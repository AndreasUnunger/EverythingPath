# Ironfang Militia Operations

Shared language for running an Ironfang militia through its weekly sequence at the table.

## Language

**Weekly Draft**:
The shared, in-progress collection of selections and entered rolls for the current militia week. Every player can see its contents before confirmation.
A campaign has exactly one open Weekly Draft, created when its current week begins. Confirmation closes that identity and atomically creates the next week's empty Weekly Draft; delayed edits tied to the closed identity cannot affect its successor.

**Weekly Draft Revision**:
A specific version of the Weekly Draft. Any synchronized change creates a newer revision.

**Militia Setup**:
The one-time recording of a militia's current table state, including a mid-campaign starting point, that opens its first Weekly Draft without resolving that week.

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

**Militia Correction**:
A reasoned change to the militia's current recorded facts outside Weekly Resolution. It preserves the current week and its prepared choices; choices it affects must be reviewed before Confirmation. It corrects one section of the militia at a time and never changes a finished week, unlike a Historical Correction, which rewrites a finished week.

**History Rewrite**:
The complete proposed result of a Historical Reconstruction or Historical Correction, including recalculated later weeks and current militia state. It becomes authoritative only through one explicit confirmation that publishes the whole rewrite atomically; an incomplete rewrite never changes shared campaign state.
A campaign can have at most one open History Rewrite. It is shared and editable by all players. Recalculation proceeds in week order and pauses at the first rules conflict so the conflict can be resolved before later weeks are recalculated.

**Rules Exception**:
An explicit, shared decision to keep a choice that the normal rules would not allow. It records a required reason and permits the choice itself; unlike a Table Adjustment, it does not change the calculated result.

**Action Slot**:
A shared position in the weekly Activity phase that contains zero or one Staged Action Choice. Any player may edit it until Weekly Confirmation.

**Staged Action Choice**:
The uncommitted militia action occupying an Action Slot, including its assigned team and action-specific details. It is visible and editable by all players until Weekly Confirmation.

**Officer**:
A character holding a militia officer role: a roster person with at least one role. An NPC is an Officer exactly while holding a role, independent of its NPC kind, which decides their team-manager limit; a stored character kind never makes one. Removing the last role changes that status, not the character's kind.

**Character**:
One person, PC or NPC, whether they serve the militia, are fully built, or both. There is exactly one Character per person; the militia roster and the character builder refer to the same Character. A Character is in at most one campaign at a time, and may be in none; adding it to a campaign moves that same Character rather than copying it, and leaving a campaign takes it off that campaign's militia roster.
_Avoid_: pfCharacter, ledger record (as a separate thing)

**Character Owner**:
The user who created a Character. Outside a campaign only the Character Owner can see and edit it; inside a campaign everyone in the campaign can edit it, ownership grants nothing extra, and anyone in the campaign can hand ownership to another member.

**Character Sheet**:
Everything a Character has (base ability scores, race, class levels, feats, gear, effects), from which their current statistics are derived. Every Character has one; a minimal sheet holds only base scores and level, and building it out is optional.
_Avoid_: Character record (for the stats), stat block

**Catalog Entry**:
The definition of something a Character can have, such as an item, spell, feat, class, race, class feature, condition or a one-off adjustment. It holds the thing's rule facts and the Modifiers it grants, and is shared globally, across one campaign, or kept for one Character.
_Avoid_: item definition, effect

**Catalog Copy**:
A campaign or Character Catalog Entry cloned from another entry so it can be changed locally. It never follows later changes to its original, and it warns when the original has changed since it was copied.
_Avoid_: override, fork

**Curation Overlay**:
The project's reviewed corrections to the imported content, each citing the official text it relies on. It supplies what the dataset lacks, such as the Modifiers of prose-only feats, shared Sources and the conditions, and it is reapplied whenever the content is imported again.
_Avoid_: patches, homebrew (homebrew belongs to one campaign)

**Character Sheet Entry**:
One Catalog Entry on one Character's sheet. It holds only that Character's state for it, such as whether it is active, its quantity, or notes. Two potions of the same kind are two Character Sheet Entries.

**Modifier**:
A bonus or penalty that a Catalog Entry grants to one statistic. Its bonus type decides whether it stacks with others. Its value is a number or a formula over the Character's other statistics.

**Source**:
What a Modifier counts as coming from for stacking: its Catalog Entry, unless official text makes several entries one effect, as with every haste effect. Of the active entries with one Source, only the strongest applies.

**Class Level**:
One level a Character has taken, kept in the order taken, with the class and the choices made at that level. Character level is the number of Class Levels.

**Archetype**:
A variant of one base class that a Character takes for all its levels in that class. It replaces or alters some of the class's features and adds its own, while the levels stay levels of the base class. Two Archetypes on one class may not replace or alter the same feature.
_Avoid_: subclass, class variant

**Prestige Class**:
A class a Character can enter only after meeting its requirements, which are prerequisites like a feat's. It can never be a favored class.

**Unspecified Class Level**:
A Class Level whose class has not been recorded. It lets a minimal Character Sheet carry a level before it is built out, and it contributes nothing but Hit Dice.

**Unchained Class**:
A *Pathfinder Unchained* version of a class, such as the unchained rogue: a class of its own that counts as another version of the original. Its levels count as levels of the original class, its features meet prerequisites that name the original's same-named features, and archetypes for the original apply to it where it still has the features they replace, except for the monk. One Character should hold levels in only one of the two versions.
_Avoid_: class variant, archetype

**Temporary Effect**:
A running spell lasting 1 day or less, a condition, a consumable or ability damage. Every other Character Sheet Entry is permanent, including a spell lasting longer than a day, and ability drain.

**Ability Damage**:
Points that lower an ability's modifier by 1 for every 2 points, leaving the ability score unchanged. Unlike ability drain, which lowers the score itself.

**Militia-only Character**:
A Character presented with only what the militia needs: name, level and ability scores, edited in place. Its Character Sheet keeps anything it already holds, and edits made in this presentation land on that sheet. Only a Character in a campaign with a militia can be Militia-only; building it out makes it a Full Character for good.

**Full Character**:
A Character presented and edited through its whole Character Sheet. Its level and ability scores are read-only outside the sheet. A campaign can have Full Characters with or without a militia, and a Character in no campaign is always a Full Character.
_Avoid_: built character, pfCharacter

**Militia Character Facts**:
The values the militia rules read from a Character: character level, racial Hit Dice, ability scores counting only permanent effects (ability drain included, spells, conditions, consumables and ability damage excluded), and whether the Character is active. Confirmed weeks keep their own frozen copy.
_Avoid_: mirror stats, live stats

**Hit Dice**:
A Character's class levels plus racial Hit Dice, always computed and never recorded. A roster person's Hit Dice override, zero included, replaces it for the militia rules.

## Related documents

- [Legacy compatibility inventory](docs/legacy-compatibility-inventory.md): code kept only for data shapes older than the current writers produce, and when each path can be removed.
