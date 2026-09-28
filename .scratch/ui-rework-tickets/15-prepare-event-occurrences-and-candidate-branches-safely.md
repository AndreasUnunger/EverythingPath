# T15: Prepare Event occurrences and candidate branches safely

**Published:** [#163](https://github.com/AndreasUnunger/EverythingPath/issues/163) · **Label:** `ready-for-agent`

<!-- everythingpath-ui-rework-148:T15 -->

Approved implementation ticket **T15**.

## Parent

Owning area spec: [#143: Implement rules-ordered Event preparation and occurrence resolution](https://github.com/AndreasUnunger/EverythingPath/issues/143). Implementation parent: [#148](https://github.com/AndreasUnunger/EverythingPath/issues/148#source-traceability-and-future-tickets).

## What to build

Players see stable blank event positions, enter chance/table rolls and choose candidates while two devices converge on the same event tree.

## Acceptance criteria

- [ ] Use existing ordered edits for fill-only stable normal, automatic, candidate and replacement positions; await accepted topology before child edits and reconcile bounded conflict retries without overwriting remote rolls.
- [ ] Preserve chance bounds/comparison and settlement modifier, forced-calm/automatic ordering, inactive recorded branches and legacy repair. Keep current event-specific editors mounted inside the new blocks.
- [ ] Implement one eligible normal Roll Twice expansion and in-place repeated/automatic/candidate rerolls, retain legacy chain interpretation, and allocate the next unused Ruleset Version only for the approved candidate semantic change.
- [ ] Include the slice’s applicable tablet, phone and desktop behavior, accessibility, structural validation, membership/campaign isolation, multi-device save/failure/reload and Confirmation safeguards; retain working existing controls for unsplit capabilities. No prototype merge or unapproved contract change.
- [ ] Run `pnpm -s typecheck`, `pnpm -s lint` and relevant meaningful unit/integration/browser scenarios from the owning spec. Record actual results and environment limits; update capability inventory locations and evidence only for shipped work.

## Spec and capability coverage

Acceptance anchors: **§1 rules-ordered sections; §5 preparation, active branches, chance and Ruleset Version** in [owning spec #143](https://github.com/AndreasUnunger/EverythingPath/issues/143). These criteria partition that contract; they do not replace its detailed field lists, compatibility requirements or validation cases.

Implemented or compatibility-covered portions: `EVT-01`, `EVT-02`, `EVT-03`, `EVT-04`, `EVT-05`, `EVT-06`, `EVT-13`, `EVT-14`. Where a capability spans slices, this ticket owns only the behavior described above; all owning-area tickets must complete before the area is shipped.

Preserve the owning spec’s cross-area handoffs for `ACT-10`, `ACT-11`, `ACT-12`, `ACT-13`, `ACT-14`, `ACT-16`, `ACT-17`, `ACT-18`, `HIST-05`, `PER-02`, `PER-03`, `PER-04`, `PER-06`, `PER-07`, `PER-08`, `PER-10`, `STATE-01`, `STATE-02`, `STATE-03`, `STATE-05`, `STATE-06`, `STATE-07`, `SUM-02`, `SUM-06`, `SUM-07`, `SUM-08`, `SUM-09`, `SUM-10`, `SUM-11`, `WEEK-02`, `WEEK-03`, `WEEK-04`, `WEEK-05`, `WEEK-06`, `WEEK-07`, `WEEK-08`, `WEEK-10`, `WEEK-11`, `WEEK-12`, `WEEK-13`, `WEEK-14`, `WEEK-15`, `WEEK-16`, `WEEK-17`, `WEEK-18`, `WEEK-19`. These are regression obligations where touched, not authorization to implement another area early.

Consumed contracts (not extra blockers unless listed below): [#142](https://github.com/AndreasUnunger/EverythingPath/issues/142), [#140](https://github.com/AndreasUnunger/EverythingPath/issues/140), [#137](https://github.com/AndreasUnunger/EverythingPath/issues/137). Later-owner references are ownership handoffs; retain their existing editors until delivery.

## Blocked by

- Completion of the preceding implementation area [#142](https://github.com/AndreasUnunger/EverythingPath/issues/142), including [T11 / #159](https://github.com/AndreasUnunger/EverythingPath/issues/159), [T12 / #160](https://github.com/AndreasUnunger/EverythingPath/issues/160), [T13 / #161](https://github.com/AndreasUnunger/EverythingPath/issues/161), [T14 / #162](https://github.com/AndreasUnunger/EverythingPath/issues/162) and the area's completion criteria. These are the underlying tickets of the existing area-level blocker.

## Sources and decisions

- [Authoring task #127](https://github.com/AndreasUnunger/EverythingPath/issues/127).
- [Original planning map #99](https://github.com/AndreasUnunger/EverythingPath/issues/99).
- [Capability inventory decision](https://github.com/AndreasUnunger/EverythingPath/issues/100#issuecomment-5828004121), [baseline inventory PR #105](https://github.com/AndreasUnunger/EverythingPath/pull/105), and [ownership/accounting PR #136](https://github.com/AndreasUnunger/EverythingPath/pull/136).
- [Event rules-order layout and final branch/reroll amendments](https://github.com/AndreasUnunger/EverythingPath/issues/108#issuecomment-5837858373): authoritative layout, generic-editor replacement, pre-existing blank occurrences and removal of manual tree buttons. The earlier prototype comment proposing keystroke-created branches is superseded.
- [Shared Event/Persistent Overseer support](https://github.com/AndreasUnunger/EverythingPath/issues/108#issuecomment-5837427038) and [Persistent rules-order decision](https://github.com/AndreasUnunger/EverythingPath/issues/109#issuecomment-5837423122), amended by the [final approved shared copy](https://github.com/AndreasUnunger/EverythingPath/issues/109#issuecomment-5837957108): filled-role toggle and one event per week across both phases, with source names in modifier breakdowns and no holder name or ability in the toggle.
- [Phone and desktop variant B](https://github.com/AndreasUnunger/EverythingPath/issues/120#issuecomment-5846493929) and [loading, failure, access and maintenance states](https://github.com/AndreasUnunger/EverythingPath/issues/119#issuecomment-5846266381).
- [Activity decisions](https://github.com/AndreasUnunger/EverythingPath/issues/106#issuecomment-5835792948), [approved dice totals](https://github.com/AndreasUnunger/EverythingPath/issues/107#issuecomment-5836751035), and their concrete implementation contracts linked above.
- [Twelve-spec rollout and completion gate](https://github.com/AndreasUnunger/EverythingPath/issues/122#issuecomment-5846600504), `CONTEXT.md`, and the Event phase/action sections in `docs/ai/ironfang-militia/militia-rules.md`, with numeric values/table mapping from `militia-tables.md`.

Pinned area prototypes (use the relevant surfaces for this slice; later explicit amendments govern behavior):

- [Event](https://github.com/AndreasUnunger/EverythingPath/tree/f93ea1cfc7a72b8655e052412008274998779f92), branch `prototype/event` — A, rules order; `/prototype/event?variant=A` — `f93ea1cfc7a72b8655e052412008274998779f92` — review refinements
- [Responsive shell](https://github.com/AndreasUnunger/EverythingPath/tree/de10f4208904ca583d0fbc143bfc6314f0b9c0e7), branch `prototype/responsive-shell` — B; `/prototype/responsive-shell?variant=B`; direct screen `/prototype/responsive-shell/screen?variant=B&phase=event` — `de10f4208904ca583d0fbc143bfc6314f0b9c0e7`

Read the owning spec and original discussions before implementation. If an ambiguity appears, cite conflicting exact sources and resolve it before changing agreed behavior. Prototype mock data is not a rules contract.
