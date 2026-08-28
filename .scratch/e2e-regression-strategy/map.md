# E2E Regression Strategy

Label: wayfinder:map

## Destination

An implementation-ready strategy for a deterministic end-to-end regression suite that protects EverythingPath's critical authenticated, persistent, and realtime multiplayer journeys. The strategy must define a Chromium pull-request gate targeted below ten minutes, broader nightly coverage, isolated non-production Clerk and Convex integration, and actionable failure evidence.

## Notes

- Domain: a Next.js 16 and React 19 tablet-first application using Clerk organizations for identity and Convex for persistence and realtime collaboration.
- This map produces decisions, not the implemented suite.
- The initial browser suite should protect critical tabletop journeys; exhaustive militia-rule combinations remain in faster Vitest and `convex-test` coverage.
- Pull requests should be blocked by a deterministic Chromium suite. Broader browser and responsive coverage should run nightly.
- Browser tests may use isolated non-production Clerk and Convex resources, but must never access production identities or data.
- Every session should consult the `wayfinder`, `grilling`, and `domain-modeling` skills. Consult `convex` for backend boundaries and `research` for external facts.
- The repo currently has 33 Vitest files containing 214 test cases, no browser E2E configuration, and no checked-in CI workflow.

## Decisions so far

<!-- Resolved tickets are indexed here by name, one line each. -->

- [Choose the Full-Stack Browser Runner](issues/01-choose-browser-runner.md): use Playwright Test with native multi-context scenarios, a Chromium/two-worker PR gate, retained failure artifacts, and measured sharding only when needed.
- [Prove Safe Clerk Authentication Automation](issues/02-prove-clerk-auth-automation.md): use Clerk's Playwright helpers with two persistent development-instance roles, fresh per-run auth states, serial execution until worker-specific cohorts exist, and hard production/secret safeguards.
- [Prove an Isolated Convex E2E Environment](issues/03-prove-convex-test-environment.md): recreate one Convex cloud preview per CI shard, partition data by worker, use guarded deterministic seed/reset functions, and retain `convex-test` for exhaustive backend coverage.
- [Define the Critical Regression Journeys](issues/04-define-critical-journeys.md): gate pull requests on five independent access, onboarding, ledger, weekly-flow, and current realtime shared-slot journeys; move broader branches and layouts nightly, keep rule matrices below E2E, and add claim and GM coverage with those product capabilities.
- [Define Multiplayer and Contention Oracles](issues/05-define-multiplayer-oracles.md): prove current shared-slot propagation without asserting competing-write behavior, then add the defined first-claim, release, timeout, and reconnect oracles when the claim lifecycle ships.
- [Choose the Browser, Viewport, and Schedule Matrix](issues/07-choose-execution-matrix.md): gate on five Chromium journeys at 1194×834 with one worker until Clerk cohorts permit two; distribute broader tablet, WebKit, Firefox desktop, and Chromium phone coverage across nightly projects.
- [Define the UI Testability Contract](issues/08-define-testability-contract.md): use semantic-first locators, accessible production interactions, domain-state synchronization, real pointer drag plus a shared keyboard/tap path, and guarded backend-only test seams.
- [Resolve the Convex Build Bootstrap Contract](issues/11-resolve-convex-build-bootstrap.md): track Convex generated code, keep builds deployment-free and deployment workflows explicit, preserve the current local dev launcher, and require clean-checkout, preview, and generated-drift evidence.
- [Choose the E2E Environment and Data-Isolation Contract](issues/06-choose-environment-topology.md): use disposable Convex previews with persistent Clerk development cohorts, worker-owned identity isolation and case-owned campaign fixtures, guarded deterministic reset operations, production-build parity, and fail-closed production safeguards.
- [Define the CI Failure and Flake Policy](issues/09-define-ci-operating-policy.md): keep retries diagnostic and flakes red, prohibit quarantines and skipped tests, preserve safe failure evidence, make reruns accountable, use activity-based escalation, and enforce a fail-closed aggregate required check.
- [Approve Rollout Boundaries and Readiness](issues/10-approve-rollout-readiness.md): implement mandatory E2E coverage incrementally against current product behavior, add future-feature coverage with those features, and hand off one consolidated specification with explicit test-layer boundaries.

## Not yet specified

None. The route to the implementation-ready strategy is fully specified.

## Out of scope

- Implementing the E2E suite, CI workflow, test-only application seams, or service provisioning during this planning map.
- Exercising production Clerk tenants, Convex deployments, identities, or campaign data.
- Repeating every deterministic militia-rule permutation in a browser when the behavior can be protected more precisely below the E2E boundary.
- Establishing exhaustive pixel-level visual regression testing or a performance/load-testing program.
