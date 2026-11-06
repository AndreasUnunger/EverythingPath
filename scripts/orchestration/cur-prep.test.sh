#!/usr/bin/env bash
# usage: cur-prep.test.sh — checks cur-prep.sh with dummy commands: the light
# test plan (the whole diff's batch tests, older batches' tests, the guards,
# the tests test:affected reaches), the launch inventory and conditions report
# checks, automatic and explicit --full, the shared-store count it writes into
# the report, and its receipt; --remote-suite (every check but Vitest, a
# tests=remote receipt) and which receipts prep_reusable lets stand in, with
# and without remote checks. A throwaway repository under $repos/.ep-tmp; a pnpm
# stub that only logs.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
. "$here/prep-test-lib.sh"
root=$(mktemp -d "${TMPDIR:?}/cur-prep-test-XXXXXX") || exit 1
trap 'rm -rf "$root"' EXIT
fail=0
check() { if [[ $2 == "$3" ]]; then echo "ok    $1"; else echo "FAIL  $1: want '$3', got '$2'"; fail=1; fi; }
case_no=0
# fresh: a new fixture in its own directory; sets d and wt.
fresh() {
  d=$root/case$(( ++case_no )); mkdir -p "$d"
  (prep_fixture "$d") > /dev/null 2>&1 || { echo "FAIL  fixture"; exit 1; }
  wt=$d/ep-cur-901
}
# prep [args...]: runs cur-prep.sh for #901 in the current fixture; output in $d/out.
prep() {
  (
    export PNPM_LOG=$d/pnpm.log MAIN=$d/main EP_ORCH=$d/orch PATH=$d/bin:$PATH CI=true VITEST_MAX_WORKERS=1
    export GIT_AUTHOR_NAME=Test GIT_AUTHOR_EMAIL=test@example.test GIT_COMMITTER_NAME=Test GIT_COMMITTER_EMAIL=test@example.test
    bash "$here/cur-prep.sh" "$@" 901 "$d/orch/briefs/cur-901-msg.txt"
  ) > "$d/out" 2>&1
}
tests_run() { PNPM_LOG=$d/pnpm.log prep_tests_run | tr '\n' ' '; }
feature() { git -C "$d/main" rev-parse feature/pf1-character-builder; }
receipt() { sed -n "s/^$1=//p" "$d/orch/logs/cur-901-prep.receipt"; }

# --- Light prep ---
fresh
prep; status=$?
check "light prep passes" "$status" 0
check "light prep runs the whole diff's batch tests, the older batch's tests and the guards, not tests/catalog" "$(tests_run)" \
  "tests/catalog/batch-ownership-sweep.test.ts tests/catalog/batch-ownership.test.ts tests/catalog/cross-batch-bindings.test.ts tests/catalog/notice-holds.test.ts tests/catalog/pinned-sources.test.ts tests/catalog/review-receipts.test.ts tests/catalog/traits-370.test.ts tests/catalog/traits-901.test.ts tests/catalog/traits370.integration.test.ts tests/catalog/traits901.integration.test.ts "
check "it still runs the format check and notice-deps" "$(grep -c -e '^-s catalog:format --check$' -e '^-s catalog:notice-deps$' "$d/pnpm.log")" 2
check "the batch is one commit on the feature head" "$(git -C "$wt" rev-list --count "$(feature)..HEAD") $(git -C "$wt" rev-parse HEAD^)" "1 $(feature)"
check "prep writes the post-rebase shared-store count into the report" \
  "$(git -C "$wt" show HEAD:docs/catalog-import/traits-901.md | sed -n '/^<!-- prep:shared-store-count -->$/,/^<!-- \/prep/p')" \
  "<!-- prep:shared-store-count -->
New shared-store files (\`tests/fixtures/pinned/\`), counted by prep after the rebase onto \`$(feature | cut -c1-8)\`: **2** (pf1-content 2).
<!-- /prep:shared-store-count -->"
check "the rest of the report is untouched" "$(git -C "$wt" show HEAD:docs/catalog-import/traits-901.md | grep -c -e '^## Preservation and gates$' -e '^The end.$')" 2
check "the worktree is clean" "$(git -C "$wt" status --porcelain)" ""
check "the receipt binds the commit, its tree, the base and the mode" "$(receipt result) $(receipt commit) $(receipt tree) $(receipt base) $(receipt mode)" \
  "ok $(git -C "$wt" rev-parse HEAD) $(git -C "$wt" rev-parse 'HEAD^{tree}') $(feature) light"
check "the receipt records the test environment" "$(receipt env)" "CI=true VITEST_MAX_WORKERS=1 VITEST_MIN_WORKERS=- VITEST_POOL=- TZ=-"
check "the receipt records the lockfile, the scripts and the check configuration" \
  "$(receipt lockfile | grep -cE '^[0-9a-f]{40} [0-9a-f]{40}$') $(receipt scripts | grep -cE '^[0-9a-f]{64}$') $(receipt config | grep -cE '^[0-9a-f]{64}$')" "1 1 1"
check "a local prep's receipt says its tests ran here, and records the toolchain" "$(receipt tests) $(receipt toolchain)" "local node $(node --version) pnpm 10.0.0-stub"
head=$(git -C "$wt" rev-parse HEAD)
prep; status=$?
check "a second prep finds the count current and leaves the commit alone" "$status $(git -C "$wt" rev-parse HEAD) $(grep -c 'the count in docs/catalog-import/traits-901.md is current' "$d/out")" "0 $head 1"

# --- Artifact rejection stops expensive preparation and leaves no receipt ---
: > "$d/pnpm.log"
PNPM_FAIL_ARTIFACT=1 prep; status=$?
check "artifact rejection stops before install, formatting or tests" \
  "$(( status != 0 )) $(grep -c -E '^(install |test |.*catalog:format)' "$d/pnpm.log") $([[ -e $d/orch/logs/cur-901-prep.receipt ]] && echo receipt || echo none)" "1 0 none"
check "artifact check pins the frozen integration base" "$(grep -c "^-s check:artifacts --base $(feature)$" "$d/pnpm.log")" 1
prep; check "a passing guard allows preparation and a new receipt" "$? $(receipt result)" "0 ok"

# --- Failure leaves no receipt ---
PNPM_FAIL_TEST=1 prep; status=$?
check "a failing test fails prep and removes the receipt" "$(( status != 0 )) $([[ -e $d/orch/logs/cur-901-prep.receipt ]] && echo receipt || echo none)" "1 none"
check "the failure summary is shown with the log's path" "$(grep -c 'FAIL  tests/catalog/traits-901.test.ts' "$d/out") $(grep -c '^full test output: .*/orch/logs/cur-901-prep-[0-9-]*-vitest.log$' "$d/out")" "1 1"
raw=$(sed -n 's/^full test output: //p' "$d/out")
check "the full output keeps the startup error, the assertion diff and the stack" \
  "$(grep -c -e '^Error: Cannot find module ./missing-helper (startup)$' -e '^AssertionError: expected 2 to be 1$' -e '^- Expected$' -e '^+ Received$' -e '^- 1$' -e '^+ 2$' -e '❯ tests/catalog/traits-901.test.ts:12:5$' "$raw")" 7

# --- An edit while any check runs gets no receipt ---
amend="echo late >> '$wt/docs/catalog-import/traits-901.md'; git -C '$wt' commit -qa --amend --no-edit"
for step in check:artifacts install; do
  : > "$d/pnpm.log"
  PNPM_HOOK_ON=$step PNPM_HOOK=$amend prep; status=$?
  check "a commit amended during $step stops before later checks with no receipt" \
    "$status $([[ -e $d/orch/logs/cur-901-prep.receipt ]] && echo receipt || echo none) $(grep -c 'changed while the checks ran; no receipt' "$d/out") $(grep -c -E '^(test |.*catalog:format)' "$d/pnpm.log")" "5 none 1 0"
  if [[ $step == check:artifacts ]]; then
    check "movement during the guard prevents install" "$(grep -c '^install ' "$d/pnpm.log")" 0
  fi
done
for step in catalog:format catalog:notice-deps plan test; do
  if [[ $step == plan ]]; then GIT_HOOK=$amend prep; status=$?
  else PNPM_HOOK_ON=$step PNPM_HOOK=$amend prep; status=$?
  fi
  check "a commit amended during $step gets no receipt" \
    "$status $([[ -e $d/orch/logs/cur-901-prep.receipt ]] && echo receipt || echo none) $(grep -c 'changed while the checks ran; no receipt' "$d/out")" "5 none 1"
done
prep; check "the amended commit gets its own prep" "$? $(receipt commit)" "0 $(git -C "$wt" rev-parse HEAD)"

# --- A light prep in a bounded unit keeps its light reservation ---
fresh
printf '#!/usr/bin/env bash\necho "$*" >> "%s/admission.log"\n' "$d" > "$d/admission-stub.sh"
BOUNDED_RESERVATION=prep901-y BOUNDED_ADMISSION_LIB=$d/admission-stub.sh prep; status=$?
check "a light prep doesn't escalate" "$status $(cat "$d/admission.log" 2> /dev/null)" "0 "

# --- --full keeps the old behaviour ---
prep --full; status=$?
check "--full runs tests/catalog and the batch's tests" "$status $(tests_run | cut -d' ' -f1) $(tests_run | grep -c 'traits-901.test.ts')" "0 tests/catalog 1"
check "--full is recorded in the receipt" "$(receipt mode)" full

# --- Automatic --full ---
fresh
echo "#901 tooling fix" >> "$wt/scripts/catalog/import.ts"
prep; status=$?
check "a shared tooling change makes prep full" "$status $(tests_run | cut -d' ' -f1) $(grep -c '^reason scripts/catalog/import.ts$' "$d/out")" "0 tests/catalog 1"
# In a bounded unit (BOUNDED_RESERVATION) a prep that turns full grows its
# light memory reservation to full before its tests (admission.sh escalate).
printf '#!/usr/bin/env bash\necho "$*" >> "%s/admission.log"\nexit "${ADMISSION_STUB_STATUS:-0}"\n' "$d" > "$d/admission-stub.sh"
reserved() { BOUNDED_RESERVATION=prep901-x BOUNDED_ADMISSION_LIB=$d/admission-stub.sh prep "$@"; }
reserved; status=$?
check "a prep that turns full asks for the full reservation before its tests" "$status $(cat "$d/admission.log")" "0 escalate prep901-x"
rm -f "$d/admission.log"
runs=$(grep -c '^test ' "$d/pnpm.log")
ADMISSION_STUB_STATUS=143 reserved; status=$?
check "and stops, before its tests, when it can't get it" "$status $(grep -c '^test ' "$d/pnpm.log")" "143 $runs"
fresh
echo "edited" >> "$wt/tests/fixtures/pinned/pf1/packs/existing.yaml"
prep
check "an edited shared-store file makes prep full" "$(tests_run | cut -d' ' -f1) $(grep -c '^reason shared-store file tests/fixtures/pinned/pf1/packs/existing.yaml changed (M)$' "$d/out")" "tests/catalog 1"
fresh
mkdir -p "$wt/tests/fixtures/cross-batch-999"; echo x > "$wt/tests/fixtures/cross-batch-999/x.json"
prep
check "a fixture of no batch inventory is uncertain: full" "$(tests_run | cut -d' ' -f1)" tests/catalog
fresh
git -C "$d/main" rm -q tests/catalog/batch-ownership-sweep.test.ts && git -C "$d/main" commit -qm "drop a guard"
prep
check "a missing guard makes prep full" "$(tests_run | cut -d' ' -f1) $(grep -c '^reason guard tests/catalog/batch-ownership-sweep.test.ts missing$' "$d/out")" "tests/catalog 1"

# --- Shared validators in test files escalate ---
fresh
echo "// a new schema rule" >> "$wt/tests/catalog/notice-holds.test.ts"
prep
check "a changed guard (notice-holds) makes prep full" "$(tests_run | cut -d' ' -f1) $(grep -c '^reason shared validator tests/catalog/notice-holds.test.ts changed$' "$d/out")" "tests/catalog 1"
fresh
echo "// receipts" >> "$wt/tests/catalog/review-receipts.test.ts"
prep
check "a changed receipt validator makes prep full" "$(tests_run | cut -d' ' -f1)" tests/catalog
fresh
echo "export const helper = 1;" > "$wt/tests/catalog/shared-helper.test.ts"
prep
check "a test file that exports helpers makes prep full" "$(tests_run | cut -d' ' -f1) $(grep -c '^reason shared validator tests/catalog/shared-helper.test.ts changed$' "$d/out")" "tests/catalog 1"

# --- Other tests in the diff ---
fresh
mkdir -p "$wt/convex"; echo x > "$wt/convex/catalogTraits901.integration.test.ts"
prep
check "a changed test outside tests/catalog is run, light" \
  "$(tests_run | tr ' ' '\n' | grep -c '^convex/catalogTraits901.integration.test.ts$') $(grep -c '^mode light$' "$d/out")" "1 1"

# --- Tests the change reaches (test:affected) ---
fresh
PNPM_AFFECTED=$'tests/catalog/curation.test.ts\nsrc/lib/reached.test.ts' prep
check "light prep adds the tests test:affected reaches from the base" \
  "$(tests_run | tr ' ' '\n' | grep -c -e '^tests/catalog/curation.test.ts$' -e '^src/lib/reached.test.ts$') $(grep -c '^mode light$' "$d/out") $(grep -c "^-s test:affected --base $(feature)$" "$d/pnpm.log")" "2 1 1"
fresh
PNPM_AFFECTED_STATUS=3 prep
check "a test:affected failure (or exit 3, every test) makes prep full" \
  "$(tests_run | cut -d' ' -f1) $(grep -c '^reason test:affected exited 3$' "$d/out")" "tests/catalog 1"
fresh
git -C "$d/main" rm -q scripts/affected-tests.ts
git -C "$d/main" -c user.name=Test -c user.email=test@example.test commit -qm "no affected-tests"
prep
check "a head without scripts/affected-tests.ts plans without it" \
  "$(grep -c 'test:affected' "$d/pnpm.log") $(grep -c '^mode light$' "$d/out")" "0 1"

# --- Generated expectations ---
fresh
PNPM_FAIL_INVENTORY=1 prep; status=$?
check "a failed launch inventory check stops prep before its tests" \
  "$(( status != 0 )) $(grep -c '^test ' "$d/pnpm.log") $(grep -c '^-s catalog:launch-inventory --check$' "$d/pnpm.log")" "1 0 1"
fresh
PNPM_CONDITIONS_DRIFT=1 prep; status=$?
check "catalog:conditions output unlike the committed report stops prep before its tests" \
  "$(( status != 0 )) $(grep -c '^test ' "$d/pnpm.log") $(grep -c 'docs/catalog-import/conditions-admission.json' "$d/out")" "1 0 1"
fresh
prep
check "matching generated expectations pass" "$(grep -c -e '^-s catalog:launch-inventory --check$' -e '^-s catalog:conditions$' "$d/pnpm.log") $(grep -c '^test ' "$d/pnpm.log")" "2 1"

# --- A report without the marker ---
fresh
sed -i '/prep:shared-store-count/d' "$wt/docs/catalog-import/traits-901.md"
prep; status=$?
check "a report without the marker gets a printed count and a warning, not a failure" \
  "$status $(grep -c '^shared-store files added against [0-9a-f]\{12\}: 2 (pf1-content 2)$' "$d/out") $(grep -c 'no <!-- prep:shared-store-count --> marker block' "$d/out")" "0 1 1"
# marked <name> <report body>: a fresh batch whose report has these markers;
# prep must warn and leave the report as the curator wrote it.
marked() {
  fresh
  printf '%s' "$2" > "$wt/docs/catalog-import/traits-901.md"
  prep; status=$?
  check "$1: a warning, a printed count, no edit" \
    "$status $(grep -c "warning: docs/catalog-import/traits-901.md: $3" "$d/out") $(grep -c '^shared-store files added against' "$d/out") $(git -C "$wt" show HEAD:docs/catalog-import/traits-901.md | sha256sum | cut -c1-12)" \
    "0 1 1 $(printf '%s' "$2" | sha256sum | cut -c1-12)"
}
marked "reversed markers" $'# R\n\n<!-- /prep:shared-store-count -->\nkept\n<!-- prep:shared-store-count -->\nkept too\n' "the count markers are reversed"
marked "duplicate markers" $'# R\n<!-- prep:shared-store-count -->\nx\n<!-- /prep:shared-store-count -->\nkept\n<!-- prep:shared-store-count -->\ny\n<!-- /prep:shared-store-count -->\n' "more than one count marker pair"
# --- Conflicts in the append-only tables go to catalog:merge ---
fresh
table=tests/catalog/cross-batch-bindings.ts
printf 'feature row\n' > "$d/main/$table"
git -C "$d/main" add -A && git -C "$d/main" commit -qm "another batch appends a row"
printf 'batch row\n' > "$wt/$table"
PNPM_MERGE="printf 'feature row\\nbatch row\\n' > $table" prep; status=$?
check "a conflict in an append-only table is merged by catalog:merge and the rebase goes on" \
  "$status $(git -C "$wt" show "HEAD:$table" | paste -sd ' ') $(git -C "$wt" rev-parse HEAD^)" "0 feature row batch row $(feature)"
fresh
printf 'feature row\n' > "$d/main/$table"
git -C "$d/main" add -A && git -C "$d/main" commit -qm "another batch appends a row"
printf 'batch row\n' > "$wt/$table"
PNPM_MERGE="echo '$table:' >&2; exit 1" prep; status=$?
check "a table conflict catalog:merge leaves unresolved stops prep, naming the file" \
  "$(( status != 0 )) $(grep -c "^$table:$" "$d/out") $([[ -e $d/orch/logs/cur-901-prep.receipt ]] && echo receipt || echo none)" "1 1 none"

# --- Remote-suite prep: every local check but Vitest ---
# The remote full suite runs on the exact tree (remote_checks.py), so
# --remote-suite records the plan without running it; tests=remote in the
# receipt keeps it from standing in for a local prep.
fresh
amend="echo late >> '$wt/docs/catalog-import/traits-901.md'; git -C '$wt' commit -qa --amend --no-edit"
prep --remote-suite; status=$?
check "a remote-suite prep passes without calling pnpm test" "$status $(grep -c '^test' "$d/pnpm.log")" "0 0"
check "it still runs the artifact check, the generated-expectation checks, format and notice-deps" \
  "$(grep -c -e "^-s check:artifacts --base $(feature)$" -e '^-s catalog:launch-inventory --check$' -e '^-s catalog:conditions$' -e '^-s catalog:format --check$' -e '^-s catalog:notice-deps$' -e '^install --offline$' "$d/pnpm.log")" 6
check "it plans, says the plan isn't run here, and records it" \
  "$(grep -c "^-s test:affected --base $(feature)$" "$d/pnpm.log") $(grep -c '^prep: remote suite, light plan recorded; the tests run on the exact tree remotely$' "$d/out") $(grep -c '^test tests/catalog/traits-901.test.ts$' "$d/out") $(grep -c '^prep: \(full\|light\)' "$d/out")" "1 1 1 0"
check "its receipt says tests=remote, with no test log, and binds the commit, tree and base" \
  "$(receipt result) $(receipt tests) $(receipt testLog) $(receipt mode) $(receipt commit) $(receipt tree) $(receipt base)" \
  "ok remote - light $(git -C "$wt" rev-parse HEAD) $(git -C "$wt" rev-parse 'HEAD^{tree}') $(feature)"
check "it records the toolchain" "$(receipt toolchain)" "node $(node --version) pnpm 10.0.0-stub"
check "it writes the post-rebase count as a local prep does" "$(receipt sharedStoreCount) $(git -C "$wt" rev-parse HEAD^)" "2 (pf1-content 2) $(feature)"
remote_config=$(receipt config)
prep; check "a local prep of the same commit is configured differently" "$? $(receipt tests) $([[ $(receipt config) != "$remote_config" ]] && echo differs)" "0 local differs"
for failure in launch-inventory conditions format notice-deps artifacts; do
  : > "$d/pnpm.log"
  case $failure in
    launch-inventory) PNPM_FAIL_INVENTORY=1 prep --remote-suite; status=$? ;;
    conditions) PNPM_CONDITIONS_DRIFT=1 prep --remote-suite; status=$? ;;
    format) PNPM_FAIL_ON=catalog:format prep --remote-suite; status=$? ;;
    notice-deps) PNPM_FAIL_ON=catalog:notice-deps prep --remote-suite; status=$? ;;
    artifacts) PNPM_FAIL_ARTIFACT=1 prep --remote-suite; status=$? ;;
  esac
  check "a remote-suite prep whose $failure check fails stops with no receipt" \
    "$(( status != 0 )) $([[ -e $d/orch/logs/cur-901-prep.receipt ]] && echo receipt || echo none) $(grep -c '^test' "$d/pnpm.log")" "1 none 0"
done
for step in check:artifacts install catalog:format catalog:notice-deps plan; do
  if [[ $step == plan ]]; then GIT_HOOK=$amend prep --remote-suite; status=$?
  else PNPM_HOOK_ON=$step PNPM_HOOK=$amend prep --remote-suite; status=$?
  fi
  check "a remote-suite prep whose commit is amended during $step exits 5 with no receipt" \
    "$status $([[ -e $d/orch/logs/cur-901-prep.receipt ]] && echo receipt || echo none) $(grep -c 'changed while the checks ran; no receipt' "$d/out")" "5 none 1"
done
# --full with --remote-suite: the plan is recorded as full, and in a bounded
# unit the reservation never escalates, since no tests run.
fresh
echo "#901 tooling fix" >> "$wt/scripts/catalog/import.ts"
printf '#!/usr/bin/env bash\necho "$*" >> "%s/admission.log"\n' "$d" > "$d/admission-stub.sh"
BOUNDED_RESERVATION=prep901-r BOUNDED_ADMISSION_LIB=$d/admission-stub.sh prep --remote-suite; status=$?
check "a remote-suite prep whose plan turns full records it full, runs no tests and never escalates" \
  "$status $(receipt mode) $(receipt tests) $(grep -c '^test' "$d/pnpm.log") $(cat "$d/admission.log" 2> /dev/null | wc -l) $(grep -c '^prep: remote suite, full plan recorded' "$d/out") $(grep -c '^reason scripts/catalog/import.ts$' "$d/out")" \
  "0 full remote 0 0 1 1"
BOUNDED_RESERVATION=prep901-r BOUNDED_ADMISSION_LIB=$d/admission-stub.sh prep --remote-suite --full; status=$?
check "--remote-suite --full is allowed: full plan recorded, no tests, no escalation" \
  "$status $(receipt mode) $(receipt tests) $(grep -c '^test' "$d/pnpm.log") $(cat "$d/admission.log" 2> /dev/null | wc -l)" "0 full remote 0 0"

# --- prep_reusable: a remote receipt stands in only for a remote-checks landing ---
# reusable [remote] [scripts dir]: prep_reusable for #901 in $wt on the feature head; output in $d/reuse.out.
reusable() {
  (
    export PNPM_LOG=$d/pnpm.log MAIN=$d/main EP_ORCH=$d/orch PATH=$d/bin:$PATH CI=true VITEST_MAX_WORKERS=${REUSE_WORKERS:-1}
    cd "$wt" && here=${2:-$here} && . "$here/paths.sh" && . "$here/prep-lib.sh" && prep_reusable 901 "$wt" "${REUSE_BASE:-$(feature)}" ${1:+"$1"}
  ) > "$d/reuse.out" 2>&1
}
said() { grep -c -- "$1" "$d/reuse.out"; }
fresh
prep --remote-suite
cp "$d/orch/logs/cur-901-prep.receipt" "$d/remote.receipt"
restore() { cp "$d/remote.receipt" "$d/orch/logs/cur-901-prep.receipt"; }
reusable; check "without remote checks a remote receipt is refused, saying why" "$? $(said 'tests=remote: the tests ran remotely; it stands in only under remote checks')" "1 1"
reusable remote; check "under remote checks the remote receipt is reusable" "$? $(said '^receipt .*: light prep (remote suite) of ')" "0 1"
reusable bogus; check "an unknown reuse mode is refused" "$? $(said "unknown prep reuse mode 'bogus'")" "1 1"
PNPM_VERSION=10.1.0 reusable remote; check "another toolchain refuses it" "$? $(said 'toolchain changed since the prep')" "1 1"
REUSE_WORKERS=3 reusable remote; check "another test environment refuses it" "$? $(said 'env changed since the prep')" "1 1"
REUSE_BASE=$(git -C "$d/main" rev-parse HEAD^) reusable remote; check "another base refuses it" "$? $(said 'base changed since the prep')" "1 1"
mkdir -p "$d/scripts"; cp -p "$here"/*.sh "$d/scripts/"; echo "# a comment" >> "$d/scripts/prep-lib.sh"
reusable remote "$d/scripts"; check "changed prep scripts refuse it" "$? $(said 'scripts changed since the prep')" "1 1"
for field in tree lockfile; do
  sed -i "s/^$field=.*/$field=0000/" "$d/orch/logs/cur-901-prep.receipt"
  reusable remote; check "a receipt whose $field differs is refused" "$? $(said "$field changed since the prep")" "1 1"
  restore
done
for bad in duplicate bogus missing toolchain; do
  case $bad in
    duplicate) echo tests=remote >> "$d/orch/logs/cur-901-prep.receipt" ;;
    bogus) sed -i 's/^tests=.*/tests=skipped/' "$d/orch/logs/cur-901-prep.receipt" ;;
    missing) sed -i '/^tests=/d' "$d/orch/logs/cur-901-prep.receipt" ;;
    toolchain) echo "toolchain=node v0 pnpm 0" >> "$d/orch/logs/cur-901-prep.receipt" ;;
  esac
  reusable remote; check "a receipt with a $bad tests or toolchain field is malformed" "$? $(said 'malformed prep receipt')" "1 1"
  restore
done
reusable remote; check "the restored receipt is reusable again" "$?" 0
echo "fixed" >> "$wt/docs/catalog-import/traits-901.md"; git -C "$wt" commit -qa --amend --no-edit
reusable remote; check "an amended commit refuses it" "$? $(said 'commit changed since the prep')" "1 1"
prep; reusable remote; check "a local receipt stands in under remote checks too" "$? $(said '^receipt .*: light prep (local) of ')" "0 1"
reusable; check "and, as before, without them" "$?" 0
# Explicit targets validate before touching an existing receipt or any files.
fresh
prep; check "default numbered prep still succeeds" "$?" 0
saved=$(sha256sum "$d/orch/logs/cur-901-prep.receipt" | cut -c1-64)
prep --branch t3/wrong --worktree "$wt"; status=$?
check "wrong branch fails before receipt invalidation" "$((status != 0)) $(sha256sum "$d/orch/logs/cur-901-prep.receipt" | cut -c1-64)" "1 $saved"
prep --branch cur/901 --worktree "$d/main"; status=$?
check "main checkout fails before receipt invalidation" "$((status != 0)) $(sha256sum "$d/orch/logs/cur-901-prep.receipt" | cut -c1-64)" "1 $saved"
prep --worktree "$wt"; status=$?
check "partial explicit target fails closed" "$((status != 0))" 1
appwt=$d/app-owned
git -C "$d/main" worktree move "$wt" "$appwt"
git -C "$appwt" branch -m t3/curation901
prep --branch t3/curation901 --worktree "$appwt"; status=$?
check "standalone app prep retains count and receipt identity" "$status $(receipt branch) $(receipt worktree) $(receipt sharedStoreCount)" "0 t3/curation901 $appwt 2 (pf1-content 2)"
# Same repository and matching branch, but no integration history.
git -C "$d/main" worktree add -q --detach "$d/orphan" HEAD
git -C "$d/orphan" checkout -q --orphan t3/orphan
git -C "$d/orphan" rm -qrf .
printf orphan > "$d/orphan/orphan"; git -C "$d/orphan" add orphan
git -C "$d/orphan" -c user.name=Test -c user.email=test@example.test commit -qm orphan
prep --branch t3/orphan --worktree "$d/orphan"; status=$?
check "unrelated history cannot enter curation prep" "$((status != 0)) $(grep -c 'no integration base' "$d/out")" "1 1"
exit $fail
