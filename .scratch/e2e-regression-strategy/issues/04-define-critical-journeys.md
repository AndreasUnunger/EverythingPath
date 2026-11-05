# Define the Critical Regression Journeys

Type: grilling
Status: resolved

## Question

Which named user journeys and observable outcomes belong in the pull-request gate, which belong in nightly coverage, and which should remain exclusively in Vitest or `convex-test`? Start from the accepted scope: authentication and organization access, campaign and mid-campaign setup, ledger and officer assignments, the complete Upkeep to Activity to Event flow, reload persistence, two-player realtime synchronization and slot contention, and GM corrections.

## Answer

Use five independent, deterministic Chromium journeys as the pull-request gate:

1. **Enforce Organization Campaign Access**: an authenticated member of the fixture organization can open its campaign; an authenticated user outside that organization cannot access the campaign or its militia data. Clerk-hosted signup, invitation, recovery, and authentication-UI permutations are not application E2E responsibilities.
2. **Initialize an Existing Militia**: through the mid-campaign setup flow, enter representative rank, training, treasury, focus, notoriety, settlement reputation, teams and conditions, officer assignments, persistent or queued effects, and week/phase context; save; reload; and observe the same campaign-scoped state. Rule mismatches appear as advisory warnings while structurally invalid input remains blocked. This journey is independent of the full-week journey.
3. **Maintain the Character and Officer Ledger**: create a character, assign the character to an officer role, observe the assignment from a second player, reassign or unassign the character without deleting it, reload, and observe the persisted result.
4. **Resolve a Complete Militia Week**: begin from a deterministic seeded campaign, proceed through Upkeep, Activity, Event, and the final summary/confirmation boundary, and observe the committed militia outcome and next-week state after reload. This is one canonical golden path; exhaustive action, event, officer, and rule permutations remain below the browser boundary.
5. **Synchronize a Shared Action Slot**: one player stages an action and the second sees the current shared state; the allowed player confirms; and both clients observe the committed choice. Do not exercise competing same-slot writes or assert last-write-wins behavior. When the product introduces the Action Slot Claim lifecycle, extend this coverage with the timing-independent arbitration oracle in **Define Multiplayer and Contention Oracles**.

Run these broader journeys nightly:

1. **Create a New Campaign and Militia**.
2. **Resume an In-Progress Week After Reload** at intermediate phase boundaries.
3. **Recover or Reject Supported Invalid Shared-Board Interactions**, including only the cancellation, invalid-drop, and reconnect behavior the product exposes when the test is implemented. Add release, timeout, and broader contention cases with the Action Slot Claim lifecycle.
4. **Exercise Secondary Weekly Branches**, selecting a small risk-based sample rather than duplicating the rules matrix.
5. **Preserve State Across Desktop and Phone Layouts**; the precise viewport/browser allocation belongs to **Choose the Browser, Viewport, and Schedule Matrix**.

Keep exhaustive militia calculations and event combinations, validator and authorization permutations, mutation atomicity and stale-revision matrices, and component/form edge cases in Vitest or `convex-test`.

GM correction is deferred because no GM-only controls currently exist. Once that product capability exists, add a focused journey proving that correction controls are hidden from players, authorized for the GM, and that a correction propagates to both connected players. Do not pretend that current shared table adjustments are GM-only behavior.
