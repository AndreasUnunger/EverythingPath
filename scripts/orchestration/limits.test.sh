#!/usr/bin/env bash
# usage: limits.test.sh — checks the usage-limit detectors in limits.sh against
# sample outputs. Scratch files go under $EP_ORCH/logs, never /tmp.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
. "$here/limits.sh"
dir=$(mktemp -d "$orch/logs/.limits-test-XXXXXX") || exit 1
trap 'rm -rf "$dir"' EXIT
fail=0
# expect <want: limit|none> <detector> <status> <text>
expect() {
  local want=$1 fn=$2 status=$3 got=none
  printf '%b\n' "$4" > "$dir/out"
  $fn "$status" "$dir/out" > /dev/null && got=limit
  if [[ $got == "$want" ]]; then echo "ok    $want: $4"; else echo "FAIL  want $want, got $got: $4"; fail=1; fi
}
expect limit claude_limit 1 "Claude AI usage limit reached|1760000000"
expect limit claude_limit 1 "You've hit your limit · resets 7pm (Europe/Stockholm)"
expect limit claude_limit 0 "You've hit your Fable limit · resets 7pm"
# Saved from a real spawn.sh ui run, 2026-10-08:
expect limit claude_limit 1 "You've reached your Fable limit. Switch to another model, or manage usage credits at https://claude.ai/settings/usage?from=cc_cli_limit_message, to continue."
expect limit claude_limit 0 "5-hour limit reached ∙ resets 7pm"
expect limit claude_limit 1 'API Error: 429 {"type":"error","error":{"type":"rate_limit_error","message":"rate limited"}}'
expect none  claude_limit 1 "Error: tool failed"
expect none  claude_limit 0 "UI report\n- 4 items done\n- files: a.tsx, b.tsx\n- no rate limit concerns; the hygiene check shows only .env.example"
expect limit codex_limit 1 "working...\nERROR: You've hit your usage limit. Try again later."
expect none  codex_limit 1 "a note about usage limit earlier\nERROR: stream disconnected"
expect none  codex_limit 0 "ERROR: usage limit"
exit $fail
