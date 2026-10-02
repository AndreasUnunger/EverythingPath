# PF1 Spellcasting Tables

Numbers and lookups for `pf1-rules.md`. Retrieved 2026-10-02. Sources and provenance in `README.md`. Pages are the first page of the class entry or rules section as Archives of Nethys prints it ("Source *Book* pg. N").

The spells per day and spells known tables of the 24 classes in Foundry's `rules` journal are not repeated: `research/pf1-spell-data` showed they match the seven shared `(type, progression)` tables cell for cell. This file adds the four tables the journal lacks (alchemist, investigator, adept, unchained summoner). CRB Table 1–3 (bonus spells) is in `docs/ai/pf1-core-rules/pf1-tables.md` on `research/pf1-core-rules`.

## Table: Rule Locations

| Topic | Book and page | URL |
|---|---|---|
| Abilities and Spellcasters (bonus spells, which ability) | CRB p. 16; Table 1–3 on p. 17 | https://aonprd.com/Rules.aspx?Name=Ability%20Scores&Category=Getting%20Started |
| Choosing a Spell; Concentration and its DC table | CRB p. 206 | https://aonprd.com/Rules.aspx?Name=Magic&Category=Rules%20of%20the%20Game |
| Caster Level; Bonus Types | CRB p. 208 | same |
| Saving Throw (DC) | CRB p. 216 | same |
| Spell Resistance (caster level check) | CRB p. 217 | same |
| Arcane Spells; Preparing Wizard Spells; Arcane Magical Writing | CRB p. 218 | same |
| Borrowed spellbooks; Adding spells; Writing costs; Replacing and copying | CRB p. 219 | same |
| Selling a spellbook; Sorcerers and Bards; Divine Spells; Preparing Divine Spells | CRB p. 220 | same |
| Divine Magical Writing; New Divine Spells | CRB p. 221 | same |
| Metamagic Feats (prepared vs spontaneous, effects) | CRB pp. 112–113 | https://legacy.aonprd.com/coreRulebook/feats.html |
| Heighten Spell | CRB p. 126 | https://aonprd.com/FeatDisplay.aspx?ItemName=Heighten%20Spell |
| Spell Focus; Spell Mastery | CRB p. 134 | https://aonprd.com/FeatDisplay.aspx?ItemName=Spell%20Focus |
| Combat Casting | CRB p. 119 | https://aonprd.com/FeatDisplay.aspx?ItemName=Combat%20Casting |
| Prestige class definitions (caster level) | CRB p. 374 | https://legacy.aonprd.com/coreRulebook/prestigeClasses.html |
| Arcane archer / dragon disciple / eldritch knight / mystic theurge | CRB pp. 374 / 380 / 384 / 387 | https://aonprd.com/PrestigeClassesDisplay.aspx?ItemName=Mystic%20Theurge |
| Expanded Arcana | APG p. 159 | https://aonprd.com/FeatDisplay.aspx?ItemName=Expanded%20Arcana |
| Magical Knack, Magical Lineage, Focused Mind (traits) | APG p. 329; UC p. 57 | https://aonprd.com/TraitDisplay.aspx?ItemName=Magical%20Knack |
| Spell Specialization / Greater Spell Specialization | UM p. 156 / p. 152 | https://aonprd.com/FeatDisplay.aspx?ItemName=Spell%20Specialization |
| Psychic Magic; components; undercasting | OA p. 144 | https://aonprd.com/Rules.aspx?Name=Psychic%20Magic&Category=Occult%20Rules |

## Table: Casting Classes

"Type": P = prepared, S = spontaneous, H = hybrid (prepares, casts spontaneously from what it prepared), E = extracts. "Levels" = highest spell level. "Starts" = class level of the first 1st-level spell. "0-level" = name and how the class gets them ("table" = a count on its table; "—" = none). CL = caster level.

| Class | Book p. | Kind | Type | Ability | Levels | Starts | 0-level | CL | What the sheet stores |
|---|---|---|---|---|---:|---:|---|---|---|
| Bard | CRB 34 | arcane | S | Cha | 6 | 1 | cantrips (known table) | class level | spells known |
| Cleric | CRB 38 | divine | P | Wis | 9 | 1 | orisons (per-day table) | class level | prepared spells; 2 domains; domain slot per level; cure or inflict |
| Druid | CRB 48 | divine | P | Wis | 9 | 1 | orisons (per-day table) | class level | prepared spells; domain slot if nature bond domain |
| Paladin | CRB 60 | divine | P | Cha | 4 | 4 ("0") | — | class level – 3 (none before 4th) | prepared spells |
| Ranger | CRB 64 | divine | P | Wis | 4 | 4 ("0") | — | class level – 3 (none before 4th) | prepared spells |
| Sorcerer | CRB 70 | arcane | S | Cha | 9 | 1 | cantrips (known table) | class level | spells known; bloodline spells (3rd, 5th, ... 19th) |
| Wizard | CRB 77 | arcane | P | Int | 9 | 1 | cantrips (per-day table) | class level | spellbook; prepared spells; school slot and 2 opposition schools, or universalist |
| Adept (NPC) | CRB 448 | divine | P | Wis | 5 | 1 | 0-level column, 3 per day (no Orisons feature) | class level | prepared spells |
| Alchemist | APG 26 | (extracts; FAQ: not a spellcaster) | E | Int | 6 | 1 | — | class level (stated) | formula book; prepared extracts |
| Inquisitor | APG 38 | divine | S | Wis | 6 | 1 | orisons (known table) | class level | spells known; 1 domain (no slots) |
| Oracle | APG 42 | divine (cleric list) | S | Cha | 9 | 1 | orisons (known table) | class level | spells known; mystery spells (2nd, 4th, ... 18th); all cure or all inflict |
| Summoner | APG 54 | arcane | S | Cha | 6 | 1 | cantrips (known table) | class level | spells known |
| Witch | APG 65 | arcane | P | Int | 9 | 1 | cantrips (per-day table) | class level | familiar as spellbook; prepared spells; patron spells (2nd, 4th, ... 18th) |
| Antipaladin | APG 118 | divine | P | Cha | 4 | 4 ("0") | — | class level – 3 (none before 4th) | prepared spells |
| Magus | UM 9 | arcane | P | Int | 6 | 1 | cantrips (per-day table) | class level | spellbook; prepared spells |
| Unchained summoner | PU 25 | arcane | S | Cha | 6 | 1 | cantrips (known table) | class level | spells known |
| Arcanist | ACG 8 | arcane | H | Int | 9 | 1 | cantrips (prepared table) | class level | spellbook; prepared spells (count from Table 1–2) |
| Bloodrager | ACG 15 | arcane | S | Cha | 4 | 4 (1 per day) | — | class level (no offset stated) | spells known; bloodline spells (7th, 10th, 13th, 16th) |
| Hunter | ACG 26 | divine (druid ≤6th + ranger) | S | Wis | 6 | 1 | orisons (known table) | class level | spells known; all *summon nature's ally* |
| Investigator | ACG 30 | (extracts) | E | Int | 6 | 1 | — | class level (dispel sentence only) | formula book; prepared extracts |
| Shaman | ACG 35 | divine | P | Wis | 9 | 1 | orisons (per-day table) | class level | prepared spells; spirit and daily wandering spirit; one spirit magic slot per level |
| Skald | ACG 49 | arcane (bard list) | S | Cha | 6 | 1 | cantrips (known table) | class level | spells known |
| Warpriest | ACG 60 | divine (cleric list ≤6th) | P | Wis | 6 | 1 | orisons (per-day table) | class level | prepared spells; cure or inflict |
| Medium | OA 30 | psychic | S | Cha | 4 | 4 (1 per day) | knacks (known table, 2 at 1st) | class level | spells known |
| Mesmerist | OA 38 | psychic | S | Cha | 6 | 1 | knacks (known table) | class level | spells known |
| Occultist | OA 46 | psychic | S | Int | 6 | 1 | knacks (1 per implement school pick) | class level | implement schools; 1 spell per level per school pick |
| Psychic | OA 60 | psychic | S | Int | 9 | 1 | knacks (known table) | class level | spells known; discipline spells (1st, 4th, 6th, ... 18th) |
| Spiritualist | OA 72 | psychic | S | Wis | 6 | 1 | knacks (known table) | class level | spells known |

"class level" in the CL column is the CRB p. 208 default, which every class except the three "– 3" classes falls under; only the alchemist states it in its own text.

## Table: Swapping Spells Known

| Class | Swap levels | New spell level | "Lower than highest" condition |
|---|---|---|---|
| Sorcerer, oracle | 4th and every even level | same as the old spell | no |
| Psychic | 4th and every even level | same | "at least 1 level lower than the highest-level spell from the psychic's class list that the psychic can cast" |
| Bard, inquisitor, summoner, unchained summoner, skald, mesmerist, spiritualist | 5th, 8th, 11th, ... (every 3rd) | same | at least one level lower than the highest the class can cast |
| Occultist | 5th, 8th, 11th, ... | same, from the same implement school list | at least one level lower |
| Hunter | 5th and every 3 levels | same | no |
| Medium | 5th and every 3 levels | same | no |
| Bloodrager | 8th and every 3 levels | "follows all the same rules as for a sorcerer" | no (as sorcerer) |

Every class: one spell per swap level, chosen when new spells known are gained for that level. Automatically added spells (bloodline, mystery, discipline, oracle cure/inflict, hunter *summon nature's ally*) cannot be swapped.

## Table: 0-Level Spells in Higher Slots (Metamagic Clause)

| States 0-level spells in metamagic slots are expended | Says only "not expended" / "do not consume slots" |
|---|---|
| inquisitor, summoner, unchained summoner, witch, mesmerist, occultist, psychic, spiritualist | bard, cleric, druid, sorcerer, wizard, oracle, magus, arcanist, hunter, shaman, skald, warpriest, medium; adept has no 0-level feature at all |

See Open S4 and S5 in `pf1-rules.md`.

## Table: Concentration Check DCs

Source: CRB p. 206, Table: Concentration Check DCs.

| Situation | DC |
|---|---|
| Cast defensively | 15 + double spell level |
| Injured while casting | 10 + damage dealt + spell level |
| Continuous damage while casting | 10 + 1/2 damage dealt + spell level |
| Affected by a non-damaging spell while casting | DC of the spell + spell level |
| Grappled or pinned while casting | 10 + grappler's CMB + spell level |
| Vigorous motion while casting | 10 + spell level |
| Violent motion while casting | 15 + spell level |
| Extremely violent motion while casting | 20 + spell level |
| Wind with rain or sleet while casting | 5 + spell level |
| Wind with hail and debris while casting | 10 + spell level |
| Weather caused by spell | see spell |
| Entangled while casting | 15 + spell level |

Class-specific: wizard casting without a bonded object, DC 20 + spell level (CRB p. 77); occultist casting without the implement, DC 20 + spell level (OA p. 46). Thought component: +10 to any concentration DC unless the psychic caster first spends a move action (OA p. 144). Metamagic: use the slot level for concentration (FAQ CRB `v5748eaic9r9w`).

## Table: Writing a Spell into a Spellbook

Source: CRB p. 219. 1 page per spell level (0-level: 1 page); 100 pages per book; 1 hour per spell level (0-level: 30 minutes). No cost or time for the free spells gained at a new level. Copying an existing book: time and cost per page halved. Copying fee charged by another wizard: usually half the writing cost. Blank spellbook 15 gp, 3 lbs. Formula books use "the same costs, pages, and time requirements" (alchemist) and cost "as much as a spellbook" (investigator).

| Spell level | Writing cost |
|---:|---:|
| 0 | 5 gp |
| 1 | 10 gp |
| 2 | 40 gp |
| 3 | 90 gp |
| 4 | 160 gp |
| 5 | 250 gp |
| 6 | 360 gp |
| 7 | 490 gp |
| 8 | 640 gp |
| 9 | 810 gp |

The printed values equal 10 gp × spell level squared for levels 1 to 9 (a derived pattern, not stated by the CRB).

## Table: Alchemist Extracts per Day

Source: APG p. 26, Table 2–1, https://aonprd.com/ClassDisplay.aspx?ItemName=Alchemist. Checked against the PRD (https://legacy.aonprd.com/advancedPlayersGuide/baseClasses/alchemist.html): identical. Base allotment before bonus extracts for Intelligence. No 0-level column. "—" = no access. The values equal the bard's Spells per Day for spell levels 1 to 6.

| Class level | 1st | 2nd | 3rd | 4th | 5th | 6th |
|---|---:|---:|---:|---:|---:|---:|
| 1st | 1 | — | — | — | — | — |
| 2nd | 2 | — | — | — | — | — |
| 3rd | 3 | — | — | — | — | — |
| 4th | 3 | 1 | — | — | — | — |
| 5th | 4 | 2 | — | — | — | — |
| 6th | 4 | 3 | — | — | — | — |
| 7th | 4 | 3 | 1 | — | — | — |
| 8th | 4 | 4 | 2 | — | — | — |
| 9th | 5 | 4 | 3 | — | — | — |
| 10th | 5 | 4 | 3 | 1 | — | — |
| 11th | 5 | 4 | 4 | 2 | — | — |
| 12th | 5 | 5 | 4 | 3 | — | — |
| 13th | 5 | 5 | 4 | 3 | 1 | — |
| 14th | 5 | 5 | 4 | 4 | 2 | — |
| 15th | 5 | 5 | 5 | 4 | 3 | — |
| 16th | 5 | 5 | 5 | 4 | 3 | 1 |
| 17th | 5 | 5 | 5 | 4 | 4 | 2 |
| 18th | 5 | 5 | 5 | 5 | 4 | 3 |
| 19th | 5 | 5 | 5 | 5 | 5 | 4 |
| 20th | 5 | 5 | 5 | 5 | 5 | 5 |


## Table: Investigator Extracts per Day

Source: ACG p. 30, Table 1–8, https://aonprd.com/ClassDisplay.aspx?ItemName=Investigator. Checked against the PRD (https://legacy.aonprd.com/advancedClassGuide/classes/investigator.html): identical. Identical to the alchemist table, cell for cell. No 0-level column.

| Class level | 1st | 2nd | 3rd | 4th | 5th | 6th |
|---|---:|---:|---:|---:|---:|---:|
| 1st | 1 | — | — | — | — | — |
| 2nd | 2 | — | — | — | — | — |
| 3rd | 3 | — | — | — | — | — |
| 4th | 3 | 1 | — | — | — | — |
| 5th | 4 | 2 | — | — | — | — |
| 6th | 4 | 3 | — | — | — | — |
| 7th | 4 | 3 | 1 | — | — | — |
| 8th | 4 | 4 | 2 | — | — | — |
| 9th | 5 | 4 | 3 | — | — | — |
| 10th | 5 | 4 | 3 | 1 | — | — |
| 11th | 5 | 4 | 4 | 2 | — | — |
| 12th | 5 | 5 | 4 | 3 | — | — |
| 13th | 5 | 5 | 4 | 3 | 1 | — |
| 14th | 5 | 5 | 4 | 4 | 2 | — |
| 15th | 5 | 5 | 5 | 4 | 3 | — |
| 16th | 5 | 5 | 5 | 4 | 3 | 1 |
| 17th | 5 | 5 | 5 | 4 | 4 | 2 |
| 18th | 5 | 5 | 5 | 5 | 4 | 3 |
| 19th | 5 | 5 | 5 | 5 | 5 | 4 |
| 20th | 5 | 5 | 5 | 5 | 5 | 5 |


## Table: Adept Spells per Day

Source: CRB p. 448, Table 14–1, https://aonprd.com/ClassDisplay.aspx?ItemName=Adept. Checked against the PRD (https://legacy.aonprd.com/coreRulebook/nPCClasses.html): identical. Prepared, Wisdom. "0" = only bonus spells for Wisdom at that level ("Where Table 14–1 indicates that the adept gets 0 spells per day of a given spell level, she gains only the bonus spells she would be entitled to based on her Wisdom score for that spell level.").

| Class level | 0 | 1st | 2nd | 3rd | 4th | 5th |
|---|---:|---:|---:|---:|---:|---:|
| 1st | 3 | 1 | — | — | — | — |
| 2nd | 3 | 1 | — | — | — | — |
| 3rd | 3 | 2 | — | — | — | — |
| 4th | 3 | 2 | 0 | — | — | — |
| 5th | 3 | 2 | 1 | — | — | — |
| 6th | 3 | 2 | 1 | — | — | — |
| 7th | 3 | 3 | 2 | — | — | — |
| 8th | 3 | 3 | 2 | 0 | — | — |
| 9th | 3 | 3 | 2 | 1 | — | — |
| 10th | 3 | 3 | 2 | 1 | — | — |
| 11th | 3 | 3 | 3 | 2 | — | — |
| 12th | 3 | 3 | 3 | 2 | 0 | — |
| 13th | 3 | 3 | 3 | 2 | 1 | — |
| 14th | 3 | 3 | 3 | 2 | 1 | — |
| 15th | 3 | 3 | 3 | 3 | 2 | — |
| 16th | 3 | 3 | 3 | 3 | 2 | 0 |
| 17th | 3 | 3 | 3 | 3 | 2 | 1 |
| 18th | 3 | 3 | 3 | 3 | 2 | 1 |
| 19th | 3 | 3 | 3 | 3 | 3 | 2 |
| 20th | 3 | 3 | 3 | 3 | 3 | 2 |


## Table: Unchained Summoner Spells per Day

Source: PU p. 25, Table 1–4, https://aonprd.com/ClassDisplay.aspx?ItemName=Summoner%20(Unchained). Checked against the PRD (https://legacy.aonprd.com/unchained/classes/summoner.html): identical. Spontaneous, Charisma. Identical to the bard's and the APG summoner's Spells per Day.

| Class level | 1st | 2nd | 3rd | 4th | 5th | 6th |
|---|---:|---:|---:|---:|---:|---:|
| 1st | 1 | — | — | — | — | — |
| 2nd | 2 | — | — | — | — | — |
| 3rd | 3 | — | — | — | — | — |
| 4th | 3 | 1 | — | — | — | — |
| 5th | 4 | 2 | — | — | — | — |
| 6th | 4 | 3 | — | — | — | — |
| 7th | 4 | 3 | 1 | — | — | — |
| 8th | 4 | 4 | 2 | — | — | — |
| 9th | 5 | 4 | 3 | — | — | — |
| 10th | 5 | 4 | 3 | 1 | — | — |
| 11th | 5 | 4 | 4 | 2 | — | — |
| 12th | 5 | 5 | 4 | 3 | — | — |
| 13th | 5 | 5 | 4 | 3 | 1 | — |
| 14th | 5 | 5 | 4 | 4 | 2 | — |
| 15th | 5 | 5 | 5 | 4 | 3 | — |
| 16th | 5 | 5 | 5 | 4 | 3 | 1 |
| 17th | 5 | 5 | 5 | 4 | 4 | 2 |
| 18th | 5 | 5 | 5 | 5 | 4 | 3 |
| 19th | 5 | 5 | 5 | 5 | 5 | 4 |
| 20th | 5 | 5 | 5 | 5 | 5 | 5 |


## Table: Unchained Summoner Spells Known

Source: PU p. 25, Table 1–5 (same URLs). Fixed numbers, not raised by Charisma. Identical to the bard's and the APG summoner's Spells Known.

| Class level | 0 | 1st | 2nd | 3rd | 4th | 5th | 6th |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1st | 4 | 2 | — | — | — | — | — |
| 2nd | 5 | 3 | — | — | — | — | — |
| 3rd | 6 | 4 | — | — | — | — | — |
| 4th | 6 | 4 | 2 | — | — | — | — |
| 5th | 6 | 4 | 3 | — | — | — | — |
| 6th | 6 | 4 | 4 | — | — | — | — |
| 7th | 6 | 5 | 4 | 2 | — | — | — |
| 8th | 6 | 5 | 4 | 3 | — | — | — |
| 9th | 6 | 5 | 4 | 4 | — | — | — |
| 10th | 6 | 5 | 5 | 4 | 2 | — | — |
| 11th | 6 | 6 | 5 | 4 | 3 | — | — |
| 12th | 6 | 6 | 5 | 4 | 4 | — | — |
| 13th | 6 | 6 | 5 | 5 | 4 | 2 | — |
| 14th | 6 | 6 | 6 | 5 | 4 | 3 | — |
| 15th | 6 | 6 | 6 | 5 | 4 | 4 | — |
| 16th | 6 | 6 | 6 | 5 | 5 | 4 | 2 |
| 17th | 6 | 6 | 6 | 6 | 5 | 4 | 3 |
| 18th | 6 | 6 | 6 | 6 | 5 | 4 | 4 |
| 19th | 6 | 6 | 6 | 6 | 5 | 5 | 4 |
| 20th | 6 | 6 | 6 | 6 | 6 | 5 | 5 |


## Table: FAQ Entries Used

FAQ pages: CRB https://paizo.com/paizo/faq/v5748nruor1fm (page last updated August 2017), APG https://paizo.com/paizo/faq/v5748nruor1fn (August 2016), ACG https://paizo.com/paizo/faq/v5748nruor1gw (August 2017), OA https://paizo.com/paizo/faq/v5748nruor1h5 (July 2016). Read 2026-10-02.

| FAQ | Anchor | Posted | Topic |
|---|---|---|---|
| CRB | `v5748eaic9o91` | July 2011 | Bonus spells only for spell levels the class can access |
| CRB | `v5748eaic9o6x` | July 2011 | Effective spell level of class spell-like abilities |
| CRB | `v5748eaic9ucw` | February 2016 | DC of abilities that work "as a spell" |
| CRB | `v5748eaic9r9w` | October 2013 | Metamagic spell counts at slot level for concentration |
| CRB | `v5748eaic9qpo` | June 2013 | Heighten Spell with higher slots and other metamagic |
| CRB | `v5748eaic9qny` | May 2013 | Spell Mastery only for wizards as written |
| CRB | `v5748eaic9qwu` | August 2013 | Open slots: wizard, magus, witch |
| CRB | `v5748eaic9s54` | July 2014 | Spells known outside the class list cannot be cast |
| CRB | `v5748eaic9s55` | July 2014 | No casting with another class's slots |
| CRB | `v5748eaic9ne8` | October 2010 | Class abilities that modify spellcasting apply to all classes |
| CRB | `v5748eaic9n9y` | August 2010 | Items are not "casting a spell" for feats and abilities |
| CRB | `v5748eaic9rae` | October 2013 | Prestige advancement: CL, spells per day, spells known only |
| CRB | `v5748eaic9nib` | November 2010 | No free spellbook spells from prestige levels |
| CRB | `v5748eaic9qx6` | August 2013 | Mystic theurge combined spells with spontaneous classes |
| APG | `v5748eaic9nii` | November 2010 | Witch patron spells not advanced by prestige levels |
| APG | `v5748eaic9qdk` | March 2013 | Alchemists are not spellcasters (crafting) |
| APG | `v5748eaic9qlk` | May 2013 | Oracle uses Wisdom where cleric spells say Wisdom |
| APG | `v5748eaic9n9z` | August 2010 | A gained domain includes a domain slot per level |
| APG | `v5748eaic9oyl` | February 2012 | Aquatic bloodline *geyser* learned as 4th level |
| APG | `v5748eaic9qns` | May 2013 | Magical Lineage cannot go below the original level |
| APG | `v5748eaic9ni3` | November 2010 | Effective-level items affect only the named ability |
| ACG | `v5748eaic9tml` | July 2015 | Blood of dragons raises draconic bloodrager powers |
| ACG | `v5748eaic9ux4` | August 2016 | Bloodrager cannot use sorcerer-level items |
| ACG | `v5748eaic9tmk` | July 2015 | Investigator's omitted alchemist sentence is intentional |
| ACG | `v5748eaic9vv1` | August 2017 | Oracle does not prepare spells (spirit guide hex) |
| OA | `v5748eaic9utw` | July 2016 | Class kind of magic follows bloodline or archetype |
