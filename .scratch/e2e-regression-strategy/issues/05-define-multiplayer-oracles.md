# Define Multiplayer and Contention Oracles

Type: prototype
Status: resolved
Blocked by: 01, 02, 03, 04

## Question

What concrete two-player test scenarios, timing-independent observations, and failure messages will prove realtime propagation, staged versus confirmed visibility, first-claim locking, release/cancel/timeout behavior, invalid-drop recovery, and GM conflict correction without relying on arbitrary sleeps? Produce a rough representative test outline for human review.

## Answer

Treat the browser suite as a black-box observer of the existing product contract. It must not decide claim ownership, lease representation, heartbeat behavior, or timeout implementation. The current application still uses last-write-wins same-slot staging, so the initial mandatory journey proves only supported staging and confirmation propagation and does not exercise competing writes. Implementing the first-claim lifecycle is not a prerequisite for the initial E2E suite.

Use user-visible state transitions as synchronization barriers. After an action in one browser context, wait for the other context's accessible slot status, card label, claimant label, or feedback message to reach the expected value. Do not wait a fixed number of milliseconds. Seed/reset helpers may expose a deterministic operation that expires a claim immediately; the browser test then observes the resulting UI transition without controlling or knowing the production timeout mechanism.

The initial pull-request journey **Synchronize a Shared Action Slot** proves that Player A can stage a currently supported choice, Player B observes the same staged choice, the allowed player confirms it, and both observe the committed state. It deliberately makes no claim about competing writes.

When the product introduces first-claim locking, replace or extend that journey with **Synchronize and Arbitrate a Shared Action Slot**, which proves:

1. Both players initially observe the same slot as available.
2. Player A makes a valid drop. Both players observe the slot as claimed by Player A with the same staged card; no committed outcome is shown yet.
3. Player B attempts a different valid drop into that slot. Player B receives clear rejection feedback, while both players continue to observe Player A's unchanged claim and staged card.
4. Player B cannot confirm Player A's claim. Player A confirms it. Both players observe the same confirmed card and committed status.

A representative future claim-lifecycle outline is:

```ts
test('first claim wins and confirmation propagates', async ({ browser }) => {
  const alice = await openPlayerContext(browser, 'alice');
  const bob = await openPlayerContext(browser, 'bob');
  await openSeededActivityBoard({ alice, bob });

  await expectSlot(alice, 1).toBeAvailable();
  await expectSlot(bob, 1).toBeAvailable();

  await stageCard(alice, 'Earn Gold', 1);
  await expectSlot(alice, 1).toBeClaimedBy('Alice', 'Earn Gold');
  await expectSlot(bob, 1).toBeClaimedBy('Alice', 'Earn Gold');
  await expectSlot(bob, 1).not.toBeConfirmed();

  await stageCard(bob, 'Reduce Danger', 1);
  await expect(bob.getByRole('alert')).toContainText('claimed by Alice');
  await expectSlot(alice, 1).toBeClaimedBy('Alice', 'Earn Gold');
  await expectSlot(bob, 1).toBeClaimedBy('Alice', 'Earn Gold');

  await confirmSlot(alice, 1);
  await expectSlot(alice, 1).toBeConfirmedAs('Earn Gold');
  await expectSlot(bob, 1).toBeConfirmedAs('Earn Gold');
});
```

Nightly claim-lifecycle scenarios added with that feature prove:

- **Cancel and reclaim**: Player A cancels an unconfirmed claim; both players observe availability; Player B can then stage and confirm.
- **Explicit release**: whichever product interaction represents release produces availability for both players without committing the card.
- **Claim timeout**: a deterministic fixture operation expires the live claim; both players observe availability; another player can claim it. No wall-clock sleep is used.
- **Invalid drop recovery**: an invalid drop returns the card to its origin, exposes clear feedback, and leaves the shared slot unchanged for both players.
- **Reconnect convergence**: after a player reconnects or reloads, their visible slot status matches the authoritative state already observed by the connected player.

Failure messages must name the journey, observing player, slot, expected lifecycle state, expected claimant/card when relevant, and last visible state. For example:

```text
Synchronize and Arbitrate a Shared Action Slot — Bob — Activity slot 1:
expected claimed by Alice with “Earn Gold”; observed claimed by Bob with “Reduce Danger”.
```

Capture a trace and screenshot from both browser contexts on failure, along with stable run, worker, organization, campaign, week, and slot identifiers in test annotations. Do not expose internal versions or identifiers in application copy.

GM conflict correction remains deferred until GM-only controls exist. When that capability is implemented, define its observable authorization and propagation behavior before adding the E2E scenario; current shared table adjustments must not stand in for GM-only behavior.

Prototype: [`../prototypes/multiplayer-slot-oracle.html`](../prototypes/multiplayer-slot-oracle.html)
