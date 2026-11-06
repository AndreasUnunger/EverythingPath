#!/usr/bin/env python3
"""Script gate operator: run one gate from its spec, with no model operator (root decision 2026-11-05).

  python3 -B scripts/orchestration/gate-run.py SPEC.json          generate the inputs and run the gate
  python3 -B scripts/orchestration/gate-run.py --stop SPEC.json   set the attempt's control to stopped (under the
                                                                  publication lock; a published attempt is left as is)

Detached (operations.md "Script gate operator"):
  BOUNDED_WAIT=1 $EP_ORCH/bounded.sh --detach <label> driver SPEC.json
then `scripts/orchestration/await.sh <id>`. The driver kind runs only this script with SPEC or --stop SPEC
(driver-argv.sh). After a stop, `gate_config.py retry` writes the next attempt's spec.

It runs the sequence a gate operator ran by hand: identity and mode prechecks, the prelaunch memory
samples, the storage baseline, `gate-operator.py prepare` and `runtime`, the stale-admission probe and
the retained entry's `resume`. The queue, the observer, collection and `complete` stay the gate
operator's (gate_operator.py, gate_monitor.py); this script never submits or lands anything itself.
It writes gate.json from the spec (gate_config.py), its own identity (path and blob at BASE) as the
operator, then `<result>.json` and `<result>.md` and the done marker, and exits non-zero on any stop.
"""
import argparse
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import threading
import time

HERE = Path(__file__).resolve().parent
MAIN = HERE.parent.parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import gate_config  # noqa: E402
import gate_core  # noqa: E402
from gate_core import SCRIPT_OPERATOR, git, require  # noqa: E402
from gate_monitor import STORAGE_PATTERN, GiB, launch_minimum_bytes  # noqa: E402
from workflow_evidence import create_json, execution_tools, now, reference  # noqa: E402

ORCH = '/home/andreas/repos/everythingpath/ep-orch'
LOCKS = ('resource', 'curator', 'curator2', 'land', 'heavy')
TOOLS = ('bash', 'git', 'node', 'pnpm', 'python3', 'systemctl', 'docker', 'flock')
# The caller's session variables that systemctl --user, git and Python need; everything else is dropped.
KEEP = ('HOME', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS')
IDLE = re.compile(r'memory: 0(\.0+)?/[0-9.]+ GiB reserved; active: none; queued: none')
GENERATED = ('convex/_generated/api.d.ts', 'convex/_generated/api.js', 'convex/_generated/dataModel.d.ts',
             'convex/_generated/server.d.ts', 'convex/_generated/server.js')
PRELAUNCH_SAMPLES, PRELAUNCH_INTERVAL, PRELAUNCH_DEADLINE = 3, 30, 90 * 60
REAP_INTERVAL, REAP_DEADLINE = 5, 120
PRECHECK_MARGIN = GiB // 2


class Stop(RuntimeError):
    """A refusal or stop: the driver records it, launches nothing further and exits non-zero."""


def meminfo_available():
    return int(re.search(r'^MemAvailable:\s+(\d+)', Path('/proc/meminfo').read_text(), re.M)[1]) * 1024


def blob(path):
    raw = Path(path).read_bytes()
    return hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()


def write_json(path, value):
    create_json(path, value)


def replace_json(path, value):
    tmp = Path(str(path) + '.tmp.' + str(os.getpid()))
    tmp.write_text(json.dumps(value, indent=2) + '\n')
    os.replace(tmp, path)


def set_control_state(path, state):
    """The stop file: the attempt's execution control, which the gate operator and this driver both honour."""
    control = json.loads(Path(path).read_text())
    control['state'] = state
    control.pop('phase', None)
    replace_json(path, control)
    return control


@contextlib.contextmanager
def publication_lock(inputs):
    """The attempt's cross-process publication lock (inputs/publication.lock, flock): finalization holds it
    while it fixes the verdict and writes the result, and `--stop` holds it while it decides and writes the
    control, so a stop and a publication never interleave."""
    inputs = Path(inputs)
    if not inputs.is_dir():
        yield
        return
    with (inputs / 'publication.lock').open('a+') as stream:
        fcntl.flock(stream, fcntl.LOCK_EX)
        yield


def stop_attempt(spec_path, orch):
    """`--stop`: under the publication lock, a published attempt is reported and left unchanged; otherwise
    its control becomes stopped, which the run's publication reads under the same lock."""
    spec = gate_config.load_spec(spec_path, orch)
    inputs = Path(spec['paths']['inputs'])
    result = Path(spec['paths']['result']).with_suffix('.json')
    with publication_lock(inputs):
        if result.is_file():
            print('already finished: ' + str(json.loads(result.read_text()).get('verdict')))
            return 0
        print(json.dumps(set_control_state(inputs / 'control.json', 'stopped')))
        return 0


class Driver:
    def __init__(self, spec_path, orch=ORCH, main=MAIN, sleep=time.sleep, clock=time.monotonic, available=meminfo_available):
        self.spec_path, self.orch, self.main = Path(spec_path), str(orch), Path(main)
        self.sleep, self.clock, self.available = sleep, clock, available
        self.stages, self.cancel_requested, self.entry = [], False, None
        self.publication, self.published = threading.RLock(), False
        self.own_unit = 'ep-fresh-' + os.environ['BOUNDED_ID'] if os.environ.get('BOUNDED_ID') else None
        self.started_at, self.started = now(), clock()

    # -- environment and probes ------------------------------------------------------------
    def canonical_environment(self):
        """The gate operator's public environment, rebuilt rather than inherited: no BOUNDED_*, CAPPED_*,
        ADMISSION_*, LAND_*, VITEST_* or NODE_OPTIONS from a bounded unit or a session reach it."""
        path, _ = execution_tools(TOOLS, hashes=False)
        environment = {key: os.environ[key] for key in KEEP if key in os.environ}
        environment.update(PATH=path, LC_ALL='C.UTF-8', BOUNDED_WORKERS='2', BOUNDED_CPU='600%',
                           PYTHONDONTWRITEBYTECODE='1', EP_ORCH=self.orch)
        return environment

    def command(self, argv, accepted=(0,), timeout=60, extra=None):
        argv = [str(item) for item in argv]
        result = subprocess.run(argv, capture_output=True, text=True, cwd=self.main, env={**self.env, **(extra or {})}, timeout=timeout)
        record = dict(argv=argv, exitCode=result.returncode, stdout=result.stdout, stderr=result.stderr)
        if result.returncode not in accepted:
            raise Stop('Instrumentation failed: ' + ' '.join(argv) + ': exit ' + str(result.returncode) + ' ' + result.stderr.strip())
        return record

    def probe(self):
        locks, held = {}, []
        try:
            for name in LOCKS:
                stream = (Path(self.orch) / (name + '.lock')).open('a+')
                held.append(stream)
                try:
                    fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    free = True
                except BlockingIOError:
                    free = False
                stat = os.fstat(stream.fileno())
                locks[name] = dict(available=free, device=stat.st_dev, inode=stat.st_ino)
        finally:
            for stream in held:
                stream.close()
        # The shared ledger, as the gate operator's own admission check reads it (never in the operator's environment).
        admission = self.command([self.main / 'scripts/orchestration/admission.sh', 'status'], extra=dict(BOUNDED_STATE_DIR=self.orch))
        units = self.command(['systemctl', '--user', 'list-units', 'ep-fresh-*', 'ep-command-*',
                              '--state=active,activating', '--no-legend', '--plain'])
        active = [line.split()[0] for line in units['stdout'].splitlines() if line.strip() and line.split()[0] != (self.own_unit or '') + '.service']
        return dict(at=now(), locks=locks, admission=admission, activeUnits=units, foreignActiveUnits=active,
                    hostAvailableBytes=self.available(), loadAverage=Path('/proc/loadavg').read_text().strip())

    @staticmethod
    def idle(probe):
        return (all(lock['available'] for lock in probe['locks'].values()) and not probe['foreignActiveUnits']
                and IDLE.fullmatch(probe['admission']['stdout'].strip()) is not None)

    def wait(self, seconds):
        for _ in range(int(seconds)):
            if self.cancel_requested:
                return
            self.sleep(1)

    def request_stop(self):
        """A stop signal: persist the stopped control at once, so no gate-operator step that starts or is
        running from now on keeps submission authority, whatever the driver is doing. After the result is
        published it changes nothing, so the recorded control stays the actual one."""
        with self.publication:
            if self.published:
                return
            self.cancel_requested = True
            self.persist_stop()

    def persist_stop(self):
        control = getattr(self, 'inputs', None) and self.inputs / 'control.json'
        try:
            if control and control.is_file() and json.loads(control.read_text()).get('state') != 'stopped':
                set_control_state(control, 'stopped')
        except (OSError, ValueError, AttributeError) as exc:  # A damaged control is reported, never trusted as active.
            self.stop_persist_error = str(exc)

    def check_stop(self):
        if self.cancel_requested:
            raise Stop('Cancelled: the driver received a stop signal')
        control = self.inputs / 'control.json'
        if control.is_file() and json.loads(control.read_text()).get('state') == 'stopped':
            raise Stop('Execution stopped by control: ' + str(control))

    # -- identities ---------------------------------------------------------------------------
    def check_main(self):
        s = self.spec
        head = git(self.main, 'rev-parse', 'HEAD')
        if head != s['base']:
            raise Stop('Moved base: MAIN is at ' + head + ', not BASE ' + s['base'] + '; regenerate the spec on the new base')
        if (git(self.main, 'rev-parse', 'HEAD^{tree}') != s['basetree'] or git(self.main, 'branch', '--show-current') != s.get('feature', gate_config.FEATURE)
                or git(self.main, 'status', '--porcelain=v1', '--untracked-files=all')):
            raise Stop('Identity mismatch: MAIN is not the clean integration branch at BASE/BASETREE')

    def check_worktree(self, candidate):
        s = self.spec
        wt = s['wt']
        if (git(wt, 'rev-parse', 'HEAD') != candidate or git(wt, 'rev-parse', 'HEAD^{tree}') != s['tree']
                or git(wt, 'branch', '--show-current') != s['branch'] or git(wt, 'status', '--porcelain=v1', '--untracked-files=all')):
            raise Stop('Identity mismatch: WT is not the clean ' + s['branch'] + ' at ' + candidate + ' / TREE ' + s['tree'])

    def identities(self, candidate=None):
        self.check_main()
        self.check_worktree(candidate or self.expected_head)

    def check_driver(self):
        """The operator identity this gate records: MAIN's committed driver at BASE, unmodified."""
        path = Path(__file__).resolve()
        if path != (self.main / SCRIPT_OPERATOR).resolve():
            raise Stop('Identity mismatch: run the driver from MAIN/' + SCRIPT_OPERATOR + ', not ' + str(path))
        committed = git(self.main, 'rev-parse', self.spec['base'] + ':' + SCRIPT_OPERATOR) if gate_core.git_holds(
            self.main, 'cat-file', '-e', self.spec['base'] + ':' + SCRIPT_OPERATOR) else None
        if committed is None or blob(path) != committed:
            raise Stop('Identity mismatch: the running driver is not the committed ' + SCRIPT_OPERATOR + ' at BASE')
        return committed

    def check_prepared_mapping(self):
        """Prepared mode: the prior attempt's mapping must bind exactly this gate before anything waits."""
        s = self.spec
        mapping_path = Path(s['paths']['mapping'])
        if not mapping_path.is_file() or hashlib.sha256(mapping_path.read_bytes()).hexdigest() != s['prepared']['mapping_sha256']:
            raise Stop('Prepared mapping mismatch: ' + str(mapping_path) + ' is missing or not the pinned sha256')
        prior = json.loads(mapping_path.read_text())
        expected = dict(BASE=s['base'], REVIEWED=s['reviewed'], TREE=s['tree'], WT=s['wt'], BR=s['branch'], ARCHIVE=s['archive'])
        for key, value in expected.items():
            if prior.get(key) != value:
                raise Stop('Prepared mapping mismatch: ' + key)
        if prior.get('SQUASHED') != s['prepared']['candidate']:
            raise Stop('Prepared mapping mismatch: SQUASHED is not the prepared candidate')

    def check_modes(self):
        """The mode proofs gate_core re-proves at every authorization, run now so a refusal stops before any wait."""
        s = self.spec
        v = dict(MAIN=str(self.main), ORCH=self.orch, WT=s['wt'], BASE=s['base'], REVIEWED=s['reviewed'],
                 TREE=s['tree'], E=s['paths']['attempt'])
        fields = gate_config.mode_fields(s)
        record = {}
        try:
            rebase = gate_core.rebase_scope(v, fields)
            if rebase is not None:
                record['rebaseProof'] = dict(passed=True, accepted=rebase[0], acceptedTree=rebase[1])
            carry = gate_core.carried_review(fields)
            if carry is not None:
                record['carriedReview'] = dict(passed=True, scope=list(gate_core.carry_scope(v, fields, carry, rebase)))
            lane = gate_core.light_lane_scope(v, fields)
            if lane is not None:
                record['lane'] = dict(passed=True, proof=lane)
            if 'remoteChecks' in fields:
                # gate_core.verify_remote_checks, with the prepared candidate a prepared attempt's mapping adds.
                from remote_checks import config as remote_config, verify_manifest
                remote = remote_config(fields['remoteChecks'])
                commits = {s['reviewed'], *([s['prepared']['candidate']] if 'prepared' in s else [])}
                verify_manifest(remote['path'], remote['sha256'], s['tree'], s['base'], s['wt'], self.orch, commits)
                record['remoteChecks'] = dict(passed=True, manifest=fields['remoteChecks'])
        except Exception as exc:
            raise Stop('Mode precheck refused: ' + str(exc))
        return record

    # -- stages -------------------------------------------------------------------------------
    def stage(self, name, operation):
        row = dict(name=name, startedAt=now())
        started = self.clock()
        self.stages.append(row)
        try:
            self.check_stop()  # Every boundary: a pending stop starts nothing.
            outcome = operation()
            row['outcome'] = 'ok'
            return outcome
        except Stop as exc:
            row.update(outcome='stopped', reason=str(exc))
            raise
        except Exception as exc:
            row.update(outcome='error', reason=str(exc))
            raise Stop(name + ' failed: ' + str(exc))
        finally:
            row.update(endedAt=now(), seconds=round(self.clock() - started, 3))

    def run_child(self, name, argv):
        """One gate-operator command, its output kept under the inputs. It never starts while a stop is
        pending. A stop signal never kills it: request_stop has already written the stopped control, which
        the gate operator honours at its own phase boundaries and in the observer, and the driver waits."""
        self.check_stop()
        log = self.inputs / (name + '-output.log')
        with log.open('x') as output:
            process = subprocess.Popen([str(item) for item in argv], cwd=self.main, env=self.env,
                                       stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
            write_json(self.inputs / (name + '-process.json'), dict(at=now(), pid=process.pid, wrapperPid=os.getpid(), argv=[str(item) for item in argv]))
            code = process.wait()
        (self.inputs / (name + '-exit.txt')).write_text(str(code) + '\n')
        self.stages[-1]['exitCode'] = code
        return code, log

    def tail(self, log, lines=5):
        return ' | '.join(Path(log).read_text().strip().splitlines()[-lines:])

    # -- the sequence -------------------------------------------------------------------------
    def run(self):
        try:
            self.spec = gate_config.load_spec(self.spec_path, self.orch)
        except Exception as exc:
            print('gate-run: invalid spec: ' + str(exc), file=sys.stderr)
            return 2
        s, paths = self.spec, self.spec['paths']
        self.inputs, self.attempt = Path(paths['inputs']), Path(paths['attempt'])
        self.result_md = Path(paths['result'])
        self.result_json = self.result_md.with_suffix('.json')
        self.done = Path(paths['done'])
        existing = [str(path) for path in (self.result_md, self.result_json, self.done, self.inputs, self.attempt) if path.exists()]
        if existing:
            print('gate-run: refusing to overwrite an earlier attempt: ' + ', '.join(existing), file=sys.stderr)
            return 2
        self.expected_head = s['prepared']['candidate'] if 'prepared' in s else s['reviewed']
        self.config_path = self.inputs / 'gate.json'
        self.verdict, self.reason = 'stopped', None
        try:
            self.env = self.canonical_environment()
            self.sequence()
        except Stop as exc:
            self.reason = str(exc)
        except Exception as exc:  # A driver defect still records its stop and exits non-zero.
            self.reason = 'Driver error: ' + type(exc).__name__ + ': ' + str(exc)
        self.recover()
        return self.finish()

    def sequence(self):
        s = self.spec
        self.driver_blob = self.stage('identity', lambda: (self.check_main(), self.check_driver())[1])
        self.stage('worktree', lambda: self.check_worktree(self.expected_head))
        if 'prepared' in s:
            self.stage('prepared-mapping', self.check_prepared_mapping)
        modes = self.stage('mode-prechecks', self.check_modes)
        self.inputs.mkdir(parents=False)
        run_id = 'gate-run:' + s['label'] + ':' + (os.environ.get('BOUNDED_ID') or time.strftime('%Y%m%d-%H%M%S') + '-' + str(os.getpid()))
        self.operator = gate_config.script_operator(self.main, s['base'], run_id)
        refs = {}
        write_json(self.inputs / 'operator.json', self.operator)
        refs['operator'] = reference(self.inputs / 'operator.json')
        write_json(self.inputs / 'control.json', {**gate_config.control(s, self.operator),
                                                  **({'state': 'stopped'} if self.cancel_requested else {})})
        refs['control'] = str(self.inputs / 'control.json')
        write_json(self.inputs / 'validation-plan.json', gate_config.validation_plan(s, self.main, self.orch))
        refs['plan'] = reference(self.inputs / 'validation-plan.json')
        message = gate_config.commit_message(s)
        if message is not None:
            with (self.inputs / 'commit-message.txt').open('x') as output:
                output.write(message)
            refs['message'] = reference(self.inputs / 'commit-message.txt')
        write_json(self.inputs / 'mode-precheck.json', modes)
        probe = self.stage('prelaunch', self.prelaunch)
        refs['storageBaseline'] = self.stage('storage-baseline', self.storage_baseline)
        refs['precheck'] = self.stage('environment-precheck', lambda: self.environment_precheck(probe))
        refs['evidence'] = [str(self.inputs / 'mode-precheck.json'), str(self.inputs / 'prelaunch-probes.jsonl')]
        write_json(self.config_path, gate_config.gate_config(s, self.main, self.orch, refs))
        self.env['GATE_CONFIG'] = str(self.config_path)
        self.check_stop()
        self.stage('prepare', self.prepare)
        self.entry = self.stage('runtime', self.runtime)
        candidate = json.loads((self.attempt / 'mapping.json').read_text())['SQUASHED']
        self.stage('admission-probe', lambda: self.reap(candidate))
        self.stage('preclaim', lambda: self.preclaim(candidate))
        self.stage('resume', self.resume)

    def prelaunch(self):
        """Three consecutive 30 s samples at the gate mode's launch guard plus 0.5 GiB, all five locks free,
        admission idle and no other heavy unit; at most 90 minutes."""
        threshold = launch_minimum_bytes(gate_config.mode_config(self.spec)) + PRECHECK_MARGIN
        started, consecutive, probe = self.clock(), 0, None
        with (self.inputs / 'prelaunch-probes.jsonl').open('x', buffering=1) as output:
            while True:
                self.identities()
                self.check_stop()
                probe = self.probe()
                ready = self.idle(probe) and probe['hostAvailableBytes'] >= threshold
                consecutive = consecutive + 1 if ready else 0
                output.write(json.dumps({**probe, 'thresholdBytes': threshold, 'consecutive': consecutive}) + '\n')
                if consecutive == PRELAUNCH_SAMPLES:
                    return probe
                if self.clock() - started >= PRELAUNCH_DEADLINE:
                    if self.idle(probe):
                        raise Stop('Memory guard: MemAvailable %.2f GiB is below %.2f GiB (launch guard plus 0.5 GiB) after %d minutes'
                                   % (probe['hostAvailableBytes'] / GiB, threshold / GiB, PRELAUNCH_DEADLINE // 60))
                    raise Stop('Admission not idle: locks, admission or heavy units stayed busy for %d minutes before preparation: %s'
                               % (PRELAUNCH_DEADLINE // 60, probe['admission']['stdout'].strip()))
                self.wait(PRELAUNCH_INTERVAL)

    def storage_baseline(self):
        journal = self.command(['journalctl', '-k', '-b', '--no-pager', '-n', '0', '-o', 'short-iso', '--show-cursor'])
        if '-- cursor: ' not in journal['stdout']:
            raise Stop('Storage baseline has no journal cursor')
        counters = self.command(['btrfs', 'device', 'stats', '/home'])
        write_json(self.inputs / 'storage-baseline.json', dict(at=now(), journal=journal, counters=counters))
        return reference(self.inputs / 'storage-baseline.json')

    def storage_check(self):
        baseline = json.loads((self.inputs / 'storage-baseline.json').read_text())
        cursor = baseline['journal']['stdout'].split('-- cursor: ')[1].strip()
        journal = self.command(['journalctl', '-k', '-b', '--after-cursor', cursor, '--no-pager', '-o', 'short-iso',
                                '--show-cursor', '--grep', STORAGE_PATTERN], accepted=(0, 1))
        counters = self.command(['btrfs', 'device', 'stats', '/home'])
        if journal['exitCode'] != 1:
            raise Stop('Storage event since the baseline: ' + journal['stdout'].strip().splitlines()[0])
        if counters['stdout'] != baseline['counters']['stdout']:
            raise Stop('Storage event since the baseline: btrfs device stats changed')
        return dict(journal=journal, counters=counters)

    def environment_precheck(self, probe):
        wt = Path(self.spec['wt'])
        lock = wt / 'node_modules/.pnpm/lock.yaml'
        value = {**probe, 'canonicalPATH': self.env['PATH'],
                 'publicEnvironment': {key: self.env.get(key) for key in ('LANG', 'LC_ALL', 'TZ', 'CI', 'VITEST_MAX_WORKERS', 'BOUNDED_WORKERS', 'BOUNDED_CPU')},
                 'generatedHashes': {name: hashlib.sha256((wt / name).read_bytes()).hexdigest() if (wt / name).is_file() else None for name in GENERATED},
                 'installedLock': reference(lock) if lock.is_file() else None,
                 'driver': dict(path=str(self.main / SCRIPT_OPERATOR), blob=self.driver_blob, runId=self.operator['runId'])}
        write_json(self.inputs / 'environment-precheck.json', value)
        return reference(self.inputs / 'environment-precheck.json')

    def prepare(self):
        code, log = self.run_child('prepare', [sys.executable, '-B', self.main / 'scripts/orchestration/gate-operator.py', 'prepare'])
        if code != 0:
            failed = self.attempt / 'prepare-failed.json'
            detail = json.loads(failed.read_text())['error'] if failed.is_file() else self.tail(log)
            raise Stop('prepare exited ' + str(code) + ': ' + detail)

    def runtime(self):
        result = self.command([sys.executable, '-B', self.main / 'scripts/orchestration/gate-operator.py', 'runtime'], accepted=(0, 1))
        entry = result['stdout'].strip()
        if result['exitCode'] != 0 or entry != str(self.attempt / 'operator-runtime/gate-operator.py'):
            raise Stop('runtime refused the retained entry: ' + (result['stderr'].strip() or entry))
        with (self.inputs / 'gate-entry.txt').open('x') as output:
            output.write(entry + '\n')
        return entry

    def reap(self, candidate):
        """Preparation's own capped verifier can leave its reservation for seconds; probe every 5 s, up to
        2 minutes, and never kill or remove anything."""
        started = self.clock()
        with (self.inputs / 'admission-reap.jsonl').open('x', buffering=1) as output:
            while True:
                self.identities(candidate)
                self.check_stop()
                probe = self.probe()
                output.write(json.dumps(probe) + '\n')
                if self.idle(probe):
                    return probe
                if self.clock() - started >= REAP_DEADLINE:
                    raise Stop('Admission not idle %d s after preparation: %s' % (REAP_DEADLINE, probe['admission']['stdout'].strip()))
                self.wait(REAP_INTERVAL)

    def preclaim(self, candidate):
        self.identities(candidate)
        self.check_stop()
        probe = self.probe()
        guard = launch_minimum_bytes(gate_config.mode_config(self.spec))
        if not self.idle(probe):
            raise Stop('Admission not idle at the submission claim: ' + probe['admission']['stdout'].strip())
        if probe['hostAvailableBytes'] < guard:
            raise Stop('Memory guard: MemAvailable %.2f GiB is below the %.0f GiB launch guard after preparation'
                       % (probe['hostAvailableBytes'] / GiB, guard / GiB))
        storage = self.storage_check()
        write_json(self.inputs / 'preclaim.json', {**probe, 'storage': storage})

    def resume(self):
        code, log = self.run_child('resume', [sys.executable, '-B', self.entry, 'resume'])
        if code != 0:
            raise Stop('resume exited ' + str(code) + ': ' + self.tail(log, 3))
        output = Path(log).read_text().strip().splitlines()
        last = json.loads(output[-1]) if output else {}
        if last.get('paused') or last.get('deferred'):
            raise Stop('resume returned without completion: ' + json.dumps(last))

    def recover(self):
        """After a stop with a submission claim and no collected result, the retained entry's `cancel` stops only
        the proven owned invocation and collects it when terminal (gate_operator.stop_owned)."""
        claim, result = self.attempt / 'submission-claim.json', self.attempt / 'result.json'
        if self.reason is None or self.entry is None or not claim.is_file() or result.is_file():
            return
        with (self.inputs / 'cancel-output.log').open('x') as output:
            code = subprocess.run([sys.executable, '-B', self.entry, 'cancel'], cwd=self.main, env=self.env,
                                  stdout=output, stderr=subprocess.STDOUT).returncode
        self.stages.append(dict(name='cancel', at=now(), exitCode=code))

    # -- result -------------------------------------------------------------------------------
    def load(self, path):
        try:
            return json.loads(Path(path).read_text())
        except (OSError, ValueError):
            return None

    def remote_report(self, remote):
        """The verified remote suite report a remoteChecks manifest names (remote_checks.suite_report)."""
        from remote_checks import load as load_manifest, suite_report
        return suite_report(load_manifest(remote['path'], remote['sha256'], self.orch), remote['path'])

    def suite(self):
        """Suite counts for every suite this gate ran or used: the local suite (local and compare), the
        remote suite (compare and replace) and the gate host's host audits (replace)."""
        config = self.load(self.config_path) or {}
        remote, lane = config.get('remoteChecks'), config.get('lane')
        out = dict(source='light lane: no suite' if lane else {None: 'local', 'compare': 'local+remote-compare',
                                                                'replace': 'remote+host-audits'}[remote and remote.get('mode')])
        local = self.attempt / 'triage-evidence/full.json'
        if local.exists():
            out['local'] = counts(local)
        if remote:
            out['remote'] = counts(lambda: self.remote_report(remote))
        audits = self.attempt / 'remote-evidence/host-audits.json'
        if audits.exists():
            record = self.load(audits)
            out['hostAudits'] = (dict(exitCode=record.get('exitCode'), **counts(record['report']['path']))
                                 if isinstance(record, dict) and isinstance(record.get('report'), dict) and isinstance(record['report'].get('path'), str)
                                 else dict(unavailable='host-audit record unreadable or without a report: ' + str(audits)))
        return out

    def receipt(self, invocation):
        if not (invocation and invocation.get('id')):
            return None
        path = Path(self.orch) / 'bounded' / invocation['id'] / 'receipt.json'
        receipt = self.load(path)
        return dict(path=str(path), **{key: receipt.get(key) for key in ('outcome', 'exitCode', 'startedAt', 'endedAt')}) if receipt else None

    @staticmethod
    def operator_result(operator):
        if not operator:
            return None
        return dict(passed=operator.get('passed'), failedChecks=sorted(k for k, ok in operator.get('checks', {}).items() if not ok),
                    errors=operator.get('errors'), suite=operator.get('suite'))

    def control_state(self):
        control = self.load(self.inputs / 'control.json')
        return control.get('state') if isinstance(control, dict) else None

    def landed(self, candidate, head, operator, completion):
        """Landed only with no stop at all: no recorded reason, no stop request, a still active control, a
        passed collection and completion, and MAIN at the candidate."""
        return (self.reason is None and not self.cancel_requested and self.control_state() == 'active'
                and bool(completion) and completion.get('passed') is True and bool(operator) and operator.get('passed') is True
                and candidate is not None and head == candidate)

    def gather(self):
        """Every evidence read the result needs, before the verdict exists. Damaged evidence becomes
        null or `unavailable`, never an exception: a stopped or failed gate still publishes its result."""
        s, attempt = self.spec, self.attempt
        mapping = self.load(attempt / 'mapping.json')
        operator, completion = self.load(attempt / 'result.json'), self.load(attempt / 'completion.json')
        operator = operator if isinstance(operator, dict) else None
        completion = completion if isinstance(completion, dict) else None
        candidate = mapping.get('SQUASHED') if isinstance(mapping, dict) else None
        head, tree = safely(lambda: git(self.main, 'rev-parse', 'HEAD')), safely(lambda: git(self.main, 'rev-parse', 'HEAD^{tree}'))
        invocation = self.load(attempt / 'submission.json')
        invocation = invocation if isinstance(invocation, dict) else None
        return dict(candidate=candidate, head=head, operator=operator, completion=completion,
                    fields=dict(title=s['title'], label=s['label'], kind=s['kind'], spec=safely(lambda: reference(self.spec_path)),
                                driver=dict(path=str(self.main / SCRIPT_OPERATOR), blob=getattr(self, 'driver_blob', None),
                                            runId=getattr(self, 'operator', {}).get('runId')),
                                identities=dict(base=s['base'], basetree=s['basetree'], reviewed=s['reviewed'], tree=s['tree'], candidate=candidate,
                                                mainHead=head, mainTree=tree, mainAtCandidate=head is not None and head == candidate),
                                inputs=str(self.inputs), attempt=str(attempt),
                                gateConfig=safely(lambda: reference(self.config_path)) if self.config_path.is_file() else None,
                                invocation=invocation, receipt=safely(lambda: self.receipt(invocation)),
                                operatorResult=safely(lambda: self.operator_result(operator)),
                                completion=dict(passed=completion.get('passed'), scope=completion.get('scope')) if completion else None,
                                suite=safely(self.suite, dict(source='unavailable')), stages=self.stages))

    def finish(self):
        record = self.gather()
        # The publication boundary: stop signals wait (and a stop from another thread waits on the lock)
        # while the verdict is fixed from the control and stop state read now and the files are written.
        blocked = signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGTERM, signal.SIGINT})
        try:
            with self.publication, publication_lock(self.inputs):  # and a `--stop` process waits on the flock
                landed = self.landed(record['candidate'], record['head'], record['operator'], record['completion'])
                if not landed:
                    self.reason = self.reason or ('Cancelled: the driver received a stop signal' if self.cancel_requested
                                                  else 'No checked completion: the operator result, completion or landing is missing')
                    self.persist_stop()  # A stopped run leaves no submission authority behind.
                verdict = 'landed' if landed else 'stopped'
                value = dict(version=1, verdict=verdict, passed=landed, stopReason=self.reason, **record['fields'],
                             control=self.control_state(),
                             preparedRetry=None if landed else safely(lambda: gate_config.prepared_retry(self.attempt)),
                             startedAt=self.started_at, endedAt=now(), wallSeconds=round(self.clock() - self.started, 3))
                self.publish(value)
                self.published = True
        finally:
            signal.pthread_sigmask(signal.SIG_SETMASK, blocked)
        print(json.dumps(dict(verdict=verdict, stopReason=self.reason, result=str(self.result_json))))
        return 0 if landed else 1

    def publish(self, value):
        write_json(self.result_json, value)
        with self.result_md.open('x') as output:
            output.write(markdown(value))
        self.done.parent.mkdir(parents=True, exist_ok=True)
        with self.done.open('x') as output:
            output.write(value['verdict'] + ' ' + value['label'] + ' ' + value['endedAt'] + ' ' + str(self.result_json) + '\n')


SUITE_KEYS = ('numTotalTestSuites', 'numPassedTestSuites', 'numFailedTestSuites', 'numTotalTests',
              'numPassedTests', 'numFailedTests', 'numPendingTests', 'numTodoTests', 'success')


def safely(read, fallback=None):
    """A result field whose evidence may be damaged: its value, or the fallback (never an exception)."""
    try:
        return read()
    except Exception:
        return fallback


def counts(source):
    """A Vitest JSON report's totals, from a path or a callable that returns one; a missing, truncated or
    malformed report is `unavailable` with the reason."""
    try:
        path = source() if callable(source) else source
        report = json.loads(Path(path).read_text())
        if not isinstance(report, dict):
            raise ValueError('not a JSON object')
        return dict(report=str(path), **{key: report.get(key) for key in SUITE_KEYS})
    except Exception as exc:
        return dict(unavailable=type(exc).__name__ + ': ' + str(exc), **({} if callable(source) else dict(report=str(source))))


def count_line(row):
    if 'unavailable' in row:
        return 'unavailable (' + row['unavailable'] + ')'
    return '%s/%s tests passed, %s failed, %s pending; %s/%s files passed (`%s`)' % (
        row['numPassedTests'], row['numTotalTests'], row['numFailedTests'], row['numPendingTests'],
        row['numPassedTestSuites'], row['numTotalTestSuites'], row['report'])


def markdown(value):
    ids, suite = value['identities'], value['suite']
    lines = ['# ' + value['title'] + ': scripted gate ' + value['label'], '',
             '- **Verdict:** ' + value['verdict'].upper() + ('' if value['passed'] else ' (exit 1)'),
             '- **Stop reason:** ' + (value['stopReason'] or 'none'),
             '- **SHAs:** BASE `%s` (tree `%s`), REVIEWED `%s`, TREE `%s`, candidate `%s`, MAIN now `%s`'
             % (ids['base'], ids['basetree'], ids['reviewed'], ids['tree'], ids['candidate'], ids['mainHead'])]
    if value['receipt']:
        lines.append('- **Invocation:** `%s`, receipt %s exit %s (%s to %s)' % (value['invocation']['id'], value['receipt']['outcome'],
                     value['receipt']['exitCode'], value['receipt']['startedAt'], value['receipt']['endedAt']))
    lines.append('- **Suite source:** ' + suite['source'])
    for name, title in (('local', 'Local suite'), ('remote', 'Remote suite'), ('hostAudits', 'Host audits')):
        if name in suite:
            lines.append('- **%s:** %s' % (title, count_line(suite[name])))
    if value['operatorResult']:
        lines.append('- **Collection:** passed %s; failed checks: %s' % (value['operatorResult']['passed'], ', '.join(value['operatorResult']['failedChecks']) or 'none'))
    if value['completion']:
        lines.append('- **Completion scope:** ' + str(value['completion']['scope']))
    retry = value['preparedRetry']
    if not value['passed']:
        lines.append('- **Next attempt:** ' + ('`prepared` with `%s`' % json.dumps(retry) if retry else
                                               'no mapping was written; a retry squashes the same REVIEWED again')
                     + ' (`gate_config.py retry`, runbook step 10)')
    lines += ['- **Driver:** `%s` blob `%s`, run `%s`' % (value['driver']['path'], value['driver']['blob'], value['driver']['runId']),
              '- **Evidence:** inputs `%s`, attempt `%s`, spec `%s`' % (value['inputs'], value['attempt'], (value['spec'] or {}).get('path')),
              '', '| Stage | Outcome | Exit | Seconds | Reason |', '|---|---|---|---|---|']
    for row in value['stages']:
        lines.append('| %s | %s | %s | %s | %s |' % (row['name'], row.get('outcome', ''), row.get('exitCode', ''), row.get('seconds', ''),
                                                    str(row.get('reason', '')).replace('|', '/')))
    return '\n'.join(lines) + '\n'


def main(argv=None):
    parser = argparse.ArgumentParser(description='Run one gate from its spec with the script operator.')
    parser.add_argument('spec')
    parser.add_argument('--stop', action='store_true', help="set the attempt's control to stopped and exit")
    parser.add_argument('--orch', default=os.environ.get('EP_ORCH', ORCH))
    args = parser.parse_args(argv)
    if args.stop:
        return stop_attempt(args.spec, args.orch)
    driver = Driver(args.spec, orch=args.orch)
    signal.signal(signal.SIGTERM, lambda signum, frame: driver.request_stop())
    signal.signal(signal.SIGINT, lambda signum, frame: driver.request_stop())
    return driver.run()


if __name__ == '__main__':
    sys.exit(main())
