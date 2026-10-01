# PF1 content dataset for the builder catalog

Research for #202 (map #201). Question: which open, machine-readable Pathfinder 1e dataset should seed the builder's global catalog (`scope: 'global'` catalog entries in `docs/pf-character-sheet-data-model.md`)?

Investigated 2026-10-01 against the dataset repositories themselves (cloned and inspected), their licence files, and the publishers' own licence pages. Counts are files or rows in the snapshot named next to each source.

## Recommendation

**Primary: the Foundry VTT pf1 system compendium packs**, plus the `pf1-content` module from the same GitLab group for breadth (feats, traits, magic items). Pin a release tag and import with a one-off script that maps each item to a catalog entry.

- It is the only candidate with **structured modifiers**. Each item carries `system.changes` entries shaped `{ target, type, formula }`, which line up with the data model's `{ target, bonusType, value }`.
- It is **actively maintained** and stored as one YAML file per record in git, so a pinned version can be diffed and re-imported.
- Records carry **stable IDs** and **structured sources** (Paizo product code plus page), so imports can upsert idempotently and filter to Paizo content.
- Content is OGL 1.0a, and Product Identity is covered by Paizo's Community Use Policy. Both are compatible with a free, public app.

**Fallback: the d20pfsrd / Pathfinder Community spreadsheets** (Feats, Magic Items and Spells Google Sheets). They are the same lineage as `convex/data/spells.js`. They are flat CSV, OGL, and broad (3,072 feats, 4,241 magic items, 2,905 spells), with semi-structured feat prerequisites. They have no modifiers, races or classes, so every modifier would be hand-authored.

**Not recommended:** PSRD-Data (frozen in 2015, prose only, no licence file). Archives of Nethys (no dataset, and its content is explicitly excluded from the Community Use Policy).

**Gaps in every candidate:** archetypes and prestige classes, and structured prerequisites. These need campaign-scoped homebrew entries or later hand-curation (see [Gaps](#gaps-the-builder-must-plan-for)).

## Correction to the map: `convex/data/spells.js` is not Archives of Nethys

Map #201 says the spell list is the "AoN dataset". It is the **d20pfsrd / Pathfinder Community Spells Database**:

- Every record's `linkText` points at d20pfsrd.com, e.g. `http://www.d20pfsrd.com/magic/all-spells/a/acid-arrow` (`convex/data/spells.js`, record `id: 1`).
- d20pfsrd's Spells DB page embeds Google Sheet `0AhwDI9kFz9SddG5GNlY5bGNoS2VKVC11YXhMLTlDLUE` ([d20pfsrd spells-db](https://www.d20pfsrd.com/magic/tools/spells-db/)). The same sheet is listed under [pathfindercommunity.net Databases > Spells](https://www.pathfindercommunity.net/home/databases/spells).
- The sheet's CSV export ([export link](https://docs.google.com/spreadsheets/d/0AhwDI9kFz9SddG5GNlY5bGNoS2VKVC11YXhMLTlDLUE/export?format=csv)) has exactly 2,905 rows, the same as `spells.js`. Its columns are the snake_case originals of the camelCase keys in `spells.js` (`spell_level`, `SLA_Level`, `linktext`, `summoner_unchained`...), and Acid Arrow is `id` 1 in both.

## Comparison

| | Foundry pf1 system + pf1-content | d20pfsrd community sheets | PSRD-Data | Archives of Nethys |
|---|---|---|---|---|
| Format | YAML, one file per record, in git | Google Sheets, CSV export | JSON per record plus SQLite | HTML site only |
| Races | 82, with ability modifiers as `changes` | none | 79 race files (prose) | full (site) |
| Classes | 44 base + 5 NPC, BAB, saves, HD, skills, class skills structured | none | 45 (core, prestige, NPC; BAB/saves in HTML tables) | full |
| Archetypes | none | none (the site lists multiclass archetypes as pages) | 221 (books up to 2014) | full |
| Class features | 4,673 (system) + 768 (module) | none | prose sections | full |
| Feats | 390 (system) + 3,251 (module) | 3,072 | 1,099 | full |
| Traits | 1,983 traits + 1,872 racial traits (module) | none | 298 | full |
| Magic items | 236 + 269 (system) + ~4,200 (module) | 4,241 | 3,523 items | full |
| Spells | 3,037 | 2,905 | yes | full |
| Structured modifiers | yes: `changes {target, type, formula}` | no | no | no |
| Structured prerequisites | no (prose in description) | partial: `prerequisite_feats`, `prerequisite_skills` columns | no (a "Prerequisites" text section) | no |
| Content licence | OGL 1.0a + Community Use notice; repo code GPL-3.0 | OGL 1.0a (site-wide declaration) | Paizo PRD content (OGL); data repo has no licence file | OGL text shown, but site content "not available for use under Paizo's Community Use License" |
| Maintenance | system: commits weekly, v11.11 (2026-03-09); module: last commit 2025-11-24 | sheets cover books to 2018 (Planar Adventures, Bestiary 6) | last commit 2015-05-08 | active site, no data feed |

## Candidate details

### 1. Foundry VTT pf1 system packs (`foundryvtt_pathfinder1e/foundryvtt-pathfinder1`)

Repository: <https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1>, inspected at commit `b0d719e1` (2026-10-01), `package.json` version 11.11.

**Licence.** The README says: "The software component of this system is distributed under the GNUv3 license while the game content is distributed under the Open Gaming License v1.0a." It also carries Paizo's Community Use notice ([README](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/master/README.md), [LICENSE.txt](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/master/LICENSE.txt), [OGL.txt](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/master/OGL.txt)). The system's OGL.txt Section 15 lists only the OGL, the 3.5 SRD and Foundry, with no Paizo titles. A redistributor must therefore build its own Section 15 from the records' `sources`. pf1-content's OGL.txt has a ready-made list of Paizo book notices (below).

**Maintenance.** GitLab releases run v11.2 (2025-02-18) through v11.11 (2026-03-09). Pack commits continue weekly (latest `fix(pack): preserve spell`, 2026-09-28) ([releases API](https://gitlab.com/api/v4/projects/16774935/releases), [commits touching packs/](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/commits/master/packs)). Packs are source YAML compiled into Foundry databases by `npm run packs:compile` (`package.json`), so the YAML is the canonical form.

**Coverage** (files under `packs/`). races 82, classes 49 (44 `subType: base`, 5 `npc`; no prestige classes), class-abilities 4,714, feats 390, items 1,726, ultimate-equipment 269, armors-and-shields 75, weapons-and-ammo 508, spells 3,037, buffs 207, skills. **No archetypes**: no archetype item type and no archetype pack. Only 25 class-ability files mention the word.

Sources are structured (`sources: [{ id: PZO1110, pages: '116, 131' }]`). Of 8,343 source references, all but 7 are Paizo product codes (`PZO…`), so third-party records can be filtered by prefix.

**Sample records.**

*Belt of Giant Strength +4* (`packs/items/magic-items/wondrous-items/belt/belt-of-giant-strength-4.ddolY7D1xWkCT3q9.yaml`): `slot: belt`, `cl: 8`, `price.base: 16000`, `weight.value: 1`, `aura.school: trs`, and

```yaml
changes:
  hbn2gsfe: { _id: hbn2gsfe, formula: '4', target: str, type: enh }
```

That maps to `{ target: 'strength', bonusType: 'enhancement', value: 4 }` with no parsing. The +2/+4/+6 belts are separate records.

*Elf* (`packs/races/core/elf.NgIhxRI0axrf3fcO.yaml`): `changes` `dex +2 racial`, `int +2 racial`, `con -2 racial`, `skill.perception +2 racial`. `contextNotes` holds situational text such as "+2 Racial vs Enchantment Effects". It also has `size: med`, `speeds.land: 30`, `languages`, `weaponProf`, `creatureTypes`, and `sources`.

*Fighter* (`packs/classes/fighter.WLqBCT5DqmGAx8Wd.yaml`): `bab: high`, `hd: 10`, `skillsPerLevel: 2`, `savingThrows: { fort: high, ref: low, will: low }`, `classSkills: [...]`, `armorProf`, `weaponProf`, `wealth: 5d6 * 10`. `links.supplements` lists `{ level, uuid }` pointing at class-ability items (levels 1, 2, 3, 5, 7, 20). That is the level-up feature table in structured form.

*Power Attack* (`packs/feats/power-attack.FUW5mIXHNBBIQ1Sq.yaml`): `subType: feat`, `tags: [Combat, Offensive]`, `changeFlags: [powerAttack]`. The prerequisites exist only inside the description HTML: `<strong>Prerequisites</strong>: Str 13, base attack bonus +1.`

**How well `changes` map onto the modifier model.** Measured across the system packs and pf1-content, counting top-level item `system.changes`:

- 2,093 changes. 1,632 have a constant integer formula. 461 are expressions such as `sizeRoll(1, 3, @size)` or `min(0, -floor(@abilities.dex.mod / 2))`. 744 are constant changes to the six ability scores, the data model's first slice.
- The system defines its bonus types in `module/config.mjs` (`bonusTypes`): `base, untyped, untypedPerm, enh, dodge, haste, inherent, deflection, morale, luck, sacred, insight, resist, profane, trait, racial, size, competence, circumstance, alchemical`. Every type in the data model's `BonusType` union has a counterpart (`enh` → `enhancement`). The import would need the union widened with `dodge, haste, deflection, resist, trait, competence, untypedPerm`. The data model already plans to widen it.
- Foundry types racial ability adjustments as `racial`, and its `stackingBonusTypes` set is `untyped, untypedPerm, dodge, racial, circumstance` (`module/config.mjs`). The data model records racial ability adjustments as `untyped` "race" entries. The importer must choose a mapping, e.g. map race-item ability changes to `untyped`.
- Targets use Foundry keys (`str`, `ac`, `nac`, `cmb`, `skill.per`, `allSavingThrows`, `landSpeed`, `bonusFeats`...): 121 distinct targets in the data. Ability keys map one-to-one. The rest need a lookup table that grows with `AbilityKey`.
- Coverage of `changes` is uneven. Races 80/82 and buffs 131/207 have them, but feats 46/390, items 111/1,726, class abilities 251/4,714 and classes 0/49 (classes use structured BAB/save fields instead). Many feats and items that grant flat bonuses still need hand-entered modifiers.

### 1b. `pf1-content` module (`foundryvtt_pathfinder1e/pf1-content`)

Repository: <https://gitlab.com/foundryvtt_pathfinder1e/pf1-content>, inspected at commit `c66bf333` (2025-11-24), `module.json` version 11.4.0.

**Coverage.** README: "~4,200 magic items… ~2,000 non-magic items… ~3,300 feats… 2,034 traits and 1,214 racial traits… 894 Class Abilities…" ([README](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/main/README.md)). Files counted in `src/`: pf-feats 3,251, pf-traits 1,998, pf-racial-traits 1,872, pf-wondrous 2,864, pf-magic-items 761, pf-artifacts 311, pf-class-abilities 768, pf-items 987, pf-goods-services 458. Third-party and 3.5 material sit in their own packs (`pf-third-party`, `pf-35-content`), so they are easy to exclude. The module has no races, classes or archetypes.

**Structure.** Same Foundry item schema. The README warns: "Except for buffs, most of them do not contain all the appropriate changes… Change formulas are slowly being added with help from the community." Measured: pf-feats 40/3,251 have `changes`, pf-wondrous 101/2,864, pf-traits 529/1,998, pf-racial-traits 517/1,872. **pf-feats records have no `sources` field** (1 of 3,251 has one), so the feat import cannot prove a Paizo origin per record. pf-wondrous (2,851/2,864) and pf-traits (1,956/1,998) do carry `sources`.

**Licence.** Repo `LICENSE.md` is GPL-3.0. `OGL.txt` carries the OGL with a Section 15 listing about 290 Paizo titles. `Legal.txt` is Paizo's Community Use notice ([LICENSE.md](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/main/LICENSE.md), [OGL.txt](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/main/OGL.txt), [Legal.txt](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/main/Legal.txt)).

**Maintenance.** Last commit 2025-11-24, a release prep ([commits](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/commits/main)). Slower than the system, but in the same group and following the system's major versions.

### 2. d20pfsrd / Pathfinder Community spreadsheets

Index: <https://www.pathfindercommunity.net/home/databases> (Feats, Magic Items, Monsters, NPCs, Spells). d20pfsrd embeds them as its "databases" ([d20pfsrd home](https://www.d20pfsrd.com/)).

- **Feats** sheet `0AhwDI9kFz9SddEJPRDVsYVczNVc2TlF6VDNBYTZqbkE` ([page](https://www.pathfindercommunity.net/home/databases/feats)): 3,072 rows. Columns include `name, type, description, prerequisites, prerequisite_feats, benefit, normal, special, source, fulltext, prerequisite_skills, race_name` plus flag columns (`teamwork, critical, style, …`). Power Attack: `prerequisites: "Str 13, base attack bonus +1."`, `type: Combat`, `source: PFRPG Core`. Cleave: `prerequisite_feats: "Power Attack"`. 1,341 rows fill `prerequisite_feats` and 531 fill `prerequisite_skills`. This is the most structured prerequisite data of any candidate. Ability and BAB requirements stay prose.
- **Magic Items** sheet `0AhwDI9kFz9SddHI0N244NjJ0LVJrQzhvTXdWZmtWcVE` ([page](https://www.pathfindercommunity.net/home/databases/magic-items)): 4,241 rows with `Name, Aura, CL, Slot, Price, PriceValue, Weight, WeightValue, Description, Requirements, Group, Source, …`. Belt of Giant Strength +2/+4/+6 are three rows. The bonus is prose only: "grants the wearer an enhancement bonus to Strength of +2, +4, or +6".
- **Spells** sheet: the source of `convex/data/spells.js` (see the correction above).
- **No races, classes, class features or traits** in any sheet.
- **Licence.** d20pfsrd's legal page declares "All content of this site not designated as Product Identity is declared Open Game Content as described in Section 1(d) of the Open Game License Version 1.0a". Its Product Identity is the site's own logos, art and trade dress ([d20pfsrd legal](https://www.d20pfsrd.com/extras/legal/)). Pages carry per-page Section 15 notices, e.g. Power Attack cites the Core Rulebook ([Power Attack](https://www.d20pfsrd.com/feats/combat-feats/power-attack-combat/)). The sheets carry no licence text of their own. d20pfsrd also mixes in third-party content, so filter on the `source` column.
- **Maintenance.** No changelog. The newest sources present are 2018 books (Planar Adventures, Book of the Damned, Bestiary 6).

No maintained general-purpose d20pfsrd-derived JSON dataset turned up on GitHub. Searches returned only small importers and scrapers, e.g. [d20pfsrd_obsidian_importer](https://github.com/mProjectsCode/d20pfsrd_obsidian_importer), last pushed 2022. The spreadsheets are the practical form of "d20pfsrd-derived".

### 3. PSRD-Data (`devonjones/PSRD-Data`)

Repository: <https://github.com/devonjones/PSRD-Data>, inspected at commit `76ea4784` (last commit 2015-05-08; GitHub `pushed_at` 2015-10-30).

- **Coverage.** JSON directories for 16 books: Core, APG, ARG, UM, UC, UE, UCampaign, Mythic Adventures, Technology Guide, Bestiaries 1–4, GMG, NPC and Monster Codex. The Advanced Class Guide exists only as `book-acg.db` (SQLite). Nothing from Occult Adventures (2015) or later. Counts: 1,099 feat files, 3,523 item files, 221 class-archetype files, 79 race files, 45 class files (core, prestige, NPC), 298 traits.
- **Structure.** JSON trees of HTML `sections`. Power Attack has a section `{ name: "Prerequisites", description: " Str 13, base attack bonus +1." }`. Belt of Giant Strength has `slot`, `cl: "8th"`, `price: "4,000 gp (+2), 16,000 gp (+4), 36,000 gp (+6)"` (one record for three items) and prose. The Elves race nests racial traits with `description: "+2 Dexterity, +2 Intelligence, -2 Constitution"` as a string. Fighter has `hit_die: "d10"`, but BAB and saves sit only in an HTML `<table>`.
- **Licence.** The data repo has no licence file (GitHub API `license: null`). The parser is GPL-3.0 and describes the data as parsed "from the Paizo Pathfinder Reference Document" ([PSRD-Parser README](https://github.com/devonjones/PSRD-Parser)). That PRD URL now redirects to `legacy.aonprd.com` (HTTP 301 from `paizo.com/pathfinderRPG/prd/`).
- **Verdict.** Its one advantage is archetypes (221, books to 2014). Otherwise it is frozen, prose-only, and smaller than Foundry.

### 4. Archives of Nethys (aonprd.com)

- **Licence.** AoN's licence page states: "This website uses trademarks, copyrights, artwork, and other material identified as Product Identity owned by Paizo Inc. and used by Archives of Nethys under commercial license. The content on this website is not available for use under Paizo's Community Use License, Pathfinder Second Edition Compatibility License, Starfinder Compatibility License, or Pathfinder Compatibility License." ([AoN Licenses](https://aonprd.com/Licenses.aspx)). The OGL content it republishes could still be used under the OGL. AoN's own compilation and the Product Identity it uses under commercial licence cannot be.
- **Data access.** The site offers no download or API. The only route is scraping HTML, as third-party scrapers do (e.g. [PathfinderMonsterDatabase](https://github.com/c0d3rman/PathfinderMonsterDatabase), "created by parsing aonprd.com").
- **Coverage** is the most complete of all, including every archetype. That makes AoN the right **human reference** when hand-authoring gaps, not a seed dataset.

## Licence position for this repo

This repo is public with no licence (`gh repo view`: `visibility: PUBLIC`, `licenseInfo: null`).

- **OGL 1.0a**: free reuse of Open Game Content if we ship the licence text with the content, mark which parts are OGC, and keep a Section 15 notice for every source used (OGL §§2, 6, 8, 10, in the [Foundry OGL.txt](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/master/OGL.txt)). Paizo states it "does not believe that the OGL 1.0a can be 'deauthorized,' ever" ([Paizo ORC announcement](https://paizo.com/blog/paizo-announces-system-neutral-open-rpg-license)). The same post says products already at the printer keep their OGL 1.0a notice and new releases move to ORC. It does not relicense existing PF1 books, which were published under OGL 1.0a.
- **Product Identity** (Golarion names, deities and similar inside the content) is outside the OGL. Paizo's Community Use Policy covers it for a project that is "accessible by everyone for free". It forbids paywalls and requires the notice "uses trademarks and/or copyrights owned by Paizo Inc., used under Paizo's Community Use Policy… not published, endorsed, or specifically approved by Paizo" ([Community Use Policy](https://paizo.com/licenses/communityuse)). The app should show that notice and stay free.
- **GPL-3.0 on the Foundry repos** covers the software. The system README separates "software component… GNUv3" from "game content… Open Gaming License v1.0a". Import only game-content fields into our catalog, never Foundry code, and attribute the source. If the owner wants zero ambiguity, ask the pf1 maintainers to confirm the YAML pack content is OGL-only.

## Gaps the builder must plan for

- **Archetypes and prestige classes**: absent from Foundry and pf1-content. Options: campaign-scoped homebrew catalog entries (already the map's fallback), a later curated import, or PSRD-Data's 221 pre-2015 archetypes as a partial seed.
- **Prerequisites**: prose everywhere. Advisory prerequisite warnings would need a parser over the description HTML, or the Pathfinder Community feat sheet's `prerequisite_feats`/`prerequisite_skills` columns joined by feat name. Only 93 of its 2,929 distinct feat names have no exact name match in Foundry+pf1-content, most of them typos such as `deepbreath`.
- **Modifiers on most feats and items**: absent even in Foundry (feats 46/390 + 40/3,251; wondrous 101/2,864). Import whatever `changes` exist and treat the rest as entries with no modifiers that users or curators can fill in.
- **Formula changes** (461 of 2,093, about 22%) need either a skip-and-flag rule or a later extension of `Modifier.value`. The data model's `value: number` cannot hold `@abilities.dex.mod`.
- **Source attribution for pf1-content feats** is missing. Either accept the pack as Paizo-only by its packaging (3pp sits in `pf-third-party`) or take feat source names from the Pathfinder Community feat sheet's `source` column.

## Sources

- Foundry pf1 system: <https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1> (commit `b0d719e1e2d1111eb863555db60d0cbbf6cc64bc`), README, LICENSE.txt, OGL.txt, `module/config.mjs` (`bonusTypes`, `stackingBonusTypes`, `buffTargets`), `packs/**`. Releases: <https://gitlab.com/api/v4/projects/16774935/releases>
- pf1-content module: <https://gitlab.com/foundryvtt_pathfinder1e/pf1-content> (commit `c66bf333cafc451d817ead660473dd01d9846fb3`), README, LICENSE.md, OGL.txt, Legal.txt, `module.json`, `src/**`
- PSRD-Data: <https://github.com/devonjones/PSRD-Data> (commit `76ea4784604145ba3dea40eb56f83bb904759467`). PSRD-Parser: <https://github.com/devonjones/PSRD-Parser>
- Pathfinder Community databases: <https://www.pathfindercommunity.net/home/databases>. Sheets: feats `0AhwDI9kFz9SddEJPRDVsYVczNVc2TlF6VDNBYTZqbkE`, magic items `0AhwDI9kFz9SddHI0N244NjJ0LVJrQzhvTXdWZmtWcVE`, spells `0AhwDI9kFz9SddG5GNlY5bGNoS2VKVC11YXhMLTlDLUE` (CSV via `https://docs.google.com/spreadsheets/d/<id>/export?format=csv`)
- d20pfsrd: <https://www.d20pfsrd.com/extras/legal/>, <https://www.d20pfsrd.com/magic/tools/spells-db/>
- Archives of Nethys licences: <https://aonprd.com/Licenses.aspx>
- Paizo Community Use Policy: <https://paizo.com/licenses/communityuse>
- Paizo on OGL 1.0a / ORC: <https://paizo.com/blog/paizo-announces-system-neutral-open-rpg-license>
- Repo data model: `docs/pf-character-sheet-data-model.md`. Existing spells: `convex/data/spells.js`
