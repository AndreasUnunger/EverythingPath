# Weekly Draft acceptance review (#88)

Status: **not ready for cutover**. The user confirmed that full-corpus human
review has not happened and requested this review report. A passing automated
suite does not supply that approval or resolve the catalog's remaining cases.

## Review materials

- [Complete source and behavior review report](weekly-draft-acceptance-review.md):
  every registered source section and fingerprint, all 489 expanded cases,
  expected outcomes, named tests, service evidence, and remaining gaps.
- [Rules corpus](ai/ironfang-militia/militia-rules.md) and
  [numeric tables](ai/ironfang-militia/militia-tables.md).
- [Accepted specification](../tests/rules/decision-57.md),
  [rules policies](../tests/rules/decision-56.md),
  [implementation sequence](../tests/rules/decision-55.md), and
  [test architecture](../tests/rules/decision-53.md).
- [Machine-readable catalog](../tests/rules/coverage-catalog.ts) and
  [original 95-entry audit](../tests/rules/audit-inventory.json).

The catalog contains 96 groups: the 95 audit entries plus the verification gate.
It is a starting inventory, not a claim that all rules behavior has been discovered.

## Human review requested

Review all 24 actions, all 24 event outcomes, four team trees, officers and
managers, weekly sequence, and product/persistence contracts. Follow each source
section to its cases and named tests. Check that the assertions establish the
stated behavior and relevant permutations; a test ID or passing fingerprint is
insufficient. Add cases for omissions rather than treating the original audit as
a ceiling. Classify introductory sections explicitly rather than silently
dropping their review gaps.

Record the reviewer, review date, source fingerprint, review reference and findings.
Keep human sign-off pending until that review is complete. Separately reconcile
or implement each remaining behavioral case and rerun verification. Approval of
the corpus does not authorize a production cutover.

## Remaining acceptance work

The current inventory retains 268 case gaps, including 99 cases without mapped
executable evidence, plus five source-section review gaps and the human review.
Some case gaps describe missing integration evidence after earlier pure tests;
others lack mapped tests entirely. These are unverified requirements, not 268
proven application defects. They cannot be cleared in bulk based on the global
test count.

| Area | Explicit case gaps |
|---|---:|
| Foundations | 114 |
| Officers and managers | 21 |
| Upkeep | 24 |
| Teams | 29 |
| Actions | 54 |
| Event outcomes and selection | 20 |
| Persistent decisions | 1 |
| Full resolution/state differences | 2 |
| Complete browser/Convex fixture parity | 1 |
| Paused cutover and recovery rehearsal | 2 |

The new service mappings cover shared editing, retry/ordering, authority,
Confirmation, and history. They require the real mandatory E2E results in
addition to local tests. The complete all-action/all-event preview-to-committed
state matrix remains open; the strengthened Confirmation assertions establish
full-state equality for the exercised scenarios only. The cutover/recovery cases
remain open without activating canonical behavior for live campaigns.

## Reproduce

Run the existing [isolated browser harness](../e2e/README.md) using the dedicated
resource declaration and credentials. It recreates only its declared preview.
Then use its newly printed safe report path:

```bash
pnpm -s acceptance:check --browser-report /absolute/path/to/report.json
```

This runs typecheck, lint, build-boundary checks, the full test suite and strict
catalog verification. It writes `coverage/acceptance.json`,
`coverage/rules-evidence.json`, `coverage/rules-tests.json` and
`coverage/rules-report.md`. It exits nonzero until every required gate passes.
Missing reports, stale source, failed/skipped/todo tests, and retry-only browser
passes cannot establish readiness. The strict failure caused by unresolved
catalog gaps is distinct from a failing behavior test.

The source fingerprint covers working source, tests, CSS/assets, configuration,
dependency files, normative rules and decision snapshots. Explanatory documents
under `docs/` are excluded so this report can be committed after verification.
Ignored credentials and private browser state are excluded. No issue is closed
by generating or committing these reports.

## Verification record

Verification completed on 2026-09-19 against application/test source `a23e9eb`.
Source fingerprint:
`c75dd8a46a3bd775eedd4f8d15972e45d8207bf600e72ff37572d713f8b8d740`.
The source remained unchanged throughout the final checks.

| Check | Result |
|---|---|
| `pnpm -s typecheck` | Passed |
| `pnpm -s lint` | Passed |
| `pnpm -s test:build` | All 3 checks passed |
| Full Vitest collection | 936 tests across 100 files passed |
| Mandatory isolated E2E `everythingpath-e2e-QQy6Pp` | All 9 required results passed on their first attempts; zero report errors; runner exit 0 |
| Strict rules completeness | **Failed: 274 explicit gaps**; 390 cases have passing mapped evidence |
| Human full-corpus review | **Pending** |

The only strict catalog error is `Completeness gate: 274 remaining gaps`.
There are no stale source fingerprints, broken named-test references or failed
mapped test results in this run. Matching service evidence is present. A case
can have passing partial evidence and still retain an explicit completeness gap.

The passing E2E run proves the six browser journeys plus authentication and the
separate deployed editing and Confirmation contracts. It includes the new full
snapshot/source/baseline/final-plan/successor equality assertions. This is
scenario evidence, not proof of all rules permutations. The successful runner
removed its temporary workspace and preview lock; both absences were verified.

Safe browser artifacts are retained locally at
`e2e-artifacts/e2e-local-andreasununger-slot-0/everythingpath-e2e-QQy6Pp/`.
The local machine-readable acceptance result is `coverage/acceptance.json`;
its status is `not-ready`. The committed complete report is the human-review
snapshot generated from that run.

Separate Standards and Spec reviews covered `95107b5...a23e9eb`. Both identified
the initial omission of CSS/assets from the source fingerprint. A filesystem
regression reproduced it, the fingerprint was corrected, and both reviewers
accepted the fix with zero remaining implementation findings. Both reviews keep
human sign-off and behavioral coverage/parity gaps as acceptance blockers.

No production deployment, campaign cutover, issue closure or branch push was
performed. **Issue #88 is not complete.**

The first run, `everythingpath-e2e-3p7KLs`, is **unsuccessful**. Authentication,
the canonical Workspace journey and four supported journeys passed; organization
access failed because the outsider's restored browser had no authenticated
session. The deployed persistence contract then timed out waiting for that
session, and the run reached its overall deadline without a complete final report.
Its `progress.json` and screenshots retain this failure and cannot establish
readiness.

Five fresh browser contexts reproduced the failure using that run's original
outsider state. The original session remained active according to Clerk, and its
cookies were not expired, but the browser's Clerk client contained no sessions.
A newly authenticated outsider state passed six restore checks immediately and
three more after the short-lived session token expired. This isolates the symptom
to the saved authentication state; it does not establish why that initial state
became unusable. No assertions, retry rules, timeouts or application authentication
were weakened. Temporary diagnostic scripts and private state were removed.

The harness uses real saved browser state, consistent with
[Clerk's authenticated-flow guidance](https://clerk.com/docs/guides/development/testing/playwright/test-authenticated-flows).
A fresh full run is required for any service acceptance evidence.

The interrupted first run also left its temporary directory and preview lock.
A subsequent invocation refused the lock before deployment. After verifying
that no process remained in the owned temporary workspace, both abandoned paths
were removed. This cleanup limitation is retained as a finding rather than
described as successful automatic teardown.
