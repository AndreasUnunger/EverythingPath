# Militia corrections (#139): don't copy from `prototype/setup-correction` (variant B, `screen=militia`)

Prototype: `/prototype/setup-correction?variant=B&screen=militia` at `c479521`. The owning spec is [#139](https://github.com/AndreasUnunger/EverythingPath/issues/139). The only amendment is [5855258043](https://github.com/AndreasUnunger/EverythingPath/issues/139#issuecomment-5855258043), which changes blocking and leaves scope unchanged. This prototype covers tablet only. Take phone and desktop from `responsive-pages?variant=C` (§3). At 390 px the prototype squashes the tablet grid and overflows horizontally by 343 px.

- **No People & officers fallback on Militia.** The prototype moves the roster and officers to its `screen=characters` side sheet (variant C). Keep the production roster/officer editor reachable as a **People & officers** fallback on Militia, linked from Characters & officers. It must be mutually exclusive with section editing and keep its reason, validation and stale-save handling. The prototype's character screen is superseded. See §1, §5 "Correction lifecycle", §7, LEDG-01 and LEDG-03, and the [#114 approval](https://github.com/AndreasUnunger/EverythingPath/issues/114#issuecomment-5844673552).
- **Invented actor names.** The header flashes "Mira corrected Teams" / "Mira corrected Values", and `changedSince` records `by: 'Mira'`. The read result has no actor, so don't invent one in the conflict or in feedback. See §5 "Correction lifecycle" step 3.
- ***Start again from their values* keeps the old reason.** This was observed: after a conflict, the restart kept "Miscounted at the table" in the reason field, because `correct:redo` resets only the draft. The restart must reset the baseline and fields to the newest section and clear the reason. See §5 step 3 and LEDG-06.
- **Simulated conflict and an instant save.**
  - Conflict comes from a local `changedSince` log checked only at Save.
  - Save commits synchronously and shows "Saved HH:MM" in the header.
  - The spec instead requires: stable structural equality of the captured and latest section; refresh and retry after a revision race rather than a forced save; restart when the week changes; "Saving correction…" with duplicate prevention; and reconciling after an unknown acknowledgement.

  See §5 steps 2, 5 and 6, and LEDG-06.
- **Reason copy.** The field is labelled "Reason for this correction" with the placeholder "What happened at the table?", and it only checks for non-empty input. Use **Reason for correction**. Trim the input, require it to be non-empty, and cap it at 2,000 characters. Don't prefill it and don't add helper text; the approval removed the reason helper. See §2, §4 "Signed-off replacements/removals" and LEDG-05.
- **Hard-coded impact lines.**
  - `impactOf` checks three fixed `stagedReferences` (a team, a settlement and a person) against the opening snapshot.
  - It prints unlinked sentences.
  - Items, caches, Upkeep, events, Persistent officers and Table Adjustments are never flagged.

  Instead, derive the impact with `draftReferenceRequirements`, passing the candidate corrected snapshot as both source arguments. Refresh it against live choices, name slots and positions, and link to the phase or selection. See §5 "Affected choices and reachable repair" and LEDG-12.
- **No reference repair.** Saving a removal just deletes the entity. The prototype has no orphaned-reference state and no **Restore missing team/settlement/item/cache** path. Implement both single-edit repair and same-identity restoration through ordinary reasoned section corrections, restoring items before caches. See §5 "Concrete recovery using existing contracts" and LEDG-13, and tickets #176 and #177.
- **Flat mock merge.** `mergeSection` overwrites flat top-level keys (`items`, `teams`, `skillBenefits`, and so on). The real save must replace only `roster.teams`, `settlements`, `characterActions.people`, `economy.items/caches/orders/markets` or `eventBenefits.skills/markets`. Never replace a whole `roster` or `economy` container. See §5 "Exact section projection and merge".
- **Reduced fields and read-only facts.**
  - Values: treasury shows in gp, not copper.
  - Conditions: only `captured / in_refuge / missing`, with no location type, PCs-must-rescue, capture source or rescued/restored weeks.
  - Orders: no due day, delivery days, decimal enchantment or receipt record/clear.
  - Caches: no contents or return week.
  - Skill benefits: free-text characters, with no bonus type, settlement, after-dark or start week.
  - Week & carried effects: no persistent-event targets or age.
  - Validation accepts whole numbers only.

  See the §5 projection table, LEDG-02, LEDG-04 and LEDG-08.
- **An unlinked error summary.** The save point shows "N fields to fix above." with no links. Use a linked save summary that separates empty-required values from malformed ones. Hard-coded amber colours and native checkboxes must become shadcn/ui components and theme tokens. See §3, §5 "Validation and later migration" and LEDG-07.
