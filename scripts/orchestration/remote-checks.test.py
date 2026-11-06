"""Remote heavy-check manifest contracts. Synthetic fixtures; no Boat run or live gate.

`python3 -B remote-checks.test.py fixture ORCH WT BASE [mutation]` publishes a passing
fixture manifest for cur-land.test.sh and prints `<path> <sha256>`; `report ROOT [key=n...]
[files=FILE,...] [skipped=FILE,...] [failed=FILE,...]` prints a matching local suite report (failed
marks a file failed under green counters); `audit-list` prints
the fixture's host-audit list.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import remote_checks
from workflow_evidence import digest

ROOT = '/remote/checkout'
FILES = ('tests/a.test.ts', 'tests/b.test.ts')
# The fixture's host-audit list: b's test needs the gate host's sources (it may skip remotely).
AUDITED = ('tests/b.test.ts', 'suite tests/b.test.ts works')
AUDIT_LIST = dict(kind='host-audits-v1', sources=['~/repos/everythingpath/sources/fixture'],
                  tests=[dict(file=AUDITED[0], fullName=AUDITED[1])])
VITEST_STUB = '''import { writeFileSync } from 'node:fs';
const out = process.argv.find((arg) => arg.startsWith('--json=')).slice(7);
writeFileSync(out, process.env.FIXTURE_VITEST_LIST ?? JSON.stringify(%s.map((file) => ({ file: process.cwd() + '/' + file }))));
''' % json.dumps(list(FILES))


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()


def blob_sha(root, tree, name):
    blob = subprocess.run(['git', '-C', str(root), 'cat-file', 'blob', tree + ':' + name], capture_output=True)
    return hashlib.sha256(blob.stdout).hexdigest() if blob.returncode == 0 else None


def report(files=FILES, root=ROOT, skipped=(), beside=(), **changes):
    """A passing report in Vitest 4's JSON shape: each file is a module suite holding one describe
    `suite <file>` with the test `works`; in skipped files `works` skips, as a missing host source makes
    it; files in beside also hold a passing `stays`. As in the real reporter (the empty-HOME reports of
    retro W1 fix r1), a skip moves only the test counters: a file of skipped tests is still `passed`
    and its suites count as passed, never pending."""
    def test(name, title, status):
        return dict(ancestorTitles=['suite ' + name], fullName='suite ' + name + ' ' + title, status=status, title=title,
                    failureMessages=[], meta={})
    results = [dict(name=root + '/' + name, status='passed', message='', startTime=0, endTime=1, assertionResults=[
        test(name, 'works', 'skipped' if name in skipped else 'passed'), *([test(name, 'stays', 'passed')] if name in beside else [])])
        for name in files]
    tests = [test['status'] for item in results for test in item['assertionResults']]
    value = dict(numTotalTestSuites=2 * len(files), numPassedTestSuites=2 * len(files), numFailedTestSuites=0, numPendingTestSuites=0,
                 numTotalTests=len(tests), numPassedTests=tests.count('passed'), numFailedTests=0, numPendingTests=tests.count('skipped'),
                 numTodoTests=0, snapshot=dict(added=0, updated=0, filesAdded=0, unmatched=0, matched=0, total=0, filesUpdated=0),
                 startTime=0, success=True, testResults=results)
    value.update(changes)
    return value


def failed_file(value, index=-1):
    """The fail-open shape: one file marked failed (an afterAll hook threw, say) under green counters."""
    value['testResults'][index].update(status='failed', message='Error: hook failed')
    return value


def failed_suite(value):
    """The other fail-open shape: a failed suite counted while success and every test stay green."""
    value.update(numFailedTestSuites=1, numPassedTestSuites=value['numPassedTestSuites'] - 1)
    return value


def gate_message(trailers, body='Tree-only CI commit of REVIEWED for the heavy checks; no history.'):
    """gate-push.sh's message shape: subject, body, then one `Key: value` line per [key, value] pair."""
    return 'gate: fixture\n\n%s\n\n%s' % (body, ''.join('%s: %s\n' % tuple(pair) for pair in trailers))


def gate_commit(root, reviewed, base, trailers=None, message=None):
    """A parentless commit of reviewed's tree whose raw message is message, or gate_message of trailers (a dict
    or [key, value] pairs; by default gate-push.sh's three). Returns the commit, the pairs and the message."""
    tree = git(root, 'rev-parse', reviewed + '^{tree}')
    trailers = {'Gate-Reviewed': reviewed, 'Gate-Base': base, 'Gate-Tree': tree} if trailers is None else trailers
    pairs = [list(pair) for pair in (trailers.items() if isinstance(trailers, dict) else trailers)]
    message = gate_message(pairs) if message is None else message
    commit = subprocess.run(['git', '-C', str(root), 'commit-tree', tree], input=message, capture_output=True, text=True, check=True)
    return commit.stdout.strip(), pairs, message


def bad_gate_messages(three):
    """The pinned corpus of gate commit messages that are not gate-push.sh's, given its three [key, value] trailer
    pairs: every way a message can carry a trailer or gate key beyond those three, each once and a full SHA.
    (name, message, the refusal both the CI probe and the verifier give)."""
    reviewed, base, tree = (value for _, value in three)
    block = ''.join('%s: %s\n' % tuple(pair) for pair in three)
    with_base = lambda value: [three[0], ['Gate-Base', value], three[2]]
    return [
        ('an extra Gate-Other trailer', gate_message(three + [['Gate-Other', base]]), 'Unexpected gate commit trailer: Gate-Other'),
        ('a lower-case gate key', gate_message(three + [['gate-reviewed', reviewed]]), 'Unexpected gate commit trailer: gate-reviewed'),
        ('a misspelt gate key', gate_message(three + [['Gate-Reviewd', reviewed]]), 'Unexpected gate commit trailer: Gate-Reviewd'),
        ('a non-gate trailer', gate_message(three + [['Co-Authored-By', 'Fixture <fixture@example.test>']]),
         'Unexpected gate commit trailer: Co-Authored-By'),
        ('a repeated key, same value', gate_message(three + [three[0]]), 'Gate commit trailer repeated: Gate-Reviewed'),
        ('a repeated key, another value', gate_message(three + [['Gate-Base', reviewed]]), 'Gate commit trailer repeated: Gate-Base'),
        ('an abbreviated SHA', gate_message(with_base(base[:12])), 'Gate commit trailer not a full SHA: Gate-Base'),
        ('an upper-case SHA', gate_message(with_base(base.upper())), 'Gate commit trailer not a full SHA: Gate-Base'),
        ('a SHA with a suffix', gate_message(with_base(base + ' extra')), 'Gate commit trailer not a full SHA: Gate-Base'),
        ('an empty value', gate_message(with_base('')), 'Gate commit trailer not a full SHA: Gate-Base'),
        ('a missing trailer', gate_message(three[:2]), 'Gate commit trailer missing: Gate-Tree'),
        ('no trailer block', 'gate: fixture\n', 'Gate commit trailer missing: Gate-Reviewed'),
        ('a gate key in the body', gate_message(three, body='Gate-Other: ' + base), 'Gate commit names a gate key outside its trailers'),
        ('an indented gate key in the body', gate_message(three, body='  gate-base: ' + base), 'Gate commit names a gate key outside its trailers'),
        ('the trailers in the subject paragraph', block, 'Gate commit names a gate key outside its trailers'),
        ('another separator', gate_message(three) + 'Gate-Other = ' + base + '\n', 'Gate commit trailer block has a non-trailer line'),
        ('a folded value', gate_message(three) + ' ' + tree + '\n', 'Gate commit trailer block has a non-trailer line'),
        ('a paragraph after the trailers', gate_message(three) + '\nlast words\n', 'Gate commit trailer block has a non-trailer line'),
    ]


def retrail(source, **changes):
    """Changes some trailer values of a manifest source, in its message and its recorded trailers alike."""
    pairs = [[key, changes.get(key, value)] for key, value in source['trailers']]
    source.update(trailers=pairs, message=gate_message(pairs))


def recorded_trailers(message):
    """Every trailer Git parses from message as [key, value] pairs, as remote_ci.py records them."""
    parsed = subprocess.run(['git', 'interpret-trailers', '--parse'], input=message, capture_output=True, text=True, check=True).stdout
    return [list(line.partition(': ')[::2]) for line in parsed.splitlines()]


def manifest_value(directory, run_id, wt, base, facts):
    tree, reviewed = git(wt, 'rev-parse', 'HEAD^{tree}'), git(wt, 'rev-parse', 'HEAD')
    commit, trailers, message = gate_commit(wt, reviewed, base)
    commands = []
    for name, argv in (('install', ['pnpm', 'install', '--offline', '--frozen-lockfile']), ('typecheck', ['pnpm', '-s', 'typecheck']),
                       ('lint', ['pnpm', '-s', 'lint']),
                       ('suite', ['pnpm', 'test', '--reporter=default', '--reporter=json', '--outputFile.json=' + ROOT + '/full.json'])):
        commands.append(dict(name=name, argv=argv, exitCode=0, startedAt='2026-10-30T10:00:00Z', endedAt='2026-10-30T10:01:00Z',
                             elapsedSeconds=60, log=dict(file=name + '.log')))
    commands[-1]['report'] = dict(file='full.json')
    return {'kind': 'remote-heavy-checks-v1', 'runId': run_id, 'directory': str(directory),
            'runner': dict(provider='boat', vm='fixture-vm', snapshot='fixture-snapshot', parentThread='fixture-thread'),
            'source': dict(commit=commit, tree=tree, parents=[], trailers=trailers, message=message, status='', root=ROOT),
            'lockfile': {'pnpm-lock.yaml': blob_sha(wt, tree, 'pnpm-lock.yaml'), 'package.json': blob_sha(wt, tree, 'package.json'),
                         'installedLock': digest(Path(wt) / 'node_modules/.pnpm/lock.yaml')},
            'toolchain': {key: facts[key] for key in ('node', 'pnpm', 'platform', 'arch')},
            'environment': dict(CI='true', LC_ALL='C.UTF-8', VITEST_MAX_WORKERS='2', TZ=facts['timeZone'], timeZone=facts['timeZone']),
            'environmentKeys': ['CI', 'HOME', 'LC_ALL', 'PATH', 'TZ', 'VITEST_MAX_WORKERS'], 'resourceOverrides': dict(GOMEMLIMIT='9GiB'),
            'commands': commands, 'completed': True, 'createdAt': '2026-10-30T10:05:00Z',
            'hostAudits': dict(file=remote_checks.AUDITS, sha256=blob_sha(wt, tree, remote_checks.AUDITS))}


def publish(orch, wt, base, run_id, mutate=None, files=None, raw=None, readonly=True):
    """Boat's publication order: logs and report, manifest last, then everything read-only."""
    directory = Path(orch) / 'remote-checks' / run_id
    directory.mkdir(parents=True)
    value = manifest_value(directory, run_id, wt, base, remote_checks.local_facts(wt))
    contents = {command['name'] + '.log': 'fixture ' + command['name'] + ' output\n' for command in value['commands']}
    contents['full.json'] = json.dumps(report())
    contents.update(files or {})
    for name, content in contents.items():
        (directory / name).write_text(content)
    for command in value['commands']:
        for key in ('log', 'report'):
            if key in command and (directory / command[key]['file']).is_file():
                command[key]['sha256'] = digest(directory / command[key]['file'])
    if mutate:
        mutate(value, directory)
    path = directory / 'manifest.json'
    path.write_text(raw(value) if raw else json.dumps(value, indent=2))
    if readonly:
        for item in directory.rglob('*'):
            if not item.is_symlink():
                item.chmod(0o444 if item.is_file() else 0o555)
        directory.chmod(0o555)
    return path, digest(path)


def fixture_repository(root):
    """A main checkout whose implementation worktree holds one candidate on top of BASE."""
    main, wt = Path(root) / 'main', Path(root) / 'wt'
    main.mkdir(parents=True)
    git(main, 'init', '-q', '-b', 'feature')
    git(main, 'config', 'user.name', 'Fixture')
    git(main, 'config', 'user.email', 'fixture@example.test')
    (main / 'package.json').write_text('{"name":"fixture"}\n')
    (main / 'pnpm-lock.yaml').write_text('lockfileVersion: fixture\n')
    (main / '.gitignore').write_text('node_modules/\n')
    (main / 'tests').mkdir()
    for name in FILES:
        (main / name).write_text('// fixture test\n')
    (main / remote_checks.AUDITS).parent.mkdir(parents=True)
    (main / remote_checks.AUDITS).write_text(json.dumps(AUDIT_LIST, indent=2) + '\n')
    git(main, 'add', '.')
    git(main, 'commit', '-qm', 'base')
    git(main, 'worktree', 'add', '-qb', 'implementation', str(wt))
    (wt / 'source.txt').write_text('candidate\n')
    git(wt, 'add', '.')
    git(wt, 'commit', '-qm', 'candidate')
    install(wt)
    return main, wt


def install(wt):
    (Path(wt) / 'node_modules/.pnpm').mkdir(parents=True, exist_ok=True)
    (Path(wt) / 'node_modules/.pnpm/lock.yaml').write_text('installed fixture\n')
    (Path(wt) / 'node_modules/vitest').mkdir(parents=True, exist_ok=True)
    (Path(wt) / 'node_modules/vitest/vitest.mjs').write_text(VITEST_STUB)


def fixture_tools(root):
    """A pnpm stub on PATH; node is the real one (the stub vitest runs in it)."""
    binary = Path(root) / 'bin'
    binary.mkdir(exist_ok=True)
    (binary / 'pnpm').write_text('#!/bin/sh\n[ "$1" = --version ] && echo 10.29.1\nexit 0\n')
    (binary / 'pnpm').chmod(0o755)
    return binary


def writable(root):
    for path in Path(root).rglob('*'):
        if not path.is_symlink():
            path.chmod(0o755 if path.is_dir() else 0o644)


class Fixture(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(dir=os.environ['TMPDIR'])
        self.addCleanup(self.scratch.cleanup)
        self.addCleanup(writable, self.scratch.name)
        self.root = Path(self.scratch.name)
        self.orch = self.root / 'orch'
        self.orch.mkdir()
        self.main, self.wt = fixture_repository(self.root)
        self.base = git(self.main, 'rev-parse', 'HEAD')
        self.tree = git(self.wt, 'rev-parse', 'HEAD^{tree}')
        self.commit = git(self.wt, 'rev-parse', 'HEAD')
        previous = os.environ['PATH']
        os.environ['PATH'] = str(fixture_tools(self.root)) + os.pathsep + previous
        self.addCleanup(os.environ.__setitem__, 'PATH', previous)
        self.runs = 0

    def publish(self, mutate=None, **options):
        self.runs += 1
        return publish(self.orch, self.wt, self.base, 'fixture-20261030-120000-%06x' % self.runs, mutate, **options)

    def verify(self, path, sha256, commits=None, tree=None, base=None):
        return remote_checks.verify_manifest(path, sha256, tree or self.tree, base or self.base, self.wt, self.orch, commits)

    def full(self, path, sha256):
        evidence = self.root / ('evidence-%d' % self.runs)
        evidence.mkdir()
        manifest = self.verify(path, sha256)
        return remote_checks.verify_local(manifest, path, self.wt, evidence)

    def refuses(self, reason, mutate=None, local=False, **options):
        path, sha256 = self.publish(mutate, **options)
        with self.assertRaisesRegex(RuntimeError, reason):
            self.full(path, sha256) if local else self.verify(path, sha256)


class RemoteManifestTest(Fixture):
    def test_passing_fixture_is_accepted_statically_and_locally(self):
        path, sha256 = self.publish()
        manifest = self.verify(path, sha256, commits={self.commit})
        self.assertEqual(manifest['source']['tree'], self.tree)
        local = self.full(path, sha256)
        self.assertEqual(local['files'], len(FILES))

    def retrailed(self, **changes):
        """A mutation giving the manifest source gate-push.sh's message with some trailer values changed, recorded alike."""
        return lambda m, d: retrail(m['source'], **changes)

    def three(self):
        return [['Gate-Reviewed', self.commit], ['Gate-Base', self.base], ['Gate-Tree', self.tree]]

    def test_identity_refusals(self):
        self.refuses('Remote tree mismatch', lambda m, d: m['source'].update(tree='0' * 40))
        self.refuses('Remote base mismatch', self.retrailed(**{'Gate-Base': self.commit}))
        path, sha256 = self.publish()
        with self.assertRaisesRegex(RuntimeError, 'Remote Gate-Reviewed is not the reviewed or prepared commit'):
            self.verify(path, sha256, commits={self.base})
        orphan = git(self.wt, 'commit-tree', self.tree, '-m', 'unrelated history with the same tree')
        self.refuses('Remote Gate-Reviewed does not descend from base', self.retrailed(**{'Gate-Reviewed': orphan}))
        self.refuses('Remote Gate-Reviewed tree mismatch', self.retrailed(**{'Gate-Reviewed': self.base}))
        self.refuses('Remote Gate-Reviewed unknown', self.retrailed(**{'Gate-Reviewed': '1' * 40}))
        self.refuses('Remote commit unknown', lambda m, d: m['source'].update(commit=self.commit[:12]))
        self.refuses('Remote source status not clean', lambda m, d: m['source'].update(status=' M source.txt'))

    def test_an_amended_sibling_with_the_same_tree_and_parent_is_not_the_reviewed_commit(self):
        """A curation candidate is its prep commit (curation-remote slice B): CI of a message-only amend of it, same
        tree and parent, never stands in for it; v1 re-preps and re-pushes."""
        sibling = git(self.wt, 'commit-tree', self.tree, '-p', self.base, '-m', 'the prep commit with another message')
        path, sha256 = self.publish(self.retrailed(**{'Gate-Reviewed': sibling}))
        self.assertEqual(self.verify(path, sha256)['source']['tree'], self.tree, 'unrestricted, the sibling is a valid gate source')
        with self.assertRaisesRegex(RuntimeError, 'Remote Gate-Reviewed is not the reviewed or prepared commit'):
            self.verify(path, sha256, commits={self.commit})

    def test_tree_only_gate_commit_refusals(self):
        """The remote commit is gate-push.sh's: parentless, Gate-Tree its tree, and its message's trailers recorded."""
        path, sha256 = self.publish()
        source = self.verify(path, sha256, commits={self.commit})['source']
        self.assertEqual(source['trailers'], self.three())
        self.assertEqual(source['trailers'], recorded_trailers(source['message']))
        self.assertEqual(git(self.wt, 'cat-file', '-p', source['commit']).count('\nparent '), 0)
        self.refuses('Gate commit has parents', lambda m, d: m['source'].update(parents=[self.base]))
        self.refuses('Gate commit parents missing', lambda m, d: m['source'].pop('parents'))
        self.refuses('Gate commit parents missing', lambda m, d: m['source'].update(parents=None))
        self.refuses('Gate commit tree is not its Gate-Tree', self.retrailed(**{'Gate-Tree': self.base}))
        self.refuses('Gate commit message missing', lambda m, d: m['source'].pop('message'))
        self.refuses('Gate commit message missing', lambda m, d: m['source'].update(message=None))
        # The recorded trailers are the message's, every one of them.
        for trailers in (None, [], {'Gate-Reviewed': self.commit}, self.three()[:2], self.three() + [['Gate-Other', self.base]],
                         self.three() + [self.three()[0]], [[key.lower(), value] for key, value in self.three()]):
            self.refuses("Gate commit trailers are not its message's", lambda m, d, trailers=trailers: m['source'].update(trailers=trailers))
        self.refuses("Gate commit trailers are not its message's", lambda m, d: m['source'].pop('trailers'))

    def test_every_message_beyond_the_three_trailers_is_refused(self):
        """The pinned corpus, as remote_ci.py records each message (Git's parse of its trailers)."""
        for name, message, reason in bad_gate_messages(self.three()):
            with self.subTest(name=name):
                self.refuses(reason, lambda m, d, message=message: m['source'].update(trailers=recorded_trailers(message), message=message))
        # A manifest of the W1 shape (the full-history candidate and its base) is refused, not reinterpreted.
        self.refuses('Unexpected remote source field: base', lambda m, d: m['source'].update(base=self.base))
        path, sha256 = self.publish()
        with self.assertRaisesRegex(RuntimeError, 'Remote tree mismatch'):
            self.verify(path, sha256, tree='2' * 40)
        with self.assertRaisesRegex(RuntimeError, 'Remote base mismatch'):
            self.verify(path, sha256, base=self.commit)

    def test_install_and_toolchain_refusals(self):
        self.refuses('Remote lockfile mismatch: pnpm-lock.yaml', lambda m, d: m['lockfile'].update({'pnpm-lock.yaml': '0' * 64}))
        self.refuses('Remote lockfile mismatch: package.json', lambda m, d: m['lockfile'].update({'package.json': '0' * 64}))
        self.refuses('Remote installed lock mismatch', lambda m, d: m['lockfile'].update(installedLock='0' * 64), local=True)
        for key, value in (('node', 'v20.0.0'), ('pnpm', '9.0.0'), ('platform', 'darwin'), ('arch', 'arm64')):
            self.refuses('Remote toolchain mismatch: ' + key, lambda m, d, key=key, value=value: m['toolchain'].update({key: value}), local=True)
        self.refuses('Remote timeZone mismatch', lambda m, d: m['environment'].update(TZ='Pacific/Chatham', timeZone='Pacific/Chatham'), local=True)
        path, sha256 = self.publish()
        (self.wt / 'node_modules/.pnpm/lock.yaml').write_text('another installation\n')
        with self.assertRaisesRegex(RuntimeError, 'Remote installed lock mismatch'):
            self.full(path, sha256)

    def test_environment_and_override_refusals(self):
        self.refuses('Remote environment mismatch: CI', lambda m, d: m['environment'].update(CI='false'))
        self.refuses('Remote environment mismatch: LC_ALL', lambda m, d: m['environment'].update(LC_ALL='en_US.UTF-8'))
        self.refuses('Remote environment mismatch: VITEST_MAX_WORKERS', lambda m, d: m['environment'].update(VITEST_MAX_WORKERS='4'))
        self.refuses('Remote environment mismatch: CI', lambda m, d: m['environmentKeys'].remove('CI'))
        for key in ('VITEST_POOL', 'NODE_OPTIONS', 'GOMEMLIMIT'):
            self.refuses('Remote environment override: ' + key, lambda m, d, key=key: m['environmentKeys'].append(key))
        self.refuses('Unexpected remote environment value: HOME', lambda m, d: m['environment'].update(HOME='/root'))
        self.refuses('Remote timeZone missing', lambda m, d: m['environment'].pop('timeZone'))
        self.refuses('Remote resource override not allowed: NODE_OPTIONS',
                     lambda m, d: m['resourceOverrides'].update(NODE_OPTIONS='--max-old-space-size=99999'))
        path, sha256 = self.publish(lambda m, d: m.pop('resourceOverrides'))
        self.verify(path, sha256)

    def test_argv_refusals(self):
        def change(index, argv):
            return lambda m, d: m['commands'][index].update(argv=argv)
        self.refuses('Remote argv not canonical: install', change(0, ['pnpm', 'install', '--offline']))
        self.refuses('Remote argv not canonical: typecheck', change(1, ['pnpm', 'typecheck']))
        self.refuses('Remote argv not canonical: lint', change(2, ['pnpm', '-s', 'lint', '--fix']))
        suite = ['pnpm', 'test', '--reporter=default', '--reporter=json']
        for drift in (suite + ['--outputFile.json=/out.json', 'tests/a.test.ts'], suite + ['--outputFile.json=/out.json', '--shard=1/2'],
                      suite + ['-t', 'works', '--outputFile.json=/out.json'], suite + ['--outputFile.json=relative.json'],
                      ['pnpm', 'test', '--reporter=json', '--reporter=default', '--outputFile.json=/out.json']):
            self.refuses('Remote argv not canonical: suite', change(3, drift))

    def test_completion_refusals(self):
        self.refuses('Remote commands missing or out of order', lambda m, d: m['commands'].pop(2))
        self.refuses('Remote commands missing or out of order', lambda m, d: m['commands'].insert(1, m['commands'].pop(2)))
        for value in ('0', True, 0.0, None):
            self.refuses('Remote exit code not an integer: lint', lambda m, d, value=value: m['commands'][2].update(exitCode=value))
        self.refuses('Remote command failed: typecheck', lambda m, d: m['commands'][1].update(exitCode=2))
        self.refuses('Remote run not completed', lambda m, d: m.update(completed=False))
        self.refuses('Remote timing missing: install', lambda m, d: m['commands'][0].pop('startedAt'))

    def test_suite_refusals(self):
        def suite(**changes):
            return {'full.json': json.dumps(report(**changes))}
        self.refuses('Remote suite was not all green', files=suite(success=False, numFailedTests=1, numPassedTests=1))
        self.refuses('Remote assertions do not reconcile with numPendingTests', files=suite(numPendingTests=1))
        self.refuses('Remote suite has pending or todo tests: not in the host-audit list: tests/a.test.ts > suite tests/a.test.ts works',
                     files=suite(skipped=FILES[:1]))
        self.refuses('Remote suite was not all green', files=suite(numTodoTests=1))
        self.refuses('Remote suite file not passed: tests/b.test.ts', files={'full.json': json.dumps(failed_file(report()))})
        self.refuses('Remote suite was not all green', files={'full.json': json.dumps(failed_suite(report()))})
        # Vitest 4 counts a skipped suite as passed; a pending suite is an unfinished run or a todo suite.
        self.refuses('Remote suite was not all green', files=suite(numPassedTestSuites=3, numPendingTestSuites=1))
        # Vitest 4 never writes a skipped file (JsonReporter: failed or passed), so none is accepted.
        skipped_file = report(skipped=(AUDITED[0],))
        skipped_file['testResults'][1]['status'] = 'skipped'
        self.refuses('Remote suite file not passed: tests/b.test.ts', files={'full.json': json.dumps(skipped_file)})
        for key in ('added', 'updated', 'filesAdded', 'unmatched'):
            self.refuses('Remote suite wrote snapshots', files=suite(snapshot={**report()['snapshot'], key: 1}))
        outside = report()
        outside['testResults'][0]['name'] = '/elsewhere/tests/a.test.ts'
        self.refuses('Remote test file outside its root', files={'full.json': json.dumps(outside)})
        path, sha256 = self.publish()
        os.environ['FIXTURE_VITEST_LIST'] = json.dumps([dict(file=str(self.wt / name)) for name in (*FILES, 'tests/c.test.ts')])
        try:
            with self.assertRaisesRegex(RuntimeError, 'Remote test file set differs: .*tests/c.test.ts'):
                self.full(path, sha256)
        finally:
            os.environ.pop('FIXTURE_VITEST_LIST')

    def test_a_listed_host_audit_may_skip_remotely(self):
        path, sha256 = self.publish(files={'full.json': json.dumps(report(skipped=(AUDITED[0],)))})
        self.assertEqual(self.full(path, sha256)['files'], len(FILES))
        path, sha256 = self.publish(files={'full.json': json.dumps(report(skipped=(AUDITED[0],), beside=FILES))})
        self.assertEqual(self.full(path, sha256)['files'], len(FILES))
        path, sha256 = self.publish()
        self.assertEqual(self.full(path, sha256)['files'], len(FILES))

    def test_host_audit_refusals(self):
        missing = report()
        missing['testResults'][1]['assertionResults'][0].update(title='renamed', fullName='suite tests/b.test.ts renamed')
        self.refuses('Remote suite lacks a host-audit test: tests/b.test.ts > suite tests/b.test.ts works',
                     files={'full.json': json.dumps(missing)})
        self.refuses('Remote host-audit list hash mismatch', lambda m, d: m['hostAudits'].update(sha256='0' * 64))
        self.refuses('Remote host-audit list missing', lambda m, d: m.pop('hostAudits'))
        self.refuses('Remote host-audit list missing', lambda m, d: m['hostAudits'].update(file='host-audits.json'))
        todo = report(skipped=(AUDITED[0],), numPendingTests=0, numTodoTests=1)
        todo['testResults'][1]['assertionResults'][0]['status'] = 'todo'
        self.refuses('Remote suite was not all green', files={'full.json': json.dumps(todo)})
        failed = report(success=False, numPassedTests=1, numFailedTests=1, numPassedTestSuites=2, numFailedTestSuites=2)
        failed['testResults'][1].update(status='failed')
        failed['testResults'][1]['assertionResults'][0]['status'] = 'failed'
        self.refuses('Remote suite was not all green', files={'full.json': json.dumps(failed)})

    def test_the_candidate_must_carry_a_well_formed_list(self):
        for value, reason in ((dict(AUDIT_LIST, kind='other'), 'Invalid host-audit list'),
                              (dict(AUDIT_LIST, tests=[]), 'Invalid host-audit list'),
                              (dict(AUDIT_LIST, tests=AUDIT_LIST['tests'] * 2), 'Host-audit list not sorted and unique'),
                              (dict(AUDIT_LIST, tests=[dict(file='../b.test.ts', fullName='x')]), 'Invalid host-audit list'),
                              (dict(AUDIT_LIST, extra=1), 'Invalid host-audit list')):
            with self.subTest(reason=reason, value=value):
                (self.wt / remote_checks.AUDITS).write_text(json.dumps(value))
                git(self.wt, 'commit', '-qam', 'list')
                self.tree = git(self.wt, 'rev-parse', 'HEAD^{tree}')
                self.refuses(reason)
        git(self.wt, 'rm', '-q', remote_checks.AUDITS)
        git(self.wt, 'commit', '-qm', 'no list')
        self.tree = git(self.wt, 'rev-parse', 'HEAD^{tree}')
        self.refuses('Host-audit list missing from the candidate', lambda m, d: m['hostAudits'].update(sha256='0' * 64))

    def test_assertion_evidence_must_reconcile_with_the_counters(self):
        def suite(value):
            return {'full.json': json.dumps(value)}
        vacuous = report()
        for item in vacuous['testResults']:
            item['assertionResults'] = []
        self.refuses('Remote test file has no assertions: tests/a.test.ts', files=suite(vacuous))
        one = report()
        one['testResults'][1]['assertionResults'] = []
        self.refuses('Remote test file has no assertions: tests/b.test.ts', files=suite(one))
        extra = report()
        extra['testResults'][0]['assertionResults'].append(dict(extra['testResults'][0]['assertionResults'][0], title='again',
                                                                fullName='suite tests/a.test.ts again'))
        self.refuses('Remote assertions do not reconcile with numTotalTests', files=suite(extra))
        self.refuses('Remote assertions do not reconcile with numTotalTests', files=suite(report(numTotalTests=3, numPassedTests=3)))
        for change in (dict(fullName=''), dict(title=''), dict(fullName='another name'), dict(ancestorTitles='suite tests/a.test.ts'),
                       dict(title=None)):
            bad = report()
            bad['testResults'][0]['assertionResults'][0].update(change)
            self.refuses('Remote assertion identity invalid in tests/a.test.ts', files=suite(bad))
        # Real parameterised titles can repeat within a file (770b2a: 15 such names): counted, never collapsed.
        repeated = report(numTotalTests=3, numPassedTests=3)
        repeated['testResults'][0]['assertionResults'].append(dict(repeated['testResults'][0]['assertionResults'][0]))
        path, sha256 = self.publish(files=suite(repeated))
        self.assertEqual(self.full(path, sha256)['files'], len(FILES))

    def test_evidence_integrity_refusals(self):
        path, sha256 = self.publish()
        outside = self.root / 'outside.json'
        outside.write_text('{}')
        self.refuses('Remote report not allowed: typecheck',
                     lambda m, d: m['commands'][1].update(report=dict(file=str(outside), sha256='0' * 64)))
        self.refuses('Remote report not allowed: lint',
                     lambda m, d: m['commands'][2].update(report=dict(m['commands'][2]['log'])))
        with self.assertRaisesRegex(RuntimeError, 'Remote manifest hash mismatch'):
            self.verify(path, '0' * 64)
        self.refuses('Remote evidence hash mismatch: lint log', lambda m, d: (d / 'lint.log').write_text('rewritten after hashing\n'))
        self.refuses('Remote evidence hash mismatch: suite report', lambda m, d: m['commands'][3]['report'].update(sha256='0' * 64))
        def symlink(m, d):
            (d / 'lint.log').unlink()
            (d / 'lint.log').symlink_to(d / 'install.log')
            m['commands'][2]['log']['sha256'] = digest(d / 'install.log')
        self.refuses('Remote evidence symlink: lint log', symlink)
        self.refuses('Remote evidence escapes directory: lint log', lambda m, d: m['commands'][2]['log'].update(file='../lint.log'))
        self.refuses('Remote evidence escapes directory: lint log', lambda m, d: m['commands'][2]['log'].update(file=str(d / 'lint.log')))
        self.refuses('Remote directory is not the manifest parent', lambda m, d: m.update(directory=str(self.orch / 'elsewhere')))
        self.refuses('Remote evidence writable', readonly=False)
        self.refuses('Duplicate JSON field: completed', raw=lambda m: json.dumps(m)[:-1] + ', "completed": true}')
        self.refuses('Invalid remote runId', lambda m, d: m.update(runId='Fixture_bad'))
        moved = self.root / 'moved'
        shutil.copytree(path.parent, moved / 'remote-checks' / path.parent.name)
        with self.assertRaisesRegex(RuntimeError, 'Remote manifest outside ORCH/remote-checks'):
            self.verify(moved / 'remote-checks' / path.parent.name / 'manifest.json', sha256)
        linked = self.orch / 'remote-checks' / 'fixture-20261030-120000-ffffff'
        linked.symlink_to(path.parent)
        with self.assertRaisesRegex(RuntimeError, 'Remote manifest path not canonical'):
            self.verify(linked / 'manifest.json', sha256)

    def test_config_refusals(self):
        path, sha256 = self.publish()
        self.assertEqual(remote_checks.config(dict(path=str(path), sha256=sha256, mode='replace'))['mode'], 'replace')
        for value in (dict(path=str(path), sha256=sha256, mode='skip'), dict(path=str(path), sha256=sha256),
                      dict(path=str(path), sha256=sha256, mode='compare', fallback='local'), 'replace'):
            with self.assertRaisesRegex(RuntimeError, 'remoteChecks'):
                remote_checks.config(value)


class RemoteComparisonTest(Fixture):
    def compare(self, local, remote=None):
        path, sha256 = self.publish(files={'full.json': json.dumps(remote)} if remote else None)
        local_path = self.root / ('local-%d.json' % self.runs)
        local_path.write_text(json.dumps(local))
        return remote_checks.compare_reports(path, sha256, self.orch, local_path, self.wt / remote_checks.AUDITS)

    def test_equal_reports_compare_from_another_root(self):
        result = self.compare(report(root='/home/fixture/ep-gate-wt-20261030-120000-abc123'))
        self.assertEqual((result['tests'], result['hostAudits']), (len(FILES), dict(listed=1, passedLocally=1, skippedRemotely=0)))

    def test_a_listed_remote_skip_compares_equal_when_it_passes_locally(self):
        result = self.compare(report(root='/gate'), remote=report(skipped=(AUDITED[0],)))
        self.assertEqual(result['hostAudits'], dict(listed=1, passedLocally=1, skippedRemotely=1))

    def test_listed_skips_inside_passed_files_compare_equal_with_equal_suite_totals(self):
        # The real CI shape (empty-HOME shard 1: six listed skips, 426 passed suites, none pending): the
        # listed skip sits beside passed tests in a passed file and only the test counters move.
        remote, local = report(skipped=(AUDITED[0],), beside=FILES), report(root='/gate', beside=FILES)
        self.assertEqual({key: remote[key] for key in remote if key.endswith('TestSuites')},
                         {key: local[key] for key in local if key.endswith('TestSuites')})
        result = self.compare(local, remote=remote)
        self.assertEqual((result['tests'], result['hostAudits']), (4, dict(listed=1, passedLocally=1, skippedRemotely=1)))
        self.assertEqual((result['totals']['numPassedTests'], result['totals']['numPendingTests']), (3, 1))

    def test_a_failed_local_file_or_suite_never_compares_equal(self):
        cases = (('failed b', lambda: failed_file(report(root='/gate')), 'Local suite file not passed: tests/b.test.ts'),
                 ('failed a', lambda: failed_file(report(root='/gate'), 0), 'Local suite file not passed: tests/a.test.ts'),
                 ('failed suite', lambda: failed_suite(report(root='/gate')), 'Local suite was not all green'),
                 ('unsuccessful', lambda: report(root='/gate', success=False), 'Local suite was not all green'),
                 ('pending suite', lambda: report(root='/gate', numPassedTestSuites=3, numPendingTestSuites=1), 'Local suite was not all green'))
        for remote in (None, report(skipped=(AUDITED[0],))):
            for name, local, reason in cases:
                with self.subTest(name, remote='listed skip' if remote else 'green'), self.assertRaisesRegex(RuntimeError, reason):
                    self.compare(local(), remote=remote)

    def test_the_remote_report_is_judged_as_verify_judges_it(self):
        for remote, reason in ((failed_file(report()), 'Remote suite file not passed: tests/b.test.ts'),
                               (failed_suite(report()), 'Remote suite was not all green'),
                               (report(skipped=FILES[:1]), 'Remote suite has pending or todo tests: not in the host-audit list')):
            with self.subTest(reason=reason), self.assertRaisesRegex(RuntimeError, reason):
                self.compare(report(root='/gate'), remote=remote)

    def test_host_audits_must_pass_locally(self):
        for status in ('skipped', 'failed'):
            local = report(root='/gate', skipped=(AUDITED[0],))
            local['testResults'][1]['assertionResults'][0]['status'] = status
            if status == 'failed':
                local.update(success=False, numPendingTests=0, numFailedTests=1, numPassedTestSuites=2, numFailedTestSuites=2)
                local['testResults'][1]['status'] = 'failed'
            with self.subTest(status=status), self.assertRaisesRegex(
                    RuntimeError, 'Host-audit test not passed locally: %s: tests/b.test.ts > suite tests/b.test.ts works' % status):
                self.compare(local, remote=report(skipped=(AUDITED[0],)))

    def test_the_list_must_be_the_manifests(self):
        path, sha256 = self.publish()
        local = self.root / 'local.json'
        local.write_text(json.dumps(report(root='/gate')))
        other = self.root / 'other-list.json'
        other.write_text(json.dumps(dict(AUDIT_LIST, sources=['elsewhere'])))
        with self.assertRaisesRegex(RuntimeError, 'Host-audit list hash mismatch'):
            remote_checks.compare_reports(path, sha256, self.orch, local, other)

    def test_missing_extra_status_and_total_differences_refuse(self):
        def with_extra(value):
            value['testResults'][0]['assertionResults'].append(dict(ancestorTitles=[], title='extra', fullName='extra', status='passed'))
            return value
        differ = 'Remote and local suites differ outside the host-audit list: '
        with self.assertRaisesRegex(RuntimeError, differ + '1 only remote, 0 only local'):
            self.compare(report(root='/gate'), remote=with_extra(report(numTotalTests=3, numPassedTests=3)))
        with self.assertRaisesRegex(RuntimeError, differ + '0 only remote, 1 only local'):
            self.compare(with_extra(report(root='/gate', numTotalTests=3, numPassedTests=3)))
        with self.assertRaisesRegex(RuntimeError, differ + '1 only remote, 1 only local'):
            self.compare(report(root='/gate', skipped=FILES[:1]))
        with self.assertRaisesRegex(RuntimeError, differ + '1 only remote, 1 only local'):
            self.compare(report(root='/gate', skipped=FILES[:1]), remote=report(skipped=(AUDITED[0],)))
        with self.assertRaisesRegex(RuntimeError, 'Remote and local totals differ: numPassedTestSuites, numTotalTestSuites'):
            self.compare(report(root='/gate', numTotalTestSuites=5, numPassedTestSuites=5))
        # A listed remote skip moves test counters only: suite totals stay equal (Vitest 4 counts skipped suites as passed).
        with self.assertRaisesRegex(RuntimeError, 'Remote and local totals differ: numPassedTestSuites, numTotalTestSuites'):
            self.compare(report(root='/gate'), remote=report(skipped=(AUDITED[0],), numTotalTestSuites=3, numPassedTestSuites=3))
        with self.assertRaisesRegex(RuntimeError, 'Host-audit test not passed locally: missing: tests/b.test.ts > suite tests/b.test.ts works'):
            self.compare(report(files=FILES[:1], root='/gate', numTotalTestSuites=4, numPassedTestSuites=4))
        with self.assertRaisesRegex(RuntimeError, differ + '1 only remote, 0 only local'):
            self.compare(report(files=FILES[1:], root='/gate', numTotalTestSuites=4, numPassedTestSuites=4))

    def test_vacuous_or_unreconciled_reports_never_compare_equal(self):
        def vacuous(value):
            for item in value['testResults']:
                item['assertionResults'] = []
            return value
        with self.assertRaisesRegex(RuntimeError, 'Local test file has no assertions: tests/a.test.ts'):
            self.compare(vacuous(report(root='/gate')))
        with self.assertRaisesRegex(RuntimeError, 'Remote test file has no assertions: tests/a.test.ts'):
            self.compare(report(root='/gate'), remote=vacuous(report()))
        with self.assertRaisesRegex(RuntimeError, 'Remote test file has no assertions: tests/a.test.ts'):
            self.compare(vacuous(report(root='/gate')), remote=vacuous(report()))
        with self.assertRaisesRegex(RuntimeError, 'Local assertions do not reconcile with numTotalTests'):
            self.compare(report(root='/gate', numTotalTests=3, numPassedTests=3))
        local = report(root='/gate')
        local['testResults'][1]['assertionResults'][0]['status'] = 'skipped'
        with self.assertRaisesRegex(RuntimeError, 'Local assertions do not reconcile with numPassedTests'):
            self.compare(local)
        local = report(root='/gate')
        local['testResults'][0]['assertionResults'][0]['fullName'] = ''
        with self.assertRaisesRegex(RuntimeError, 'Local assertion identity invalid in tests/a.test.ts'):
            self.compare(local)


class RemoteCommandTest(Fixture):
    def command(self, *args):
        return subprocess.run([sys.executable, '-B', str(HERE / 'remote_checks.py'), *map(str, args)],
                              capture_output=True, text=True, env={**os.environ, 'EP_ORCH': str(self.orch)})

    def test_verify_records_a_create_only_verdict(self):
        path, sha256 = self.publish()
        evidence = self.root / 'remote-evidence'
        result = self.command('verify', path, sha256, self.wt, self.base, evidence)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('remote verified ' + str(path), result.stdout)
        record = json.loads((evidence / 'remote-verification.json').read_text())
        self.assertEqual((record['passed'], record['manifest'], record['candidate'], record['tree'], record['base']),
                         (True, dict(path=str(path), sha256=sha256), self.commit, self.tree, self.base))
        self.assertTrue((evidence / 'local-files.json').is_file())
        again = self.command('verify', path, sha256, self.wt, self.base, evidence)
        self.assertNotEqual(again.returncode, 0)
        self.assertEqual(json.loads((evidence / 'remote-verification.json').read_text()), record)

    def test_refused_verify_records_its_reason_and_fails(self):
        path, sha256 = self.publish(lambda m, d: m['commands'][3].update(exitCode=1))
        evidence = self.root / 'refused-evidence'
        result = self.command('verify', path, sha256, self.wt, self.base, evidence)
        self.assertEqual(result.returncode, 1)
        self.assertIn('remote refused: Remote command failed: suite', result.stdout)
        record = json.loads((evidence / 'remote-verification.json').read_text())
        self.assertEqual((record['passed'], record['error']), (False, 'Remote command failed: suite'))

    def test_compare_records_its_verdict(self):
        path, sha256 = self.publish()
        evidence = self.root / 'compare-evidence'
        evidence.mkdir()
        local = self.root / 'full.json'
        local.write_text(json.dumps(report(root='/gate')))
        audits = self.wt / remote_checks.AUDITS
        result = self.command('compare', path, sha256, local, audits, evidence)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('remote compare: equal', result.stdout)
        record = json.loads((evidence / 'remote-comparison.json').read_text())
        self.assertEqual((record['passed'], record['local'], record['hostAudits']),
                         (True, dict(path=str(local), sha256=digest(local)), dict(path=str(audits), sha256=digest(audits))))
        self.assertEqual(record['comparison']['hostAudits'], dict(listed=1, passedLocally=1, skippedRemotely=0))
        other = self.root / 'other-evidence'
        other.mkdir()
        local.write_text(json.dumps(report(root='/gate', numTotalTests=9)))
        result = self.command('compare', path, sha256, local, audits, other)
        self.assertEqual(result.returncode, 1)
        self.assertFalse(json.loads((other / 'remote-comparison.json').read_text())['passed'])


class HostAuditTest(Fixture):
    """The gate host's run of exactly the listed tests (host-audits.sh runs it; remote_checks.py audit judges it)."""
    def host_report(self, status='passed', extra=(), root='/gate/ep-gate-audits'):
        """Vitest 4's report for `pnpm test tests/b.test.ts -t <listed>`: b's listed test plus filtered (skipped)
        others. As in the real dry run (retro W1 fix r1, host-audit-dryrun.json): the file and its two suites
        (module, describe) pass while the filter skips tests; a failed test fails the file and both suites."""
        tests = [dict(fullName=AUDITED[1], title='works', ancestorTitles=['suite tests/b.test.ts'], status=status, failureMessages=[], meta={})]
        tests += [dict(fullName='suite tests/b.test.ts ' + title, title=title, ancestorTitles=['suite tests/b.test.ts'], status=state,
                       failureMessages=[], meta={}) for title, state in extra]
        statuses = [test['status'] for test in tests]
        failed = 'failed' in statuses
        return dict(numTotalTestSuites=2, numPassedTestSuites=0 if failed else 2, numFailedTestSuites=2 if failed else 0,
                    numPendingTestSuites=0, numTotalTests=len(tests),
                    numPassedTests=statuses.count('passed'), numFailedTests=statuses.count('failed'),
                    numPendingTests=statuses.count('skipped'), numTodoTests=statuses.count('todo'),
                    snapshot=report()['snapshot'], startTime=0, success=not failed,
                    testResults=[dict(name=root + '/' + AUDITED[0], status='failed' if failed else 'passed', message='', startTime=0, endTime=1,
                                      assertionResults=tests)])

    def audit(self, value, exit_code=0, audits=None, root='/gate/ep-gate-audits'):
        path, sha256 = self.publish()
        report_path = self.root / ('host-%d.json' % self.runs)
        report_path.write_text(json.dumps(value))
        evidence = self.root / ('audit-evidence-%d' % self.runs)
        evidence.mkdir()
        result = subprocess.run([sys.executable, '-B', str(HERE / 'remote_checks.py'), 'audit', str(path), sha256,
                                 str(audits or self.wt / remote_checks.AUDITS), str(report_path), root, str(exit_code), str(evidence)],
                                capture_output=True, text=True, env={**os.environ, 'EP_ORCH': str(self.orch)})
        return result, json.loads((evidence / 'host-audits.json').read_text())

    def test_listed_tests_passing_with_the_rest_filtered_out_is_recorded(self):
        result, record = self.audit(self.host_report(extra=[('reads nothing', 'skipped')]))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('host-audits passed: 1 listed tests in 1 files', result.stdout)
        self.assertEqual((record['kind'], record['passed'], record['exitCode'], record['result']),
                         ('host-audits-verification-v1', True, 0, dict(tests=1, files=1)))
        self.assertEqual(record['list'], dict(path=str(self.wt / remote_checks.AUDITS), sha256=digest(self.wt / remote_checks.AUDITS)))

    def test_refusals(self):
        other = self.root / 'other-list.json'
        other.write_text(json.dumps(dict(AUDIT_LIST, sources=['elsewhere'])))
        for value, options, reason in (
                (self.host_report('skipped'), {}, 'Host-audit test not passed on the gate host: skipped: tests/b.test.ts > suite tests/b.test.ts works'),
                (self.host_report('failed'), dict(exit_code=1),
                 'Host-audit test not passed on the gate host: failed: tests/b.test.ts > suite tests/b.test.ts works'),
                (self.host_report(extra=[('reads nothing', 'passed')]), {},
                 'Host audits ran an unlisted test: tests/b.test.ts > suite tests/b.test.ts reads nothing'),
                (self.host_report(extra=[('later', 'todo')]), {}, 'Host audits ran an unlisted test: tests/b.test.ts > suite tests/b.test.ts later'),
                (dict(self.host_report(), testResults=[dict(self.host_report()['testResults'][0], assertionResults=[
                    dict(self.host_report()['testResults'][0]['assertionResults'][0], title='renamed', fullName='suite tests/b.test.ts renamed',
                         status='skipped')])], numPassedTests=0, numPendingTests=1), {},
                 'Host-audit test not passed on the gate host: missing: tests/b.test.ts > suite tests/b.test.ts works'),
                (self.host_report(), dict(audits=other), 'Host-audit list hash mismatch'),
                (self.host_report(), dict(exit_code=2), 'Host-audit run exited 2'),
                (self.host_report(), dict(root='/elsewhere'), 'Host audit test file outside its root'),
                # Every listed test passed, yet the report declares a failure: the verdict the remote suite() gives.
                (failed_file(self.host_report(extra=[('reads nothing', 'skipped')])), {}, 'Host audit suite file not passed: tests/b.test.ts'),
                (failed_suite(self.host_report()), {}, 'Host audit suite was not all green'),
                (dict(self.host_report(), success=False), {}, 'Host audit suite was not all green'),
                (dict(self.host_report(), numPassedTestSuites=1, numPendingTestSuites=1), {}, 'Host audit suite was not all green')):
            with self.subTest(reason=reason):
                result, record = self.audit(value, **options)
                self.assertEqual(result.returncode, 1)
                self.assertIn('host-audits refused: ' + reason, result.stdout)
                self.assertIs(record['passed'], False)
                self.assertTrue(record['error'].startswith(reason), record['error'])

    def test_selection_runs_exactly_the_listed_tests(self):
        selection = subprocess.run([sys.executable, '-B', str(HERE / 'remote_checks.py'), 'selection', str(self.wt / remote_checks.AUDITS)],
                                   capture_output=True, check=True).stdout.split(b'\0')
        self.assertEqual(selection, [b'--testNamePattern=^(?:suite tests/b\\.test\\.ts works)$', b'tests/b.test.ts', b''])
        listed = dict(AUDIT_LIST, tests=[dict(file='tests/a.test.ts', fullName='odd (name) [x] a|b $1 ^ * + ? {2} \\ .'),
                                         dict(file='tests/b.test.ts', fullName='plain'), dict(file='tests/c.test.ts', fullName='plain')])
        self.assertEqual(remote_checks.selection(remote_checks.audit_list(json.dumps(listed).encode())),
                         ['--testNamePattern=^(?:odd \\(name\\) \\[x\\] a\\|b \\$1 \\^ \\* \\+ \\? \\{2\\} \\\\ \\.|plain)$',
                          'tests/a.test.ts', 'tests/b.test.ts', 'tests/c.test.ts'])


class CommittedListTest(unittest.TestCase):
    """The repository's own list: well formed, and every listed file has the source guard that skips it in CI."""
    def test_the_committed_list_names_guarded_tests(self):
        repo = HERE.parent.parent
        listed = remote_checks.audit_list((repo / remote_checks.AUDITS).read_bytes())
        self.assertTrue(listed)
        for name in sorted({file for file, _ in listed}):
            source = (repo / name).read_text()
            self.assertRegex(source, r'(describe|it)\.skipIf\(', name)


def fixture_main(orch, wt, base, mutation=''):
    """Publish one fixture manifest for the shell queue tests: a named mutation breaks it."""
    def mutate(m, d):
        if mutation == 'failed':
            m['commands'][3]['exitCode'] = 1
        elif mutation == 'stale-base':
            retrail(m['source'], **{'Gate-Base': dict(m['source']['trailers'])['Gate-Reviewed']})
        elif mutation == 'with-parents':
            m['source']['parents'] = [base]
        elif mutation == 'wrong-tree':
            m['source']['tree'] = '0' * 40
        elif mutation == 'unlisted-skip':
            (d / 'full.json').write_text(json.dumps(report(skipped=FILES[:1])))
            m['commands'][3]['report']['sha256'] = digest(d / 'full.json')
        elif mutation == 'listed-skip':
            (d / 'full.json').write_text(json.dumps(report(skipped=(AUDITED[0],))))
            m['commands'][3]['report']['sha256'] = digest(d / 'full.json')
        elif mutation:
            raise SystemExit('unknown fixture mutation: ' + mutation)
    install(wt)
    run_id = 'fixture-20261030-120000-' + hashlib.sha256((mutation or 'pass').encode()).hexdigest()[:6]
    path, sha256 = publish(orch, wt, base, run_id, mutate)
    print(path, sha256)


if __name__ == '__main__':
    if sys.argv[1:2] == ['fixture']:
        fixture_main(*sys.argv[2:])
    elif sys.argv[1:2] == ['report']:
        options = dict(item.split('=') for item in sys.argv[3:])
        skipped = tuple(filter(None, options.pop('skipped', '').split(',')))
        failed = tuple(filter(None, options.pop('failed', '').split(',')))
        files = tuple(filter(None, options.pop('files', ','.join(FILES)).split(',')))
        value = report(files=files, root=sys.argv[2], skipped=skipped, **{key: int(value) for key, value in options.items()})
        for name in failed:
            failed_file(value, files.index(name))
        print(json.dumps(value))
    elif sys.argv[1:2] == ['audit-list']:
        print(json.dumps(AUDIT_LIST, indent=2))
    else:
        unittest.main()
