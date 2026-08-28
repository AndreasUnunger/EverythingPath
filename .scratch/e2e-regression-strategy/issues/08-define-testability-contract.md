# Define the UI Testability Contract

Type: prototype
Status: resolved
Claimed by: AndreasUnunger
Blocked by: 01, 04
Prototype: [`../prototypes/ui-testability-contract.html`](../prototypes/ui-testability-contract.html)

## Question

What locator hierarchy, accessible naming rules, test identifiers, drag-and-drop interface, loading-state semantics, and test-only seams are acceptable for stable browser tests without coupling them to visual implementation details? Create a rough locator inventory and representative test fragment against the critical journeys for human review.

## Answer

Adopt a semantic-first UI testability contract. Browser tests locate surfaces in this order: accessible role and name, associated label, stable visible domain state, then a documented `data-testid` exception. Test IDs use stable domain language and must not encode CSS classes, component structure, reorderable array positions, or Convex and Clerk identifiers.

Production UI must expose the semantics the product already promises. Major panels have unique headings and named regions; every control has a persistent player-facing label; Action Slots are named groups containing their current visible staged or confirmed state and Action Choice; Action Choices expose focusable, uniquely named drag handles; repeated actions include the affected entity in their accessible name; field errors are associated with their controls. Claimant and full lifecycle semantics join this contract when the product introduces them. This work improves the product's accessibility rather than creating browser-only markup.

The pull-request shared-slot journey exercises the real pointer drag through a shared Playwright helper that moves between role-located Action Choice handles and Action Slots. The product also provides a player-visible keyboard/tap placement alternative using the same production staging path. Other tests may use that alternative when drag itself is not under test. No hidden front-end staging bypass is allowed.

Async operations expose busy, status, and alert semantics, disable conflicting actions, and show unobtrusive Saving/Saved feedback for autosaves. Tests synchronize on the resulting domain outcome—for example a shared Action Choice appearing in its slot or a character assigned as Commandant—not sleeps, animation completion, `networkidle`, or spinner disappearance alone. Rejections must leave the authoritative visible state unchanged and announce the rejected operation.

Test-only data controls are guarded non-production backend operations for deterministic seeding, reset, and claim expiry. They must be impossible to invoke against production. Do not add `window.__test`, query-string authentication bypasses, browser-visible mutation shortcuts, or production-enabled reset endpoints.

The current application does not yet satisfy every semantic part of this contract: its activity cards and Action Slots lack accessible domain identities, async states are mostly plain text, and the shared model has no claimant or per-slot claim lifecycle. Add the accessibility semantics needed to test current interactions without changing product behavior. Claimant and claim-lifecycle semantics, and their accepted arbitration oracle, remain deferred until that product capability is implemented; they are not prerequisites for the initial E2E harness.

The reviewed locator inventory, state walkthroughs, and representative Playwright fragments are preserved in the [UI testability contract prototype](../prototypes/ui-testability-contract.html).
