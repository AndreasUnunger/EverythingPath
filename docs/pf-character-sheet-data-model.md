# Pathfinder character sheet data model

Revised by [Reconcile the sheet data model with one Character identity](https://github.com/AndreasUnunger/EverythingPath/issues/206) on the [Pathfinder 1e character builder](https://github.com/AndreasUnunger/EverythingPath/issues/201) map. It follows [ADR 0001](adr/0001-one-character-identity.md): the builder extends the existing `character` table, and every Character has a Character Sheet. Terms are defined in [`CONTEXT.md`](../CONTEXT.md).

Rules sources:

- [Collect the official PF1 bonus-stacking and target rules](https://github.com/AndreasUnunger/EverythingPath/issues/209) (`research/pf1-official-stacking-rules`)
- [Find how official PF1 rules treat "functions as" wordings for stacking](https://github.com/AndreasUnunger/EverythingPath/issues/210) (`research/pf1-functions-as-stacking`)
- [Survey how existing PF1 builders model characters](https://github.com/AndreasUnunger/EverythingPath/issues/203) (`research/pf1-builder-models`)

Only official Paizo text decides a rule: the Core Rulebook, plus the official FAQ and errata. Where it is silent, the model follows the literal text and adds nothing.

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
  ownerId: string,                    // grants no permissions
  campaignId: Id<'campaign'>,
  description: string,                // labelled "Notes" in the UI
  kind: 'pc' | 'npc',
  isActive: boolean,
  sheetMode: 'militiaOnly' | 'full',  // presentation only, see "Two presentations"
}
// indexes: by_campaignId

// The only place authored Modifiers are stored. Scope decides who sees it.
catalogEntry: {
  scope: 'global' | 'campaign' | 'character',
  campaignId?: Id<'campaign'>,         // campaign and character scope
  characterId?: Id<'character'>,       // character scope
  name: string,
  sourceKey?: string,                  // shared Source, see "Same Source"; absent = the entry itself
  stacksWithItself: boolean,           // official text says duplicates stack
  modifiers: Modifier[],               // bounded; empty is fine (a rope)
  detail: CatalogEntryDetail,          // discriminated on `kind`
}
// indexes: by_scope, by_campaignId_and_scope, by_characterId, by_sourceKey

// One row per thing a Character has.
characterSheetEntry: {
  characterId: Id<'character'>,
  campaignId: Id<'campaign'>,
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
type CatalogKind = 'base' | 'race' | 'class' | 'classFeature' | 'feat' | 'trait'
                 | 'item' | 'spell' | 'condition' | 'manual';
// State-only: no Catalog Entry; the resolver emits built-in Modifiers from state.
type StateKind = 'classLevel' | 'abilityDamage' | 'abilityDrain';
type EntryKind = Exclude<CatalogKind, 'class'> | StateKind;   // a class is reached through Class Levels

type CatalogEntryDetail =
  | { kind: 'base' }
  | { kind: 'race'; racialHitDice: number }                     // later: creature-type progression
  | { kind: 'class'; classKind: 'base' | 'prestige' | 'npc';
      hitDie: number; bab: 'full' | 'threeQuarters' | 'half';
      saves: Record<'fort' | 'ref' | 'will', 'good' | 'poor'>;
      skillRanksPerLevel: number; classSkills: SkillKey[];
      featuresByLevel: Array<{ classLevel: number; catalogEntryId: Id<'catalogEntry'> }> }
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
- `hpGained` holds the recorded number. How the builder pre-fills it (max at 1st level, a roll, or the average) belongs to [Prototype the character creation and level-up flow](https://github.com/AndreasUnunger/EverythingPath/issues/208).
- **Hit Dice** = Class Levels + racial Hit Dice. They are computed and never recorded. The militia's roster Hit Dice override stays as the militia's own ruling.

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

`sheetMode` controls only how a Character is presented. The sheet behind it is the same in both modes, and switching keeps every entry.

- **Militia-only Character:**
  - Characters & officers shows its name, level and permanent ability totals, and edits them in place.
  - **Raising the level** appends Unspecified Class Levels.
  - **Lowering the level** removes Class Levels from the end, real ones included, after a confirmation naming them.
  - **Editing a score** changes the base score by the difference, so the total shown equals what was typed.
- **Full Character:** it is edited on its Character Sheet. Its level and ability scores are read-only in Characters & officers and link to the sheet. A campaign can have Full Characters with or without a militia. Where they live in the UI belongs to [Prototype the character creation and level-up flow](https://github.com/AndreasUnunger/EverythingPath/issues/208).

The roster Hit Dice override, the name, PC/NPC kind, active state and `description` stay editable in Characters & officers in both modes.

## Catalog scopes

- **Global:** the imported catalog, read-only for players ([Decide how the content dataset becomes the global catalog](https://github.com/AndreasUnunger/EverythingPath/issues/207)).
- **Campaign:** homebrew that anyone in the campaign can use and edit.
- **Character:** one-offs on a single Character, such as base scores, manual adjustments and tweaks.

Adding a one-off inserts its character-scoped Catalog Entry and its sheet entry in one mutation. "Save to catalog" rescopes a character entry to the campaign. "Detach" clones a global or campaign entry into a character-scoped one and repoints the sheet entry.

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
- campaign scoping of every catalog and sheet read.
