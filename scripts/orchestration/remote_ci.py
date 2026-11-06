#!/usr/bin/env python3
"""Heavy checks for a gate/<label> candidate in CI, published as remote-heavy-checks-v1.

The ci.yaml remote-checks job runs this in the candidate checkout. It runs remote_checks.py's
pinned argv (install, typecheck, lint, suite) under only the pinned environment, stops at
the first failure, and writes OUT/<runId>/manifest.json last, binding the committed
host-audit list (tests that skip here for want of the gate host's sources). The manifest names its
directory as the gate host's ORCH/remote-checks/<runId>, where remote-fetch.sh publishes
the uploaded artifact read-only; the gate then verifies it with remote_checks.py.

The checkout is gate-push.sh's tree-only commit (owner 2026-11-02), cloned at depth 1: parentless,
its message trailers naming the reviewed commit, the base and the tree, and no other. Anything else
stops the run before any command (remote_checks.gate_commit, which the gate host applies alike); the
manifest records the commit, its tree, parents, message and every trailer, and the gate host binds
them (remote_checks.gate_source).

python3 -B remote_ci.py --label LABEL --orch GATE_EP_ORCH --tz ZONE --out OUT
python3 -B remote_ci.py probe   (the checkout's source facts as JSON; refuses a non-gate commit)
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parent))
from remote_checks import ARGV, AUDITS, ENVIRONMENT, KIND, PROBE, RUN_ID, gate_commit
from workflow_evidence import digest, require

LABEL = r'[a-z0-9-]+'
# Runner variables a command needs to find node, pnpm and its store; nothing else is passed.
INHERITED = ('HOME', 'PATH', 'PNPM_HOME')


def stamp(moment=None):
    return (moment or datetime.now(timezone.utc)).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'


def run_id(label, commit, moment=None):
    """<label>-<UTC yyyymmdd-hhmmss>-<commit[:6]>, the runId remote_checks.py accepts."""
    require(isinstance(label, str) and re.fullmatch(LABEL, label), 'Invalid gate label: %r' % label)
    value = '%s-%s-%s' % (label, (moment or datetime.now(timezone.utc)).strftime('%Y%m%d-%H%M%S'), commit[:6])
    require(re.fullmatch(RUN_ID, value), 'Invalid runId: ' + value)
    return value


def environment(parent, tz):
    """The commands' whole environment: the runner's PATH/HOME/PNPM_HOME, the pinned values, TZ if set."""
    values = {key: parent[key] for key in INHERITED if key in parent}
    values.update(ENVIRONMENT)
    if tz:
        values['TZ'] = tz
    return values


def capture(root, argv, env):
    return subprocess.run(argv, cwd=root, env=env, capture_output=True, text=True, check=True).stdout.strip()


def read_source(root):
    """The checkout's facts as the manifest records them, refusing nothing: its status (every untracked file, whatever
    the configuration), commit, tree, parents from the raw commit object (which still names them in a shallow clone,
    where rev-parse HEAD^ would not), message, and every trailer Git parses from it as [key, value] pairs."""
    status = capture(root, ['git', '-c', 'core.fsmonitor=false', 'status', '--porcelain=v1', '--untracked-files=all',
                            '--ignore-submodules=none'], None)
    commit = capture(root, ['git', 'rev-parse', 'HEAD'], None)
    raw = subprocess.run(['git', 'cat-file', 'commit', commit], cwd=root, capture_output=True, text=True, check=True).stdout
    headers, _, message = raw.partition('\n\n')
    parents = [line.split(' ', 1)[1] for line in headers.splitlines() if line.startswith('parent ')]
    tree = capture(root, ['git', 'rev-parse', 'HEAD^{tree}'], None)
    parsed = subprocess.run(['git', 'interpret-trailers', '--parse'], cwd=root, input=message, capture_output=True, text=True,
                            check=True).stdout
    trailers = [list(line.partition(': ')[::2]) for line in parsed.splitlines()]
    return dict(commit=commit, tree=tree, parents=parents, trailers=trailers, message=message, status=status, root=str(root))


def source(root):
    """The candidate: a clean checkout of gate-push.sh's commit (remote_checks.gate_commit, as the gate host checks it).
    Clean means a status that succeeded and listed nothing, and no index entry marked assume-unchanged or
    skip-worktree (ls-files -v: a lowercase tag or S), which hides its worktree change from status."""
    try:
        facts = read_source(root)
        index = capture(root, ['git', 'ls-files', '-v'], None)
    except subprocess.CalledProcessError as exc:
        raise RuntimeError('Candidate checkout status failed: %s' % ' '.join(exc.cmd)) from exc
    require(facts['status'] == '', 'Candidate checkout not clean: ' + facts['status'].partition('\n')[0])
    require(not re.search(r'^([a-z]|S) ', index, re.M), 'Candidate checkout index hides worktree changes')
    gate_commit(facts)
    return facts


def execute(name, argv, root, env, directory):
    """One command, its output streamed to the job log and to <name>.log."""
    log = directory / (name + '.log')
    started, clock = stamp(), time.monotonic()
    print('::group::%s: %s' % (name, ' '.join(argv)), flush=True)
    with log.open('w') as sink:
        with subprocess.Popen(argv, cwd=root, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, errors='replace') as process:
            for line in process.stdout:
                sink.write(line)
                sys.stdout.write(line)
        code = process.returncode
    print('::endgroup::\n%s exited %d' % (name, code), flush=True)
    return dict(name=name, argv=argv, exitCode=code, startedAt=started, endedAt=stamp(),
                elapsedSeconds=round(time.monotonic() - clock, 3), log=dict(file=log.name, sha256=digest(log)))


def probe(root, env):
    """The toolchain and effective zone the commands see; the verifier compares them with the gate host's."""
    facts = json.loads(capture(root, ['node', '-e', PROBE], env))
    toolchain = dict(node=facts['node'], pnpm=capture(root, ['pnpm', '--version'], env), platform=facts['platform'], arch=facts['arch'])
    return toolchain, facts['timeZone']


def stages(root, env, directory):
    """install, typecheck, lint and the suite in order, stopping at the first non-zero exit; (rows, planned count)."""
    plan = [(name, ARGV[name]) for name in ('install', 'typecheck', 'lint')]
    plan.append(('suite', ARGV['suite'] + ['--outputFile.json=' + str(directory / 'full.json')]))
    rows = []
    for name, argv in plan:
        rows.append(execute(name, argv, root, env, directory))
        if rows[-1]['exitCode'] != 0:
            break
    report = directory / 'full.json'
    if rows[-1]['name'] == 'suite' and report.is_file():
        rows[-1]['report'] = dict(file=report.name, sha256=digest(report))
    return rows, len(plan)


def write_manifest(directory, root, identity, orch, runner, facts, env, toolchain, zone, rows, planned):
    """remote-heavy-checks-v1, create-only and last; its sha256."""
    lock = root / 'node_modules/.pnpm/lock.yaml'
    manifest = dict(
        kind=KIND, runId=identity, directory=str(Path(orch) / 'remote-checks' / identity),
        runner=runner or dict(provider='local'), source=facts,
        lockfile={'pnpm-lock.yaml': digest(root / 'pnpm-lock.yaml'), 'package.json': digest(root / 'package.json'),
                  'installedLock': digest(lock) if lock.is_file() else None},
        toolchain=toolchain,
        environment={**{key: env[key] for key in ENVIRONMENT}, **({'TZ': env['TZ']} if 'TZ' in env else {}), 'timeZone': zone},
        environmentKeys=sorted(env), resourceOverrides={},
        commands=rows, completed=len(rows) == planned, createdAt=stamp(),
        # The committed list of tests that may skip here for want of the gate host's sources.
        hostAudits=dict(file=AUDITS, sha256=digest(root / AUDITS) if (root / AUDITS).is_file() else None))
    with (directory / 'manifest.json').open('x') as stream:
        json.dump(manifest, stream, indent=2)
        stream.write('\n')
    return digest(directory / 'manifest.json')


def run(root, out, orch, label, tz, parent=None, runner=None, github_output=None):
    """Runs the checks and writes the manifest last; True only for four zero exits."""
    root, out = Path(root).resolve(), Path(out)
    parent = os.environ if parent is None else parent
    facts = source(root)
    identity = run_id(label, facts['commit'])
    directory = out / identity
    directory.mkdir(parents=True)
    if github_output:
        with open(github_output, 'a') as stream:
            stream.write('run-id=%s\ndirectory=%s\n' % (identity, directory))
    env = environment(parent, tz)
    toolchain, zone = probe(root, env)
    rows, planned = stages(root, env, directory)
    sha256 = write_manifest(directory, root, identity, orch, runner, facts, env, toolchain, zone, rows, planned)
    passed = len(rows) == planned and all(row['exitCode'] == 0 for row in rows)
    print('remote checks %s: %s, manifest %s' % ('passed' if passed else 'FAILED', identity, sha256))
    return passed


def github_runner(env):
    """Where the run came from; remote_checks.py does not read it."""
    keys = dict(repository='GITHUB_REPOSITORY', runId='GITHUB_RUN_ID', attempt='GITHUB_RUN_ATTEMPT', workflow='GITHUB_WORKFLOW',
                job='GITHUB_JOB', ref='GITHUB_REF', sha='GITHUB_SHA', runnerName='RUNNER_NAME', image='ImageVersion')
    value = dict(provider='github-actions', **{key: env.get(name) for key, name in keys.items()})
    if env.get('GITHUB_SERVER_URL') and env.get('GITHUB_RUN_ID'):
        value['url'] = '%s/%s/actions/runs/%s' % (env['GITHUB_SERVER_URL'], env.get('GITHUB_REPOSITORY'), env['GITHUB_RUN_ID'])
    return value


def main(argv):
    if argv == ['probe']:
        try:
            print(json.dumps(source(Path.cwd()), indent=2))
            return 0
        except (RuntimeError, subprocess.CalledProcessError) as exc:
            print('remote_ci probe refused: %s' % exc, file=sys.stderr)
            return 1
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--label', required=True, help='gate/<label> without the prefix')
    parser.add_argument('--orch', required=True, help="the gate host's EP_ORCH")
    parser.add_argument('--tz', default='', help="the gate host's zone; empty leaves TZ unset")
    parser.add_argument('--out', required=True, help='where <runId>/ is written')
    args = parser.parse_args(argv)
    passed = run(Path.cwd(), args.out, args.orch, args.label, args.tz, github_output=os.environ.get('GITHUB_OUTPUT'),
                 runner=github_runner(os.environ))
    return 0 if passed else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
