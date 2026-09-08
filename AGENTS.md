# Agent Guidance

## Agent skills

### Issue tracker

Issues and specifications are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the five canonical role labels. See `docs/agents/triage-labels.md`.

### Domain docs

Domain documentation uses the single-context layout. See `docs/agents/domain.md`.

## Issue Tracker

Use GitHub Issues for planning and tracking work in this repository. Use the
`gh` CLI, infer the repository from the `origin` remote, and use GitHub
sub-issues and native issue dependencies for Wayfinder maps.

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

### Character Ledger and Officer Assignments

- The application must include a ledger for tracking characters tied to the militia.
- The MVP ledger should support creating and editing basic character records with at least:
  - name
  - level
  - core stats/ability scores
  - short notes
- The ledger must support assigning characters to militia officer roles and show current assignments clearly.
- Officer assignment data should be campaign-scoped, synced in real time through Convex, and visible to all players.
- Reassignment must be straightforward during play (unassign, replace, or move between roles) without losing character records.
- This ledger is the foundation for a future full character builder; current implementation should keep the model simple and extensible.

### Rules Completeness Constraints

- Do not re-encode rule text in this file; enforce behavior by referencing `militia-rules.md` and `militia-tables.md`.
- Weekly state must track enough metadata to run rules correctly across weeks:
  - first-week-upkeep skip
  - uneventful-week bonus carry
  - queued next-week effects
  - persistent events with age/order
- Officer assignments must apply officer mechanics from rules, including non-stacking behavior (except commandant where applicable), strategist action bonus behavior, and manager Charisma effects/limits.
- Team state must support at least `active`, `disabled`, and `missing`, including their rule-based recovery/loss handling.
- Action validation must enforce rule constraints such as:
  - per-phase/per-team action limits
  - `Lie Low` exclusivity
  - `Drill Militia` once-per-Activity
  - upgrade/recruit availability and team-cap constraints
  - event-phase reactive actions (for example `Sabotage`)
- Event resolution must include edge semantics from rules: min/max event chance bounds, `Roll Twice` handling, `Twice` duplicate behavior, and persistent-event mitigation/buyoff cadence.

### Existing Campaign Onboarding (Mid-Campaign Start)

- The system must support creating a militia at an in-progress state, not only at rank 1 / week 1.
- Users must be able to initialize militia data from current table state in one setup flow, including at least:
  - rank, training, treasury, focus, notoriety
  - current reputation by settlement
  - active teams and team conditions (`active` / `disabled` / `missing`)
  - current officer assignments
  - active/persistent events and queued next-week effects
  - current week/phase context
- Initialization should validate rule consistency (for example rank/training thresholds, team caps, and phase legality) and show clear errors before saving.
- This onboarding path is a first-class workflow for MVP, not a fallback or admin-only feature.
- After initialization, gameplay must proceed using the same weekly rules flow as normal play, without special-case behavior.

### Validation Philosophy (Rules-Aware, Not Rules-Blocking)

- Form validation should use `react-hook-form` with `zod` schemas and field-level error messages.
- Use `zod` for structural/data-integrity validation (types, required values, parseability) before mutations.
- Validation UI must match the application design system (typography, borders, spacing, and tone) whenever new UI is added.
- Do not rely on browser-native validation UX; avoid native popups and use in-app, styled validation and warning presentation.
- Validation should explicitly differentiate `required/empty` errors from `invalid type/format` errors where both cases are possible.
- Validation messaging may expand within its own field container but must not misalign adjacent controls in the same row.
- Rule validation should be advisory by default, not hard-blocking.
- The system must allow out-of-rules but table-valid states (for example homebrew adjustments, narrative rewards, GM exceptions, or legacy campaign drift).
- Rule mismatches should be shown as warnings with clear context, not automatic rejection.
- Hard validation should be limited to data integrity and technical correctness (for example required fields, valid IDs, correct data types, and numeric parseability).
- Inputs that are structurally invalid (for example text in numeric fields, malformed references, impossible enum values) must still be blocked.
- Where useful, users should be able to mark or annotate intentional overrides so future sessions understand why state differs from baseline rules.

### UI Implementation Preference

- Prefer `shadcn/ui` components for all UI implementation by default; deviate only when a requirement cannot be met with `shadcn/ui`.
- Keep synchronization, shared-state storage, local derivation, and internal identifiers or versions out of user-facing copy. Describe only the product behavior or outcome the user needs.

### Engineering Guardrails

- After feature changes, run `pnpm -s typecheck`, `pnpm -s lint`, and relevant tests before concluding work.
- Follow React guidance from “You Might Not Need an Effect”: avoid `useEffect` for derived state or internal data flow when it can be expressed with render logic, memoization, event handlers, or keyed resets.
- Prefer feature architecture that separates concerns: keep route/page components thin and mostly presentational, move orchestration/derived state into focused controller hooks, isolate backend writes behind mutation/service hooks, and keep rule logic in shared pure utilities rather than scattered across UI components.
- When rules provide deterministic numeric defaults, prefill those values in the UI automatically (while still allowing user override and syncing), instead of requiring manual re-entry.

### Non-Goals For MVP

- Do not build a full tactical combat simulator.
- Do not replace GM adjudication or full rulebook interpretation.
- Focus on synchronized militia tracking, option selection, and weekly phase execution.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.

<!-- convex-ai-end -->
