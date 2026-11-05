# Choose the Full-Stack Browser Runner

Type: research
Status: resolved
Research branch: `research/e2e-browser-runner`
Expected asset: `docs/research/e2e-browser-runner.md`

## Question

Which browser test runner and application lifecycle best satisfy EverythingPath's Next.js 16 stack, authenticated multi-context scenarios, trace/screenshot/video evidence, parallel isolation, and a Chromium pull-request gate targeted below ten minutes? Establish the answer from official documentation and current project constraints, comparing alternatives only where they could materially change the decision.

## Answer

Choose Playwright Test. Its native multiple-browser-context model fits true player/player and GM/player scenarios, Next.js documents its production-build lifecycle, and its workers, optional sharding, traces, screenshots, videos, and GitHub reporting fit the requested CI gate. Start with Chromium and two workers, retain failure artifacts, and add two-way sharding only if measured p95 runtime approaches eight minutes. Cypress's single-controlled-browser limitation makes it materially weaker for this application's collaboration contract.

Detailed evidence is committed at `docs/research/e2e-browser-runner.md` on `research/e2e-browser-runner` (`76b7f6d6cd8f2750247f6e5e8701d1e10c113e10`).
