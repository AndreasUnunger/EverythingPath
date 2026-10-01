# Character builder prototype — contract (#208, round 2)

Throwaway prototype of the Pathfinder 1e character builder at
`/prototype/character-builder` (no login). Run `pnpm prototype` (port
3025). Primary target is tablet landscape (1180×820). Desktop (1440×900)
and phone (390×844) must remain usable.

Round 1 (commits 2bbc177 and 7ed8e3a) had three variants. The review chose
**B ("One living sheet")** as the starting point, not locked in. Round 2
keeps only B and rebuilds it inside the approved app shell, **variant C** of
[#213](https://github.com/AndreasUnunger/EverythingPath/issues/213) (tag
`prototype-approved/app-shell`), with the decisions of #212, #213 and ADR
0002:

- Characters are owned by a user and can be in **no campaign**; a Character
  is in at most one campaign and can move (**Add to campaign**, **Leave
  campaign**, **Add from my characters**).
- The presentation is a **status**, not a picker. Militia-only has a one-way
  **Build out** button on Characters & officers and on the sheet body.
- **Hit points per Class Level are a plain number** the player types. No
  roll, average or max buttons, no pre-fill policy; new levels start empty.
- Create from the Characters area (no campaign), a campaign's Characters
  page (in it), and Characters & officers (Militia-only, on the roster).

Domain terms come from `CONTEXT.md`; the model is
`docs/pf-character-sheet-data-model.md`. Rules checks are advisory and never
block: every field stays editable at any time, including class, order and
deletion of Class Levels.

## Files

All files are in `src/components/character-builder-prototype/`.

| File                                                                                                     | Owner        | What                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `variant-b.tsx`, `variant-b/…`                                                                           | presentation | Variant B's pages inside the shell.                                                                                                      |
| `index.tsx`                                                                                              | foundation   | Provider, shell, page dispatch, switcher, yellow state panel.                                                                            |
| `shell/shell.tsx`, `shell/phone.tsx`, `shell/parts.tsx`, `shell/model.ts`                                | foundation   | Shell C copied from the approved app-shell prototype and wired to this store and URL. Exports `AppShell`, `NavLink`, `PAGE_LABEL`, tabs. |
| `shell/placeholders.tsx`                                                                                 | foundation   | Campaigns, Campaign home, Week, Finished weeks, Militia and Setup bodies, copied from the shell prototype.                               |
| `nav.ts`                                                                                                 | foundation   | `useProtoNav()`: URL state and navigation.                                                                                               |
| `flows.ts`                                                                                               | foundation   | `useCreateFlow`, `useLevelUpRedirect`, `useBuildoutFlow`: URL actions that end on the sheet.                                             |
| `store.tsx`                                                                                              | foundation   | Context + `useReducer` store, actions, selectors.                                                                                        |
| `resolve.ts`, `warnings.ts`, `sheet.ts`, `catalog.ts`, `mock-characters.ts`, `types.ts`, `ui-helpers.ts` | foundation   | Resolver, advisory warnings, read helpers, catalog, seed data, types.                                                                    |

## Shell

`AppShell` (shell C) renders the pinned top bar (place picker over
Campaigns, Characters and the organization's campaigns; the place's pages as
section links), the militia's left rail on militia pages (icons only below
1280px), and on phone the fixed bottom tabs Campaign · Militia · Characters ·
More with the current tab's pages in a strip under the top bar. On a
Character page it renders only a Back button to `nav.back` above the page;
there is no sub-header bar. The page body shows the Character's name,
status and the **Add to campaign**, **Leave campaign** and **Build out**
actions, once. The path is never shown. The top bar's height is
`--shell-top` on the shell root, so a page's own sticky element sits at
`top: var(--shell-top)`. Militia pages scroll inside their own column from
768px (sticky there is relative to that column).

## Pages and URL params

`?variant=B&page=<page>&campaign=<id>&character=<id>&from=<page>`, plus
page-local params. Every state worth a screenshot is reachable by URL.

| `?page=`                              | Shows                                                                                                                                                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `campaigns`                           | The homepage: pick a campaign (placeholder).                                                                                                                                                                                                                  |
| `characters`                          | The Characters area: every Character I own, "No campaign" first, then by campaign. **New character** → `create` with no campaign.                                                                                                                             |
| `campaign-home`                       | A campaign's home (placeholder). `&campaign=` (default `ironfang`).                                                                                                                                                                                           |
| `campaign-characters`                 | A campaign's Characters, everyone's, with or without a militia (`&campaign=oneshot`). **New character** → `create&campaign=<id>`; **Add from my characters** moves one in.                                                                                    |
| `week`, `history`, `militia`, `setup` | Militia placeholders.                                                                                                                                                                                                                                         |
| `officers`                            | Characters & officers. Status per row; Militia-only rows edit name, level and the six scores in place and have **Build out**; Full rows are read-only and link to the sheet. **New character** makes a Militia-only Character on the roster, edited in place. |
| `sheet`                               | A Character's sheet (default `kesh`). Militia-only Characters (`hessa`) show the Militia-only body with **Build out**. Reachable with no militia (`brannoc`) and no campaign (`ilsa`, `tobin`).                                                               |
| `levelup`                             | A URL action: appends a Class Level (default Kesh 7 → 8; `&as=<classKey>` or `unspecified`), then opens `sheet` with `&level=<id>`, scrolled to the new level.                                                                                                |
| `create`                              | A URL action: a new Character from nothing (`&campaign=<id>` or none), then opens its `sheet`.                                                                                                                                                                |
| `buildout`                            | A URL action (default `hessa`): builds a Militia-only Character out, as the button would, then opens its `sheet`.                                                                                                                                             |

`from` is where a Character page was opened from; Back goes there in the
Character's current campaign (or its list, if it left or moved). It
survives moving between Character pages.

```ts
const nav = useProtoNav();
nav.page;
nav.campaignId;
nav.campaign;
nav.characterId;
nav.from;
nav.back;
nav.param('level');
nav.go('sheet', { character: 'kesh', from: 'officers' }); // Character pages
nav.go('campaign-characters', { campaign: 'oneshot' }); // campaign pages
nav.go('create', { campaign: 'oneshot', from: 'campaign-characters' });
nav.set({ level: id }); // patch page-local params
nav.goBack(); // Back on a Character page
nav.href(page, opts); // string for <a href>
```

The store lives above the shell, so navigating keeps edits. Reloading
resets them, and the yellow panel has "reset all characters" plus shortcuts
to every notable state.

## Store (`store.tsx`)

`useBuilderStore()` returns `{ state, catalog, ...actions }`. `state` is
`{ campaigns, characters, pointBuyBudget, notice }`.

None of these actions blocks. Ids are returned where useful.

| Action                                                                                          | Semantics                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createCharacter(p?: NewCharacter): id`                                                         | New Character owned by me, with one Unspecified Class Level and base scores (default all 10). No `campaignId` = in no campaign. `sheetMode: 'militiaOnly'` sticks only in a campaign with a militia. It can take `campaignId`, `name`, `kind`, `sheetMode`, `raceKey`, `startingLevel`, `onRoster`, `roles`. |
| `buildOut(id)`                                                                                  | One way: Militia-only becomes Full for good, every entry kept. Sets the notice. There is no way back.                                                                                                                                                                                                        |
| `addToCampaign(id, campaignId)`                                                                 | Moves the Character into a campaign. One in another campaign leaves it first (see below). Never puts it on the militia roster. Sets the notice.                                                                                                                                                              |
| `leaveCampaign(id)`                                                                             | Back to no campaign: off the roster and its roles, campaign homebrew detached into character-scoped copies (the sheet doesn't change), Militia-only becomes Full. Confirm first with `leaveConsequences(state, id)`. Only the owner may leave (`canLeave(character)`). Sets the notice.                      |
| `dismissNotice()`                                                                               | Clears the confirmation note.                                                                                                                                                                                                                                                                                |
| `setName(id, name)` / `updateCharacter(id, {name,kind,isActive,description})`                   | Character fields. `description` is labelled "Notes" in the UI.                                                                                                                                                                                                                                               |
| `setRace(id, raceKey \| null, {abilityChoice?, favoredClass?})`                                 | Replaces the race. `abilityChoice` is the +2 for human and half-orc. Favored class lives on the race entry.                                                                                                                                                                                                  |
| `setBaseScore(id, ability, v)` / `setBaseScores(id, scores)`                                    | Edits the character-scoped `base` Catalog Entry.                                                                                                                                                                                                                                                             |
| `setMilitiaScore(id, ability, total)`                                                           | Militia-only in-place edit. It changes the base score by the difference, so the permanent total equals `total`.                                                                                                                                                                                              |
| `setMilitiaLevel(id, level): string[]`                                                          | Raising appends Unspecified Class Levels. Lowering removes levels from the end, together with the entries they granted, and returns the labels of the real levels removed. Confirm first with `levelsRemovedBy(character, level)`.                                                                           |
| `addClassLevel(id, classKey \| null, choices?): levelId`                                        | Appends a level, or inserts it at `choices.position`. `hpGained` starts `null` unless passed: the player types the number. Adds the class's fixed features for that level unless `autoFeatures: false`. Picks such as a rogue talent are never added automatically.                                          |
| `updateClassLevel(id, levelId, patch)`                                                          | Patches `classKey`, `hpGained`, `favoredClassBonus`, `abilityIncrease` or `skillRanks` (the whole map). Changing the class swaps the auto-added fixed features. `hpGained` is never filled in for you.                                                                                                       |
| `moveClassLevel(id, levelId, toPosition)`                                                       | Moves a level. Positions renumber 1…n, and features stay attached.                                                                                                                                                                                                                                           |
| `removeClassLevel(id, levelId, {keepGained?})`                                                  | Deletes a level from anywhere. Entries gained at it are deleted too, unless `keepGained`.                                                                                                                                                                                                                    |
| `addEntry(id, catalogKey, {gainedAtClassLevel?, active?, choice?, notes?, quantity?}): entryId` | Any catalog-backed entry: feat, trait, item, spell, condition, class feature.                                                                                                                                                                                                                                |
| `removeEntry(id, entryId)` / `toggleEntryActive(id, entryId, active?)`                          | Neither touches the base entry. An inactive entry contributes nothing but stays listed.                                                                                                                                                                                                                      |
| `updateEntry(id, entryId, {notes?, choice?, quantity?, gainedAtClassLevel?})`                   | `choice` is Skill Focus's skill key or Weapon Focus's weapon.                                                                                                                                                                                                                                                |
| `addOneOff(id, {name, modifiers, kind?, temporary?, notes?}): entryId`                          | Adds a character-scoped Catalog Entry and its sheet entry in one step (homebrew, manual adjustment).                                                                                                                                                                                                         |
| `addAbilityDamage(id, {ability, points, drain?}): entryId`                                      | Damage lowers the modifier and is temporary. Drain lowers the score and is permanent.                                                                                                                                                                                                                        |
| `setPointBuyBudget(n)`                                                                          | Table setting, also in the yellow panel.                                                                                                                                                                                                                                                                     |
| `setOnRoster(characterId, onRoster, roles?)`                                                    | Militia roster membership in the Character's campaign (no-op without a militia).                                                                                                                                                                                                                             |
| `setRoles(characterId, roles)` / `setHitDiceOverride(characterId, n \| null)`                   | Roster person's officer roles and the militia's Hit Dice ruling.                                                                                                                                                                                                                                             |
| `resetPrototype()`                                                                              | Restores the seed state.                                                                                                                                                                                                                                                                                     |

Selectors and hooks:

- `useCharacter(id)` returns a `Character`.
- `useCampaign(id)` returns a `Campaign`. `useCampaigns()` returns the organization's campaigns.
- `useCampaignCharacters(campaignId)` returns `{ character, roster: RosterPerson | null }[]`, everyone's.
- `useMyCharacters()` returns the Characters area's groups: `{ key, campaign: Campaign | null, characters }[]`, "No campaign" (`campaign: null`) first, then one per campaign (possibly empty).
- `useRosterPerson(id)` returns the Character's `RosterPerson` in its campaign, or null.
- `useNotice(id)` returns the `Notice` (`{ characterId, kind: 'left'|'added'|'moved'|'builtOut', title, lines }`) when the last membership change was this Character's.
- `leaveConsequences(state, id)` returns `{ campaign, roster, detached: string[], becomesFull } | null`, for the Leave confirmation.
- `canLeave(character)` (owner and in a campaign) and `isMilitiaOnly(character)`.
- `ME`, `USERS`, `userName(id)`, `ORGS` (one organization).
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
- `levelLine(character)` returns "Level 7 · Barbarian 4 / Rogue 3", or "Level 5" when no level has a class.
- `baseScores(character)`, `favoredClass(character)` and `raceCatalog(character)` read the sheet.
- `entryName(character, entry)` and `isTemporary(character, entry)` describe one entry.
- `lookupCatalog(character, key)` checks the character's own scope first, then the global catalog, then campaign homebrew.

Other modules:

- `catalog.ts`: `CAMPAIGN_CATALOG` and `campaignCatalog(campaignId)` (campaign homebrew), `CATALOG`, `CATALOG_BY_KEY`, `CLASSES`, `RACES`, `SKILLS`, `SKILL_BY_KEY`, `ABILITY_LABEL`, `ABILITY_SHORT`, `catalogOfKind(kind)`, `catalogForGroup('ragePower'|'rogueTalent'|'combatFeat')`, `classDetail(classKey)` and `POINT_BUY_COST`.
- `flows.ts`: `useCreateFlow()`, `useLevelUpRedirect(characterId)` and `useBuildoutFlow(characterId)`, the URL actions behind those pages (see Pages); each does its thing and opens `sheet`.
- `ui-helpers.ts`: `formatBonus(n)` ("+2"/"−1"), `BONUS_TYPE_LABEL`, `BONUS_TYPE_CLASS` (text colour per bonus type), `SEVERITY_CLASS`, `contributionText(c)`, `isBuffed(stat)` and `modOf(score)`.

## Data shapes (`types.ts`)

`Character` is `{ id, ownerId, campaignId?, name, kind:'pc'|'npc', isActive, description, sheetMode, ownCatalog: CatalogEntry[], entries: SheetEntry[] }`. No `campaignId` = in no campaign. `sheetMode` is the presentation, shown as a status, never a picker.

Everything a Character has is a `SheetEntry`: `{ id, kind, catalogKey?, active, gainedAtClassLevel?, notes?, state }`. Its kind is one of `base`, `race`, `classLevel`, `classFeature`, `feat`, `trait`, `item`, `spell`, `condition`, `manual`, `abilityDamage` or `abilityDrain`.

A Class Level's state is `{ kind:'classLevel', classKey: string|null, position, hpGained: number|null, favoredClassBonus: null|{choice:'hp'}|{choice:'skill'}|{choice:'alt',note}, abilityIncrease: AbilityKey|null, skillRanks: Partial<Record<SkillKey,number>> }`. A null `classKey` means an Unspecified Class Level.

A `Campaign` is `{ id, name, orgId, description, militia: { week, finishedWeeks, roster } | null }`.

A `CatalogEntry` is `{ key, scope, campaignId?, copiedFrom?, name, sourceKey?, stacksWithItself, modifiers: {target, bonusType, value: number|{formula}}[], summary?, detail }`.

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

One organization, Phaendar table. The signed-in user is Andreas (`ME`).

Ironfang Invasion is at week 14 (13 finished) and has a militia. Its roster has four people:

| id      | Who                                                                                                                                               | Owner   | Mode        | Roster        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------- | ------------- |
| `kesh`  | Human Barbarian 4 / Rogue 3, levels B1 B2 R1 R2 B3 R3 B4. 20-point buy, +2 Str, increase at 4 (Str), favored class Barbarian (hp, hp, skill, hp). | Andreas | full        | Marshal       |
| `ama`   | Elf Wizard 5, headband, ring, inactive _mage armor_ and _haste_. Her Wizard 5 bonus feat is unpicked, which gives a prompt.                       | Mira    | full        | Spymaster     |
| `hessa` | Sergeant Hessa, NPC, five Unspecified levels, base scores only.                                                                                   | Jonas   | militiaOnly | Commandant    |
| `ardo`  | Brother Ardo, PC, three Unspecified levels, base scores, and the Ironfang homebrew _Phaendar council seal_.                                       | Andreas | militiaOnly | Ambassador    |
| `moss`  | Old Moss, NPC, level 2.                                                                                                                           | Jonas   | militiaOnly | not on roster |

One-shot: Hollow Mountain has no militia. Its one Character is `brannoc`, a dwarf Fighter 3 (Andreas, full).

No campaign: `ilsa` (Ilsa Varn, human Cleric 2, built) and `tobin` (Brother Tobin, base scores and one Unspecified level), both Andreas's.

Kesh resolves to:

| Statistic                   | Value                                                        |
| --------------------------- | ------------------------------------------------------------ |
| Str                         | 21 (16 base, +2 human, +1 increase, +2 belt)                 |
| BAB                         | +6 (4 + 2)                                                   |
| Fort / Ref / Will           | 9 / 7 / 3                                                    |
| AC / touch / flat-footed    | 18 / 13 / 15                                                 |
| CMB / CMD / flat-footed CMD | 11 / 24 / 22                                                 |
| Initiative                  | +4                                                           |
| HP                          | 78 (54 recorded, 3 favored class bonus, 14 Con, 7 Toughness) |

He has no warnings.

## Showcase scenarios

1. **Suppression.** Toggle `kesh-bulls` (_bull's strength_, +4 enhancement). Str goes to 23, and the belt's +2 enhancement is listed as suppressed by Bull's strength. Militia facts keep Str 21, because spells of a day or less are temporary. `kesh-raging` gives Str 27, Con 18, Will +5, AC 16 and HP 92. _Haste_ and _boots of speed_ share `sourceKey: 'haste'`.
2. **Level-up 7→8.** `addClassLevel('kesh', 'class.rogue')`: Rogue 4 at character level 8, Uncanny Dodge added automatically, and the warnings show hp not recorded, an ability increase prompt, 9 skill ranks to spend, a rogue talent prompt, and **"Uncanny Dodge from two classes… Add Improved Uncanny Dodge?"** with an `addEntry` action for `cf.improvedUncannyDodge`.
3. **Militia-only in-place edit.** `setMilitiaScore('ardo', 'wis', 18)` changes his base score by +2. `setMilitiaLevel('ardo', 5)` appends Unspecified levels. Lowering a level that has real Class Levels names them first (`levelsRemovedBy`).
4. **Build out.** `buildOut('hessa')`: each Unspecified level shows an info warning; choosing a class adds its fixed features and leaves hit points empty for the player to type. Point buy (18 of 20) and the missing race are advisory.
5. **Leave campaign.** `leaveCampaign('ardo')`: off the roster (no longer Ambassador), the council seal becomes his own copy (Diplomacy unchanged), and he becomes Full. Ama's owner is Mira, so `canLeave(ama)` is false.
6. **Add to campaign.** `addToCampaign('tobin', 'oneshot')` moves Tobin in; adding to Ironfang doesn't put him on the roster.

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
