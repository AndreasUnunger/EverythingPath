# Ironfang Militia Operations

Shared language for running an Ironfang militia through its weekly sequence at the table.

## Language

**Weekly Draft**:
The shared, in-progress collection of selections and entered rolls for the current militia week. Every player can see its contents before confirmation.
A campaign has exactly one open Weekly Draft, created when its current week begins. Confirmation closes that identity and atomically creates the next week's empty Weekly Draft; delayed edits tied to the closed identity cannot affect its successor.

**Weekly Draft Revision**:
A specific version of the Weekly Draft. Any synchronized change creates a newer revision.

**Phase View**:
The phase of the current week that one player is viewing. It is local to that player and does not change which phase other players are viewing.

**Phase Readiness**:
A derived indication of whether a phase has all inputs needed for Weekly Resolution. It is recalculated whenever the Weekly Draft changes rather than stored separately.

**Persistent Phase Eligibility**:
The fixed determination, made when a week begins, of whether the Persistent Phase can be viewed that week. A week is eligible when at least one unresolved persistent event carries into it, and events created or resolved during that week do not change its eligibility.

**Resolution Preview**:
A non-authoritative forecast derived from a Weekly Draft Revision and current militia state. It may be partial while inputs are missing and is not stored independently from its inputs.

**Weekly Resolution**:
The deterministic application of the complete Weekly Draft when the week is finally confirmed, producing all weekly effects and the state needed for the next week.

**Confirmation**:
A request to atomically commit the entire week by applying Weekly Resolution for the exact Weekly Draft Revision the player reviewed. The whole request is rejected if the revision is stale or any change cannot be applied.

**Table Adjustment**:
An explicit, shared, typed departure that any player may stage after the rules baseline is calculated. It includes a reason so later sessions can distinguish intentional adjudication from calculation drift.

**Rules Baseline**:
The game outcome prescribed by the Ironfang militia rules before any Table Adjustments. It is authoritative when legacy calculation behavior conflicts with those rules.

**Resolution Record**:
The immutable history of one week: its source, ruleset version, change plan, warnings, Table Adjustments, and final outcome. A correction appends a new record that supersedes the earlier record rather than overwriting it.
For a confirmed week, its source is the complete confirmed Weekly Draft Revision. The Resolution Record replaces that closed draft as the authoritative historical artifact rather than retaining a separately editable or reopenable draft.
For each week, the newest record that has not been superseded is the effective record shown by default. Older records remain available as an audit trail, and records are never merged.

**Historical Week View**:
A read-only view of a finished week, derived from that week's effective Resolution Record. It does not read current militia state or preserve a separate copy of the old board.

**Ruleset Version**:
A monotonically increasing identifier for the Weekly Resolution behavior used to produce a Resolution Record. It changes when resolution behavior changes, not when presentation, persistence, or internal implementation changes.

**Historical Reconstruction**:
A manually authored Resolution Record for a past week that has no record. Its provenance distinguishes reconstructed history from a record created by Confirmation. Adding it recalculates each later week and the current militia state.

**Historical Correction**:
A change to a past week that already has a Resolution Record. It is prepared outside the closed Weekly Draft, recalculates that week and every later week, and appends superseding Resolution Records rather than changing existing records.

**History Rewrite**:
The complete proposed result of a Historical Reconstruction or Historical Correction, including recalculated later weeks and current militia state. It becomes authoritative only through one explicit confirmation that publishes the whole rewrite atomically; an incomplete rewrite never changes shared campaign state.
A campaign can have at most one open History Rewrite. It is shared and editable by all players. Recalculation proceeds in week order and pauses at the first rules conflict so the conflict can be resolved before later weeks are recalculated.

**Rules Exception**:
An explicit, shared decision to keep a choice that the normal rules would not allow. It records a required reason and permits the choice itself; unlike a Table Adjustment, it does not change the calculated result.

**Action Slot**:
A shared position in the weekly Activity phase that contains zero or one Staged Action Choice. Any player may edit it until Weekly Confirmation.

**Staged Action Choice**:
The uncommitted militia action occupying an Action Slot, including its assigned team and action-specific details. It is visible and editable by all players until Weekly Confirmation.
