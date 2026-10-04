# Pathfinder character sheet data model

Equipment and Proficiencies preparation (#306): [equipment and proficiency behavior](character-equipment-proficiencies.md) describes the shared armor facts, category adapter, item-state edits and Grant preservation. The public resolver derives active class/racial/feature proficiency grants plus atomic manual additions minus removals, reports empty choices without warnings, and checks typed proficiency prerequisite clauses in current and recorded views. The prepared catalog stores these supported clauses in optional `proficiencyPrerequisites`; this intentionally covers proficiency clauses only, while the wider prerequisite language remains future work. Dated new Selections record their add order in `choiceOrder`, retaining unknown legacy order without inventing history. Explicit weapon-use inputs produce named weapon and armor penalties and the narrow one-handed exotic warning; prepared Attack Routines now supply those uses automatically.

Advancement preparation (#299): the prepared sheet now includes character-scoped class definitions and Class Level editing through level 20 and beyond as an advisory departure. Newly initialized demo/fixture sheets seed the representative Fighter, Wizard, Rogue, Cleric, Sorcerer, Alchemist and Witch schedules from `convex/lib/representativeClassCatalog.ts`; these are calculation examples citing the Core Rulebook class tables (Fighter p. 56, Wizard p. 80, Rogue p. 68, Cleric p. 40 and Sorcerer pp. 70–73) and Advanced Player’s Guide classes (Alchemist pp. 26–27 and Witch pp. 65–67), with no curated class-feature or pick catalog. Character-scoped copies are restricted to these isolated prepared sheets; this is not a global or campaign Catalog Release. Earlier prepared sheets need their isolated fixtures recreated/reseeded to receive these definitions. There is no production backfill or authority change.

`addClassLevel` appends an empty-HP row, or inserts at an explicit position. A selected class continues the definition already chosen for that durable rule identity. `editClassLevel` saves independent class, HP, favored-class bonus, ability-increase and skill-rank fields; explicitly choosing another definition of the same class switches its other rows together. Stable row IDs and their choices survive moves and definition switches. Deletion closes positions and preserves selections' `gainedAtClassLevel` references; the controller exposes those whose referenced row no longer exists as `unplacedSelections`. It never retargets them to a later level.

Favored-class entitlement is temporarily stored as optional `base.state.favoredClassIds`, edited by the prepared `editCreationSettings` writer. The target home remains race state when race selection lands; no inferred first-class entitlement is used. The per-row bonus uses the target model's `null | { choice: 'hp' } | { choice: 'skill' } | { choice: 'alt'; note: string }`, and increases use the six full ability names. Optional fields preserve compatibility with prior prepared rows. Read and write authorization includes class type and same-Character references; campaign membership, private ownership and the existing Write Gate remain in force. Global/campaign class catalogs and their publication belong to later catalog work. Legacy class-name definitions and deleted class references calculate as Unspecified Class Levels with inline warnings, retaining HP and recorded choices; unrelated edits remain available. Existing foreign or nonclass references still fail the ownership check. An alternative favored-class bonus requires a nonempty note.

The public resolver supplies row metadata (`classLevels`), HD-based feat/rank budgets (`budgets`), advancement warnings and contribution breakdowns for BAB, saves, Initiative, CMB and ordinary defenses. Unspecified levels contribute level/Hit Dice and plain HP only, without guessed class schedules. HP is never prefilled. The new `useClassLevelChoicesForm` uses the raw rejecting `saveClassLevel` writer so failed saves retain the draft for retry. Presentation for this slice is assigned separately under the UI contract in `docs/character-class-levels-ui-contract.md`.

Skill allocation preparation (#302): the shared resolver supplies skill facts in `skills` and complete skill leaf breakdowns in `breakdowns` (one statistic per target) with recorded ranks, one class-skill +3 when trained, current ability modifiers and applicable armor/shield check penalties. The supported skill keys are the existing 35 `skill.*` targets; bare three-letter keys remain readable aliases, including in cumulative checks. Craft, Perform and Profession specialization records remain future catalog work. Active item details may supply `armor: { slot, armorCheckPenalty }`, with sheet state `masterwork` and `enhancement`; `armorCheckPenalty` is a finite nonnegative raw base penalty magnitude before the one-point masterwork reduction. Magic enhancement implies masterwork. The shared equipment calculation (#306) applies CRB material adjustments to raw armor numbers once; a specific item's catalog material marks already adjusted numbers. Base Item resolution remains an import concern. Inactive items, non-armor items and temporary items excluded from the permanent projection are skipped before armor-value validation. An active malformed enhancement or armor check penalty raises one sourced `armorCheckPenaltyUnresolved` warning on its item; the item's penalty is omitted, so Strength and Dexterity skill totals retain only known contributions and remain partial as explained by the warning. Other skill totals and valid armor/shield contributions remain intact.

Ordinary `budgets` explicitly identify `kind: 'ordinary'` and the current permanent Intelligence modifier. Class Level metadata includes ranks spent and remaining; over-budget ranks remain calculated and warn, unspent ranks are incomplete, and an Unspecified class leaves its budget unresolved. Rank caps use racial Hit Dice plus each recorded row's position. The existing ordinary racial Hit Dice budget remains part of the total; racial allocation and Racial Trait skill bonuses await their persistence workflow. Both projections use `advancementBudgets` and its shared ordinary rank-budget formula. The prepared `SkillRankBudget` interface describes ordinary budgets; companion budgets remain a separate future progression interface, and no companion-specific budget is inferred from ordinary Hit Dice. Alternative favored-class benefit text and missing proficiency choices contribute no invented numerical benefit.

The prepared `editClassLevel` writer accepts both a full `skillRanks` allocation and an atomic `skillRank: { skill, ranks }` edit, rejecting mixed forms; atomic edits preserve other players' changes to different skills. Rank keys are structurally validated against the supported targets and readable aliases, and ranks must be safe nonnegative integers. Full allocations canonicalize keys and sum aliases before saving; an unsafe combined count is refused. Optional nullable `proficiencyChoice` records text without deriving a proficiency grant from missing class metadata. Deleted favored-class references are dropped when entitlement is saved; foreign and nonclass references remain invalid. The skills controller exposes row budgets/caps, current skill totals, inline warnings and draft-preserving field writers through `useCharacterSheetSkills`; its presentation contract is [Character skills UI contract](character-skills-ui-contract.md). The existing effect writer persists optional armor detail. The schema-derived read carries proficiency choices and seeded masterwork/enhancement state, and the resolver reports unresolved armor penalties when active armor enhancement is not a finite nonnegative integer; editing those fields is provided by the prepared equipment workflow (#306). There is no new gear UI, production activation, Convex module or migration.

Revised by [Reconcile the sheet data model with one Character identity](https://github.com/AndreasUnunger/EverythingPath/issues/206) on the [Pathfinder 1e character builder](https://github.com/AndreasUnunger/EverythingPath/issues/201) map. It follows [ADR 0001](adr/0001-one-character-identity.md): the builder extends the existing `character` table, and every Character has a Character Sheet. Terms are defined in [`CONTEXT.md`](../CONTEXT.md).

Implementation status after #260, #261, #262, #263, #297, #298, #299, #300 and #319: this document describes the target sheet model. `catalogEntry` and `characterSheetEntry` support character-scoped base scores, personal adjustments and ordered Class Levels on the existing Character identity. `src/lib/character-sheet.ts` is the shared pure calculation interface for staged formulas, ability scores/modifiers, character level, Hit Dice, recorded HP, numeric Modifier stacking, ability damage/drain, current and ordinary permanent projections, and contribution breakdowns. In isolated fixture campaigns, initialized sheets supply ledger statistics, Setup options/review checks and current Militia Character Facts. Ordinary campaigns retain flat-field authority, including when a candidate sheet is present. Private bounded backfill machinery and isolated fixture validation are implemented in #319; production activation remains #413. The [Character access and Militia Character Facts inventory](character-seam-inventory.md) records the implemented interfaces and remaining consumers.

The implemented subset is additive: Character has optional owner and campaign references and retains required level and six compatibility score columns, with optional `sheetMode: 'militiaOnly' | 'full'` and sheet edit metadata. Private Characters have a current owner and no campaign; ownerless campaign Characters remain available to campaign members under the lifecycle contract. Catalog Entries support character-scoped `base`, `manual` and representative class definitions, durable `ruleIdentity`, optional effective `sourceKey`, and `stacksWithItself`. Sheet entries support an always-active base entry, always-active Class Levels and removable personal adjustments with an active flag. Personal adjustment edits preserve rule identity and cannot set the curated `stacksWithinEntry` exception. A Class Level may reference an owning Character's class definition or have no recorded class; Class Levels now provide progression totals and recorded per-row choices. Broader class feature and pick mechanics remain deferred. New Full sheets contain six scores of 10 and one Unspecified Class Level with empty HP. Ledger creation in a fixture campaign with a militia creates a Militia-only sheet using the submitted level and scores. Numeric and closed-grammar formula Modifiers are supported. State-only ability damage/drain and character-scoped Spell Effects, conditions, consumable or ordinary items, and recorded Spells have gated writers. Reads return current `calculated` and ordinary `permanentCalculated` results from the same resolver. `abilityModifierBreakdowns` records ability damage separately from score breakdowns. Recorded Spells grant no Modifiers. Unsupported formulas stay on their entry, contribute nothing, and emit inline `unsupportedFormula` or `formulaDependency` rules warnings; every writer prunes stale Accepted Warnings. The base entry records `abilityMethod`, `traitCount`, and `campaignTraitRequired`: new sheets use 15-point buy, two traits and no required campaign trait. Rolled settings retain an optional point-buy budget so switching methods preserves the recorded budget. Preexisting base entries without settings read as rolled, with two traits and no campaign-trait requirement; this compatibility fallback is not a backfill. Trait selections and their checks remain later work. Only the queried `by_characterId` sheet-entry index is implemented; the additional indexes below remain target contracts. Class Level identity survives editing/reordering; deleting every Class Level is allowed. Additional kinds and broader state fields remain target contracts; prepared catalog scopes and copy operations are described under "Catalog scopes".

`convex/characterSheet.ts` exposes prepared sheet commands and reads, including permanent Build out on the same identity. Campaign sheets require persisted organization membership through the Character access interface; prepared campaign writes remain restricted to campaigns marked by `campaign.e2eFixture`. Private sheets require the current Character Owner and refuse asserted campaign or organization context. Creating a private demo requires the persisted `characterSheetDemo` grant; editing requires its `sheetDemo` marker. Unscoped inaccessible Character links refuse with "Character not found". Prepared writers also edit creation settings, accept current rules warnings, reopen Accepted Warnings, archive campaign Characters and delete private Characters. All use the same access and migration Write Gate restrictions as other sheet edits. Sheet initialization and changes refresh the live militia projection in the same transaction, and its revision advances only when facts or mirrored roster kinds differ. A ledger score edit adjusts the base Modifier by the difference from the calculated permanent score. Every ledger level decrease confirms the ordered trailing row IDs and current `sheetRevision`; a changed row invalidates the confirmation. Full statistics are read-only through the ledger, while name, Notes, kind and active state remain editable. Roster Hit Dice overrides, including zero, remain militia corrections. The isolated `characterSheet` and `privateCharacter` cases in `convex/e2eFixtures.ts` use the harness's preview binding and capability checks. The former creates a disposable campaign and minimal sheet; the latter temporarily grants private demos. Reset/cleanup removes owned sheet entries, Catalog Entries and Accepted Warnings, and revokes the private demo grant. The sheet read returns `catalogEntries`, an explicit `baseScoresEntry`, ordered sheet entries, `acceptedWarnings`, and `calculated` totals, creation settings, point-buy cost and warnings from the shared pure calculation; the client consumes that calculation directly; the production ledger omits prepared presentation metadata and has no activation path.

Calculated warnings have a closed check union and explicit inline targets. Militia-only sheets show only the PC level-zero advisory; Full sheets also show missing choices, unresolved HP and point-buy warnings. Accepted Warnings match their semantic facts fingerprint and are pruned after every prepared sheet edit, including ledger statistics and Build out, using the edited in-memory sheet. Local writers use shared session operation IDs so their warning echoes stay quiet and other players' changes are announced.

Frozen and superseded Resolution Records retain their selected snapshot facts. `convex/canonicalHistory.ts` is read-only, and the existing authorized append seam preserves historical sources without loading current sheets. A public History Rewrite publication command is not registered yet; that future writer must use the active facts calculation for current inputs, preserve frozen inputs and enter the migration writer inventory. Fixed racial Hit Dice are prepared in #312: militia snapshot Characters have optional `racialHitDice`, and the weekly rules compute the roster override (zero included), or character level plus racial Hit Dice. An absent racial count means zero without rewriting frozen snapshots. Zero racial counts are omitted from refreshed facts so class-only sheets keep their existing facts and revisions. Companion-specific replacement inputs remain with their calculation ticket. `COMPUTED_HIT_DICE_RULESET_VERSION` reserves version 10, while production Weekly Resolution remains on version 9. The initial cutover must activate version 10 together with sheet authority and require a fresh review of saved Weekly Draft inputs; preparing this feature does not activate it. `calculateMilitiaCharacterFacts(ctx, character, preparedSheet)` remains the single asynchronous server seam: an omitted/`undefined` prepared sheet loads eligible authority, `null` retains legacy authority, and an already-loaded sheet supplies the same authorized inputs without another read. This helper uses the prepared sheet’s `permanentCalculated` result from the complete prepared inputs, including permanent ability drain; current sheet display keeps the current projection. Setup, ledger refresh, corrections and Confirmation continue to share the same ordinary permanent calculation, excluding Temporary Effects transitively and ignoring viewed Combined Forms. Only isolated fixture campaigns currently load prepared facts; ordinary campaigns retain the legacy shape and authority.

Prepared ability-score inputs, ability-target personal adjustment values and resolved ability scores must be safe integers (`Number.isSafeInteger`), matching the canonical snapshot's Zod integer constraint. Creation, base-score edits and Militia-only score edits enforce these structural constraints before persistence; both current and permanent calculated scores are also checked on reads and before persisting edits or supplying Militia Character Facts. Formula results round down at evaluation; fractional numeric ability Modifiers remain invalid, and fractional nonability Modifiers remain allowed. Flat ledger creation and edits require safe-integer levels and all six scores. Selected Militia Character Facts enforce these constraints under either authority without applying prepared-sheet entry caps to flat levels. Unusual safe-integer scores remain allowed with advisory rule warnings, and no rounding changes the Character's recorded scores. The 256-Character preparation limit applies only to fixture sheet loading, leaving legacy flat ledgers unrestricted by that new bound. Setup retains its separate, original 256-Character campaign limit for both flat and prepared Characters. Growing Class Levels must stay within the 4,096-entry prepared sheet cap, which counts the base entry, all Class Levels and personal adjustments. Ledger sheet links and Build out navigate through `characterSheetPath` to the independent Character URL, retaining the Characters & officers origin and its organization; owner display and reassignment remain available alongside the level/score controls.

The current `calculateCharacterSheet({ characterKind, entries, catalogEntries }, options?)` result includes `breakdowns` by leaf target and `derivedStatistics` for BAB, saves, Initiative, CMB, AC, touch AC, flat-footed AC, CMD and flat-footed CMD. Each reports applied, suppressed and conditional contributions. The Convex read transmits `breakdowns` through a string-keyed record because dotted leaf targets cannot be Convex object validator fields. The client parses that record into the complete typed leaf-target map before presenting it, rejecting unknown or missing targets and malformed statistics. Recorded Class Level HP and Constitution are explained as built-ins; an incomplete HP input still leaves the sheet HP unresolved. Level and Hit Dice remain counts, outside the Modifier target list. Situation previews run the same calculation with `options.situations`; local selectors include both `{ local, sheetEntryId }` so matching words on different entries do not activate one another. The implemented condition schema supports Situation, `whileActive`, `castingClass` and `school`; casting-class and school selectors apply within the class-specific Spellcasting calculation. Weapon, Routine Option and `ability.$choice` scopes remain target contracts until their scoped calculations are implemented; they are not accepted by the prepared numeric Modifier interface. The personal-adjustment hooks and form are ready; touch/keyboard/hover presentation is assigned to the separate UI agent in `/tmp/ep-orch/briefs/263/ui-contract.md`.

Rules sources:

- [Collect the official PF1 bonus-stacking and target rules](https://github.com/AndreasUnunger/EverythingPath/issues/209) (`research/pf1-official-stacking-rules`)
- [Find how official PF1 rules treat "functions as" wordings for stacking](https://github.com/AndreasUnunger/EverythingPath/issues/210) (`research/pf1-functions-as-stacking`)
- [Survey how existing PF1 builders model characters](https://github.com/AndreasUnunger/EverythingPath/issues/203) (`research/pf1-builder-models`)
- [Collect the official rules for racial Hit Dice progression](https://github.com/AndreasUnunger/EverythingPath/issues/220) (`research/pf1-racial-hit-dice`) and its follow-up on FAQ and designer rulings (`research/pf1-racial-hd-level-rulings`)
- [Collect the official PF1 spellcasting rules](https://github.com/AndreasUnunger/EverythingPath/issues/231) (`research/pf1-spellcasting-rules`) and [Compare the spell data sources for spellcasting](https://github.com/AndreasUnunger/EverythingPath/issues/217) (`research/pf1-spell-data`)

Only official Paizo text decides a rule: the Core Rulebook, plus the official FAQ and errata. Where it is silent, the model follows the literal text and adds nothing. [Set the coverage bar for archetypes and prestige classes](https://github.com/AndreasUnunger/EverythingPath/issues/219) also admits, with their FAQ and errata: the *Advanced Player's Guide* archetype rules, its favored class option rules, the trait rules of the *Advanced Player's Guide* and *Ultimate Campaign*, and *Pathfinder Unchained*'s classes ([Decide which Pathfinder Unchained rules the builder supports](https://github.com/AndreasUnunger/EverythingPath/issues/226)). [Decide how spellcasting fits the Character Sheet](https://github.com/AndreasUnunger/EverythingPath/issues/218) admits each casting class's own spellcasting section, for that class only. [Decide how racial traits live on a Character Sheet](https://github.com/AndreasUnunger/EverythingPath/issues/232) admits the alternate racial trait and subrace rules of the *Advanced Player's Guide* and the *Advanced Race Guide*. Companion rules for in-scope classes and archetypes and the published Bestiary monster cohort equivalence rules are also admitted as described under "Companions", including the explicit witch spell-collection simplification. Other Paizo books supply catalog content, not rules.

### Prepared CRB conditions (#311)

The complete [34-condition inventory](catalog-import/conditions.md) is locally authored beside the Curation Overlay, using the unchanged [agreed CRB corpus](ai/pf1-core-rules/pf1-crb-conditions.md). Prepared `detail.kind: condition` accepts an optional bounded `conditionKey`; existing custom conditions omit it. The existing sheet-entry create/edit/remove writers select canonical keyed definitions with per-condition rule identity/Source, numeric Modifiers and CRB attribution. Ordinary edits retain the key; explicit key removal detaches a custom definition. A keyed condition's Notes and unmodeled quantities resolve from the same reviewed resource, and permanent projections omit every condition and its effects.

The public calculation adds `conditionEffects` with `sheetEntryId`, effective `conditionKey`/name, optional surviving-row `replacedBy`, readable Notes and `unmodeled` quantities. Replacement is calculation-only and preserves recorded active state and the original Catalog Entry identities used by while-active predicates. Fear escalates, repeated Fatigued becomes Exhausted, and Pinned replaces Grappled. Distinct untyped penalties stack. Curated ability-score penalties are limited to a minimum of 1 after other contributions without lifting a drain/manual score already below 1. Positive Dex/dodge AC loss is attributed once; negative Dex remains. Flat-Footed CMD loses positive Dex while retaining dodge; other AC-denial conditions do not imply CMD denial.

Open rules questions and both sides of conflicting text are recorded in [condition curation](catalog-import/conditions.md#combinations-and-open-rules-questions), including Panicked appendix versus Fear (“also shaken”), apply-all/severity versus stacking/replacement, unlisted Blinded skill exceptions and Dex/dodge/CMD implications. The literal Panicked appendix has no attack penalty. Effective zero-score overrides (Helpless/Paralyzed and inherited helpless states), negative-level counts, ability checks, speed, opponent/item quantities and HP/event cycles are not guessed: every missing quantity appears in the condition's unmodeled result. No combat-state controls are introduced.

Three further readings remain open without changing the implemented behavior: Pinned's literal replacement of Grappled removes its invisibility restriction and restores the full Invisible entry, including the modeled attack bonus; Grappled's +2 circumstance CMD when the grappled creature becomes invisible is a selectable `grapple-while-invisible` Situation rather than an automatic consequence of an active Invisible row; and two Shaken rows escalate to Frightened following the corpus even though source-specific non-escalating fear effects may require an exception.

Admission uses committed static assessments, CRB notice/evidence and actual locally inventoried candidates through the ordinary gate. Release preparation explicitly appends these definitions and fingerprints the JSON, corpus and two resolver files using `conditionReleaseResourcePaths`; `catalog:preview --conditions` and `catalog:conditions` expose the artifacts. The existing form controller preserves/selects/detaches keys; presentation of the picker and condition Notes is handed off separately.

Prepared Spell browsing (#315): newly initialized isolated fixture campaigns and private demo Characters seed the exact normalized Breeze and Haste definitions from the #253 importer demonstration (`tests/fixtures/catalog/expected/catalog.json`), copied into `convex/data/preparedSpellCatalog.json`. Initialization uses the same character-scoped installer as prepared imports, in batches of at most 64 definitions, preserving upstream identities and Sources. The committed artifact retains its exact sanitized HTML; the prepared installer converts that HTML to readable text for the existing Spell rows, decoding entities and preserving paragraph breaks through the installed pure JavaScript `parse5` dependency (no Node APIs or new dependency). These are representative demonstration inputs, not a Catalog Release or a production backfill. Legacy `convex/data/spells.js` is not a source for this seed.

The lightweight `spellCatalogIndex` holds one row per Spell rule identity and representative casting class on each Character. Catalog Copies share that identity, so recording a customized or detached definition does not add another collection count. Existing duplicate recorded rows remain stored while the collection shows the latest selected definition once per Spellcasting. Recorded definitions load through the shared referenced-only catalog reader, including authorized campaign and global definitions; unrelated browse-only definitions stay outside sheet calculation. `spellCatalogSummary` holds separate level and school counts (not combinations), including availability and unrecorded availability; every index insertion/deletion updates those counts transactionally. Browser metadata reads at most 257 small summary rows independent of Spell count. Each class list permits at most 128 distinct levels and 128 distinct schools; the installer rejects a batch that exceeds either metadata bound before it commits. Granted Spells do not contribute to recorded counts. The optional index `recorded`, `ruleIdentity` and `levels` fields permit existing prepared rows during deployment; existing isolated fixtures must be recreated/reseeded to populate summaries and current indexes. No production catalog is enabled or migrated here. Authorized Character deletion removes indexes and summaries with its bounded catalog cleanup continuations.

Each index row retains a `levels` snapshot of its selected Spell definition’s class-to-level map. Copying a casting class repoints its lightweight index and summary rows, preserving both recorded and unrecorded browsing. Editing that class’s casting list refreshes availability, displayed levels and summary counts from these snapshots and the retained explicit recorded levels, without loading Spell descriptions. For older index rows without `levels`, the refresh reads their definition and saves the missing snapshot.

Index naming follows the Convex field-order guidance: list every indexed field in order, joined with `_and_`. Only when that full name would exceed Convex's 64-character limit, omit the `_and_` joiners while retaining every field in order. This exception applies to the long Spell browser indexes.

## Principles

1. **Stat totals are never stored.** They are derived from Modifiers every time by a pure resolver. The sheet UI and the server's Militia Character Facts calculation share that resolver.
2. **Everything on the sheet is a Character Sheet Entry.** This covers gear, spells, features, base scores, Class Levels and ability damage. Grants are worked out from their sources, like Granted Spells, and stored only to hold their state (see "Grants and dormant entries").
3. **Modifiers live on Catalog Entries.** A one-off item, a manual adjustment and the base scores are Catalog Entries scoped to one Character. The exceptions are Class Levels, ability damage and ability drain, which hold only Character state, and an item's armor bonus, enhancement, masterwork and material, from its detail and state (see "Weapons and armor"). The resolver turns these into built-in Modifiers.
4. **Rule facts belong on the Catalog Entry, state on the Character Sheet Entry.** Kind-specific shape is a discriminated union keyed by `kind` on both.
5. **Everything stays editable at any time,** including choices the rules say can't change later. Such rules, like every rules check, become advisory warnings and never block (AGENTS.md "Validation Philosophy").
6. **No caches** and no "active effects" table. Pools (current HP, spell slots, daily uses) are not entries, and play-time status tracking is out of scope.

## Tables

```ts
// Existing table, narrowed. Level and ability scores are derived from the sheet.
character: {
  name: string,
  ownerId?: string,                   // absent only for retained ownerless states; see "Ownership and campaigns"
  campaignId?: Id<'campaign'>,        // absent = in no campaign; a Character is in at most one
  description: string,                // labelled "Notes" in the UI
  kind: 'pc' | 'npc',
  isActive: boolean,
  sheetMode: 'militiaOnly' | 'full',  // presentation only, see "Two presentations"
}
// indexes: by_campaignId, by_ownerId

// Logical loaded shape; global identities have immutable definition bodies per Catalog Release.
// Campaign and Character definitions remain editable. Scope decides who sees an entry.
type RuleIdentity = string;            // durable equality identity; never dereferenced for an original definition
catalogEntry: {
  scope: 'global' | 'campaign' | 'character',
  campaignId?: Id<'campaign'>,         // campaign scope only; character-scope entries follow their Character
  characterId?: Id<'character'>,       // character scope
  name: string,
  ruleIdentity: RuleIdentity,          // new rule = new identity; copies inherit transitively, even after edits
  sourceKey?: string,                  // inherited shared Source; absent = ruleIdentity, never copiedFrom traversal
  stacksWithItself: boolean,           // official text says duplicates stack
  modifiers: Modifier[],               // bounded; empty is fine (a rope)
  situationalNotes?: SituationalNote[], // situational text with no number, see "Situational notes"
  detail: CatalogEntryDetail,          // discriminated on `kind`
  description?: string,                // sanitized rules text
  sources: Array<{ book: string; pages?: string }>, // feeds OGL Section 15
  externalKey?: string,                // global scope: `<repo>/<_id>`, finds the stable identity; pack is an ordinary field
  retired?: boolean,                   // global scope: absent from current content; hidden from pickers, kept for sheets
  copiedFrom?: Id<'catalogEntry'>,     // immediate copy origin, independent of transitive ruleIdentity; grants no access
  copiedFromFingerprint?: string,     // immediate origin at copy time; compare only while viewer can access it
  racialStatisticsCopy?: true,        // prepared Character-only race customization, hidden from the race picker
  unsupported?: string[],              // importer notes: unmappable targets, formulas outside the grammar
  prerequisites?: Prerequisite[],      // feats, traits, prestige classes, archetypes; all must hold, see "Rules checks"
  prerequisiteText?: string,           // original readable line, including unsupported clauses
  countsAsRaces?: RuleIdentity[]      // "count as both elves and humans"; equality only, no original payload needed
    | { oneOf: RuleIdentity[] },      // "count as either": the sheet entry's `choice` picks one
  grantsSlots?: Array<{ kind: 'feat' | 'trait'; count: number;   // bonus feats (fighter, human), Additional Traits
    featTypes?: string[];              // a bonus feat must carry one of these Foundry feat types, such as 'combat'
    feats?: Id<'catalogEntry'>[];      // a bonus feat must be one of these (the half-elf's Skill Focus)
    ignoresPrerequisites?: boolean }>, // monk bonus feats, ranger combat style
  routineOption?: true,                // a Routine Option, set by the Curation Overlay; see "Attacks"
  proficiencies?: ProficiencyGrant[],  // classes, Racial Traits, feats, class features, traits; see "Proficiencies"
}
// indexes: by_scope, by_campaignId_and_scope, by_characterId, by_sourceKey, by_externalKey, by_copiedFrom

// One row per thing a Character has, except Grants with no recorded state (see "Grants and dormant entries").
characterSheetEntry: {
  characterId: Id<'character'>,        // access follows the Character; no campaignId, because Characters move
  kind: EntryKind,                     // immutable, indexed
  catalogEntryId?: Id<'catalogEntry'>, // required for catalog-backed kinds, absent for state-only kinds
  active: boolean,                     // off drops its Modifiers and keeps the row
  grantKey?: GrantKey,                 // present = a Grant's stored state; absent = a Selection or state-only entry
  kept?: true,                         // counts even while dormant, with a warning; see "Grants and dormant entries"
  gainedAtClassLevel?: Id<'characterSheetEntry'>, // Selections (feats, traits, prompt picks): the Class Level that dates them;
                                       // a Grant's position comes from its Grant Key
  choiceOrder?: number,                // order among choices at that Class Level; set in order added, editable
  selectionSlot?: { id: string; position: number }, // feat/trait group and zero-based position; advisory capacity
  notes?: string,
  state: SheetEntryState,              // discriminated on `kind`
}
// indexes: by_characterId, by_characterId_and_kind, by_catalogEntryId

// A warning someone on the sheet marked as intended. The only stored part of the rules checks.
acceptedWarning: {
  characterId: Id<'character'>,
  check: string,                       // the check's key, such as 'pointBuy' or 'prerequisites.current'
  subject: string,                     // what it is about: a sheet entry id, or 'sheet'
  fingerprint: string,                 // semantic facts; reference remapping alone never reopens the warning
  acceptedBy: string,
  acceptedAt: number,
}
// indexes: by_characterId
```

The builder stops using the old `spell` and `characterSpell` tables at activation; a separate cleanup clears their rows and removes them (see "Migration and release"). Spells are `spell` Catalog Entries (see "Spellcasting").

### Entry kinds

```ts
// Catalog-backed: the sheet entry points at a Catalog Entry of the same kind.
type CatalogKind = 'base' | 'race' | 'racialTrait' | 'class' | 'archetype' | 'classFeature' | 'feat' | 'trait'
                 | 'item' | 'itemAbility' | 'spell' | 'spellEffect' | 'condition' | 'manual';
// State-only: no Catalog Entry; the resolver emits built-in Modifiers from state.
type StateKind = 'classLevel' | 'abilityDamage' | 'abilityDrain' | 'attackRoutine';
type EntryKind = Exclude<CatalogKind, 'class' | 'itemAbility'> | StateKind; // a class is reached through Class Levels,
                                                              // an Item Ability through the item listing it

type CatalogEntryDetail =
  | { kind: 'base' }
  | { kind: 'race'; racialHitDice: number;                      // 0 for every core race
      racialTraits: Id<'catalogEntry'>[];                        // the standard Racial Traits it grants, see "Racial traits"
      racialProgression?: { creatureType: CreatureType;          // needed when racialHitDice > 0
        hitDie: number; bab: 'full' | 'threeQuarters' | 'half';
        saves: Record<'fort' | 'ref' | 'will', 'good' | 'poor'>;
        skillRanksPerHitDie: number; classSkills: SkillKey[] } }
  | { kind: 'racialTrait'; raceEntryIds: Id<'catalogEntry'>[];  // the races it belongs to
      replaces: Id<'catalogEntry'>[];                            // standard Racial Traits it replaces; non-empty = alternate
      favoredClassCount?: 2;                                     // Multitalented; set by the Curation Overlay
      bonusSkillRanksPerLevel?: number }                         // 1 for the human's Skilled, from Foundry `bonusSkillRanks`
  | { kind: 'class'; classKind: 'base' | 'prestige' | 'npc';
      counterpartOf?: Id<'catalogEntry'>,                         // an Unchained Class: its original class
      hitDie: number; bab: 'full' | 'threeQuarters' | 'half';
      saves: Record<'fort' | 'ref' | 'will', 'good' | 'poor'>;
      skillRanksPerLevel: number; classSkills: SkillKey[];
      alignments?: Alignment[];                                   // absent = any; set by the Curation Overlay
      casting?: Casting;                                          // a casting class, see "Spellcasting"
      castingAdvances?: Array<{ classLevel: number; count: number; // prestige "+1 level of existing spellcasting class"
        kind: 'any' | 'arcane' | 'divine' }>;
      featuresByLevel: Array<{ classLevel: number; catalogEntryId: Id<'catalogEntry'> }>;
      picksByLevel: Array<{ classLevel: number; list: string; count: number }> } // "choose a rage power"; empty = no prompts
  | { kind: 'archetype'; classEntryIds: Id<'catalogEntry'>[];   // the base class it varies; both versions where its source names both
      replaces: Array<{ classLevel: number; catalogEntryId: Id<'catalogEntry'>; scope?: 'whole' | 'part' }>; // exact rows; absent scope = part
      adds: Array<{ classLevel: number; catalogEntryId: Id<'catalogEntry'> }>;
      featureChanges?: Array<{ featureIdentity: RuleIdentity; scope: 'whole' } | { featureIdentity: RuleIdentity; scope: 'part'; part: string }>;
      classSkillsAdded?: SkillKey[]; classSkillsRemoved?: SkillKey[];
      skillRanksPerLevel?: number }                             // absent = the class's own
  | { kind: 'classFeature';
      parentFeature?: RuleIdentity; part?: string;                // shared parent and independently replaceable part
      duplicateUpgrade?: Id<'catalogEntry'>;                     // advisory prompt only; never automatically upgrades
      spellcasting?: {                                            // set by the importer or the Curation Overlay
        extraSlot?: 'domain' | 'school' | 'spirit';               // one extra slot per spell level from 1st
        grants?: { list: 'domain' | 'subDomain' | 'bloodline'; key: string; // a Foundry `learnedAt` list: its Spells are granted
          atClassLevel?: number[] };                              // schedule-style: the class level granting spell level 1, 2…; absent = slot-style
        school?: SchoolKey } }                                    // an arcane school: the specialist school
  | { kind: 'feat'; featTypes?: string[];                        // Foundry feat types: 'combat', 'general', 'teamwork'…
      repeatable?: 'no' | 'newChoice' | 'yes' | 'unreviewed';      // missing/unreviewed invents no duplicate restriction
      additionalTraits?: true }                                 // typed NPC entitlement; grantsSlots supplies +2 traits
  | { kind: 'trait'; traitType: string }                         // Foundry `traitType`: 'combat', 'faith', 'region', 'drawback'…
  | { kind: 'item'; consumable: boolean;                        // later: slot, weight, price
      weapon?: { baseType: string;                               // Foundry `baseTypes`: what Weapon Focus names
        group: WeaponGroup;                                      // Foundry `weaponGroups`
        proficiency: 'simple' | 'martial' | 'exotic' | 'always'; // always: Foundry's forced `proficient: true`; see "Proficiencies"
        handedness: 'light' | 'oneHanded' | 'twoHanded' | 'ranged';
        dice: string;                                            // "1d12", from `sizeRoll(1, 12, @size)`
        damageTypes: Array<'bludgeoning' | 'piercing' | 'slashing'>; // the damage part's types: keen, alchemical silver
        threat: number; mult: number;                            // lowest threat roll (20, 19, 18) and multiplier
        rangeIncrement?: number; strRating?: number;             // feet; composite bows
        reload?: 'free' | 'move' | 'fullRound';                  // crossbows
        finesse: boolean;                                        // Foundry `system.properties.fin`: Weapon Finesse applies
        thrown: boolean;                                         // has a thrown attack (a `twak` action): dagger, spear, javelin
        otherEnd?: { dice: string; threat: number; mult: number }; // a double weapon's second end
        natural?: 'primary' | 'secondary' };                     // a natural weapon; the type is written from the rules
      armor?: { slot: 'armor' | 'shield';                        // see "Armor and shields"
        category: 'light' | 'medium' | 'heavy' | 'buckler' | 'lightShield' | 'heavyShield' | 'tower'; // also its proficiency
        bonus: number; maxDex: number | null;                    // null = no cap
        armorCheckPenalty: number; asf: number };                              // armor check penalty; spell failure, in %
      baseItem?: Id<'catalogEntry'>;                             // a specific magic item's Base Item
      magic?: ItemEnchantment & { otherEnd?: ItemEnchantment };  // its defaults, copied into the sheet entry
      material?: MaterialKey }                                   // a specific item's, display only; see "Special materials"
  | { kind: 'itemAbility';                                       // see "Item Abilities"
      appliesTo: 'melee' | 'ranged' | 'weapon' | 'armor' | 'shield' | 'armorOrShield'; // from the pf1-content tag
      bonusEquivalent: number;                                   // +0 for flat-priced; a tiered ability is one entry per tier
      damageDice?: Array<{ dice: string; damageType?: string;
        on: 'hit' | 'crit';                                      // crit: burst, thundering; ×3 → 2 dice, ×4 → 3
        situation?: Situation }>;                                // holy "vs. evil", bane "vs. the chosen foe"
      doublesThreat?: true;                                      // keen
      weaponDamageTypes?: Array<'bludgeoning' | 'piercing' | 'slashing'>; // keen: piercing or slashing; Curation Overlay
      choice?: 'creatureType' }                                  // bane's designated foe, kept on the ItemAbilityRef
  | { kind: 'spell';                                           // the Spell itself; grants no Modifiers
      levels: Record<ClassTag, number>;                          // Foundry `learnedAt.class`; the record's own `level` is ignored
      grantedLevels: Partial<Record<'domain' | 'subDomain' | 'bloodline', Record<string, number>>>; // the rest of `learnedAt`
      school: SchoolKey; subschools: string[]; descriptors: string[] }  // the stat block stays in the description
  | { kind: 'spellEffect'; spellKey?: string;                    // the Spell's `externalKey`
      lastsOverOneDay: boolean; defaultCasterLevel: number;       // Foundry's buff `level`, used when spellKey is absent
      doublesThreat?: true }                                     // keen edge, on its `onItem` weapon; Curation Overlay
  | { kind: 'condition'; conditionKey?: ConditionKey } | { kind: 'manual' };

type SheetEntryState =
  | { kind: 'classLevel'; classEntryId: Id<'catalogEntry'> | null;   // one chosen definition per class across its levels; null = Unspecified
      position: number;                                               // character level this row is, 1-based
      castingAdvances: Array<Id<'catalogEntry'> | null>;              // prestige levels: the class each advance goes to
      hpGained: number | null;
      favoredClassBonus: null | { choice: 'hp' } | { choice: 'skill' } | { choice: 'alt'; note: string };
      abilityIncrease: AbilityKey | null;
      skillRanks: Partial<Record<SkillKey, number>>;
      proficiencyChoice: string | null }                              // a `baseType` for the class's `choice` grant (Favored Weapon);
                                                                      // read on the class's first Class Level
  | { kind: 'base';                                                  // the one base-scores entry also holds sheet-wide facts
      alignment: Alignment | null; deity: string | null;               // deity: a free-text name
      abilityMethod: { kind: 'pointBuy'; budget: number } | { kind: 'rolled'; budget?: number };
      traitCount: number; campaignTraitRequired: boolean;
      proficiencies: { added: ManualProficiency[]; removed: ManualProficiency[] } } // the player's own, see "Proficiencies"
  | { kind: 'race'; racialHpGained: number | null;                  // hit points from all racial Hit Dice together
      racialSkillRanks: Partial<Record<SkillKey, number>>;
      favoredClassIds: Id<'catalogEntry'>[] }
  | { kind: 'racialTrait'; choice: string | null }                  // the ability of "+2 to one ability score", Dragon Soul's race
  | { kind: 'feat'; choice: string | null;                          // Weapon Focus's weapon (a `baseType`, Bite or Claw included), Skill Focus's skill…
      slot: 'general' | { grantedBy: SelectionReference; slotIndex?: number } } // whose `grantsSlots` it fills: a Grant by
                                                                      // its Grant Key, a Selection by its id
  | { kind: 'abilityDamage'; ability: AbilityKey; points: number }
  | { kind: 'abilityDrain'; ability: AbilityKey; points: number }
  | { kind: 'item'; quantity: number;                                 // later: charges
      masterwork: boolean; enhancement: number;                       // 0 = none; see "Weapons and armor"
      abilities: ItemAbilityRef[];
      material: MaterialKey | null;
      otherEnd?: ItemEnchantment & { material: MaterialKey | null };  // a double weapon's second end
      bash?: ItemEnchantment }                                        // a shield's bash, apart from its AC enhancement
  | { kind: 'spell'; castingClassId: Id<'catalogEntry'>;              // the Spellcasting it is recorded for
      level: number | null }                                          // null = the class's level for it; set for off-list Spells
  | { kind: 'spellEffect'; casterLevel: number;                       // pre-filled, see "Spell Effects"
      onItem?: { entry: Id<'characterSheetEntry'> | 'unarmed';        // the weapon or armor it enhances, see "Spells on an item"
        end?: 'otherEnd' | 'bash' } }
  | { kind: 'classFeature'; oppositionSchools: SchoolKey[];          // arcane schools only; empty otherwise
      weaponGroup: WeaponGroup | null }                               // Weapon Training's chosen group
  | { kind: 'attackRoutine'; name: string;
      main?: { weapon: RoutineWeapon; hands: 'two' | 'one'; thrown: boolean; // absent = natural attacks only
        ammo?: Id<'characterSheetEntry'> };                           // a ranged weapon's ammunition, see "Ammunition"
      off?: { weapon: RoutineWeapon | 'otherEnd'; thrown: boolean }; // two-weapon fighting; 'otherEnd' = the main double weapon's
      natural: Id<'characterSheetEntry'>[];                           // natural weapons attacking too
      options: Id<'catalogEntry'>[] }                                 // switched-on Routine Options, see "Attacks"
  | { kind: Exclude<EntryKind, 'classLevel' | 'base' | 'race' | 'racialTrait' | 'feat' | 'abilityDamage' | 'abilityDrain' | 'item' | 'attackRoutine'
                     | 'spell' | 'spellEffect' | 'classFeature'> };

type RoutineWeapon = Id<'characterSheetEntry'> | 'unarmed';         // an item entry, or the built-in unarmed strike
type GrantKey = { source: RuleIdentity | string;                    // durable race/class/Archetype identity, or canonical parent Grant Key id / Selection id
  classLevel?: number;                                                // level within the class; class and Archetype features
  entry: RuleIdentity };                                             // granted rule's identity; neither field reads copiedFrom
type ItemEnchantment = { masterwork: boolean; enhancement: number; abilities: ItemAbilityRef[] };
type ItemAbilityRef = { id: Id<'catalogEntry'>; choice: string | null }; // choice: bane's designated foe
type MaterialKey = 'adamantine' | 'mithral' | 'darkwood' | 'dragonhide' | 'coldIron' | 'alchemicalSilver';
```

## Class Levels and Hit Dice

Companion Progression and Hit Dice follow the contract under "Companions"; the general class-and-race rules below apply except where companion rules replace them.

- A Character's level is the number of its Class Levels. It is never stored. Zero is allowed: a PC at level 0 shows an advisory warning.
- A new Character normally starts with one Unspecified Class Level. Creating a Companion whose rules supply non-class Hit Dice does not add an invented Class Level; linking an existing Character preserves its actual Class Levels. An Unspecified Class Level adds Hit Dice and nothing else.
- The level within a class is the count of earlier Class Levels of that class. Every field of every Class Level can be edited at any time. That includes its class, its position (a level can move), and deleting it from the middle, in which case later positions close up. The order is the build as recorded, not proof of history (see "Prerequisites").
- All Class Levels of one class use one chosen Catalog Entry definition, with copies grouped by their durable rule identity. A new level continues that chosen version. Choosing another copy explicitly switches every Class Level of that class together, preserving row IDs, order, HP, skill ranks, choices and casting-advance links; Grants follow the existing dormancy and restoration rules. The original-versus-Unchained policy remains separate and unchanged. See "Campaign homebrew moving with a Character".
- The ability increase and favored class bonus fields exist on every Class Level. A favored class bonus on a level of a class that isn't favored shows a warning. So does an increase on a Class Level where neither its character level nor its Hit Dice count is 4, 8, 12, 16 or 20 (see "Racial Hit Dice").
- `hpGained` holds the recorded number. The builder takes it as a plain number and never pre-fills it: there is no roll, average or maximum button ([Prototype the character creation and level-up flow](https://github.com/AndreasUnunger/EverythingPath/issues/208)).
- **Hit Dice** = Class Levels + racial Hit Dice for a Character without Companion Progression. Companion Progression supplies actual Hit Dice according to its own rules, replacing baseline Hit Dice where prescribed rather than counting both (see "Companions"). Totals are computed and never recorded. The militia reads actual Hit Dice; its roster Hit Dice override, including zero, stays as the militia's own ruling.

## Grants and dormant entries

Decided by [Decide how granted entries survive edits and replacement](https://github.com/AndreasUnunger/EverythingPath/issues/243). It amends [Set the coverage bar for archetypes and prestige classes](https://github.com/AndreasUnunger/EverythingPath/issues/219) and [Decide how racial traits live on a Character Sheet](https://github.com/AndreasUnunger/EverythingPath/issues/232), where adding or removing an Archetype or alternate deleted and restored rows, and [Reconcile the sheet data model with one Character identity](https://github.com/AndreasUnunger/EverythingPath/issues/206): Grants are calculated, not stored as rows.

- **Two kinds of entry.**
  - A **Grant** is an entry the Character has because something on its sheet gives it: a class feature from its class at a level within the class, a feature an Archetype adds, a standard Racial Trait from its race. Editing it (a choice, notes, turning it off, detaching it) records state on it and never makes it the player's own.
  - A **Selection** is an entry the player chose to add: feats, traits, alternate Racial Traits, Archetypes, picks for `picksByLevel` prompts, items and recorded Spells.
- **Grants are calculated.**
  - They are worked out each time from the race, Class Levels, Archetypes and alternate Racial Traits, like Granted Spells and Proficiencies. A Catalog Release change to a source reaches every sheet without rewriting rows.
  - Each Grant has a stable Grant Key: its source, the level within the class for class and Archetype features, and the granted entry. A row is stored for a Grant only when the player records state on it or keeps it, keyed by `grantKey`. References to a Grant, such as a feat slot's `grantedBy`, use the Grant Key.
  - A Catalog Copy counts as its original in a Grant Key, as the source and as the granted entry, using its stored durable rule identity without reading the original definition or traversing `copiedFrom`. So "Customize for campaign", detaching a race and detaching a granted feature keep recorded state.
  - Changing a Class Level between an original class and its Unchained Class matches features and prompts by name, ignoring "(UC)" (see "Unchained Classes"). Features with no match go dormant.
  - Each source gives its own Grant with its own state: Evasion from rogue 2 and from monk 2 are two Grants. Same-Source stacking stops them counting twice, and the sheet may show them as one line. Removing one source leaves the other's Grant untouched. A Selection that duplicates a Grant stays a separate entry, under the same rule and the duplicate feat warning.
  - A Grant can't be deleted, because it would be worked out again. Turning it off is the way to switch it off.
- **Dormant entries.** Dormancy is worked out, never stored.
  - A Grant goes dormant when its source no longer gives it: an Archetype or alternate replaces it, the race is swapped, or the class loses that level.
  - A Selection goes dormant when it fills a slot, prompt, race or class the Character no longer has: a feat in a Bonus Feat slot, a talent in a "Rogue Talent" prompt, an alternate Racial Trait of another race, an Archetype of a class with no Class Levels. Other Selections, such as general feats, traits and items, only raise warnings. Recorded Spells keep the orphaned treatment (see "Recorded Spells").
  - A dormant entry keeps all its state but counts for nothing: no Modifiers, prerequisites met, slots, proficiencies, Granted Spells or Grants of its own. Every rules check ignores it. When its source returns, it comes back as the same entry with its state.
  - An inactive source counts as absent. An Archetype or alternate that is turned off gives and replaces nothing, so its Grants and the Selections inside it go dormant and what it replaced comes back. Turning it on reverses this.
- **Keep.** `kept` makes a dormant entry count anyway. If its source returns, it is an ordinary Grant or Selection again, with no duplicate. While it would be dormant it raises an advisory warning ("Armor Training 1: kept, although Weapon Master replaces it"), which can be accepted like any other. Un-keeping makes it dormant again.
- **Display.** The exact visuals are left to the implementation, inside the approved living-sheet design.
  - A replaced Grant shows as a muted "replaced by …" line under what replaces it, with Keep, whether or not it has state.
  - Other dormant entries with state go in a collapsed "Not counting now (n)" group at the end of their section, with Keep and Discard. A dormant Grant without state isn't listed.
  - A source change never deletes anything. Dormant entries stay until discarded.
- **Accepted Warnings** stay with a dormant entry and apply again when it returns, unless their facts changed. Discarding deletes them.
- **Class Levels.**
  - Class features follow the level within the class. Deleting any one of five fighter Class Levels makes the fighter-5 Grants dormant.
  - A deleted row's own data (hit points, skill ranks, ability increase, favored class bonus, proficiency choice, casting advances) is deleted with it. Reordering moves that data with the row.
  - Changing a Class Level's class keeps the row's own data. The old class's Grants at that level within the class go dormant, and the new class's appear.
  - A general feat whose `gainedAtClassLevel` points at a deleted row keeps counting, unplaced, with only the current prerequisite check (see "Prerequisites"). Nothing guesses a new position for it.

### Prepared Grant persistence and read interface (#301)

The prepared sheet resolver exposes `calculated.resolvedEntries` for Grants, Selections and dormant entries. Base scores, Class Levels and ability damage/drain remain in `entries` and their calculated statistics, without repeated resolver rows. The read's `permanentCalculated` omits `resolvedEntries`; the pure calculation interface still provides them for either projection. Each result contains the effective `entry`, `origin: 'grant' | 'selection'`, `recorded`, optional `storedEntryId`, `dormant`, `counting`, and optional `reason` (`{ kind: 'sourceMissing' }` or `{ kind: 'replaced', byEntryIds: string[] }`). These are calculated facts, not stored flags. `counting` requires both an on entry and either an available source or Keep; Keep never turns an off entry on.

For a Grant, the effective entry's `_id` is the canonical serialization of its Grant Key, while `storedEntryId` identifies its optional persisted state row. The object shape remains `{ source, classLevel?, entry }`; `formatGrantKeyId` uses length-prefixed source and entry strings (`grant:<source length>:<source>:<class level or empty>:<entry length>:<entry>`), so nested parent keys grow linearly without escaping each previous key. The persisted row retains `grantKey`, `active`, choice state, optional `notes`, optional `kept: true`, and its catalog reference. A nested Grant's source is its parent's canonical Grant Key id or Selection id, keeping the states of children from distinct parent Grants separate. Direct race, class and Archetype sources use durable rule identity. Catalog Copies preserve that identity. An ordinary recorded Grant follows the current source's granted definition; optional stored `catalogOverride: true` records an intentionally detached Catalog Copy. Both remain Grants, and a copy edit must preserve the granted rule identity and kind.

A recorded Selection can carry `selectionSource: { kind: 'slot', grantedBy: SelectionReference, slotIndex?: number } | { kind: 'prompt', source: SelectionReference, list: string, classLevel?: number } | { kind: 'classPrompt', source: string, classLevel: number, list: string }`. A `SelectionReference` is `{ kind: 'grant', grantKey: GrantKey } | { kind: 'entry', entryId: string }`: Grant references use the key; Selection references use the row id. `slotIndex` identifies the source's zero-based `grantsSlots` declaration, defaulting to zero for older rows. `selectionSlot: { id, position }` separately records the feat/trait group and zero-based position for fill/replace operations. The writer checks that the referenced source belongs to the Character; the resolver checks slot or prompt availability and makes the Selection dormant while its source does not count. Feat/trait budgets, slot types and duplicates are advisory checks; exceeding a budget never removes a Selection. Prompt capacity checks across consuming Selections are not yet implemented. For `classPrompt`, the writer saves the canonical class-family identity and normalized prompt list name, and validates the level and prompt against any selected member of the active class family's schedule. Corresponding original and Unchained prompt names match ignoring `(UC)`. The link follows the level within the class, so removing an earlier Class Level does not orphan a choice while its class-local entitlement still exists. `gainedAtClassLevel` remains a separate recorded acquisition link: losing it alone does not make a general feat dormant. Current non-Grant Selections with a deleted acquisition link are exposed as named `unplacedSelections` in the sheet view and retain their original link. Grant section rows additionally expose `gainedAtClassLevel` and `unplaced` for inline presentation; no successor level is guessed.

Prepared mutations are `characterSheet:editGrantState` (key plus optional `active`, `choice`, `notes`, or detached `catalogEntryId`), `setDormantEntryKept` (Grant Key or Selection row id, plus `kept`), `discardDormantEntry` (same target), and `selectEntry`/`editSelection` for recorded Selections. Each uses the shared maintenance/Write Epoch gate, resolves the Character's authorized campaign or private scope, checks catalog and dependent references, and prunes Accepted Warnings against the resulting in-memory sheet. Un-Keep removes a Grant's stored row when its state matches the kind-specific derived default and it has no notes, detached definition, acquisition link or Selection dependency; edited Grants and Selections retain their rows. Discard removes recorded state and its Accepted Warnings, including an unreferenced character-scoped definition belonging to a discarded Selection. Discarding a Selection also removes its descendant Grant state and warning acceptance recursively, including descendants reached through Grants without stored rows or catalog links that have since disappeared; durable Grant identities preserve the ancestry. Other sources of the same definition retain their independent state. A replaced derived Grant can still appear with default state. Accepting a warning on an untouched Grant stores only the warning acceptance, without creating Grant state. These prepared writes do not activate production sheet authority.

Removing an ordinary Selection retains its local definition while live, future or nested hard catalog dependencies still reference it. Saved missing `whileActive` and Situation `option` references remain soft references with their existing behavior; this retention rule does not turn them into required catalog dependencies.

The frontend projection nests replaced Grants beneath their replacer whether or not recorded state exists. Other dormant records appear only in their own section's collapsed `Not counting now (n)` group. A kept dormant record appears once among ordinary rows, or remains beneath its replacer, with Unkeep and Discard controls. Existing effect/adjustment panels omit all Grants and dormant rows; the Grants sections provide appropriate controls, including for derived Grants without recorded state, and never offer deletion of an available Grant. Local controls acknowledge saving, saved and failed writes at the row; entry, source/class and catalog changes from other players have dismissible feedback. A local successful Discard recovers focus after its result appears: the next remaining row, the section heading, or a surviving sheet heading when the section disappears. A retained derived default row keeps focus within that row. Remote removals and failed Discards do not trigger this focus recovery. Internal keys and persistence markers are never product copy.

## Racial Hit Dice

Decided by [Decide how a Character Sheet models racial Hit Dice beyond the count](https://github.com/AndreasUnunger/EverythingPath/issues/222).

- **Rules sources.** No FAQ or errata covers how racial Hit Dice meet level-keyed rules. The CRB, the CRB FAQ and Paizo's own stat blocks decide what they can. The Bestiary's creature-type table arrives as catalog content; its monster cohort equivalence rules are narrowly admitted under "Companions". Its general rules for adding racial Hit Dice and for Monsters as PCs (CR counted as class levels) remain out of scope, and a Monster PC's level-equivalence is the GM's call.
- **On the race.** The race fixes the count, so `racialHitDice` and `racialProgression` live on the race entry, in the class detail's vocabulary. Foundry race records carry no count, so every imported race has 0. A race with racial Hit Dice is a campaign or character Catalog Copy, with the count and progression set by hand.
- **Seeding.** Choosing a creature type fills `racialProgression` from the creature-type seed table (see "Global catalog import"). Every seeded field stays editable, because type features hold "unless otherwise noted" and humanoid and outsider good saves vary.
- **Choices on the sheet.** The race sheet entry records `racialHpGained`, one plain number for all racial Hit Dice, never pre-filled. It gets no favored class bonus and no maximized first Hit Die (CRB FAQ). It also records `racialSkillRanks`. Feats from racial Hit Dice are ordinary feat entries.
- **Ability increases.** Racial Hit Dice have no ability increase field. The rules are silent when racial Hit Dice and Class Levels mix, so the increase warning accepts either reading: the Class Level's character level or its Hit Dice count.
- **Level-keyed rules.**

  | Rule | Reads | Basis |
  |---|---|---|
  | Character level: prerequisites such as Leadership, "1/2 your character level", the level-0 warning | Class Levels only | CRB definition; Paizo keeps character level and Hit Dice apart (familiar rule, monster DCs by Hit Dice) |
  | Feat count | Hit Dice | CRB "based off their Hit Dice"; Monster Codex stat blocks |
  | Maximum ranks per skill | Hit Dice | CRB "your total number of Hit Dice" |
  | BAB | per source, summed | CRB FAQ (Monk): racial Hit Dice BAB "adds normally" |
  | Base saves | per source, summed | CRB multiclassing rule; Paizo stat blocks add a racial and a class good save +2 each |
  | Skill ranks per Hit Die | per source, summed | CRB multiclassing rule |

- **Type quirks.** Construct bonus hit points by size and undead Cha-for-Con hit points are hand-entered `hp` Modifiers on the race Catalog Copy. Mindless creatures (no Int score) are not supported.

## Racial traits

Decided by [Decide how racial traits live on a Character Sheet](https://github.com/AndreasUnunger/EverythingPath/issues/232).

- **Rules sources.** The *Advanced Player's Guide* and *Advanced Race Guide* rules for alternate racial traits and subraces are admitted. An alternate racial trait is exchanged for one or more standard racial traits, and "you cannot exchange the same racial trait more than once" (APG). Neither book defines "alters". The *Advanced Race Guide* race builder (race points) is out of scope. A custom race is a campaign or character Catalog Copy of a race.
- **Sheet entries.** Racial Traits are `racialTrait` sheet entries (see "Grants and dormant entries").
  - The race's `racialTraits` lists its standard traits, which are Grants of the race, like class features. Changing the race makes the old race's Grants and its alternates dormant, and the new race's traits appear.
  - An alternate is a Selection. The standard traits its `replaces` names go dormant with their state, and come back when it is removed or turned off.
  - Racial Traits are permanent entries, so the ability score trait counts for Militia Character Facts as the race's adjustments did.
- **Modifiers sit on the traits.** A Modifier lives on exactly one entry, so nothing counts twice. A race entry keeps its racial Hit Dice, progression, size and creature type; its Modifiers come from its Racial Traits. The importer:
  - moves each race record's ability changes (152, found only on race records) onto that race's ability score trait;
  - drops race changes and notes that a standard trait also carries (64 of 67 non-ability changes; the race's 32 notes repeat trait notes in other words), keeping the trait's version when they differ;
  - leaves anything else on the race and lists it in the import report until the Curation Overlay moves it. The three races with no traits (gnoll, lizardfolk, ogre) keep all their Modifiers.

  So Orc Atavism, which "replaces the usual ability modifiers", and subrace stat blocks work by replacement alone.
- **Ability of choice.** A "+2 to one ability score of your choice" trait (human, half-elf, half-orc and others; Orc Atavism's −2 to one mental score) has an `ability.$choice` Modifier. The sheet entry's `choice` names the ability. Until it is chosen, the Modifier contributes nothing and the field shows a blue outline. Restrictions such as "a mental ability score" stay prose.
- **Facts the traits carry.** Each fact sits on the trait, so an alternate that replaces the trait makes it dormant, and the fact with it.
  - Bonus Feat (human): `grantsSlots`, from Foundry's `bonusFeats` change.
  - Adaptability (half-elf): a slot whose `feats` is Skill Focus.
  - Skilled (human): `bonusSkillRanksPerLevel`, from Foundry's `bonusSkillRanks` change.
  - Multitalented (half-elf): `favoredClassCount: 2`, set by the Curation Overlay. A Character's favored class count is 1 unless an active Racial Trait sets 2. So Arcane Training, which replaces Multitalented, brings it back to 1. Its arcane-only restriction stays prose.
  - Weapon familiarity (dwarf, elf and others): `proficiencies`, set by the Curation Overlay (see "Proficiencies"). A race record's own `weaponProf` moves onto this trait, like its ability changes.
- **Standard and alternate.** The pf1-content racial traits pack marks these only by folder.
  - Standard-folder records are standard.
  - For the 22 races with a flat folder, a record is standard unless it has a "Replaced Trait" header.
  - Every record with a header is an alternate.
- **Replacement links.** The importer builds `replaces` from the "Replaced Trait(s)" header. It matches names and `@UUID` links against the same race's standard traits, ignoring a "(Race)" suffix, which fully matches 82% of the 770 headers.
  - Unmatched names go to the import report: subrace "Base Statistics", category words such as "Speed", and typos. A one-off Curation Overlay pass resolves them before launch, and no gate fails the import.
  - An unresolved alternate imports with an empty `replaces`, so adding it replaces nothing and the player turns the replaced trait off by hand.
  - "Alters X" reads like an Archetype's "alters": it replaces X, and the alternate's own text takes over.
- **Subraces.** A subrace is an alternate Racial Trait, not a race of its own.
  - A Subraces-folder record replaces "Base Statistics". The Curation Overlay pass resolves that to the parent's ability score trait plus whatever else its stat block replaces.
  - Each Subrace Standard record, such as `Skilled (Tiefling - Beastbrood)`, is an alternate replacing the parent's trait of the same name.
  - Nothing bundles a subrace with its overrides, and no check matches them: the player adds the ones they want.
  - The *Advanced Race Guide*'s racial subtypes are named combinations of alternates (Cosmopolitan is Heart of the Streets plus Focused Study), so they need nothing.
- **Counting as another race.** `countsAsRaces` is set by the Curation Overlay on any Catalog Entry, because only prose says it.
  - Elf Blood counts as elf and human, and Orc Blood as human and orc. Replacing them changes the counting automatically.
  - Orc Atavism counts as orc only ("not also humans").
  - Dragon Soul's "either elves or humans" is `oneOf`, and the sheet entry's `choice` picks the race.
  - The feat Half-Drow Paragon counts as drow.
  - It feeds `race` prerequisite clauses and the check for a race trait of another race (see "Rules checks"). Favored class options stay unchecked free text.

## Archetypes and prestige classes

Decided by [Set the coverage bar for archetypes and prestige classes](https://github.com/AndreasUnunger/EverythingPath/issues/219).

- **Coverage.** Every official Paizo prestige class and archetype, from any Paizo product: rulebooks, Campaign Setting, Player Companion and Adventure Path books. That is the intended scope. What a release offers leaves out content held for attribution or notices and its dependent omissions, which are reported by identity and reason, never counted as complete ([Decide how unproven content attribution affects import](https://github.com/AndreasUnunger/EverythingPath/issues/241); see "Notice gate" under "Global catalog import").
- **Archetypes.**
  - An Archetype is a Catalog Entry tied to one base class, or to both versions of one (see "Unchained Classes"). A Character takes it as a sheet entry, and it applies to every level of that class. The levels stay levels of the base class.
  - `replaces` names rows of the class's `featuresByLevel`, a feature at one class level, so "replaces armor training 1" replaces only that row. An archetype feature that alters a class feature replaces that row and adds its own feature at the same level.
  - An Archetype is a Selection. The Grants of the rows it replaces go dormant with their state, and its own features are Grants at their levels within the class. Removing it or turning it off reverses this. Selections stay, except those filling a prompt or slot that goes with it, which go dormant (see "Grants and dormant entries").
  - Class skills added or removed and skill ranks per level are structured. Proficiency changes remain prose/manual. Structured casting properties and their conflict choices are completed by #422; the prepared #305 resolver does not infer them.
  - Feature rows carry a durable `parentFeature` and independent `part` where appropriate. Two changes to the same part conflict; an alteration naming the whole parent also conflicts with any affected part, while independent parts coexist. `featureChanges` carries whole/part alteration metadata even when the alteration does not remove every original Grant. Exact `replaces` rows control removal; an explicit whole replacement can remove all rows of that parent. Conflicts remain advisory.
**Prepared implementation (#305).** `calculateCharacterSheet` returns `archetypes` alongside ordinary Grants, class skills and Class Level rank budgets. A Selection's optional `state.classEntryId` binds it to the chosen class family, retaining original/Unchained and Catalog Copy continuity; older Selections without it retain inferred applicability. A known scoped class that does not fit the Archetype is retained with an advisory warning and contributes no benefits on another class. A deleted bound or referenced class definition leaves the Selection unavailable/dormant with its notes and choices intact; an existing foreign or nonclass reference is refused. The Archetypes hook edits Selection notes and choice through the existing scoped `editSelection` writer, with per-Selection save/error feedback. A Selection's optional `state.replaces` overrides catalog replacement rows; `null` at the writer resets the override and an empty array deliberately replaces none. The sheet writers apply/deactivate one durable Archetype Selection across the class's levels, retain its row and state across same-identity Catalog Copies, validate scoped class/feature references, and update in-memory state before pruning Accepted Warnings. Each compatibility conflict and unmatched part has a distinct semantic warning subject; accepting one never overwrites another. Competing rank overrides leave affected rank budgets unresolved rather than picking a winner. Inactive Archetypes contribute neither replacements, additions, class skills nor rank changes, even when an old row retains Keep state. Duplicate-feature upgrades remain advisory prompts with the named upgraded feature; no automatic replacement occurs. Complete representative Fighter/Rogue schedules and Archer/Scout examples are seeded only for isolated prepared sheets, with their authored resources captured privately by the release builder. This demonstrates the mechanics without claiming complete catalog curation or activating production authority. Source coverage and limits are recorded in [the representative archetype notes](catalog-import/archetypes.md).

- **Base class schedules.** Foundry links many multi-level features only at their first level; the Fighter links six features. The Curation Overlay completes each base class's `featuresByLevel` from its class table, so archetypes can replace any row and the sheet shows every feature gained.
- **Prestige classes.** These are `class` entries with `classKind: 'prestige'`, and their `featuresByLevel` comes from the class's level table.
  - Entry requirements are prerequisites on the class entry, like a feat's. Prerequisites at recorded level check them before any benefit of the class's first level (see "Prerequisites").
  - A prestige class can never be the favored class.
  - "+1 level of existing spellcasting class" is `castingAdvances` (see "Spellcasting").
- **Source: a scraped AoN dataset.**
  - Neither Foundry repo has archetypes or prestige classes. PSRD-Data (no licence, frozen in 2015) and the `pf1e-archetypes` module are not used.
  - A one-off scraper reads Archives of Nethys' prestige class and archetype pages into a dataset committed to this repo. It runs very slowly, over days if need be, and only after the project owner has contacted AoN.
  - Every record keeps its book, page and AoN URL. Its catalog key is `everythingpath/<id>`, never the URL. Entries whose source is not a Paizo product are dropped and listed in the scraper's report.
  - The scraper extracts what it can, including matching "replaces X" against the base class's features. Every record it cannot match or classify goes to a hand-review list. Each book also gets a sampled spot-check.
  - Corrections, including Modifiers for archetype and prestige features, are made in the dataset itself. A reviewed record is marked and cites its book and page. The Curation Overlay is only for upstream data.
  - Every admitted scraped record's book is in the import's book set, so it needs a Section 15 Registry record. A record without an accepted Attribution Assessment or a required notice is held in the dataset, not admitted (see "Notice gate" under "Global catalog import").

## Unchained Classes

Decided by [Decide which Pathfinder Unchained rules the builder supports](https://github.com/AndreasUnunger/EverythingPath/issues/226).

- **Scope.** The four Unchained Classes (barbarian, monk, rogue, summoner), their archetypes, and *Pathfinder Unchained*'s other catalog content are in. Signature Skill and skill unlocks, the stamina feats, Combat Trick feats and scaling items are plain prose catalog content: nothing is derived from them, and no stamina pool exists. Every alternate rule system in the book is out of scope, so there are no variant rule switches on a campaign or a Character.
- **Class entries.** Each Unchained Class is its own `class` Catalog Entry, imported from Foundry's `<Class> (Unchained)` records, with `counterpartOf` pointing at the original class. Its features are found through the class's links, not by the PZO1131 source, which most unchained feature records lack.
- **One version per Character.** Class Levels in both an original class and its Unchained Class show an advisory warning ("individual characters must use one version or the other exclusively").
- **A version of the same class.** The book's own framing, applied consistently:
  - Levels of an Unchained Class count as levels of the original wherever something counts levels in that class: `@classLevel.<classKey>`, requirements, and the favored class with its favored class options. The two never coexist, so nothing double-counts.
  - A prerequisite naming a class feature is met by the same-named feature of either version, ignoring Foundry's `(UC)` suffix: Extra Rage accepts *Rage (UC)*. See "Rules checks".
- **Archetypes.**
  - An archetype for the original barbarian, rogue or summoner applies to the Unchained Class ("as long as the classes still have the appropriate class features to replace"). Its `replaces` rows match the Unchained Class's `featuresByLevel` by feature name and class level, ignoring `(UC)`. A row with no match shows an advisory warning and replaces nothing.
  - An archetype for the original monk on the unchained monk shows an advisory warning ("with the exception of the monk").
  - Archetypes written for an Unchained Class name it directly. One whose source names both versions lists both in `classEntryIds`.
  - The Pathfinder Society restrictions (no barbarian archetype that changes rage, no summoner archetype that changes the eidolon's base form) are campaign policy, not rules text, and are not adopted.
- **Spells.** The unchained summoner's revised spell list is ordinary per-class spell data under its own class tag, and its casting table is the bard's (see "Spellcasting").

## Spellcasting

Decided by [Decide how spellcasting fits the Character Sheet](https://github.com/AndreasUnunger/EverythingPath/issues/218). Rules from [Collect the official PF1 spellcasting rules](https://github.com/AndreasUnunger/EverythingPath/issues/231) (`research/pf1-spellcasting-rules`); open items there are cited as S1–S14.

**Prepared implementation (#307).** `calculateCharacterSheet` and `calculateCharacterSheetProjections` derive `spellcastings`, exposed by `characterSheet.read` in both `calculated` and `permanentCalculated`. Each result retains its class identity and casting kind, ability, recording model, casting/table levels, castable spell levels, per-level allowances and current caster-level/concentration/DC contribution breakdowns. School-specific DCs retain separate breakdowns. Each spell level carries `dcUnresolved`, and each school-specific DC carries its own `unresolved` flag, so an incomplete school DC leaves the generic and other schools’ DCs usable. Nullable table cells distinguish unavailable spell levels from zero base slots; cantrips are at will while the adept retains its finite zero-level allowance. Bonus slots use the selected ability's ordinary permanent score even in the current projection. The representative Wizard, Cleric, Sorcerer, Alchemist and Witch definitions carry reviewed casting data. A failed caster-level formula leaves that class’s concentration unresolved and prevents formulas using its named or arcane caster-level variable from consuming a partial total; ordinary DCs and other classes remain resolved. The prepared casting prerequisite evaluator feeds general current and recorded-level checks (#320) and uses a `kind` discriminant (`casterLevel`, `canCast`, `castsSpell`, or `anyOf`); caster-level uncertainty affects caster-level prerequisites, while castable spell levels remain usable for `canCast` and `castsSpell`. The class casting shape is authored once as a zod schema and supplies its TypeScript type and Convex validators. Extra slots are omitted until their feature producer is integrated. These prepared readers retain existing Character and campaign authorization and do not activate production sheet authority. School/opposition choices, granted/extra-slot features, prestige advances and Archetype casting overrides remain their later ticket integrations; this calculated subset does not invent those player choices.

- **Scope.** The sheet records which Spells each casting class has, and derives caster level, spells per day with bonus spells, spells known, save DCs and concentration. It records no prepared spells, no casts and no slots used: preparation, like every pool, is play-time status tracking. Spell-like abilities stay prose class features and racial traits.
- **Spellcasting.** One is derived for each class the Character has Class Levels in whose class entry has `casting`. Nothing is stored for it. A multiclass caster's Spellcastings stay separate: caster levels, spells per day, lists and bonus spells.

```ts
type Casting = {                                  // Foundry `system.casting`, completed by the casting tables file
  classTag: ClassTag;                             // Foundry class `tag`: the key into a Spell's `levels`
  type: 'prepared' | 'spontaneous' | 'hybrid';    // hybrid = the arcanist
  spellKind: 'arcane' | 'divine' | 'psychic' | 'alchemy';
  ability: AbilityKey;                            // casting ability: bonus spells, DCs, concentration
  cantrips: boolean;
  casterLevelOffset: number;                      // −3 for paladin, ranger and antipaladin; 0 otherwise, the bloodrager included
  table: CastingTableKey;                         // in the casting tables file
  record: 'known' | 'book' | 'none';              // what the sheet records for it
  bookType?: 'spellbook' | 'formula' | 'familiar'; // collection heading from effective casting facts
};
```

### Recorded Spells

**Prepared collections (#315).** Both sheet projections return `spellCollections`: recording headings, retained Spell rows and per-level counts. Both projections expose `collections` and `spellsWithoutSpellcasting`. Collections and calculated Spell rows identify the class definition as `classEntryId`; persisted Spell state retains `castingClassId`. Collection headings are the closed union `Spells known`, `Spellbook`, `Formula book`, `Familiar` or null and derive from effective recording facts, including `bookType`. Warning builders live separately from collection assembly; the persisted `spellOrphaned` acceptance check keeps its identity. The isolated representative class catalog includes source-cited Sorcerer, Wizard, Alchemist and Witch definitions for public recording tests, alongside read-only Cleric browsing. Known allowances reuse `slots[].known`; Spellbook, Formula book and Familiar have no invented limits. Each selection preserves its casting association and level snapshot. Current `levels[classTag]` takes precedence; list loss falls back to the snapshot with an off-list warning. Casting or recording-model loss retains the row under "Not under any Spellcasting" with its original class name. Legacy missing associations/levels remain visible. Count warnings target the casting/level and use its stable rule identity as their subject; level/list/orphan warnings target the Spell. Fingerprints include relevant facts, so renames, identity-preserving remaps and unrelated lower castable levels preserve acceptance. `characterSheetSpells.record` records or edits an off-list level without changing row identity; `remove` deletes only a recorded Spell. `browserInfo` supplies opening level, list levels and schools; `browse` pages indexed definitions with cross-level search and read-only whole-list browsing. `useCharacterSheet().spells` owns row save/remote-change feedback, and `useCharacterSpellsPage` supplies URL filters and phone description expansion. Recorded and derived Spell definitions contribute no Modifiers. Generic Grants remain separate; casting attribution, slot/schedule producers and extra slots remain deferred.

`record` decides what a Spellcasting holds, and the heading it shows:

| `record` | Heading | Classes |
|---|---|---|
| `known` | Spells known | the spontaneous casters: bard, sorcerer, oracle, inquisitor, summoner, skald, bloodrager, psychic, mesmerist, spiritualist, occultist and the rest |
| `book` | Spellbook, Formula book, Familiar | wizard, magus, arcanist; alchemist and investigator; witch |
| `none` | (no list) | casters from their whole class list: cleric, druid, paladin, ranger, antipaladin, warpriest, shaman and the rest |

The casting tables file sets `record` for every casting class, because Foundry doesn't carry it.

- A recorded Spell is a `spell` sheet entry naming its `castingClassId`. One Spell recorded for two Spellcastings is two entries.
- Its level for that Spellcasting is the Spell's `levels[classTag]`. A Spell missing from the class's list takes its level from the entry's own `level`, and shows the off-list warning.
- A `none` Spellcasting records nothing. It shows its numbers, and its Spells page browses its class list read-only (see "On the sheet").
- A recorded Spell whose casting class the Character has no Class Levels in is **orphaned**. It shows in a "Not under any Spellcasting" group with its warning.
- **Granted Spells** are derived and never recorded. An active class feature whose `spellcasting.grants` names a domain, subdomain or bloodline grants every Spell on that list, at its `grantedLevels` level. When each level is granted follows the feature's text ([Prototype the spellcasting section on the living sheet](https://github.com/AndreasUnunger/EverythingPath/issues/233)):
  - **Slot-style** grants follow every spell level the Spellcasting can cast, prestige advances included: the cleric's domain Spells and domain slot (CRB p. 38: "one domain spell slot for each level of cleric spell she can cast"; the FAQ gives a domain gained elsewhere "a domain spell slot at each spell level they can cast"), the wizard's school slot and the shaman's spirit slot.
  - **Schedule-style** grants follow the class's own Class Levels, never advances (FAQ). Each spell level arrives at the class level the feature's text names. `grants.atClassLevel` holds that schedule: a sorcerer bloodline grants spell level N at sorcerer 2N + 1, a bloodrager bloodline at 7, 10, 13 and 16. The Curation Overlay writes it, because Foundry doesn't carry it. Sorcerer and bloodrager bloodlines are separate class features, so the schedule lives on the feature, not on the list. Oracle mysteries and witch patrons are schedule-style too, once added.
  - **"Domain slot only."** A granted domain Spell that isn't on the class's own list, at any level, is tagged "domain slot only" (CRB: "If a domain spell is not on the cleric spell list, a cleric can prepare it only in her domain spell slot"). Bloodline and mystery Spells join the class list (FAQ), so they never get it. The tag is derived, never stored.
  - Mystery, patron and spirit spells stay prose until the Curation Overlay adds them as `grants` lists. So do the oracle's and hunter's automatic cure and *summon nature's ally* spells.
- A class feature's Spellcasting is that of the class granting it, or for a Selection, of its `gainedAtClassLevel`'s class. Without one, it applies to the Character's only Spellcasting, and shows nothing when there are several.

### Casting tables

A reviewed file in the repo beside the Curation Overlay. Foundry's own tables are GPL code (`config.mjs`) and are never copied.

The prepared source is `scripts/catalog/reviewed-casting-tables.json`, read through `src/lib/character-sheet-casting-tables.ts`. It contains the seven shared families and the adept, extracts and Unchained summoner exceptions through level 20. Occultist rows explicitly identify castable spell levels without inventing a fixed spells-known allowance for its implement-dependent rule. Its structured tables and class metadata are captured as a Catalog Release rule resource. The calculation compatibility identity covers the resolver, adapter, permanent-statistics utility and exact reviewed JSON bytes along with the existing calculation closure.

- **Shared tables:** the seven `(type, progression)` tables, authored from the OGL `rules` journal (`Spell Tables`) and cross-checked against a parse of it. Every Foundry casting class reduces to one of them plus `cantrips`.
- **Class tables:** alchemist and investigator extracts (the bard's numbers for levels 1–6, no 0-level column), the adept, and the unchained summoner (the bard's). They are transcribed from the books.
- **Rows:** class level 1 to 20, and per spell level either no entry, or a number. A "0" means bonus spells only.
  - `spellsPerDay` for every table.
  - `spellsKnown` for `known` casters.
  - `preparedPerDay` for the arcanist.
- **Class data:** each casting class's `record` and `table`, and corrections to the Foundry `casting` summary.

### Derived per Spellcasting

- **Casting level:** the class's Class Levels (an Unchained Class counts as its original, see "Unchained Classes"), plus the prestige advances assigned to it. It reads the table row, capped at row 20 (S11).
- **Castable spell levels:** a spell level the Spellcasting's spells per day, spells known or prepared table has an entry at, "0" included. Spells known and prepared cover sorcerer and arcanist cantrips, which have no 0-level per-day column. Spell too high, Granted Spells, the Spell Effect pre-fill and the `canCast` prerequisite read it ([Prototype the spellcasting section on the living sheet](https://github.com/AndreasUnunger/EverythingPath/issues/233)).
- **Caster level:** the class's Class Levels plus `casterLevelOffset`, plus the advances assigned to it, plus `casterLevel` Modifiers. The offset applies to class levels only (S10), and nothing clamps the sum. The caster level is shown only once the table has an entry, so a paladin shows none before 4th (S1), and a shown caster level is never 0 or less.
- **Spells per day:** the table row, plus bonus spells, plus one extra slot per spell level from 1st when an active class feature of the Spellcasting has `extraSlot`. Several such features still give one extra slot per level. The slot row labels it "+1 domain", "+1 school (evocation)" or "+1 spirit".
- **Bonus spells:** from the CRB table, by the casting ability's permanent score (see "Temporary Effects"). They apply only at spell levels where the table has an entry, "0" included (FAQ). They add to spells per day, and never to spells known, the arcanist's prepared count, or the extra slot (S3).
- **Spells known:** the table row for `known` casters. Nothing adds to it, so feats like Expanded Arcana are covered by accepting the warning.
- **The arcanist's prepared count:** `preparedPerDay`, shown beside its spells per day. Prestige advances raise it (S12).
- **Save DC per spell level:** 10 + spell level + the casting ability modifier + `spellDC` Modifiers. A `school` condition shows a DC per school where it differs.
- **Concentration:** caster level + the casting ability modifier + `concentration` Modifiers.

The casting ability modifier for DCs and concentration is the current one, Temporary Effects included. Only bonus spells read permanent scores.

### Prestige advances

- A prestige class entry's `castingAdvances` lists, per class level, how many advances the level gives and of which kind: one for most, one arcane and one divine for the mystic theurge. The AoN scraper parses them from the level table's Spells column.
- Each prestige Class Level records, in `castingAdvances`, the class each advance goes to. An empty choice is a blue outline. It is pre-filled when exactly one class qualifies.
- **An advance qualifies** for a casting class of its kind (`any`, or the class's `spellKind`) that the Character had Class Levels in before the prestige class's first level, the literal "belonged to before adding the prestige class". So a casting class first taken between prestige levels never qualifies for later advances. The pre-fill and the "belonged to before" warning both use this ([Prototype the spellcasting section on the living sheet](https://github.com/AndreasUnunger/EverythingPath/issues/233)).
- An advance adds to that Spellcasting's casting level and caster level, and so to its spells per day, spells known and castable spell levels. Slot-style grants follow those levels, so an advance can add domain Spells and the domain, school or spirit slot at a new spell level (see "Recorded Spells"). Nothing else counts it (FAQ): no schedule-style grants such as bloodline, mystery or patron spells, and no other class features such as school or domain powers.
- Choices are per level, so advances may be split across classes (S6). An advance may go to a class that doesn't cast yet. It counts once the class does (S9).
- An `arcane` or `divine` advance on a Spellcasting of another `spellKind` warns, so a psychic, alchemist or investigator takes only an `any` advance without a warning (S7, S8).

### Opposition schools

- An arcane school is a class feature with `spellcasting.school` and `extraSlot: 'school'`. Its sheet entry records the two `oppositionSchools`. A universalist has no school entry, and so no school slot.
- Every recorded Spell of an opposition school shows a "2 slots" tag, from the Spell's `school`.
- The same shape covers any other class or archetype with an arcane school and opposition schools.
- Crafting penalties for opposition schools are not modelled.

### Spell Effects

- A Spell Effect is a `spellEffect` Catalog Entry: the Modifiers a running spell grants, imported from the Foundry buffs. `spellKey` names its Spell. A Spell may have several, such as *Fire Shield*'s warm and cold shields.
- Its sheet entry records `casterLevel`, a plain number the player can change ("cast by Brother Ardo at CL 7"). Nothing links it to the caster's sheet. A Spell Effect on one weapon or armor also records `onItem` (see "Spells on an item").
- **Pre-fill.** `casterLevel` is pre-filled with the lowest caster level at which any class can cast the Spell. For each class in the Spell's `levels`, that is the caster level at the first class level at which that class can cast the Spell's level (see "Derived per Spellcasting"). *Haste* pre-fills 4, from the summoner's 2nd-level spells at summoner 4. A paladin spell of 1st level pre-fills 1. A Spell Effect without a Spell uses `defaultCasterLevel`.
- Its formulas may read `@casterLevel` (see "Formulas"). Casting a Spell from a sheet is play-time and out of scope.

### On the sheet

Decided by [Prototype the spellcasting section on the living sheet](https://github.com/AndreasUnunger/EverythingPath/issues/233) (variant 3 "Spells page", tag `prototype-approved/spellcasting` at 3df8cf5: `src/components/character-builder-prototype/`, derivation in `spellcasting.ts`, contract in its CONTRACT.md "Round 4"). The rejected variants were "Spell cards", a card per Spellcasting with a numbers grid, and "Spell-level ladder", rows per spell level with slot pips and Spell chips.

- **Spellcasting section.** One line per Spellcasting: caster level, concentration, a per-day strip, the recorded or granted counts, the warning count, and a link to its Spells page. The section shows whenever the Character has a Spellcasting or an orphaned Spell.
- **Spells page.** Each Character has one at `/characters/<id>/spells`, with a tab per Spellcasting.
  - The numbers: caster level with its casting-level sum ("Wizard 3 +2 from Mystic theurge"), concentration, casting ability, school and opposition schools, the extra slot, and per spell level the spells per day as "table + bonus + extra = total", the DC, and a DC per school where it differs.
  - The default view lists recorded Spells by level, then Granted Spells.
  - **Add Spells** switches to the class list, one spell level at a time, with search across levels, a school filter and "include other lists". A check per Spell records it.
  - A `none` Spellcasting's page is the same browser, read-only.
- Spell warnings sit inline under their Spell, with Accept.
- Orphaned Spells show in a "Not under any Spellcasting" group on the sheet and the Spells page, with their warning.
- **Elsewhere on the sheet:**
  - A prestige Class Level's advance choices sit in the levels table, with a blue outline while empty.
  - Opposition schools are edited on the arcane school's row in Class features.
  - A Spell Effect's caster level field is in Gear, spells & conditions. It may be empty while typing, and leaving it empty restores the pre-fill.
- On phone, Spell rows are one line, and the description opens on tap.
- Recording prepared spells, casts and slots used stays out of scope.

## Modifiers

```ts
type Modifier = { target: Target; bonusType: BonusType; value: number | { formula: string };  // negative = penalty
                  condition?: ModifierCondition;
                  stacksWithinEntry?: true };    // text says it adds to its own entry's other bonuses, see "Stacking"

type ModifierCondition = {                       // every part present must hold
  situation?: Situation;                         // "vs. traps": never in a total (see "Conditional Modifiers")
  whileActive?: Id<'catalogEntry'>;              // "while raging": applies while an active entry of that Catalog Entry exists
  weapon?: '$self' | '$choice' | '$group'        // only attacks with this item, the entry's chosen weapon (Weapon Focus),
    | '$target' | '$unarmedOrNatural';           // a weapon of the entry's chosen group (Weapon Training), the Spell
                                                 // Effect's `onItem` weapon, or the unarmed strike and natural attacks
  option?: true;                                 // only inside a routine that has this entry switched on (see "Attacks")
  castingClass?: '$choice' | ClassTag;           // only this Spellcasting (Magical Knack)
  school?: '$choice' | SchoolKey;                // only Spells of this school (Spell Focus)
};

type Situation = SituationKey | { local: string }   // see "Situational notes"
               | { option: Id<'catalogEntry'> };    // "Only when using Combat Expertise", see "Attacks"
type SituationalNote = { target?: Target; situation?: Situation; text: string };  // no target = shown with its entry
```

### Targets

Targets form a closed list of statistics. Any bonus type may go on any target, because the rules set no restriction.

- **Abilities:** `ability.str`, `ability.dex`, `ability.con`, `ability.int`, `ability.wis`, `ability.cha`, and `ability.$choice`, the ability the sheet entry's `choice` names. An unchosen `ability.$choice` contributes nothing.
- **AC:**
  - `ac.armor`, `ac.shield` and `ac.natural` are separate targets, because the rules count enhancement separately for each thing enhanced.
  - `ac.other` covers every other AC bonus.
- **Saves:** `save.fort`, `save.ref`, `save.will`
- **Skills:** `skill.<key>`
- **Combat:** `bab`, `attack.melee`, `attack.ranged`, `damage.melee`, `damage.ranged`, `cmb`, `cmd`, `init`
- **Hit points:** `hp`
- **Spellcasting:** `casterLevel`, `spellDC`, `concentration`. Each applies to every Spellcasting unless a `castingClass` condition narrows it.

The parent targets `ac`, `saves`, `skills`, `attack` and `damage` exist because rules text uses them. They expand into their leaves before stacking: `ac` expands to `ac.other`. Touch AC and flat-footed AC are never targets. They are derived from the AC leaves (see "Derived statistics").

### Bonus types

`alchemical`, `armor`, `circumstance`, `competence`, `deflection`, `dodge`, `enhancement`, `inherent`, `insight`, `luck`, `morale`, `naturalArmor`, `profane`, `racial`, `resistance`, `sacred`, `shield`, `size`, `trait` (APG, admitted because imported traits use it), `untyped`, plus `base` for base scores and built-in bases.

### Formulas

A formula uses a closed grammar:

- **Operators and functions:** integers, `+ - * /`, `floor`, `ceil`, `min` and `max`. Arithmetic may produce fractional intermediate values; round the complete formula contribution down before stacking, including negative results (Core Rulebook p. 11, Rounding). Explicit `ceil` still rounds its argument up: `ceil(5 / 2)` contributes 3, while `@level / 2` at level 1 contributes 0. Numeric Modifiers retain their recorded value.
- **Variables:** `@level`, `@classLevel.<classKey>`, `@hitDice`, `@ability.<key>.mod` and `@bab`.
- **`@casterLevel`:** in a Spell Effect's Modifiers, the caster level recorded on its sheet entry. *Shield of faith* grants +2 deflection, another +1 at each six caster levels, and a maximum of +5 at level 18: `min(5, 2 + floor(@casterLevel / 6))` (Core Rulebook, Shield of Faith; retained spell description in `convex/data/spells.js`). In a `casterLevel` Modifier, the Spellcasting's caster level before `casterLevel` Modifiers, so Magical Knack is `min(2, @hitDice − @casterLevel)`, capped at Hit Dice as written (S13). Anywhere else it is unsupported.
- **`@casterLevel.<classKey>`** is that class's Spellcasting's caster level, and **`@casterLevel.arcane`** the highest caster level among arcane Spellcastings, for Arcane Strike and other caster-level scaling. Both are 0 without one.

A formula may read only stages earlier than its target's stage (see "Resolution stages"). Runtime evaluation parses an AST without executing the expression. Structural character/class levels are available before ability scores; Hit Dice and BAB are stage-3 inputs and cannot feed ability scores or BAB itself. Caster levels resolve before other dependent statistics, so qualified caster-level reads are allowed on dependent saves, skills, attacks, damage, HP and casting checks, but not on ability, BAB or caster-level targets. Recorded Spell Effect caster level and a casting Modifier's pre-modifier caster level are the explicit early-input exceptions. Scoped class/casting keys may contain dots; the entire suffix is one key, never an object-property path. Absent valid class/casting keys read as zero. Parsing bounds length, token count and nesting; unsafe integer literals, non-finite results and division by zero contribute nothing with a warning. A formula outside the grammar is stored and flagged as unsupported. It contributes nothing and shows a warning. About 22% of the dataset's changes are formulas, so the importer parses them ([Decide how the content dataset becomes the global catalog](https://github.com/AndreasUnunger/EverythingPath/issues/207)).

Named class/casting inputs read only own keys. Inherited properties such as `constructor` are unsupported; a deliberately recorded own key with that spelling remains a valid class key. The importer and runtime use the same parser and target-stage classification, with import-specific variable mapping and admission checks. Current/permanent projections share a calculation-local cache of parsed expressions and parse failures; each contribution still evaluates against its own entry, stage and projection. Constitution HP built-ins join the HP stage after ability resolution, so each projection requires one resolver pass.

### Conditional Modifiers

Decided by [Prototype attacks and conditional modifiers on the living sheet](https://github.com/AndreasUnunger/EverythingPath/issues/216) (variant 3, tag `prototype-approved/attacks-conditionals`).

- **Weapon conditions** apply only inside the attacks of the matching weapon: `$self` for a weapon's own enhancement, `$choice` for Weapon Focus's chosen weapon, matched on `baseType`, and `$group` for fighter Weapon Training, matched on the weapon's `group` against the entry's `weaponGroup`. `$target` and `$unarmedOrNatural` are in "Spells on an item". They never reach the sheet-level attack statistics.
- **Option conditions** apply only inside the routines that switch the entry on (see "Routine Options").
- **While-active conditions** apply automatically while an active entry of the named Catalog Entry is on the sheet, such as Superstition while Raging. Otherwise the Modifier waits and adds nothing.
- **Situational Modifiers** never enter a total. A Situation is a key from a reviewed vocabulary, such as `traps`, `fear`, `spells`, `giants` or `orcsGoblinoids`, with display text such as "vs. traps", or a local Situation that only its own entry names (see "Situational notes"). `resolveSheet(…, { situations: [situation] })` resolves the sheet as if the Situation held. Its Modifiers then apply and stack like any other, so raging Will vs. spells is +6, not +8: Superstition's +3 morale suppresses Raging's +2 morale.
- Every statistic reports `conditional`, the contributions left out of its total, each with its condition text and Situation, or with the while-active wording it waits on. Derived statistics carry the conditional contributions their composition would take: a conditional dodge bonus reaches touch AC and CMD, but not flat-footed AC.
- **Every situational note in the imported content becomes structured.** Foundry has only text notes on a statistic, so the Curation Overlay writes one record per note (see "Situational notes").

### Situational notes

Decided by [Decide how the Curation Overlay structures every situational note](https://github.com/AndreasUnunger/EverythingPath/issues/228). Foundry stores situational bonuses only as text notes on a statistic (`contextNotes`): 278 in the system packs and 3,367 in pf1-content at the pins. The ticket's resolution records the survey of them.

- **Situations.** There are two tiers:
  - A **shared Situation** is a key in the reviewed vocabulary, for a circumstance more than one entry names: fear, poison, mind-affecting, traps, creature types and subtypes, combat maneuvers, schools and descriptors. Notes that word it differently ("vs. fear", "vs fear effects") get one key once a reviewer confirms the match.
  - A **local Situation** is free text owned by one entry ("vs male creatures of your race") and matches nothing else. About 80% of the notes' circumstances occur only once. A local Situation is promoted to a key when a second entry names the same circumstance.
  - Keys are flat, and none implies another. "vs. charm" doesn't include "vs. enchantment", and "vs. spells" doesn't include spell-like abilities, because the rules don't settle either. Asking for several Situations at once combines them.
- **Situational notes.** About 24% of notes carry no number: immunities, rerolls, "can always take 10". Each becomes a `SituationalNote`, a text line with a target and a Situation. It shows in that Situation's group in the breakdown and never changes a number. A note naming a statistic the sheet doesn't have (critical confirmation, ability checks, speed, stabilizing), or naming none, has no target and shows with its entry.
- **Note records.** The Curation Overlay holds one record per note, bound to `externalKey`, Foundry target and exact note text. A note repeated on many entries still gets a record per entry, because formulas depend on the entry's class.
  - A record holds a list of outputs: Situational Modifiers, situational notes, and while-active or weapon Modifiers where the text says so. So one note can split (Duergar's "+4 vs bull rush and trip while on ground" is two Modifiers) or produce nothing when another record covers it.
  - Targets come from the text. `allSavingThrows` maps to `saves`, `skills` to `skills`, `meleeWeapon` to `attack.melee`, `cl` to `casterLevel`, `conChecks` to `concentration` and `spellEffect` to `spellDC`. The 39 notes with an empty target are mapped the same way.
  - Formulas are rewritten into the closed grammar: `@class.level` becomes `@classLevel.<the granting class>`, and `if(gte(…))` becomes `min` and `floor`. Formulas reading `@resources.*` or `@item.level` stay unsupported.
- **Action conditionals.** Foundry's structured action `conditionals` on 14 weapon and ability records (the double-barrelled firearms, Grab) get records the same way, as Situational Modifiers with `weapon: '$self'`. The two library records of UI helpers (`*Common Conditional Modifiers` and `*Weapon Enchant Conditional Modifiers`) are not imported, because the CRB attack rules are written by hand. The second's 19 conditionals seed the Item Ability drafts (see "Item Abilities").
- **Drafting and review.** A drafter script writes the records. A parser drafts notes that lead with a value and a bonus type (about 2,200), and an agent drafts the rest from the note and the entry's description.
  - Each record is `drafted` or `checked`, and both apply. The status isn't shown on the sheet.
  - A record is checked against the entry's imported description, which is Paizo's text, not against the printed book.
- **Prose-only bonuses.** Situational bonuses with no Foundry note (Superstition, a feat's "+2 vs. bull rush") are ordinary overlay Modifier records for prose-only entries, outside the note gate. A one-off drafter pass over every description looks for "vs.", "against" and "when" wordings and drafts what it finds.
- **Note gate.** The import fails if any note or action conditional lacks a record of either status. A record whose note text changed upstream no longer applies, so its note counts as missing. A pin bump runs the drafter for the gaps and commits the new records with its import report, which lists records by status.

The Item Ability policy below extends required coverage to every `itemAbility` entry. The #303 operator workflow adds a separate conservative drafting policy: a drafted record with any `unresolved` or `review` diagnostic contributes no output until checked. Diagnosed drafts for required notes, action conditionals and Item Abilities fail coverage; optional prose-pass diagnostics remain outside that gate. A checked record may retain review diagnostics for context, but unresolved mechanics still fail required coverage. Unresolved raw-mechanics Notes are review placeholders that must be replaced before a record can apply. Unsupported note formulas also require checking, retaining their runtime formula warnings and readable text after review. Required gate status counts and optional prose-pass status counts are reported separately. These safeguards supplement #228's original missing-record gate rather than changing the meaning of either status.

The concrete operator record format, strict output schema, helper-seed bindings, gap-only resume and separate prose-description pass are documented in [Note curation operators](catalog-import/curation.md). `catalog:preview` writes itemised coverage and admission reports before a failing exit. The bounded #303 fixtures demonstrate this workflow without claiming corpus execution or source-content review.

## Stacking

Modifiers are grouped by (leaf target, bonus type).

**Bonuses:**

| Rule | Types |
|---|---|
| stack | `dodge`, `racial`, `untyped`, `circumstance` |
| highest only | every other type, `base` included |

**Penalties.** Untyped penalties sum. Typed penalties take the worst of their type. That honours both the CRB's "most penalties stack" and its magic chapter's same-type rule.

**Same Source.**

- A Modifier's Source is its Catalog Entry's `sourceKey`, or its stored `ruleIdentity` when the key is absent. A Catalog Copy retains its original's effective Source even after edits, without reading an original definition; a distinct Catalog Entry represents a distinct rule.
- Distinct rules share a key only where official text makes them one effect: *haste*, *boots of speed* and the *speed* property share `haste`, and a spell-like ability shares the key of the spell it names. Where the rules are silent, distinct rules stay separate, and bonus type decides.
- Among active entries of one Source, per target, the entry with the largest net contribution applies when any entry has a positive net. When all entries have nonpositive nets, the most negative net applies, including when another entry contributes zero. The others are listed as suppressed by the winner. This refines PRD §8's "largest net" wording for penalties using the CRB magic chapter's worst-penalty and same-effect highest-strength readings ([#209](https://github.com/AndreasUnunger/EverythingPath/issues/209)); the broader same-source penalty rule remains ambiguous in the CRB.
- `stacksWithItself` lifts this rule for text that says duplicates stack, such as sneak attack, trap sense, and the myrmidarch's "as the fighter ability".
- Within one entry, two Modifiers of the same type and target don't stack. Only Modifiers that apply count, so two Situations of one entry never suppress each other. The rule fits the dataset: a note that raises an entry's bonus in a Situation usually gives the new total ("increases to +4"), and one bonus against several Situations (dwarf *hardy*) never counts twice.
- `stacksWithinEntry` marks a Modifier whose text says it adds to another bonus of its own entry. Decided by [Decide how bonuses on one entry stack when their text says so](https://github.com/AndreasUnunger/EverythingPath/issues/230).
  - Per target and type, an entry contributes its largest unmarked Modifier plus every marked one, even where the type wouldn't stack. That contribution then stacks with other entries by type.
  - Only the Curation Overlay sets it. The drafter flags "stacks with" wordings that point back at the same entry, and a reviewer confirms each. At the pins three entries need it: *Overlooked Mastermind*'s feign-ignorance +2, *Good Influence*'s second +1, and *Elixir of the Peaks*'s mountain +10.
  - Halfling *fearless* and halfling luck don't need it: they are separate Racial Traits, so their racial bonuses stack.
- The built-in Modifiers use fixed Sources where the FAQ names them. The class-skill +3 applies once per skill, however many classes grant it.

**Duplicated class features.** A feature taken from two classes that the rules upgrade, such as Uncanny Dodge becoming Improved Uncanny Dodge, gets an advisory prompt to add the upgraded feature. It is never changed automatically.

The resolver reports `applied` and `suppressed` for every statistic, and the sheet shows the breakdown on hover.

## Resolution stages

Each stage groups and stacks. There is no priority field. These stages describe the ordinary single-sheet calculation. Companion Progression and Combined Forms follow their rule-specific inputs and operation order under "Companions"; ordinary per-Hit-Die formulas do not override explicit companion tables or allocated component budgets.

1. **Ability scores:**
   - the base scores;
   - `ability.*` Modifiers, with race bonuses counted as stacking racial Modifiers;
   - Class Level ability increases, as untyped built-in Modifiers;
   - ability drain, lowering the score.
2. **Ability modifiers:** `floor((score − 10) / 2)`, minus `floor(damage points / 2)` of that ability's ability damage. The score itself doesn't change.
3. **Class bases:**
   - BAB and base saves are computed per class from its progression, floored, and summed across classes. A race's `racialProgression` is one more source, computed from `racialHitDice`.
   - Hit Dice are computed here.
4. **Dependent statistics:**
   - **AC leaves:** with Dex as a built-in Modifier on `ac.other`, capped by the lowest max Dex among active armor and shields, and their bonuses on `ac.armor` and `ac.shield` (see "Armor and shields").
   - **Saves, skills and initiative:**
     - Skills combine ranks (`base`), the class-skill +3, the ability modifier and armor check penalty, the sum over active armor and shields.
   - **Hit points:**
     - `hpGained` per Class Level, and the race's `racialHpGained`;
     - the favored class bonus;
     - the Con modifier × Hit Dice.
   - **Attack, CMB and CMD.**
   - **Spellcastings:** caster level, spells per day, spells known, DCs and concentration (see "Spellcasting").

BAB, base saves, HP per level, ranks, the class-skill +3, Dex to AC, ability increases, favored class bonuses, ability damage, and an item's armor bonus, enhancement and masterwork are all built-in Modifiers. That way they appear in the same breakdown as item bonuses.

### Derived statistics

These follow the literal text:

| Statistic | Built from |
|---|---|
| AC | 10 + every AC leaf |
| Touch AC | AC without `ac.armor`, `ac.shield` and `ac.natural`, including enhancements to them |
| Flat-footed AC | AC without the Dex bonus and dodge bonuses |
| CMB | BAB + Str modifier + special size modifier (Dex for Tiny and smaller) + `cmb` Modifiers |
| CMD | 10 + BAB + Str modifier + Dex modifier + special size modifier + every circumstance, deflection, dodge, insight, luck, morale, profane and sacred AC bonus + every AC penalty except size + `cmd` Modifiers |
| Flat-footed CMD | CMD without the Dex bonus; dodge bonuses stay |

Untyped AC bonuses don't reach CMD. Armor's max Dex doesn't cap the Dex in CMD, and the AC size modifier doesn't reach CMD.

CMD applies the normal same-type stacking rule after composing its admitted AC contributions and direct `cmd` Modifiers (CRB p. 208, [Combining Magical Effects](https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects)). A +2 deflection bonus to AC and a +3 deflection bonus to CMD yield +3 to CMD, even from the same entry. Ordinary same-entry contributions of a nonstacking type keep the strongest contribution before comparing entries; explicit `stacksWithinEntry` contributions remain combined. Typed penalties keep the worst per type, while resolved untyped penalties on different leaves remain summed. AC leaves still compose separately, including armor and shield enhancements.

## Attacks

Decided by [Prototype attacks and conditional modifiers on the living sheet](https://github.com/AndreasUnunger/EverythingPath/issues/216) (variant 3, tag `prototype-approved/attacks-conditionals`), [Decide which attack options an Attack Routine supports](https://github.com/AndreasUnunger/EverythingPath/issues/229) and [Decide how the builder treats the remaining CRB attack feats and open attack rulings](https://github.com/AndreasUnunger/EverythingPath/issues/237). Its rules follow the CRB. Foundry stores none of them as data, so they are written from the text. [Collect the official rules for attack options, natural attacks and flurry](https://github.com/AndreasUnunger/EverythingPath/issues/235) (`research/pf1-attack-rules`) collected that text from the CRB and FAQ, flagged the Bestiary's, and swept the CRB feat chapter for anything missed. The rules here are final, and its open items are cited as A1–A15.

- **Coverage.** The builder writes by hand every CRB feat, class feature and Combat situation that changes a routine line's bonus, damage, critical or number of attacks. Other books are catalog content: computed when a plain Modifier with its condition expresses it, and text otherwise. Text:
  - feats that change no line's numbers: Cleave, Great Cleave, Spring Attack, Whirlwind Attack, Shot on the Run, Ride-By Attack, Unseat, Trample, Stunning Fist, Scorpion Style, Gorgon's Fist, Shatter Defenses, Channel Smite, Penetrating Strike, Greater Penetrating Strike, Shield Slam, Combat Reflexes, Strike Back and the maneuver feats;
  - multipliers: Spirited Charge and Deadly Stroke;
  - what the sheet doesn't compute: range increments (Far Shot), mounted penalties (Mounted Archery) and the target's AC (Improved Precise Shot, Pinpoint Targeting);
  - the eight critical feats, such as Bleeding Critical, and Critical Mastery;
  - feats changing improvised attacks: Catch Off-Guard, Improvised Weapon Mastery and Throw Anything;
  - Improved Natural Attack, which isn't CRB and which no Modifier expresses.
- **Attack Routines.**
  - A Character attacks through Attack Routines, state-only sheet entries. Each names the main weapon and whether it is held in two hands or one, an optional off-hand weapon, its natural attacks, and the Routine Options switched on.
  - Adding a weapon to Gear also adds a routine for it, held its natural way. A shield doesn't: its bash is picked into a routine by hand. The player renames, edits, deletes and adds routines.
  - A routine whose weapon has left Gear stays, with an advisory warning.
  - **Prepared manufactured-weapon slice (#314).** `attackRoutine` state stores its name, main `weaponEntryId`, `hands` (`one`/`two`), and `mode` (`melee`/`ranged`/`thrown`). Its state-only entry has no copied weapon definition. Adding a manufactured weapon through either writer atomically creates its default named routine; armor and shields do not. The same hands/mode defaults apply when replacing the weapon, with explicitly supplied choices taking precedence. The public calculator returns separate single/full lines with BAB iteratives, current ability modifiers, size, weapon enhancement/masterwork, proficiency/armor penalties, Strength damage, critical and range breakdowns. Ability contributions identify their ability, iterative penalties identify BAB, and weapon facts identify the Gear entry. Two-weapon chains, natural attacks, haste/reload/throw rate, automatic feats and Routine Options remain subsequent slices.
  - **Warnings and repair.** Missing Gear, switched-off Gear, a weapon whose source is unavailable, and a selected entry that is no longer a weapon produce distinct warnings owned by the routine, with no guessed attack lines. A same-Character non-item reference does not prevent the sheet from loading; a reference to another Character still fails authorization. Routines keep their name and recorded choices and remain available for rename, removal or replacement. Unsuitable hands/mode and one-handed exotic use are advisory warnings shown both on the card and in the editor, including when attacks can be calculated. Throwing a weapon not designed for throwing applies the CRB's −4 improvised penalty and 10-foot range increment (CRB pp. 141–142); selecting an unusual configuration remains allowed. Switched-off, missing and unavailable weapons supply no proficiency-use facts.
  - **Editing and collaboration.** Changes persist immediately, field by field. Any authorized player may edit a campaign routine, and the latest supplied change wins; no expected revision or stale-save refusal is used. The server returns an acknowledged routine revision solely for local draft bookkeeping. Incoming changes refresh untouched fields while retaining dirty or invalid drafts, with “Changed by another player. Your edits are kept.” Saving, saved, error and retry feedback stays beside the affected control; a failed save preserves the draft. Empty and structurally invalid values are blocked with field errors, while rule suitability stays advisory. Internal identifiers and revisions are not player-facing copy.
  - **Removal and Undo.** `active: false` is the only removal state. Removal retains the same row and choices, omits its calculated attacks, and prunes its Accepted Warnings. A Character retains at most one removed routine for Undo: removing another routine permanently purges the earlier removed row and its warning acceptances. Routine writes, and writers that automatically create routines, retire accumulated historical removals before checking sheet size. Undo restores the retained row's original ID; an earlier purged removal cannot be restored. Only an acknowledged removal creates a local Undo receipt. Failed Undo keeps that receipt available for retry; removal and restoration notices can be dismissed. This does not copy or re-add Gear.
  - **Prepared schema transition.** The earlier prepared representation additionally stored `state.deleted: true`. This schema removes that optional field and adds `by_characterId_and_kind_and_active`. Before deploying over such prepared data, remove `state.deleted` from attack-routine states while retaining `active: false`, the latest Undo row's ID and choices, and remove older inactive routines plus their warning acceptances. Ordinary writes clean up historical inactive rows within a transaction; data exceeding Convex transaction limits needs operator cleanup in bounded batches before deployment. No production migration or deployment is performed by #314. The generated API declaration includes `lib/representativeWeaponCatalog` and must be verified by real codegen when deployment is authorized.
  - Runtime weapon facts retain the imported vocabulary `handedness`, `dice`, `damageTypes`, `threat`, `mult`, `thrown` and `rangeIncrement`. The #306 runtime proficiency adapter keeps singular `baseType`; `attackType`, `thrownRangeIncrement`, `strengthDamage` and `strengthRating` make the selected mode and ranged Strength rule explicit. The representative prepared Base Items cite CRB Table 6–4 and weapon descriptions and carry Medium-size printed dice; they are not a curated Catalog Release. Import admission continues to use its broader plural `baseTypes` shape, so a later importer/runtime adapter must map that shape explicitly.
- **Weapons.**
  - **Unarmed strike** is a built-in weapon every sheet can put in a routine, with no Gear item. It is imported from Foundry's `monster-abilities` unarmed strike (1d3 nonlethal). Its lines say "nonlethal", or "lethal or nonlethal" with Improved Unarmed Strike. The −4 penalty for dealing the other kind of damage stays text. A monk's unarmed damage scales with monk level. For sizes other than Small, Medium and Large, unarmed and monk unarmed damage step from the Medium value along the CRB FAQ damage-dice chart (March 2015) (A14).
  - **Natural attacks:** primary at full BAB with Str, ×1.5 if it is the only natural attack; secondary at −5 with ½ Str. They get no iterative attacks. Foundry's 12 generic natural attack items (Bite, Claw… in `monster-abilities`, `attack` items with `subType: natural`) import as natural weapons. Their primary or secondary type is written from the rules, because Foundry marks it on only 5. Nothing grants them, because racial natural-weapon traits are prose in Foundry: the player adds a natural attack entry. Grants can come later without a model change.
  - **Natural attacks with weapons** (A5; CRB p. 182, the Bestiary's universal monster rule, the UM FAQ synthesist and tentacle entries):
    - A routine may mix them. All its natural attacks are then secondary: −5 and ½ Str, −2 with Multiattack.
    - The weapon attacks take no two-weapon penalty from the natural attacks. Table 8-7 applies only with an off-hand weapon, and Two-Weapon Fighting doesn't change natural attacks.
    - A routine whose claws, slams or tentacles outnumber its limbs not holding a weapon shows an advisory warning.
    - A flurry routine can't include natural attacks.
  - **Thrown weapons:** a weapon with a thrown attack has a melee or thrown mode in a routine. Foundry stores separate `mwak` and `twak` actions on one item (dagger, spear, javelin). Thrown takes Dex to attack and Str ×1 to damage however many hands throw it, because the ×1½ rule says "melee attacks"; an off-hand throw takes ×½ (A9).
    - **Rate (A9).** Without Quick Draw a thrown routine gets one throw per hand already holding a weapon: no iterative, haste or extra off-hand attacks, as with a crossbow that doesn't reload free. Quick Draw restores the full rate. Shuriken are exempt, because they are drawn as ammunition.
  - **Double weapons:** the off hand may be the other end of the main weapon, light for two-weapon penalties. Foundry models only one end for 16 of 17 double weapons, so the Curation Overlay supplies the second end's dice and critical. Each end has its own enchantment (see "Weapons and armor").
    - Used as a double weapon, the primary end takes Str ×1 and plain Power Attack, and the off-hand end ×½. The ×1½ and +50% belong only to wielding it two-handed to attack with one end (A10).
  - **Weapon choices.** A natural attack form (Bite, Claw…) is a valid Weapon Focus, Weapon Specialization and Improved Critical choice, matched on `baseType` like a weapon (A8).
- **Single and full attack.**
  - Each routine resolves to its single attack (a standard action: the main weapon, no two-weapon penalty, no extra attacks) and its full attack in order.
  - **Iterative attacks:** one more at −5 cumulative at BAB +6, +11 and +16.
  - **Off hand:** one off-hand attack.
  - **Haste:** an active `haste` Source adds one attack at the highest bonus.
  - **Reload:** a crossbow gets no iterative or haste attacks unless reloading is a free action. Thrown weapons without Quick Draw follow the same rule (see "Weapons").
- **Attack bonus:**
  - BAB, plus Str for melee or Dex for ranged;
  - the `attack.*` Modifiers and the weapon's own conditional Modifiers;
  - the item's enhancement and masterwork, built-in Modifiers with `weapon: '$self'` (see "Weapons and armor");
  - two-weapon penalties (CRB Table 8-7): −6/−10, −4/−8 with a light off-hand weapon, −4/−4 with Two-Weapon Fighting, −2/−2 with both;
  - the switched-on Routine Options;
  - −2 with a composite bow whose Strength rating exceeds the Str bonus;
  - nonproficiency penalties (see "Proficiencies").
- **Damage:**
  - the weapon's dice;
  - Str ×1.5 in two hands, ×1 in one, ×0.5 off hand (a Str penalty applies in full); Str up to its rating for a composite bow, no Str for a crossbow, a Str penalty only for other bows;
  - the `damage.*` and weapon Modifiers, the item's enhancement included (masterwork adds nothing to damage).
  - **Sneak attack:** +1d6 per entry, as conditional damage in its own Situation (flanking or the target denied its Dex bonus).
  - **Special-ability dice:** always-on dice are an extra damage part ("1d8+4 plus 1d6 fire"). Target-dependent ones (*holy*, *bane*) are Situational damage, like sneak attack. They come from Item Abilities (see "Item Abilities").
- **Critical:** the weapon's threat range and multiplier, shown as "×3", "19–20/×2" or "18–20/×2".
- **Automatic feats** apply with no toggle while on the sheet:
  - Improved and Greater Two-Weapon Fighting: a second and third off-hand attack, at −5 and −10;
  - Double Slice: full Str on the off hand;
  - Threat-range expanders: Improved Critical, *keen* and *keen edge* (`doublesThreat`). Any number of them double the threat range once. This follows AoN's later CRB printing of Improved Critical (A15), and is a hand-written rule, as no Modifier target is a threat range;
  - Rapid Reload: a light crossbow's reload becomes free and a heavy crossbow's a move action;
  - Quick Draw: the full rate for thrown routines (see "Weapons");
  - Weapon Finesse: the higher of Str and Dex to attack with a `finesse` weapon. The breakdown names the ability used, and a shield's armor check penalty applies;
  - Multiattack: secondary natural attacks take −2 instead of −5. It is a Bestiary feat, written by hand because the CRB natural-attack rule names it;
  - Two-Weapon Rend: a routine with an off-hand weapon shows one extra line after its full attack, "Rend: 1d10 + 1½ Str, once per round if both hands hit". It is never added to a single attack line;
  - Shield Master: a shield bash in a routine takes no two-weapon penalty, because the FAQ limits its "any penalties" to two-weapon ones. The shield's enhancement also applies to its bash attack and damage "as if it was a weapon enhancement bonus", so it doesn't stack with the `bash` enchantment's own (see "Armor and shields").
- **Data-only feats.** Point-Blank Shot is a Curation Overlay Situational Modifier: +1 on ranged attack and damage in the shared Situation `within30ft` ("within 30 ft"). Critical Focus is a Situational Note with no target, shown with its entry, like any note on critical confirmation (see "Situational notes").
- **Combat situations** are built-in Situations: fighting defensively, total defense, charging, and shooting into melee (−4 on ranged attacks, CRB p. 182). Precise Shot removes the shooting-into-melee penalty, a hand-written rule. Combat situations don't trigger the situational marker. Each breakdown lists them in a collapsed "Combat situations" group below the Character's own "Only when…" groups.
  - Fighting defensively applies to routine lines. The sheet has no attack-of-opportunity line, so A11 needs no ruling.
- **On the sheet:**
  - The Offense block keeps BAB, CMB and Initiative. A separate Attacks block lists the routines as cards: the single attack, then the numbered full attack. Each line shows the weapon, its bonus, damage, critical and range, plus options as chips and penalties in one line.
  - Routines are edited in a side panel, or a bottom sheet on phone. Changes apply at once, and a delete can be undone.
  - **Situational bonuses never appear on the face of the sheet.** A small marker flags any number that has them: in the pinned stats, the Defenses, the skills and the attacks.
  - The number's breakdown has an "Only when…" section grouped by Situation. Each group shows its lines and what the total becomes then, with suppressed lines struck through. A while-active line that is waiting is dimmed ("only while raging").

### Routine Options

- **Data.** The Curation Overlay can mark any feat Catalog Entry as a Routine Option (`routineOption`). Its Modifiers carry the `option` condition, so they apply only inside a routine that has it switched on.
- **Offered.** A routine offers an option only while its entry is on the sheet. If the entry leaves, the routine keeps it switched on, with an advisory warning.
- **Outside the routine.** An option's Modifiers on anything but its routine's lines, such as Combat Expertise's dodge AC or Lunge's −2 AC, belong to a Situation named after the option. The AC breakdown shows "Only when using Combat Expertise".
- **CRB Routine Options:** Power Attack, Deadly Aim, Combat Expertise, Arcane Strike, Rapid Shot, Manyshot, Vital Strike (with Improved and Greater), Lunge and Medusa's Wrath. Deadly Aim, Combat Expertise and Arcane Strike are data only. Arcane Strike's damage reaches natural attacks and unarmed strikes too: the CRB has a Natural weapon group, and unarmed damage "is considered weapon damage" (A7). The others add hand-written rules:
  - **Power Attack:** −1 attack and +2 damage, plus −1 and +2 more per 4 BAB from +4. The damage is ×1.5 two-handed and ×0.5 off hand, and it applies to melee only.
  - **Rapid Shot:** one extra attack, and −2 on every attack.
  - **Manyshot:** a second arrow on the first attack.
  - **Vital Strike:** the weapon's dice ×2, ×3 with Improved and ×4 with Greater, on the single attack only. It applies to any attack with damage dice: natural attacks, unarmed strikes and monk unarmed damage (A6).
  - **Lunge:** +5 ft reach.
  - **Medusa's Wrath:** offered only on routines with an unarmed strike. It adds two more unarmed strikes at the highest bonus to the full attack. The player switches it on when the target qualifies.
- **Flurry of blows** is a Routine Option for monks, written separately for the core monk and the unchained monk.
  - **Weapons.** The routine's main weapon makes every flurry attack. If an off-hand weapon is set, it makes the flurry's extra attacks, laid out as two-weapon fighting. Other mixes are separate routines. A flurry routine can't include natural attacks.
  - **Core flurry.** Every flurry attack takes full Str. Power Attack halves only the attacks made with the off-hand weapon; unarmed strikes and a single weapon have no off hand (A1). A two-handed monk weapon takes Str ×1, from the flurry's "full Strength bonus … with a weapon wielded in both hands", but Power Attack still gets +50% from its own two-handed clause (A2). The flurry is "as if using" Two-Weapon Fighting, not two-weapon fighting: the Two-Weapon Fighting chain adds no attacks on top, and Double Slice and Two-Weapon Rend don't apply (A3).
  - **Unchained flurry.** Unarmed strikes take full Str. Monk weapons follow the normal rules: one weapon in two hands takes Str ×1½ and Power Attack +50%, and off-hand weapon attacks take Str ×½ and half Power Attack. No two-weapon penalties apply (A4).

## Weapons and armor

Decided by [Decide how enhancement and special abilities attach to weapons and armor](https://github.com/AndreasUnunger/EverythingPath/issues/236).

- **State on the item.** An item's enhancement, masterwork, material and Item Abilities are state on its sheet entry, never separate entries or a Catalog Copy. Two longswords are two sheet entries, each with its own enchantment.
- **Always on.** Command-word abilities such as *flaming* count as always on. Switching them during play is out of scope, so a burst weapon's dice always show (A12 needs no ruling).
- **Per end and per bash.** A double weapon's `otherEnd` ("the double weapon is treated as two separate weapons", FAQ) applies when a routine's off hand is `'otherEnd'`. A shield's `bash` is its own enchantment (see "Armor and shields"). Everything below holds for each end and each bash.
- **Not modelled.** Class features that enchant a weapon for a while (paladin divine bond, magus arcane pool, warpriest sacred weapon) are play-time state. Their text stays on the class feature. Gold-piece prices are never computed.
- **Editing.** There is no prototype. The item editor follows the routine side panel (a bottom sheet on phone): an enhancement stepper, a masterwork toggle, a material select, an Item Ability picker filtered by `appliesTo`, and the construction warnings inline.

### Enhancement and masterwork

- **Enhancement.** A weapon's is a built-in `enhancement` Modifier on `attack` and `damage` with `weapon: '$self'`. Armor's and a shield's are in "Armor and shields".
- **Masterwork.** The `masterwork` flag is kept, but an item with enhancement +1 or more, or of a masterwork material, counts as masterwork whatever the flag. Nothing warns about magic that isn't masterwork.
  - A masterwork weapon has a built-in +1 `enhancement` Modifier on `attack` only, with `weapon: '$self'`. Highest-only stacking suppresses it under any enhancement bonus, so no special rule is needed.
  - Masterwork armor or a masterwork shield has −1 armor check penalty, kept when it is magic.
  - Masterwork armor or shields never add to a shield bash or to armor used as a weapon.

### Armor and shields

- **Base.** An active armor item is a built-in `armor` Modifier of its `bonus` on `ac.armor`, and a shield a `shield` Modifier on `ac.shield`. Its enhancement is an `enhancement` Modifier on the same leaf, so touch AC drops it. "Worn" is the sheet entry's `active` flag, and highest-only stacking settles two active suits.
- **Max Dex.** Dex to AC is capped by the lowest `maxDex` among active armor and shields.
- **Armor check penalty.** The sum of active armor's and shields' `armorCheckPenalty`, after masterwork and material.
- **Spell failure** is shown, not computed.
- **Tower shield.** Its −2 on attacks is a Curation Overlay Modifier on the tower shield entry.
- **Shield bash.** Foundry gives each shield a "Bash" melee action (heavy steel shield: 1d4 bludgeoning), and the shield's `weapon` detail is mapped from it. So a shield can be a routine weapon, usually off hand: a light shield's bash is light, a heavy shield's one-handed.
  - A bash uses the `bash` enchantment. The shield's own enhancement stays on `ac.shield` ("An enhancement bonus on a shield does not improve the effectiveness of a shield bash made with it, but the shield can be made into a magic weapon in its own right", CRB).
  - *Bashing* is a shield Item Ability. Its +1 on attack and damage are Modifiers with `weapon: '$self'`, and its dice two sizes larger are a hand-written CRB rule.
  - Losing the shield's AC bonus after a bash stays text. With Shield Master the shield's enhancement also reaches the bash, as a weapon enhancement bonus that doesn't stack with the `bash` enchantment's (see "Attacks").
- **Spikes.** Armor spikes and shield spikes are separate weapon items in Gear, as in Foundry.

### Item Abilities

- **Entries.** Each weapon, armor or shield ability, such as *flaming*, *keen* or *fortification*, is an `itemAbility` Catalog Entry. They come from pf1-content's `pf-special-qualities` pack, 333 prose-only records, because Foundry has no way to attach an ability to an item. An item lists them as `ItemAbilityRef`s.
- **Modifiers.** An ability's Modifiers bind to the item listing it.
  - Weapon Modifiers carry `weapon: '$self'`: *bane*'s +2 enhancement on attack and damage in its Situation.
  - A Modifier with no weapon condition applies while the item is active: *shadow*'s +5 competence on Stealth.
  - Situational ones work as anywhere else: *arrow catching*'s +1 deflection vs. ranged attacks.
  - *Speed* has `sourceKey: 'haste'`, so its extra attack comes from the haste rule and doesn't stack with *haste*.
- **Choice.** *Bane*'s designated foe is the `ItemAbilityRef`'s `choice`. Until it is chosen, its Modifiers and dice contribute nothing and the field shows a blue outline.
- **Dice.** `hit` dice are an extra damage part, or Situational damage with a `situation` (see "Attacks"). `crit` dice (*flaming burst*, *thundering*) apply only on a critical hit, one more die per multiplier step above ×2. They read the weapon's printed multiplier, not Weapon Mastery's raised one, so never more than ×4 (A13). Extra dice are never multiplied on a critical (CRB).
- **Keen.** `doublesThreat` feeds the threat-range rule in "Attacks".
- **No sheet statistic.** *Fortification*, damage reduction, spell resistance, energy resistance, *defending*, *brilliant energy* and *ghost touch* are Situational Notes on the ability. Overcoming damage reduction (+3 as cold iron and silver, *holy* as good) isn't computed.
- **Tiers.** A tiered ability is one entry per tier (*fortification* light, moderate and heavy), as pf1-content already splits *spell resistance* 13, 15, 17 and 19.
- **Import.** The importer reads `appliesTo` from the pack's tag (Melee, Ranged, Universal Weapon, Armor, Shield, Universal Armor & Shield Qualities) and `bonusEquivalent` from the price prose: 241 plain +1 to +5, 72 flat gold prices as +0, and a few tiered.
- **Drafting.** The situational-notes drafter (parser plus agent) drafts each ability's dice, Modifiers and notes from its description, seeded by the 19 conditionals of Foundry's `*Weapon Enchant Conditional Modifiers` helper (see "Situational notes"). Each record is `drafted` or `checked`, and the note gate covers every `itemAbility`. CRB abilities are checked before launch, the coverage bar of [Decide which attack options an Attack Routine supports](https://github.com/AndreasUnunger/EverythingPath/issues/229). The rest ship `drafted`.

### Specific magic items

- **Upstream.** pf1-content has 387 magic weapons and 228 magic armors and shields as standalone records.
  - Their weapon data is broken: a placeholder `sizeRoll(1, 4, @size)` melee action with no critical, even on bows.
  - The only link to a base is free-text `baseTypes`.
  - Enhancement and abilities are prose ("This is a +1 flaming burst longsword").
- **Base Item.** A specific item is an `item` Catalog Entry with `baseItem`.
  - Its `weapon` detail always comes from the Base Item, never from Foundry's placeholder, its `proficiency` included.
  - Its `armor` detail comes from the record's own numbers when it has them (the *mithral shirt* and *celestial armor* bake theirs in), else from the Base Item (*dwarven plate* has no armor block). A shield with an empty subtype takes its `category` from the Base Item.
  - The importer matches `baseTypes` to a mundane item's name, ignoring case: 348 of 380 weapons match, and 25 mundane `baseTypes` strings are shared by several items. The Curation Overlay settles the unmatched and ambiguous ones.
- **Defaults.** `magic` holds the default masterwork, enhancement, abilities and other end, drafted from the prose and checked in the Curation Overlay. Adding the item to a sheet copies them into the sheet entry's state, which is then the truth and stays editable, like a Spell Effect's pre-filled caster level.
- **On the entry.** The description, price, unique powers (*flame tongue*'s ray) and the item's own Modifiers stay on the Catalog Entry.
- **Conditional enhancement.** *Sun blade* (+4 vs. evil), *mace of smiting* (+5 vs. constructs), *oathbow* (vs. a sworn enemy), *holy avenger* (+5 *holy* in a paladin's hands), *dwarven thrower* (in a dwarf's hands) and *sword of the planes* get Situational `enhancement` Modifiers on attack and damage with `weapon: '$self'`, written by the Curation Overlay.
  - Target conditions use shared or local Situations. Wielder conditions use a local Situation too, not a new condition kind.
  - A player who wants the bonus on the face of the sheet sets the state's enhancement.

### Spells on an item

- **Target.** A Spell Effect that enhances one weapon or armor records `onItem`: a sheet entry or the unarmed strike, and optionally the other end or the bash. This covers *magic weapon*, *greater magic weapon*, *magic vestment* and *magic fang*.
  - `weapon: '$target'` limits a Modifier to attacks with that weapon or end.
  - A `$target` Modifier on an AC target lands on that item's leaf, `ac.armor` or `ac.shield` (*magic vestment*).
  - Highest-only `enhancement` stacking settles *magic weapon* against the weapon's own +1.
  - *Keen edge*'s `doublesThreat` applies to its `onItem` weapon (see "Attacks").
  - Until `onItem` is filled, its `$target` Modifiers contribute nothing and the field shows a blue outline.
- **Unarmed and natural.** `weapon: '$unarmedOrNatural'` limits a Modifier to the unarmed strike and natural attacks (*amulet of mighty fists*). A monk's unarmed strike counts as both a manufactured and a natural weapon for these (CRB monk).

### Ammunition

- A routine's ranged main weapon may name `ammo`, an ammunition item. Its enhancement and Item Abilities apply to that routine's lines.
  - Its enhancement competes with the launcher's by highest-only ("Only the higher of the two enhancement bonuses applies", CRB).
  - The launcher's abilities still apply, since bows pass them to their ammunition (CRB).
  - Without `ammo` nothing changes.
- Ammunition items have the same state, `quantity` included. Foundry's 120 ammunition records carry no enhancement. Some magic ammunition is a weapon record (*screaming bolt*, +2) and imports as an item like any other.

### Special materials

- **Table.** Item state's `material` is applied by a hand-written CRB table. Other books' materials are text.

  | Material | Effect |
  |---|---|
  | Mithral | armor: −3 armor check penalty (minimum 0), +2 max Dex, −10% spell failure; masterwork |
  | Darkwood | shield: −2 armor check penalty; masterwork |
  | Adamantine | masterwork; armor: damage reduction 1, 2 or 3 for light, medium or heavy, as a Situational Note |
  | Dragonhide | masterwork |
  | Alchemical silver | −1 damage (minimum 1) on slashing and piercing weapons |
  | Cold iron | nothing on the sheet |

- **Mithral.** Its −3 doesn't stack with masterwork's −1. The CRB is silent, and *elven chain* and the *mithral shirt* only fit no stacking. "One category lighter" stays text: per the FAQ it doesn't change the actual category.
- **One material.** Only the most prevalent material applies, so an item has one. A double weapon's other end has its own.
- **Specific items.** A specific item's material (Foundry `material.normal`) is display-only in its catalog detail, because its numbers already include it. The table applies only when state sets a material on an item whose Catalog Entry has none.

## Proficiencies

Decided by [Decide how the builder treats the remaining CRB attack feats and open attack rulings](https://github.com/AndreasUnunger/EverythingPath/issues/237). It reverses [Decide which rules checks the builder warns about](https://github.com/AndreasUnunger/EverythingPath/issues/215) where that never recorded proficiencies and showed nothing for proficiency clauses.

- **Tracked.** Weapons, armor (light, medium and heavy) and shields (shield and tower shield). A buckler counts as a shield.
- **Derived, never stored.** A Character's proficiencies are the union of the grants on its active sheet entries (the classes of its Class Levels, Racial Traits, feats, class features and traits), plus the player's additions, minus the player's removals. Multiclassing adds the new class's grants.

```ts
type ProficiencyGrant =
  | { category: 'simple' | 'martial' | 'firearm'                  // firearm: every weapon in the firearms group
      | 'light' | 'medium' | 'heavy' | 'shield' | 'towerShield' }
  | { baseType: string; asMartial?: true }                        // asMartial: "treat dwarven weapons as martial"; counts only with `martial`
  | { group: WeaponGroup }                                        // "Close Weapon Group"
  | { choice: true };                                             // the entry's choice: a feat's `choice`, a Class Level's `proficiencyChoice`
type ManualProficiency = Exclude<ProficiencyGrant, { choice: true }>;
```

- **What a grant covers.**
  - A weapon is covered by a grant of its `proficiency` category (`simple` or `martial`), its `baseType`, its `group`, or `firearm` for the firearms group. An exotic weapon is covered only by name or group. A weapon with `proficiency: 'always'` (natural attacks, the unarmed strike, alchemical throwables) is always covered.
  - A bastard sword or dwarven waraxe counts as martial in two hands (CRB), so a `martial` grant covers it there. In one hand only a grant naming its `baseType` covers it, Exotic Weapon Proficiency included.
  - A shield's bash is `martial` (CRB weapon table).
  - Armor's `category` gives its proficiency: `light`, `medium` or `heavy`; `buckler`, `lightShield` and `heavyShield` need `shield`, and `tower` needs `towerShield`.
- **Choices.**
  - Martial and Exotic Weapon Proficiency grant the feat's chosen `baseType`. Simple Weapon Proficiency grants all simple weapons.
  - Cleric, warpriest and inquisitor Favored Weapon, and the commoner's "1 simple weapon", are a `choice` grant on the class. The player picks a `baseType` in `proficiencyChoice` on the class's first Class Level. An empty choice grants nothing and shows no warning. The deity stays free text, so nothing checks the choice against it.
- **Manual changes.** The base entry's `proficiencies` holds the player's additions and removals, each shown as manual. A removal wins over every grant covering the same weapon, armor or shield. Removal exists because Archetype proficiency changes stay prose (see "Archetypes and prestige classes").
- **Effects.**
  - A routine line with a weapon the Character isn't proficient with takes −4 on attack.
  - Active armor or a shield the Character isn't proficient with adds its armor check penalty to every attack line and to the Str- and Dex-based skills that involve moving (CRB). Those skills already take the armor check penalty (see "Armor and shields"), so it never counts twice.
  - Each penalty is named in the breakdown ("not proficient: longsword"). Being nonproficient raises no warning.
  - **One-handed exotic.** A bastard sword or dwarven waraxe held in one hand without a grant naming it shows an advisory warning (CRB FAQ `#v5748eaic9qut`). The line is still computed as written: one-handed, with the −4.
- **Prerequisites.** Proficiency clauses are checked (see "Prerequisites").
- **Import of grants.**
  - Foundry's `system.weaponProf` and `system.armorProf` string arrays become `proficiencies`. They sit on all 49 system classes, 9 races, 24 pf1-content racial traits, a few traits, 5 class features and the proficiency feats. A race's move onto its weapon familiarity trait (see "Racial traits").
  - The keys `simple`, `martial`, `lgt`, `med`, `hvy`, `shl` and `twr` map to categories. Free-text names match a `baseType` ignoring case and spelling, and the Curation Overlay fixes the ~38 variants that still fail.
  - Martial and Exotic Weapon Proficiency are corrected to `{ choice: true }`, because v11.11 wrongly grants all martial weapons and a placeholder.
  - The Curation Overlay resolves the class strings. "Close Weapon Group" becomes a group grant, "Firearms" the `firearm` category, "Monk Quality" the monk weapons list, and "1 simple weapon" and "Favored Weapon" a choice. "Bombs" is dropped, as it is no weapon item, and "No Metal Armor" stays text.
  - The Curation Overlay also writes weapon familiarity for every admitted race (CRB, APG and ARG traits), with "treat elven weapons as martial" and its kin as an explicit list of `asMartial` base types, and the CRB class-feature grants. Other prose grants aren't structured: the player adds them.
- **Import of item proficiency.**
  - A system-pack weapon's `proficiency` is its `system.subType`, and a missing one is `simple`. pf1-content magic weapons mostly lack it (315 of 436 disagree with their base), so a specific weapon takes its Base Item's through `baseTypes` (see "Specific magic items").
  - Foundry's forced `proficient: true` (natural attacks, the unarmed strike, alchemical throwables) becomes `always`.
  - Armor's `category` comes from `system.equipmentSubtype`: `lightArmor`, `mediumArmor` and `heavyArmor`; `lightShield`, `heavyShield`, `towerShield`, and `other` for a buckler. pf1-content shields with an empty subtype take their Base Item's. The armor check penalty is `system.armor.acp`.

## Rules checks

Decided by [Decide which rules checks the builder warns about](https://github.com/AndreasUnunger/EverythingPath/issues/215), with proficiencies revised by [Decide how the builder treats the remaining CRB attack feats and open attack rulings](https://github.com/AndreasUnunger/EverythingPath/issues/237) (see "Proficiencies"), with Prerequisites at recorded level revised by [Decide what as-taken prerequisite checks reconstruct](https://github.com/AndreasUnunger/EverythingPath/issues/242) (see "Prerequisites"), and with dormant and kept entries from [Decide how granted entries survive edits and replacement](https://github.com/AndreasUnunger/EverythingPath/issues/243) (see "Grants and dormant entries"). Every check is advisory (Principle 5). The approved prototype fixed the presentation ([Prototype the character creation and level-up flow](https://github.com/AndreasUnunger/EverythingPath/issues/208)): warnings show inline next to their field, and blue outlines mark only what Class Levels leave unfilled.

**Where checks run.**
- Warnings are pure derived output and are never stored. `calculateCharacterSheet` orchestrates the separate `calculatePointBuy` and `sheetWarnings` functions and returns warnings with totals. Point-buy cost reads the base Modifiers directly, independently of resolved ability totals. Convex uses that shared calculation both for sheet reads and to validate acceptance against current facts inside the write transaction; the client adds acceptance state. Each warning carries its inline target from the pure calculation.
- Warnings appear only on the Character Sheet. Characters & officers, the Characters area and the campaign Characters page show no warnings or warning counts.
- A Militia-only Character gets only the level-0 warning.

**Implemented checks (#262, #298, #299).** Each warning contains `kind` (`incomplete`, `unresolved` or `rules`), a closed `check` key, `subject`, `fingerprint`, `message` and inline `target`. The shared `characterSheetWarningSchema` supplies both the pure calculation's TypeScript type and Convex's validator; check and target variants are defined once.

- Missing class/HP choices (`class`, `hpGainedMissing`), unresolved total HP (`totalHpUnresolved`), the PC level-zero rule (`levelZero`) and point-buy range or budget (`pointBuy`) remain. Point-buy reads base scores and the CRB cost table; fractional or out-of-range scores leave cost unresolved. Under budget produces only the counter.
- Complete class definitions supply the HP checks: below 1 (`hpGainedBelowMinimum`), above the class hit die (`hpGainedAboveMaximum`), and a PC without racial Hit Dice whose first recorded Class Level HP differs from that die's maximum (`firstLevelHpNotMaximum`). Missing HP raises its incomplete warning rather than the maximum check. A deleted or legacy name-only class definition is treated as Unspecified with a class-choice warning; its recorded HP and other choices remain. Without a complete schedule, its die-dependent checks cannot run.
- Advancement checks include missing/off-milestone ability increases (`abilityIncreaseMissing`, `abilityIncreaseMilestone`), missing/nonfavored bonuses (`favoredClassBonusMissing`, `favoredClassBonusNotFavored`), excess favored-class selections (`favoredClassCount`), a prestige favored class (`favoredClassPrestige`), cumulative per-row skill-rank caps (`skillRankCap`) and coexisting original/Unchained definitions (`classVersions`). Favored selection warnings target `favoredClasses`; row warnings target the corresponding Class Level field. Skill-rank budgets use current permanent Intelligence, retaining drain and excluding Temporary Effects and ability damage.
- Formula warnings (`unsupportedFormula`, `formulaDependency`) retain expressions without a contribution. `@hitDice`, `@level` and `@classLevel.<tag>` read advancement's actual total Hit Dice, recorded Class Level count and per-class counts; Unchained levels also count under their original class identity. Current and permanent projections share parsed expressions and retain their own evaluated totals.

Entered rule departures still contribute; only `rules` warnings can be accepted. Acceptance never fills a decision, resolves missing HP or changes a total. The broader inventory below remains the target for subsequent feature tickets.

Prepared sheets now select a race through `characterSheet.selectRace`. Race definitions carry size, creature types/subtypes, racial Hit Dice and progression; their standard Racial Traits are Grants that supply ability score changes, slots, familiarity, extra skill ranks and favored-class entitlement. Every selection writer, including `setRacialTraitSelected`, `selectEntry` and `editSelection`, rejects standard trait definitions and Catalog Copies sharing their Rule Identity; they cannot duplicate a standard Grant as a Selection. Alternate Racial Traits remain selectable through the dedicated or generic selection writers, with recorded state retained when switched off. The live calculation exposes these as `racial` facts, separately from the base scores. Prepared favored-class selections remain on the base Sheet Entry; their entitlement comes from active racial traits.

Race selection activates one race Selection and leaves previous race rows inactive. Returning to a race restores its row, aggregate racial HP, skill-rank allocation and recorded Grant choices. `chooseRacialAbilityScore` records a named ability or clears the choice on the standard Grant or selected trait; an unchosen `ability.$choice` contributes nothing. `setRacialTraitSelected` selects or switches off an alternate/subrace without deleting its row. A subrace selection supplies only that entry's explicit replacements; it never infers a bundle. `allowedAlternateRaces` records explicit Rule Identities allowed for alternate-trait eligibility, including the half-orc/orc exception; it grants no prerequisite race equivalence and never guesses names. `setRacialTraitReplacements` records explicit local trait IDs for unresolved headers; an empty list deliberately replaces nothing, while clearing the override returns to the definition. These changes recalculate Grants and prune Accepted Warnings against the pending write in the same transaction.

`editRaceStatistics` records aggregate `racialHpGained` (a nonnegative whole number or unknown) and `racialSkillRanks` (skill-to-ranks allocation). Racial HP is never prefilled, maximized or given a favored-class bonus. The race's racial Hit Dice contribute to Hit Dice, BAB, saves and rank budgets; Class Levels alone determine level. Race changes retain the allocation and HP for restoration. The pure `CharacterSheetInput.racialHitDice` remains available for worked resolver examples, while stored sheets derive it from their selected race and its state.

The same writer accepts a fixed `racialHitDice` count and editable `racialProgression`. On the first definition change it creates a Character-scoped Catalog Copy with immediate provenance and a copy-time fingerprint, clears campaign scope and preference metadata, retains the durable Rule Identity, effective Source, sources and persisted trait dependencies, and repoints the same race Sheet Entry; recorded HP, ranks, choices and Grant Keys remain intact. Later edits update that deliberate copy, and an existing owned Character Catalog Copy made by Detach is edited in place without another copy. Shared definitions always get a Character copy, even when their sheet row carries an override. HP/rank-only writes leave the definition untouched. An absent HD count and zero mean the same thing, as do an absent progression and an explicitly cleared progression; saving either default does not create a copy. Racial rank keys must identify an available skill, and aliases such as `per` and `skill.per` cannot appear together in one allocation.

Statistics copies carry the optional top-level `racialStatisticsCopy: true` marker and stay out of both catalog and race pickers, which marks their ordinary race definition selected by Rule Identity. The sheet controller supplies authorized catalog choices to race option shaping separately from the referenced calculation snapshot, so an unreferenced shared original remains available in the picker. Other Character-local race definitions remain selectable. Selecting another definition clears the local override marker and removes unused statistics copies; inactive Sheet Entries, recorded choices/replacements and catalog dependencies, including saved condition references, retain their referenced statistics copies. Ordinary Selection removal keeps its existing soft-condition deletion behavior. Creating another statistics copy also removes unused marked copies before checking the Character-owned catalog count; referenced global and campaign definitions do not consume that limit. Statistics edits apply only the HD/progression changes to persisted race fields, preserving frozen raw dependency references while referenced global definitions remain live. Cleanup removes only marked, Character-owned statistics copies. Unmarked older copies remain because a row's `catalogOverride` does not distinguish them from ordinary detached races. Save to catalog clears the statistics marker so the resulting campaign race remains selectable and survives Character-local cleanup. Zero racial Hit Dice and an explicitly cleared progression remain valid; positive HD without progression raise the unresolved warning instead of blocking a table-valid save. `creatureTypeProgressionSeeds` supplies the thirteen pinned #253 type resources as draft defaults, never additional Catalog Entries or Class Levels; choosing a type fills editable fields without changing the count, HP or ranks. Creature type keys identify the seed separately from its editable display name.

New isolated prepared sheets seed representative Human, Elf, Dwarf, Half-Elf and Half-Orc definitions and selected examples of their traits/alternates. This is representative fixture content rather than complete race curation. Race and trait controls use the existing owner-only private-demo or shared campaign membership checks, Character-scoped references, and the legacy Character Write Gate. Production authority remains unchanged until the explicit initial cutover.

**Accepted Warnings.**
- Anyone who can edit the sheet can accept a warning as intended. No reason is asked for, which sets it apart from the militia's Rules Exception.
- An accepted warning collapses to a muted "Accepted" line, and anyone can reopen it.
- An `acceptedWarning` row is keyed by check, subject and a fingerprint of the facts that raised the warning. When those facts change, the warning reopens: accepting 22 of 20 points doesn't cover 25 of 20.
- The current and recorded-level prerequisite checks are accepted separately (`prerequisites.current`, `prerequisites.recordedLevel`). A prerequisite fingerprint covers the relevant clauses, the inputs evaluated and, at recorded level, the position evaluated, so a change to any of them reopens it, a correction to a relevant Catalog Entry included. An unrelated edit or a new Catalog Release number alone doesn't.
- Accepting never changes eligibility or any calculation and records no history. A check that passes raises no warning, accepted or not.
- Prepared sheet writers prune acceptances whose check, subject or semantic fingerprint no longer matches a current rules warning; restoring old facts cannot resurrect an obsolete acceptance. Changes to Character kind through the legacy metadata writer also reconcile these checks. Unrelated metadata leaves acceptance intact. Archiving a campaign Character changes no current warning facts and preserves applicable acceptances. Deleting a private Character removes all of its Accepted Warnings with its sheet. Deleting the subject deletes the acceptance. Blue outlines can't be accepted, because they mark unfilled fields, not broken rules.

**Settings.** The base entry holds how the Character was built, as facts of the Character rather than of a campaign:
- `abilityMethod`: point buy with a budget, or rolled with an optional retained budget;
- `traitCount`;
- `campaignTraitRequired`.

A new Character gets 15-point buy (Standard Fantasy), 2 traits and no campaign trait. Backfilled Characters get rolled.

Point-buy budgets (including retained rolled budgets) and trait counts must be whole numbers of 0 or more. These are structural constraints enforced by form validation and server writes; unusual nonnegative integers remain allowed without enforcing a standard rules budget or trait count. A hidden invalid budget draft in rolled mode is ignored in favor of the saved budget.

**What the sheet records for checks.**
- Alignment.
- Deity, as a free-text name matched to deity clauses by name.
- Each feat's `choice` and the slot it fills.
- Each dated choice's `gainedAtClassLevel` and `choiceOrder`, the editable recorded order Prerequisites at recorded level read. No eligibility snapshot or history is recorded.
- The favored classes, on the race sheet entry.
- The player's proficiency additions and removals, and each Class Level's `proficiencyChoice` (see "Proficiencies").
- Region is never recorded.
- Racial Traits, as sheet entries (see "Racial traits").
- Each item's enhancement, masterwork, material and Item Abilities (see "Weapons and armor").

**Clauses that can't be checked show nothing.** A prerequisite clause the sheet has no fact for, or that the importer couldn't parse, shows no warning and no "not checked" line. This covers region, senses such as darkvision, a clause forbidding a racial trait, and a cleric's alignment relative to the deity. The entry's prerequisite prose stays readable in its description.

### The checks

The class-and-race formulas below describe ordinary advancement. Companion checks use their own progression tables and allocation rules under "Companions", including any separately allocated BAB, saves, feats or skill ranks. A missing calculation input is visible and unresolved; the policy for uncheckable prerequisite clauses does not hide a missing statistic.

| Check | Reads | Data from |
|---|---|---|
| **Level 0:** a PC with no Class Levels | Class Levels | sheet |
| **Point buy:** a `base` score outside 7–18, or the cost over the budget; under budget shows only the "N left" counter; nothing when rolled | `base` Modifiers, `abilityMethod` | CRB cost table |
| **Hit points:** `hpGained` outside 1 to the hit die; a PC with no racial Hit Dice whose first Class Level isn't the hit die's maximum | Class Levels | class `hitDie` |
| **Ability increase:** at a Class Level where neither the character level nor the Hit Dice count is 4, 8, 12, 16 or 20; a prompt where one is due | Class Levels, racial Hit Dice | sheet |
| **Skill rank budget:** per Class Level, max(1, ranks per level + Int modifier) + each active Racial Trait's `bonusSkillRanksPerLevel` + 1 for a skill-rank favored class bonus; racial skill ranks get `skillRanksPerHitDie` + Int, at least 1, per racial Hit Die; over budget warns | the archetype's or class's ranks per level; current permanent Int | class, archetype, racial trait |
| **Rank cap:** at each Class Level position, a skill's ranks so far exceed racial Hit Dice + position; racial skill ranks are capped by racial Hit Dice | ranks per Class Level | sheet |
| **Feat slots:** feats over or under one at the first Hit Die and one at each later odd Hit Die, plus `grantsSlots` | Hit Dice, active entries | Curation Overlay (`grantsSlots`) |
| **Bonus feat type:** a feat in a bonus slot whose `featTypes` miss the slot's | feat `slot` | Foundry feat types |
| **Prerequisites at recorded level** (`prerequisites.recordedLevel`): a Selection checked against the recorded build up to its `gainedAtClassLevel` and `choiceOrder`, with current facts; a prestige class before any benefit of its first level; skipped without a usable Class Level link | recorded build up to the position | parsed `prerequisites` |
| **Prerequisites now:** the same clauses against the current sheet ("can't be used while unmet"). Both prerequisite checks skip a feat in a slot with `ignoresPrerequisites` | current sheet | parsed `prerequisites` |
| **Duplicate feat:** a second copy of a `no` feat; a second copy of a `newChoice` feat with the same `choice`, case-insensitive; never for `yes` | feat entries | `repeatable` (importer, Curation Overlay) |
| **Duplicate trait** | trait entries | sheet |
| **Favored class:** more favored classes than the favored class count (2 if an active Racial Trait sets `favoredClassCount`, else 1); a prestige class as a favored class; a favored class bonus on a level of a class that isn't favored, or on a prestige level | race entry state, Racial Traits, Class Levels | racial trait (Curation Overlay), `classKind` |
| **Traits:** more than `traitCount`, +1 for a drawback (only one drawback counts), +2 per Additional Traits; two from one `traitType` list; a race trait for a race the Character neither is nor counts as (`countsAsRaces`); no campaign trait when required; an NPC with traits but no Additional Traits | trait entries | `traitType`, `prerequisites` |
| **Class alignment:** a Class Level whose class's `alignments` exclude the current alignment | alignment | Curation Overlay, for the 9 Foundry classes; scraped prestige classes carry it as a clause |
| **Racial traits:** two alternates replacing the same standard trait (APG); an alternate for a race the Character neither is nor counts as, except a half-orc taking orc alternates (*Advanced Race Guide*, at the GM's discretion) | Racial Trait entries, race | `racialTraits`, `replaces` |
| **Archetypes:** two on one class replacing or altering the same row (one feature at one class level); an Archetype on a class the Character has no levels in; the Unchained warnings (see "Unchained Classes") | archetype entries | `replaces` |
| **Class features:** a due selection in `picksByLevel` prompts "choose a rage power"; a duplicated feature with an upgrade prompts adding it (see "Stacking") | Class Levels | Curation Overlay, scraped dataset |
| **Kept dormant entry** (`grant.kept`): a kept entry that would otherwise be dormant: its source no longer gives it, something replaces it, or its slot, prompt, race or class is gone | kept entries | sheet |
| **Spells known over the table:** more Spells recorded at a level than the Spellcasting's spells known; `known` casters only | recorded Spells, casting level | casting tables |
| **Spell too high:** a recorded Spell above the highest castable spell level of its Spellcasting (see "Derived per Spellcasting") | recorded Spells, casting level | casting tables |
| **Off-list Spell:** a recorded Spell that isn't on its class's list and isn't granted | recorded Spells | Spell `levels`, `grantedLevels` |
| **Orphaned Spell:** a recorded Spell whose casting class the Character has no Class Levels in; it shows under "Not under any Spellcasting" | recorded Spells, Class Levels | sheet |
| **Prestige advance:** an `arcane` or `divine` advance on a Spellcasting of another kind; an advance to a class the Character had no Class Levels in before the prestige class's first level ("belonged to before", see "Prestige advances"). An empty choice is a blue outline, not a warning | Class Levels | `castingAdvances`, `casting.spellKind` |
| **Opposition schools:** the specialist school chosen as an opposition school, or fewer than two opposition schools | arcane school entry | `spellcasting.school` |
| **Enhancement over +5** (`item.enhancement`): an item's state enhancement above +5. Only state counts, because *bane* and conditional items may exceed +5 in a Situation | item state | sheet |
| **Ability without enhancement** (`item.abilityWithoutEnhancement`): an Item Ability on an item with no +1 enhancement | item state | sheet |
| **Bonus equivalent over +10** (`item.bonusEquivalent`): the item's highest enhancement, active Spell Effects with `onItem` on it included, plus each Item Ability's `bonusEquivalent` ("including those from character abilities and spells", CRB; "a hard cap for all weapons", FAQ) | item state, Spell Effects | `bonusEquivalent` |
| **Duplicate Item Ability** (`item.duplicateAbility`): the same Item Ability twice on one item | item state | sheet |
| **Wrong item** (`item.appliesTo`): an Item Ability whose `appliesTo` excludes the item (a weapon ability on armor, a melee ability on a bow), or a weapon outside its `weaponDamageTypes` (*keen*) | item state | `appliesTo`, Curation Overlay |
| **Natural attacks and limbs** (`routine.limbs`): a routine whose claws, slams or tentacles outnumber its limbs not holding a weapon | routine | natural weapon `baseType` |
| **One-handed exotic** (`routine.oneHandedExotic`): a bastard sword or dwarven waraxe held in one hand without a grant naming it. Being nonproficient otherwise raises no warning | routine, proficiencies | weapon `baseType`, `proficiencies` |
| **Unsupported formula** (see "Formulas") | Modifiers | importer |

**Skill ranks follow Intelligence retroactively.** The CRB glossary says a permanent ability increase means you "modify all skills and statistics related to that ability. This might cause you to gain skill points", and drain "might cause you to lose skill points". So every Class Level's budget uses the current permanent Int modifier. The headband's fixed skill ranks are *Ultimate Equipment* rules and aren't admitted, so a headband counts as ordinary permanent Int. This budget is separate from Prerequisites at recorded level, which never change it.

**Item construction.** Decided by [Decide how enhancement and special abilities attach to weapons and armor](https://github.com/AndreasUnunger/EverythingPath/issues/236). The five item checks run per end of a double weapon and per shield bash. Flat-priced abilities (*shadow*, *glamered*) count as +0.

**Favored class.** It is chosen on the race sheet entry, once a race is set. The count comes from Racial Traits (see "Racial traits"). Unchained Class levels count as the original's. Favored class options stay a free-text note and are not checked against race and class pairs. A change of favored class after creation can't be detected and isn't checked.

### Prerequisites

Prepared implementation (#313): `calculateCharacterSheet` returns general `prerequisites` checks and `selectionRules` slot budgets and warnings. Race and Racial Trait clauses call `resolveCharacterSheetRacialFacts` and `satisfiesRacialPrerequisite` for both current and recorded-level checks, excluding dormant or replaced entries. Legacy proficiency clauses feed the same general checks; the separate `proficiencyPrerequisites` result remains available for existing consumers, without duplicate warnings. Unresolved clauses remain silent, and all supported failures stay advisory. Typed `casterLevel`, `canCast` and `castsSpell` clauses read the common resolver’s current or recorded-prefix Spellcastings. Caster level uses the highest available casting; castability reads the exact castable spell levels and casting kind. Spell possession reads active recorded and Granted Spells; whole-list casters additionally recognize spells on their castable class list. Prepared reads discover only specific `castsSpell` identities named by loaded definitions, query the Character-scoped #315 spell index with at most 64 casting-list rows per identity, and load their authorized Spell definitions through the ordinary catalog-reference reader. Browse-only and global Spell definitions need no recorded Spell row to satisfy a whole-list caster. An absent specific list definition remains unresolved rather than inventing membership; the full spell catalog is never loaded for this check. Characters with known classes and no casting have both `canCast` and `castsSpell` unmet; an Unspecified Class Level leaves both unresolved because its casting is unknown. Casting fingerprints retain relevant evaluated spell levels and specific-spell eligibility, so relevant earlier progression can reopen a continuing failure while unrelated class levels and spells preserve acceptance. Pending casting conflicts remain unresolved rather than failed prerequisites. Atom types are inferred from the shared Zod schema in `character-sheet-prerequisite-schema.ts`; Convex validators are generated from that same schema. New imports record each atom’s `kind`, while stored atoms without `kind` remain readable and derive their discriminant before exhaustive evaluation. This additive compatibility path requires no stored-data migration. Alignment clauses and class restrictions use the same nine-value alignment schema as editable Character facts.

Prerequisite warning fingerprints retain canonical counting race identities and, for a named feat with a required choice, the normalized held choices sharing that durable rule identity. A change to those evaluated facts reopens a continuing failure. Exact Racial Trait possession tracks only its required identity, so unrelated traits do not reopen acceptance. Copy remapping and unrelated metadata preserve these fingerprints. Named proficiency feat prerequisites, including resolved UUID references, become derived category or chosen-weapon proficiency checks rather than feat-possession requirements; an unrecognized category or unspecified exotic weapon remains readable, unchecked prose.

Authored Selection guidance uses `guidanceText`, separate from `prerequisiteText` and the catalog description. The prepared drawback's instruction to record narrative consequences is guidance, not a prerequisite. Saved rows, catalog candidates and previews expose all three fields independently so guidance never acquires a prerequisite label or failed check.

The importer parses each Prerequisites or Requirements line into clauses ([Find how the Foundry pf1 dataset encodes prerequisites](https://github.com/AndreasUnunger/EverythingPath/issues/214), `research/pf1-prerequisite-data`). The AoN scraper does the same for prestige classes and archetypes, and its unmatched records go to hand review. The Curation Overlay corrects misparses and adds the "counts as X for prerequisites" substitutions, which exist only in prose. Counting as another race is `countsAsRaces` (see "Racial traits").

```ts
type NormalizedPrerequisiteAtom =
  | { kind: 'ability'; ability: AbilityKey; min: number } | { kind: 'bab'; bab: number }
  | { kind: 'skillRanks'; skillRanks: SkillKey; min: number }
  | { kind: 'feat'; feat: RuleIdentity; choice?: string }                       // resolve `@UUID` first, then exact name
  | { kind: 'classFeature'; classFeature: RuleIdentity; classFeatureName?: string }       // retained authored name for original/Unchained equivalence
  | { kind: 'racialTrait'; racialTrait: RuleIdentity }                                 // resolve by name, ignoring a "(Race)" suffix
  | { kind: 'classLevel'; classLevel: RuleIdentity; min: number } | { kind: 'characterLevel'; characterLevel: number }
  | { kind: 'race'; race: RuleIdentity[] } | { kind: 'alignment'; alignment: Alignment[] } | { kind: 'deity'; deity: string }
  | { kind: 'casterLevel'; casterLevel: number }                                        // the highest caster level among the Spellcastings
  | { kind: 'canCast'; canCast: { spellLevel: number; kind?: 'arcane' | 'divine' | 'psychic' } } // "able to cast 3rd-level arcane spells"
  | { kind: 'castsSpell'; castsSpell: RuleIdentity }                                  // "able to cast dimension door"
  | { kind: 'proficiency'; proficiency: ProficiencyGrant }                              // "Martial Weapon Proficiency"; { choice: true } = "proficiency with selected weapon"
  | { kind: 'unchecked'; unchecked: string };                                         // parsed but unmodelled, or unparsed: shows nothing

// Stored/input atoms infer the same variants with an optional kind.
type PrerequisiteAtom = z.infer<typeof prerequisiteAtomSchema>;
type Prerequisite = z.infer<typeof prerequisiteSchema>; // flat "or" alternatives; codegen-safe validators
```

Clauses follow the CRB FAQ:
- Numeric clauses are inclusive.
- Catalog equality clauses retain the named rule's durable identity and already-held display facts. A Catalog Copy meets clauses naming its original even after editing; matching never loads an inaccessible original definition. The name-resolution rules above select identities when a clause is authored or imported, rather than rematching copies by their edited names.
- A feat clause needs only the feat, not that feat's own prerequisites.
- A class feature replaced by an Archetype doesn't count. Nor does a Racial Trait replaced by an alternate.
- A `race` clause is met by the Character's race or by any active entry's `countsAsRaces`.
- A same-named feature of either version of an Unchained Class counts, ignoring `(UC)`. The clause retains `classFeatureName` when authored/imported, so equivalence and readable labels do not require access to the original definition. The durable identity remains authoritative for exact possession.
- Unchained Class levels count as the original's.
- A spell-like ability meets an "able to cast" clause only when the clause names the spell. Spell-like abilities remain prose; their unmodeled clauses show nothing. Structured `castsSpell` clauses evaluate the modeled Spellcastings and are unmet for a Character with known classes and no casting.
- `canCast` is met by a Spellcasting of that `spellKind` that can cast that level (castable spell levels, see "Derived per Spellcasting"; [Decide how spellcasting fits the Character Sheet](https://github.com/AndreasUnunger/EverythingPath/issues/218), [Prototype the spellcasting section on the living sheet](https://github.com/AndreasUnunger/EverythingPath/issues/233)).
- `castsSpell` is met by a Spellcasting with that Spell recorded or granted, or, for a `none` Spellcasting, with it on its class list at a level it can cast.
- A `proficiency` clause is met by the Character's derived proficiencies, whatever grants them (see "Proficiencies"): a fighter meets "Martial Weapon Proficiency" without the feat. The importer parses a proficiency feat named as a prerequisite (Martial Weapon Proficiency, Heavy Armor Proficiency, Exotic Weapon Proficiency for an exotic weapon) and "proficiency with selected weapon" into one. `{ choice: true }` reads the entry's own `choice`, so Weapon Focus checks its chosen weapon.

**Prerequisites at recorded level.** Decided by [Decide what as-taken prerequisite checks reconstruct](https://github.com/AndreasUnunger/EverythingPath/issues/242). It amends the as-taken check of [Decide which rules checks the builder warns about](https://github.com/AndreasUnunger/EverythingPath/issues/215) and the historical-sheet reading of it in [Reconcile the sheet data model with one Character identity](https://github.com/AndreasUnunger/EverythingPath/issues/206). The check rebuilds the editable recorded build up to a choice's position, read with current facts. It never claims the Character was actually eligible when the choice was made, and no eligibility snapshot or history is stored. The current check is otherwise unchanged.

- **Position.** `gainedAtClassLevel` dates a choice, and `choiceOrder` orders the choices at one Class Level: the order added, which the player can change. A choice sees:
  - the Class Levels up to its own, each with its ordinary advancement: ability increase, class progression and automatic class features, and skill ranks;
  - choices at earlier Class Levels, and earlier choices at its own;
  - every entry without a gained level, such as items, as before.

  It doesn't see its own benefits or grants, or any later choice. What a choice brings, such as a bonus feat slot or a class feature, shares the choice's position and is never treated as undated.
  Older rows with no `choiceOrder` use their recorded row position among Selections at that level as an effective order. Rows with equal effective orders use that same row position to break ties, giving one consistent order across mixed known and unknown values. Assigning or changing a Selection's recorded level appends after the target level's highest effective order; ordinary edits preserve missing or explicit recorded orders. This fallback orders the recorded build without claiming original acquisition history. Earlier/later moves apply to active dated nongrant catalog-backed Selections with a usable recorded Class Level, across kinds. Race, items, manual adjustments, conditions and Spell Effects remain current undated facts even when a retained gained-level field is present; they never occupy order positions. Inactive rows do not count or serve as swap targets. An adjacent move saves one contiguous order for that level without changing row or level identities; a Grant moves with its source. Recorded warning fingerprints retain the clause's evaluated semantic facts rather than its ordinal position. Removing, relinking or reordering unrelated rows and normalizing sparse or tied stored values preserves acceptance; a relevant earlier change reopens a continuing failure.
- **Current facts.** Base scores, race, alignment, deity, the player's proficiency changes, active equipment, manual adjustments and effects, Temporary Effects included, and the current definitions of referenced Catalog Entries, Catalog Copies following "Catalog scopes". So a Strength item acquired at level 8 can meet a level-3 feat's Str 13, and editing a base score, the race, the alignment or a catalog definition rechecks every position. Nothing proves history.
- **Derived values** are recomputed through the common `calculateCharacterSheet` resolver from the visible prefix: BAB, base saves, skill ranks, Hit Dice, character level, caster levels and the formulas reading them. Level-linked contributions stop at the position, and current full-level totals never leak in.
- **A feat need only be possessed.** An earlier feat meets a feat clause even when its own prerequisites fail, and its failure doesn't disqualify the choices depending on it. With feats A and B each requiring the other, the first may warn and the second sees it. Accepting a warning changes no calculation.
- **Prestige classes** are checked before any benefit of their first level. Later prestige levels have no entry check.
- **No usable position.** A choice without a gained level, or whose Class Level was deleted or is unavailable, gets no recorded-level check, only the current one. Original history is never inferred. Moving or deleting Class Levels and reordering choices use the edited order, and surviving entries keep their links. An Unspecified Class Level, backfilled ones included, adds only a level and a Hit Die, never guessed class features. Clauses that can't be checked still show nothing.
- **Granted entries.** Dormant entries are invisible to both checks, and kept entries count (see "Grants and dormant entries").

The two checks have their own copy, for example "Power Attack: BAB +1 not met at level 1 as recorded" and "Power Attack: Str 13 not met now; it can't be used."

## Temporary Effects

An entry is a Temporary Effect according to its kind:

| Temporary | Permanent |
|---|---|
| `spellEffect` with `lastsOverOneDay: false` | every other kind, including Spell Effects with `lastsOverOneDay: true` and `spell` |
| `condition` | |
| `item` with `consumable: true` | |
| `abilityDamage` | `abilityDrain` |

The derived sheet applies every active entry to every statistic, HP included. Hit points from a temporary Con bonus are not temporary hit points. For ordinary single-sheet calculations, three calculations count permanent entries only:

- Militia Character Facts;
- the skill-rank budget;
- bonus spells.

This narrows "running spells" in [Decide what the militia reads from a Character Sheet, and when](https://github.com/AndreasUnunger/EverythingPath/issues/205) to Spell Effects lasting a day or less, which is the official 24-hour rule. A recorded `spell` grants no Modifiers, so it never affects these.

Permanent-only filtering follows every linked dependency: a temporary effect on an associated Character cannot enter Militia Character Facts through a Companion's derived value. Current sheet calculations still use the rule-specific inputs described under "Companions"; filtering changes which effects contribute, not which statistic a rule reads.

The prepared calculation interface is `calculateCharacterSheet(input, { permanentOnly: true })` or `calculateCharacterSheetProjections(input)`, which returns `{ current, permanent }`. Conditional `whileActive` references are rebuilt after filtering, and formulas read the filtered ability modifiers. The projections interface accepts paired `projectionInputs.current` / `.permanent` for already-resolved class and casting inputs from linked calculations; callers must propagate the corresponding projection at every link. These inputs are calculated data, never persisted. Actual Companion Relationship persistence and rule-specific linked input assembly remain with the companion tickets. Class progression assembly remains with #299; the formula resolver accepts its built-in numeric BAB and class/casting contexts rather than duplicating progression tables.

`calculateCharacterSheetProjections(input).permanent` remains the exported ordinary permanent projection for Militia Character Facts (#261). Structural advancement is assembled in the named `characterLevelInputs` step; formula rules read the resulting `options.level` and `options.hitDice`, while named class counts come from `options.classLevels`. #299 can replace that assembly with its advancement inputs without changing the formula grammar or variable rules.

The public calculator's `advancementBudgets` in `src/lib/character-sheet-advancement.ts` consumes the permanent Intelligence modifier retroactively, floors each level's base-plus-Int budget at one, then adds favored-class ranks. Racial Hit Dice supply their separate ordinary rank budget through the same `ordinarySkillRanksPerLevel` formula. This ordinary formula must not replace fixed or allocated companion budgets. `calculateBonusSpells` selects replacement casting abilities using current modifiers and alphabetical ability-name ties, then reads the selected ability's permanent score. Only available positive spell-level table entries receive bonuses (a zero-valued entry is available; `null` is unavailable); level zero and levels above nine receive none. Skill budgets are integrated into the public calculator; the bonus-spell reader remains prepared for the later Spellcasting integration, without persisted spells-known counts or casting tables.

## Two presentations

`sheetMode` controls only how a Character is presented. The sheet behind it is the same in both modes, and building out keeps every entry.

- Only a Character in a campaign with a militia can be Militia-only. A Character in no campaign is always Full.
- The mode is never shown as a label, on Characters & officers or on the sheet. A Militia-only Character has a **Build out** button, which makes it Full and opens its sheet. There is no way back to Militia-only.

- **Militia-only Character:**
  - Characters & officers shows its name, level and permanent ability totals, and edits them in place.
  - **Raising the level** appends Unspecified Class Levels.
  - **Lowering the level** removes Class Levels from the end, real ones included, after a confirmation naming them.
  - **Editing a score** changes the base score by the difference, so the total shown equals what was typed.
- **Full Character:** it is edited on its Character Sheet. Its level and ability scores are read-only in Characters & officers and link to the sheet. A campaign can have Full Characters with or without a militia. Every Character Sheet lives at `/characters/<id>` (see "Ownership and campaigns").

The roster Hit Dice override, the name, PC/NPC kind, active state and `description` stay editable in Characters & officers in both modes.

## Ownership and campaigns

Decided in [Decide how Characters exist outside a campaign, and the app's home](https://github.com/AndreasUnunger/EverythingPath/issues/212), amended by [Decide Character ownership when campaign access changes](https://github.com/AndreasUnunger/EverythingPath/issues/245); see [ADR 0002](adr/0002-characters-owned-by-users-move-between-campaigns.md).

Prepared in #260: owner-private and shared campaign Full Character creation, private access/deletion, campaign archive commands and independent `/characters/<id>` routes. Campaign and owner fields are optional in storage; ordinary private creation always records the authenticated owner. Creation and sheet writes remain limited to isolated fixtures (`campaign.e2eFixture`, or server-seeded `user.characterSheetDemo` / `character.sheetDemo` for private demos), with the migration Write Gate still enforced. Characters navigation is implemented in #297: every sheet uses its independent URL, owned Characters are grouped across accessible organizations, and campaign Characters and the militia ledger have distinct pages. #300 adds campaign ownership reassignment, protected owner/member display projections and the authoritative current-owner departure check. Legacy ownership-only edits preserve flat militia authority; prepared-sheet ownership writes retain fixture restrictions and warning reconciliation. The departure check performs no movement and must be rerun in a future move's publication transaction. Movement and external lifecycle processing remain later slices; see the implementation inventory for [Characters navigation](character-seam-inventory.md#characters-navigation-297) and [campaign ownership reassignment](character-seam-inventory.md#campaign-ownership-reassignment-300).

- **Character Owner.** The current owning user, initially the creator. Outside a campaign, only the owner can see and edit the Character. Inside a campaign, everyone with campaign access can edit it; ownership supplies authority to leave or move, not extra editing permissions. Campaign access is organization membership, with no separate campaign membership model.
- **Reassigning ownership.** Any current campaign member can transfer ownership to any current member, including themselves, without the current owner's or recipient's approval. This deliberately permits taking ownership and then leaving with the Character. The recipient must have a surviving account and current campaign access when the transfer is applied. Outside a campaign, ownership cannot be transferred.
  - **Prepared implementation (#300).** Character list and sheet responses project `{ userId, name, isMine } | null` for the authorized caller. `isActive` remains the archive state. Optional stored `ownerLastOperationId` correlates assignment feedback and does not grant access. The indexed `organizationMembership` directory is maintained transactionally and backfilled in gated bounded batches; current `user.orgIds` remains authoritative for membership and stale/deleted candidates are rechecked before display. The current-owner departure helper is reserved for #316's final write transaction, with no public departure-check endpoint.
- **Joining or moving.** The owner can move the same Character into a campaign they can currently access; it is never copied and belongs to at most one campaign.
  - It doesn't put the Character on the militia roster. That stays a "Correct roster" Militia Correction.
  - "Add to a campaign" offers the active organization's campaigns.
- **Leaving a campaign.** The owner can take a Character out, back to no campaign or into another accessible campaign. Every actual departure, including automatic departures below, applies these changes together:
  - It takes the Character off the militia roster, out of its officer roles and out of team management. This is recorded as a Militia Correction with an automatic reason, and Staged Action Choices it affects must be reviewed before Confirmation.
  - It detaches campaign homebrew while preserving the Character Sheet, under the contract in "Campaign homebrew moving with a Character" ([decision](https://github.com/AndreasUnunger/EverythingPath/issues/244)).
  - A Militia-only Character becomes Full.
- **Losing organization access.** If the owner's account survives, all their Characters in that organization's campaigns automatically return to no campaign. No action by the departed owner is required. Revoked campaign access is enforced even while preservation cleanup retries; backend completion must not require the departed user's access.
- **Deleting an account.** Its owned Characters in campaigns stay there, editable by the remaining members, and visibly need an owner. Any current member can claim them or assign them to another current member under the same reassignment rules. Its owned Characters outside campaigns are deleted. `ownerId` is absent for the retained Characters until reassignment.
- **Deleting a campaign or organization through the app.** First return every Character with a surviving owner to no campaign; ownerless Characters must be assigned before deletion can proceed.
- **An organization deleted externally.** Deletion cannot wait for assignment. Return Characters with surviving owners to no campaign; preserve ownerless Characters, inaccessible to users, for manual recovery by the app operator. This is an operational action, not a gameplay role or a right for former members to claim Characters. Preserve all sheet dependencies needed for recovery. A normal Character outside a campaign must have a surviving owner; these ownerless records are retained recovery data, not browseable private Characters.
- **Lifecycle processing.** Handlers must check current authoritative account, membership and ownership state and be safe to retry. A known deleted account follows account-deletion policy, not surviving-account membership-loss policy. A real earlier departure that already made a Character private still follows private-Character deletion if its owner later deletes their account. Preserve source data and dependencies until departure detachment or recovery completes successfully.
- **History.** Frozen Resolution Records, including superseded audit records, remain unchanged through departure or deletion. A deleted campaign's history remains available read-only to current members of its surviving organization; a deleted organization's history is inaccessible to users. Historical references never grant access to a current private Character Sheet.
- **Deleting.** The owner can delete a Character in no campaign. Inside a campaign, a Character can only be archived (`isActive: false`), as today.
- **Catalog outside a campaign.** A Character in no campaign uses the global catalog and its own character-scoped entries. "Save to catalog" needs a campaign. Character-scoped entries stay with the Character when it joins or leaves.
- **App shell:**
  - **Top-level areas.** Campaigns (filtered to the active organization) and Characters (every Character you own, across organizations, grouped "No campaign" first and then by campaign).
  - **Inside a campaign.** The top bar adds the campaign-level pages Home, Characters and Militia.
  - **Inside Militia.** A left rail holds Week N · Finished weeks · Militia · Characters & officers, plus Setup until the militia is set up. On phone, the bottom bar has fixed tabs (Campaign · Militia · Characters · More), and a strip under the top bar holds the current tab's pages. The approved layout is [Prototype the app shell with Campaigns and Characters areas](https://github.com/AndreasUnunger/EverythingPath/issues/213).
  - **Sheets.** A sheet keeps the campaign's top bar when its Character is in one, and opens with only a back button to the page it came from. Opening a Character in another organization's campaign switches the active organization.
- **Where Characters are created:**
  - the Characters area (no campaign, Full);
  - a campaign's Characters page (Full, and **Add from my characters**);
  - Characters & officers (Militia-only);
  - **Add to campaign** on a sheet in no campaign.

## Companions

Identity and lifecycle are decided by [Decide how companions fit the Character Sheet](https://github.com/AndreasUnunger/EverythingPath/issues/246). Progression and cross-sheet behavior are decided by [Decide companion progression and cross-sheet calculations](https://github.com/AndreasUnunger/EverythingPath/issues/249), informed by [companion rules and catalog coverage](https://github.com/AndreasUnunger/EverythingPath/issues/247) and [progression and combined-form research](https://github.com/AndreasUnunger/EverythingPath/issues/248). This section is the behavior contract; detailed table shapes and resolver interfaces remain implementation work.

### Coverage and identity

- Launch calculates build-time statistics for animal companions, familiars, cohorts, eidolons and unchained eidolons, including the companion-specific mechanics of in-scope classes and archetypes and their distinct progression or allocation models. Admit their companion rules as needed without adopting unrelated systems from those books. Inputs stay editable and rules checks advisory.
- Each Companion is a Character with its own Character Sheet. Linking an existing Character reuses its identity and recorded choices. Its Character Owner follows the existing rules, initially its creator, and may differ from the associated Character's owner; campaign members retain shared editing.
- Companions appear in the Characters area with their relationship identified and links between the two sheets. The relationship never grants access: do not expose an inaccessible endpoint's name, details or sheet link.
- Keep one unchanged witch spell collection on the witch's sheet. Familiar replacement neither resets it nor splits it into separate familiar collections. This is a deliberate simplification of the companion rules, not permission to delete or reinitialize recorded spells.

### Progression and cross-sheet foundations

- **Companion Progression.** A distinct advancement model supplies actual Hit Dice and progression benefits without inventing Class Levels or broadening fixed Racial Hit Dice into an advancing model. Each rule determines whether progression replaces the creature's baseline Hit Dice; never count the same Hit Dice twice. A familiar's effective Hit Dice remain distinct from its actual Hit Dice.
- **Shared budgets and choices.** Shared advancement budgets and allocations belong to the associated Character's granting features, with each contributing source identified. Species, feats, skill ranks and individual evolutions remain choices on the Companion's sheet; group purchases belong with the shared budget. Dividing effective levels and dividing separate component budgets are distinct operations, as prescribed by each rule.
- **Combined Forms.** A Synthesist's fused statistics appear as a calculated view on the summoner's sheet, linked to the eidolon's build. Preserve separate-form choices and show separate-form results where the rules provide them. Viewing a form neither declares it currently active nor tracks damage, summoning or duration.
- **Familiar hit points.** Half the associated Character's total hit points means half their calculated maximum HP, rounded down and excluding temporary HP. Ordinary HP gained from a temporary Constitution bonus contributes to the current sheet calculation. Existing plain-number HP inputs remain unchanged.
- **Monster cohorts.** Admit the published Bestiary monster cohort equivalence rules and the creature inputs needed to use them. Keep Cohort Equivalence, actual Hit Dice and Class Levels separate; use published mappings where available and an explicitly entered equivalence for an unlisted creature. This does not admit the Monsters as PCs subsystem.

### Calculation inputs and conflicting rules

- **Read the named statistic.** Each companion rule identifies its inputs and operation order. Actual Hit Dice, effective progression level, Class Levels, class-derived BAB and base saves, recorded skill ranks, calculated maximum HP and Combined Form outputs are distinct values. A rule borrowing BAB does not import the associated Character's whole sheet or every attack modifier; likewise, borrowing ranks does not borrow a finished skill total. Read only the components its text supplies.
- **Progression exceptions.** Explicit companion rules override ordinary per-Hit-Die BAB, save, feat and skill-budget derivations. In particular, separately allocated component budgets, such as a Broodmaster's, cannot be reconstructed by applying ordinary formulas to each creature's allocated Hit Dice. Apply replacements, additions, comparisons, caps and rounding in each statistic's prescribed order, without a universal replacement or stacking sequence.
- **Synthesist examples.** Fused BAB replaces only the BAB from summoner Class Levels, retaining BAB from other sources, and evolution effects use the eidolon's Hit Dice ([official FAQ](https://paizo.com/paizo/faq/v5748nruor1fz#v5748eaic9obc)). The Skilled evolution benefits the Synthesist, while a mental Ability Increase to the eidolon does not increase the summoner's mental score ([official FAQ](https://paizo.com/paizo/faq/v5748nruor1fz#v5748eaic9obb)). These specific rules do not justify importing the eidolon's entire statistics or a blanket compatibility ruling for the unchained summoner.
- **Current and permanent calculations.** Current sheet statistics use applicable current inputs. Militia Character Facts use the ordinary form and exclude Temporary Effects at every step across linked Characters. The existing retroactive permanent-Int policy remains wherever a skill budget uses Intelligence; it does not invent an Intelligence contribution to a rule-defined fixed or allocated budget. HP inputs remain plain recorded numbers, without automatic rolls, averages, maximization or prefilling.
- **Competing rules.** Apply published precedence automatically. Where applicable rules prescribe incompatible calculations without precedence, let the player choose and save the interpretation or an explicit fallback for the affected value, while retaining compatible contributions. Never choose by newest entry or discard unrelated contributions. Until the choice or fallback supplies the missing answer, that value is visibly unresolved.
- **Shrinking budgets and source loss.** Preserve recorded allocations and recalculate from those choices when a shared budget shrinks. An over-budget allocation raises an advisory warning; never trim or redistribute it automatically. Choices exclusively dependent on a vanished Grant follow the existing dormancy and Keep rules. Remove only the lost source's contribution, preserve surviving contributions and choices, and treat truly unavailable inputs as unresolved rather than inventing replacement statistics. Losing one source does not interrupt a relationship that still has rules support.

The #317 input mechanism lives in `src/lib/character-sheet-linked-inputs.ts`. Its closed named inputs distinguish Character level, Actual Hit Dice, representative familiar progression levels, Class Levels identified by class rule identity, class-derived BAB, each base save, recorded ranks for a named skill, and calculated maximum HP. Reads select the current or permanent projection and borrow only the named component. The resolver distinguishes available, unavailable and conflicting inputs, returns surviving source contributions, and applies published precedence or a saved interpretation before an explicit fallback. Disabled or no-longer-counting supporting sources are excluded from candidates. If the preferred source is lost, agreeing surviving alternatives calculate automatically; conflicting survivors require an available saved interpretation. A still-counting source with an unavailable numeric input remains a missing dependency unless published precedence or a saved interpretation resolves it. An unresolved value remains `null`.

Named input declarations, source contributions and published precedence come from [cited representative companion rules](../src/lib/catalog/representative-companion-rules.ts), following the representative catalogs' explicit coverage limits. Relationship creation, linking and source addition accept recorded support choices, never player-authored calculation bindings or contribution roles. Explicit relationship creation, linking, source addition and source enable/disable commands capture the supporting source's rule kind from its associated Class Level or Grant under associated-sheet authorization. Ordinary sheet reconciliation preserves this declaration, so hidden sheet edits cannot disclose live class changes. Authorized readers derive current rules from the associated sheet; inaccessible readers use only the stored declaration. Older sources without a stored rule kind use the generic relationship kind when hidden. Reads and all four save/clear writers use the same authorized derivation, so legacy rows that can be read can also be edited. Input declarations remain discoverable when the associated Character is inaccessible; curated input labels disclose no private sheet name, value, source label or navigation. Both sheet views read the associated Character's named components.

The representative familiar progression input combines distinct surviving wizard, sorcerer and witch class families. Witch precedence selects the governing rule without discarding compatible class contributions: witch 2 / wizard 3 / fighter 2 supplies familiar progression levels 5. Source loss removes only the corresponding contribution; duplicate supporting references do not count a class family twice. Animal-companion declarations name druid and ranger Class Levels; ranger effective-level reduction remains part of #325. These declarations and the representative familiar progression input do not implement full Companion Progression, shared-budget calculations or Combined Forms; those remain #325 work.

`calculateCharacterSheet` accepts authorized, calculated `companionLinkedInputs` in its resolve options. Current and recorded-level prerequisite checks call `evaluateCompanionLinkedInputPrerequisite` for the exact named BAB, Character level, class rule identity or canonical skill rank input. A supplied unresolved value stays unresolved rather than falling back to local statistics; unrelated clauses use the ordinary sheet facts. Duplicate declarations for one input stay unresolved, so list order never chooses a value. Resolved fallbacks and interpretations enter numeric warning fingerprints; a successful alternative satisfies an OR clause even while another branch is unresolved. Paired `projectionInputs.current` and `.permanent` accept these inputs separately to preserve transitive Temporary Effect filtering. These calculated inputs are never persisted. This prerequisite wiring works inside the calculation engine, but no production path passes `companionLinkedInputs` yet; end-to-end linked-input prerequisites arrive with Companion Progression (#325). Curated Companion Progression output bindings and full linked calculations also remain #325 work.

`characterLinkedInput` stores a fallback and interpretation per consuming Character, Companion Relationship and named input, independently of ordinary adjustments and sheet choices. The `characterSheetLinkedInputs` read and save/clear endpoints authorize the consuming sheet, verify relationship membership, and authorize the associated Character separately before exposing values or source labels. A relationship list query loads the sheets and graph once for all named input snapshots; rows share that subscription. An inaccessible associated Character yields unavailable values with no candidate or source details. A retained interpretation returns only a redacted `rule:<stored rule kind>` display token, falling back to the generic relationship kind if its source or declaration is missing. This token preserves the saved-choice and Clear affordances without exposing a private entry ID or custom source key/label; it is never used for resolution or persistence and cannot be saved while candidates are unavailable. The original interpretation remains stored and returns when access is restored. Fallbacks are signed safe integers; zero is explicit and preserved. Saved fallbacks and interpretations survive interruption and source loss. Restoration suspends the fallback without deleting it or overwriting subsequent edits. Writers use the existing legacy Character gate and sheet revision/warning-pruning path, with operation IDs for ordinary change attribution. They store no retry records or derived totals. The `characterLinkedInputOperation` table is removed from this branch. The original #317 implementation report records no deployment, and its introducing commit is present only on `impl/317` in the local refs. Remote deployment state was not inspected; the operator must confirm the table has no deployed rows before removing it from a target schema, as described in [the migration writer gate](initial-character-migration-write-gate.md).

`useCharacterSheetLinkedInput` is the client controller for one named input, using object arguments with `scope`, availability and an optional curated `classLabel`. Its form uses `react-hook-form` and `zod`, distinguishes empty and invalid fallback values, retains refused drafts, rechecks interpretation choices, disables writes during maintenance and acknowledges saves where they happen. Decimal integer text permits zero and negatives and rejects exponent or hexadecimal notation. Remote input changes leave an open draft intact; handlers and pending completions from another Character, relationship, input or projection cannot alter the new editor.

The implemented Companion Relationship rows include `character-linked-inputs.tsx`, `character-linked-input-row.tsx` and `character-linked-input-editor.tsx`. Each row names the borrowed component, shows its current value or `Unresolved`, and explains unavailable, conflicting, interpreted, published-precedence and fallback states using the view model. Curated labels preserve domain capitalization; internal rule identities and hidden endpoint details never appear. Players can save a fallback while calculation is available: the row says "Saved for when the value is unavailable". Applied fallbacks explain the missing input; suspended fallbacks remain visible and saved without adding to the calculated value. Lasting changes use ordinary personal adjustments.

Fallback editors prefill only the saved fallback and otherwise start empty. Interpretation choices include available alternatives and exclude additions, using the same predicate as the resolver and writer. The existing inline editors retain playing-card choices, keyboard selection and focus restoration, field descriptions/errors, local SaveFeedback and dismissible remote-change notices. Failed writes preserve the draft and are never automatically replayed. Maintenance disables writes while preserving readable values and drafts. Tablet landscape remains the primary layout; signed-value inputs use a mobile keyboard that permits negatives and the existing `min-h-11 md:min-h-9` touch targets. The prototype reference is `prototype-approved/character-builder:src/components/character-builder-prototype/CONTRACT.md` and `variant-b/living-sheet.tsx`, with the implemented #309 companion section providing the inline-editor precedent. Full companion calculations remain #325 work.

### Required catalog support

- Catalog definitions and curated resources must carry the source rules, progression tables, species inputs, eidolon subtypes, version-specific evolutions, familiar base-creature inputs and admitted monster cohort mappings needed by the supported builds. Keep original and unchained rules distinct where their mechanics differ. Imported templates or prose alone do not establish working automation.
- Missing rules structures and calculation inputs must be visible as unresolved values, with the saved fallback behavior below. A fallback keeps the sheet usable but does not satisfy the promised rules coverage: missing curated structures remain required work. Do not silently freeze a previous result, substitute zero or claim a build is calculated from an imported description alone.
- Existing Attribution Assessments, holds and retained-exception treatment apply to all companion definitions and resources. Admission of companion rules neither bypasses the notice gate nor turns retained held content into permission for new selections or Grants.

### Relationships and restoration

- A Companion has at most one active associated Character. An associated Character may have multiple Companions, and multiple supporting sources may contribute according to the rules. Former relationships remain inactive.
- A relationship can be active only when both Characters share a campaign, or both are private with the same Character Owner. Moving apart or losing the rules support for the relationship makes it inactive while preserving the Companion's sheet and choices. Losing one contributing source alone preserves surviving contributions and does not interrupt a still-supported relationship. Replacing a Companion also retains the former relationship and sheet.
- Automatically resume an interrupted relationship when its rules support or compatible campaign/private arrangement returns. An explicitly replaced relationship requires player reselection; restoration never displaces a newer relationship.
- Block self-links and active relationship cycles as data-integrity errors, while retaining inactive history. Automatic restoration that would create a cycle stays inactive instead of evicting another relationship.

Creating a Companion accepts a separate optional Character kind (`pc` or `npc`), defaulting to `npc`; relationship kind never dictates Character kind. Private creation inherits the associated Character’s prepared/demo marker and requires that Character’s existing prepared write access. A newly created Companion is not added to the militia roster or assigned an officer role.

Prepared relationships are stored in `companionRelationship` and discovered in both directions through `companionRelationships:list`. Each supporting source has a durable key and either an explicit recorded support flag, a Character Sheet Entry reference, or a Grant Key. Referenced support follows effective counting, including dormant entries that are Kept; Class Level references follow their active recorded level. Base scores, Ability Damage and Ability Drain cannot grant relationship support. An explicit player interruption preserves source choices and resumes only through Restore; rule-support and endpoint-arrangement interruptions resume automatically. Read DTOs report source availability independently of its recorded enabled flag.

The resolver preserves eligible active edges before considering interrupted relationships, so restoration cannot evict an active association or close a cycle. Sheet writes, ownership reassignment, archive writes and deletion reconcile stored relationship status in their transaction; reads also derive eligibility from current endpoint ownership, campaign placement and support. Archive state does not remove independent sheet access or interrupt an otherwise compatible relationship. Reconciliation attributes status transitions and changed referenced supporting-source availability to the initiating operation, including automatic side effects, without changing unrelated rows’ attribution. Replacement and support edits require access to the associated Character; activation also requires access to the Companion. Restore rechecks current supporting-source availability, access, conflicts and cycles before reporting success. A replaced relationship must be reselected before it can replace another Companion. The former Companion can remain inaccessible or deleted during replacement, and its retained endpoint is disclosed only when independently accessible. Rows with an inaccessible endpoint omit relationship status and the last operation ID. Reverse rows with an inaccessible associated Character omit supporting-source details and the interruption reason, while retaining only curated linked-input declarations so fallback editing remains reachable. Deletion retains relationship history and never deletes another Character Sheet. The indexed connected graph is bounded at 1,024 Characters and Relationships, including inactive history; exceeding either bound returns a clear error.

Campaign movement/publication writers are not present in this branch. Future writers must reconcile the changed graph in the same transaction after publishing the complete moving group. This relationship implementation does not add movement or publication endpoints, nor activate production Character Sheets or companion calculations.

### Movement and publication

- Moving a Character includes its active Companions with the same Character Owner, recursively: a Character, its cohort and that cohort's familiar move together if those conditions hold throughout. Stop at inactive links or different owners. Moving a Companion alone does not pull its associated Character along. A differently owned Companion may stay behind, with the separated relationship retained inactive.
- Apply the existing departure, homebrew-preservation and publication contract to the whole moving group. Prepare and publish every included Character's campaign transition, preserved sheet, relationship changes and departure effects together; no partial group move may become visible. Revalidate current owners, links, access and inputs at publication, reconciling concurrent changes instead of overwriting them.
- These are implementation requirements derived from grouped movement, not new departure authority. Existing automatic access revocation, deletion and recovery policies still apply. Recalculate affected Militia Character Facts coherently with the change; only changed facts invalidate their prior review, alongside the existing roster/departure review rules. Frozen Resolution Records remain unchanged.

### Interrupted calculation and militia participation

- When a relationship becomes inactive, apply any explicit rules for the remaining statistics. Where those rules are silent, associated-Character-dependent values are unresolved until explicitly adjusted; preserve independent statistics and all choices. Never silently freeze prior totals or substitute zero.
- An explicit fallback contributes while normal calculation is unavailable. Once calculation resumes, the fallback stops contributing automatically but stays saved for another interruption. Deliberate lasting changes use ordinary sheet adjustments separately.
- Militia participation is opt-in under the existing roster and officer rules. Creating a Companion does not add it to the roster or assign an officer role.
- Militia Character Facts read each Character's ordinary permanent statistics. Viewing a Synthesist's fused form never changes the summoner's or eidolon's militia contribution; deliberate table rulings use the existing adjustments. Permanent-only filtering applies transitively to linked dependencies.
- The militia reads actual Hit Dice, including Companion Progression where applicable, never a familiar's effective-HD substitution, an effective progression level or Cohort Equivalence. The roster Hit Dice override still replaces that value, including an override of zero. Applying actual Hit Dice to a familiar serving as an Officer is the product's chosen reading; the militia corpus does not definitively resolve that interaction.
- An unresolved value actually required to calculate the militia week must be supplied before Weekly Confirmation. Keep the Companion on the roster and allow editing; unrelated unresolved statistics do not block confirmation. Do not omit a required contribution, use zero or reuse stale values.

## Catalog scopes

Catalog Copy preparation (#308): `convex/catalogCopies.ts` exposes `createOneOff`, `editDefinition`, `saveToCatalog`, `customizeForCampaign` and `detach`, plus read-only `list` and access-filtered `advisories` queries. The additive `catalogEntry` schema supports global, campaign and Character scopes with optional scope references, immediate `copiedFrom` provenance and a copy-time `copiedFromFingerprint`; scope lookups use `by_scope`, `by_campaignId_and_scope` and `by_characterId`. Prepared writes retain the existing private-demo/fixture restrictions, current-owner or campaign-membership authorization, and the legacy Character maintenance/epoch/authority gate. Copies keep durable rule identity and effective Source while their editable definitions remain independent. Only Customize for campaign sets the optional `campaignPreference` marker that replaces its global origin in pickers and projects global parents for future Grants. Save to catalog rescopes and shares homebrew without replacing original definitions or changing other sheets; Detach removes this marker. Provenance alone never selects a preference; customization records the chosen campaign copy on affected current Grants, including dormant state, without creating Selections or rewriting copied parents’ frozen global references. Later parent customization keeps those choices. Copies capture their persisted origin’s fields and fingerprint, and uncustomized global dependencies remain live; an advisory compares the accessible origin with its copy-time fingerprint without updating the copy. This prepares local definitions and copy operations; production sheet activation and campaign-departure dependency closure remain separate work.

The Catalog controller selects existing definitions through `characterSheet.selectEntry`, with acknowledgement beside the selected definition and a created-row focus target. Only selectable kinds are offered; Classes use the Class Level workflow. New Selections resolve an explicit campaign preference even when an in-flight picker submits its previous global ID, while choices, notes and active state remain player input. Existing Selections and explicit Character copies retain their own definition references. Class Level rows expose their class definition for Customize and Detach; detaching a Class retains the Character's Class Level state and repoints its class references, including favored-class settings. A Spell Effect's recorded caster level has a separate state-only form and writer adapter: it sends only caster level and optional active state, without resubmitting or validating shared definition fields. The full definition editor remains the path for one-off creation and Character-specific definition changes. These controllers prepare the remaining picker, Class Level controls and shared Spell Effect state presentation for the UI handoff.

- **Global:** the imported catalog, read-only for players. See "Global catalog import".
- **Campaign:** homebrew that anyone in the campaign can use and edit.
- **Character:** one-offs on a single Character, such as base scores, manual adjustments and tweaks.

Adding a one-off inserts its character-scoped Catalog Entry and its sheet entry in one mutation. "Save to catalog" rescopes a character entry to the campaign. "Detach" clones a global or campaign entry into a character-scoped one and repoints the sheet entry. "Customize for campaign" clones a global entry into campaign scope, repoints every sheet entry in that campaign, and makes the picker show the copy in place of the original for that campaign. A Grant keeps its Grant Key through either clone, so its recorded state stays (see "Grants and dormant entries").

Both clones record their immediate origin as `copiedFrom` and that definition's fingerprint at copy time, separately from the durable transitive `ruleIdentity` and effective Source they inherit. A copy's own fields never follow later changes to its original. Its retained references to global Catalog Entries follow the active Catalog Release: a copied magic weapon can still change when its global Base Item or Item Ability changes. These editing actions do not recursively freeze dependencies, and references to local entries keep their existing behavior; campaign departure preserves campaign dependencies as described below.

The upstream-change advisory compares the immediate origin's current definition fingerprint with the one recorded at copy time, only while the viewer can access that origin. An unrelated release does not warn. Neither provenance nor equality identity requires the original's current definition; references used to compute, grant or offer content are definition dependencies.

Prepared #308 verifies same-Source stacking and retained Grant Keys after the original becomes inaccessible. The #313 prerequisite engine compares copies' retained durable rule identities without loading their originals. Public calculation tests cover remapped feat possession, racial identities and retained Unchained feature names, preserving prerequisite results when a copied definition remains available and its original does not.

The definition editor reads persisted catalog fields rather than references projected for sheet calculation. Definition editing is unavailable while the raw catalog read is loading or omits the definition; projected sheet fields alone never grant edit permission. It sends only its editable name and Modifiers; the server preserves unedited definition fields and existing curated `stacksWithinEntry` exceptions through value edits and reordering. It matches unchanged Modifier facts first, then pairs remaining value edits by target, bonus type and condition. Each existing exception can be retained once; adding a duplicate Modifier does not create another exception. Clients cannot introduce that exception through one-off creation or editing.

Scope validation remains compatible with existing optional `characterId` and `campaignId` fields. Tightening the catalog schema into a scope-discriminated union requires auditing retained prepared/migration rows first; no deployed-row evidence is available for #308. The single `writeCatalogDefinition` helper instead validates the complete definition, scope and required references before inserting or patching Catalog Copy definitions. An additive index on campaign, scope, immediate origin and Campaign Catalog Preference supports bounded preferred-copy lookup without changing stored row shapes. The persisted `campaignPreference` field represents the glossary's Campaign Catalog Preference.

The general prepared catalog picker currently reads at most 4,096 definitions from each accessible scope and returns at most 8,192 definitions, prioritizing Character, campaign and then global definitions, with no pagination interface. This is a prepared-fixture limit, not evidence of complete large-catalog browsing. The separate #315 Spell browser uses bounded indexed pagination and summaries rather than this picker or full-catalog reads. Sheet reads separately load their referenced definitions and applicable Campaign Catalog Preferences; unrelated global or campaign rows do not consume the Character child-row limit. Large-catalog pagination for the general picker remains follow-up work before production activation.

### Campaign homebrew moving with a Character

Decided by [Decide how campaign homebrew moves with a Character](https://github.com/AndreasUnunger/EverythingPath/issues/244). This supplies the homebrew preservation mechanics for "Ownership and campaigns" and amends the retained-exception copying restriction under "Global catalog import"; ownership, departure authority and deletion policy remain unchanged.

- **Departure scope.** Campaign homebrew needed by the Character is copied into character scope. A carried homebrew class preserves its complete progression, future features, available talent choices and full spell list, including options never selected, together with their campaign dependencies. Unrelated campaign content stays behind. References to global Catalog Entries keep following the active Catalog Release; attribution holds still limit which content can be selected or granted.
- **Arrival and return.** Joining another campaign or returning to the original campaign keeps carried definitions until someone explicitly replaces them, even when that campaign has a different version. The destination's catalog preferences apply to future selections; joining alone never replaces existing choices or adds a militia roster assignment.
- **One class version.** All Class Levels of one class use one chosen definition. Adding another level continues it, regardless of the destination's catalog preference. Selecting a different copy is an explicit switch of the whole class, preserving all Class Level row IDs, order, HP, skill ranks, choices, favored-class state and casting-advance links. Matching Grants retain their state; removed Grants and displaced choices go dormant, and switching back restores them under "Grants and dormant entries". A switch may change calculated results because the chosen definition changes. The existing original-versus-Unchained policy is unchanged and is not the policy for Catalog Copies.
- **Rule identity.** A Catalog Copy retains the original rule identity for prerequisites, Grant Keys and same-Source stacking through edits. Creating a distinct Catalog Entry represents a distinct rule. Different copies keep their own definitions and saved state; sharing rule identity does not merge them. Durable identity and effective Source are retained directly, without privileged traversal of original definitions. Immediate copy provenance and its copy-time fingerprint are separate and never confer access.
- **Original-change advisories.** Check for changes only when the person viewing the Character Sheet can access the immediate origin. Without access, reveal no information about later changes. If access returns, compare its current definition with the definition recorded at copy time. Never update the copy automatically.
- **Held content.** A necessary departure copy or reference remapping may preserve the same Character's already-retained use of attribution-held content. It carries the hold, retained-exception reporting and notice requirements with it. This grants no new selection or Grant entitlement, admits no held revision and does not make future features or options available while held; the complete future homebrew repertoire remains subject to those holds. The exception permits lifecycle preservation only, not ordinary new copies.

**Dependency and identity invariants.**

- Start from all retained Character state, not only currently active entries: active, off, kept and dormant entries, orphaned Spells, saved Grant state, slots and Accepted Warnings, Class Levels, casting, Attack Routines and item magic state. Also include that Character's existing character-scoped definitions, so unused local customizations remain theirs. Preserve the Character ID, sheet and Class Level row IDs, their ordering and state links. A move neither repairs pre-existing broken Class Level links nor turns Grants into new Selections.
- Follow definition dependencies transitively, including catalog IDs and key-based joins. Include full class progression, future prompt options and whole-class spell lists even when they have no sheet rows, granted-spell lists, Base Items, Item Abilities, Archetype replacements and Racial Traits. Campaign members of a required keyed list remain dependencies even when the class definition is global. A reference used to compute, grant or offer content is a definition dependency regardless of how it is encoded.
- Copy required campaign definitions; reuse global identities, which continue following the active Catalog Release. Reuse existing character-scoped definitions only when they belong to this Character, remapping campaign dependencies inside them without overwriting their custom fields. Do not traverse `copiedFrom` or identity-only prerequisite and equality links as content dependencies: preserve their durable equality identity and already-held display facts without loading an inaccessible original payload.
- Deduplicate only repeated references to the same source definition within the move. Preserve divergent copies and existing customized character copies separately; a shared ancestor, rule identity or name does not justify coalescing definitions. Allocate the mapping before following dependent edges so cycles terminate and shared dependencies get one destination definition.
- Apply one consistent mapping to typed catalog references and scoped class, list and formula keys, including Grant definition sources, Archetype and Racial Trait replacement targets, and slot links. Durable identities inside Grant Keys remain unchanged. Keep casting-advance and recorded-Spell links attached to the chosen class definition, and sheet-to-sheet links attached to the same rows. Preserve each copy's effective Source and canonical rule identity; remapping must never require access to its ancestors.
- Copying and remapping alone change no totals, Grants, stacking, prerequisite results, saved state or Accepted Warning acceptance. Warning fingerprints use semantic facts and durable identities, so new storage references do not reopen them. Independent edits, an explicit class-version switch or a Catalog Release can change underlying facts and use the ordinary recalculation and warning rules.

**Preparation and publication.**

- Prepare privately in bounded, resumable work. Staged copies and remaps never appear in pickers or partially redirect the live sheet. Preserve source definitions and dependencies until detachment or retained recovery finishes safely. Retrying the same move reuses its work and creates no duplicate definitions, rows or departure effects; after a lost response, inspect the committed operation before retrying.
- Track the inputs used for preparation, including the sheet, all source campaign and character definitions, ownership, authoritative account and membership state, relationships and the active Catalog Release. Relevant writes mark pending work dirty under the protocol in "Catalog releases". A move also participates in any pending release's dirty-work tracking. Reconcile intervening edits or release changes against current state; never restore a prepared snapshot over later player changes.
- At the final bounded transaction, verify current authority, destination access for a requested move, current input revisions and the active release, and that all preparation and reconciliation is complete. Publish the complete sheet-reference selection, campaign transition, Militia-only-to-Full change, departure Militia Correction, roster/officer/team-manager removals and affected Staged Action Choice review flags together. Staged data selected through pointers may keep this bounded, but every reader and writer must observe one complete selection. Militia Character Facts and any release work stay consistent with that same publication boundary.
- A failed voluntary move leaves the pre-move sheet, roster and campaign relationship unchanged. Automatic access loss revokes access immediately while preservation work retries; trusted system completion does not require the departed user's credentials. Recheck current ownership and authoritative lifecycle state before publishing, so stale work cannot undo reassignment, membership changes or account-deletion policy. Frozen Resolution Records, including superseded records, remain unchanged, and the existing deletion and ownerless-recovery rules still apply.

## Global catalog import

Decided by [Decide how the content dataset becomes the global catalog](https://github.com/AndreasUnunger/EverythingPath/issues/207). The dataset is the Foundry VTT pf1 system packs plus `pf1-content` ([Choose the PF1 content dataset for the builder catalog](https://github.com/AndreasUnunger/EverythingPath/issues/202)).

- **Content.** These packs are imported:
  - races, classes and class abilities;
  - feats, traits and racial traits, without the 240 *Advanced Race Guide* race builder records (see "Racial traits"; `racePoints` is unmapped);
  - every item pack: mundane, magic, wondrous, artifacts, armor and weapons, with specific magic weapons and armor built on a Base Item (see "Specific magic items");
  - pf1-content's `pf-special-qualities`, as `itemAbility` entries, without its one template item (see "Item Abilities");
  - buffs;
  - spells, as `spell` entries keyed `pf1/<_id>`;
  - the 13 `racial-hd` records, as the creature-type seed table rather than as Catalog Entries;
  - from `monster-abilities`, only the 12 generic natural attacks and the unarmed strike (see "Attacks").
  - companion source resources from system `companion-features` and pf1-content `pf-companions`, `pf-familiars`, `pf-companion-features`, `pf-eidolon-forms` and `pf-eidolon-evolutions` (see "Companions"). Actor-owned embedded records remain attached to their resource rather than becoming independent global identities. General monster/template sources may contain companion dependencies; they remain unassigned until a reviewed per-record inventory settles them.

  Goods and services, third-party packs and 3.5 packs are not imported.
- **Buffs.** A spell buff becomes a `spellEffect` entry, with `lastsOverOneDay` taken from its duration and `defaultCasterLevel` from its `level`. Its `spellKey` comes from its first `Compendium.pf1.spells` link in either `@UUID` or `@Compendium` syntax when the names agree after removing parenthetical variant suffixes and normalizing comma inversion (178 of 185 at the pinned versions). Otherwise the import report proposes one and the Curation Overlay decides. Class and item buffs become their own kinds.
- **Spells.** ([Compare the spell data sources for spellcasting](https://github.com/AndreasUnunger/EverythingPath/issues/217), `research/pf1-spell-data`.)
  - `levels` come only from `learnedAt.class`, joined to class entries by `system.tag`. `grantedLevels` come from the rest of `learnedAt`.
  - The description's `@UUID` links are rewritten to catalog links or stripped.
  - The 186 class and level pairs where the retired spell sheet disagrees with Foundry go to the import report. A Curation Overlay correction is written only where a mistake matters.
  - A class's `casting` comes from its `system.casting`, renaming `spells` to `spellKind` and `offset` to `casterLevelOffset`, completed by the casting tables file (see "Spellcasting").
  - Spells join the book set, so their sources need Section 15 Registry records like any entry.
- **Rows.** Global entries keep stable `catalogEntry` identities and immutable definition bodies for each Catalog Release. Readers assemble the logical shape above for the active release, including description and `sources`, so the resolver receives the same shape for every scope. Staged bodies never overwrite live ones.
- **Curation overlay.** This is a reviewed file in the repo, keyed by `externalKey`. Each record cites the official text it relies on. The importer applies it on every import. It can:
  - add or replace Modifiers, for prose-only entries such as most feats;
  - set `sourceKey` and `stacksWithItself`, and mark Modifiers `stacksWithinEntry`;
  - set Racial Trait `replaces`, `countsAsRaces` and `favoredClassCount`, and move race-record Modifiers onto traits (see "Racial traits");
  - turn every situational note (Foundry `contextNotes`) and action conditional into Situational Modifiers and situational notes, with a gate that fails the import on any note without a record (see "Situational notes");
  - define the CRB conditions, written from `docs/ai/pf1-core-rules/` because the dataset has no conditions pack;
  - mark Routine Options, and set natural attack types and a double weapon's second end (see "Attacks");
  - write Point-Blank Shot's `within30ft` Modifiers and *keen edge*'s `doublesThreat` (see "Attacks");
  - fix proficiency names, resolve class proficiency strings, and write weapon familiarity and class-feature grants (see "Proficiencies");
  - draft and check each Item Ability's dice, Modifiers, notes and `weaponDamageTypes`, under the note gate (see "Item Abilities");
  - settle a specific item's Base Item, check its `magic` defaults, and write its conditional enhancement (see "Specific magic items");
  - exclude an entry, giving the reason (see "Notice gate").

  Generally useful fixes may also be contributed upstream to Foundry, and the overlay record is then deleted.
- **Mapping.** Foundry targets map onto the closed target list, and formulas are parsed into the closed grammar. A weapon's `weapon` detail comes from its `baseTypes`, `weaponGroups`, `weaponSubtype` and `held`, and from the first action's `damage.parts` (the dice inside `sizeRoll(n, s, @size)`, and the damage types), `ability.critRange`/`critMult` and `range`. `finesse` comes from `properties.fin`, `thrown` from a `twak` action, and `proficiency` from `system.subType` or the forced `proficient` flag. A shield's `weapon` detail comes from its Bash action. `weaponProf` and `armorProf` become `proficiencies` (see "Proficiencies"). The `armor` detail comes from `system.armor.value`, `armor.dex`, `armor.acp`, `system.spellFailure` and `system.equipmentSubtype`. A magic armor's enhancement is read from `armor.enh`, falling back to `system.enh`, where 159 of the 228 keep it and Foundry's own AC code ignores it. Omitted defaults are filled in. Anything unmappable is stored on the entry, flagged in `unsupported`, contributes nothing and shows a warning.
- **Initial extraction.** The local [catalog preview](catalog-import/README.md) produces deterministic JSON entries/resources, unsupported-content and upstream-inventory reports without deploying or publishing. Its partial preview DTO and scope-admitted counts are separate from release admission: all attribution, notice, note, structure and feature-completeness gates remain required. The committed representative artifacts and [observed pinned inventory](catalog-import/pinned-preview.json) expose gaps rather than claiming completed curation.
- **Pipeline.**
  - The repo pins a release tag of each upstream repo, never an unreleased commit ([Decide which Foundry pf1 release the catalog import pins](https://github.com/AndreasUnunger/EverythingPath/issues/223)). The pins are system `v11.11` and pf1-content `11.4.0`. Both repos must share a major version, and the import fails if they don't.
  - The importer maps one upstream shape, the v11 one, in which class skills are a boolean map, class features are listed in `links.classAssociations`, skill targets use three-letter keys such as `skill.per`, and `system.changes` is an array. Pack files are read recursively from a checkout of the tag, so Foundry itself never runs.
  - The owner bumps a pin by hand within the major. The next major waits until both repos have released it, and then moves both together as a separate effort that replaces the mapper.
  - Fixes on upstream master that aren't released yet are not backported. A Curation Overlay correction is written only for a mistake that matters, and a bump's import report flags it once upstream has the fix.
  - The owner manually increments the Catalog Release number to trigger an import. Input fingerprints guard against a forgotten bump; neither a pin change nor another input change releases content automatically. See "Catalog releases" below.
  - Every release PR carries a committed import report: counts per pack, additions, edits, retirements and remaps, affected resources, unsupported changes, overlay records that no longer apply, note records by status, attribution holds, dependent omissions and retained exceptions (see "Notice gate"), and gate results.
- **Updates.** An import finds stable identities by `externalKey` and reviewed remaps, then prepares release-specific bodies. Sheet references and stacking identity stay stable. A removed entry retains a usable definition and becomes `retired`, hidden from ordinary pickers and never deleted.
- **Keys.**
  - Upstream keeps a record's `_id` through edits, renames and pack moves, while pack names change ([Check whether Foundry pf1 record IDs stay stable across releases](https://github.com/AndreasUnunger/EverythingPath/issues/211), `research/pf1-foundry-id-stability`). That is why the key leaves out the pack.
  - The Curation Overlay holds a reviewed remap list for the cases that would otherwise break the key: records that move between the two repos, upstream merges, and the rare record re-created with a new `_id`.
  - Upstream's own redirect tables are not trusted.
- **Batches.** The recorded import prepares a private candidate in idempotent, resumable batches. Definitions, references, remaps, supporting resources, legal output and affected Militia Character Facts become current together through the publication protocol below; completing import batches alone does not publish anything.
- **Legal page.** Decided by [Find the Section 15 text for every imported source book](https://github.com/AndreasUnunger/EverythingPath/issues/224) and [Decide how the import keeps its Section 15 notices complete](https://github.com/AndreasUnunger/EverythingPath/issues/227), as amended by [Decide how unproven content attribution affects import](https://github.com/AndreasUnunger/EverythingPath/issues/241). That decision is the product's import policy, not a conclusion that the notices are legally sufficient. The import generates an in-app legal page, linked from every page's footer. Its parts, in order:
  - the OGL 1.0a text;
  - a Section 15 of the OGL and SRD lines, both upstream `OGL.txt` notices verbatim, the Section 15 Registry notices required by every admitted definition, all available reviewed notices required by retained content, the permanent superset of previously shipped notices, and the owner-authorized `Keepnet © 2026 Andreas Ununger` copyright notice;
  - the owner-approved Section 8 statement (2026-10-03), identifying only reproduced contributor-designated Pathfinder rules, mechanics and rules text as Open Game Content; no other Keepnet content is Open Game Content;
  - the Paizo Community Use notice.

  The Section 15 Registry is a reviewed file in the repo beside the Curation Overlay, keyed by product code. Each record holds `title`, `notice` (the book's own Section 15 lines verbatim, inherited third-party lines included, the OGL and SRD lines left out), `checkedAgainst` (`printed`, `prd`, `aon` or `pf1-content` for reviewed notices), `checkedOn` and optional `aliases` for broken upstream codes. Unreviewed seeds record their source and remain insufficient for admission. Required unreviewed notices show `Notice review pending`, withholding their unverified text from newly supplied notices. A retained exception whose notice is missing stays outstanding in the release report, and the page never implies that notice has been supplied. Previously shipped notice versions remain in the permanent superset.
- **Attribution Assessments.** Every imported definition has one, bound to its stable identity and to the content and evidence reviewed, so a later change cannot reuse an obsolete one. It is one of:
  - *confirmed attribution*: evidence names the book or books for all of the imported content;
  - *reviewed notice coverage*: the exact book is uncertain, but a recorded content comparison bounds the possible origins of the whole entry, linked content included, and ties each to a shipped notice;
  - *unresolved*: neither holds, as for an unmatched entry, an unreviewed name match, or an ambiguous match with origins not accounted for.

  The committed evidence keeps links or snapshots, the comparison and its rationale, the reviewer and review date, the possible or confirmed books and their registry records. A same-name match, a broad collection of notices or the presence of a related book is not enough. Evidence never becomes entry `sources`.
- **Book set.** It is every book required by the accepted assessments of admitted content, every code cited by an admitted entry, every book of an admitted AoN-scraped record, and the books of retained content (see "Retained exceptions"). It only grows. A notice an earlier release shipped stays when its content is held or retired; that preserves an existing notice and never stands in for one the registry lacks. A declared retained exception whose notice is missing keeps it as an outstanding requirement until review supplies it. A book required only by held content that was never admitted is left out, so its missing notice blocks no unrelated release.
- **Notice gate.** An entry is admitted for new selection only with a current accepted assessment (confirmed attribution or reviewed notice coverage) and every notice it requires; knowing the book alone is not enough. Any other entry is held: omitted from new admission and listed in the import report with its identity, reason and missing evidence or notices. Upstream holds are Curation Overlay exclusion records, and holds in the AoN-scraped dataset are recorded there. A held entry returns with its stable identity in a later Catalog Release once review accepts its assessment and the notices exist.
  - An accepted assessment whose content, identity mapping, evidence or notice bindings no longer match is reopened and held for re-review. Missing, blank or revoked evidence, missing or unreviewed required notices, absent notice bindings and unidentified source notices likewise hold that candidate individually, with the review gap and associated evidence IDs or missing notices reported. A stale assessment never admits content and does not fail unrelated admission. Explicit and unresolved holds retain their reasons.
  - Holds never fail a release, so the rest of the catalog ships. The check covers the complete candidate, not just a list of identified books, and fails the release on a candidate record not accounted for as admitted, held or a reported retained exception; a stale assessment used to admit content; an admitted definition missing a required notice; or an unreported retained exception. A missing notice is reported, not failed, only on held content and on declared retained exceptions of previously admitted content.
  - Structure and reference gates still apply. A held feature that keeps a class, archetype or other entry from being complete holds that entry too, as a reported dependent omission, never a silently incomplete definition or broken reference.
  - Held now, until their evidence and notice gaps are resolved: the Dynamite comics, *Pathfinder Online: Thornkeep*, *PFS Scenario #4-12*, *Horror Realms* and *Shattered Star #4*.
- **Every release.** The attribution check runs on every Catalog Release, local corrections, notice-only releases and rollbacks included, not only on a pin bump. An assessment is reused while its content, identity mapping, evidence and notices are unchanged, and reopens when any of them changes, whether through upstream, the Curation Overlay, the local dataset or the importer. A correction to shared evidence or a notice rechecks every assessment relying on it. New or changed content without valid evidence is held.
- **Retained exceptions.** When an earlier assessment proves wrong, the affected content stops being offered for new selection, but existing Character Sheets keep their usable definitions, references, choices and edits, and existing Catalog Copies stay intact. Copied fields are never overwritten to repair attribution, and retiring or hiding an entry doesn't make what it still serves covered.
  - Each such definition, retired and copied content included, is a retained exception in the release report until review corrects its evidence or notices. Restoring selection takes a checked Catalog Release.
  - Retention covers existing uses only: no new selection, copy or grant, except necessary lifecycle copies and remapping that preserve the same Character's already-retained use on departure ("Campaign homebrew moving with a Character", [decision](https://github.com/AndreasUnunger/EverythingPath/issues/244)). Those copies retain their hold, reporting and notice requirements; they confer no new selection or Grant entitlement. A held revision never replaces the definition kept for existing sheets, and future homebrew features and options remain subject to holds.
  - A release may publish with retained exceptions, but its completeness claim covers only content with accepted assessments and required notices, and names the exceptions as excluded. Nothing on a sheet and no Resolution Record is deleted automatically.
- **Sources.** `sources` serve the licence only. An entry shows its source where it has one, there is no book filtering, and unsourced records stay unsourced.
- **Notice review.** Before launch, every book the admitted launch set requires has a registry record and every disagreement between seed sources is settled against the book. The known errors are fixed: *Ultimate Combat*'s authors and AoN's *Occult Mysteries* block. The free-PDF gaps and the owner's copies of *Goblins of Golarion*, *Faiths of Purity* and *Bestiary 6* are transcribed. All other records ship checked against `prd`, `aon` or `pf1-content`, and printed checks continue after launch, most-cited first.

The base scores are one character-scoped `base` entry with six `base` Modifiers. Every Character has exactly one sheet entry for it, which cannot be removed or deactivated.

### Catalog releases

Decided by [Decide how catalog revisions are detected and activated](https://github.com/AndreasUnunger/EverythingPath/issues/239). This replaces pin-only detection, in-place global updates and the end-of-import facts recalculation from [Decide how the content dataset becomes the global catalog](https://github.com/AndreasUnunger/EverythingPath/issues/207).

The #310 preparation interface is private `catalogRelease:begin`, `writeBatch`, `finalize`, `inspect`, `inspectRows` and `readiness`. `catalogRelease` stores the immutable manifest, comparison base number/artifact identity, progress counters and preparation state; `catalogReleaseRow` stores candidate definitions, supporting resources, reviewed remaps, five report categories and the legal inputs. A manifest binds every ordered batch's SHA-256 fingerprint, row count and byte count. Each transaction accepts at most 100 rows and 512,000 canonical JSON bytes; manifests contain at most 1,024 batch commitments and 131,072 bytes. Finalization certifies complete committed batches, passing report summaries and validated legal input structure, without rereading the whole artifact. Missing inputs or changed content under an existing number fail. Changed artifacts require a new number; the newest preparation fences older workers. Read-only inspection remains available for their audit trail.

`catalogReleaseControl` is the future atomic selection boundary; this ticket provides no writer for it. Before that boundary exists, production retains legacy Character authority, prepared fixture sheets keep their existing local Catalog Entries, and the public legal query returns null so the frontend selects committed page inputs. The frontend also retains those defaults when the backend legal query is unavailable. Candidates never enter `catalogEntry`, redirect a sheet reference, publish legal inputs or update Militia Character Facts. All three preparation writers use the general/operator Write Gate class: they remain allowed under sheet authority without freezing ordinary gameplay, while legacy Character writers remain fenced. Closing the gate blocks every gated writer, and both classes reject stale epochs.

#318 adds private `catalogReleaseImpact:start`, `discover`, `evaluate`, `complete`, `status`, `inspectWork`, `retry`, `retryDiscovery`, `finish`, `abandon` and `cleanup`. A singleton `catalogImpactControl` registers one run before discovery; `catalogImpactRun` records bounded enumeration progress and lifecycle state. Operators derive pending/failed counts from per-Character work instead of making every edit patch a shared run row. `catalogImpactChange` and `catalogImpactEdge` retain old/new keyed relationships; `catalogImpactWork` stores one revision-fenced facts result per Character. Supported imported class-feature relationships name stable `externalKey` identities, resolved to existing global Catalog Entry IDs, while retained local Grants keep their Catalog Entry references. Imported definitions do not declare arbitrary Grant bodies, and staging never creates player-facing definitions.

Ordinary sheet writes, including initialization and archive, mark candidate work in the shared canonical Character update before any campaign/militia early return. Deletion uses the same hook before removing the Character. Active facts are still updated transactionally through the existing calculation; this hook never evaluates candidates or patches shared run counters. Missing or inactive registration is a no-op for gameplay. Discovery uses batches of at most 4 definitions, 32 prepared Characters or 8 reverse Spell-index rows; only referenced local definitions participate, so unused customizations do not block readiness. The operator can reconcile bounded representative sheets through `catalog:release reconcile`, with workers recalculating current inputs and validating their revision and input/result fingerprints before completing work. Status pages count at most 1,024 dirty/failed work rows and 1 MiB per state, flagging incomplete counts with `hasTruncatedCounts`. `finish` seals ready evidence and clears the control registration; later edits require a fresh run. Abandonment also clears registration; ready runs cannot be abandoned. Preparing a newer candidate supersedes active tracking and clears registration. Status and `finish` validate the current preparation and comparison base even for retained ready evidence. Resumable cleanup throws for a still-current active run, removes at most 32 child rows per call, then the empty obsolete run, while retaining the latest ready run and its evidence per Catalog Release. Candidate errors leave active edits available. No general sheet totals are stored; impacted casting-resource evaluations return transient slot evidence so operators/tests can verify that the candidate used its resource rows. Seed catalog resources never reapply recorded defaults. See [the reconciliation runbook](catalog-import/releases.md#reconcile-candidate-character-facts) for limits and unsupported candidate reporting. Complete moves and linked-companion dependency tracking remain the later ticket 76; atomic activation remains #327.

Prepared-sheet orchestration calls `requireCompatibleActiveRelease` and passes the selected identity into `calculateActiveCharacterSheet`. The calculation fingerprint covers the implementation closure, shared dispatch and reviewed defaults. #318 supports exactly the prior default-only identity and the current resource-aware identity. The prior adapter identifies the default calculator at the rebased dependency head, including Attack Routine, Spell collection, #317 linked inputs and #319 Grant Key parser work, omits supplied resources and relies on independently pinned, unchanged bundled behavior; it is not a general historical-calculator retention mechanism. Future changes to shared calculation behavior or bundled defaults require a separately retained implementation before activation. Unsupported active identities fail closed. Before the first Catalog Release activation, the identity is provisional: reviewed changes update the pin, independent test expectation and current recorded examples together under the [release preparation procedure](catalog-import/releases.md), without rewriting historical immutable artifacts. The shared Grant Key parser extraction follows that procedure and preserves ancestor matching while retaining the stricter complete-key migration checks. A resolver-only candidate compares the coherent base manifest's identity with its required identity and reconciles all sheets from current inputs. Publication still must select matching definitions, resources, facts, runtime and client preview behavior together; this ticket performs no activation.

- **Release identity.** Each manually incremented number binds an immutable manifest and generated artifact. The release check fails if declared inputs change without a bump, or a number is reused for different inputs or output. Unchanged inputs and number are a no-op or resume that unfinished run. The manifest fingerprints the upstream tags and their resolved content; the Curation Overlay, remaps, exclusions and note records; local content; output-affecting mapping, parsing, sanitizing and configuration; casting, creature-type and other rule resources; attribution evidence, Attribution Assessments and holds, the Section 15 Registry and legal-page resources. The parsers fingerprint includes `src/lib/character-sheet.ts` because its shared schemas validate and shape imported definitions; an edit requires a new release number even if normalized output stays equal. Unrelated application code is excluded. Compare deterministic normalized output to identify actual definition and resource changes; a notice-only release need not affect any Character.
- **Private preparation.** Prepare one candidate against the active release, keeping all ordinary reads and edits available. Candidate entries never appear in pickers, and candidate remaps cannot redirect active references. All references, including sheet entries, catalog references and `copiedFrom`, keep pointing to stable identities rather than staging rows. Existing content and notice gates still apply. Preparation never changes live definitions or invalidates a reviewed week.
- **Impact.** Find potentially affected Characters through the reverse dependency closure of both old and new definitions and resources. Include references in sheet state (Class Levels, Item Abilities, Routine Options and Spellcasting), Base Items, catalog-to-catalog references, key-based joins, derived grants and built-in resources. Added and removed relationships count. Catalog Copies participate through their retained global references. Recalculate only potentially affected Characters with the existing `militiaCharacterFacts` function and permanent-effect rules; a resource shared by all Characters can affect them all. Store no general sheet-stat cache, and change the militia's effective review revision only when the resulting facts differ.
- **Capture concurrent edits.** Register the candidate before enumerating affected Characters. Every relevant write updates active state normally and transactionally marks candidate work dirty: sheet and local-definition edits, new Characters or dependencies, detach/customize, campaign and roster moves, archive/delete and related changes. Active Militia Character Facts still update in the ordinary write's transaction when their values change. A candidate calculation error cannot reject an otherwise-valid active edit. Candidate workers tag results with their sheet, local-definition, relationship and membership inputs, and clear dirty work only if those inputs still match. Enumeration must include work discovered while it runs.
- **One publication boundary.** The militia's character-facts portion is a versioned projection selected with the same active-release boundary as definitions. Other militia state remains live; never stage and later restore a whole campaign snapshot. Every canonical-state reader and writer, including mutation preconditions, Setup, `requireReviewedCharacters`, Confirmation, Militia Correction and History Rewrite, uses this boundary. Publishing definitions and patching embedded facts afterward is insufficient. The effective review revision includes the ordinary mutation revision and the selected facts generation for that campaign. Reuse the generation when facts are equal; publication changes it once for each campaign whose current facts differ, making only those earlier reviews stale. Subsequent ordinary edits maintain the selected live facts normally.
- **Atomic activation.** One bounded transaction verifies that the candidate's base release is still active, import/reference/gate checks passed, discovery finished and no dirty or pending facts work remains. It then switches the active release and facts selection together, without looping through Characters. Concurrent writes participate in this readiness protocol: they commit before activation and must be reconciled, or retry/read after it and use the new release. There is no maintenance window or gameplay write freeze. Each query and derived view uses one coherent release and input snapshot; clients keep a complete prior view until the next complete view arrives. They preserve entered draft fields. Gameplay commands use current server state and existing stale-review checks, without a new catalog-version permission prompt.
- **Runtime compatibility.** The manifest records required schema and calculation compatibility. Compatible readers, writers and calculation behavior must be available before activation, including support for already-open clients. A code deployment cannot reinterpret the active catalog before matching facts are ready. A resolver change that affects facts with identical catalog rows follows this same protocol, including its calculation behavior in the manifest and impact analysis. Catalog publication alone does not change Ruleset Version; changes to Weekly Resolution behavior follow the existing policy. The initial schema/backfill establishes this access boundary through the planned maintenance window and reload policy in "Migration and release" below ([Decide how the character builder release migrates safely](https://github.com/AndreasUnunger/EverythingPath/issues/240#issuecomment-5954578153)). That one-time allowance does not change ordinary Catalog Releases' uninterrupted reading and editing or support for already-open clients.
- **Failure and retry.** Incomplete or failed preparation leaves the active release and its live facts serving everyone. Retry resumes the same immutable artifact; changed inputs require a new number. Failed activation publishes nothing. If its response is lost, inspect the authoritative active release/run before retrying. Obsolete workers cannot write into a different or activated run. Competing activations are serialized; a changed base requires a fresh comparison and reconciliation.
- **Rollback.** Publish another manually numbered release using earlier definitions and the same protocol against current sheets and local definitions. Never restore player or militia snapshots. Entries introduced since the target remain addressable with their last usable definitions but become retired; retain the dependencies needed to resolve them. Reviewed remaps cannot destroy existing identities or change their kinds incompatibly; an incompatible kind change gets a new identity. Keep legal notices as the existing permanent superset. The attribution check applies as to any release: an old release cannot reinstate an assessment now known to be wrong, revive revoked evidence or clear a retained exception, and retained entries follow "Retained exceptions" under "Global catalog import". Preserve selected entries, quantities, choices, customizations and copied defaults, including item magic state, Spell Effect caster levels and editable racial progression. Import and rollback never reapply defaults or replace sheet choices. Finished weeks and their frozen Resolution Records stay unchanged.

## Resolver

The resolver lives in `src/lib`, is pure, and is shared by the client and Convex:

```ts
type SourcedModifier = Modifier & { sheetEntryId: string; entryName: string; source: string; builtIn: boolean };

collectModifiers(character, entries, catalog): SourcedModifier[]   // active entries, their Item Abilities + built-ins from state
resolveSheet(modifiers, { permanentOnly?: boolean; situations?: Situation[] }): ResolvedSheet // staged; each statistic → { total, applied, suppressed, conditional }; plus one resolved Spellcasting per casting class
resolveRoutine(character, sheet, routine, { situations? }): { single, attacks }   // see "Attacks"
militiaCharacterFacts(character, entries, catalog): MilitiaCharacterFacts // permanentOnly; the one function the militia uses
calculatePointBuy({ baseModifiers, abilityMethod }): { spent: number | null } | null
sheetWarnings({ characterKind, base, levels, baseModifiers, creationSettings, pointBuy, hp }): SheetWarning[] // implemented; pure derived output, never stored
```

## Migration and release

Decided by [Decide how the character builder release migrates safely](https://github.com/AndreasUnunger/EverythingPath/issues/240#issuecomment-5954578153). This amends the release sequence in [Reconcile the sheet data model with one Character identity](https://github.com/AndreasUnunger/EverythingPath/issues/206#issuecomment-5930864770) and spell-retirement timing in [Decide how spellcasting fits the Character Sheet](https://github.com/AndreasUnunger/EverythingPath/issues/218#issuecomment-5950044118). These are implementation requirements, not a record of a completed migration.

The initial gate, complete writer inventory and pre-activation start/status/abort procedure are implemented in [Initial Character migration write gate](initial-character-migration-write-gate.md). [Private candidate backfill](initial-character-backfill.md) adds internal capture/validation/driver/status/abort commands under that closed gate. Its completion receipt binds the current epoch, input capture and validation; capture records bind build/catalog and schema/calculation compatibility. Partial, aborted or superseded receipts cannot authorize activation. Production still reads legacy authority, and activation remains #413.

One product release has separate preparation and activation steps. Merging prepares it; an operator explicitly starts a planned read-only window once the frontend and catalog are ready. Tabs opened before cutover reload before saving afterward. These allowances apply only to this initial migration, not later Catalog Releases.

1. **Prepare compatible code and content.** Add schema and functions while flat Character fields remain readable and writable through the existing contract. Preserve Character IDs, campaign and owner references, descriptions, kinds and active state. Stage the initial immutable Catalog Release, stable identities, definitions, resources and legal output privately. Publish and verify a frontend that supports the existing state, maintenance and the new state, with the builder inactive. Verify backend compatibility before maintenance. All readers and writers must honor the same server-selected authority, including the mirror writer, Setup, `requireReviewedCharacters`, Confirmation, corrections and History Rewrite. Under sheet authority, they derive Militia Character Facts through the shared resolver; Character writers, including fixtures, write the sheet.
2. **Separate deployment from activation.** Build success, backend deployment, frontend publication and activation are separate checks. The current `pnpm deploy:convex` wrapper builds the frontend before pushing Convex functions; its generated-file check and site publication can fail after the backend changes. A failed preparation leaves compatible code serving the existing contract and gameplay available. Frontend failure is not a backend rollback.
3. **Close the write gate explicitly.** Record the migration run and atomically close a server-enforced gate covering every writer of Characters, membership/ownership, roster references, militia state or migration inputs, including background jobs, fixtures, imports and administrative paths. A write committed before closure is included; later writes, including old-client commands, are rejected without mutation. Reads keep serving the complete existing state. Show maintenance feedback and ask players to save beforehand; old bundles cannot be assumed to preserve unsaved input across reload, and rejected commands are not replayed automatically. This is an operator procedure, not a gameplay permission.
4. **Backfill private candidates.** Enumerate all Characters only after closure. Use bounded, idempotent, resumable batches, retaining a fixed SHA-256 digest of each complete source Character while preserving its flat fields untouched. An uninitialized Character's candidate gets exactly one base-scores entry from the recorded scores, `abilityMethod: 'rolled'` and the recorded number of ordered Unspecified Class Levels. Militia Characters receive `sheetMode: 'militiaOnly'`; Characters outside a campaign militia receive Full presentation. Already initialized sheets retain their recorded inputs and eligible presentation. Keep partial candidates invisible and preserve identity and ownership. Completion markers identify the run and source inventory they certify; retries cannot duplicate entries. The [operator runbook](initial-character-backfill.md) records preparation resource limits and explicit overflow reporting.
5. **Validate before activation.** Check complete coverage, structure, references and access scope, and exact equality of candidate Militia Character Facts to flat Character values and existing militia facts wherever mirrored. Preserve roster Hit Dice overrides, officer/team assignments, saved Weekly Draft inputs and immutable Resolution Records. A discrepancy fails the run; migration neither silently corrects facts nor makes advisory rules warnings blocking. Equal facts leave militia source/facts revisions unchanged. The separately required computed-Hit-Dice Ruleset Version still makes an old preview stale: Confirmation needs a fresh review under the new rules, without losing saved draft inputs. That behavior becomes active at cutover, never during preparation; historical versions and values stay frozen.
6. **Activate, check, then reopen.** One bounded transaction verifies the current run, closed gate, unchanged source/compatibility identity, complete and validated batches, catalog/legal gates for the same immutable artifact, and frontend readiness. It selects sheet authority, the initial Catalog Release, matching facts and compatible calculation behavior together, without looping through Characters or replacing whole militia snapshots. Keep writes closed for smoke checks, then explicitly reopen for the new client contract. Legacy endpoints reject old or delayed commands with reload-required feedback; they never restore flat authority or reinterpret an old command as a sheet edit. New clients read one coherent release and retain saved drafts. Activation and reopening are idempotent; inspect authoritative control state after a lost response. Abandoned, superseded or activated-run workers cannot mutate live sheets.
7. **Resume or abort before activation.** A failed batch or invariant leaves legacy reads available and writes paused. Retry within the same freeze, or fence all candidate workers before aborting and reopening legacy edits. After an abort, old completion markers cannot authorize activation: capture current source, include new Characters, revalidate every candidate and rebuild changed ones. Never skip work merely because a previous run completed it.
8. **Repair forward after activation.** Failed smoke checks leave the new coherent state read-only while compatible code is repaired. Never restore stale flat-field authority. Once editing reopens, preserve every accepted sheet and militia edit; do not automatically restore database snapshots or redeploy an old schema. Catalog rollback is another numbered release evaluated against current sheets. A frontend rollback must support current server state. A pre-migration backup is disaster-recovery evidence, not ordinary rollback.
9. **Clean up separately.** Retain old flat values and spell rows through preparation and activation; active sheet readers leave them unread. Retire all old spell writers, imports and aggregate-maintenance paths before clearing anything, so they cannot repopulate the tables. Once forward recovery is verified, a separate behavior-preserving change clears flat values, `spell`/`characterSpell` rows and spell aggregate entries, then removes their columns/tables and obsolete spell code/data. Retain reload-required compatibility stubs as needed. Track this work in [legacy inventory B6](legacy-compatibility-inventory.md#b6-planned-character-sheet-release-cleanup-240).

## Verification

Resolver tests (pure) must cover:

- each stacking rule;
- untyped penalties summing and typed penalties taking the worst;
- a shared `sourceKey` keeping only the strongest entry, and `stacksWithItself` lifting that;
- the same-entry rule, and `stacksWithinEntry` adding to the entry's largest bonus even of a non-stacking type (*Elixir of the Peaks* in mountains at altitude);
- parent targets competing with their leaves;
- the touch, flat-footed, CMD and flat-footed CMD compositions above;
- ability damage changing the modifier but not the score;
- drain changing the score;
- `permanentOnly` excluding short spells, conditions, consumables and damage;
- formulas reading only earlier stages;
- an unsupported formula contributing nothing;
- moving and deleting Class Levels;
- a situational Modifier staying out of the total and stacking like any other once its Situation is asked for (raging Will vs. spells);
- a local Situation matching only itself, and two Situations asked for together combining;
- while-active and weapon conditions;
- a multiclass caster's separate Spellcastings, caster level offsets, and prestige advances split across classes;
- bonus spells only at levels with a table entry, from permanent scores, never adding to spells known;
- one extra slot per level however many `extraSlot` features, and granted Spells appearing once their level is castable;
- castable spell levels from spells known or prepared (sorcerer and arcanist cantrips), slot-style grants following prestige advances, schedule-style grants following only the class's own levels, and "domain slot only";
- an advance qualifying only for classes taken before the prestige class's first level, for both the pre-fill and the warning;
- the Spell Effect caster level pre-fill, and `@casterLevel` in a Spell Effect and in Magical Knack;
- attack bonus, iterative attacks, two-weapon penalties, Str multipliers, composite bows, crossbows, Power Attack and haste, and the single attack taking no two-weapon penalty;
- an `option` Modifier applying only in routines that switch it on, its other targets only in its option's Situation, and a routine keeping an option whose entry left;
- Power Attack scaling, Rapid Shot, Manyshot, Vital Strike on the single attack only (natural and unarmed included), Lunge, and Medusa's Wrath adding two unarmed strikes at the highest bonus and offered only with an unarmed strike;
- flurry for each monk: the main weapon making every attack and the off-hand weapon the extra ones; core flurry with full Str, Str ×1 but Power Attack +50% for a two-handed monk weapon, Power Attack halved only on off-hand weapon attacks, and no extra attacks from the Two-Weapon Fighting chain, Double Slice or Two-Weapon Rend; unchained flurry with Str ×1½ in two hands and ×½ off hand, Power Attack scaling to match, and no two-weapon penalties;
- Improved and Greater Two-Weapon Fighting, Double Slice, Rapid Reload, Weapon Finesse choosing the higher ability, and Improved Critical, *keen* and *keen edge* together doubling once;
- natural attacks alone and alongside weapons: all secondary, Multiattack's −2, no two-weapon penalty on the weapons without an off-hand weapon, and the limb warning;
- unarmed strike with monk scaling and sizes off the FAQ dice chart, and special-ability dice as a damage part or Situational damage, crit dice capped at the printed ×4;
- thrown mode with Str ×1 in two hands and ×½ off hand, one throw per hand without Quick Draw, the full rate with it, and shuriken exempt;
- a double weapon's other end as a light off hand, and its primary end taking Str ×1 and plain Power Attack;
- Two-Weapon Rend's extra line after the full attack only, and Shield Master removing the two-weapon penalty from a shield bash;
- shooting into melee as a Combat situation removed by Precise Shot, and Point-Blank Shot only in `within30ft`;
- the `$group` weapon condition, `@casterLevel.<classKey>` and `@casterLevel.arcane`, and Combat situations staying out of the marker;
- proficiencies: grants from Class Levels, Racial Traits, feats, class features and traits, multiclass grants adding up, a Martial Weapon Proficiency or Favored Weapon choice, an empty choice granting nothing, `asMartial` counting only with `martial`, a bastard sword covered by `martial` only in two hands, `always` weapons, and manual additions and removals with a removal beating a grant;
- nonproficiency: −4 on a weapon's lines, a nonproficient armor's or shield's armor check penalty on every attack line and never twice on skills, each named in the breakdown;
- Racial Traits: choosing and changing a race, an alternate removing and restoring what it replaces, an unchosen `ability.$choice`, `countsAsRaces` and `oneOf`, and the favored class count following Multitalented;
- a masterwork weapon's +1 on attack only, suppressed by any enhancement;
- armor and shield bonuses with their enhancement on their own leaves and off touch AC, two suits highest-only, the lowest max Dex capping Dex to AC but not CMD, and armor check penalties summing into skills;
- a specific weapon taking its `weapon` detail from its Base Item, and its `magic` defaults copied into the sheet entry;
- Item Ability dice on a hit, crit-only dice scaling with the multiplier, and *bane* contributing nothing until its `choice` is set;
- *magic weapon* through `onItem` competing highest-only with the weapon's own enhancement, and contributing nothing without `onItem`;
- ammunition's enhancement competing highest-only with the launcher's, with both items' abilities applying;
- each end of a double weapon with its own enchantment, and a shield bash using `bash`, not the shield's AC enhancement;
- the special materials table, mithral's −3 not stacking with masterwork's −1, and a specific item's material changing nothing;
- `sheetWarnings`: each check in "Rules checks", including the cumulative rank cap, the retroactive Int budget, prerequisites at recorded level and now, `ignoresPrerequisites`, `newChoice` duplicates, the item construction checks per end and per bash, `proficiency` clauses met by any grant, the one-handed exotic warning with no other warning for being nonproficient, and an Accepted Warning reopening when its fingerprint changes;
- Prerequisites at recorded level: a Strength item added at level 8 meeting a level-3 feat's Str 13; BAB and ranks from the prefix, never the current totals; a level-4 feat seeing that level's ability increase but not a later choice at the same level, until the choices are reordered; a choice's grants sharing its position; mutually required feats warning only on the first; a prestige class checked before its first level's benefits; no recorded-level check without a usable Class Level link, while the current check still runs; an Unspecified Class Level adding only a level and a Hit Die; separate acceptances per check, reopening on a relevant clause, input, position or catalog correction, not on an unrelated edit or a release number alone.

Integration tests (convex-test) must cover:

- a backfilled Character's Militia Character Facts equal its old flat values;
- a sheet edit that doesn't change the facts leaves the `canonicalMilitiaState` revision untouched;
- editing a militia-only Character's score adjusts its base score;
- a full Character's level can't be edited through Characters & officers;
- campaign scoping of every catalog and sheet read;
- deleting is refused for a Character in a campaign;
- an Accepted Warning follows its Character between campaigns and is deleted with its subject.

Ownership and access-change handoff checks must demonstrate:

- private Characters are visible and editable only by their current owner; campaign Characters are editable by every current organization member, with no owner-only editing privilege;
- any current member can assign a campaign Character to themselves or another current member without either person's approval; a deleted account, a recipient without access and a transfer outside a campaign are rejected;
- only the current owner can request departure or a move, including immediately after claiming ownership; joining or moving preserves identity, requires destination access and does not add a roster assignment;
- every actual departure, requested or automatic, removes roster, officer and team-manager assignments through an automatic-reason Militia Correction, marks affected Staged Action Choices for review, makes a Militia-only Character Full and preserves its sheet through the homebrew detachment contract;
- loss of organization access returns every affected Character of a surviving owner to no campaign; access is revoked during cleanup failures and retries, and completion does not require that user's campaign access;
- account deletion leaves campaign Characters editable and visibly needing an owner, lets remaining members claim or assign them, and deletes private Characters;
- delayed, repeated or reordered lifecycle events check current authoritative state before acting: a known deleted account uses account-deletion policy, changed ownership is respected, and a real completed private departure followed by account deletion remains private-Character deletion;
- app-controlled campaign and organization deletion return surviving-owner Characters and refuse to proceed with any ownerless Character until assignment;
- external organization deletion returns surviving-owner Characters and retains ownerless Characters with their required sheet dependencies for app-operator recovery, with no user browsing or former-member claim rights;
- failed detachment or recovery retains source data and dependencies, retrying does not duplicate Characters or departure effects, and a normal private Character cannot be ownerless;
- departure and deletion preserve all frozen and superseded Resolution Records; current surviving-organization members can read but not edit deleted-campaign history, deleted-organization history is inaccessible to users, and historical references cannot open a private sheet.

Homebrew-departure handoff checks must demonstrate:

- complete dependency closure through future class features, prompt options and whole-class spell lists without sheet rows, Base Items, Item Abilities and replacement rules, including cycles and shared dependencies; unrelated campaign definitions stay behind;
- off, kept and dormant entries, orphaned Spells, saved Grants, slots and Accepted Warnings survive with their links, and dormant entries restore with their saved state when their source returns;
- remapping preserves totals, stacking, prerequisites and warning acceptance, including edited copies sharing rule identity; global references stay live, existing character customizations survive, and equality-only references need no inaccessible original payload;
- original-change advisories reveal nothing without the viewer's original access, and restored access resumes comparison with the copy-time fingerprint without updating the copy;
- repeated A-to-B-to-A moves keep carried versions and identities without accumulating duplicate copies or roster assignments; divergent definitions are not merged by name or ancestry;
- a new Class Level continues the chosen version; an explicit class-wide switch updates every level while preserving row IDs, order, HP, skill ranks, choices and casting links, with Grant dormancy/restoration and the existing Unchained policy intact;
- lifecycle copies of already-retained held uses preserve holds, reporting and notice obligations, while new selections, new Grants, ordinary copies and held revisions remain unavailable;
- failed preparation, failed publication, a lost response and retries produce no partial sheet or duplicated departure effects; voluntary failure leaves the prior relationship and roster intact;
- sheet/local-definition edits, Catalog Release activation, ownership reassignment, membership loss and account deletion during a move are reconciled against authoritative state, with immediate access revocation where required, no stale overwrite, complete publication, retained source dependencies and unchanged frozen history.

Catalog-release handoff checks must demonstrate:

- an overlay-only input change needs a manual release bump; changed inputs or output under an existing number fail, and unrelated application changes do not import;
- halfway batch failure, activation failure and a lost activation response leave one coherent authoritative release and recover idempotently;
- concurrent edits, newly added dependencies and campaign moves appear in candidate facts without freezing gameplay or losing intervening militia changes;
- indirect users, including Catalog Copies with global references, update while unrelated Characters and unchanged facts leave militia reviews untouched;
- notice-only releases leave facts and reviews unchanged, while changed facts make affected reviews stale at publication;
- copies keep their own fields, follow retained global references and warn only when the viewer can access the original and its definition differs from the fingerprint recorded at copy time;
- rollback preserves later player edits and a newly selected entry with its required dependencies, without reapplying defaults;
- current views never mix releases, already-open clients remain usable, and finished-week snapshots stay unchanged.

Initial-migration handoff checks must demonstrate:

- halfway batch failure and duplicate-free resume, with private candidates and complete legacy reads;
- a write racing gate closure, and rejection of a Character change after its batch;
- abort, intervening edits/new Characters and restart against current source, with obsolete workers fenced;
- exact facts equality without source/facts revision changes, while an old Ruleset Version preview requires a fresh review;
- preservation of IDs, ownership, overrides, assignments, saved Weekly Draft inputs and frozen history;
- failed frontend build or publication leaving the compatible existing contract available;
- stale tabs and delayed writes receiving maintenance or reload-required rejection without automatic replay;
- failed/lost activation and reopening responses recovering idempotently without mixed authority;
- failed smoke checks leaving coherent new reads, and forward repair preserving edits accepted after reopening;
- authorization and campaign-scoped references in the new paths, and spell retirement without repopulation.

The handoff includes a rehearsal on representative isolated data, identified application build and catalog manifest, batch/coverage and invariant reports, a reader/writer coverage inventory, and an operator runbook for start, status, resume, abort, activate and reopen. Declare the maintenance budget before starting; if it cannot be met before activation, the runbook directs an explicit abort. An abandoned worker must not leave users indefinitely paused.

These are acceptance cases for the implementation, not claims of runtime behavior already implemented or tested.
