# 09: Add the Nightly Compatibility Matrix

**What to build:** Extend the stable mandatory suite with a risk-based nightly browser and viewport matrix that protects the primary tablet experience and representative secondary layouts without multiplying every journey across every project.

**Blocked by:** 05: Land the Existing-Militia Journey; 06: Land the Character and Officer Ledger Journey; 07: Land the Complete-Week Journey; 08: Land the Current Realtime Action Slot Journey.

**Status:** ready-for-agent

- [ ] Chromium tablet at 1194x834 runs all mandatory journeys and every accepted nightly journey.
- [ ] WebKit tablet at 1194x834 runs all five critical journeys.
- [ ] Firefox desktop at 1440x900 runs organization access, existing-militia initialization, and complete-week resolution.
- [ ] Chromium phone at 390x844 runs focused navigation, form-layout, reload-persistence, and cross-layout state checks rather than the full multiplayer suite.
- [ ] Nightly recovery and secondary-flow scenarios cover only behavior present when implemented and do not introduce placeholders for absent claim or GM capabilities.
- [ ] The nightly projects use the same isolation, reset, retry, artifact, secret, and no-skip policies as the mandatory gate.
- [ ] Reports identify the browser project, journey, observing player when relevant, expected domain state, and last visible state.
- [ ] The same recurring failure creates or updates one deduplicated issue after two consecutive failures or at least two failures in twenty runs.
- [ ] Nightly failures remain actionable without retroactively blocking unrelated merges.
