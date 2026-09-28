<!-- everythingpath-ui-rework-148:T39 -->

Approved implementation ticket **T39**.

## Parent

Owning area spec: [#147: Implement the Campaign list and home with scoped creation and editing](https://github.com/AndreasUnunger/EverythingPath/issues/147). Implementation parent: [#148](https://github.com/AndreasUnunger/EverythingPath/issues/148#source-traceability-and-future-tickets).

## What to build

Players select a campaign in place or explicitly create one and land on the home identified by its returned ID.

## Acceptance criteria

- [ ] Deliver responsive campaign index and selected pane with existing-order default, route selection, current week/not-set-up labels and authorized empty/error/unavailable states.
- [ ] Replace the create dialog with the pane form, exact 2–50 name validation and optional description; change only createCampaign’s result to the inserted ID and keep old consumers compatible.
- [ ] Handle delayed list observation, duplicate names, pending/failure/unknown acknowledgement and organization changes without duplicate automatic creation. Preserve setup/characters and existing section links until richer home content lands.
- [ ] Include the slice’s applicable tablet, phone and desktop behavior, accessibility, structural validation, membership/campaign isolation, multi-device save/failure/reload and Confirmation safeguards; retain working existing controls for unsplit capabilities. No prototype merge or unapproved contract change.
- [ ] Run `pnpm -s typecheck`, `pnpm -s lint` and relevant meaningful unit/integration/browser scenarios from the owning spec. Record actual results and environment limits; update capability inventory locations and evidence only for shipped work.

## Spec and capability coverage

Acceptance anchors: **§1 selection/creation/states; §5 createCampaign result and existing reads** in [owning spec #147](https://github.com/AndreasUnunger/EverythingPath/issues/147). These criteria partition that contract; they do not replace its detailed field lists, compatibility requirements or validation cases.

Implemented or compatibility-covered portions: `CAMP-01`, `CAMP-02`, `CAMP-03`, `CAMP-04`, `CAMP-05`, `CAMP-06`, `CAMP-11`. Where a capability spans slices, this ticket owns only the behavior described above; all owning-area tickets must complete before the area is shipped.

Preserve the owning spec’s cross-area handoffs for `HIST-08`, `NAV-02`, `NAV-03`, `NAV-04`, `NAV-05`, `NAV-06`, `NAV-07`, `NAV-08`, `NAV-09`, `NAV-10`, `NAV-11`, `NAV-15`, `NAV-17`, `STATE-01`, `STATE-02`, `STATE-03`, `STATE-04`, `STATE-06`, `STATE-07`, `WEEK-02`. These are regression obligations where touched, not authorization to implement another area early.

Consumed contracts (not extra blockers unless listed below): [#146](https://github.com/AndreasUnunger/EverythingPath/issues/146), [#135](https://github.com/AndreasUnunger/EverythingPath/issues/135), [#138](https://github.com/AndreasUnunger/EverythingPath/issues/138), [#141](https://github.com/AndreasUnunger/EverythingPath/issues/141). Later-owner references are ownership handoffs; retain their existing editors until delivery.

## Blocked by

- Completion of the preceding implementation area [#146](https://github.com/AndreasUnunger/EverythingPath/issues/146), including [T36 / #184](https://github.com/AndreasUnunger/EverythingPath/issues/184), [T37 / #185](https://github.com/AndreasUnunger/EverythingPath/issues/185), [T38 / #186](https://github.com/AndreasUnunger/EverythingPath/issues/186) and the area's completion criteria. These are the underlying tickets of the existing area-level blocker.

## Sources and decisions

- [Authoring task #134](https://github.com/AndreasUnunger/EverythingPath/issues/134).
- [Original planning map #99](https://github.com/AndreasUnunger/EverythingPath/issues/99).
- [Capability inventory decision](https://github.com/AndreasUnunger/EverythingPath/issues/100#issuecomment-5828004121), [baseline inventory PR #105](https://github.com/AndreasUnunger/EverythingPath/pull/105), and [ownership/accounting PR #136](https://github.com/AndreasUnunger/EverythingPath/pull/136).
- [What should the campaign list and creation look like, and does a campaign get its own home view? — B without next up](https://github.com/AndreasUnunger/EverythingPath/issues/118#issuecomment-5846080538).
- [What navigation structure should the live flow have?](https://github.com/AndreasUnunger/EverythingPath/issues/102#issuecomment-5831173561); the later campaign-home decision replaces the provisional campaign-root-to-week redirect.
- [How should loading, unavailable, failed and maintenance-pause states look across the new structure?](https://github.com/AndreasUnunger/EverythingPath/issues/119#issuecomment-5846266381).
- [How should the campaign list, Setup, Militia, Characters & officers and Finished weeks adapt to phone and desktop? — C](https://github.com/AndreasUnunger/EverythingPath/issues/121#issuecomment-5846528685).
- [How should the agreed designs be split into per-area spec issues, and in what order should they roll out?](https://github.com/AndreasUnunger/EverythingPath/issues/122#issuecomment-5846600504), including backend ownership, shipping-last order and the reuse of Finished weeks’ listing.

Pinned area prototypes (use the relevant surfaces for this slice; later explicit amendments govern behavior):

- List/home, creation and header editing — [`prototype/campaign-home` at `a9db8ac64ce0a0e92a0f1def415af050a4d73ca6`](https://github.com/AndreasUnunger/EverythingPath/tree/a9db8ac64ce0a0e92a0f1def415af050a4d73ca6) — `/prototype/campaign-home?variant=B` — B
- Phone/desktop page adaptation — [`prototype/responsive-pages` at `cf13bfc6c852fc897ef39459ca6cc53b45fc243c`](https://github.com/AndreasUnunger/EverythingPath/tree/cf13bfc6c852fc897ef39459ca6cc53b45fc243c) — `/prototype/responsive-pages?variant=C`, choose Campaigns in the state panel — C

Read the owning spec and original discussions before implementation. If an ambiguity appears, cite conflicting exact sources and resolve it before changing agreed behavior. Prototype mock data is not a rules contract.
