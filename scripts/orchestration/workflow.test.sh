#!/usr/bin/env bash
# Fixture contracts only: no live gate, Cloud operation or resource qualification.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
run_tmp workflow-test
trap 'rm -rf "$run_tmp"' EXIT
python3 -B "$here/gate-operator.test.py"
python3 -B "$here/gate-runtime.test.py"
python3 -B "$here/gate-run.test.py"
bash "$here/driver-argv.test.sh"
python3 -B "$here/remote-checks.test.py"
python3 -B "$here/remote-ci.test.py"
bash "$here/remote-fetch.test.sh"
bash "$here/gate-push.test.sh"
bash "$here/host-audits.test.sh"
python3 -B "$here/light-lane.test.py"
python3 -B "$here/gate-monitor.test.py"
bash "$here/lane-lock.test.sh"
bash "$here/pipefail.test.sh"
bash "$here/env-guard.test.sh"
python3 -B "$here/agent-launch-guard.test.py"
