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
# Option 1 (owner, 2026-10-30): the gate unit's MemoryMax, and the launch
# guard as that cap plus the unchanged 6 GiB in-run host floor.
CAP = 15 * GiB
FLOOR = 6 * GiB
LAUNCH = CAP + FLOOR


def scope(real=0, **systemd):
    return {'systemctlExit': 0, 'systemd': dict(ActiveState='active', **systemd),
            'memory.events': 'max 0\noom 0\noom_kill 0\noom_group_kill 0\n',
            'memory.current': str(real), 'memory.stat': 'file 0\nshmem 0\n'}


class GateMemoryCapTest(unittest.TestCase):
    def setUp(self):
        scratch = tempfile.TemporaryDirectory(dir=os.environ['TMPDIR'])
        self.addCleanup(scratch.cleanup)
        self.e = Path(scratch.name)
        (self.e / 'protected-refs.json').write_text('{}')
        self.v = dict(E=str(self.e), ORCH=str(self.e), BASE='b' * 40, TREE='t' * 40, REVIEWED='r' * 40,
                      ARCHIVE='refs/archive', BR='branch', FEATURE='feature')
        self.d = dict(SQUASHED='s' * 40)
        self.base = dict(slice=scope())

    def row(self, unit_real=0, bounded_peak=0, unit_props=None):
        unit = dict(MemoryMax=str(CAP), MemoryHigh='infinity', MemorySwapMax='0', CPUQuotaPerSecUSec='6s', TasksMax='1024',
                    CPUWeight='20', Nice='10', Restart='no', LimitCORE='0', TimeoutStopUSec='5min')
        unit.update(unit_props or {})
        sliced = dict(MemoryMax=str(20 * GiB), MemoryHigh=str(18 * GiB), MemorySwapMax='0', CPUQuotaPerSecUSec='8s', TasksMax='2048')
        return dict(unit=scope(unit_real, **unit), slice=scope(**sliced), boundedSample='real_peak=%d\n' % bounded_peak,
                    integrationStatus='', candidateStatus='', candidateHead=self.d['SQUASHED'], integrationHead=self.v['BASE'],
                    candidateTree=self.v['TREE'], archiveSHA=self.v['REVIEWED'], refs={}, guard={})

    def violations(self, row):
        with patch.object(monitor, 'guard_violations', return_value=[]):
            return monitor.violations(self.v, None, self.d, self.base, row)

    def test_one_named_cap_derives_the_launch_threshold_from_the_unchanged_floor(self):
        self.assertEqual(monitor.GATE_MEMORY_MAX_BYTES, CAP)
        self.assertEqual(monitor.HOST_FLOOR_BYTES, FLOOR)
        self.assertEqual(monitor.LAUNCH_MINIMUM_BYTES, LAUNCH)

    def test_unit_at_the_cap_and_none_other_is_accepted(self):
        self.assertEqual(self.violations(self.row()), [])
        bad = self.violations(self.row(unit_props=dict(MemoryMax=str(16 * GiB))))
        self.assertEqual(bad, [dict(scope='unit', capMismatch=dict(MemoryMax=dict(expected=str(CAP), actual=str(16 * GiB))))])

    def test_unit_real_memory_stops_at_the_cap(self):
        self.assertEqual(self.violations(self.row(unit_real=CAP - 1)), [])
        self.assertEqual(self.violations(self.row(unit_real=CAP)), [dict(scope='unit', realBytes=CAP)])

    def test_bounded_real_peak_stops_at_the_cap(self):
        self.assertEqual(self.violations(self.row(bounded_peak=CAP - 1)), [])
        self.assertEqual(self.violations(self.row(bounded_peak=CAP)), [dict(realPeak=str(CAP))])

    def prelaunch(self, available):
        shown = subprocess.CompletedProcess([], 0, 'ControlGroup=\nActiveState=active\n', '')
        guard = dict(hostAvailableBytes=available, hostLowSeconds=0, observationGapSeconds=0)
        with patch.object(monitor.subprocess, 'run', return_value=shown), \
             patch.object(monitor, 'guard_observation', return_value=guard), \
             patch.object(monitor, 'guard_violations', return_value=[]):
            return monitor.observe(self.v, None)

    def test_launch_needs_the_cap_plus_the_host_floor(self):
        with self.assertRaisesRegex(RuntimeError, 'Host below 21 GiB launch threshold'):
            self.prelaunch(LAUNCH - 1)
        self.assertFalse((self.e / 'resource-progress.jsonl').exists())
        self.assertEqual(self.prelaunch(LAUNCH)['guard']['hostAvailableBytes'], LAUNCH)
        rows = (self.e / 'resource-progress.jsonl').read_text().splitlines()
        self.assertEqual([json.loads(r)['guard']['hostAvailableBytes'] for r in rows], [LAUNCH])

    def test_in_run_host_floor_stays_six_gib_for_five_seconds(self):
        def guard(available, seconds):
            return dict(guard=dict(hostAvailableBytes=available, hostLowSeconds=seconds, observationGapSeconds=0, docker=[],
                                   storage=dict(journal=dict(exitCode=1), counters=dict(stdout='same')), expectedStorageCounters='same'))
        self.assertEqual(monitor.guard_violations(guard(FLOOR, 60)), [])
        self.assertEqual(monitor.guard_violations(guard(FLOOR - 1, 4)), [])
        self.assertEqual(monitor.guard_violations(guard(FLOOR - 1, 5)), [dict(hostBelow6GiBSeconds=5)])


if __name__ == '__main__':
    unittest.main()
