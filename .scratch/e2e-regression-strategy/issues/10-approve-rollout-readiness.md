# Approve Rollout Boundaries and Readiness

Type: grilling
Status: resolved
Claimed by: AndreasUnunger
Blocked by: 04, 05, 06, 07, 08, 09, 11

## Question

Given all resolved E2E decisions, what minimum evidence and documented contracts make the strategy implementation-ready, and in what increments should implementation proceed without weakening the pull-request gate? Confirm where E2E coverage ends and Vitest, `convex-test`, visual testing, and later reliability work begin.

## Answer

The strategy is implementation-ready when one consolidated specification gives an implementing agent the current-product journey inventory, environment and fixture contracts, safety boundary, locator and synchronization rules, CI policy, ordered work, and explicit deferred coverage. Provisioned credentials and a running suite belong to implementation rather than to this planning map.

Implementation must target the product that exists now. It must not wait for first-claim Action Slot locking, GM-only correction controls, or other planned capabilities. The initial mandatory suite contains:

1. organization campaign access;
2. existing-militia initialization and reload persistence;
3. character and officer ledger maintenance with realtime observation;
4. one complete militia week and persisted next-week state; and
5. current shared Action Slot staging and confirmation propagation.

The multiplayer journey deliberately does not assert current last-write-wins contention as desirable behavior. First-claim rejection, release, timeout, and GM correction coverage arrive with those product capabilities. Do not represent absent behavior with skipped or quarantined tests.

There is no informational or soak period. Each completed E2E test is part of the mandatory pull-request check as soon as it lands on `main`; unfinished tests remain off `main`. The broader nightly browser and viewport matrix may follow after the first mandatory Chromium tablet journeys and does not block their rollout.

Browser E2E owns cross-system user journeys. Vitest and component tests own rule calculations, validation, forms, and UI edge cases. `convex-test` owns authorization matrices, backend invariants, mutation atomicity, contention permutations, and fixture-helper verification. Pixel-level visual regression and load/performance programs remain separate future efforts; normal E2E screenshots, traces, and runtime monitoring remain required.

Future cross-system capabilities add their E2E coverage in the same feature change and expand the mandatory gate when they land. Pure rule permutations continue to receive lower-level coverage.

Implementation handoff: [Deterministic E2E Regression Suite](../../e2e-regression-suite/spec.md).
