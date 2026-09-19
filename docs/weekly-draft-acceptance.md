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

## Gap reconciliation

The follow-up reviewed the old gaps against executable evidence, added missing
permutations, and corrected three related Notoriety defects: Activity gains and
reactive Sabotage now bound the rules baseline to 0–100, and Covert Action fully
suppresses the covered gain even at the cap or from an explicitly unusual source.
Typed Table Adjustments still apply afterward. Canonical ruleset version is 3.

The shared browser/Convex matrix exercises 131 ready weeks: all 60 rank/focus
combinations, two substantive officer/boon scenarios, 18 team/action/recovery
scenarios, 50 event scenarios, and one compound week. It compares all five Phase
Views and complete previews, races actual authenticated Confirmation mutations,
and checks full snapshot, immutable record, baseline, final plan, retained reasons,
and successor context. The compound expected state is independently authored and
also runs against the deployed isolated Convex service. Full rule permutations
remain in pure tests, as #57 requires; the matrix does not claim every possible
combination of rules has been tested.

Five case gaps remain, with specific dispositions:

| Case | Remaining work |
|---|---|
| F04.context | The corpus mentions ally/event action allowances without numeric definitions. Human review must decide whether reasoned capacity exceptions suffice or specify additional modeled allowances. |
| O06.changes | Current manager reassignment recomputes team checks, but ordered reassignment between actions is not represented. Human review must settle this timing requirement. |
| E06.preserve | Rehearse queued-effect preservation during the paused cutover in #89. |
| P11.cutover | Rehearse pause, initialization/restart and recovery in #89. |
| P11.legacy | Implement/rehearse rejection of old writes and recovery before reopening in #89. |

Five introductory source-section classifications and complete human corpus review
also remain pending. These cannot be signed off by an automated reviewer. The
strict gate therefore remains **not ready** even when all executable checks pass.
The operational production cutover is separately tracked by #90.

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

Verification completed on 2026-09-19. Matching source fingerprint:
`266846091b3e7e140074e1940a09852bbed29d442b2f165531ec673d1a90c072`.
The source remained unchanged throughout the final checks.

| Check | Result |
|---|---|
| `pnpm -s typecheck` | Passed |
| Convex-specific `tsc --noEmit --project convex/tsconfig.json` | Passed |
| `pnpm -s lint` | Passed |
| `pnpm -s test:build` | All 3 checks passed |
| Full Vitest suite | 977 tests across 105 files passed |
| Mandatory isolated E2E `everythingpath-e2e-IypBJD` | All 9 required results passed on their first attempts; zero report errors; runner exit 0 |
| Strict rules completeness | **Not ready: 11 explicit gaps**, down from 274; 488 of 489 cases have passing mapped evidence |
| Human full-corpus review | **Pending** |

The only strict error is `Completeness gate: 11 remaining gaps`. No mapped test
is missing, failed, skipped or ambiguous; source fingerprints and the mandatory
service evidence match. Passing partial evidence can coexist with a specific gap.
The sole case without executable evidence is P11.legacy, the future cutover gate.

The successful E2E runner removed its temporary workspace and preview lock;
both absences were verified. Safe local evidence is under
`e2e-artifacts/e2e-local-andreasununger-slot-0/everythingpath-e2e-IypBJD/`.
Machine-readable results are `coverage/acceptance.json`, `coverage/rules-evidence.json`
and `coverage/rules-tests.json`. The committed full report is regenerated from
this run. Human review and the cutover work remain outstanding; **#88 is not complete**.

Independent automated reviews of the follow-up since `e62de89` concluded:

- **Standards:** no outstanding actionable findings, including the Convex alias fix.
- **Spec:** found missing joint Pain/Serenity coverage; the added next-week modifier,
  loss/gain and expiry test resolves it. No outstanding actionable findings.

These agent reviews do not constitute human corpus review. No production deployment,
operational cutover, issue closure or branch push was performed.

The previous successful automated baseline was `everythingpath-e2e-QQy6Pp`
(936 tests, 274 gaps). Its evidence is superseded by the verified follow-up above. An earlier failed run, `everythingpath-e2e-3p7KLs`, lost the outsider's
restored authentication session and timed out; fresh sign-in restored the session,
but the original cause was not established. That failed run left a workspace/lock
which were removed only after confirming no owned processes remained. Assertions,
retry rules and deadlines were not relaxed. This historical operational limitation
is not represented as passing evidence.

This follow-up's first two runs (`J1VQbb`, `rwybqe`) stopped at Convex's deployment
typecheck after a successful web build. The new parity test imported browser Phase
Views using the application's path aliases; Convex's separate TypeScript config
lacked those aliases. Adding the same alias targets corrected the failure, and
`pnpm -s exec tsc --noEmit --project convex/tsconfig.json` passed. Those incomplete
runs do not count as browser evidence. The temporary private diagnostic capture
was removed after diagnosis.
