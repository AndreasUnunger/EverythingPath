<!-- everythingpath-ui-rework-148:T13b -->

Approved implementation ticket **T13b**.

## Parent

Owning area spec: [#142: Implement shared Activity slots and action details](https://github.com/AndreasUnunger/EverythingPath/issues/142). Implementation parent: [#148](https://github.com/AndreasUnunger/EverythingPath/issues/148#source-traceability-and-future-tickets).

## What to build

Players complete every information, mission and event-influence action using the selected-slot detail area. People and team actions are delivered separately in [T13 / #161: Complete people and team action details](https://github.com/AndreasUnunger/EverythingPath/issues/161).

## Acceptance criteria

- [ ] Cover Gather Information, Knowledge Check, Covert Action, Special, Spread Propaganda, Strike Team, Activate Refuge and Reduce Danger with every existing mode/target/outcome, including subjects, Covert Action mode/following-choice reference/location, instructions, Propaganda possible/occupied flags and Strike Team support/extraction/location.
- [ ] Keep Guarantee Event/Manipulate Events candidate trees and nested controls working pending Event redesign; do not invent an Activity Sabotage card.
- [ ] Preserve staged-entity references, deterministic defaults, explicit zero overrides, all required rolls/acknowledgements and exception repair. Retain inapplicable values until explicitly replaced under existing edit semantics.
- [ ] Include the slice’s applicable tablet, phone and desktop behavior, accessibility, structural validation, membership/campaign isolation, multi-device save/failure/reload and Confirmation safeguards; retain working existing controls for unsplit capabilities. No prototype merge or unapproved contract change.
- [ ] Run `pnpm -s typecheck`, `pnpm -s lint` and relevant meaningful unit/integration/browser scenarios from the owning spec. Record actual results and environment limits; update capability inventory locations and evidence only for shipped work.

## Spec and capability coverage

Acceptance anchors: **§5 Existing choice fields checklist, information, mission and event-influence action families (Gather Information, Knowledge Check, Covert Action, Special, Spread Propaganda, Strike Team, Activate Refuge, Reduce Danger, Guarantee Event and Manipulate Events)** in [owning spec #142](https://github.com/AndreasUnunger/EverythingPath/issues/142). These criteria partition that contract; they do not replace its detailed field lists, compatibility requirements or validation cases.

Implemented or compatibility-covered portions: `ACT-10`, `ACT-11`, `ACT-12`, `ACT-13`, `ACT-14`, `ACT-16`, `ACT-17`, for the information, mission and event-influence action families above only. Where a capability spans slices, this ticket owns only the behavior described above; all owning-area tickets must complete before the area is shipped.

Preserve the owning spec’s cross-area handoffs for `EVT-04`, `EVT-06`, `LEDG-01`, `NAV-15`, `STATE-01`, `STATE-05`, `STATE-06`, `WEEK-04`, `WEEK-05`, `WEEK-06`, `WEEK-07`, `WEEK-08`, `WEEK-10`, `WEEK-12`, `WEEK-13`, `WEEK-14`, `WEEK-15`, `WEEK-16`, `WEEK-17`, `WEEK-18`. These are regression obligations where touched, not authorization to implement another area early.

Consumed contracts (not extra blockers unless listed below): [#140](https://github.com/AndreasUnunger/EverythingPath/issues/140), [#137](https://github.com/AndreasUnunger/EverythingPath/issues/137). Later-owner references are ownership handoffs; retain their existing editors until delivery.

## Blocked by

- [T11 / #159: Choose, move and remove Action Slots with teams and check bonuses](https://github.com/AndreasUnunger/EverythingPath/issues/159): renders inside #159's selected-slot detail area and reuses its team dropdown, shared check-total and modifier controls.

## Sources and decisions

- [Authoring task #126](https://github.com/AndreasUnunger/EverythingPath/issues/126).
- [Original planning map #99](https://github.com/AndreasUnunger/EverythingPath/issues/99).
- [Capability inventory decision](https://github.com/AndreasUnunger/EverythingPath/issues/100#issuecomment-5828004121), [baseline inventory PR #105](https://github.com/AndreasUnunger/EverythingPath/pull/105), and [ownership/accounting PR #136](https://github.com/AndreasUnunger/EverythingPath/pull/136).
- [Activity variant E and approved remove_slot](https://github.com/AndreasUnunger/EverythingPath/issues/106#issuecomment-5835792948).
- [Touch-card research and accessibility findings](https://github.com/AndreasUnunger/EverythingPath/issues/104#issuecomment-5822359665).
- [Week main-column/shared-frame boundary](https://github.com/AndreasUnunger/EverythingPath/issues/101#issuecomment-5831260876), implemented by the Week frame contract above.
- [Officer behavior and later manager/kind change](https://github.com/AndreasUnunger/EverythingPath/issues/112#issuecomment-5836835106), subject to the [rollout/version amendment](https://github.com/AndreasUnunger/EverythingPath/issues/122#issuecomment-5846600504).
- [Phone/desktop variant B](https://github.com/AndreasUnunger/EverythingPath/issues/120#issuecomment-5846493929) and [shared states](https://github.com/AndreasUnunger/EverythingPath/issues/119#issuecomment-5846266381).
- [Corrections and affected-draft references](https://github.com/AndreasUnunger/EverythingPath/issues/103#issuecomment-5834024251), concretized in Militia corrections above.
- [Shared dice-total approval](https://github.com/AndreasUnunger/EverythingPath/issues/107#issuecomment-5836751035), concretized in Upkeep above, and [twelve-spec completion gate](https://github.com/AndreasUnunger/EverythingPath/issues/122#issuecomment-5846600504).
- [Parallel-work and right-sizing amendment (2026-09-27)]({{AMENDMENT_URL}}).

Pinned area prototypes (use the relevant surfaces for this slice; later explicit amendments govern behavior):

- [`prototype/activity-slots` at `eea4ac70b0d85d784ccefda5337b4506a33dae57`](https://github.com/AndreasUnunger/EverythingPath/tree/eea4ac70b0d85d784ccefda5337b4506a33dae57) — `/prototype/activity-slots?variant=E` — **Chosen: slot board + picker sheet** — Tablet board, grouped picker, details, team/modifier controls. A–D are alternatives, not deliverables.
- [`prototype/responsive-shell` at `de10f4208904ca583d0fbc143bfc6314f0b9c0e7`](https://github.com/AndreasUnunger/EverythingPath/tree/de10f4208904ca583d0fbc143bfc6314f0b9c0e7) — `/prototype/responsive-shell?variant=B`; direct `/prototype/responsive-shell/screen?variant=B&phase=activity` — Phone and desktop arrangement inside the shell/frame.

Read the owning spec and original discussions before implementation. If an ambiguity appears, cite conflicting exact sources and resolve it before changing agreed behavior. Prototype mock data is not a rules contract.
