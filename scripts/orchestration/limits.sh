# shellcheck shell=bash
# Sourced by curate.sh and spawn.sh: provider usage-limit detectors. A worker
# that ends on one exits 75, which means pause the lane (or, for UI, defer).

# codex_limit <status> <log>: true, printing the error, when a failed codex run's
# final ERROR: line (within the last 40 lines) is a usage/quota error. Only the
# end counts: logs quote old notes about usage limits.
codex_limit() {
  (( $1 != 0 )) || return 1
  local err
  err=$(sed 's/\x1b\[[0-9;]*m//g' "$2" | tail -n 40 | grep -E '^ERROR:' | tail -n 1 || true)
  grep -qiE 'usage limit|usage_limit_exceeded|insufficient_quota|exceeded your current quota' <<<"$err" || return 1
  printf '%s\n' "$err"
}

# claude_limit <status> <file>...: true, printing the line, when a claude -p run
# ended on a usage or rate limit: the last 20 lines of its output or log name
# one, and the run failed or printed no real report (3 lines or fewer).
claude_limit() {
  local status=$1 f hit= lines=0; shift
  for f in "$@"; do
    [[ -s $f ]] || continue
    (( lines += $(wc -l < "$f") ))
    hit=${hit:-$(sed 's/\x1b\[[0-9;]*m//g' "$f" | tail -n 20 | grep -iE \
      'usage limit|(hit|reached) your ([a-z0-9-]+ )?limit|([a-z0-9-]+ )?limit reached|rate[ _]limit|API Error: 429|out of (extra )?usage' \
      | tail -n 1 || true)}
  done
  [[ -n $hit ]] && (( status != 0 || lines <= 3 )) || return 1
  printf '%s\n' "$hit"
}
