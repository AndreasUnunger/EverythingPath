# Touch card placement: current drag behavior and tap-to-place options

Research for #104 (map #99). Facts and options only; no design decision.
Code references are to commit `7e69857`.

## 1. What the current code does

Two independent hand-written pointer implementations exist. No drag-and-drop
library is installed (`package.json` has no `@dnd-kit/*`, React Aria, or
Pragmatic DnD).

### `ChoiceCards` + `useChoiceCardDrag` (single choice fields)

Files: `src/components/weekly-draft-workspace/choice-cards.tsx`,
`src/components/weekly-draft-workspace/use-choice-card-drag.ts`. Used for
officer, operating settlement, team recovery, structured choices, summary
adjustments, persistent events, and activity details (10+ call sites).

- Each card is a shadcn `Button` (`variant="outline"`) with `aria-pressed`,
  inside a `fieldset`/`legend`. A dashed "Selected choice" box above the grid
  is the drop area.
- **Tap** fires `click` and selects immediately (`onChoose`). Drag is an
  alternative path that ends in the same `onChoose`.
- `pointerdown` (primary button, primary pointer only) calls
  `setPointerCapture`; movement of 6 px or more (`Math.hypot`) turns the
  gesture into a drag; the card follows via inline `transform`. `pointerup`
  inside the drop area's `getBoundingClientRect()` selects; outside, it shows
  "Place the card in the highlighted selection area. Your selection is
  unchanged." A click that follows a drag is suppressed with a ref flag.
- `pointercancel` and `lostpointercapture` both call `cancel()`; Escape during
  a drag cancels.
- Card classes include `touch-none` (CSS `touch-action: none`),
  `select-none`, `cursor-grab`, `hover:-translate-y-1`,
  `focus-visible:-translate-y-1`, `motion-reduce:transform-none`.
- The feedback `<p role="status">` is rendered conditionally (only when
  there is feedback).

### Activity deck + slots (`useActivityPlacement`)

Files: `src/components/weekly-draft-workspace/use-activity-placement.ts`,
`src/components/weekly-draft-workspace/activity-view.tsx`.

- Deck cards and in-slot cards are shadcn `Button`s with the same
  `touch-none select-none cursor-grab hover:-translate-y-1` classes. The deck
  is a horizontal scroller (`flex gap-3 overflow-x-auto`, cards `w-40
  shrink-0`). Slots are shadcn `Card`s in `md:grid-cols-2`.
- **Select-then-place already exists.** Tapping a card sets `selection`; the
  status line reads "Choose a destination slot, or clear the selected
  choice."; every slot then renders a "Place in / Replace / Swap with Action
  Slot N" button, plus toolbar buttons "Cancel placement" and (for in-slot
  cards) "Clear selected choice".
- **Drag** uses the same 6 px threshold and pointer capture; while dragging a
  floating ghost is portalled to `document.body` (`aria-hidden`,
  `pointer-events-none`) and the source card is dimmed to 40% opacity. Drop
  target is resolved by iterating registered slot rects.
- Drop semantics: deck card on slot = stage or replace; slot card on another
  slot = move or swap; **slot card dropped outside all slots = clear**; deck
  card dropped outside = "The card returned to the deck."
- The status `<p role="status">` is always rendered (initial text "Choose a
  card, then choose a slot. You can also drag cards.").
- The selected card is not marked with `aria-pressed` or any other state;
  while a selection exists, *all* slots get `data-drop-active=true`.
- `pointercancel` calls `cancel()`, which also clears any tap selection.

### Test coverage

`choice-cards.test.tsx` and `activity-view.test.tsx` drive
`fireEvent.pointerDown/Move/Up` in jsdom with mouse-shaped events. There is
no test with `pointerType: 'touch'`, and jsdom does not implement
`touch-action`, panning, or `pointercancel` from the browser, so touch
behavior is untested.

## 2. How this behaves with touch (derived from specs)

| Fact from source | Effect on current code |
| --- | --- |
| Panning/zooming "are intentionally NOT a default action of pointer events ... cannot be suppressed by canceling a pointer event. Authors must instead use touch-action" ([Pointer Events 3, §8.1][pe-touch-action]). | The `event.preventDefault()` in both `move()` handlers has no effect on scrolling. Only `touch-none` is what stops the browser from panning. |
| The browser intersects `touch-action` of the touched element and ancestors when the gesture **starts**; later changes do not affect the current gesture ([MDN touch-action][mdn-touch-action]). | Scroll-vs-drag cannot be decided mid-gesture by toggling the class; it must be declared up front per element. |
| `touch-action: none` "Disables browser handling of all panning and zooming gestures" ([MDN][mdn-touch-action]). | Any swipe that starts on a card cannot scroll the page. On tablet the `ChoiceCards` grid is two full-width columns of `min-h-24` cards, so large parts of the viewport become non-scrollable starting points. In the Activity deck (`overflow-x-auto`) the cards fill almost the whole scroller, so horizontal swiping through the deck is effectively only possible from the 12 px gaps or padding; a swipe on a card becomes a drag instead. |
| UAs fire `pointercancel` when the pointer "is subsequently used by the user agent to manipulate the page viewport (e.g. panning or zooming)" ([PE3 §4.2.7][pe-cancel]). | With `touch-none` this does not normally happen on cards; if `touch-action` is relaxed (e.g. to `pan-y`), a vertical swipe would fire `pointercancel`, which in Activity also clears the tap selection and shows "Placement cancelled". |
| Direct-manipulation (touch) pointers are implicitly captured to the `pointerdown` target ([PE3 implicit capture][pe-implicit]); capture is implicitly released after `pointerup`, which fires `lostpointercapture` ([PE3 §4.2.6][pe-up]). | Explicit `setPointerCapture` is redundant for touch but harmless. `lostpointercapture` after every `pointerup` is handled because both hooks null the active drag first. |
| With capture, `click` is dispatched to the capturing element ([PE3 §4.2.12.3][pe-dispatch]). | A click can follow a drag on the card, hence the existing `suppressClick` ref. |
| Tailwind v4 wraps `hover:` in `@media (hover: hover)` ([Tailwind upgrade guide][tw-hover]); repo does not override it (`src/styles/globals.css` only defines a `dark` custom variant). | Hover lift does not apply on touch tablets (no sticky hover after tap), so on touch the only lift cues are `focus-visible:` and drag transform. The "drag affordance" is the `GripVertical` icon only. |
| No press-and-hold delay: drag starts at 6 px of movement. | For touch, dnd-kit's pointer sensor defaults to "250ms delay with 5px movement tolerance" to "prevent accidental drags when scrolling" ([dnd-kit pointer sensor][dnd-pointer]); the current code has no delay, so any finger movement over 6 px on a card is a drag. |

## 3. Accessibility facts

- WCAG 2.2 **SC 2.5.7 Dragging Movements (AA)**: all dragging functionality
  must be achievable "by a single pointer without dragging". Listed
  alternatives include selecting an element then using adjacent controls,
  a pop-up menu to reposition, and "click one item, then click its
  counterpart" ([Understanding 2.5.7][wcag-257]). Both current surfaces have a
  tap alternative (tap-to-select in `ChoiceCards`; select-then-place in
  Activity).
- **SC 2.5.2 Pointer Cancellation (A)**: completion on up-event with a way to
  abort or undo; the Understanding doc's drag example: "Releasing the pointer
  outside the drop target area reverts the action"
  ([Understanding 2.5.2][wcag-252]). Current Activity behavior differs: dropping
  an in-slot card outside the slots clears it (recoverable only by re-placing;
  nothing is committed until week Confirmation).
- **SC 2.5.8 Target Size (Minimum, AA)**: 24x24 CSS px; 2.5.5 (AAA) 44x44
  ([Understanding 2.5.8][wcag-258]). Cards (`min-h-24` = 96 px) exceed both;
  the per-slot placement buttons are default shadcn `Button` height.
- `aria-grabbed` / `aria-dropeffect` are deprecated in WAI-ARIA 1.1+
  ([WAI-ARIA 1.2][aria-grabbed]); announcements must come from live regions or
  from state on real controls.
- Live regions: "Establish the live region before updating its content ... The
  most reliable way ... is to include them in the initial markup"; `role=status`
  is implicitly `aria-live="polite"` ([MDN Live regions][mdn-live]).
  `ChoiceCards` mounts its `role="status"` together with its first message, so
  that first message may not be announced; Activity's status is always
  mounted.
- Selected state: `ChoiceCards` exposes `aria-pressed` on the chosen card.
  Activity's picked-up card exposes no state; only the status text changes.
- APG radio group: `radiogroup` / `radio` / `aria-checked`, Tab lands on the
  checked item, arrow keys move and check ([APG Radio Group][apg-radio]). The
  current `ChoiceCards` is a set of toggle buttons in a fieldset; each card is
  a separate Tab stop.

## 4. Established patterns and library support

### A. Select-then-place (tap source, tap destination)

- Named by WCAG 2.5.7 as a valid alternative ([wcag-257]).
- Already implemented in Activity. Variations: tapping a highlighted slot
  directly (whole slot `Card` as target) instead of a separate "Place in"
  button per slot; showing the picked card as raised/selected with state.
- Works with plain shadcn `Button`/`Card`; no library required.

### B. Tap-to-choose with cards as radio/toggle items (single-choice fields)

- shadcn Radio Group has a **"Choice Card"** example: "Use `FieldLabel` to wrap
  the entire `Field` for a clickable card-style selection"
  ([shadcn Radio Group][shadcn-radio]). Current shadcn docs show it built on
  Base UI with Radix and React Aria variants; this repo is on the Radix
  `new-york` style (`components.json`) and does not yet have
  `@radix-ui/react-radio-group` installed.
- Radix Toggle Group (`type="single"`) uses roving tabindex, `data-state`
  for styling, and "adheres to the WAI-ARIA pattern for radio buttons"
  ([Radix Toggle Group][radix-toggle]); not installed.
- Either keeps the card visual and removes the drop area; drag becomes
  unnecessary for single-value choices.

### C. "Move to..." menu on the card

- WCAG 2.5.7 lists a pop-up menu for repositioning ([wcag-257]). Atlassian's
  Pragmatic DnD guidelines: "If the entity does not have any more actions
  (...), make the drag handle icon into a menu button ... that allows the
  users to move the item" ([Atlassian PDnD design guidelines][pdnd]).
- In shadcn this maps to Dropdown Menu or Popover (Radix); neither is
  installed yet.

### D. Picker sheet/drawer (tap slot, choose card from a sheet)

- shadcn Drawer plus a responsive Dialog-on-desktop / Drawer-on-mobile
  example ([shadcn Drawer][shadcn-drawer]); the shadcn docs now say Drawer
  "uses Base UI instead of Vaul". The repo already has `sheet.tsx` and
  `dialog.tsx` (Radix Dialog).
- Cards can be rendered inside the sheet, so the playing-card presentation is
  kept; the destination is fixed by which slot was tapped.

### E. Keep drag, but make it touch-safe

- **Drag handle only**: apply `touch-action: none` to the grip only, leave
  the card body scrollable (`touch-action` is per-element at gesture start,
  [mdn-touch-action]). dnd-kit legacy docs: "We highly recommend you specify
  the `touch-action` CSS property for all of your draggable elements",
  suggesting `manipulation` with the delay-based Touch sensor
  ([dnd-kit Touch sensor][dnd-touch]).
- **Press-and-hold activation**: delay + tolerance (dnd-kit default for touch
  250 ms / 5 px, [dnd-pointer]). With a native-scroll-friendly
  `touch-action`, the browser may claim the gesture for panning first and
  send `pointercancel` ([pe-cancel]); dnd-kit's legacy docs note Touch
  events allow `preventDefault` in `touchmove`, "offering more control than
  Pointer events" for this case ([dnd-touch]).
- **Library**: dnd-kit (`@dnd-kit/react` current, `@dnd-kit/core` legacy)
  provides pointer/touch/keyboard sensors and customizable screen-reader
  announcements ([dnd-kit accessibility][dnd-a11y]). React Aria DnD offers
  keyboard mode (Enter, Tab between valid targets, Enter to drop) and "Touch
  screen reader users can also drag by double tapping ... swiping between
  drop targets" ([React Aria DnD][ra-dnd]); it is a separate component
  system from shadcn/Radix.

### Summary of trade-offs (facts, not a recommendation)

| Option | Keeps card look | Needs new dependency | Scroll conflict on touch | Keyboard/SR story |
| --- | --- | --- | --- | --- |
| A Select-then-place | yes | no | none | buttons + status region (exists) |
| B Radio/Toggle cards | yes | Radix radio-group or toggle-group | none | APG radio pattern built in |
| C Move-to menu | yes | Radix dropdown/popover | none | menu pattern built in |
| D Picker sheet | yes (inside sheet) | none (Sheet/Dialog exist) | none | Dialog focus management built in |
| E Touch-safe drag | yes | optional (dnd-kit) | reduced by handle/delay, not zero | needs alternative (A-D) anyway per 2.5.7 |

## Sources

- `pe-touch-action`: <https://www.w3.org/TR/pointerevents3/#the-touch-action-css-property>
- `pe-cancel`: <https://www.w3.org/TR/pointerevents3/#the-pointercancel-event>
- `pe-up`: <https://www.w3.org/TR/pointerevents3/#the-pointerup-event>
- `pe-implicit`: <https://www.w3.org/TR/pointerevents3/#implicit-pointer-capture>
- `pe-dispatch`: <https://www.w3.org/TR/pointerevents3/#event-dispatch>
- `mdn-touch-action`: <https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action>
- `mdn-live`: <https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions>
- `wcag-257`: <https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html>
- `wcag-252`: <https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html>
- `wcag-258`: <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>
- `aria-grabbed`: <https://www.w3.org/TR/wai-aria-1.2/#aria-grabbed>
- `apg-radio`: <https://www.w3.org/WAI/ARIA/apg/patterns/radio/>
- `tw-hover`: <https://tailwindcss.com/docs/upgrade-guide>
- `dnd-pointer`: <https://dndkit.com/extend/sensors/pointer-sensor>
- `dnd-touch`: <https://dndkit.com/legacy/api-documentation/sensors/touch>
- `dnd-a11y`: <https://dndkit.com/legacy/guides/accessibility>
- `ra-dnd`: <https://react-aria.adobe.com/dnd>
- `pdnd`: <https://atlassian.design/components/pragmatic-drag-and-drop/design-guidelines/>
- `shadcn-radio`: <https://ui.shadcn.com/docs/components/radio-group>
- `shadcn-drawer`: <https://ui.shadcn.com/docs/components/drawer>
- `radix-toggle`: <https://www.radix-ui.com/primitives/docs/components/toggle-group>

[pe-touch-action]: https://www.w3.org/TR/pointerevents3/#the-touch-action-css-property
[pe-cancel]: https://www.w3.org/TR/pointerevents3/#the-pointercancel-event
[pe-up]: https://www.w3.org/TR/pointerevents3/#the-pointerup-event
[pe-implicit]: https://www.w3.org/TR/pointerevents3/#implicit-pointer-capture
[pe-dispatch]: https://www.w3.org/TR/pointerevents3/#event-dispatch
[mdn-touch-action]: https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
[mdn-live]: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions
[wcag-257]: https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
[wcag-252]: https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html
[wcag-258]: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
[aria-grabbed]: https://www.w3.org/TR/wai-aria-1.2/#aria-grabbed
[apg-radio]: https://www.w3.org/WAI/ARIA/apg/patterns/radio/
[tw-hover]: https://tailwindcss.com/docs/upgrade-guide
[dnd-pointer]: https://dndkit.com/extend/sensors/pointer-sensor
[dnd-touch]: https://dndkit.com/legacy/api-documentation/sensors/touch
[dnd-a11y]: https://dndkit.com/legacy/guides/accessibility
[ra-dnd]: https://react-aria.adobe.com/dnd
[pdnd]: https://atlassian.design/components/pragmatic-drag-and-drop/design-guidelines/
[shadcn-radio]: https://ui.shadcn.com/docs/components/radio-group
[shadcn-drawer]: https://ui.shadcn.com/docs/components/drawer
[radix-toggle]: https://www.radix-ui.com/primitives/docs/components/toggle-group
