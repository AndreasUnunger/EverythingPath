# T2: Use the campaign shell on phone and desktop

**Published:** [#150](https://github.com/AndreasUnunger/EverythingPath/issues/150) · **Label:** `ready-for-agent`

<!-- everythingpath-ui-rework-148:T02 -->

Approved implementation ticket **T2**.

## Parent

Owning area spec: [#135: Implement the campaign navigation shell and scoped routes](https://github.com/AndreasUnunger/EverythingPath/issues/135). Implementation parent: [#148](https://github.com/AndreasUnunger/EverythingPath/issues/148#source-traceability-and-future-tickets).

## What to build

Players use bottom navigation and More on phones, and the bounded week host on desktop, while every hosted form remains usable.

## Acceptance criteria

- [ ] Implement the below-768px bottom bar and More sheet with organization/account controls, accessible names, dismissal and focus return.
- [ ] Position phone maintenance above the top bar and reserve space for the future Week status strip, safe areas and keyboard; verify all current editor actions remain reachable.
- [ ] At desktop width provide the week host required by Week frame while non-week and legacy forms continue to scroll normally; retain theme and fonts.
- [ ] Include the slice’s applicable tablet, phone and desktop behavior, accessibility, structural validation, membership/campaign isolation, multi-device save/failure/reload and Confirmation safeguards; retain working existing controls for unsplit capabilities. No prototype merge or unapproved contract change.
- [ ] Run `pnpm -s typecheck`, `pnpm -s lint` and relevant meaningful unit/integration/browser scenarios from the owning spec. Record actual results and environment limits; update capability inventory locations and evidence only for shipped work.

## Spec and capability coverage

Acceptance anchors: **§2 phone/desktop shell acceptance; §3 responsive prototype; §8 accessible editor reachability** in [owning spec #135](https://github.com/AndreasUnunger/EverythingPath/issues/135). These criteria partition that contract; they do not replace its detailed field lists, compatibility requirements or validation cases.

Implemented or compatibility-covered portions: `NAV-01`, `NAV-05`, `NAV-06`, `NAV-07`, `NAV-08`, `NAV-09`, `NAV-16`, `STATE-01`, `STATE-02`, `STATE-03`. Where a capability spans slices, this ticket owns only the behavior described above; all owning-area tickets must complete before the area is shipped.

Preserve the owning spec’s cross-area handoffs for `CAMP-01`, `CAMP-02`, `CAMP-03`, `CAMP-04`, `CAMP-05`, `CHAR-01`, `CHAR-08`, `CHAR-09`, `HIST-02`, `HIST-03`, `HIST-07`, `LEDG-01`, `LEDG-03`, `LEDG-05`, `LEDG-06`, `LEDG-09`, `LEDG-10`, `SETUP-22`, `SETUP-23`, `STATE-04`, `STATE-05`, `STATE-06`, `STATE-07`, `WEEK-03`, `WEEK-08`, `WEEK-12`. These are regression obligations where touched, not authorization to implement another area early.

## Blocked by

- [T1 / #149: Open campaign-scoped sections without losing existing editors](https://github.com/AndreasUnunger/EverythingPath/issues/149)

## Sources and decisions

- [Authoring task #123](https://github.com/AndreasUnunger/EverythingPath/issues/123).
- [Original planning map #99](https://github.com/AndreasUnunger/EverythingPath/issues/99).
- [Capability inventory decision](https://github.com/AndreasUnunger/EverythingPath/issues/100#issuecomment-5828004121), [baseline inventory PR #105](https://github.com/AndreasUnunger/EverythingPath/pull/105), and [ownership/accounting PR #136](https://github.com/AndreasUnunger/EverythingPath/pull/136).
- [What navigation structure should the live flow have? — resolution](https://github.com/AndreasUnunger/EverythingPath/issues/102#issuecomment-5831173561), including the [team-manager amendment](https://github.com/AndreasUnunger/EverythingPath/issues/102#issuecomment-5831430773).
- [How should loading, unavailable, failed and maintenance-pause states look across the new structure? — resolution](https://github.com/AndreasUnunger/EverythingPath/issues/119#issuecomment-5846266381).
- [How should the shell and week screen adapt to phone and desktop? — approved variant B](https://github.com/AndreasUnunger/EverythingPath/issues/120#issuecomment-5846493929).
- [What should the campaign list and creation look like, and does a campaign get its own home view? — resolution](https://github.com/AndreasUnunger/EverythingPath/issues/118#issuecomment-5846080538).
- [Should first-time setup and militia corrections be one workflow or two? — route and editor ownership amendment](https://github.com/AndreasUnunger/EverythingPath/issues/103#issuecomment-5834024251).
- [How should the agreed designs be split into per-area spec issues, and in what order should they roll out? — common template and completion gate](https://github.com/AndreasUnunger/EverythingPath/issues/122#issuecomment-5846600504).

Pinned area prototypes (use the relevant surfaces for this slice; later explicit amendments govern behavior):

- Tablet navigation and section placement — [`prototype/navigation` at `76c4d9a4eccffc48d99fb55f8c64788c4ec2a6b8`](https://github.com/AndreasUnunger/EverythingPath/tree/76c4d9a4eccffc48d99fb55f8c64788c4ec2a6b8) — `/prototype/navigation?variant=E` — E, top bar plus docked reference panel
- Phone shell and desktop host constraints — [`prototype/responsive-shell` at `de10f4208904ca583d0fbc143bfc6314f0b9c0e7`](https://github.com/AndreasUnunger/EverythingPath/tree/de10f4208904ca583d0fbc143bfc6314f0b9c0e7) — `/prototype/responsive-shell?variant=B`; direct `/prototype/responsive-shell/screen?variant=B&phase=activity` — B, Bottom bar and sheets

Read the owning spec and original discussions before implementation. If an ambiguity appears, cite conflicting exact sources and resolve it before changing agreed behavior. Prototype mock data is not a rules contract.
