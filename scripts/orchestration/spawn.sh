#!/usr/bin/env bash
# usage: spawn.sh <role> --brief <file> --worktree <dir> [--model <codex model>] [--author opus|sol] [--runtime codex|claude] [--report <file>]
#        spawn.sh curator <n> <notice|content> [--brief <extra-notes-file>] [--dry-run]
# Starts one worker detached and prints its run id. The run lives in
# $EP_ORCH/runs/<id>/: meta, prompt.md, pid, log, report.md, and an exit file
# (the worker's exit status) once it finishes; wait for it with await.sh.
# The prompt is roles/common.md, then roles/<role>.md (both in
# docs/agents/orchestration/), then the brief, then a short note naming the
# worktree. Roles:
#   implementer  codex exec (gpt-6.1-sol, high), workspace-write in the worktree,
#                plus the main checkout's .git so it can commit.
#   explorer     codex exec (gpt-6.1-sol, high), writable only in
#                $EP_ORCH/research; it reads the worktree.
#   reviewer     --author is required, and the reviewer is the other model:
#                sol:  claude -p --agent reviewer in the worktree.
#                opus: codex exec --sandbox read-only (gpt-6.1-sol, high) in a
#                      fresh detached checkout of the worktree's HEAD beside the
#                      main checkout (ep-review-<id>), removed when it finishes.
#                      The worktree must be clean.
#   gatherer     read-only fact-gathering (logs, bulk search, sweeps) on a
#                cheap model. --runtime is required:
#                codex:  codex exec --sandbox read-only (gpt-6.1-sol, low) in a
#                        fresh detached checkout of the worktree's HEAD beside
#                        the main checkout (ep-gather-<id>), removed when it
#                        finishes. The worktree must be clean.
#                claude: claude -p --model sonnet in the worktree, with the
#                        reviewer's tools.
#                A reviewer gets read-only snapshots of the issues its brief
#                names (#<n>, or `gh issue view <n>`): its title, fields and
#                body (`gh issue view <n>`) and its comments (`gh issue view
#                <n> --comments`), each headed with its fetch time, plus an index.md
#                that lists them and any gh couldn't read. They go in the review
#                checkout's git-ignored .scratch/issues, or for a Claude
#                reviewer, which works in the shared worktree, in the run's
#                issues/ directory. The worker fetches them before it starts.
#                It also records what the review reads, for its receipts (#757):
#                meta's reviewed_commit (the checkout's HEAD, with
#                reviewed_dirty=1 when a Claude reviewer's worktree has
#                uncommitted changes) and reviewed-records.json, every catalog
#                record a receipt can cover with its source and payload hashes
#                as the review starts (catalog-record-review.ts --list --json,
#                run from this checkout). When it finishes, report.snapshot.md
#                and report.snapshot.sha256 keep its report's bytes (the
#                --report file, else report.md), which the receipt records.
#                --report <file> (reviewer and gatherer) is the only file a
#                Claude worker may write. If the run didn't write it (a Codex
#                run can't), spawn.sh copies report.md there; if that fails, so
#                does the run.
# --model is for implementer and explorer only, and must be a Codex (gpt-*)
# model. ui always runs on Fable, a reviewer's model follows --author, a
# gatherer's follows --runtime, and a curator runs what curate.sh runs;
# spawn.sh refuses --model for them.
#   ui           claude -p --agent ui (Fable) in the worktree.
# Claude workers run headless with the least permission that works:
# --permission-mode dontAsk (anything not allowed below is denied), no MCP
# servers, and an allowlist per role (claude_rules). The reviewer and gatherer get Read,
# Grep, Glob, read-only Bash (git and `git -C <worktree>` reads, cat, ls, gh issue
# view, gh api -X GET, and the bare `pnpm -s typecheck` and `pnpm -s lint`) and
# Write to its --report file only. The reviewer may also run `pnpm test <path>`
# without the snapshot-, output- or coverage-writing flags; the gatherer runs no
# tests. Neither gets rg (Grep searches; rg --pre and -z run other programs). ui gets
# Edit and Write inside its worktree and Bash for tests, typecheck, lint and
# git status/diff. spawn.sh refuses to start if claude lacks those flags.
#   curator      curate.sh <n> <notice|content> [extra-notes]; report.md links
#                to $EP_ORCH/answers/curation-<n>.md.
# Exit 75 (in the exit file) means a provider usage limit: pause that lane, and
# for ui, defer the UI. The worker runs a copy of this script from the run
# directory, so editing the repo's scripts can't break it.
# spawn.sh --classify-claude <status> <file>... applies the claude limit rule.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/limits.sh"

if [[ ${1:-} == --classify-claude ]]; then
  shift; claude_limit "$@" && exit 75; exit "${1:-1}"
fi

. "$here/paths.sh"
sol_model=gpt-6.1-sol

# claude_rules <role> <worktree> [report]: one --allowedTools rule per line.
# An absolute path in a rule is written //path. Edit(path) rules cover every
# file-writing tool, Write included; --tools decides which of them exist.
# `git -C` is allowed for the worktree's exact path only, so no glob can stretch
# a rule over a different subcommand.
claude_rules() {
  local b
  printf '%s\n' Read Grep Glob 'Bash(git status:*)' 'Bash(git diff:*)'
  case $1 in
    reviewer|gatherer)
      # Bare commands only: arguments could reach a writer (lint --fix, tsc --outDir).
      printf '%s\n' 'Bash(pnpm -s typecheck)' 'Bash(pnpm -s lint)'
      [[ $1 == reviewer ]] && printf '%s\n' 'Bash(pnpm test *)'
      for b in 'git log' 'git show' cat ls 'gh issue view' 'gh api -X GET'; do printf 'Bash(%s:*)\n' "$b"; done
      for b in diff log show status; do printf 'Bash(git -C %s %s:*)\n' "$2" "$b"; done
      [[ -n ${3:-} ]] && printf 'Edit(/%s)\n' "$3" ;;
    ui) printf '%s\n' 'Bash(pnpm test:*)' 'Bash(pnpm -s typecheck:*)' 'Bash(pnpm -s lint:*)' "Edit(/$2/**)" ;;
  esac
}
# claude_denied <role>: rules that win over the allowlist. gh api stays a GET (no
# second method or request body); git diff and log can't write files with
# --output. A read-only role's test run can't update snapshots or write a report
# or coverage.
claude_denied() {
  printf '%s\n' 'Bash(gh api -X GET *-X*)' 'Bash(gh api -X GET *--method*)' 'Bash(gh api -X GET *--input*)' \
    'Bash(git *--output*)'
  case $1 in
    reviewer|gatherer)
      printf '%s\n' 'Bash(pnpm test -u*)' 'Bash(pnpm test * -u*)' 'Bash(pnpm test *--update*)' \
        'Bash(pnpm test *--outputFile*)' 'Bash(pnpm test *--coverage*)' ;;
  esac
}
# claude_tools <role>: the built-in tools the worker can see at all.
claude_tools() { case $1 in reviewer|gatherer) echo Read,Grep,Glob,Bash,Write ;; ui) echo Read,Grep,Glob,Bash,Edit,Write ;; esac; }
# Fail closed: every flag the headless permission setup relies on must exist.
claude_flags_ok() {
  local help f
  help=$(claude --help 2>&1) || return 1
  for f in --permission-mode dontAsk --allowedTools --disallowedTools --tools --strict-mcp-config --permission-prompts --agent --model; do
    grep -qe "$f" <<<"$help" || { echo "claude --help has no $f"; return 1; }
  done
}
die() { echo "spawn.sh: $*" >&2; exit 1; }
has_env_files() { ls -A "$1" | grep -E '^\.env' | grep -vqx '.env.example'; }
# brief_issues <brief>: the issue numbers a brief names, once each, in order.
brief_issues() { grep -oE '#[0-9]+|gh issue view [0-9]+' "$1" | grep -oE '[0-9]+$' | awk '!seen[$0]++'; }
# snapshot_issues <dir>: writes issue-<n>.md for each issue the brief names, as
# gh read it then: `gh issue view <n>` (title, fields and body) and then
# `gh issue view <n> --comments` (off a terminal, gh prints the comments
# alone), and index.md; leaves them read-only. An issue either read fails for
# is listed as not fetched.
snapshot_issues() {
  local dir=$1 n issue comments
  mkdir -p "$dir" || return 1
  echo "# Issue snapshots for $id" > "$dir/index.md"
  for n in $(brief_issues "$brief"); do
    issue= comments=
    if issue=$(cd "${review_wt:-$wt}" && timeout 60 gh issue view "$n" 2>&1) \
      && comments=$(cd "${review_wt:-$wt}" && timeout 60 gh issue view "$n" --comments 2>&1); then
      {
        printf 'Fetched %s with `gh issue view %s` and `gh issue view %s --comments`.\n\n' "$(date -Iseconds)" "$n" "$n"
        printf '%s\n\n## Comments\n\n%s\n' "$issue" "${comments:-(none)}"
      } > "$dir/issue-$n.md"
      echo "- #$n: issue-$n.md" >> "$dir/index.md"
    else
      echo "- #$n: not fetched ($(head -1 <<<"${comments:-$issue}"))" >> "$dir/index.md"
    fi
  done
  chmod a-w "$dir"/*
  echo "issue snapshots: $(grep -c ': issue-' "$dir/index.md") in $dir"
}
# record_reviewed <checkout>: saves reviewed-records.json in the run, the
# catalog records as the review sees them; the record step compares against it.
record_reviewed() {
  if (cd "$repo" && node --import tsx scripts/catalog-record-review.ts --list --json --root "$1") > reviewed-records.json 2>> log; then
    echo "reviewed records: $(grep -c '"id":' reviewed-records.json) at ${reviewed_commit:0:12}${reviewed_dirty:+, with uncommitted changes}"
  else
    rm -f reviewed-records.json
    echo "no reviewed records: catalog-record-review.ts --list failed in $1"
  fi
}

# --exec <run>: the detached worker itself.
if [[ ${1:-} == --exec ]]; then
  run=${2:?run directory}
  # shellcheck source=/dev/null
  . "$run/meta"
  cd "$run" || exit 1
  status=
  finish() {
    trap - EXIT INT TERM
    local rc=${status:-$1}
    [[ -n ${run_tmp:-} ]] && rm -rf "$run_tmp"
    if [[ -n ${review_wt:-} && -e $review_wt ]]; then
      git -C "$main" worktree remove --force "$review_wt" >/dev/null 2>&1 || rm -rf "$review_wt"
      git -C "$main" worktree prune
      [[ -e $review_wt ]] && echo "!!!! review checkout $review_wt could not be removed; remove it by hand"
    fi
    echo "finished $(date +%Y%m%d-%H%M%S): exit $rc"
    echo "$rc" > exit.tmp && mv exit.tmp exit
    exit "$rc"
  }
  trap 'finish $?' EXIT; trap 'status=130; exit' INT; trap 'status=143; exit' TERM
  run_tmp "$id" || exit 1
  echo "started $(date +%Y%m%d-%H%M%S): $role in ${wt:-$repos}"
  [[ -n ${issues:-} ]] && snapshot_issues "$issues"
  [[ $role == reviewer ]] && record_reviewed "${review_wt:-$wt}"
  prompt=$(cat prompt.md)
  codex_run() {
    codex exec -m "$model" -c model_reasoning_effort="${effort:-high}" "$@" -o "$run/report.md" "$prompt" < /dev/null >> log 2>&1
    local rc=$? err
    if err=$(codex_limit "$rc" log); then echo "codex usage limit: pause the lane ($err)"; return 75; fi
    return "$rc"
  }
  # claude_run --agent <name> | --model <model>: the worker's definition or model.
  claude_run() {
    local rc hit rules denied
    mapfile -t rules < <(claude_rules "$role" "$wt" "$report")
    mapfile -t denied < <(claude_denied "$role")
    printf 'allowed: %s\ndenied: %s\n' "${rules[*]}" "${denied[*]}"
    # The prompt goes in on stdin: --add-dir and the rule lists are variadic and would swallow it.
    (cd "$wt" && claude -p "$@" --permission-mode dontAsk --permission-prompts none \
      --strict-mcp-config --tools "$(claude_tools "$role")" --add-dir "$orch" \
      --disallowedTools "${denied[@]}" --allowedTools "${rules[@]}") < prompt.md > report.md 2>> log
    rc=$?
    if hit=$(claude_limit "$rc" report.md log); then echo "claude usage or rate limit ($hit)"; return 75; fi
    return "$rc"
  }
  case $role in
    implementer) codex_run --sandbox workspace-write -C "$wt" --add-dir "$main/.git"; status=$? ;;
    explorer) codex_run --sandbox workspace-write --skip-git-repo-check -C "$orch/research"; status=$? ;;
    reviewer)
      if [[ $author == opus ]]; then
        GIT_OPTIONAL_LOCKS=0 codex_run --sandbox read-only -C "$review_wt"; status=$?
      else
        claude_run --agent reviewer; status=$?
      fi ;;
    gatherer)
      if [[ $runtime == codex ]]; then
        GIT_OPTIONAL_LOCKS=0 effort=low codex_run --sandbox read-only -C "$review_wt"; status=$?
      else
        claude_run --model sonnet; status=$?
      fi ;;
    ui) claude_run --agent ui; status=$?; (( status == 75 )) && echo "Fable has no quota: defer the UI" ;;
    curator) bash "$run/curate.sh" ${dry:+"$dry"} "$n" "$kind" ${extra:+"$extra"} >> log 2>&1; status=$?
      [[ -n $dry ]] && ln -sfn "$orch/briefs/curation-$n.dry-run.md" report.md ;;
  esac
  # --report: a Claude reviewer or gatherer writes it itself; otherwise (a Codex
  # run, or a worker that didn't) report.md is copied there. No report there means a failed run.
  if [[ $role =~ ^(reviewer|gatherer)$ && -n $report ]] && (( status == 0 )) && ! [[ $report -nt meta ]]; then
    if [[ ! -s report.md ]]; then
      echo "failed: the $role produced no report to put at $report"; status=1
    elif ! cp report.md "$report"; then
      echo "failed: could not copy the report to $report"; status=1
    fi
  fi
  # The report as the review finished, for its receipt (#757): the --report
  # file the reviewer wrote (or the copy above), else its final message. Either
  # can change later; report.snapshot.md and its hash don't.
  if [[ $role == reviewer ]] && (( status == 0 )); then
    src=report.md; [[ -n $report && -s $report ]] && src=$report
    if cp "$src" report.snapshot.md && sha256sum report.snapshot.md | cut -d' ' -f1 > report.snapshot.sha256; then
      chmod a-w report.snapshot.md report.snapshot.sha256
    else
      echo "failed: could not snapshot the report from $src"; status=1
    fi
  fi
  exit "$status"
fi

role=${1:-}; shift || true
case $role in implementer|explorer|reviewer|gatherer|ui|curator) ;; *) die "usage: spawn.sh <implementer|explorer|reviewer|gatherer|ui|curator> ..." ;; esac
brief= wt= model= author= runtime= n= kind= extra= report= dry=
if [[ $role == curator ]]; then
  n=${1:-}; kind=${2:-}; shift 2 2>/dev/null || true
  [[ $n =~ ^[0-9]+$ && $kind =~ ^(notice|content)$ ]] || die "usage: spawn.sh curator <n> <notice|content> [--brief <extra-notes-file>]"
fi
while (( $# )); do
  case $1 in
    --brief) brief=${2:?}; shift ;;
    --worktree) wt=${2:?}; shift ;;
    --model) model=${2:?}; shift ;;
    --author) author=${2:?}; shift ;;
    --runtime) runtime=${2:?}; shift ;;
    --report) report=${2:?}; shift ;;
    --dry-run) [[ $role == curator ]] || die "--dry-run is for curator only"; dry=--dry-run ;;
    *) die "unknown argument: $1" ;;
  esac; shift
done
[[ -z $brief || -f $brief ]] || die "no such brief: $brief"
[[ -n $brief ]] && brief=$(realpath "$brief")

review_wt= sha= issues= reviewed_commit= reviewed_dirty=
if [[ $role == curator ]]; then
  extra=$brief
  [[ -z $model ]] || die "--model is fixed for curator: curate.sh runs Sol"
  [[ -z $wt && -z $author && -z $runtime && -z $report ]] || die "curator takes only <n> <kind> [--brief <extra-notes-file>]"
else
  [[ -n $brief ]] || die "--brief is required"
  [[ -n $wt ]] || die "--worktree is required"
  wt=$(cd "$wt" 2>/dev/null && pwd -P) || die "no such worktree"
  [[ $(git -C "$wt" rev-parse --show-toplevel 2>/dev/null) == "$wt" ]] || die "$wt is not a git worktree root"
  [[ $wt != "$(cd "$main" && pwd -P)" ]] || die "$wt is the owner's main checkout"
  has_env_files "$wt" && die "$wt holds env files other than .env.example"
  if [[ $role == reviewer ]]; then
    case $author in
      sol) ;;
      opus)
        [[ -z $(git -C "$wt" status --porcelain) ]] || die "$wt has uncommitted changes; commit them before a Sol review"
        sha=$(git -C "$wt" rev-parse HEAD) ;;
      *) die "reviewer needs --author opus|sol (who wrote the work; the reviewer is the other model)" ;;
    esac
  elif [[ -n $author ]]; then
    die "--author is for reviewers only"
  fi
  if [[ $role == gatherer ]]; then
    case $runtime in
      claude) ;;
      codex)
        [[ -z $(git -C "$wt" status --porcelain) ]] || die "$wt has uncommitted changes; commit them before a Codex gatherer reads it"
        sha=$(git -C "$wt" rev-parse HEAD) ;;
      *) die "gatherer needs --runtime codex|claude" ;;
    esac
  elif [[ -n $runtime ]]; then
    die "--runtime is for gatherers only"
  fi
  [[ -z $report || $role =~ ^(reviewer|gatherer)$ ]] || die "--report is for reviewers and gatherers only"
  if [[ -n $report ]]; then
    report=$(realpath -m "$report")
    [[ -d $(dirname "$report") ]] || die "no directory for the report $report"
  fi
  case $role in
    implementer|explorer)
      [[ -z $model || $model == gpt-* ]] || die "--model for $role must be a Codex (gpt-*) model, not $model"
      model=${model:-$sol_model} ;;
    *)
      [[ -z $model ]] || die "--model is fixed for $role: ui runs on Fable only, a reviewer's model follows --author, and a gatherer's follows --runtime"
      [[ $role == reviewer && $author == opus || $role == gatherer && $runtime == codex ]] && model=$sol_model ;;
  esac
  agent=; [[ $role == ui ]] && agent=ui; [[ $role == reviewer && $author == sol ]] && agent=reviewer
  if [[ -n $agent && ! -f $wt/.claude/agents/$agent.md && ! -f $HOME/.claude/agents/$agent.md ]]; then
    die "$wt has no .claude/agents/$agent.md; rebase it onto the feature head"
  fi
  if [[ -n $agent || $role == gatherer && $runtime == claude ]]; then
    why=$(claude_flags_ok) || die "refusing to start a headless claude worker without its permission flags: $why"
  fi
fi

id=$role-$(date +%Y%m%d-%H%M%S)-$$
run=$orch/runs/$id
mkdir -p "$run" || die "can't create $run"
[[ $role == explorer ]] && mkdir -p "$orch/research"
if [[ -n $sha ]]; then
  prefix=review; [[ $role == gatherer ]] && prefix=gather
  review_wt=$repos/ep-$prefix-$id
  git -C "$wt" worktree add -q --detach "$review_wt" "$sha" || die "could not create the detached checkout $review_wt"
  if has_env_files "$review_wt"; then
    git -C "$main" worktree remove --force "$review_wt"; die "$sha commits env files"
  fi
fi
if [[ $role == reviewer ]]; then
  issues=$run/issues; [[ -n $review_wt ]] && issues=$review_wt/.scratch/issues
  reviewed_commit=$(git -C "${review_wt:-$wt}" rev-parse HEAD)
  [[ -z $review_wt && -n $(git -C "$wt" status --porcelain) ]] && reviewed_dirty=1
fi

{
  for v in id role brief wt model author runtime report sha review_wt issues reviewed_commit reviewed_dirty n kind extra dry main repos orch; do printf '%s=%q\n' "$v" "${!v}"; done
  printf 'started=%q\n' "$(date +%Y%m%d-%H%M%S)"
} > "$run/meta"

if [[ $role == curator ]]; then
  cp -p "$here/curate.sh" "$here/paths.sh" "$here/limits.sh" "$run/"
  ln -s "$orch/answers/curation-$n.md" "$run/report.md"
  echo "curator for #$n ($kind); the brief is written by curate.sh" > "$run/prompt.md"
else
  {
    cat "$repo/docs/agents/orchestration/roles/"{common,"$role"}.md || exit 1
    printf '\n---\n\n'
    cat "$brief"
    printf '\n---\n\n## This run\n\n'
    case $role in
      explorer) echo "- Read the codebase in $wt. Your writable directory is $orch/research; save your notes there." ;;
      reviewer) if [[ -n $review_wt ]]; then
          echo "- You're reviewing a fresh detached copy of $wt at $sha: $review_wt. Read that copy wherever the brief names $wt."
          echo "- Your sandbox is read-only, so your final message is the report; the orchestrator saves it."
        else
          echo "- Your worktree is $wt."
        fi
        if [[ -n $report && -z $review_wt ]]; then echo "- Write your report to $report; it's the only file you may write."; fi
        echo "- Snapshots of the issues this brief names, with their fetch times, are in $issues (index.md lists them). Read them when \`gh issue view\` can't reach GitHub." ;;
      gatherer) if [[ -n $review_wt ]]; then
          echo "- You're reading a fresh detached copy of $wt at $sha: $review_wt. Read that copy wherever the brief names $wt."
          echo "- Your sandbox is read-only, so your final message is the report; the orchestrator saves it."
        else
          echo "- Your worktree is $wt."
          [[ -n $report ]] && echo "- Write your report to $report; it's the only file you may write."
        fi ;;
      *) echo "- Your worktree is $wt." ;;
    esac
    echo "- Your final message is your report; it is saved to $run/report.md."
  } > "$run/prompt.md" || die "can't write the prompt"
fi
cp -p "$here/spawn.sh" "$here/paths.sh" "$here/limits.sh" "$run/" 2>/dev/null
setsid bash "$run/spawn.sh" --exec "$run" < /dev/null >> "$run/log" 2>&1 &
echo $! > "$run/pid"
echo "$id"
