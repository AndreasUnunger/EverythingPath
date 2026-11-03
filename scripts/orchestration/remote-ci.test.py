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
  --version) echo 10.29.1; exit 0 ;;
  install) exit %(install)d ;;
  -s) [ "$2" = typecheck ] && exit %(typecheck)d; exit %(lint)d ;;
  test) for arg; do case "$arg" in --outputFile.json=*) cp %(report)s "${arg#--outputFile.json=}" ;; esac; done
        echo "fixture suite"; exit %(suite)d ;;
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


class RemoteCiTest(unittest.TestCase):
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

    def stub(self, **exits):
        codes = {**dict(install=0, typecheck=0, lint=0, suite=0), **exits}
        (self.bin / 'pnpm').write_text(PNPM_STUB % dict(calls=self.root / 'calls.log', envs=self.envs, report=self.root / 'report.json', **codes))
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


class WorkflowTest(unittest.TestCase):
    """ci.yaml's remote-checks job, read as GitHub reads it."""
    def setUp(self):
        import yaml
        self.workflow = yaml.safe_load((HERE.parent.parent / '.github/workflows/ci.yaml').read_text())
        self.job = self.workflow['jobs']['remote-checks']

    def test_gate_checkout_is_the_pushed_commit_alone_and_probed_first(self):
        # gate-push.sh pushes a parentless commit; the tests that need history are host audits (owner 2026-11-02).
        steps = self.job['steps']
        checkout = [index for index, step in enumerate(steps) if str(step.get('uses', '')).startswith('actions/checkout@')]
        self.assertEqual(checkout, [0])
        self.assertEqual(steps[0]['with']['fetch-depth'], 1)
        self.assertIs(steps[0]['with']['persist-credentials'], False)
        self.assertEqual(steps[1].get('id'), 'probe')
        self.assertIn('python3 -B scripts/orchestration/remote_ci.py probe', steps[1]['run'])
        self.assertIn('GITHUB_STEP_SUMMARY', steps[1]['run'])

    def test_heavy_checks_run_on_blacksmith_and_the_light_job_stays_on_github(self):
        # Root 2026-11-03: 4 vCPU, since Vitest is pinned to 2 workers; the light job stays on GitHub's free runner.
        self.assertEqual(self.job['runs-on'], 'blacksmith-4vcpu-ubuntu-2404')
        self.assertEqual(self.workflow['jobs']['checks']['runs-on'], 'ubuntu-latest')

    def test_the_runner_hardware_is_logged_before_the_heavy_checks(self):
        # Blacksmith may give a job the next size up, so each run records what it got.
        ids = [step.get('id') for step in self.job['steps']]
        self.assertLess(ids.index('runner'), ids.index('heavy'))
        script = self.job['steps'][ids.index('runner')]['run']
        for command in ('nproc', 'lscpu', 'free -g', 'RUNNER_NAME'):
            self.assertIn(command, script)

    def test_the_job_runs_plain_pnpm_test_through_the_driver_on_linux(self):
        self.assertEqual(self.job['if'], "${{ github.event_name == 'push' && startsWith(github.ref, 'refs/heads/gate/') }}")
        heavy = [step for step in self.job['steps'] if step.get('id') == 'heavy']
        self.assertEqual(len(heavy), 1)
        self.assertIn('python3 -B scripts/orchestration/remote_ci.py', heavy[0]['run'])


if __name__ == '__main__':
    unittest.main()
