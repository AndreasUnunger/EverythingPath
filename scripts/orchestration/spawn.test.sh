#!/usr/bin/env bash
# usage: spawn.test.sh — runs spawn.sh reviewer end to end with a stub codex
# (--author opus), a stub claude (--author sol) and a stub gh, checking the
# --report copy (copied on success, and a failed copy makes the run fail with
# a non-zero exit file), the issue snapshots (each issue the brief names is in
# the review checkout, read-only, with its fetch time, title, body and
# comments, and one gh can't read is listed as not fetched) and, for both
# runtimes, the reviewed inputs: the reviewed commit in meta and the catalog
# records in reviewed-records.json; and that a worker's prompt and a
# curation brief (curate.sh --dry-run) start with roles/common.md once.
# Uses a throwaway detached worktree of this checkout's HEAD beside the main
# checkout and a scratch EP_ORCH under $EP_ORCH/logs; removes both.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
dir=$(mktemp -d "$orch/logs/.spawn-test-XXXXXX") || exit 1
wt=$(mktemp -d "$repos/ep-spawn-test-XXXXXX") || exit 1
cleanup() {
  chmod -R u+w "$dir" 2>/dev/null; rm -rf "$dir"
  git -C "$main" worktree remove --force "$wt" > /dev/null 2>&1 || rm -rf "$wt"
  git -C "$main" worktree prune
}
trap cleanup EXIT
head=$(git -C "$here" rev-parse HEAD)
git -C "$main" worktree add -q --detach "$wt" "$head" || exit 1
mkdir -p "$dir/orch" "$dir/bin" "$dir/out" "$dir/ro"
# Stub codex: writes "OK" to its -o file, then what it found in the review
# checkout's issue snapshots, since the checkout is gone once the run ends.
cat > "$dir/bin/codex" <<'STUB'
#!/usr/bin/env bash
out= cwd=
while (( $# )); do
  case $1 in -o) out=$2; shift ;; -C) cwd=$2; shift ;; esac; shift
done
issues=$cwd/.scratch/issues
{
  echo OK
  for f in "$issues"/*; do
    [[ -w $f ]] && w=writable || w=read-only
    echo "== ${f##*/} $w"; cat "$f"
  done
  git -C "$cwd" status --porcelain
} > "$out"
STUB
# Stub gh, as gh prints off a terminal: `gh issue view <n>` prints the issue's
# fields and body, `gh issue view <n> --comments` its comments only; #404
# doesn't exist.
cat > "$dir/bin/gh" <<'STUB'
#!/usr/bin/env bash
[[ "$1 $2 ${4:-}" == 'issue view --json' ]] && { echo "Issue $3"; exit 0; }
[[ "$1 $2 ${4:-}" == 'issue view ' || "$1 $2 ${4:-}" == 'issue view --comments' ]] || { echo "unexpected gh $*" >&2; exit 2; }
[[ $3 == 404 ]] && { echo "GraphQL: Could not resolve to an issue (repository.issue)" >&2; exit 1; }
if [[ -n ${4:-} ]]; then
  printf 'author:\treviewer\nassociation:\towner\nedited:\tfalse\nstatus:\tnone\n--\nComment on %s.\n--\n' "$3"
else
  printf 'title:\tIssue %s\nstate:\tOPEN\ncomments:\t1\nnumber:\t%s\n--\nBody of %s.\n' "$3" "$3" "$3"
fi
STUB
# Stub claude: has every flag spawn.sh checks for, writes WRITTEN to the
# report path its prompt names, and answers with a different final message.
cat > "$dir/bin/claude" <<'STUB'
#!/usr/bin/env bash
[[ ${1:-} == --help ]] && { echo '--permission-mode dontAsk --allowedTools --disallowedTools --tools --strict-mcp-config --permission-prompts --agent --model'; exit 0; }
path=$(sed -n "s/^- Write your report to \(.*\); it's the only file you may write\.$/\1/p")
echo WRITTEN > "$path"; echo FINAL
STUB
chmod +x "$dir/bin/codex" "$dir/bin/gh" "$dir/bin/claude"
printf 'Review ticket #716 and #404 (`gh issue view 251`), then #716 again. Write OK.\n' > "$dir/brief.md"
chmod a-w "$dir/ro"
fail=0
ids=()
# review <report path> [author]: prints the run's exit code from await.sh;
# the run id goes in $dir/last-id.
review() {
  local id
  id=$(EP_ORCH=$dir/orch PATH=$dir/bin:$PATH "$here/spawn.sh" reviewer --author "${2:-opus}" --worktree "$wt" --brief "$dir/brief.md" --report "$1") || return 1
  echo "$id" > "$dir/last-id"
  EP_ORCH=$dir/orch "$here/await.sh" "$id" --timeout 120 | awk '{ print $2 }'
}
# snapshot <author> <expected first line>: checks the last run kept its
# report's bytes and their hash.
snapshot() {
  local run=$dir/orch/runs/$(cat "$dir/last-id")
  if [[ $(head -1 "$run/report.snapshot.md" 2>/dev/null) == "$2" && ! -w $run/report.snapshot.md ]] \
    && [[ $(sha256sum "$run/report.snapshot.md" | cut -d' ' -f1) == $(cat "$run/report.snapshot.sha256") ]]; then
    echo "ok    $1 review's report snapshot holds the report it wrote, with its hash"
  else
    echo "FAIL  $1 review's report snapshot:"; ls -l "$run" | sed 's/^/      /'; fail=1
  fi
}
# reviewed <author>: checks the last run recorded what it reviewed.
reviewed() {
  local id run
  id=$(cat "$dir/last-id"); run=$dir/orch/runs/$id; ids+=("$id")
  if grep -qx "reviewed_commit=$head" "$run/meta" \
    && grep -q '"id": "separate-identities everythingpath/monk-perfect-scholar + everythingpath/unchained-monk-perfect-scholar"' "$run/reviewed-records.json" 2>/dev/null; then
    echo "ok    $1 review records the reviewed commit and records"
  else
    echo "FAIL  $1 review's reviewed inputs:"; grep reviewed "$run/meta" "$run/log" | sed 's/^/      /'; fail=1
  fi
}
# preamble_first <file> <role heading> <what>: <file> starts with
# roles/common.md, which appears once, and the role file follows it.
preamble_first() {
  local common=$repo/docs/agents/orchestration/roles/common.md lines at
  lines=$(wc -l < "$common")
  at=$(grep -nx "$2" "$1" | head -1 | cut -d: -f1)
  if [[ $(head -n "$lines" "$1") == "$(cat "$common")" && $(grep -cxF "$(head -1 "$common")" "$1") == 1 && ${at:-0} -gt $lines ]]; then
    echo "ok    $3 starts with roles/common.md once, then the role file"
  else
    echo "FAIL  $3 preamble:"; head -n 5 "$1" | sed 's/^/      /'; fail=1
  fi
}
got=$(review "$dir/out/review.out.md")
if [[ $got == 0 && $(head -1 "$dir/out/review.out.md" 2>/dev/null) == OK ]]; then echo "ok    report copied, exit 0"; else echo "FAIL  copy: exit $got"; fail=1; fi
preamble_first "$dir/orch/runs/$(cat "$dir/last-id")/prompt.md" '# Reviewer' "a spawned worker's prompt"
mkdir -p "$dir/orch/briefs"
if EP_ORCH=$dir/orch PATH=$dir/bin:$PATH bash "$here/curate.sh" --dry-run 9901 notice > "$dir/curate.out" 2>&1; then
  preamble_first "$dir/orch/briefs/curation-9901.dry-run.md" '# Curator' "a curation brief"
else
  echo "FAIL  curate.sh --dry-run:"; sed 's/^/      /' "$dir/curate.out"; fail=1
fi
reviewed Sol
snapshot Sol OK
seen=$(cat "$dir/out/review.out.md" 2>/dev/null)
fetched='Fetched [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]+[+-][0-9:]+ with `gh issue view ([0-9]+)`'
if [[ $(grep -c '^== ' <<<"$seen") == 3 && $(grep -c '^== .* read-only$' <<<"$seen") == 3 ]] \
  && grep -qx '== issue-716.md read-only' <<<"$seen" && grep -qx '== issue-251.md read-only' <<<"$seen" \
  && [[ $(grep -oE "$fetched" <<<"$seen" | grep -oE 'view [0-9]+' | tr '\n' ' ') == 'view 251 view 716 ' ]] \
  && grep -qxF $'title:\tIssue 716' <<<"$seen" && grep -qxF $'title:\tIssue 251' <<<"$seen" \
  && grep -qx 'Body of 716.' <<<"$seen" && grep -qx 'Body of 251.' <<<"$seen" \
  && grep -qx 'Comment on 716.' <<<"$seen" && grep -qx 'Comment on 251.' <<<"$seen" \
  && grep -q '^- #404: not fetched (GraphQL: Could not resolve' <<<"$seen" \
  && ! grep -q '^??' <<<"$seen"; then
  echo "ok    issue snapshots in the review checkout, read-only, with fetch times, title, body and comments"
else
  echo "FAIL  issue snapshots:"; sed 's/^/      /' <<<"$seen"; fail=1
fi
got=$(review "$dir/out/claude.out.md" sol)
if [[ $got == 0 && $(cat "$dir/out/claude.out.md" 2>/dev/null) == WRITTEN ]]; then echo "ok    Claude review writes its report, exit 0"; else echo "FAIL  Claude review: exit $got"; fail=1; fi
reviewed Opus
snapshot Opus WRITTEN
got=$(review "$dir/ro/review.out.md")
ids+=("$(cat "$dir/last-id")")
if [[ $got != 0 && -n $got ]]; then echo "ok    failed copy fails the run (exit $got)"; else echo "FAIL  failed copy: exit ${got:-none}"; fail=1; fi
for id in "${ids[@]}"; do
  [[ -z $(git -C "$main" worktree list | grep "ep-review-$id") ]] || { echo "FAIL  review checkout ep-review-$id was left behind"; fail=1; }
done
exit $fail
