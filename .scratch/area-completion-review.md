# Area completion review: #140, #144, #146, #147, #139

Read-only review of `implement/148-ui-rework` at `ab6983e`, on 2026-09-28. Evidence: the green gate `everythingpath-e2e-6PN4oh` at `7067217` (39/39, first attempt, artifacts in `e2e-artifacts/e2e-local-andreasununger-slot-0/everythingpath-e2e-6PN4oh/`), `rules:check` with 0 errors, ticket completion comments, `docs/ui-capability-inventory.md` and the code. `ab6983e` adds only #165 event work after the gate.

**Gate shape.** `canonical-workspace` journeys run only in Chromium at 1194x834, with phone/desktop resize loops in specific steps (`e2e/canonical-workspace.spec.ts:336,377,719,1048`). The WebKit, Firefox and phone projects run the shell, home, access, legacy, character, complete-week and existing-militia specs, not the phase editors. While this review ran, HEAD moved to `307091d` (#190, Activity details); it touches none of these five areas.

**Cross-cutting finding.** The inventory still says "not run" on 34 lines (29-80 and rows 230-339), including the paragraphs and rows for #157, #158, #167, #168, #175, #178, #184, #185, #187 and #189. It does not mention `6PN4oh` anywhere. #148's gate requires "actual shipped locations and coverage", so every area below needs one inventory refresh recording the green gate. This is one small docs commit, not five.

## Summary

| Area | Shippable bullets | Inventory | Verdict |
| --- | --- | --- | --- |
| #140 Upkeep | 6 Met, 2 Partly (responsive, inventory) | Stale "not run"; UPK-02/07/09 coverage wrong | Not ready (2 small items) |
| #144 Persistent | 4 Met, 2 Partly (layout, states), 1 Mostly | PER complete; WEEK-13 stale | Not ready (2 items + 2 decisions) |
| #146 Finished weeks | 3 Met, 3 Partly (inventory, layout, a11y), 1 Mostly | HIST-02/04/05/06/08, NAV-12, route stale | Not ready (1 browser step + docs) |
| #147 Campaign home | 4 Met, 2 Partly (inventory, layout) | CAMP-12 wrong journey; lines 78/80 stale | Not ready (3 small items) |
| #139 Militia corrections | 3 Met, 3 Partly (phone, states, inventory) | LEDG-03/04/12/13 stale; #176/#177 unnoted | Not ready (3 small items) |

No functional defects were found in any area. The focused vitest runs all pass: Upkeep 125, Persistent 106, history 97, home/shell/campaign 118, corrections 137. Every area is blocked mainly by stale inventory and by one or two missing browser layout checks.

## #140 Upkeep (#154-#158)

**Shippable when (§8)**
- Bullets 1, 2, 4, 6, 7: **Met**. The dice-total readers and writers, rules-ordered sections, rank boons, characterless transfers and first-week skip all have unit and journey coverage (`canonical-workspace` Upkeep, settlement and recovery journeys, green in 6PN4oh).
- Bullet 3 (compatibility): **Met**, with one hole. Both transfer forms (with and without an actor) are proved only in `convex/characterlessTransfers.integration.test.ts:72`. The live `canonical-persistence` contract that §6 names doesn't exercise them.
- Bullet 5 (responsive): **Partly met**. The settlement cards, rank feat cards, missing-team row and Remove repair appear only in the settlement/rank journey (`e2e/canonical-workspace.spec.ts:437-558`). It never leaves 1194x834.
- Bullet 8 (inventory): **Partly met** (see below).

**Capability accounting.** UPK-08, UPK-10 and the notes at lines 29 and 33 still say "not run". Line 27 says the correction warning was "left to #139", but it shipped and #178 later retired it. UPK-07 omits its browser coverage (`e2e/support/team-conditions.ts:31-45`). UPK-09 claims browser coverage of the withdrawal-funds exception, but only unit tests cover it. UPK-02 is unit-only, which is accurate.

**Deferred limits.** #158 left rendering unverified at phone, tablet and desktop. The gate has since run the transfer journey, but only at the default tablet size. This is a real gap only for the bullet-5 content listed above.

**Verdict: not ready.** Remaining:
1. Refresh the UPK rows and the notes at lines 27/29/33, citing 6PN4oh.
2. Add 390x844 and 1440x900 overflow/reachability checks for the settlement, feat, missing-team and Remove-repair content, or record an equivalent manual QA pass.
3. Optional: add both transfer forms to `tests/persistence/contracts.ts`, and link the transfer departure note from `militia-rules.md:55`.

## #144 Persistent (#167, #168)

**Shippable when (§8)**
1. PER-01..10 and shared IDs: **Met**. Every PER row names real shipped files, and the PER-05/PER-09 removals keep their sign-offs (inventory lines 289-298).
2. Real preview, Leave it, table endings, no cost entry: **Met**. Browser: `e2e/support/persistent-workspace.ts:34-86`. Unit: `persistent-facts.test.ts`, `persistent-check-facts.test.ts`.
3. Same-week Event, eligibility, Overseer: **Met**. Evidence: `rules-persistent-events.test.ts:44`, `canonical-workspace.spec.ts:850`, `src/lib/overseer-support.test.ts:178-298`.
4. Compatibility, isolation, immutable records: **Met**. The persistence, confirmation and access projects pass, and the journey inspects the confirmed record (`canonical-workspace.spec.ts:813-852`).
5. Layout: **Partly met**. Checked at 1194x834, 390x844 and 1440x900 (`e2e/support/persistent-qa.ts:74-106`). §6 also requires phone landscape (844x390) and tablet 1180x820 with the panel closed; neither is run.
6. States: **Partly met**. Loading uses the generic `WeekSkeleton` (`week-frame/week-frame.tsx:222`). No UI test covers an eligible phase in which every event has ended.
7. Evidence: **Mostly met**. PER-10 honestly lists no browser coverage. #144 has no completion or closing comment yet.

**Capability accounting.** No PER row is missing or still planned. WEEK-13 (line 209) still says cards are used "for every single choice ... or drag". It doesn't mention Persistent's tap/keyboard-only cards. The #167/#168 notes (lines 56/58) say "not run".

**Deferred limits.**
- #167, "half-typed ending lost on phase switch": **borderline real gap**. The ending form isn't wired into the store's unsaved-form guard (`store.ts:59`), and §6.3 forbids a hidden decision confirming unintentionally.
- #168, retained unused fields are remove-only where §5 says "editable/clearable": this **needs an explicit decision**.

**Verdict: not ready.** Remaining:
1. Add 844x390 and 1180x820 panel-closed passes to `persistent-qa.ts`.
2. Wire "Ended at the table" into the unsaved-form guard, or record acceptance.
3. Decide on remove-only retained fields.
4. Fix WEEK-13 and the line 56/58 notes. Accept the frame skeleton for bullet 6, or add a Persistent-shaped one.

## #146 Finished weeks (#184, #185, #197; #186 merged into #184)

**Shippable when (§8)**
1. HIST-01..08 covered, evidence recorded: **Partly met**. The code and tests exist, but the inventory is stale.
2. Selection, paging, direct-link dates, reload, Back/Forward, bounded reads, home uses the list: **Met in code, browser coverage partial**.
   - Tests: `screen.test.tsx:391,473,536,568`, `canonicalHistory.integration.test.ts:500,646,697`.
   - The home requests limit 3 (`use-campaign-home-content.ts:121`).
   - The browser covers only a one-entry week (`canonical-confirmation.spec.ts:441-490`).
3. Facts come only from the selected record: **Met**. Evidence: `record-review.test.ts:326-340`, `canonical-confirmation.spec.ts:436-445`.
4. Responsive layout: **Partly met**. The gate checks no overflow at 390 and 1440, but with only one seeded week. The single expanded phone row, the wider desktop index and clearance above the bottom tabs are never seen.
5. Accessibility: **Partly met**. The markup is present (`finished-week-pane.tsx:84-88`, `finished-weeks-index.tsx:43`), but nothing tests keyboard use or focus.
6. States, access, no editing: **Met**. Evidence: `screen.test.tsx:655-719`, outsider check at `canonical-confirmation.spec.ts:365-371`.
7. Checks pass: **Mostly met**. 6PN4oh is green, but not recorded.

**Capability accounting.**
- HIST-02/04/05/06 (lines 325-329) say "`canonical-confirmation` (written, not run)". HIST-08 (line 331) says "`canonical-cutover` (written, not yet run)". Both passed in 6PN4oh.
- The notes at lines 50/52/54 are stale.
- Line 116 says `canonical-confirmation` covers "no item here".
- NAV-12 lists "—", but the return link is clicked at `canonical-confirmation.spec.ts:492`.
- The HIST header (line 320) gives the route as `/canonical-history`.
- #186's scope did land (`use-audit-trail.ts`, `use-audit-ordinal.ts`; `createdAt` via #197).

**Deferred limits.** #184's "no browser coverage of paging, the single expanded phone row or keyboard use" is a **real gap**: §6 item 6 explicitly requires phone/tablet/desktop checks with five-entry paging and keyboard/focus, and nobody signed off dropping it.

**Verdict: not ready.** Remaining:
1. Extend the history step in `canonical-confirmation`. Seed a non-adjacent second week and six or more entries on one week. Page with Earlier entries, select an entry and reload. Check the gap-aware arrows. Check one expanded row and bottom-tab clearance at 390px and both panes at 1440px. Use Tab/Enter on the index and entries.
2. Refresh the HIST/NAV-12 rows and the notes at lines 50-54, 116 and 320.

## #147 Campaign list and home (#187, #189; #188 merged into #187)

**Shippable when (§8)**
1. Capability evidence recorded accurately: **Partly met** (see below).
2. Routes, selection, create, editing, partial-save recovery: **Met**.
   - `src/components/campaign-home/home-state.ts:68-124`
   - `use-campaign-home.test.ts`, `header-editor.test.ts`
   - The `home` journey (`e2e/support/campaign-home.ts`) edits and clears the description and date, with reload, Back/Forward and a second member watching. Green on all four browser projects in 6PN4oh.
3. Continue week, current facts, latest three weeks, scoped links: **Met**. `continue-week.ts:31-44` reuses `derivePhaseReadiness`. The home makes one history-list call and mounts no week editor.
4. Tablet/phone/desktop layout: **Partly met**. The classes match the spec (`campaign-home-view.tsx:78,117`). Browser checks cover only overflow, reachability and focus, and 6PN4oh has no campaign-home screenshots. The phone create form has never been seen in a browser. The route loading fallback is plain text, not the skeleton (`src/app/campaigns/loading.tsx:1-7`); #187 already notes this as a known limit.
5. Shell controls, states, maintenance: **Met**. Minor: phone rows expose only `aria-current`, so a screen reader can't tell which row is expanded.
6. Checks pass; only the two approved backend changes ship: **Met**. Evidence: `convex/campaign.integration.test.ts:51-179`.

**Capability accounting.** CAMP-01..12 all exist with real files.
- CAMP-12 (line 155) names `access` as its browser coverage, but the edit happens in `home`.
- Lines 78/80 say the journeys weren't run, and line 80 still records `rules:check` as failing.
- NAV-10 (line 130) omits the home's finished-week links. CAMP-10 covers them, so this is minor.
- #188's scope landed in #187: `updateCampaignDescription`, its tests and the CAMP-07/12 rows.

**Deferred limits.**
- No browser test of creating a campaign, because the fixtures can't clean up UI-created campaigns. **Acceptable**: backend and component tests cover it. It does leave the phone create layout unseen.
- The WebKit `access` journey runs about 58 s against its 60 s limit: a reliability risk, not a spec gap.

**Verdict: not ready.** Remaining:
1. Fix CAMP-12 and the line 78/80 notes, citing 6PN4oh.
2. Capture phone, tablet and desktop screenshots of the home, including the create form and edit mode, or assert layout in the `home` journey.
3. Use `CampaignHomeSkeleton` in `loading.tsx`, or record the plain-text fallback as an accepted deviation.

## #139 Militia corrections (#175-#178)

**Shippable when (§8)**
1. Nine isolated sections, the read-only week view, one-open/reason/validation at all sizes: **Partly met**.
   - Component coverage: `militia-page.test.tsx`, `assets.test.tsx`, `conditions-benefits.test.tsx`, `teams-settlements.test.tsx`, `people-fallback.test.tsx`.
   - Browser editing: `existing-militia` on WebKit/Chromium tablet and Firefox desktop.
   - On phone, `campaign-sections` only checks that **Correct values** is reachable. Nobody has checked that the reason bar (`section-correction.tsx:176-198`) clears the bottom tabs without covering fields.
2. Merge, conflict, race, new week, unknown acknowledgement: **Met**. Evidence: `correction-lifecycle.test.ts:91-340`, `convex/militiaCorrection.integration.test.ts:78,168,260`.
3. Orphan repair and restoration: **Met**. Evidence: `convex/referenceRestoration.integration.test.ts:147,361,476,625`, `realtime-action-slot.spec.ts:70-160`.
4. People & officers fallback, managers in Teams, contracts: **Met**. Evidence: `character-ledger.spec.ts:33-65`, the canonical projects green.
5. States: **Partly met**. Loading and no-militia are tested (`militia-page.test.tsx:187`), and a maintenance refusal keeps input. But the failure state has no test. §6.6 requires one (LEDG-10), and nothing tests `src/app/campaigns/[campaignId]/error.tsx` or `FailedLoadCard`.
6. Glossary and inventory: **Partly met**. The glossary entry is at `CONTEXT.md:58`; the inventory is stale.

**Capability accounting.** LEDG-01..13 all exist (lines 343-355), and their files exist.
- LEDG-03/04/12/13 still say "written, not yet run".
- The notes at lines 337/339 say "not run".
- #176 and #177 have no validation note.
- LEDG-07..10 list no coverage, although component and Convex tests back them.

**Deferred limits.** These are all **acceptable** per §5/§7:
- #175: the retry after an unknown acknowledgement is bound to the same revision.
- #176: the repair link opens the phase, not the slot, and there is no leave guard.
- #177: item and cache restoration is proved in Convex, not the browser.
- #178: a stale refusal in the fallback can only be escaped with Cancel.

The setup controls below phone touch size predate #139 (#177 note). Look at them during the phone check.

**Verdict: not ready.** Remaining:
1. Refresh the LEDG rows and notes, citing 6PN4oh, and add the #176/#177 notes.
2. Add a component test for the `/militia` failure state and its **Try again**.
3. Run a 390x844 check with a correction open (Values and a long list), recorded by screenshot or a chromium-phone step.
4. Optional: a Teams test for a manager removed meanwhile.
