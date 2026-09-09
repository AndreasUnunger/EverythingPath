# Canonical Weekly Draft contract

Issue #61 implements checkpoint 2 of #57 in isolation. `src/lib/weekly-draft.ts`
exposes creation and pure semantic edits; `weekly-draft-contract.ts` exports the
shared Zod validators and inferred types. Browser and server adapters can use the
same contract. No production consumer, Convex schema, storage, or calculation has
changed. Existing scenarios remain in place.

`createWeeklyDraft` requires caller-provided domain identities and actual
week-start facts. It starts revision zero with empty choices, without executing
Upkeep or guessing missing historical context. Week-start facts are cloned and
recursively frozen, including fixed Persistent Phase Eligibility. Absence is an
omitted optional value, empty slot is `null`, and zero is a real numeric value.
Ordinary numerical inputs are nonnegative integers; modifiers and adjustments may
be signed. Money is expressed in integer copper; rule ranges and eligibility are projection
advisories, while invalid numbers, unknown variants and duplicate identities are
structural failures.

`editWeeklyDraft` returns a new draft or a structural error. One accepted operation
increments revision once; failure leaves the source intact. Stage requires an
empty slot. Replace requires the current choice identity and fresh complete
contents; it never merges old details. Detail requires the same action and choice
identity and carries its complete typed contents (omitting a detail clears it).
Move requires an empty destination; swap checks both identities. Both move entire
choices atomically. Clear removes a complete choice. Slot identities and occupied
extra slots survive every edit; `add_slot` permits explicit extra positions.

Callers must allocate fresh draft, slot, choice and event identities and never
reuse retired identities. Reference strings denote domain identities, not Convex
IDs. The contract checks its own local identity ownership and event ancestry;
campaign membership and external entity existence belong to the later persistence
adapter. It does not implement transport deduplication, stale revision arbitration,
closed-draft rejection or Weekly Confirmation.

Action variants own their teams, typed details, raw dice and modifier provenance.
Event arrays are ordered forests: parents precede children, and Roll Twice,
and replacement relationships retain independent occurrence identities. Candidate
trees and selection belong to Guarantee Event / Manipulate Events choices, so
replacement removes their entire dependent input tree.
Event-phase Sabotage is attached to its occurrence. Persistent decisions distinguish
unattempted mitigation, incomplete attempted mitigation, buyoff and narrative
ending. Decisions for new events live on their occurrence, including action-owned
candidates, so clearing an action also clears its dependent event decisions.
Carried-event decisions reference the immutable week-start events. Order context retains exact days and prior receipt; staged receipts cannot
be duplicated. Newly placed orders own same-week receipt facts inside their action
choice, including one-day expedited orders. Upkeep facts, operating settlement, consumables, acknowledgements,
reasoned Rules Exceptions and ordered typed Table Adjustments are domain inputs.
Rules Exceptions record permission and never mutate other inputs or arithmetic.
Future projection decides whether a reason permits a particular extra choice and
whether all required facts are present.

The accepted #36 and #56 decisions **supersede AGENTS.md's older first-claim locking
and per-slot confirmation clauses** for this canonical contract. Slots are empty
or staged and jointly editable; Weekly Confirmation remains a whole-week operation.
No claim ownership, lock, timeout or confirmed-choice state exists here. Local
Phase View, input text, pending transport, readiness and preview are excluded.

The pure contract tests cover this checkpoint. Rules-catalog mappings deliberately
retain gaps for derived readiness, real persistence and Confirmation; passing these
tests is not evidence of cutover readiness or complete rules coverage.
