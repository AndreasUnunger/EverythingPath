#!/usr/bin/env python3
"""Remote heavy-check evidence (remote-heavy-checks-v1) for one exact landing candidate.

Boat publishes ORCH/remote-checks/<runId>/manifest.json. A gate whose gate.json names it in
remoteChecks {path, sha256, mode} accepts it only for the exact tree, base, lockfile,
toolchain, environment and canonical commands, with a complete all-green suite. Any defect
refuses with a named reason; nothing falls back to a local or partial pass. The sha256 pin
detects corruption, moved directories and stale scope; it is not cryptographic attestation.

The remote commit is gate-push.sh's tree-only commit (owner 2026-11-02): parentless, with the
candidate's tree, its message trailers naming the reviewed commit, the base and the tree. The
manifest binds its tree to TREE, Gate-Reviewed to REVIEWED (or the prepared squash) and Gate-Base
to BASE; ancestry is checked here, on the gate host, since the integration history is never pushed.

The one exception to all-green (owner 2026-11-02): a test in the candidate's pinned host-audit
list (AUDITS; it needs sources only the gate host has) may skip remotely. The manifest binds
the list's sha256; the gate host then runs exactly those tests (host-audits.sh, `audit`) or,
in compare mode, takes them from its local full suite.

python3 -B remote_checks.py verify MANIFEST SHA256 WT BASE EVIDENCE_DIR
python3 -B remote_checks.py compare MANIFEST SHA256 LOCAL_FULL_JSON AUDITS_JSON EVIDENCE_DIR
python3 -B remote_checks.py audit MANIFEST SHA256 AUDITS_JSON HOST_REPORT HOST_ROOT EXIT_CODE EVIDENCE_DIR
python3 -B remote_checks.py selection AUDITS_JSON   (the Vitest arguments, NUL-terminated)
"""
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from workflow_evidence import command, create_json, digest, git, now, parse_json, read_json, reference, require

KIND = 'remote-heavy-checks-v1'
AUDITS = 'scripts/orchestration/host-audits.json'
AUDITS_KIND = 'host-audits-v1'
TEST_FILE = r'(?:[A-Za-z0-9_.-]+/)*[A-Za-z0-9_.-]+\.test\.tsx?'
MODES = ('compare', 'replace')
RUN_ID = r'[a-z0-9-]+-\d{8}-\d{6}-[0-9a-f]{6}'
ARGV = dict(install=['pnpm', 'install', '--offline', '--frozen-lockfile'], typecheck=['pnpm', '-s', 'typecheck'],
            lint=['pnpm', '-s', 'lint'], suite=['pnpm', 'test', '--reporter=default', '--reporter=json'])
ENVIRONMENT = dict(CI='true', LC_ALL='C.UTF-8', VITEST_MAX_WORKERS='2')
OVERRIDES = ('GOMEMLIMIT',)  # Resource-only, typecheck only: a memory limit can only fail closed.
SKIPPED = ('skipped', 'pending')
SNAPSHOT_WRITES = ('added', 'updated', 'filesAdded', 'unmatched')
STATUS_COUNTERS = (('numPassedTests', ('passed',)), ('numFailedTests', ('failed',)),
                   ('numPendingTests', SKIPPED), ('numTodoTests', ('todo',)))
COUNTERS = ('numTotalTestSuites', 'numPassedTestSuites', 'numFailedTestSuites', 'numPendingTestSuites',
            'numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numTodoTests')
# The remote source: gate-push.sh's commit and the facts remote_ci.py records about it.
SOURCE = ('commit', 'tree', 'parents', 'trailers', 'message', 'status', 'root')
TRAILERS = ('Gate-Reviewed', 'Gate-Base', 'Gate-Tree')
FULL_SHA = '[0-9a-f]{40}'
# A gate commit message's trailer block is its last paragraph, every line `Key: value`; a line that names a
# gate key anywhere else (any case, any indent) is refused, so no gate key escapes the parse.
TRAILER_LINE = r'([A-Za-z0-9][A-Za-z0-9-]*): (.*)'
GATE_KEY = r'(?i)\s*gate-'
PROBE = ('console.log(JSON.stringify({node: process.version, platform: process.platform, arch: process.arch,'
         ' timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone}))')


def config(value):
    """gate.json remoteChecks: exactly {path, sha256, mode}."""
    require(isinstance(value, dict) and set(value) == {'path', 'sha256', 'mode'}, 'Invalid remoteChecks config')
    require(value['mode'] in MODES, 'Unknown remoteChecks mode: ' + str(value['mode']))
    return value


def audit_list(data):
    """The host-audit list {kind, sources, tests: [{file, fullName}]}, sorted and unique: its (file, fullName) set."""
    value = parse_json(data.decode() if isinstance(data, bytes) else data)
    tests = value.get('tests') if isinstance(value, dict) else None
    require(isinstance(value, dict) and set(value) == {'kind', 'sources', 'tests'} and value['kind'] == AUDITS_KIND
            and isinstance(value['sources'], list) and value['sources'] and all(isinstance(item, str) and item for item in value['sources'])
            and isinstance(tests, list) and tests
            and all(isinstance(test, dict) and set(test) == {'file', 'fullName'} and isinstance(test['file'], str)
                    and re.fullmatch(TEST_FILE, test['file']) and not {'.', '..'} & set(test['file'].split('/'))
                    and isinstance(test['fullName'], str) and test['fullName'].strip()
                    for test in tests), 'Invalid host-audit list')
    keys = [(test['file'], test['fullName']) for test in tests]
    require(keys == sorted(set(keys)), 'Host-audit list not sorted and unique')
    return frozenset(keys)


def bound_audits(path, manifest):
    """The list at path, which must be the one the manifest binds."""
    require(digest(path) == manifest['hostAudits']['sha256'], 'Host-audit list hash mismatch')
    return audit_list(Path(path).read_bytes())


def selection(listed):
    """Vitest arguments for the listed tests: one pattern anchored on their full names (Vitest 4 matches
    the describe titles and title, without the file), then the listed files. A same-named unlisted test
    in a listed file would also run; host_audit_report refuses that."""
    escape = lambda text: re.sub(r'[\\^$.*+?()\[\]{}|]', lambda match: '\\' + match.group(), text)
    pattern = '|'.join(escape(name) for name in sorted({name for _, name in listed}))
    return ['--testNamePattern=^(?:' + pattern + ')$', *sorted({file for file, _ in listed})]


def label(key):
    return key[0] + ' > ' + key[1]


def original_suite(path):
    report = read_json(path)
    keys = ('numTotalTests', 'numPassedTests', 'numFailedTests', 'numFailedTestSuites')
    require(all(type(report.get(key)) is int for key in keys), 'Original suite counters missing')
    require(report.get('success') is True and report['numFailedTests'] == 0 and report['numFailedTestSuites'] == 0
            and report['numTotalTests'] > 0 and report['numPassedTests'] == report['numTotalTests'], 'Original suite was not all green')
    return True


def load(path, sha256, orch):
    """The pinned manifest, at its create-only ORCH/remote-checks/<runId>/ location."""
    path = Path(path)
    require(path.is_absolute(), 'Remote manifest path must be absolute')
    require(path.name == 'manifest.json' and path.parent.parent == Path(orch) / 'remote-checks',
            'Remote manifest outside ORCH/remote-checks/<runId>/')
    require(path.resolve() == path, 'Remote manifest path not canonical')
    require(path.is_file() and isinstance(sha256, str) and digest(path) == sha256, 'Remote manifest hash mismatch')
    manifest = read_json(path)
    require(manifest.get('kind') == KIND, 'Unsupported remote manifest kind')
    require(isinstance(manifest.get('runId'), str) and re.fullmatch(RUN_ID, manifest['runId'])
            and manifest['runId'] == path.parent.name, 'Invalid remote runId')
    require(manifest.get('directory') == str(path.parent), 'Remote directory is not the manifest parent')
    require(not path.parent.stat().st_mode & 0o222 and not path.stat().st_mode & 0o222, 'Remote evidence writable: manifest')
    return manifest


def evidence_file(directory, value, label):
    require(isinstance(value, dict) and set(value) == {'file', 'sha256'} and isinstance(value['file'], str)
            and isinstance(value['sha256'], str), 'Invalid remote evidence reference: ' + label)
    relative = Path(value['file'])
    require(relative.parts and not relative.is_absolute() and '..' not in relative.parts, 'Remote evidence escapes directory: ' + label)
    require(not any((directory / Path(*relative.parts[:index])).is_symlink() for index in range(1, len(relative.parts) + 1)),
            'Remote evidence symlink: ' + label)
    path = directory / relative
    require(path.resolve().is_relative_to(directory) and path.is_file(), 'Missing remote evidence: ' + label)
    require(digest(path) == value['sha256'], 'Remote evidence hash mismatch: ' + label)
    require(not path.stat().st_mode & 0o222, 'Remote evidence writable: ' + label)
    return path


def commands(manifest, directory):
    rows = manifest.get('commands')
    require(isinstance(rows, list) and all(isinstance(row, dict) for row in rows)
            and [row.get('name') for row in rows] == list(ARGV), 'Remote commands missing or out of order')
    for row in rows:
        name, argv = row['name'], row.get('argv')
        if name == 'suite':
            canonical = (isinstance(argv, list) and len(argv) == 5 and argv[:4] == ARGV['suite'] and isinstance(argv[4], str)
                         and re.fullmatch(r'--outputFile\.json=/\S+', argv[4]))
        else:
            canonical = argv == ARGV[name]
        require(canonical, 'Remote argv not canonical: ' + name)
        require(type(row.get('exitCode')) is int, 'Remote exit code not an integer: ' + name)
        require(row['exitCode'] == 0, 'Remote command failed: ' + name)
        require(isinstance(row.get('startedAt'), str) and isinstance(row.get('endedAt'), str)
                and type(row.get('elapsedSeconds')) in (int, float) and row['elapsedSeconds'] >= 0, 'Remote timing missing: ' + name)
        evidence_file(directory, row.get('log'), name + ' log')
        require(name == 'suite' or 'report' not in row, 'Remote report not allowed: ' + name)
    return evidence_file(directory, rows[-1].get('report'), 'suite report')


def environment(manifest):
    values, keys = manifest.get('environment'), manifest.get('environmentKeys')
    require(isinstance(values, dict) and isinstance(keys, list) and all(isinstance(key, str) for key in keys)
            and len(set(keys)) == len(keys), 'Invalid remote environment')
    for key, value in ENVIRONMENT.items():
        require(values.get(key) == value and key in keys, 'Remote environment mismatch: ' + key)
    extra = sorted(set(values) - set(ENVIRONMENT) - {'TZ', 'timeZone'})
    require(not extra, 'Unexpected remote environment value: ' + ', '.join(extra))
    require(isinstance(values.get('timeZone'), str) and values['timeZone'], 'Remote timeZone missing')
    require('TZ' not in values or (isinstance(values['TZ'], str) and 'TZ' in keys), 'Remote TZ not in its environment')
    bad = sorted(key for key in keys if key == 'NODE_OPTIONS' or key in OVERRIDES
                 or key.startswith('VITEST_') and key != 'VITEST_MAX_WORKERS')
    require(not bad, 'Remote environment override: ' + ', '.join(bad))
    overrides = manifest.get('resourceOverrides', {})
    require(isinstance(overrides, dict) and all(isinstance(value, str) for value in overrides.values()), 'Invalid remote resource overrides')
    extra = sorted(set(overrides) - set(OVERRIDES))
    require(not extra, 'Remote resource override not allowed: ' + ', '.join(extra))


def suite(path, root, listed):
    """A complete report written without snapshot changes, all green except that a listed host audit
    may skip, and with every listed test present; returns its (file, fullName, status) multiset."""
    report = read_json(path)
    snapshot = report.get('snapshot')
    require(isinstance(snapshot, dict) and all(type(snapshot.get(key)) is int and snapshot[key] == 0 for key in SNAPSHOT_WRITES),
            'Remote suite wrote snapshots')
    tests = verdict(report, root, 'Remote', lambda file, name, status: status in SKIPPED and (file, name) in listed,
                    'has pending or todo tests: not in the host-audit list')
    missing = sorted(listed - {key[:2] for key in tests})
    require(not missing, 'Remote suite lacks a host-audit test: ' + ', '.join(map(label, missing)))
    return tests


def verdict(report, root, side, allowed=lambda file, name, status: False, refusal='has a test that did not pass'):
    """The all-green verdict every report path shares (the remote suite, the host audits, compare's
    local suite); returns assertions(). Vitest 4's JSON reporter (JsonReporter.onTestRunEnd; proved by a
    real run, retro W1 fix r2) marks a file `failed` when it or a test in it failed and `passed`
    otherwise, even when every test in it skipped; a skip never moves the suite counters, and
    numPendingTestSuites counts only unfinished or todo suites. So: success, no failed or todo test,
    every suite and every file passed, and no test other than passed unless allowed(file, fullName, status)."""
    require(all(type(report.get(key)) is int for key in COUNTERS), side + ' suite counters missing')
    require(report.get('success') is True and report['numFailedTests'] == report['numTodoTests'] == 0
            and report['numFailedTestSuites'] == report['numPendingTestSuites'] == 0
            and report['numTotalTests'] > 0 and report['numPassedTestSuites'] == report['numTotalTestSuites'] > 0,
            side + ' suite was not all green')
    tests = assertions(report, root, side)
    for item in report['testResults']:
        require(item.get('status') == 'passed', side + ' suite file not passed: ' + relative(item['name'], root, side))
    bad = sorted({(file, name) for file, name, status in tests if status != 'passed' and not allowed(file, name, status)})
    require(not bad, side + ' suite ' + refusal + ': ' + ', '.join(map(label, bad)))
    return tests


def assertions(report, root, side):
    """The (relative file, fullName, status) multiset, reconciled with the report's counters.

    Parameterised titles can repeat within a file and reports carry no per-test location,
    so repeats are counted, never collapsed.
    """
    results = report.get('testResults')
    require(isinstance(results, list) and results and all(isinstance(item, dict) for item in results), side + ' suite has no test files')
    found = Counter()
    for item in results:
        name = relative(item.get('name'), root, side + ' test file outside its root')
        tests = item.get('assertionResults')
        require(isinstance(tests, list) and tests, side + ' test file has no assertions: ' + name)
        for test in tests:
            require(isinstance(test, dict) and isinstance(test.get('title'), str) and test['title']
                    and isinstance(test.get('ancestorTitles'), list) and all(isinstance(title, str) for title in test['ancestorTitles'])
                    and test.get('fullName') == ' '.join([*test['ancestorTitles'], test['title']])
                    and isinstance(test.get('status'), str), side + ' assertion identity invalid in ' + name)
            require(item.get('status') != 'passed' or test['status'] != 'failed', side + ' passed file has a failed assertion: ' + name)
            found[(name, test['fullName'], test['status'])] += 1
    statuses = Counter()
    for (_, _, status), count in found.items():
        statuses[status] += count
    for key, names in (('numTotalTests', tuple(statuses)), *STATUS_COUNTERS):
        require(type(report.get(key)) is int and sum(statuses[status] for status in names) == report[key],
                side + ' assertions do not reconcile with ' + key)
    unknown = sorted(set(statuses) - {status for _, names in STATUS_COUNTERS for status in names})
    require(not unknown, side + ' assertion status unknown: ' + ', '.join(unknown))
    return found


def require_listed_passed(tests, listed, message):
    """Every occurrence of every listed test passed: '<message>: <status or missing>: <file> > <name>'."""
    statuses = {key: set() for key in listed}
    for file, name, status in tests:
        if (file, name) in statuses:
            statuses[(file, name)].add(status)
    for key, seen in sorted(statuses.items()):
        bad = sorted(seen - {'passed'}) or ([] if seen else ['missing'])
        if bad:
            raise RuntimeError('%s: %s: %s' % (message, bad[0], label(key)))


def relative(name, root, message):
    require(isinstance(name, str) and name.startswith(root + '/') and '..' not in Path(name).parts, message + ': ' + str(name))
    return name[len(root) + 1:]


def git_value(repo, *args):
    result = subprocess.run(['git', '-C', str(repo), *args], capture_output=True, env={**os.environ, 'GIT_OPTIONAL_LOCKS': '0'})
    return result.stdout if result.returncode == 0 else None


def message_trailers(message):
    """Every trailer of a gate commit message, as [key, value] pairs in order: the lines of its last paragraph
    (none when it has one paragraph). Refuses a non-trailer line there and a gate key outside it."""
    require(isinstance(message, str), 'Gate commit message missing')
    paragraphs = [paragraph.split('\n') for paragraph in re.split(r'\n(?:[ \t]*\n)+', message.strip('\n'))]
    block = paragraphs.pop() if len(paragraphs) > 1 else []
    lines = [re.fullmatch(TRAILER_LINE, line) for line in block]
    require(all(lines), 'Gate commit trailer block has a non-trailer line')
    require(not any(re.match(GATE_KEY, line) for paragraph in paragraphs for line in paragraph),
            'Gate commit names a gate key outside its trailers')
    return [list(line.groups()) for line in lines]


def gate_trailers(pairs):
    """gate-push.sh's three trailers from a message's [key, value] pairs: no other key, each once, each a full SHA."""
    keys = [key for key, _ in pairs]
    extra = [key for key in keys if key not in TRAILERS]
    require(not extra, 'Unexpected gate commit trailer: ' + ', '.join(extra))
    repeated = sorted(key for key, count in Counter(keys).items() if count > 1)
    require(not repeated, 'Gate commit trailer repeated: ' + ', '.join(repeated))
    trailers = dict(pairs)
    for key in TRAILERS:
        require(key in trailers, 'Gate commit trailer missing: ' + key)
        require(re.fullmatch(FULL_SHA, trailers[key]), 'Gate commit trailer not a full SHA: ' + key)
    return trailers


def gate_commit(source):
    """What makes a recorded source gate-push.sh's commit, checked alike by the CI probe and the gate host: a full
    commit SHA, no parents, a message whose trailers are the three (recorded, every one, as Git parsed them) and
    whose Gate-Tree is the tree. Returns the three trailers."""
    require(isinstance(source, dict), 'Remote source missing')
    require(isinstance(source.get('commit'), str) and re.fullmatch(FULL_SHA, source['commit']), 'Remote commit unknown')
    require(isinstance(source.get('parents'), list), 'Gate commit parents missing')
    require(source['parents'] == [], 'Gate commit has parents')
    pairs = message_trailers(source.get('message'))
    trailers = gate_trailers(pairs)
    require(source.get('trailers') == pairs, "Gate commit trailers are not its message's")
    require(trailers['Gate-Tree'] == source.get('tree'), 'Gate commit tree is not its Gate-Tree')
    return trailers


def gate_source(source, tree, base, repo, commits):
    """The tree-only gate commit: gate_commit's, with tree TREE, Gate-Base BASE, and Gate-Reviewed in commits (when
    given), known here with tree TREE and descending from BASE. Returns Gate-Reviewed."""
    require(isinstance(source, dict), 'Remote source missing')
    extra = sorted(set(source) - set(SOURCE))
    require(not extra, 'Unexpected remote source field: ' + ', '.join(extra))
    require(source.get('tree') == tree, 'Remote tree mismatch')
    trailers = gate_commit(source)
    require(trailers['Gate-Base'] == base, 'Remote base mismatch')
    reviewed = trailers['Gate-Reviewed']
    require(commits is None or reviewed in commits, 'Remote Gate-Reviewed is not the reviewed or prepared commit')
    actual = git_value(repo, 'rev-parse', '--verify', '-q', reviewed + '^{tree}')
    require(actual is not None, 'Remote Gate-Reviewed unknown')
    require(actual.decode().strip() == tree, 'Remote Gate-Reviewed tree mismatch')
    require((git_value(repo, 'merge-base', base, reviewed) or b'').decode().strip() == base, 'Remote Gate-Reviewed does not descend from base')
    return reviewed


def verify_manifest(path, sha256, tree, base, repo, orch, commits=None):
    """Static binding to TREE/BASE in repo; commits limits Gate-Reviewed (the operator's REVIEWED/SQUASHED)."""
    manifest = load(path, sha256, orch)
    directory = Path(path).parent
    source = manifest.get('source')
    gate_source(source, tree, base, repo, commits)
    require(source.get('status') == '', 'Remote source status not clean')
    require(isinstance(source.get('root'), str) and source['root'].startswith('/') and source['root'] != '/', 'Remote root must be absolute')
    lockfile = manifest.get('lockfile')
    require(isinstance(lockfile, dict) and set(lockfile) == {'pnpm-lock.yaml', 'package.json', 'installedLock'}, 'Remote lockfile missing')
    for name in ('pnpm-lock.yaml', 'package.json'):
        blob = git_value(repo, 'cat-file', 'blob', tree + ':' + name)
        require(blob is not None and lockfile[name] == hashlib.sha256(blob).hexdigest(), 'Remote lockfile mismatch: ' + name)
    toolchain = manifest.get('toolchain')
    require(isinstance(toolchain, dict) and set(toolchain) == {'node', 'pnpm', 'platform', 'arch'}
            and all(isinstance(value, str) for value in toolchain.values()), 'Remote toolchain missing')
    environment(manifest)
    listed = candidate_audits(manifest, repo, tree)
    report = commands(manifest, directory)
    require(manifest.get('completed') is True, 'Remote run not completed')
    require(isinstance(manifest.get('createdAt'), str), 'Remote creation time missing')
    suite(report, source['root'], listed)
    return manifest


def candidate_audits(manifest, repo, tree):
    """The manifest's hostAudits binding: exactly the candidate's committed list, by sha256."""
    audits = manifest.get('hostAudits')
    require(isinstance(audits, dict) and set(audits) == {'file', 'sha256'} and audits['file'] == AUDITS
            and isinstance(audits['sha256'], str), 'Remote host-audit list missing')
    blob = git_value(repo, 'cat-file', 'blob', tree + ':' + AUDITS)
    require(blob is not None, 'Host-audit list missing from the candidate')
    require(hashlib.sha256(blob).hexdigest() == audits['sha256'], 'Remote host-audit list hash mismatch')
    return audit_list(blob)


def suite_report(manifest, path):
    return commands(manifest, Path(path).parent)


def remote_suite(manifest, path, repo):
    """The verified remote suite's file set (suite() with the candidate's list); collection's originalSuite in replace."""
    source = manifest['source']
    return {file for file, _, _ in suite(suite_report(manifest, path), source['root'], candidate_audits(manifest, repo, source['tree']))}


def local_facts(wt):
    facts = json.loads(command(['node', '-e', PROBE], cwd=wt))
    facts['pnpm'] = command(['pnpm', '--version'], cwd=wt)
    return facts


def verify_local(manifest, path, wt, evidence):
    """The gate host's toolchain, timezone, installed lock and Vitest file set (no test module imported)."""
    facts = local_facts(wt)
    for key in ('node', 'pnpm', 'platform', 'arch'):
        require(manifest['toolchain'][key] == facts[key], 'Remote toolchain mismatch: ' + key)
    require(manifest['environment']['timeZone'] == facts['timeZone'], 'Remote timeZone mismatch')
    require(manifest['lockfile']['installedLock'] == digest(Path(wt) / 'node_modules/.pnpm/lock.yaml'), 'Remote installed lock mismatch')
    listing = Path(evidence) / 'local-files.json'
    command(['node', './node_modules/vitest/vitest.mjs', 'list', '--filesOnly', '--json=' + str(listing)], cwd=wt)
    entries = read_json(listing)
    require(isinstance(entries, list) and all(isinstance(entry, dict) for entry in entries), 'Local Vitest file list unreadable')
    local = {relative(entry.get('file'), str(Path(wt)), 'Local test file outside the worktree') for entry in entries}
    remote = remote_suite(manifest, path, wt)
    if local != remote:
        raise RuntimeError('Remote test file set differs: only remote ' + ', '.join(sorted(remote - local)) +
                           '; only local ' + ', '.join(sorted(local - remote)))
    return dict(toolchain={key: facts[key] for key in ('node', 'pnpm', 'platform', 'arch')}, timeZone=facts['timeZone'],
                installedLock=manifest['lockfile']['installedLock'], files=len(local), listing=reference(listing))


def local_root(report, files):
    """The local report's checkout root (triage tests in a removed ep-gate-* checkout)."""
    names = [item.get('name') for item in report.get('testResults') or []]
    require(names and all(isinstance(name, str) for name in names), 'Local suite has no test files')
    candidates = {names[0][:-len(name) - 1] for name in files if names[0].endswith('/' + name)}
    candidates = [root for root in candidates if all(name.startswith(root + '/') for name in names)]
    exact = [root for root in candidates if {name[len(root) + 1:] for name in names} == files]
    roots = exact or candidates
    require(len(roots) == 1, 'Cannot relate local report paths to the remote files')
    return roots[0]


def compare_reports(path, sha256, orch, local_path, audits_path):
    """The remote suite as verify judges it (suite()) and the local suite all green (verdict());
    outside the host-audit list, an equal multiset of (relative file, fullName, status); every listed
    test passed locally; equal totals, except that each listed remote skip moves one test from passed
    to pending. Suite totals never move: Vitest 4 counts a suite of skipped tests as passed."""
    manifest = load(path, sha256, orch)
    listed = bound_audits(audits_path, manifest)
    remote_path, local = suite_report(manifest, path), read_json(local_path)
    remote, remote_tests = read_json(remote_path), suite(remote_path, manifest['source']['root'], listed)
    root = local_root(local, {name for name, _, _ in remote_tests})
    local_tests = assertions(local, root, 'Local')
    outside = lambda tests: Counter({key: count for key, count in tests.items() if key[:2] not in listed})
    remote_outside, local_outside = outside(remote_tests), outside(local_tests)
    if remote_outside != local_outside:
        raise RuntimeError('Remote and local suites differ outside the host-audit list: %d only remote, %d only local' % (
            sum((remote_outside - local_outside).values()), sum((local_outside - remote_outside).values())))
    require_listed_passed(local_tests, listed, 'Host-audit test not passed locally')
    verdict(local, root, 'Local')
    skipped = sum(count for (file, name, status), count in remote_tests.items() if (file, name) in listed and status != 'passed')
    totals = sorted(key for key in set(remote) | set(local) if key.startswith('num'))
    differ = [key for key in totals if key not in ('numPassedTests', 'numPendingTests') and remote.get(key) != local.get(key)]
    if local['numPassedTests'] - remote['numPassedTests'] != skipped or remote['numPendingTests'] - local['numPendingTests'] != skipped:
        differ.append('numPassedTests')
    require(not differ, 'Remote and local totals differ: ' + ', '.join(sorted(differ)))
    return dict(tests=sum(remote_tests.values()), totals={key: remote[key] for key in totals},
                hostAudits=dict(listed=len(listed), passedLocally=len(listed), skippedRemotely=skipped))


def host_audit_report(listed, path, root):
    """The gate host's run of exactly the listed tests: each one passed (every repeat), the listed
    files' other tests filtered out (skipped), no other file, and otherwise the verdict() the remote
    suite gets."""
    report = read_json(path)
    tests = assertions(report, root, 'Host audit')
    require_listed_passed(tests, listed, 'Host-audit test not passed on the gate host')
    ran = sorted({(file, name) for file, name, status in tests if (file, name) not in listed and status not in SKIPPED})
    require(not ran, 'Host audits ran an unlisted test: ' + ', '.join(map(label, ran)))
    require({file for file, _, _ in tests} == {file for file, _ in listed}, 'Host-audit file set differs from the list')
    verdict(report, root, 'Host audit', lambda file, name, status: status == 'skipped' and (file, name) not in listed)
    return dict(tests=sum(count for (file, name, _), count in tests.items() if (file, name) in listed), files=len({file for file, _ in listed}))


def audit(path, sha256, audits_path, report_path, root, exit_code, evidence):
    """Records the host-audit verdict in EVIDENCE/host-audits.json (create-only)."""
    record = dict(kind='host-audits-verification-v1', at=now(), manifest=dict(path=str(path), sha256=sha256), root=root, exitCode=int(exit_code))
    try:
        record.update(list=reference(audits_path), report=reference(report_path))
        listed = bound_audits(audits_path, load(path, sha256, os.environ['EP_ORCH']))
        record['result'] = host_audit_report(listed, report_path, root)
        require(record['exitCode'] == 0, 'Host-audit run exited %d' % record['exitCode'])
        record['passed'] = True
        print('host-audits passed: %d listed tests in %d files' % (record['result']['tests'], record['result']['files']))
    except Exception as exc:
        record.update(passed=False, error=str(exc))
        print('host-audits refused: ' + str(exc))
    create_json(Path(evidence) / 'host-audits.json', record)
    return record['passed']


def print_selection(audits_path):
    sys.stdout.buffer.write(b''.join(arg.encode() + b'\0' for arg in selection(audit_list(Path(audits_path).read_bytes()))))
    return True


def verify(path, sha256, wt, base, evidence):
    evidence = Path(evidence)
    require(evidence.is_absolute(), 'Remote evidence directory must be absolute')
    evidence.mkdir()
    record = dict(kind='remote-verification-v1', at=now(), manifest=dict(path=str(path), sha256=sha256), worktree=str(wt), base=base)
    try:
        record.update(candidate=git(wt, 'rev-parse', 'HEAD'), tree=git(wt, 'rev-parse', 'HEAD^{tree}'))
        manifest = verify_manifest(path, sha256, record['tree'], base, wt, os.environ['EP_ORCH'])
        record.update(local=verify_local(manifest, path, wt, evidence), passed=True)
        print('remote verified %s: tree %s, base %s, %d test files' % (path, record['tree'], base, record['local']['files']))
    except Exception as exc:
        record.update(passed=False, error=str(exc))
        print('remote refused: ' + str(exc))
    create_json(evidence / 'remote-verification.json', record)
    return record['passed']


def compare(path, sha256, local_path, audits_path, evidence):
    record = dict(kind='remote-comparison-v1', at=now(), manifest=dict(path=str(path), sha256=sha256))
    try:
        record.update(local=reference(local_path), hostAudits=reference(audits_path))
        record.update(comparison=compare_reports(path, sha256, os.environ['EP_ORCH'], local_path, audits_path), passed=True)
        print('remote compare: equal, %d tests' % record['comparison']['tests'])
    except Exception as exc:
        record.update(passed=False, error=str(exc))
        print('remote compare refused: ' + str(exc))
    create_json(Path(evidence) / 'remote-comparison.json', record)
    return record['passed']


COMMANDS = dict(verify=(5, verify), compare=(5, compare), audit=(7, audit), selection=(1, print_selection))

if __name__ == '__main__':
    try:
        name = sys.argv[1] if len(sys.argv) > 1 else None
        require(name in COMMANDS and len(sys.argv) - 2 == COMMANDS[name][0], 'usage: remote_checks.py ' + '|'.join(COMMANDS) + ' ...')
        passed = COMMANDS[name][1](*sys.argv[2:])
    except Exception as exc:
        print('remote refused: ' + str(exc))
        passed = False
    sys.exit(0 if passed else 1)
