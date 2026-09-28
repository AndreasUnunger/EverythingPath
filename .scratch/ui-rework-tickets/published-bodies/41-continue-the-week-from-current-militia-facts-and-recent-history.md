<!-- everythingpath-ui-rework-148:T41 -->

Approved implementation ticket **T41**.

## Parent

Owning area spec: [#147: Implement the Campaign list and home with scoped creation and editing](https://github.com/AndreasUnunger/EverythingPath/issues/147). Implementation parent: [#148](https://github.com/AndreasUnunger/EverythingPath/issues/148#source-traceability-and-future-tickets).

## What to build

Players open the first unready eligible phase, inspect current militia facts and open any of the latest three finished weeks.

## Acceptance criteria

- [ ] Reuse frame readiness/fixed eligibility for Continue; warnings alone do not block, all-ready opens review and navigation performs no write. Handle peer Setup/Confirmation without a duplicate editor.
- [ ] Show current rank/focus/team conditions, occupied role categories out of six and settlement attitudes, with campaign-preserving militia/character/setup links.
- [ ] Use exactly the shared list query with campaignId and limit:3, truthful headlines/provenance and local retry. Support sparse/zero/one/two histories and skip militia-required reads before setup; reconcile #94 as overlapping delivery evidence without closing it as ticket-authoring work.
- [ ] Include the slice’s applicable tablet, phone and desktop behavior, accessibility, structural validation, membership/campaign isolation, multi-device save/failure/reload and Confirmation safeguards; retain working existing controls for unsplit capabilities. No prototype merge or unapproved contract change.
- [ ] Run `pnpm -s typecheck`, `pnpm -s lint` and relevant meaningful unit/integration/browser scenarios from the owning spec. Record actual results and environment limits; update capability inventory locations and evidence only for shipped work.

## Spec and capability coverage

Acceptance anchors: **§1 Home pane; §5 existing workspace/readiness and shared history listing** in [owning spec #147](https://github.com/AndreasUnunger/EverythingPath/issues/147). These criteria partition that contract; they do not replace its detailed field lists, compatibility requirements or validation cases.

Implemented or compatibility-covered portions: `CAMP-08`, `CAMP-09`, `CAMP-10`, `CAMP-11`, `WEEK-02`, `HIST-08`. Where a capability spans slices, this ticket owns only the behavior described above; all owning-area tickets must complete before the area is shipped.

Preserve the owning spec’s cross-area handoffs for `NAV-02`, `NAV-03`, `NAV-04`, `NAV-05`, `NAV-06`, `NAV-07`, `NAV-08`, `NAV-09`, `NAV-10`, `NAV-11`, `NAV-15`, `NAV-17`, `STATE-01`, `STATE-02`, `STATE-03`, `STATE-04`, `STATE-06`, `STATE-07`. These are regression obligations where touched, not authorization to implement another area early.

Consumed contracts (not extra blockers unless listed below): [#146](https://github.com/AndreasUnunger/EverythingPath/issues/146), [#137](https://github.com/AndreasUnunger/EverythingPath/issues/137), [#138](https://github.com/AndreasUnunger/EverythingPath/issues/138), [#139](https://github.com/AndreasUnunger/EverythingPath/issues/139), [#141](https://github.com/AndreasUnunger/EverythingPath/issues/141), [#135](https://github.com/AndreasUnunger/EverythingPath/issues/135). Later-owner references are ownership handoffs; retain their existing editors until delivery.

## Blocked by

- [T39 / #187: Select and create campaigns in the home pane](https://github.com/AndreasUnunger/EverythingPath/issues/187)

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
