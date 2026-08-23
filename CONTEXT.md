# Ironfang Militia Operations

Shared language for running an Ironfang militia through its weekly sequence at the table.

## Language

**Weekly Draft**:
The shared, in-progress collection of selections and entered rolls for the current militia week. Every player can see its contents before confirmation.

**Weekly Draft Revision**:
A specific version of the Weekly Draft. Any synchronized change creates a newer revision.

**Phase View**:
The phase of the current week that one player is viewing. It is local to that player and does not change which phase other players are viewing.

**Phase Readiness**:
A derived indication of whether a phase has all inputs needed for Weekly Resolution. It is recalculated whenever the Weekly Draft changes rather than stored separately.

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

**Ruleset Version**:
A monotonically increasing identifier for the Weekly Resolution behavior used to produce a Resolution Record. It changes when resolution behavior changes, not when presentation, persistence, or internal implementation changes.

**Historical Reconstruction**:
A manually authored Resolution Record for a week that predates recorded Weekly Resolution. Its provenance distinguishes reconstructed history from a record created by Confirmation, and creating it does not alter current militia state.
