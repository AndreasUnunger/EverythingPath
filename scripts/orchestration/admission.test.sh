#!/usr/bin/env bash
# usage: admission.test.sh — checks memory admission (admission.sh) with dummy
# commands: the committed table, reservations from recorded real peaks (seed
# until 3, then max + margin), the sampler, admission and queueing against the
# budget, gate priority, a gate beside a curator command when the real
# numbers fit, release when a job ends, is killed or is cancelled, stale-owner
# cleanup, unique ids and two concurrent curators. Uses a scratch state
# directory under $EP_ORCH/logs and a test table; no systemd unit or scope.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
dir=$(mktemp -d "$orch/logs/.admission-test-XXXXXX") || exit 1
pids=()
cleanup() { (( ${#pids[@]} )) && kill "${pids[@]}" 2> /dev/null; wait 2> /dev/null; rm -rf "$dir"; }
trap cleanup EXIT
export BOUNDED_STATE_DIR=$dir ADMISSION_INTERVAL=0.2
unset BOUNDED_WAIT_TIMEOUT BOUNDED_RESERVATION ADMISSION_TABLE
adm=$here/admission.sh
fail=0
check() { if [[ $2 == "$3" ]]; then echo "ok    $1"; else echo "FAIL  $1: want '$3', got '$2'"; fail=1; fi; }
# run <id> <class> <priority> <command...>: reserves, then runs the command in
# the background (admission.sh run execs into it); its output goes to <id>.out.
run() { "$adm" run "$@" > "$dir/$1.out" 2>&1 & pids+=($!); }
# state <id>: active, queued or gone, from the status line.
state() {
  local line; line=$("$adm" status)
  if [[ ${line#*active: } == *"$1 "* && ${line%%; queued:*} == *"$1 "* ]]; then echo active
  elif [[ ${line#*queued: } == *"$1 "* ]]; then echo queued
  else echo gone; fi
}
# until_state <id> <state>: waits up to 10 s for it.
until_state() { local _; for _ in $(seq 50); do [[ $(state "$1") == "$2" ]] && return 0; sleep 0.2; done; return 1; }
finish() { touch "$dir/$1.go"; }
# A dummy job that runs until finish <name> (or 60 s).
job() { echo "until [[ -e $dir/$1.go ]]; do sleep 0.1; done"; }

# --- The committed table ---
check "the budget is the table's" "$("$adm" gib budget)" "$(awk '$1 == "budget" { print $2 }' "$here/memory-reservations.tsv")"
check "the margin is 10%" "$(awk '$1 == "margin" { print $2 }' "$here/memory-reservations.tsv")" 10
check "a role (a model session) reserves nothing" "$("$adm" gib role)" 0
for class in gate-1 gate-2 gate-3 gate-4 prep-light-1 prep-light-2 prep-light-3 prep-light-4 prep-full-1 prep-full-2 prep-full-3 prep-full-4 curator curator-lint curator-corpus curator-test curator-light command role; do
  "$adm" gib "$class" > /dev/null || { echo "FAIL  class $class is missing from the table"; fail=1; }
  awk -v c="$class" '$1 == c && NF >= 3 { ok = 1 } END { exit !ok }' "$here/memory-reservations.tsv" \
    || { echo "FAIL  class $class has no source"; fail=1; }
done
"$adm" table | grep '^gate-3 .* seed (0 qualifying)$' > /dev/null
check "admission.sh table shows each class's basis" "$?" 0

# The rest uses a test table, so the logic doesn't move with the seeds.
cat > "$dir/test.tsv" << 'TABLE'
budget 16 test
margin 10 test
gate-1 12 test
gate-3 15 test
gate-4 16 test
prep-full-3 13 test
prep-light-1 10 test
prep-full-1 15 test
curator 8 test
curator-lint 3 test
curator-corpus 3 test
curator-test 3 test
curator-light 2 test
command 12 test
role 0 test
TABLE
export ADMISSION_TABLE=$dir/test.tsv
"$adm" gib bogus > /dev/null 2>&1
check "an unknown class is refused" "$?" 64
check "a landing queue in a gate unit is a gate by its workers" "$("$adm" class gate 3 /x/scripts/orchestration/land-queue.sh 384)" gate-3
check "cur-prep.sh is a light prep by its workers" "$("$adm" class gate 1 /x/scripts/orchestration/cur-prep.sh 384 msg)" prep-light-1
check "cur-prep.sh --full is a full prep" "$("$adm" class command 3 /x/cur-prep.sh --full 384 msg)" prep-full-3
check "any other command unit gets the default" "$("$adm" class command 1 bash -c true)" command
check "a role unit is a role" "$("$adm" class role 1 implementer)" role

# --- capped.sh commands by what they run ---
kind() { "$adm" class capped 1 "$@"; }
check "lint is curator-lint" "$(kind pnpm -s lint)" curator-lint
check "typecheck is curator-lint" "$(kind pnpm typecheck)" curator-lint
check "eslint and tsc on their own are curator-lint" "$(kind npx eslint a.ts) $(kind node ./node_modules/@typescript/native/bin/tsc -p x.json)" "curator-lint curator-lint"
check "a full-corpus preview is curator-corpus" "$(kind pnpm -s catalog:preview --system /s/foundryvtt-pf1)" curator-corpus
check "catalog:curate is curator-corpus" "$(kind pnpm catalog:curate --system /s)" curator-corpus
check "the whole of tests/catalog is curator-corpus" "$(kind pnpm test tests/catalog) $(kind npx vitest run tests/catalog/)" "curator-corpus curator-corpus"
check "a test run with no files is the whole suite: curator-corpus" "$(kind pnpm -s test)" curator-corpus
check "named test files are curator-test" "$(kind pnpm -s vitest run tests/catalog/a.test.ts convex/b.integration.test.ts)" curator-test
check "-t takes a value, which is no file" "$(kind pnpm test tests/catalog/a.test.ts -t 'public resolver')" curator-test
check "a file filter beside a directory is the corpus" "$(kind pnpm test tests/catalog/a.test.ts tests/catalog)" curator-corpus
check "--exclude runs everything else: curator-corpus" "$(kind pnpm test --exclude tests/catalog/example.test.ts) $(kind pnpm -s vitest run --exclude=tests/catalog/x.test.ts)" "curator-corpus curator-corpus"
check "option values are no file filters" \
  "$(kind pnpm test --project unit --reporter dot tests/catalog/a.test.ts) $(kind npx vitest run --reporter=verbose -t 'one case' tests/catalog/a.test.ts)" "curator-test curator-test"
check "a value option with no file after it is the whole suite" "$(kind pnpm test --project unit) $(kind pnpm test --reporter dot)" "curator-corpus curator-corpus"
check "known boolean flags take no value" "$(kind pnpm test --silent --passWithNoTests tests/catalog/a.test.ts)" curator-test
check "an option it doesn't know is uncertain: curator-corpus" "$(kind pnpm test --sequence.shuffle tests/catalog/a.test.ts) $(kind pnpm test -x tests/catalog/a.test.ts)" "curator-corpus curator-corpus"
check "--changed and --related pick their own files: curator-corpus" "$(kind pnpm test --changed) $(kind pnpm test --related src/a.ts)" "curator-corpus curator-corpus"
check "an unknown option in the --opt=value form is uncertain too: curator-corpus" "$(kind pnpm test --sequence.shuffle=true tests/catalog/a.test.ts)" curator-corpus
check "--changed=value and --related=value beside a named file: curator-corpus" \
  "$(kind pnpm test --changed=HEAD~1 tests/catalog/a.test.ts) $(kind pnpm test --related=src/a.ts tests/catalog/a.test.ts)" "curator-corpus curator-corpus"
check "a known option in the --opt=value form takes its value" "$(kind pnpm test --project=unit --testTimeout=30000 tests/catalog/a.test.ts)" curator-test
check "catalog:pin and catalog:format are curator-light" "$(kind pnpm catalog:pin) $(kind pnpm -s catalog:format --check)" "curator-light curator-light"
check "catalog:notice-deps reads the whole catalog: curator-corpus" "$(kind pnpm catalog:notice-deps)" curator-corpus
check "check:initial-migration-writers and prettier are curator-light" \
  "$(kind pnpm -s check:initial-migration-writers) $(kind pnpm exec prettier --write a.ts)" "curator-light curator-light"
check "bash -c is composite: curator, the largest" "$(kind bash -c 'pnpm -s lint')" curator
check "a script is unknown: curator" "$(kind .scratch/cur-388/gen/final.sh) $(kind node --import tsx .scratch/x.ts) $(kind pnpm exec tsx x.ts)" "curator curator curator"
check "a package script it doesn't know is unknown: curator" "$(kind pnpm dev)" curator
check "CAPPED_KIND names the kind of a composite command" "$(CAPPED_KIND=light kind bash -c 'pnpm catalog:pin; pnpm catalog:format')" curator-light
CAPPED_KIND=huge kind true > /dev/null 2>&1
check "an unknown CAPPED_KIND is refused" "$?" 64
check "curator is never below the largest command kind (curator-lint 3, ..., curator 8)" "$("$adm" gib curator)" 8
printf 'budget 16 test\nmargin 10 test\ncurator 2 test\ncurator-lint 3 test\ncurator-corpus 5 test\n' > "$dir/kinds.tsv"
check "curator below a command kind is raised to it" "$(ADMISSION_TABLE=$dir/kinds.tsv "$adm" gib curator) $(ADMISSION_TABLE=$dir/kinds.tsv "$adm" table | grep -c '^curator  .*the largest command kind, curator-corpus')" "5 1"

# Real peaks.log lines (a committed sample, truncated to 100 characters as
# the log keeps them) reclassified by their command: legacy curator lines by
# kind, a light prep whose log says it ran full as prep-full.
mkdir -p "$dir/admission" "$dir/logs"
cp "$here/admission-peaks.sample.log" "$dir/admission/peaks.log"
echo 'prep: full (tests/catalog changed)' > "$dir/logs/bounded-prep391b-20261019-213012-638aad.log"
echo 'prep: light, 4 test files' > "$dir/logs/bounded-prep425b-20261020-022205-c8a417.log"
"$adm" reclassify > "$dir/reclassify.out"
check "reclassify alone only says what it would change" "$(cmp -s "$here/admission-peaks.sample.log" "$dir/admission/peaks.log" && echo same) $(grep -c ' -> ' "$dir/reclassify.out")" "same 30"
"$adm" reclassify --write > /dev/null
check "reclassify --write relabels each line by its command" "$(awk '{ print $2 }' "$dir/admission/peaks.log" | paste -sd' ')" \
  "$(printf '%s ' curator-lint curator-lint curator curator-lint curator-lint curator-lint curator-lint \
    curator-corpus curator-corpus curator curator-corpus curator-corpus curator-corpus curator-corpus curator-corpus \
    curator-test curator-test curator-test curator-corpus curator-test curator curator-test curator-test curator-test \
    curator-light curator-light curator-light curator-light curator-corpus curator-light curator-light curator-light \
    curator curator curator curator curator curator prep-full-3 prep-light-3 | sed 's/ $//')"
check "and leaves the rest of each line alone" "$(cut -d' ' -f1,3- "$dir/admission/peaks.log")" "$(cut -d' ' -f1,3- "$here/admission-peaks.sample.log")"
check "a second run changes nothing" "$("$adm" reclassify --write | grep -c ' -> ')" 0
check "--write keeps a backup of the log it replaced" "$(for f in "$dir"/admission/peaks.log.bak-*; do cmp -s "$here/admission-peaks.sample.log" "$f" && echo kept; done)" kept
cp "$here/admission-peaks.sample.log" "$dir/admission/peaks.log"
mkdir "$dir/admission/peaks.log.tmp"                              # the rewrite can't be written
"$adm" reclassify --write > /dev/null 2>&1
check "a failed rewrite exits non-zero and leaves the log as it was" "$? $(cmp -s "$here/admission-peaks.sample.log" "$dir/admission/peaks.log" && echo same)" "72 same"
rmdir "$dir/admission/peaks.log.tmp"
"$adm" reclassify --write > /dev/null
# Each kind's reservation from its reclassified lines (every run qualifies here):
# lint 3 ok runs, max 6.82 GiB -> 7.5 -> 8; corpus one ok 8.08 GiB run raises
# it -> 8.9 -> 9; test 2 ok, a failed 5.68 GiB run raises it -> 6.25 -> 6.5;
# light 7 short ok runs of a few MiB -> 0.5; composites 6.96 -> 7.7 -> 8, under
# the largest kind (corpus 9).
check "each kind's reservation comes from its own lines" \
  "$(for c in curator-lint curator-corpus curator-test curator-light curator; do ADMISSION_MIN_SECONDS=0 "$adm" gib "$c"; done | paste -sd' ')" "8 9 6.5 0.5 9"
rm -rf "$dir/admission" "$dir/logs"

# --- Reservations from recorded real peaks ---
lib() { bash -c '. "$1"; shift; "$@"' _ "$adm" "$@"; }
G=1073741824
printf 'real_peak=%s\npeak=%s\nsamples=3\n' $(( 5 * G )) $(( 7 * G )) > "$dir/s5"
printf 'real_peak=%s\npeak=%s\nsamples=3\n' $(( 6 * G )) $(( 8 * G )) > "$dir/s6"
printf 'real_peak=%s\npeak=%s\nsamples=3\n' $(( 9 * G )) $(( 9 * G )) > "$dir/s9"
printf 'real_peak=%s\npeak=%s\nsamples=3\n' $(( 4 * G )) $(( 4 * G )) > "$dir/s4"
lib admission_record curator "$dir/s5" ok 120 r1 "pnpm -s lint"
lib admission_record curator "$dir/s6" ok 300 r2 "pnpm -s catalog:preview"
check "two qualifying runs: still the seed" "$("$adm" gib curator)" 8
lib admission_record curator "$dir/s4" ok 59 r3 "a short run"
check "an ok run under 60 s doesn't qualify" "$("$adm" gib curator) $("$adm" table | grep -o 'seed (2 qualifying)')" "8 seed (2 qualifying)"
lib admission_record curator "$dir/s4" failed 400 r4 "a failed run"
lib admission_record curator "$dir/s4" killed 400 r5 "a stopped run"
lib admission_record curator "$dir/s4" oom 400 r6 "an OOM-killed run"
check "failed, killed and OOM runs don't qualify" "$("$adm" gib curator) $("$adm" table | grep -o 'seed (2 qualifying)')" "8 seed (2 qualifying)"
lib admission_record curator "$dir/s4" ok 60 r7 "pnpm -s typecheck"
check "three qualifying: the largest real peak + 10%, rounded up to 0.5 GiB (6 -> 6.6 -> 7)" "$("$adm" gib curator)" 7
check "admission.sh table says so" "$("$adm" table | grep '^curator ')" "curator            7 GiB  max of 3 qualifying real peaks 6.00 GiB + 10%"
check "the peaks log has class, real peak, memory.peak, result, seconds, id and command" \
  "$(sed -n 1p "$dir/admission/peaks.log" | cut -d' ' -f2-)" "curator $(( 5 * G )) $(( 7 * G )) ok 120 r1 pnpm -s lint"
lib admission_record curator "$dir/s9" oom 10 r8 "an OOM-killed run"
check "an OOM run above the reservation raises it at once (9 -> 9.9 -> 10)" "$("$adm" gib curator)" 10
check "and the table says why" "$("$adm" table | grep -o 'raised: a recorded real peak 9.00 GiB + 10%')" "raised: a recorded real peak 9.00 GiB + 10%"
rm "$dir/admission/peaks.log"
lib admission_record gate-1 "$dir/s9" killed 5 k1 "a stopped gate"
check "a killed run below the seed changes nothing (9 < 12)" "$("$adm" gib gate-1)" 12
printf 'real_peak=%s\npeak=0\nsamples=3\n' $(( 13 * G )) > "$dir/s13"
lib admission_record gate-1 "$dir/s13" failed 30 k2 "a short failed gate"
check "a short failed run above the seed raises it (13 -> 14.3 -> 14.5)" "$("$adm" gib gate-1)" 14.5
for r in g1 g2 g3; do lib admission_record role "$dir/s13" ok 600 "$r" "a model session"; done
check "a role is never recorded and stays at 0" "$("$adm" gib role) $(grep -c ' role ' "$dir/admission/peaks.log")" "0 0"
rm "$dir/admission/peaks.log"

# --- The sampler ---
# It samples its own cgroup: here the test's. Its real peak is current - file + shmem.
ADMISSION_SAMPLE_INTERVAL=0.2 bash -c '. "$1"; admission_sample "$2" & sleep 1' _ "$adm" "$dir/sampled"
sleep 0.5
check "the sampler records a real peak, memory.peak and its sample count" \
  "$(grep -cE '^(real_peak=[1-9][0-9]*|peak=[0-9]+|samples=[2-9][0-9]*)$' "$dir/sampled")" 3
before=$(stat -c %Y.%s "$dir/sampled"); sleep 1
check "and stops when the shell that started it exits" "$(stat -c %Y.%s "$dir/sampled")" "$before"
cg=/sys/fs/cgroup$(sed -n 's/^0:://p' /proc/self/cgroup)
read -r cur < "$cg/memory.current"
check "the real peak is at most memory.current + shmem (cache excluded)" \
  "$(( $(sed -n 's/^real_peak=//p' "$dir/sampled") <= cur + $(awk '$1 == "shmem" { print $2 }' "$cg/memory.stat") + 268435456 ))" 1
( cd "$dir" && lib admission_run_sampled curator samp1 bash -c 'head -c 50M /dev/zero | tail > /dev/null; exit 3' )
check "a sampled command keeps its exit status" "$?" 3
check "and gets its line, with the result and seconds" "$(awk '{ print $2, $5, ($6 <= 2), $7 }' "$dir/admission/peaks.log")" "curator failed 1 samp1"
check "and the command" "$(cut -d' ' -f8- "$dir/admission/peaks.log")" "${dir##*/}: bash -c head -c 50M /dev/zero | tail > /dev/null; exit 3"
check "the sample file is removed" "$(ls "$dir/admission/samples" | wc -l)" 0
printf 'piped\n' | lib admission_run_sampled curator samp2 cat > "$dir/samp2.out"
check "stdin reaches the command" "$(cat "$dir/samp2.out")" piped
# started as a job of its own (set -m), as a terminal or the Bash tool starts
# capped.sh, so its SIGINT isn't ignored on entry
set -m; bash -c '. "$1"; shift; "$@"' _ "$adm" admission_run_sampled curator samp3 sleep 30 & sp=$!; set +m
sleep 1; kill -TERM "$sp"; wait "$sp"
check "TERM reaches the command; the run is recorded as killed" "$? $(awk '$7 == "samp3" { print $5 }' "$dir/admission/peaks.log")" "143 killed"
set -m; bash -c '. "$1"; shift; "$@"' _ "$adm" admission_run_sampled curator samp4 sleep 30 & sp=$!; set +m
sleep 1; t0=$SECONDS; kill -INT "$sp"; wait "$sp"
check "INT stops a command that doesn't handle it (sleep), promptly" "$? $(( SECONDS - t0 < 5 )) $(awk '$7 == "samp4" { print $5 }' "$dir/admission/peaks.log")" "130 1 killed"
rm "$dir/admission/peaks.log"

# --- Two concurrent curators; a third queues ---
run cur-a curator normal bash -c "$(job cur-a)"
until_state cur-a active
run cur-b curator normal bash -c "$(job cur-b)"
until_state cur-b active
check "two curator commands fit the budget together (8 + 8 GiB)" "$(state cur-a) $(state cur-b)" "active active"
run cur-c curator normal bash -c "$(job cur-c)"
until_state cur-c queued
check "a third queues" "$(state cur-c)" queued
check "the status line says why" "$("$adm" status | grep -o '^memory: 16/16 GiB reserved')" "memory: 16/16 GiB reserved"
finish cur-a
until_state cur-c active
check "it is admitted once a reservation is released" "$(state cur-a) $(state cur-c)" "gone active"
finish cur-b; finish cur-c
until_state cur-c gone

# --- Gates and preps first ---
run p-cur1 curator normal bash -c "$(job p-cur1)"; until_state p-cur1 active
run p-cur2 curator normal bash -c "$(job p-cur2)"; until_state p-cur2 active
run p-gate gate-1 high bash -c "$(job p-gate)"; until_state p-gate queued
run p-cur3 curator normal bash -c "$(job p-cur3)"; until_state p-cur3 queued
check "the status line marks the queued gate" "$("$adm" status | grep -c 'p-gate (gate-1 12G, [0-9]*s, gate/prep, ')" 1
finish p-cur1; until_state p-cur1 gone; sleep 1
check "8 GiB free: the queued curator would fit but waits behind the gate" "$(state p-gate) $(state p-cur3)" "queued queued"
finish p-cur2
until_state p-gate active
check "the gate is admitted first" "$(state p-gate) $(state p-cur3)" "active queued"
finish p-gate
until_state p-cur3 active
check "then the curator" "$(state p-cur3)" active
run p-prep prep-full-3 high bash -c "$(job p-prep)"; until_state p-prep queued
check "a prep beside a curator command doesn't fit (13 + 8 GiB) and queues" "$(state p-prep)" queued
finish p-cur3; until_state p-prep active
check "the prep is admitted when the curator command ends" "$(state p-prep)" active
finish p-prep; until_state p-prep gone

# --- A light prep that turns full ---
# cur-prep.sh, once its plan says full and before its tests, runs
# admission.sh escalate on its reservation: prep-light-<n> grows to
# prep-full-<n>, waiting while that doesn't fit, ahead of every queued command.
# esc_job <name>: a prep's job that escalates, notes the status in <name>.escaped, then runs until finish <name>.
esc_job() { echo "'$adm' escalate \"\$BOUNDED_RESERVATION\" > $dir/$1.esc 2>&1; echo \$? > $dir/$1.escaped; $(job "$1")"; }
run e-cur curator-light normal bash -c "$(job e-cur)"; until_state e-cur active
run e-prep prep-light-1 high bash -c "$(esc_job e-prep)"; until_state e-prep active
for _ in $(seq 50); do "$adm" status | grep -q 'growing to prep-full-1' && break; sleep 0.2; done
check "the prep (10 GiB) asks for prep-full-1 (15), which doesn't fit beside a curator command (2)" \
  "$("$adm" status | grep -c 'e-prep (prep-light-1 10G, [0-9]*s, growing to prep-full-1 15G, ')" 1
check "it keeps running meanwhile" "$(state e-prep) $([[ -e $dir/e-prep.escaped ]] && echo returned || echo waits)" "active waits"
run e-cur2 curator-light normal bash -c "$(job e-cur2)"; until_state e-cur2 queued; sleep 1
check "a curator command that fits beside the light prep (10 + 2 + 2) waits behind its growth" "$(state e-cur2)" queued
finish e-cur
for _ in $(seq 50); do [[ -e $dir/e-prep.escaped ]] && break; sleep 0.2; done
check "once the curator command ends the prep holds prep-full-1's 15 GiB" \
  "$(cat "$dir/e-prep.escaped") $(grep -c '^mib=15360$' "$dir/admission/entries/e-prep.entry") $(grep -c '^class=prep-full-1$' "$dir/admission/entries/e-prep.entry")" "0 1 1"
check "the events log says so" "$(grep -c ' escalating e-prep prep-light-1 10 to prep-full-1' "$dir/admission/events.log") $(grep -c ' grown e-prep prep-full-1 15' "$dir/admission/events.log")" "1 1"
check "and the curator command still waits (15 + 2 > 16)" "$(state e-cur2)" queued
finish e-prep; until_state e-prep gone
lib admission_record prep-light-1 "$dir/s5" ok 600 e-prep e-prep
check "the prep's run is recorded as prep-full-1, though its unit's meta says prep-light-1" "$(awk '$7 == "e-prep" { print $2 }' "$dir/admission/peaks.log")" prep-full-1
check "the class it was escalated to is forgotten once recorded" "$(ls "$dir/admission/classes" | wc -l)" 0
until_state e-cur2 active; finish e-cur2; until_state e-cur2 gone
run e-fit prep-light-1 high bash -c "$(esc_job e-fit)"; until_state e-fit active
for _ in $(seq 50); do [[ -e $dir/e-fit.escaped ]] && break; sleep 0.2; done
check "alone, it grows at once" "$(cat "$dir/e-fit.escaped") $(grep -c '^class=prep-full-1$' "$dir/admission/entries/e-fit.entry")" "0 1"
finish e-fit; until_state e-fit gone
run e-gate gate-1 high bash -c "$(esc_job e-gate)"; until_state e-gate active
for _ in $(seq 50); do [[ -e $dir/e-gate.escaped ]] && break; sleep 0.2; done
check "any other class (a landing queue's prep runs under its gate) is left alone" "$(cat "$dir/e-gate.escaped") $(grep -c '^class=gate-1$' "$dir/admission/entries/e-gate.entry")" "0 1"
finish e-gate; until_state e-gate gone
run e-busy curator-light normal bash -c "$(job e-busy)"; until_state e-busy active
run e-term prep-light-1 high bash -c "$(esc_job e-term)"; until_state e-term active
for _ in $(seq 50); do "$adm" status | grep -q 'e-term (prep-light-1 10G, [0-9]*s, growing' && break; sleep 0.2; done
pkill -TERM -f "admission.sh escalate e-term\$"; for _ in $(seq 50); do [[ -e $dir/e-term.escaped ]] && break; sleep 0.2; done
check "TERM ends the wait with 143 and leaves the light reservation" "$(cat "$dir/e-term.escaped") $(state e-term) $("$adm" status | grep -c growing)" "143 active 0"
finish e-term; finish e-busy; until_state e-term gone; until_state e-busy gone
rm -f "$dir/admission/peaks.log"

# --- A gate's intent: ahead of curator commands while it waits for its locks ---
# intent <id> <class> [awaited locks]: registers a pending intent (awaiting
# resource.lock by default), waits for $dir/<id>.locks (its locks), then asks
# for its memory and runs until finish <id>.
intent() {
  bash -c '. "$1"; admission_register "$2" "$3" high "$2" pending "$5" || exit
    until [[ -e $4.locks ]]; do sleep 0.1; done
    admission_request "$2" && admission_wait "$2" || exit
    until [[ -e $4.go ]]; do sleep 0.1; done' _ "$adm" "$1" "$2" "$dir/$1" "${3:-resource}" > "$dir/$1.out" 2>&1 & pids+=($!)
}
run i-cur1 curator normal bash -c "$(job i-cur1)"; until_state i-cur1 active
intent i-gate gate-1; until_state i-gate queued
check "the status line shows the intent" "$("$adm" status | grep -c 'i-gate (gate-1 waiting for its locks, ')" 1
run i-cur2 curator normal bash -c "$(job i-cur2)"; until_state i-cur2 queued; sleep 1
check "a curator command that fits (8 + 8) still waits behind the gate's intent" "$(state i-cur2)" queued
run i-cmd command high bash -c "$(job i-cmd)"
finish i-cur1; until_state i-cmd active
check "a high job (it may hold the gate's lock) is never held back by an intent" "$(state i-cmd) $(state i-cur2)" "active queued"
finish i-cmd; until_state i-cmd gone
touch "$dir/i-gate.locks"; until_state i-gate active
check "with its locks the gate asks for memory and goes first" "$(state i-gate) $(state i-cur2)" "active queued"
finish i-gate; until_state i-cur2 active
check "then the curator command" "$(state i-cur2)" active
finish i-cur2; until_state i-cur2 gone
intent i-gone gate-1; until_state i-gone queued
run i-cur3 curator normal bash -c "$(job i-cur3)"; until_state i-cur3 queued
{ kill -KILL "${pids[-2]}"; wait "${pids[-2]}"; } 2> /dev/null
until_state i-cur3 active
check "an intent whose job is gone ends, and the curator command goes" "$(state i-gone) $(state i-cur3)" "gone active"
finish i-cur3; until_state i-cur3 gone
intent i-cancel gate-1; until_state i-cancel queued
"$adm" cancel i-cancel; touch "$dir/i-cancel.locks"; wait "${pids[-1]}"
check "a cancelled intent ends its job with 143 once it has its locks" "$? $(state i-cancel)" "143 gone"

# --- An intent never holds back the job that holds its lock ---
# A bounded role holds resource.lock and reserves nothing; its worker's
# capped.sh commands inherit BOUNDED_HELD_LOCKS. A gate's intent waiting for
# that lock must not hold them back, or neither could ever finish.
intent h-gate gate-1; hg=${pids[-1]}; until_state h-gate queued
run h-free curator normal bash -c "$(job h-free)"; until_state h-free queued
# ran <id>: waits up to 10 s for <id>.out to say "<id> ran".
ran() { local _; for _ in $(seq 50); do grep -q "^$1 ran$" "$dir/$1.out" 2> /dev/null && return 0; sleep 0.2; done; return 1; }
BOUNDED_HELD_LOCKS=resource run h-role curator normal echo h-role ran
check "a command whose job holds the awaited lock is admitted past the intent and finishes" "$(ran h-role && echo ran)" ran
check "while a command without it still waits" "$(state h-free)" queued
BOUNDED_HELD_LOCKS="curator2 resource" run h-role2 curator normal echo h-role2 ran
check "the held locks are matched by name, in any list" "$(ran h-role2 && echo ran)" ran
BOUNDED_HELD_LOCKS=curator2 run h-other curator normal bash -c "$(job h-other)"; until_state h-other queued
check "holding some other lock doesn't count" "$(state h-other)" queued
"$adm" cancel h-gate > /dev/null; touch "$dir/h-gate.locks"; wait "$hg" 2> /dev/null
until_state h-free active; finish h-free; until_state h-free gone
until_state h-other active; finish h-other; until_state h-other gone
intent h-cgate gate-1 "resource curator"; hc=${pids[-1]}; until_state h-cgate queued
run h-cur curator normal echo h-cur ran
check "an intent waiting for a curator lock holds back no curator command (its holders can't be told apart)" "$(ran h-cur && echo ran)" ran
"$adm" cancel h-cgate > /dev/null; touch "$dir/h-cgate.locks"; wait "$hc" 2> /dev/null

# --- A gate beside a curator command when the real numbers fit ---
run f-cur curator normal bash -c "$(job f-cur)"; until_state f-cur active
run f-gate gate-3 high bash -c "$(job f-gate)"; until_state f-gate queued
check "with the seeds a 3-worker gate (15) doesn't fit beside a curator command (8)" "$(state f-gate)" queued
"$adm" cancel f-gate > /dev/null; wait "${pids[-1]}" 2> /dev/null
printf 'real_peak=%s\npeak=%s\nsamples=9\n' $(( 9 * G )) $(( 13 * G )) > "$dir/g9"
printf 'real_peak=%s\npeak=%s\nsamples=9\n' $(( 5 * G )) $(( 8 * G )) > "$dir/c5"
for r in 1 2 3; do lib admission_record gate-3 "$dir/g9" ok 1200 "g$r" land; lib admission_record curator "$dir/c5" ok 200 "c$r" lint; done
check "recorded real peaks: gate 9 -> 10 GiB, curator 5 -> 5.5 GiB" "$("$adm" gib gate-3) $("$adm" gib curator)" "10 5.5"
run f-cur2 curator normal bash -c "$(job f-cur2)"; until_state f-cur2 active
check "a new curator command reserves the derived 5.5 GiB" "$(grep -c '^mib=5632$' "$dir/admission/entries/f-cur2.entry")" 1
finish f-cur; until_state f-cur gone
run f-gate2 gate-3 high bash -c "$(job f-gate2)"; until_state f-gate2 active
check "the gate is admitted beside one curator command (10 + 5.5 <= 16)" "$(state f-gate2) $(state f-cur2)" "active active"
check "the status line shows it" "$("$adm" status | grep -o '^memory: 15.5/16 GiB reserved')" "memory: 15.5/16 GiB reserved"
run f-cur3 curator normal bash -c "$(job f-cur3)"; until_state f-cur3 queued
check "a second curator command beside them doesn't fit and queues" "$(state f-cur3)" queued
finish f-gate2; finish f-cur2; until_state f-cur3 active; finish f-cur3; until_state f-cur3 gone
rm "$dir/admission/peaks.log"

# --- Release when a job is killed, and stale owners ---
run k-cur curator normal bash -c "$(job k-cur)"; until_state k-cur active
{ kill -KILL "${pids[-1]}"; wait "${pids[-1]}"; } 2> /dev/null
until_state k-cur gone
check "a SIGKILLed job's reservation is gone once its last process is" "$(state k-cur)" gone
check "the sweep records its end" "$(grep -c ' ended k-cur curator 8 no process holds it' "$dir/admission/events.log")" 1
# The reservation belongs to the whole job: a child that outlives the
# reserving process keeps it until it exits too.
"$adm" run k-tree curator normal bash -c "sleep 60 & echo \$! > $dir/k-tree.child; exit 0" > /dev/null 2>&1
check "a child that outlives its parent keeps the reservation" "$(state k-tree)" active
bash -c '. "$1"; admission_drop k-tree' _ "$adm"
check "a wrapper's exit (admission_drop) leaves an admitted reservation to its last process" "$(state k-tree)" active
kill "$(cat "$dir/k-tree.child")"
until_state k-tree gone
check "and it is released when the child exits" "$(state k-tree)" gone
mkdir -p "$dir/admission/entries"
printf 'id=k-ghost\nclass=gate-3\nmib=15360\nprio=0\nseq=999\nstate=active\npid=999999\nsince=%s\nwhat=crashed wrapper\n' "$(date +%s)" > "$dir/admission/entries/k-ghost.entry"
check "an entry without a lock holder (a crashed wrapper) is swept" "$(state k-ghost)" gone
run k-after gate-3 high true
wait "${pids[-1]}"
check "and doesn't block the next job" "$? $(grep -c ' admitted k-after ' "$dir/admission/events.log")" "0 1"

# --- Cancelling a queued wait ---
run c-gate gate-4 high bash -c "$(job c-gate)"; until_state c-gate active
run c-cmd curator normal bash -c 'echo ran'; until_state c-cmd queued
"$adm" cancel c-cmd
wait "${pids[-1]}"
check "admission.sh cancel ends a queued wait with 143" "$? $(state c-cmd) $(grep -c '^ran$' "$dir/c-cmd.out")" "143 gone 0"
"$adm" cancel c-gate 2> /dev/null
check "an admitted reservation can't be cancelled that way" "$? $(state c-gate)" "1 active"
run c-term curator normal bash -c 'echo ran'; until_state c-term queued
kill -TERM "${pids[-1]}"; wait "${pids[-1]}"
check "TERM ends a queued wait with 143" "$? $(state c-term) $(grep -c '^ran$' "$dir/c-term.out")" "143 gone 0"
BOUNDED_WAIT_TIMEOUT=1 "$adm" run c-late curator normal true > "$dir/c-late.out" 2>&1
check "BOUNDED_WAIT_TIMEOUT ends a queued wait with 73" "$? $(state c-late) $(grep -c 'gave up waiting for memory after 1 s' "$dir/c-late.out")" "73 gone 1"
finish c-gate; until_state c-gate gone

# --- A failed state write fails the admission ---
run w-block gate-4 high bash -c "$(job w-block)"; until_state w-block active
run w-cmd curator normal bash -c 'echo ran'; until_state w-cmd queued
mkdir "$dir/admission/entries/w-cmd.entry.tmp"                   # its next state write can't happen
finish w-block; wait "${pids[-1]}"; status=$?
rmdir "$dir/admission/entries/w-cmd.entry.tmp"
check "the admission fails (72) and the command never runs" "$status $(grep -c '^ran$' "$dir/w-cmd.out")" "72 0"
check "the failure is in the events log" "$(grep -c ' failed w-cmd curator 8 state write' "$dir/admission/events.log")" 1
until_state w-cmd gone

# --- Ids, limits and the budget ---
run u-one curator normal bash -c "$(job u-one)"; until_state u-one active
"$adm" run u-one curator normal true > /dev/null 2>&1
check "a reservation id is unique" "$?" 64
finish u-one; until_state u-one gone
"$adm" run u-bad bogus normal true > /dev/null 2>&1
check "an unknown class never starts the command" "$?" 64
printf 'budget 4 test\nbig 8 test\n' > "$dir/small.tsv"
ADMISSION_TABLE=$dir/small.tsv "$adm" run u-big big normal true
check "a job bigger than the budget still runs alone" "$?" 0
check "nothing is left reserved" "$("$adm" status)" "memory: 0/16 GiB reserved; active: none; queued: none"

exit $fail
