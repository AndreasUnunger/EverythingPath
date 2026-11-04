#!/usr/bin/env bash
# usage: gate-monitor.test.sh — the gate monitor's memory cap, launch threshold
# and host floor (gate-monitor.test.py). Fixture rows only: no live gate.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
run_tmp gate-monitor-test
trap 'rm -rf "$run_tmp"' EXIT
python3 -B "$here/gate-monitor.test.py"
