# PF1 Core Rules for Character Building

Rules reorganized by topic for the Pathfinder 1e character builder (map #201). Numbers live in `pf1-tables.md`; this file holds procedures, formulas, and edge cases. Rules are paraphrased, not quoted at length.

Source key: **CRB** = Core Rulebook via the Pathfinder Reference Document (PRD). Paizo's `paizo.com/pathfinderRPG/prd/...` URLs 301-redirect to the `legacy.aonprd.com/...` mirror, which is the URL cited per section. **AoN** = Archives of Nethys, `https://www.aonprd.com`. Retrieved 2026-10-01.

## Scope

- Core Rulebook only (PF1). Core races and the 11 core classes.
- Variants (Pathfinder Unchained fractional bonuses, APG racial favored-class bonuses, traits, alternate racial traits) are out of scope. See `README.md` gaps.
- General rounding rule: always round down unless stated otherwise. Source: https://legacy.aonprd.com/coreRulebook/gettingStarted.html (Common Terms: Rounding).

## Topic: Character Creation Steps

Source: https://legacy.aonprd.com/coreRulebook/gettingStarted.html (Generating a Character); AoN https://www.aonprd.com/Rules.aspx?Name=Character%20Creation&Category=Basics

1. Determine ability scores (see "Ability Score Generation").
2. Pick race: apply racial ability modifiers after generation; note languages, size, speed, racial traits. Bonus languages = Int modifier.
3. Pick class: a new character starts at 1st level in one class.
4. Pick skills and feats: compute skill ranks from class + Int modifier (+ racial bonuses); spend them, with max ranks per skill = character level (1 at 1st level). Then pick feats granted by class and level.
5. Buy equipment: starting gold by class (see tables); no magic items without GM consent; plus an outfit worth up to 10 gp.
6. Finishing details: derive starting hp, AC, saves, initiative, attack values; choose name, alignment, appearance. Favored class is chosen at creation (see "Favored Class").

## Topic: Ability Score Generation

Source: https://legacy.aonprd.com/coreRulebook/gettingStarted.html; AoN https://www.aonprd.com/Rules.aspx?Name=Ability%20Scores&Category=Basics

- Six scores: Str, Dex, Con, Int, Wis, Cha. Typical range 3-18 before racial changes; average 10.
- Racial modifiers are applied after generation, in every method.
- Methods: Standard (4d6 drop lowest), Classic (3d6), Heroic (2d6+6), Dice Pool (24d6, or 28d6 high-powered; min 3d6 each; keep top three dice), Purchase (point buy). Details in `pf1-tables.md`.
- Point buy ("Purchase"):
  - All scores start at 10; spend points to raise, reduce a score to gain points.
  - No score below 7 or above 18 before racial modifiers.
  - Budget by campaign type: Low 10, Standard 15 (the default), High 20, Epic 25. Average NPCs use about 3.
  - Total cost = sum of per-score costs from the cost table; a legal build has total cost <= budget (the CRB phrasing is "spend all points", it does not forbid leaving points unspent, see README ambiguities).
  - Point buy is "typically used for organized play" (Pathfinder Society).
- Racial adjustments listed in `pf1-tables.md` (Core Races).

## Topic: Ability Modifiers

Source: https://legacy.aonprd.com/coreRulebook/gettingStarted.html (Determine Bonuses)

- Modifier = floor((score - 10) / 2). Scores 10-11 give +0; each 2 above 11 adds +1; each 2 below 10 subtracts 1. The source text says modifiers range -5 to +5, but its table continues upward (+5 at 20-21 through +17 at 44-45).
- A positive modifier is a "bonus", a negative one a "penalty" (it behaves as a typeless value, see stacking).
- What each ability modifies:
  - Str: melee attack, melee/thrown damage (off-hand 1/2 Str bonus, two-handed 1-1/2x Str bonus), Climb, Swim, Str checks, CMB (Small or larger), CMD, carrying capacity.
  - Dex: ranged attack, AC (if the character can react), Reflex saves, initiative, Acrobatics, Disable Device, Escape Artist, Fly, Ride, Sleight of Hand, Stealth, CMB (Tiny or smaller), CMD.
  - Con: hp per Hit Die, Fortitude saves.
  - Int: bonus languages, skill ranks per level (minimum 1 rank per level), Appraise, Craft, Knowledge, Linguistics, Spellcraft; wizard bonus spells.
  - Wis: Will saves, Heal, Perception, Profession, Sense Motive, Survival; cleric/druid/ranger bonus spells.
  - Cha: Bluff, Diplomacy, Disguise, Handle Animal, Intimidate, Perform, Use Magic Device; bard/paladin/sorcerer bonus spells.
- Casting requirement: casting ability score must be at least 10 + spell level.
- Temporary vs permanent ability changes (Glossary / Conditions: Ability Score Bonuses): temporary increases (duration <= 1 day) give a temporary bonus per 2 points to the related skills and stats; a Con increase adds (total Hit Dice x bonus) temporary hp. Permanent increases (e.g. level-up, inherent bonuses) change the score and all derived stats. Source: https://legacy.aonprd.com/coreRulebook/glossary.html

## Topic: Character Advancement (Level-Up)

Source: https://legacy.aonprd.com/coreRulebook/classes.html (Character Advancement); AoN https://www.aonprd.com/Rules.aspx?Name=Character%20Advancement&Category=Basics

- A character levels up as soon as XP reaches the threshold for the chosen XP track (Slow / Medium / Fast), typically at the end of a session. Thresholds are in `pf1-tables.md`.
- Level-up cannot change ability scores, race, or previous class/skill/feat choices (it adds, not rewrites).
- Order of operations when adding a level (existing or new class):
  1. Select the new class level; you must qualify before any adjustments.
  2. Apply any ability score increase for the new character level.
  3. Integrate class abilities and roll for additional hp.
  4. Add new skill ranks and feats.
- Level-dependent bonuses by CHARACTER level (not class level):
  - Feats: 1st-level feat plus one more at every odd level (3, 5, 7, ... 19), total 10 at 20th level.
  - Ability score: +1 to one ability score of your choice at levels 4, 8, 12, 16, 20 (permanent). AoN wording: "a permanent +1 increase to one ability score of your choice".
  - Classes also grant bonus feats separately; humans get one extra feat at 1st level; half-elf gets Skill Focus at 1st level.
- Prerequisites and effects keyed to "level" or "Hit Dice" use total character level; class abilities use class level (see Multiclassing).

## Topic: Hit Points

Sources: https://legacy.aonprd.com/coreRulebook/gettingStarted.html (Common Terms: Hit Points; Constitution), https://legacy.aonprd.com/coreRulebook/classes.html (Favored Class), https://legacy.aonprd.com/coreRulebook/feats.html (Toughness)

- Each class has a Hit Die type (d6/d8/d10/d12, see tables). Each character level adds one Hit Die of that level's class.
- First character level: take MAXIMUM hit points on the die (first Hit Die from a character class level). NPC-class or racial first HD roll normally.
- Later levels: roll the class's Hit Die. The CRB specifies rolling; it does not define an "average" option (see README ambiguities).
- Con modifier is added to every Hit Die roll. A Con penalty can never push a level's hp gain below 1 (at least 1 hp per level gained).
- If Con modifier changes (permanent change), hp change retroactively across all Hit Dice.
- Favored class: +1 hp per level in the favored class instead of +1 skill rank (chosen per level).
- Toughness feat: +3 hp, plus +1 per Hit Die beyond 3.
- Formula (build time):

  hp_total = sum over levels of max(1, hit_die_result + Con_mod) + favored_class_hp_levels + Toughness + other

  with the level-1 hit_die_result = the die's maximum.
- Dying thresholds (not part of the build but part of the hp rule): unconscious below 0 hp, dead when negative total equals Con score.

## Topic: Class Progression Shape (BAB, Saves)

Sources: class pages `https://legacy.aonprd.com/coreRulebook/classes/<class>.html`; formulas cross-checked with https://legacy.aonprd.com/bestiary/monsterCreation.html (Table: Statistics Summary) and https://legacy.aonprd.com/advancedClassGuide/designingClasses.html

- Three BAB progressions:
  - Fast ("good"): BAB = class level. Barbarian, fighter, paladin, ranger. Hit die d10 (barbarian d12).
  - Medium ("average"): BAB = floor(3 x level / 4). Bard, cleric, druid, monk, rogue. Hit die d8.
  - Slow ("poor"): BAB = floor(level / 2). Sorcerer, wizard. Hit die d6.
- Two save progressions:
  - Good: base save = 2 + floor(level / 2).
  - Poor: base save = floor(level / 3).
  - Which saves are good per class: see "Core Class Summary" in `pf1-tables.md`. The monk is the only class with all three good.
- The two formula sets are derived from the published tables (CRB class tables and the Bestiary summary table); the CRB does not print the closed forms.
- Iterative attacks: extra attacks at BAB +6, +11, +16 (each at -5 cumulative). Source: Common Terms, https://legacy.aonprd.com/coreRulebook/gettingStarted.html

## Topic: Multiclassing and Favored Class

Source: https://legacy.aonprd.com/coreRulebook/classes.html (Multiclassing; Favored Class)

- Instead of the next level in the current class, a character can take 1st level in a new class and gain its 1st-level features.
- Character level = sum of all class levels. Class level = levels in that class. Example in source: fighter 5 + wizard 1 is character level 6.
- Hit points, BAB and base saves from each class level are ADDED to the existing totals (BAB and each save accumulate separately per class level; for example, derived from the tables: two classes that each have a good Fortitude save contribute +2 at their own 1st level, and the contributions add). The class page tables give each class's contribution by class level.
- Effects/prerequisites keyed to level or Hit Dice use TOTAL levels; class abilities use LEVELS IN THAT CLASS.
- No general multiclass prerequisites exist in the CRB; the new class's own entry requirements apply (alignment: barbarian nonlawful, monk any lawful, paladin lawful good, druid any neutral, cleric within one step of the deity's).
- Skill ranks per level, hit die, and class skills come from the class whose level is taken (see Skills). Class skills accumulate; the +3 does not stack across classes.
- Favored class:
  - One favored class chosen at creation (usually the 1st-level class); cannot be changed. Half-elves choose two (Multitalented).
  - Each level taken in the favored class (including 1st) gives +1 hp OR +1 skill rank. The choice is made per level and is fixed once made.
  - Prestige classes can never be favored. (Source: Favored Class section; the CRB does not list racial favored-class bonuses, those are from the APG.)

## Topic: Skills (Ranks, Class Skills, Totals)

Sources: https://legacy.aonprd.com/coreRulebook/usingSkills.html, https://legacy.aonprd.com/coreRulebook/skillDescriptions.html

- Skill ranks per level = class base (2/4/6/8, in `pf1-tables.md`) + Int modifier, minimum 1 per level. Humans +1 rank per level (including 1st). Favored class level: option of +1 rank.
- Retroactive Int changes: Int changes change ranks; rule text is in the Ability Score Bonuses section of the glossary (permanent increases modify "all skills and statistics related to that ability", including skill points).
- Max ranks in any skill = total Hit Dice (character level). At 1st level that is 1.
- Each rank gives +1 on checks.
- Class skills: +3 bonus on a class skill ONLY if you have at least 1 rank in it. Multiple classes granting the same class skill do not stack: the bonus stays +3. When you gain a level in a new class, its class skills join your class-skill list.
- Skill total = d20 + ranks + key-ability modifier + class-skill 3 (if ranked class skill) + racial/size/feat/item/spell modifiers - armor check penalty (Str/Dex skills).
  - Untrained: only ability modifier (and misc); trained-only skills cannot be used with 0 ranks.
  - Take 10 and take 20 apply; see the source if needed.
- Armor check penalty: applies to all Str- and Dex-based skill checks (marked `*` in the skill table). A suit's penalty and a shield's penalty both apply. Encumbrance can also impose a check penalty; use the worse of armor and load, not both. Nonproficient armor or shield also gives its penalty to attack rolls and Str/Dex ability checks. Masterwork armor reduces the penalty by 1. Sources: https://legacy.aonprd.com/coreRulebook/equipment.html, https://legacy.aonprd.com/coreRulebook/additionalRules.html

## Topic: Bonus Types and Stacking

Sources: https://legacy.aonprd.com/coreRulebook/gettingStarted.html (Common Terms: Bonus, Penalty, Stacking), https://legacy.aonprd.com/coreRulebook/magic.html (Bonus Types; Combining Magic Effects), https://legacy.aonprd.com/coreRulebook/combat.html (Armor Class, Combat Maneuver Defense), https://legacy.aonprd.com/coreRulebook/equipment.html (Armor)

- Most bonuses have a type. Bonuses of the same type do not stack: only the highest applies. Exceptions explicitly named in the CRB: dodge bonuses, most circumstance bonuses, and racial bonuses stack.
- Bonuses of different types stack.
- Untyped bonuses (no type) always stack with everything, EXCEPT when they come from the same source.
- Same effect more than once (e.g. identical spell at different strengths): only the strongest applies. The same spell cast again with differing results: the last in the series trumps the earlier ones.
- Penalties:
  - Common Terms: penalties have no type and most stack.
  - Magic Basics: same-type penalties apply only the worst one, "although most penalties have no type and thus always stack".
  - Builder rule of thumb: treat untyped penalties as stacking; if a typed penalty is ever modelled, apply only the worst of a given type.
- Bonuses and penalties stack with each other (penalties offset bonuses).
- Armor-specific: an armor bonus does not stack with other armor-bonus sources; a shield bonus does not stack with other shield-bonus sources. Enhancement bonuses on armor add to the armor bonus of that armor.
- Dodge bonuses are lost whenever the character loses his Dexterity bonus to AC (flat-footed, helpless, etc.); armor does not limit dodge bonuses.
- Multipliers: multiple multipliers on one roll combine additively (x2 and x2 = x3). Source: Common Terms (Multiplying).
- Type catalogue and examples: see "Bonus Types and Stacking" in `pf1-tables.md`.
- Note: the CRB never prints a consolidated list of bonus types, and which "circumstance" bonuses do not stack is not enumerated. Builder implementation should keep the type per modifier and make the stacking exception an attribute of the type (dodge, racial, circumstance = stack) with a same-source guard for untyped.

## Topic: Hit Points, BAB, Saves, Initiative (Derived Stat Formulas)

Sources: https://legacy.aonprd.com/coreRulebook/combat.html, https://legacy.aonprd.com/coreRulebook/gettingStarted.html

- Hit points: see "Hit Points".
- BAB = sum over class levels of that class's BAB contribution (fast = level, medium = floor(3L/4), slow = floor(L/2)), per class level.
- Saving throw modifier = base save + ability modifier (+ misc). Ability: Fortitude = Con, Reflex = Dex, Will = Wis. Base save = sum of per-class base saves by class level (good = 2 + floor(L/2), poor = floor(L/3)). Natural 1 always fails, natural 20 always succeeds.
- Initiative check = d20 + Dex modifier + misc (Improved Initiative +4). It is a Dex check. Ties: higher total initiative modifier acts first, then roll.
- Melee attack = BAB + Str mod + size modifier. Ranged attack = BAB + Dex mod + size modifier + range penalty.

## Topic: Armor Class (Normal, Touch, Flat-Footed)

Source: https://legacy.aonprd.com/coreRulebook/combat.html (Armor Class; Initiative: Flat-Footed; Touch Attacks)

- AC = 10 + armor bonus + shield bonus + Dex modifier + size modifier + natural armor + deflection + dodge + other modifiers.
  - Dex modifier is capped by armor's Max Dex bonus and by encumbrance (medium load +3, heavy +1); use the lower cap. If a Dex bonus would be reduced to 0 by armor, this does NOT count as losing the Dex bonus.
  - If you lack a Dex bonus (0 or negative), losing "your Dexterity bonus" changes nothing; a Dex penalty still applies.
  - Size modifier by size category (Small +1, Large -1 ...), see `pf1-tables.md`.
  - Enhancement bonuses on armor/shield are part of that armor/shield's bonus.
- Touch AC: AC with armor bonus, shield bonus, and natural armor bonus removed. Size, Dex, deflection, dodge and others still apply. Touch AC = 10 + Dex mod (capped) + size + deflection + dodge + other non-armor/non-shield/non-natural bonuses. (Incorporeal touch attacks additionally ignore cover bonuses but not force-effect armor bonuses such as mage armor.)
- Flat-footed AC: AC without the Dex bonus (and without dodge bonuses, since dodge bonuses are denied when Dex bonus is denied). Flat-footed AC = 10 + armor + shield + size + natural armor + deflection + other non-dodge bonuses (a Dex PENALTY still applies). A creature is flat-footed before its first turn in combat; uncanny dodge prevents it.
- Condition effects on AC exist (blinded, cowering, stunned: -2 AC and lose Dex bonus; prone: -4 melee / +4 ranged; etc.) in the Conditions appendix, https://legacy.aonprd.com/coreRulebook/glossary.html
- Fighting defensively: -4 attack, +2 dodge AC. Total defense: +4 dodge AC (not combinable with fighting defensively). Source: combat.html.

## Topic: Combat Maneuver Bonus and Defense

Source: https://legacy.aonprd.com/coreRulebook/combat.html (Combat Maneuvers)

- CMB = BAB + Str modifier + special size modifier. Tiny or smaller use Dex instead of Str.
- CMD = 10 + BAB + Str modifier + Dex modifier + special size modifier.
- CMD also adds circumstance, deflection, dodge, insight, luck, morale, profane and sacred bonuses to AC. Any penalties to AC also apply to CMD. A flat-footed creature does not add Dex bonus to CMD.
- Special size modifiers: Small -1, Large +1 (reverse sign vs. the AC table); see `pf1-tables.md`.

## Topic: Size

Sources: combat.html (Size Modifiers, CMB), skills pages (Stealth, Fly), additionalRules.html (Carrying Capacity)

- Size categories: Fine, Diminutive, Tiny, Small, Medium, Large, Huge, Gargantuan, Colossal.
- Core PC races are Medium or Small. Small: +1 size modifier to AC and attack, -1 to CMB/CMD, +4 Stealth, carrying capacity x3/4 (biped).
- Four separate size tables exist: AC/attack, CMB/CMD, Stealth/Fly skill modifiers, carrying capacity multipliers. All in `pf1-tables.md`.

## Topic: Carrying Capacity and Armor Encumbrance

Source: https://legacy.aonprd.com/coreRulebook/additionalRules.html (Carrying Capacity); https://legacy.aonprd.com/coreRulebook/equipment.html (Armor)

- Two independent encumbrance sources: armor (Max Dex, check penalty, speed, run) and total carried weight (light/medium/heavy load). Use the worse figure per category; penalties do not stack.
- Compare total weight of all gear (armor, weapons, items) to the Strength row of the carrying capacity table. Light load: no effect. Medium or heavy load: Max Dex +3/+1, check penalty -3/-6, speed 30 -> 20 (20 -> 15), run x4/x3. A medium or heavy load counts as medium or heavy armor for effects restricted by armor.
- Maximum load = top of the Heavy column for the Str score. Lift overhead = max load, off ground = 2x, push/drag = 5x.
- Scores above 29: take the matching ones-digit row from 20-29 and multiply by 4 per 10 points above it.
- Size multipliers for bipeds and quadrupeds in `pf1-tables.md`.
- Dwarves: base speed 20 ft. never reduced by armor or encumbrance.

## Topic: Race (Scope Note)

Source: https://legacy.aonprd.com/coreRulebook/races.html

- Seven core races: dwarf, elf, gnome, half-elf, half-orc, halfling, human. Racial ability modifiers, size and speed are in `pf1-tables.md`.
- Flexible +2 (half-elf, half-orc, human) goes to one ability of the player's choice at creation.
- Full racial trait lists (darkvision, weapon familiarity, skill bonuses, languages) are not transcribed. They are required for a complete builder but are separate content from the rules in this corpus.

## Edge Cases and Ambiguities

- Point-buy leftover points: the CRB says characters "spend" points; it does not state whether leftover points may be unspent. Common treatment: total cost <= budget.
- Hit points beyond level 1: only rolling is defined; fixed-average conventions are not in the CRB.
- Retroactive Con: the CRB says hp change when the Con modifier changes enough; it does not spell out how the "at least 1 hp per level" floor interacts with a retroactive recalculation.
- Circumstance bonus stacking: the CRB says "most" stack without listing exceptions.
- Typed penalties: Common Terms says penalties have no type; Magic Basics describes same-type penalties not stacking. Practical resolution above.
- Fractional BAB/saves: when multiclassing, the CRB tables add whole-number class contributions. The Unchained fractional option (which avoids rounding loss) is a variant, not CRB.
- Starting wealth is rolled in the CRB; "average" values are listed alongside.
- "Knowledge (all)" appears in bard/wizard class text, the PRD skill matrix lists each Knowledge skill separately; they agree.
