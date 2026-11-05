# Deterministic E2E Regression Suite

Status: ready-for-agent

## Problem Statement

EverythingPath has substantial unit, component, and backend integration coverage, but no browser-level regression suite or checked-in CI workflow protects the journeys that matter most at the table. Changes can pass existing tests while breaking authenticated campaign access, mid-campaign initialization, persisted militia state, the Character Ledger and officer assignments, the complete weekly flow, or realtime collaboration.

These journeys cross the Next.js interface, Clerk identity and organization membership, and Convex persistence and subscriptions. Multiplayer failures can be timing-sensitive, while unsafe test infrastructure could accidentally target production identities or campaign data. The project needs a deterministic, actionable gate without moving exhaustive militia-rule combinations into slow and brittle browser tests.

## Solution

Build a Playwright Test suite that exercises EverythingPath through its production UI against isolated non-production Clerk and Convex resources. Make each completed critical journey part of a required Chromium tablet pull-request check as soon as it lands. Keep the gate below ten minutes, synchronize on player-visible domain outcomes, reset deterministic case-owned fixtures before every attempt, and preserve safe diagnostic evidence on failure.

The initial suite protects five independent current-product journeys: organization campaign access, existing-militia initialization, Character Ledger and officer maintenance, complete militia-week resolution, and realtime Action Slot staging. Broader browser and viewport compatibility runs nightly. Planned first-claim locking and GM-only controls gain browser coverage when those capabilities exist; the initial suite does not encode current last-write-wins behavior as a desired contract or use skipped tests to pretend future behavior is present.

## User Stories

1. As a campaign member, I want the suite to prove I can open my organization's campaign, so that legitimate access does not regress.
2. As a campaign member, I want the suite to prove another organization's member cannot open my campaign, so that militia data remains private.
3. As a maintainer, I want access checks to use real authenticated application flows, so that they cover the boundary users depend on.
4. As a maintainer, I want Clerk-hosted signup, invitation, recovery, and authentication UI excluded, so that the suite tests EverythingPath rather than Clerk.
5. As a player joining an in-progress campaign, I want to initialize rank, training, treasury, focus, and notoriety, so that current tabletop state can be adopted.
6. As a player joining an in-progress campaign, I want to initialize reputation, teams and conditions, officers, effects, and week context, so that the militia is ready for normal play.
7. As a player, I want structurally invalid onboarding input blocked with field feedback, so that malformed state cannot be saved.
8. As a player, I want rules mismatches to remain advisory, so that legacy state, homebrew, and GM adjudication remain possible.
9. As a player, I want initialized militia state to survive reload, so that I can trust it was persisted.
10. As a player, I want initialized state scoped to the selected campaign, so that campaigns cannot contaminate each other.
11. As a player, I want to create a character in the Character Ledger, so that militia participants can be tracked.
12. As a player, I want to assign a character to an officer role, so that leadership is clear.
13. As a second player, I want to see an officer assignment without reloading, so that everyone shares the same state.
14. As a player, I want to reassign or unassign an officer without deleting the character, so that role changes preserve records.
15. As a player, I want ledger and officer changes to survive reload, so that the shared record remains dependable.
16. As a player, I want to complete Upkeep, Activity, and Event in order, so that the core weekly workflow is protected.
17. As a player, I want Confirmation to commit the reviewed week, so that the transition from Weekly Draft to Weekly Resolution is protected.
18. As a player, I want the committed outcome and next-week state to survive reload, so that Weekly Resolution is demonstrably persistent.
19. As a maintainer, I want one canonical complete-week golden path, so that integration is protected without duplicating the rules matrix.
20. As a player, I want a staged Action Choice to appear for another connected player, so that realtime collaboration remains trustworthy.
21. As a player, I want an Action Choice visibly marked Staged, so that uncommitted decisions are clear.
22. As a player, I want both clients to show the same Staged Action Choice while the current week remains open. Actions have no individual confirmation; Confirm Week commits the entire Weekly Draft.
23. As a maintainer, I want the initial shared-slot journey to avoid competing writes, so that last-write-wins is not blessed as intended behavior.
24. As a player, I want future first-claim locking to reject a competing choice without changing the accepted claim, so that simultaneous play resolves predictably.
25. As a player, I want future cancellation, release, timeout, and reconnect behavior to converge for everyone, so that claims cannot become ambiguous.
26. As a GM, I want future correction controls hidden from players and authorized corrections propagated, so that adjudication is protected when moderation exists.
27. As a tablet user, I want critical journeys exercised in the primary landscape layout with touch enabled, so that the gate represents normal play.
28. As an iPad user, I want nightly WebKit coverage, so that engine-specific tablet regressions are detected.
29. As a desktop user, I want representative Firefox coverage, so that the secondary desktop layout remains usable.
30. As a phone user, I want focused navigation, form, persistence, and cross-layout coverage, so that the compact layout remains usable.
31. As a contributor, I want the pull-request gate below ten minutes, so that browser coverage does not make iteration impractical.
32. As a contributor, I want every test to own and reset deterministic data, so that failures do not depend on order or leftovers.
33. As a contributor, I want multiplayer tests to wait for domain-state transitions rather than delays, so that timing variation does not cause false failures.
34. As a contributor, I want accessible roles, names, labels, statuses, and alerts to be the default locator surface, so that tests reinforce accessibility.
35. As a keyboard or touch user, I want a visible non-drag placement path, so that card placement is not limited to pointer dragging.
36. As a contributor, I want real pointer drag used when drag itself is under test, so that the suite covers the interaction players use.
37. As a contributor, I want a clean checkout to typecheck and build without selecting or mutating Convex, so that builds are safe and reproducible.
38. As a contributor, I want deployment workflows to bind the frontend to an explicit disposable preview, so that E2E cannot silently use another backend.
39. As a contributor without service credentials, I want all secretless checks available, so that local and forked development retain useful verification.
40. As a maintainer, I want setup to fail before any write when service targets are unsafe, so that production identities and data cannot be touched.
41. As a maintainer, I want auth state and credentials excluded from artifacts, so that diagnostic evidence cannot leak secrets.
42. As a maintainer, I want a diagnostic retry to remain red when it passes, so that flakes are visible.
43. As a maintainer, I want skipped, focused, quarantined, cancelled, neutral, or missing required tests to fail the gate, so that green CI cannot hide lost coverage.
44. As a pull-request author, I want traces, screenshots, reports, and safe logs, so that I can diagnose broken journeys efficiently.
45. As a maintainer, I want failures to identify the journey, player, domain object, expected state, and observed state, so that multiplayer failures are actionable.
46. As a maintainer, I want recurring nightly failures deduplicated and escalated by an explicit threshold, so that compatibility regressions remain visible.
47. As a maintainer, I want p95 runtime measured, so that workers or sharding are introduced from evidence.
48. As a maintainer, I want exhaustive rule, validation, authorization, atomicity, and contention permutations in faster tests, so that the browser gate stays focused.

## Implementation Decisions

- Use Playwright Test with isolated browser contexts for simultaneous player/player and future GM/player scenarios.
- Add Playwright and Clerk's supported Playwright testing package as development dependencies.
- Make both the generic build and an explicit web build backend-free. Neither may select, synchronize, or mutate a Convex deployment.
- Track Convex generated runtime utilities and declarations so a clean checkout can typecheck and build before deployment selection. Fail CI on unexpected deployment-time generated drift.
- Preserve the combined local development launcher while keeping web-only development independent of backend synchronization.
- Make deployment explicit: E2E deploys current backend functions to the intended preview and injects its public URL into the production frontend build.
- Use one freshly recreated Convex cloud preview per CI shard or authorized local slot. Do not offer a lower-parity browser mode using development servers or personal deployments.
- Use a dedicated Clerk development application with persistent admin/GM-fixture, player/member, and outsider users.
- Give each Playwright worker its own Clerk organization and identity cohort before enabling multiple authenticated workers. Browser contexts represent players, not data isolation.
- Give each test one synthetic campaign graph and address fixtures by stable domain keys rather than generated provider identifiers or display text.
- Use stable sanitized preview names for pull-request shards and local slots. Serialize or cancel overlapping executions for one slot and recreate its preview before every run.
- Keep a versioned synthetic fixture catalog in the repository and provider-specific identity/organization identifiers in non-secret external configuration.
- Provide guarded internal operations to seed the identity projection, reset a case, inspect deterministic state, and clean up a case. Add deterministic claim expiry only with the claim feature.
- Require fixture operations to verify E2E mode, namespace, fixture version, worker key, and case key. They must be impossible to invoke against production.
- Make time-dependent and random values explicit fixture inputs.
- Reset each case before every initial attempt and retry. Cleanup is best-effort hygiene; reset and next-run preview recreation provide correctness.
- Seed the identity projection Clerk webhooks would create, while keeping webhook verification at a separate backend/HTTP integration seam.
- Provision or repair Clerk fixtures only through an idempotent, explicitly enabled bootstrap. Normal runs verify fixtures without modifying Clerk.
- Generate fresh role-specific auth storage in a serial setup project for every run. Keep it ignored and never retain it as an artifact.
- Run one fail-closed preflight before any network write. Accept only test/development Clerk credentials, a preview deploy key, an `e2e-` preview name, no inherited production target, targets outside production denylists, and trusted code for secret-backed execution.
- Never expose service secrets to fork or dependency-update code. Require a trusted secret-enabled gate against the reviewed commit before merge.
- Run completed mandatory journeys in Chromium at 1194x834 with touch enabled. Start with one worker because the initial fixtures provide one safe two-user cohort.
- Target pull-request p95 at or below eight minutes and total duration below ten. Stop E2E after twelve minutes and the workflow after fifteen to preserve artifact finalization time.
- Add a second worker only after independent Clerk cohorts exist and repeated contention runs prove isolation. Add two-way sharding only when measured p95 approaches eight minutes.
- Add a nightly matrix after the mandatory foundation: all coverage on Chromium tablet, critical journeys on WebKit tablet, selected journeys on Firefox desktop, and focused layout/persistence coverage on Chromium phone.
- Keep mandatory journeys independent and start each from a purpose-built fixture.
- Add each completed journey to the required gate in the same change. Keep unfinished tests off the main branch; there is no soak phase.
- Locate UI by accessible role/name, associated label, stable visible domain state, then a documented test-identifier exception.
- Give panels named regions, controls persistent labels, repeated operations entity-specific names, fields associated errors, and async work suitable busy/status/alert semantics.
- Expose Action Slots as named groups with visible state and Action Choice, and Action Choices as focusable named drag handles. Add claimant semantics only when claims exist.
- Test identifiers use stable domain vocabulary and never encode CSS, component structure, reorderable indexes, or provider IDs.
- Use a shared real-pointer helper when drag is under test and a player-visible keyboard/tap path using the same production staging logic elsewhere. Do not add hidden staging bypasses.
- Synchronize on visible domain outcomes, never arbitrary sleeps, animation completion, network-idle state, or spinner disappearance alone.
- Do not add browser-visible mutation shortcuts, authentication bypasses, query-string test modes, or global test hooks.
- Make the initial slot journey prove only current staging propagation. Do not issue competing writes or assert last-write-wins behavior.
- When first-claim locking ships, prove shared availability, first accepted claim, unchanged state after competitor rejection, and convergence.
- Add cancellation, release, deterministic expiry, invalid-drop recovery, and reconnect convergence with the claim lifecycle.
- Add a GM correction journey only when GM-only controls exist; shared Table Adjustments are not a substitute.
- Use one stable aggregate required-check name. It fails unless every required journey succeeds.
- Permit one CI retry for evidence, but classify a retry-pass as a failing flaky result. A later rerun clears failure only after a fix or documented external incident.
- Reject skipped, focused, fixed, quarantined, or disabled required/nightly tests. Do not use continue-on-error for required results.
- Publish concise console output, an HTML report, first-retry traces, screenshots from every relevant context, and safe application/service logs. Keep video off unless traces are insufficient.
- Retain artifacts for thirty days while excluding credentials, auth storage, secrets, and production data.
- Make the pull-request author the initial failure owner; transfer ownership only when evidence identifies shared E2E infrastructure.
- Create or update one deduplicated issue when a nightly test fails twice consecutively or at least twice in twenty runs. Nightly failures do not block unrelated merges retroactively.
- Implement in this order: backend-free build boundary; safe Playwright and fixture harness; non-production resources; access, onboarding, ledger, complete-week, and realtime-slot journeys; nightly matrix.
- After the harness and gate exist, the last four journeys may be developed independently and join the aggregate only when complete.

## Testing Decisions

- Use one highest browser seam through the rendered Next.js app, authenticated Clerk session, deployed Convex functions, persistence, and subscriptions. Assert player-visible behavior without coupling to component structure, internal IDs, revision shapes, or subscription implementation.
- The access journey proves an organization member can open its campaign and an authenticated outsider cannot access that campaign or militia data.
- The onboarding journey submits representative mid-campaign state, verifies structural errors and advisory warnings, reloads, and verifies campaign-scoped persistence.
- The ledger journey creates a character, assigns an officer, observes it from a second context, reassigns or unassigns without deletion, reloads, and verifies persistence.
- The complete-week journey starts from a deterministic fixture, completes Upkeep, Activity, Event, and Confirmation, then reloads and verifies the committed outcome and next-week state.
- The realtime journey opens two authenticated contexts on the same seeded Activity board and empty Action Slot, stages a supported Action Choice through a visible production interaction in one, and waits until both show the same Staged Action Choice without reloading. There is no per-action confirmation. Whole-week Confirmation stays in the complete-week journey.
- A good browser test uses accessible production interactions, owns a deterministic fixture, runs alone or in any order, resets before attempts, waits for domain state, and reports the journey, observer, object, expectation, and observation.
- Existing component tests are prior art for forms, character/officer interactions, phase rendering, Action Slots, and controller synchronization. Extend them for exhaustive UI states.
- Existing pure Vitest suites are prior art for Weekly Resolution, events, progression, action constraints, officer rules, and shared-query behavior. Keep deterministic rule matrices there.
- Existing `convex-test` harnesses are prior art for organization authorization, mutations, atomic Confirmation, stale revisions, concurrency, collaboration, rollback, and query contracts. Add exhaustive fixture-helper and safety tests there.
- Test the preflight below the browser boundary with accepted non-production inputs and rejected production, malformed, inherited, and missing targets. Prove rejection occurs before a network-writing adapter runs.
- Test fixture operations for namespace enforcement, version validation, idempotent reset, case isolation, deterministic inspection, scoped cleanup, identity projection, and refusal outside E2E mode.
- Test the aggregate evaluator so failure, flake, cancellation, neutral, skip, timeout, and missing results all fail the required check.
- Test accessibility additions at the component boundary where practical, including named regions, labels, associated errors, announcements, slot groups, choice handles, and keyboard/tap placement.
- From a clean checkout without Convex credentials, run typecheck, lint, relevant tests, and the backend-free web build with safe public configuration.
- Rehearse explicit deployment against one disposable preview and prove it creates only the intended preview, deploys once, and binds the build to its URL.
- Smoke-test combined local development and prove backend changes refresh tracked generated output without disrupting the web process.
- Fail CI when deployment-time generation causes unexpected generated-code drift.
- Measure pull-request p95. Runtime breaches are operating signals, not browser assertions.
- Treat retry-passes as failures. Retries gather evidence rather than improving apparent pass rate.
- Do not assert exact pixels. Responsive tests verify usable navigation, visible controls, form integrity, persistence, and supported cross-layout workflows.
- Add first-claim and GM tests only alongside those capabilities; until then their absence is explicit scope, not a skipped test.

## Out of Scope

- Implementing Action Slot claims, leases, heartbeats, release, or timeout behavior.
- Implementing GM-only moderation or correction controls.
- Treating current last-write-wins staging as intended behavior.
- Testing Clerk-hosted signup, invitation, recovery, or Clerk's authentication UI.
- Delivering Clerk webhooks into ephemeral previews during browser setup.
- Accessing production Clerk tenants, Convex deployments, identities, organizations, campaigns, or data.
- Exercising every rule, action, event, officer interaction, validation branch, stale revision, authorization permutation, or contention case in a browser.
- Replacing existing Vitest, component, or `convex-test` coverage.
- Exhaustive pixel-level visual regression.
- Load, soak, stress, or performance programs beyond monitoring suite runtime.
- Deleting failed previews through broad Convex management credentials.
- A lower-parity E2E mode based on development servers or persistent personal deployments.
- Providing service secrets to untrusted fork or dependency-update code.

## Further Notes

- This specification consolidates the fully resolved [E2E Regression Strategy map](../e2e-regression-strategy/map.md). Its decision tickets, research, and prototypes retain the detailed rationale.
- The repository currently uses Next.js 16, React 19, Clerk organizations, and Convex. It has extensive Vitest and `convex-test` coverage but no browser E2E setup or checked-in CI workflow.
- Use the canonical domain vocabulary: Weekly Draft, Weekly Draft Revision, Phase View, Phase Readiness, Resolution Preview, Weekly Resolution, Confirmation, Table Adjustment, Rules Baseline, Resolution Record, Ruleset Version, Historical Reconstruction, Action Slot, Action Slot Claim, and Staged Action Choice.
- Implementation is complete when all five current-product journeys are mandatory, every attempt has deterministic reset, production safeguards are proven, the tablet gate stays within budget, safe evidence covers all contexts, clean-checkout and disposable-preview build contracts pass, and no required coverage is skipped or accepted only on retry.
