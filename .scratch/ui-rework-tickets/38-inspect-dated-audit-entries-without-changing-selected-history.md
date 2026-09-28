# T38: Inspect dated audit entries without changing selected history

**Published:** [#186](https://github.com/AndreasUnunger/EverythingPath/issues/186) · **Label:** `ready-for-agent`

<!-- everythingpath-ui-rework-148:T38 -->

Approved implementation ticket **T38**.

## Parent

Owning area spec: [#146: Implement Finished weeks with immutable records and paged audit history](https://github.com/AndreasUnunger/EverythingPath/issues/146). Implementation parent: [#148](https://github.com/AndreasUnunger/EverythingPath/issues/148#source-traceability-and-future-tickets).

## What to build

Players page through five immutable audit entries at a time, inspect each entry’s actual date/ruleset and return to the effective record.

## Acceptance criteria

- [ ] Implement entry count/ordinal, effective/earlier markers, newest-page reopening and bounded Earlier entries while preserving a deliberately selected record.
- [ ] Use existing read calls only for missing visible-entry Ruleset Versions and bounded ordinal lookup; keep at most the expanded five-entry metadata page active and cancel stale scoped work.
- [ ] Test long correction chains, direct record links outside loaded pages, reactive effective-tip changes, isolated metadata failures and Back/Forward without record mixing or unapproved audit fields.
- [ ] Include the slice’s applicable tablet, phone and desktop behavior, accessibility, structural validation, membership/campaign isolation, multi-device save/failure/reload and Confirmation safeguards; retain working existing controls for unsplit capabilities. No prototype merge or unapproved contract change.
- [ ] Run `pnpm -s typecheck`, `pnpm -s lint` and relevant meaningful unit/integration/browser scenarios from the owning spec. Record actual results and environment limits; update capability inventory locations and evidence only for shipped work.

## Spec and capability coverage

Acceptance anchors: **§1 audit acceptance; §5 Date-only reader extension and bounded audit metadata** in [owning spec #146](https://github.com/AndreasUnunger/EverythingPath/issues/146). These criteria partition that contract; they do not replace its detailed field lists, compatibility requirements or validation cases.

Implemented or compatibility-covered portions: `HIST-03`, `HIST-04`, `HIST-07`, `HIST-08`, `NAV-17`. Where a capability spans slices, this ticket owns only the behavior described above; all owning-area tickets must complete before the area is shipped.

Preserve the owning spec’s cross-area handoffs for `NAV-10`, `NAV-11`, `NAV-12`, `STATE-01`, `STATE-02`, `STATE-03`, `STATE-04`, `STATE-05`, `STATE-06`, `SUM-06`, `SUM-07`, `SUM-08`, `SUM-10`, `SUM-11`, `WEEK-19`. These are regression obligations where touched, not authorization to implement another area early.

Consumed contracts (not extra blockers unless listed below): [#141](https://github.com/AndreasUnunger/EverythingPath/issues/141), [#145](https://github.com/AndreasUnunger/EverythingPath/issues/145), [#135](https://github.com/AndreasUnunger/EverythingPath/issues/135). Later-owner references are ownership handoffs; retain their existing editors until delivery.

## Blocked by

- [T36 / #184: Browse distinct finished weeks with bounded record metadata](https://github.com/AndreasUnunger/EverythingPath/issues/184)
- [T37 / #185: Read finished-week consequences only from the selected record](https://github.com/AndreasUnunger/EverythingPath/issues/185)

## Sources and decisions

- [Authoring task #133](https://github.com/AndreasUnunger/EverythingPath/issues/133).
- [Original planning map #99](https://github.com/AndreasUnunger/EverythingPath/issues/99).
- [Capability inventory decision](https://github.com/AndreasUnunger/EverythingPath/issues/100#issuecomment-5828004121), [baseline inventory PR #105](https://github.com/AndreasUnunger/EverythingPath/pull/105), and [ownership/accounting PR #136](https://github.com/AndreasUnunger/EverythingPath/pull/136).
- [Finished weeks: Ledger variant A, oldest-first and context under Show all](https://github.com/AndreasUnunger/EverythingPath/issues/117#issuecomment-5845007868).
- [Authoritative Finished weeks amendment: new query, creation dates, five-entry paging and no correction notes](https://github.com/AndreasUnunger/EverythingPath/issues/117#issuecomment-5845032926). This overrides the original claim that all audit entries show at once and no payload changes are needed.
- [Summary's six-section rules-order presentation](https://github.com/AndreasUnunger/EverythingPath/issues/110#issuecomment-5844063536), implemented by [Review & confirm's pure live/frozen boundary](https://github.com/AndreasUnunger/EverythingPath/issues/145).
- [Shared loading, unavailable, failure, empty and maintenance states](https://github.com/AndreasUnunger/EverythingPath/issues/119#issuecomment-5846266381).
- [Responsive pages, variant C](https://github.com/AndreasUnunger/EverythingPath/issues/121#issuecomment-5846528685).
- [Campaign home's recent finished weeks](https://github.com/AndreasUnunger/EverythingPath/issues/118#issuecomment-5846080538), with [rollout/query ownership](https://github.com/AndreasUnunger/EverythingPath/issues/122#issuecomment-5846600504) superseding its suggestion to fetch recent weeks through repeated detail reads.
- [Twelve-spec template, compatible gradual rollout and completion gate](https://github.com/AndreasUnunger/EverythingPath/issues/122#issuecomment-5846600504).

Pinned area prototypes (use the relevant surfaces for this slice; later explicit amendments govern behavior):

- [Finished weeks](https://github.com/AndreasUnunger/EverythingPath/tree/2e9904c8afae05107a9f10ff7eb6112beea6ee7a), `prototype/finished-weeks` — A, Ledger; `/prototype/finished-weeks?variant=A` — `2e9904c8afae05107a9f10ff7eb6112beea6ee7a`
- [Responsive pages](https://github.com/AndreasUnunger/EverythingPath/tree/cf13bfc6c852fc897ef39459ca6cc53b45fc243c), `prototype/responsive-pages` — C, Stacked; `/prototype/responsive-pages?variant=C`, select history — `cf13bfc6c852fc897ef39459ca6cc53b45fc243c`
- [Summary](https://github.com/AndreasUnunger/EverythingPath/tree/65d472dcf4bb65094efb97b621c7bbae3ee18965), `prototype/summary` — B; `/prototype/summary?variant=B` — `65d472dcf4bb65094efb97b621c7bbae3ee18965`

Read the owning spec and original discussions before implementation. If an ambiguity appears, cite conflicting exact sources and resolve it before changing agreed behavior. Prototype mock data is not a rules contract.
