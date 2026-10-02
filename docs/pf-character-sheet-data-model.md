# Pathfinder character sheet data model

Revised by [Reconcile the sheet data model with one Character identity](https://github.com/AndreasUnunger/EverythingPath/issues/206) on the [Pathfinder 1e character builder](https://github.com/AndreasUnunger/EverythingPath/issues/201) map. It follows [ADR 0001](adr/0001-one-character-identity.md): the builder extends the existing `character` table, and every Character has a Character Sheet. Terms are defined in [`CONTEXT.md`](../CONTEXT.md).

Rules sources:

- [Collect the official PF1 bonus-stacking and target rules](https://github.com/AndreasUnunger/EverythingPath/issues/209) (`research/pf1-official-stacking-rules`)
- [Find how official PF1 rules treat "functions as" wordings for stacking](https://github.com/AndreasUnunger/EverythingPath/issues/210) (`research/pf1-functions-as-stacking`)
- [Survey how existing PF1 builders model characters](https://github.com/AndreasUnunger/EverythingPath/issues/203) (`research/pf1-builder-models`)

Only official Paizo text decides a rule: the Core Rulebook, plus the official FAQ and errata. Where it is silent, the model follows the literal text and adds nothing. [Set the coverage bar for archetypes and prestige classes](https://github.com/AndreasUnunger/EverythingPath/issues/219) also admits, with their FAQ and errata: the *Advanced Player's Guide* archetype rules, its favored class option rules, the trait rules of the *Advanced Player's Guide* and *Ultimate Campaign*, and *Pathfinder Unchained*'s classes ([Decide which Pathfinder Unchained rules the builder supports](https://github.com/AndreasUnunger/EverythingPath/issues/226)). Other Paizo books supply catalog content, not rules.

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
  detail: CatalogEntryDetail,          // discriminated on `kind`
  description?: string,                // sanitized rules text
  sources: Array<{ book: string; pages?: string }>, // feeds OGL Section 15
  externalKey?: string,                // global scope: `<repo>/<_id>`, the upsert key; the pack is an ordinary field
  retired?: boolean,                   // global scope: removed upstream; hidden from pickers, kept for sheets
  copiedFrom?: Id<'catalogEntry'>,     // campaign or character copy of another entry
  unsupported?: string[],              // importer notes: unmappable targets, formulas outside the grammar
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
```

The `spell` and `characterSpell` tables are untouched. Spellcasting is still in the map's fog.

### Entry kinds

```ts
// Catalog-backed: the sheet entry points at a Catalog Entry of the same kind.
type CatalogKind = 'base' | 'race' | 'class' | 'archetype' | 'classFeature' | 'feat' | 'trait'
                 | 'item' | 'spell' | 'condition' | 'manual';
// State-only: no Catalog Entry; the resolver emits built-in Modifiers from state.
type StateKind = 'classLevel' | 'abilityDamage' | 'abilityDrain';
type EntryKind = Exclude<CatalogKind, 'class'> | StateKind;   // a class is reached through Class Levels

type CatalogEntryDetail =
  | { kind: 'base' }
  | { kind: 'race'; racialHitDice: number }                     // later: creature-type progression
  | { kind: 'class'; classKind: 'base' | 'prestige' | 'npc';
      counterpartOf?: Id<'catalogEntry'>,                         // an Unchained Class: its original class
      hitDie: number; bab: 'full' | 'threeQuarters' | 'half';
      saves: Record<'fort' | 'ref' | 'will', 'good' | 'poor'>;
      skillRanksPerLevel: number; classSkills: SkillKey[];
      featuresByLevel: Array<{ classLevel: number; catalogEntryId: Id<'catalogEntry'> }> }
  | { kind: 'archetype'; classEntryIds: Id<'catalogEntry'>[];   // the base class it varies; both versions where its source names both
      replaces: Array<{ classLevel: number; catalogEntryId: Id<'catalogEntry'> }>; // rows of the class's featuresByLevel
      adds: Array<{ classLevel: number; catalogEntryId: Id<'catalogEntry'> }>;
      classSkillsAdded: SkillKey[]; classSkillsRemoved: SkillKey[];
      skillRanksPerLevel?: number }                             // absent = the class's own
  | { kind: 'classFeature' } | { kind: 'feat' } | { kind: 'trait' }
  | { kind: 'item'; consumable: boolean }                       // later: slot, weight, price
  | { kind: 'spell'; lastsOverOneDay: boolean }                 // later: level, school, duration text
  | { kind: 'condition' } | { kind: 'manual' };

type SheetEntryState =
  | { kind: 'classLevel'; classEntryId: Id<'catalogEntry'> | null;   // null = Unspecified Class Level
      position: number;                                               // character level this row is, 1-based
      hpGained: number | null;
      favoredClassBonus: null | { choice: 'hp' } | { choice: 'skill' } | { choice: 'alt'; note: string };
      abilityIncrease: AbilityKey | null;
      skillRanks: Partial<Record<SkillKey, number>> }
  | { kind: 'abilityDamage'; ability: AbilityKey; points: number }
  | { kind: 'abilityDrain'; ability: AbilityKey; points: number }
  | { kind: 'item'; quantity: number }                                // later: charges
  | { kind: Exclude<EntryKind, 'classLevel' | 'abilityDamage' | 'abilityDrain' | 'item'> };
```

## Class Levels and Hit Dice

- A Character's level is the number of its Class Levels. It is never stored. Zero is allowed: a PC at level 0 shows an advisory warning.
- A new Character starts with one Unspecified Class Level. An Unspecified Class Level adds Hit Dice and nothing else.
- The level within a class is the count of earlier Class Levels of that class. Every field of every Class Level can be edited at any time. That includes its class, its position (a level can move), and deleting it from the middle, in which case later positions close up.
- The ability increase and favored class bonus fields exist on every Class Level. An increase outside levels 4, 8, 12, 16 and 20, or a favored class bonus on a level of a class that isn't favored, shows a warning.
- `hpGained` holds the recorded number. The builder takes it as a plain number and never pre-fills it: there is no roll, average or maximum button ([Prototype the character creation and level-up flow](https://github.com/AndreasUnunger/EverythingPath/issues/208)).
- **Hit Dice** = Class Levels + racial Hit Dice. They are computed and never recorded. The militia's roster Hit Dice override stays as the militia's own ruling.

## Archetypes and prestige classes

Decided by [Set the coverage bar for archetypes and prestige classes](https://github.com/AndreasUnunger/EverythingPath/issues/219).

- **Coverage.** Every official Paizo prestige class and archetype, from any Paizo product: rulebooks, Campaign Setting, Player Companion and Adventure Path books.
- **Archetypes.**
  - An Archetype is a Catalog Entry tied to one base class, or to both versions of one (see "Unchained Classes"). A Character takes it as a sheet entry, and it applies to every level of that class. The levels stay levels of the base class.
  - `replaces` names rows of the class's `featuresByLevel`, a feature at one class level, so "replaces armor training 1" removes only that row. An archetype feature that alters a class feature replaces that row and adds its own feature at the same level.
  - Adding an Archetype removes the class feature entries it replaces from the sheet and adds its own features at their levels, with `gainedAtClassLevel` set. Removing it reverses this. Entries added or edited by hand stay.
  - Class skills added or removed and skill ranks per level are structured. Proficiency changes stay in the description. Spellcasting changes wait for spellcasting.
  - Two Archetypes on one class that replace or alter the same feature show an advisory warning.
- **Base class schedules.** Foundry links many multi-level features only at their first level; the Fighter links six features. The Curation Overlay completes each base class's `featuresByLevel` from its class table, so archetypes can replace any row and the sheet shows every feature gained.
- **Prestige classes.** These are `class` entries with `classKind: 'prestige'`, and their `featuresByLevel` comes from the class's level table.
  - Entry requirements are prerequisites on the class entry, like a feat's. They are checked against the Character as of the Class Level before the class's first level.
  - A prestige class can never be the favored class.
  - "+1 level of existing spellcasting class" waits for spellcasting.
- **Source: a scraped AoN dataset.**
  - Neither Foundry repo has archetypes or prestige classes. PSRD-Data (no licence, frozen in 2015) and the `pf1e-archetypes` module are not used.
  - A one-off scraper reads Archives of Nethys' prestige class and archetype pages into a dataset committed to this repo. It runs very slowly, over days if need be, and only after the project owner has contacted AoN.
  - Every record keeps its book, page and AoN URL. Its catalog key is `everythingpath/<id>`, never the URL. Entries whose source is not a Paizo product are dropped and listed in the scraper's report.
  - The scraper extracts what it can, including matching "replaces X" against the base class's features. Every record it cannot match or classify goes to a hand-review list. Each book also gets a sampled spot-check.
  - Corrections, including Modifiers for archetype and prestige features, are made in the dataset itself. A reviewed record is marked and cites its book and page. The Curation Overlay is only for upstream data.
  - Every scraped record's book needs a Section 15 line, or the import fails. Where that text comes from is decided by [Find the Section 15 text for every imported source book](https://github.com/AndreasUnunger/EverythingPath/issues/224).

## Unchained Classes

Decided by [Decide which Pathfinder Unchained rules the builder supports](https://github.com/AndreasUnunger/EverythingPath/issues/226).

- **Scope.** The four Unchained Classes (barbarian, monk, rogue, summoner), their archetypes, and *Pathfinder Unchained*'s other catalog content are in. Signature Skill and skill unlocks, the stamina feats, Combat Trick feats and scaling items are plain prose catalog content: nothing is derived from them, and no stamina pool exists. Every alternate rule system in the book is out of scope, so there are no variant rule switches on a campaign or a Character.
- **Class entries.** Each Unchained Class is its own `class` Catalog Entry, imported from Foundry's `<Class> (Unchained)` records, with `counterpartOf` pointing at the original class. Its features are found through the class's links, not by the PZO1131 source, which most unchained feature records lack.
- **One version per Character.** Class Levels in both an original class and its Unchained Class show an advisory warning ("individual characters must use one version or the other exclusively").
- **A version of the same class.** The book's own framing, applied consistently:
  - Levels of an Unchained Class count as levels of the original wherever something counts levels in that class: `@classLevel.<classKey>`, requirements, and the favored class with its favored class options. The two never coexist, so nothing double-counts.
  - A prerequisite naming a class feature is met by the same-named feature of either version, ignoring Foundry's `(UC)` suffix: Extra Rage accepts *Rage (UC)*. The check itself belongs to [Decide which rules checks the builder warns about](https://github.com/AndreasUnunger/EverythingPath/issues/215).
- **Archetypes.**
  - An archetype for the original barbarian, rogue or summoner applies to the Unchained Class ("as long as the classes still have the appropriate class features to replace"). Its `replaces` rows match the Unchained Class's `featuresByLevel` by feature name and class level, ignoring `(UC)`. A row with no match shows an advisory warning and removes nothing.
  - An archetype for the original monk on the unchained monk shows an advisory warning ("with the exception of the monk").
  - Archetypes written for an Unchained Class name it directly. One whose source names both versions lists both in `classEntryIds`.
  - The Pathfinder Society restrictions (no barbarian archetype that changes rage, no summoner archetype that changes the eidolon's base form) are campaign policy, not rules text, and are not adopted.
- **Spells.** The unchained summoner's revised spell list is ordinary per-class spell data, left to spellcasting.

## Modifiers

```ts
type Modifier = { target: Target; bonusType: BonusType; value: number | { formula: string } };  // negative = penalty
```

### Targets

Targets form a closed list of statistics. Any bonus type may go on any target, because the rules set no restriction.

- **Abilities:** `ability.str`, `ability.dex`, `ability.con`, `ability.int`, `ability.wis`, `ability.cha`
- **AC:**
  - `ac.armor`, `ac.shield` and `ac.natural` are separate targets, because the rules count enhancement separately for each thing enhanced.
  - `ac.other` covers every other AC bonus.
- **Saves:** `save.fort`, `save.ref`, `save.will`
- **Skills:** `skill.<key>`
- **Combat:** `bab`, `attack.melee`, `attack.ranged`, `cmb`, `cmd`, `init`
- **Hit points:** `hp`

The parent targets `ac`, `saves` and `attack` exist because rules text uses them. They expand into their leaves before stacking: `ac` expands to `ac.other`. Touch AC and flat-footed AC are never targets. They are derived from the AC leaves (see "Derived statistics").

### Bonus types

`alchemical`, `armor`, `circumstance`, `competence`, `deflection`, `dodge`, `enhancement`, `inherent`, `insight`, `luck`, `morale`, `naturalArmor`, `profane`, `racial`, `resistance`, `sacred`, `shield`, `size`, `trait` (APG, admitted because imported traits use it), `untyped`, plus `base` for base scores and built-in bases.

### Formulas

A formula uses a closed grammar:

- **Operators and functions:** integers, `+ - * /`, `floor`, `ceil`, `min` and `max`.
- **Variables:** `@level`, `@classLevel.<classKey>`, `@hitDice`, `@ability.<key>.mod` and `@bab`.

A formula may read only stages earlier than its target's stage (see "Resolution stages"). A formula outside the grammar is stored and flagged as unsupported. It contributes nothing and shows a warning. About 22% of the dataset's changes are formulas, so the importer parses them ([Decide how the content dataset becomes the global catalog](https://github.com/AndreasUnunger/EverythingPath/issues/207)).

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
- Within one entry, two Modifiers of the same type and target don't stack.
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
   - BAB and base saves are computed per class from its progression, floored, and summed across classes.
   - Hit Dice are computed here.
4. **Dependent statistics:**
   - **AC leaves:** with Dex as a built-in Modifier on `ac.other`.
   - **Saves, skills and initiative:**
     - Skills combine ranks (`base`), the class-skill +3, the ability modifier and armor check penalty.
   - **Hit points:**
     - `hpGained` per Class Level;
     - the favored class bonus;
     - the Con modifier × Hit Dice.
   - **Attack, CMB and CMD.**

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

## Temporary Effects

An entry is a Temporary Effect according to its kind:

| Temporary | Permanent |
|---|---|
| `spell` with `lastsOverOneDay: false` | every other kind, including spells with `lastsOverOneDay: true` |
| `condition` | |
| `item` with `consumable: true` | |
| `abilityDamage` | `abilityDrain` |

The derived sheet applies every active entry to every statistic, HP included. Hit points from a temporary Con bonus are not temporary hit points. Three calculations count permanent entries only:

- Militia Character Facts;
- the skill-rank budget;
- bonus spells.

This narrows "running spells" in [Decide what the militia reads from a Character Sheet, and when](https://github.com/AndreasUnunger/EverythingPath/issues/205) to spells lasting a day or less, which is the official 24-hour rule.

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
  - buffs.

  The spell pack, goods and services, third-party packs and 3.5 packs are not imported.
- **Buffs.** A spell buff becomes a `spell` entry, with `lastsOverOneDay` taken from its duration. Class and item buffs become their own kinds. The `spell` and `characterSpell` tables wait for spellcasting.
- **Rows.** Global entries are ordinary `catalogEntry` rows, so the resolver loads every scope the same way. Each imported entry carries its description text and its `sources`.
- **Curation overlay.** This is a reviewed file in the repo, keyed by `externalKey`. Each record cites the official text it relies on. The importer applies it on every import. It can:
  - add or replace Modifiers, for prose-only entries such as most feats;
  - set `sourceKey` and `stacksWithItself`;
  - define the CRB conditions, written from `docs/ai/pf1-core-rules/` because the dataset has no conditions pack.

  Generally useful fixes may also be contributed upstream to Foundry, and the overlay record is then deleted.
- **Mapping.** Foundry targets map onto the closed target list, and formulas are parsed into the closed grammar. Anything unmappable is stored on the entry, flagged in `unsupported`, contributes nothing and shows a warning.
- **Pipeline.**
  - The repo pins a release tag of each upstream repo, never an unreleased commit ([Decide which Foundry pf1 release the catalog import pins](https://github.com/AndreasUnunger/EverythingPath/issues/223)). The pins are system `v11.11` and pf1-content `11.4.0`. Both repos must share a major version, and the import fails if they don't.
  - The importer maps one upstream shape, the v11 one, in which class skills are a boolean map, class features are listed in `links.classAssociations`, skill targets use three-letter keys such as `skill.per`, and `system.changes` is an array. Pack files are read recursively from a checkout of the tag, so Foundry itself never runs.
  - The owner bumps a pin by hand within the major. The next major waits until both repos have released it, and then moves both together as a separate effort that replaces the mapper.
  - Fixes on upstream master that aren't released yet are not backported. A Curation Overlay correction is written only for a mistake that matters, and a bump's import report flags it once upstream has the fix.
  - At deploy, the build imports only when the pin differs from the catalog's recorded version.
  - The PR that bumps the pin carries a committed import report. It lists counts per pack, unsupported changes, overlay records that no longer apply, and what changed since the last pin.
- **Updates.** An import upserts by `externalKey`, so sheets follow updates. An entry removed upstream is marked `retired` and never deleted.
- **Keys.**
  - Upstream keeps a record's `_id` through edits, renames and pack moves, while pack names change ([Check whether Foundry pf1 record IDs stay stable across releases](https://github.com/AndreasUnunger/EverythingPath/issues/211), `research/pf1-foundry-id-stability`). That is why the key leaves out the pack.
  - The Curation Overlay holds a reviewed remap list for the cases that would otherwise break the key: records that move between the two repos, upstream merges, and the rare record re-created with a new `_id`.
  - Upstream's own redirect tables are not trusted.
- **Batches.** An import runs in idempotent, resumable batches, and the run is recorded. The catalog's recorded version flips only when the run completes. Militia Character Facts are recalculated once at the end, for Characters whose sheets use changed entries. The militia copy is written only when those facts differ, like any sheet edit, and no Ruleset Version changes.
- **Legal page.** The import generates an in-app legal page, linked from every page's footer. It holds:
  - the OGL 1.0a text;
  - a Section 15 built from the imported entries' `sources` plus `pf1-content`'s Section 15 list;
  - the Paizo Community Use notice.

  The import fails if an imported pack has neither per-entry sources nor a Section 15 list.

The base scores are one character-scoped `base` entry with six `base` Modifiers. Every Character has exactly one sheet entry for it, which cannot be removed or deactivated.

## Resolver

The resolver lives in `src/lib`, is pure, and is shared by the client and Convex:

```ts
type SourcedModifier = Modifier & { sheetEntryId: string; entryName: string; source: string; builtIn: boolean };

collectModifiers(character, entries, catalog): SourcedModifier[]   // active entries + built-ins from state
resolveSheet(modifiers, { permanentOnly?: boolean }): ResolvedSheet // staged; each statistic → { total, applied, suppressed }
militiaCharacterFacts(character, entries, catalog): MilitiaCharacterFacts // permanentOnly; the one function the militia uses
```

## Migration and release

Everything ships in the one release that merges the PR to main. Netlify runs `pnpm deploy:convex` on every push to main, and Convex rejects a schema that stored documents violate. So the release works like this:

1. **Schema.** The release's schema adds `catalogEntry` and `characterSheetEntry` and `sheetMode`. It keeps the flat ability columns and `level` as optional and unread.
2. **Backfill.** The Netlify build command runs an idempotent backfill right after `convex deploy`. For each Character it:
   - creates the base-scores entry from the flat scores, as recorded;
   - creates `level` Unspecified Class Levels;
   - sets `sheetMode: 'militiaOnly'`;
   - clears the flat columns.
3. **Check.** The build fails loudly if any Character's Militia Character Facts differ from the copy in `canonicalMilitiaState`. They don't change, so no revision is bumped and no reviewed week is invalidated.
4. **Readers.** The mirror writer, the Setup options query and `requireReviewedCharacters` call `militiaCharacterFacts`. `createCharacter`, `updateCharacter` and the e2e fixtures write the sheet.
5. **Ruleset Version.** The new Ruleset Version for computed Hit Dice ships in the same release.

Open browsers on the old bundle get errors from the changed character mutations until they reload. The backfill is rehearsed on a preview deployment first. A follow-up PR, with no behaviour change, drops the unread columns. It is tracked in [the legacy compatibility inventory](legacy-compatibility-inventory.md) until then.

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
- moving and deleting Class Levels.

Integration tests (convex-test) must cover:

- a backfilled Character's Militia Character Facts equal its old flat values;
- a sheet edit that doesn't change the facts leaves the `canonicalMilitiaState` revision untouched;
- editing a militia-only Character's score adjusts its base score;
- a full Character's level can't be edited through Characters & officers;
- campaign scoping of every catalog and sheet read;
- owner-only access to a Character in no campaign, and campaign access once it joins;
- leaving a campaign removes the Character from the roster, its roles and team management as one Militia Correction, detaches campaign catalog entries without changing the resolved sheet, and leaves past Resolution Records untouched;
- deleting is refused for a Character in a campaign.
