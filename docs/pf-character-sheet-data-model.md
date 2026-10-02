# Pathfinder character sheet data model

Revised by [Reconcile the sheet data model with one Character identity](https://github.com/AndreasUnunger/EverythingPath/issues/206) on the [Pathfinder 1e character builder](https://github.com/AndreasUnunger/EverythingPath/issues/201) map. It follows [ADR 0001](adr/0001-one-character-identity.md): the builder extends the existing `character` table, and every Character has a Character Sheet. Terms are defined in [`CONTEXT.md`](../CONTEXT.md).

Rules sources:

- [Collect the official PF1 bonus-stacking and target rules](https://github.com/AndreasUnunger/EverythingPath/issues/209) (`research/pf1-official-stacking-rules`)
- [Find how official PF1 rules treat "functions as" wordings for stacking](https://github.com/AndreasUnunger/EverythingPath/issues/210) (`research/pf1-functions-as-stacking`)
- [Survey how existing PF1 builders model characters](https://github.com/AndreasUnunger/EverythingPath/issues/203) (`research/pf1-builder-models`)
- [Collect the official rules for racial Hit Dice progression](https://github.com/AndreasUnunger/EverythingPath/issues/220) (`research/pf1-racial-hit-dice`) and its follow-up on FAQ and designer rulings (`research/pf1-racial-hd-level-rulings`)
- [Collect the official PF1 spellcasting rules](https://github.com/AndreasUnunger/EverythingPath/issues/231) (`research/pf1-spellcasting-rules`) and [Compare the spell data sources for spellcasting](https://github.com/AndreasUnunger/EverythingPath/issues/217) (`research/pf1-spell-data`)

Only official Paizo text decides a rule: the Core Rulebook, plus the official FAQ and errata. Where it is silent, the model follows the literal text and adds nothing. [Set the coverage bar for archetypes and prestige classes](https://github.com/AndreasUnunger/EverythingPath/issues/219) also admits, with their FAQ and errata: the *Advanced Player's Guide* archetype rules, its favored class option rules, the trait rules of the *Advanced Player's Guide* and *Ultimate Campaign*, and *Pathfinder Unchained*'s classes ([Decide which Pathfinder Unchained rules the builder supports](https://github.com/AndreasUnunger/EverythingPath/issues/226)). [Decide how spellcasting fits the Character Sheet](https://github.com/AndreasUnunger/EverythingPath/issues/218) admits each casting class's own spellcasting section, for that class only. [Decide how racial traits live on a Character Sheet](https://github.com/AndreasUnunger/EverythingPath/issues/232) admits the alternate racial trait and subrace rules of the *Advanced Player's Guide* and the *Advanced Race Guide*. Other Paizo books supply catalog content, not rules.

## Principles

1. **Stat totals are never stored.** They are derived from Modifiers every time by a pure resolver. The sheet UI and the server's Militia Character Facts calculation share that resolver.
2. **Everything on the sheet is a Character Sheet Entry.** This covers gear, spells, features, base scores, Class Levels and ability damage.
3. **Modifiers live on Catalog Entries.** A one-off item, a manual adjustment and the base scores are Catalog Entries scoped to one Character. The exceptions are Class Levels, ability damage and ability drain, which hold only Character state, and an item's armor bonus, enhancement, masterwork and material, from its detail and state (see "Weapons and armor"). The resolver turns these into built-in Modifiers.
4. **Rule facts belong on the Catalog Entry, state on the Character Sheet Entry.** Kind-specific shape is a discriminated union keyed by `kind` on both.
5. **Everything stays editable at any time,** including choices the rules say can't change later. Such rules, like every rules check, become advisory warnings and never block (AGENTS.md "Validation Philosophy").
6. **No caches** and no "active effects" table. Pools (current HP, spell slots, daily uses) are not entries, and play-time status tracking is out of scope.

## Tables

```ts
// Existing table, narrowed. Level and ability scores are derived from the sheet.
character: {
  name: string,
  ownerId: string,                    // the Character Owner, see "Ownership and campaigns"
  campaignId?: Id<'campaign'>,        // absent = in no campaign; a Character is in at most one
  description: string,                // labelled "Notes" in the UI
  kind: 'pc' | 'npc',
  isActive: boolean,
  sheetMode: 'militiaOnly' | 'full',  // presentation only, see "Two presentations"
}
// indexes: by_campaignId, by_ownerId

// Logical loaded shape; global identities have immutable definition bodies per Catalog Release.
// Campaign and Character definitions remain editable. Scope decides who sees an entry.
catalogEntry: {
  scope: 'global' | 'campaign' | 'character',
  campaignId?: Id<'campaign'>,         // campaign scope only; character-scope entries follow their Character
  characterId?: Id<'character'>,       // character scope
  name: string,
  sourceKey?: string,                  // shared Source, see "Same Source"; absent = the entry itself
  stacksWithItself: boolean,           // official text says duplicates stack
  modifiers: Modifier[],               // bounded; empty is fine (a rope)
  situationalNotes?: SituationalNote[], // situational text with no number, see "Situational notes"
  detail: CatalogEntryDetail,          // discriminated on `kind`
  description?: string,                // sanitized rules text
  sources: Array<{ book: string; pages?: string }>, // feeds OGL Section 15
  externalKey?: string,                // global scope: `<repo>/<_id>`, finds the stable identity; pack is an ordinary field
  retired?: boolean,                   // global scope: absent from current content; hidden from pickers, kept for sheets
  copiedFrom?: Id<'catalogEntry'>,     // campaign or character copy of another entry
  copiedFromFingerprint?: string,     // original definition at copy time; advisory compares against its current body
  unsupported?: string[],              // importer notes: unmappable targets, formulas outside the grammar
  prerequisites?: Prerequisite[],      // feats, traits, prestige classes, archetypes; all must hold, see "Rules checks"
  countsAsRaces?: Id<'catalogEntry'>[] // "count as both elves and humans"; set by the Curation Overlay, see "Racial traits"
    | { oneOf: Id<'catalogEntry'>[] }, // "count as either": the sheet entry's `choice` picks one
  grantsSlots?: Array<{ kind: 'feat' | 'trait'; count: number;   // bonus feats (fighter, human), Additional Traits
    featTypes?: string[];              // a bonus feat must carry one of these Foundry feat types, such as 'combat'
    feats?: Id<'catalogEntry'>[];      // a bonus feat must be one of these (the half-elf's Skill Focus)
    ignoresPrerequisites?: boolean }>, // monk bonus feats, ranger combat style
  routineOption?: true,                // a Routine Option, set by the Curation Overlay; see "Attacks"
  proficiencies?: ProficiencyGrant[],  // classes, Racial Traits, feats, class features, traits; see "Proficiencies"
}
// indexes: by_scope, by_campaignId_and_scope, by_characterId, by_sourceKey, by_externalKey, by_copiedFrom

// One row per thing a Character has.
characterSheetEntry: {
  characterId: Id<'character'>,        // access follows the Character; no campaignId, because Characters move
  kind: EntryKind,                     // immutable, indexed
  catalogEntryId?: Id<'catalogEntry'>, // required for catalog-backed kinds, absent for state-only kinds
  active: boolean,                     // off drops its Modifiers and keeps the row
  gainedAtClassLevel?: Id<'characterSheetEntry'>, // feats, traits and class features: the Class Level that granted them
  notes?: string,
  state: SheetEntryState,              // discriminated on `kind`
}
// indexes: by_characterId, by_characterId_and_kind, by_catalogEntryId

// A warning someone on the sheet marked as intended. The only stored part of the rules checks.
acceptedWarning: {
  characterId: Id<'character'>,
  check: string,                       // the check's key, such as 'pointBuy' or 'prerequisites.current'
  subject: string,                     // what it is about: a sheet entry id, or 'sheet'
  fingerprint: string,                 // the facts that raised it; when they change, the warning reopens
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
      replaces: Array<{ classLevel: number; catalogEntryId: Id<'catalogEntry'> }>; // rows of the class's featuresByLevel
      adds: Array<{ classLevel: number; catalogEntryId: Id<'catalogEntry'> }>;
      classSkillsAdded: SkillKey[]; classSkillsRemoved: SkillKey[];
      skillRanksPerLevel?: number }                             // absent = the class's own
  | { kind: 'classFeature';
      spellcasting?: {                                            // set by the importer or the Curation Overlay
        extraSlot?: 'domain' | 'school' | 'spirit';               // one extra slot per spell level from 1st
        grants?: { list: 'domain' | 'subDomain' | 'bloodline'; key: string; // a Foundry `learnedAt` list: its Spells are granted
          atClassLevel?: number[] };                              // schedule-style: the class level granting spell level 1, 2…; absent = slot-style
        school?: SchoolKey } }                                    // an arcane school: the specialist school
  | { kind: 'feat'; featTypes: string[];                         // Foundry feat types: 'combat', 'general', 'teamwork'…
      repeatable: 'no' | 'newChoice' | 'yes' }                    // "You can gain this feat multiple times"
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
        acp: number; asf: number };                              // armor check penalty; spell failure, in %
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
  | { kind: 'condition' } | { kind: 'manual' };

type SheetEntryState =
  | { kind: 'classLevel'; classEntryId: Id<'catalogEntry'> | null;   // null = Unspecified Class Level
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
      abilityMethod: { method: 'pointBuy'; budget: number } | { method: 'rolled' };
      traitCount: number; campaignTraitRequired: boolean;
      proficiencies: { added: ManualProficiency[]; removed: ManualProficiency[] } } // the player's own, see "Proficiencies"
  | { kind: 'race'; racialHpGained: number | null;                  // hit points from all racial Hit Dice together
      racialSkillRanks: Partial<Record<SkillKey, number>>;
      favoredClassIds: Id<'catalogEntry'>[] }
  | { kind: 'racialTrait'; choice: string | null }                  // the ability of "+2 to one ability score", Dragon Soul's race
  | { kind: 'feat'; choice: string | null;                          // Weapon Focus's weapon (a `baseType`, Bite or Claw included), Skill Focus's skill…
      slot: 'general' | { grantedBy: Id<'characterSheetEntry'> } }   // the entry whose `grantsSlots` it fills
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
type ItemEnchantment = { masterwork: boolean; enhancement: number; abilities: ItemAbilityRef[] };
type ItemAbilityRef = { id: Id<'catalogEntry'>; choice: string | null }; // choice: bane's designated foe
type MaterialKey = 'adamantine' | 'mithral' | 'darkwood' | 'dragonhide' | 'coldIron' | 'alchemicalSilver';
```

## Class Levels and Hit Dice

- A Character's level is the number of its Class Levels. It is never stored. Zero is allowed: a PC at level 0 shows an advisory warning.
- A new Character starts with one Unspecified Class Level. An Unspecified Class Level adds Hit Dice and nothing else.
- The level within a class is the count of earlier Class Levels of that class. Every field of every Class Level can be edited at any time. That includes its class, its position (a level can move), and deleting it from the middle, in which case later positions close up.
- The ability increase and favored class bonus fields exist on every Class Level. A favored class bonus on a level of a class that isn't favored shows a warning. So does an increase on a Class Level where neither its character level nor its Hit Dice count is 4, 8, 12, 16 or 20 (see "Racial Hit Dice").
- `hpGained` holds the recorded number. The builder takes it as a plain number and never pre-fills it: there is no roll, average or maximum button ([Prototype the character creation and level-up flow](https://github.com/AndreasUnunger/EverythingPath/issues/208)).
- **Hit Dice** = Class Levels + racial Hit Dice. They are computed and never recorded. The militia's roster Hit Dice override stays as the militia's own ruling.

## Racial Hit Dice

Decided by [Decide how a Character Sheet models racial Hit Dice beyond the count](https://github.com/AndreasUnunger/EverythingPath/issues/222).

- **Rules sources.** No FAQ or errata covers how racial Hit Dice meet level-keyed rules. The CRB, the CRB FAQ and Paizo's own stat blocks decide what they can. The Bestiary is not admitted as a rules source: its creature-type table arrives only as catalog content. Its rules for adding racial Hit Dice and for Monsters as PCs (CR counted as class levels) are not modelled, and a Monster PC's level-equivalence is the GM's call.
- **On the race.** The race fixes the count, so `racialHitDice` and `racialProgression` live on the race entry, in the class detail's vocabulary. Foundry race records carry no count, so every imported race has 0. A race with racial Hit Dice is a campaign or character Catalog Copy, with the count and progression set by hand.
- **Seeding.** Choosing a creature type fills `racialProgression` from the creature-type seed table (see "Global catalog import"). Every seeded field stays editable, because type features hold "unless otherwise noted" and humanoid and outsider good saves vary.
- **Choices on the sheet.** The race sheet entry records `racialHpGained`, one plain number for all racial Hit Dice, never pre-filled. It gets no favored class bonus and no maximized first Hit Die (CRB FAQ). It also records `racialSkillRanks`. Feats from racial Hit Dice are ordinary feat entries.
- **Ability increases.** Racial Hit Dice have no ability increase field. The rules are silent when racial Hit Dice and Class Levels mix, so the increase warning accepts either reading: the Class Level's character level or its Hit Dice count.
- **Level-keyed rules.**

  | Rule | Reads | Basis |
  |---|---|---|
  | Character level: prerequisites such as Leadership, "1/2 your character level", the militia, the level-0 warning | Class Levels only | CRB definition; Paizo keeps character level and Hit Dice apart (familiar rule, monster DCs by Hit Dice) |
  | Feat count | Hit Dice | CRB "based off their Hit Dice"; Monster Codex stat blocks |
  | Maximum ranks per skill | Hit Dice | CRB "your total number of Hit Dice" |
  | BAB | per source, summed | CRB FAQ (Monk): racial Hit Dice BAB "adds normally" |
  | Base saves | per source, summed | CRB multiclassing rule; Paizo stat blocks add a racial and a class good save +2 each |
  | Skill ranks per Hit Die | per source, summed | CRB multiclassing rule |

- **Type quirks.** Construct bonus hit points by size and undead Cha-for-Con hit points are hand-entered `hp` Modifiers on the race Catalog Copy. Mindless creatures (no Int score) are not supported.

## Racial traits

Decided by [Decide how racial traits live on a Character Sheet](https://github.com/AndreasUnunger/EverythingPath/issues/232).

- **Rules sources.** The *Advanced Player's Guide* and *Advanced Race Guide* rules for alternate racial traits and subraces are admitted. An alternate racial trait is exchanged for one or more standard racial traits, and "you cannot exchange the same racial trait more than once" (APG). Neither book defines "alters". The *Advanced Race Guide* race builder (race points) is out of scope. A custom race is a campaign or character Catalog Copy of a race.
- **Sheet entries.** Racial Traits are `racialTrait` sheet entries, granted like class features.
  - The race's `racialTraits` lists its standard traits. Choosing a race adds them, and changing the race swaps them for the new race's.
  - An alternate's `replaces` names standard traits. Adding it removes them, and removing it restores them.
  - Entries added or edited by hand stay, as with Archetypes.
  - Racial Traits are permanent entries, so the ability score trait counts for Militia Character Facts as the race's adjustments did.
- **Modifiers sit on the traits.** A Modifier lives on exactly one entry, so nothing counts twice. A race entry keeps its racial Hit Dice, progression, size and creature type; its Modifiers come from its Racial Traits. The importer:
  - moves each race record's ability changes (152, found only on race records) onto that race's ability score trait;
  - drops race changes and notes that a standard trait also carries (64 of 67 non-ability changes; the race's 32 notes repeat trait notes in other words), keeping the trait's version when they differ;
  - leaves anything else on the race and lists it in the import report until the Curation Overlay moves it. The three races with no traits (gnoll, lizardfolk, ogre) keep all their Modifiers.

  So Orc Atavism, which "replaces the usual ability modifiers", and subrace stat blocks work by replacement alone.
- **Ability of choice.** A "+2 to one ability score of your choice" trait (human, half-elf, half-orc and others; Orc Atavism's −2 to one mental score) has an `ability.$choice` Modifier. The sheet entry's `choice` names the ability. Until it is chosen, the Modifier contributes nothing and the field shows a blue outline. Restrictions such as "a mental ability score" stay prose.
- **Facts the traits carry.** Each fact sits on the trait, so an alternate that replaces the trait removes it.
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
  - An unresolved alternate imports with an empty `replaces`, so adding it removes nothing and the player removes the replaced entry by hand.
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

- **Coverage.** Every official Paizo prestige class and archetype, from any Paizo product: rulebooks, Campaign Setting, Player Companion and Adventure Path books.
- **Archetypes.**
  - An Archetype is a Catalog Entry tied to one base class, or to both versions of one (see "Unchained Classes"). A Character takes it as a sheet entry, and it applies to every level of that class. The levels stay levels of the base class.
  - `replaces` names rows of the class's `featuresByLevel`, a feature at one class level, so "replaces armor training 1" removes only that row. An archetype feature that alters a class feature replaces that row and adds its own feature at the same level.
  - Adding an Archetype removes the class feature entries it replaces from the sheet and adds its own features at their levels, with `gainedAtClassLevel` set. Removing it reverses this. Entries added or edited by hand stay.
  - Class skills added or removed and skill ranks per level are structured. Proficiency changes and spellcasting changes stay in the description. The player records a proficiency change by hand (see "Proficiencies").
  - Two Archetypes on one class that replace or alter the same row (one feature at one class level) show an advisory warning (see "Rules checks").
- **Base class schedules.** Foundry links many multi-level features only at their first level; the Fighter links six features. The Curation Overlay completes each base class's `featuresByLevel` from its class table, so archetypes can replace any row and the sheet shows every feature gained.
- **Prestige classes.** These are `class` entries with `classKind: 'prestige'`, and their `featuresByLevel` comes from the class's level table.
  - Entry requirements are prerequisites on the class entry, like a feat's. They are checked against the Character as of the Class Level before the class's first level.
  - A prestige class can never be the favored class.
  - "+1 level of existing spellcasting class" is `castingAdvances` (see "Spellcasting").
- **Source: a scraped AoN dataset.**
  - Neither Foundry repo has archetypes or prestige classes. PSRD-Data (no licence, frozen in 2015) and the `pf1e-archetypes` module are not used.
  - A one-off scraper reads Archives of Nethys' prestige class and archetype pages into a dataset committed to this repo. It runs very slowly, over days if need be, and only after the project owner has contacted AoN.
  - Every record keeps its book, page and AoN URL. Its catalog key is `everythingpath/<id>`, never the URL. Entries whose source is not a Paizo product are dropped and listed in the scraper's report.
  - The scraper extracts what it can, including matching "replaces X" against the base class's features. Every record it cannot match or classify goes to a hand-review list. Each book also gets a sampled spot-check.
  - Corrections, including Modifiers for archetype and prestige features, are made in the dataset itself. A reviewed record is marked and cites its book and page. The Curation Overlay is only for upstream data.
  - Every scraped record's book is in the import's book set, so it needs a Section 15 Registry record or the import fails (see "Legal page" under "Global catalog import").

## Unchained Classes

Decided by [Decide which Pathfinder Unchained rules the builder supports](https://github.com/AndreasUnunger/EverythingPath/issues/226).

- **Scope.** The four Unchained Classes (barbarian, monk, rogue, summoner), their archetypes, and *Pathfinder Unchained*'s other catalog content are in. Signature Skill and skill unlocks, the stamina feats, Combat Trick feats and scaling items are plain prose catalog content: nothing is derived from them, and no stamina pool exists. Every alternate rule system in the book is out of scope, so there are no variant rule switches on a campaign or a Character.
- **Class entries.** Each Unchained Class is its own `class` Catalog Entry, imported from Foundry's `<Class> (Unchained)` records, with `counterpartOf` pointing at the original class. Its features are found through the class's links, not by the PZO1131 source, which most unchained feature records lack.
- **One version per Character.** Class Levels in both an original class and its Unchained Class show an advisory warning ("individual characters must use one version or the other exclusively").
- **A version of the same class.** The book's own framing, applied consistently:
  - Levels of an Unchained Class count as levels of the original wherever something counts levels in that class: `@classLevel.<classKey>`, requirements, and the favored class with its favored class options. The two never coexist, so nothing double-counts.
  - A prerequisite naming a class feature is met by the same-named feature of either version, ignoring Foundry's `(UC)` suffix: Extra Rage accepts *Rage (UC)*. See "Rules checks".
- **Archetypes.**
  - An archetype for the original barbarian, rogue or summoner applies to the Unchained Class ("as long as the classes still have the appropriate class features to replace"). Its `replaces` rows match the Unchained Class's `featuresByLevel` by feature name and class level, ignoring `(UC)`. A row with no match shows an advisory warning and removes nothing.
  - An archetype for the original monk on the unchained monk shows an advisory warning ("with the exception of the monk").
  - Archetypes written for an Unchained Class name it directly. One whose source names both versions lists both in `classEntryIds`.
  - The Pathfinder Society restrictions (no barbarian archetype that changes rage, no summoner archetype that changes the eidolon's base form) are campaign policy, not rules text, and are not adopted.
- **Spells.** The unchained summoner's revised spell list is ordinary per-class spell data under its own class tag, and its casting table is the bard's (see "Spellcasting").

## Spellcasting

Decided by [Decide how spellcasting fits the Character Sheet](https://github.com/AndreasUnunger/EverythingPath/issues/218). Rules from [Collect the official PF1 spellcasting rules](https://github.com/AndreasUnunger/EverythingPath/issues/231) (`research/pf1-spellcasting-rules`); open items there are cited as S1–S14.

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
};
```

### Recorded Spells

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
- A class feature's Spellcasting is that of its `gainedAtClassLevel`'s class. Without one, it applies to the Character's only Spellcasting, and shows nothing when there are several.

### Casting tables

A reviewed file in the repo beside the Curation Overlay. Foundry's own tables are GPL code (`config.mjs`) and are never copied.

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

- **Operators and functions:** integers, `+ - * /`, `floor`, `ceil`, `min` and `max`.
- **Variables:** `@level`, `@classLevel.<classKey>`, `@hitDice`, `@ability.<key>.mod` and `@bab`.
- **`@casterLevel`:** in a Spell Effect's Modifiers, the caster level recorded on its sheet entry (*shield of faith*'s +1 per 6 levels). In a `casterLevel` Modifier, the Spellcasting's caster level before `casterLevel` Modifiers, so Magical Knack is `min(2, @hitDice − @casterLevel)`, capped at Hit Dice as written (S13). Anywhere else it is unsupported.
- **`@casterLevel.<classKey>`** is that class's Spellcasting's caster level, and **`@casterLevel.arcane`** the highest caster level among arcane Spellcastings, for Arcane Strike and other caster-level scaling. Both are 0 without one.

A formula may read only stages earlier than its target's stage (see "Resolution stages"). A formula outside the grammar is stored and flagged as unsupported. It contributes nothing and shows a warning. About 22% of the dataset's changes are formulas, so the importer parses them ([Decide how the content dataset becomes the global catalog](https://github.com/AndreasUnunger/EverythingPath/issues/207)).

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
- **Note gate.** The import fails if any note, action conditional or `itemAbility` entry lacks a record of either status. A record whose note text changed upstream no longer applies, so its note counts as missing. A pin bump runs the drafter for the gaps and commits the new records with its import report.

## Stacking

Modifiers are grouped by (leaf target, bonus type).

**Bonuses:**

| Rule | Types |
|---|---|
| stack | `dodge`, `racial`, `untyped`, `circumstance` |
| highest only | every other type, `base` included |

**Penalties.** Untyped penalties sum. Typed penalties take the worst of their type. That honours both the CRB's "most penalties stack" and its magic chapter's same-type rule.

**Same Source.**

- A Modifier's Source is its Catalog Entry's `sourceKey`, or the entry itself when the key is absent.
- Entries share a key only where official text makes them one effect: *haste*, *boots of speed* and the *speed* property share `haste`, and a spell-like ability shares the key of the spell it names. Where the rules are silent, entries stay separate, and bonus type decides.
- Among active entries of one Source, per target, only the entry with the largest net contribution applies. The others are listed as suppressed by it.
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

Each stage groups and stacks. There is no priority field.

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
| CMD | 10 + BAB + Str modifier + Dex modifier + special size modifier + every circumstance, deflection, dodge, insight, luck, morale, profane and sacred AC bonus + every AC penalty + `cmd` Modifiers |
| Flat-footed CMD | CMD without the Dex bonus; dodge bonuses stay |

Untyped AC bonuses don't reach CMD. Armor's max Dex doesn't cap the Dex in CMD, and the AC size modifier doesn't reach CMD.

## Attacks

Decided by [Prototype attacks and conditional modifiers on the living sheet](https://github.com/AndreasUnunger/EverythingPath/issues/216) (variant 3, tag `prototype-approved/attacks-conditionals`), [Decide which attack options an Attack Routine supports](https://github.com/AndreasUnunger/EverythingPath/issues/229) and [Decide how the builder treats the remaining CRB attack feats and open attack rulings](https://github.com/AndreasUnunger/EverythingPath/issues/237). Its rules follow the CRB. Foundry stores none of them as data, so they are written from the text. [Collect the official rules for attack options, natural attacks and flurry](https://github.com/AndreasUnunger/EverythingPath/issues/235) (`research/pf1-attack-rules`) collected that text from the CRB and FAQ, flagged the Bestiary's, and swept the CRB feat chapter for anything missed. The rules here are final, and its open items are cited as A1–A15.

- **Coverage.** The builder writes by hand every CRB feat, class feature and Combat situation that changes a routine line's bonus, damage, critical or number of attacks. Other books are catalog content: computed when a plain Modifier with its condition expresses it, and text otherwise. Text:
  - feats that change no line's numbers: Cleave, Great Cleave, Spring Attack, Whirlwind Attack, Shot on the Run, Ride-By Attack, Unseat, Trample, Stunning Fist, Scorpion Style, Gorgon's Fist, Shatter Defenses, Channel Smite, Penetrating Strike, Greater Penetrating Strike, Shield Slam, Combat Reflexes, Strike Back and the maneuver feats;
  - multipliers: Spirited Charge and Deadly Stroke;
  - what the sheet doesn't compute: range increments (Far Shot), mounted penalties (Mounted Archery) and the target's AC (Improved Precise Shot, Pinpoint Targeting);
  - the eight critical feats, such as Bleeding Critical, and Critical Mastery;
  - improvised weapons, which are not computed: Catch Off-Guard, Improvised Weapon Mastery and Throw Anything;
  - Improved Natural Attack, which isn't CRB and which no Modifier expresses.
- **Attack Routines.**
  - A Character attacks through Attack Routines, state-only sheet entries. Each names the main weapon and whether it is held in two hands or one, an optional off-hand weapon, its natural attacks, and the Routine Options switched on.
  - Adding a weapon to Gear also adds a routine for it, held its natural way. A shield doesn't: its bash is picked into a routine by hand. The player renames, edits, deletes and adds routines.
  - A routine whose weapon has left Gear stays, with an advisory warning.
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
- **Armor check penalty.** The sum of active armor's and shields' `acp`, after masterwork and material.
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

Decided by [Decide which rules checks the builder warns about](https://github.com/AndreasUnunger/EverythingPath/issues/215), with proficiencies revised by [Decide how the builder treats the remaining CRB attack feats and open attack rulings](https://github.com/AndreasUnunger/EverythingPath/issues/237) (see "Proficiencies"). Every check is advisory (Principle 5). The approved prototype fixed the presentation ([Prototype the character creation and level-up flow](https://github.com/AndreasUnunger/EverythingPath/issues/208)): warnings show inline next to their field, and blue outlines mark only what Class Levels leave unfilled.

**Where checks run.**
- `sheetWarnings` is a pure function beside the resolver. Its warnings are computed on the client and never stored.
- Warnings appear only on the Character Sheet. Characters & officers, the Characters area and the campaign Characters page show no warnings or warning counts.
- A Militia-only Character gets only the level-0 warning.

**Accepted Warnings.**
- Anyone who can edit the sheet can accept a warning as intended. No reason is asked for, which sets it apart from the militia's Rules Exception.
- An accepted warning collapses to a muted "Accepted" line, and anyone can reopen it.
- An `acceptedWarning` row is keyed by check, subject and a fingerprint of the facts that raised the warning. When those facts change, the warning reopens: accepting 22 of 20 points doesn't cover 25 of 20.
- Deleting the subject deletes the acceptance. Blue outlines can't be accepted, because they mark unfilled fields, not broken rules.

**Settings.** The base entry holds how the Character was built, as facts of the Character rather than of a campaign:
- `abilityMethod`: point buy with a budget, or rolled;
- `traitCount`;
- `campaignTraitRequired`.

A new Character gets 15-point buy (Standard Fantasy), 2 traits and no campaign trait. Backfilled Characters get rolled.

**What the sheet records for checks.**
- Alignment.
- Deity, as a free-text name matched to deity clauses by name.
- Each feat's `choice` and the slot it fills.
- The favored classes, on the race sheet entry.
- The player's proficiency additions and removals, and each Class Level's `proficiencyChoice` (see "Proficiencies").
- Region is never recorded.
- Racial Traits, as sheet entries (see "Racial traits").
- Each item's enhancement, masterwork, material and Item Abilities (see "Weapons and armor").

**Clauses that can't be checked show nothing.** A prerequisite clause the sheet has no fact for, or that the importer couldn't parse, shows no warning and no "not checked" line. This covers region, senses such as darkvision, a clause forbidding a racial trait, and a cleric's alignment relative to the deity. The entry's prerequisite prose stays readable in its description.

### The checks

| Check | Reads | Data from |
|---|---|---|
| **Level 0:** a PC with no Class Levels | Class Levels | sheet |
| **Point buy:** a `base` score outside 7–18, or the cost over the budget; under budget shows only the "N left" counter; nothing when rolled | `base` Modifiers, `abilityMethod` | CRB cost table |
| **Hit points:** `hpGained` outside 1 to the hit die; a PC with no racial Hit Dice whose first Class Level isn't the hit die's maximum | Class Levels | class `hitDie` |
| **Ability increase:** at a Class Level where neither the character level nor the Hit Dice count is 4, 8, 12, 16 or 20; a prompt where one is due | Class Levels, racial Hit Dice | sheet |
| **Skill rank budget:** per Class Level, max(1, ranks per level + Int modifier) + each active Racial Trait's `bonusSkillRanksPerLevel` + 1 for a skill-rank favored class bonus; racial skill ranks get `skillRanksPerHitDie` + Int, at least 1, per racial Hit Die; over budget warns | the archetype's or class's ranks per level; current permanent Int | class, archetype, racial trait |
| **Rank cap:** at each Class Level position, a skill's ranks so far exceed racial Hit Dice + position; racial skill ranks are capped by racial Hit Dice | ranks per Class Level | sheet |
| **Feat slots:** feats over or under 1 + one per odd Hit Die, plus `grantsSlots` | Hit Dice, active entries | Curation Overlay (`grantsSlots`) |
| **Bonus feat type:** a feat in a bonus slot whose `featTypes` miss the slot's | feat `slot` | Foundry feat types |
| **Prerequisites as taken:** a feat checked against the Character as of its `gainedAtClassLevel`; a prestige class as of the Class Level before its first | historical sheet | parsed `prerequisites` |
| **Prerequisites now:** the same clauses against the current sheet ("can't be used while unmet"). Both prerequisite checks skip a feat in a slot with `ignoresPrerequisites` | current sheet | parsed `prerequisites` |
| **Duplicate feat:** a second copy of a `no` feat; a second copy of a `newChoice` feat with the same `choice`, case-insensitive; never for `yes` | feat entries | `repeatable` (importer, Curation Overlay) |
| **Duplicate trait** | trait entries | sheet |
| **Favored class:** more favored classes than the favored class count (2 if an active Racial Trait sets `favoredClassCount`, else 1); a prestige class as a favored class; a favored class bonus on a level of a class that isn't favored, or on a prestige level | race entry state, Racial Traits, Class Levels | racial trait (Curation Overlay), `classKind` |
| **Traits:** more than `traitCount`, +1 for a drawback (only one drawback counts), +2 per Additional Traits; two from one `traitType` list; a race trait for a race the Character neither is nor counts as (`countsAsRaces`); no campaign trait when required; an NPC with traits but no Additional Traits | trait entries | `traitType`, `prerequisites` |
| **Class alignment:** a Class Level whose class's `alignments` exclude the current alignment | alignment | Curation Overlay, for the 9 Foundry classes; scraped prestige classes carry it as a clause |
| **Racial traits:** two alternates replacing the same standard trait (APG); an alternate for a race the Character neither is nor counts as, except a half-orc taking orc alternates (*Advanced Race Guide*, at the GM's discretion); a standard trait neither on the sheet nor replaced prompts "Add" | Racial Trait entries, race | `racialTraits`, `replaces` |
| **Archetypes:** two on one class replacing or altering the same row (one feature at one class level); an Archetype on a class the Character has no levels in; the Unchained warnings (see "Unchained Classes") | archetype entries | `replaces` |
| **Class features:** a feature in `featuresByLevel` missing from the sheet prompts "Add"; a due selection in `picksByLevel` prompts "choose a rage power"; a duplicated feature with an upgrade prompts adding it (see "Stacking") | Class Levels | Curation Overlay, scraped dataset |
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

**Skill ranks follow Intelligence retroactively.** The CRB glossary says a permanent ability increase means you "modify all skills and statistics related to that ability. This might cause you to gain skill points", and drain "might cause you to lose skill points". So every Class Level's budget uses the current permanent Int modifier. The headband's fixed skill ranks are *Ultimate Equipment* rules and aren't admitted, so a headband counts as ordinary permanent Int.

**Item construction.** Decided by [Decide how enhancement and special abilities attach to weapons and armor](https://github.com/AndreasUnunger/EverythingPath/issues/236). The five item checks run per end of a double weapon and per shield bash. Flat-priced abilities (*shadow*, *glamered*) count as +0.

**Favored class.** It is chosen on the race sheet entry, once a race is set. The count comes from Racial Traits (see "Racial traits"). Unchained Class levels count as the original's. Favored class options stay a free-text note and are not checked against race and class pairs. A change of favored class after creation can't be detected and isn't checked.

### Prerequisites

The importer parses each Prerequisites or Requirements line into clauses ([Find how the Foundry pf1 dataset encodes prerequisites](https://github.com/AndreasUnunger/EverythingPath/issues/214), `research/pf1-prerequisite-data`). The AoN scraper does the same for prestige classes and archetypes, and its unmatched records go to hand review. The Curation Overlay corrects misparses and adds the "counts as X for prerequisites" substitutions, which exist only in prose. Counting as another race is `countsAsRaces` (see "Racial traits").

```ts
type Prerequisite =
  | { anyOf: Prerequisite[] }                                      // "or" clauses
  | { ability: AbilityKey; min: number } | { bab: number }
  | { skillRanks: SkillKey; min: number }
  | { feat: Id<'catalogEntry'>; choice?: string }                  // `@UUID` first, then exact name
  | { classFeature: string }                                       // by name, ignoring `(UC)`
  | { racialTrait: string }                                        // "hardy racial trait": by name, ignoring a "(Race)" suffix
  | { classLevel: Id<'catalogEntry'>; min: number } | { characterLevel: number }
  | { race: Id<'catalogEntry'>[] } | { alignment: Alignment[] } | { deity: string }
  | { casterLevel: number }                                        // the highest caster level among the Spellcastings
  | { canCast: { spellLevel: number; kind?: 'arcane' | 'divine' | 'psychic' } } // "able to cast 3rd-level arcane spells"
  | { castsSpell: Id<'catalogEntry'> }                             // "able to cast dimension door"
  | { proficiency: ProficiencyGrant }                              // "Martial Weapon Proficiency"; { choice: true } = "proficiency with selected weapon"
  | { unchecked: string };                                         // parsed but unmodelled, or unparsed: shows nothing
```

Clauses follow the CRB FAQ:
- Numeric clauses are inclusive.
- A feat clause needs only the feat, not that feat's own prerequisites.
- A class feature replaced by an Archetype doesn't count. Nor does a Racial Trait replaced by an alternate.
- A `race` clause is met by the Character's race or by any active entry's `countsAsRaces`.
- A same-named feature of either version of an Unchained Class counts.
- Unchained Class levels count as the original's.
- A spell-like ability meets an "able to cast" clause only when the clause names the spell. Spell-like abilities are prose, so such a clause met only by one shows nothing.
- `canCast` is met by a Spellcasting of that `spellKind` that can cast that level (castable spell levels, see "Derived per Spellcasting"; [Decide how spellcasting fits the Character Sheet](https://github.com/AndreasUnunger/EverythingPath/issues/218), [Prototype the spellcasting section on the living sheet](https://github.com/AndreasUnunger/EverythingPath/issues/233)).
- `castsSpell` is met by a Spellcasting with that Spell recorded or granted, or, for a `none` Spellcasting, with it on its class list at a level it can cast.
- A `proficiency` clause is met by the Character's derived proficiencies, whatever grants them (see "Proficiencies"): a fighter meets "Martial Weapon Proficiency" without the feat. The importer parses a proficiency feat named as a prerequisite (Martial Weapon Proficiency, Heavy Armor Proficiency, Exotic Weapon Proficiency for an exotic weapon) and "proficiency with selected weapon" into one. `{ choice: true }` reads the entry's own `choice`, so Weapon Focus checks its chosen weapon.

`gainedAtClassLevel` dates a feat. The historical sheet at Class Level *k* counts the Class Levels up to *k*, the entries gained at or before *k*, and every entry without a gained level, such as items. A feat without a gained level is checked only against the current sheet. The two checks have their own copy, for example "Power Attack needed BAB +1 when taken at level 1" and "Power Attack: Str 13 no longer met; it can't be used." Later prestige levels have no requirement check.

## Temporary Effects

An entry is a Temporary Effect according to its kind:

| Temporary | Permanent |
|---|---|
| `spellEffect` with `lastsOverOneDay: false` | every other kind, including Spell Effects with `lastsOverOneDay: true` and `spell` |
| `condition` | |
| `item` with `consumable: true` | |
| `abilityDamage` | `abilityDrain` |

The derived sheet applies every active entry to every statistic, HP included. Hit points from a temporary Con bonus are not temporary hit points. Three calculations count permanent entries only:

- Militia Character Facts;
- the skill-rank budget;
- bonus spells.

This narrows "running spells" in [Decide what the militia reads from a Character Sheet, and when](https://github.com/AndreasUnunger/EverythingPath/issues/205) to Spell Effects lasting a day or less, which is the official 24-hour rule. A recorded `spell` grants no Modifiers, so it never affects these.

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

Decided in [Decide how Characters exist outside a campaign, and the app's home](https://github.com/AndreasUnunger/EverythingPath/issues/212); see [ADR 0002](adr/0002-characters-owned-by-users-move-between-campaigns.md).

- **Character Owner.** The user who created the Character.
  - Outside a campaign, only the owner can see and edit it.
  - Inside a campaign, everyone in the campaign can edit it, and ownership grants nothing extra.
  - Anyone in the campaign can hand ownership to another member of the campaign's organization. Outside a campaign, ownership never changes.
- **Joining a campaign.** Joining moves the Character itself into the campaign; it is never copied.
  - It doesn't put the Character on the militia roster. That stays a "Correct roster" Militia Correction.
  - "Add to a campaign" offers the active organization's campaigns.
- **Leaving a campaign.** The owner can take a Character out, back to no campaign or into another campaign. In one mutation, leaving does three things:
  - It takes the Character off the militia roster, out of its officer roles and out of team management. This is recorded as a Militia Correction with an automatic reason, and Staged Action Choices it affects must be reviewed before Confirmation.
  - It detaches every sheet entry that points at a campaign Catalog Entry into a character-scoped copy, so the sheet doesn't change.
  - A Militia-only Character becomes Full.
- **History.** Finished weeks read only their frozen snapshots, so leaving a campaign changes no past week.
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

## Catalog scopes

- **Global:** the imported catalog, read-only for players. See "Global catalog import".
- **Campaign:** homebrew that anyone in the campaign can use and edit.
- **Character:** one-offs on a single Character, such as base scores, manual adjustments and tweaks.

Adding a one-off inserts its character-scoped Catalog Entry and its sheet entry in one mutation. "Save to catalog" rescopes a character entry to the campaign. "Detach" clones a global or campaign entry into a character-scoped one and repoints the sheet entry. "Customize for campaign" clones a global entry into campaign scope, repoints every sheet entry in that campaign, and makes the picker show the copy in place of the original for that campaign.

Both clones record `copiedFrom` and the original definition's fingerprint. A copy's own fields never follow later changes to its original. Its retained references to global Catalog Entries follow the active Catalog Release: a copied magic weapon can still change when its global Base Item or Item Ability changes. Copying does not recursively freeze its dependencies, and references to local entries keep their existing behavior.

The upstream-change advisory compares the active original's definition fingerprint with the one recorded at copy time. An unrelated release does not warn. `copiedFrom` alone is provenance, not a calculation dependency; retained references are calculation dependencies. Campaign-departure copying and access rules remain with [Decide how campaign homebrew moves with a Character](https://github.com/AndreasUnunger/EverythingPath/issues/244).

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

  Goods and services, third-party packs and 3.5 packs are not imported.
- **Buffs.** A spell buff becomes a `spellEffect` entry, with `lastsOverOneDay` taken from its duration and `defaultCasterLevel` from its `level`. Its `spellKey` comes from its first `Compendium.pf1.spells` link when the names agree (177 of 185). Otherwise the import report proposes one and the Curation Overlay decides. Class and item buffs become their own kinds.
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
- **Pipeline.**
  - The repo pins a release tag of each upstream repo, never an unreleased commit ([Decide which Foundry pf1 release the catalog import pins](https://github.com/AndreasUnunger/EverythingPath/issues/223)). The pins are system `v11.11` and pf1-content `11.4.0`. Both repos must share a major version, and the import fails if they don't.
  - The importer maps one upstream shape, the v11 one, in which class skills are a boolean map, class features are listed in `links.classAssociations`, skill targets use three-letter keys such as `skill.per`, and `system.changes` is an array. Pack files are read recursively from a checkout of the tag, so Foundry itself never runs.
  - The owner bumps a pin by hand within the major. The next major waits until both repos have released it, and then moves both together as a separate effort that replaces the mapper.
  - Fixes on upstream master that aren't released yet are not backported. A Curation Overlay correction is written only for a mistake that matters, and a bump's import report flags it once upstream has the fix.
  - The owner manually increments the Catalog Release number to trigger an import. Input fingerprints guard against a forgotten bump; neither a pin change nor another input change releases content automatically. See "Catalog releases" below.
  - Every release PR carries a committed import report: counts per pack, additions, edits, retirements and remaps, affected resources, unsupported changes, overlay records that no longer apply, note records by status, and gate results.
- **Updates.** An import finds stable identities by `externalKey` and reviewed remaps, then prepares release-specific bodies. Sheet references and stacking identity stay stable. A removed entry retains a usable definition and becomes `retired`, hidden from ordinary pickers and never deleted.
- **Keys.**
  - Upstream keeps a record's `_id` through edits, renames and pack moves, while pack names change ([Check whether Foundry pf1 record IDs stay stable across releases](https://github.com/AndreasUnunger/EverythingPath/issues/211), `research/pf1-foundry-id-stability`). That is why the key leaves out the pack.
  - The Curation Overlay holds a reviewed remap list for the cases that would otherwise break the key: records that move between the two repos, upstream merges, and the rare record re-created with a new `_id`.
  - Upstream's own redirect tables are not trusted.
- **Batches.** The recorded import prepares a private candidate in idempotent, resumable batches. Definitions, references, remaps, supporting resources, legal output and affected Militia Character Facts become current together through the publication protocol below; completing import batches alone does not publish anything.
- **Legal page.** Decided by [Find the Section 15 text for every imported source book](https://github.com/AndreasUnunger/EverythingPath/issues/224) and [Decide how the import keeps its Section 15 notices complete](https://github.com/AndreasUnunger/EverythingPath/issues/227). The import generates an in-app legal page, linked from every page's footer. Its parts, in order:
  - the OGL 1.0a text;
  - a Section 15 of the OGL and SRD lines, both upstream `OGL.txt` notices verbatim, the Section 15 Registry notice for every book in the import's book set, and an EverythingPath line for our original Open Game Content;
  - a Section 8 statement;
  - the Paizo Community Use notice.

  The Section 15 Registry is a reviewed file in the repo beside the Curation Overlay, keyed by product code. Each record holds `title`, `notice` (the book's own Section 15 lines verbatim, inherited third-party lines included, the OGL and SRD lines left out), `checkedAgainst` (`printed`, `prd`, `aon` or `pf1-content`), `checkedOn` and optional `aliases` for broken upstream codes.
- **Book set.** It is every code cited by an imported entry, every book in the AoN-scraped dataset, and every book found by a one-off attribution pass run when the registry is built. The pass matches unsourced records by name against Archives of Nethys and follows links. Its matches are committed as evidence and never become entry `sources`. Records it cannot match are listed in the import report and stay imported.
- **Notice gate.** The import fails if any book in the book set lacks a registry record. An entry whose book has no confirmed notice is not imported: a Curation Overlay exclusion record gives the reason, and the import report lists the entry, so it can return once someone checks the printed book. Excluded now: the Dynamite comics, *Pathfinder Online: Thornkeep*, *PFS Scenario #4-12*, *Horror Realms* and *Shattered Star #4*.
- **Sources.** `sources` serve the licence only. An entry shows its source where it has one, there is no book filtering, and unsourced records stay unsourced.
- **Notice review.** Before launch, every book in the set has a registry record and every disagreement between seed sources is settled against the book. The known errors are fixed: *Ultimate Combat*'s authors and AoN's *Occult Mysteries* block. The free-PDF gaps and the owner's copies of *Goblins of Golarion*, *Faiths of Purity* and *Bestiary 6* are transcribed. All other records ship checked against `prd`, `aon` or `pf1-content`, and printed checks continue after launch, most-cited first.

The base scores are one character-scoped `base` entry with six `base` Modifiers. Every Character has exactly one sheet entry for it, which cannot be removed or deactivated.

### Catalog releases

Decided by [Decide how catalog revisions are detected and activated](https://github.com/AndreasUnunger/EverythingPath/issues/239). This replaces pin-only detection, in-place global updates and the end-of-import facts recalculation from [Decide how the content dataset becomes the global catalog](https://github.com/AndreasUnunger/EverythingPath/issues/207).

- **Release identity.** Each manually incremented number binds an immutable manifest and generated artifact. The release check fails if declared inputs change without a bump, or a number is reused for different inputs or output. Unchanged inputs and number are a no-op or resume that unfinished run. The manifest fingerprints the upstream tags and their resolved content; the Curation Overlay, remaps, exclusions and note records; local content; output-affecting mapping, parsing, sanitizing and configuration; casting, creature-type and other rule resources; attribution evidence, the Section 15 Registry and legal-page resources. Unrelated application code is excluded. Compare deterministic normalized output to identify actual definition and resource changes; a notice-only release need not affect any Character.
- **Private preparation.** Prepare one candidate against the active release, keeping all ordinary reads and edits available. Candidate entries never appear in pickers, and candidate remaps cannot redirect active references. All references, including sheet entries, catalog references and `copiedFrom`, keep pointing to stable identities rather than staging rows. Existing content and notice gates still apply. Preparation never changes live definitions or invalidates a reviewed week.
- **Impact.** Find potentially affected Characters through the reverse dependency closure of both old and new definitions and resources. Include references in sheet state (Class Levels, Item Abilities, Routine Options and Spellcasting), Base Items, catalog-to-catalog references, key-based joins, derived grants and built-in resources. Added and removed relationships count. Catalog Copies participate through their retained global references. Recalculate only potentially affected Characters with the existing `militiaCharacterFacts` function and permanent-effect rules; a resource shared by all Characters can affect them all. Store no general sheet-stat cache, and change the militia's effective review revision only when the resulting facts differ.
- **Capture concurrent edits.** Register the candidate before enumerating affected Characters. Every relevant write updates active state normally and transactionally marks candidate work dirty: sheet and local-definition edits, new Characters or dependencies, detach/customize, campaign and roster moves, archive/delete and related changes. Active Militia Character Facts still update in the ordinary write's transaction when their values change. A candidate calculation error cannot reject an otherwise-valid active edit. Candidate workers tag results with their sheet, local-definition, relationship and membership inputs, and clear dirty work only if those inputs still match. Enumeration must include work discovered while it runs.
- **One publication boundary.** The militia's character-facts portion is a versioned projection selected with the same active-release boundary as definitions. Other militia state remains live; never stage and later restore a whole campaign snapshot. Every canonical-state reader and writer, including mutation preconditions, Setup, `requireReviewedCharacters`, Confirmation, Militia Correction and History Rewrite, uses this boundary. Publishing definitions and patching embedded facts afterward is insufficient. The effective review revision includes the ordinary mutation revision and the selected facts generation for that campaign. Reuse the generation when facts are equal; publication changes it once for each campaign whose current facts differ, making only those earlier reviews stale. Subsequent ordinary edits maintain the selected live facts normally.
- **Atomic activation.** One bounded transaction verifies that the candidate's base release is still active, import/reference/gate checks passed, discovery finished and no dirty or pending facts work remains. It then switches the active release and facts selection together, without looping through Characters. Concurrent writes participate in this readiness protocol: they commit before activation and must be reconciled, or retry/read after it and use the new release. There is no maintenance window or gameplay write freeze. Each query and derived view uses one coherent release and input snapshot; clients keep a complete prior view until the next complete view arrives. They preserve entered draft fields. Gameplay commands use current server state and existing stale-review checks, without a new catalog-version permission prompt.
- **Runtime compatibility.** The manifest records required schema and calculation compatibility. Compatible readers, writers and calculation behavior must be available before activation, including support for already-open clients. A code deployment cannot reinterpret the active catalog before matching facts are ready. A resolver change that affects facts with identical catalog rows follows this same protocol, including its calculation behavior in the manifest and impact analysis. Catalog publication alone does not change Ruleset Version; changes to Weekly Resolution behavior follow the existing policy. The initial schema/backfill establishes this access boundary through the planned maintenance window and reload policy in "Migration and release" below ([Decide how the character builder release migrates safely](https://github.com/AndreasUnunger/EverythingPath/issues/240#issuecomment-5954578153)). That one-time allowance does not change ordinary Catalog Releases' uninterrupted reading and editing or support for already-open clients.
- **Failure and retry.** Incomplete or failed preparation leaves the active release and its live facts serving everyone. Retry resumes the same immutable artifact; changed inputs require a new number. Failed activation publishes nothing. If its response is lost, inspect the authoritative active release/run before retrying. Obsolete workers cannot write into a different or activated run. Competing activations are serialized; a changed base requires a fresh comparison and reconciliation.
- **Rollback.** Publish another manually numbered release using earlier definitions and the same protocol against current sheets and local definitions. Never restore player or militia snapshots. Entries introduced since the target remain addressable with their last usable definitions but become retired; retain the dependencies needed to resolve them. Reviewed remaps cannot destroy existing identities or change their kinds incompatibly; an incompatible kind change gets a new identity. Keep legal notices as the existing permanent superset. Preserve selected entries, quantities, choices, customizations and copied defaults, including item magic state, Spell Effect caster levels and editable racial progression. Import and rollback never reapply defaults or replace sheet choices. Finished weeks and their frozen Resolution Records stay unchanged.

## Resolver

The resolver lives in `src/lib`, is pure, and is shared by the client and Convex:

```ts
type SourcedModifier = Modifier & { sheetEntryId: string; entryName: string; source: string; builtIn: boolean };

collectModifiers(character, entries, catalog): SourcedModifier[]   // active entries, their Item Abilities + built-ins from state
resolveSheet(modifiers, { permanentOnly?: boolean; situations?: Situation[] }): ResolvedSheet // staged; each statistic → { total, applied, suppressed, conditional }; plus one resolved Spellcasting per casting class
resolveRoutine(character, sheet, routine, { situations? }): { single, attacks }   // see "Attacks"
militiaCharacterFacts(character, entries, catalog): MilitiaCharacterFacts // permanentOnly; the one function the militia uses
sheetWarnings(character, entries, catalog, accepted): SheetWarning[]   // see "Rules checks"; client only, never stored
```

## Migration and release

Decided by [Decide how the character builder release migrates safely](https://github.com/AndreasUnunger/EverythingPath/issues/240#issuecomment-5954578153). This amends the release sequence in [Reconcile the sheet data model with one Character identity](https://github.com/AndreasUnunger/EverythingPath/issues/206#issuecomment-5930864770) and spell-retirement timing in [Decide how spellcasting fits the Character Sheet](https://github.com/AndreasUnunger/EverythingPath/issues/218#issuecomment-5950044118). These are implementation requirements, not a record of a completed migration.

One product release has separate preparation and activation steps. Merging prepares it; an operator explicitly starts a planned read-only window once the frontend and catalog are ready. Tabs opened before cutover reload before saving afterward. These allowances apply only to this initial migration, not later Catalog Releases.

1. **Prepare compatible code and content.** Add schema and functions while flat Character fields remain readable and writable through the existing contract. Preserve Character IDs, campaign and owner references, descriptions, kinds and active state. Stage the initial immutable Catalog Release, stable identities, definitions, resources and legal output privately. Publish and verify a frontend that supports the existing state, maintenance and the new state, with the builder inactive. Verify backend compatibility before maintenance. All readers and writers must honor the same server-selected authority, including the mirror writer, Setup, `requireReviewedCharacters`, Confirmation, corrections and History Rewrite. Under sheet authority, they derive Militia Character Facts through the shared resolver; Character writers, including fixtures, write the sheet.
2. **Separate deployment from activation.** Build success, backend deployment, frontend publication and activation are separate checks. The current `pnpm deploy:convex` wrapper builds the frontend before pushing Convex functions; its generated-file check and site publication can fail after the backend changes. A failed preparation leaves compatible code serving the existing contract and gameplay available. Frontend failure is not a backend rollback.
3. **Close the write gate explicitly.** Record the migration run and atomically close a server-enforced gate covering every writer of Characters, membership/ownership, roster references, militia state or migration inputs, including background jobs, fixtures, imports and administrative paths. A write committed before closure is included; later writes, including old-client commands, are rejected without mutation. Reads keep serving the complete existing state. Show maintenance feedback and ask players to save beforehand; old bundles cannot be assumed to preserve unsaved input across reload, and rejected commands are not replayed automatically. This is an operator procedure, not a gameplay permission.
4. **Backfill private candidates.** Enumerate all Characters only after closure. Use bounded, idempotent, resumable batches, retaining the flat source values. Each candidate gets exactly one base-scores entry from the recorded scores, `abilityMethod: 'rolled'`, the recorded number of ordered Unspecified Class Levels and `sheetMode: 'militiaOnly'`. Keep partial candidates invisible and preserve identity and ownership. Completion markers identify the run and source inventory they certify; retries cannot duplicate entries.
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
- `sheetWarnings`: each check in "Rules checks", including the cumulative rank cap, the retroactive Int budget, prerequisites as taken and now, `ignoresPrerequisites`, `newChoice` duplicates, the item construction checks per end and per bash, `proficiency` clauses met by any grant, the one-handed exotic warning with no other warning for being nonproficient, and an Accepted Warning reopening when its fingerprint changes.

Integration tests (convex-test) must cover:

- a backfilled Character's Militia Character Facts equal its old flat values;
- a sheet edit that doesn't change the facts leaves the `canonicalMilitiaState` revision untouched;
- editing a militia-only Character's score adjusts its base score;
- a full Character's level can't be edited through Characters & officers;
- campaign scoping of every catalog and sheet read;
- owner-only access to a Character in no campaign, and campaign access once it joins;
- leaving a campaign removes the Character from the roster, its roles and team management as one Militia Correction, detaches campaign catalog entries without changing the resolved sheet, and leaves past Resolution Records untouched;
- deleting is refused for a Character in a campaign.
- an Accepted Warning follows its Character between campaigns and is deleted with its subject.

Catalog-release handoff checks must demonstrate:

- an overlay-only input change needs a manual release bump; changed inputs or output under an existing number fail, and unrelated application changes do not import;
- halfway batch failure, activation failure and a lost activation response leave one coherent authoritative release and recover idempotently;
- concurrent edits, newly added dependencies and campaign moves appear in candidate facts without freezing gameplay or losing intervening militia changes;
- indirect users, including Catalog Copies with global references, update while unrelated Characters and unchanged facts leave militia reviews untouched;
- notice-only releases leave facts and reviews unchanged, while changed facts make affected reviews stale at publication;
- copies keep their own fields, follow retained global references and warn only when the original definition differs from its copied fingerprint;
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
