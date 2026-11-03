# shellcheck shell=bash
# Sourced by every orchestration script after it sets $here (its own directory).
# Sets main (the main checkout), repos (its parent), orch (the run directory)
# and repo (the checkout these scripts and their docs come from), and exports
# MAIN, EP_ORCH and EP_REPO so child scripts and snapshot copies inherit them.
# main comes from `git rev-parse --git-common-dir` in $here, so a snapshot copy
# outside the repo needs MAIN in its environment. EP_ORCH defaults to
# ep-orch/ beside the main checkout.
if [[ -z ${MAIN:-} ]]; then
  MAIN=$(git -C "$here" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) \
    || { echo "can't find the main checkout from $here; set MAIN" >&2; exit 1; }
  MAIN=$(dirname "$MAIN")
fi
main=$MAIN
repos=$(dirname "$main")
orch=${EP_ORCH:-$repos/ep-orch}
repo=${EP_REPO:-$(git -C "$here" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$main")}
export MAIN EP_ORCH=$orch EP_REPO=$repo

# run_tmp <name>: makes a fresh TMPDIR for this run outside every checkout,
# $repos/.ep-tmp/<name>-XXXXXX (never /tmp: tests that write scripts into
# TMPDIR break inside a "type": "module" checkout), and exports it as TMPDIR.
# The caller removes "$run_tmp" when it exits.
run_tmp() {
  mkdir -p "$repos/.ep-tmp" && run_tmp=$(mktemp -d "$repos/.ep-tmp/$1-XXXXXX") || { echo "can't create a TMPDIR under $repos/.ep-tmp" >&2; return 1; }
  export TMPDIR=$run_tmp
}
