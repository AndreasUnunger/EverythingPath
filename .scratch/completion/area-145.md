**Review & confirm is complete.** Every implementation ticket is closed: #169, #170, #171, #194. 

**Delivered**
- The six-section review (live and frozen adapters), Table Adjustments and exception reasons with the Confirm guard, Go links, and exact Confirmation. The stale alert stays until "Review updated week".
- **Final-review gaps closed:** browser checks of Warnings (SUM-09) and inline outcomes (SUM-11), landscape and 1180×820 passes with the panel open and closed, positioned content kept inside the column (`fb183d8`), and a phase-shaped skeleton.

**Verification** (`implement/148-ui-rework`):
- Typecheck, lint and the full unit suite pass. The last full run was 2,219 tests, with `rules:check` at 0 errors.
- **Browser gate:** the full isolated-preview nightly gate (parallel, 3 cohorts, isolation check clean) passed every journey for this area in `everythingpath-e2e-SK580N` at `0573d0b`. That run passed 41/42 overall; the single failure is an intermittent #141 focus issue, being fixed separately.
- **Final completion reviews:** `.scratch/final-area-review-A.md` / `-B.md` and `final-148-gate-review.md`. The gaps they raised for this area are closed; see below.
- **Capability accounting:** `docs/ui-capability-inventory.md` records every capability this area owns exactly once, with its shipped location and coverage (`9a6222f`, `4d51031`). The legacy-compatibility paths it keeps are listed in `docs/legacy-compatibility-inventory.md`.

The code is committed on `implement/148-ui-rework`. It will be pushed and a PR opened to `main` once the last area is green.

**Tracked follow-ups (not blocking):** none specific to this area.
