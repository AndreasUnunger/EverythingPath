**Finished weeks is complete.** Every implementation ticket is closed: #184, #185, #197. #186 was merged into #184.

**Delivered**
- The bounded history listing, an oldest-first index with Reconstructed and Corrected markers, audit paging, and the selected record's six sections read only from that record.
- **Final-review gaps closed:** multi-week, multi-entry paging, keyboard use, the phone expanded row, and tablet and desktop panes (`finished-weeks.ts`, with the `appendHistory` fixture).

**Verification** (`implement/148-ui-rework`):
- Typecheck, lint and the full unit suite pass. The last full run was 2,219 tests, with `rules:check` at 0 errors.
- **Browser gate:** the full isolated-preview nightly gate (parallel, 3 cohorts, isolation check clean) passed every journey for this area in `everythingpath-e2e-SK580N` at `0573d0b`. That run passed 41/42 overall; the single failure is an intermittent #141 focus issue, being fixed separately.
- **Final completion reviews:** `.scratch/final-area-review-A.md` / `-B.md` and `final-148-gate-review.md`. The gaps they raised for this area are closed; see below.
- **Capability accounting:** `docs/ui-capability-inventory.md` records every capability this area owns exactly once, with its shipped location and coverage (`9a6222f`, `4d51031`). The legacy-compatibility paths it keeps are listed in `docs/legacy-compatibility-inventory.md`.

The code is committed on `implement/148-ui-rework`. It will be pushed and a PR opened to `main` once the last area is green.

**Tracked follow-ups (not blocking):** removing the older record-format readers (legacy inventory).
