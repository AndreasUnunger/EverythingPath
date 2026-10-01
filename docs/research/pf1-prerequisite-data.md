# How the Foundry pf1 dataset encodes prerequisites

Research for #214 (map #201). Question: how do the Foundry VTT pf1 system packs and `pf1-content` encode prerequisites for feats, prestige classes and traits? Are they structured fields, formulas or tags, or prose only? And do class records carry what the other rules checks need: class skills, skill ranks per level, and the BAB and save progressions?

Investigated 2026-10-01 against the two repositories themselves (shallow clones, every pack YAML parsed), the system's data models in `module/models/`, `module/config.mjs`, its changelogs and its issue tracker:

- **System:** `foundryvtt-pathfinder1` master at `688b13b3` (2026-10-01), plus the v11.11 release tag at `418761d2` (2026-03-09) for comparison.
- **Module:** `pf1-content` main at `c66bf333` (2025-11-24), `module.json` version 11.4.0. These are the same pins as `research/pf1-content-dataset`.

Counts below are records in those snapshots. Shares of prerequisite kinds come from a clause parser written for this research (see [Method](#method)), so treat them as accurate to a few percentage points.

## Answer

**Prose only.** No record type has a prerequisite field, formula or flag, and the system code never reads prerequisites.

- **Feats.** The prerequisites are one HTML line in the description, `<strong>Prerequisites</strong>: Str 13, Power Attack, base attack bonus +1.` 92% of feats have one: 333 of 390 in the system and 3,018 of 3,251 in `pf1-content`.
  - The line is regular enough to parse. Its comma-separated clauses read like the books.
  - In the system pack, 178 feats wrap the prerequisite feats or class features in `@UUID[...]` links, which resolve to a record `_id`.
- **Traits.** These have a `<strong>Requirements</strong>:` line instead. 1,218 of 1,983 traits have one, and it names a race, region, deity or faction. `tags` repeats that requirement in 93% of cases (1,128), and `traitType` holds the trait category as a structured field.
- **Prestige classes.** There are none in either repo, so there are no prestige prerequisites to import. The system defines the `prestige` class type and its save formulas. Upstream issue [#4110](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/work_items/4110), "Add way to track requirements for prestige classes", is still open.
- **Classes are structured.** All 49 class records carry hit die, BAB progression, the three save progressions, skill ranks per level and class skills. Nine also carry an alignment restriction as a prose string.
  - Unreleased system master changes the shape of class skills and of the level feature table. The importer's pin decides which shape it reads.

## Recommendation

- **Parse feat prerequisites at import** into structured conditions. Use the parser grammar below, and flag what it can't parse in the same way as `unsupported` Modifiers.
  - Resolve a named feat to its `externalKey` through the `@UUID` link where one exists, and otherwise by exact name. Prefer the system record when both repos have the feat.
  - Store unparsed clauses as text, so the warning can say "not checked: proficiency with weapon" rather than staying silent.
  - The Curation Overlay corrects misparses and adds the "counts as X for prerequisites" substitutions, which exist only in prose.
- **What that buys.** About 40% of feats with prerequisites can be checked in full from facts the sheet model already has: ability scores, BAB, feats, skill ranks, character level and class level. About 68% can be checked once race, class features, caster level and alignment are also checkable. Among the rest, most clauses can still be checked even where one clause can't.
- **Traits.** Check race requirements against the Character's race entry, using `tags` plus the Requirements line. Show region, deity and faction requirements as text, because the sheet records none of them.
- **Classes.** Import directly:
  - `bab`: `high` → `full`, `med` → `threeQuarters`, `low` → `half`;
  - saves: `high` → `good`, `low` → `poor`;
  - `skillsPerLevel` → `skillRanksPerLevel`, `hd` → `hitDie`;
  - class skills → `SkillKey`, using whichever skill-key format the pin has (see [Classes](#classes)).
- **Prestige classes.** These need campaign homebrew or a curated source, which #219 covers. Prestige requirements would come with them.

## Feats

Packs: system `feats` (390 records, `subType: feat`) and `pf1-content` `pf-feats` (3,251 records, no `subType`, which defaults to feat). `pf-third-party` and `pf-35-content` are excluded, as the import excludes them.

### Fields

- **Schema.** `FeatModel` (`module/models/item/feat-model.mjs`) and the base item model (`module/models/item/abstract/base-item-model.mjs`) define these fields:
  - `subType`, `traitType`, `traitCategory`, `racePoints`, `abilityType`;
  - `associations.classes`, `tags`, `sources`, `flags`;
  - `links.children` and `links.supplements`;
  - `changes`, `contextNotes`.

  None of them holds prerequisites.
- **Code and docs.** No source file under `module/`, no `lang/` string, and nothing under `docs/` or `help/` mentions prerequisites. The system never checks them.
- **Changelog.** Its only prerequisite entries are content fixes. v10.0 (2024-06-15) "Added compendium links to feat prerequisites" ([#2648](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/work_items/2648)), which is where the `@UUID` links come from.
- **Description line.** Every record that has prerequisites puts them in `system.description.value`, in one paragraph headed `<strong>Prerequisites</strong>:`. The system uses the singular `Prerequisite` in 2 records.
  - Records without the heading almost never mention prerequisites elsewhere: 8 of 290 do.
  - Two of those 8 are prerequisite lines in variant markup that the heading match misses: Retributive Summoning (`<strong>Prerequisites<br /></strong>`) and Magic Trick (bare `Prerequisites:`).
  - The other six are prose. Some are substitutions such as "counts as Arcane Strike for the purposes of prerequisites" (Caster's Champion, Dirty Fighting, Exotic Heritage).
- **`tags`.** The tags are feat types and race names, not prerequisites:
  - top feat types: `Combat` 1,447, `General` 1,292, `Racial` 467, `Combat Trick` 427, `Teamwork` 189, `Mythic` 144, `Style` 92, `Metamagic` 85, `Story` 76;
  - of 499 feats with a race prerequisite, 416 also carry the race as a tag, e.g. `[Racial, Dwarf]`.

  Feat-type tags are structured enough for checks such as "a fighter bonus feat must be a combat feat".
- **`@UUID` links.** These appear only in the system pack. 178 of its 333 feats with prerequisites link at least one prerequisite:
  - 228 links to `pf1.feats`;
  - 57 to `pf1.class-abilities`;
  - 4 to `pf1.races`;
  - 2 to `pf1.spells`.

  A link is `@UUID[Compendium.pf1.feats.Item.<_id>]{Label}`, so it resolves to the `externalKey` `pf1/<_id>` with no name lookup. `pf-feats` has none.

### Examples

| Record | Prerequisites line (raw) |
|---|---|
| Power Attack, `packs/feats/power-attack.FUW5mIXHNBBIQ1Sq.yaml` | `Str 13, base attack bonus +1.` |
| Cleave, `packs/feats/cleave.Zeq6RWYv5otvg8q7.yaml` | `Str 13, @UUID[Compendium.pf1.feats.Item.FUW5mIXHNBBIQ1Sq]{Power Attack}, base attack bonus +1.` |
| Penetrating Strike, `packs/feats/penetrating-strike.TGmNCGtnHf0icozK.yaml` | `@UUID[…n250dFlbykAIAg5Z]{Weapon Focus}, base attack bonus +1, 12th-level fighter, proficiency with weapon.` |
| Steel Soul, `src/pf-feats/Steel_Soul_HRXjxU8L1jFPME8P.yaml` (tags `Racial, Dwarf`) | `Dwarf, hardy racial trait.` |
| Armored Athlete, `src/pf-feats/Armored_Athlete_oc0bf9KMIEMqhAQ2.yaml` | `Light armor proficiency, medium armor proficiency, 3 ranks in any Dexterity- or Strength-based skill.` |

### Share of each condition kind

Each line is split into clauses at top-level commas and semicolons, and each clause into atoms at "or". The table counts records whose prerequisites contain at least one atom of that kind. The base is the 3,351 feats with a Prerequisites line: 333 from the system and 3,018 from `pf1-content`.

| Kind | Example atom | Records | Share | Checkable from the sheet model? |
|---|---|---|---|---|
| Feat | `Power Attack`, `Skill Focus (Linguistics)` | 1,593 | 48% | yes: the Character's feat entries, by `externalKey` |
| Ability score | `Str 13` | 841 | 25% | yes: the resolved score |
| Class feature or racial trait | `ki pool`, `channel energy class feature`, `hardy racial trait` | 789 | 24% | partly: class feature entries by name. Racial traits are not entries in the model |
| BAB | `base attack bonus +6` | 701 | 21% | yes: resolved BAB |
| Skill ranks | `Acrobatics 5 ranks`, `5 ranks in the chosen skill` | 696 | 21% | yes: summed `skillRanks` on Class Levels, except "the chosen skill" or "any" |
| Race | `Dwarf`, `half-orc or orc` | 499 | 15% | yes: the race entry, by name |
| Class level | `12th-level fighter`, `monk level 6th` | 236 | 7% | yes: Class Levels of that class |
| Spellcasting | `ability to cast 2nd-level arcane spells` | 191 | 6% | no: spellcasting is in the fog (#218) |
| Feat with a parameter | `Weapon Focus with the chosen weapon` | 147 | 4% | partly: whether the feat is present, but not the choice, because sheet entries hold no feat choice |
| Proficiency | `proficiency with weapon` | 124 | 4% | no: the model has no proficiencies |
| Deity or faith | `worshiper of Abadar` | 106 | 3% | no: no deity field |
| Character level | `character level 5th` | 96 | 3% | yes: the count of Class Levels |
| Caster level | `caster level 7th` | 83 | 2% | no, until spellcasting |
| Alignment | `any good alignment` | 71 | 2% | no: no alignment field |
| Size or creature type | `Small or smaller`, `animal or magical beast` | 56 | 2% | partly: race size and type are imported, but the model has no fields for them |
| Unclassified | `10 Hit Dice`, `base Fortitude save bonus +3`, `must be taken at 1st level`, `Bite attack` | 726 | 22% | case by case. Hit Dice and base saves could be checked |

- **Disjunctions.** 599 records (18%) have at least one "or" clause, most often `base attack bonus +6 or monk level 6th` from style feats. A parser that keeps "or" as a disjunction of atoms handles them.
- **Fully checkable records.**

  | | System | `pf1-content` | Both |
  |---|---|---|---|
  | Every atom from facts the model has today (ability, BAB, feat, skill ranks, character and class level) | 194 (58%) | 1,137 (38%) | 1,331 (40%) |
  | Plus race, class feature, caster level and alignment | 286 (86%) | 2,000 (66%) | 2,286 (68%) |
- **Name resolution.** The two feat packs hold 3,564 distinct names. 77 names occur in both repos: 68 are the same record copied under the same `_id`, and 9 have different IDs, such as Multiweapon Fighting. Within each repo's feat pack, every name is unique. "Weapon Focus" and "Weapon Focus (Mythic)" are separate feats, and the mythic one lists the base feat as a prerequisite.

## Traits

Pack: `pf1-content` `pf-traits` (1,983 records, `subType: trait`). The system has no traits pack.

- **Fields.** `traitType` is structured, with 15 values. There is no prerequisite field.
- **Description line.** Requirements sit in a `<strong>Requirements</strong>:` line. 1,214 records use that form, 3 use `Requirement(s)` and 1 uses `Prerequisite(s)`.
- **`tags` repeat the requirement**, e.g. Opportune Slayer (Lamashtu), `src/pf-traits/Opportune_Slayer__Lamashtu__uC8j5uveUkL8EiBj.yaml`: `traitType: religion`, `tags: [Lamashtu]`, `Requirements: Lamashtu`.

| `traitType` | Records | With Requirements | `tags` repeat it | What the requirement names |
|---|---|---|---|---|
| region | 447 | 444 | 420 | a nation, region or city (`Varisia`, `Osirion`) |
| race | 406 | 405 | 400 | a race (`elf`, `Geniekin`) |
| religion | 204 | 203 | 196 | a deity (`Desna`, `Iomedae`) |
| campaign | 205 | 10 | 6 | an Adventure Path, usually with no Requirements line |
| social, combat, magic, faith | 536 | 64 | 40 | mostly none; the rest are race or region conditions |
| faction | 66 | 66 | 66 | a Pathfinder Society faction |
| mount, cosmic | 26 | 26 | 0 | a mount type, or a birth date range (`12 Pharast - 18 Gozran`) |
| drawback, equipment, family, exemplar | 93 | 0 | 0 | none |

- **Mechanically checkable today:** race traits (436 records name a race), against the race entry.
- **Not checkable today:** region, deity and faction, because the sheet records none of them. They make up most of the rest.
- **Category limits.** `traitType` makes per-category limits mechanical, such as "one trait per category". That rule is APG text, so #215 would have to admit it.

### Racial traits (for the race checks)

Pack: `pf1-content` `pf-racial-traits` (1,642 records, `subType: racial`).

- **Which race.** Every record has `tags`, and in 1,396 of them a tag equals a race record's name. 1,395 open with a `<strong>Race</strong>: X` line. Alternate traits add `<strong>Replaced Trait(s)</strong>: …` in prose.
- **Prerequisites.** 100 records (6%) have a `Prerequisite` line. These are mostly race-builder conditions on the race itself, such as `Fey type`, `Charisma 13+` or `The race has at least a +2 racial bonus to Dexterity`. Example: `src/pf-racial-traits/Voice_in_the_Darkness__Dwarf__XVm7uHb6cw0AiUOh.yaml`, with `Charisma 13+`.

## Class features

- **Packs.** System `class-abilities` holds 4,673 records and `pf1-content` `pf-class-abilities` holds 767, both `subType: classFeat`.
- **Granting class.** `associations.classes` names it, by class name, e.g. `[Kineticist]`. 5,477 of the 5,485 `classFeat` records across both repos have it.
- **Prerequisite lines.** Only 119 system and 4 module records have one. They are mostly kineticist wild talents that require other talents, and 115 of them link those talents with `@UUID`. Example: `class-abilities/kineticist-talents/utility-talents/wood/tree-step.lTXQGIFZtG0eAGWQ.yaml` requires greater woodland step and woodland step.

## Prestige classes

- **Records.** There are none. No record in either repo has `subType: prestige`.
  - The system's `classes` pack has 44 `base` and 5 `npc` classes. It also has 13 `racial` HD classes in `racial-hd` and 6 `mythic` paths in `mythic-paths`.
  - `pf1-content` has 4 class records: Animal Companion, Eidolon, and two collaboration classes, Vampire Hunter and Omdura. None is prestige.
- **Support code.** The system supports the type: `classTypes.prestige` in `module/config.mjs`, with its own save progressions. Prestige good saves use `floor((1 + @hitDice) / 2)`, and poor saves use `floor((1 + @hitDice) / 3)`.
- **Upstream plans.** Upstream issue [#4110](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/work_items/4110) is open, created 2025-04-07 and labelled Enhancement. It proposes tracking prestige requirements (skill ranks, caster level, alignment, feats), but only to generate description headers. No structured requirement field exists or is scheduled.

## Classes

The 49 records in the system `classes` pack all carry the fields the other rules checks need. The classes are `ClassModel` items (`module/models/item/class-model.mjs`).

| Field | Content in the pack | Maps to `CatalogEntryDetail` `class` |
|---|---|---|
| `subType` | `base` 44, `npc` 5 | `classKind` |
| `hd` | d8 26, d10 14, d6 7, d12 2 | `hitDie` |
| `bab` | `med` 26, `high` 16, `low` 7; `custom` with `babFormula` unused | `bab`: `threeQuarters`, `full`, `half` |
| `savingThrows.{fort,ref,will}.value` | `high`/`low`. Fort 27/22, Ref 18/31, Will 28/21. `custom` formulas unused | `saves`: `good`/`poor` |
| `skillsPerLevel` | 2 (16), 4 (21), 6 (9), 8 (3) | `skillRanksPerLevel` |
| `classSkills` | present on all 49 (format below) | `classSkills` |
| level features | `{ level, uuid }` links to class-ability records | `featuresByLevel` |
| `alignment` | prose on 9 classes: Paladin "Lawful good", Antipaladin "Chaotic evil", Monk "Any lawful.", Monk (Unchained) "Any lawful", Barbarian "Any non-lawful", Barbarian (Unchained) "Any nonlawful", Druid, Hunter and Shifter "Any neutral" | not in the model. Small enough to map by hand if alignment is checked |
| `casting` | 28 classes: `type` (prepared/spontaneous), `progression` (high/med/low), `ability` | for spellcasting (#218) |

- **Progression formulas.** The progressions are enums, and the formulas live in system code, not in the records: `classBABFormulas`, `classSavingThrowFormulas` and their fractional variants in `module/config.mjs`.
  - Base, NPC and racial classes share the same save formulas: `2 + floor(@hitDice / 2)` for a good save and `floor(@hitDice / 3)` for a poor one. This matches the CRB tables and the data model's built-in Modifiers.
- **Background skills.** Class skills include the Unchained background skills `artistry` and `lore` (`art`, `lor` at v11.11). `SkillKey` has to include them or drop them on import.
- **The format depends on the pin.** Unreleased master has breaking changes to class records, recorded as API entries under `changelogs/unreleased/` (508 entries). Master's `system.json` still says 11.11, but it requires Foundry 14.368, while v11.11 requires 12 and is verified on 13.

  | | v11.11 release (`418761d2`) | master (`688b13b3`) |
  |---|---|---|
  | `classSkills` | boolean map of three-letter keys: `{ clm: true, kdu: true, … }` | array of skill ids: `[climb, knowledge.dungeoneering, …]` ("Class skill data structure has been changed from a boolean map to a key array") |
  | level features | `links.classAssociations` on 44 classes | merged into `links.supplements` ("Merged `classAssociations` on class items into `supplements`", #2877) |
  | skills | defined in `config.skills` | also a new `skill` item type and the `skills-core` / `skills-background` / `skills-consolidated` packs (#420) |
  | feats | 313 records | 390 records. Same prerequisite encoding: 83% have the line, 51% fully checkable from today's facts, 85% with the wider set |

  `research/pf1-content-dataset` described master's `links.supplements`. The decision to pin "one commit" has to choose between the released shape and master's.

## Method

1. Shallow-clone both repos and parse every `.yaml` under `packs/` (system) and `src/` (`pf1-content`). That is 28,767 documents on master and 27,592 with v11.11 packs.
2. Grep `module/`, `lang/`, `docs/`, `help/`, the changelogs and the tools for "prereq" and "requirement". Search both projects' issue trackers through the GitLab API.
3. Extract the paragraph after a `<strong>`/`<b>` heading matching `Prerequisite(s)` or `Requirement(s)`. Replace `@UUID[…]{Label}` with its label, after recording the link target.
4. Split the paragraph at top-level `,` and `;`, then at `or`. Classify each atom:
   - first by exact name match against the feat, race and class-ability records;
   - then by regular expressions for ability scores, BAB, skill ranks, caster level, character level, `<n>th-level <class>` and `<class> level <n>th`, spellcasting, alignment, proficiency, class features, deity, and size or type.

   Random samples of 25 atoms per kind were read by hand. Misclassification is a few per cent: for example, `animal or magical beast` is counted as a class feature, and `Halfling Jinx trait` as a race.

## Sources

- Foundry pf1 system: <https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1>, master `688b13b3a288cd4b0666a8e0848297a1c9c2ce1c` and tag v11.11 `418761d2e16a6037c0156bb4a241f7cea5a2986d`. Files used:
  - `module/models/item/feat-model.mjs`, `module/models/item/class-model.mjs`, `module/models/item/abstract/base-item-model.mjs`, `module/models/components/link-model.mjs`;
  - `module/config.mjs` (`classTypes`, `classBAB`, `classSavingThrows`, `classBABFormulas`, `classSavingThrowFormulas`, `skills`);
  - `public/system.json`, `CHANGELOG.md` (10.0 entry for #2648);
  - `changelogs/unreleased/class-skill-trait-selector_2.json`, `changelogs/unreleased/feature_2877_merge_class_associations_with_supplements.json`, `changelogs/unreleased/skill-items-try-3_1.json`;
  - `packs/feats`, `packs/classes`, `packs/class-abilities`, `packs/races`.
- System issues: [#4110 Add way to track requirements for prestige classes](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/work_items/4110), [#2648 Improved Iron Will should have a link to Iron Will](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/work_items/2648)
- `pf1-content`: <https://gitlab.com/foundryvtt_pathfinder1e/pf1-content>, main `c66bf333cafc451d817ead660473dd01d9846fb3`. Files used: `src/pf-feats`, `src/pf-traits`, `src/pf-racial-traits`, `src/pf-class-abilities`, `CHANGELOG.md`.
- Earlier research on this map: `research/pf1-content-dataset` (`docs/research/pf1-content-dataset.md`) and `research/pf1-foundry-id-stability` (`docs/research/pf1-foundry-id-stability.md`).
- Repo data model: `docs/pf-character-sheet-data-model.md`, "Tables", "Entry kinds" and "Global catalog import", on `feature/pf1-character-builder`.
