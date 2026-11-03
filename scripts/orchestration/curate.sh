#!/usr/bin/env bash
# usage: curate.sh [--dry-run] <issue> <notice|content> [extra-notes-file]
# Creates the worktree ep-cur-<n> (branch cur/<n>) beside the main checkout
# from the feature head, writes the brief $EP_ORCH/briefs/curation-<n>.md
# (roles/common.md, the curator role, then the template from
# docs/agents/orchestration/templates/, then any extra notes), and runs Sol
# (Codex gpt-6.1-sol, high) on it. The answer goes to
# $EP_ORCH/answers/curation-<n>.md and each run's log to
# $EP_ORCH/logs/curation-<n>-<YYYYmmdd-HHMMSS>-codex.log;
# logs/curation-<n>-codex.log is a symlink to the latest run. Never use /tmp.
# The worktree holds only .env.example.
# Exit 75 means codex ended on a provider usage/quota error: pause the lane
# until the limit resets. Any other failure keeps codex's exit status.
# curate.sh --classify-log <log> [status] applies that rule to an existing log.
# It refuses to run while the pinned sources ($repos/sources) have any write
# bit: Sol's sandbox can write the whole repo parent, so the disk keeps them
# read-only (chmod -R a-w).
# --dry-run writes the brief to $EP_ORCH/briefs/curation-<n>.dry-run.md and
# prints the codex command; it creates no worktree and runs no codex.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/limits.sh"

# finish <status> <log>: exit 75 on a usage/quota terminal error, else <status>.
finish() {
  local err
  if err=$(codex_limit "$1" "$2"); then
    echo "codex usage limit: pause the lane ($err)" >&2
    exit 75
  fi
  exit "$1"
}
if [[ ${1:-} == --classify-log ]]; then
  finish "${3:-1}" "${2:?log file}"
fi

. "$here/paths.sh"
dry=0; [[ ${1:-} == --dry-run ]] && { dry=1; shift; }
n=${1:?issue number}; kind=${2:?notice|content}
wt=$repos/ep-cur-$n
run_tmp=
trap '[[ -n $run_tmp ]] && rm -rf "$run_tmp"' EXIT
run_tmp "curation-$n"
templates=$repo/docs/agents/orchestration/templates
common=$repo/docs/agents/orchestration/roles/common.md
role=$repo/docs/agents/orchestration/roles/curator.md
[[ -f $templates/brief-curation-$kind.md && -f $common && -f $role ]] || { echo "no template or role for $kind under $repo" >&2; exit 1; }
sources=$repos/sources
sources_check() {
  local w
  [[ -d $sources ]] || { echo "no pinned sources at $sources"; return 1; }
  w=$(find "$sources" -perm /a=w -print -quit 2>/dev/null)
  [[ -z $w ]] || { echo "the pinned sources are writable (e.g. $w); make them read-only first: chmod -R a-w $sources"; return 1; }
}
if (( dry )); then
  if why=$(sources_check); then echo "sources: read-only"; else echo "sources: a real run would refuse: $why"; fi
else
  why=$(sources_check) || { echo "refusing: $why" >&2; exit 1; }
fi
title=$(cd "$main" && gh issue view "$n" --json title --jq .title)
brief=$orch/briefs/curation-$n.md
if (( dry )); then
  brief=$orch/briefs/curation-$n.dry-run.md
elif [[ ! -d $wt ]]; then
  git -C "$main" worktree add "$wt" -b "cur/$n" feature/pf1-character-builder >/dev/null
  (cd "$wt" && pnpm install --offline >/dev/null)
fi
if [[ -d $wt ]] && ls -a "$wt" | grep -E '^\.env' | grep -vqx '.env.example'; then
  echo "env file present in $wt; refusing" >&2
  exit 1
fi
{ cat "$common"; echo; cat "$role"; echo; sed -e "s#<N>#$n#g" -e "s#<TITLE>#${title//#/\\#}#g" "$templates/brief-curation-$kind.md"; } > "$brief"
if [[ -n ${3:-} ]]; then
  { printf '\n## Extra for this batch\n'; cat "$3"; } >> "$brief"
fi
if (( dry )); then
  echo "dry run: brief $brief ($(wc -l < "$brief") lines)"
  echo "would create: $wt (cur/$n) from feature/pf1-character-builder$([[ -d $wt ]] && echo ', already there')"
  echo "would run: TMPDIR=$TMPDIR codex exec -m gpt-6.1-sol -c model_reasoning_effort=high --sandbox workspace-write -c sandbox_workspace_write.network_access=true -C $wt -o $orch/answers/curation-$n.md"
  exit 0
fi
start=$(date +%s)
log=$orch/logs/curation-$n-$(date -d "@$start" +%Y%m%d-%H%M%S)-codex.log
latest=$orch/logs/curation-$n-codex.log
# A pre-per-run log at the old path keeps its evidence under its own timestamp.
if [[ -f $latest && ! -L $latest ]]; then
  mv -n "$latest" "$orch/logs/curation-$n-$(date -r "$latest" +%Y%m%d-%H%M%S)-codex.log"
fi
ln -sfn "$(basename "$log")" "$latest"
echo "log: $log"
set +e
codex exec -m gpt-6.1-sol -c model_reasoning_effort=high --sandbox workspace-write \
  -c sandbox_workspace_write.network_access=true -C "$wt" \
  -o "$orch/answers/curation-$n.md" \
  "Read and follow $orch/briefs/curation-$n.md. Your worktree is the current directory (branch cur/$n). The answer file is the -o output path you were launched with; do not write answer files into the repo." \
  < /dev/null > "$log" 2>&1
status=$?
set -e
echo "curation-$n exit $status elapsed $(( ($(date +%s) - start) / 60 )) min"
echo "log: $log"
finish "$status" "$log"
