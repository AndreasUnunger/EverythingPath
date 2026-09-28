**Upkeep is complete.** Every implementation ticket is closed: #154, #155, #156, #157, #158. 

**Delivered**
- Rules-ordered Upkeep: dice totals, team conditions, rank boons, and characterless transfers under Ruleset Version 6.
- **Final-review gaps closed:** settlement, feat, missing-team and Remove-repair content checked at phone and desktop (`workspaceUpkeepLayout`), overflowing long links fixed (`1da1fba`), both transfer forms in the persistence contract, and the Treasury pointer in `militia-rules.md`.

**Verification** (`implement/148-ui-rework`):
- Typecheck, lint and the full unit suite pass. The last full run was 2,219 tests, with `rules:check` at 0 errors.
- **Browser gate:** the full isolated-preview nightly gate (parallel, 3 cohorts, isolation check clean) passed every journey for this area in `everythingpath-e2e-SK580N` at `0573d0b`. That run passed 41/42 overall; the single failure is an intermittent #141 focus issue, being fixed separately.
- **Final completion reviews:** `.scratch/final-area-review-A.md` / `-B.md` and `final-148-gate-review.md`. The gaps they raised for this area are closed; see below.
- **Capability accounting:** `docs/ui-capability-inventory.md` records every capability this area owns exactly once, with its shipped location and coverage (`9a6222f`, `4d51031`). The legacy-compatibility paths it keeps are listed in `docs/legacy-compatibility-inventory.md`.

The code is committed on `implement/148-ui-rework`. It will be pushed and a PR opened to `main` once the last area is green.

**Tracked follow-ups (not blocking):** removing the dice-array, transfer-actor and Upkeep-Remove legacy paths (legacy inventory).
