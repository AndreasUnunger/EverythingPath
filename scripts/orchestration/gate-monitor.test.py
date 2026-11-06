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


if __name__ == '__main__':
    unittest.main()
