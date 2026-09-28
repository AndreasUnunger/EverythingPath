<!-- everythingpath-ui-rework-148:T03 -->

Approved implementation ticket **T3**.

## Parent

Owning area spec: [#137: Implement the shared Week frame and cross-device week transition](https://github.com/AndreasUnunger/EverythingPath/issues/137). Implementation parent: [#148](https://github.com/AndreasUnunger/EverythingPath/issues/148#source-traceability-and-future-tickets).

## What to build

Players navigate five phase positions independently and see decisions and warnings around the working current editors.

## Acceptance criteria

- [ ] Derive phase facts from one source, optimistic Weekly Draft and Resolution Preview; distinguish unique decisions, advisory warnings and accepted-review eligibility.
- [ ] Preserve fixed Persistent Phase Eligibility, URL fallback, local Back/Forward and pending edits through phase changes; never write navigation state.
- [ ] Deliver tablet stepper/footer, phone step sheet and desktop rail with Summary caption removals, loading/retry/no-militia states and every existing editing control intact.
- [ ] Include the slice’s applicable tablet, phone and desktop behavior, accessibility, structural validation, membership/campaign isolation, multi-device save/failure/reload and Confirmation safeguards; retain working existing controls for unsplit capabilities. No prototype merge or unapproved contract change.
- [ ] Run `pnpm -s typecheck`, `pnpm -s lint` and relevant meaningful unit/integration/browser scenarios from the owning spec. Record actual results and environment limits; update capability inventory locations and evidence only for shipped work.

## Spec and capability coverage

Acceptance anchors: **§1 Frame acceptance and Responsive and accessibility acceptance; §5 single-store derivation** in [owning spec #137](https://github.com/AndreasUnunger/EverythingPath/issues/137). These criteria partition that contract; they do not replace its detailed field lists, compatibility requirements or validation cases.

Implemented or compatibility-covered portions: `WEEK-01`, `WEEK-02`, `WEEK-03`, `WEEK-12`, `WEEK-13`, `WEEK-14`, `WEEK-15`, `WEEK-16`, `WEEK-17`, `WEEK-18`. Where a capability spans slices, this ticket owns only the behavior described above; all owning-area tickets must complete before the area is shipped.

Preserve the owning spec’s cross-area handoffs for `ACT-17`, `EVT-11`, `EVT-14`, `NAV-01`, `NAV-10`, `NAV-11`, `NAV-15`, `PER-08`, `PER-10`, `STATE-01`, `STATE-02`, `STATE-03`, `STATE-05`, `STATE-06`, `SUM-01`, `SUM-02`, `SUM-03`, `SUM-04`, `SUM-05`, `SUM-09`, `UPK-11`, `UPK-12`. These are regression obligations where touched, not authorization to implement another area early.

Consumed contracts (not extra blockers unless listed below): [#135](https://github.com/AndreasUnunger/EverythingPath/issues/135). Later-owner references are ownership handoffs; retain their existing editors until delivery.

## Blocked by

- Completion of the preceding implementation area [#135](https://github.com/AndreasUnunger/EverythingPath/issues/135), including [T1 / #149](https://github.com/AndreasUnunger/EverythingPath/issues/149), [T2 / #150](https://github.com/AndreasUnunger/EverythingPath/issues/150) and the area's completion criteria. These are the underlying tickets of the existing area-level blocker.

## Sources and decisions

- [Authoring task #124](https://github.com/AndreasUnunger/EverythingPath/issues/124).
- [Original planning map #99](https://github.com/AndreasUnunger/EverythingPath/issues/99).
- [Capability inventory decision](https://github.com/AndreasUnunger/EverythingPath/issues/100#issuecomment-5828004121), [baseline inventory PR #105](https://github.com/AndreasUnunger/EverythingPath/pull/105), and [ownership/accounting PR #136](https://github.com/AndreasUnunger/EverythingPath/pull/136).
- [What shared layout should the week screen use across phases? — variant A](https://github.com/AndreasUnunger/EverythingPath/issues/101#issuecomment-5831260876).
- [What navigation structure should the live flow have? — variant E](https://github.com/AndreasUnunger/EverythingPath/issues/102#issuecomment-5831173561) and its [team-manager amendment](https://github.com/AndreasUnunger/EverythingPath/issues/102#issuecomment-5831430773).
- [How should loading, unavailable, failed and maintenance-pause states look across the new structure?](https://github.com/AndreasUnunger/EverythingPath/issues/119#issuecomment-5846266381), including the cross-device confirmed-week notice.
- [How should the shell and week screen adapt to phone and desktop? — variant B](https://github.com/AndreasUnunger/EverythingPath/issues/120#issuecomment-5846493929).
- [How should Summary lay out the review, Table Adjustments and the outcome? — approved frame/review amendments](https://github.com/AndreasUnunger/EverythingPath/issues/110#issuecomment-5844063536): no Review & confirm caption; no ready/needs-attention sentence in review/footer; no applies-the-whole-week note. Disabled-Confirmation reasons remain. Review-block removals ship with that owner, not by deleting its controls here.
- [How should the agreed designs be split into per-area spec issues, and in what order should they roll out?](https://github.com/AndreasUnunger/EverythingPath/issues/122#issuecomment-5846600504), including shared ownership and staged preservation of old editors.

Pinned area prototypes (use the relevant surfaces for this slice; later explicit amendments govern behavior):

- Week frame at tablet landscape — [`prototype/week-layout` at `14659d7dc6dc9062098055e29508fa3327912402`](https://github.com/AndreasUnunger/EverythingPath/tree/14659d7dc6dc9062098055e29508fa3327912402) — `/prototype/week-layout?variant=A` — A
- Shell/reference tabs — [`prototype/navigation` at `76c4d9a4eccffc48d99fb55f8c64788c4ec2a6b8`](https://github.com/AndreasUnunger/EverythingPath/tree/76c4d9a4eccffc48d99fb55f8c64788c4ec2a6b8) — `/prototype/navigation?variant=E` — E
- Phone and desktop — [`prototype/responsive-shell` at `de10f4208904ca583d0fbc143bfc6314f0b9c0e7`](https://github.com/AndreasUnunger/EverythingPath/tree/de10f4208904ca583d0fbc143bfc6314f0b9c0e7) — `/prototype/responsive-shell?variant=B`; direct `/prototype/responsive-shell/screen?variant=B&phase=activity` — B
- Later Summary amendments — [`prototype/summary` at `65d472dcf4bb65094efb97b621c7bbae3ee18965`](https://github.com/AndreasUnunger/EverythingPath/tree/65d472dcf4bb65094efb97b621c7bbae3ee18965) — `/prototype/summary?variant=B` — B; reference for frame amendments, main editor owned separately

Read the owning spec and original discussions before implementation. If an ambiguity appears, cite conflicting exact sources and resolve it before changing agreed behavior. Prototype mock data is not a rules contract.
