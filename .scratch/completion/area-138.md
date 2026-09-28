**Setup is complete.** Every implementation ticket is closed: #172, #173, #195. #174 was merged into #173.

**Delivered**
- Guided nine-step Setup on shared section editors: browser resume, inline Add character (using #182's dialog), and a safe start race.
- **Final-review gaps closed:** Next and the sticky footer are reachable on phone, a 1440×900 pass was added, and the tablet footer now really sticks (`267881b`, spec §3).

**Verification** (`implement/148-ui-rework`):
- Typecheck, lint and the full unit suite pass. The last full run was 2,219 tests, with `rules:check` at 0 errors.
- **Browser gate:** the full isolated-preview nightly gate (parallel, 3 cohorts, isolation check clean) passed every journey for this area in `everythingpath-e2e-SK580N` at `0573d0b`. That run passed 41/42 overall; the single failure is an intermittent #141 focus issue, being fixed separately.
- **Final completion reviews:** `.scratch/final-area-review-A.md` / `-B.md` and `final-148-gate-review.md`. The gaps they raised for this area are closed; see below.
- **Capability accounting:** `docs/ui-capability-inventory.md` records every capability this area owns exactly once, with its shipped location and coverage (`9a6222f`, `4d51031`). The legacy-compatibility paths it keeps are listed in `docs/legacy-compatibility-inventory.md`.

The code is committed on `implement/148-ui-rework`. It will be pushed and a PR opened to `main` once the last area is green.

**Tracked follow-ups (not blocking):** the Setup controls that are below phone touch size; removing the envelope v1 migration once it's safe (legacy inventory).
