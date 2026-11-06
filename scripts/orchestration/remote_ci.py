#!/usr/bin/env python3
"""Heavy checks for a gate/<label> candidate in CI, published as remote-heavy-checks-v1.

The single-job run (ci.yaml's job before the shards; its manifest shape is still accepted) runs in the
candidate checkout. It runs remote_checks.py's
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

Sharded (owner 2026-11-06, speed-ci-shards; ci.yaml's gate jobs): the `static` job runs install, typecheck and
lint; each of N `shard` jobs runs the suite's --shard=i/N with the blob reporter beside the JSON one; the `assemble`
job gathers their parts (each job's rows and facts: checkout, toolchain, environment, installed lock), merges the
blobs with `vitest --merge-reports` into full.json and writes the one manifest last, recording what each job did:
remote_checks.py judges it (a missing, failed or mismatched part is recorded and refused there, never dropped).

python3 -B remote_ci.py static --tz ZONE --out PART
python3 -B remote_ci.py shard --index I --total N --tz ZONE --out PART
python3 -B remote_ci.py assemble --label LABEL --orch GATE_EP_ORCH --tz ZONE --out OUT --parts PARTS --total N
    (PARTS holds the downloaded artifacts remote-static/ and remote-shard-<i>/)
python3 -B remote_ci.py --label LABEL --orch GATE_EP_ORCH --tz ZONE --out OUT   (the single-job run)
python3 -B remote_ci.py probe   (the checkout's source facts as JSON; refuses a non-gate commit)
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parent))
from remote_checks import ARGV, AUDITS, ENVIRONMENT, JOB_SOURCE, KIND, PROBE, RUN_ID, SHARD_REPORTER, gate_commit
from workflow_evidence import create_json, digest, read_json, require

LABEL = r'[a-z0-9-]+'
# Runner variables a command needs to find node, pnpm and its store; nothing else is passed.
INHERITED = ('HOME', 'PATH', 'PNPM_HOME')
# The parts a static or shard job uploads for the assemble job.
STATIC_KIND, SHARD_KIND = 'remote-static-part-v1', 'remote-shard-part-v1'


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


def sequence(plan, root, env, directory):
    """The planned (name, argv) commands in order, stopping at the first non-zero exit."""
    rows = []
    for name, argv in plan:
        rows.append(execute(name, argv, root, env, directory))
        if rows[-1]['exitCode'] != 0:
            break
    return rows


def static_plan():
    return [(name, ARGV[name]) for name in ('install', 'typecheck', 'lint')]


def stages(root, env, directory):
    """install, typecheck, lint and the suite in order, stopping at the first non-zero exit; (rows, planned count)."""
    plan = static_plan() + [('suite', ARGV['suite'] + ['--outputFile.json=' + str(directory / 'full.json')])]
    rows = sequence(plan, root, env, directory)
    report = directory / 'full.json'
    if rows[-1]['name'] == 'suite' and report.is_file():
        rows[-1]['report'] = dict(file=report.name, sha256=digest(report))
    return rows, len(plan)


def installed_lock(root):
    lock = root / 'node_modules/.pnpm/lock.yaml'
    return digest(lock) if lock.is_file() else None


def recorded_environment(env, zone):
    """The manifest's environment: the pinned values, TZ when set, and the effective zone."""
    return {**{key: env[key] for key in ENVIRONMENT}, **({'TZ': env['TZ']} if 'TZ' in env else {}), 'timeZone': zone}


def job_facts(root, facts, env, toolchain, zone, runner):
    """One CI job's facts, which remote_checks.job requires to equal the manifest's (the assemble job's)."""
    return dict(source={key: facts[key] for key in JOB_SOURCE}, toolchain=toolchain, environment=recorded_environment(env, zone),
                environmentKeys=sorted(env), installedLock=installed_lock(root), runner=runner or dict(provider='local'))


def write_manifest(directory, root, identity, orch, runner, facts, env, toolchain, zone, rows, completed, extra=None):
    """remote-heavy-checks-v1, create-only and last; its sha256. extra adds a sharded run's static and shards."""
    manifest = dict(
        kind=KIND, runId=identity, directory=str(Path(orch) / 'remote-checks' / identity),
        runner=runner or dict(provider='local'), source=facts,
        lockfile={'pnpm-lock.yaml': digest(root / 'pnpm-lock.yaml'), 'package.json': digest(root / 'package.json'),
                  'installedLock': installed_lock(root)},
        toolchain=toolchain, environment=recorded_environment(env, zone),
        environmentKeys=sorted(env), resourceOverrides={},
        commands=rows, completed=completed, createdAt=stamp(),
        # The committed list of tests that may skip here for want of the gate host's sources.
        hostAudits=dict(file=AUDITS, sha256=digest(root / AUDITS) if (root / AUDITS).is_file() else None), **(extra or {}))
    with (directory / 'manifest.json').open('x') as stream:
        json.dump(manifest, stream, indent=2)
        stream.write('\n')
    return digest(directory / 'manifest.json')


def job_start(root, out, tz, parent):
    """A job's checkout (refusing a non-gate or unclean one before anything runs), its new part directory,
    environment, toolchain and zone."""
    root, out = Path(root).resolve(), Path(out)
    facts = source(root)
    out.mkdir(parents=True)
    env = environment(os.environ if parent is None else parent, tz)
    toolchain, zone = probe(root, env)
    return root, out, facts, env, toolchain, zone


def static(root, out, tz, parent=None, runner=None):
    """The static job: install, typecheck and lint, stopping at the first failure, then OUT/static.json (its rows and
    facts) last. True only for three zero exits."""
    root, out, facts, env, toolchain, zone = job_start(root, out, tz, parent)
    rows = sequence(static_plan(), root, env, out)
    create_json(out / 'static.json', dict(kind=STATIC_KIND, job=job_facts(root, facts, env, toolchain, zone, runner), commands=rows))
    return len(rows) == 3 and all(row['exitCode'] == 0 for row in rows)


def shard(root, out, index, total, tz, parent=None, runner=None):
    """Shard index of total: the suite with --shard=index/total, its JSON report and blob beside its log, then
    OUT/shard.json (its row and facts) last. True for a zero exit."""
    require(isinstance(index, int) and isinstance(total, int) and 1 <= index <= total, 'Invalid shard %r of %r' % (index, total))
    root, out, facts, env, toolchain, zone = job_start(root, out, tz, parent)
    report, blob = out / ('shard-%d.json' % index), out / 'blobs' / ('blob-%d.json' % index)
    argv = ARGV['suite'] + [SHARD_REPORTER, '--shard=%d/%d' % (index, total), '--outputFile.json=' + str(report), '--outputFile.blob=' + str(blob)]
    row = execute('shard-%d' % index, argv, root, env, out)
    row = dict(index=index, **{key: value for key, value in row.items() if key != 'name'})
    for key, path in (('report', report), ('blob', blob)):
        if path.is_file():
            row[key] = dict(file=str(path.relative_to(out)), sha256=digest(path))
    row['job'] = job_facts(root, facts, env, toolchain, zone, runner)
    create_json(out / 'shard.json', dict(kind=SHARD_KIND, total=total, shard=row))
    return row['exitCode'] == 0


def read_part(path, kind):
    """A downloaded part, or None (with the reason in the job log) when it is missing or not of its kind."""
    try:
        value = read_json(path)
        require(isinstance(value, dict) and value.get('kind') == kind, 'not a %s part' % kind)
        return value
    except Exception as exc:
        print('assemble: no %s part at %s: %s' % (kind, path, exc), flush=True)
        return None


def place(part, reference, directory, target):
    """Copies a part's referenced file to directory/target, keeping its recorded sha256 (the verifier rehashes)."""
    source_path = (part / reference['file']).resolve()
    require(source_path.is_relative_to(part.resolve()) and source_path.is_file(), 'Part file outside its part: ' + reference['file'])
    destination = directory / target
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source_path, destination)
    return dict(reference, file=target)


def same_job(value, own):
    """The job facts remote_checks.job compares (all but the runner)."""
    return isinstance(value, dict) and all(value.get(key) == own[key] for key in own if key != 'runner')


def assemble(root, out, orch, label, tz, parts, total, parent=None, runner=None, github_output=None):
    """The assemble job: OUT/<runId>/ from the static and shard parts in PARTS (logs at the top, shards/ and blobs/),
    the merged suite (--merge-reports of blobs/) and the manifest last. Records every part as it came; True only
    when the static job and all total shards passed with this job's facts and the merge passed."""
    root, out, parts = Path(root).resolve(), Path(out), Path(parts)
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
    own = job_facts(root, facts, env, toolchain, zone, runner)
    (directory / 'blobs').mkdir()
    rows, static_job = [], None
    part = read_part(parts / 'remote-static' / 'static.json', STATIC_KIND)
    if part:
        static_job = part['job']
        for row in part['commands']:
            rows.append(dict(row, log=place(parts / 'remote-static', row['log'], directory, row['name'] + '.log')))
    shards = []
    for index in range(1, total + 1):
        base = parts / ('remote-shard-%d' % index)
        part = read_part(base / 'shard.json', SHARD_KIND)
        if not part:
            continue
        row = dict(part['shard'])
        for key, target in (('log', 'shards/shard-%d.log'), ('report', 'shards/shard-%d.json'), ('blob', 'blobs/blob-%d.json')):
            if isinstance(row.get(key), dict):
                row[key] = place(base, row[key], directory, target % index)
        shards.append(row)
    if any('blob' in row for row in shards):
        report = directory / 'full.json'
        merge = ARGV['suite'] + ['--merge-reports=' + str(directory / 'blobs'), '--outputFile.json=' + str(report)]
        rows.append(execute('suite', merge, root, env, directory))
        if report.is_file():
            rows[-1]['report'] = dict(file=report.name, sha256=digest(report))
    completed = [row['name'] for row in rows] == list(ARGV) and len(shards) == total
    sha256 = write_manifest(directory, root, identity, orch, runner, facts, env, toolchain, zone, rows, completed,
                            dict(static=static_job, shards=shards))
    problems = [name for name, job in [('static job', static_job)] + [('shard %s' % row.get('index'), row.get('job')) for row in shards]
                if not same_job(job, own)]
    if problems:
        print('assemble: facts differ from this job\'s: ' + ', '.join(problems), flush=True)
    passed = completed and not problems and all(row['exitCode'] == 0 for row in rows + shards)
    print('remote checks %s: %s, %d of %d shards, manifest %s' % ('passed' if passed else 'FAILED', identity, len(shards), total, sha256))
    return passed


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
    sha256 = write_manifest(directory, root, identity, orch, runner, facts, env, toolchain, zone, rows, len(rows) == planned)
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
    mode = argv[0] if argv[:1] and argv[0] in ('static', 'shard', 'assemble') else None
    parser = argparse.ArgumentParser(prog='remote_ci.py' + (' ' + mode if mode else ''), description=__doc__.splitlines()[0])
    parser.add_argument('--tz', default='', help="the gate host's zone; empty leaves TZ unset")
    parser.add_argument('--out', required=True, help="where the part (static, shard) or <runId>/ is written")
    if mode == 'shard':
        parser.add_argument('--index', type=int, required=True)
    if mode in ('shard', 'assemble'):
        parser.add_argument('--total', type=int, required=True, help='the shard count N')
    if mode in (None, 'assemble'):
        parser.add_argument('--label', required=True, help='gate/<label> without the prefix')
        parser.add_argument('--orch', required=True, help="the gate host's EP_ORCH")
    if mode == 'assemble':
        parser.add_argument('--parts', required=True, help='the downloaded remote-static/ and remote-shard-<i>/ artifacts')
    args = parser.parse_args(argv[1:] if mode else argv)
    runner, output = github_runner(os.environ), os.environ.get('GITHUB_OUTPUT')
    if mode == 'static':
        passed = static(Path.cwd(), args.out, args.tz, runner=runner)
    elif mode == 'shard':
        passed = shard(Path.cwd(), args.out, args.index, args.total, args.tz, runner=runner)
    elif mode == 'assemble':
        passed = assemble(Path.cwd(), args.out, args.orch, args.label, args.tz, args.parts, args.total, runner=runner, github_output=output)
    else:
        passed = run(Path.cwd(), args.out, args.orch, args.label, args.tz, github_output=output, runner=runner)
    return 0 if passed else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
