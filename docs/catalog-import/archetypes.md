# Representative Archetype schedules

The prepared Character Sheet catalog includes Fighter and Rogue feature schedules through class level 20 and two representative Archetypes: Archer and Scout. These specimens exercise feature replacement, independent progression parts, additions, prompts, restoration and the advisory duplicate-feature upgrade. They are not a curated Catalog Release or a claim that either class's feature mechanics and choices are fully implemented.

`convex/lib/representativeClassCatalog.ts` preserves the existing class definition array and exports reference-key schedules. `convex/lib/representativeArchetypeCatalog.ts` supplies every referenced feature plus the Archetypes. Materialization translates class, feature and upgrade keys into real Catalog Entry IDs; `parentFeature` and `part` are durable semantic identities, not document references. Each increment has a separate Grant Key, so retaining one increment never accidentally preserves another.

## Sources and review limits

| Specimen | Book and page | Source reference |
| --- | --- | --- |
| Fighter schedule and abilities | Pathfinder RPG Core Rulebook, pp. 56–57, Table 3–9 | [Paizo PRD Fighter](https://paizo.com/pathfinderRPG/prd/coreRulebook/classes/fighter.html) |
| Rogue schedule and abilities | Pathfinder RPG Core Rulebook, pp. 68–70, Table 3–13 | [Paizo PRD Rogue](https://paizo.com/pathfinderRPG/prd/coreRulebook/classes/rogue.html) |
| Archer | Pathfinder RPG Advanced Player's Guide, p. 104 | [Paizo PRD Fighter Archetypes](https://paizo.com/pathfinderRPG/prd/advancedPlayersGuide/coreClasses/fighter.html) |
| Scout | Pathfinder RPG Advanced Player's Guide, p. 134 | [Paizo PRD Rogue Archetypes](https://paizo.com/pathfinderRPG/prd/advancedPlayersGuide/coreClasses/rogue.html) |
| Feature/part compatibility | Advanced Player's Guide p. 72 and Paizo's 2015 Archetype FAQ | Repository decision #225 and #238 source corpus; [Paizo APG FAQ](https://paizo.com/paizo/faq/v5748nruor1fn) |

These are source references, not a report of live URL verification. Network use is prohibited in the implementation sandbox. The offline pinned Foundry PF1 v11.11 data supplies the base-class and ability descriptions: Fighter `WLqBCT5DqmGAx8Wd`, Rogue `24b0LaabeAlUx5gN`, Uncanny Dodge `7WaQxnVaaoL4AGr8` and Improved Uncanny Dodge `ZfnHhhTFQVo0Lj4P`, among others. Its class associations list first acquisition rather than every printed table increment; the prepared schedules therefore expand those documented progressions.

The pinned pf1-content 11.4.0 checkout contains no Archer or Scout Archetype definitions or their feature descriptions. The Archer and Scout rows here are representative source-reference transcriptions, not claimed extracted records. Its `Hawkeye` record `GG6I9gZr2QTJwL50` is a Druid domain power and is deliberately excluded. A content batch must verify these specimens against the admitted official source text, FAQ and errata, establish attribution/notices, and curate the remaining mechanics before admitting them to a numbered release. No downstream consumer should count these seeds as extracted or reviewed Archetype corpus coverage.

## Complete representative base-class rows

| Class feature | Class levels |
| --- | --- |
| Fighter Bonus Feat | 1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20 |
| Fighter Bravery | 2, 6, 10, 14, 18 |
| Fighter Armor Training | 3, 7, 11, 15 |
| Fighter Weapon Training | 5, 9, 13, 17 |
| Fighter Armor Mastery | 19 |
| Fighter Weapon Mastery | 20 |
| Rogue Sneak Attack | 1, 3, 5, 7, 9, 11, 13, 15, 17, 19 |
| Rogue Trapfinding | 1 |
| Rogue Evasion | 2 |
| Rogue Talent | 2, 4, 6, 8, 10, 12, 14, 16, 18, 20 |
| Rogue Trap Sense | 3, 6, 9, 12, 15, 18 |
| Rogue Uncanny Dodge | 4 |
| Rogue Improved Uncanny Dodge | 8 |
| Rogue Advanced Talents | 10 |
| Rogue Master Strike | 20 |

The Fighter Bonus Feat rows each grant one combat-feat slot. They do not duplicate an ordinary feat slot. Rogue Talent, Weapon Training and Weapon Mastery rows retain their choice prompts; curated option lists remain a content gap. Rogue Advanced Talents broadens the Rogue Talent choices from level 10 rather than granting an additional talent. The progression names describe the total shown on the printed table; no additive numeric Modifier is inferred from an increment label.

The weapon-training rows share a parent but identify separate class-level parts. Paizo's APG FAQ specifically permits replacement of different Weapon Training increments. A whole-parent change conflicts with every affected part. `scope` records this distinction separately from the exact feature-and-level replacement rows.

## Archer application

| Added or altered feature | Acquisition/increment levels | Replaced feature rows |
| --- | --- | --- |
| Hawkeye | 2, 6, 10, 14, 18 | Bravery at each corresponding level |
| Trick Shot | 3, 7, 11, 15, 19 | Armor Training at 3, 7, 11, 15 |
| Expert Archer | 5, 9, 13, 17 | Weapon Training 1 at 5 |
| Safe Shot | 9 | Weapon Training 2 at 9 |
| Evasive Archer | 13, 17 | Weapon Training 3 at 13 |
| Volley | 17 | Weapon Training 4 at 17 |
| Ranged Defense | 19 | Armor Mastery at 19 |
| Weapon Mastery restricted to a bow | 20 | The ordinary Weapon Mastery choice at 20 |

Expert Archer's later increases and Evasive Archer's increase at 17 are additions to their original Archetype abilities. They are not additional replacements of Weapon Training 2–4. The separate replacement rows allow compatibility to report the actual class feature parts touched.

Hawkeye concerns Perception and bow range increments; Trick Shot supplies bow combat-maneuver choices. Expert Archer concerns bow attacks and damage; Safe Shot concerns attacks of opportunity; Evasive Archer concerns defense against ranged attacks; Volley supplies a multi-target bow attack; Ranged Defense replaces Armor Mastery at 19. At 20, Weapon Mastery must name a bow. Trick Shot and the restricted mastery preserve their choice prompts. Numeric bonuses, maneuver restrictions and full combat text await official-text verification and curation. No calculation is inferred from these ability names or the representative increment labels.

## Scout application

At Rogue 4, Scout's Charge replaces Uncanny Dodge: a charge deals sneak attack damage as though the target were flat-footed, except against a target with Uncanny Dodge. At Rogue 8, Skirmisher replaces Improved Uncanny Dodge: moving more than 10 feet permits sneak attack damage as though the target were flat-footed, with the same Uncanny Dodge exclusion; when making multiple attacks it applies only to the first attack. These are two different feature replacements, not a whole alteration of Sneak Attack.

No extracted APG Archetype with class-skill or skill-rank changes and a complete feature schedule is available in this repository's admitted fixture data. The offline pinned content has neither of these Archetype definitions, and the prepared specimens are source-reference transcriptions. A further representative class-skill/rank specimen therefore remains a content-curation gap; synthetic calculation and Convex fixtures exercise those mechanics without inventing an officially extracted schedule.

Scout adds no class skill and changes no skill-rank budget in these representative rows. Structural class-skill additions/removals and rank changes are exercised by explicitly synthetic resolver fixtures rather than falsely attributed to Scout. Neither representative Archetype changes casting or proficiencies. Archetype casting changes belong to #422; proficiency changes remain prose/manual when content supplies them.

Uncanny Dodge records Improved Uncanny Dodge as its source-defined cross-class duplicate upgrade, matching the CRB ability text. The resolver emits an advisory prompt when another class also grants it. It does not remove the originals or silently create the upgrade.

## Retention and coverage

Applying an active Archetype suppresses the exact original Grant rows and adds the acquired Archetype rows across every Class Level of that class. Deactivating it stops additions and replacements, restores original Grants and leaves edited inactive Grants in the existing dormancy mechanism. The base class identity, HP, base attack and saves remain those of Fighter or Rogue.

Wizard and Cleric remain the earlier representative progression/casting specimens with no newly curated feature schedule in this ticket. Broader Archetype coverage, curated ability Modifiers, option definitions and all content admission work remain with the content batches. Preparing a Character with these bounded seeds does not activate or publish a Catalog Release.
