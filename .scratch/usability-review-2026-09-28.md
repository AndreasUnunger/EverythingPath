# Usability review — PR #198 (`implement/148-ui-rework`), 2026-09-28

Scope: the whole app at phone (390×844), phone landscape (844×390), tablet (1024–1194) and desktop, from the 121 screenshots of the last green E2E gate
(`e2e-artifacts/e2e-local-andreasununger-slot-0/everythingpath-e2e-fX7jhJ/`) and the code under `src/components/**` and `src/app/**` at `7184b37`.
Findings were produced by three parallel read-only reviews (home/Setup/Characters/Militia; Upkeep/Activity/Event; Persistent/Review/History/frame) and the top items were spot-checked against the cited code.
Paths are relative to the repo root. Screenshot names: the last size word is the rendered viewport.

Out of scope (being fixed elsewhere): the phone bottom bar not being sticky; tab navigation waiting for the page instead of a skeleton.
Fixed in this branch (Task 1, commit `eeb2858`): form field border/fill contrast — see "Field contrast" at the end.

## Top 8

| # | Sev | Finding | Ref |
|---|-----|---------|-----|
| 1 | high | Upkeep choice cards set `touch-none` and start a drag on any 6px move, so a finger scroll over a card sticks it; Activity cards are tap-only, so the steps disagree | B1 |
| 2 | high | Tablet (the primary target) gets the compact "mouse" sizes: every `md:` override drops controls to 20–36px from 768px up | A1 |
| 3 | high | Every plain Table Adjustment renders as an amber warning that repeats its own reason, in Summary, the panel, the stepper count and History | C1 |
| 4 | high | Review & Confirm's primary action is not in the pinned footer; the footer shows an empty disabled arrow instead (also Previous on Upkeep) | C2 / B12 |
| 5 | high | Phone Characters reason strip pins ~265px (input, four chips on two rows, Save/Cancel) plus the 60px tab bar: ~38% of the viewport | A2 |
| 6 | high | Phone tap targets under 44px across Upkeep and Activity (h-9/h-8/size-8 kit defaults) while the Event forms already use `min-h-11 sm:min-h-9` | B2 |
| 7 | high | Event disclosures are 16–20px native `<summary>` rows in three type styles; the muted `text-xs` one is hardest to hit | B3 |
| 8 | medium | Phone status strip truncates the values it exists to show ("Treasury 500 gp → 420…"); prev/next chevrons are 40px and unlabeled | C6 / C3 |

## A. Campaign home, Setup, Characters & officers, Militia corrections

### High

**A1. Tablet gets the compact "mouse" sizes.** All sizes from 768px up.
Evidence: `campaign-home-chromium-tablet-tablet.png` (+ and Edit ≈36px); `character-correction-chromium-tablet-roster-desktop.png` (chips ≈20px). Code: `src/components/characters-officers/holder-menu.tsx:155` (`md:size-8`), `role-card.tsx:73` (`md:min-h-8`), `correction-bar.tsx:221` (`md:min-h-7`), `character-rows.tsx:164,187` and `correction-bar.tsx:63,143` (`md:min-h-0`), `characters-officers-view.tsx:242` (16px checkbox), `campaign-home-view.tsx:131` (`md:size-9`), shared `action = 'min-h-11 md:min-h-9'`.
Why: 768px is treated as "no longer touch", but an iPad landscape is 1024–1194px and touch, and tablet landscape is the product's primary target.
Fix: keep 44px through `lg` and compact only at `xl` (1280, which `use-desktop-layout.ts` already treats as desktop), or use Tailwind v4 `pointer-fine:` for the compact sizes.

**A2. Phone: the Characters reason strip covers ~38% of the viewport.** Phone 390×844.
Evidence: `character-correction-chromium-tablet-roster-phone.png`, `-officers-phone.png` — label, 44px input, four chips wrapping to two 44px rows, Save/Cancel row (y≈1095–1360, ≈265px) plus the 60px tab bar, all pinned. Code: `src/components/characters-officers/correction-bar.tsx:173-253` rendered through `PhoneStatusStrip` at `:407-411`.
Why: at phone landscape this leaves nothing of the page (same family as the known Week issue, but on Characters).
Fix: one row in the strip (input + Save, Cancel as text) with quick reasons in a horizontally scrolling row or a small popover; or keep the reason inline above the rows and pin only Save/Cancel.

### Medium

**A3. Phone: the Assign picker opens ~700px below the tapped card.**
Evidence: `character-correction-chromium-tablet-assign-phone.png` — panel under the Overseer card (y≈830) while Marshal/Ambassador are at the top. Code: `characters-officers-view.tsx:74-81` renders `{picker}` after the whole board; `assign-picker.tsx:166` focuses its heading, so the page scrolls away from the card.
Fix: use the bottom `Sheet` on phone (tablet already does), or insert the panel as a `col-span-2` item directly after the tapped card's row.

**A4. 11–12px VT323 pixel text is barely legible on phone.**
Evidence: phone screenshots' "Vacant: no secondary-check bonus", "already Marshal", "Story change", column headers. Code: `characters-officers/parts.tsx:21` (`chip` = `font-mono text-xs`), `:28` (`text-[11px]`), `role-card.tsx:124`, `character-rows.tsx:218`, `assign-picker.tsx:61,84`, `holder-menu.tsx:203`; `--font-mono` is VT323 (`src/styles/globals.css`).
Fix: floor mono captions at `text-sm`/`text-base` (VT323 reads at 16–20px) or set chips in the sans face.

**A5. Tablet 1194px: the top bar wraps to two rows on every section page.**
Evidence: `canonical-setup-tablet.png` (org control and avatar drop to a second row, ~100px header) vs `campaign-home-chromium-tablet-tablet.png` (fits). Code: `campaign-shell/shell-frame.tsx:57` `flex-wrap`; `campaign-shell.tsx:138` `max-w-[11rem]`; `organization-control.tsx:104-157`.
Fix: below `xl` collapse the organization control to its icon (or fold it into the account menu) and use the short "Characters" label so 1024–1279px fits one row. (Same as C14.)

**A6. Militia and Characters corrections use different reason controls.**
Evidence: `militia-correction-chromium-phone-values-phone.png` (two-row textarea, no quick reasons) vs `character-correction-…-roster-phone.png` (single-line input + four chips, Enter saves). Code: `militia-corrections/section-correction.tsx:386-403` vs `characters-officers/correction-bar.tsx:184-228`.
Fix: share one ReasonBar; the chip version doubles as the space fix for A2.

**A7. The role chip is a button that looks identical to the inert kind chip.**
Evidence: `character-correction-chromium-tablet-roster-desktop.png` — "PC" and "Marshal" chips look the same; only a `title` hints (never shown on touch). Code: `character-rows.tsx:41-47` vs `:155-170`; "Manages no teams" is a link that reads as a fact (`:184-193`).
Fix: give role chips a link affordance (underline/arrow) and label the teams link as a destination ("Teams: none →").

**A8. Truncated campaign/organization names show no visible ellipsis.**
Evidence: `campaign-home-chromium-phone-phone.png` ("E2E EVERYTHINGPA"), `character-correction-…-phone.png` ("E2E CHARACTER-LEDC"), `canonical-setup-tablet.png` ("E2E CANONICAL-P"). Code: `campaign-shell.tsx:138` `max-w-[11rem] … [&>span]:truncate`, `organization-control.tsx:109-112`. Cinzel's ellipsis is tiny, so it reads as a hard cut and similarly prefixed campaigns can't be told apart.
Fix: on phone let the switcher use the row (`max-md:max-w-[calc(100vw-6rem)]`), add `title`, show the full name in the More sheet.

**A9. Phone text inputs stay 36px next to 44px buttons.**
Evidence: `campaign-home-chromium-phone-phone-create.png` (Campaign name ≈36px beside 44px Create). Code: `src/components/ui/input.tsx` `h-9` with no phone override in `create-campaign-form.tsx:63`, `character-record-dialog-view.tsx:145,158,205`, `campaign-context/campaign-context-input.tsx`.
Fix: `h-11 md:h-9` in the base Input (as `character-rows.tsx:119` already does for HD). Setup's own controls are the known follow-up.

**A10. Campaign Edit autofocuses the description and can't rename.**
Evidence: `campaign-home-chromium-phone-phone-edit.png` (textarea focused, no name field); `-create.png` has name but no in-game date. Code: `campaign-home-pane.tsx:82` `autoFocus`, fields at `:78-123`.
Fix: skip autofocus on coarse pointers (focus the form heading instead), add the name to the editor or say where renaming happens.

**A11. Desktop floating Assign panel always docks top-right and has no outside-click close.**
Evidence: `character-correction-chromium-tablet-assign-desktop.png` — panel covers the Spymaster and Overseer cards (and their Assign buttons) although it opened from Spymaster. Code: `assign-picker.tsx:181` `absolute top-0 right-0 w-96`; no pointerdown-outside handler (contrast `holder-menu.tsx:72-74`).
Fix: anchor as a Popover to the tapped card and close on outside press.

### Low

**A12. Setup copy:** "Campaign progress" labels the New/Existing militia choice (`militia-setup/starting-point.tsx:33`); on tablet "7. Assets" is the only step without a caption, so it reads unfinished rather than optional (`canonical-setup-tablet.png`; desktop shows "None"). Fix: "Militia: new or existing?", and an "Optional" caption at every width.

**A13. Phone Characters header:** "Add character" sits alone right-aligned with an empty left half (`character-correction-…-roster-phone.png`, y≈780–830; `characters-officers-view.tsx:248` `ml-auto`). Fix: `max-md:w-full` like `campaign-home-content.tsx:211`.

**A14. Bottom bar active tab is hard to spot:** `text-primary` (0.95) vs `text-muted-foreground` (0.82) with no indicator (`campaign-shell.tsx:344-346`; all phone screenshots). Fix: a top border or `bg-primary/10` indicator like the selected index rows.

Known (seen, not re-reported): Setup Add/Remove/option buttons at `h-9` on phone (`militia-setup/fields.tsx:135,165`); conflict / week-changed messages taking focus on mount (`section-correction.tsx:155-161`).

## B. Upkeep, Activity, Event

### High

**B1. Upkeep choice cards block touch scrolling and start a drag instead.** Phone 390px; code + screenshot.
`src/components/weekly-draft-workspace/choice-cards.tsx:68` puts `touch-none` on every card and `use-choice-card-drag.ts:851-857` turns any 6px pointer move into a drag. On phone the cards fill the column (`canonical-upkeep-drag-tablet.png` shows the family), so a swipe to scroll over a card sticks it and shows "Place the card in the highlighted selection area". Activity option cards deliberately chose tap-only "so touch scrolling can start on a card" (`activity-option-cards.tsx:363-364`).
Fix: drop `touch-none` and pointer-drag on coarse pointers (`pointerType === 'mouse'` only), keep tap as the touch affordance, and shrink or hide the 80px "Drop a card here" zone when drag is unavailable.

**B2. Phone tap targets under 44px across Upkeep and Activity.** Phone 390px; code + screenshot.
`h-9` for "Add", "Change action", "Clear …", the Team `SelectTrigger` (`activity-slot-details.tsx:76`); `h-8` `size="sm"` for Deposit/Withdraw (`transfer-form.tsx:274-283`), "Add slot" (`activity-slot-board.tsx:271-280`), "Add modifier", purchase "Edit", table-modifier "Edit"/"Remove" (`event-table-modifiers.tsx:461-485`); `size-8` icon Removes (`activity-economy-parts.tsx:97`, `activity-detail-parts.tsx:166,249`). Visible in `canonical-upkeep-rank-phone.png`, `canonical-activity-phone.png`. Event forms already use `min-h-11 sm:min-h-9` (`event-reward-form.tsx:686`, `event-officer-check.tsx:142`, `event-sabotage-panel.tsx:340`).
Fix: same `min-h-11 sm:min-h-9` (and `size-11 sm:size-8` for icons) in Upkeep/Activity, or a coarse-pointer minimum in `src/components/ui/button.tsx` and the select trigger.

**B3. Event disclosures are 16–20px native `<summary>` rows.** Phone 390px; code + screenshot.
`canonical-event-phone.png` stacks "Rules: Roll Twice", "Edit Event 1 details", "Rules: All Is Calm", "Recorded inputs this event does not use (2)" as bare `<details><summary>` lines (`event-rules-disclosure.tsx:652` at `text-xs`, `event-retained-inputs.tsx:320`, `event-occurrence-editors.tsx:459`, `event-block.tsx:330,346`). No min height, three type styles.
Fix: one shared Disclosure summary (`min-h-11 sm:min-h-8`, `text-sm`, chevron, full-width hit area); label the raw editor "Advanced: edit raw details".

**B4. Picker sheet Close is a 16px icon with no alternative.** Phone landscape 844×390; code + screenshot.
`src/components/ui/sheet.tsx:75-77` renders Close as an unpadded `size-4` icon; `canonical-activity-picker-phone-landscape.png` shows the picker covering the whole screen, so the overlay can't be tapped either; `activity-picker-sheet.tsx` adds no Cancel.
Fix: 44px hit box on the kit Close (`size-11 -m-3 flex items-center justify-center`) and a "Cancel" outline button at the bottom of the picker.

**B5. Out-of-range roll warning shown three times.** Phone, tablet, desktop; screenshot + code.
`canonical-roll-total-phone.png`/`-tablet.png`/`-desktop.png`: "The usual range for 1d20 is 1–20…" (`roll-total-field.tsx:217-221`) sits directly above "Attrition Loyalty total 0 is outside the usual 1–20 range…" (`upkeep-parts.tsx:628-638`), and the reference panel repeats it. ~6 amber lines for one fact on phone.
Fix: keep the field-level advisory and suppress the section issue with the same code (or vice versa); the panel entry stays as the summary.

### Medium

**B6. "Beyond the allowance" warning reads as a blocker and offers a disabled action.** Phone/tablet.
`canonical-activity-phone.png`: "Warning: Move this choice to an available slot, clear it, or restore the action allowance before confirming the week." (`activity-warnings.ts:18`, prefixed by `activity-slot-details.tsx:153`) sounds mandatory but is only a warning. "Move to…" is a `Select` with `value=""` used as an action menu, silently `disabled` with no targets (`activity-slot-details.tsx:212-231`).
Fix: consequence first ("Slot 3 is beyond the allowance of 2. The week can still be confirmed; the rules will note it."), then options; a "Move to" menu that shows "No free slot" instead of greying out.

**B7. Explicit-Save text fields give no saved/dirty feedback and carry long button names.** Tablet 1194/1180, desktop.
`canonical-activity-tablet.png`/`-desktop.png`: "SAVE AVAILABILITY OF POTION OF HEALING" full-width (`activity-text.tsx:64-71`), Save always enabled, no stored indication; `canonical-event-tablet-narrow-closed.png` same for What happened (`event-what-happened.tsx:82-99`). Number/roll fields in the same card save on change, so users can't tell which fields need Save.
Fix: visible "Save" with the name in `aria-label`; disable until dirty and show a brief "Saved"; or save text on blur like the number fields.

**B8. Transfer amount error: 12px uppercase mono red at 3.8:1, and the row misaligns.** Tablet 1194; measured.
`canonical-upkeep-errors-tablet.png`: `FormMessage` (`src/components/ui/form.tsx`: `font-mono text-xs uppercase text-destructive`); `--destructive` oklch(0.55 0.22 20) measures 3.79:1 on a card and 3.89:1 on the page, under 4.5:1 for 12px text. Lightening the shared token is not enough: at L 0.6 white-on-destructive buttons fall to 3.78:1. The label also turns red and wraps at `sm:w-40`, so Deposit/Withdraw and Add (`transfer-form.tsx:267,314`) no longer line up with the input.
Fix: split the token (`--destructive` for fills, a lighter `--destructive-text` ≈ oklch(0.64 0.2 20) = 5.5:1 for text and borders), sentence-case `text-sm` messages; `items-end` and a non-wrapping "Amount (gp)" label.

**B9. All Is Calm block contradicts itself.** Phone, tablet, desktop.
`canonical-event-tablet.png`/`-desktop.png`/`-phone.png`: green "Happens" chip, then "› No event this week.", then "Not an uneventful week: more than one event happens this week; an event other than All Is Calm happens this week." (`event-family-panel.tsx:131-142`, copy from `event-outcome-facts.ts`).
Fix: "All Is Calm: this event has no effect." and "Does not count as an uneventful week: two events were rolled." (one reason, not a list); chip "Rolled" for no-effect events.

**B10. Purchase/consumable/roll-modifier lists use an unlabelled ghost X while table modifiers use "Edit / Remove" text.** Tablet, desktop.
`canonical-activity-tablet.png` "EDIT ×" (`activity-economy-parts.tsx:91-101`) vs `event-table-modifiers.tsx:461-485` words. Two idioms for the same list; the X is the 32px target from B2.
Fix: the text-button pair everywhere (or icon + visible "Remove" on ≥sm), same size class in all four lists.

**B11. Drag overlay hides the drop zone while dragging.** Tablet 1194.
`canonical-upkeep-drag-tablet.png`: the dragged card covers the "Selected choice / Drop a card here" text; the only drop-active cue is a border/ring change the card obscures (`choice-cards.tsx:353`). The instruction leads with tapping, but the always-visible 80px dashed zone makes drag look expected.
Fix: ghost at `opacity-70 pointer-events-none`, strong fill plus "Release to choose" on the active zone, hide the zone on coarse pointers (see B1).

### Low

**B12. Disabled "Previous" arrow box on the first step.** Tablet, desktop. `canonical-upkeep-tablet.png`/`-desktop.png`: an empty bordered arrow because `DirectionButton` keeps a disabled control "so the footer keeps its shape" (`week-frame/week-frame.tsx:35-36,70`). Fix: an invisible placeholder of the same size. (Same root as C2.)

**B13. Picker groups look identical.** Tablet 1180. `canonical-activity-picker-tablet-1180.png`: "No ready team (needs a Rules Exception)" cards are styled like the ready group (`activity-picker-sheet.tsx:628-632`); only a muted heading separates them and it scrolls away. Fix: dashed border or a "Needs exception" chip (option cards already use `border-dashed`: `activity-option-cards.tsx:443`); sticky group heading.

Known (seen, not re-reported): roll field "Clear …" labelled only by the roll name (`roll-total-field.tsx:207-216`); phone landscape pinned chrome leaves the editor under 100px (`canonical-activity-phone-landscape.png`, `canonical-event-phone-landscape.png`, `canonical-roll-total-phone-landscape.png`); "Another player changed…" notice grabbing focus on resize (`canonical-upkeep-rank-phone-landscape.png`).
Evidence note: `canonical-activity-picker-phone.png` caught the sheet mid slide-in, so the phone-portrait picker layout was not verifiable from that capture; B4 and B13 rely on the landscape and 1180 captures plus code.

## C. Persistent, Review & Confirm, History, Week frame and shell

### High

**C1. Every Table Adjustment renders as an amber warning that repeats its own reason.** Summary at all sizes, and History.
Evidence: `reviewer-summary-phone.png` (reason, then "⚠ Table Adjustment: Scouts rest after a narrative encounter." right under it), `reviewer-summary-tablet.png` ("This phase" lists four such warnings), `canonical-history-tablet.png`. Code: `summary-messages.ts:136-139` (`Table Adjustment: ${adjustment.reason}`), `kind: 'warning'` in `summary-review.ts:568-590` and `historical-week/record-review.ts:648-665`, amber via `week-review/review-note-list.tsx:12-21`. It also inflates "Ready · 1 warning" in the stepper and the footer (`canonical-persistent-tablet.png`).
Why: an intended table decision reads as a problem, four times, and real warnings drown.
Fix: treat the bare adjustment code as an "applied" note; keep amber only for the overflow/target variants; drop the duplicate line under the editable reason.

**C2. Review & Confirm's primary action is not in the pinned footer; the footer shows an empty disabled arrow.**
Evidence: `reviewer-summary-tablet.png`, `reviewer-summary-desktop.png`, `canonical-recovery-summary-tablet.png` (footer right is an empty outlined box; Confirm week is scrolled off the top), `reviewer-summary-phone-landscape-open.png`. Code: `week-frame.tsx:35-77` (`disabled={!target}`), `summary-view.tsx:246-258` (Confirm in the top card), `readiness-copy.ts:29-36` (footer text empty when ready).
Why: adjustments are edited at the bottom, then the user scrolls back up to confirm; the blank box looks broken.
Fix: render Confirm week (with its disabled reason) in the Next slot on the summary step; render nothing on endpoints.

### Medium

**C3. Phone strip prev/next chevrons are 40px and unlabeled.** Persistent/Summary, phone. `canonical-persistent-phone.png`; `week-frame.tsx:68` `size={compact ? 'icon-lg' : 'lg'}`, `button.tsx` `'icon-lg': 'size-10'`. Fix: `min-h-11 min-w-11` and the target's short label under the chevron.

**C4. Adjustment row controls on phone are 36px ghost icon buttons** (move up/down, edit, delete) plus the exception Clear X. `reviewer-summary-phone.png`; `summary-adjustment-row.tsx:127-137,161-183` `size="icon"`; `summary-view.tsx:114` `[&_button]:min-h-9` doesn't lift them; `summary-exception-control.tsx:70-78`. Disabled arrows at 50% are nearly invisible. Fix: `max-md:size-11`; hide (not disable) the impossible direction.

**C5. Phone top-bar status is three look-alike glyphs; only one is a button and it is 32px.** `canonical-persistent-phone.png`, `reviewer-persistent-phone.png`; `week-status.tsx:71,123` (decorative) and `:140-166` (`size="sm"` ghost). "Saved" vs "another player changed Persistent" is indistinguishable. Fix: one `min-h-11` button with the glyph plus a short word ("Saved", "Not saved", "Changed").

**C6. Phone strip truncates the values it exists to show.** `canonical-persistent-phone.png` "Training 14 → … Treasury 500 gp → 420…", `reviewer-summary-phone.png` "Treasury 500 gp → 499.9…"; `reference-panel.tsx:410-417` (`truncate` per item in one row). Fix: stack Training and Treasury on two lines (or "after" value with a ± delta); readiness as the trigger's description.

**C7. Tablet/desktop: a whole row above the stepper holds only the 36px reference-panel toggle**, far from the panel and unlabeled. `canonical-persistent-tablet.png` (y≈120–150), `reviewer-persistent-tablet-narrow-closed.png`; `reference-panel.tsx:366-380`, `week-frame.tsx:175-182`. Fix: collapse the row when there is no status/notice; a labeled "Reference" outline button at the end of the stepper row when closed, close button inside the panel when open.

**C8. Docked reference panel clips mid-row with no scroll cue.** `canonical-persistent-tablet.png` ("Actions" cut), `reviewer-summary-tablet.png` ("Focus" cut); `reference-panel.tsx:358` `overflow-y-auto` with no bottom padding/fade. Users don't discover Carried events and "Open militia". Fix: `pb-8` plus a bottom fade or `scrollbar-gutter: stable`; or sticky "This phase" with the tabs as the scroller.

**C9. Successor week opens on Review & Confirm with "2 decisions left" and both footer arrows dead.** `canonical-confirmation-successor.png` (Week 5, Next disabled, no "Week 4 confirmed · Open in Finished weeks" notice visible). Code: `store.ts:178-190` resets phase to 'upkeep' only on a handoff; `readiness-copy.ts:34` plain text with no link. Fix: route to the first phase with requirements; make "N decisions left" a link; verify `ConfirmedWeekNotice` (`week-status.tsx:194-240`) shows on this path.

### Low

**C10. Phone step header glyph reads as a checkbox.** `canonical-persistent-phone.png`; `steps.tsx:20-46`. Fix: the round numbered marker from `persistent-parts.tsx:86-105` or a "4/5" pill, plus the word "Steps".

**C11. "Show all values" looks like a label, not a toggle, and is 32px on phone.** `canonical-history-phone.png`, `canonical-history-tablet.png`; `review-result.tsx:33-49` ghost `size="sm"`. Fix: outline with a visible pressed state and `max-md:min-h-11`, or a "Changed only / All" segmented control.

**C12. History pane: prev/next week arrows are 36px next to a 44px "7 entries" button; amber "Earlier entry 1 of 7"/"showing" chips read as warnings.** `canonical-history-entries-phone.png`; `finished-week-pane.tsx:52-77` vs `:138`; `finished-weeks-layout-classes.ts` `amberBadgeClass`. Fix: `max-md:size-11`; neutral mono chip for "showing".

**C13. Phone history puts "Week 2 is in progress / Return to current week" after ~2,300px of record.** `canonical-history-entries-phone.png`; `finished-weeks-index.tsx:151-171` (`order-3`). Fix: keep the closing lines at the top on phone, or repeat "Return to current week" in the record footer.

**C14. Tablet top bar always wraps to two rows** because the save status shares the row with the org switcher, and the org name truncates. `canonical-persistent-tablet.png` (~100px header); `campaign-shell.tsx:458-483`, `organization-control.tsx` `max-w-[11rem]`. Fix: portal the save status into the week frame's status row on ≥md; `title` on the org select. (Same as A5.)

Known (seen, not counted): pinned chrome at phone landscape leaves ~110px of editor (`reviewer-persistent-phone-landscape.png`).

## Field contrast (fixed in this branch, commit `eeb2858`)

Root cause: `Input`, `Textarea` and `SelectTrigger` drew `border-input` with `--input` = oklch(0.15 0 0), which measures 1.06:1 on the page (oklch 0.05) and 1.04:1 on a card (0.11); their `dark:bg-input/30` fill never applied because no `.dark` class is set, leaving `bg-transparent`. Only invalid (red) and focused fields were findable (`canonical-setup-phone.png`, `canonical-roll-total-phone.png`).
Fix: `--input` = oklch(0.58 0.01 200) (4.91:1 page, 4.80:1 card, 4.79:1 muted/40 panel, 4.61:1 muted) and a new `--field` well oklch(0.2 0 0) lighter than every surface. Text on the well 14.3:1, placeholder 10.5:1, focus ring/50 6.5:1 with a 12:1 focused border, disabled border 2.96:1 (distinct from editable), invalid 3.8:1. The Setup roster's read-only kind uses a dashed boundary without a well. Also repaired `--base-border-gray: --base-gray` (missing `var()`), which made `border-border` fall back to currentColor and `bg-border` separators invisible.
Related follow-up: B8 (destructive text token) and A9 (input height on phone).
