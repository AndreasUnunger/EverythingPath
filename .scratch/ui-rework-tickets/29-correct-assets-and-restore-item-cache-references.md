# T29: Correct assets and restore item/cache references

**Published:** [#177](https://github.com/AndreasUnunger/EverythingPath/issues/177) · **Label:** `ready-for-agent`

<!-- everythingpath-ui-rework-148:T29 -->

Approved implementation ticket **T29**.

## Parent

Owning area spec: [#139: Implement in-place Militia corrections and reference repair](https://github.com/AndreasUnunger/EverythingPath/issues/139). Implementation parent: [#148](https://github.com/AndreasUnunger/EverythingPath/issues/148#source-traceability-and-future-tickets).

## What to build

Players correct inventory and delivery facts without replacing sibling assets, and restore missing items/caches needed to repair the week.

## Acceptance criteria

- [ ] Expose all item/cache/order/market fields, add/remove, decimal values and receipt clear/record operations while merging only the edited subsection.
- [ ] Extend named affected-choice warnings and ordinary same-identity restoration to items and caches, restoring prerequisite items first where snapshot integrity requires it.
- [ ] Prove mixed team/settlement/item/cache orphans recover across separate corrections after reload, then allow normal staged-choice repair. No fabricated old facts, raw-ID inputs or new API.
- [ ] Include the slice’s applicable tablet, phone and desktop behavior, accessibility, structural validation, membership/campaign isolation, multi-device save/failure/reload and Confirmation safeguards; retain working existing controls for unsplit capabilities. No prototype merge or unapproved contract change.
- [ ] Run `pnpm -s typecheck`, `pnpm -s lint` and relevant meaningful unit/integration/browser scenarios from the owning spec. Record actual results and environment limits; update capability inventory locations and evidence only for shipped work.

## Spec and capability coverage

Acceptance anchors: **§5 Items/Caches/Orders/Marketplaces projection and multi-orphan repair** in [owning spec #139](https://github.com/AndreasUnunger/EverythingPath/issues/139). These criteria partition that contract; they do not replace its detailed field lists, compatibility requirements or validation cases.

Implemented or compatibility-covered portions: `LEDG-04`, `LEDG-05`, `LEDG-06`, `LEDG-07`, `LEDG-12`, `LEDG-13`. Where a capability spans slices, this ticket owns only the behavior described above; all owning-area tickets must complete before the area is shipped.

Preserve the owning spec’s cross-area handoffs for `CHAR-01`, `CHAR-08`, `CHAR-09`, `NAV-11`, `NAV-16`, `NAV-17`, `SETUP-02`, `SETUP-05`, `SETUP-06`, `SETUP-07`, `SETUP-08`, `SETUP-10`, `SETUP-11`, `SETUP-12`, `SETUP-13`, `SETUP-16`, `SETUP-17`, `SETUP-19`, `SETUP-20`, `STATE-01`, `STATE-02`, `STATE-03`, `STATE-04`, `STATE-05`, `STATE-06`, `STATE-07`, `WEEK-03`, `WEEK-08`, `WEEK-12`. These are regression obligations where touched, not authorization to implement another area early.

Consumed contracts (not extra blockers unless listed below): [#138](https://github.com/AndreasUnunger/EverythingPath/issues/138), [#142](https://github.com/AndreasUnunger/EverythingPath/issues/142), [#143](https://github.com/AndreasUnunger/EverythingPath/issues/143), [#144](https://github.com/AndreasUnunger/EverythingPath/issues/144), [#145](https://github.com/AndreasUnunger/EverythingPath/issues/145). Later-owner references are ownership handoffs; retain their existing editors until delivery.

## Blocked by

- [T28 / #176: Correct teams and settlements with reference restoration](https://github.com/AndreasUnunger/EverythingPath/issues/176)

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
