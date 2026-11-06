# shellcheck shell=bash
# Sourced by cur-prep.sh and land-queue.sh after paths.sh. The curation prep's
# test plan, its shared-store count and its receipt (#759).
#
# prep_plan <base> [full]: in a batch worktree, the checks for HEAD against
# <base> (the feature head it was rebased onto), one per line:
#   mode light|full
#   reason <why prep runs the whole of tests/catalog>   (full only)
#   test <path>                                          (sorted, unique)
#   note <text>
# Light prep runs the batch tests the whole <base>..HEAD diff touches (every
# changed test file, and every test of each batch whose artifacts change,
# older batches included, integration tests too), the tests the diff reaches
# through imports (`pnpm -s test:affected`, scripts/affected-tests.ts), plus
# the fixed guards. A test:affected failure, or its exit 3 (a changed path it
# cannot trace), makes the plan full.
# Anything else in the diff (shared tooling, schema, validators, including the
# guards and any test file that exports helpers, other fixtures, an edited or
# removed shared-store file, a removed test) makes it full, as does a missing
# guard: when in doubt, full.
#
# Receipts: cur-prep.sh writes $orch/logs/cur-<n>-prep.receipt (key=value)
# when prep passes, and removes it when a prep starts. The key is taken before
# the checks run, and no receipt is written if HEAD, its tree, the base or the
# worktree's state changed meanwhile. land-queue.sh reuses it only when the
# commit, base, lockfile, prep scripts, check configuration and the test
# environment (prep_env) are all unchanged (prep_reusable).

# The shared data files every batch adds to; catalog:merge merges them.
prep_data_files=(
  scripts/catalog/reviewed-curation.json
  scripts/catalog/legal/held-notices.json
  src/lib/catalog/data/attribution-assessments.json
  src/lib/catalog/data/attribution-evidence.json
  src/lib/catalog/data/section15-registry.json
)
# The TypeScript tables every batch appends rows to; catalog:merge merges
# their rows too (scripts/catalog/table-merge.ts), so they are resolvable.
prep_table_files=(
  scripts/catalog/reviewed-change-replacements.ts
  tests/catalog/cross-batch-bindings.ts
)
# The conflicted paths a rebase may hand to catalog:merge, as an extended
# regular expression: the data files and the tables. Any other conflict is
# resolved by hand.
prep_merge_re=$(printf '^%s$|' "${prep_data_files[@]}" "${prep_table_files[@]}" | sed 's/\./\\./g; s/|$//')
# Light prep always runs these: the #756 cross-batch guard, the notice holds,
# the shared-store loader, the #749 ownership checks' self-tests and their
# sweep over every applicable inventory, and #757's review-receipt validator.
# They are shared validators, so a batch that changes one gets a full prep.
prep_guards=(
  tests/catalog/cross-batch-bindings.test.ts
  tests/catalog/notice-holds.test.ts
  tests/catalog/pinned-sources.test.ts
  tests/catalog/batch-ownership.test.ts
  tests/catalog/batch-ownership-sweep.test.ts
  tests/catalog/review-receipts.test.ts
)
# The environment settings that change how the tests run (CI sets the test
# timeout in vitest.config.ts; the rest choose Vitest's workers and pool, and
# the time zone): part of the receipt, compared in both modes.
prep_env_vars=(CI VITEST_MAX_WORKERS VITEST_MIN_WORKERS VITEST_POOL TZ)
# Bump when the checks cur-prep.sh runs change; it is part of the receipt.
prep_checks='check:artifacts --base; catalog:launch-inventory --check; catalog:conditions compare; catalog:format --check; catalog:notice-deps; test:affected; vitest'
prep_count_start='<!-- prep:shared-store-count -->'
prep_count_end='<!-- /prep:shared-store-count -->'

prep_receipt_path() { printf '%s\n' "${PREP_RECEIPT_DIRECTORY:-$orch/logs}/cur-$1-prep.receipt"; }

# prep_batch_id <path>: the batch whose artifact <path> is, if any: its
# inventory scripts/catalog/legal/<id>.json (or <id>-evidence.json) exists at HEAD.
prep_batch_id() {
  local id
  case $1 in
    docs/catalog-import/*.md) id=${1#docs/catalog-import/}; id=${id%.md} ;;
    scripts/catalog/legal/*.json) id=${1#scripts/catalog/legal/}; id=${id%.json}; id=${id%-evidence} ;;
    tests/fixtures/*/*) id=${1#tests/fixtures/}; id=${id%%/*} ;;
    *) return 1 ;;
  esac
  [[ $id =~ ^[a-z]+(-[a-z]+)*-[0-9]+$ ]] || return 1
  git cat-file -e "HEAD:scripts/catalog/legal/$id.json" 2> /dev/null \
    || git cat-file -e "HEAD:scripts/catalog/legal/$id-evidence.json" 2> /dev/null || return 1
  printf '%s\n' "$id"
}

# prep_batch_tests <id>: every test file of batch <id> at HEAD, under tests/
# or convex/: <family>-<n>.test.ts, <family><n>.integration.test.ts,
# convex/catalog<Family><n>.integration.test.ts and the like.
prep_batch_tests() {
  local family=${1%-*} n=${1##*-}
  git ls-tree -r --name-only HEAD -- tests convex \
    | grep -iE "/(catalog)?(${family}|${family//-/})-?${n}\.([a-z]+\.)?test\.tsx?$" || true
}

# prep_classify <status> <path>: what one changed path means for the plan:
# "data", "store", "batch <id>", "test <path>" or "full <reason>".
prep_classify() {
  local status=$1 path=$2 id
  if [[ " ${prep_data_files[*]} " == *" $path "* ]]; then
    if [[ $status == D ]]; then echo "full $path removed"; else echo data; fi
  elif [[ $path == tests/fixtures/pinned/* ]]; then
    if [[ $status == A ]]; then echo store; else echo "full shared-store file $path changed ($status)"; fi
  elif id=$(prep_batch_id "$path"); then
    if [[ $status == D ]]; then echo "full $path removed"; else echo "batch $id"; fi
  elif [[ $path =~ \.test\.tsx?$ ]]; then
    if [[ $status == D ]]; then echo "full test $path removed"
    elif prep_shared_test "$path"; then echo "full shared validator $path changed"
    else echo "test $path"
    fi
  else
    echo "full $path"
  fi
}

# prep_shared_test <path>: a test file other tests depend on: a guard, the
# cross-batch guard's files, or one that exports helpers.
prep_shared_test() {
  [[ " ${prep_guards[*]} " == *" $1 "* || $1 == tests/catalog/cross-batch-bindings* ]] && return 0
  # grep reads the whole blob: with -q it would close the pipe on the first
  # export, and under pipefail git's SIGPIPE (141) would hide a shared test.
  git show "HEAD:$1" 2> /dev/null | grep -E '^export ' > /dev/null
}

# prep_plan_tests <id>...: "test <path>" for each batch's tests, or "full
# <reason>" for a batch with none.
prep_plan_tests() {
  local id own
  for id in $(printf '%s\n' "$@" | LC_ALL=C sort -u); do
    own=$(prep_batch_tests "$id")
    if [[ -n $own ]]; then sed 's/^/test /' <<< "$own"; else echo "full batch $id has no test file"; fi
  done
}

# prep_plan_guards: "test <guard>", or "full guard <guard> missing".
prep_plan_guards() {
  local g
  for g in "${prep_guards[@]}"; do
    if git cat-file -e "HEAD:$g" 2> /dev/null; then echo "test $g"; else echo "full guard $g missing"; fi
  done
}

# prep_plan_affected <base>: "test <path>" for each test the diff reaches
# through imports, nothing when HEAD has no scripts/affected-tests.ts, or
# "full test:affected exited <status>".
prep_plan_affected() {
  local out rc=0
  git cat-file -e HEAD:scripts/affected-tests.ts 2> /dev/null || return 0
  out=$(pnpm -s test:affected --base "$1" 2> /dev/null) || rc=$?
  if (( rc )); then echo "full test:affected exited $rc"; elif [[ -n $out ]]; then sed 's/^/test /' <<< "$out"; fi
}

prep_plan() {
  local base=$1 force=${2:-} status path ids=() lines
  lines=$(
    while IFS=$'\t' read -r status path; do
      prep_classify "$status" "$path"
    done < <(git diff --no-renames --name-status "$base" HEAD)
  )
  mapfile -t ids < <(sed -n 's/^batch //p' <<< "$lines")
  lines+=$'\n'$(prep_plan_tests "${ids[@]}")$'\n'$(prep_plan_affected "$base")$'\n'$(prep_plan_guards)
  prep_plan_print "$force" "$lines"
}

# prep_plan_print <force> <lines>: the plan from the classified lines.
prep_plan_print() {
  local reasons
  reasons=$(sed -n 's/^full //p' <<< "$2")
  if [[ -n $1 ]]; then printf 'mode full\nreason --full\n'
  elif [[ -n $reasons ]]; then
    echo "mode full"
    head -n 5 <<< "$reasons" | sed 's/^/reason /'
    (( $(wc -l <<< "$reasons") > 5 )) && echo "reason and $(( $(wc -l <<< "$reasons") - 5 )) more"
  else echo "mode light"
  fi
  grep '^test ' <<< "$2" | LC_ALL=C sort -u
}

# prep_shared_count <base>: the shared-store files HEAD adds against <base>,
# grouped by source: "102 (pf1 2, pf1-content 100)", or "0".
prep_shared_count() {
  local groups total
  groups=$(git diff --no-renames --diff-filter=A --name-only "$1" HEAD -- tests/fixtures/pinned \
    | awk -F/ 'NF > 4 { n[$4]++ } END { for (s in n) print s, n[s] }' | LC_ALL=C sort)
  total=$(awk '{ t += $2 } END { print t + 0 }' <<< "$groups")
  if (( total )); then echo "$total ($(awk '{ printf "%s%s %s", sep, $1, $2; sep = ", " }' <<< "$groups"))"
  else echo 0
  fi
}

# prep_write_count <issue> <base>: writes the shared-store count into the
# batch report's marker block (docs/catalog-import/<family>-<issue>.md) and
# amends HEAD when the line changes. Only a report with exactly one start
# marker followed by exactly one end marker is edited; without a report, or
# with a missing, duplicate or reversed marker, it prints the count and a
# warning and changes nothing. It never fails prep.
prep_write_count() {
  local n=$1 base=$2 count line report problem
  count=$(prep_shared_count "$base")
  echo "shared-store files added against ${base:0:12}: $count"
  report=$(git diff --name-only --diff-filter=AM "$base" HEAD -- docs/catalog-import | grep -E "^docs/catalog-import/[a-z]+(-[a-z]+)*-$n\.md$" || true)
  if [[ -z $report || $report == *$'\n'* ]]; then
    echo "warning: no single batch report for #$n in the diff; write the count above into it by hand" >&2
    return 0
  fi
  if problem=$(prep_marker_problem "$report"); then
    echo "warning: $report: $problem; the count above isn't in the report, which is unchanged" >&2
    return 0
  fi
  line="New shared-store files (\`tests/fixtures/pinned/\`), counted by prep after the rebase onto \`${base:0:8}\`: **${count%% *}**${count#"${count%% *}"}."
  awk -v start="$prep_count_start" -v end="$prep_count_end" -v line="$line" '
    $0 == start { print; print line; skip = 1; next }
    $0 == end { skip = 0 }
    !skip { print }' "$report" > "$report.prep-tmp" && mv "$report.prep-tmp" "$report" || return 1
  if [[ -n $(git status --porcelain -- "$report") ]]; then
    git add -- "$report" && git commit -q --amend --no-edit || return 1
    echo "wrote the count into $report (amended HEAD)"
  else
    echo "the count in $report is current"
  fi
}

# prep_marker_problem <report>: prints what is wrong with the report's count
# markers and succeeds, or fails when there is exactly one ordered pair.
prep_marker_problem() {
  local starts ends
  starts=$(grep -nxF "$prep_count_start" "$1" | cut -d: -f1)
  ends=$(grep -nxF "$prep_count_end" "$1" | cut -d: -f1)
  if [[ -z $starts || -z $ends ]]; then echo "no $prep_count_start marker block"
  elif [[ $starts == *$'\n'* || $ends == *$'\n'* ]]; then echo "more than one count marker pair"
  elif (( starts > ends )); then echo "the count markers are reversed"
  else return 1
  fi
}

# prep_scripts_hash: the prep scripts this checkout of scripts/orchestration runs.
prep_scripts_hash() {
  { (cd "$here" && cat cur-prep.sh prep-lib.sh paths.sh worktree-lib.sh)
    git hash-object -- scripts/check-artifacts.mjs scripts/artifact-budgets.json
  } | sha256sum | cut -c1-64
}

# prep_env: the test-affecting environment, "CI=true VITEST_MAX_WORKERS=1 ...",
# with "-" for an unset variable.
prep_env() {
  local v out=()
  for v in "${prep_env_vars[@]}"; do out+=("$v=${!v:--}"); done
  echo "${out[*]}"
}

# prep_identity <base>: what the checks ran on: HEAD, its tree, the feature
# head (frozen as <base> at the start) and the worktree's state.
prep_identity() {
  echo "$(git rev-parse HEAD) $(git rev-parse 'HEAD^{tree}') $(git rev-parse feature/pf1-character-builder) $1 $(git status --porcelain | sha256sum | cut -c1-16) $(git symbolic-ref --short -q HEAD) $(realpath "$(git rev-parse --show-toplevel)")"
}

# prep_key <base> <plan>: the receipt's key for HEAD in this worktree.
prep_key() {
  local base=$1 plan=$2
  echo "branch=$(git symbolic-ref --short -q HEAD)"
  echo "worktree=$(realpath "$(git rev-parse --show-toplevel)")"
  echo "commit=$(git rev-parse HEAD)"
  echo "tree=$(git rev-parse 'HEAD^{tree}')"
  echo "base=$(git rev-parse "$base")"
  echo "integrationBase=$(git rev-parse feature/pf1-character-builder)"
  echo "lockfile=$(git rev-parse HEAD:pnpm-lock.yaml 2> /dev/null) $(git rev-parse HEAD:package.json 2> /dev/null)"
  echo "scripts=$(prep_scripts_hash)"
  echo "env=$(prep_env)"
  echo "mode=$(sed -n 's/^mode //p' <<< "$plan")"
  echo "config=$(printf '%s\n%s\n' "$prep_checks" "$plan" | sha256sum | cut -c1-64)"
}

# prep_write_receipt <issue> <key> [extra key=value lines]: the key was taken
# before the checks ran.
prep_write_receipt() {
  local file; file=$(prep_receipt_path "$1")
  { echo "issue=$1"; echo result=ok; printf '%s\n' "$2"; printf '%s\n' "${@:3}"; echo "finishedAt=$(date -u +%FT%TZ)"; } > "$file.tmp" \
    && mv -f "$file.tmp" "$file" && echo "prep receipt: $file"
}

# Extract only a complete, unambiguous receipt key; never evaluate its contents.
prep_receipt_key() {
  local file=$1 k line
  for k in branch worktree commit tree base integrationBase lockfile scripts env mode config; do
    [[ $(grep -c "^$k=" "$file") == 1 ]] || { echo "missing or duplicate receipt field: $k" >&2; return 1; }
    line=$(prep_field "$file" "$k")
    [[ -n $line ]] || return 1
    printf '%s=%s\n' "$k" "$line"
  done
}

# Compare an already checked key with a receipt, preserving its full context.
prep_receipt_matches() {
  local file=$1 key=$2 k want got
  prep_receipt_key "$file" > /dev/null || return 1
  while IFS='=' read -r k want; do
    got=$(prep_field "$file" "$k")
    [[ $want == "$got" ]] || { echo "$k changed since the prep (${got:0:40} -> ${want:0:40})"; return 1; }
  done <<< "$key"
}

# prep_field <file> <key>: the first value of <key>. sed quits on it rather
# than feeding head, which under pipefail fails a long run of matches with 141.
prep_field() { sed -n "/^$2=/{s///p;q;}" "$1"; }

# prep_reusable <issue> <worktree> <base>: prints why the receipt can or can't
# stand in for a new prep of the worktree's HEAD on <base>; 0 when it can.
# A full prep's receipt stands in for any plan, but never for another
# test environment.
prep_reusable() {
  local n=$1 wt=$2 base=$3 file key want got k
  file=$(prep_receipt_path "$n")
  [[ -f $file && $(prep_field "$file" result) == ok ]] || { echo "no prep receipt"; return 1; }
  prep_receipt_key "$file" > /dev/null || { echo "malformed prep receipt"; return 1; }
  [[ $(grep -c '^issue=' "$file") == 1 && $(prep_field "$file" issue) == "$n" && $(grep -c '^result=' "$file") == 1 ]] || { echo "wrong or malformed prep receipt issue/result"; return 1; }
  [[ -z $(git -C "$wt" status --porcelain) ]] || { echo "the worktree has uncommitted changes"; return 1; }
  key=$(cd "$wt" && echo "commit=$(git rev-parse HEAD)"; echo "base=$(git rev-parse "$base")")
  for k in commit base lockfile tree integrationBase branch worktree scripts env config; do
    [[ $k == lockfile ]] && { key=$(cd "$wt" && git merge-base --is-ancestor "$base" HEAD && prep_key "$base" "$(prep_plan "$base")") \
      || { echo "HEAD isn't on top of ${base:0:12}"; return 1; }; }
    [[ $k == config && $(prep_field "$file" mode) == full ]] && continue
    want=$(sed -n "s/^$k=//p" <<< "$key"); got=$(prep_field "$file" "$k")
    [[ $want == "$got" ]] || { echo "$k changed since the prep (${got:0:40} -> ${want:0:40})"; return 1; }
  done
  echo "receipt $file: $(prep_field "$file" mode) prep of $(prep_field "$file" commit | cut -c1-12) on $(prep_field "$file" base | cut -c1-12) at $(prep_field "$file" finishedAt)"
}
