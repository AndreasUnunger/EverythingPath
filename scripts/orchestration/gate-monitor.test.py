"""Gate memory cap and host guards in the monitor. Fixture rows only; no live unit/backend/gate."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
spec = importlib.util.spec_from_file_location('gate_monitor', HERE / 'gate_monitor.py')
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)

GiB = 1024**3
# The gate unit's MemoryMax per gate mode, and the launch guard as that cap
# plus the unchanged 6 GiB in-run host floor. Option 1 (owner, 2026-10-30):
# 15 GiB for gates that run the local full suite (local, compare). The owner's
# 2026-11-03 decision: a measured, smaller cap for replace gates.
FULL_CAP = 15 * GiB
REPLACE_CAP = 10 * GiB
FLOOR = 6 * GiB
CAPS = dict(local=FULL_CAP, compare=FULL_CAP, replace=REPLACE_CAP)


def scope(real=0, **systemd):
    return {'systemctlExit': 0, 'systemd': dict(ActiveState='active', **systemd),
            'memory.events': 'max 0\noom 0\noom_kill 0\noom_group_kill 0\n',
            'memory.current': str(real), 'memory.stat': 'file 0\nshmem 0\n'}


def gate_config(mode):
    config = dict(version=1, kind='code')
    if mode != 'local':
        config['remoteChecks'] = dict(path='/manifest.json', sha256='0' * 64, mode=mode)
    return config


class GateMemoryCapTest(unittest.TestCase):
    def setUp(self):
        scratch = tempfile.TemporaryDirectory(dir=os.environ['TMPDIR'])
        self.addCleanup(scratch.cleanup)
        self.e = Path(scratch.name)
        (self.e / 'protected-refs.json').write_text('{}')
        self.v = dict(E=str(self.e), ORCH=str(self.e), BASE='b' * 40, TREE='t' * 40, REVIEWED='r' * 40,
                      ARCHIVE='refs/archive', BR='branch', FEATURE='feature', CONFIG=str(self.e / 'gate.json'))
        self.d = dict(SQUASHED='s' * 40)
        self.base = dict(slice=scope())
        self.mode('local')

    def mode(self, mode):
        Path(self.v['CONFIG']).write_text(json.dumps(gate_config(mode)))
        return CAPS[mode]

    def row(self, cap, unit_real=0, slice_real=0, bounded_peak=0, unit_props=None):
        unit = dict(MemoryMax=str(cap), MemoryHigh='infinity', MemorySwapMax='0', CPUQuotaPerSecUSec='6s', TasksMax='1024',
                    CPUWeight='20', Nice='10', Restart='no', LimitCORE='0', TimeoutStopUSec='5min')
        unit.update(unit_props or {})
        sliced = dict(MemoryMax=str(20 * GiB), MemoryHigh=str(18 * GiB), MemorySwapMax='0', CPUQuotaPerSecUSec='8s', TasksMax='2048')
        return dict(unit=scope(unit_real, **unit), slice=scope(slice_real, **sliced), boundedSample='real_peak=%d\n' % bounded_peak,
                    integrationStatus='', candidateStatus='', candidateHead=self.d['SQUASHED'], integrationHead=self.v['BASE'],
                    candidateTree=self.v['TREE'], archiveSHA=self.v['REVIEWED'], refs={}, guard={})

    def violations(self, row):
        with patch.object(monitor, 'guard_violations', return_value=[]):
            return monitor.violations(self.v, None, self.d, self.base, row)

    def test_each_mode_has_one_named_cap_and_a_launch_guard_of_cap_plus_the_unchanged_floor(self):
        self.assertEqual(monitor.GATE_MEMORY_MAX_BYTES, CAPS)
        self.assertEqual(monitor.HOST_FLOOR_BYTES, FLOOR)
        for mode, cap in CAPS.items():
            with self.subTest(mode=mode):
                config = gate_config(mode)
                self.assertEqual(monitor.gate_mode(config), mode)
                self.assertEqual(monitor.gate_memory_max_bytes(config), cap)
                self.assertEqual(monitor.launch_minimum_bytes(config), cap + FLOOR)
        self.assertEqual([monitor.launch_minimum_bytes(gate_config(m)) // GiB for m in ('local', 'compare', 'replace')], [21, 21, 16])

    def test_the_bounded_launch_value_is_the_mode_cap_in_systemd_units(self):
        self.assertEqual(monitor.bounded_gate_memory_max(gate_config('local')), '15G')
        self.assertEqual(monitor.bounded_gate_memory_max(gate_config('compare')), '15G')
        self.assertEqual(monitor.bounded_gate_memory_max(gate_config('replace')), '10G')
        self.assertEqual(sorted(monitor.BOUNDED_GATE_MEMORY_MAX_VALUES), ['10G', '15G'])

    def test_an_unknown_remote_mode_selects_no_cap(self):
        config = gate_config('local')
        config['remoteChecks'] = dict(path='/manifest.json', sha256='0' * 64, mode='skip')
        for select in (monitor.gate_mode, monitor.gate_memory_max_bytes, monitor.launch_minimum_bytes, monitor.bounded_gate_memory_max):
            with self.subTest(select=select.__name__), self.assertRaisesRegex(RuntimeError, 'Unknown remoteChecks mode'):
                select(config)

    def test_unit_at_the_mode_cap_and_none_other_is_accepted(self):
        for mode in CAPS:
            with self.subTest(mode=mode):
                cap = self.mode(mode)
                self.assertEqual(self.violations(self.row(cap)), [])
                # 11 GiB: the replace cap before fix round 1's measurements.
                for other in {FULL_CAP, REPLACE_CAP, 11 * GiB, 16 * GiB} - {cap}:
                    bad = self.violations(self.row(cap, unit_props=dict(MemoryMax=str(other))))
                    self.assertEqual(bad, [dict(scope='unit', capMismatch=dict(MemoryMax=dict(expected=str(cap), actual=str(other))))])

    def test_unit_real_memory_stops_at_the_mode_cap(self):
        for mode in CAPS:
            with self.subTest(mode=mode):
                cap = self.mode(mode)
                self.assertEqual(self.violations(self.row(cap, unit_real=cap - 1)), [])
                self.assertEqual(self.violations(self.row(cap, unit_real=cap)), [dict(scope='unit', realBytes=cap)])

    def test_slice_real_memory_stop_stays_at_the_full_suite_cap_in_every_mode(self):
        # The slice holds other admitted jobs as well; a replace gate does not
        # tighten their shared stop.
        for mode in CAPS:
            with self.subTest(mode=mode):
                cap = self.mode(mode)
                self.assertEqual(self.violations(self.row(cap, slice_real=FULL_CAP - 1)), [])
                self.assertEqual(self.violations(self.row(cap, slice_real=FULL_CAP)), [dict(scope='slice', realBytes=FULL_CAP)])

    def test_bounded_real_peak_stops_at_the_mode_cap(self):
        for mode in CAPS:
            with self.subTest(mode=mode):
                cap = self.mode(mode)
                self.assertEqual(self.violations(self.row(cap, bounded_peak=cap - 1)), [])
                self.assertEqual(self.violations(self.row(cap, bounded_peak=cap)), [dict(realPeak=str(cap))])

    def prelaunch(self, available):
        shown = subprocess.CompletedProcess([], 0, 'ControlGroup=\nActiveState=active\n', '')
        guard = dict(hostAvailableBytes=available, hostLowSeconds=0, observationGapSeconds=0)
        with patch.object(monitor.subprocess, 'run', return_value=shown), \
             patch.object(monitor, 'guard_observation', return_value=guard), \
             patch.object(monitor, 'guard_violations', return_value=[]):
            return monitor.observe(self.v, None)

    def test_launch_needs_the_mode_cap_plus_the_host_floor(self):
        progress = self.e / 'resource-progress.jsonl'
        for mode, shown in (('local', 21), ('compare', 21), ('replace', 16)):
            with self.subTest(mode=mode):
                launch = self.mode(mode) + FLOOR
                progress.unlink(missing_ok=True)
                with self.assertRaisesRegex(RuntimeError, 'Host below %d GiB launch threshold' % shown):
                    self.prelaunch(launch - 1)
                self.assertFalse(progress.exists())
                self.assertEqual(self.prelaunch(launch)['guard']['hostAvailableBytes'], launch)
                rows = progress.read_text().splitlines()
                self.assertEqual([json.loads(r)['guard']['hostAvailableBytes'] for r in rows], [launch])

    def test_in_run_host_floor_stays_six_gib_for_five_seconds(self):
        def guard(available, seconds):
            return dict(guard=dict(hostAvailableBytes=available, hostLowSeconds=seconds, observationGapSeconds=0, docker=[],
                                   storage=dict(journal=dict(exitCode=1), counters=dict(stdout='same')), expectedStorageCounters='same'))
        self.assertEqual(monitor.guard_violations(guard(FLOOR, 60)), [])
        self.assertEqual(monitor.guard_violations(guard(FLOOR - 1, 4)), [])
        self.assertEqual(monitor.guard_violations(guard(FLOOR - 1, 5)), [dict(hostBelow6GiBSeconds=5)])


# The r4 sequence (mvp-20261023/admission-light-peaks-gate-r4-result.md, 2026-11-05): after a clean exit and the
# canonical receipt, the unit deactivated with its cgroup files gone, then systemd collected it; the observer
# flagged observerMissingCounters and its stop request met an unloaded unit.
INVOCATION_ID = 'fixture-20261105-152810-abcdef'
CLEAN_EXIT = dict(Result='success', ExecMainStatus='0', MainPID='0')
NOT_LOADED = 'Failed to stop ep-fresh-%s.service: Unit ep-fresh-%s.service not loaded.\n' % (INVOCATION_ID, INVOCATION_ID)


class TerminalDeactivationTest(unittest.TestCase):
    setUp, mode, row = GateMemoryCapTest.setUp, GateMemoryCapTest.mode, GateMemoryCapTest.row

    def invocation(self):
        return dict(id=INVOCATION_ID, invocationId=INVOCATION_ID, unit='ep-fresh-' + INVOCATION_ID,
                    log=str(self.e / ('bounded-' + INVOCATION_ID + '.log')), candidate=self.d['SQUASHED'])

    def receipt(self, outcome='ok', exit_code=0):
        s = self.invocation()
        path = self.e / 'bounded' / INVOCATION_ID / 'receipt.json'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(dict(id=s['id'], unit=s['unit'], log=s['log'], outcome=outcome, exitCode=exit_code)))

    def terminal_row(self, state='deactivating', counters=False, **props):
        """A unit row in STATE whose cgroup counters are gone (unless COUNTERS) after the main process ended."""
        row = self.row(15 * GiB, unit_props={**CLEAN_EXIT, **props})
        row['unit']['systemd']['ActiveState'] = state
        if not counters:
            for name in monitor.CGFILES:
                row['unit'].pop(name, None)
            row['unit']['unavailable'] = list(monitor.CGFILES)
        return row

    def violations(self, row):
        with patch.object(monitor, 'guard_violations', return_value=[]):
            return monitor.violations(self.v, self.invocation(), self.d, self.base, row)

    def test_a_deactivating_unit_after_a_clean_exit_and_an_ok_receipt_is_terminal(self):
        self.receipt()
        self.assertEqual(self.violations(self.terminal_row()), [])

    def test_a_deactivating_unit_before_its_receipt_is_written_is_still_terminal(self):
        self.assertEqual(self.violations(self.terminal_row()), [])

    def test_genuine_counter_loss_still_stops(self):
        self.receipt()
        missing = [dict(observerMissingCounters='unit')]
        cases = [('active unit', self.terminal_row('active')), ('activating unit', self.terminal_row('activating')),
                 ('main process still running', self.terminal_row(MainPID='4242')),
                 ('no main PID recorded (r4 rows)', self.terminal_row(MainPID=None)),
                 ('failed result', self.terminal_row(Result='exit-code')), ('non-zero status', self.terminal_row(ExecMainStatus='1'))]
        for name, row in cases:
            with self.subTest(name):
                if row['unit']['systemd'].get('MainPID') is None:
                    row['unit']['systemd'].pop('MainPID', None)
                self.assertEqual(self.violations(row), missing)
        row = self.row(15 * GiB)
        for name in monitor.CGFILES:
            row['slice'].pop(name, None)
        self.assertEqual(self.violations(row), [dict(observerMissingCounters='slice')])

    def test_a_failed_receipt_keeps_the_missing_counters_a_violation(self):
        for outcome, code in (('failed', 1), ('ok', 1)):
            with self.subTest(outcome=outcome, code=code):
                self.receipt(outcome, code)
                self.assertEqual(self.violations(self.terminal_row()), [dict(observerMissingCounters='unit')])

    def test_missing_counters_are_recorded_unavailable_never_zero(self):
        shown = subprocess.CompletedProcess([], 0, 'ControlGroup=/ep-heavy.slice/gone.service\nActiveState=deactivating\n'
                                                   'Result=success\nExecMainStatus=0\nMainPID=0\n', '')
        with patch.object(monitor.subprocess, 'run', return_value=shown) as run, patch.object(monitor, 'CGROUP_ROOT', self.e / 'cgroup'):
            scope = monitor.observe_scope('ep-fresh-' + INVOCATION_ID)
        self.assertIn('MainPID', run.call_args.args[0])
        self.assertEqual(scope['unavailable'], list(monitor.CGFILES))
        self.assertFalse(set(monitor.CGFILES) & set(scope))
        self.assertIsNone(monitor.real(scope))
        cgroup = self.e / 'cgroup/ep-heavy.slice/gone.service'
        cgroup.mkdir(parents=True)
        (cgroup / 'memory.current').write_text('0\n')
        with patch.object(monitor.subprocess, 'run', return_value=shown), patch.object(monitor, 'CGROUP_ROOT', self.e / 'cgroup'):
            scope = monitor.observe_scope('ep-fresh-' + INVOCATION_ID)
        self.assertEqual((scope['memory.current'], scope['unavailable']), ('0\n', [name for name in monitor.CGFILES if name != 'memory.current']))

    def systemctl(self, load_state='not-found', stop_code=1, calls=None):
        def run(argv, **kwargs):
            (calls if calls is not None else []).append(argv)
            if argv[:3] == ['systemctl', '--user', 'stop']:
                return subprocess.CompletedProcess(argv, stop_code, '', NOT_LOADED if stop_code else '')
            if argv[:3] == ['systemctl', '--user', 'show'] and argv[-3:] == ['-p', 'LoadState', '--value']:
                return subprocess.CompletedProcess(argv, 0, load_state + '\n', '')
            raise AssertionError('unexpected command in a fixture: ' + str(argv))
        return run

    def test_a_stop_request_to_an_unloaded_unit_is_not_a_failure(self):
        with patch.object(monitor.subprocess, 'run', self.systemctl()):
            self.assertEqual(monitor.stop_unit('ep-fresh-' + INVOCATION_ID)['unloaded'], True)
        with patch.object(monitor.subprocess, 'run', self.systemctl(stop_code=0)):
            self.assertEqual(monitor.stop_unit('ep-fresh-' + INVOCATION_ID)['unloaded'], False)
        with patch.object(monitor.subprocess, 'run', self.systemctl(load_state='loaded')):
            with self.assertRaisesRegex(RuntimeError, '^Guard instrumentation failed: .*not loaded'):
                monitor.stop_unit('ep-fresh-' + INVOCATION_ID)

    def loop(self, rows, receipt_at=1):
        """run_monitor_loop over fixture ROWS (the receipt appears with row RECEIPT_AT), with an integrity worker
        that passes at once and systemctl answering as it did in r4. Returns the systemctl calls."""
        self.v.update(BUNDLE=str(self.e), LABEL='fixture', WT=str(self.e))
        sequence, calls, seen = iter(rows), [], []

        def observe(v, s):
            row = {**next(sequence), 'at': '2026-11-05T15:28:%02dZ' % len(seen)}
            seen.append(row)
            if len(seen) - 1 == receipt_at:
                self.receipt()
            with (self.e / 'resource-progress.jsonl').open('a') as f:
                f.write(json.dumps(row) + '\n')
            return row

        class Worker:
            returncode, pid = 0, None
            def poll(self):
                return 0
            def communicate(self, timeout=None):
                return json.dumps(dict(passed=True, binding=monitor.integrity_binding(outer.v), phases=[])), None
        outer = self
        with patch.object(monitor, 'observe', observe), patch.object(monitor, 'guard_violations', return_value=[]), \
             patch.object(monitor, 'stop_integrity', lambda process: None), patch.object(monitor.time, 'sleep', lambda seconds: None), \
             patch.object(monitor.subprocess, 'run', self.systemctl(calls=calls)), patch('builtins.print'):
            monitor.run_monitor_loop(self.v, self.invocation(), self.d, self.base, launch_integrity=lambda v: Worker())
        return calls

    def test_the_r4_sequence_reaches_terminal_integrity_without_a_stop(self):
        active = self.row(15 * GiB, unit_props=dict(Result='success', ExecMainStatus='0', MainPID='4242'))
        unloaded = self.terminal_row('inactive', LoadState='not-found')
        calls = self.loop([active, self.terminal_row(), unloaded])
        self.assertEqual(calls, [])
        self.assertFalse((self.e / 'stop-reason.json').exists())
        self.assertFalse((self.e / 'observer-failure.json').exists())
        integrity = [json.loads(line) for line in (self.e / 'integrity-progress.jsonl').read_text().splitlines()]
        self.assertEqual((integrity[-1]['stage'], integrity[-1]['passed']), ('terminal', True))

    def test_active_counter_loss_still_stops_and_an_unloaded_stop_target_is_not_the_failure(self):
        active = self.row(15 * GiB, unit_props=dict(Result='success', ExecMainStatus='0', MainPID='4242'))
        lost = self.terminal_row('active', MainPID='4242')
        unloaded = self.terminal_row('inactive', LoadState='not-found')
        calls = self.loop([active, lost, unloaded], receipt_at=2)
        self.assertEqual([argv[:3] for argv in calls if argv[2] == 'stop'], [['systemctl', '--user', 'stop']])
        reason = json.loads((self.e / 'stop-reason.json').read_text())
        self.assertEqual(reason['violations'], [dict(observerMissingCounters='unit')])
        self.assertFalse((self.e / 'observer-failure.json').exists())


if __name__ == '__main__':
    unittest.main()
