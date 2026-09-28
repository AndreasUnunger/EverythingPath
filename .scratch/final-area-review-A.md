# Final area review A: #138, #139, #140, #141, #142

This is a read-only review of `implement/148-ui-rework` at `9589fe1`, done on 2026-09-28.

**Evidence:**
- **Gate `everythingpath-e2e-YIg0cp`:** 40/40 journeys, all on the first attempt with no retries (`progress.json`). It started at 08:28:45Z, 22 s after `9589fe1` was committed. `#183` also cites this gate.
- **Server stage:** the "production application server: failed" line at teardown also appears in `eyuUJ6`. The journeys are unaffected, so it isn't a gap.
- **Other sources:** `rules:check` (0 errors), the completion comments, `docs/ui-capability-inventory.md` and the code.

**Cross-cutting finding.** The inventory never mentions `YIg0cp`. Its gate refresh (line 90) is still anchored on `6PN4oh`/`eyuUJ6`. Rows and notes for journeys that passed in YIg0cp still say "gate pending" or "written, not yet run":
- **Notes:** lines 33, 78, 80, 82, 90 (the #140 and #139 bullets) and 357.
- **Rows:** 149 (NAV-13), 200/202/204 (SETUP-22/24/26), 242/243/245/246/248 (UPK-04/05/07/08/10), 363/364/371 (LEDG-03/04/11), 381–384/388/390/392 (CHAR-01–04/08/10/12). Line 129 (`shell`) is shared.

One docs commit that cites YIg0cp and its commit fixes all of these. It's the only remaining item for #139 and #140.

## Summary

| Area | Shippable bullets | Inventory | Verdict |
| --- | --- | --- | --- |
| #138 Setup | 4 Met, 2 Partly (layout, inventory) | SETUP-22/24/26, NAV-13 stale; 7 rows omit component tests | Not ready (docs + 1 small browser check) |
| #139 Militia corrections | 5 Met, 1 Partly (inventory) | LEDG-03/04/11 and line 357 stale | Not ready (docs only) |
| #140 Upkeep | 7 Met, 1 Partly (inventory) | UPK-04/05/07/08/10 and line 33 stale | Not ready (docs only) |
| #141 Characters & officers | 3 Met, 2 Partly (breakpoints, inventory) | 8 CHAR rows and LEDG-03 stale; line 78 cites a closed migration | Not ready (docs + phone/desktop correction pass) |
| #142 Activity | 3 Met, 2 Partly (layout/touch, reconciliation evidence) | Accurate; ACT-03 retirement recorded | Not ready (browser checks §6 names) |

No functional defects found. All earlier-review items for #139 and #140 are verified closed.

## #138 Setup (#172, #173 with #174, #195)

**Shippable when (§8)**
1. Nine steps, fields, advisory warnings, review links: **Met**.
   - Browser: `ws:setup` (`e2e/support/setup-workspace.ts:167-184`, the Rank summary link focuses the field).
   - Component: `guided.test.tsx` `[setup.guided.warnings]`, `[setup.guided.phone]`, `[setup.event-instances]`, `[setup.receipt-decimal]`.
2. Resume and reactive characters: **Met**. `existing` walks all nine steps, resumes after reload and adds a recruit inline on Chromium, WebKit and Firefox 1440×900. `screen.test.tsx:429` covers the reactive arrival.
3. Started page, race, one-time phase entry: **Met**. Evidence: `screen.test.tsx:291,350,529`, `ws:setup` (Event entry).
4. Breakpoint layout, no obscured controls: **Partly met**.
   - The browser checks only horizontal bounds, at 1194 and 390 (`setup-workspace.ts:140-163`).
   - Nothing checks that the phone's inline **Next** or the sticky footer clear the bottom bar.
   - Desktop is exercised only functionally, on Firefox.
5. Correction editor after extraction: **Met**. The shared editors now back Militia corrections (#195); #178 retired the old form.
6. Glossary (`CONTEXT.md:14`) and inventory: **Partly met**. SETUP-22/24/26 and NAV-13 are stale. SETUP-09–14 and 16 show "—" without naming their component tests (`guided.test.tsx`, `editors.test.tsx`).

**Known limits** (all acceptable):
- #172: a copied width hook; generic malformed-input summaries (linked errors exist).
- #195: first-entry-only error location; duplicate event identity falls back to the summary.
- #173: no two-member browser test of the inline character; component tests and `ledger` cover it.
- Setup touch size: tracked follow-up.

**Verdict: not ready.**
1. Refresh the four stale rows, and name the component coverage for SETUP-09–14 and 16.
2. Add `expectReachable` for the open step's controls and **Next**, plus a 1440×900 pass, to the Setup layout loop.

## #139 Militia corrections (#175–#178)

**Shippable when (§8)**
1. Nine sections, carry view, one open, reasons, all sizes: **Met**.
   - Component: `militia-page.test.tsx`, `assets.test.tsx`, `teams-settlements.test.tsx`, `conditions-benefits.test.tsx`.
   - Browser: `existing` on three projects.
   - New phone check: `e2e/support/militia-phone.ts`, in `campaign-sections` on all four projects in YIg0cp, with `militia-correction-*-phone.png`.
2. Merge, conflict, race, unknown acknowledgement: **Met**. Evidence: `correction-lifecycle.test.ts`, `convex/militiaCorrection.integration.test.ts`.
3. Affected choices and orphan repair: **Met**. Evidence: `referenceRestoration.integration.test.ts`, `slot` (#176 steps).
4. Roster/officer reachability, managers in Teams: **Met**. #183 retired the fallback with a field-by-field mapping (inventory line 82).
5. States: **Met**. The earlier gap is closed by `militia-failure.test.tsx`, which tests the failure card and **Try again**.
6. Glossary (`CONTEXT.md:58`) and inventory: **Partly met**.
   - LEDG-03 ("written, not yet run") is stale, as are LEDG-04/11 and line 357 ("gate pending").
   - Line 355 still maps roster fields to "the People & officers fallback". Line 351 corrects this, but line 355 reads stale.

**Known limits** (all acceptable per §5/§7):
- #175: Save is re-offered after a lost acknowledgement; revision binding keeps it safe.
- #176: the repair link opens the phase, not the slot; there's no mid-correction leave guard, which predates #139.
- #177: item and cache restoration is proved in Convex only.
- #178: after a stale refusal, Cancel is the only way out.
- Setup touch size: tracked follow-up.

**Verdict: not ready (docs only).** Refresh LEDG-03/04/11 and lines 355/357, citing YIg0cp.

## #140 Upkeep (#154–#158)

**Shippable when (§8)**
- **Bullets 1–4, 6 and 7: Met.**
  - The dice-total readers and writers, rules order, rank boons (Ruleset Version 6 for transfers) and the Remove repair are all covered.
  - Both transfer forms are now in the persistence contract (`tests/persistence/contracts.ts:1137-1177`); `canonical-persistence` passed in YIg0cp.
  - The departure note is linked from `militia-rules.md:55`.
- **Bullet 5 (responsive): Met, a closed gap.**
  - The `workspaceUpkeepLayout` journey (`canonical-workspace.spec.ts:1129`, `e2e/support/upkeep-layout.ts`) checks settlement cards, the missing-team row, the staged-Remove repair and the feat cards at 390×844 and 1440×900.
  - Controls are checked for reachability, fitting labels and no overflow. It passed in YIg0cp, with `canonical-upkeep-{rank,repair}-{phone,desktop}.png`.
  - `1da1fba` fixed the Remove link widening the phone view by 51 px.
- **Bullet 8 (inventory): Partly met.**
  - UPK-04/05/07/08 ("`workspaceUpkeepLayout` … gate pending"), UPK-10 (contract "gate pending") and line 33 are stale.
  - The earlier findings are fixed: UPK-09 is now unit-only, UPK-07 cites `team-conditions.ts`, and line 27 no longer says "left to #139".

**Known limits:**
- #157, feat cards are tap/keyboard only: acceptable. WEEK-13 says drag is kept only "where still provided". WEEK-13 (line 225) could name the feat cards alongside Persistent.
- #158, no phone/desktop pass: closed by the layout journey.
- #155, Special Order delivery isn't in the browser fixture: acceptable, since component and rules tests cover it.

**Verdict: not ready (docs only).** Refresh UPK-04/05/07/08/10 and lines 33/90 to cite YIg0cp. Optionally, add the feat cards to WEEK-13.

## #141 Characters & officers (#179, #180, #181 closed as not planned, #182, #183, #196)

**Shippable when (§8)**
1. Board, table, corrections and dialog at all three breakpoints: **Partly met**.
   - Real-browser coverage:
     - The table/cards and dialog, with reachability on phone and desktop plus a cross-layout edit (`nightly-flows.ts:13-80`, `access` on four projects).
     - **Correct roster** / **Correct officers**, only at 1194×834 (`character-ledger.spec.ts`, Chromium and WebKit tablet).
   - Not seen in a real browser: the phone inline Assign picker, the desktop floating panel and the correction reason bar at 390/1440. #182/#183 checked them only in a mock-data harness, and §6 item 7 requires them.
2. Consistency, merges, conflicts, repair: **Met**. Evidence: `characters-corrections.test.tsx`, `roster-week-impact.test.ts`, and `ledger`'s two-session conflict with Start again (YIg0cp).
3. PC/NPC authority, mirrors, envelope v2: **Met**. The live-row migration was dropped on a recorded production check and user decision (#181), and it's recorded in `legacy-compatibility-inventory.md:475`.
4. Role-aware limits, commandant fallback, Ruleset Version 8: **Met** (#196).
5. Fallback retired after equivalence, Officer glossary entry (`CONTEXT.md:74`), inventory: **Partly met**.
   - CHAR-01–04/08/10/12, LEDG-03 and lines 78/80/82 say "not run".
   - Line 78 still defers to "the live-data migration (#181)".
   - CHAR-05/06/07/09/11/13 show "—" without naming `characters-page.test.tsx`.

**Known limits:**
- Joining the roster with missing facts: tracked follow-up.
- The hand-built ⋯ menu, Assign panel, switch and table go against AGENTS.md's shadcn default. That's a Standards decision, not a spec gap.

**Verdict: not ready.**
1. Refresh the inventory, including the line-78 #181 wording and component coverage.
2. Add a 390×844 and 1440×900 pass that opens Correct officers (Assign) and Correct roster, checks reachability of the picker and reason bar, and cancels. This mirrors `militia-phone.ts`.

## #142 Activity (#159 with #160, #161, #162, #190)

**Shippable when (§8)**
1. ACT-01–19 accounted for, ACT-19 server-validated: **Met**. Every ACT row names shipped files and honest coverage; ACT-03's retirement is recorded, and ACT-19 is in the persistence contract and `canonicalDraftPersistence.integration.test.ts`.
2. Layouts, touch/keyboard, no clipped controls: **Partly met**.
   - Browser: keyboard picker open/close with focus return (`activity-workspace.ts:201-207`), and horizontal overflow only at 1194/390/1440 plus the phone picker (`:275-298`).
   - §6 also requires:
     - phone landscape and 1180×820. Neither is run, and `1da1fba` changed the slot cards for short viewports without an Activity check.
     - "actual touch-capable browser coverage" of panning on cards, which #159 lists as untested.
     - reachability rather than overflow alone.
3. Shared edits and reconciliation: **Partly met**.
   - Covered in the browser: stale replacement, two-member edits, reload and `slot`.
   - §6 also asks for real two-member tests of "allowance changes via corrections" and "a Confirmation arriving while a picker is open". The latter is component-only (`activity-board-view.test.tsx:757`), and §6 says "do not claim browser coverage from a component test".
4. Rule behaviour: **Met**.
5. Inventory and checks: **Met**.

**Known limits:**
- Acceptable: grouping by ready team (teams are the actors), Helpful needing the roll first, and "What happened" predating this area.
- Resolved: the #190 candidate editor (`5244006`).
- 32 px remove buttons meet WCAG 2.5.8; treat them with the touch-size follow-up.
- The roll field's unlabelled "Clear": tracked follow-up.

**Verdict: not ready.**
1. Add 844×390 and 1180×820 passes with `expectReachable` on the details and picker.
2. Add one touch pan on the picker sheet that places nothing.
3. For the correction-driven allowance change and Confirmation-with-open-picker, add browser steps or record an explicit acceptance of component coverage.
