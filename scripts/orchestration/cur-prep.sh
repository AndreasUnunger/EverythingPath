#!/usr/bin/env bash
# usage: cur-prep.sh [--full] [--remote-suite] [--branch <branch> --worktree <path>] <issue> <commit-message-file>
# Commits the curation batch in ep-cur-<n> beside the main checkout, rebases it
# onto the feature head (frozen at the start), resolves conflicts in the
# shared data files and append-only tables with `pnpm catalog:merge`
# (prep-lib.sh, prep_merge_re), writes the post-rebase
# shared-store count into the batch report's marker block (amending the
# commit; prep-lib.sh), then checks the result: the artifact check,
# `catalog:launch-inventory --check`, a byte compare of `catalog:conditions`
# with docs/catalog-import/conditions-admission.json, the format check,
# `catalog:notice-deps` and the light test plan (prep-lib.sh, prep_plan): the
# batch tests the whole reviewed diff touches, older batches' tests when their
# artifacts change, the tests it reaches through imports (test:affected), and
# the guards. Shared tooling, schema or validator
# changes, or anything uncertain, make it full: the whole of tests/catalog
# plus the batch's tests, as --full always does; in a bounded unit a light
# prep that turns full first grows its memory reservation to the full prep's
# (admission.sh escalate). Stops on the first failure.
# The whole Vitest output goes to $EP_ORCH/logs/cur-<n>-prep-<stamp>-vitest.log;
# the console gets its summary and the log's path.
# On success it writes the prep receipt $EP_ORCH/logs/cur-<n>-prep.receipt
# (commit, tree, base, lockfile, scripts, test environment, toolchain, tests
# mode, check configuration), keyed before the checks ran; if HEAD, its tree,
# the feature head or the worktree changed meanwhile, it writes none and exits 5.
# land-queue.sh reuses the receipt while all of them are unchanged; a prep
# that starts removes it.
# --remote-suite, for a landing under remote checks (the remote full suite on
# the exact tree): every step above except the Vitest run. It still plans and
# records the plan (full with --full or when the diff says so), never
# escalates its reservation (admission.sh class prep-remote), and writes
# tests=remote with testLog=- in the receipt. Only a landing under remote
# checks reuses that receipt (prep_reusable ... remote); any other landing
# preps again locally. A local receipt (tests=local) serves both.
# PREP_LOG names this run's log in the receipt (default: the bounded.sh
# unit's log when BOUNDED_ID is set). Never uses /tmp.
# Queue scratch may use --staged-parent <sha> --receipt-directory <absolute-dir>:
# require one clean issue commit on that parent, skip committing/rebasing,
# keep the integration head frozen separately, and isolate this prep's receipt.
set -euo pipefail
full=; remote=; br=; wt=; staged_parent=; receipt_directory=
while [[ ${1:-} == --* ]]; do
  case $1 in
    --full) full=1; shift ;;
    --remote-suite) remote=1; shift ;;
    --branch) br=${2:?branch}; shift 2 ;;
    --worktree) wt=${2:?worktree}; shift 2 ;;
    --staged-parent) staged_parent=${2:?parent}; shift 2 ;;
    --receipt-directory) receipt_directory=${2:?receipt directory}; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 64 ;;
  esac
done
n=${1:?issue}; msg=$(realpath "${2:?message file}")
[[ $n =~ ^[0-9]+$ && $# == 2 ]] || { echo "expected issue number and message file" >&2; exit 64; }
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
. "$here/prep-lib.sh"
. "$here/worktree-lib.sh"
[[ -z $br && -z $wt || -n $br && -n $wt ]] || { echo "supply both --branch and --worktree" >&2; exit 64; }
br=${br:-cur/$n}; wt=$(realpath -m "${wt:-$repos/ep-cur-$n}")
worktree_target "$br" "$wt" feature/pf1-character-builder || exit 1
cd "$wt"
if [[ -n $staged_parent || -n $receipt_directory ]]; then
  [[ $staged_parent =~ ^[a-f0-9]{40}$ && $receipt_directory == /* && $(git rev-parse HEAD^) == "$staged_parent" && -z $(git status --porcelain) ]] \
    || { echo "staged prep requires one clean commit on its explicit parent and a separate receipt directory" >&2; exit 1; }
  mkdir -p "$receipt_directory"
  export PREP_RECEIPT_DIRECTORY=$receipt_directory
fi
rm -f "$(prep_receipt_path "$n")"
run_tmp=
trap '[[ -n $run_tmp ]] && rm -rf "$run_tmp"' EXIT
run_tmp "cur-prep-$n"
if has_env_files .; then
  echo "env file present; refusing" >&2
  exit 1
fi
if [[ -n $(git status --porcelain) ]]; then
  git add -A
  git commit -qF "$msg"
fi
integration_base=$(git rev-parse feature/pf1-character-builder)
base=${staged_parent:-$integration_base}
git merge-base --is-ancestor "$integration_base" "$base" || { echo "item parent is not on the frozen integration base" >&2; exit 5; }
if [[ -z $staged_parent ]] && ! git rebase -q "$base" 2>/dev/null; then
  pnpm -s catalog:merge
  conflicted=$(git diff --name-only --diff-filter=U)
  data=$(printf '%s\n' "$conflicted" | grep -E "$prep_merge_re" || true)
  other=$(printf '%s\n' "$conflicted" | grep -vE "$prep_merge_re" | grep . || true)
  if [[ -n $other ]]; then
    echo "non-data conflicts, resolve by hand: $other" >&2
    exit 2
  fi
  if [[ -n $data ]]; then
    # shellcheck disable=SC2086 # one path per line, none contain spaces
    git add $data
  fi
  GIT_EDITOR=true git rebase --continue >/dev/null
fi
git merge-base --is-ancestor "$base" HEAD || { echo "$br is not on the integration base after rebase" >&2; exit 2; }
prep_write_count "$n" "$base"
# Count metadata is the last expected write. Freeze before the first check.
[[ -z $(git status --porcelain) && $(git symbolic-ref --short -q HEAD) == "$br" && $(git rev-parse feature/pf1-character-builder) == "$integration_base" ]] \
  || { echo "candidate is not clean on $br and the frozen integration base; no receipt" >&2; exit 5; }
identity=$(prep_identity "$base")
check_identity() {
  [[ $(prep_identity "$base") == "$identity" ]] && return 0
  echo "HEAD, its tree, the feature head or the worktree changed while the checks ran; no receipt" >&2
  exit 5
}
# write_receipt <test log|->: the receipt for $key, taken before the checks ran.
write_receipt() {
  local log=${PREP_LOG:-}
  [[ -z $log && -n ${BOUNDED_ID:-} ]] && log=$orch/logs/bounded-$BOUNDED_ID.log
  prep_write_receipt "$n" "$key" "identity=$identity" "log=${log:--}" "testLog=$1" "sharedStoreCount=$(prep_shared_count "$base")"
}
pnpm -s check:artifacts --base "$base"
check_identity
# The head may have changed dependencies (9c35c231 moved typecheck to
# @typescript/native), so reinstall after every rebase.
pnpm install --offline > /dev/null 2>&1 || { echo "pnpm install --offline failed" >&2; exit 4; }
check_identity
# Generated expectations a batch can leave stale, before the tests: the launch
# inventory, and the conditions admission report byte for byte.
pnpm -s catalog:launch-inventory --check
pnpm -s catalog:conditions > "$run_tmp/conditions-admission.json"
cmp -s docs/catalog-import/conditions-admission.json "$run_tmp/conditions-admission.json" \
  || { echo "pnpm -s catalog:conditions differs from docs/catalog-import/conditions-admission.json; regenerate and commit it" >&2; exit 1; }
check_identity
git log --oneline -1
# No empty-directory check: cur-land's full suite runs in a clean checkout of the commit, which catches worktree-only files (#337).
pnpm -s catalog:format --check
# Prints the notice-dependency warnings for review; fails only on hard gaps.
pnpm -s catalog:notice-deps
plan=$(prep_plan "$base" "$full")
mapfile -t tests < <(sed -n 's/^test //p' <<< "$plan")
if [[ -n $remote ]]; then
  # No tests here, so no escalation either: the remote full suite runs them on
  # the exact tree, and the receipt says tests=remote.
  echo "prep: remote suite, $(sed -n 's/^mode //p' <<< "$plan") plan recorded; the tests run on the exact tree remotely"
  printf '%s\n' "$plan"
  key=$(prep_key "$base" "$plan" remote && prep_key_extra remote)
  check_identity
  write_receipt -
  exit
fi
if [[ $(sed -n 's/^mode //p' <<< "$plan") == full ]]; then
  echo "prep: full ($(sed -n 's/^reason //p' <<< "$plan" | paste -sd ';' | sed 's/;/; /g'))"
  tests=(tests/catalog "${tests[@]}")
  # In a bounded unit, a light prep's memory reservation grows to the full
  # prep's before the tests, and its run is recorded as full (#759).
  if [[ -n ${BOUNDED_RESERVATION:-} ]]; then
    bash "${BOUNDED_ADMISSION_LIB:-$here/admission.sh}" escalate "$BOUNDED_RESERVATION" || exit
  fi
else
  echo "prep: light, ${#tests[@]} test files"
fi
printf '%s\n' "$plan"
key=$(prep_key "$base" "$plan" && prep_key_extra local)
# The whole Vitest output, unfiltered, goes to its own log first; the console
# gets the summary lines.
test_log=${receipt_directory:-$orch/logs}/cur-$n-prep-$(date +%Y%m%d-%H%M%S)-vitest.log
set +e
pnpm test "${tests[@]}" > "$test_log" 2>&1
status=$?
set -e
grep -E 'Test Files|Tests  |FAIL' "$test_log" | sed 's/\x1b\[[0-9;]*m//g' || true
echo "full test output: $test_log"
(( status == 0 )) || { echo "tests failed ($status); see $test_log" >&2; exit "$status"; }
check_identity
write_receipt "$test_log"
