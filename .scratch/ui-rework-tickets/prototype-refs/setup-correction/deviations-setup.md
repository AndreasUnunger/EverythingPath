# Setup (#138): don't copy from `prototype/setup-correction` (variant B)

Prototype: `/prototype/setup-correction?variant=B` at `c479521`. The owning spec is [#138](https://github.com/AndreasUnunger/EverythingPath/issues/138). The only amendment is [5855257929](https://github.com/AndreasUnunger/EverythingPath/issues/138#issuecomment-5855257929), which changes blocking and leaves scope unchanged. This prototype covers tablet only. Take phone and desktop from `responsive-pages?variant=C` (§3). At 390 px the prototype squashes the tablet grid and overflows horizontally by 30 px.

- **Treasury in gp, with a New default of `100`.** The Starting point shows "Treasury (gp)" and `newSnapshot` seeds `treasury: '100'`. Setup keeps treasury in copper and New defaults to 1,000 copper (10 gp). See §4 SETUP-01/SETUP-02.
- **Switching New/Existing wipes the form.** The `scenario` action with `key: 'mode'` in `mock.ts` returns `initialState(...)`, which resets the draft, the step and the visited statuses. New/Existing must keep entered facts. The only allowed change is that switching to Existing clears the first-militia-week skip. Mode changes must never overwrite an intentional edit. See §4 SETUP-01 and §5 "Validation".
- **PC/NPC kind toggle and Hit Dice with a level fallback.** The People & officers rows use a `pc | npc` radio, and Hit Dice shows the level as its placeholder. Keep character-record `pc | officer_npc`, roster `pc | officer_npc | other_npc` and the required commandant Hit Dice until Characters & officers migrates them. See §3, §5 "Character creation and later migration", and the approvals [#112](https://github.com/AndreasUnunger/EverythingPath/issues/112#issuecomment-5836835106) and [#114](https://github.com/AndreasUnunger/EverythingPath/issues/114#issuecomment-5844673552).
- **A reduced Add character dialog that writes into the local draft.** The dialog has only Name, Level and Cha modifier. It adds the row straight to `draft.people` with `onRoster: true` and `kind: 'npc'`. Instead, reuse the full existing dialog: name, kind, level, six ability scores, notes and validation. Create through `character.createCharacter`, and let `options.characters` deliver the record reactively. Roster inclusion stays explicit, and a failure keeps the dialog values. See §4 SETUP-26, CHAR-03 and CHAR-07, and §5.
- **"Another player finished setup" discards input and lands on Militia.** The banner reads "Your entries here are discarded and the week opens in a moment". A 2.5 s timer then switches to the Militia screen, and our own *Start militia week* also goes to Militia. A live external completion must open that campaign's accepted current week. Our own success must open the requested eligible phase exactly once. See §4 SETUP-27 and NAV-14, and §5 "Start/race state machine".
- **No started page.** The prototype has no "This militia is already set up." page with *Open week N* and *Open militia*. A first visit to a started militia must show that page, even when a stale browser envelope exists, and must not redirect automatically. See §4 SETUP-22 and the [#119 approval](https://github.com/AndreasUnunger/EverythingPath/issues/119#issuecomment-5846266381).
- **Start is instant.** `startMilitia` dispatches synchronously. It has no "Starting militia…" pending state, no protection against duplicate submission, and no failure/retry that keeps values. Implement those, and keep the same attempt ID and source on retry. See §4 SETUP-21 and §5 "Start/race state machine".
- **Simplified mock fields are not the field list.** Examples:
  - Conditions offer only `captured / in_refuge / missing`.
  - Settlements lack Reduce Danger and refuge weeks.
  - Orders lack due day/Activity week, delivery days, enchantment value and receipt.
  - Items lack weight.
  - Caches lack return week and contents.
  - Marketplaces lack availability and sale percentages.
  - Queued effects are a free-text "Effect".
  - Persistent events have no targets or Theft mitigation.
  - Skill benefits take free-text characters.

  Every field in §4 SETUP-05…SETUP-17 stays. §4 says: "omission from simplified prototype data is not approval to remove a field".
- **Whole-number-only validation with no reference checks.** `errorsFor` rejects anything that isn't `/^-?\d+$/` ("must be a whole number"), which would reject decimal enchantment values. It also has no hard reference checks: missing carried-event targets, incomplete order delivery facts, and foreign or impossible IDs. Use react-hook-form + zod with the shared validators. See §5 "Validation", SETUP-12 and SETUP-20.
- **Error links only switch step, and the setup chrome is not the shell.**
  - `ErrorSummary` calls `go(stepForProblem(p))`. It neither focuses the field nor, on phone, expands the row. See §3 and §8.
  - The prototype's top bar shows only "Set up militia" and "Not started yet". Use the shell, which keeps normal navigation and all sections available. See §1 and §7.
  - Hard-coded `text-amber-300`, native checkboxes and raw `<button>` radios must become shadcn/ui components and theme tokens. See §3.
