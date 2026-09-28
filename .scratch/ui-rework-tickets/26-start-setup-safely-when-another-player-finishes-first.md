# T26: Start Setup safely when another player finishes first

**Published:** [#174](https://github.com/AndreasUnunger/EverythingPath/issues/174) · **Label:** `ready-for-agent`

<!-- everythingpath-ui-rework-148:T26 -->

Approved implementation ticket **T26**.

## Parent

Owning area spec: [#138: Implement guided Militia Setup with browser resume](https://github.com/AndreasUnunger/EverythingPath/issues/138). Implementation parent: [#148](https://github.com/AndreasUnunger/EverythingPath/issues/148#source-traceability-and-future-tickets).

## What to build

Players start once, reach the requested valid phase, or follow the already-accepted militia when another member completes setup.

## Acceptance criteria

- [ ] Show the already-started page on initial authoritative load with Open week/Open militia; a later external completion redirects the open unfinished form to the accepted current week.
- [ ] Keep own-success navigation at the requested eligible phase despite racing observations; preserve attempt identity/source and pending/unknown-acknowledgement idempotence.
- [ ] Test duplicate submits, competing clients, delayed subscription/result order, rejected changed-source retries, maintenance and scope changes with no overwrite or extra week advance.
- [ ] Include the slice’s applicable tablet, phone and desktop behavior, accessibility, structural validation, membership/campaign isolation, multi-device save/failure/reload and Confirmation safeguards; retain working existing controls for unsplit capabilities. No prototype merge or unapproved contract change.
- [ ] Run `pnpm -s typecheck`, `pnpm -s lint` and relevant meaningful unit/integration/browser scenarios from the owning spec. Record actual results and environment limits; update capability inventory locations and evidence only for shipped work.

## Spec and capability coverage

Acceptance anchors: **§5 Start/race state machine; §8 reviewed start and live collision** in [owning spec #138](https://github.com/AndreasUnunger/EverythingPath/issues/138). These criteria partition that contract; they do not replace its detailed field lists, compatibility requirements or validation cases.

Implemented or compatibility-covered portions: `SETUP-19`, `SETUP-20`, `SETUP-21`, `SETUP-22`, `SETUP-23`, `SETUP-27`, `NAV-13`, `NAV-14`. Where a capability spans slices, this ticket owns only the behavior described above; all owning-area tickets must complete before the area is shipped.

Preserve the owning spec’s cross-area handoffs for `CHAR-03`, `CHAR-07`, `CHAR-08`, `LEDG-02`, `LEDG-03`, `LEDG-04`, `LEDG-07`, `NAV-11`, `NAV-15`, `NAV-17`, `STATE-01`, `STATE-02`, `STATE-03`, `STATE-04`, `STATE-05`, `STATE-06`, `STATE-07`, `WEEK-09`. These are regression obligations where touched, not authorization to implement another area early.

Consumed contracts (not extra blockers unless listed below): [#145](https://github.com/AndreasUnunger/EverythingPath/issues/145), [#135](https://github.com/AndreasUnunger/EverythingPath/issues/135), [#137](https://github.com/AndreasUnunger/EverythingPath/issues/137). Later-owner references are ownership handoffs; retain their existing editors until delivery.

## Blocked by

- [T25 / #173: Resume unfinished Setup and add characters inline](https://github.com/AndreasUnunger/EverythingPath/issues/173)

## Sources and decisions

- [Authoring task #130](https://github.com/AndreasUnunger/EverythingPath/issues/130).
- [Original planning map #99](https://github.com/AndreasUnunger/EverythingPath/issues/99).
- [Capability inventory decision](https://github.com/AndreasUnunger/EverythingPath/issues/100#issuecomment-5828004121), [baseline inventory PR #105](https://github.com/AndreasUnunger/EverythingPath/pull/105), and [ownership/accounting PR #136](https://github.com/AndreasUnunger/EverythingPath/pull/136).
- [Separate guided Setup from Militia Correction](https://github.com/AndreasUnunger/EverythingPath/issues/103#issuecomment-5834024251): nine steps, free navigation, local resume, inline character creation, validation and reuse boundaries.
- [Approve index/detail Setup, without explanatory captions](https://github.com/AndreasUnunger/EverythingPath/issues/113#issuecomment-5844235691): variant B, statuses, review, footer and explicit caption removals.
- [Approve shared loading, failed and started-militia states](https://github.com/AndreasUnunger/EverythingPath/issues/119#issuecomment-5846266381): **initially started Setup is a page with links, superseding the earlier automatic redirect on initial visit**. The live false→true transition while an unfinished form is open still follows the earlier automatic redirect decision.
- [Approve stacked responsive pages](https://github.com/AndreasUnunger/EverythingPath/issues/121#issuecomment-5846528685): variant C for phone and desktop; [responsive shell approval](https://github.com/AndreasUnunger/EverythingPath/issues/120#issuecomment-5846493929) owns the surrounding bottom tabs/More.
- [Approve officer behavior and kind/Hit Dice changes](https://github.com/AndreasUnunger/EverythingPath/issues/112#issuecomment-5836835106) and [approve character-record kind ownership](https://github.com/AndreasUnunger/EverythingPath/issues/114#issuecomment-5844673552): later Characters & officers migration, including Setup compatibility. The latter supersedes the setup-correction prototype's separate character-page layout.
- [Approve twelve-area rollout and ownership](https://github.com/AndreasUnunger/EverythingPath/issues/122#issuecomment-5846600504): Setup ships with current character CRUD before that migration; later owner updates already-shipped consumers. Its next-unused-Ruleset-Version instruction supersedes the older literal version number.

Pinned area prototypes (use the relevant surfaces for this slice; later explicit amendments govern behavior):

- `prototype/setup-correction` — B, index and detail; `/prototype/setup-correction?variant=B` (Setup screen) — [`c479521ba1cfb2e7ee931fa5b9daf4254280e8a9`](https://github.com/AndreasUnunger/EverythingPath/tree/c479521ba1cfb2e7ee931fa5b9daf4254280e8a9) — Tablet landscape, nine-step index, one detail pane, statuses and footer.
- `prototype/responsive-pages` — C, Stacked; `/prototype/responsive-pages?variant=C`, choose Setup in the prototype state panel — [`cf13bfc6c852fc897ef39459ca6cc53b45fc243c`](https://github.com/AndreasUnunger/EverythingPath/tree/cf13bfc6c852fc897ef39459ca6cc53b45fc243c) — Phone accordion rows; desktop wider index, preview lines and centred two-pane layout; page-state frames.

Read the owning spec and original discussions before implementation. If an ambiguity appears, cite conflicting exact sources and resolve it before changing agreed behavior. Prototype mock data is not a rules contract.
