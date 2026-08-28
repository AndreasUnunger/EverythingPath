# Choose the Browser, Viewport, and Schedule Matrix

Type: grilling
Status: resolved
Blocked by: 01, 04

## Question

Which journeys run in the pull-request Chromium gate and which browser/viewport combinations run nightly, given tablet landscape as the primary product target and desktop and phone as secondary layouts? Set explicit runtime budgets, parallelism expectations, and the conditions that should block a merge.

## Answer

Run all five critical journeys from **Define the Critical Regression Journeys** in the pull-request gate using Chromium at 1194×834, with tablet touch behavior enabled. This is the canonical gate viewport: it represents an 11-inch iPad Pro in landscape and, importantly, exercises the application's primary tablet layout below its current 1280px `xl` breakpoint.

Use this nightly project matrix without multiplying every journey across every browser and viewport:

1. **Chromium tablet, 1194×834**: run all five critical journeys plus every nightly journey.
2. **WebKit tablet, 1194×834**: rerun all five critical journeys to protect the primary tablet experience on the engine used by iPad browsers.
3. **Firefox desktop, 1440×900**: run organization access, existing-militia initialization, and the complete-week journey.
4. **Chromium phone, 390×844**: run focused navigation, form-layout, reload-persistence, and cross-layout state checks rather than the full multiplayer suite.

Start the authenticated pull-request project with one Playwright worker because the accepted Clerk setup has only one safe identity and organization cohort. Multiple browser contexts inside a multiplayer test still represent simultaneous players. Design fixtures for worker partitioning, but enable two workers only after each worker has an independent Clerk cohort and repeated contention runs prove isolation. This qualifies the earlier two-worker runner target rather than weakening the isolation contract.

Keep pull-request wall-clock p95 at or below eight minutes so the gate has headroom beneath its ten-minute target. Investigate when p95 approaches eight minutes and introduce two-way sharding only after worker-safe cohorts exist and measurements justify it. Use a 15-minute workflow timeout to terminate hangs while preserving failure artifacts. A green run that exceeds the runtime target is an operating-policy signal, not an assertion failure by itself.

The Chromium tablet gate must pass for every trusted pull request and merge-queue entry. Any test failure, setup failure, artifact-preserving timeout, or skipped required journey blocks the merge. Code from an external fork must not receive secrets automatically; before merge it requires a trusted, secret-enabled run of the same gate against the reviewed commit. Nightly failures enter the failure and flake policy defined later, but do not retroactively block unrelated merges.
