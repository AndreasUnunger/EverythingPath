# 04: Land the Mandatory Access Journey

**What to build:** Protect organization-scoped campaign access with the first complete Chromium tablet journey and make its aggregate result a mandatory pull-request and merge-queue check, including fail-closed result evaluation and actionable failure evidence.

**Blocked by:** 02: Build the Safe Playwright and Fixture Harness; 03: Provision the Non-Production E2E Resources.

**Status:** ready-for-agent

- [ ] An authenticated member of the fixture organization can open its campaign through the production UI.
- [ ] An authenticated outsider cannot access that campaign or its militia data, with the denial observable through player-facing behavior.
- [ ] The case resets and owns its fixture independently and passes against a freshly recreated preview and fresh auth states.
- [ ] One stable aggregate required check fails for failed, flaky, cancelled, neutral, skipped, focused, quarantined, timed-out, or missing required results.
- [ ] A CI-only diagnostic retry remains red when it passes; required results do not use continue-on-error.
- [ ] A forced failure produces a safe console summary, HTML report, first-retry trace, screenshots, and useful sanitized logs.
- [ ] E2E execution stops after twelve minutes and the workflow after fifteen, leaving time to finalize and upload evidence.
- [ ] The aggregate check is required immediately after this journey reaches the main branch.
