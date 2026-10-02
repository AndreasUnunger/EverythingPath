# Character builder prototype — contract (#208, round 2; #216, round 3)

Throwaway prototype of the Pathfinder 1e character builder at
`/prototype/character-builder` (no login). Run `pnpm prototype` (port
3027). Round 3 (attacks and conditional modifiers, #216) is the last
section: "Round 3: attacks and conditional modifiers (#216)". Primary target is tablet landscape (1180×820). Desktop (1440×900)
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

`?variant=1|2|3&page=<page>&campaign=<id>&character=<id>&from=<page>` (round 3; an old `B` shows variant 1), plus
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

1. **Suppression.** Toggle `kesh-bulls` (_bull's strength_, +4 enhancement). Str goes to 23, and the belt's +2 enhancement is listed as suppressed by Bull's strength. Militia facts keep Str 21, because spells of a day or less are temporary. `kesh-raging` gives Str 25, Con 18, Will +5, AC 16 and HP 92. _Haste_ and _boots of speed_ share `sourceKey: 'haste'`.
2. **Level-up 7→8.** `addClassLevel('kesh', 'class.rogue')`: Rogue 4 at character level 8, Uncanny Dodge added automatically, and the warnings show hp not recorded, an ability increase prompt, 9 skill ranks to spend, a rogue talent prompt, and **"Uncanny Dodge from two classes… Add Improved Uncanny Dodge?"** with an `addEntry` action for `cf.improvedUncannyDodge`.
3. **Militia-only in-place edit.** `setMilitiaScore('ardo', 'wis', 18)` changes his base score by +2. `setMilitiaLevel('ardo', 5)` appends Unspecified levels. Lowering a level that has real Class Levels names them first (`levelsRemovedBy`).
4. **Build out.** `buildOut('hessa')`: each Unspecified level shows an info warning; choosing a class adds its fixed features and leaves hit points empty for the player to type. Point buy (18 of 20) and the missing race are advisory.
5. **Leave campaign.** `leaveCampaign('ardo')`: off the roster (no longer Ambassador), the council seal becomes his own copy (Diplomacy unchanged), and he becomes Full. Ama's owner is Mira, so `canLeave(ama)` is false.
6. **Add to campaign.** `addToCampaign('tobin', 'oneshot')` moves Tobin in; adding to Ironfang doesn't put him on the roster.

## Rules shortcuts (prototype fidelity)

- Conditional bonuses are Modifiers with a `condition` since round 3 (see that section). Speed and rage rounds are not statistics.
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

## Round 3: attacks and conditional modifiers (#216)

Wayfinder ticket #216, "Prototype attacks and conditional modifiers on the
living sheet", asks how attacks and conditional modifiers should look and
behave on the living sheet:

- **Attacks.** Weapon attacks with iterative attacks from BAB, two-weapon
  (off-hand) attacks, and each attack's damage and critical range.
- **Conditional modifiers.** A Modifier with a `condition`, such as "+1
  dodge vs. traps" or "while raging". Do they appear in totals, in
  breakdowns, or as listed riders?

Toggling buffs during play is out of scope; entries keep their `active`
flag. Rules come from the CRB only, and rules checks stay advisory.

Three **sheet variants** answer it. Every page is the same as round 2; only
the living sheet differs, through slots.

| `?variant=` | Name             | Setup source               | Idea                                                                                           |
| ----------- | ---------------- | -------------------------- | ---------------------------------------------------------------------------------------------- |
| `1`         | Stat-block lines | `autoSetups(character)`    | Conditional numbers as stat-block lines ("Ref +7, +9 vs. traps"); attacks as stat-block lines. |
| `2`         | Attack table     | `wieldSetups(character)`   | A table of weapons with their `wield`; a situation lens recomputes the whole sheet.            |
| `3`         | Attack routines  | `routineSetups(character)` | Saved Attack Routines the player names, edits and adds.                                        |

The default is `1`, and an unknown or old value (`B`) shows `1`. Run
`pnpm prototype` and open
`http://localhost:3027/prototype/character-builder?variant=1&page=sheet&character=kesh`.

### Files and ownership

All paths are in `src/components/character-builder-prototype/`.

| File                                                                                            | Owner             | What                                                                                          |
| ----------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------- |
| `variant-b/v1-stat-block.tsx`                                                                   | variant 1 (Fable) | `export const v1Slots: SheetVariantSlots`. Today a stub with the default blocks.              |
| `variant-b/v2-attack-table.tsx`                                                                 | variant 2 (Fable) | `export const v2Slots: SheetVariantSlots`.                                                    |
| `variant-b/v3-routines.tsx`                                                                     | variant 3 (Fable) | `export const v3Slots: SheetVariantSlots`.                                                    |
| `attacks.ts`                                                                                    | foundation        | Weapons, the three setup sources, `resolveRoutine`, `statBlockText`.                          |
| `variant-b/sheet-variants.tsx`                                                                  | foundation        | `SheetVariantSlots`, `SHEET_VARIANTS`, `useSheetVariant()`.                                   |
| `variant-b/sheet-default-blocks.tsx`                                                            | foundation        | `Figure`, `StatRow`, `StatGroups`, `DefensesBlock`, `OffenseBlock`, reusable by the variants. |
| `types.ts`, `resolve.ts`, `catalog.ts`, `mock-characters.ts`, `store.tsx`                       | foundation        | Conditions, weapons, routines, resolver options, seed data, actions.                          |
| `variant-b/shared.tsx`, `variant-b/living-sheet.tsx`, `variant-b/skills-table.tsx`, `index.tsx` | foundation        | Context, `StatButton`, breakdown popover, lens, slot wiring, switcher, yellow panel.          |

A variant agent edits only its own file. It may add more files named
`variant-b/v1-*.tsx` (`v2-*`, `v3-*`) for its own components. Anything else
is foundation: ask for a change instead of editing it.

### Conditional Modifiers (`types.ts`)

```ts
type Modifier = { target; bonusType; value; condition?: ModifierCondition };

type ModifierCondition = {
  /** Situational: never applied to a total unless the situation is asked for. */
  situation?: { key: SituationKey; text: string };
  /** Applies only while an active sheet entry with this catalog key exists ("while raging"). */
  whileActive?: { catalogKey: string; text: string };
  /** Only for attacks with this weapon: '$self' = the item carrying it; '$choice' = the entry's choice matched against the weapon's `base`. */
  weapon?: '$self' | '$choice';
};
```

Every part present must hold. `SITUATION_KEYS` (in `types.ts`) is closed.
Its display text is `SITUATION_TEXT` in `catalog.ts`:

| `SituationKey`   | `SITUATION_TEXT`                                    |
| ---------------- | --------------------------------------------------- |
| `traps`          | vs. traps                                           |
| `fear`           | vs. fear                                            |
| `spells`         | vs. spells and spell-like abilities                 |
| `poison`         | vs. poison                                          |
| `enchantment`    | vs. enchantment spells and effects                  |
| `giants`         | vs. giants                                          |
| `orcsGoblinoids` | vs. orcs and goblinoids                             |
| `bullRushTrip`   | vs. bull rush and trip while standing on the ground |
| `sneak`          | when flanking or the target is denied its Dex bonus |

A Modifier's own `situation.text` may be more specific than the key's
text. Superstition says "vs. spells, supernatural and spell-like
abilities", and Trapfinding's Perception says "to locate traps".

New targets: the leaves `damage.melee` and `damage.ranged`, and the parent
`damage`, which expands to both. Weapon enhancement is an item Modifier on
`attack` and `damage` with `condition: { weapon: '$self' }`.

Conditions in the catalog. Every existing summary and `traitsText` stays.

| Entry              | Modifiers with a condition                                                                                                                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `race.dwarf`       | +1 untyped `attack` vs. orcs and goblinoids; +4 dodge `ac.other` vs. giants; +2 racial `saves` vs. poison and, separately, vs. spells; +4 racial `cmd` vs. bull rush and trip while standing on the ground (stability) |
| `race.elf`         | +2 racial `saves` vs. enchantment                                                                                                                                                                                      |
| `race.halfling`    | +2 racial `saves` vs. fear. Halfling luck is now +1 **racial** on saves, per the CRB; it was `luck`.                                                                                                                   |
| `cf.trapSense`     | +1 untyped `save.ref` and +1 dodge `ac.other`, vs. traps. It stacks with itself, so Kesh has +2 of each.                                                                                                               |
| `cf.bravery`       | +1 untyped `save.will` vs. fear                                                                                                                                                                                        |
| `rp.superstition`  | `2 + floor(@classLevel.barbarian / 4)` morale on `saves`, vs. spells, **while raging** (`whileActive: condition.raging`). That is +3 for Kesh.                                                                         |
| `cf.trapfinding`   | Disable Device as before, plus the same formula on Perception to locate traps                                                                                                                                          |
| `feat.weaponFocus` | +1 untyped `attack`, `weapon: '$choice'`                                                                                                                                                                               |
| `item.greataxe+1`  | +1 enhancement `attack` and `damage`, `weapon: '$self'`                                                                                                                                                                |
| `cf.sneakAttack`   | No Modifier. `detail.damageDice: { die: 6, situation: 'sneak', rangedWithin: 30 }`, 1d6 per entry, stacking                                                                                                            |

New catalog entries:

- **Weapons:** `item.greataxe+1`, `item.kukri`, `item.compositeLongbow2`,
  `item.dwarvenWaraxe`, `item.lightCrossbow`. Each has `detail.weapon`
  (`Weapon`): `{ base, group, handedness: 'light'|'oneHanded'|'twoHanded'|'ranged', dice, threat, mult, rangeIncrement?, strRating? }`.
- **Feat:** `feat.twoWeaponFighting` (Dex 15). Nobody has it.

### Resolver (`resolve.ts`)

```ts
resolveSheet(character, opts?: {
  permanentOnly?: boolean;
  situations?: SituationKey[];      // asked for: their Modifiers apply
  weapon?: { entryId; base };       // attacks.ts only
}): ResolvedSheet
```

**Statistics.** Every `Stat` is `{ total, applied, suppressed, conditional }`.

**`conditional`.** It lists `ConditionalContribution[]`: the contributions
left out of `total` because their condition isn't met.

```ts
type ConditionalContribution = Contribution & {
  conditionText: string; // the whole condition: "vs. spells, supernatural and spell-like abilities, while raging"
  situationKey?: SituationKey;
  waitingOn?: string; // the whileActive text when that part is unmet: "while raging"
  weapon?: string; // weapon-scoped, at sheet level: "with greataxe", "with +1 greataxe"
};
```

A `Contribution` may now carry `conditionText?` and `situationKey?`. They
are set when a conditional Modifier does apply, such as a situation asked
for, or a weapon's own bonus inside an attack. That way applied lines can
say why they apply.

**Semantics:**

- **Situational.** A situational Modifier applies only when its key is in
  `opts.situations`. It then stacks and suppresses like any other
  contribution.
- **`whileActive`.** It is met when an active entry with that catalog key
  exists. In `permanentOnly` mode, only permanent entries count.
- **Weapon-scoped.** These never reach a sheet total. At sheet level they
  sit in `conditional` with `weapon` set, and only on the leaf of their
  weapon's kind: the greataxe's +1 shows on `attackMelee` and
  `damageMelee`, not on ranged. Inside attack resolution, other weapons'
  scoped Modifiers are ignored entirely.
- **Stacking.** Stacking runs only over contributions that apply. Kesh
  raging, with `spells` asked for, gets Superstition's +3 morale on Will,
  and Raging's +2 morale Will shows under `suppressed` (reason
  `bonusType`).
- **`sameEntry` with conditions.** The rule is unchanged, but it only sees
  contributions that apply. Two Modifiers of one entry in different
  situations never suppress each other when one situation is asked for.
  With both asked for, only one applies. Dwarven hardy vs. a poison spell
  is +2, not +4.
- **Derived statistics.** They carry the conditional contributions that
  would reach them:
  - AC carries every AC leaf's.
  - Touch AC carries `ac.other`'s.
  - Flat-footed AC carries AC's, without positive dodge bonuses: trap sense
    and defensive training are lost.
  - CMD carries the `cmd` leaf's, plus AC's of the CMD types (circumstance,
    deflection, dodge, insight, luck, morale, profane, sacred) and
    penalties. So CMD is +2 vs. traps for Kesh and +4 vs. giants for
    Brannoc, by the data model's literal composition.
  - Flat-footed CMD carries CMD's.

**`ResolvedSheet` additions:**

- `damageMelee`, `damageRanged`: the authored `damage.*` Modifiers only. No
  Str and no weapon; weapon-scoped ones wait in `conditional`.
- `situationsAsked: SituationKey[]`: what this sheet was resolved with.
- `situations: SheetSituation[]`, in `SITUATION_KEYS` order. A
  `SheetSituation` is `{ key, text, paths: StatPath[], attacks: ('attack'|'damage')[] }`:
  - `paths` lists every sheet statistic with a contribution in that
    situation, whether waiting, applied or suppressed.
  - `attacks` says whether weapon attacks change. `'attack'` comes from a
    situational contribution on `attackMelee`/`attackRanged` (hatred);
    `'damage'` from one on `damageMelee`/`damageRanged`, or from extra dice.
  - Attack-level situations are listed here too. Hatred appears with
    `paths: ['attackMelee','attackRanged'], attacks: ['attack']`. Sneak
    attack has no Stat, so it appears as `{ key: 'sneak', paths: [], attacks: ['damage'] }`.
- `extraDamage: ExtraDamage[]`: `{ label, catalogKey, dice: '2d6', count, die, situationKey, conditionText, rangedWithin?, entryIds }`,
  which is sneak attack. `attacks.ts` applies it.

**Helpers:**

- `StatPath` (now in `types.ts`) adds `damageMelee` and `damageRanged`.
- `STAT_PATHS` lists every path in sheet order. `getStat(sheet, path)`
  moved here; `shared.tsx` re-exports both.
- `resolveInSituation(character, key)` returns the sheet with one situation
  asked for. It is memoised per Character object.
- `situationalTotals(character, baseSheet, path)` returns
  `{ key, text, total, delta }[]`: the situations that change that
  statistic, and only those (delta ≠ 0). Example: `saves.ref` for Kesh gives
  `[{ key: 'traps', text: 'vs. traps', total: 9, delta: 2 }]`. Pass the
  normal sheet (`ui.baseSheet`), not the lens sheet.

### Attacks (`attacks.ts`)

```ts
type AttackSetup = {                       // types.ts, re-exported
  id: string; name: string;
  main: { entryId: string; hand: 'twoHands' | 'oneHand' };   // ranged weapons: 'twoHands'
  off?: { entryId: string };               // two-weapon fighting; main becomes the primary hand
  options: { powerAttack: boolean };
};
type ResolvedAttack = {
  key: string;            // `${setup.id}:main-0` | `:main-1`… | `:haste` | `:off`; unique and stable
  label: string;          // catalog name, "+1 greataxe"
  weaponEntryId: string;
  hand: 'twoHands' | 'oneHand' | 'primary' | 'off' | 'ranged';
  kind: 'melee' | 'ranged';
  sequence: number;       // 1-based order in the full attack
  note?: string;          // 'haste' | 'off hand'
  bonus: Stat;            // conditional[] holds situational ones (hatred)
  damage: { dice: string; bonus: Stat; text: string;          // "1d12+8", "1d12+8 plus 2d6"
            extra: { label; dice; conditionText }[] };          // dice applied because their situation was asked for
  critical: { threat: number; mult: number; text: string };   // "×3", "18–20/×2", "19–20/×2"
  rangeIncrement?: number;
};
type Rider = { key; label; text; from; conditionText?; situationKey? };  // read as `${label}: ${text}` + conditionText
type ResolvedRoutine = {
  setup;
  single: ResolvedAttack | null;   // the standard-action attack; null only when the weapon is gone
  attacks: ResolvedAttack[];       // the full attack (full-round action)
  penalties: string[]; riders: Rider[]; notes: string[];
};

weaponsOf(character): { entry; catalog; weapon }[]     // active weapon items, sheet order
autoSetups(character): AttackSetup[]                    // variant 1
wieldSetups(character): AttackSetup[]                   // variant 2
routineSetups(character): AttackSetup[]                 // variant 3
resolveRoutine(character, sheet, setup, opts?: { situations?: SituationKey[] }): ResolvedRoutine
statBlockText(routine): string    // "+1 greataxe +13/+8 (1d12+8/×3)", "kukri +7/+2 (1d4+5/18–20), kukri +3 (1d4+2/18–20)"
naturalHand(weapon), wieldOf(entry), iterativeCount(bab), powerAttackSteps(bab), criticalText(weapon)
```

`single` is the standard-action attack: the primary (or only) weapon once,
with no two-weapon penalty, no iterative and no haste attack, and Power
Attack as the routine has it. Its key is `<setup id>:single`, its
`sequence` 1, and a two-weapon routine's primary weapon attacks in
`oneHand` there. Two-weapon penalties apply only when you fight with two
weapons in a full attack (CRB), so for "Two kukris" `single` is +11 while
the full attack's first attack is +7. `attacks` is the full attack, in
full-attack order. `sheet` gives BAB; pass the sheet on screen.
`opts.situations` should be the lens, `ui.situation ? [ui.situation] : []`.
For `data-situation-changed` on attack numbers, resolve once with
`ui.baseSheet` and no situations, then match attacks by `key`.

Every part of `bonus` and `damage.bonus` is a Contribution. Their built-in
labels are "BAB", "Str modifier", "Dex modifier", "Two-weapon fighting
(light off hand)", "Power Attack", "2nd attack" (−5), "3rd attack" (−10),
"Str modifier ×1½", "Str modifier ×½", "Str modifier (composite, up to +2)",
"Str penalty" and "Str below the bow’s +2 rating".

**Rules implemented** (CRB):

- **Attack bonus.** BAB + Str (melee) or Dex (ranged) + `attack.*`
  Modifiers + the weapon's scoped Modifiers (`$self`; `$choice` matching
  `weapon.base`, case-insensitive), stacked together as on the sheet. Then
  two-weapon penalties, Power Attack when on, and the iterative penalty.
- **Iteratives.** One more attack at −5 cumulative at BAB +6, +11 and +16,
  for the main or single weapon, ranged included. The off hand gets one
  attack; Improved Two-Weapon Fighting isn't modelled.
- **Haste.** An active entry with `sourceKey: 'haste'` (_haste_, _boots of
  speed_) adds one main-weapon attack at the highest bonus, with
  `note: 'haste'`. The +1 attack comes from the Modifiers.
- **Order.** Highest bonus first; ties go main, haste, off. Two kukris:
  primary +7, off +3, primary +2.
- **Two-weapon penalties (Table 8-7).** Normal −6/−10; light off hand
  −4/−8; with Two-Weapon Fighting −4/−4; both −2/−2. `penalties` gets
  "Two-weapon fighting, light off hand: −4 primary, −8 off hand". Ranged or
  two-handed weapons can't pair: a note, main weapon only.
- **Damage.** Dice + Str + `damage.*` Modifiers + scoped Modifiers + Power
  Attack. Str is:
  - ×1½ in two hands, a one-handed weapon in two hands included (a light
    weapon in two hands stays ×1);
  - ×1 in one hand or the primary hand;
  - ×½ in the off hand (floored);
  - a penalty is always applied in full, never multiplied;
  - composite bows: the bonus up to `strRating`, plus −2 attack when Str is
    below the rating; other bows: the penalty only; crossbows: none;
  - other ranged weapons (thrown, sling): full Str.
- **Power Attack.** Needs the active feat. One step at BAB +1, plus one at
  +4 and every 4 after (BAB 6: −2/+4; BAB 3: −1/+2). Each step is −1
  attack and +2 damage: +50% two-handed, half off hand, melee only. When
  `options.powerAttack` is off, a rider: "Power Attack: −2 attack, +6
  damage", or "−2 attack, +4 damage (+2 off hand)" for two weapons.
- **Sneak attack.** It comes from `sheet.extraDamage`. Without `sneak`
  asked for, it is a rider: "Sneak Attack: +2d6", with conditionText
  "when flanking or the target is denied its Dex bonus" and, for ranged
  weapons, "; ranged only within 30 ft." With `sneak` asked for, the dice
  join `damage.text` ("1d12+8 plus 2d6") and `damage.extra`, and the rider
  goes away.
- **Critical.** `threat` and `mult` come from the weapon (no keen or
  Improved Critical in the data).
- **Notes.** A setup whose weapon is missing or switched off resolves to no
  attacks and a note. A two-handed weapon set to one hand attacks in two
  hands, with a note.

**Setup sources:**

- **`autoSetups` (variant 1).** One setup per weapon in its natural hand
  (`auto-<entryId>`; two-handed and ranged `twoHands`, others `oneHand`).
  Plus `auto-two-weapon` when at least two light or one-handed weapons
  exist: the first two, with the light one in the off hand. Kesh gets
  `+1 greataxe`, `Kukri`, `Kukri`, `Composite longbow (+2 Str)` and
  `Two kukris`.
- **`wieldSetups` (variant 2).** These come from `entry.state.wield`
  (`'twoHands'|'oneHand'|'primary'|'off'|null`, on item entries). There is
  one setup per weapon whose wield isn't null. A `primary` pairs with the
  first unpaired `off` (`wield-<primaryId>-<offId>`), and an unpaired
  primary or off attacks alone in one hand. Seed: Kesh's greataxe
  `twoHands`, kukri-1 `primary`, kukri-2 `off` and longbow `twoHands` (3
  setups); Brannoc's waraxe `oneHand` and crossbow `twoHands`.
- **`routineSetups` (variant 3).** One setup per `attackRoutine` entry, in
  sheet order; `id` is the entry id. Seed: Kesh's "Greataxe", "Greataxe
  with Power Attack", "Two kukris" and "Longbow"; Brannoc's "Waraxe and
  shield" and "Crossbow".

### Data and store actions

- **Item entries.** `SheetEntry.state` for items is now
  `{ kind: 'item'; quantity; wield?: Wield | null }`.
- **Attack Routines.** A new state-only entry kind, `attackRoutine`, has
  state `{ kind: 'attackRoutine'; name; main; off?; options }`, the
  `AttackSetup` minus `id`. It has no `catalogKey`, so the resolver ignores
  it. Gear, Feats, Features, the Class Levels strip and warnings never show
  it. `entryName` returns its name.
- **Seed entries.** Kesh: `kesh-greataxe`, `kesh-kukri-1`, `kesh-kukri-2`,
  `kesh-longbow`, `kesh-boots` (_boots of speed_, off), and
  `kesh-routine-greataxe`, `kesh-routine-greataxe-pa`,
  `kesh-routine-kukris` and `kesh-routine-longbow`. Brannoc:
  `brannoc-waraxe`, `brannoc-crossbow`, `brannoc-routine-waraxe` and
  `brannoc-routine-crossbow`.

| Action                                          | Semantics                                                                                                 |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `setWield(characterId, entryId, wield \| null)` | Sets an item's `wield`. No-op on other entries.                                                           |
| `addRoutine(characterId, routine): id`          | `routine` is `AttackRoutine` = `{ name, main, off?, options }`. Appends an `attackRoutine` entry.         |
| `updateRoutine(characterId, id, patch)`         | Patches `name`, `main`, `off` or `options` (`options` merged). `{ off: undefined }` removes the off hand. |
| `removeRoutine(characterId, id)`                | Deletes the routine.                                                                                      |

### Slots (`variant-b/sheet-variants.tsx`)

```ts
type SheetSlotProps = { character: Character; sheet: ResolvedSheet };   // `sheet` is the sheet on screen (the lens sheet when set)
type SheetVariantSlots = {
  Defenses: ComponentType<SheetSlotProps>;
  Offense: ComponentType<SheetSlotProps>;
  BreakdownExtra?: ComponentType<SheetSlotProps & { path: StatPath | null; openKey: string; title: string; stat: Stat }>;
  replacesConditionalSection?: boolean;   // BreakdownExtra renders its own "Only when…" section
  SkillExtra?: ComponentType<SheetSlotProps & { skill: SkillKey; stat: SkillStat }>;
  VitalExtra?: ComponentType<SheetSlotProps & { path: StatPath; stat: Stat }>;
  AboveSheet?: ComponentType<SheetSlotProps>;
};
useSheetVariant(): { key: '1' | '2' | '3'; slots: SheetVariantSlots };
SHEET_VARIANTS: { key; name; slots }[];
```

Where each slot renders:

- **`Defenses`, `Offense`.** In place of the round-2 blocks, in the left
  column under Ability scores. Attacks go in `Offense`, or `AboveSheet` if
  the variant prefers. The defaults are `DefensesBlock` and `OffenseBlock`
  from `sheet-default-blocks.tsx`. That file also exports `StatRow`
  (`children` render after the label), `StatGroups` and `Figure`.
- **`VitalExtra`.** Under each figure of the pinned vitals row: HP, AC,
  touch, FF, Fort, Ref, Will, BAB, Init, CMB, CMD.
- **`AboveSheet`.** After the membership strip, before the grid.
- **`SkillExtra`.** In the skills table's Total cell, right after the
  number.
- **`BreakdownExtra`.** The last thing in the breakdown popover. `path` is
  null for a Stat opened with `openStat`; then `openKey` identifies it.
- **`replacesConditionalSection`.** A flag, not a component. Set it to
  `true` when `BreakdownExtra` renders its own section for
  `stat.conditional`; the popover then skips its default "Only when…"
  list. Variant 3 sets it; variants 1 and 2 keep the default.

**Context.** `useSheetUi()` (from `shared.tsx`) returns:

```ts
{
  open, setOpen,
  openStat({ key, title, stat, signed = true, anchor }),   // breakdown for any Stat; the same key again closes it
  ranksLevelId, setRanksLevelId,
  situation: SituationKey | null, setSituation(s),         // the lens; setSituation closes the popover
  sheet,        // the sheet on screen (the lens sheet when set)
  baseSheet,    // the normal sheet
  character,
  variant: '1' | '2' | '3', slots,
}
```

**`StatButton`.** It has two forms:

- `<StatButton path="saves.ref" sheet={sheet} title="Reflex save" signed />`
  for a sheet statistic.
- `<StatButton stat={attack.bonus} statKey={`${attack.key}:bonus`} baseStat={base?.bonus} title="+1 greataxe attack" signed />`
  for any Stat.

Both open the one breakdown popover. A button gets
`data-situation-changed="true"` when its value differs from `baseSheet`'s
(or from `baseStat`). It has no styling; the variant styles it, for
example `data-[situation-changed=true]:text-sky-300`. To open a breakdown
from your own element, call
`ui.openStat({ key, title, stat, anchor: e.currentTarget })`.

**Breakdown popover.** Applied lines show `conditionText` after the label.
Under "Not applied", a neutral **"Only when…"** section lists
`stat.conditional`: label, type and value, with the condition text under
each line, plus "(not active now)" when `waitingOn` is set. It is left
out when the variant sets `replacesConditionalSection`. Then comes
`BreakdownExtra`.

**Situation lens.** `ui.situation` is view state only: never saved, and
cleared when the Character changes (`LivingSheet` is mounted with
`key={character.id}`; toggling raging keeps it). When it is set,
`LivingSheet` renders `resolveInSituation(character, situation)` everywhere
on the sheet, and `ui.baseSheet` is the normal one. The variant renders
the control that sets it. The choices are `ui.baseSheet.situations`; their
`text` is the label.

### Yellow state panel

The panel's shortcuts are "kesh · 1 stat-block lines", "kesh · 2 attack
table", "kesh · 3 attack routines" (Kesh's sheet in each variant), "brannoc
sheet" and "ama sheet". It also has two toggles, "kesh raging: on/off"
(`kesh-raging`) and "kesh boots of speed: on/off" (`kesh-boots`).

### Expected numbers (verified with the resolver)

**Kesh, not raging.** The sheet is as in round 2: Fort/Ref/Will 9/7/3, AC
18/13/15, CMD 24/22.

| Statistic or setup                       | Value                                                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| +1 greataxe, two hands                   | +13/+8, 1d12+8, ×3; rider "Power Attack: −2 attack, +6 damage"                                                                       |
| Greataxe with Power Attack               | +11/+6, 1d12+14                                                                                                                      |
| Kukri, one hand                          | +11/+6, 1d4+5, 18–20/×2                                                                                                              |
| Two kukris (no TWF feat, light off hand) | full attack: primary +7/+2, 1d4+5; off hand +3, 1d4+2; Power Attack rider "−2 attack, +4 damage (+2 off hand)". `single`: +11, 1d4+5 |
| Composite longbow (+2 Str)               | +8/+3, 1d8+2, ×3, 110 ft.                                                                                                            |
| Sneak attack                             | rider +2d6 (ranged: within 30 ft.); with `sneak` asked: "1d12+8 plus 2d6"                                                            |
| Ref; vs. traps                           | +7; +9                                                                                                                               |
| AC; vs. traps                            | 18; 20. Touch 13 → 15. Flat-footed stays 15. CMD 24 → 26.                                                                            |
| Perception; to locate traps              | +10; +11                                                                                                                             |
| Will; vs. spells                         | +3; +3 (Superstition waits on raging)                                                                                                |

**Kesh raging** (Str 25, Con 18, AC 16, HP 92):

| Statistic or setup   | Value                                                                           |
| -------------------- | ------------------------------------------------------------------------------- |
| Greataxe             | +15/+10, 1d12+11 (with Power Attack +13/+8, 1d12+17)                            |
| Two kukris           | primary +9/+4, 1d4+7; off hand +5, 1d4+3                                        |
| Will; vs. spells     | +5; **+6**: Superstition +3 morale applies and Raging's +2 morale is suppressed |
| Fort, Ref vs. spells | +3 over raging Fort and Ref                                                     |

**Kesh with boots of speed** (AC 19, Ref +8):

| Setup      | Value                           |
| ---------- | ------------------------------- |
| Greataxe   | +14/+14 (haste)/+9, 1d12+8      |
| Two kukris | +8, +8 (haste), off hand +4, +3 |
| Longbow    | +9/+9/+4                        |

**Brannoc** (AC 18, CMD 18, Fort/Ref/Will +6/+2/+5):

| Statistic or setup                                  | Value                                                                                                           |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Dwarven waraxe, one hand                            | +7, 1d10+3, ×3; vs. orcs and goblinoids +8 (in `bonus.conditional`); rider "Power Attack: −1 attack, +2 damage" |
| Light crossbow                                      | +4, 1d8, 19–20/×2, 80 ft.                                                                                       |
| Will vs. fear                                       | +6                                                                                                              |
| AC vs. giants                                       | 22 (touch too; flat-footed unchanged); CMD vs. giants 22                                                        |
| CMD vs. bull rush and trip (standing on the ground) | 22                                                                                                              |
| Saves vs. poison, vs. spells                        | +2 each (Fort +8, Ref +4, Will +7); both asked at once still +2                                                 |

**Ama.** Saves vs. enchantment are +2. She has no weapons and no setups.

Kesh and Brannoc still have no warnings.
