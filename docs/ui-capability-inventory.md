# Live UI capability inventory

The no-lost-functionality gate for [Rework the militia UI for ease of use](https://github.com/AndreasUnunger/EverythingPath/issues/99), produced by [Inventory the live UI's user-facing capabilities](https://github.com/AndreasUnunger/EverythingPath/issues/100). Every later design must say which ids it covers. An item leaves this list only with explicit human sign-off.

Taken from `main` at `3a4708d`. It covers the live flow only: `/sandbox` and its prototype components (`week-board-prototypes`, `ledger-page-prototypes.tsx`, `character-officer-prototypes.tsx`, `campaign-overview.tsx`) are excluded.

## How to read this

- **Id**: stable. New items get new ids; retired items keep theirs and are marked as removed with who signed off.
- **Where**: the route, then the component file under `src/`. `components/` is abbreviated `c/`, and `c/weekly-draft-workspace/` is abbreviated `wdw/`.
- **E2E**: the scenario that exercises the capability through the browser. `—` means no browser scenario covers it today. A rewritten suite must keep at least this coverage.

### Routes today

| Route                                              | Screen                                                                                                                                                                       |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                | Placeholder landing page (`app/page.tsx`)                                                                                                                                    |
| `/campaigns`                                       | Campaign dashboard: picker, create, **Militia week** tab (embeds the full week screen) and **Ledger** tab (`c/campaign-dashboard.tsx`, `c/canonical-campaign-dashboard.tsx`) |
| `/canonical-setup?campaign=<id>`                   | Militia setup (`c/militia-setup/screen.tsx`)                                                                                                                                 |
| `/canonical-workspace?campaign=<id>&phase=<phase>` | Standalone week screen (`wdw/board.tsx`)                                                                                                                                     |
| `/canonical-history?campaign=<id>`                 | Finished weeks (`c/historical-week/screen.tsx`)                                                                                                                              |

### E2E scenario keys

| Key              | Scenario                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| `access`         | `e2e/access.spec.ts`: organization members can open their campaign and outsiders cannot                        |
| `access-nightly` | The nightly-only branch of `access`: `e2e/support/nightly-flows.ts`                                            |
| `ledger`         | `e2e/character-ledger.spec.ts`: players share character and officer assignment changes                         |
| `slot`           | `e2e/realtime-action-slot.spec.ts`: players share a Staged Action Choice                                       |
| `week`           | `e2e/complete-week.spec.ts`: a player confirms a complete week and reloads its outcome                         |
| `existing`       | `e2e/existing-militia.spec.ts`: existing militia state survives reload within its campaign                     |
| `ws`             | `e2e/canonical-workspace.spec.ts`: players prepare shared Upkeep with independent navigation and save recovery |
| `ws:setup`       | …its setup part: `e2e/support/setup-workspace.ts`                                                              |
| `ws:activity`    | …its Activity part: `e2e/support/activity-workspace.ts`                                                        |
| `ws:event`       | …its Event part: `e2e/support/event-workspace.ts`                                                              |
| `ws:persistent`  | …its Persistent part: `e2e/support/persistent-workspace.ts`, `e2e/support/persistent-qa.ts`                    |
| `ws:summary`     | …its Summary part: `e2e/support/summary-qa.ts`                                                                 |
| `cutover`        | `e2e/canonical-cutover.spec.ts`: accepted campaign preserves canonical history and rejects retired paths       |

`e2e/canonical-persistence.spec.ts` and `e2e/canonical-confirmation.spec.ts` exercise the Convex contracts directly, not the UI. They cover no item here but stay in the suite.

## App shell and navigation (NAV)

| Id     | Capability                                                                                                                                                                                                                                                                              | Where                                                                               | E2E                                    |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------- |
| NAV-01 | **Removed**, signed off by @AndreasUnunger in [#102](https://github.com/AndreasUnunger/EverythingPath/issues/102#issuecomment-5831173561): the top bar replaces the sidebar. Was: collapsible sidebar (icon rail), open/closed state kept across reloads via the `sidebar_state` cookie | all routes · `app/layout.tsx`, `app/appSidebar.tsx`, `c/ui/sidebar.tsx`             | —                                      |
| NAV-02 | "KEEPNET" logo links to `/`                                                                                                                                                                                                                                                             | sidebar · `app/appSidebar.tsx`                                                      | —                                      |
| NAV-03 | "My Keep" link to `/`, which is a placeholder page                                                                                                                                                                                                                                      | sidebar · `app/appSidebar.tsx`, `app/page.tsx`                                      | —                                      |
| NAV-04 | "Campaigns" link to `/campaigns`, highlighted when active                                                                                                                                                                                                                               | sidebar · `app/appSidebar.tsx`                                                      | —                                      |
| NAV-05 | Sign in (shown only when signed out and the sidebar is open)                                                                                                                                                                                                                            | sidebar footer · `app/appSidebar.tsx`                                               | —                                      |
| NAV-06 | Organization switcher (signed in, sidebar open). The active organization decides which campaigns are visible                                                                                                                                                                            | sidebar footer · `app/appSidebar.tsx`                                               | — (fixture users have one org each)    |
| NAV-07 | User menu: account and sign out                                                                                                                                                                                                                                                         | sidebar footer · `app/appSidebar.tsx`                                               | —                                      |
| NAV-08 | "Still loading" while auth is resolving                                                                                                                                                                                                                                                 | sidebar footer · `app/appSidebar.tsx`                                               | —                                      |
| NAV-09 | Mobile-only floating sidebar trigger                                                                                                                                                                                                                                                    | all routes · `OnlyMobileSidebarTrigger` in `c/ui/sidebar.tsx`                       | —                                      |
| NAV-10 | From the week screen: **Finished weeks** link to `/canonical-history`                                                                                                                                                                                                                   | `/campaigns` Militia week tab and `/canonical-workspace` · `wdw/board.tsx`          | `week`                                 |
| NAV-11 | From an unavailable week: **Set up militia** link to `/canonical-setup`                                                                                                                                                                                                                 | same · `wdw/board.tsx`                                                              | `existing`                             |
| NAV-12 | From finished weeks: **Return to current week** link to `/canonical-workspace`                                                                                                                                                                                                          | `/canonical-history` · `c/historical-week/screen.tsx`                               | —                                      |
| NAV-13 | From completed setup: **Open current week** link to `/canonical-workspace`                                                                                                                                                                                                              | `/canonical-setup` · `c/militia-setup/screen.tsx`                                   | —                                      |
| NAV-14 | After starting a militia, go straight to the week screen at the chosen open phase                                                                                                                                                                                                       | `/canonical-setup` → `/canonical-workspace?…&phase=` · `c/militia-setup/screen.tsx` | `existing`, `ws:setup`                 |
| NAV-15 | Deep link to a phase with `?phase=`: `upkeep`, `activity`, `event`, `persistent` or `summary`. Invalid values fall back to Upkeep                                                                                                                                                       | `/canonical-workspace` · `app/canonical-workspace/page.tsx`                         | `ws:setup` (via NAV-14)                |
| NAV-16 | Switch between the **Militia week** and **Ledger** tabs for the selected campaign                                                                                                                                                                                                       | `/campaigns` · `c/canonical-campaign-dashboard.tsx`                                 | `ledger`, `existing`, `access-nightly` |

## Campaigns (CAMP)

| Id      | Capability                                                                                                               | Where                                                                             | E2E                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------- |
| CAMP-01 | See the active organization's campaigns in an "Active campaign" picker. The first campaign is selected by default        | `/campaigns` · `c/campaign-selector.tsx`, `c/canonical-campaign-dashboard.tsx`    | `access`            |
| CAMP-02 | Switch campaign. The week and ledger reload for that campaign; the selection is not kept in the URL and resets on reload | `/campaigns` · same                                                               | `existing`          |
| CAMP-03 | Create a campaign ("NEW CAMPAIGN" dialog: name 2–50 chars, description) in the active organization                       | `/campaigns` · `app/campaigns/createCampaignDialog.tsx`, `createCampaignForm.tsx` | —                   |
| CAMP-04 | Empty state: "Create a campaign to get started."                                                                         | `/campaigns` · `c/canonical-campaign-dashboard.tsx`                               | `access` (outsider) |
| CAMP-05 | Outsiders never see another organization's campaigns or weeks                                                            | `/campaigns`, `/canonical-workspace`                                              | `access`, `ws`      |
| CAMP-06 | The campaign description is stored but never shown in the live UI                                                        | —                                                                                 | —                   |

## Militia setup (SETUP)

`/canonical-setup` · `c/militia-setup/`. The same form, in correction mode, powers ledger corrections (LEDG).

| Id       | Capability                                                                                                                                                                                                                                                                     | Where                    | E2E                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ | ------------------------------------- |
| SETUP-01 | Choose **New militia** or **Existing militia**. New defaults to rank 1, training 0, 10 gp; switching keeps entries and toggles "First militia week"                                                                                                                            | `form.tsx`               | `existing`, `ws:setup`                |
| SETUP-02 | Militia values: focus (Loyalty/Security/Secrecy), rank, training, treasury (copper), notoriety                                                                                                                                                                                 | `form.tsx`               | `existing`, `ws:setup`                |
| SETUP-03 | Week context: current week, week start day, first militia week (new only), previous week uneventful, last persistent buyoff week                                                                                                                                               | `form.tsx`               | `existing`, `ws:setup`                |
| SETUP-04 | Choose the **Open phase** the week starts in                                                                                                                                                                                                                                   | `form.tsx`               | `ws:setup`                            |
| SETUP-05 | Add people from the campaign's character records. Per person: kind (pc / officer_npc / other_npc), Hit Dice, and toggle officer roles. Removing a person clears their roles and team manager assignments                                                                       | `roster.tsx`             | `ws:setup`, `ledger`                  |
| SETUP-06 | Teams: add/remove; name, type, condition, reward-limit exemption, manager (from added people), notes                                                                                                                                                                           | `roster.tsx`             | `ws:setup` (add, name)                |
| SETUP-07 | Character conditions: add/remove; character, condition (available/hidden/captured/recovering/dead), location (headquarters / refuge settlement / elsewhere + description), PCs must rescue, capture record (source, week), rescued week, restored week                         | `effects.tsx`            | `ws:setup` (add, character)           |
| SETUP-08 | Settlements: add/remove; name, reputation, secured, occupied, temporary reputation shift, Reduce Danger benefit (shift, end week), refuge activated/end weeks                                                                                                                  | `world.tsx`              | `ws:setup` (add, name, Reduce Danger) |
| SETUP-09 | Carried persistent events (setup only): add/remove; type, started week, processing order, targets (settlements, teams, characters, items, caches, events), Theft mitigation (week)                                                                                             | `world.tsx`              | —                                     |
| SETUP-10 | Items: add/remove; name, value, owner (militia or character), identified, weight, location                                                                                                                                                                                     | `assets.tsx`             | —                                     |
| SETUP-11 | Caches: add/remove; location, class, status, secure, extradimensional, return Activity week, contents (items)                                                                                                                                                                  | `assets.tsx`             | —                                     |
| SETUP-12 | Orders: add/remove; item, delivery settlement, source, kind, ordered week/day, due day, due Activity week, price, delivery days, enchantment value, record/clear receipt (received day)                                                                                        | `assets.tsx`             | —                                     |
| SETUP-13 | Marketplaces: add/remove; source, settlement, available/expires week, availability, availability %, sale %, contraband                                                                                                                                                         | `assets.tsx`             | —                                     |
| SETUP-14 | Queued effects (setup only): add/remove; source, start/end week, effect kind (check modifier, upkeep loss multiplier, activity training multiplier, event chance, all is calm, automatic events, blocked action, team unavailable, team return, narrative) with its own fields | `carry.tsx`              | —                                     |
| SETUP-15 | One-use bonuses (setup only): add/remove; source, applies to, team, phase, amount, available/consumed week                                                                                                                                                                     | `carry.tsx`              | `ws:setup`                            |
| SETUP-16 | Carried skill benefits: add/remove; characters, skills, bonus type, value, settlement, after dark, start/end week                                                                                                                                                              | `effects.tsx`            | —                                     |
| SETUP-17 | Carried Market Day benefits: add/remove; settlements, start/end week                                                                                                                                                                                                           | `effects.tsx`            | `ws:setup`                            |
| SETUP-18 | Setup notes / intentional rules deviations (optional). Shown later on the week screen (WEEK-09)                                                                                                                                                                                | `form.tsx`               | `ws:setup`                            |
| SETUP-19 | Live **Rules warnings** panel, with the hint that values can be kept and explained in notes                                                                                                                                                                                    | `form.tsx`               | `ws:setup`                            |
| SETUP-20 | Field validation: per-field required/whole-number messages plus a "Review the highlighted fields" summary                                                                                                                                                                      | `fields.tsx`, `form.tsx` | `ws:setup`                            |
| SETUP-21 | **Start militia week**. Shows "Starting militia…", and on failure keeps entries with a retry message                                                                                                                                                                           | `form.tsx`, `screen.tsx` | `existing`, `ws:setup`                |
| SETUP-22 | Setup already done: "Militia setup is complete." with Open current week (NAV-13)                                                                                                                                                                                               | `screen.tsx`             | —                                     |
| SETUP-23 | States: loading, unavailable (bad id, no access, signed out)                                                                                                                                                                                                                   | `screen.tsx`             | `ws:setup` (unavailable)              |

## Week screen: shared (WEEK)

`/campaigns` Militia week tab and `/canonical-workspace` · `wdw/board.tsx`, `wdw/store.ts`, `wdw/use-weekly-draft-workspace.tsx`.

| Id      | Capability                                                                                                                                                                                                                                      | Where                                             | E2E                                       |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------- |
| WEEK-01 | Heading "Week N · Phase"                                                                                                                                                                                                                        | `board.tsx`                                       | all week scenarios                        |
| WEEK-02 | Phase navigation: Upkeep, Activity, Event, Persistent, Summary. Persistent is disabled when no event was carried in                                                                                                                             | `board.tsx`, `store.ts`                           | `ws`, `ws:persistent`                     |
| WEEK-03 | Each player navigates phases independently, even while edits are saving                                                                                                                                                                         | `store.ts`                                        | `ws`                                      |
| WEEK-04 | Every edit syncs to all players in real time. There are no claims or locks                                                                                                                                                                      | `store.ts`, `gateway.ts`                          | `ws`, `slot`, `ledger`                    |
| WEEK-05 | Edits show at once as an optimistic forecast                                                                                                                                                                                                    | `store.ts`                                        | `ws`                                      |
| WEEK-06 | Save status line: "Saving changes…", "Changes saved.", "Changes could not be saved. The latest saved values are shown.", "Confirming the week…", idle "Prepare the week together."                                                              | `board.tsx`                                       | `ws`, `week`                              |
| WEEK-07 | A failed save restores the latest saved values and requires a fresh review before Confirmation (SUM-05)                                                                                                                                         | `store.ts`                                        | `ws`, `ws:activity`                       |
| WEEK-08 | Leave-page warning while edits or Confirmation are pending                                                                                                                                                                                      | `board.tsx`                                       | `ws`                                      |
| WEEK-09 | Setup notes panel when setup recorded notes                                                                                                                                                                                                     | `board.tsx`                                       | `ws:setup`                                |
| WEEK-10 | All inputs are disabled while Confirmation is in flight                                                                                                                                                                                         | `board.tsx`                                       | —                                         |
| WEEK-11 | After Confirmation every player moves to the next week's Upkeep                                                                                                                                                                                 | `store.ts`                                        | `week`, `ws`, `ws:setup`, `cutover`       |
| WEEK-12 | States: "Loading the week…", "This week is unavailable." (+ NAV-11), "The week could not be loaded." with **Reload the week**                                                                                                                   | `board.tsx`                                       | `ws` (unavailable/failed for outsider)    |
| WEEK-13 | Choice cards (used for every single choice on the week screen): tap or keyboard to choose, or drag into a highlighted "Selected choice" area. A missed drop returns the card with feedback and keeps the previous choice. Escape cancels a drag | `wdw/choice-cards.tsx`, `use-choice-card-drag.ts` | `ws` (tap, drag, missed drop)             |
| WEEK-14 | Whole-number fields: digits only, keep the previous value on invalid input or paste, zero is allowed, blank clears, required message                                                                                                            | `wdw/whole-number-field.tsx`                      | `ws`                                      |
| WEEK-15 | Multi-die rolls are entered in order; clearing an earlier die clears the later ones                                                                                                                                                             | `wdw/upkeep-view.tsx`, `activity-details.tsx`     | —                                         |
| WEEK-16 | Dice outside the usual range are kept, with an advisory note                                                                                                                                                                                    | Upkeep, Activity, Event, Persistent views         | `ws`                                      |
| WEEK-17 | Layout fits tablet, phone and desktop without horizontal scroll                                                                                                                                                                                 | all phase views                                   | `ws`, `ws:activity`, `ws:summary`         |
| WEEK-18 | Structured fields (lists, nested objects, discriminated choices, custom table modifiers): add/remove entries, Save/Clear the field                                                                                                              | `wdw/structured-choice-field.tsx`                 | `ws:event`, `ws:persistent`, `ws:summary` |

## Upkeep phase (UPK)

`wdw/upkeep-view.tsx`, `team-recovery.tsx`, `upkeep-warnings.ts`.

| Id     | Capability                                                                                                                                                                                                        | Where                | E2E                      |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------ |
| UPK-01 | Outcome tiles: training, treasury and rank after Upkeep, with starting training and minimum treasury                                                                                                              | `upkeep-view.tsx`    | `ws`                     |
| UPK-02 | "Upkeep is skipped for the militia's first week"                                                                                                                                                                  | `upkeep-view.tsx`    | —                        |
| UPK-03 | Required rolls as needed: attrition Loyalty, attrition training, maximum-notoriety training, notoriety Loyalty, treasury-shortage training. Each shows dice, DC, calculated bonus, total and a modifier breakdown | `upkeep-view.tsx`    | `ws`                     |
| UPK-04 | Nearest settlement choice (marked required when notoriety needs it)                                                                                                                                               | `upkeep-view.tsx`    | `ws`                     |
| UPK-05 | Missing or disabled teams: decide Recover (disabled only), Leave or Remove                                                                                                                                        | `team-recovery.tsx`  | `ws`                     |
| UPK-06 | Recovery cost prefilled with the rules cost; a changed cost needs a reason and becomes a treasury Table Adjustment. **Stage recovery**. Leave or Remove clears it                                                 | `team-recovery.tsx`  | `ws`                     |
| UPK-07 | Team return die (d20) when a missing team rolls to return                                                                                                                                                         | `team-recovery.tsx`  | —                        |
| UPK-08 | Rank boon card: reward details; record/clear the boon outcome                                                                                                                                                     | `upkeep-view.tsx`    | —                        |
| UPK-09 | Upkeep Rules Exceptions (team removal, recovery beyond funds, transfer by a non-officer, withdrawal beyond funds): record/clear a reason                                                                          | `upkeep-view.tsx`    | —                        |
| UPK-10 | Treasury transfers: officer card, deposit/withdraw, amount; **Stage transfer**; list of staged transfers with remove                                                                                              | `upkeep-view.tsx`    | `ws` (stage, validation) |
| UPK-11 | Upkeep warnings in plain language (recovery funds/cost, removal, return die range, transfer officer/funds, archived officer, rank above PC level, roll range)                                                     | `upkeep-warnings.ts` | `ws` (roll range)        |
| UPK-12 | "Complete the required rolls and decisions to finish Upkeep" readiness hint                                                                                                                                       | `upkeep-view.tsx`    | —                        |

## Activity phase (ACT)

`wdw/activity-view.tsx`, `use-activity-placement.ts`, `activity-details.tsx`, `activity-receipt.tsx`, `activity-warnings.ts`.

| Id     | Capability                                                                                                                                                                                                                                                                                                                                                                                                    | Where                                               | E2E                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------- |
| ACT-01 | Action deck with every action card: Activate Black Market, Activate Refuge, Broker Market, Change Officer Role, Covert Action, Dismiss Team, Drill Militia, Earn Gold, Gather Information, Guarantee Event, Knowledge Check, Reduce Danger, Manipulate Events, Recruit Team, Rescue Character, Restore Character, Secure Cache, Special, Special Order, Spread Propaganda, Strike Team, Upgrade Team, Lie Low | `activity-view.tsx`                                 | `slot`, `ws:activity` (some)             |
| ACT-02 | Tap-to-place: tap a card, then **Place in / Replace / Swap with Action Slot N**; **Cancel placement**                                                                                                                                                                                                                                                                                                         | `activity-view.tsx`, `use-activity-placement.ts`    | `ws:activity` (place, replace, swap)     |
| ACT-03 | Drag a deck card into a slot                                                                                                                                                                                                                                                                                                                                                                                  | same                                                | `slot`                                   |
| ACT-04 | Move a staged choice (with its team and details) to another slot, by tap or drag                                                                                                                                                                                                                                                                                                                              | same                                                | `ws:activity`                            |
| ACT-05 | Swap two occupied slots                                                                                                                                                                                                                                                                                                                                                                                       | same                                                | `ws:activity`                            |
| ACT-06 | Clear a choice: drag it outside the slots, **Clear selected choice**, or **Clear <action>** in its details                                                                                                                                                                                                                                                                                                    | same                                                | `ws:activity` (drag out, clear selected) |
| ACT-07 | Placement feedback line; a stale choice gives "That choice changed…"                                                                                                                                                                                                                                                                                                                                          | `use-activity-placement.ts`                         | —                                        |
| ACT-08 | **Add action slot**                                                                                                                                                                                                                                                                                                                                                                                           | `activity-view.tsx`                                 | —                                        |
| ACT-09 | Per-slot badges and notes: Strategist +2, over the action allowance                                                                                                                                                                                                                                                                                                                                           | `activity-view.tsx`                                 | `ws:activity` (over allowance)           |
| ACT-10 | Per-choice details (collapsible): every field the action needs (team, target team, settlement, character, overseer, strategist, items, caches, events, sales, consumables, mode, subject, cost…), as choice cards, number fields, text fields or structured fields                                                                                                                                            | `activity-details.tsx`, `activity-input-options.ts` | `ws:activity` (team, cost, subject)      |
| ACT-11 | Calculated cost display (and the entered cost that differs from it is only advisory)                                                                                                                                                                                                                                                                                                                          | `activity-details.tsx`                              | `ws:activity`                            |
| ACT-12 | Required dice per choice, with a collapsible "sources and modifiers" editor (settlement support, available bonuses, custom table modifier with reason)                                                                                                                                                                                                                                                        | `activity-details.tsx`                              | `ws:activity` (dice)                     |
| ACT-13 | Check result: calculated bonus, total, modifier breakdown                                                                                                                                                                                                                                                                                                                                                     | `activity-details.tsx`                              | —                                        |
| ACT-14 | Outcome acknowledgements the choice requires                                                                                                                                                                                                                                                                                                                                                                  | `activity-details.tsx`                              | —                                        |
| ACT-15 | Special Order receipt: received day, receipt notes; record/clear                                                                                                                                                                                                                                                                                                                                              | `activity-receipt.tsx`                              | —                                        |
| ACT-16 | Per-choice Rules Exceptions: record/remove a reason                                                                                                                                                                                                                                                                                                                                                           | `activity-details.tsx`                              | `ws:activity`                            |
| ACT-17 | Per-choice warnings (team capacity/action/unavailable/used, action blocked, Lie Low exclusivity, Drill limit, treasury, calculated cost, roll range) and a "needs more preparation" hint                                                                                                                                                                                                                      | `activity-warnings.ts`, `activity-details.tsx`      | `ws:activity`                            |
| ACT-18 | Operating settlement choice                                                                                                                                                                                                                                                                                                                                                                                   | `activity-view.tsx`                                 | —                                        |

## Event phase (EVT)

`wdw/event-view.tsx`, `event-checks.tsx`, `event-messages.ts`.

| Id     | Capability                                                                                                                                                                           | Where                                 | E2E                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | ------------------------------- |
| EVT-01 | Event chance % and the event chance roll (d100)                                                                                                                                      | `event-view.tsx`                      | `week`, `ws:setup`, `ws:event`  |
| EVT-02 | Note when an Activity choice guarantees an event                                                                                                                                     | `event-view.tsx`                      | —                               |
| EVT-03 | **Add rolled event**; **Add automatic event: <source>** per available source                                                                                                         | `event-view.tsx`                      | `ws:event` (rolled)             |
| EVT-04 | Per event: table roll (d100), resolved type or "Awaiting roll", origin, parent, Activity-candidate marker, status (negated / selected / twice / no additional effect / not selected) | `event-view.tsx`                      | `ws:event`                      |
| EVT-05 | Event table modifiers (collapsible)                                                                                                                                                  | `event-view.tsx`                      | —                               |
| EVT-06 | **Select this Activity event** among an Activity choice's candidates                                                                                                                 | `event-view.tsx`                      | —                               |
| EVT-07 | Edit event details (collapsible structured field: targets, officer check, rolls, sabotage, rewards…)                                                                                 | `event-view.tsx`                      | `ws:event`                      |
| EVT-08 | Optional mitigation status (attempted / unattempted; does not block)                                                                                                                 | `event-view.tsx`                      | —                               |
| EVT-09 | Event outcome acknowledgement: record/clear                                                                                                                                          | `event-view.tsx`                      | `ws:event`                      |
| EVT-10 | Checks per event: kind, target, calculated bonus, total, modifier breakdown                                                                                                          | `event-checks.tsx`                    | —                               |
| EVT-11 | Event warnings and Rules Exceptions: record/remove a reason                                                                                                                          | `event-view.tsx`, `event-messages.ts` | —                               |
| EVT-12 | Event outcomes list (treasury, training, team, reputation changes and narrative effects)                                                                                             | `event-view.tsx`, `event-messages.ts` | —                               |
| EVT-13 | **Add Roll Twice child**, **Add replacement event**, **Remove Event N and its branches**                                                                                             | `event-view.tsx`                      | `ws:event` (roll twice, remove) |
| EVT-14 | Required preparation list for the phase and per event                                                                                                                                | `event-view.tsx`                      | —                               |

## Persistent phase (PER)

`wdw/persistent-view.tsx`, `persistent-outcomes.tsx`.

| Id     | Capability                                                                                                          | Where                     | E2E                      |
| ------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------ |
| PER-01 | Overview: oldest-first order, first buyoff available, projected buyoff cost, next buyoff week, four-week wait       | `persistent-view.tsx`     | `ws:persistent`          |
| PER-02 | Per event: name, started week, weeks elapsed, recorded order, targets, "Ending staged for Confirmation"             | `persistent-view.tsx`     | `ws:persistent`          |
| PER-03 | Decision: Leave unattempted, Attempt temporary mitigation (Theft) / Attempt officer ending (Rivalry), Buy off event | `persistent-view.tsx`     | `ws:persistent`          |
| PER-04 | Mitigation inputs (officer, rolls, overseer…) as a structured field                                                 | `persistent-view.tsx`     | `ws:persistent`          |
| PER-05 | Recorded buyoff cost (the rules cost is used at Confirmation)                                                       | `persistent-view.tsx`     | `ws:persistent`          |
| PER-06 | Table-adjudicated ending outcome (needs a Rules Exception)                                                          | `persistent-view.tsx`     | `ws:persistent`          |
| PER-07 | Check result and staged outcomes (buyoff, officer check, temporary mitigation)                                      | `persistent-outcomes.tsx` | `ws:persistent` (buyoff) |
| PER-08 | Warnings and Rules Exceptions: record/remove a reason                                                               | `persistent-view.tsx`     | `ws:persistent` (record) |
| PER-09 | **Clear decision** per event                                                                                        | `persistent-view.tsx`     | `ws:persistent`          |
| PER-10 | Required preparation, including "earlier phases still need preparation"                                             | `persistent-view.tsx`     | —                        |

## Summary and Confirmation (SUM)

`wdw/summary-view.tsx`, `summary-adjustments.tsx`, `summary-outcome.tsx`, `summary-messages.ts`.

| Id     | Capability                                                                                                                                                | Where                                     | E2E                |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------ |
| SUM-01 | Readiness line: ready / needs attention / "Review will be ready when your changes are saved."                                                             | `summary-view.tsx`                        | `ws`               |
| SUM-02 | **Required decisions** list across all phases, in plain language                                                                                          | `summary-view.tsx`, `summary-messages.ts` | `ws:activity`      |
| SUM-03 | **Confirm week**: enabled only when the whole week is ready, saved and reviewed                                                                           | `summary-view.tsx`, `store.ts`            | `week`, `ws`       |
| SUM-04 | Concurrent Confirmation: only one succeeds; stale reviews are rejected                                                                                    | `store.ts`                                | `ws`               |
| SUM-05 | Stale review: "could not be confirmed as reviewed" alert with **Review updated week**                                                                     | `summary-view.tsx`                        | `ws`               |
| SUM-06 | Rules Baseline and Final preview side by side: training, treasury, week, and collapsible militia facts and future-week context                            | `summary-outcome.tsx`                     | `ws`, `ws:summary` |
| SUM-07 | Rules Exceptions list: edit/clear each reason; remove an obsolete action-capacity exception                                                               | `summary-view.tsx`                        | —                  |
| SUM-08 | Table Adjustments: add (militia value, team condition, settlement reputation, end persistent event), edit, clear, move earlier/later; each needs a reason | `summary-adjustments.tsx`                 | `ws:summary`       |
| SUM-09 | Warnings list                                                                                                                                             | `summary-view.tsx`                        | —                  |
| SUM-10 | Weekly consequences by phase (collapsible)                                                                                                                | `summary-view.tsx`                        | —                  |
| SUM-11 | Recorded table outcomes (acknowledgements)                                                                                                                | `summary-view.tsx`                        | —                  |

## Finished weeks (HIST)

`/canonical-history` · `c/historical-week/screen.tsx`, `record-view.tsx`, `record-facts.tsx`.

| Id      | Capability                                                                                                                                                                                                       | Where                                 | E2E              |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------- |
| HIST-01 | Opens on the latest finished week                                                                                                                                                                                | `screen.tsx`                          | `week`           |
| HIST-02 | Previous week, Next week, Latest finished week                                                                                                                                                                   | `screen.tsx`                          | —                |
| HIST-03 | Audit history: Show effective record, pick any entry (Confirmed week / Historical reconstruction / Historical correction · Entry N), Earlier entries                                                             | `screen.tsx`                          | —                |
| HIST-04 | Record header: week, effective or earlier, provenance, ruleset version, read-only notice                                                                                                                         | `record-view.tsx`                     | `week` (heading) |
| HIST-05 | Record sections (collapsible): recorded choices and context, militia at confirmation, baseline plan, final plan, warnings, Rules Exceptions, Table Adjustments, table outcomes, final outcome, next-week context | `record-view.tsx`, `record-facts.tsx` | —                |
| HIST-06 | "History correction" notice: corrections are not available yet                                                                                                                                                   | `screen.tsx`                          | —                |
| HIST-07 | States: "Loading history…", "No finished weeks have been recorded.", "History could not be loaded" with **Reload history**, "Campaign history is unavailable."                                                   | `screen.tsx`                          | —                |

## Ledger corrections (LEDG)

`/campaigns` Ledger tab · `c/canonical-campaign-dashboard.tsx`, `c/use-canonical-ledger.ts`, `c/militia-setup/form.tsx` in correction mode.

| Id      | Capability                                                                                                             | Where                                  | E2E                  |
| ------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------- |
| LEDG-01 | **Edit militia ledger** / **Close correction** toggle, with the hint that weekly actions belong on the week board      | `canonical-campaign-dashboard.tsx`     | `ledger`, `existing` |
| LEDG-02 | Correct militia values (focus, rank, training, treasury, notoriety)                                                    | setup form SETUP-02                    | `existing`           |
| LEDG-03 | Assign people, officer roles and team managers; this is the **only** place officers and managers are assigned          | setup form SETUP-05, SETUP-06          | `ledger`             |
| LEDG-04 | Correct teams, character conditions, settlements, items, caches, orders, marketplaces, skill and Market Day benefits   | setup form SETUP-06–08, 10–13, 16–17   | —                    |
| LEDG-05 | A reason for the correction is required                                                                                | `form.tsx`                             | `ledger`             |
| LEDG-06 | **Save correction** against the revision it was opened at; on failure keep entries and ask to review the latest ledger | `form.tsx`, `use-canonical-ledger.ts`  | `ledger`             |
| LEDG-07 | Rules warnings panel while correcting                                                                                  | `form.tsx`                             | —                    |
| LEDG-08 | Not correctable here: week context, carried persistent events, queued effects, one-use bonuses                         | `form.tsx` (hidden in correction mode) | —                    |
| LEDG-09 | Before setup there is no militia: the Ledger tab shows only the character ledger                                       | `canonical-campaign-dashboard.tsx`     | —                    |
| LEDG-10 | "Loading militia ledger…"                                                                                              | `canonical-campaign-dashboard.tsx`     | —                    |

## Characters (CHAR)

`/campaigns` Ledger tab · `c/character-manager.tsx`, `c/character-manager/`, `c/ledger-shell.tsx`.

| Id      | Capability                                                                                                          | Where                                       | E2E                        |
| ------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------- |
| CHAR-01 | Character Ledger panel: open/close, "Tracking N active characters"                                                  | `character-manager.tsx`, `ledger-shell.tsx` | `ledger`, `access-nightly` |
| CHAR-02 | Active characters table sorted by name: name, level, STR–CHA, kind                                                  | `character-list-card.tsx`                   | `ledger`, `access-nightly` |
| CHAR-03 | **Add Character** dialog: name, level (≥1), kind (PC / Officer NPC), six ability scores, notes. Validation messages | `character-form-card.tsx`, `types.ts`       | `ledger`, `access-nightly` |
| CHAR-04 | **Edit** a character in the same dialog                                                                             | `character-manager.tsx`                     | `access-nightly`           |
| CHAR-05 | **Archive** a character                                                                                             | `character-list-card.tsx`                   | —                          |
| CHAR-06 | **Show Archived** dialog with **Un-archive**                                                                        | `archived-characters-card.tsx`              | —                          |
| CHAR-07 | Save and archive errors shown inline                                                                                | `character-manager.tsx`                     | —                          |
| CHAR-08 | Character changes sync to other players in real time                                                                | `character-manager.tsx`                     | `ledger`                   |
| CHAR-09 | States: "Select a campaign…", "Checking organization access...", "No active characters", "No archived characters"   | `character-manager.tsx` and cards           | —                          |

## Cross-cutting states (STATE)

| Id       | Capability                                                                                                                    | Where                                                                              | E2E                                                     |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------- |
| STATE-01 | Maintenance pause: "Campaign editing is paused for maintenance. Please try again shortly." when cutover mode is not canonical | `/campaigns` · `c/campaign-dashboard.tsx`                                          | —                                                       |
| STATE-02 | "Loading campaigns…" and the route-level "Loading..." fallback                                                                | `/campaigns` · `c/campaign-dashboard.tsx`, `app/campaigns/loading.tsx`, `page.tsx` | —                                                       |
| STATE-03 | "Campaigns could not be loaded. Please try again." and the route-level error text                                             | `/campaigns` · `c/canonical-campaign-dashboard.tsx`, `app/campaigns/error.tsx`     | —                                                       |
| STATE-04 | "Select an organization with campaign access."                                                                                | `/campaigns` · `c/canonical-campaign-dashboard.tsx`                                | —                                                       |
| STATE-05 | Week, setup and history loading/unavailable/failed states                                                                     | see WEEK-12, SETUP-23, HIST-07                                                     | see those                                               |
| STATE-06 | Changes made on one device reload intact on another after refresh                                                             | all screens                                                                        | `slot`, `week`, `existing`, `access-nightly`, `cutover` |

## Observations for the designs

Facts about today's UI that later tickets may want to decide on. None of them is a decision.

- The week screen appears twice: embedded in `/campaigns` and standalone at `/canonical-workspace`. Links (Finished weeks, Set up militia, Return to current week) always go to the standalone routes, so leaving `/campaigns` loses the sidebar campaign context.
- Setup can only be reached from the "This week is unavailable" state or by URL. Finished weeks can only be reached from the week screen.
- The selected campaign is not in the URL, so reloading `/campaigns` returns to the first campaign.
- Officer and manager assignment (LEDG-03) lives in the correction form, not with the characters (CHAR); the character dialog says so.
- Many capabilities have no browser coverage (every `—` above), including campaign creation, archiving, history navigation, the maintenance pause and most error states.

## Planned implementation ownership

The sections below record planned ownership and acceptance coverage from the approved UI rework. They do not change the current routes, behavior, or E2E coverage recorded above. Signed-off replacements apply when their owning implementation ships; existing controls remain available until then. Each linked implementation issue carries its source decisions, prototype pins, rollout requirements, and validation gate.

### Planned: Navigation shell (rollout 1)

Implementation spec: [Implement the campaign navigation shell and scoped routes](https://github.com/AndreasUnunger/EverythingPath/issues/135), authored by [Write the Navigation shell implementation spec](https://github.com/AndreasUnunger/EverythingPath/issues/123). This is **planned coverage**, not a claim that the routes, layouts or tests have shipped. Current-location and E2E columns above retain the inventory snapshot stated at the top of this document; this spec was checked against main at `eef41f7bad19e63ecce858e7a4490c937a4ece89`. the existing NAV-01 removal entry records design approval while the sidebar still exists in that code. Implementation updates those current-behavior rows when it lands.

| Exact id | Planned ownership and acceptance | Handoff |
| --- | --- | --- |
| NAV-01 | Shell removes the approved sidebar; preserve destination access. | [Week frame](https://github.com/AndreasUnunger/EverythingPath/issues/124) inherits remembered open/closed visibility for the reference panel. |
| NAV-02 | Shell Keep link opens `/campaigns`. | [Campaign list/home](https://github.com/AndreasUnunger/EverythingPath/issues/134) reuses it. |
| NAV-03 | Shell preserves home navigation through `/` → `/campaigns` and Keep/All campaigns; the My Keep placeholder is the approved replacement. | Campaign list/home owns final destination content. |
| NAV-04 | Shell campaign-list navigation remains reachable with active-location indication. | Campaign list/home. |
| NAV-05 | Shell sign-in control remains reachable, including phone More and campaign sign-in state. | Campaign list/home consumes it. |
| NAV-06 | Shell organization switcher filters campaign access and sends an organization change to its campaign list. | Campaign list/home owns final list organization states. |
| NAV-07 | Shell account and sign out remain reachable in top bar/More. | All page owners consume it. |
| NAV-08 | Shell renders an accessible account skeleton while auth resolves. | All page owners consume it. |
| NAV-09 | Shell replaces floating mobile sidebar trigger with bottom section tabs and More. | Approved responsive rearrangement; no navigation destination is lost. |
| NAV-10 | Shell Finished weeks link keeps campaign context. | Week frame owns reference-panel entry; [Finished weeks](https://github.com/AndreasUnunger/EverythingPath/issues/133) owns page. |
| NAV-11 | Shell setup links target the same campaign. | Week frame and [Militia corrections](https://github.com/AndreasUnunger/EverythingPath/issues/131) own final no-militia pages. |
| NAV-12 | Shell Week tab and hosted history return link preserve campaign context. | Finished weeks owns final return CTA. |
| NAV-13 | Shell hosted completed-setup return link works. | [Setup](https://github.com/AndreasUnunger/EverythingPath/issues/130) owns final started-militia page and Open week N/Open militia. |
| NAV-14 | Shell routes setup success to the selected valid phase of the same campaign. | Setup owns initialization and collision behavior. |
| NAV-15 | Shell preserves five phase URL values, invalid→Upkeep and player-local navigation. | Week frame owns phase navigation and Persistent Phase Eligibility. |
| NAV-16 | Shell hosts all week and ledger capabilities in reachable campaign sections. | Existing page editors remain until named area replacements ship. |
| CAMP-01 | Shell retains current list/picker/default and provides campaign-page switcher. | Campaign list/home owns final list rows. |
| CAMP-02 | Shell campaign route selection persists through reload and isolates campaign content. | Campaign list/home owns final pane selection. |
| CAMP-03 | Shell preserves existing campaign-create dialog access. | Campaign list/home owns form and approved result-shape change. |
| CAMP-04 | Shell preserves current empty-organization create entry. | Campaign list/home owns final empty layout. |
| CAMP-05 | Shell guards campaign routes with active-organization membership and neutral outsider/wrong-organization presentation. | All page owners retain backend authorization; Campaign list/home owns final list states. |
| STATE-01 | Shell maintenance banner leaves all hosted pages/list readable and writes use normal failure feedback. | All page owners consume it. |
| STATE-02 | Shell/name/account loading scaffold plus current readable page statuses. | Campaign list/home owns list skeleton; individual page owners own full page skeletons. |
| STATE-03 | Shell supplies shared neutral failed-load card with page-local Try again; tabs remain usable. | Campaign list/home and other page owners supply nouns/retry actions. |
| STATE-04 | Shell owns wrong-organization campaign state and organization chooser recovery. | Campaign list/home owns final no-organization/list-access states. |
| STATE-05 | Shell owns campaign access boundary without losing page loading/retry/empty states. | Week frame, Setup and Finished weeks own final page states. |
| STATE-06 | Shell routes/hosts preserve reload and cross-device persistence. | Shared regression obligation across all area owners. |
| WEEK-03 | Shell navigation never changes another player's Phase View. | Week frame owns full behavior. |
| WEEK-08 | Shell links/campaign/organization changes preserve existing pending-edit and Confirmation departure protection. | Week frame owns ongoing barrier/feedback. |
| WEEK-12 | Shell separates unavailable campaign from page failure and retains no-militia setup route. | Week frame owns final skeleton/empty/failed page. |
| SETUP-22 | Shell keeps completed setup return navigation reachable. | Setup owns later already-set-up page; bookmark redirect layer must not force week navigation. |
| SETUP-23 | Shell supplies campaign access gate and keeps current setup state coverage. | Setup owns layout skeleton/failure details. |
| HIST-02 | Shell history adapter preserves previous/next/latest in the same campaign. | Finished weeks owns final browsing layout. |
| HIST-03 | Shell preserves selected audit entry and Earlier entries with existing query arguments. | Finished weeks owns final audit presentation/paging. |
| HIST-07 | Shell preserves current history loading/failure/empty coverage under shared access boundary. | Finished weeks owns final states. |
| LEDG-01 | Shell hosts existing correction editor until replacement. | Militia corrections owns per-section Correct. |
| LEDG-03 | Shell retains roster/officer/manager editing in Militia with a link from Characters & officers. | Militia corrections must retain roster/officer fallback until [Characters & officers](https://github.com/AndreasUnunger/EverythingPath/issues/132) ships; managers remain with teams. |
| LEDG-05 | Shell hosted correction requires the existing reason. | Militia corrections and Characters & officers own replacement correction flows. |
| LEDG-06 | Shell hosted correction retains current revision/save/conflict behavior. | Militia corrections owns later section merge and reference/conflict handling. |
| LEDG-09 | Shell keeps pre-setup character access on Characters & officers. | Militia corrections and Characters & officers own final empty states. |
| LEDG-10 | Shell keeps readable current ledger-loading state. | Militia corrections owns final skeleton. |
| CHAR-01 | Shell exposes existing CharacterManager with create/edit/archive/unarchive through Characters & officers. | Characters & officers owns the full replacement; legacy Militia embedding may remain during rollout. |
| CHAR-08 | Shell hosting keeps character edits realtime and campaign-scoped. | Characters & officers owns full behavior. |
| CHAR-09 | Shell campaign context makes Select a campaign… unnecessary; retain other current character states until replacement. | Characters & officers owns empty/archive/access skeleton states; removal is only the explicitly approved fragment. |
| NAV-17 — **new, planned** | Campaign-scoped routes and legacy redirects preserve campaign, phase and supported history selection across reload/Back/Forward. | Shell owns; downstream pages use the route contract. |
| STATE-07 — **new, planned** | Neutral campaign-level sign-in/unavailable state and organization/Back to campaigns recovery. | Shell owns; every campaign page consumes it. |

Approved changes/removals: NAV-01 sidebar and NAV-03 placeholder destination replacement are authorized by [navigation resolution](https://github.com/AndreasUnunger/EverythingPath/issues/102#issuecomment-5831173561); NAV-09 trigger is replaced by bottom navigation/More under [responsive-shell approval](https://github.com/AndreasUnunger/EverythingPath/issues/120#issuecomment-5846493929); only CHAR-09's **Select a campaign…** fragment is removed under [shared-state approval](https://github.com/AndreasUnunger/EverythingPath/issues/119#issuecomment-5846266381); the standalone correction address is replaced by `/militia` under [setup/correction approval](https://github.com/AndreasUnunger/EverythingPath/issues/103#issuecomment-5834024251). No current character, correction, history/audit or week-editing capability is removed merely because a prototype omits it.

Shell and Week frame cannot depend on the future finished-weeks listing query: current Finished weeks access and existing `canonicalHistory.read` remain usable until rollout 11. All current browser scenarios (including nightly) and direct persistence/Confirmation contracts keep equivalent coverage; the implementation issue enumerates them. No schema/payload/rules change or Ruleset Version bump belongs to this shell delivery.

### Setup — planned ownership

Implementation spec: [Implement guided Militia Setup with browser resume](https://github.com/AndreasUnunger/EverythingPath/issues/138). Shipping position 8, after Review & confirm and before Militia corrections. All destinations and coverage below are **planned**, not shipped; preserve the baseline current-location/E2E rows above until implementation.

| ID | Destination and acceptance |
| --- | --- |
| SETUP-01 | Starting point: New/Existing retains entered facts; New defaults rank 1, training 0, 1,000 copper (10 gp). Switching Existing clears the first-militia-week skip as today. |
| SETUP-02 | Starting point: focus, rank, training, treasury in copper and notoriety, with current numeric semantics and defaults. |
| SETUP-03 | Week: current week, start day, first militia week shown only for New, previous week uneventful and optional last persistent buyoff week. |
| SETUP-04 | Week: all five open phases; Persistent without carried events warns and opens Upkeep under current eligibility rules. |
| SETUP-05 | People & officers: campaign records, roster inclusion/removal, current kind, Hit Dice and six officer-role toggles. Removing a person clears its roles and managers; do not delete the character record. Keep all current kinds/Hit Dice validation until the named migration. |
| SETUP-06 | Teams: add/remove, name, type, active/disabled/missing condition, reward-limit exemption, manager from roster and notes. |
| SETUP-07 | Character conditions: add/remove, character, available/hidden/captured/recovering/dead, headquarters/refuge/elsewhere location and description, PCs must rescue, capture source/week, rescued/restored weeks. |
| SETUP-08 | Settlements: add/remove, name, reputation, secured/occupied, temporary reputation shift, Reduce Danger shift/end week and refuge activated/end weeks. |
| SETUP-09 | Carried effects: persistent-event instances with type, started week, processing order, all supported entity targets and Theft mitigation week. Repeated types retain separate identities and targeting. |
| SETUP-10 | Assets: items, including add/remove, name, value, militia/character ownership, identified, weight and location. |
| SETUP-11 | Assets: caches, including location, class, status, secure/extradimensional, return Activity week and item contents. |
| SETUP-12 | Assets: orders, including item, delivery settlement, source/kind, ordered week/day, due day/Activity week, price, delivery days, enchantment value and receipt recorded/cleared with received day. Preserve decimal enchantment input. |
| SETUP-13 | Assets: marketplaces, including source, settlement, available/expires week, availability, availability percentage, sale percentage and contraband. |
| SETUP-14 | Carried effects: queued effects with source, start/end week and every existing branch: check modifier, upkeep loss multiplier, activity training multiplier, event chance, all is calm, automatic events, blocked action, team unavailable, team return and narrative. Retain each branch's fields. |
| SETUP-15 | Carried effects: one-use bonuses with source, applies-to, team, phase, amount and available/consumed week. |
| SETUP-16 | Carried effects: skill benefits with characters, skills, bonus type/value, settlement, after-dark and start/end week. |
| SETUP-17 | Carried effects: Market Day benefits with settlements and start/end week. |
| SETUP-18 | Review & start: optional setup notes, persisted unchanged and displayed after entry through Week frame's WEEK-09. |
| SETUP-19 | Live non-blocking section warnings and collected review warnings with links; remove only the approved keep-and-explain hint. |
| SETUP-20 | Field errors for empty versus malformed values and linked review error summary; preserve structural/reference validation. |
| SETUP-21 | Start militia week, Starting militia… pending feedback, retry with values retained on failure; no duplicate initialization. |
| SETUP-22 | Initially started: “This militia is already set up.” with Open week N and Open militia, inside the shell. |
| SETUP-23 | Setup-specific responsive skeleton and screen-reader loading status, failed-load card/Try again; shell handles unavailable/signed-out campaigns. |
| SETUP-24 (new) | Browser resume of unfinished values, including incomplete numeric input, nested entries, selected step and mode, safely scoped to the signed-in account, organization and campaign. |
| SETUP-25 (new) | Nine freely navigable steps, live status/counts, optional grouping, Next and linked review navigation across all breakpoints. |
| SETUP-26 (new) | Inline Add character creates through existing character dialog/mutation and appears reactively in People & officers without losing unfinished setup. |
| SETUP-27 (new) | Another player completes setup while the form is open: detect started transition and automatically open the current week without overwriting the accepted setup. |

Shared IDs and owners:

| ID | Setup obligation and other owner |
| --- | --- |
| NAV-11 | Consume shell's same-campaign Setup entry from Week/Militia; Week frame/Militia corrections own their empty-page links. |
| NAV-13 | Own both started-page links; Navigation shell supplies scoped destinations. |
| NAV-14 | Own successful start navigation to the same campaign's requested eligible phase; shell routes it, Week frame enforces Phase View eligibility. |
| NAV-15 | Preserve all phase values/fallback; shell owns parsing and Week frame owns later phase navigation. |
| NAV-17 | Consume shell's scoped route and legacy redirect contract; preserve setup bookmarks. |
| CHAR-03 | Reuse existing full Add character dialog: name, current kind, level, six ability scores, notes and validation; Characters & officers owns overall CRUD and its later redesign. |
| CHAR-07 | Inline character failure keeps its form values with existing error presentation; Characters & officers owns general CRUD errors. |
| CHAR-08 | Newly created/changed character options arrive on other members' devices; Characters & officers owns records' realtime contract. |
| LEDG-02 | Shared Values editor/validation primitives; Militia corrections owns correction UI and save behavior. |
| LEDG-03 | Shared roster/officer/team-manager field primitives; Militia corrections retains the legacy roster/officer editor until Characters & officers replaces it. |
| LEDG-04 | Shared section field primitives and reference semantics; Militia corrections owns all correction entry points. |
| LEDG-07 | Shared section-keyed warning presentation; Militia corrections owns warning aggregation at each correction save. |
| WEEK-09 | Persist notes; Week frame owns their display during normal play. |
| STATE-01 | Render under shell maintenance banner; inputs stay readable/editable and server pause failures use ordinary save feedback. |
| STATE-02 | Own Setup layout skeleton; shell owns name/account loading. |
| STATE-03 | Supply “Militia setup could not be loaded.” and page-local Try again using shell's failed-load card. |
| STATE-04 | Respect shell's organization selection and unavailable state; never restore another organization's setup into this page. |
| STATE-05 | Own Setup-specific loading/failure/started state while shell owns campaign access. |
| STATE-06 | Setup accepted state/characters persist and are shared; unfinished form is deliberately browser-local. |
| STATE-07 | Consume shell's neutral sign-in/unavailable campaign gate before rendering protected data or restoring its form. |

**Signed-off removals/replacements:** [prototype approval](https://github.com/AndreasUnunger/EverythingPath/issues/113#issuecomment-5844235691) removes explanatory captions, including the browser-persistence note, People introduction and SETUP-19 keep-and-explain hint; it does not remove persistence, warnings, field labels, required validation or status captions. [Shared-state approval](https://github.com/AndreasUnunger/EverythingPath/issues/119#issuecomment-5846266381) replaces SETUP-22's old completion text and initial-entry redirect with the two-link started page, and SETUP-23's visible loading paragraph with a layout skeleton plus accessible status. No data-entry capability is removed.


Coverage plan: preserve `existing-militia.spec.ts`, `canonical-workspace.spec.ts`/`support/setup-workspace.ts`, character-ledger/access/nightly journeys, Action Slot/complete-week/cutover journeys and all direct persistence/Confirmation scenarios. Retain setup pure/component/Convex integration contracts for idempotent initialization, complete imports, authority, foreign-reference rejection, competing starts and existing first-week skip. Add focused guided navigation/status, raw browser-resume/isolation, inline reactive creation, initial-started versus live completion, own-phase race, responsive/accessibility and page-state cases as specified in the linked issue. No tests were executed for this documentation-only authoring.

Handoffs: [Navigation shell](https://github.com/AndreasUnunger/EverythingPath/issues/135) supplies scoped routes/access/maintenance; Week frame supplies ongoing Phase View behavior and WEEK-09 notes; [Militia corrections authoring owner](https://github.com/AndreasUnunger/EverythingPath/issues/131) consumes section editors/validators/warning descriptors while owning save merges/conflicts and retaining roster/officer fallback. [Characters & officers authoring owner](https://github.com/AndreasUnunger/EverythingPath/issues/132) owns later `pc | npc`, roster kind mirroring, commandant fallback, manager rules and compatibility across Setup's existing form/schema, inline CRUD, character source and versioned browser envelopes. The Setup spec does not change any backend schema, argument/result shape or Ruleset Version; existing options lacks week/kind, so reuse authorized current reads rather than quietly add fields.

### Week frame — planned implementation coverage

Implementation spec: [Implement the shared Week frame and cross-device week transition](https://github.com/AndreasUnunger/EverythingPath/issues/137), authored by [Write the Week frame implementation spec](https://github.com/AndreasUnunger/EverythingPath/issues/124). **Planned coverage only:** the locations and E2E columns above continue to describe the inventory snapshot; no frame, notice, layout or new test is claimed shipped. Code inspected at main `eef41f7bad19e63ecce858e7a4490c937a4ece89`; authoring baseline `6836fadf2ec5430f725681df1a3fb9b066fb7dcc` adds Navigation shell planning accounting only. Week frame is rollout 2 after [Navigation shell](https://github.com/AndreasUnunger/EverythingPath/issues/135); phase owners replace existing editors later.

Shared owner links: [Upkeep](https://github.com/AndreasUnunger/EverythingPath/issues/125), [Activity](https://github.com/AndreasUnunger/EverythingPath/issues/126), [Event](https://github.com/AndreasUnunger/EverythingPath/issues/127), [Persistent](https://github.com/AndreasUnunger/EverythingPath/issues/128), [Review & confirm](https://github.com/AndreasUnunger/EverythingPath/issues/129), [Setup](https://github.com/AndreasUnunger/EverythingPath/issues/130), [Finished weeks](https://github.com/AndreasUnunger/EverythingPath/issues/133). These authoring tickets supply the later concrete implementation links; the current Week frame output is linked above.

| ID | Acceptance / disposition | Ownership / handoff |
| --- | --- | --- |
| WEEK-01 | Week N plus selected phase replaces the duplicate heading while preserving accessible week/phase context. | Frame; shell renders Week tab. |
| WEEK-02 | Five-step navigation, all-phase readiness, locked Persistent, footer and This phase. | Frame; phases supply facts. |
| WEEK-03 | Player-local navigation survives saving, URL changes and Back/Forward. | Frame; shell route adapter. |
| WEEK-04 | All edits remain shared in real time without claims/locks; remote-change notice. | Frame feedback; each editor keeps existing writes. |
| WEEK-05 | Immediate optimistic preview refreshes values, counts and editor. | Frame/store; all phase consumers. |
| WEEK-06 | One accessible save/error/confirming status in the shell, including phone icons. | Frame; shell placement. |
| WEEK-07 | Rejected edit restores saved values and invalidates review. | Frame/store; Review & confirm renders recovery control. |
| WEEK-08 | Pending departure protection covers unload and section/campaign/organization exits. | Frame plus shell guard. |
| WEEK-09 | Existing setup notes move into a reachable button/panel. | Frame. |
| WEEK-10 | Weekly editing disabled during Confirmation, including retained editors and open input surfaces. | Frame plus Review & confirm control. |
| WEEK-11 | Every device transitions to next-week Upkeep without a skeleton flash. | Frame/store; same Confirmation contract. |
| WEEK-12 | Week skeleton, neutral failed card/retry and no-militia setup path; campaign access handled outside. | Frame plus shell access boundary. |
| WEEK-13 | All existing choice interactions remain usable in hosted editors. | Shared: Upkeep, Activity, Event, Persistent, Review & confirm own their eventual approved tap/card controls; no global drag removal in frame. |
| WEEK-14 | Hosted whole-number inputs retain required/invalid distinction, clear/zero semantics and styled feedback. | Upkeep coordinates shared roll input work; every phase retains its own field validation; frame preserves access. |
| WEEK-15 | Existing ordered multi-die entry remains until approved dice-total migration. | Upkeep owns shared contract/read compatibility and updates Activity/Event/Persistent/Review & confirm consumers; frame introduces no roll-format change. |
| WEEK-16 | Out-of-range dice remain advisory and visible in editor/phase warnings. | Upkeep, Activity, Event, Persistent own inputs; frame aggregates warnings. |
| WEEK-17 | Tablet, phone and desktop frame replacements plus usable hosted editors, no clipped controls/horizontal page scroll. | Frame; each phase owns its later internal responsive redesign. |
| WEEK-18 | Existing structured list/nested/discriminated/modifier Save/Clear/add/remove operations stay usable. | Activity, Event, Persistent and Review & confirm own their editor replacements; frame cannot remove structured fields absent replacement coverage. |
| WEEK-19 — new, planned | Every observing device gets Week N confirmed and a correct historical-week link once the successor arrives. | Frame; Finished weeks owns destination. |
| NAV-01 | Remembered panel visibility replaces the retired sidebar's local preference. | Shell removes sidebar; frame preserves preference behavior. |
| NAV-10 | History reference tab, recent-week links and All finished weeks preserve campaign. | Frame; shell section link; Finished weeks owns final listing query/page. |
| NAV-11 | No-militia Week links to campaign Setup. | Frame; shell route; Setup destination. |
| NAV-15 | Five phase URL values, invalid fallback, Persistent eligibility and local Back/Forward. | Frame plus shell parser. |
| STATE-01 | Consume readable maintenance banner and existing write-failure path. | Shell owner; frame feedback. |
| STATE-02 | Week-shaped skeleton and accessible loading status. | Frame portion; shell name/account scaffold. |
| STATE-03 | Week failure uses shared card and page-local Try again; tabs remain usable. | Frame retry; shell component. |
| STATE-05 | Loading/failure/no militia is distinct from campaign unavailable. | Frame week portion; shell access; Setup/Finished weeks own theirs. |
| STATE-06 | Shared changes survive reload and cross-device navigation. | All owners; frame regression gate. |
| UPK-11 | Aggregate Upkeep warning visibility in This phase/counts. | Frame summary; Upkeep retains item warnings/reasons. |
| UPK-12 | Upkeep readiness in stepper/footer/This phase. | Frame; Upkeep facts/editor. |
| ACT-17 | Aggregate Activity warning/required-preparation visibility. | Frame summary; Activity owns per-choice warnings and hints. |
| EVT-11 | Aggregate Event warnings remain visible. | Frame summary; Event owns item warnings/Rules Exceptions. |
| EVT-14 | Required Event preparation remains visible. | Frame summary; Event owns per-occurrence list. |
| PER-08 | Aggregate Persistent warnings remain visible. | Frame summary; Persistent owns item warnings/Rules Exceptions. |
| PER-10 | Persistent preparation and earlier-phase dependencies remain visible. | Frame summary; Persistent owns item inputs. |
| SUM-01 | No Summary step caption or ready/needs-attention footer; retain disabled reason. | Frame chrome now; Review & confirm owns later block-copy removal. |
| SUM-02 | Aggregate required decisions available in This phase; hosted required list remains. | Review & confirm owns final review list and Go links; frame navigation supplies destination. |
| SUM-03 | Keep readiness/saved/reviewed Confirmation gate and hosted control. | Review & confirm owns final control; frame never infers confirmability from count alone. |
| SUM-04 | Concurrent Confirmation remains single-winner and stale-safe. | Existing persistence contract; shared frame/Review & confirm tests. |
| SUM-05 | Keep stale-review alert and Review updated week reachable after failure/remote changes. | Review & confirm owns control; frame/store carries invalidation. |
| SUM-09 | Aggregate warnings available in panel and preserved Summary warning list. | Frame summary; Review & confirm owns final list. |
| SUM-06 | Hosted baseline/final preview and all existing facts stay reachable. | [Review & confirm](https://github.com/AndreasUnunger/EverythingPath/issues/129) owns replacement presentation. |
| SUM-07 | Hosted Rules Exception edit/clear and obsolete exception removal stay reachable. | Review & confirm. |
| SUM-08 | Hosted Table Adjustments add/edit/clear/reorder with reasons stay reachable. | Review & confirm. |
| SUM-10 | Hosted consequences remain readable until replaced by numbered sections. | Review & confirm. |
| SUM-11 | Hosted recorded table outcomes remain readable. | Review & confirm. |
| NAV-17 | Consume campaign-scoped route/deep-link and history-selection contract already planned by shell. | [Navigation shell](https://github.com/AndreasUnunger/EverythingPath/issues/135); no new ID allocation. |
| STATE-07 | Consume neutral campaign unavailable/sign-in boundary. | Navigation shell; no new ID allocation. |

Approved removals/replacements: [Week-layout approval](https://github.com/AndreasUnunger/EverythingPath/issues/101#issuecomment-5831260876) replaces WEEK-01's duplicate heading with Week tab/current step, drops the prototype's duplicate History icon while retaining NAV-10, and moves WEEK-09 setup notes into a button. [Summary approval](https://github.com/AndreasUnunger/EverythingPath/issues/110#issuecomment-5844063536) removes the Review & confirm caption and ready/needs-attention sentences; disabled-Confirmation reasons remain. Frame applies its caption/footer portion now; Review & confirm owns the later review-block sentence/note removals. [State approval](https://github.com/AndreasUnunger/EverythingPath/issues/119#issuecomment-5846266381) replaces WEEK-12 loading/error/unavailable presentation with accessible skeleton, Try again and no-militia/shell-access states; it adds WEEK-19's cross-device notice. [Responsive approval](https://github.com/AndreasUnunger/EverythingPath/issues/120#issuecomment-5846493929) replaces phone stepper/panel/footer with step sheet/reference sheet/status strip, preserving access. NAV-01's sidebar removal is shell-owned under [navigation approval](https://github.com/AndreasUnunger/EverythingPath/issues/102#issuecomment-5831173561); frame inherits remembered local reference visibility.

No shared choice, numeric, roll, structured-field or Confirmation capability is removed by the frame. WEEK-15 remains the old ordered-dice interaction until Upkeep delivers its approved shared dice-total compatibility change; WEEK-13's future tap/card replacements and WEEK-18's replacement forms belong to their phase owners. History references initially use the existing reader rather than assuming rollout 11's listing query exists. Implementation updates current-location and actual-test coverage only when the behavior lands.

### Planned: Militia corrections

Output: [Implement in-place Militia corrections and reference repair](https://github.com/AndreasUnunger/EverythingPath/issues/139), from [Write the Militia corrections implementation spec](https://github.com/AndreasUnunger/EverythingPath/issues/131). Shipping position 9 of 12, after [guided Militia Setup](https://github.com/AndreasUnunger/EverythingPath/issues/138). All locations/coverage below are **planned, not shipped**; current-location rows above stay unchanged until implementation.

Militia corrections owns the nine correction sections, required reasons, latest-section merge/conflict, manager controls, read-only carried state and same-API draft-reference repair. Keep the existing roster/officer correction editor until Characters & officers replaces it; no schema/payload/rules migration or correction-history query. New IDs LEDG-11, LEDG-12 and LEDG-13 are reserved by this spec.

| ID | Acceptance / coverage obligation |
| --- | --- |
| LEDG-01 | Replace the single Edit militia ledger toggle with per-section Correct/Cancel; retain a reachable temporary roster/officer editor. Test one local editor and Cancel without a write. |
| LEDG-02 | Values: focus, rank, training, treasury in copper, notoriety. Defaults/validation reuse Setup, intentional numeric overrides remain possible. |
| LEDG-03 | Teams retains manager assign/replace/clear from roster people, names and limit warnings. Temporarily preserve roster inclusion/removal, kind, Hit Dice and six officer-role assignments; final roster/officer owner is Characters & officers. Removing a roster person clears their roles and team managers with named warnings, without deleting the character record. |
| LEDG-04 | Preserve every correctable field in the section table below, including add/remove, conditions, asset delivery/receipt facts and both carried benefit types. Test each section's isolated save and nested sibling preservation. |
| LEDG-05 | Each correction requires entered free text, trimmed nonempty, at most the existing 2,000-character server limit. No Militia preset chips or prefilled reason; blank/whitespace fails inline and in the save summary. |
| LEDG-06 | Merge only the edited section into latest accepted state; latest revision on save; same-section conflict shows theirs/yours and Start again from their values. Pending, failure/retry and unknown-ack behavior cannot overwrite remote changes or duplicate an acknowledged correction. |
| LEDG-07 | Section warnings plus collected save-point warnings are advisory; fields and linked error summary distinguish invalid data. Remove only approved explanatory hints. |
| LEDG-08 | Expose previously hidden week context, carried persistent events, queued effects and one-use bonuses read-only, in Changes through the week. No correction fields for them. |
| LEDG-09 | No militia: show No militia yet. and Set up militia; character CRUD remains usable on Characters & officers. |
| LEDG-10 | Responsive skeleton, accessible Loading militia ledger… status, page failure/Try again and successful recovery inside the shell. |
| LEDG-11 — new, planned | Section index/detail with count/warning indicators, phone single-open rows and desktop previews, including accessible navigation and only one correction open. |
| LEDG-12 — new, planned | Before save, identify all staged choices affected by candidate source changes, with human names/slot positions and reachable phase controls; after save recompute warnings on every device. |
| LEDG-13 — new, planned | Recover from source-correction orphaned references through existing draft edits when a complete valid result is possible, or identity-preserving source restoration through the ordinary correction API; cover multiple orphans, reload and another device. No relaxed validation or new payload. |

Shared IDs, each explicitly retained:

| ID | Militia obligation / owner |
| --- | --- |
| SETUP-02 | Reuse Values editor and structural validation; Setup owns initialization. |
| SETUP-05 | Reuse roster/officer fields for temporary fallback; Setup owns initialization, Characters & officers owns permanent replacement/migration. |
| SETUP-06 | Reuse all team fields/manager choices; Setup owns initialization. |
| SETUP-07 | Reuse full character-condition editor; Setup owns initialization. |
| SETUP-08 | Reuse full settlement editor; Setup owns initialization. |
| SETUP-10 | Reuse all item fields; Setup owns initialization. |
| SETUP-11 | Reuse all cache fields; Setup owns initialization. |
| SETUP-12 | Reuse complete order editor including decimals and receipts; Setup owns initialization. |
| SETUP-13 | Reuse all marketplace fields; Setup owns initialization. |
| SETUP-16 | Reuse carried skill-benefit editor; Setup owns initialization. |
| SETUP-17 | Reuse carried Market Day editor; Setup owns initialization. |
| SETUP-19 | Reuse section-keyed advisory warnings; Setup owns initialization review, this issue correction review. |
| SETUP-20 | Reuse field and reference validation with linked errors; Setup owns initialization, this issue merged-correction validation. |
| NAV-11 | Militia no-militia link opens same-campaign Setup; shell owns routing. |
| NAV-16 | Every old correction operation remains reachable throughout rollout; shell temporary hosting is replaced here. |
| NAV-17 | Consume scoped Militia/Characters/Week routes and context-preserving bookmarks; shell owner. |
| CHAR-01 | Character list remains reachable on Characters & officers, not removed when replacing the old ledger tab; Characters & officers owns it. |
| CHAR-08 | Current character changes update manager options/effects and are never overwritten by a stale correction; Characters & officers owns record updates. |
| CHAR-09 | Retain pre-setup/empty/archive behavior on Characters & officers; shell owns unavailable campaign. |
| WEEK-03 | Repair navigation changes only this player's Phase View; Week frame owns phase navigation. |
| WEEK-08 | Preserve pending-save/Confirmation departure safeguards and recovery feedback when navigating between Militia and Week; Week frame owns weekly barrier. |
| WEEK-12 | Militia links into existing same-campaign week states; Week frame owns those states. |
| STATE-01 | Shell banner leaves militia readable/editable; paused writes fail normally with fields/reason retained. |
| STATE-02 | Militia owns its section skeleton; shell owns name/account skeleton. |
| STATE-03 | Use shell's shared card: The militia could not be loaded. with page-local Try again, tabs usable. |
| STATE-04 | Respect shell organization selection/unavailable state; never show stale prior-organization facts. |
| STATE-05 | Militia owns its loading/failure/no-militia distinction; campaign access remains shell-owned. |
| STATE-06 | Saved corrections, warnings and restored references update other players and survive reload. Shared regression obligation. |
| STATE-07 | Use shell neutral unavailable/sign-in gate before protected page reads. |

**Signed-off replacements/removals:** [separate workflows](https://github.com/AndreasUnunger/EverythingPath/issues/103#issuecomment-5834024251) replaces LEDG-01's whole-page toggle and `/militia/correct` with in-place corrections and transfers roster/officer ownership; this does not authorize removing that fallback early. [Prototype approval](https://github.com/AndreasUnunger/EverythingPath/issues/113#issuecomment-5844235691) removes explanatory captions: the weekly-actions hint, keep-and-explain warning hint, reason helper, “you can still save…” line and conflict explainer. Keep concise warnings, field labels, actionable errors, read-only group label and validation. [State approval](https://github.com/AndreasUnunger/EverythingPath/issues/119#issuecomment-5846266381) replaces visible ledger-loading copy with skeleton/accessibility status and pre-setup ledger content with the no-militia page while preserving character access elsewhere. No field, manager operation or reason requirement is removed.


Coverage plan: preserve all existing E2E scenarios, especially `character-ledger.spec.ts`, `existing-militia.spec.ts`, setup/workspace and persistence/Confirmation journeys; add section merge/conflict, required reason, carried-state, membership/scope and responsive/state coverage. Prove same-identity recovery for multiple staged orphans through existing source corrections, including reload/another device and required fact entry without an archive query. Implementation must add Militia Correction to the glossary and update actual shipped locations and tests.

## Planned Upkeep implementation ownership

Implementation issue: [Implement rules-ordered Upkeep and compatible shared dice totals](https://github.com/AndreasUnunger/EverythingPath/issues/140), authored by [Write the Upkeep implementation spec](https://github.com/AndreasUnunger/EverythingPath/issues/125). Rollout position 3, after the Week frame. These are planned locations and compatibility obligations, not shipped claims.

All rows are **planned** until implementation ships. Preserve stable IDs and update actual locations/test mappings on delivery.

| ID | Acceptance and coverage ownership |
| --- | --- |
| UPK-01 | Replace duplicate outcome tiles with section effects plus frame now → after values, retaining starting training/minimum treasury and rank visibility; Upkeep facts, frame presentation. |
| UPK-02 | First-week skip notice and frame “Skipped · first week” caption; skip has no hidden requirements/effects. |
| UPK-03 | All five existing required roll kinds, their conditional presence, notation/DC/bonus/total/modifiers and dice-total input; natural and loss branches tested. |
| UPK-04 | Nearest settlement cards only for applicable maximum-notoriety step; required after check failure; campaign-scoped choices and existing selection/clear semantics. |
| UPK-05 | Recover/Leave disabled and missing-team return rows; newly selecting Remove is retired here, with reachable Militia correction fallback and old-draft repair below. |
| UPK-06 | Rules-prefilled gp recovery cost, automatic valid edits, reasoned treasury adjustment, Use rules cost and Leave cleanup; Stage recovery retired. |
| UPK-07 | Return d20 plus Security bonus/total/result; scheduled-return suppression, end-week timing and natural 1 retained. |
| UPK-08 | All rank-boon details, per-PC fixed-list cards or text acknowledgement and clear; old text preserved. |
| UPK-09 | Inline recovery-funds and withdrawal-funds Rules Exceptions with reason/clear; new team-removal and non-officer-transfer exception entry retired from Upkeep, old recorded facts retained. |
| UPK-10 | Ordered deposit/withdraw Add/remove, gp display/copper persistence and before/after; officer choice retired. |
| UPK-11 | Applicable item warning messages and frame This phase/counts; removal/transfer-officer warnings retired for new ordinary editing, archived-officer bonus diagnostics retained. |
| UPK-12 | Required-decision/readiness facts feed frame footer/This phase and skip caption; no duplicate phase footer or contradictory local ready flag. |
| WEEK-04 | Shared roll/condition/transfer/exception/acknowledgement updates and latest edit wins; frame owns feedback. |
| WEEK-05 | Existing optimistic preview immediately updates section/header/reference/readiness facts. |
| WEEK-06 | Frame save/failed/remote-update feedback remains correct for new editors. |
| WEEK-07 | Rejected saves restore authoritative data and invalidate review; local invalid form entries are not falsely reported as saved. |
| WEEK-08 | Preserve frame departure protection and do not silently discard pending local invalid recovery/transfer entries on destructive form replacement; existing pending-write barrier remains authoritative. |
| WEEK-10 | All Upkeep editing and open input surfaces disabled during Confirmation; frame owns lifecycle. |
| WEEK-12 | Consume frame loading/failure/no-militia states and shell campaign gate; use section skeleton inside week frame while Upkeep content resolves. |
| WEEK-13 | Upkeep condition/settlement/boon choice cards keep tap/keyboard, clear where allowed and touch-safe existing drag affordances where still provided; no global removal of other owners' choice interactions. |
| WEEK-14 | Shared total input retains digits-only/invalid paste protection, zero, blank-clear and required-versus-format feedback; gp money fields use separate copper-exact decimal parser, not integer truncation. |
| WEEK-15 | Approved replacement of ordered per-die entry by one dice-total field; this owner delivers compatibility for all phase consumers and legacy arrays, including incomplete arrays and record readers. |
| WEEK-16 | Advisory total ranges based on required dice count/sides, legacy per-die diagnostics preserved; each phase's warning presentation remains reachable. |
| WEEK-17 | Upkeep numbered sections/check rows and forms fit phone/tablet/desktop; frame owns surrounding responsive shell. |
| WEEK-18 | Shared structured nested-roll adapter must support new totals and legacy forms without losing add/remove/Save/Clear, target, outcome or custom modifier operations; Activity/Event/Persistent/Review own their later layouts. |
| ACT-12 | Compatibility-only update to current Activity roll fields/modifier editor, including multi-die training/delivery; Activity owns full redesign. |
| ACT-13 | Activity check bonus/total remains unchanged for equivalent rolls; Activity owner retains final presentation. |
| EVT-01 | Event chance d100 dual-form input/read compatibility; Event owns full editor. |
| EVT-04 | Event occurrence table-roll dual-form input/read compatibility without changing its tree; Event owns full editor. |
| EVT-05 | Event table modifiers survive shared schema changes; Event owns final modifier layout. |
| EVT-07 | All nested Event detail rolls support both forms and total entry; targets/structured operations remain. Event owns full replacement. |
| EVT-10 | Event check bonus/total/breakdown derives equivalent results; Event owns presentation. |
| EVT-11 | Event roll-format warnings/requirements remain understandable and applicable; Event owns full warnings/exception layout. |
| PER-04 | Nested Persistent checks support both forms and total entry without dropping officer/Overseer fields; Persistent owns redesign. |
| PER-07 | Equivalent Persistent check results/outcomes for both roll forms; Persistent owns final presentation. |
| PER-08 | Persistent roll requirements/range warnings remain available; Persistent owns full warnings/exception layout. |
| SUM-02 | Current Summary still identifies genuinely missing/incompatible rolls and withdrawal-funds reasons; Review & confirm owns presentation. |
| SUM-06 | Equivalent total rolls retain Rules Baseline/Final outcomes; only approved transfer rule changes behavior. Review & confirm owns presentation. |
| SUM-07 | Old exception facts remain readable/editable in existing Summary; no new officer-transfer requirement. Review & confirm owns final presentation. |
| SUM-09 | Current Summary renders applicable new range and transfer warnings; Review & confirm owns final list. |
| SUM-10 | Current consequences read actorless new transfers and equivalent dice totals; Review & confirm owns redesign. |
| SUM-11 | Existing text acknowledgements, including legacy boon outcomes, remain readable; Review & confirm owns presentation. |
| HIST-04 | Recorded Ruleset Version/provenance remain unchanged and readable; Finished weeks owns header redesign. |
| HIST-05 | Current historical record sections remain readable for old/new roll and transfer forms; Finished weeks owns replacement presentation. |
| STATE-01 | Shell maintenance stays readable; attempted Upkeep write follows existing failure path. |
| STATE-05 | Frame states plus shell membership/access state, with no Upkeep-specific access leakage. |
| STATE-06 | Reload and second-member persistence across every changed roll/transfer form; shared regression obligation. |
| LEDG-01 | Existing correction form retains team removal before redesigned Teams correction ships; Militia corrections owns final implementation. |

No new IDs required: total entry, check breakdown and changed transfer interaction replace or extend these existing capabilities. This issue does not claim all of Activity, Event, Persistent, Summary or historical layout as owned merely because it adapts a shared field.

**Signed-off removals/replacements:** [Upkeep approval](https://github.com/AndreasUnunger/EverythingPath/issues/107#issuecomment-5836751035) explicitly covers UPK-05's Remove option, UPK-06's Stage recovery, UPK-09's team-removal and non-officer-transfer exception entry, UPK-10's officer choice, and corresponding UPK-11 removal/transfer-officer warnings. Team removal remains a correction capability. WEEK-15's ordered dice editing becomes one total per roll under the same approval and [shared ownership amendment](https://github.com/AndreasUnunger/EverythingPath/issues/122#issuecomment-5846600504); historical dice detail is not retired. UPK-01 tiles and UPK-12 local hint relocate into headers/frame under the Upkeep and Week layout decisions. No archived-officer bonus diagnostic, withdrawal-funds exception, boon, modifier or historical fact is signed off for removal.


The complete shared roll contract and compatibility/coverage acceptance are in the implementation issue. Existing draft arrays (including partial arrays), operation records, actor-bearing transfers and immutable history remain readable; Upkeep owns all current phase/nested-roll/summary/history adapters before new total writers ship. The transfer character/officer rule removal uses the next unused Ruleset Version; format-only conversion does not re-version or rewrite existing records. Team removal remains available in the current Militia correction form until its redesigned Teams section ships.

## Planned coverage: Characters & officers

Implementation spec: [Implement Characters & officers with role corrections and compatible kind migration](https://github.com/AndreasUnunger/EverythingPath/issues/141). Authored from [Write the Characters & officers implementation spec](https://github.com/AndreasUnunger/EverythingPath/issues/132), rollout position 10 of 12, after [Militia corrections](https://github.com/AndreasUnunger/EverythingPath/issues/139). These changes are planned; current shipped locations and test mappings above remain until implementation.

Own six role cards over the character table, record CRUD/archive, separate reasoned roster/officer corrections, pending Activity roles and read-only manager links. Own PC/NPC migration in character records and retained roster mirrors, all affected Setup/browser-envelope/Activity/correction consumers, role-based manager limits and commandant Hit Dice fallback. Allocate the next unused Ruleset Version after earlier rule changes; preserve all historical records/readers. New IDs CHAR-10–13 are reserved here.

| ID | Acceptance/coverage owned here |
| --- | --- |
| CHAR-01 | Character access/counts move from the embedded collapsible ledger to the dedicated page/table; no lost CRUD access before or after Setup. |
| CHAR-02 | Name-sorted active records, kind and effective Hit Dice; all six stats remain readable/editable in the full dialog. |
| CHAR-03 | Add dialog preserves every existing field/default/validation, with approved PC/NPC and Hit Dice labels; reusable by Setup. |
| CHAR-04 | Edit same dialog, immediate shared record update and retained input on failure. |
| CHAR-05 | Archive in record dialog, assignments preserved and warned. |
| CHAR-06 | Show archived on table and Un-archive in dialog; empty archived state. |
| CHAR-07 | Inline create/update/archive errors, pending acknowledgement, retry and retained values. |
| CHAR-08 | Reactive records, kinds, roles, roster, effects and managed counts on all members' devices; reload persistence. |
| CHAR-09 | Page skeleton, failed/Try again, active/archived empty states and pre-setup records; consume shell access gate. |
| LEDG-03 | Own roster membership/Hit Dice and six-role assign/move/remove, atomic role/manager cleanup on roster removal; Militia corrections retains manager editing. |
| CHAR-10 — new | Role board with current/non-stacking/commandant effects, vacancy, source attribution, candidate contributions and strategist allowance preview. |
| CHAR-11 — new | Pending Change Officer Role display and same-campaign Activity links, derived from open draft without staging anything. |
| CHAR-12 — new | Separate Correct officers/Correct roster modes, quick-pick required reasons, roster conflict handling and named cascade warnings. |
| CHAR-13 — new | Per-character role navigation chips and read-only managed-team count/limit links to Militia Teams. |

Shared IDs, with their owners:

| IDs | Obligation here / owner |
| --- | --- |
| LEDG-01, LEDG-05, LEDG-06, LEDG-07 | Consume Militia corrections' one-open/reason/save/conflict/validation primitives for these two corrections; preserve these capabilities when removing its temporary fallback. |
| LEDG-09 | Pre-setup character CRUD remains here; Militia corrections owns its no-militia page. |
| LEDG-12, LEDG-13 | Consume Militia corrections' affected-choice warnings and valid reference-repair paths; own roster/officer restoration and integrity behavior here. |
| SETUP-05, SETUP-06, SETUP-19, SETUP-20, SETUP-24, SETUP-26 | Update Setup roster/officer/manager editors, warnings, validation, browser envelopes and inline record dialog for kind and Hit Dice migration. Setup remains flow owner. |
| ACT-09, ACT-10, ACT-13, ACT-16, ACT-17 | Activity owns slots/details/check displays/exceptions/warnings; this delivery updates their officer, manager-limit and commandant rules consumers and revalidates staged choices. |
| WEEK-02, WEEK-03, WEEK-04, WEEK-05 | Week frame owns phase navigation/readiness, independent Phase Views, shared updates and optimistic previews; changed officer facts/effects propagate without moving another player. |
| SUM-05 | Review & confirm owns stale-review recovery; character/source revision changes invalidate stale Confirmation normally. |
| HIST-04, HIST-05 | Finished weeks owns historical presentation; preserve old version/provenance and recorded outcomes through compatibility readers. |
| NAV-16, NAV-17 | Consume shell section navigation/scoped routes; retire fallback links only after replacement access exists. |
| STATE-01, STATE-02, STATE-03, STATE-04, STATE-05, STATE-06, STATE-07 | Shell owns pause/access/shared failure pattern; own this page's skeleton/error/empty states, write feedback and cross-device persistence. |

Signed-off replacements/removals: [character-page approval](https://github.com/AndreasUnunger/EverythingPath/issues/114#issuecomment-5844673552) replaces CHAR-01's embedded collapse, CHAR-02's table arrangement, CHAR-05/06's archive placement and the superseded combined correction screen; all underlying data/actions remain reachable. [Officer approval](https://github.com/AndreasUnunger/EverythingPath/issues/112#issuecomment-5836835106) replaces officer_npc/other_npc choices with NPC and removes required commandant override in favor of level fallback. [Caption approval](https://github.com/AndreasUnunger/EverythingPath/issues/113#issuecomment-5844235691) removes explanatory subtext, reason/conflict helper paragraphs and keep-and-explain hints; preserve concise warnings/labels and the separately approved PC-to-Activity hint. [State approval](https://github.com/AndreasUnunger/EverythingPath/issues/119#issuecomment-5846266381) removes only CHAR-09's Select a campaign… and replaces access-loading text with a skeleton. **No approval to drop roster.kind, archive records automatically, delete stats/notes, remove manager editing or rewrite old records.**


Migration/rollout handoff: existing authorized `character.listByCampaign` provides Setup's authoritative kind without extending `canonicalSetup.options`. Compatible readers precede new writers; retain legacy enum readers for immutable records, migrate live mirrors atomically and saved Setup envelopes without losing raw input, and keep the temporary People & officers editor until every replacement operation is available. Team managers remain on Militia Teams. The spec carries the Officer glossary addition and migration/race/history/reference-repair tests.

Coverage gate: retain all existing E2E scenarios, specifically character-ledger/access, Setup/workspace, realtime Action Slots, completed weeks/cutover and direct persistence/Confirmation contracts. Add role/roster/archive/concurrency cases, legacy/new kind and browser-envelope migration, role-aware manager and commandant arithmetic, old-record immutability and three-breakpoint/shared-state/access tests. Implementation must run typecheck, lint and relevant unit/component/Convex/E2E checks; authoring does not claim runtime coverage has shipped.
