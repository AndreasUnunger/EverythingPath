# Character builder prototype — contract (#208)

Throwaway prototype of the Pathfinder 1e character builder at
`/prototype/character-builder` (no login). Three variants share one in-memory
foundation; each variant owns only its own files. Run `pnpm prototype` (port
3025). Primary target is tablet landscape (1180×820). Desktop and phone must
remain usable.

Domain terms come from `CONTEXT.md`. The model is
`docs/pf-character-sheet-data-model.md`. Rules checks are advisory and never
block: every field stays editable at any time, including out-of-rules values.

## Files

All files are in `src/components/character-builder-prototype/`.

| File | Owner | What |
|---|---|---|
| `variant-a.tsx`, `variant-b.tsx`, `variant-c.tsx` | **variant agents** | Replace the stub. Each file may add its own `variant-a/…` folder. |
| `index.tsx` | foundation | Reads `?variant`, renders provider + frame + variant + switcher + yellow state panel. |
| `frame.tsx` | foundation | Fake app shell: top bar with campaign switcher and section links, phone bottom bar. |
| `store.tsx` | foundation | Context + `useReducer` store, actions, selectors. |
| `nav.ts` | foundation | `useProtoNav()`: URL navigation. |
| `resolve.ts` | foundation | Pure resolver: `resolveSheet`, `militiaCharacterFacts`, `evaluateFormula`. |
| `warnings.ts` | foundation | `advisoryWarnings`. |
| `hp.ts` | foundation | `hpPrefill`, `rollHitDie`, `HP_POLICIES`. |
| `sheet.ts` | foundation | Pure read helpers (re-exported from `store.tsx`). |
| `catalog.ts` | foundation | Global catalog, skills, labels. |
| `mock-characters.ts` | foundation | Seed campaigns and characters. |
| `types.ts` | foundation | All types. |
| `ui-helpers.ts` | foundation | `formatBonus`, bonus-type colours, and similar helpers. |

Variants must not edit the foundation files. If you need something, ask for
it or derive it locally.

## Variant module shape

```ts
export const name: string;                       // index uses fixed names: A "Guided steps", B "One living sheet", C "Level timeline + live sheet"
export function VariantA(props: VariantProps): ReactNode;   // VariantB / VariantC
export const frameNav: FrameNavFn | undefined;   // optional: change the frame's section links
type VariantProps = { page: ProtoPage; campaignId: string; characterId: string | null };
```

`frameNav({ campaign, page }) => { sections: FrameSection[]; activeKey }`.
Start from `defaultSections(campaign)`, which gives Week N, Finished weeks,
Militia, and Characters & officers (→ `list`). A `FrameSection` is
`{ key, label, short, icon: LucideIcon, to?: { page, character? } }`, and a
section without `to` is inert. Use this for questions like "does a
Characters section appear without a militia?". The frame renders only the
shell. Your component renders the page itself, starting with its own
`<main className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">`, the
real pages' wrapper.

## Pages and URL params

| `?page=` | Must show | Default `&character=` |
|---|---|---|
| `list` | The campaign's characters home. Militia-only rows are edited in place (name, level, the six scores). Full Character rows are read-only and link to the sheet. Switching `sheetMode`. With `&campaign=oneshot` (no militia), where Full Characters live. | — |
| `create` | A new Character from nothing. Use `createCharacter`, then edit it. | — (put the new id in `&character=`) |
| `buildout` | Turn militia-only Sergeant Hessa into a Full Character by giving her five Unspecified Class Levels classes, hp, ranks and so on. | `hessa` |
| `sheet` | Kesh's sheet: derived statistics, breakdowns (applied and suppressed), toggling effects. | `kesh` |
| `levelup` | Level Kesh from 7 to 8. | `kesh` |

Other params: `&variant=A|B|C`, `&campaign=ironfang|oneshot` (default
`ironfang`), and any page-local params you add (`&step=2`, `&tab=skills`).
Every state worth a screenshot must be reachable by URL.

```ts
const nav = useProtoNav();
nav.page; nav.variant; nav.campaignId; nav.characterId; nav.param('step');
nav.go('sheet', { character: 'kesh', campaign?: 'oneshot', params?: { tab: 'skills' } }); // router.replace; page-local params reset on a page change
nav.set({ step: '3' });            // patch params on the current page
nav.href('sheet', { character })   // string for <a href>
```

The store lives above the variant, so switching variants keeps edits.
Reloading the page resets them, and the yellow panel has "reset all
characters".

## Store (`store.tsx`)

`useBuilderStore()` returns
`{ state, catalog, selectedCampaignId, selectedCharacterId, ...actions }`.
`state` is `{ campaigns, characters, hpPolicy, pointBuyBudget }`.

None of these actions blocks. Ids are returned where useful.

| Action | Semantics |
|---|---|
| `createCharacter(p?: NewCharacter): id` | New Character with one Unspecified Class Level, base scores (default all 10), `sheetMode` default `'full'`. It can take `campaignId`, `name`, `kind`, `raceKey`, `startingLevel`, `onRoster`, `roles`. |
| `setSheetMode(id, 'militiaOnly' \| 'full')` | Changes the presentation only. Every entry is kept. |
| `setName(id, name)` / `updateCharacter(id, {name,kind,isActive,description})` | Character fields. `description` is labelled "Notes" in the UI. |
| `setRace(id, raceKey \| null, {abilityChoice?, favoredClass?})` | Replaces the race. `abilityChoice` is the +2 for human and half-orc. Favored class lives on the race entry. |
| `setBaseScore(id, ability, v)` / `setBaseScores(id, scores)` | Edits the character-scoped `base` Catalog Entry. |
| `setMilitiaScore(id, ability, total)` | Militia-only in-place edit. It changes the base score by the difference, so the permanent total equals `total`. |
| `setMilitiaLevel(id, level): string[]` | Raising appends Unspecified Class Levels. Lowering removes levels from the end, together with the entries they granted, and returns the labels of the real levels removed. Confirm first with `levelsRemovedBy(character, level)`. |
| `addClassLevel(id, classKey \| null, choices?): levelId` | Appends a level, or inserts it at `choices.position`. Pre-fills `hpGained` from the hp policy unless you pass it (pass `hpGained: null` to leave it empty). Adds the class's fixed features for that level unless `autoFeatures: false`. Picks such as a rogue talent are never added automatically. |
| `updateClassLevel(id, levelId, patch)` | Patches `classKey`, `hpGained`, `favoredClassBonus`, `abilityIncrease` or `skillRanks` (the whole map). Changing the class swaps the auto-added fixed features and pre-fills an empty `hpGained`. |
| `moveClassLevel(id, levelId, toPosition)` | Moves a level. Positions renumber 1…n, and features stay attached. |
| `removeClassLevel(id, levelId, {keepGained?})` | Deletes a level from anywhere. Entries gained at it are deleted too, unless `keepGained`. |
| `addEntry(id, catalogKey, {gainedAtClassLevel?, active?, choice?, notes?, quantity?}): entryId` | Any catalog-backed entry: feat, trait, item, spell, condition, class feature. |
| `removeEntry(id, entryId)` / `toggleEntryActive(id, entryId, active?)` | Neither touches the base entry. An inactive entry contributes nothing but stays listed. |
| `updateEntry(id, entryId, {notes?, choice?, quantity?, gainedAtClassLevel?})` | `choice` is Skill Focus's skill key or Weapon Focus's weapon. |
| `addOneOff(id, {name, modifiers, kind?, temporary?, notes?}): entryId` | Adds a character-scoped Catalog Entry and its sheet entry in one step (homebrew, manual adjustment). |
| `addAbilityDamage(id, {ability, points, drain?}): entryId` | Damage lowers the modifier and is temporary. Drain lowers the score and is permanent. |
| `setHpPolicy(policy)` / `setPointBuyBudget(n)` | Table settings. The yellow panel also exposes both. |
| `setOnRoster(characterId, onRoster, roles?)` | Militia roster membership (no-op without a militia). |
| `resetPrototype()` | Restores the seed state. |

Selectors and hooks:

- `useCharacter(id)` returns a `Character`.
- `useCampaign(id)` returns a `Campaign`.
- `useCampaignCharacters(campaignId)` returns `{ character, roster: RosterPerson | null }[]`.
- `useResolved(id)` returns `ResolvedSheet | null` (all active entries).
- `useWarnings(id)` returns `Warning[]`.

Pure helpers, re-exported from `store.tsx`:

- `classLevelLabel(character, levelId)` returns "Rogue 4 · character level 8". `classLevelShortLabel` returns "Rogue 4".
- `classLevels(character)` returns the levels in order. `characterLevel`, `hitDice`, `levelInClass` and `className` are also available.
- `featSlots(character)` returns `{ slots: {kind:'general'|'racial'|'class', reason, classLevelId}[], taken }`. Class-granted feats such as Scribe Scroll take no slot.
- `skillRankBudget(character, levelId)` returns `{ total, parts: {label,value}[], spent } | null`, or null for an Unspecified level.
- `featuresGainedAt(character, levelId)` returns `{ features, generalFeat, abilityIncreaseDue, gainedHere }`. Each feature is `{kind:'fixed', grant, catalog, entry?}` or `{kind:'choice', grant:{label,choose}, options: CatalogEntry[], picked: SheetEntry[]}`.
- `pointBuyCost(scores)` returns `{ total, outOfRange }`.
- `levelsRemovedBy(character, level)` returns `string[]`.
- `baseScores(character)`, `favoredClass(character)` and `raceCatalog(character)` read the sheet.
- `entryName(character, entry)` and `isTemporary(character, entry)` describe one entry.
- `lookupCatalog(character, key)` checks the character's own scope first, then the global catalog.

Other modules:

- `catalog.ts`: `CATALOG`, `CATALOG_BY_KEY`, `CLASSES`, `RACES`, `SKILLS`, `SKILL_BY_KEY`, `ABILITY_LABEL`, `ABILITY_SHORT`, `catalogOfKind(kind)`, `catalogForGroup('ragePower'|'rogueTalent'|'combatFeat')`, `classDetail(classKey)` and `POINT_BUY_COST`.
- `hp.ts`: `HP_POLICIES` (`{key,label,description,crb}`), `hpPrefill({position, hitDie, policy})`, which returns `{ value: number|null, roll: boolean, reason }`, and `rollHitDie(hitDie)`.
- `ui-helpers.ts`: `formatBonus(n)` ("+2"/"−1"), `BONUS_TYPE_LABEL`, `BONUS_TYPE_CLASS` (text colour per bonus type), `SEVERITY_CLASS`, `contributionText(c)`, `isBuffed(stat)` and `modOf(score)`.

## Data shapes (`types.ts`)

`Character` is `{ id, campaignId, name, kind:'pc'|'npc', isActive, description, sheetMode, ownCatalog: CatalogEntry[], entries: SheetEntry[] }`.

Everything a Character has is a `SheetEntry`: `{ id, kind, catalogKey?, active, gainedAtClassLevel?, notes?, state }`. Its kind is one of `base`, `race`, `classLevel`, `classFeature`, `feat`, `trait`, `item`, `spell`, `condition`, `manual`, `abilityDamage` or `abilityDrain`.

A Class Level's state is `{ kind:'classLevel', classKey: string|null, position, hpGained: number|null, favoredClassBonus: null|{choice:'hp'}|{choice:'skill'}|{choice:'alt',note}, abilityIncrease: AbilityKey|null, skillRanks: Partial<Record<SkillKey,number>> }`. A null `classKey` means an Unspecified Class Level.

A `CatalogEntry` is `{ key, scope, name, sourceKey?, stacksWithItself, modifiers: {target, bonusType, value: number|{formula}}[], summary?, detail }`.

`ResolvedSheet` holds:

- `abilities`, `abilityMods`, `bab`, `saves.fort|ref|will`, `ac`, `touchAc`, `flatFootedAc`, `attackMelee`, `attackRanged`, `cmb`, `cmd`, `flatFootedCmd`, `init` and `hp`. Each is a `Stat`.
- `skills[key]`: a `Stat` plus `{ ranks, classSkill, trainedOnly, usable, ability }`.
- `level`, `hitDice`, `racialHitDice`, `classes` (`{classKey,name,levels}[]`), `notes`, and `militia` (Militia Character Facts with permanent-only scores).

A `Stat` is `{ total, applied: Contribution[], suppressed: {contribution, by, reason}[] }`. A `Contribution` is `{ label, bonusType, value, builtIn, temporary, target, entryId? }`. Built-in labels look like "BAB (Barbarian 4)", "Dex modifier", "Class skill", "Ranks" and "Barbarian 1 (d12) · level 1". Suppression reasons:

- `bonusType`: the same type, and only the highest applies.
- `sameSource`: one Source, and only the strongest entry applies.
- `sameEntry`: two modifiers of the same entry.
- `excluded`: touch and flat-footed compositions.

A `Warning` is `{ id, severity:'warning'|'prompt'|'info', where, message, action? }`:

- `where` is `'abilities'|'race'|'level'|'skills'|'feats'|'features'|'sheet'|'classLevel:<levelId>'|'entry:<entryId>'`.
- `action` is `{kind:'addEntry', label, catalogKey, gainedAtClassLevel?}`, a one-click fix you may offer. It is never applied automatically.
- Militia-only Characters get only the level-0-PC check.

## Mock data

Ironfang Invasion is at week 14 and has a militia. Its roster has four people:

| id | Who | Mode | Roster |
|---|---|---|---|
| `kesh` | Human Barbarian 4 / Rogue 3, levels B1 B2 R1 R2 B3 R3 B4. 20-point buy, +2 Str, increase at 4 (Str), favored class Barbarian (hp, hp, skill, hp). | full | Marshal |
| `ama` | Elf Wizard 5, headband, ring, inactive *mage armor* and *haste*. Her Wizard 5 bonus feat is unpicked, which gives a prompt. | full | Spymaster |
| `hessa` | Sergeant Hessa, NPC, five Unspecified levels, base scores only. | militiaOnly | Commandant |
| `ardo` | Brother Ardo, PC, three Unspecified levels, base scores only. | militiaOnly | Ambassador |
| `moss` | Old Moss, NPC, level 2. | militiaOnly | not on roster |

One-shot: Hollow Mountain has no militia. Its one Character is `brannoc`, a dwarf Fighter 3 in full mode.

Kesh resolves to:

| Statistic | Value |
|---|---|
| Str | 21 (16 base, +2 human, +1 increase, +2 belt) |
| BAB | +6 (4 + 2) |
| Fort / Ref / Will | 9 / 7 / 3 |
| AC / touch / flat-footed | 18 / 13 / 15 |
| CMB / CMD / flat-footed CMD | 11 / 24 / 22 |
| Initiative | +4 |
| HP | 78 (54 rolled, 3 favored class bonus, 14 Con, 7 Toughness) |

He has no warnings.

## Showcase scenarios

1. **Suppression.** Toggle `kesh-bulls` (*bull's strength*, +4 enhancement). Str goes to 23, and the belt's +2 enhancement is listed as suppressed by Bull's strength. Militia facts keep Str 21, because spells of a day or less are temporary. Also toggle `kesh-raging` for Str 27, Con 18, Will +5, AC 16 (the −2 also reaches CMD) and HP 92. `kesh-potion` is the consumable version of the same effect. To show same-Source stacking, add *haste* (`spell.haste`) and *boots of speed* (`item.bootsOfSpeed`), which share `sourceKey: 'haste'`.
2. **Level-up 7→8.** Run `addClassLevel('kesh', 'class.rogue')`. Rogue 4 is at character level 8, and Uncanny Dodge is added automatically. The warnings then show:
   - hp not recorded (the CRB policy says roll 1d8);
   - an ability increase prompt (level 8);
   - 9 skill ranks to spend (8 + 0 Int + 1 human);
   - a rogue talent prompt (pick from `catalogForGroup('rogueTalent')`);
   - **"Uncanny Dodge from two classes… Add Improved Uncanny Dodge?"**, with an `addEntry` action for `cf.improvedUncannyDodge`.
3. **Militia-only in-place edit.** `setMilitiaScore('ardo', 'wis', 18)` changes his base score by +2. `setMilitiaLevel('ardo', 5)` appends Unspecified levels. Lowering Kesh's level names the real levels first (`levelsRemovedBy`).
4. **Buildout.** Run `setSheetMode('hessa', 'full')`. Each Unspecified level shows an info warning. `updateClassLevel('hessa', 'hessa-l1', { classKey: 'class.fighter' })` pre-fills 10 hp (max at 1st) and adds fixed features. Later levels pre-fill per the hp policy. Point buy (18 of 20) and the missing race show as advisory warnings.
5. **HP prefill policies.** There are three:
   - `'maxFirst+roll'` (Core Rulebook, the default): max at 1st, then `value: null, roll: true`.
   - `'maxFirst+average'` (table rule): half the die + 1.
   - `'max'` (table rule).

   Present the choice and the "not Core Rulebook" flag as you see fit, and always let the player type their own number.

## Rules shortcuts (prototype fidelity)

- Conditional bonuses are text only. That covers dwarf defensive training, trap sense vs. traps and bravery vs. fear. Speed, damage, sneak attack dice and rage rounds are not statistics.
- The skill-rank budget uses the Character's current permanent Int for every level, not the Int it had at that level.
- Flat-footed AC drops Dex and dodge even with Uncanny Dodge, following the data model's literal composition.
- Armor max Dex caps Dex to AC. Armor check penalties come from active armour and shields. Armor Training is not applied.
- Base saves sum the per-class progressions, so the +2 of each good save is counted per class.
- Formulas use the closed grammar. An unsupported formula adds nothing and becomes a `sheet` warning.
- Ids are strings, and catalog entries are addressed by `key`.

## Styling conventions (match the current app)

- **Theme.** The app is dark only. The background is near-black, `--radius` is 0 (square corners), and the root font size is 18px. `font-sans` is Cinzel and is used for headings and names. `font-mono` is VT323 and is used for numbers, chips and table headers. Never introduce light surfaces.
- **Tokens.** Use `bg-background`, `bg-card`, `bg-sidebar`, `text-foreground`, `text-muted-foreground`, `text-primary`, `border-foreground/20` (row and card borders), `border-foreground/10` (row dividers), `bg-foreground/5` and `bg-foreground/10` (hover), and `text-destructive` (errors).
- **Advisory warnings.** Use `text-amber-300` with lucide `TriangleAlert` and `border-amber-500/60` badges, as in `characters-officers/parts.tsx`. Use sky for prompts and muted for info (`SEVERITY_CLASS`).
- **Components.** Use the shadcn components in `~/components/ui`: `button` (variants default, outline, ghost, secondary, link; sizes default, sm, icon), `input`, `select`, `dialog`, `sheet` (side panels and phone bottom sheets), `tabs`, `tooltip`, `badge`, `card`, `label`, `separator`, `textarea` and `skeleton`. Icons come from `lucide-react`. Use `cn` from `~/lib/utils`.
- **Patterns.**
  - Section headings are `font-sans text-2xl`.
  - Table header cells are `text-muted-foreground px-2 py-2 text-left font-mono text-xs font-normal tracking-wide uppercase`.
  - A chip is `border-foreground/40 inline-flex items-center border px-1.5 py-0.5 font-mono text-xs leading-tight`.
  - Numbers are `font-mono`.
  - Touch targets are `min-h-11 md:min-h-9`.
  - Tables appear from 768px (`md`). Below that, show cards (`border-foreground/20 bg-card border p-3`).
- **Layout.** The page wrapper is `mx-auto w-full max-w-6xl p-4 md:p-6`. Breakpoints are `md` (768) and `lg` (1024). The custom `short:` variant targets heights of 520px or less. The phone bottom bar is about 48px, so keep fixed controls above it.
- **Copy.** Write user-facing copy in plain product language: no storage, sync or id talk. Validation is styled in-app, never native browser popups.
