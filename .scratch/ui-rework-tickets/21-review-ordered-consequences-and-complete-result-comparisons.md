# T21: Review ordered consequences and complete result comparisons

**Published:** [#169](https://github.com/AndreasUnunger/EverythingPath/issues/169) · **Label:** `ready-for-agent`

<!-- everythingpath-ui-rework-148:T21 -->

Approved implementation ticket **T21**.

## Parent

Owning area spec: [#145: Implement Review & confirm with ordered consequences and exact reviewed Confirmation](https://github.com/AndreasUnunger/EverythingPath/issues/145). Implementation parent: [#148](https://github.com/AndreasUnunger/EverythingPath/issues/148#source-traceability-and-future-tickets).

## What to build

Players read the complete ordered story of the week and compare Now, Rules Baseline and Final, including changes later reversed.

## Acceptance criteria

- [ ] Deliver four expanded phase sections, adjustment section and result section using pure renderable facts; retain item-local checks, warnings, exceptions, outcomes and unassociated legacy facts.
- [ ] Compare the union of available source/baseline/final facts with changed-only and Show all, retaining nonnumeric/add/remove and successor facts; never fabricate zero for missing preview data.
- [ ] Expose an explicit read-only rendering boundary and immutable-record fixtures for history without querying live state or running current rules. Keep current adjustment/Confirmation controls usable until replaced.
- [ ] Include the slice’s applicable tablet, phone and desktop behavior, accessibility, structural validation, membership/campaign isolation, multi-device save/failure/reload and Confirmation safeguards; retain working existing controls for unsplit capabilities. No prototype merge or unapproved contract change.
- [ ] Run `pnpm -s typecheck`, `pnpm -s lint` and relevant meaningful unit/integration/browser scenarios from the owning spec. Record actual results and environment limits; update capability inventory locations and evidence only for shipped work.

## Spec and capability coverage

Acceptance anchors: **§1 six-section acceptance; §5 live/frozen pure presentation contract** in [owning spec #145](https://github.com/AndreasUnunger/EverythingPath/issues/145). These criteria partition that contract; they do not replace its detailed field lists, compatibility requirements or validation cases.

Implemented or compatibility-covered portions: `SUM-06`, `SUM-09`, `SUM-10`, `SUM-11`. Where a capability spans slices, this ticket owns only the behavior described above; all owning-area tickets must complete before the area is shipped.

Preserve the owning spec’s cross-area handoffs for `HIST-05`, `NAV-15`, `STATE-01`, `STATE-02`, `STATE-03`, `STATE-05`, `STATE-06`, `STATE-07`, `WEEK-01`, `WEEK-02`, `WEEK-03`, `WEEK-04`, `WEEK-05`, `WEEK-06`, `WEEK-07`, `WEEK-08`, `WEEK-10`, `WEEK-11`, `WEEK-12`, `WEEK-13`, `WEEK-14`, `WEEK-15`, `WEEK-16`, `WEEK-17`, `WEEK-18`, `WEEK-19`. These are regression obligations where touched, not authorization to implement another area early.

Consumed contracts (not extra blockers unless listed below): [#144](https://github.com/AndreasUnunger/EverythingPath/issues/144), [#137](https://github.com/AndreasUnunger/EverythingPath/issues/137). Later-owner references are ownership handoffs; retain their existing editors until delivery.

## Blocked by

- Completion of the preceding implementation area [#144](https://github.com/AndreasUnunger/EverythingPath/issues/144), including [T19 / #167](https://github.com/AndreasUnunger/EverythingPath/issues/167), [T20 / #168](https://github.com/AndreasUnunger/EverythingPath/issues/168) and the area's completion criteria. These are the underlying tickets of the existing area-level blocker.

## Sources and decisions

- [Authoring task #129](https://github.com/AndreasUnunger/EverythingPath/issues/129).
- [Original planning map #99](https://github.com/AndreasUnunger/EverythingPath/issues/99).
- [Capability inventory decision](https://github.com/AndreasUnunger/EverythingPath/issues/100#issuecomment-5828004121), [baseline inventory PR #105](https://github.com/AndreasUnunger/EverythingPath/pull/105), and [ownership/accounting PR #136](https://github.com/AndreasUnunger/EverythingPath/pull/136).
- [Summary variant B and signed-off review-copy removals](https://github.com/AndreasUnunger/EverythingPath/issues/110#issuecomment-5844063536).
- [Shared Week frame](https://github.com/AndreasUnunger/EverythingPath/issues/101#issuecomment-5831260876), with the later Summary copy amendment taking precedence.
- [Loading, unavailable, failure, maintenance and successor transition](https://github.com/AndreasUnunger/EverythingPath/issues/119#issuecomment-5846266381).
- [Responsive shell and phase fixes, variant B](https://github.com/AndreasUnunger/EverythingPath/issues/120#issuecomment-5846493929).
- [Finished weeks' six-section record presentation](https://github.com/AndreasUnunger/EverythingPath/issues/117#issuecomment-5845007868) and its [authoritative payload/paging amendment](https://github.com/AndreasUnunger/EverythingPath/issues/117#issuecomment-5845032926): history consumes frozen facts; listing query/dates belong to that owner, audit paging stays and correction notes are omitted.
- [Twelve-spec rollout, ownership and completion gate](https://github.com/AndreasUnunger/EverythingPath/issues/122#issuecomment-5846600504).
- Adjacent implementation contracts linked in section 1, especially Upkeep's exact dual roll format and Persistent's live-only recorded-buyoff-warning removal. Underlying sign-off: [Persistent amount/control removal amendment](https://github.com/AndreasUnunger/EverythingPath/issues/109#issuecomment-5837634317).

Pinned area prototypes (use the relevant surfaces for this slice; later explicit amendments govern behavior):

- [Summary](https://github.com/AndreasUnunger/EverythingPath/tree/65d472dcf4bb65094efb97b621c7bbae3ee18965), branch `prototype/summary` — B, rules-order story; `/prototype/summary?variant=B` — `65d472dcf4bb65094efb97b621c7bbae3ee18965`, includes approved review-copy changes
- [Responsive shell](https://github.com/AndreasUnunger/EverythingPath/tree/de10f4208904ca583d0fbc143bfc6314f0b9c0e7), branch `prototype/responsive-shell` — B; `/prototype/responsive-shell?variant=B`; direct `/prototype/responsive-shell/screen?variant=B&phase=summary` — `de10f4208904ca583d0fbc143bfc6314f0b9c0e7`

Read the owning spec and original discussions before implementation. If an ambiguity appears, cite conflicting exact sources and resolve it before changing agreed behavior. Prototype mock data is not a rules contract.
