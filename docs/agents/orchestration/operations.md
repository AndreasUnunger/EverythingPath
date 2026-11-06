# Local validation and gate operation

New operations use repository tooling. Active external frozen bundles, old failed inputs/helpers/reports and authentic review/admission evidence remain immutable history; changing repository scripts does not qualify them or amend a frozen operation, and the parent owns adoption and live-state migration after review and qualification. Exact rules of the optional gate modes: [gate modes](../orchestration-reference/gate-modes.md). The complete validation and operator contracts, verbatim: [full contracts](../orchestration-reference/gate-operator-internals.md).

## Validation evidence

Before coding, select one impact-based plan, naming why each check is necessary and the configuration/runtime inputs it reads. Package scripts are authoritative for commands and heaps: `pnpm -s typecheck`, `pnpm -s lint` (including its 8192-MB old-space and 256-MB semi-space ESLint options), `pnpm test <paths>`, writer/artifact checks, and local codegen/browser checks when affected. Orchestration shell tests may be selected by their exact `scripts/orchestration/*.test.sh` entry path; the recorder executes no shell expressions or callback strings. The full queue stays mandatory, and shared-code regressions block outside a selected content slice.

Store a JSON plan in the external task directory:

```json
{
  "version": 1,
  "main": "/absolute/main",
  "orch": "/absolute/shared/ep-orch",
  "worktree": "/absolute/app-owned/worktree",
  "base": "FULL_BASE_SHA",
  "fullQueueRequired": true,
  "checks": {
    "types": {
      "impact": "Changed public types and their consumers",
      "argv": ["pnpm", "-s", "typecheck"],
      "inputs": ["tsconfig.json", "convex/tsconfig.json"]
    },
    "lint": {
      "impact": "Changed code must satisfy repository lint and unused checks",
      "argv": ["pnpm", "-s", "lint"],
      "inputs": ["eslint.config.mjs", "knip.jsonc"]
    }
  }
}
```

Resolve the actual configuration paths in this checkout, and include backend image/configuration or browser runtime input files when relevant; private environment files stay out of inputs. Run the recorder bare, with exactly `BOUNDED_WORKERS=2 BOUNDED_CPU=600% LC_ALL=C.UTF-8` exported; it caps its own child through `capped.sh`. Record and verify serially:

```bash
export BOUNDED_WORKERS=2 BOUNDED_CPU=600% LC_ALL=C.UTF-8
python3 -B scripts/orchestration/validation.py run /absolute/plan.json types /absolute/ep-orch/run/types-attempt-1
python3 -B scripts/orchestration/validation.py verify /absolute/plan.json types /absolute/ep-orch/run/types-attempt-1/receipt.json
```

The recorder and the full reuse boundary reject every `CAPPED_*` and `ADMISSION_*` override and every `BOUNDED_*` override except the canonical two (or their unset defaults); leave `CAPPED_KIND` unset so the wrapper classifies the planned command. Current receipts bind the canonical effective wrapper-control contract: receipts recorded under the earlier 1-worker / 400% contract, or missing that contract, need fresh recording for reuse and remain historical evidence. Each result directory is create-only, failures included. `verify` names the reason when content, dependencies, configuration, tooling, runtime inputs or environment change; a SHA change alone is not a reason, so a tree-identical squash repeats no author check. A check that is invalidated gets a new evidence directory; keep the failed or obsolete result and cite it with the reason in the report.

Specialized curation prep receipts stay authoritative for light/full catalog preparation, affected older batches, post-rebase counts, branch/path and full-plan escalation; author receipts supplement them. `cur-prep.sh --remote-suite` runs every prep check except Vitest, records the plan and uses admission class `prep-remote`. It writes only its own receipt file, `cur-<n>-prep.remote.receipt` (`tests=remote`), and never `cur-<n>-prep.receipt`, which only a local prep writes; each prep removes both when it starts. A landing under remote checks reads only the remote file and refuses a missing or stale one instead of preparing again. Every other landing reads only the local file, whose Vitest log must be this commit's passing run; otherwise it preps locally. A landing gate runs its complete checks and original suite independently of author-check reuse; only a verified [remote heavy-check manifest](#remote-heavy-checks) replaces its local typecheck, lint and full suite. Full validation contract: [validation evidence](../orchestration-reference/gate-operator-internals.md#validation-evidence).

**Empty validation plans.** A plan with `checks: {}` carries no author receipt into the gate, and `gate.json` `validation.receipts` is then `{}` too: `gate_core.verify_validation` requires the receipt names to equal the plan's check names. The gate still verifies the plan's `{path, sha256}`, `version: 1` and `fullQueueRequired: true`, and that its `main`, `orch`, `worktree` and `base` match the gate's. It verifies no receipt and captures no tool context. An empty plan is correct whenever no author check was recorded with `validation.py`, for example when the author ran its checks through `capped.sh` and reported them. It relaxes nothing, because the landing gate runs its complete checks and original suite either way. A plan that names a check needs that check's original receipt, which is verified at every authorization, so name only checks you recorded.

## Gate operator

`scripts/orchestration/gate-operator.py` owns the single-item prepare/freeze/submit/observe/collect/complete sequence. It runs `land-queue.sh` in a bounded gate unit; the queue owns rebasing, specialized curation prep, full validation and checked `land.sh`. Pairs use the [paired procedure](paired-gates.md); unflagged queue lists stay serial. Root drives it with the [script gate operator](#script-gate-operator); a gate is not a delegated task.

### Script gate operator

Root runs a gate with one command (root, 2026-11-05), from the gate spec `$EP_ORCH/scripts/brief.py ITEM gate ROUND` writes (`R/ITEM-gate-spec-rN.json`):

```bash
BOUNDED_WAIT=1 $EP_ORCH/bounded.sh --detach <label> driver <spec.json>
$S/await.sh <id>
```

- **Sequence:** `gate-run.py` runs what the operator task ran by hand, with the same checks and refusals:
  1. identities, prepared mapping and mode proofs;
  2. three prelaunch samples 30 s apart at the gate mode's launch guard plus 0.5 GiB ([gate memory](#gate-memory)), with all five locks free, idle admission and no other heavy unit, for at most 90 minutes;
  3. the storage baseline;
  4. `gate-operator.py prepare` and `runtime`;
  5. the stale-admission probe (every 5 s, at most 2 minutes, never killing or removing anything);
  6. a pre-claim check of memory, admission and storage against the baseline;
  7. the retained entry's `resume`.
  The observer, collection, `complete`, the frozen runtime and the single submission stay the gate operator's.
- **Inputs:** it writes `gate.json` from the spec with `gate_config.py` and never from prose. It also writes `operator.json`, `control.json`, the empty validation plan, the commit message (the spec's `message`, an optional `message_body` and the trailer), `storage-baseline.json` and `environment-precheck.json`, all create-only in the spec's `inputs_dir`. `preservedEvidence` binds the acceptance, the Q1 records, the driver's own prechecks, the lane check, a curation batch's prep receipt and the spec's `preserve` list. It rebuilds the public environment rather than inheriting it: no `BOUNDED_*`, `CAPPED_*`, `LAND_*` or `VITEST_*` from the unit reaches the gate operator. Unknown spec keys refuse.
- **Operator identity:** `operator.json` is `{kind: "script", path, commit, blob, taskId, runId}`: MAIN's `scripts/orchestration/gate-run.py`, its blob at `BASE` and this run's id. `gate_core.operator_identity` requires that path, `commit` equal to `BASE` and the committed blob. The driver refuses to run when its own bytes are not that blob. Author and reviewer independence, terminal review identity and the exact candidate, base and tree bind as before.
- **Refusals** stop with a recorded reason and launch nothing further: a memory guard, a storage event since the baseline, admission not idle, an identity mismatch (MAIN, WT or driver), a moved base, a prepared-mapping mismatch, a refused mode proof, or a `prepare`/`resume` failure. A stopped gate keeps its attempt and mapping, and its control ends `stopped`.
- **Stop:** `python3 -B $MAIN/scripts/orchestration/gate-run.py --stop <spec.json>` sets the attempt's control to `stopped`. It takes the attempt's publication lock (`publication.lock` in the inputs) that finalization holds while it fixes the verdict and writes the result, so the two never interleave. A stop that wins makes the run report `stopped` (exit 1); after a publication, `--stop` prints `already finished: <verdict>` and changes nothing. Stopping the unit (`systemctl --user stop ep-fresh-<id>`, or SIGTERM/SIGINT) writes the same stopped control at once, whatever the driver is doing. From then on the driver starts no stage and launches no gate-operator command. The gate operator refuses any phase under that control: at submission, observation and completion, with the scoped cancellation and safe collection below. A running command is never killed; the driver waits for it. A stopped run never reports `landed`, even when MAIN reached the candidate before the stop (the result records `mainAtCandidate`). After a stop with a submission claim and no collected result, the driver runs the retained entry's `cancel`.
- **Outputs:** the spec's `result` (`.md`) and the same path as `.json`: the verdict (`landed` or `stopped`), the stop reason, the SHAs, the invocation and receipt, each stage's outcome and exit, and the driver identity. The suite counts cover every suite the gate used: `local` (local and `compare`), `remote` (`compare` and `replace`, from the manifest's report) and `hostAudits` (`replace`). A light-lane gate runs no suite. Then the spec's `done_marker`. Exit 0 means landed and completed; 1 means any stop; 2 means an invalid spec or an earlier attempt's files in the way. Nothing is overwritten.
- **Retry after a stop:** the result's `preparedRetry` is the exact `prepared` spec field, `{candidate, mapping, mapping_sha256}`, from the attempt's `mapping.json`. It is null when the attempt stopped before preparation wrote one. `python3 -B $MAIN/scripts/orchestration/gate_config.py retry <prior spec> R/ITEM-gate-spec-rN.json --label <label>` writes the next spec (`brief.py ITEM gate N --label <label> --retry-of <prior spec>` calls it). It keeps the prior spec's BASE, REVIEWED, TREE, branch, archive, reviews, author, acceptance, message and modes, never the squashed HEAD, and renames only the attempt.
  - With a mapping, the retry is `prepared` mode on the same frame.
  - Without one, it is the prior `prepared` or a fresh squash of the same REVIEWED. A partial preparation that already wrote the archive ref but no mapping refuses that squash ("Archive ref already exists"); root diagnoses it.
  - A moved base allows neither: rebase, prove or re-review, and write a new spec.
- **Detaching:** kind `driver` takes no lock and reserves no memory, because the gate operator it runs takes the five locks itself and needs idle admission. Kind `gate` would hold both and refuse its own gate. So the kind runs one command only, built by `scripts/orchestration/driver-argv.sh`: `/usr/bin/env -i <session variables> /usr/bin/python3 -I -B $MAIN/scripts/orchestration/gate-run.py [--stop] <spec>`.
  - **Spec:** a canonical regular `.json` file under `$EP_ORCH` with a full `base` SHA.
  - **Code:** every entry of `scripts/orchestration` must be exactly BASE's, with BASE's bytes (`git hash-object --no-filters`, so `assume-unchanged` and `skip-worktree` change nothing). That binds the driver, its imports, the guard and the admission and outcome libraries.
  - **Refused with 64:** any other argument, script or interpreter; an override that names code (`BOUNDED_ADMISSION_LIB`, `BOUNDED_OUTCOME_LIB`, `BOUNDED_SPAWN`, `BOUNDED_CLASS`, `BOUNDED_LOCKS`, `BOUNDED_GATE_MEMORY_MAX`, `ADMISSION_TABLE`, `BASH_ENV`, `ENV`, `LD_PRELOAD`, `LD_AUDIT`, `PYTHON*`, `NODE_OPTIONS`/`NODE_PATH`); an exported function.
  - **Fixed PATH:** before either entry point sources, executes or looks anything up, it sets PATH to `DRIVER_PATH` in `$EP_ORCH/bounded-driver.sh`: the gate's `execution_tools` PATH, `/home/andreas/.nvm/versions/node/v22.22.0/bin:/usr/bin:/bin`. The caller's PATH is ignored, not validated. The unit, its sampler and receipt, and the driver run with that PATH, and Python always runs by absolute path. The guard refuses any other PATH, so an entry point that skipped the step never runs a driver.
  - **Neutralized:** the ambient session variables `GIT_*` and `LD_LIBRARY_PATH` (a T3 session sets `GIT_EDITOR` and `LD_LIBRARY_PATH`) are unset before any external command runs. Every git and Python call, and the driver itself, runs under `env -i` and never sees them.
  - **Order:** both entry points (`bounded.sh` and the unit's `run-bounded-driver.sh`) run as `bash -p`. `$EP_ORCH/bounded-driver.sh` checks the guard's bytes against BASE, under `env -i` with absolute tools, before sourcing it. The guard runs before either entry point loads any MAIN library or writes any state.
  - **`--stop` through the unit** needs MAIN still at BASE. After the checked fast-forward, run `gate-run.py --stop` directly. Until `$EP_ORCH/bounded.sh` has kind `driver`, start `/usr/bin/python3 -I -B $MAIN/scripts/orchestration/gate-run.py <spec.json>` with `systemd-run --user --collect --unit=ep-gaterun-<label> -p WorkingDirectory=$MAIN --setenv=PATH=/home/andreas/.nvm/versions/node/v22.22.0/bin:/usr/bin:/bin` and wait for the done marker.
- **Root still owns:** the diagnosis of a stop, recovery from an ambiguous state and every decision about a fresh attempt.

**Codex operator (transition).** Attempts prepared under a codex operator task before the script operator continue through that operator's frozen runtime: `export GATE_CONFIG=<its gate.json>; python3 -B "$GATE_ENTRY" resume`. `gate_core` accepts a codex operator task only for an attempt whose `prepared.json` binds that exact configuration. Every new attempt, `prepared`-mode retries included, uses the script operator. Root removes this paragraph once the first scripted gate has qualified the driver.

The driver writes one external JSON configuration with these fields (operations schema):

| Field | Contract |
|---|---|
| `version`, `kind` | `1`; `code` or `curation` |
| `main`, `orch`, `worktree`, `branch`, `feature` | Canonical absolute main/shared run/app checkout paths and exact Git branches |
| `base`, `reviewed`, `tree` | Full fixed Git SHAs, linear reviewed history on the frozen integration base |
| `attempt`, `label` | New absolute external evidence directory; safe unique invocation label |
| `operator` | `{path, sha256}` for the [script operator identity](#script-gate-operator) (enforced); a codex operator task only for an attempt already prepared under it |
| `author` | Separate `{path, sha256}` for the actual author task/model/options. Review independence is checked against the author. |
| `validation` | `{plan: {path, sha256}, receipts: {CHECK: {path, sha256}}}`: the validation plan and the original version-2 receipt for every reused check, verified at preparation, submission and final acceptance |
| `resourcePolicy` | `{path, sha256}` for the shared `resource-policy.md` |
| `storageBaseline` | `{path, sha256}` for the storage journal/counter baseline, in the existing guard format |
| `reviews` | Code: `standards` and `spec`; curation: `curation`, with all admissions reviewed |
| `phases` | Authorized subset of `prepare`, `submit`, `observe`, `collect`, `complete`, `checked-land` |
| `control` | Absolute external mutable stop control, bound to the operator's `taskId`/`runId` and reviewed/base/tree |
| `preparation` | `squash` or `prepared`, below |
| `issue` | Positive issue discriminator, curation only; independent of app branch/path |
| `remoteChecks` | Optional `{path, sha256, mode}`; [remote heavy checks](#remote-heavy-checks). Absent, every code path is the local gate. |
| `rebaseProof` | Optional, code only; [mechanical-rebase proof](#mechanical-rebase-proof) |
| `carriedReview` | Optional, code only; [single-axis fix review](#single-axis-fix-review) |
| `lane` | Optional, code only; [light landing lane](#light-landing-lane). Absent, the full queue runs. |
| `preservedEvidence` | Optional `{path, sha256}` references to prior evidence; `kind: "index"` also verifies its relative `files` map at prepare/collect |

Each review declares `commit`, `tree`, `taskId`, `runId`, actual `target: {providerInstanceId, model, options}`, `task: {path, sha256}`, `report: {path, sha256}`, `disposition: "accepted"` and `unresolved: []`. A review binds `REVIEWED`/`TREE`, except as `rebaseProof` and `carriedReview` allow. Task metadata must show the original run terminal and completed, with no pending children and exact model/options; the parent supplies these observations. A correction review's report carries prior acceptance and the delta/closure disposition. Record promotion also needs [T3 capture evidence](t3-reviews.md) and `catalog-record-review.ts --verify`.

New preparation: `preparation: {mode: "squash", archive: "refs/archive/RUN/reviewed", message: {path, sha256}}`. It keeps the reviewed chain under the archive, creates one exact-tree commit with the frozen base as sole parent, compares the complete content and records `mapping.json`. Curation must already be one specialized-prepared, reviewed commit; preparation keeps that commit and its prep receipt, and a mismatching prep receipt stops for fresh prep and review.

An already prepared candidate: `preparation: {mode: "prepared", archive: "refs/archive/RUN/reviewed", candidate: "FULL_SHA", mapping: {path, sha256}}`. The mapping binds `BASE`, `REVIEWED`, `TREE`, `WT`, `BR`, `ARCHIVE` and `SQUASHED`; historical mapping formats are read as they are, and tree, parent, diff, registered checkout and archive are rechecked. This creates fresh attempt evidence without re-squashing.

Control shape: `{state: "active", taskId: "ACTUAL_TASK", runId: "ACTUAL_RUN", reviewed: "FULL_SHA", tree: "FULL_TREE", base: "FULL_BASE"}`. Set `state: "stopped"` to stop; `finish-current` plus `phase` restricts continuation to that phase, except that finishing observation includes the required terminal collection, and completion waits for active continuing authority. The configuration authorizes the selected sequence once. Submission requires `observe`, `collect` and `checked-land` together, so a `finish-current` restricted to submission refuses before launch, and a run without submission authority can only prepare. A pause reports the actual blocked phase. After a claim, a refused control or validation handoff or an observer failure cancels only the invocation proven by the captured return and original claim. `cancel` bypasses the sequencing lock, and `cancel` and terminal `collect` stay available under stopped controls; cancelling after a canonical terminal receipt adds no retrospective stop marker. A deferred collection (`nextPhase: collect`) writes neither a failed result nor a stop marker. A failed, stopped or resource-failed invocation can neither complete nor resubmit. Every control, cancellation, deferral and recovery rule, verbatim: [control and cancellation](../orchestration-reference/gate-operator-internals.md#control-and-cancellation).

The driver runs these commands; root runs them by hand only for the codex transition or a recovery it has diagnosed:

```bash
export GATE_CONFIG=/absolute/ep-orch/run/gate.json
python3 -B "$MAIN/scripts/orchestration/gate-operator.py" prepare
GATE_ENTRY=$(python3 -B "$MAIN/scripts/orchestration/gate-operator.py" runtime)
# Retain this absolute attempt entry before the queue can change MAIN.
python3 -B "$GATE_ENTRY" resume
```

Use the retained `$GATE_ENTRY` for every later `resume`, `collect`, `cancel`, `complete` or repeated `run`. `runtime` returns it only after successful preparation; an initial `run` prepares and re-executes it automatically (`attempt/operator-runtime/gate-operator.py`). `run` chains a fresh authorized attempt; `resume` reuses a completed preparation and its saved invocation. A create-only claim precedes the only submission. Lost or ambiguous returns, failures, identity drift, unexpected controls and resource violations stop the chain: inspect the existing invocation instead of resubmitting it. Failures follow [Authorization and failures](decisions.md#workflow): a live gate failure, resource violation or observer safety event keeps its failed receipts and needs diagnosis before a fresh attempt; partial launched attempts remain historical. Full entry and chaining contract: [runtime entry](../orchestration-reference/gate-operator-internals.md#runtime-entry-chaining-and-failures).

Collection references the canonical receipts, logs and original-suite JSON. A failed receipt, stopped monitor, missing resource observation, non-green original suite or incomplete checked landing cannot finalize; LOAD/NEW verdicts never authorize landing. Host, storage and Docker guards, caps, admission and locks stay binding. A new runtime or script version needs qualification before live use. Run the runner/receipt/transition fixtures with `pnpm -s test:workflow`; shell queue, prep and pair tests are separate checks. Full collection contract: [submission and collection](../orchestration-reference/gate-operator-internals.md#submission-and-collection).

## Remote heavy checks

A verified Boat run of typecheck, lint and the full suite for the exact candidate tree may count for the landing gate (owner 2026-10-30). Boat publishes `$EP_ORCH/remote-checks/<runId>/` with `manifest.json` last and the directory read-only; the orchestrator names the manifest in `gate.json` as `remoteChecks: {path, sha256, mode}`. A remote skip counts only for a test on the pinned host-audit list, `scripts/orchestration/host-audits.json`, whose sha256 the manifest binds (owner 2026-11-02): those tests need sources only the gate host has. `replace` skips the local typecheck, lint and suite and runs the listed tests on the gate host (`host-audits.sh`), which must all pass; `compare` runs them all and requires the same per-test results and totals outside the list, with every listed test passed locally. Root publishes the candidate with `gate-push.sh` as a parentless commit of its tree carrying `Gate-Reviewed`, `Gate-Base` and `Gate-Tree` trailers (owner 2026-11-02); the integration history is never pushed, the verifier binds the trailers, and ancestry is checked on the gate host. `scripts/orchestration/remote_checks.py` is the verifier; the bindings are in [gate modes](../orchestration-reference/gate-modes.md#remote-heavy-checks).

- **Stop conditions:** a refused push, a remote commit that is not the tree-only gate commit for `REVIEWED` (or the prepared squash) on `BASE`, a remote failure, a refused or stale binding (tree, base, lockfile, host-audit list, toolchain, timezone, environment, argv, completion, suite or file set), an unlisted remote skip, a listed test missing from the remote report, in `replace` a listed test not passed on the gate host or, in `compare`, any difference outside the list or a listed test not passed locally blocks landing; there is no fallback to a local or partial pass.
- **Trust:** the manifest and its files are writable local artifacts pinned by sha256 in `gate.json` and the queue argv. This detects corruption, moved directories, stale scope and unsupported pass claims; it is not cryptographic attestation against an actor rewriting every file.
- **Not supported:** pairs, more than one queue item and author validation receipts. A curation gate spec with remote checks stays refused until the gate-side slice lands; the prep side (`cur-prep.sh --remote-suite`) is in [validation evidence](#validation-evidence). The gate unit keeps its memory cap and admission in every mode.

## Mechanical-rebase proof

A rebase-only change is a mechanical check, not new reviews (owner 2026-10-31). Run `python3 -B scripts/orchestration/rebase-proof.py WT OLD_BASE ACCEPTED NEW_BASE` (full SHAs; clean WT whose `HEAD` descends from NEW_BASE; `--head SHA` reads objects only). On PASS it prints `{verdict: "PASS", ..., rebaseProof}`; put `rebaseProof: {oldBase, accepted, acceptedTree}` into `gate.json` as is, and Standards/Spec reviews bound to `(accepted, acceptedTree)` count. The gate re-proves it from Git objects at every authorization: equal per-commit deltas and messages, equal commit count and equal net delta on both bases.

- **Refusals:** any overlap between the slice and the base movement, an unmoved base, a changed commit or message, a different net delta, a missing object or no review binding `accepted`. A refusal means full independent reviews of the rebased head; there is no fallback. Every refusal and its message: [gate modes](../orchestration-reference/gate-modes.md#mechanical-rebase-proof).
- After repeated rebases, prove from the original accepted commit straight to the current head, and keep `accepted` reachable with an archive ref (for example `refs/archive/RUN/<slice>/accepted`).
- The full gate suite stays authoritative for semantic interaction, which no textual proof can see.
- **Not supported:** curation, pairs and overlap.

## Single-axis fix review

When only one axis had findings, only that axis (A) re-reviews the fix; the other axis's (B) LAND stands unless the fix touches behaviour it judged (owner 2026-10-31). `gate.json` carries `carriedReview: {axis, commit, tree, attestation: {path, sha256}}`: B's review at the earlier commit E = `commit`, together with A's fix review at the head H.

- A's report must contain the literal `E..H` with full SHAs, and E must lie strictly inside the linear chain from the frame base to H (`gate_core.carry_proof`).
- Root writes the attestation JSON with exactly `{version: 1, axis: B, carried: E, head: H, paths, statement, attestedBy}`. `paths` is `git diff-tree -r --no-renames --name-only -z E H`, sorted (as `carry_proof` returns it); `statement` is root's judgement that the delta stays within A's findings and touches no behaviour B judged.
- **Composition:** fix first, rebase last. Fix-then-rebase composes with `rebaseProof`; rebase-then-fix refuses, and B then gets an ordinary delta review.
- **Refusals** (each with its own message, no fallback): a malformed field, a curation kind, E outside the chain, a report without the full-SHA delta, an attestation mismatch, or B not bound to `(E, tree)`. The full list: [gate modes](../orchestration-reference/gate-modes.md#single-axis-fix-review).
- **Not supported:** curation, pairs and rebase-then-fix. A fix broader than the findings goes to both axes.

## Light landing lane

A candidate whose every changed path lies outside everything the full queue reads skips the full gate (owner 2026-11-01, bounded risk: a dependency the lane missed fails the next full gate, which always follows on a tree that includes the change). `gate.json` carries `lane: {mode: "light", rule: "light-lane-v1", paths}`, pasted from `python3 -B scripts/orchestration/light_lane.py check ROOT BASE COMMIT`. It skips codegen, the pin, typecheck, lint, the full suite and the E2E preflight; identity, review binding (with `rebaseProof` and `carriedReview` unchanged), the exact-tree squash, the bounded unit, rebase, `pnpm install --offline`, the writer check, `check:artifacts`, checked `land.sh`, collect and complete still run.

- **Rule** (`light_lane.py`, from Git objects only): only added or modified mode-100644 files, all on the allowlist (`AGENTS.md`, `CLAUDE.md`, `docs/standards.md`, `.claude/settings.json`, `.gitignore`; `*.md` under `docs/agents/`, `docs/product/` and `.agents/skills/`; `.claude/agents/<name>.md`); no non-Markdown reference to a changed path outside the reviewed `REFERENCES` table; unchanged pinned readers; `.gitignore` only gains blank lines, comments or literal `.claude/` paths.
- **Light checks:** each changed `.json` parses strictly, and each relative link on an added line of a changed `.md` resolves in the commit (`http:`, `https:`, `mailto:`, `#`, absolute, `$` and `<` targets skipped). A light-check failure (exit 2) is a fix round.
- **Refusal** (exit 1): the full gate now; the operator writes a config without `lane`. A `reader pin changed` refusal or a new census hit means the same. Updating the rule (pins, allowlist or `REFERENCES`) is its own reviewed workflow slice.
- **Read lock:** every full gate that runs its suite locally through `triage-failures.sh` runs it under `lane-lock.sh`, which makes every tracked lane-eligible file except `.gitignore` unreadable to the suite. `.gitignore` is never locked and stays readable (git must read it); R5 bounds its changes instead. A `remoteChecks` gate in `replace` mode runs no local suite, so the lock does not apply to it. If the lock process dies before restoring (a `lane-lock-<report>.json.active` record beside the triage report), recover as [gate modes](../orchestration-reference/gate-modes.md#light-landing-lane) describes before any fresh attempt.
- **Not supported:** curation, pairs, `remoteChecks` and more than one item; `README.md`, `GLOSSARY.md` and non-Markdown files under `.agents/skills/`.
- Full rule, stop messages, why each skipped stage is safe and what is not guaranteed: [gate modes](../orchestration-reference/gate-modes.md#light-landing-lane).

## Reports and timing

Keep one short report linking canonical evidence. Separate implementation, independent review, validation, orchestration/wait time and outcomes. Use observed start/end/elapsed times; mark unavailable values as unavailable. Preserve original failures and their receipts; later summaries reference them. Artifact budgets and the pre-review artifact check in [generated artifacts](../generated-artifacts.md) apply.

## Gate memory

The gate unit's `MemoryMax` (`$EP_ORCH/bounded.sh`, kind `gate`, no MemoryHigh) depends on the gate mode, and a gate launches only with its cap plus the 6 GiB in-run host floor available (below the floor for 5 s stops the gate):

| Gate (`gate.json`) | Cap | Launch guard | Root's pre-check |
|---|---|---|---|
| local (no `remoteChecks`, light lane included) or `remoteChecks.mode` `compare`: the local full suite runs | **15 GiB** | **21 GiB** | 21.5 GiB ×3 |
| `remoteChecks.mode` `replace`: no local typecheck, lint or suite | **10 GiB** | **16 GiB** | 16.5 GiB ×3 |

- **One source:** `gate_monitor.py` `GATE_MEMORY_MAX_BYTES` holds the per-mode caps. For the gate's mode it sets the launch guard, the unit's real-memory stop and the expected unit `MemoryMax`.
- **Launch:** the operator passes the cap to `bounded.sh` as `BOUNDED_GATE_MEMORY_MAX`, which accepts only `15G` or `10G` (unset means `15G`; any other value, or the variable for another kind, is refused). An ambient `BOUNDED_GATE_MEMORY_MAX` is an injected override.
- **Mismatch:** a unit whose `MemoryMax` is not its mode's cap stops the gate as a cap mismatch.
- **Slice stop:** the slice-wide real-memory stop stays at 15 GiB in every mode.
- **Workers and admission:** 3-worker gates no longer fit; `gate-2` admission is unchanged.
- **Replace evidence:** a replace gate's whole local sequence, in queue order with the real e2e preflight, peaked at 6.55 GiB kernel (6.59 GiB with reclaimed cache added back) and 5.16 GiB real. Each Node process it runs without a heap flag used at most 93 MiB of the 2,096 MiB default heap that Node picks below 15G. A cold-cache proxy (installs that copy instead of hardlinking) reached at most 8.13 GiB (`$EP_ORCH/mvp-20261023/replace-gate-cap-measurements.md`). Root qualifies the 10 GiB cap on the first replace gate. Evidence, monitor provenance and the monitor's qualification authority with its limits: [qualification](../orchestration-reference/qualification.md#monitor-qualification-authority).
