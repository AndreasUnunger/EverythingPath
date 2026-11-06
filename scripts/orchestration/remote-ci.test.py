"""The CI heavy-check driver (remote_ci.py) against the verifier (remote_checks.py).

Runs the driver on a fixture candidate with a stub pnpm, publishes its directory through
remote-fetch.sh with a fake gh, and verifies the manifest statically and against the local
host exactly as a gate would. No GitHub run, network or live gate.
"""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import remote_checks
import remote_ci
from workflow_evidence import digest

spec = importlib.util.spec_from_file_location('remote_checks_fixtures', HERE / 'remote-checks.test.py')
fixtures = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixtures)

PNPM_STUB = '''#!/bin/sh
# Stub pnpm: --version, then install/typecheck/lint/test with the exit codes baked in below.
printf '%%s\\n' "$*" >> %(calls)s
env > %(envs)s/"$2".env
case "$1" in
  --version) echo %(version)s; exit 0 ;;
  install) exit %(install)d ;;
  -s) [ "$2" = typecheck ] && exit %(typecheck)d; exit %(lint)d ;;
  # A shard (--shard=i/N) copies report-<i>.json and writes its blob, exiting with exit-<i>'s code if that file exists;
  # the single run and the merge copy report.json.
  test) shard=
        for arg; do case "$arg" in --shard=*) shard=${arg#--shard=}; shard=${shard%%%%/*} ;; esac; done
        report=%(report)s; [ -n "$shard" ] && report=${report%%.json}-$shard.json
        for arg; do case "$arg" in
          --outputFile.json=*) cp "$report" "${arg#--outputFile.json=}" ;;
          --outputFile.blob=*) mkdir -p "$(dirname "${arg#--outputFile.blob=}")" && echo "fixture blob $shard" > "${arg#--outputFile.blob=}" ;;
        esac; done
        echo "fixture suite"
        [ -n "$shard" ] && [ -f %(root)s/exit-"$shard" ] && exit "$(cat %(root)s/exit-"$shard")"
        exit %(suite)d ;;
esac
exit 99
'''

GH_STUB = '''#!/bin/sh
# Fake gh: `gh run download --name <artifact> --dir <dir>` copies the artifact store's <artifact>/.
[ "$1 $2 $3" = "run download --name" ] && [ "$5" = --dir ] || exit 2
[ -d %(artifacts)s/"$4" ] || { echo "no artifact $4" >&2; exit 1; }
mkdir -p "$6" && cp -R %(artifacts)s/"$4"/. "$6"/
'''


def host_zone():
    probe = subprocess.run(['node', '-e', remote_checks.PROBE], capture_output=True, text=True, check=True, env={'PATH': os.environ['PATH']})
    return json.loads(probe.stdout)['timeZone']


class CiFixture(unittest.TestCase):
    """A fixture candidate, its depth-1 gate checkout, a stub pnpm and a fake gh."""
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(dir=os.environ['TMPDIR'])
        self.addCleanup(self.scratch.cleanup)
        self.addCleanup(fixtures.writable, self.scratch.name)
        self.root = Path(self.scratch.name)
        self.orch = self.root / 'orch'
        self.orch.mkdir()
        self.main, self.wt = fixtures.fixture_repository(self.root)
        self.base = fixtures.git(self.main, 'rev-parse', 'HEAD')
        self.tree = fixtures.git(self.wt, 'rev-parse', 'HEAD^{tree}')
        self.commit = fixtures.git(self.wt, 'rev-parse', 'HEAD')
        # CI's checkout: gate-push.sh's tree-only commit of the candidate, cloned at depth 1 as ci.yaml does.
        self.gate_commit, self.pairs, self.message = fixtures.gate_commit(self.wt, self.commit, self.base)
        self.trailers = dict(self.pairs)
        self.ci = self.clone(self.gate_commit, 'ci')
        fixtures.install(self.ci)
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        self.envs = self.root / 'envs'
        self.envs.mkdir()
        self.artifacts = self.root / 'artifacts'
        self.artifacts.mkdir()
        (self.root / 'report.json').write_text(json.dumps(fixtures.report(root=str(self.ci))))
        self.stub()
        (self.bin / 'gh').write_text(GH_STUB % dict(artifacts=self.artifacts))
        (self.bin / 'gh').chmod(0o755)
        previous = os.environ['PATH']
        os.environ['PATH'] = str(self.bin) + os.pathsep + previous
        self.addCleanup(os.environ.__setitem__, 'PATH', previous)

    def clone(self, commit, name):
        """actions/checkout with fetch-depth 1: a shallow clone of one pushed commit (via a scratch bare origin)."""
        origin = self.root / (name + '-origin.git')
        fixtures.git(self.root, 'init', '-q', '--bare', str(origin))
        fixtures.git(self.wt, 'push', '-q', str(origin), commit + ':refs/heads/gate/' + name)
        subprocess.run(['git', 'clone', '-q', '--depth', '1', '--branch', 'gate/' + name, 'file://' + str(origin), str(self.root / name)], check=True)
        return self.root / name

    def stub(self, version='10.29.1', **exits):
        codes = {**dict(install=0, typecheck=0, lint=0, suite=0), **exits}
        (self.bin / 'pnpm').write_text(PNPM_STUB % dict(calls=self.root / 'calls.log', envs=self.envs, report=self.root / 'report.json',
                                                        root=self.root, version=version, **codes))
        (self.bin / 'pnpm').chmod(0o755)

    def drive(self, tz=None, label='w1-fixture', parent=None):
        """remote_ci.run as the workflow calls it, with the runner's environment plus leaked overrides."""
        parent = parent if parent is not None else {**os.environ, 'NODE_OPTIONS': '--max-old-space-size=1', 'VITEST_POOL': 'threads',
                                                    'GOMEMLIMIT': '1GiB', 'GITHUB_TOKEN': 'secret', 'TZ': 'Pacific/Chatham'}
        output = self.root / 'github-output'
        out = self.root / 'out'
        with contextlib.redirect_stdout(io.StringIO()):
            ok = remote_ci.run(self.ci, out, self.orch, label, tz, parent=parent, github_output=output)
        values = dict(line.split('=', 1) for line in output.read_text().splitlines())
        return ok, values['run-id'], Path(values['directory'])

    def publish(self, run_id, directory):
        """The artifact upload, then remote-fetch.sh as root runs it."""
        subprocess.run(['cp', '-R', str(directory), str(self.artifacts / ('remote-checks-' + run_id))], check=True)
        fetched = subprocess.run(['bash', str(HERE / 'remote-fetch.sh'), run_id], capture_output=True, text=True,
                                 env={**os.environ, 'EP_ORCH': str(self.orch)})
        self.assertEqual(fetched.returncode, 0, fetched.stdout + fetched.stderr)
        path = self.orch / 'remote-checks' / run_id / 'manifest.json'
        self.assertEqual(fetched.stdout.strip(), digest(path))
        return path, fetched.stdout.strip()

    def gate(self, path, sha256):
        manifest = remote_checks.verify_manifest(path, sha256, self.tree, self.base, self.wt, self.orch, {self.commit})
        evidence = self.root / ('evidence-' + path.parent.name)
        evidence.mkdir()
        return manifest, remote_checks.verify_local(manifest, path, self.wt, evidence)


class RemoteCiTest(CiFixture):
    def test_driver_manifest_passes_the_verifier(self):
        ok, run_id, directory = self.drive(tz=host_zone())
        self.assertTrue(ok)
        self.assertRegex(run_id, '^' + remote_checks.RUN_ID + '$')
        self.assertTrue(run_id.startswith('w1-fixture-') and run_id.endswith('-' + self.gate_commit[:6]))
        self.assertEqual(directory, self.root / 'out' / run_id)
        manifest, local = self.gate(*self.publish(run_id, directory))
        self.assertEqual(local['files'], len(fixtures.FILES))
        self.assertEqual(manifest['directory'], str(self.orch / 'remote-checks' / run_id))
        self.assertEqual(manifest['source'], dict(commit=self.gate_commit, tree=self.tree, parents=[], trailers=self.pairs,
                                                  message=self.message, status='', root=str(self.ci)))
        self.assertEqual(self.trailers, {'Gate-Reviewed': self.commit, 'Gate-Base': self.base, 'Gate-Tree': self.tree})
        self.assertEqual([row['argv'][:4] for row in manifest['commands']][:3], [remote_checks.ARGV[name] for name in ('install', 'typecheck', 'lint')])
        self.assertEqual(manifest['commands'][3]['argv'], remote_checks.ARGV['suite'] + ['--outputFile.json=' + str(directory / 'full.json')])
        self.assertEqual(manifest['environment']['TZ'], host_zone())

    def test_commands_get_only_the_pinned_environment(self):
        ok, run_id, directory = self.drive(tz='Europe/Stockholm')
        self.assertTrue(ok)
        manifest = json.loads((directory / 'manifest.json').read_text())
        self.assertEqual(manifest['environment'], dict(CI='true', LC_ALL='C.UTF-8', VITEST_MAX_WORKERS='2', TZ='Europe/Stockholm',
                                                       timeZone='Europe/Stockholm'))
        self.assertEqual(manifest['resourceOverrides'], {})
        for name in ('typecheck', 'lint'):
            seen = dict(line.split('=', 1) for line in (self.envs / (name + '.env')).read_text().splitlines() if '=' in line)
            self.assertEqual(sorted(set(seen) - {'PWD', 'SHLVL', '_', 'OLDPWD'}), manifest['environmentKeys'])
            for leaked in ('NODE_OPTIONS', 'VITEST_POOL', 'GOMEMLIMIT', 'GITHUB_TOKEN', 'LANG'):
                self.assertNotIn(leaked, seen)
            self.assertEqual(seen['TZ'], 'Europe/Stockholm')

    def test_unset_zone_records_the_resolved_zone_without_tz(self):
        ok, run_id, directory = self.drive(tz='')
        self.assertTrue(ok)
        manifest, _ = self.gate(*self.publish(run_id, directory))
        self.assertNotIn('TZ', manifest['environment'])
        self.assertNotIn('TZ', manifest['environmentKeys'])
        self.assertEqual(manifest['environment']['timeZone'], host_zone())

    def test_another_zone_than_the_gate_hosts_is_refused(self):
        zone = 'Pacific/Chatham' if host_zone() != 'Pacific/Chatham' else 'Pacific/Honolulu'
        ok, run_id, directory = self.drive(tz=zone)
        self.assertTrue(ok)
        with self.assertRaisesRegex(RuntimeError, 'Remote timeZone mismatch'):
            self.gate(*self.publish(run_id, directory))

    def test_a_failed_command_stops_the_run_and_is_refused(self):
        self.stub(typecheck=2)
        ok, run_id, directory = self.drive(tz=host_zone())
        self.assertFalse(ok)
        manifest = json.loads((directory / 'manifest.json').read_text())
        self.assertEqual([(row['name'], row['exitCode']) for row in manifest['commands']], [('install', 0), ('typecheck', 2)])
        self.assertIs(manifest['completed'], False)
        self.assertNotIn('test', (self.root / 'calls.log').read_text().split())
        with self.assertRaisesRegex(RuntimeError, 'Remote commands missing or out of order'):
            self.gate(*self.publish(run_id, directory))

    def test_a_failed_suite_is_complete_and_refused(self):
        self.stub(suite=1)
        ok, run_id, directory = self.drive(tz=host_zone())
        self.assertFalse(ok)
        manifest = json.loads((directory / 'manifest.json').read_text())
        self.assertIs(manifest['completed'], True)
        with self.assertRaisesRegex(RuntimeError, 'Remote command failed: suite'):
            self.gate(*self.publish(run_id, directory))

    def test_manifest_is_written_last(self):
        ok, run_id, directory = self.drive(tz=host_zone())
        files = sorted(directory.iterdir(), key=lambda path: path.stat().st_mtime_ns)
        self.assertEqual(files[-1].name, 'manifest.json')
        self.assertEqual(sorted(path.name for path in files),
                         ['full.json', 'install.log', 'lint.log', 'manifest.json', 'suite.log', 'typecheck.log'])

    def test_the_manifest_binds_the_candidates_host_audit_list_and_a_listed_skip_passes(self):
        (self.root / 'report.json').write_text(json.dumps(fixtures.report(root=str(self.ci), skipped=(fixtures.AUDITED[0],))))
        ok, run_id, directory = self.drive(tz=host_zone())
        self.assertTrue(ok)
        manifest, local = self.gate(*self.publish(run_id, directory))
        self.assertEqual(manifest['hostAudits'], dict(file=remote_checks.AUDITS, sha256=digest(self.wt / remote_checks.AUDITS)))
        self.assertEqual(local['files'], len(fixtures.FILES))

    def test_an_unlisted_skip_is_refused(self):
        (self.root / 'report.json').write_text(json.dumps(fixtures.report(root=str(self.ci), skipped=fixtures.FILES[:1])))
        ok, run_id, directory = self.drive(tz=host_zone())
        self.assertTrue(ok)
        with self.assertRaisesRegex(RuntimeError, 'Remote suite has pending or todo tests: not in the host-audit list: tests/a.test.ts'):
            self.gate(*self.publish(run_id, directory))

    def test_label_and_candidate_refusals(self):
        for label in ('', 'Gate-R1', 'a/b', 'w1 fixture', 'w1_fixture'):
            with self.assertRaisesRegex(RuntimeError, 'Invalid gate label'):
                remote_ci.run_id(label, self.commit)
        self.assertTrue(re.fullmatch(remote_checks.RUN_ID, remote_ci.run_id('retro-w1-q1', self.commit)))
        (self.ci / 'source.txt').write_text('dirty\n')
        with self.assertRaisesRegex(RuntimeError, 'Candidate checkout not clean'):
            self.drive(tz='')
        self.assertFalse((self.root / 'out').exists())

    def test_only_a_tree_only_gate_commit_is_checked(self):
        """CI stops before any command on a checkout that is not gate-push.sh's commit; even at depth 1,
        where Git hides a shallow commit's parents, the raw commit object still names them."""
        trailers = lambda **changes: {**self.trailers, **changes}
        cases = [(self.commit, 'Gate commit has parents'),
                 (fixtures.gate_commit(self.wt, self.commit, self.base, trailers(**{'Gate-Base': self.base[:12]}))[0], 'Gate commit trailer not a full SHA: Gate-Base'),
                 (fixtures.gate_commit(self.wt, self.commit, self.base, {k: v for k, v in self.trailers.items() if k != 'Gate-Tree'})[0],
                  'Gate commit trailer missing: Gate-Tree'),
                 (fixtures.gate_commit(self.wt, self.commit, self.base, trailers(**{'Gate-Tree': self.base}))[0], 'Gate commit tree is not its Gate-Tree')]
        repeated = fixtures.git(self.wt, 'commit-tree', self.tree, '-m', 'gate: fixture\n\n' + ''.join('%s: %s\n' % item for item in self.trailers.items())
                                + 'Gate-Reviewed: ' + self.base + '\n')
        cases.append((repeated, 'Gate commit trailer repeated: Gate-Reviewed'))
        for index, (commit, reason) in enumerate(cases):
            with self.subTest(reason=reason):
                checkout = self.clone(commit, 'bad%d' % index)
                self.assertEqual(fixtures.git(checkout, 'rev-parse', '--is-shallow-repository'), 'true')
                with self.assertRaisesRegex(RuntimeError, reason):
                    remote_ci.source(checkout)
                self.ci = checkout
                with self.assertRaisesRegex(RuntimeError, reason):
                    self.drive(tz='')
                self.assertFalse((self.root / 'out').exists())
                self.assertFalse((self.root / 'calls.log').exists())

    def refused_everywhere(self, checkout, reason):
        """CI refuses checkout before any command: remote_ci.source, `remote_ci.py probe` and the run."""
        with self.assertRaisesRegex(RuntimeError, reason):
            remote_ci.source(checkout)
        probe = subprocess.run([sys.executable, '-B', str(HERE / 'remote_ci.py'), 'probe'], cwd=checkout, capture_output=True, text=True)
        self.assertEqual((probe.returncode, probe.stdout), (1, ''))
        self.assertRegex(probe.stderr, '^remote_ci probe refused: .*' + reason)
        self.ci = checkout
        with self.assertRaisesRegex(RuntimeError, reason):
            self.drive(tz='')
        self.assertFalse((self.root / 'out').exists())
        self.assertFalse((self.root / 'calls.log').exists())

    def test_every_message_beyond_the_three_trailers_is_refused_by_the_probe_and_the_verifier(self):
        """The pinned corpus as raw parentless commits cloned at depth 1: CI refuses each before any command, and the
        verifier refuses the facts CI would record for it (remote_ci.read_source), so neither path accepts one."""
        gate = remote_ci.read_source(self.ci)
        self.assertEqual(remote_checks.gate_source(gate, self.tree, self.base, self.wt, {self.commit}), self.commit)
        for index, (name, message, reason) in enumerate(fixtures.bad_gate_messages(self.pairs)):
            with self.subTest(name=name):
                commit = fixtures.gate_commit(self.wt, self.commit, self.base, message=message)[0]
                checkout = self.clone(commit, 'message%d' % index)
                facts = remote_ci.read_source(checkout)
                self.assertEqual((facts['commit'], facts['parents'], facts['message']), (commit, [], message))
                self.assertEqual(facts['trailers'], fixtures.recorded_trailers(message))
                with self.assertRaisesRegex(RuntimeError, reason):
                    remote_checks.gate_source(facts, self.tree, self.base, self.wt, None)
                self.refused_everywhere(checkout, reason)

    def test_a_checkout_that_hides_changes_from_status_is_not_clean(self):
        """The clean check holds whatever the checkout's configuration or index says."""
        cases = [('untracked with status.showUntrackedFiles=no', 'Candidate checkout not clean',
                  lambda c: (fixtures.git(c, 'config', 'status.showUntrackedFiles', 'no'), (c / 'new.txt').write_text('new\n'))),
                 ('assume-unchanged', 'Candidate checkout index hides worktree changes',
                  lambda c: (fixtures.git(c, 'update-index', '--assume-unchanged', 'source.txt'), (c / 'source.txt').write_text('hidden\n'))),
                 ('skip-worktree', 'Candidate checkout index hides worktree changes',
                  lambda c: (fixtures.git(c, 'update-index', '--skip-worktree', 'source.txt'), (c / 'source.txt').write_text('hidden\n'))),
                 ('a corrupt index', 'Candidate checkout status failed', lambda c: (c / '.git/index').write_text('not an index\n'))]
        for index, (name, reason, spoil) in enumerate(cases):
            with self.subTest(name=name):
                checkout = self.clone(self.gate_commit, 'spoilt%d' % index)
                spoil(checkout)
                self.refused_everywhere(checkout, reason)

    def test_probe_prints_the_gate_commit_facts(self):
        """`remote_ci.py probe`, ci.yaml's first step after checkout: the commit, its tree, parents and trailers."""
        probe = subprocess.run([sys.executable, '-B', str(HERE / 'remote_ci.py'), 'probe'], cwd=self.ci, capture_output=True, text=True)
        self.assertEqual(probe.returncode, 0, probe.stderr)
        self.assertEqual(json.loads(probe.stdout), dict(commit=self.gate_commit, tree=self.tree, parents=[], trailers=self.pairs,
                                                        message=self.message, status='', root=str(self.ci)))
        refused = subprocess.run([sys.executable, '-B', str(HERE / 'remote_ci.py'), 'probe'], cwd=self.wt, capture_output=True, text=True)
        self.assertEqual((refused.returncode, refused.stdout), (1, ''))
        self.assertIn('Gate commit has parents', refused.stderr)


class ShardedCiTest(CiFixture):
    """The sharded jobs (speed-ci-shards): static, N shards and the assemble job, whose parts reach it as the
    downloaded artifacts remote-static/ and remote-shard-<i>/, all on one checkout path as on GitHub's runners."""
    def setUp(self):
        super().setUp()
        for index, files in enumerate(fixtures.shard_files(2), 1):
            (self.root / ('report-%d.json' % index)).write_text(json.dumps(fixtures.report(files=files, root=str(self.ci))))
        self.parts = self.root / 'parts'

    def jobs(self, total=2, tz=None, shard_zone=None, drop=()):
        """Every job in turn, as ci.yaml runs them: (static passed, [shard passed], assemble passed, runId, directory)."""
        tz = host_zone() if tz is None else tz
        with contextlib.redirect_stdout(io.StringIO()):
            static = remote_ci.static(self.ci, self.parts / 'remote-static', tz)
            shards = [remote_ci.shard(self.ci, self.parts / ('remote-shard-%d' % index), index, total,
                                      shard_zone if shard_zone and index == total else tz) for index in range(1, total + 1)]
        for index in drop:
            shutil.rmtree(self.parts / ('remote-shard-%d' % index))
        output = self.root / 'github-output'
        with contextlib.redirect_stdout(io.StringIO()) as log:
            assembled = remote_ci.assemble(self.ci, self.root / 'out', self.orch, 'w1-fixture', tz, self.parts, total, github_output=output)
        self.log = log.getvalue()
        values = dict(line.split('=', 1) for line in output.read_text().splitlines())
        return static, shards, assembled, values['run-id'], Path(values['directory'])

    def manifest(self, directory):
        return json.loads((directory / 'manifest.json').read_text())

    def test_the_jobs_assemble_a_manifest_the_verifier_accepts(self):
        static, shards, assembled, run_id, directory = self.jobs()
        self.assertEqual((static, shards, assembled), (True, [True, True], True))
        self.assertRegex(run_id, '^' + remote_checks.RUN_ID + '$')
        manifest, local = self.gate(*self.publish(run_id, directory))
        self.assertEqual(local['files'], len(fixtures.FILES))
        self.assertEqual([row['name'] for row in manifest['commands']], list(remote_checks.ARGV))
        self.assertEqual(manifest['commands'][3]['argv'], remote_checks.ARGV['suite'] + [
            '--merge-reports=' + str(directory / 'blobs'), '--outputFile.json=' + str(directory / 'full.json')])
        part = self.parts / 'remote-shard-2'
        self.assertEqual(manifest['shards'][1]['argv'], remote_checks.ARGV['suite'] + [
            '--reporter=blob', '--shard=2/2', '--outputFile.json=' + str(part / 'shard-2.json'), '--outputFile.blob=' + str(part / 'blobs/blob-2.json')])
        self.assertEqual(manifest['static']['source'], dict(commit=self.gate_commit, tree=self.tree, root=str(self.ci), status=''))
        self.assertEqual(manifest['completed'], True)
        files = sorted(str(path.relative_to(directory)) for path in directory.rglob('*') if path.is_file())
        self.assertEqual(files, ['blobs/blob-1.json', 'blobs/blob-2.json', 'full.json', 'install.log', 'lint.log', 'manifest.json',
                                 'shards/shard-1.json', 'shards/shard-1.log', 'shards/shard-2.json', 'shards/shard-2.log',
                                 'suite.log', 'typecheck.log'])
        written = sorted(directory.rglob('*'), key=lambda path: path.stat().st_mtime_ns)
        self.assertEqual(written[-1].name, 'manifest.json')

    def test_a_failed_shard_is_recorded_and_refused(self):
        (self.root / 'exit-2').write_text('1')
        static, shards, assembled, run_id, directory = self.jobs()
        self.assertEqual((static, shards, assembled), (True, [True, False], False))
        self.assertEqual([row['exitCode'] for row in self.manifest(directory)['shards']], [0, 1])
        with self.assertRaisesRegex(RuntimeError, 'Remote shard failed: 2'):
            self.gate(*self.publish(run_id, directory))

    def test_a_missing_shard_part_is_recorded_and_refused(self):
        static, shards, assembled, run_id, directory = self.jobs(drop=(2,))
        self.assertFalse(assembled)
        self.assertIn('no remote-shard-part-v1 part at', self.log)
        manifest = self.manifest(directory)
        self.assertEqual(([row['index'] for row in manifest['shards']], manifest['completed']), ([1], False))
        with self.assertRaisesRegex(RuntimeError, 'Remote shards incomplete: 1 of 2'):
            self.gate(*self.publish(run_id, directory))

    def test_a_missing_static_part_is_refused(self):
        static, shards, assembled, run_id, directory = self.jobs()
        shutil.rmtree(self.parts / 'remote-static')
        shutil.rmtree(self.root / 'out')
        (self.root / 'github-output').unlink()
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertFalse(remote_ci.assemble(self.ci, self.root / 'out', self.orch, 'w1-fixture', host_zone(), self.parts, 2,
                                                github_output=self.root / 'github-output'))
        directory = next((self.root / 'out').iterdir())
        with self.assertRaisesRegex(RuntimeError, 'Remote commands missing or out of order'):
            self.gate(*self.publish(directory.name, directory))

    def test_a_failed_static_job_is_recorded_and_refused(self):
        self.stub(typecheck=2)
        static, shards, assembled, run_id, directory = self.jobs()
        self.assertEqual((static, assembled), (False, False))
        self.assertEqual([(row['name'], row['exitCode']) for row in self.manifest(directory)['commands']],
                         [('install', 0), ('typecheck', 2), ('suite', 0)])
        with self.assertRaisesRegex(RuntimeError, 'Remote commands missing or out of order'):
            self.gate(*self.publish(run_id, directory))

    def test_a_shard_with_another_zone_or_toolchain_is_refused(self):
        zone = 'Pacific/Chatham' if host_zone() != 'Pacific/Chatham' else 'Pacific/Honolulu'
        static, shards, assembled, run_id, directory = self.jobs(shard_zone=zone)
        self.assertEqual((shards, assembled), ([True, True], False))
        self.assertIn("facts differ from this job's: shard 2", self.log)
        with self.assertRaisesRegex(RuntimeError, 'Remote shard 2 environment mismatch'):
            self.gate(*self.publish(run_id, directory))
        shutil.rmtree(self.parts)
        with contextlib.redirect_stdout(io.StringIO()):
            remote_ci.static(self.ci, self.parts / 'remote-static', host_zone())
            remote_ci.shard(self.ci, self.parts / 'remote-shard-1', 1, 2, host_zone())
            self.stub(version='10.0.0')
            remote_ci.shard(self.ci, self.parts / 'remote-shard-2', 2, 2, host_zone())
            self.stub()
            remote_ci.assemble(self.ci, self.root / 'out2', self.orch, 'w1-other', host_zone(), self.parts, 2)
        directory = next((self.root / 'out2').iterdir())
        with self.assertRaisesRegex(RuntimeError, 'Remote shard 2 toolchain mismatch'):
            self.gate(*self.publish(directory.name, directory))

    def test_a_job_refuses_a_bad_shard_or_a_non_gate_checkout_before_running(self):
        for index, total in ((0, 2), (3, 2), (1, 0)):
            with self.assertRaisesRegex(RuntimeError, 'Invalid shard'):
                remote_ci.shard(self.ci, self.parts / 'bad', index, total, '')
        (self.ci / 'source.txt').write_text('dirty\n')
        for run in (lambda: remote_ci.static(self.ci, self.parts / 'remote-static', ''),
                    lambda: remote_ci.shard(self.ci, self.parts / 'remote-shard-1', 1, 2, ''),
                    lambda: remote_ci.assemble(self.ci, self.root / 'out', self.orch, 'w1-fixture', '', self.parts, 2)):
            with self.assertRaisesRegex(RuntimeError, 'Candidate checkout not clean'):
                run()
        self.assertFalse(self.parts.exists() or (self.root / 'out').exists() or (self.root / 'calls.log').exists())

    def test_the_command_lines_ci_yaml_runs(self):
        """static, shard and assemble through main(), each in the checkout as its job runs it."""
        zone = host_zone()
        def cli(*args):
            return subprocess.run([sys.executable, '-B', str(HERE / 'remote_ci.py'), *args], cwd=self.ci, capture_output=True, text=True,
                                  env={**os.environ, 'GITHUB_OUTPUT': str(self.root / 'github-output')})
        for args in (('static', '--tz', zone, '--out', str(self.parts / 'remote-static')),
                     *(('shard', '--index', str(index), '--total', '2', '--tz', zone, '--out', str(self.parts / ('remote-shard-%d' % index)))
                       for index in (1, 2)),
                     ('assemble', '--label', 'w1-fixture', '--orch', str(self.orch), '--tz', zone, '--out', str(self.root / 'out'),
                      '--parts', str(self.parts), '--total', '2')):
            ran = cli(*args)
            self.assertEqual(ran.returncode, 0, ran.stdout + ran.stderr)
        values = dict(line.split('=', 1) for line in (self.root / 'github-output').read_text().splitlines())
        manifest, local = self.gate(*self.publish(values['run-id'], Path(values['directory'])))
        self.assertEqual(manifest['runner']['provider'], 'github-actions')
        self.assertEqual(cli('shard', '--index', '1', '--out', str(self.parts / 'x')).returncode, 2)


GATE = "${{ github.event_name == 'push' && startsWith(github.ref, 'refs/heads/gate/') }}"


class WorkflowTest(unittest.TestCase):
    """ci.yaml's gate jobs (remote-shard, remote-static, remote-checks), read as GitHub reads them."""
    def setUp(self):
        import yaml
        self.workflow = yaml.safe_load((HERE.parent.parent / '.github/workflows/ci.yaml').read_text())
        self.jobs = {name: self.workflow['jobs'][name] for name in ('remote-shard', 'remote-static', 'remote-checks')}
        self.shard, self.static, self.assemble = self.jobs.values()

    def step(self, job, id):
        steps = [step for step in job['steps'] if step.get('id') == id]
        self.assertEqual(len(steps), 1, id)
        return steps[0]

    def test_each_gate_job_checks_out_the_pushed_commit_alone_and_probes_it_first(self):
        # gate-push.sh pushes a parentless commit; the tests that need history are host audits (owner 2026-11-02).
        for name, job in self.jobs.items():
            with self.subTest(job=name):
                self.assertEqual(job['if'], GATE if job is not self.assemble else GATE.replace('${{ ', '${{ always() && '))
                self.assertEqual(job['permissions'], dict(contents='read'))
                steps = job['steps']
                checkout = [index for index, step in enumerate(steps) if str(step.get('uses', '')).startswith('actions/checkout@')]
                self.assertEqual(checkout, [0])
                self.assertEqual(steps[0]['with']['fetch-depth'], 1)
                self.assertIs(steps[0]['with']['persist-credentials'], False)
                self.assertEqual(steps[1].get('id'), 'probe')
                self.assertIn('python3 -B scripts/orchestration/remote_ci.py probe', steps[1]['run'])
                self.assertIn('GITHUB_STEP_SUMMARY', steps[1]['run'])

    def test_every_gate_job_runs_on_githubs_free_runner_and_logs_its_hardware(self):
        # Owner 2026-11-06: GitHub's standard runners are free for this public repository (4 vCPU, 16 GB).
        self.assertEqual(self.workflow['jobs']['checks']['runs-on'], 'ubuntu-latest')
        self.assertNotIn('blacksmith', (HERE.parent.parent / '.github/workflows/ci.yaml').read_text())
        for name, work in (('remote-shard', 'shard'), ('remote-static', 'static'), ('remote-checks', 'assemble')):
            with self.subTest(job=name):
                job = self.jobs[name]
                self.assertEqual(job['runs-on'], 'ubuntu-latest')
                ids = [step.get('id') for step in job['steps']]
                self.assertLess(ids.index('runner'), ids.index(work))
                script = self.step(job, 'runner')['run']
                for command in ('nproc', 'lscpu', 'free -g', 'RUNNER_NAME'):
                    self.assertIn(command, script)
                self.assertIn('echo "runner label: %s"' % job['runs-on'], script)

    def test_the_shard_matrix_is_one_to_n_and_every_job_agrees_on_n(self):
        strategy = self.shard['strategy']
        self.assertIs(strategy['fail-fast'], False)
        indexes = strategy['matrix']['index']
        self.assertEqual(indexes, list(range(1, len(indexes) + 1)))
        self.assertEqual(len(indexes), 8)
        total = '--total %d' % len(indexes)
        self.assertIn(total, self.step(self.shard, 'shard')['run'])
        self.assertIn('--index ${{ matrix.index }}', self.step(self.shard, 'shard')['run'])
        self.assertIn(total, self.step(self.assemble, 'assemble')['run'])

    def test_each_job_runs_its_part_through_the_driver_and_uploads_it_even_on_failure(self):
        for job, mode in ((self.shard, 'shard'), (self.static, 'static')):
            with self.subTest(job=mode):
                self.assertIn('python3 -B scripts/orchestration/remote_ci.py %s ' % mode, self.step(job, mode)['run'])
                self.assertIn('--tz "$GATE_TZ"', self.step(job, mode)['run'])
                upload = self.step(job, 'upload')
                self.assertTrue(upload['uses'].startswith('actions/upload-artifact@'))
                self.assertEqual(upload['if'], '${{ always() }}')
                self.assertIs(upload['with']['overwrite'], True)
        self.assertEqual(self.step(self.shard, 'upload')['with']['name'], 'remote-shard-${{ matrix.index }}')
        self.assertEqual(self.step(self.static, 'upload')['with']['name'], 'remote-static')
        for job in self.jobs.values():
            self.assertEqual(job['env']['GATE_TZ'], 'Europe/Stockholm')

    def test_the_assemble_job_waits_for_every_part_runs_anyway_and_publishes_the_one_artifact(self):
        self.assertEqual(sorted(self.assemble['needs']), ['remote-shard', 'remote-static'])
        downloads = [step for step in self.assemble['steps'] if str(step.get('uses', '')).startswith('actions/download-artifact@')]
        self.assertEqual(sorted((step['with'].get('pattern') or step['with'].get('name')) for step in downloads), ['remote-shard-*', 'remote-static'])
        for step in downloads:
            self.assertIs(step.get('continue-on-error'), True)
        run = self.step(self.assemble, 'assemble')['run']
        for argument in ('python3 -B scripts/orchestration/remote_ci.py assemble', '--orch "$GATE_EP_ORCH"', '--tz "$GATE_TZ"', '--parts'):
            self.assertIn(argument, run)
        upload = self.step(self.assemble, 'upload')
        self.assertEqual(upload['with']['name'], 'remote-checks-${{ steps.assemble.outputs.run-id }}')
        self.assertEqual(upload['with']['path'], '${{ steps.assemble.outputs.directory }}')
        self.assertEqual(upload['with']['if-no-files-found'], 'error')
        self.assertEqual(self.assemble['env']['GATE_EP_ORCH'], '/home/andreas/repos/everythingpath/ep-orch')

    def test_the_pinned_environment_holds_in_every_gate_job(self):
        """The pinned argv and environment come from remote_checks.py; no job sets a Vitest or Node override."""
        for name, job in self.jobs.items():
            with self.subTest(job=name):
                text = json.dumps(job)
                for override in ('VITEST_', 'NODE_OPTIONS', '--shard='):
                    self.assertNotIn(override, text)
        self.assertEqual(remote_checks.ENVIRONMENT['VITEST_MAX_WORKERS'], '2')


if __name__ == '__main__':
    unittest.main()
