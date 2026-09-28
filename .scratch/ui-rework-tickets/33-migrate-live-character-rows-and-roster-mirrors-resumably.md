# T33: Migrate live character rows and roster mirrors resumably

**Published:** [#181](https://github.com/AndreasUnunger/EverythingPath/issues/181) · **Label:** `ready-for-agent`

<!-- everythingpath-ui-rework-148:T33 -->

Approved implementation ticket **T33**.

## Parent

Owning area spec: [#141: Implement Characters & officers with role corrections and compatible kind migration](https://github.com/AndreasUnunger/EverythingPath/issues/141). Implementation parent: [#148](https://github.com/AndreasUnunger/EverythingPath/issues/148#source-traceability-and-future-tickets).

## What to build

Existing live campaigns reach consistent record-owned kinds through restartable internal migration while ordinary shared play remains valid.

This is a bounded compatibility/migration exception to vertical UI slicing. It must remain independently verifiable and green; legacy contracts stay supported.

## Acceptance criteria

- [ ] Implement bounded resumable/idempotent internal batches with current-record authority, source revision invalidation and no public authorization bypass.
- [ ] Preserve memberships, roles, managers, IDs/order, overrides, notes/stats/archive flags, current week and open-draft contents; diagnose foreign/missing references without manufacturing facts.
- [ ] Prove interrupted/rerun and concurrent-write behavior, zero remaining eligible live mismatches and unchanged immutable artifacts. Retain legacy readers/writes; follow deployment approval rules separately for any live execution.
- [ ] Include the slice’s applicable tablet, phone and desktop behavior, accessibility, structural validation, membership/campaign isolation, multi-device save/failure/reload and Confirmation safeguards; retain working existing controls for unsplit capabilities. No prototype merge or unapproved contract change.
- [ ] Run `pnpm -s typecheck`, `pnpm -s lint` and relevant meaningful unit/integration/browser scenarios from the owning spec. Record actual results and environment limits; update capability inventory locations and evidence only for shipped work.

## Spec and capability coverage

Acceptance anchors: **§5 Compatibility and migration, bounded internal live-data batches** in [owning spec #141](https://github.com/AndreasUnunger/EverythingPath/issues/141). These criteria partition that contract; they do not replace its detailed field lists, compatibility requirements or validation cases.

Implemented or compatibility-covered portions: `CHAR-08`, `LEDG-03`, `SETUP-05`, `SETUP-24`, `HIST-04`, `HIST-05`. Where a capability spans slices, this ticket owns only the behavior described above; all owning-area tickets must complete before the area is shipped.

Preserve the owning spec’s cross-area handoffs for `ACT-09`, `ACT-10`, `ACT-13`, `ACT-16`, `ACT-17`, `LEDG-01`, `LEDG-05`, `LEDG-06`, `LEDG-07`, `LEDG-09`, `LEDG-12`, `LEDG-13`, `NAV-16`, `NAV-17`, `SETUP-06`, `SETUP-19`, `SETUP-20`, `SETUP-26`, `STATE-01`, `STATE-02`, `STATE-03`, `STATE-04`, `STATE-05`, `STATE-06`, `STATE-07`, `SUM-05`, `WEEK-02`, `WEEK-03`, `WEEK-04`, `WEEK-05`. These are regression obligations where touched, not authorization to implement another area early.

Consumed contracts (not extra blockers unless listed below): [#139](https://github.com/AndreasUnunger/EverythingPath/issues/139), [#138](https://github.com/AndreasUnunger/EverythingPath/issues/138). Later-owner references are ownership handoffs; retain their existing editors until delivery.

## Blocked by

- [T32 / #180: Apply record-owned kind and shared officer mechanics everywhere](https://github.com/AndreasUnunger/EverythingPath/issues/180)

## Sources and decisions

- [Authoring task #132](https://github.com/AndreasUnunger/EverythingPath/issues/132).
- [Original planning map #99](https://github.com/AndreasUnunger/EverythingPath/issues/99).
- [Capability inventory decision](https://github.com/AndreasUnunger/EverythingPath/issues/100#issuecomment-5828004121), [baseline inventory PR #105](https://github.com/AndreasUnunger/EverythingPath/pull/105), and [ownership/accounting PR #136](https://github.com/AndreasUnunger/EverythingPath/pull/136).
- [Officer assignment, corrections, manager limits and approved kind/Hit Dice changes](https://github.com/AndreasUnunger/EverythingPath/issues/112#issuecomment-5836835106), including its earlier roster/removal handoff.
- [Character page variant B, separate corrections and record-owned kind](https://github.com/AndreasUnunger/EverythingPath/issues/114#issuecomment-5844673552), superseding the earlier character screen.
- [Separate Setup/Correction workflows and reference warnings](https://github.com/AndreasUnunger/EverythingPath/issues/103#issuecomment-5834024251).
- [Setup/correction prototype and signed-off caption removals](https://github.com/AndreasUnunger/EverythingPath/issues/113#issuecomment-5844235691); its character strip/combined side sheet is superseded by the character-page decision.
- [Navigation and team-manager ownership addendum](https://github.com/AndreasUnunger/EverythingPath/issues/102#issuecomment-5831173561).
- [Shared states, pre-setup character access and removal of Select a campaign…](https://github.com/AndreasUnunger/EverythingPath/issues/119#issuecomment-5846266381).
- [Responsive pages variant C](https://github.com/AndreasUnunger/EverythingPath/issues/121#issuecomment-5846528685).
- [Rollout, compatibility scope and next-unused Ruleset Version amendment](https://github.com/AndreasUnunger/EverythingPath/issues/122#issuecomment-5846600504). Its version policy supersedes the officer decision's obsolete literal 4→5 instruction.

Pinned area prototypes (use the relevant surfaces for this slice; later explicit amendments govern behavior):

- [`prototype/characters-officers` at `c6f90faecb0109c39f202c89475962e2c0014b31`](https://github.com/AndreasUnunger/EverythingPath/tree/c6f90faecb0109c39f202c89475962e2c0014b31) — `/prototype/characters-officers?variant=B`, `pnpm prototype` (3017); select “kind lives on the character record” in the scenario panel — Tablet board/table, separate correction modes, role picker, warnings, record dialog; scenario controls exercise concurrent change, pending actions and remote Spymaster.
- [`prototype/responsive-pages` at `cf13bfc6c852fc897ef39459ca6cc53b45fc243c`](https://github.com/AndreasUnunger/EverythingPath/tree/cf13bfc6c852fc897ef39459ca6cc53b45fc243c) — `/prototype/responsive-pages?variant=C&page=characters`, `pnpm prototype` (3013) — Phone/tablet/desktop and loading/failed/empty scenarios. Integrate the actual shell, not its stand-in.

Read the owning spec and original discussions before implementation. If an ambiguity appears, cite conflicting exact sources and resolve it before changing agreed behavior. Prototype mock data is not a rules contract.
