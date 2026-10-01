# Official rules for racial Hit Dice progression

Research for [Collect the official rules for racial Hit Dice progression](https://github.com/AndreasUnunger/EverythingPath/issues/220), part of map #201. The militia needs only the count of racial Hit Dice ([Decide what the militia reads from a Character Sheet, and when](https://github.com/AndreasUnunger/EverythingPath/issues/205)). This note covers what racial Hit Dice add beyond the count, and how the Foundry VTT pf1 system models them. It reads against `docs/pf-character-sheet-data-model.md` on `feature/pf1-character-builder` ("Class Levels and Hit Dice").

## Answer

- **The Core Rulebook defines racial Hit Dice but not what they grant.** It says monsters "gain racial Hit Dice", that racial first Hit Dice are not maximized, and that the PC races have none. It also keys feats, skill ranks and the skill-rank cap to Hit Dice. It never gives a per-type Hit Die, BAB, save or skill progression.
- **The progression comes from the Bestiary (another Paizo book, flagged).** Each of the 13 creature types sets a Hit Die, a BAB rate (full, 3/4 or 1/2 of HD), its good saves, skill ranks per HD (2, 4 or 6 + Int, minimum 1) and a class-skill list. The Bestiary also gives the feat formula (1 + 1 per 2 HD after the first), the save and BAB values per HD, and +1 ability score per 4 *added* racial HD.
- **Combining with Class Levels.** The Bestiary adds class levels "just like adding class levels to a character without racial Hit Dice": HD, hit points, BAB, feats and skills add up.
  - The official FAQ confirms that BAB from racial HD adds normally.
  - Racial HD never get a favored class bonus (FAQ).
  - A racial first Hit Die is not maximized (CRB and FAQ).
  - The skill-rank cap is total Hit Dice (CRB).
  - Character level, as the CRB defines it, counts class levels only.
- **Gaps.** The text is silent on several points, listed as [open items](#open-items):
  - whether ability score increases follow total HD or character level once class levels are added;
  - whether "character level" prerequisites (Leadership) count racial HD;
  - whether racial HD saves combine like a class's;
  - how a Monster PC's CR-as-levels interacts with Hit Dice.
- **Foundry pf1** models racial HD as a `class` item with `subType: "racial"`. The item's `level` is the number of racial HD, and it carries the same `hd`, `bab`, `savingThrows`, `skillsPerLevel` and `classSkills` fields as a PC class.
  - The 13 records in the `racial-hd` pack match the Bestiary table.
  - Race items carry no Hit Dice count.
  - Total HD includes racial HD, while `details.level.value` (character level) excludes them.
- **Recommendation.** Keep `racialHitDice` on the race entry, and add an optional creature-type progression that reuses the class detail's fields. Record racial HD hit points as one plain number, with no favored class bonus. Compute feats and the skill-rank cap from Hit Dice, and keep character level as Class Levels only. Details are in [Recommendation](#recommendation).

## Sources and method

- **Core Rulebook.** The PRD on the Archives of Nethys legacy mirror (Paizo's `paizo.com/pathfinderRPG/prd/` URLs redirect there), retrieved 2026-10-01:
  - [Getting Started](https://legacy.aonprd.com/coreRulebook/gettingStarted.html) (Common Terms, Constitution);
  - [Classes](https://legacy.aonprd.com/coreRulebook/classes.html) (Character Advancement, Multiclassing, Favored Class);
  - [Using Skills](https://legacy.aonprd.com/coreRulebook/usingSkills.html);
  - [Feats](https://legacy.aonprd.com/coreRulebook/feats.html) (Toughness, Defensive Combat Training);
  - [Gamemastering](https://legacy.aonprd.com/coreRulebook/gamemastering.html) (Adding NPCs);
  - [Creating NPCs](https://legacy.aonprd.com/coreRulebook/creatingNPCs.html).
- **Bestiary (flagged: another Paizo book).** Same mirror:
  - [Creature Types](https://legacy.aonprd.com/bestiary/creatureTypes.html);
  - [Monster Creation](https://legacy.aonprd.com/bestiary/monsterCreation.html) (Table: Statistics Summary, Table: Creature Statistics by Type);
  - [Monster Advancement](https://legacy.aonprd.com/bestiary/monsterAdvancement.html) (Adding Racial Hit Dice, Adding Class Levels);
  - [Monsters as PCs](https://legacy.aonprd.com/bestiary/monstersAsPCs.html);
  - [Introduction](https://legacy.aonprd.com/bestiary/introduction.html) (stat block format).
- **Official FAQ.**
  - [Core Rulebook FAQ](https://paizo.com/paizo/faq/v5748nruor1fm/) (last updated 2017-08-08): "Hit Points", "Monk" (flurry) and "Awaken" entries.
  - [Bestiary FAQ](https://paizo.com/paizo/faq/v5748nruor1fo/) (last updated 2016-03-18): no entry on racial Hit Dice.
  - The APG and GameMastery Guide FAQs were searched too, with no relevant entry.
  - Paizo's separate errata documents were not checked beyond the PRD text, which is the errata'd printing.
- **Corpus.** `docs/ai/pf1-core-rules/` on `research/pf1-core-rules` was cross-checked. It already holds the max-hp rule and the Bestiary BAB/save table. Its skill section writes "total Hit Dice (character level)"; the two differ once racial HD exist (see [Combining with Class Levels](#combining-with-class-levels)).
- **Foundry VTT pf1.** [foundryvtt-pathfinder1](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1) at tag `v11.11` (`418761d2`, 2026-03-09), shallow clone. Read:
  - `packs/racial-hd/*.yaml` (13 records) and `packs/basic-monsters/*.yaml` (examples);
  - `public/template.json` (class defaults);
  - `module/config.mjs`, `module/documents/item/item-class.mjs`, `module/documents/actor/actor-pf.mjs`, `module/documents/actor/abstract/base-character.mjs`;
  - `module/applications/level-up.mjs`, `module/applications/actor/actor-sheet.mjs`, `module/applications/settings/health.mjs`;
  - `help/en/`, `CHANGELOG.md`.

Quotes are verbatim from the sources above.

## Findings: Core Rulebook

The CRB names racial Hit Dice and keys several rules to Hit Dice, but prints no racial progression.

- **What racial Hit Dice are.** Getting Started, Common Terms:
  > **Hit Dice (HD):** Hit Dice represent a creature's general level of power and skill. As a creature gains levels, it gains additional Hit Dice. Monsters, on the other hand, gain racial Hit Dice, which represent the monster's general prowess and ability.

  > **Monster:** Monsters are creatures that rely on racial Hit Dice instead of class levels for their powers and abilities (although some possess class levels as well). PCs are usually not monsters.
- **The PC races have none.** Gamemastering, Adding NPCs:
  > Creatures whose Hit Dice are solely a factor of their class levels and not a feature of their race, such as all of the PC races detailed in Races, are factored into combats a little differently than normal monsters or monsters with class levels.

  This supports the militia default of 0 racial Hit Dice for every core race.
- **Hit points: a racial first Hit Die is not maximized.** Getting Started, Common Terms:
  > **Hit Points (hp):** … A creature gains maximum hit points if its first Hit Die roll is for a character class level. Creatures whose first Hit Die comes from an NPC class or from his race roll their first Hit Die normally.

  Constitution applies per Hit Die (Getting Started, Constitution): "Each roll of a Hit Die (though a penalty can never drop a result below 1 …)". Toughness scales "For every Hit Die you possess beyond 3".
- **Feats, BAB and skills scale with Hit Dice.** Getting Started, Common Terms:
  > **Feat:** … Creatures receive a number of feats based off their Hit Dice, but some classes and other abilities grant bonus feats.

  > **Base Attack Bonus (BAB):** … As a character gains levels or Hit Dice, his base attack bonus improves.

  > **Skill:** … As a creature gains Hit Dice, it also gains additional skill ranks that can be added to its skills.
- **The skill-rank cap is total Hit Dice.** Using Skills:
  > You can never have more ranks in a skill than your total number of Hit Dice.

  Creating NPCs says the same: "limited by his total HD".
- **Character level counts class levels only.** Getting Started, Common Terms:
  > **Level:** … Class level is the number of levels of a specific class possessed by a character. Character level is the sum of all of the levels possessed by a character in all of his classes.

  Classes, Multiclassing:
  > Note that there are a number of effects and prerequisites that rely on a character's level or Hit Dice. Such effects are always based on the total number of levels or Hit Dice a character possesses, not just those from one class.
- **Ability score increases and feats follow character level.** Table: Character Advancement and Level-Dependent Bonuses gives feats at character levels 1, 3, 5 … 19 and ability score increases at 4, 8, 12, 16 and 20. For a creature without racial HD, character level equals Hit Dice, so the table and the "feats based off their Hit Dice" term agree. With racial HD they can differ (see [open items](#open-items)).
- **Multiclass totals add up.** Classes, Multiclassing: "He adds all of the hit points, base attack bonuses, and saving throw bonuses from a 1st-level wizard on top of those gained from being a 5th-level fighter." The CRB says this about two classes, not about racial HD.
- **Silent.** The CRB gives no Hit Die type, BAB rate, save progression, skill ranks per HD or class skills for any creature type. It has no rule for advancing a creature by racial HD.

## Findings: Bestiary (another Paizo book)

### Per creature type

Bestiary, Monster Creation, Table: Creature Statistics by Type, matching the prose in Creature Types:

| Type | Hit Die | BAB | Good saves | Skill ranks per HD* |
| --- | --- | --- | --- | --- |
| Aberration | d8 | HD × 3/4 (medium) | Will | 4 + Int |
| Animal | d8 | HD × 3/4 (medium) | Fort, Ref | 2 + Int |
| Construct | d10 | HD (fast) | — | 2 + Int |
| Dragon | d12 | HD (fast) | Fort, Ref, Will | 6 + Int |
| Fey | d6 | HD × 1/2 (slow) | Ref, Will | 6 + Int |
| Humanoid | d8 | HD × 3/4 (medium) | Varies (any one) | 2 + Int |
| Magical beast | d10 | HD (fast) | Fort, Ref | 2 + Int |
| Monstrous humanoid | d10 | HD (fast) | Ref, Will | 4 + Int |
| Ooze | d8 | HD × 3/4 (medium) | — | 2 + Int |
| Outsider | d10 | HD (fast) | Varies (any two) | 6 + Int |
| Plant | d8 | HD × 3/4 (medium) | Fort | 2 + Int |
| Undead | d8 | HD × 3/4 (medium) | Will | 4 + Int |
| Vermin | d8 | HD × 3/4 (medium) | Fort | 2 + Int |

> \* As long as a creature has an Intelligence of at least 1, it gains a minimum of 1 skill point per Hit Die. Creatures with an Intelligence score of "—" gain no skill points or feats.

- **Class skills by type.** Each type in Creature Types lists its class skills. Constructs, oozes and vermin have none.
  - Aberrations get "Knowledge (pick one)".
  - Outsiders "also receive 4 additional class skills determined by the creature's theme".
- **Defaults, not fixed values.** Each type's features hold "unless otherwise noted in a creature's entry". Humanoids have "One good save, usually Reflex", and outsiders "Two good saving throws, usually Reflex and Will". The good saves therefore belong to the individual creature, with the type as the default.
- **Humanoids trade their racial Hit Die for a class.** Creature Types, Humanoid:
  > Humanoids with 1 Hit Die exchange the features of their humanoid Hit Die for the class features of a PC or NPC class. … Humanoids with more than 1 Hit Die are the only humanoids who make use of the features of the humanoid type.

  On class skills: "Humanoids with a character class use their class's skill list instead. Humanoids with both a character class and racial HD add these skill sto [sic] their list of class skills."
- **Type-specific hit points.** Constructs gain bonus hit points by size (Small 10 up to Colossal 80). Undead "use their Charisma score in place of their Constitution score when calculating hit points".

### Progression per Hit Die

Bestiary, Monster Creation, Table: Statistics Summary gives BAB, saves and feats per HD. It matches the CRB class tables, so the closed forms in `docs/ai/pf1-core-rules/` apply:

- fast BAB = HD, medium = floor(3 × HD / 4), slow = floor(HD / 2);
- good save = 2 + floor(HD / 2), poor save = floor(HD / 3);
- feats = ceil(HD / 2).

The feat rule appears in two places.

- Monster Creation:
  > Each creature with an Intelligence score receives a number of feats equal to 1 + 1 per every 2 Hit Dice after the first (so, 1 at 1 HD, 2 at 3 HD, etc.). A creature must qualify to take a feat as normal.
- Monster Advancement:
  > Creatures gain one feat at 1 Hit Die and one additional feat for every 2 Hit Dice above 1.

### Adding racial Hit Dice (advancing a monster)

Bestiary, Monster Advancement, Adding Racial Hit Dice:

- **Ability scores, Step 3:**
  > For every 4 additional Hit Dice gained by the monster, add 1 to one of its ability scores.

  The count is of *additional* HD added to the base creature. Monster Creation gives no ability increases for a creature's original racial HD. Its scores are set by concept, and the Introduction says they "represent the baseline of its racial modifiers applied to scores of 10 or 11".
- **Skills, Step 4:** "multiply the total number of ranks per Hit Dice gained by a monster of its type times the total number of added Hit Dice". A higher Int modifier applies retroactively to all HD.
- **Hit points.** Average results per die are assumed in stat blocks. The Introduction says: "Creatures with PC class levels receive maximum hit points for their first HD, but all other HD rolls are assumed to be average." Monster Creation says: "Remember that PC class levels provide the maximum number of hit points at 1st level."

### Combining with Class Levels

Bestiary, Monster Advancement, Adding Class Levels, Step 2:

> Next, add the class levels to the monster, making all of the necessary additions to its HD, hit points, BAB, CMB, CMD, feats, skills, spells, and class features. If the creature possesses class features (such as spellcasting or sneak attack) for the class that is being added, these abilities stack. This functions just like adding class levels to a character without racial Hit Dice.

- **Ability adjustments.** The same step gives creatures with PC class levels "+4, +4, +2, +2, +0, and –2 adjustments to their ability scores". This is the Bestiary's elite-array conversion for building NPC monsters. A PC's base scores come from the CRB generation methods instead.
- **Saves are not named.** Step 2 lists HD, hit points, BAB, CMB, CMD, feats, skills, spells and class features, but not saves. Saves combine only by analogy with "just like adding class levels" and the CRB multiclassing rule.

### Monsters as PCs

Bestiary, Monsters as PCs:

> For monsters with racial Hit Dice, the best way to allow monster PCs is to pick a CR and allow all of the players to make characters using monsters of that CR. Treat the monster's CR as its total class levels and allow the characters to multiclass into the core classes. Do not advance such monsters by adding Hit Dice. Monster PCs should only advance through classes.

> If you are including a single monster character in a group of standard characters, make sure the group is of a level that is at least as high as the monster's CR. Treat the monster's CR as class levels when determining the monster PC's overall levels. For example, in a group of 6th-level characters, a minotaur (CR 4) would possess 2 levels of a core class, such as barbarian.

- **For a PC, the racial HD count is fixed by the race.** Only Class Levels advance.
- **A Monster PC's "overall level" is CR + class levels, not HD + class levels.** The minotaur has 6 racial HD and CR 4. This is a level-equivalence for party balance, not a Hit Dice rule. The page also has a catch-up schedule for mixed groups.
- **One sentence has no stated mechanics:** "a few of them are so powerful that they count as having 1 class level, even without a racial Hit Die".

## Findings: official FAQ

- **Hit points and favored class** (CRB FAQ, "Hit Points", September 2010):
  > Creatures whose first Hit Die is from an NPC class (adept, aristocrat, commoner, expert, warrior) or from a racial Hit Die (such as most monsters) do not get maximum hit points for that Hit Die.
  > All creatures with class levels (including those with levels in an NPC class or monsters with class levels) may select a favored class and gain the normal favored class benefits. Creatures never gain favored class benefits for racial Hit Dice.

  The entry's example: "A normal bugbear with 3 racial Hit Dice and no class levels has no favored class and no favored class bonuses, but if that bugbear gained a level in rogue, he could choose "rogue" as his favored class".
- **BAB from racial HD adds normally** (CRB FAQ, "Monk", September 2010):
  > A monk using flurry treats his BAB from monk levels as equal to his monk level. He still adds BAB from other sources (such as other classes or racial Hit Dice) normally to this total.
- **Racial HD follow the creature, not a later type change** (CRB FAQ, "Awaken", October 2010): an awakened animal's type becomes magical beast, but "it doesn't gain all the mathematical benefits for this type change … The 2 HD it gains are d8s, just like its other animal HD."
- **No FAQ entry** covers ability score increases, feat counts, saves, skill ranks or character level for creatures with racial HD.

## Findings: Foundry VTT pf1

### The "racial" class type

- **Shape.** Racial HD are a `class` item with `system.subType: "racial"`, alongside `base`, `prestige`, `npc` and `mythic` (`classTypes` in `module/config.mjs`; `help/en/Items/Classes.md`: "Class item covers base PC classes, NPC classes, racial HD, prestige classes, and mythic paths").
  - `system.level` is the number of racial HD.
  - `system.customHD` can override the HD count with a formula.
- **Fields shared with every class** (`public/template.json` defaults):

  | Field | Meaning | Default |
  | --- | --- | --- |
  | `hd` | Hit Die size | `8` |
  | `hp` | manual hit points total (used when automatic health is off) | `8` |
  | `bab` | `low` / `med` / `high` / `custom` (+ `babFormula`) | `low` |
  | `savingThrows.{fort,ref,will}.value` | `low` / `high` / `custom` (+ `custom` formula) | `low` |
  | `skillsPerLevel` | skill ranks per HD before Int | `0` |
  | `classSkills` | map of skill key → `true` | `{}` |
  | `level` | number of HD | `1` |
  | `changes`, `links.supplements`, `weaponProf` | modifiers, linked monster abilities, proficiencies | empty |

- **BAB.** Each class item computes its own BAB:
  - `classBABFormulas`: `low: floor(@hitDice * 0.5)`, `med: floor(@hitDice * 0.75)`, `high: @hitDice`;
  - the actor sums the per-item values (`actor-pf.mjs`, "Reset BAB").
- **Saves.** `classSavingThrowFormulas.racial` is the same as `base`: `low: floor(@hitDice / 3)`, `high: 2 + floor(@hitDice / 2)`. These are per item, so a racial good save and a class good save each add their own +2.
- **Skill ranks.** The budget is `max(1, skillsPerLevel + Int mod) × hitDice` for each non-mythic class item, racial ones included (`actor-sheet.mjs`, `level-up.mjs`). Mindless actors (Int `null`) get none.
  - Class skills are the union over all class, race and feat items (`_prepareClassSkills`).
  - No per-skill rank cap is enforced.
- **Feats.** `getFeatCount()` gives `ceil(attributes.hd.total / 2)` from total HD, racial included. Mindless actors are skipped.
- **Ability score increases.** The level-up dialog offers one at total HD 4, 8, 12, 16 and 20 (`levelAbilityScores`, keyed on `level.hd.total`). The table stops at 20.
- **Hit Dice and level.** `actor-pf.mjs` sums `hitDice` over all class items into `attributes.hd.total`, but adds `level` into `details.level.value` only for classes that are not `mythic` or `racial`.
  - `help/en/Formulas.md`: "The total hit die the actor has. This is a combination of class levels and racial hit die, and it excludes mythic tiers."
  - The v10.8 changelog: "`@details.level.value` no longer is synonym for HD, but rather actual levels (such as without racial HD and mythic paths)."
- **Favored class.** `favoredClassTypes` is `["base", "prestige", "npc"]`. Racial HD get no favored class bonus to hp or skills, matching the FAQ.
- **XP.** Racial and mythic class items are `xpUnbound`. Their level-up button doesn't wait for XP.
- **Hit points** (`_calculateMaxHealth`):
  - With automatic health on, racial HD get `rate` × die per HD and are processed first. The racial setting `maximized: false` keeps them from being maximized.
  - Racial HD don't use up the maximized-HD count (`maximized: 1`), so the first *PC class* level after racial HD is still maximized. The CRB maximizes only a first Hit Die that is a class level, so this differs from the rules.
  - Automatic health is off by default (`auto: false`), and then the item's `hp` is used as typed.
- **Race items don't record racial HD.** Their fields are `changes`, `classSkills`, `creatureTypes`, `creatureSubtypes`, `languages`, `size`, `speeds`, `weaponProf` and similar. None of the 82 `races` records holds a Hit Dice count. Racial HD live only as a class item on an actor.

### The 13 `racial-hd` records

All 13 have `subType: racial`. A blank cell means the template default applies (hd 8, bab low, saves low):

| Record (`_id`) | `hd` | `bab` | `savingThrows` high | `skillsPerLevel` | Notes |
| --- | --- | --- | --- | --- | --- |
| Aberration `WiROthmRgcwDncDM` | (8) | med | will | 4 | no Knowledge pick |
| Animal `WJqmmfXscPVpcISH` | (8) | med | fort, ref | 2 | |
| Construct `H8FbMUps5Z0gQdvV` | 10 | high | — | 2 | change `max(0, @size - 2) * 10 + max(0, @size - 6) * 10` → `mhp` (size bonus hp) |
| Dragon `X2WLdbFFedaah6VC` | 12 | high | fort, ref, will | 6 | |
| Fey `0jjH2XJVd6dzlaSm` | 6 | (low) | ref, will | 6 | |
| Humanoid `S38eYYsK7pRhPbwg` | (8) | med | ref | 2 | |
| Magical Beast `AjUleVwKSsSaDI4N` | 10 | high | fort, ref | 2 | |
| Monstrous Humanoid `6Uh8PAjR3BE7dult` | 10 | high | ref, will | 4 | |
| Ooze `D1vugd9jeyAQrLVX` | (8) | med | — | 2 | |
| Outsider `cV7yHt8i5YCV0ZTd` | 10 | high | ref, will | 6 | `weaponProf: simple, martial`; no 4 theme skills |
| Plant `AbOSfjvKMqpNihdM` | (8) | med | fort | 2 | |
| Undead `mp1Zmbx0OAzSW4oW` | (8) | med | will | 4 | Cha-for-Con is not on the item |
| Vermin `g3gX00gTvJU478ju` | (8) | med | fort | 2 | |

- **Match.** Every row matches the Bestiary's Hit Die, BAB, good saves and skill ranks.
- **Class skills** match the Bestiary lists. Aberration's "Knowledge (pick one)" and the outsider's 4 theme skills are left to the user.
- **No creature type on the record.** Creature type normally comes from the race item (`creatureTypes`, `creatureSubtypes`). The v11.8 changelog says class items, "notably racial HD", gained type selectors, but none of the 13 records sets one.

### Examples (`basic-monsters` pack)

Each actor embeds a copy of the record, with `level` = HD and `hp` = the stat block's hit points before Con:

- Wolf: Animal, level 2, hp 9, good Fort/Ref.
- Human zombie: Undead, level 2, hp 9.
- Wasp swarm: Vermin, level 7, hp 31.
- Homunculus: Construct, level 2, hp 11.
- Stirge: Magical Beast, level 1.
- Fire beetle: Vermin, level 1.

Humanoid NPCs carry no racial HD item. The goblin and the orc are Warrior 1 (an NPC class) with a race item, which is the 1-HD humanoid exchange.

## Fit with the data model

`docs/pf-character-sheet-data-model.md` (on `feature/pf1-character-builder`) already has `{ kind: 'race'; racialHitDice: number }`, with the note "later: creature-type progression". It defines **Hit Dice** = Class Levels + racial Hit Dice, computed and never stored. Against the findings:

- **Count and level.** The CRB agrees that character level is the count of Class Levels and Hit Dice add racial HD. Foundry agrees too (`details.level.value` versus `attributes.hd.total`).
- **Core races.** 0 racial HD is right for every core race (CRB, Adding NPCs). The 1-HD humanoid exchange means humanoid races like goblin or orc also have 0 racial HD and a class at 1st level.
- **Skill-rank cap.** The cap must read Hit Dice, not character level. The corpus line "total Hit Dice (character level)" conflates the two.
- **Feat count.** It reads Hit Dice (CRB "based off their Hit Dice", Bestiary formula), not character level.
- **Racial HD hit points.** These have no home today. `hpGained` lives on a Class Level, and racial HD aren't Class Levels. Racial HD never get a favored class bonus and are never maximized.
- **Progression.** BAB, saves, skill ranks and class skills from racial HD need the progression fields the class detail already has (`hitDie`, `bab`, `saves`, `skillRanksPerLevel`, `classSkills`).

## Recommendation

- **Keep racial HD on the race, not as Class Levels.** A Monster PC never advances by HD (Bestiary), so the count belongs to the race. Modelling racial HD as Class Levels, as Foundry does, would break "level = number of Class Levels".
- **Extend the race detail with an optional progression** in the class detail's vocabulary. For example: `racialProgression?: { creatureType; hitDie; bab: 'full' | 'threeQuarters' | 'half'; saves; skillRanksPerHitDie; classSkills }`.
  - Seed it from the creature type (the Bestiary table, or the Foundry `racial-hd` records). Allow per-race edits, because good saves "vary" and type features hold "unless otherwise noted".
  - Absent means 0 racial HD, which covers every core race.
- **Resolver.** Emit built-in Modifiers from the progression the same way it does for Class Levels.
  - BAB, base saves and skill ranks are per-source totals that add to the Class Levels' totals.
  - Mindless creatures get no skill ranks or feats.
- **Hit points.** Record racial HD hit points as one plain number on the race sheet entry (for example `racialHpGained: number | null`), never pre-filled. This follows the approved "hit points are a plain number" flow. Never offer a favored class bonus for it.
- **Import.** Foundry race records carry no HD count, so `racialHitDice` imports as 0. The 13 `racial-hd` records are a source for the type defaults, not per-race data. A monster race with racial HD (a Monster PC) is a campaign or character Catalog Copy where the count and progression are set by hand.
- **Militia.** No change. It still reads only the count, and every core race reads 0.
- **Warnings.** Where the text is silent ([open items](#open-items)), don't pick a reading. Make the advisory warnings accept either reading, for example an ability increase at character level 4 *or* at total Hit Dice 4. *Decide which rules checks the builder warns about* (#215) can settle that.

## Open items

Places where the official text is silent or unclear. Nothing here is invented; each needs a ruling or a deliberate "accept either".

1. **Ability score increases once racial HD and class levels mix.** The CRB keys increases to character level, which excludes racial HD. The Bestiary keys them to *additional* racial HD only. The Bestiary's "Adding Class Levels" doesn't mention them. Foundry uses total HD (4, 8, 12, 16, 20). No FAQ.
2. **Ability increases from a race's own racial HD.** Monster Creation sets scores by concept and gives no increases per original HD. The text doesn't say whether a Monster PC with, say, 4 racial HD is owed one.
3. **Feat count: total HD versus per source.** The CRB says "based off their Hit Dice" and the Bestiary formula uses HD, so total HD is the best-supported reading. No text says so for a mixed creature, though, and the CRB table is keyed to character level.
4. **"Character level" prerequisites and effects** (Leadership "Character level 7th", feat DCs using "1/2 your character level"). The CRB defines character level as class levels only, but no text addresses creatures with racial HD.
5. **Saves when combining.** Bestiary "Adding Class Levels" lists no saves, so saves combine only by analogy with the CRB multiclassing rule. That would give two good-save +2s, one from the racial HD and one from the class, as Foundry does.
6. **Class skills for non-humanoid types with class levels.** The union is stated only for humanoids. For the other types it follows from "just like adding class levels" and the CRB multiclass skill rule.
7. **Monster PC level-equivalence.** "Treat the monster's CR as its total class levels" gives an overall level of CR + class levels. That differs from both character level and Hit Dice. It is unclear which one XP, wealth by level and the militia's own level-keyed rules should use. The catch-up schedule and "count as having 1 class level, even without a racial Hit Die" have no further mechanics.
8. **Racial HD hit points when a PC class comes second.** The CRB maximizes only a first Hit Die "for a character class level", so a later first PC level isn't maximized. Foundry's automatic health maximizes it anyway. This doesn't matter while the builder takes hit points as a plain number.
9. **Type changes.** Per the Awaken FAQ, a type change doesn't by itself rewrite racial HD. Templates that change type specify their own changes, and these were not surveyed.
10. **Errata.** Paizo's separate errata documents for the CRB and Bestiary were not checked beyond the errata'd PRD text.
