# T6: Accept legacy dice arrays and dice totals throughout the week

**Published:** [#154](https://github.com/AndreasUnunger/EverythingPath/issues/154) · **Label:** `ready-for-agent`

<!-- everythingpath-ui-rework-148:T06 -->

Approved implementation ticket **T6**.

## Parent

Owning area spec: [#140: Implement rules-ordered Upkeep and compatible shared dice totals](https://github.com/AndreasUnunger/EverythingPath/issues/140). Implementation parent: [#148](https://github.com/AndreasUnunger/EverythingPath/issues/148#source-traceability-and-future-tickets).

## What to build

The running app can read, validate, project, replay and confirm either approved roll representation before any UI starts writing totals.

This is a bounded compatibility/migration exception to vertical UI slicing. It must remain independently verifiable and green; legacy contracts stay supported.

## Acceptance criteria

- [ ] Widen every nested draft, operation, storage, record and confirmation reader/validator to strict legacy-array or total/count alternatives; introduce one pure normalization boundary.
- [ ] Update every resolver and display consumer, including nested Event/Persistent, current Summary and history. Preserve complete-array equivalence, partial-array incompleteness, natural single-die behavior, provenance and modifiers.
- [ ] Keep existing writers and immutable records unchanged; verify mixed-form persistence, replay, reviewed identity and history fixtures. This additive compatibility expansion has no Ruleset Version bump or backfill.
- [ ] Include the slice’s applicable tablet, phone and desktop behavior, accessibility, structural validation, membership/campaign isolation, multi-device save/failure/reload and Confirmation safeguards; retain working existing controls for unsplit capabilities. No prototype merge or unapproved contract change.
- [ ] Run `pnpm -s typecheck`, `pnpm -s lint` and relevant meaningful unit/integration/browser scenarios from the owning spec. Record actual results and environment limits; update capability inventory locations and evidence only for shipped work.

## Spec and capability coverage

Acceptance anchors: **§5 Approved dice-total contract and compatibility, full layer/consumer checklist** in [owning spec #140](https://github.com/AndreasUnunger/EverythingPath/issues/140). These criteria partition that contract; they do not replace its detailed field lists, compatibility requirements or validation cases.

Implemented or compatibility-covered portions: `WEEK-15`, `WEEK-16`, `WEEK-18`. Where a capability spans slices, this ticket owns only the behavior described above; all owning-area tickets must complete before the area is shipped.

Preserve the owning spec’s cross-area handoffs for `ACT-12`, `ACT-13`, `EVT-01`, `EVT-04`, `EVT-05`, `EVT-07`, `EVT-10`, `EVT-11`, `HIST-04`, `HIST-05`, `LEDG-01`, `PER-04`, `PER-07`, `PER-08`, `STATE-01`, `STATE-05`, `STATE-06`, `SUM-02`, `SUM-06`, `SUM-07`, `SUM-09`, `SUM-10`, `SUM-11`, `WEEK-04`, `WEEK-05`, `WEEK-06`, `WEEK-07`, `WEEK-08`, `WEEK-10`, `WEEK-12`, `WEEK-13`, `WEEK-14`, `WEEK-17`. These are regression obligations where touched, not authorization to implement another area early.

Consumed contracts (not extra blockers unless listed below): [#137](https://github.com/AndreasUnunger/EverythingPath/issues/137). Later-owner references are ownership handoffs; retain their existing editors until delivery.

## Blocked by

- Completion of the preceding implementation area [#137](https://github.com/AndreasUnunger/EverythingPath/issues/137), including [T3 / #151](https://github.com/AndreasUnunger/EverythingPath/issues/151), [T4 / #152](https://github.com/AndreasUnunger/EverythingPath/issues/152), [T5 / #153](https://github.com/AndreasUnunger/EverythingPath/issues/153) and the area's completion criteria. These are the underlying tickets of the existing area-level blocker.

## Sources and decisions

- [Authoring task #125](https://github.com/AndreasUnunger/EverythingPath/issues/125).
- [Original planning map #99](https://github.com/AndreasUnunger/EverythingPath/issues/99).
- [Capability inventory decision](https://github.com/AndreasUnunger/EverythingPath/issues/100#issuecomment-5828004121), [baseline inventory PR #105](https://github.com/AndreasUnunger/EverythingPath/pull/105), and [ownership/accounting PR #136](https://github.com/AndreasUnunger/EverythingPath/pull/136).
- [Upkeep: approved rules-order variant, totals, characterless transfers and signed-off removals](https://github.com/AndreasUnunger/EverythingPath/issues/107#issuecomment-5836751035).
- [Shared Week layout](https://github.com/AndreasUnunger/EverythingPath/issues/101#issuecomment-5831260876), as concretized by the [Week frame implementation contract](https://github.com/AndreasUnunger/EverythingPath/issues/137).
- [Shared loading, unavailable, failed and maintenance states](https://github.com/AndreasUnunger/EverythingPath/issues/119#issuecomment-5846266381).
- [Phone/desktop variant B and phase layout requirements](https://github.com/AndreasUnunger/EverythingPath/issues/120#issuecomment-5846493929).
- [Separate Militia corrections and staged-reference warning obligations](https://github.com/AndreasUnunger/EverythingPath/issues/103#issuecomment-5834024251).
- [Twelve-spec rollout, payload ownership and Ruleset Version amendment](https://github.com/AndreasUnunger/EverythingPath/issues/122#issuecomment-5846600504).

Pinned area prototypes (use the relevant surfaces for this slice; later explicit amendments govern behavior):

- Upkeep main column — [`prototype/upkeep` at `9c91ed3ba2503d55862b9aa89d54e23dcf884bd8`](https://github.com/AndreasUnunger/EverythingPath/tree/9c91ed3ba2503d55862b9aa89d54e23dcf884bd8) — `/prototype/upkeep?variant=A`, **Rules order**.
- Responsive shell/phase framing — [`prototype/responsive-shell` at `de10f4208904ca583d0fbc143bfc6314f0b9c0e7`](https://github.com/AndreasUnunger/EverythingPath/tree/de10f4208904ca583d0fbc143bfc6314f0b9c0e7) — `/prototype/responsive-shell?variant=B`; direct `/prototype/responsive-shell/screen?variant=B&phase=upkeep`.

Read the owning spec and original discussions before implementation. If an ambiguity appears, cite conflicting exact sources and resolve it before changing agreed behavior. Prototype mock data is not a rules contract.
