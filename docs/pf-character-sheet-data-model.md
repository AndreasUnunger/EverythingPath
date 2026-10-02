# Pathfinder character sheet data model

Revised by [Reconcile the sheet data model with one Character identity](https://github.com/AndreasUnunger/EverythingPath/issues/206) on the [Pathfinder 1e character builder](https://github.com/AndreasUnunger/EverythingPath/issues/201) map. It follows [ADR 0001](adr/0001-one-character-identity.md): the builder extends the existing `character` table, and every Character has a Character Sheet. Terms are defined in [`CONTEXT.md`](../CONTEXT.md).

Rules sources:

- [Collect the official PF1 bonus-stacking and target rules](https://github.com/AndreasUnunger/EverythingPath/issues/209) (`research/pf1-official-stacking-rules`)
- [Find how official PF1 rules treat "functions as" wordings for stacking](https://github.com/AndreasUnunger/EverythingPath/issues/210) (`research/pf1-functions-as-stacking`)
- [Survey how existing PF1 builders model characters](https://github.com/AndreasUnunger/EverythingPath/issues/203) (`research/pf1-builder-models`)
- [Collect the official rules for racial Hit Dice progression](https://github.com/AndreasUnunger/EverythingPath/issues/220) (`research/pf1-racial-hit-dice`) and its follow-up on FAQ and designer rulings (`research/pf1-racial-hd-level-rulings`)
- [Collect the official PF1 spellcasting rules](https://github.com/AndreasUnunger/EverythingPath/issues/231) (`research/pf1-spellcasting-rules`) and [Compare the spell data sources for spellcasting](https://github.com/AndreasUnunger/EverythingPath/issues/217) (`research/pf1-spell-data`)

Only official Paizo text decides a rule: the Core Rulebook, plus the official FAQ and errata. Where it is silent, the model follows the literal text and adds nothing. [Set the coverage bar for archetypes and prestige classes](https://github.com/AndreasUnunger/EverythingPath/issues/219) also admits, with their FAQ and errata: the *Advanced Player's Guide* archetype rules, its favored class option rules, the trait rules of the *Advanced Player's Guide* and *Ultimate Campaign*, and *Pathfinder Unchained*'s classes ([Decide which Pathfinder Unchained rules the builder supports](https://github.com/AndreasUnunger/EverythingPath/issues/226)). [Decide how spellcasting fits the Character Sheet](https://github.com/AndreasUnunger/EverythingPath/issues/218) admits each casting class's own spellcasting section, for that class only. Other Paizo books supply catalog content, not rules.

## Principles

1. **Stat totals are never stored.** They are derived from Modifiers every time by a pure resolver. The sheet UI and the server's Militia Character Facts calculation share that resolver.
2. **Everything on the sheet is a Character Sheet Entry.** This covers gear, spells, features, base scores, Class Levels and ability damage.
3. **Modifiers live on Catalog Entries.** A one-off item, a manual adjustment and the base scores are Catalog Entries scoped to one Character. The exceptions are Class Levels, ability damage and ability drain. They hold only Character state, and the resolver turns that state into built-in Modifiers.
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

// The only place authored Modifiers are stored. Scope decides who sees it.
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
  externalKey?: string,                // global scope: `<repo>/<_id>`, the upsert key; the pack is an ordinary field
  retired?: boolean,                   // global scope: removed upstream; hidden from pickers, kept for sheets
  copiedFrom?: Id<'catalogEntry'>,     // campaign or character copy of another entry
  unsupported?: string[],              // importer notes: unmappable targets, formulas outside the grammar
  prerequisites?: Prerequisite[],      // feats, traits, prestige classes, archetypes; all must hold, see "Rules checks"
  grantsSlots?: Array<{ kind: 'feat' | 'trait'; count: number;   // bonus feats (fighter, human), Additional Traits
    featTypes?: string[];              // a bonus feat must carry one of these Foundry feat types, such as 'combat'
    ignoresPrerequisites?: boolean }>, // monk bonus feats, ranger combat style
  routineOption?: true,                // a Routine Option, set by the Curation Overlay; see "Attacks"
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

The old `spell` and `characterSpell` tables retire in the builder release (see "Migration and release"). Spells are `spell` Catalog Entries (see "Spellcasting").

### Entry kinds

```ts
// Catalog-backed: the sheet entry points at a Catalog Entry of the same kind.
type CatalogKind = 'base' | 'race' | 'class' | 'archetype' | 'classFeature' | 'feat' | 'trait'
                 | 'item' | 'spell' | 'spellEffect' | 'condition' | 'manual';
// State-only: no Catalog Entry; the resolver emits built-in Modifiers from state.
type StateKind = 'classLevel' | 'abilityDamage' | 'abilityDrain' | 'attackRoutine';
type EntryKind = Exclude<CatalogKind, 'class'> | StateKind;   // a class is reached through Class Levels

type CatalogEntryDetail =
  | { kind: 'base' }
  | { kind: 'race'; racialHitDice: number;                      // 0 for every core race
      favoredClassCount: 1 | 2;                                  // 2 for Multitalented; set by the Curation Overlay
      bonusSkillRanksPerLevel: number;                           // 1 for the human's Skilled; set by the Curation Overlay
      racialProgression?: { creatureType: CreatureType;          // needed when racialHitDice > 0
        hitDie: number; bab: 'full' | 'threeQuarters' | 'half';
        saves: Record<'fort' | 'ref' | 'will', 'good' | 'poor'>;
        skillRanksPerHitDie: number; classSkills: SkillKey[] } }
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
        grants?: { list: 'domain' | 'subDomain' | 'bloodline'; key: string }; // a Foundry `learnedAt` list: its Spells are granted
        school?: SchoolKey } }                                    // an arcane school: the specialist school
  | { kind: 'feat'; featTypes: string[];                         // Foundry feat types: 'combat', 'general', 'teamwork'…
      repeatable: 'no' | 'newChoice' | 'yes' }                    // "You can gain this feat multiple times"
  | { kind: 'trait'; traitType: string }                         // Foundry `traitType`: 'combat', 'faith', 'region', 'drawback'…
  | { kind: 'item'; consumable: boolean;                        // later: slot, weight, price
      weapon?: { baseType: string;                               // Foundry `baseTypes`: what Weapon Focus names
        group: WeaponGroup;                                      // Foundry `weaponGroups`
        handedness: 'light' | 'oneHanded' | 'twoHanded' | 'ranged';
        dice: string;                                            // "1d12", from `sizeRoll(1, 12, @size)`
        threat: number; mult: number;                            // lowest threat roll (20, 19, 18) and multiplier
        rangeIncrement?: number; strRating?: number;             // feet; composite bows
        reload?: 'free' | 'move' | 'fullRound';                  // crossbows
        finesse: boolean;                                        // Foundry `system.properties.fin`: Weapon Finesse applies
        thrown: boolean;                                         // has a thrown attack (a `twak` action): dagger, spear, javelin
        otherEnd?: { dice: string; threat: number; mult: number }; // a double weapon's second end
        natural?: 'primary' | 'secondary' } }                    // a natural weapon; the type is written from the rules
  | { kind: 'spell';                                           // the Spell itself; grants no Modifiers
      levels: Record<ClassTag, number>;                          // Foundry `learnedAt.class`; the record's own `level` is ignored
      grantedLevels: Partial<Record<'domain' | 'subDomain' | 'bloodline', Record<string, number>>>; // the rest of `learnedAt`
      school: SchoolKey; subschools: string[]; descriptors: string[] }  // the stat block stays in the description
  | { kind: 'spellEffect'; spellKey?: string;                    // the Spell's `externalKey`
      lastsOverOneDay: boolean; defaultCasterLevel: number }      // Foundry's buff `level`, used when spellKey is absent
  | { kind: 'condition' } | { kind: 'manual' };

type SheetEntryState =
  | { kind: 'classLevel'; classEntryId: Id<'catalogEntry'> | null;   // null = Unspecified Class Level
      position: number;                                               // character level this row is, 1-based
      castingAdvances: Array<Id<'catalogEntry'> | null>;              // prestige levels: the class each advance goes to
      hpGained: number | null;
      favoredClassBonus: null | { choice: 'hp' } | { choice: 'skill' } | { choice: 'alt'; note: string };
      abilityIncrease: AbilityKey | null;
      skillRanks: Partial<Record<SkillKey, number>> }
  | { kind: 'base';                                                  // the one base-scores entry also holds sheet-wide facts
      alignment: Alignment | null; deity: string | null;               // deity: a free-text name
      abilityMethod: { method: 'pointBuy'; budget: number } | { method: 'rolled' };
      traitCount: number; campaignTraitRequired: boolean }
  | { kind: 'race'; racialHpGained: number | null;                  // hit points from all racial Hit Dice together
      racialSkillRanks: Partial<Record<SkillKey, number>>;
      favoredClassIds: Id<'catalogEntry'>[] }
  | { kind: 'feat'; choice: string | null;                          // Weapon Focus's weapon (a `baseType`), Skill Focus's skill…
      slot: 'general' | { grantedBy: Id<'characterSheetEntry'> } }   // the entry whose `grantsSlots` it fills
  | { kind: 'abilityDamage'; ability: AbilityKey; points: number }
  | { kind: 'abilityDrain'; ability: AbilityKey; points: number }
  | { kind: 'item'; quantity: number }                                // later: charges
  | { kind: 'spell'; castingClassId: Id<'catalogEntry'>;              // the Spellcasting it is recorded for
      level: number | null }                                          // null = the class's level for it; set for off-list Spells
  | { kind: 'spellEffect'; casterLevel: number }                      // pre-filled, see "Spell Effects"
  | { kind: 'classFeature'; oppositionSchools: SchoolKey[];          // arcane schools only; empty otherwise
      weaponGroup: WeaponGroup | null }                               // Weapon Training's chosen group
  | { kind: 'attackRoutine'; name: string;
      main?: { weapon: RoutineWeapon; hands: 'two' | 'one'; thrown: boolean }; // absent = natural attacks only
      off?: { weapon: RoutineWeapon | 'otherEnd'; thrown: boolean }; // two-weapon fighting; 'otherEnd' = the main double weapon's
      natural: Id<'characterSheetEntry'>[];                           // natural weapons attacking too
      options: Id<'catalogEntry'>[] }                                 // switched-on Routine Options, see "Attacks"
  | { kind: Exclude<EntryKind, 'classLevel' | 'base' | 'race' | 'feat' | 'abilityDamage' | 'abilityDrain' | 'item' | 'attackRoutine'
                     | 'spell' | 'spellEffect' | 'classFeature'> };

type RoutineWeapon = Id<'characterSheetEntry'> | 'unarmed';         // an item entry, or the built-in unarmed strike
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

## Archetypes and prestige classes

Decided by [Set the coverage bar for archetypes and prestige classes](https://github.com/AndreasUnunger/EverythingPath/issues/219).

- **Coverage.** Every official Paizo prestige class and archetype, from any Paizo product: rulebooks, Campaign Setting, Player Companion and Adventure Path books.
- **Archetypes.**
  - An Archetype is a Catalog Entry tied to one base class, or to both versions of one (see "Unchained Classes"). A Character takes it as a sheet entry, and it applies to every level of that class. The levels stay levels of the base class.
  - `replaces` names rows of the class's `featuresByLevel`, a feature at one class level, so "replaces armor training 1" removes only that row. An archetype feature that alters a class feature replaces that row and adds its own feature at the same level.
  - Adding an Archetype removes the class feature entries it replaces from the sheet and adds its own features at their levels, with `gainedAtClassLevel` set. Removing it reverses this. Entries added or edited by hand stay.
  - Class skills added or removed and skill ranks per level are structured. Proficiency changes and spellcasting changes stay in the description.
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
- A `none` Spellcasting records nothing. It shows its numbers and a link to browse its class list.
- **Granted Spells** are derived and never recorded. An active class feature whose `spellcasting.grants` names a domain, subdomain or bloodline grants every Spell on that list, at its `grantedLevels` level, once the Spellcasting can cast that level. Mystery, patron and spirit spells stay prose until the Curation Overlay adds them as `grants` lists. So do the oracle's and hunter's automatic cure and *summon nature's ally* spells.
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
- **Caster level:** the class's Class Levels plus `casterLevelOffset`, plus the advances assigned to it, plus `casterLevel` Modifiers. The offset applies to class levels only (S10). The caster level is shown only once the table has an entry, so a paladin shows none before 4th (S1).
- **Spells per day:** the table row, plus bonus spells, plus one extra slot per spell level from 1st when an active class feature of the Spellcasting has `extraSlot`. Several such features still give one extra slot per level. The slot row labels it "+1 domain", "+1 school (evocation)" or "+1 spirit".
- **Bonus spells:** from the CRB table, by the casting ability's permanent score (see "Temporary Effects"). They apply only at spell levels where the table has an entry, "0" included (FAQ). They add to spells per day, and never to spells known, the arcanist's prepared count, or the extra slot (S3).
- **Spells known:** the table row for `known` casters. Nothing adds to it, so feats like Expanded Arcana are covered by accepting the warning.
- **The arcanist's prepared count:** `preparedPerDay`, shown beside its spells per day. Prestige advances raise it (S12).
- **Save DC per spell level:** 10 + spell level + the casting ability modifier + `spellDC` Modifiers. A `school` condition shows a DC per school where it differs.
- **Concentration:** caster level + the casting ability modifier + `concentration` Modifiers.

The casting ability modifier for DCs and concentration is the current one, Temporary Effects included. Only bonus spells read permanent scores.

### Prestige advances

- A prestige class entry's `castingAdvances` lists, per class level, how many advances the level gives and of which kind: one for most, one arcane and one divine for the mystic theurge. The AoN scraper parses them from the level table's Spells column.
- Each prestige Class Level records, in `castingAdvances`, the class each advance goes to. An empty choice is a blue outline. It is pre-filled when exactly one Spellcasting qualifies.
- An advance adds to that Spellcasting's casting level and caster level, and so to its spells per day and spells known. Nothing else counts it (FAQ): no bloodline, domain, mystery or patron spells, no school powers.
- Choices are per level, so advances may be split across classes (S6). An advance may go to a class that doesn't cast yet. It counts once the class does (S9).
- An `arcane` or `divine` advance on a Spellcasting of another `spellKind` warns, so a psychic, alchemist or investigator takes only an `any` advance without a warning (S7, S8).

### Opposition schools

- An arcane school is a class feature with `spellcasting.school` and `extraSlot: 'school'`. Its sheet entry records the two `oppositionSchools`. A universalist has no school entry, and so no school slot.
- Every recorded Spell of an opposition school shows a "2 slots" tag, from the Spell's `school`.
- The same shape covers any other class or archetype with an arcane school and opposition schools.
- Crafting penalties for opposition schools are not modelled.

### Spell Effects

- A Spell Effect is a `spellEffect` Catalog Entry: the Modifiers a running spell grants, imported from the Foundry buffs. `spellKey` names its Spell. A Spell may have several, such as *Fire Shield*'s warm and cold shields.
- Its sheet entry records `casterLevel`, a plain number the player can change ("cast by Brother Ardo at CL 7"). Nothing links it to the caster's sheet.
- **Pre-fill.** `casterLevel` is pre-filled with the lowest caster level at which any class can cast the Spell. For each class in the Spell's `levels`, that is the caster level at the first class level whose table has an entry ("0" included) at the Spell's level for that class. *Haste* pre-fills 4, from the summoner's 2nd-level spells at summoner 4. A paladin spell of 1st level pre-fills 1. A Spell Effect without a Spell uses `defaultCasterLevel`.
- Its formulas may read `@casterLevel` (see "Formulas"). Casting a Spell from a sheet is play-time and out of scope.

## Modifiers

```ts
type Modifier = { target: Target; bonusType: BonusType; value: number | { formula: string };  // negative = penalty
                  condition?: ModifierCondition };

type ModifierCondition = {                       // every part present must hold
  situation?: Situation;                         // "vs. traps": never in a total (see "Conditional Modifiers")
  whileActive?: Id<'catalogEntry'>;              // "while raging": applies while an active entry of that Catalog Entry exists
  weapon?: '$self' | '$choice' | '$group';       // only attacks with this item, the entry's chosen weapon (Weapon Focus),
                                                 // or a weapon of the entry's chosen group (Weapon Training)
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

- **Abilities:** `ability.str`, `ability.dex`, `ability.con`, `ability.int`, `ability.wis`, `ability.cha`
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

- **Weapon conditions** apply only inside the attacks of the matching weapon: `$self` for a weapon's own enhancement, `$choice` for Weapon Focus's chosen weapon, matched on `baseType`, and `$group` for fighter Weapon Training, matched on the weapon's `group` against the entry's `weaponGroup`. They never reach the sheet-level attack statistics.
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
- **Action conditionals.** Foundry's structured action `conditionals` on 14 weapon and ability records (the double-barrelled firearms, Grab) get records the same way, as Situational Modifiers with `weapon: '$self'`. The two library records of UI helpers (`*Common Conditional Modifiers` and `*Weapon Enchant Conditional Modifiers`) are not imported, because the CRB attack rules are written by hand.
- **Drafting and review.** A drafter script writes the records. A parser drafts notes that lead with a value and a bonus type (about 2,200), and an agent drafts the rest from the note and the entry's description.
  - Each record is `drafted` or `checked`, and both apply. The status isn't shown on the sheet.
  - A record is checked against the entry's imported description, which is Paizo's text, not against the printed book.
- **Prose-only bonuses.** Situational bonuses with no Foundry note (Superstition, a feat's "+2 vs. bull rush") are ordinary overlay Modifier records for prose-only entries, outside the note gate. A one-off drafter pass over every description looks for "vs.", "against" and "when" wordings and drafts what it finds.
- **Note gate.** The import fails if any note or action conditional lacks a record of either status. A record whose note text changed upstream no longer applies, so its note counts as missing. A pin bump runs the drafter for the gaps and commits the new records with its import report.

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
- Within one entry, two Modifiers of the same type and target don't stack. Only Modifiers that apply count, so two Situations of one entry never suppress each other. Text that says two bonuses of one entry stack (halfling *fearless* with halfling luck) is open in [Decide how bonuses on one entry stack when their text says so](https://github.com/AndreasUnunger/EverythingPath/issues/230).
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
   - **AC leaves:** with Dex as a built-in Modifier on `ac.other`.
   - **Saves, skills and initiative:**
     - Skills combine ranks (`base`), the class-skill +3, the ability modifier and armor check penalty.
   - **Hit points:**
     - `hpGained` per Class Level, and the race's `racialHpGained`;
     - the favored class bonus;
     - the Con modifier × Hit Dice.
   - **Attack, CMB and CMD.**
   - **Spellcastings:** caster level, spells per day, spells known, DCs and concentration (see "Spellcasting").

BAB, base saves, HP per level, ranks, the class-skill +3, Dex to AC, ability increases, favored class bonuses and ability damage are all built-in Modifiers. That way they appear in the same breakdown as item bonuses.

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

Decided by [Prototype attacks and conditional modifiers on the living sheet](https://github.com/AndreasUnunger/EverythingPath/issues/216) (variant 3, tag `prototype-approved/attacks-conditionals`) and [Decide which attack options an Attack Routine supports](https://github.com/AndreasUnunger/EverythingPath/issues/229). Its rules follow the CRB. Foundry stores none of them as data, so they are written from the text. [Collect the official rules for attack options, natural attacks and flurry](https://github.com/AndreasUnunger/EverythingPath/issues/235) collects that text from the CRB and FAQ, flags the Bestiary's, and sweeps the CRB feat chapter for anything missed. The exact rules here are finalised from it.

- **Coverage.** The builder writes by hand every CRB feat, class feature and combat action that changes a routine line's bonus, damage, critical or number of attacks. Other books are catalog content: computed when a plain Modifier with its condition expresses it, and text otherwise. Feats that change no line's numbers stay text: Cleave, Great Cleave, Spring Attack, Whirlwind Attack, Shot on the Run, Ride-By Attack, Stunning Fist, Spirited Charge (a multiplier) and the maneuver feats.
- **Attack Routines.**
  - A Character attacks through Attack Routines, state-only sheet entries. Each names the main weapon and whether it is held in two hands or one, an optional off-hand weapon, its natural attacks, and the Routine Options switched on.
  - Adding a weapon to Gear also adds a routine for it, held its natural way. The player renames, edits, deletes and adds routines.
  - A routine whose weapon has left Gear stays, with an advisory warning.
- **Weapons.**
  - **Unarmed strike** is a built-in weapon every sheet can put in a routine, with no Gear item. It is imported from Foundry's `monster-abilities` unarmed strike (1d3 nonlethal). Its lines say "nonlethal", or "lethal or nonlethal" with Improved Unarmed Strike. The −4 penalty for dealing the other kind of damage stays text. A monk's unarmed damage scales with monk level.
  - **Natural attacks:** primary at full BAB with Str, ×1.5 if it is the only natural attack; secondary at −5 with ½ Str. They get no iterative attacks, and all are secondary alongside weapon attacks. Foundry's 12 generic natural attack items (Bite, Claw… in `monster-abilities`, `attack` items with `subType: natural`) import as natural weapons. Their primary or secondary type is written from the rules, because Foundry marks it on only 5. Nothing grants them, because racial natural-weapon traits are prose in Foundry: the player adds a natural attack entry. Grants can come later without a model change.
  - **Thrown weapons:** a weapon with a thrown attack has a melee or thrown mode in a routine. Foundry stores separate `mwak` and `twak` actions on one item (dagger, spear, javelin). Thrown takes Dex to attack and Str ×1 to damage.
  - **Double weapons:** the off hand may be the other end of the main weapon, light for two-weapon penalties. Foundry models only one end for 16 of 17 double weapons, so the Curation Overlay supplies the second end's dice and critical.
- **Single and full attack.**
  - Each routine resolves to its single attack (a standard action: the main weapon, no two-weapon penalty, no extra attacks) and its full attack in order.
  - **Iterative attacks:** one more at −5 cumulative at BAB +6, +11 and +16.
  - **Off hand:** one off-hand attack.
  - **Haste:** an active `haste` Source adds one attack at the highest bonus.
  - **Reload:** a crossbow gets no iterative or haste attacks unless reloading is a free action.
- **Attack bonus:**
  - BAB, plus Str for melee or Dex for ranged;
  - the `attack.*` Modifiers and the weapon's own conditional Modifiers;
  - two-weapon penalties (CRB Table 8-7): −6/−10, −4/−8 with a light off-hand weapon, −4/−4 with Two-Weapon Fighting, −2/−2 with both;
  - the switched-on Routine Options;
  - −2 with a composite bow whose Strength rating exceeds the Str bonus.
- **Damage:**
  - the weapon's dice;
  - Str ×1.5 in two hands, ×1 in one, ×0.5 off hand (a Str penalty applies in full); Str up to its rating for a composite bow, no Str for a crossbow, a Str penalty only for other bows;
  - the `damage.*` and weapon Modifiers.
  - **Sneak attack:** +1d6 per entry, as conditional damage in its own Situation (flanking or the target denied its Dex bonus).
  - **Special-ability dice:** always-on dice are an extra damage part ("1d8+4 plus 1d6 fire"). Target-dependent ones (*holy*, *bane*) are Situational damage, like sneak attack. How abilities, enhancement and masterwork attach to a weapon is open in [Decide how enhancement and special abilities attach to weapons and armor](https://github.com/AndreasUnunger/EverythingPath/issues/236).
- **Critical:** the weapon's threat range and multiplier, shown as "×3", "19–20/×2" or "18–20/×2".
- **Automatic feats** apply with no toggle while on the sheet:
  - Improved and Greater Two-Weapon Fighting: a second and third off-hand attack, at −5 and −10;
  - Double Slice: full Str on the off hand;
  - Improved Critical and *keen*: the threat range doubles once and never stacks. This is a hand-written rule, as no Modifier target is a threat range;
  - Rapid Reload: a light crossbow's reload becomes free and a heavy crossbow's a move action;
  - Weapon Finesse: the higher of Str and Dex to attack with a `finesse` weapon. The breakdown names the ability used, and a shield's armor check penalty applies.
- **Combat actions** are built-in Situations: fighting defensively, total defense and charging. They don't trigger the situational marker. Each breakdown lists them in a collapsed "Combat actions" group below the Character's own "Only when…" groups.
- **On the sheet:**
  - The Offense block keeps BAB, CMB and Initiative. A separate Attacks block lists the routines as cards: the single attack, then the numbered full attack. Each line shows the weapon, its bonus, damage, critical and range, plus options as chips and penalties in one line.
  - Routines are edited in a side panel, or a bottom sheet on phone. Changes apply at once, and a delete can be undone.
  - **Situational bonuses never appear on the face of the sheet.** A small marker flags any number that has them: in the pinned stats, the Defenses, the skills and the attacks.
  - The number's breakdown has an "Only when…" section grouped by Situation. Each group shows its lines and what the total becomes then, with suppressed lines struck through. A while-active line that is waiting is dimmed ("only while raging").

### Routine Options

- **Data.** The Curation Overlay can mark any feat Catalog Entry as a Routine Option (`routineOption`). Its Modifiers carry the `option` condition, so they apply only inside a routine that has it switched on.
- **Offered.** A routine offers an option only while its entry is on the sheet. If the entry leaves, the routine keeps it switched on, with an advisory warning.
- **Outside the routine.** An option's Modifiers on anything but its routine's lines, such as Combat Expertise's dodge AC or Lunge's −2 AC, belong to a Situation named after the option. The AC breakdown shows "Only when using Combat Expertise".
- **CRB Routine Options:** Power Attack, Deadly Aim, Combat Expertise, Arcane Strike, Rapid Shot, Manyshot, Vital Strike (with Improved and Greater) and Lunge. Deadly Aim, Combat Expertise and Arcane Strike are data only. The others add hand-written rules:
  - **Power Attack:** −1 attack and +2 damage, plus −1 and +2 more per 4 BAB from +4. The damage is ×1.5 two-handed and ×0.5 off hand, and it applies to melee only.
  - **Rapid Shot:** one extra attack, and −2 on every attack.
  - **Manyshot:** a second arrow on the first attack.
  - **Vital Strike:** the weapon's dice ×2, ×3 with Improved and ×4 with Greater, on the single attack only.
  - **Lunge:** +5 ft reach.
- **Flurry of blows** is a Routine Option for monks, written separately for the core monk and the unchained monk.

## Rules checks

Decided by [Decide which rules checks the builder warns about](https://github.com/AndreasUnunger/EverythingPath/issues/215). Every check is advisory (Principle 5). The approved prototype fixed the presentation ([Prototype the character creation and level-up flow](https://github.com/AndreasUnunger/EverythingPath/issues/208)): warnings show inline next to their field, and blue outlines mark only what Class Levels leave unfilled.

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
- Proficiencies and region are never recorded.
- Racial traits as sheet entries are open in [Decide how racial traits live on a Character Sheet](https://github.com/AndreasUnunger/EverythingPath/issues/232).

**Clauses that can't be checked show nothing.** A prerequisite clause the sheet has no fact for, or that the importer couldn't parse, shows no warning and no "not checked" line. This covers proficiency, region, a racial trait, and a cleric's alignment relative to the deity. The entry's prerequisite prose stays readable in its description.

### The checks

| Check | Reads | Data from |
|---|---|---|
| **Level 0:** a PC with no Class Levels | Class Levels | sheet |
| **Point buy:** a `base` score outside 7–18, or the cost over the budget; under budget shows only the "N left" counter; nothing when rolled | `base` Modifiers, `abilityMethod` | CRB cost table |
| **Hit points:** `hpGained` outside 1 to the hit die; a PC with no racial Hit Dice whose first Class Level isn't the hit die's maximum | Class Levels | class `hitDie` |
| **Ability increase:** at a Class Level where neither the character level nor the Hit Dice count is 4, 8, 12, 16 or 20; a prompt where one is due | Class Levels, racial Hit Dice | sheet |
| **Skill rank budget:** per Class Level, max(1, ranks per level + Int modifier) + race `bonusSkillRanksPerLevel` + 1 for a skill-rank favored class bonus; racial skill ranks get `skillRanksPerHitDie` + Int, at least 1, per racial Hit Die; over budget warns | the archetype's or class's ranks per level; current permanent Int | class, archetype, race (Curation Overlay) |
| **Rank cap:** at each Class Level position, a skill's ranks so far exceed racial Hit Dice + position; racial skill ranks are capped by racial Hit Dice | ranks per Class Level | sheet |
| **Feat slots:** feats over or under 1 + one per odd Hit Die, plus `grantsSlots` | Hit Dice, active entries | Curation Overlay (`grantsSlots`) |
| **Bonus feat type:** a feat in a bonus slot whose `featTypes` miss the slot's | feat `slot` | Foundry feat types |
| **Prerequisites as taken:** a feat checked against the Character as of its `gainedAtClassLevel`; a prestige class as of the Class Level before its first | historical sheet | parsed `prerequisites` |
| **Prerequisites now:** the same clauses against the current sheet ("can't be used while unmet"). Both prerequisite checks skip a feat in a slot with `ignoresPrerequisites` | current sheet | parsed `prerequisites` |
| **Duplicate feat:** a second copy of a `no` feat; a second copy of a `newChoice` feat with the same `choice`, case-insensitive; never for `yes` | feat entries | `repeatable` (importer, Curation Overlay) |
| **Duplicate trait** | trait entries | sheet |
| **Favored class:** more favored classes than the race's `favoredClassCount`; a prestige class as a favored class; a favored class bonus on a level of a class that isn't favored, or on a prestige level | race entry state, Class Levels | race (Curation Overlay), `classKind` |
| **Traits:** more than `traitCount`, +1 for a drawback (only one drawback counts), +2 per Additional Traits; two from one `traitType` list; a race trait for another race; no campaign trait when required; an NPC with traits but no Additional Traits | trait entries | `traitType`, `prerequisites` |
| **Class alignment:** a Class Level whose class's `alignments` exclude the current alignment | alignment | Curation Overlay, for the 9 Foundry classes; scraped prestige classes carry it as a clause |
| **Archetypes:** two on one class replacing or altering the same row (one feature at one class level); an Archetype on a class the Character has no levels in; the Unchained warnings (see "Unchained Classes") | archetype entries | `replaces` |
| **Class features:** a feature in `featuresByLevel` missing from the sheet prompts "Add"; a due selection in `picksByLevel` prompts "choose a rage power"; a duplicated feature with an upgrade prompts adding it (see "Stacking") | Class Levels | Curation Overlay, scraped dataset |
| **Spells known over the table:** more Spells recorded at a level than the Spellcasting's spells known; `known` casters only | recorded Spells, casting level | casting tables |
| **Spell too high:** a recorded Spell above the highest level its Spellcasting can cast now | recorded Spells, casting level | casting tables |
| **Off-list Spell:** a recorded Spell that isn't on its class's list and isn't granted | recorded Spells | Spell `levels`, `grantedLevels` |
| **Orphaned Spell:** a recorded Spell whose casting class the Character has no Class Levels in | recorded Spells, Class Levels | sheet |
| **Prestige advance:** an `arcane` or `divine` advance on a Spellcasting of another kind; an advance to a class first taken after the prestige class ("belonged to before"). An empty choice is a blue outline, not a warning | Class Levels | `castingAdvances`, `casting.spellKind` |
| **Opposition schools:** the specialist school chosen as an opposition school, or fewer than two opposition schools | arcane school entry | `spellcasting.school` |
| **Unsupported formula** (see "Formulas") | Modifiers | importer |

**Skill ranks follow Intelligence retroactively.** The CRB glossary says a permanent ability increase means you "modify all skills and statistics related to that ability. This might cause you to gain skill points", and drain "might cause you to lose skill points". So every Class Level's budget uses the current permanent Int modifier. The headband's fixed skill ranks are *Ultimate Equipment* rules and aren't admitted, so a headband counts as ordinary permanent Int.

**Favored class.** It is chosen on the race sheet entry, once a race is set. Unchained Class levels count as the original's. Favored class options stay a free-text note and are not checked against race and class pairs. A change of favored class after creation can't be detected and isn't checked.

### Prerequisites

The importer parses each Prerequisites or Requirements line into clauses ([Find how the Foundry pf1 dataset encodes prerequisites](https://github.com/AndreasUnunger/EverythingPath/issues/214), `research/pf1-prerequisite-data`). The AoN scraper does the same for prestige classes and archetypes, and its unmatched records go to hand review. The Curation Overlay corrects misparses and adds the "counts as X for prerequisites" substitutions, which exist only in prose.

```ts
type Prerequisite =
  | { anyOf: Prerequisite[] }                                      // "or" clauses
  | { ability: AbilityKey; min: number } | { bab: number }
  | { skillRanks: SkillKey; min: number }
  | { feat: Id<'catalogEntry'>; choice?: string }                  // `@UUID` first, then exact name
  | { classFeature: string }                                       // by name, ignoring `(UC)`
  | { classLevel: Id<'catalogEntry'>; min: number } | { characterLevel: number }
  | { race: Id<'catalogEntry'>[] } | { alignment: Alignment[] } | { deity: string }
  | { casterLevel: number }                                        // the highest caster level among the Spellcastings
  | { canCast: { spellLevel: number; kind?: 'arcane' | 'divine' | 'psychic' } } // "able to cast 3rd-level arcane spells"
  | { castsSpell: Id<'catalogEntry'> }                             // "able to cast dimension door"
  | { unchecked: string };                                         // parsed but unmodelled, or unparsed: shows nothing
```

Clauses follow the CRB FAQ:
- Numeric clauses are inclusive.
- A feat clause needs only the feat, not that feat's own prerequisites.
- A class feature replaced by an Archetype doesn't count.
- A same-named feature of either version of an Unchained Class counts.
- Unchained Class levels count as the original's.
- A spell-like ability meets an "able to cast" clause only when the clause names the spell. Spell-like abilities are prose, so such a clause met only by one shows nothing.
- `canCast` is met by a Spellcasting of that `spellKind` whose table has an entry at that level, "0" included ([Decide how spellcasting fits the Character Sheet](https://github.com/AndreasUnunger/EverythingPath/issues/218)).
- `castsSpell` is met by a Spellcasting with that Spell recorded or granted, or, for a `none` Spellcasting, with it on its class list at a level it can cast.

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

Both clones record `copiedFrom`. A copy never updates automatically. When its original changes after the copy was made, the copy shows an advisory that upstream has changed.

## Global catalog import

Decided by [Decide how the content dataset becomes the global catalog](https://github.com/AndreasUnunger/EverythingPath/issues/207). The dataset is the Foundry VTT pf1 system packs plus `pf1-content` ([Choose the PF1 content dataset for the builder catalog](https://github.com/AndreasUnunger/EverythingPath/issues/202)).

- **Content.** These packs are imported:
  - races, classes and class abilities;
  - feats, traits and racial traits;
  - every item pack: mundane, magic, wondrous, artifacts, armor and weapons;
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
- **Rows.** Global entries are ordinary `catalogEntry` rows, so the resolver loads every scope the same way. Each imported entry carries its description text and its `sources`.
- **Curation overlay.** This is a reviewed file in the repo, keyed by `externalKey`. Each record cites the official text it relies on. The importer applies it on every import. It can:
  - add or replace Modifiers, for prose-only entries such as most feats;
  - set `sourceKey` and `stacksWithItself`;
  - turn every situational note (Foundry `contextNotes`) and action conditional into Situational Modifiers and situational notes, with a gate that fails the import on any note without a record (see "Situational notes");
  - define the CRB conditions, written from `docs/ai/pf1-core-rules/` because the dataset has no conditions pack;
  - mark Routine Options, and set natural attack types and a double weapon's second end (see "Attacks");
  - exclude an entry, giving the reason (see "Notice gate").

  Generally useful fixes may also be contributed upstream to Foundry, and the overlay record is then deleted.
- **Mapping.** Foundry targets map onto the closed target list, and formulas are parsed into the closed grammar. A weapon's `weapon` detail comes from its `baseTypes`, `weaponGroups`, `weaponSubtype` and `held`, and from the first action's `damage.parts` (the dice inside `sizeRoll(n, s, @size)`), `ability.critRange`/`critMult` and `range`. `finesse` comes from `properties.fin`, and `thrown` from a `twak` action. Omitted defaults are filled in. Anything unmappable is stored on the entry, flagged in `unsupported`, contributes nothing and shows a warning.
- **Pipeline.**
  - The repo pins a release tag of each upstream repo, never an unreleased commit ([Decide which Foundry pf1 release the catalog import pins](https://github.com/AndreasUnunger/EverythingPath/issues/223)). The pins are system `v11.11` and pf1-content `11.4.0`. Both repos must share a major version, and the import fails if they don't.
  - The importer maps one upstream shape, the v11 one, in which class skills are a boolean map, class features are listed in `links.classAssociations`, skill targets use three-letter keys such as `skill.per`, and `system.changes` is an array. Pack files are read recursively from a checkout of the tag, so Foundry itself never runs.
  - The owner bumps a pin by hand within the major. The next major waits until both repos have released it, and then moves both together as a separate effort that replaces the mapper.
  - Fixes on upstream master that aren't released yet are not backported. A Curation Overlay correction is written only for a mistake that matters, and a bump's import report flags it once upstream has the fix.
  - At deploy, the build imports only when the pin differs from the catalog's recorded version.
  - The PR that bumps the pin carries a committed import report. It lists counts per pack, unsupported changes, overlay records that no longer apply, note records by status, and what changed since the last pin.
- **Updates.** An import upserts by `externalKey`, so sheets follow updates. An entry removed upstream is marked `retired` and never deleted.
- **Keys.**
  - Upstream keeps a record's `_id` through edits, renames and pack moves, while pack names change ([Check whether Foundry pf1 record IDs stay stable across releases](https://github.com/AndreasUnunger/EverythingPath/issues/211), `research/pf1-foundry-id-stability`). That is why the key leaves out the pack.
  - The Curation Overlay holds a reviewed remap list for the cases that would otherwise break the key: records that move between the two repos, upstream merges, and the rare record re-created with a new `_id`.
  - Upstream's own redirect tables are not trusted.
- **Batches.** An import runs in idempotent, resumable batches, and the run is recorded. The catalog's recorded version flips only when the run completes. Militia Character Facts are recalculated once at the end, for Characters whose sheets use changed entries. The militia copy is written only when those facts differ, like any sheet edit, and no Ruleset Version changes.
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

## Resolver

The resolver lives in `src/lib`, is pure, and is shared by the client and Convex:

```ts
type SourcedModifier = Modifier & { sheetEntryId: string; entryName: string; source: string; builtIn: boolean };

collectModifiers(character, entries, catalog): SourcedModifier[]   // active entries + built-ins from state
resolveSheet(modifiers, { permanentOnly?: boolean; situations?: Situation[] }): ResolvedSheet // staged; each statistic → { total, applied, suppressed, conditional }; plus one resolved Spellcasting per casting class
resolveRoutine(character, sheet, routine, { situations? }): { single, attacks }   // see "Attacks"
militiaCharacterFacts(character, entries, catalog): MilitiaCharacterFacts // permanentOnly; the one function the militia uses
sheetWarnings(character, entries, catalog, accepted): SheetWarning[]   // see "Rules checks"; client only, never stored
```

## Migration and release

Everything ships in the one release that merges the PR to main. Netlify runs `pnpm deploy:convex` on every push to main, and Convex rejects a schema that stored documents violate. So the release works like this:

1. **Schema.** The release's schema adds `catalogEntry` and `characterSheetEntry` and `sheetMode`. It keeps the flat ability columns and `level` as optional and unread.
2. **Backfill.** The Netlify build command runs an idempotent backfill right after `convex deploy`. For each Character it:
   - creates the base-scores entry from the flat scores, as recorded;
   - creates `level` Unspecified Class Levels;
   - sets the base entry's `abilityMethod` to rolled, since the flat scores were totals;
   - sets `sheetMode: 'militiaOnly'`;
   - clears the flat columns.
3. **Check.** The build fails loudly if any Character's Militia Character Facts differ from the copy in `canonicalMilitiaState`. They don't change, so no revision is bumped and no reviewed week is invalidated.
4. **Readers.** The mirror writer, the Setup options query and `requireReviewedCharacters` call `militiaCharacterFacts`. `createCharacter`, `updateCharacter` and the e2e fixtures write the sheet.
5. **Ruleset Version.** The new Ruleset Version for computed Hit Dice ships in the same release.
6. **Old spell tables.** The backfill clears every `spell` and `characterSpell` row. Nothing in the UI reads them.

Open browsers on the old bundle get errors from the changed character mutations until they reload. The backfill is rehearsed on a preview deployment first. A follow-up PR, with no behaviour change, drops the unread columns, the `spell` and `characterSpell` tables, `convex/spell.ts` and `convex/data/spells.js`. It is tracked in [the legacy compatibility inventory](legacy-compatibility-inventory.md) until then.

## Verification

Resolver tests (pure) must cover:

- each stacking rule;
- untyped penalties summing and typed penalties taking the worst;
- a shared `sourceKey` keeping only the strongest entry, and `stacksWithItself` lifting that;
- the same-entry rule;
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
- the Spell Effect caster level pre-fill, and `@casterLevel` in a Spell Effect and in Magical Knack;
- attack bonus, iterative attacks, two-weapon penalties, Str multipliers, composite bows, crossbows, Power Attack and haste, and the single attack taking no two-weapon penalty;
- an `option` Modifier applying only in routines that switch it on, its other targets only in its option's Situation, and a routine keeping an option whose entry left;
- Power Attack scaling, Rapid Shot, Manyshot, Vital Strike on the single attack only, Lunge, and flurry for each monk;
- Improved and Greater Two-Weapon Fighting, Double Slice, Rapid Reload, Weapon Finesse choosing the higher ability, and Improved Critical with *keen* doubling once;
- natural attacks alone and alongside weapons, unarmed strike with monk scaling, thrown mode, a double weapon's other end as a light off hand, and special-ability dice as a damage part or Situational damage;
- the `$group` weapon condition, `@casterLevel.<classKey>` and `@casterLevel.arcane`, and combat actions staying out of the marker;
- `sheetWarnings`: each check in "Rules checks", including the cumulative rank cap, the retroactive Int budget, prerequisites as taken and now, `ignoresPrerequisites`, `newChoice` duplicates, and an Accepted Warning reopening when its fingerprint changes.

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
