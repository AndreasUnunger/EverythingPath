<!-- everythingpath-ui-rework-148:T27 -->

Approved implementation ticket **T27**.

## Parent

Owning area spec: [#139: Implement in-place Militia corrections and reference repair](https://github.com/AndreasUnunger/EverythingPath/issues/139). Implementation parent: [#148](https://github.com/AndreasUnunger/EverythingPath/issues/148#source-traceability-and-future-tickets).

## What to build

Players browse militia sections, correct Values with a reason and inspect week/carried facts while preserving concurrent changes.

## Acceptance criteria

- [ ] Deliver section index/detail, responsive states and the complete read-only Week & carried effects view; expose Values as the first isolated section correction.
- [ ] Implement latest-snapshot section merge, required free-text reason, same-section theirs/yours conflict, explicit restart, revision-race retry, week-change restart and unknown-ack reconciliation.
- [ ] Retain every unsplit correction through the current full editor until replacement, mutually exclusive with section editing; keep roster/officer fallback and character CRUD reachable. Add Militia Correction glossary definition.
- [ ] Include the slice’s applicable tablet, phone and desktop behavior, accessibility, structural validation, membership/campaign isolation, multi-device save/failure/reload and Confirmation safeguards; retain working existing controls for unsplit capabilities. No prototype merge or unapproved contract change.
- [ ] Run `pnpm -s typecheck`, `pnpm -s lint` and relevant meaningful unit/integration/browser scenarios from the owning spec. Record actual results and environment limits; update capability inventory locations and evidence only for shipped work.

## Spec and capability coverage

Acceptance anchors: **§3 section page layout; §5 section projection, correction lifecycle and read-only carry** in [owning spec #139](https://github.com/AndreasUnunger/EverythingPath/issues/139). These criteria partition that contract; they do not replace its detailed field lists, compatibility requirements or validation cases.

Implemented or compatibility-covered portions: `LEDG-01`, `LEDG-02`, `LEDG-05`, `LEDG-06`, `LEDG-07`, `LEDG-08`, `LEDG-09`, `LEDG-10`, `LEDG-11`. Where a capability spans slices, this ticket owns only the behavior described above; all owning-area tickets must complete before the area is shipped.

Preserve the owning spec’s cross-area handoffs for `CHAR-01`, `CHAR-08`, `CHAR-09`, `NAV-11`, `NAV-16`, `NAV-17`, `SETUP-02`, `SETUP-05`, `SETUP-06`, `SETUP-07`, `SETUP-08`, `SETUP-10`, `SETUP-11`, `SETUP-12`, `SETUP-13`, `SETUP-16`, `SETUP-17`, `SETUP-19`, `SETUP-20`, `STATE-01`, `STATE-02`, `STATE-03`, `STATE-04`, `STATE-05`, `STATE-06`, `STATE-07`, `WEEK-03`, `WEEK-08`, `WEEK-12`. These are regression obligations where touched, not authorization to implement another area early.

Consumed contracts (not extra blockers unless listed below): [#138](https://github.com/AndreasUnunger/EverythingPath/issues/138), [#135](https://github.com/AndreasUnunger/EverythingPath/issues/135), [#137](https://github.com/AndreasUnunger/EverythingPath/issues/137). Later-owner references are ownership handoffs; retain their existing editors until delivery.

## Blocked by

- Completion of the preceding implementation area [#138](https://github.com/AndreasUnunger/EverythingPath/issues/138), including [T24 / #172](https://github.com/AndreasUnunger/EverythingPath/issues/172), [T25 / #173](https://github.com/AndreasUnunger/EverythingPath/issues/173), [T26 / #174](https://github.com/AndreasUnunger/EverythingPath/issues/174) and the area's completion criteria. These are the underlying tickets of the existing area-level blocker.

## Sources and decisions

- [Authoring task #131](https://github.com/AndreasUnunger/EverythingPath/issues/131).
- [Original planning map #99](https://github.com/AndreasUnunger/EverythingPath/issues/99).
- [Capability inventory decision](https://github.com/AndreasUnunger/EverythingPath/issues/100#issuecomment-5828004121), [baseline inventory PR #105](https://github.com/AndreasUnunger/EverythingPath/pull/105), and [ownership/accounting PR #136](https://github.com/AndreasUnunger/EverythingPath/pull/136).
- [Separate Militia Setup and Militia Correction](https://github.com/AndreasUnunger/EverythingPath/issues/103#issuecomment-5834024251): section boundary, required free-text reasons, latest-snapshot merge, same-section conflict, read-only carry and known whole-draft reference validation limitation.
- [Approve Militia index/detail and remove explanatory captions](https://github.com/AndreasUnunger/EverythingPath/issues/113#issuecomment-5844235691), including the [team-removal handoff from Upkeep](https://github.com/AndreasUnunger/EverythingPath/issues/113#issuecomment-5836758014).
- [Approve the officer board and separate roster/officer corrections](https://github.com/AndreasUnunger/EverythingPath/issues/114#issuecomment-5844673552): permanent roster/officer ownership is Characters & officers; managers stay with Teams. This supersedes the earlier character strip/side-sheet prototype. Its quick-pick reasons apply to that page, not to Militia's explicitly free-text-only reasons.
- [Approve shared loading, failure, no-militia and maintenance states](https://github.com/AndreasUnunger/EverythingPath/issues/119#issuecomment-5846266381).
- [Approve stacked responsive pages](https://github.com/AndreasUnunger/EverythingPath/issues/121#issuecomment-5846528685), inside the [responsive shell](https://github.com/AndreasUnunger/EverythingPath/issues/120#issuecomment-5846493929).
- [Approve twelve-area rollout, payload ownership and completion gate](https://github.com/AndreasUnunger/EverythingPath/issues/122#issuecomment-5846600504): retain roster/officer fallback; explicitly cover orphan repair without silently broadening the backend.

Pinned area prototypes (use the relevant surfaces for this slice; later explicit amendments govern behavior):

- `prototype/setup-correction` — `/prototype/setup-correction?variant=B&screen=militia` — B, index and detail — [`c479521ba1cfb2e7ee931fa5b9daf4254280e8a9`](https://github.com/AndreasUnunger/EverythingPath/tree/c479521ba1cfb2e7ee931fa5b9daf4254280e8a9) — Tablet Militia sections, warnings, correction pane, conflict and read-only carry.
- `prototype/responsive-pages` — `/prototype/responsive-pages?variant=C`; choose Militia in the state panel — C, Stacked — [`cf13bfc6c852fc897ef39459ca6cc53b45fc243c`](https://github.com/AndreasUnunger/EverythingPath/tree/cf13bfc6c852fc897ef39459ca6cc53b45fc243c) — Phone accordion sections, desktop wider index/previews/centred page, responsive page-state frames.

Read the owning spec and original discussions before implementation. If an ambiguity appears, cite conflicting exact sources and resolve it before changing agreed behavior. Prototype mock data is not a rules contract.
