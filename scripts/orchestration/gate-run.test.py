"""Script gate operator fixtures: gate-run.py, gate_config.py and the script operator identity in gate_core.

Every test runs on a scratch repository and run root with stubbed bounded.sh, admission.sh, systemctl,
journalctl and btrfs and a stub gate-operator.py whose prepare/resume run the real gate_core authorization.
No test launches an agent, a bounded unit or a gate.
"""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import gate_config  # noqa: E402
import gate_core  # noqa: E402
from workflow_evidence import create_json, digest, reference  # noqa: E402

GiB = 1024 ** 3
REAL = ('gate-run.py', 'gate_config.py', 'gate_core.py', 'gate_monitor.py', 'workflow_evidence.py',
        'validation.py', 'remote_checks.py', 'light_lane.py')
SOL = [{'id': 'reasoningEffort', 'value': 'xhigh'}, {'id': 'serviceTier', 'value': 'default'}]
OPUS = [{'id': 'effort', 'value': 'high'}, {'id': 'fastMode', 'value': False}]

# The stub gate operator: prepare and resume run the real gate_core checks on the generated gate.json,
# then do only what a fixture needs (a squash, a mapping, a recorded bounded.sh call, a checked FF).
STUB_OPERATOR = r'''#!/usr/bin/env python3
import json, os, shutil, subprocess, sys
from pathlib import Path
config = json.loads(Path(os.environ['GATE_CONFIG']).read_text())
sys.path.insert(0, config['main'] + '/scripts/orchestration')
import gate_core
from workflow_evidence import create_json, reference
v = gate_core.env(); E = Path(v['E']); O = Path(v['ORCH']); mode = sys.argv[1]
def git(root, *args): return subprocess.check_output(['git', '-C', root, *args], text=True).strip()
def flag(name): return (O / ('flag-' + name)).exists()
if mode == 'prepare':
    gate_core.reject_overrides()
    gate_core.authorization(v, full_validation=True)
    gate_core.execution_control(v, step='prepare')
    if flag('prepare-fail'):
        sys.exit('fixture prepare refusal')
    E.mkdir()
    if config['preparation']['mode'] == 'prepared':
        mapping = json.loads(Path(config['preparation']['mapping']['path']).read_text())
    else:
        git(v['WT'], 'update-ref', v['ARCHIVE'], v['REVIEWED'], '0' * 40)
        candidate = git(v['WT'], 'commit-tree', v['TREE'], '-p', v['BASE'], '-F', config['preparation']['message']['path'])
        git(v['WT'], 'update-ref', 'refs/heads/' + v['BR'], candidate, v['REVIEWED'])
        mapping = {key: v[key] for key in ('BASE', 'REVIEWED', 'TREE', 'WT', 'BR', 'ARCHIVE')}
        mapping['SQUASHED'] = candidate
    create_json(E / 'mapping.json', mapping)
    runtime = E / 'operator-runtime'; runtime.mkdir(); shutil.copyfile(__file__, runtime / 'gate-operator.py')
    create_json(E / 'prepared.json', dict(config=reference(v['CONFIG']), bindings=[reference(E / 'mapping.json')]))
    if flag('busy-after-prepare'): (O / 'admission-busy').touch()
    if flag('storage-event-after-prepare'): (O / 'storage-event').touch()
    print(json.dumps(mapping))
elif mode == 'runtime':
    print(E / 'operator-runtime/gate-operator.py')
elif mode == 'resume':
    if flag('resume-slow'):  # a stop signal reaches the driver while this short resume is starting
        import time; time.sleep(1.5)
    gate_core.reject_overrides()
    gate_core.authorization(v, full_validation=True)
    gate_core.execution_control(v, step='submit')
    candidate = json.loads((E / 'mapping.json').read_text())['SQUASHED']
    create_json(E / 'submission-claim.json', dict(candidate=candidate, label=v['LABEL'], attempt=v['E']))
    out = subprocess.run([str(O / 'bounded.sh'), '--detach', v['LABEL'], 'gate', 'land-queue.sh'], capture_output=True, text=True, check=True).stdout
    invocation = out.split('id: ')[1].strip()
    create_json(E / 'submission.json', dict(id=invocation, unit='ep-fresh-' + invocation, log=str(O / 'logs' / ('bounded-' + invocation + '.log')), candidate=candidate))
    receipt = O / 'bounded' / invocation; receipt.mkdir(parents=True)
    create_json(receipt / 'receipt.json', dict(id=invocation, outcome='ok', exitCode=0, startedAt='s', endedAt='e'))
    if flag('resume-stopped'):  # root's --stop while the operator observes
        control = json.loads(Path(config['control']).read_text()); control['state'] = 'stopped'
        Path(config['control']).write_text(json.dumps(control))
        gate_core.execution_control(v, step='observe')
    (E / 'triage-evidence').mkdir()
    if flag('truncated-suite'):  # the suite was interrupted while it wrote its report
        (E / 'triage-evidence/full.json').write_text('{"numTotalTests": 7, "numPass')
        sys.exit('fixture interrupted suite')
    if flag('malformed-host-audits'):
        (E / 'remote-evidence').mkdir()
        (E / 'remote-evidence/host-audits.json').write_text('{broken')
        sys.exit('fixture malformed host audits')
    create_json(E / 'triage-evidence/full.json', dict(success=True, numTotalTests=7, numPassedTests=7, numFailedTests=0, numPendingTests=0,
                numTodoTests=0, numTotalTestSuites=2, numPassedTestSuites=2, numFailedTestSuites=0))
    git(v['MAIN'], 'merge', '-q', '--ff-only', candidate)
    create_json(E / 'result.json', dict(passed=True, checks=dict(canonicalReceipt=True, checkedLanding=True), errors=[], evidence=[]))
    create_json(E / 'completion.json', dict(passed=True, result=reference(E / 'result.json'), scope='fixture scope'))
    print(json.dumps(dict(passed=True)))
elif mode == 'cancel':
    (O / 'cancel.log').open('a').write('cancel\n')
    print(json.dumps(dict(cancelled=True)))
'''


class FakeTime:
    def __init__(self, hook=None):
        self.now, self.hook, self.calls = 0.0, hook, 0

    def clock(self):
        return self.now

    def sleep(self, seconds):
        self.calls += 1
        self.now += seconds
        if self.hook:
            self.hook(self.calls)


class Fixture(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(dir=os.environ.get('TMPDIR'))
        self.root = Path(self.scratch.name).resolve()
        self.main, self.worker, self.orch = self.root / 'main', self.root / 'worker', self.root / 'orch'
        self.r = self.orch / 'run'
        for path in (self.main / 'scripts/orchestration', self.r / 'fixture-review-r1', self.orch / 'logs', self.orch / 'runs', self.root / 'bin'):
            path.mkdir(parents=True)
        scripts = self.main / 'scripts/orchestration'
        for name in REAL:
            shutil.copyfile(HERE / name, scripts / name)
        (scripts / 'gate-operator.py').write_text(STUB_OPERATOR)
        self.stub(scripts / 'admission.sh', '#!/bin/sh\ncase "$1" in status) if [ -e "$BOUNDED_STATE_DIR/admission-busy" ]; then '
                  'echo "memory: 12/18 GiB reserved; active: gate-x; queued: none"; else echo "memory: 0/18 GiB reserved; active: none; queued: none"; fi;; esac\n')
        (self.main / '.gitignore').write_text('node_modules/\n')
        self.git(self.main, 'init', '-q', '-b', 'feature/pf1-character-builder')
        self.git(self.main, 'config', 'user.name', 'Fixture')
        self.git(self.main, 'config', 'user.email', 'fixture@example.test')
        self.git(self.main, 'add', '.')
        self.git(self.main, 'commit', '-qm', 'base')
        self.base, self.basetree = self.git(self.main, 'rev-parse', 'HEAD'), self.git(self.main, 'rev-parse', 'HEAD^{tree}')
        self.git(self.main, 'worktree', 'add', '-qb', 'implementation', str(self.worker))
        for index in range(2):
            (self.worker / 'value').write_text(str(index) + '\n')
            self.git(self.worker, 'add', '.')
            self.git(self.worker, 'commit', '-qm', 'author step')
        self.reviewed, self.tree = self.git(self.worker, 'rev-parse', 'HEAD'), self.git(self.worker, 'rev-parse', 'HEAD^{tree}')
        # Shared run state, the stubbed wrappers and host tools.
        (self.orch / 'resource-policy.md').write_text('Synthetic fixture policy\n')
        self.stub(self.orch / 'bounded.sh', '#!/bin/sh\necho "$*" >> "%s/launches.log"\n'
                  'echo "unit: ep-fresh-$2-20261105-170000-abcdef; log: %s/logs/bounded-$2-20261105-170000-abcdef.log; id: $2-20261105-170000-abcdef"\n'
                  % (self.orch, self.orch))
        bin_dir = self.root / 'bin'
        self.stub(bin_dir / 'systemctl', '#!/bin/sh\nexit 0\n')
        self.stub(bin_dir / 'journalctl', '#!/bin/sh\ncase "$*" in *--after-cursor*) if [ -e "%s/storage-event" ]; then '
                  'echo "2026-11-05T17:00:00 kernel: ata9: hard resetting link"; exit 0; fi; echo "-- No entries --"; exit 1;; esac\n'
                  'printf -- "-- No entries --\\n-- cursor: s=fixture;i=1\\n"\n' % self.orch)
        self.stub(bin_dir / 'btrfs', '#!/bin/sh\necho "[/dev/sda2].write_io_errs    0"\n')
        for tool in ('node', 'pnpm', 'docker'):
            self.stub(bin_dir / tool, '#!/bin/sh\nexit 0\n')
        reviews = {}
        folder = self.r / 'fixture-review-r1'
        self.terminal(folder / 'author-terminal.json', 'author', 'claudeAgent', 'claude-opus-5-5', OPUS)
        for axis in ('standards', 'spec'):
            self.terminal(folder / (axis + '-terminal.json'), 'review-' + axis, 'codex', 'gpt-6.1-sol', SOL)
            (folder / (axis + '.md')).write_text('Synthetic fixture review, not authentic qualification.\n')
            reviews[axis] = dict(terminal='R/fixture-review-r1/' + axis + '-terminal.json', report='R/fixture-review-r1/' + axis + '.md')
        (folder / 'parent-acceptance.md').write_text('Fixture acceptance\n')
        self.spec = dict(title='Fixture gate', kind='code', base=self.base, basetree=self.basetree, reviewed=self.reviewed,
                         tree=self.tree, wt=str(self.worker), branch='implementation', label='fixture-r1',
                         archive='refs/archive/fixture/reviewed-final-r1', inputs_dir='R/fixture-gate-r1-inputs',
                         evidence_dir='R/fixture-gate-r1-evidence', result='R/fixture-gate-r1-result.md',
                         done_marker='EP_ORCH/runs/fixture-final-gate-r1.done', acceptance='R/fixture-review-r1/parent-acceptance.md',
                         author_terminal='R/fixture-review-r1/author-terminal.json', reviews=reviews,
                         message='Land the fixture', browser='Fixture only.', notes=[])
        self.spec_path = self.r / 'fixture-gate-spec-r1.json'
        self.write_spec()
        self.inputs, self.attempt = self.r / 'fixture-gate-r1-inputs', self.r / 'fixture-gate-r1-evidence'
        self.environment = mock.patch.dict(os.environ, {'PATH': str(bin_dir) + ':' + os.environ['PATH'],
                                                        'BOUNDED_LOCKS': 'resource curator', 'VITEST_MAX_WORKERS': '4',
                                                        'CAPPED_KIND': 'light', 'LANG': 'en_US.UTF-8'})
        self.environment.start()
        os.environ.pop('BOUNDED_ID', None)
        os.environ.pop('GATE_CONFIG', None)

    def tearDown(self):
        self.environment.stop()
        self.scratch.cleanup()

    def git(self, root, *args):
        return subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()

    def stub(self, path, text):
        path.write_text(text)
        path.chmod(0o755)

    def terminal(self, path, name, provider, model, options):
        path.write_text(json.dumps(dict(taskId='task-' + name, childRunId='run-' + name, latestTerminalRunId='run-' + name,
                                        status='completed', latestTerminalStatus='completed', hasPendingChildRuns=False,
                                        providerInstanceId=provider, model=model, options=options)))

    def write_spec(self):
        self.spec_path.write_text(json.dumps(self.spec, indent=2) + '\n')

    def flag(self, name):
        (self.orch / ('flag-' + name)).touch()

    def driver_module(self):
        spec = importlib.util.spec_from_file_location('gate_run_fixture', self.main / 'scripts/orchestration/gate-run.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def driver(self, available=30 * GiB, hook=None):
        module = self.driver_module()
        module.PRELAUNCH_DEADLINE = 300  # ten samples, not 180; test_prelaunch_constants_are_the_operator_rules pins 90 minutes
        clock = FakeTime(hook)
        value = available if callable(available) else (lambda: available)
        driver = module.Driver(self.spec_path, orch=self.orch, main=self.main, sleep=clock.sleep, clock=clock.clock, available=value)
        return module, driver, clock

    def run_gate(self, **options):
        module, driver, clock = self.driver(**options)
        code = driver.run()
        result_path = self.r / 'fixture-gate-r1-result.json'
        result = json.loads(result_path.read_text()) if result_path.is_file() else None
        return code, result, driver

    def launches(self):
        path = self.orch / 'launches.log'
        return path.read_text().splitlines() if path.is_file() else []

    def assert_stopped(self, code, result, reason):
        self.assertEqual(code, 1)
        self.assertEqual(result['verdict'], 'stopped')
        self.assertFalse(result['passed'])
        self.assertIn(reason, result['stopReason'])
        self.assertTrue((self.orch / 'runs/fixture-final-gate-r1.done').is_file())
        self.assertTrue((self.r / 'fixture-gate-r1-result.md').is_file())
        self.assertEqual(self.git(self.main, 'rev-parse', 'HEAD'), self.base)


class ScriptOperatorRunTest(Fixture):
    def test_end_to_end_dry_run_lands_through_the_stubbed_queue(self):
        code, result, driver = self.run_gate()
        self.assertEqual(code, 0, result and result['stopReason'])
        self.assertEqual(result['verdict'], 'landed')
        candidate = json.loads((self.attempt / 'mapping.json').read_text())['SQUASHED']
        self.assertEqual(result['identities']['candidate'], candidate)
        self.assertEqual(self.git(self.main, 'rev-parse', 'HEAD'), candidate)
        self.assertEqual(self.git(self.main, 'rev-parse', 'HEAD^{tree}'), self.tree)
        self.assertEqual(len(self.launches()), 1, 'exactly one submission')
        self.assertEqual((result['suite']['source'], result['suite']['local']['numPassedTests']), ('local', 7))
        self.assertEqual([row['name'] for row in result['stages']],
                         ['identity', 'worktree', 'mode-prechecks', 'prelaunch', 'storage-baseline', 'environment-precheck',
                          'prepare', 'runtime', 'admission-probe', 'preclaim', 'resume'])
        self.assertEqual({row['name']: row.get('exitCode') for row in result['stages'] if 'exitCode' in row}, dict(prepare=0, resume=0))
        operator = json.loads((self.inputs / 'operator.json').read_text())
        committed = self.git(self.main, 'rev-parse', self.base + ':scripts/orchestration/gate-run.py')
        self.assertEqual(operator, dict(kind='script', path=str(self.main / 'scripts/orchestration/gate-run.py'), commit=self.base,
                                        blob=committed, taskId='script:scripts/orchestration/gate-run.py@' + committed, runId=operator['runId']))
        self.assertEqual(result['driver']['blob'], committed)
        config = json.loads((self.inputs / 'gate.json').read_text())
        self.assertEqual(config['operator'], reference(self.inputs / 'operator.json'))
        self.assertEqual(config['phases'], ['prepare', 'submit', 'observe', 'collect', 'complete', 'checked-land'])
        self.assertEqual([item['path'] for item in config['preservedEvidence']],
                         [str(self.r / 'fixture-review-r1/parent-acceptance.md')] +
                         [str(self.inputs / name) for name in ('environment-precheck.json', 'mode-precheck.json', 'prelaunch-probes.jsonl')])
        self.assertEqual((self.inputs / 'commit-message.txt').read_text(),
                         'Land the fixture\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n')
        precheck = json.loads((self.inputs / 'environment-precheck.json').read_text())
        self.assertEqual(precheck['publicEnvironment'], dict(LANG=None, LC_ALL='C.UTF-8', TZ=None, CI=None, VITEST_MAX_WORKERS=None,
                                                             BOUNDED_WORKERS='2', BOUNDED_CPU='600%'))
        self.assertEqual(len((self.inputs / 'prelaunch-probes.jsonl').read_text().splitlines()), 3)
        self.assertIn('LANDED', (self.r / 'fixture-gate-r1-result.md').read_text())
        self.assertTrue((self.orch / 'runs/fixture-final-gate-r1.done').read_text().startswith('landed fixture-r1 '))

    def test_a_second_run_never_overwrites_an_attempt(self):
        self.assertEqual(self.run_gate()[0], 0)
        before = (self.r / 'fixture-gate-r1-result.json').read_bytes()
        module, driver, _ = self.driver()
        self.assertEqual(driver.run(), 2)
        self.assertEqual((self.r / 'fixture-gate-r1-result.json').read_bytes(), before)
        self.assertEqual(len(self.launches()), 1)

    def test_memory_guard_stops_before_preparation(self):
        code, result, _ = self.run_gate(available=20 * GiB)
        self.assert_stopped(code, result, 'Memory guard')
        self.assertFalse(self.attempt.exists())
        self.assertEqual(self.launches(), [])
        rows = (self.inputs / 'prelaunch-probes.jsonl').read_text().splitlines()
        self.assertEqual(json.loads(rows[0])['thresholdBytes'], int(21.5 * GiB))

    def test_replace_mode_samples_at_its_own_launch_guard(self):
        module, driver, _ = self.driver()
        driver.spec = {**self.spec, 'remote': dict(mode='replace')}
        self.assertEqual(module.launch_minimum_bytes(module.gate_config.mode_config(driver.spec)) + module.PRECHECK_MARGIN, int(16.5 * GiB))

    def test_post_preparation_memory_below_the_launch_guard_stops_before_submission(self):
        samples = iter([30 * GiB] * 3 + [20.5 * GiB] * 10)
        code, result, _ = self.run_gate(available=lambda: next(samples))
        self.assert_stopped(code, result, 'below the 21 GiB launch guard after preparation')
        self.assertEqual(self.launches(), [])
        self.assertTrue((self.attempt / 'mapping.json').is_file(), 'a stopped gate keeps its mapping for prepared mode')
        mapping = self.attempt / 'mapping.json'
        self.assertEqual(result['preparedRetry'], dict(candidate=json.loads(mapping.read_text())['SQUASHED'], mapping=str(mapping),
                                                      mapping_sha256=digest(mapping)), 'exactly the prepared field gate_config takes')
        self.assertEqual(result['control'], 'stopped', 'a stopped run leaves no submission authority')

    def test_storage_event_after_the_baseline_stops_before_submission(self):
        self.flag('storage-event-after-prepare')
        code, result, _ = self.run_gate()
        self.assert_stopped(code, result, 'Storage event since the baseline')
        self.assertEqual(self.launches(), [])
        self.assertIsNotNone(result['preparedRetry'])

    def test_admission_not_idle_after_preparation_stops_before_submission(self):
        self.flag('busy-after-prepare')
        code, result, _ = self.run_gate()
        self.assert_stopped(code, result, 'Admission not idle 120 s after preparation')
        self.assertEqual(self.launches(), [])
        self.assertGreaterEqual(len((self.inputs / 'admission-reap.jsonl').read_text().splitlines()), 24)

    def test_admission_not_idle_before_preparation_waits_then_stops(self):
        (self.orch / 'admission-busy').touch()
        code, result, _ = self.run_gate()
        self.assert_stopped(code, result, 'Admission not idle')
        self.assertFalse(self.attempt.exists())

    def test_held_lock_is_not_idle(self):
        import fcntl
        with (self.orch / 'curator2.lock').open('a+') as held:
            fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
            code, result, _ = self.run_gate()
        self.assert_stopped(code, result, 'Admission not idle')
        self.assertFalse(self.attempt.exists())

    def test_moved_base_stops_before_any_input(self):
        (self.main / 'later.txt').write_text('moved\n')
        self.git(self.main, 'add', '.')
        self.git(self.main, 'commit', '-qm', 'later landing')
        code, result, _ = self.run_gate()
        self.assertEqual(code, 1)
        self.assertIn('Moved base', result['stopReason'])
        self.assertFalse(self.inputs.exists())
        self.assertFalse(self.attempt.exists())

    def test_changed_candidate_is_an_identity_mismatch(self):
        (self.worker / 'untracked').write_text('dirty\n')
        code, result, _ = self.run_gate()
        self.assertEqual(code, 1)
        self.assertIn('Identity mismatch: WT', result['stopReason'])
        self.assertFalse(self.inputs.exists())

    def test_driver_other_than_the_committed_one_at_base_is_an_identity_mismatch(self):
        path = self.main / 'scripts/orchestration/gate-run.py'
        path.write_text(path.read_text() + '# a later driver\n')
        self.git(self.main, 'commit', '-qam', 'later driver')
        module, driver, _ = self.driver()
        driver.spec = self.spec
        with self.assertRaisesRegex(module.Stop, 'Identity mismatch: the running driver'):
            driver.check_driver()

    def test_prepared_mapping_mismatch_stops_before_any_wait(self):
        prior = self.r / 'prior-mapping.json'
        prior.write_text(json.dumps(dict(BASE=self.base, REVIEWED=self.reviewed, TREE=self.tree, WT=str(self.worker),
                                         BR='other-branch', ARCHIVE=self.spec['archive'], SQUASHED=self.reviewed)))
        self.spec['prepared'] = dict(candidate=self.reviewed, mapping=str(prior), mapping_sha256=digest(prior))
        self.write_spec()
        code, result, _ = self.run_gate()
        self.assertEqual(code, 1)
        self.assertIn('Prepared mapping mismatch: BR', result['stopReason'])
        self.assertFalse(self.inputs.exists())
        self.spec['prepared']['mapping_sha256'] = '0' * 64
        self.write_spec()
        for name in ('fixture-gate-r1-result.json', 'fixture-gate-r1-result.md'):
            (self.r / name).unlink()
        (self.orch / 'runs/fixture-final-gate-r1.done').unlink()
        code, result, _ = self.run_gate()
        self.assertIn('Prepared mapping mismatch', result['stopReason'])
        self.assertIn('pinned sha256', result['stopReason'])

    def test_refused_mode_proofs_stop_before_any_wait(self):
        cases = [(dict(rebase_proof=dict(oldBase=self.base, accepted=self.reviewed, acceptedTree=self.tree, cli_output='x')), 'needs a moved base'),
                 (dict(remote=dict(manifest='R/missing/manifest.json', sha256='0' * 64, mode='replace')), 'Mode precheck refused')]
        for change, message in cases:
            with self.subTest(mode=next(iter(change))):
                self.spec_path.write_text(json.dumps({**self.spec, **change}))
                for path in (self.r / 'fixture-gate-r1-result.json', self.r / 'fixture-gate-r1-result.md', self.orch / 'runs/fixture-final-gate-r1.done'):
                    path.unlink(missing_ok=True)
                code, result, _ = self.run_gate()
                self.assertEqual(code, 1)
                self.assertIn('Mode precheck refused', result['stopReason'])
                self.assertIn(message, result['stopReason'])
                self.assertFalse(self.inputs.exists())

    def test_control_stop_before_preparation_stops_without_preparing(self):
        module = self.driver_module()
        code, result, _ = self.run_gate(hook=lambda calls: calls == 1 and module.set_control_state(self.inputs / 'control.json', 'stopped'))
        self.assert_stopped(code, result, 'Execution stopped by control')
        self.assertFalse(self.attempt.exists())

    def test_stop_signal_before_preparation_cancels_without_preparing(self):
        holder = {}
        def hook(calls):
            holder['driver'].cancel_requested = True
        module, driver, clock = self.driver(hook=hook)
        holder['driver'] = driver
        self.assertEqual(driver.run(), 1)
        result = json.loads((self.r / 'fixture-gate-r1-result.json').read_text())
        self.assertIn('Cancelled', result['stopReason'])
        self.assertFalse(self.attempt.exists())

    def test_stopped_control_after_the_claim_goes_to_the_retained_cancel(self):
        self.flag('resume-stopped')
        code, result, _ = self.run_gate()
        self.assertEqual(code, 1)
        self.assertIn('resume exited 1', result['stopReason'])
        self.assertEqual(len(self.launches()), 1)
        self.assertEqual((self.orch / 'cancel.log').read_text(), 'cancel\n', 'a claimed, uncollected attempt goes to the retained cancel')
        self.assertEqual(result['stages'][-1]['name'], 'cancel')

    def test_the_driver_kinds_isolated_interpreter_runs_the_stop_command(self):
        code, result, _ = self.run_gate(available=20 * GiB)
        self.assertEqual(code, 1)
        control = self.inputs / 'control.json'
        value = json.loads(control.read_text())
        value['state'] = 'active'
        control.write_text(json.dumps(value))
        run = subprocess.run([sys.executable, '-I', '-B', str(self.main / 'scripts/orchestration/gate-run.py'), '--stop', str(self.spec_path),
                              '--orch', str(self.orch)], capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertEqual(run.stdout.strip(), 'already finished: stopped', 'a published attempt is reported, not changed')
        self.assertEqual(json.loads(control.read_text())['state'], 'active')

    def test_prelaunch_constants_are_the_operator_rules(self):
        module = self.driver_module()
        self.assertEqual((module.PRELAUNCH_SAMPLES, module.PRELAUNCH_INTERVAL, module.PRELAUNCH_DEADLINE), (3, 30, 5400))
        self.assertEqual((module.REAP_INTERVAL, module.REAP_DEADLINE), (5, 120))

    def test_invalid_spec_refuses_with_usage_exit(self):
        self.spec['remote_checks'] = dict(mode='replace')
        self.write_spec()
        module, driver, _ = self.driver()
        self.assertEqual(driver.run(), 2)
        self.assertFalse(self.inputs.exists())


STAGES = ['identity', 'worktree', 'mode-prechecks', 'prelaunch', 'storage-baseline', 'environment-precheck',
          'prepare', 'runtime', 'admission-probe', 'preclaim', 'resume']


class StopAuthorityTest(Fixture):
    """A stop signal persists as the stopped control at once; nothing launches after it and a stopped run never lands."""

    def patched_child(self, module, before=None, after=None):
        original = module.Driver.run_child

        def run_child(driver, name, argv):
            if before == name:
                driver.request_stop()
            result = original(driver, name, argv)
            if after == name:
                driver.request_stop()
            return result
        return mock.patch.object(module.Driver, 'run_child', run_child)

    def run_with(self, module, available=30 * GiB):
        clock = FakeTime()
        module.PRELAUNCH_DEADLINE = 300
        driver = module.Driver(self.spec_path, orch=self.orch, main=self.main, sleep=clock.sleep, clock=clock.clock, available=lambda: available)
        code = driver.run()
        return code, json.loads((self.r / 'fixture-gate-r1-result.json').read_text())

    def control(self):
        return json.loads((self.inputs / 'control.json').read_text())['state']

    def test_stop_during_prepare_leaves_no_submission_authority(self):
        module = self.driver_module()
        with self.patched_child(module, after='prepare'):
            code, result = self.run_with(module)
        self.assertEqual((code, result['verdict'], result['control']), (1, 'stopped', 'stopped'))
        self.assertEqual(self.control(), 'stopped')
        self.assertIn('Cancelled', result['stopReason'])
        self.assertEqual(self.launches(), [])
        self.assertIsNotNone(result['preparedRetry'])

    def test_stop_just_before_a_short_resume_launches_nothing(self):
        module = self.driver_module()
        with self.patched_child(module, before='resume'):
            code, result = self.run_with(module)
        self.assertEqual((code, result['verdict']), (1, 'stopped'))
        self.assertFalse((self.inputs / 'resume-output.log').exists(), 'resume never started')
        self.assertFalse((self.attempt / 'submission-claim.json').exists())
        self.assertEqual(self.launches(), [])

    def test_stop_while_a_short_resume_starts_is_honoured_by_the_operator(self):
        import threading
        self.flag('resume-slow')
        module = self.driver_module()
        original = module.Driver.run_child

        def run_child(driver, name, argv):
            if name == 'resume':
                threading.Timer(0.3, driver.request_stop).start()
            return original(driver, name, argv)
        with mock.patch.object(module.Driver, 'run_child', run_child):
            code, result = self.run_with(module)
        self.assertEqual((code, result['verdict']), (1, 'stopped'))
        self.assertFalse((self.attempt / 'submission-claim.json').exists(), 'the stopped control refused submission')
        self.assertEqual(self.launches(), [])

    def test_a_stop_that_arrives_after_landing_never_reports_landed(self):
        module = self.driver_module()
        with self.patched_child(module, after='resume'):
            code, result = self.run_with(module)
        self.assertEqual((code, result['verdict'], result['passed']), (1, 'stopped', False))
        self.assertTrue(result['identities']['mainAtCandidate'], 'the record says what Git shows')
        self.assertIn('Cancelled', result['stopReason'])

    def assert_finalization_stop(self, code, result):
        self.assertEqual((code, result['verdict'], result['passed']), (1, 'stopped', False))
        self.assertEqual(result['control'], self.control(), 'the recorded control is the actual control')
        self.assertEqual(self.control(), 'stopped')
        self.assertTrue((self.orch / 'runs/fixture-final-gate-r1.done').read_text().startswith('stopped '))
        self.assertIn('Cancelled', result['stopReason'])

    def test_a_stop_at_the_submission_read_in_finish_reports_stopped(self):
        module = self.driver_module()
        original = module.Driver.load

        def load(driver, path):
            if Path(path).name == 'submission.json':
                driver.request_stop()
            return original(driver, path)
        with mock.patch.object(module.Driver, 'load', load):
            self.assert_finalization_stop(*self.run_with(module))

    def test_a_stop_while_finish_reads_the_suite_reports_stopped(self):
        module = self.driver_module()
        original = module.Driver.suite

        def suite(driver):
            driver.request_stop()
            return original(driver)
        with mock.patch.object(module.Driver, 'suite', suite):
            self.assert_finalization_stop(*self.run_with(module))

    def test_a_stop_anywhere_before_publication_reports_stopped(self):
        module = self.driver_module()
        original = module.Driver.receipt

        def receipt(driver, invocation):
            driver.request_stop()
            return original(driver, invocation)
        with mock.patch.object(module.Driver, 'receipt', receipt):
            self.assert_finalization_stop(*self.run_with(module))

    def stop_process(self):
        return subprocess.Popen([sys.executable, '-I', '-B', str(self.main / 'scripts/orchestration/gate-run.py'), '--stop',
                                 str(self.spec_path), '--orch', str(self.orch)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    def test_a_file_stop_that_wins_the_publication_lock_reports_stopped(self):
        module = self.driver_module()
        original = module.Driver.suite
        stops = []

        def suite(driver):  # just before the boundary: the separate --stop process takes the lock first
            process = self.stop_process()
            stops.append(process.communicate(timeout=30))
            self.assertEqual(process.returncode, 0, stops[-1][1])
            return original(driver)
        with mock.patch.object(module.Driver, 'suite', suite):
            code, result = self.run_with(module)
        self.assertEqual((code, result['verdict'], result['passed']), (1, 'stopped', False))
        self.assertEqual((result['control'], self.control()), ('stopped', 'stopped'))
        self.assertIn('"state": "stopped"', stops[0][0])
        self.assertTrue((self.orch / 'runs/fixture-final-gate-r1.done').read_text().startswith('stopped '))

    def test_a_file_stop_that_loses_the_publication_lock_reports_already_finished(self):
        module = self.driver_module()
        original = module.Driver.publish
        processes = []

        def publish(driver, value):  # inside the boundary, with the lock held: the --stop process must wait
            import time
            processes.append(self.stop_process())
            time.sleep(1)
            self.assertIsNone(processes[0].poll(), '--stop waits on the publication lock')
            return original(driver, value)
        with mock.patch.object(module.Driver, 'publish', publish):
            code, result = self.run_with(module)
        out, err = processes[0].communicate(timeout=30)
        self.assertEqual((processes[0].returncode, out.strip()), (0, 'already finished: landed'), err)
        self.assertEqual((code, result['verdict'], result['control'], self.control()), (0, 'landed', 'active', 'active'))

    def test_a_stop_after_publication_changes_nothing(self):
        module = self.driver_module()
        clock = FakeTime()
        driver = module.Driver(self.spec_path, orch=self.orch, main=self.main, sleep=clock.sleep, clock=clock.clock, available=lambda: 30 * GiB)
        self.assertEqual(driver.run(), 0)
        driver.request_stop()
        result = json.loads((self.r / 'fixture-gate-r1-result.json').read_text())
        self.assertEqual((result['verdict'], result['control'], self.control()), ('landed', 'active', 'active'))

    def test_a_stop_at_every_boundary_starts_nothing_after_it(self):
        for boundary in STAGES:
            with self.subTest(boundary=boundary):
                self.tearDown()
                self.setUp()
                module = self.driver_module()
                original = module.Driver.stage

                def stage(driver, name, operation, boundary=boundary):
                    if name == boundary:
                        driver.request_stop()
                    return original(driver, name, operation)
                with mock.patch.object(module.Driver, 'stage', stage):
                    code, result = self.run_with(module)
                self.assertEqual((code, result['verdict']), (1, 'stopped'))
                self.assertIn('Cancelled', result['stopReason'])
                self.assertEqual(self.launches(), [])
                names = [row['name'] for row in result['stages']]
                self.assertEqual(names[-1], boundary)
                self.assertEqual(result['stages'][-1]['outcome'], 'stopped')
                if (self.inputs / 'control.json').is_file():
                    self.assertEqual(self.control(), 'stopped')
                self.assertEqual(self.attempt.exists(), STAGES.index(boundary) > STAGES.index('prepare'))


class SuiteCountsTest(Fixture):
    def report(self, name, total, passed, pending=0):
        path = self.r / name
        path.write_text(json.dumps(dict(success=True, numTotalTests=total, numPassedTests=passed, numFailedTests=0, numPendingTests=pending,
                                        numTodoTests=0, numTotalTestSuites=3, numPassedTestSuites=3, numFailedTestSuites=0)))
        return path

    def suite(self, config, remote_report=None):
        module, driver, _ = self.driver()
        driver.attempt, driver.config_path = self.attempt, self.r / 'gate.json'
        driver.config_path.write_text(json.dumps(config))
        with mock.patch.object(module.Driver, 'remote_report', lambda driver, remote: remote_report):
            return module, driver.suite()

    def test_replace_reports_the_remote_suite_and_the_host_audits(self):
        remote = self.report('remote-full.json', 11521, 11519, pending=2)
        audits = self.report('host-audits-report.json', 2, 2)
        (self.attempt / 'remote-evidence').mkdir(parents=True)
        (self.attempt / 'remote-evidence/host-audits.json').write_text(json.dumps(dict(exitCode=0, report=reference(audits))))
        module, suite = self.suite(dict(remoteChecks=dict(path='/m', sha256='0' * 64, mode='replace')), remote)
        self.assertEqual(suite['source'], 'remote+host-audits')
        self.assertNotIn('local', suite)
        self.assertEqual((suite['remote']['numTotalTests'], suite['remote']['numPassedTests'], suite['remote']['numPendingTests']), (11521, 11519, 2))
        self.assertEqual((suite['hostAudits']['numPassedTests'], suite['hostAudits']['exitCode']), (2, 0))
        lines = module.markdown(dict(title='t', label='l', verdict='landed', passed=True, stopReason=None, receipt=None, operatorResult=None,
                                     completion=None, preparedRetry=None, stages=[], suite=suite, inputs='i', attempt='a', spec=dict(path='s'),
                                     driver=dict(path='p', blob='b', runId='r'),
                                     identities=dict(base='b', basetree='bt', reviewed='r', tree='t', candidate='c', mainHead='c')))
        self.assertIn('**Remote suite:** 11519/11521 tests passed', lines)
        self.assertIn('**Host audits:** 2/2 tests passed', lines)

    def test_compare_reports_both_suites_and_local_reports_one(self):
        (self.attempt / 'triage-evidence').mkdir(parents=True)
        shutil.copyfile(self.report('local.json', 20, 20), self.attempt / 'triage-evidence/full.json')
        _, suite = self.suite(dict(remoteChecks=dict(path='/m', sha256='0' * 64, mode='compare')), self.report('remote.json', 20, 18, pending=2))
        self.assertEqual(suite['source'], 'local+remote-compare')
        self.assertEqual((suite['local']['numPassedTests'], suite['remote']['numPassedTests']), (20, 18))
        _, suite = self.suite({})
        self.assertEqual((suite['source'], suite['local']['numTotalTests']), ('local', 20))
        self.assertNotIn('remote', suite)

    def test_an_interrupted_suite_still_publishes_the_stopped_result(self):
        self.flag('truncated-suite')
        code, result, _ = self.run_gate()
        self.assertEqual((code, result['verdict']), (1, 'stopped'))
        self.assertIn('unavailable', result['suite']['local'])
        self.assertIn('unavailable', (self.r / 'fixture-gate-r1-result.md').read_text())
        self.assertTrue((self.orch / 'runs/fixture-final-gate-r1.done').is_file())

    def test_a_malformed_host_audit_record_still_publishes_the_stopped_result(self):
        self.flag('malformed-host-audits')
        code, result, _ = self.run_gate()
        self.assertEqual((code, result['verdict']), (1, 'stopped'))
        self.assertIn('unavailable', result['suite']['hostAudits'])
        self.assertTrue((self.orch / 'runs/fixture-final-gate-r1.done').is_file())

    def test_missing_or_malformed_host_audit_reports_are_unavailable(self):
        (self.attempt / 'remote-evidence').mkdir(parents=True)
        record = self.attempt / 'remote-evidence/host-audits.json'
        broken = self.r / 'broken-report.json'
        broken.write_text('[1, 2')
        for report in (dict(path=str(self.r / 'missing.json'), sha256='0' * 64), reference(broken)):
            record.write_text(json.dumps(dict(exitCode=0, report=report)))
            _, suite = self.suite(dict(remoteChecks=dict(path='/m', sha256='0' * 64, mode='replace')), self.report('remote.json', 3, 3))
            self.assertIn('unavailable', suite['hostAudits'])
        record.write_text(json.dumps(dict(exitCode=0)))
        _, suite = self.suite(dict(remoteChecks=dict(path='/m', sha256='0' * 64, mode='replace')), self.report('remote.json', 3, 3))
        self.assertIn('without a report', suite['hostAudits']['unavailable'])

    def test_an_unreadable_remote_report_is_recorded_not_hidden(self):
        module, driver, _ = self.driver()
        driver.attempt, driver.config_path = self.attempt, self.r / 'gate.json'
        driver.config_path.write_text(json.dumps(dict(remoteChecks=dict(path=str(self.r / 'missing.json'), sha256='0' * 64, mode='replace'))))
        self.assertIn('unavailable', driver.suite()['remote'])


class PreparedRetryTest(Fixture):
    def run_spec(self, path, available=lambda: 30 * GiB):
        module = self.driver_module()
        module.PRELAUNCH_DEADLINE = 300
        clock = FakeTime()
        return module.Driver(path, orch=self.orch, main=self.main, sleep=clock.sleep, clock=clock.clock, available=available).run()

    def test_a_stopped_prepared_attempt_retries_in_prepared_mode_on_the_original_frame(self):
        samples = iter([30 * GiB] * 3 + [20.5 * GiB] * 10)
        self.assertEqual(self.run_spec(self.spec_path, lambda: next(samples)), 1)
        first = json.loads((self.r / 'fixture-gate-r1-result.json').read_text())
        retry = gate_config.retry_spec(self.spec_path, self.r / 'fixture-gate-spec-r2.json', 'fixture-r2', self.orch)
        spec = json.loads(retry.read_text())
        self.assertEqual(spec['prepared'], first['preparedRetry'])
        for key in ('base', 'basetree', 'reviewed', 'tree', 'branch', 'archive', 'reviews', 'author_terminal', 'acceptance', 'message'):
            self.assertEqual(spec[key], self.spec[key], key)
        self.assertEqual((spec['label'], spec['inputs_dir'], spec['done_marker']),
                         ('fixture-r2', 'R/fixture-gate-r2-inputs', 'EP_ORCH/runs/run-fixture-final-gate-r2.done'))
        self.assertEqual(self.run_spec(retry), 0)
        second = json.loads((self.r / 'fixture-gate-r2-result.json').read_text())
        self.assertEqual(second['verdict'], 'landed')
        config = json.loads((self.r / 'fixture-gate-r2-inputs/gate.json').read_text())
        self.assertEqual(config['preparation'], dict(mode='prepared', archive=self.spec['archive'], candidate=first['identities']['candidate'],
                                                     mapping=dict(path=first['preparedRetry']['mapping'], sha256=first['preparedRetry']['mapping_sha256'])))
        self.assertEqual({axis: review['commit'] for axis, review in config['reviews'].items()}, dict(standards=self.reviewed, spec=self.reviewed))
        self.assertEqual(self.git(self.main, 'rev-parse', 'HEAD'), first['identities']['candidate'])
        self.assertEqual(len(self.launches()), 1)

    def test_an_attempt_stopped_before_preparation_retries_as_the_same_squash(self):
        self.assertEqual(self.run_spec(self.spec_path, lambda: 20 * GiB), 1)
        self.assertIsNone(json.loads((self.r / 'fixture-gate-r1-result.json').read_text())['preparedRetry'])
        spec = json.loads(gate_config.retry_spec(self.spec_path, self.r / 'fixture-gate-spec-r2.json', 'fixture-r2', self.orch).read_text())
        self.assertNotIn('prepared', spec)
        self.assertEqual((spec['reviewed'], spec['message']), (self.reviewed, self.spec['message']))
        self.assertEqual(self.run_spec(self.r / 'fixture-gate-spec-r2.json'), 0)

    def test_retry_refusals(self):
        with self.assertRaisesRegex(RuntimeError, 'no result'):
            gate_config.retry_spec(self.spec_path, self.r / 'fixture-gate-spec-r2.json', 'fixture-r2', self.orch)
        self.assertEqual(self.run_spec(self.spec_path), 0)
        with self.assertRaisesRegex(RuntimeError, 'Only a stopped attempt'):
            gate_config.retry_spec(self.spec_path, self.r / 'fixture-gate-spec-r2.json', 'fixture-r2', self.orch)


class GateConfigTest(Fixture):
    def refs(self):
        for name in ('operator.json', 'validation-plan.json', 'storage-baseline.json', 'environment-precheck.json', 'commit-message.txt'):
            (self.r / name).write_text('{}\n')
        return dict(operator=reference(self.r / 'operator.json'), plan=reference(self.r / 'validation-plan.json'),
                    storageBaseline=reference(self.r / 'storage-baseline.json'), precheck=reference(self.r / 'environment-precheck.json'),
                    message=reference(self.r / 'commit-message.txt'), control=str(self.r / 'control.json'))

    def build(self):
        spec = gate_config.load_spec(self.spec_path, self.orch)
        return gate_config.gate_config(spec, self.main, self.orch, self.refs())

    def test_generation_is_deterministic_and_binds_reviewed_scope(self):
        first, second = self.build(), self.build()
        self.assertEqual(first, second)
        for axis in ('standards', 'spec'):
            review = first['reviews'][axis]
            self.assertEqual((review['commit'], review['tree']), (self.reviewed, self.tree))
            self.assertEqual(review['target'], dict(providerInstanceId='codex', model='gpt-6.1-sol', options=dict(reasoningEffort='xhigh', serviceTier='default')))
            self.assertEqual((review['taskId'], review['runId'], review['disposition'], review['unresolved']), ('task-review-' + axis, 'run-review-' + axis, 'accepted', []))
        self.assertEqual(first['preparation']['mode'], 'squash')
        self.assertEqual(first['validation']['receipts'], {})
        self.assertEqual([item['path'] for item in first['preservedEvidence']],
                         [str(self.r / 'fixture-review-r1/parent-acceptance.md'), str(self.r / 'environment-precheck.json')])
        for key in ('rebaseProof', 'carriedReview', 'remoteChecks', 'lane', 'issue'):
            self.assertNotIn(key, first)

    def test_mode_fields_follow_the_spec(self):
        attestation = self.r / 'attestation.json'
        attestation.write_text('{}')
        lane = self.r / 'lane.json'
        lane.write_text(json.dumps(dict(verdict='PASS', lane=dict(mode='light', rule='light-lane-v1', paths=['docs/x.md']))))
        old, accepted, tree, carried, ctree = ('1' * 40, '2' * 40, '3' * 40, '4' * 40, '5' * 40)
        self.spec.update(rebase_proof=dict(oldBase=old, accepted=accepted, acceptedTree=tree, cli_output='x', q1='R/fixture-review-r1/parent-acceptance.md'),
                         carried_review=dict(axis='standards', commit=carried, tree=ctree, attestation='R/attestation.json', attestation_sha256='a' * 64),
                         remote=dict(manifest='/abs/manifest.json', sha256='b' * 64, mode='compare'), lane=dict(cli_output='R/lane.json'))
        self.write_spec()
        config = self.build()
        self.assertEqual(config['rebaseProof'], dict(oldBase=old, accepted=accepted, acceptedTree=tree))
        self.assertEqual(config['carriedReview'], dict(axis='standards', commit=carried, tree=ctree, attestation=dict(path=str(attestation), sha256='a' * 64)))
        self.assertEqual(config['remoteChecks'], dict(path='/abs/manifest.json', sha256='b' * 64, mode='compare'))
        self.assertEqual(config['lane'], dict(mode='light', rule='light-lane-v1', paths=['docs/x.md']))
        self.assertEqual((config['reviews']['standards']['commit'], config['reviews']['standards']['tree']), (carried, ctree))
        self.assertEqual((config['reviews']['spec']['commit'], config['reviews']['spec']['tree']), (accepted, tree))
        self.assertIn(str(lane), [item['path'] for item in config['preservedEvidence']])

    def test_prepared_and_curation_preparations(self):
        mapping = self.r / 'mapping.json'
        mapping.write_text('{}')
        self.spec['prepared'] = dict(candidate=self.reviewed, mapping='R/mapping.json', mapping_sha256='c' * 64)
        self.write_spec()
        self.assertEqual(self.build()['preparation'], dict(mode='prepared', archive=self.spec['archive'], candidate=self.reviewed,
                                                           mapping=dict(path=str(mapping), sha256='c' * 64)))
        del self.spec['prepared']
        message = self.r / 'cur-message.txt'
        message.write_text('Curate fixtures (#7)\n')
        terminal = self.spec['reviews']['standards']
        self.spec.update(kind='curation', issue=7, message_file='R/cur-message.txt', message_sha256=digest(message),
                         reviews=dict(curation=terminal))
        self.write_spec()
        receipt = self.orch / 'logs/cur-7-prep.receipt'
        receipt.write_text('fixture prep receipt\n')
        config = self.build()
        self.assertIn(reference(receipt), config['preservedEvidence'], "the batch's prep receipt is preserved, as operators did")
        self.assertEqual((config['kind'], config['issue']), ('curation', 7))
        self.assertEqual(config['preparation'], dict(mode='squash', archive=self.spec['archive'], message=reference(message)))
        self.assertEqual(set(config['reviews']), {'curation'})
        spec = gate_config.load_spec(self.spec_path, self.orch)
        self.assertIsNone(gate_config.commit_message(spec))

    def test_spec_refusals(self):
        cases = [(dict(lane_typo=1), 'Unknown gate spec keys'), (dict(kind='pair'), 'kind'), (dict(base='abc'), 'Full Git identity'),
                 (dict(reviews=dict(standards={})), 'reviews must be exactly'), (dict(inputs_dir='relative/x'), 'absolute or start with R/'),
                 (dict(kind='curation', issue=3, reviews=dict(curation={}), message_file='/m', message_sha256='0', lane={}), 'code gates only')]
        original = dict(self.spec)
        for change, message in cases:
            self.spec = {**original, **change}
            self.write_spec()
            with self.assertRaisesRegex(RuntimeError, message):
                spec = gate_config.load_spec(self.spec_path, self.orch)
                gate_config.gate_config(spec, self.main, self.orch, self.refs())


class ScriptOperatorIdentityTest(Fixture):
    def values(self):
        return dict(MAIN=str(self.main), BASE=self.base, E=str(self.attempt), CONFIG=str(self.r / 'gate.json'))

    def script(self, **changes):
        identity = gate_config.script_operator(self.main, self.base, 'gate-run:fixture-r1:1')
        identity.update(changes)
        return identity

    def test_committed_driver_at_base_is_the_operator(self):
        self.assertEqual(gate_core.operator_identity(self.values(), self.script()), 'script')

    def test_script_identity_mismatches_refuse(self):
        cases = [(dict(blob='0' * 40), 'blob'), (dict(commit=self.reviewed), 'commit is not BASE'),
                 (dict(path='/elsewhere/gate-run.py'), 'path'), (dict(taskId='script:other'), 'taskId'),
                 (dict(runId=''), 'runId'), (dict(extra=1), 'keys')]
        for change, message in cases:
            with self.assertRaisesRegex(RuntimeError, 'Script operator identity mismatch: ' + message):
                gate_core.operator_identity(self.values(), self.script(**change))

    def test_codex_operator_only_for_an_attempt_already_prepared_under_it(self):
        codex = dict(taskId='t', childRunId='r', providerInstanceId='codex', model='gpt-6.1-sol',
                     options=[{'id': 'reasoningEffort', 'value': 'high'}, {'id': 'serviceTier', 'value': 'default'}])
        config = self.r / 'gate.json'
        config.write_text('{"fixture": true}\n')
        with self.assertRaisesRegex(RuntimeError, 'accepted only for an attempt already prepared under it'):
            gate_core.operator_identity(self.values(), codex)
        self.attempt.mkdir()
        create_json(self.attempt / 'prepared.json', dict(config=reference(config)))
        self.assertEqual(gate_core.operator_identity(self.values(), codex), 'codex')
        config.write_text('{"fixture": "changed"}\n')
        with self.assertRaisesRegex(RuntimeError, 'accepted only'):
            gate_core.operator_identity(self.values(), codex)

    def test_control_bound_to_another_run_refuses(self):
        code, result, _ = self.run_gate()
        self.assertEqual(code, 0)
        control = json.loads((self.inputs / 'control.json').read_text())
        control['runId'] = 'gate-run:fixture-r1:someone-else'
        (self.inputs / 'control.json').write_text(json.dumps(control))
        with mock.patch.dict(os.environ, {'GATE_CONFIG': str(self.inputs / 'gate.json')}):
            values = gate_core.env()
        with self.assertRaisesRegex(RuntimeError, 'Execution control identity mismatch'):
            gate_core.execution_control(values, step='collect')


if __name__ == '__main__':
    unittest.main()
