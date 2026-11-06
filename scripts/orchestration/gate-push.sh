#!/usr/bin/env bash
# usage: gate-push.sh <REVIEWED> <BASE> <label>
# Root's push of a frozen landing candidate for the CI heavy checks (owner 2026-11-02, tree-only
# CI commits): a parentless commit of REVIEWED's tree, whose message carries Gate-Reviewed,
# Gate-Base and Gate-Tree (full SHAs), pushed to origin as refs/heads/gate/<label> and nothing
# else, so only the candidate's current files are published and never the integration history.
# Run it from the checkout whose origin is GitHub (root's main checkout). It refuses, pushing
# nothing, unless REVIEWED and BASE are full commit SHAs with REVIEWED descending from BASE, the
# worktree is clean (untracked files included), GIT_CONFIG is unset, origin has exactly one
# well-formed push URL that no url.<base>.insteadOf rewrite or remote named by it can redirect (the
# push names that URL), and every file in the tree is under 100 MB (GitHub's per-file limit),
# naming each at or over it.
# The commit's dates are REVIEWED's committer date, so the same inputs give the same commit.
# Prints the commit; remote_checks.py binds the CI manifest to it. Exit 64 is a usage error.
set -euo pipefail
limit=100000000
fail() { echo "gate-push: $*" >&2; exit 1; }
# The checks below must read the configuration the push applies. GIT_CONFIG makes `git config`
# read that one file, without include.path, and no other git command honours it (git-config(1),
# ENVIRONMENT), so with it set, whatever its value, the script refuses before any read. The other
# variables that change what git reads, GIT_CONFIG_GLOBAL, GIT_CONFIG_SYSTEM, GIT_CONFIG_NOSYSTEM,
# GIT_CONFIG_COUNT/KEY_<n>/VALUE_<n>, GIT_CONFIG_PARAMETERS, and HOME and XDG_CONFIG_HOME for the
# global files, apply to `git config` and `git push` alike, so they stay.
[[ -z ${GIT_CONFIG+set} ]] \
  || fail "GIT_CONFIG is set; only git config reads it, not git push, so the push URL checked could differ from the one pushed"
sha='^[0-9a-f]{40}$'
[[ $# -eq 3 && $1 =~ $sha && $2 =~ $sha && $3 =~ ^[a-z0-9-]+$ ]] \
  || { echo "usage: gate-push.sh <REVIEWED> <BASE> <label>  (full SHAs; label [a-z0-9-]+)" >&2; exit 64; }
reviewed=$1 base=$2 label=$3
[[ $(git rev-parse -q --verify "$reviewed^{commit}") == "$reviewed" ]] || fail "REVIEWED $reviewed is not a commit"
[[ $(git rev-parse -q --verify "$base^{commit}") == "$base" ]] || fail "BASE $base is not a commit"
git merge-base --is-ancestor "$base" "$reviewed" || fail "REVIEWED $reviewed does not descend from BASE $base"
# Clean means a status that succeeded and listed nothing: every untracked file whatever
# status.showUntrackedFiles says, submodules whatever their ignore setting, and no index entry
# marked assume-unchanged or skip-worktree (ls-files -v: a lowercase tag or S), which hides its
# worktree change from status.
status=$(git -c core.fsmonitor=false status --porcelain=v1 --untracked-files=all --ignore-submodules=none) \
  || fail "git status failed, so the worktree is not known to be clean"
[[ -z $status ]] || fail "the worktree is not clean"
index=$(git ls-files -v) || fail "git ls-files failed, so the worktree is not known to be clean"
! grep -qE '^([a-z]|S) ' <<< "$index" || fail "the index hides worktree changes (assume-unchanged or skip-worktree entries)"
# One destination: with several, one could accept the push while another refuses it. Git pushes
# to every remote.origin.pushurl, else every remote.origin.url; values are read NUL-separated
# (a value may hold a newline), and the push names the one URL, so configuration read later can
# add none. A config read that fails is refused, never taken as "no value".
# config_values <git config args...>: the values as NUL records, then the exit status as the last.
# (A process substitution inherits set -e, so the status is caught, not left to end it.)
config_values() { local status=0; git config --null "$@" || status=$?; printf '%s\0' "$status"; }
mapfile -d '' -t urls < <(config_values --get-all remote.origin.pushurl)
status=${urls[-1]}; unset 'urls[-1]'
if [[ $status == 1 ]]; then
  mapfile -d '' -t urls < <(config_values --get-all remote.origin.url)
  status=${urls[-1]}; unset 'urls[-1]'
  [[ $status != 1 ]] || fail "no origin remote (no remote.origin.pushurl or remote.origin.url)"
fi
[[ $status == 0 ]] || fail "git config failed reading origin's URLs"
[[ ${#urls[@]} -eq 1 ]] || fail "origin has ${#urls[@]} push URLs; a gate push needs exactly one"
url=${urls[0]}
# Refused: empty, an option-like leading '-', or any C0 control (newline and CR among them), DEL
# or C1 control (UTF-8 C2 80..9F).
[[ -n $url && $url != -* && $(printf '%s' "$url" | LC_ALL=C tr -d '\000-\037\177') == "$url" ]] \
  && ! LC_ALL=C grep -q $'\xc2[\x80-\x9f]' <<< "$url" \
  || fail "origin's push URL is empty, starts with '-' or contains a control character"
# Git rewrites a URL, an explicit one too, that starts with a url.<base>.insteadOf or
# pushInsteadOf value (remote.c alias_url: the longest such prefix). Any that applies is
# refused, so git applies none. A record is "key\nvalue"; the text after its last newline is the
# value or, if the value holds a newline (so it cannot prefix the URL), a part of it: a false
# match only refuses more. A record with no newline is a rewrite with no value.
mapfile -d '' -t rewrites < <(config_values --get-regexp '^url\..*\.(push)?insteadof$')
status=${rewrites[-1]}; unset 'rewrites[-1]'
[[ $status == 0 || $status == 1 ]] || fail "git config failed reading url.<base>.insteadOf rewrites"
for record in "${rewrites[@]}"; do
  [[ $record == *$'\n'* ]] || fail "a url.<base>.insteadOf or pushInsteadOf rewrite has no value"
  [[ $url != "${record##*$'\n'}"* ]] || fail "a url.<base>.insteadOf or pushInsteadOf rewrite applies to origin's push URL"
done
# git push <url> first reads a remote named <url> (remote.<url>.*), whose push URLs would replace
# the one checked; get-url exits 2 only when no such remote is configured.
git remote get-url -- "$url" > /dev/null 2>&1 && status=0 || status=$?
[[ $status == 2 ]] || fail "a remote is named by origin's push URL, so a push to it would use that remote's URLs"
tree=$(git rev-parse "$reviewed^{tree}")
large=$(git ls-tree -r -l -z "$tree" | awk -v RS='\0' -v limit="$limit" '
  { split($0, part, "\t"); split(part[1], meta, " ") }
  meta[2] == "blob" && meta[4] + 0 >= limit { printf "%s is %s bytes\n", part[2], meta[4] }')
[[ -z $large ]] || { while IFS= read -r line; do echo "gate-push: $line, at or over GitHub's 100 MB file limit" >&2; done <<< "$large"; exit 1; }
date=$(git show -s --format=%cI "$reviewed")
commit=$(printf 'gate: %s\n\nTree-only CI commit of REVIEWED for the heavy checks; no history.\n\nGate-Reviewed: %s\nGate-Base: %s\nGate-Tree: %s\n' \
  "$label" "$reviewed" "$base" "$tree" | GIT_AUTHOR_DATE=$date GIT_COMMITTER_DATE=$date git commit-tree "$tree")
git push --no-follow-tags --no-recurse-submodules -- "$url" "$commit:refs/heads/gate/$label" >&2 \
  || fail "push of gate/$label failed (an existing gate/$label at another commit, or origin unreachable)"
echo "$commit"
