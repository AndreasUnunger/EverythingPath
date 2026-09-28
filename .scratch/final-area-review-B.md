# Final area completion review B: #143, #144, #145, #146, #147

This is a read-only review of `implement/148-ui-rework` at `9589fe1`, done on 2026-09-28.

**Evidence used**
- **Gate `everythingpath-e2e-YIg0cp`:** 40/40 journeys passed on the first attempt with 0 errors. The run started at 08:28:45Z, 22 s after `9589fe1` was committed. The only `failed` stage in `stages.log`/`timings.jsonl` is the production server being stopped after the journeys passed.
- **Other checks:** `rules:check` reports 0 errors. I also read the ticket completion comments, the inventory and the code.

**Cross-cutting findings**
1. **The inventory does not mention `YIg0cp`.** It was last edited at `ea9cb05`, before the gate ran. Everything it still marks "gate pending" or "written but not run" in these five areas ran and passed in YIg0cp:
   - Notes at lines 41, 54, 58, 86, 90 and 131.
   - Rows PER-01, PER-06, SUM-02, SUM-05, HIST-02, HIST-03, HIST-04, HIST-08, CAMP-03, CAMP-12 and STATE-02.

   The screenshots prove these checks ran: `reviewer-persistent-phone-landscape.png` and `-tablet-narrow-closed.png`, `canonical-history-entries-*.png`, `campaign-home-*-{phone,tablet,desktop}{,-edit,-create}.png` and `-skeleton.png`. One docs commit citing YIg0cp fixes all of these.
2. **Every phase uses the same loading skeleton.** The only week skeleton is the generic `WeekSkeleton` (`src/components/weekly-draft-workspace/week-frame/week-frame.tsx:230`), used at `board.tsx:213`. The specs ask for phase-shaped placeholders: Event-shaped (#143 §7), Persistent-shaped (#144 §8 bullet 6) and Review-shaped (#145 §8 bullet 6). No decision accepting the generic one is recorded. One decision covering all three areas would settle it.

## Summary

| Area | §8 bullets | Inventory | Verdict |
| --- | --- | --- | --- |
| #143 Event | 4 Met, 2 Partly (layout, loading) | Locations complete; EVT-06 under-claims coverage | **Not ready** (2 small items + skeleton decision) |
| #144 Persistent | 5 Met, 2 Partly (retained fields, skeleton) | PER-01/PER-06 and line 58 stale | **Not ready** (2 decisions + docs) |
| #145 Review & confirm | 4 Met, 3 Partly (browser coverage, layout, loading) | SUM-02/05 and line 41 stale; SUM-09/11 have no browser coverage | **Not ready** (1 browser step + docs + skeleton decision) |
| #146 Finished weeks | 7 Met | HIST-02/03/04/08 and lines 54/131 stale | **Ready once the docs refresh lands** |
| #147 Campaign home | 6 Met | CAMP-03/12, STATE-02 and line 86 stale | **Ready once the docs refresh lands** |

## #143 Event (#163, #164, #165, #166, #191, #192, #193)

**Shippable when (§8)**
1. EVT-01..14 and shared obligations: **Met**. Rows 284-297 name real files. The retired controls (manual add controls, the Remove extra Event control, the generic shell) cite the #108 approval and the #143 ownership comment.
2. Occurrences converge; branches and ownership are kept: **Met**. Evidence: unit tests `event-occurrence-preparation` and `event-preparation`; #164's two-device store and Convex tests; `ws:event` Roll Twice hide/restore.
3. Reputation fix, reroll regression, Ruleset Version 7 with client/server parity: **Met**. Evidence: #191 and convex-test `rules.A10.reroll-parity`.
4. Mitigation, checks, Sabotage, Overseer and outcomes with both roll forms: **Met** in unit, component and store tests. The Sabotage/Overseer browser journey is a tracked follow-up.
5. Layout and states: **Partly met**.
   - `event-workspace.ts:224-249` checks only 1194, 390 and 1440 px. §7 also requires phone landscape, and the 1180 panel-closed pass that Persistent now has is missing here.
   - Loading uses the generic skeleton (cross-cutting finding 2).
6. Inventory and checks: **Met**. One under-claim: EVT-06 lists only unit tests, but the Guarantee Event candidate step (`e2e/support/activity-workspace.ts:325-400`, #190) exercises **Choose this event** and the in-place candidate reroll. That step passed in eyuUJ6 and YIg0cp.

**Known limits**
- #191's "no Guarantee Event Roll Twice browser path" has since been **closed** by #190.
- Sabotage/Overseer browser journey and the unlabelled "Clear" in the roll field: **tracked**.
- #165's native Alchemical/Poison checkboxes are a small deviation from the shadcn rule. **Record it as accepted.**
- #165's Market Day doesn't recalculate Activity purchases: **acceptable**, because the engine is unchanged and no new API is allowed.
- #193's "Edit details" disclosure repeats the party level: cosmetic.

**Verdict: not ready.**
1. Add 844x390 and 1180x820 (panel closed) to the Event layout loop, with `expectBoundedWeekHost`.
2. Accept the frame skeleton or add Event placeholders.
3. Cite `ws:activity` on EVT-06, then post the area completion comment.

## #144 Persistent (#167, #168)

**Shippable when (§8)**
1. PER-01..10 with the PER-05/PER-09 removals: **Met** (rows 305-314).
2. Overview, cards, Leave it reset, table endings, no cost entry and no Clear button: **Met** (`persistent-workspace.ts:55-100`).
3. Same-week Event, fixed eligibility, shared Overseer: **Met**. Evidence: `rules-persistent-events.test.ts:44`, `use-weekly-draft-workspace.test.tsx:362`, `overseer-support` tests.
4. Compatibility, isolation, immutable records: **Met**. The persistence and confirmation contracts pass, and the journey inspects the confirmed record (`canonical-workspace.spec.ts:813-857`).
5. Layout: **Met**. This was a gap in the earlier review. Now covered:
   - `persistent-qa.ts:79-146` runs 1194, 390, 1440, 844x390 and 1180x820 with the panel closed, checking reachability and the bounded host.
   - `9589fe1` fixed the pinned chrome.
6. States: **Partly met**. The all-ended state is honest and was seen in the browser (`persistent-qa.ts:147-156`), but the skeleton is the generic frame one.
7. Evidence: **Met** once the docs refresh lands.

**Retained fields: Partly met.** Retained unused fields are remove-only (`persistent-retained-details.tsx`; PER-04 says "listed and removable"). §5 says "editable/clearable". This is still undecided and is not on the tracked list.

**Earlier gap closed.** The unfinished-ending guard is now wired in: PER-06 row, `persistent-ending-guard.ts`, `store-ending-forms.test.ts`, and the half-typed ending step passed in YIg0cp. Typed text lost on a *rejected* ending is **tracked**.

**Verdict: not ready.**
1. Record acceptance of remove-only retained fields, or make them editable.
2. Make the skeleton decision.
3. Refresh PER-01, PER-06 (row 310 still says "written but not run") and line 58. Cite the `week-frame.ts:65-75` "No carried events" check on PER-10.

## #145 Review & confirm (#169, #170, #171, with #194)

**Shippable when (§8)**
1. SUM-01..11 have coverage: **Partly met**.
   - §4 requires *browser* coverage for SUM-09 (Warnings in the block, placement) and SUM-11 (inline acknowledgements).
   - Both rows still list `—`, and no e2e asserts either. The Event journey records Invasion's What happened, but Review never checks it.
2. Review block and six sections match B: **Met**. Evidence: `summary-qa.ts:122-190` (section order, changed-only/Show all, all four adjustment kinds, gp values, reorder).
3. No unsubmitted form mistaken for saved; conflicts; Confirmation contracts: **Met**. Evidence: `summary-confirm-guard.test.tsx`, `store-local-forms.test.ts`, and the racing journey (`canonical-workspace.spec.ts:859-1125`, Go to Upkeep focus, leave-and-return).
4. Live and frozen presentation are separate: **Met** (`record-review.test.ts`, #194 import-boundary test).
5. Layout: **Partly met**. `summary-qa.ts:189-193` checks only 1194, 390 and 1440 px. The phone landscape and 1180 panel-open/closed passes from §6 are missing, and so is a bounded-host assertion on Review.
6. States: **Partly met**, because of the generic skeleton. The other states are honest.
7. Checks: **Met**. Journeys passed in YIg0cp.

**Known limits**
- #169's clipping reason field: fixed by #170.
- #170's "another kind card discards an open new form" and "remote change during a save shows the generic failure": **acceptable**. Both are ordinary local-form and failed-save behaviour, and neither is a false save.
- #171 has none.

**Verdict: not ready.**
1. Add browser assertions for the Warnings list and an inline acknowledgement (for example Invasion's What happened) in Review.
2. Add 844x390 and 1180x820 open/closed passes to `summary-qa`.
3. Make the skeleton decision.
4. Refresh SUM-02, SUM-05 and line 41.

## #146 Finished weeks (#184, #185, #186 merged into #184, #194, #197)

**Shippable when (§8)**
1. HIST-01..08 and replacements: **Met**; only the docs are stale.
2. Selection, arrows, five-entry paging, dates, reload, bounded list, home uses list(limit 3): **Met**.
   - Browser: `e2e/support/finished-weeks.ts:26-104` covers two non-adjacent weeks, arrows skipping week 2, seven entries paged, and **Earlier entry 1 of 7** across reload.
   - Backend: `canonicalHistory.integration.test.ts`.
3. Facts only from the selected record: **Met** (`record-review.test.ts`; unchanged after a live treasury change).
4. Responsive layout: **Met** (`finished-weeks.ts:105-155`). The phone view has one expanded row and every control above the bottom tabs; tablet and desktop show both panes. Confirmed visually in `canonical-history-entries-phone.png`.
5. Accessibility: **Met**. `aria-expanded` and Tab/Shift+Tab/Enter are tested in the browser. The heading scrolls into view without moving focus (`finished-week-pane.tsx:83-88`), and loading uses a `role=status` element.
6. States, access, no editing: **Met** (`screen.test.tsx`, outsider checks).
7. Checks: **Met** (YIg0cp).

**Known limits.** #184's "no browser paging, phone row or keyboard" is **closed** by `790f577`/`73690ad`, and those steps passed in YIg0cp. #197's `beforeRecorded:false` and #185's helper duplication are acceptable.

**Verdict: ready to close once the inventory refresh lands.** Update HIST-02/03/04/08 and lines 54 and 131, citing YIg0cp.

## #147 Campaign list and home (#187, #188 merged into #187, #189)

**Shippable when (§8)**
1. CAMP-01..12 evidence: **Met**. CAMP-12 now correctly cites `home`. CAMP-03, CAMP-12, STATE-02 and line 86 still say "gate pending".
2. Routes, default, create returns its ID, partial-save recovery: **Met** (`use-campaign-home.test.ts`, `header-editor.test.ts`, `campaign.integration.test.ts`).
3. Continue uses readiness, latest three via `list`, scoped links, no next up: **Met** (`continue-week.ts`, #189).
4. Layout and loading: **Met**. This was a gap in the earlier review. Now covered:
   - `campaign-home-layout.ts:49-104` checks the home, the editor and the create form at three sizes on all four projects, with the phone row expanded above its home.
   - The skeleton step passed.
   - `(list)/loading.tsx` now renders `CampaignHomeSkeleton`.
5. Shell, focus, states, maintenance: **Met**. Minor: phone rows are links with `aria-current`, and there is no `aria-expanded` on the expanded row. That is acceptable for navigation links.
6. Checks and only approved backend changes: **Met**. The changes are the two mutations plus the recorded `workspace.week` amendment.

**Known limits**
- No browser campaign creation (fixture cleanup): **acceptable**. The form layout is covered in the browser; the create behaviour is covered in unit and backend tests.
- #189's "no live visual QA": **closed** by the YIg0cp screenshots.
- The WebKit `access` runtime is 11.9 s now that the journey is split: resolved.

**Verdict: ready to close once the inventory refresh lands.** Update CAMP-03, CAMP-12, STATE-02 and line 86.
