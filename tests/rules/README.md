# Weekly Draft rules coverage

`coverage-catalog.ts` is the canonical executable coverage inventory for #59.
It preserves the 95 rows from all three #54 audit comments and expands compound
behavior into independently identified cases, including advancement rows and event
interval endpoints. `audit-inventory.json` retains the original baseline,
implementation evidence, remaining permutations and source comment URL. Existing
legacy tests are leads for migration, **not verified replacement coverage**.

Run `pnpm -s rules:check` to collect the full Vitest suite and write
`coverage/rules-report.md` plus `coverage/rules-tests.json`. It uses a fresh temporary
results file every run, so old passing output cannot cover a failed collection.
The GitHub workflow runs this gate and uploads both artifacts. No deployment,
credentials or live campaign writes are involved.

Run `pnpm -s rules:complete` for the final strict gate. It intentionally fails today:
replacement behavior, parity/adapter/browser suites and full-corpus human review
remain explicit gaps. Passing the extraction gate does not mean rules completeness
or cutover approval. This ticket does not extract or activate application behavior.

## Adding evidence

1. Find the case and source section. Read its audit `remainingCases` as well as the
   complete source; a compact case may need several input permutations. Accepted
   #56 policies override conflicting audit observations or ambiguous wording.
2. Add a behavior test at an agreed #53 interface. Put its stable ID in the actual
   test name, for example `test('[rules.A06.failure] failed dismissal removes the
   team and adds rolled Notoriety', ...)`. Each ID must identify exactly one
   collected assertion. For parameterized tests, use distinct IDs for individual
   rows or use a single named test that asserts the entire case matrix.
3. Copy the ID from `plannedTests` to `tests` only when it is real evidence. Multiple
   test IDs can be required by one case. Passing all referenced tests establishes
   evidence; missing, failed, skipped, pending, todo, duplicate IDs or failed suites
   do not. An explicit gap never excuses a broken mapped test.
4. Clear `gap` only after all named case permutations are covered. Partial passing
   evidence can coexist with an explicit gap and cannot pass strict completeness.
   Keep IDs stable when moving files, changing titles or adding cases; do not reuse
   or renumber an ID. Add new cases/rules for newly identified corpus behavior.
   Register new IDs in `case-inventory.json`; its independently fingerprinted list
   prevents removing a case from the catalog unnoticed. Removing or superseding
   an inventoried case requires an explicit reviewed inventory update.
5. Run the gate and review its report. Do not delete a mapping to hide a regression.
   Browser/Convex parity must use actual entry paths; the `GATE` cases remain open
   until the required infrastructure and outcome assertions exist.

## Source review and completeness

Fingerprints are SHA-256 over LF-normalized text, trimmed and followed by one
newline. A section starts at its exact Markdown heading and ends at the next
heading of any level. Source IDs are stable initial line-based identifiers, not
current line numbers. Inserting lines does not rename them. Duplicate or removed
headings are errors. Repeated names such as Treasury use `parentHeading` to
distinguish terminology from the team tree. Added headings must be registered and mapped or receive an
explicit review gap. Unmapped introductory sections are deliberately listed as
review gaps until a human classifies them; no part of the corpus is silently ignored.

Decision snapshots #53/#55/#56/#57 and the annotated audit snapshot have whole-file
fingerprints. Their URLs remain the normative upstream references. These local
snapshots make the gate deterministic; it does not poll GitHub for later decisions.
Bring accepted decision updates into the snapshots and review affected cases.

When text changes, inspect the affected outcomes and edge cases before updating
its stored fingerprint. The exported `fingerprint` function calculates a digest;
there is intentionally no blanket accept/update command. Fingerprints prove
traceability, not that the expected behavior is correct. Inventory growth beyond
#54 and semantic review of **all** rules and tables remain necessary. Record the
reviewer and review reference in `corpusReview` before clearing its gap. All source
review gaps and case gaps must also be resolved for the strict gate.

## Implementation checkpoints

Checkpoint prefixes refer to the accepted sequence in #55, preserved in
`decision-55.md`:

| Checkpoint | Required implementation outcome |
|---|---|
| 3-test-infrastructure | Browser/Convex parity fixtures and isolated two-player gate |
| 4-foundations | Rank, training, check composition, capacity and boon calculations |
| 4-officers | Officer and manager effects with ordered assignments |
| 4-teams | Team identities, trees, conditions and temporal eligibility |
| 4-upkeep | First-use metadata and ordered losses, progression, transfers |
| 4-activity | All 24 actions and their required inputs/outcomes |
| 4-events | Event trigger/table, independent occurrences and modifiers |
| 4-persistence | Persistent effects, weekly mitigation and buyoff cadence |
| 5-resolution | Complete preview/change plan, readiness and table decisions |
| 6-adapters | Shared persistence contracts, authority and exact Confirmation |
| 7-workspace | Phase Views, fixed eligibility and immediate local navigation |
| 8-cutover-rehearsal | Preservation/reset, restartability, legacy rejection and recovery |

All rule cases ultimately need Phase View/Resolution Preview evidence and applicable
Confirmation parity; the checkpoint is where their behavior is implemented, not an
exemption from later gates. Canonical contracts in step 2 prepare these facts; step 9
activation remains contingent on complete review and a separately approved cutover.
