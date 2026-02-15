# Agent Guidance

## Militia Rules Corpus

The Ironfang militia rules are stored in:

- `docs/ai/ironfang-militia/militia-rules.md`
- `docs/ai/ironfang-militia/militia-tables.md`
- `docs/ai/ironfang-militia/militia-verbatim.md`
- `docs/ai/ironfang-militia/search-tags.md`
- `docs/ai/ironfang-militia/README.md`

## How To Search

Use `rg` first, then open only matching files/sections.

- Find exact action logic:
  - `rg -n "^## Action:|Drill Militia|Reduce Danger|Restore Character" docs/ai/ironfang-militia`
- Find weekly procedure order:
  - `rg -n "Upkeep Phase|Activity Phase|Event Phase|Step 1|Step 2|Step 3|Step 4|Step 5" docs/ai/ironfang-militia`
- Find event behavior and mitigation:
  - `rg -n "^## Event:|Mitigate|persistent|Twice:" docs/ai/ironfang-militia`
- Find numeric thresholds quickly:
  - `rg -n "Table 6-1|Table 6-2|Table 6-3|DC|Minimum Training|Max Actions|Max Teams" docs/ai/ironfang-militia/militia-tables.md`
- Find team trees/upgrades:
  - `rg -n "Team Trees|Upgrades To|Upgrades From|tier" docs/ai/ironfang-militia/militia-rules.md`
- Find exact quoted source wording:
  - `rg -n "exact phrase here" docs/ai/ironfang-militia/militia-verbatim.md`

## Retrieval Preference

1. Use `militia-tables.md` for hard numbers and thresholds.
2. Use `militia-rules.md` for process/order, action semantics, and edge cases.
3. Use `militia-verbatim.md` when exact wording is required.
4. Use `search-tags.md` when query terms are vague or abbreviated.

## Application Product Description

### Product Goal

The application is a multiplayer Pathfinder militia operations board for Ironfang campaign play. It must turn the militia subsystem into a fast, table-usable workflow and keep shared state synchronized through Convex in real time.

### Core Tabletop UX

- The default play model is `multi-device at one table`, where all players can interact from their own device.
- The primary layout target is `tablet landscape`; desktop and phone views should remain usable as secondary layouts.
- The UX should minimize turn friction, surface the current decision clearly, and keep militia status legible at a glance.

### Real-Time Collaboration Contract (Convex Sync)

- Militia state updates must sync to all connected players in real time through Convex.
- Collaboration is fully shared: any player can stage and confirm allowed changes.
- When two players target the same action slot, `first claim locks` the slot.
- Slot lifecycle must be explicit in UI and state: `available -> claimed -> confirmed` and `claimed -> released/cancelled/timeout`.
- Clients should show immediate visual acknowledgement for claims, staged changes, confirms, and lock release events.

### Card Selection Interaction Model

- Any player choice between options (such as teams or actions) should be presented as playing-card style choices.
- Cards should support hover lift, subtle animation, drag affordance, and slot highlighting.
- Dropping a card into a slot stages the choice but does not commit it.
- A separate explicit confirm action commits the staged choice.
- Staged and confirmed choices are visible to all players in real time.
- Invalid drops must return cards to origin with clear feedback.

### Militia Flow Alignment

- The application flow must follow the militia weekly sequence:
  1. Upkeep
  2. Activity
  3. Event
- Action cards and slot availability must be constrained by militia rules and current state.
- Rank, training, treasury, notoriety, reputation, events, and team constraints should be rules-driven using:
  - `docs/ai/ironfang-militia/militia-rules.md`
  - `docs/ai/ironfang-militia/militia-tables.md`

### Moderation and Authority

- Collaboration is open to players, but GM moderation controls must exist.
- GM controls are hidden from non-GM players.
- GM controls should allow conflict resolution and correction of staged/confirmed state when table adjudication requires it.

### Non-Goals For MVP

- Do not build a full tactical combat simulator.
- Do not replace GM adjudication or full rulebook interpretation.
- Focus on synchronized militia tracking, option selection, and weekly phase execution.
