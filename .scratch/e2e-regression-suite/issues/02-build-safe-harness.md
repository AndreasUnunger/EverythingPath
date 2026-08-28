# 02: Build the Safe Playwright and Fixture Harness

**What to build:** Provide a deterministic Playwright harness that can start a production-style EverythingPath instance against a disposable Convex preview, authenticate two fixture roles through Clerk, give every test its own campaign graph, and fail before any write when the configured targets are unsafe.

**Blocked by:** 01: Establish the Backend-Free Build Boundary.

**Status:** ready-for-agent

- [ ] The mandatory Playwright project runs Chromium at 1194x834 with touch enabled and starts with one authenticated worker.
- [ ] One preflight rejects production or malformed Clerk and Convex targets, unsafe credential types, inherited deployment targeting, invalid preview names, and untrusted secret-backed execution before any write.
- [ ] A versioned fixture catalog assigns each worker an identity cohort and each test case a synthetic campaign graph addressed by stable domain keys.
- [ ] Guarded internal fixture operations seed the identity projection, reset a case idempotently, inspect deterministic state, and clean up only the owned case.
- [ ] Fixture operations refuse production, disabled E2E mode, wrong namespaces, wrong fixture versions, and cross-worker or cross-case access, with exhaustive lower-level tests.
- [ ] Serial authentication setup creates fresh, ignored, role-specific storage states without changing Clerk during normal runs.
- [ ] Each initial attempt and retry resets its case before browser contexts are created; teardown remains best-effort hygiene.
- [ ] Shared helpers support two authenticated contexts, semantic locators, production pointer drag, the visible keyboard/tap placement path, and domain-state synchronization without fixed sleeps.
- [ ] Failure output can retain safe reports, traces, screenshots from all relevant contexts, and sanitized logs without retaining credentials or auth state.
- [ ] An authorized local smoke run creates and resets one synthetic campaign using only declared non-production resources.
