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

Specialized curation prep receipts stay authoritative for light/full catalog preparation, affected older batches, post-rebase counts, branch/path and full-plan escalation; author receipts supplement them. A landing gate runs its complete checks and original suite independently of author-check reuse; only a verified [remote heavy-check manifest](#remote-heavy-checks) replaces its local typecheck, lint and full suite. Full validation contract: [validation evidence](../orchestration-reference/gate-operator-internals.md#validation-evidence).

## Gate operator

`scripts/orchestration/gate-operator.py` owns the single-item prepare/freeze/submit/observe/collect/complete sequence. It runs `land-queue.sh` in a bounded gate unit; the queue owns rebasing, specialized curation prep, full validation and checked `land.sh`. Pairs use the [paired procedure](paired-gates.md); unflagged queue lists stay serial.

Create one external JSON configuration with these fields:

| Field | Contract |
|---|---|
| `version`, `kind` | `1`; `code` or `curation` |
| `main`, `orch`, `worktree`, `branch`, `feature` | Canonical absolute main/shared run/app checkout paths and exact Git branches |
| `base`, `reviewed`, `tree` | Full fixed Git SHAs, linear reviewed history on the frozen integration base |
| `attempt`, `label` | New absolute external evidence directory; safe unique invocation label |
| `operator` | `{path, sha256}` for the actual T3 task metadata of the operator the role table names (enforced) |
| `author` | Separate `{path, sha256}` for the actual author task/model/options; author and operator may reference the same task when it did both jobs. Review independence is checked against the author. |
| `validation` | `{plan: {path, sha256}, receipts: {CHECK: {path, sha256}}}`: the validation plan and the original version-2 receipt for every reused check, verified at preparation, submission and final acceptance |
| `resourcePolicy` | `{path, sha256}` for the shared `resource-policy.md` |
| `storageBaseline` | `{path, sha256}` for the storage journal/counter baseline, in the existing guard format |
| `reviews` | Code: `standards` and `spec`; curation: `curation`, with all admissions reviewed |
| `phases` | Authorized subset of `prepare`, `submit`, `observe`, `collect`, `complete`, `checked-land` |
| `control` | Absolute external mutable stop control, bound to the operator task/run and reviewed/base/tree |
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
- **Not supported:** pairs, more than one queue item, remote curation prep and author validation receipts. The gate unit keeps its memory cap and admission in every mode.

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

The gate unit's `MemoryMax` is **15 GiB** (`$EP_ORCH/bounded.sh`, kind `gate`, no MemoryHigh), and a gate launches only with **21 GiB** available: the cap plus the 6 GiB in-run host floor (below it for 5 s stops the gate). One constant in `gate_monitor.py`, `GATE_MEMORY_MAX_BYTES`, sets the launch guard, the unit and slice real-memory stops and the expected unit `MemoryMax`; the wrapper must match it, or the monitor stops the gate as a cap mismatch. 3-worker gates no longer fit; `gate-2` admission is unchanged. Evidence, monitor provenance and the monitor's qualification authority with its limits: [qualification](../orchestration-reference/qualification.md#monitor-qualification-authority).
