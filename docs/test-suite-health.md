# Test suite health

This change reduces fixture and DOM-query work in two slow tests while preserving their public behavior checks. Production code, UI presentation, Vitest configuration and timeout settings are unchanged. Local tests retain the 5,000 ms timeout; the existing CI setting remains 15,000 ms.

## Measurement

Measurements were collected on 2026-10-03. Each target was run alone three times before and after editing. The numbers below are the target assertion's `duration` from Vitest JSON, in milliseconds. They measure the test body, not transform, import, environment startup or total process duration. Reports and diagnostic logs are in `/tmp/ep-testhealth-evidence` for this implementation session.

| Target                              |  Before 1 |  Before 2 |  Before 3 | Before median | After 1 | After 2 | After 3 | After median |
| ----------------------------------- | --------: | --------: | --------: | ------------: | ------: | ------: | ------: | -----------: |
| Character level growth before Setup | 2,167.341 | 2,258.868 | 2,179.768 |     2,179.768 | 349.679 | 341.776 | 352.008 |      349.679 |
| New Table Adjustment Cancel         |   290.978 |   287.918 |   290.491 |       290.491 | 234.570 | 228.640 | 229.410 |      229.410 |

Median test-body duration fell **83.96%** for Character level growth and **21.03%** for Table Adjustment Cancel. All six before and six after measurements passed. These percentages compare the named targets; the new focused boundary test adds separate coverage and cost, reported below, and no before-suite benchmark was collected.

The source reports are `character-before-{1,2,3}.json`, `character-after-{1,2,3}.json`, `summary-before-{1,2,3}.json` and `summary-after-{1,2,3}.json`; `timings.json` preserves their unrounded assertion durations.

## Character fixture

`convex/characterMilitiaSheet.integration.test.ts` previously inserted 4,093 Class Level rows directly into the test database. Together with the original Class Level, base entry and personal adjustment, this produced a 4,096-entry sheet solely to reject one additional level. That setup also made reads calculate thousands of rows.

The existing test now creates a realistic level-one Character and a Charisma personal adjustment through public mutations, grows to level two and reads the sheet through `api.characterSheet.read`. It checks the calculated level and Charisma, the four resulting entries, and retention of the same personal adjustment. It then requests level 4,095 while also changing the name. The real production cap remains 4,096: 4,095 Class Levels plus base scores and the personal adjustment would need 4,097 entries. Rejection is checked against the complete preceding public read, covering unchanged name, revision, entries and calculated statistics without inserting thousands of rows.

`convex/characterMilitiaSheetLimit.integration.test.ts` separately proves the exact boundary with a file-scoped partial mock. `vi.mock` uses `importOriginal` and overrides only `maxCharacterChildRows` to eight; all mutations, validation, calculations and reads retain their real implementations. Six Class Levels plus base scores and the personal adjustment reach eight entries and are accepted. A seventh Class Level would require nine entries and is rejected atomically, again checked by complete public-read equality.

The partial mock changes the cap consumed by importing mutation helpers. `readCharacterSheetData` retains its original lexical 4,096-entry loader limit; this focused test proves mutation growth behavior rather than claiming a scaled loader-limit test. The existing integration file is unmocked and retains its real-cap rejection. No production configuration, helper interface or Convex function module was added.

## Table Adjustment Cancel

Profiling the original `[rules.P85.adjustment-new-cancel]` test identified jsdom style work in accessibility queries as the main cost. One run made 143 real `getComputedStyle` calls taking 211.34 ms, about 72% of its 292 ms test duration. Rendering took 22.98 ms; registration and dismissal waits together took 4.92 ms. A follow-up profile observed one registration attempt, two validation attempts and one dismissal attempt. Those measurements support reducing the rendered/query surface rather than changing polling or timeout settings. Temporary instrumentation was removed.

Only this test now renders the existing exported `AddAdjustment` form instead of the entire `SummaryView`. It still uses the real form fields, adjustment hook, react-hook-form, Zod validation and the existing in-memory form guard. It verifies registration, preservation of malformed `1.005` input, visible validation, dismissal, guard release, no writes before or after Cancel, and focus returning to the same choice card. Role and accessible-name queries remain in use, and real style calculation is not mocked.

Integration coverage remains in `summary-confirm-guard.test.tsx`: `[rules.P85.local-confirm-guard]` renders the real board/store and exercises the new adjustment through `SummaryView`, checking that open or invalid input disables Confirm, Save releases it, and another device's adjustment survives. `[rules.P85.adjustment-return]` in `summary-adjustments.test.tsx` still verifies retained input and guard propagation when returning to `SummaryView`. The narrower Cancel test does not replace these integration checks.

## Reproduction and validation

Run from the repository root. The shared lock serializes heavy checks so unrelated runs do not distort measurements. For each target, repeat with `run` set to `1`, `2` and `3`, retaining separate before/after reports. Use the original tests for the before measurements; use the updated tests and replace `before` with `after` in the output filenames for after measurements:

```bash
run=1
flock /tmp/ep-orch/heavy.lock pnpm test convex/characterMilitiaSheet.integration.test.ts \
  -t 'level growth respects existing personal adjustments before Setup' \
  --reporter=json --outputFile="/tmp/ep-testhealth-evidence/character-before-${run}.json"
flock /tmp/ep-orch/heavy.lock pnpm test src/components/weekly-draft-workspace/summary-adjustments.test.tsx \
  -t adjustment-new-cancel \
  --reporter=json --outputFile="/tmp/ep-testhealth-evidence/summary-before-${run}.json"

flock /tmp/ep-orch/heavy.lock pnpm test \
  convex/characterMilitiaSheetLimit.integration.test.ts \
  convex/characterMilitiaSheet.integration.test.ts
flock /tmp/ep-orch/heavy.lock pnpm -s typecheck
flock /tmp/ep-orch/heavy.lock pnpm -s lint
```

The sandbox-compatible suite run excludes 22 `e2e/support/*.test.ts` files per the shared brief, because socket-based support tests fail in the sandbox. Some files in that directory are pure tests; the exclusion covers the directory as a whole. The run uses four workers with verbose and JSON reporters. This exclusion is supplied to the command; no test discovery configuration or test file is disabled:

```bash
flock /tmp/ep-orch/heavy.lock pnpm test --exclude 'e2e/support/**' \
  --maxWorkers=4 --reporter=verbose --reporter=json \
  --outputFile.json=/tmp/ep-testhealth-evidence/suite.json \
  > /tmp/ep-testhealth-evidence/suite.log 2>&1
```

| Check                                                      | Result                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| Both character integration files together                  | Passed: 50 tests in two files; session log `character-focused-agent.log` |
| Three after measurements per target                        | Passed: all six runs, exit 0                                             |
| Sandbox-compatible suite with four workers                 | Passed: 290 files, 3,210 tests; 115.93 s wall duration                   |
| Typecheck                                                  | Passed: exit 0                                                           |
| Lint, including unused-code checks                         | Passed: exit 0                                                           |
| Prettier for the four changed files and `git diff --check` | Passed                                                                   |
| Slowest remaining tests                                    | Ranked below from final suite JSON                                       |

The suite's target body durations were 144.173 ms for the Character growth test, 95.457 ms for Table Adjustment Cancel, and 298.820 ms for the focused cap test. These are observations under the four-worker suite load, separate from the isolated before/after comparison. File and test totals come from the verbose summary; the JSON suite counter also includes nested describe groups and is not a file count.

## Slowest remaining tests

All ten passed. Durations are individual test bodies from `suite.json`, ranked in `slowest-tests.json`:

| Rank | Test file                                                                  | Test                                                                                                                                                              | Duration (ms) |
| ---: | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------: |
|    1 | `convex/rulesAcceptance.integration.test.ts`                               | `[rules.GATE.projection-parity]` shared canonical fixtures retain every Phase View and full committed outcome through browser and authenticated Convex boundaries |     7,056.265 |
|    2 | `src/components/militia-setup/guided.test.tsx`                             | `[setup.carry-form]` character conditions and scoped expiring benefits can be carried into ordinary play                                                          |     2,733.368 |
|    3 | `tests/catalog/curation-command.test.ts`                                   | Writes itemised preview failures before exiting nonzero, then drafts, resumes and previews working records                                                        |     1,573.276 |
|    4 | `tests/catalog/release-operator.test.ts`                                   | The CLI builds a deterministic gated artifact and prepares/inspects it through the injected remote command adapter                                                |     1,562.137 |
|    5 | `src/components/militia-setup/guided.test.tsx`                             | `[setup.receipt-decimal]` enchantment delivery preserves decimal input and explicit receipt days                                                                  |     1,554.960 |
|    6 | `src/components/militia-setup/guided.test.tsx`                             | `[setup.guided.navigation]` steps navigate freely with invalid input, keep every entry and never submit                                                           |     1,501.189 |
|    7 | `src/components/historical-week/screen.test.tsx`                           | A deep link outside the newest window loads only the window ending at that week and keeps the latest row at the bottom                                            |     1,264.377 |
|    8 | `src/components/character-sheet/character-sheet-page.test.tsx`             | A minimal sheet offers Build out once; a visit never runs it, a click runs it once, and the full response takes it away                                           |     1,259.065 |
|    9 | `src/components/weekly-draft-workspace/nested-roll-compatibility.test.tsx` | `[rules.EVT-11.invalid-shift]` removing an earlier entry keeps a later entry's malformed text blocking the save until it is fixed                                 |     1,222.646 |
|   10 | `src/components/weekly-draft-workspace/event-recurring-inputs.test.tsx`    | `[EVT-10.rivalry-officer-view]` Rivalry Twice: Attempt it shows the officer check, which is stored once character and skill are known                             |     1,220.682 |

The projection-parity acceptance test already has an explicit 60,000 ms timeout, unchanged by this work. Its 7,056.265 ms duration exceeds the local default but does not indicate a timeout regression in either optimized test. The remaining nine are below the unchanged 5,000 ms default in this run.

There are no UI presentation changes, new Convex function modules, schema changes or migration implications. No deploy or codegen is required for these test changes. The sandbox suite result does not certify the excluded support tests or browser end-to-end tests.
