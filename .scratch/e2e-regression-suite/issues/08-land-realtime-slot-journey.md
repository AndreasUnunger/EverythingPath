# 08: Land the Current Realtime Action Slot Journey

**What to build:** Protect the Action Slot collaboration behavior the product supports today: one player stages a valid Action Choice through a production interaction, another player observes the shared staged state, the allowed player confirms, and both clients converge on the Confirmed Action Choice.

**Blocked by:** 04: Land the Mandatory Access Journey.

**Status:** ready-for-agent

- [ ] Both authenticated players initially observe the same seeded Activity board and Action Slot state.
- [ ] One player stages a supported Action Choice using the production pointer-drag interaction or visible keyboard/tap path.
- [ ] Both players observe the same Staged Action Choice before any committed outcome is shown.
- [ ] The currently allowed player confirms through the production UI and both clients observe the same Confirmed Action Choice.
- [ ] Synchronization uses accessible slot state, choice names, status, and feedback instead of fixed sleeps, network-idle state, or browser-visible backend shortcuts.
- [ ] The journey does not issue competing same-slot writes or assert last-write-wins, first-claim rejection, release, timeout, reconnect, or GM correction behavior.
- [ ] Failures identify the journey, observing player, Action Slot, expected state and choice, and last visible state, with safe evidence from both contexts.
- [ ] The completed journey joins the required aggregate and deferred claim-lifecycle coverage remains explicit in the parent specification.
