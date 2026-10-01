# PF1 spell data sources for spellcasting

Research for [Compare the spell data sources for spellcasting](https://github.com/AndreasUnunger/EverythingPath/issues/217), part of map #201. Question: should the builder's spells come from the d20pfsrd / Pathfinder Community sheet already in `convex/data/spells.js`, or from the Foundry VTT pf1 spell pack? Also: what do class records carry for spellcasting, and how can the imported spell buffs be keyed onto real spell entries?

Context: [Choose the PF1 content dataset](https://github.com/AndreasUnunger/EverythingPath/issues/202) (`research/pf1-content-dataset`), [Decide how the content dataset becomes the global catalog](https://github.com/AndreasUnunger/EverythingPath/issues/207) and [Check whether Foundry pf1 record IDs stay stable](https://github.com/AndreasUnunger/EverythingPath/issues/211) (`research/pf1-foundry-id-stability`). The catalog design is in "Global catalog import" of `docs/pf-character-sheet-data-model.md` on `feature/pf1-character-builder`.

## Answer

- **Use the Foundry pf1 `spells` pack.** It covers every Paizo spell the sheet has, plus about 130 more. It stores spell levels per class, domain, subdomain and bloodline as numbers, and range, duration, save and SR as enums or formulas. Every record has a Paizo product code and page, and a stable `_id`. The sheet stores most of these as free text, has no arcanist or warpriest columns, records no provenance in this repo, and has no upsert key the repo uses.
- **Class records carry a casting summary, not tables.** Each casting class has `system.casting`: preparation type, progression (high, medium or low), casting ability, spell kind, cantrips, domain slots and a caster-level offset. Spells per day and spells known come from seven shared tables in the system's GPL code. Bonus spells come from a one-line formula in code. The same per-class numbers are published as HTML tables in the `rules` journal pack, which is game content. All 24 class tables there match the code tables cell for cell.
- **Buffs already point at their spells.** 177 of the 185 spell buffs open their description with an `@UUID[Compendium.pf1.spells.Item.<_id>]` link to the spell, and the buff's name confirms it. The other 8 need a name match or a Curation Overlay record. Several buffs can belong to one spell (Fire Shield warm and cold), so link buffs to spells rather than merging them.
- **Recommendation.** Import the spell pack as global `spell` Catalog Entries keyed `pf1/<_id>`. Give each buff-derived entry a `spellKey` that names its spell. Store the casting summary on the class entry, and take the spells-per-day and spells-known tables from content we can show is OGL, never from `config.mjs`. Retire `convex/data/spells.js` and the unused `spell` and `characterSpell` tables. Details are in [Recommendation](#recommendation).

## Sources and method

- **This repo** at `origin/main` (`e141722`): `convex/data/spells.js`, `convex/spell.ts`, `convex/schema.ts` (`spellValidator`, `spell`, `characterSpell`), and the git history of the spell files.
- **Foundry pf1 system** ([foundryvtt-pathfinder1](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1)) at tag `v11.11` (commit `418761d2`, 2026-03-09), the latest release:
  - `packs/spells`, `packs/buffs`, `packs/classes`, `packs/class-abilities`, `packs/rules`;
  - `public/template.json`, `module/config.mjs` (`casterProgression`, `classCasterType`), `module/documents/actor/actor-pf.mjs` (spellbook preparation, `getSpellSlotIncrease`, `createSpellbook`), `module/registry/sources.mjs`;
  - README, LICENSE.txt, OGL.txt.
- **pf1-content** ([pf1-content](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content)) at tag `11.4.0` (commit `02f4ab0d`, 2025-11-24): `src/pf-buffs`, every `type: spell` record in `src/`, README, LICENSE.md, OGL.txt, Legal.txt.
- **Method.** Every YAML record was parsed. Spells were matched to sheet rows by name, ignoring case, apostrophes and punctuation. Class and spell levels were compared pairwise on the matched spells. Buff-to-spell links were resolved against the pack's `_id`s. The rules journal's class tables were parsed and compared with `casterProgression`.

## The two sources

### d20pfsrd / Pathfinder Community sheet (`convex/data/spells.js`)

- **What it is.** It holds 2,905 rows, one per spell. It is the CSV of the Pathfinder Community Spells sheet that d20pfsrd embeds, with keys camelCased. `research/pf1-content-dataset` traced it: same row count, the same columns in snake_case, and the same `id` for Acid Arrow. 1,282 rows have a `linkText` pointing to d20pfsrd.com.
- **Provenance in this repo.** The repo records none. The data arrived as `spells.json` in "Add spell seeding (#4)" (`76ea90f`, 2025-06-29) with no source note, and became `convex/data/spells.js` in "Better seeding (#6)" (`36e9fdf`). No file names d20pfsrd, the sheet, the OGL or a Section 15. The only record is `research/pf1-content-dataset`.
- **Licence.** d20pfsrd declares everything that isn't Product Identity to be Open Game Content under OGL 1.0a ([d20pfsrd legal](https://www.d20pfsrd.com/extras/legal/), cited in `research/pf1-content-dataset`). The sheet carries no licence text and no Section 15. Rows give a `source` book name and no page.
- **Use in the app.** None. `spellValidator` in `convex/schema.ts` mirrors the sheet's 92 columns. `spell.addNextHundredSpells` inserts the next 100 rows, counting already-inserted rows with an aggregate. Nothing calls it, no query reads `spell`, and only the e2e fixtures touch `characterSpell` (deleting rows). The data model already says these tables are not reused.

### Foundry pf1 `spells` pack

- **What it is.** 3,029 `type: spell` records (plus 9 folder records), one YAML file each. The item schema is `Item.spell` in `public/template.json`.
- **pf1-content has no spell pack.** Its only `type: spell` records are 81 occult rituals in `pf-occult-rituals`, none of which has `learnedAt`, and one Society spell, *Steal Book*.
- **Licence.** The README says: "The software component of this system is distributed under the GNUv3 license while the game content is distributed under the Open Gaming License v1.0a". It also carries Paizo's Community Use notice. The system's `OGL.txt` Section 15 lists only the OGL, the SRD and Foundry. pf1-content's `OGL.txt` lists about 290 Paizo titles.

## Comparison

| | d20pfsrd sheet | Foundry `spells` pack |
|---|---|---|
| Spells | 2,905 rows | 3,029 records |
| Paizo coverage | every Paizo spell here is in Foundry | about 130 more spells |
| Third-party | 4 (Frog God Games) | none |
| Level per class | 26 numeric columns | `learnedAt.class`, 28 classes keyed by class `tag` |
| Domains, bloodlines | prose strings (`"Luck (2), Tactics (2)"`) | `learnedAt.domain` (37), `subDomain` (114), `bloodline` (39), numeric |
| School, subschool | strings (`"Transmutation"`, `"see text"` occur) | 3-letter enum, subschool array |
| Descriptors | 28 booleans plus a string | array |
| Components | booleans, a string, `materialCosts` | booleans, a `divineFocus` code (1–3), materials text, `gpValue` |
| Range | text, 122 distinct values | `units` enum (`close`, `touch`, `ft`…), optional formula |
| Duration | text, 354 distinct values | `units` enum plus formula (`'@cl'`), `dismiss`, `concentration` |
| Save | text, 201 distinct values | `type` (fort/ref/will) plus text, `harmless` flag |
| Spell resistance | text, 53 distinct values (`"yes (harmless, object)"`) | boolean (default true) |
| Sources | book name only, 154 names | Paizo product code and page |
| Mythic text | 228 rows | none |
| ID | numeric row `id` (1–5,033, gaps), unused by the repo | 16-character `_id`, unique, stable |
| Maintained | newest books from 2018 | system release v11.11, 2026-03-09 |
| Licence | OGL (site declaration), nothing in the sheet | OGL content, GPL code, Community Use notice |

### Coverage

- **Matching.** 2,895 of the 2,905 sheet rows match a Foundry spell by normalised name. The other 10 are:
  - 4 third-party spells: *Grand Curse*, *Mage's Evasion*, *Chant* (Rappan Athuk) and *Cone of Slime* (Sword of Air);
  - 2 duplicate rows of spells the sheet also has under another name: *Winter's Grasp* (= *Winter Grasp*) and *Corpse Hammer* (= *Geb's Hammer*);
  - 2 misspellings: *Adjuring Step* (*Abjuring Step*) and *Dead Eye's Arrow* (*Deadeye's Arrow*);
  - 2 rows Foundry splits by printing: *Fool's Gold* (AA, VC) and *Shield Companion* (AA, ACG).

  So every Paizo spell in the sheet is in Foundry.
- **Foundry-only.** 134 Foundry spells have no exact name match in the sheet. About 130 are genuinely missing from it, mostly from Player Companions and Adventure Paths published between 2008 and 2019, such as *Elemental Master's Handbook* (11) and *Disciple's Doctrine* (10).
- **Sources.** 3,019 Foundry spells cite a Paizo `PZO…` code. Nine cite a Paizo blog post, condition cards or Dynamite comics by name, two cite a Dynamite code, one has a malformed source (`id: Languid Venom`), and one has none.

### Spell levels per class

- **The sheet has no arcanist or warpriest columns.** Its `skald` (4 rows) and `investigator` (1 row) columns are almost empty, because those classes use the sorcerer/wizard, cleric, bard and alchemist lists. A builder would have to derive them by rule.
- **Foundry stores them explicitly.** Arcanist and wizard each have 1,898 spells, warpriest 986, skald 869 and investigator 409. Five spells break the derive-by-rule pattern: *Contact High* (skald 3, bard 2), *Shield Speech* and *Shield Speech, Greater* (skald only), *Realm Retribution* (warpriest only) and *Defensive Grace* (investigator only). Deriving them would get these wrong.
- **The two sources agree.** On the 2,895 matched spells, they agree on 16,451 class–level pairs and disagree on 1 (*Vermin Shape I*: bloodrager 4 in the sheet, 3 in Foundry). The sheet has 90 pairs Foundry lacks, 72 of them unchained summoner levels such as *Simulacrum* 5 and *Maze* 6. Foundry has 95 pairs the sheet lacks, 31 of them shaman (*Summon Nature's Ally I–IX*, *Remove Disease*) and 22 bloodrager. Neither source is authority. These 186 pairs need checking against the official class spell lists.
- **The Foundry record's own `level` is not the class level.** It is a display default, usually the sorcerer/wizard level. It differs from the lowest class level on 883 spells. Only `learnedAt` matters.

### Structured fields

- **Foundry splits the stat block into an action.** Range, duration, save, target, area and effect live on `system.actions[0]`. 72 spells have more than one action, for example the continuing damage of *Acid Arrow*. The first action holds the spell's stat block.
  - Range has `units` and an optional `value`.
  - Duration has `units` plus a formula (`value: 1 + min(6, floor(@cl / 3))`), with `dismiss` and `concentration` flags. The units are `minute` 756, `round` 664, `spec` 558, `inst` 504, `hour` 301, `day` 93, `seeText` 77, `perm` 70, `week` 2 and `month` 1. That is enough to derive `lastsOverOneDay` for most spells. The 635 `spec`/`seeText` ones need the text.
  - Save has `type` plus the printed text (`Will negates; see text`), and `harmless` (559 spells).
- **Spell resistance in Foundry is a boolean.** Its default is true, and it is false on 1,331 spells. Qualifiers such as "(harmless, object)" survive only in the save text and the description. The sheet keeps the printed SR text.
- **Both describe spells in HTML.** Foundry's descriptions contain `@UUID[...]` links (738 from spells to other spells) that need rewriting or stripping. The sheet's `fullText` embeds `<link rel="stylesheet" href="PF.css">`. Both need sanitizing.
- **Product Identity naming is inconsistent in the sheet.** d20pfsrd sometimes renames Paizo-named spells (*Corpse Hammer* for *Geb's Hammer*) but keeps others (*Gorum's Armor*). Foundry uses Paizo's names, which the Community Use Policy covers.

### Stable IDs

- **Foundry.** `_id` is unique across all 3,029 spells, and no two spells share a name. `research/pf1-foundry-id-stability` showed that `_id` survives edits, renames and pack moves. The `spells` pack was not among the v11.0 pack renames. Upsert by `pf1/<_id>`, as the catalog import already does.
- **The sheet.** Its `id` is a sheet row number (1–5,033 with gaps). The sheet is effectively frozen, since its newest books are from 2018, and the repo doesn't use `id`. The seed resumes by counting rows already inserted, and `spell` has only a `by_name` index. The sheet's names contain duplicates under other names and misspellings, so it has no reliable upsert key.

## What class records carry for spellcasting

- **The casting summary.** 28 class records have `system.casting`: 27 base classes and the NPC adept. Wizard, for example:

  ```yaml
  casting: { ability: int, cantrips: true, domain: 1, progression: high, spells: arcane, type: prepared }
  ```

  - `type` is `prepared` (adept, alchemist, antipaladin, cleric, druid, investigator, magus, paladin, ranger, shaman, warpriest, witch, wizard), `spontaneous`, or `hybrid` (arcanist).
  - `progression` is `high` (9 spell levels), `med` (6) or `low` (4).
  - `ability` is the casting ability, which drives bonus spells and DCs.
  - `spells` is the kind: `arcane`, `divine`, `psychic` or `alchemy`.
  - `cantrips` says whether the class has 0-level spells.
  - `domain` is the number of domain or school slots per spell level: 1 for cleric, druid and wizard, 0 otherwise.
  - `offset` is a caster-level offset: −3 on paladin, ranger and antipaladin only.
- **Spells per day and spells known are not in the class records.** `module/config.mjs` holds `casterProgression.castsPerDay` and `spellsPreparedPerDay`, which doubles as spells known for spontaneous casters. The tables are 20 rows each, keyed by `[type][progression]`: prepared low, med and high, spontaneous low, med and high, and hybrid high, plus one prestige table. `ActorPF._updateSpellBook` reads the row for the class level and sets known spells to infinite for prepared casters.
- **Bonus spells are a formula in code.** `ActorPF.getSpellSlotIncrease(mod, level)` returns `ceil((mod + 1 − level) / 4)` for spell levels 1 and up when the modifier is positive, which reproduces CRB Table 1-3. Spontaneous and hybrid casters add bonus spells to casts per day, and prepared casters add them to spells prepared. Known spells never get them.
- **The class abilities point at tables in the rules journal.** 24 casting classes have a "<Class> Spells" class ability; alchemist, investigator and adept do not. Its prose gives the casting rules and links to tables in the `rules` journal pack, `Spell Tables` (`GnZ4SFsgV11ab8Vz`):
  - page "Ability Modifiers and Bonus Spells" (`BfKeMBHQruwqyUXX`) has Table 1-3;
  - page "Class Features & Progression" (`8HNFlPoMR5NxGMzD`) has the full class table, with Spells per Day and, where the class has one, Spells Known, for 24 classes.

  Alchemist, investigator, adept and unchained summoner have no table there.
- **The code tables match the journal tables.** Parsing the journal tables for those 24 classes and comparing every Spells per Day and Spells Known cell with `casterProgression` for the class's `type` and `progression` gives 0 differences. Every casting class's numbers therefore reduce to its `(type, progression)` pair plus `cantrips`.
- **Things the records do not carry.**
  - Wizard and other spellbook learning (2 free spells per level, scribing) is prose only.
  - Spontaneous casters' spell swapping is prose only.
  - Specialist school and domain spell choices are prose only.
  - Prestige-class casting progression ("+1 level of existing class") does not exist, because there are no prestige classes.
- **Bloodrager has no caster-level offset.** Foundry gives paladin, ranger and antipaladin `offset: -3`, but not bloodrager, which also begins casting at 4th level. Its "Bloodrager Spells" text states no caster level. This needs checking against the Advanced Class Guide (p. 16) before it is relied on.

## Keying spell buffs onto spell entries

The catalog import turns each spell buff (`type: buff`, `subType: spell`) into a `spell` Catalog Entry keyed by the buff's own `<repo>/<_id>`. At the pins:

- the system `buffs` pack has 74 buffs, 35 of them spell buffs;
- pf1-content `pf-buffs` has 253 buffs, 150 of them spell buffs;
- that makes 185 spell buffs, pointing at 161 distinct spells.

How each buff resolves to a spell:

| Signal | System | pf1-content |
|---|---:|---:|
| First spell `@UUID` link in the description agrees with the buff's name | 34 | 143 |
| Link agrees with the name only after a rename (*Blessings of Luck and Resolve*, *Greater Spell Immunity*) | 0 | 2 |
| Link and name disagree: *Age Resistance, Lesser* links to *Age Resistance*, an upstream bug | 1 | 0 |
| No link, but the name matches (*Adoration*, *Ant Haul*) | 0 | 2 |
| Neither: *Animal Focus* (Bull, Falcon, Frog), a hunter class feature mis-typed as a spell buff | 0 | 3 |

Name matching strips the variant in parentheses and turns "X (Greater)" into "X, Greater". For example, the system's *Bull's Strength* buff (`ClOy4KHJFDdt0ALh`) description begins `@UUID[Compendium.pf1.spells.Item.05i5rxwim12hwktu] spell`, which is the *Bull's Strength* spell.

- **The relationship is many to one.** 12 spells have more than one buff. Examples are *Align Weapon* (4 alignments), *Blessing of Fervor* (5 choices), *Bestow Curse* (3), *Channel Vigor* (4), *Fire Shield* (warm, cold), *Alter Self* (Small, Medium) and *Prayer* (positive, negative). *See Invisibility* and *Blessing of the Mole* have a buff in both repos.
- **The link points into the system, so the key crosses repos.** Every resolved link is `Compendium.pf1.spells…`. A pf1-content buff therefore points at a `pf1/<_id>` spell.
- **Other buff fields.** A buff's `system.level` is a default caster level for its formulas (*Bull's Strength* buff `level: 3`), not the spell level. Buff durations (`units: minute`, `value: '@item.level'`) are absent on 21 module buffs. The spell's own duration units can fill `lastsOverOneDay` there.

## Recommendation

1. **Import the system `spells` pack** as global `spell` Catalog Entries, upserted by `pf1/<_id>` like every other pack. This reverses "the spell pack is not imported" in the data model, which was decided while spellcasting was in the fog. Map these fields into `detail`:
   - `learnedAt.class` as `levels: Record<classTag, number>`, joined to class entries through the class record's `system.tag`. All 28 `learnedAt` keys match a class `tag`.
   - `learnedAt.domain`, `subDomain` and `bloodline` as their own level maps.
   - school, subschool, descriptors, components and material cost.
   - From the first action: range, duration, save, target, area and effect, keeping the printed text next to each enum.
   - `sr` as a boolean. Where a qualifier such as "(harmless)" matters, it comes from the save text or the description.

   Skip pf1-content's occult rituals until rituals are in scope.
2. **Link buffs to spells.** Add `spellKey?: string` (a spell's `externalKey`) to the `spell` detail of buff-derived entries. Set it from the first `Compendium.pf1.spells` link when the normalised name agrees. Otherwise propose it in the import report and let the Curation Overlay decide. That covers the 8 cases above, and *Animal Focus* gets re-kinded as a class-feature buff. Keep buff entries separate from spell entries, for two reasons:
   - variants need several modifier sets per spell;
   - sheets already point at buff rows by `_id`, so nothing re-keys.
3. **Store `system.casting` on the class entry**, renaming `spells` to `spellKind` and `offset` to `casterLevelOffset`.
4. **Take the spell tables from OGL content, not GPL code.** Do not copy `config.mjs` into the repo, because the map only allows content fields from the GPL repos. Two routes:
   - author the seven `(type, progression)` tables and the bonus-spell rule in a reviewed repo file citing each class's printed table;
   - parse the `rules` journal's class tables, which are pack content.

   Either way, check one against the other in the import report, and author the tables the journal lacks (alchemist, investigator, adept, unchained summoner) from the books.
5. **Retire the sheet.**
   - Delete `convex/data/spells.js` (15 MB), `convex/spell.ts` and the `spell` and `characterSpell` tables in a later cleanup, once checked that no deployment holds rows.
   - Keep the sheet only as a cross-check, such as the 186 level pairs where the two sources disagree.
   - If any sheet field is ever kept (its `mythicText`, say), record its provenance and Section 15 first.

## Open items

- **Level pairs that disagree.** 186 class–level pairs (unchained summoner 84, shaman 31, bloodrager 25, oracle 9 and others) differ between the sources and need the official class spell lists.
- **Bloodrager caster level.** Check the Advanced Class Guide p. 16 for the bloodrager's caster level, which Foundry gives no offset.
- **Section 15 coverage.** pf1-content's `OGL.txt` is incomplete for spells. A title search finds only 97 of the 195 spell source books named in the system's source registry, missing for example *Adventurer's Guide* (47 spells), *Black Markets* (24) and *Inner Sea Intrigue* (26). The registry (`module/registry/sources.mjs`) gives title, date and ISBN, but no Section 15 text. The legal page needs another source for the rest.

## Sources

- This repo at `origin/main` `e141722`: `convex/data/spells.js`, `convex/data/spells.d.ts`, `convex/spell.ts`, `convex/schema.ts`, `convex/e2eFixtures.ts`; commits `76ea90f` and `36e9fdf`.
- Foundry pf1 system v11.11 (`418761d2e16a6037c0156bb4a241f7cea5a2986d`): <https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/tree/v11.11>
  - [`packs/spells`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/tree/v11.11/packs/spells), [`packs/buffs`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/tree/v11.11/packs/buffs), [`packs/classes`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/tree/v11.11/packs/classes), [`packs/class-abilities`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/tree/v11.11/packs/class-abilities), [`packs/rules/spell-tables.GnZ4SFsgV11ab8Vz.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/v11.11/packs/rules/spell-tables.GnZ4SFsgV11ab8Vz.yaml)
  - [`public/template.json`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/v11.11/public/template.json), [`module/config.mjs`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/v11.11/module/config.mjs), [`module/documents/actor/actor-pf.mjs`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/v11.11/module/documents/actor/actor-pf.mjs), [`module/registry/sources.mjs`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/v11.11/module/registry/sources.mjs)
  - [README](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/v11.11/README.md), [LICENSE.txt](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/v11.11/LICENSE.txt), [OGL.txt](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/v11.11/OGL.txt)
- pf1-content 11.4.0 (`02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`): <https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/tree/11.4.0>
  - [`src/pf-buffs`](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/tree/11.4.0/src/pf-buffs), [`src/pf-occult-rituals`](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/tree/11.4.0/src/pf-occult-rituals)
  - [LICENSE.md](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/11.4.0/LICENSE.md), [OGL.txt](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/11.4.0/OGL.txt), [Legal.txt](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/11.4.0/Legal.txt)
- The sheet's identity and d20pfsrd's licence: `research/pf1-content-dataset` (`docs/research/pf1-content-dataset.md`), citing [d20pfsrd legal](https://www.d20pfsrd.com/extras/legal/) and the [Pathfinder Community spells database](https://www.pathfindercommunity.net/home/databases/spells).
- ID stability: `research/pf1-foundry-id-stability` (`docs/research/pf1-foundry-id-stability.md`).
- Paizo Community Use Policy: <https://paizo.com/licenses/communityuse>
