# PF1 Archetype, Prestige Class, Favored Class, Trait and Unchained Rules

Rules text admitted by [Set the coverage bar for archetypes and prestige classes](https://github.com/AndreasUnunger/EverythingPath/issues/219), collected for [#225](https://github.com/AndreasUnunger/EverythingPath/issues/225) (map #201). Numbers and the Unchained inventory live in `pf1-tables.md`. Unlike `docs/ai/pf1-core-rules/` (branch `research/pf1-core-rules`), every rule here is **quoted exactly**, because the ticket asks for the official wording.

Retrieved 2026-10-01. Source policy, source keys and page-number provenance are in `README.md`. Short form used below: **APG** = *Advanced Player's Guide*, **CRB** = *Core Rulebook*, **UC** = *Ultimate Campaign*, **PU** = *Pathfinder Unchained*. "FAQ" entries are Paizo's official FAQ pages; the anchor is given so the entry can be opened directly.

Conventions:

- `> "..."` blocks and inline quotes are verbatim official text.
- **Reading:** marks a conclusion drawn from quoted text, without adding a rule.
- **Open:** marks a point where the official text is silent, ambiguous or contradictory. Open items give no answer. All open items are collected at the end.

## Topic: Archetypes (APG)

Source: APG p. 72, "Alternate Class Features" and "Core Class Archetypes". PRD http://paizo.com/pathfinderRPG/prd/advancedPlayersGuide/advancedCoreClasses.html; page from https://www.aonprd.com/Rules.aspx?Name=Archetypes&Category=Character+Creation (same wording).

### Choosing an archetype

> "Most of the options presented on the following pages include a host of alternate class features. When a character selects a class, he must choose to use the standard class features found in the Core Rulebook or those listed in one of the archetypes presented here."

> "The core class archetypes that follow are included in this chapter. Characters may take more than one archetype if they meet the requirements."

- **Reading:** the choice is made "When a character selects a class". The APG prints no procedure for adding an archetype at a later level of that class. **Open (A1).**
- The APG names "requirements" but defines no requirement format. Race requirements appear in FAQ answers (below). What happens if a requirement stops being met is not stated. **Open (A7).**

### Replacing class features

> "Each alternate class feature replaces a specific class feature from its parent class. For example, the elemental fist class feature of the monk of the four winds replaces the stunning fist class feature of the monk. When an archetype includes multiple class features, a character must take all of them—often blocking the character from ever gaining certain familiar class features, but replacing them with equally powerful options. All of the other class features found in the core class and not mentioned among the alternate class features remain unchanged and are acquired normally when the character reaches the appropriate level (unless noted otherwise). A character who takes an alternate class feature does not count as having the class feature that was replaced when meeting any requirements or prerequisites."

- An archetype is all-or-nothing: "a character must take all of them".
- Unmentioned class features stay and arrive at their normal levels "(unless noted otherwise)".
- A replaced feature does not count for any requirement or prerequisite.

### Taking several archetypes

> "A character can take more than one archetype and garner additional alternate class features, but none of the alternate class features can replace or alter the same class feature from the core class as another alternate class feature. For example, a paladin could not be both a hospitaler and an undead scourge since they both modify the smite evil class feature and both replace the aura of justice class feature. A paladin could, however, be both an undead scourge and a warrior of the holy light, since none of their new class features replace the same core class feature."

The APG uses "replace", "alter" and "modify" here but defines none of them.

### FAQ: what counts as altering, and sub-features

FAQ APG, "Archetype Stacking and Altering" (posted June 2015), https://paizo.com/paizo/faq/v5748nruor1fn#v5748eaic9thg:

> "In general, if a class feature grants multiple subfeatures, it's OK to take two archetypes that only change two separate subfeatures. This includes two bard archetypes that alter or replace different bardic performances (even though bardic performance is technically a single class feature) or two fighter archetypes that replace the weapon training gained at different levels (sometimes referred to as "weapon training I, II, III, or IV") even though those all fall under the class feature weapon training. However, if something alters the way the parent class feature works, such as a mime archetype that makes all bardic performances completely silent, with only visual components instead of auditory, you can't take that archetype with an archetype that alters or replaces any of the sub-features. This even applies for something as small as adding 1 extra round of bardic performance each day, adding an additional bonus feat to the list of bonus feats you can select, or adding an additional class skill to the class. As always, individual GMs should feel free to houserule to allow small overlaps on a case by case basis, but the underlying rule exists due to the unpredictability of combining these changes."

- Sub-features of one class feature (separate bardic performances, weapon training at different levels) may be changed by different archetypes.
- An archetype that changes how the whole parent feature works conflicts with any archetype that touches any of its sub-features.
- The FAQ lists "adding an additional class skill to the class" as such a change, but does not say which parent class feature a class-skill change belongs to. **Open (A3).**
- No official list says which class features have sub-features beyond the two examples. **Open (A4).**
- "individual GMs should feel free to houserule to allow small overlaps" is a GM override, not a rule.

### FAQ: APG archetypes never say "alters"

FAQ APG, "Monk ki mystic archetype" (posted June 2015), https://paizo.com/paizo/faq/v5748nruor1fn#v5748eaic9tig:

> "No. When Advanced Player's Guide was written, archetypes were new and the "this alters" language didn't exist yet, meaning archetypes in this book, including ki mystic, never include it, even when they should by current standards. The ki mystic ability alters ki pool. At 3rd level, a ki mystic gets a ki pool of Wisdom modifier points that can be used for the abilities listed in the archetype. At level 4, this upgrades to a ki pool of 1/2 monk level + Wisdom modifier + 2 points, which is a single ki pool (the ki mystic does not gain two) that can be used in all the usual ways a monk can use ki, plus those mentioned in the archetype."

- **Reading:** for APG archetypes, whether a feature "alters" another cannot be taken from the printed words "This ability alters ..."; it has to be read from each ability's prose. **Open (A2).**

### FAQ: when you have a class feature (partial and delayed replacement)

FAQ CRB, "When do I count as having a class feature?" (posted July 2013), https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9qt8:

> "You have a class feature when your class description tells you you gain that class feature, generally based on your level in that class (and perhaps altered by factors, see below).
> If you have an archetype or other rules element that replaces that class feature, you do not have that class feature. For example, if your archetype replaces a rogue's sneak attack, you no longer have the sneak attack class feature (whether a requirement is as general as "sneak attack" or as specific as "sneak attack +1d6," you do not qualify for it).
> If you have an archetype or other rules element that replaces part of a scaling class feature, or delays when you get that class feature, you do not have that class feature until you actually gain that class feature.
> Example: If you have a fighter archetype that replaces weapon training 1 (but not weapon training 2, 3, and 4), you don't gain the weapon training 2 ability until fighter level 9, which means you don't have the weapon training class ability at all until you reach fighter level 9. Anything with "weapon training" or "weapon training class feature" as a prerequisite is unavailable to you until level 9.
> Example: If you have a cleric archetype that replaces channel energy at level 1 (but not later increments of channel energy), you don't gain the channel energy ability until cleric level 3, which means you don't have the channel energy class feature until you reach cleric level 3. Anything with "channel energy" or "channel energy class feature" as a prerequisite is unavailable to you until level 3.
> Example: If you have a witch archetype that replaces your hex at level 1 (but not later hexes, major hexes, or grand hexes), you don't gain your first hex ability until witch level 2, which means you don't have the hex class feature until you reach witch level 2. Anything with "hex" or "hex class feature" as a prerequisite is unavailable to you until level 2."

- This confirms replacement per level row: replacing "weapon training 1" leaves weapon training 2, 3 and 4.
- The FAQ says when the feature is first held, but not what the later increment's value is (for example, the weapon training bonus at fighter level 9 when weapon training 1 was replaced). **Open (A5).**

### FAQ: does an archetype ability count as the ability it replaced?

FAQ CRB, "Archetype" (posted July 2013), https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9qto:

> "It depends on how the archetype's ability is worded. If the archetype ability says it works like the standard ability, it counts as that ability. If the archetype's ability requires you to make a specific choice for the standard ability, it counts as that ability. Otherwise, the archetype ability doesn't count as the standard ability. (It doesn't matter if the archetype's ability name is different than the standard class ability it is replacing; it is the description and game mechanics of the archetype ability that matter.)"

The entry's examples are the dragoon's "spear training" (counts as weapon training) and the archer's "expert archer" (does not). Deciding which case applies takes a judgment for each archetype ability. **Open (A9).**

### FAQ: race requirements on archetypes

FAQ APG, "Racial Heritage" (posted July 2012), https://paizo.com/paizo/faq/v5748nruor1fn#v5748eaic9pka:

> "Yes, the Racial Heritage feat allows you to qualify for archetypes that have the chosen race as a requirement, assuming you still meet all of the other requirements to take levels in the archetype."

FAQ CRB, "Half-Elf or Half-Orc" (posted March 2013, edited 9/26/13), https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9qf9 (the same answer appears in the APG FAQ, https://paizo.com/paizo/faq/v5748nruor1fn#v5748eaic9r7c):

> "Yes. Half-elves and half-orcs may select racial favored class options, archetypes, traits, and so on, as if they were a full member of both races (a half-elf can select elf and human rules elements, a half-orc can select human and orc rules elements).
> Edit 9/26/13: This is a reversal of an earlier ruling. This resolves a discrepancy between this FAQ and two Advanced Player's Guide FAQs."

### Class-specific limits printed in the same chapter

APG p. 72, "Core Class Archetypes" list:

> "Sorcerer: ... Unlike other alternate class features, a sorcerer may never have more than one bloodline."

> "Cleric: Instead of specific archetypes, each cleric can choose from a host of subdomains that focus on one aspect of their deity's power."

### Adapting existing characters (GM guidance)

APG p. 72, "Adapting Existing Characters" (excerpt):

> "Players with existing characters should talk with their GM about whether on not these alternate class features are available in her game, and if so, whether they can recreate their characters to adopt them."

> "Typically, the best time for a player to adopt alternate class features and significantly revise his character is when leveling up between adventures, though he should always check with the GM before doing so, as she may wish to work significant changes to a character into the campaign."

This is advice to the GM about rebuilding, not a rule for adding an archetype part-way through a class.

### Archetypes and the unchained classes

PU ch. 1 introduction (PRD http://paizo.com/pathfinderRPG/prd/unchained/classes/index.html; page not verified):

> "These classes can be used alongside their original counterparts (although individual characters must use one version or the other exclusively). Some feats, rage powers, rogue talents, and other rules might not work with the unchained classes, and such rules should be reviewed before being used with the new versions. Finally, with the exception of the monk, these classes should work with any of the archetypes from previous books as long as the classes still have the appropriate class features to replace."

- Archetypes from earlier books work with the unchained barbarian, rogue and summoner, provided the features they replace still exist.
- The unchained monk is excluded. The text does not say whether any earlier monk archetype may still be used with it. **Open (A8).**

## Topic: Prestige Classes (CRB)

Source: CRB p. 374, "Prestige Classes". PRD http://paizo.com/pathfinderRPG/prd/coreRulebook/prestigeClasses.html; page and the longer printed wording from https://aonprd.com/Rules.aspx?Name=Prestige%20Classes&Category=Character%20Advancement.

### Requirements and entry

> "Prestige classes allow characters to become truly exceptional, gaining powers beyond the ken of their peers. Unlike the core classes, characters must meet specific requirements before they can take their first level of a prestige class. If a character does not meet the requirements for a prestige class before gaining any benefits of that level, that character cannot take that prestige class. Characters that take levels in prestige classes do not gain any favored class bonuses for those levels."

The printed book (as reproduced on AoN) continues; the PRD omits these sentences:

> "This chapter presents 10 prestige classes for you to choose from, and other prestige classes appear in other Pathfinder products. Some prestige classes are quite focused and heavy on flavor that might not be compatible with your campaign—consult with your GM before you start to work toward qualifying for a prestige class to make sure that the class is allowed"

(AoN prints no full stop after "allowed".)

Each prestige class states its requirements in its own entry, for example the dragon disciple: "To qualify to become a dragon disciple, a character must fulfill all the following criteria." (PRD http://paizo.com/pathfinderRPG/prd/coreRulebook/prestigeClasses/dragonDisciple.html).

### Order of operations when the level is taken

CRB p. 30, "Advancing Your Character" (PRD http://paizo.com/pathfinderRPG/prd/coreRulebook/classes.html; the CRB FAQ calls the advancement table and its text "page 30"):

> "When adding new levels of an existing class or adding levels of a new class (see Multiclassing, below), make sure to take the following steps in order. First, select your new class level. You must be able to qualify for this level before any of the following adjustments are made. Second, apply any ability score increases due to gaining a level. Third, integrate all of the level's class abilities and then roll for additional hit points. Finally, add new skills and feats."

- **Reading:** requirements are checked against the character as they stand before the new level. Anything gained at that level, such as an ability increase, feat or skill ranks, cannot be used to qualify. This agrees with the p. 374 wording "before gaining any benefits of that level".
- **Reading:** the CRB requires the requirements "before they can take their first level of a prestige class". It says nothing about later prestige levels, and nothing about keeping the requirements once the character has entered. **Open (P1).**

### Mid-career entry

The CRB has no rule on entering a prestige class at a given character level. The only gates are the class's requirements, which in practice need several levels to meet, and the GM consultation sentence above. **Reading:** nothing beyond the requirements needs encoding. Retraining into or out of a prestige class is out of scope (#219), but the Ultimate Campaign FAQ below is quoted because it states a general principle.

FAQ UC, "Retraining: Can I retrain out of my base classes and use my prestige class levels to meet the requirements for that prestige class?" (posted October 2013), https://paizo.com/paizo/faq/v5748nruor1gn#v5748eaic9r9e:

> "No.
> The retraining rules say, "If retraining a class level means you no longer qualify for a feat, prestige class, or other ability you have, you can't use that feat, prestige class, or ability until you meet the qualifications again." Therefore, if you retrain out of the base class and that causes you to no longer meet the requirements of the prestige class, you no longer have access to the class features from that prestige class, and therefore can't use that prestige class to meet the requirements of anything (including itself).
> Update 10/16/13: In any case, you cannot use rule elements from a prestige class to meet the requirements of that prestige class.
> Update 10/16/13: New ruling: You cannot use retraining to replace a base class level with a prestige class level."

- General rule from this FAQ: "you cannot use rule elements from a prestige class to meet the requirements of that prestige class."
- The "can't use ... until you meet the qualifications again" sentence quotes the UC retraining rules, so it covers retraining only. The CRB has no equivalent for other ways of losing a requirement, such as an alignment change, ability drain or a lost feat. **Open (P1).**

### FAQ: meeting numeric requirements

FAQ CRB, "Prestige Class Requirements" (posted February 2015), https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9r95:

> "Yes, because skill ranks are inclusive: if you have 6 ranks in a skill, then you have 5 ranks in that skill, and therefore meet the "have 5 ranks in [this] skill" requirement.
> In the same way, if you have a BAB of +6, then you have a BAB of +5, and therefore meet the "have BAB +5" requirement.
> In the same way, if you have Str 15, then you have Str 13, and therefore meet the "Str 13" feat prerequisite for Power Attack.
> Feat prerequisites are not inclusive, as it is possible for a creature to have a feat without meeting that feat's prerequisites. For example, a ranger can select Precise Shot as a ranger bonus feat without having the Point Blank Shot feat; he does not meet the prerequisites for Far Shot (which has Point Blank Shot as a prerequisite) because he doesn't actually have the Point Blank Shot feat, even though he has a feat that lists Point Blank Shot as a prerequisite."

### FAQ: spell-like abilities and "able to cast" requirements

FAQ CRB, "Spell-Like Abilities, Casting, and Prerequisites" (posted February 2015), https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9qow:

> "Only if the pre-requisite calls out the name of a spell explicitly. For instance, the Dimensional Agility feat (Ultimate Combat) has "ability to use the abundant step class feature or cast dimension door" as a prerequisite; a barghest has dimension door as a spell-like ability, so the barghest meets the "able to cast dimension door prerequisite for that feat. However, the barghest's dimension door would not meet requirements such as "Ability to cast 4th level spells" or "Ability to cast arcane spells"."

### Prestige levels that advance spellcasting

This is handed to [Decide how spellcasting fits the Character Sheet](https://github.com/AndreasUnunger/EverythingPath/issues/218); the official limits are recorded here.

FAQ CRB, "Prestige Class" (posted October 2013), https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9rae:

> "Prestige classes which advance spellcasting only advance caster level, spells per day, and (for spontaneous casters) spells known—essentially, the spellcasting features described in your class's Spells class feature description."

The same entry says such levels give no additional bloodline spells or bloodline feats, mystery spells, patron spells or school powers, and notes that the dragon disciple's blood of dragons is an explicit exception.

FAQ CRB, "Prestige Classes and Spellcasters" (posted November 2010), https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9nib:

> "No. The increase to his spellcasting level does not grant any other benefits, except for spells per day, spells known (for spontaneous casters), and an increase to his overall caster level. He must spend time and gold to add new spells to his spellbook."

FAQ APG, "Witch" (posted November 2010), https://paizo.com/paizo/faq/v5748nruor1fn#v5748eaic9nii:

> "No. That is a class feature of the witch class, and the standard "+1 level of spellcasting" prestige class ability only advances spells known, spells per day, effective spellcaster level. (You retain the patron spells from your familiar based on your actual witch level, of course.)"

### Definitions printed with the prestige classes

CRB p. 374, "Definitions of Terms":

> "Core Class: One of the standard eleven classes found in Classes.
> Caster Level: Generally equal to the number of class levels (see below) in a spellcasting class. Some prestige classes add caster levels to an existing class.
> Character Level: The total level of the character, which is the sum of all class levels held by that character.
> Class Level: The level of a character in a particular class. For a character with levels in only one class, class level and character level are the same."

APG prestige classes chapter (PRD http://paizo.com/pathfinderRPG/prd/advancedPlayersGuide/advancedPrestigeClasses.html; page not verified) adds:

> "Always check with your GM to make sure a given prestige class is allowed before working toward it."

> "Base Class: A class that progresses from level 1–20."

### Prestige classes and the favored class

CRB p. 31: "Prestige classes (see Prestige Classes) can never be a favored class." CRB p. 374: "Characters that take levels in prestige classes do not gain any favored class bonuses for those levels." See the next topic.

## Topic: Favored Class (CRB) and Favored Class Options (APG)

### CRB rule

Source: CRB p. 31, "Favored Class". PRD http://paizo.com/pathfinderRPG/prd/coreRulebook/classes.html; page from http://aonprd.com/Rules.aspx?Name=Favored%20Class&Category=Character%20Advancement.

> "Each character begins play with a single favored class of his choosing—typically, this is the same class as the one he chooses at 1st level. Whenever a character gains a level in his favored class, he receives either + 1 hit point or + 1 skill rank. The choice of favored class cannot be changed once the character is created, and the choice of gaining a hit point or a skill rank each time a character gains a level (including his first level) cannot be changed once made for a particular level. Prestige classes (see Prestige Classes) can never be a favored class."

FAQ CRB, "Hit Points: ... What creatures get favored class bonuses to hit points or skills?" (posted September 2010), https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9nad (excerpt):

> "All creatures with class levels (including those with levels in an NPC class or monsters with class levels) may select a favored class and gain the normal favored class benefits. Creatures never gain favored class benefits for racial Hit Dice."

The same entry lists the "PC-appropriate character classes ... (including archetypes, subclasses, and other variants of these classes)" for maximum hit points at the first Hit Die. **Reading:** an archetype is a variant of its class, not a separate class, so it does not change which class is the favored class. No text says this directly.

### APG alternate favored class options

Source: APG p. 8, "Racial Favored Classes". PRD http://paizo.com/pathfinderRPG/prd/advancedPlayersGuide/advancedRaces.html; page from https://aonprd.com/Rules.aspx?Name=Racial%20Favored%20Class%20Bonus&Category=Favored%20Class.

> "The final section for each racial discussion describes alternative benefits for members of that race taking certain classes as a favored class. The normal benefit of having a favored class is simple and effective: your character gains one extra hit point or one extra skill rank each time she gains a level in that class (or in either of two classes, if she is a half-elf). The alternate favored class abilities listed here may not have as broad an appeal as the standard choices. They are designed to reflect flavorful options that might be less useful in general but prove handy in the right situations or for a character with the right focus. Most of them play off racial archetypes, like a half-orc's toughness and proclivity for breaking things or elven grace and finesse."

> "In most cases, these benefits are gained on a level-by-level basis—your character gains the specified incremental benefit each time she gains a level. Unless otherwise noted, these benefits always stack with themselves. For example, a human with paladin as a favored class may choose to gain 1 point of energy resistance each time she gains a level; choosing this benefit twice increases this resistance bonus to 2, 10 times raises it to 10, and so on."

> "In some cases this benefit may eventually hit a fixed numerical limit, after which selecting that favored class benefit has no effect. Of course, you can still select the bonus hit point or skill rank as your favored class benefit, so there is always a reward for sticking with a favored class."

> "Finally, some of these alternate favored class benefits only add +1/2, +1/3, +1/4, or +1/6 to a roll (rather than +1) each time the benefit is selected; when applying this result to the die roll, round down (minimum 0). For example, a dwarf with rogue as his favored class adds +1/2 to his trap sense ability regarding stone traps each time he selects the alternate rogue favored class benefit; though this means the net effect is +0 after selecting it once (because +1/2 rounds down to +0), after 20 levels this benefit gives the dwarf a +10 bonus to his trap sense (in addition to the base value from being a 20th-level rogue)."

> "As in the previous section, what is presented here is a set of alternative benefits that characters of each race may choose instead of the normal benefits for their favored class. Thus, rather than taking an extra hit point or an extra skill rank, players may choose for their characters to gain the benefit listed here. This is not a permanent or irrevocable choice; just as characters could alternate between taking skill ranks and hit points when they gain levels in their favored class, these benefits provide a third option, and characters may freely alternate between them."

> "As with any alternate or optional rule, consult with your GM to determine whether exchanging normal favored class benefits for those in this chapter will be allowed."

Each race's own list opens like this (dwarf shown; the elf, gnome, half-elf and human lists open the same way, including the "unless otherwise stated" clause):

> "Instead of receiving an additional skill rank or hit point whenever he gains a level in a favored class, a dwarf has the option of choosing from a number of other bonuses, depending upon his favored class. The following options are available to all dwarves who have the listed favored class, and unless otherwise stated, the bonus applies each time you select the listed favored class reward."

The half-orc and halfling lists omit the clause "and unless otherwise stated, the bonus applies each time you select the listed favored class reward"; they read only "The following options are available to all half-orcs [halflings] who have the listed favored class." The general p. 8 statement "Unless otherwise noted, these benefits always stack with themselves" covers all races.

- Each favored class level gives a choice of three: +1 hp, +1 skill rank, or one of the race's options for that class.
- An option exists only for the race and class pairs the APG lists.
- **Reading:** the CRB's "cannot be changed once made for a particular level" and the APG's "This is not a permanent or irrevocable choice ... characters may freely alternate between them" fit together: each level's choice is fixed, and a different choice may be made at the next level. The APG sentence could also be read as allowing an earlier level's choice to be changed. **Open (F1),** low risk.
- Fractional options: rounding down is stated only "when applying this result to the die roll". Many options with +1/2, +1/3 or +1/6 apply to things that are not rolls, such as uses per day, feet of movement, spells known or rounds. The text does not say how to round those. **Open (F2).**
- "fixed numerical limit": each option states its own limit. **Reading:** this belongs in each option's data, not in a general rule.
- Half-elves and half-orcs may pick options from both parent races (FAQ above). Whether the Racial Heritage feat also opens another race's favored class options is not addressed; its FAQ answer covers archetypes only. **Open (F3).**
- Half-elf alternate racial trait Arcane Training (APG): "Half-elves with this racial trait have only one favored class and it must be an arcane spellcasting class. ... This racial trait replaces the multitalented racial trait."

## Topic: Traits (APG and Ultimate Campaign)

### APG trait rules

Source: APG p. 326, "Traits", "Gaining Traits", "Types of Traits", "Restrictions on Trait Selection" (all four sections cite p. 326 on AoN). PRD http://paizo.com/pathfinderRPG/prd/advancedPlayersGuide/advancedNewRules.html; page from http://aonprd.com/Rules.aspx?Name=Traits&Category=Character%20Creation.

Nature and the trait bonus:

> "Character traits are abilities that are not tied to your character's race or class. They can enhance your character's skills, racial abilities, class abilities, or other statistics, enabling you to further customize him. At its core, a character trait is approximately equal in power to half a feat, so two character traits are roughly equivalent to a bonus feat."

> "Many traits grant a new type of bonus: a "trait" bonus. Trait bonuses do not stack—they're intended to give player characters a slight edge, not a secret backdoor way to focus all of a character's traits on one type of bonus and thus gain an unseemly advantage. It's certainly possible, for example, that somewhere down the line, a "Courageous" trait might be on the list of dwarf race traits, but just because this trait is on both the dwarf race traits list and the basic combat traits list doesn't mean you're any more brave if you choose both versions than if you choose only one."

> "Character traits are only for player characters. If you want an NPC to have traits, that NPC must "buy" them with the Additional Traits feat."

How many:

> "When you create your character for a campaign, ask your GM how many traits you can select. In most cases, a new PC should gain two traits, effectively gaining what amounts to a bonus feat at character creation. Some GMs may wish to adjust this number somewhat, depending upon their style of play; you may only be able to pick one trait, or your GM might allow three or more. Even if your GM normally doesn't allow bonus traits, you might still be able to pick up some with the Additional Traits feat."

Types:

> "There are five types of character traits to choose from: basic (split among four categories: Combat, Faith, Magic, and Social), campaign, race, regional, and religion. Only a selection of character traits is listed here—more traits from all categories can be found in Pathfinder Player Companions, available at your local game store or from paizo.com."

> "Campaign Traits: These traits are specifically tailored to give new characters an instant hook into a new campaign. Campaign traits tailored to a specific Pathfinder Adventure Path can always be found in that Adventure Path's Player's Guide, available at paizo.com."

> "Race Traits: Race traits are keyed to specific races or ethnicities, which your character must belong to in order to select the trait. If your race or ethnicity changes at some later point (perhaps as a result of polymorph magic or a reincarnation spell), the benefits gained by your race trait persist—only if your mind and memories change as well do you lose the benefits of a race trait."

> "Regional Traits: Regional traits are keyed to specific regions, be they large (such as a nation or geographic region) or small (such as a city or a specific mountain). In order to select a regional trait, your PC must have spent at least a year living in that region. At 1st level, you can only select one regional trait (typically the one tied to your character's place of birth or homeland), despite the number of regions you might wish to write into your character's background."

> "Religion Traits: Religion traits indicate that your character has an established faith in a specific deity; you need not be a member of a class that can wield divine magic to pick a religion trait, but you do have to have a patron deity and have some amount of religion in your background to justify this trait. Unlike the other categories of traits, religion traits can go away if you abandon your religion, as detailed below under Restrictions on Trait Selection."

Restrictions:

> "There are a few rules governing trait selection. To begin with, your GM controls how many bonus traits a PC begins with; the default assumption is two traits. When selecting traits, you may not select more than one from the same list of traits (the four basic traits each count as a separate list for this purpose). Certain types of traits may have additional requirements, as detailed in the section above."

> "Remember also that traits are intended to model events that were formative in your character's development, either events from before he became an adventurer, or (in the case of additional traits gained via the Additional Traits feat) ones that happened while adventuring. Even if your character becomes a hermit and abandons society, he'll still retain his legacy of growing up an aristocrat if he took the relevant social trait. The one exception to this is religion traits—since these traits require continued faith in a specific deity, your character can indeed lose the benefits of these traits if he switches religions. In this case, consult your GM for your options. She may simply rule that your character loses that trait, or she might allow him to pick a new religion trait tied to his new deity. Another option is that if your character abandons a religion, he loses the associated religion trait until he gains an experience level, at which point he may replace a lost religion trait with a basic faith trait."

Campaign traits (APG ch. 8, "Campaign Traits"; page not verified):

> "Campaign traits are specifically designed to tie your character into a campaign's storyline, and often give you a built-in reason to begin the first adventure. For this reason, GMs usually create their own campaign traits for their PCs. If your GM uses campaign traits, one of your starting traits must be a campaign trait. Your other trait can be chosen from one of the other types of traits."

Race traits (APG ch. 8, "Race Traits"):

> "Race traits are tied to specific races or ethnicities. In order to select a race trait, your character must be of the specified race or ethnicity."

Rules summary:

- The number of traits is a campaign setting; the default is two.
- At most one trait per list. The lists are Combat, Faith, Magic, Social, campaign, race, regional and religion.
- If the GM uses campaign traits, one starting trait must be a campaign trait.
- Race traits require the race. Regional traits require a year living in the region, which is not checkable. Religion traits require a patron deity.
- Trait bonuses do not stack with each other. The bonus-type data is in `research/pf1-official-stacking-rules`.
- The same trait printed on two lists gives no extra benefit if taken from both.

### Additional Traits feat

Source: APG p. 150 (page from https://aonprd.com/FeatDisplay.aspx?ItemName=Additional%20Traits; PRD http://paizo.com/pathfinderRPG/prd/advancedPlayersGuide/advancedFeats.html).

> "You have more traits than normal.
> Benefit: You gain two character traits of your choice (see Chapter 8). These traits must be chosen from different lists, and cannot be chosen from lists from which you have already selected a character trait. You must meet any additional qualifications for the character traits you choose."

### Ultimate Campaign trait rules

Source: UC ch. 1, "Traits" (PRD http://paizo.com/pathfinderRPG/prd/ultimateCampaign/characterBackground/traits.html). The UC text itself gives the page: "Traits and drawbacks begin on page 51."

> "Character traits are abilities that are not tied to your race or class. They can enhance your skills, racial abilities, class abilities, or other statistics, allowing you further customization."

UC chapter introduction (PRD http://paizo.com/pathfinderRPG/prd/ultimateCampaign/characterBackground.html; page not verified):

> "No matter how you go about developing your character's background, the next step is to quantify that background in terms of game mechanics. Select two traits (or three traits and a drawback) that capture the background you imagined. Traits and drawbacks begin on page 51. These traits provide small bonuses that reflect skills and knowledge gained from your life experiences. The drawback, if you choose to take one, represents an emotional vulnerability or character flaw that should not only provide a slight mechanical disadvantage, but also (more importantly) serve as a roleplaying tool for making interesting choices."

> "For published Pathfinder Adventure Paths, you often have the option of selecting campaign traits that tie your character thematically into a specific storyline relevant to that Adventure Path."

UC race traits and the background generator:

> "Race traits are tied to specific races. Your character must be of the specified race to select a race trait. However, the background generator draws from all lists, letting you ignore these restrictions. If using the background generator, you can take any trait you gain access to through it."

UC bloodline race traits:

> "Members of any race can select one of these traits, as they represent distant bloodlines intermixed with or corrupting those your race."

UC religion traits:

> "Religion traits are tied to specific deities. The following religion traits reference the deities presented on page 43 of the Core Rulebook."

UC drawbacks (UC p. 64; the first drawback, Attached, cites p. 64 at https://aonprd.com/TraitDisplay.aspx?ItemName=Attached):

> "Drawbacks are traits in reverse. Instead of granting you a boon, they grant you a negative effect, typically in particular circumstances. If you choose to take a drawback, you can take a third trait that you have access to. You don't have to take a drawback."

UC background generator (PRD http://paizo.com/pathfinderRPG/prd/ultimateCampaign/characterBackground/backgroundGenerator.html; page not verified):

> "While rolling on the tables in these three steps, you are sometimes granted access to a trait, story feat, or drawback. Upon gaining access to one of these rules elements, write it down. At the end of background generation, you can choose up to two of the traits you've gained access to. If you gained access to at least one drawback, you can take one of those drawbacks to gain an additional trait you have access to (following the normal rules for trait selection). When you gain access to a story feat, it means you've met the prerequisite for the feat and can take it at any time, not just at character creation."

UC trait example showing the trait-bonus rule (Kin Guardian):

> "This increase is a trait bonus (and therefore doesn't stack with increases granted by other family members using this trait)."

- **Reading:** UC fixes the default at "two traits (or three traits and a drawback)". The APG lets the GM change the count. The two agree on the default.
- Taking one drawback allows one extra trait. Neither book says whether a second drawback buys a fourth trait; the text speaks of "a drawback" and "a third trait". **Open (T3).**
- UC prints "Bloodline Race Traits" under the "Race Traits" heading, open to any race. Whether it is its own list for the one-per-list rule is not stated. **Open (T2).**
- Trait categories outside the APG and UC (for example from Player Companions or Adventure Path guides) have no admitted rule assigning them to a list. **Open (T2).**
- With the background generator, race restrictions are lifted for traits gained through it.

### FAQ

FAQ APG, "Magical Lineage (trait)" (posted May 2013), https://paizo.com/paizo/faq/v5748nruor1fn#v5748eaic9qns:

> "No. For example, it won't allow you to alter a wizard's fireball into 2nd-level spell."

No other APG, UC or CRB FAQ entry addresses the trait selection rules.

## Topic: Pathfinder Unchained (inventory)

Every system is listed with its page, what it changes on the character sheet and how it is adopted in `pf1-tables.md` ("Table: Pathfinder Unchained Character-Building Inventory"). This section quotes the rule text that the table summarizes, limited to systems that change the sheet. Page numbers come from AoN Rules pages (see `README.md`).

### Chapter introductions (the book's own framing)

PU ch. 1 (classes): "This chapter includes unchained versions of the barbarian, monk, rogue, and summoner, as well as subsystems that alter character advancement."

PU ch. 2 (skills and options): "This chapter unchains skills from their foundations, presenting new optional rules that simplify and streamline skills, as well as rules that enhance the use of non-adventuring skills. The chapter's final section introduces an alternative approach to multiclassing, in which you trade out some of your feats to customize your character with powers from a secondary class of your choice."

PU ch. 3 (gameplay): "Alignment, combat, and the consequences of combat are three fundamental components of the Pathfinder RPG. But in an unchained game, all the fundamentals can be shaken up! ... This chapter contains a variety of exciting alternative systems, from altered alignment to a progression for disease and poison."

PU ch. 4 (magic): "This chapter introduces the following new rules to help enhance the sense of wonder magic can bring and allow you to more easily play games that are free from the standard assumptions of magic availability and stat-boosting items."

(PRD http://paizo.com/pathfinderRPG/prd/unchained/{classes,skillsAndOptions,gameplay,magic}/index.html; pages not verified.)

**Reading:** each system is presented as optional. The book has no single switch for turning systems on. Some systems name the campaign or the GM as the one who adopts them; others are written to the player. The table records the wording for each. **Open (U1).**

### Unchained classes (PU pp. 8, 14, 20, 25)

> "These classes can be used alongside their original counterparts (although individual characters must use one version or the other exclusively)."

Monk sidebar (p. 14): "Much of the monk has been reworked, including its base attack bonus, Hit Die, saves, and many of its special abilities." Barbarian sidebar (p. 8): "Rage now grants temporary hit points and static bonuses on attack and damage rolls, rather than bonuses to ability scores that force players to recalculate a number of statistics." Rogue sidebar (p. 20): "with finesse training, the rogue now gains Weapon Finesse for free at 1st level. This ability also lets her add her Dexterity to damage rolls with one weapon starting at 3rd level." Summoner sidebar (p. 25): "The unchained summoner selects a subtype for his eidolon (such as angel, demon, or protean) ... Finally, the summoner spell list has been greatly revised, removing a number of imbalances."

- **Reading:** an unchained class is its own class entry. One character cannot hold levels in both the original and the unchained version of a class.

FAQ PU, "Unchained Rogue Finesse Training" (posted May 2015), https://paizo.com/paizo/faq/v5748nruor1h3#v5748eaic9tb7. This is the only entry on the Unchained FAQ page:

> "With a two-handed weapon, you add 1-1/2 times your Dexterity bonus on damage rolls, and with an off-hand weapon, you add half your Dexterity bonus on damage rolls. As per the ability's text, if an effect would prevent you from adding your Strength modifier on damage rolls, you don't add your Dexterity modifier. However, any other effects that would increase the multiplier to your Strength bonus on damage rolls (such as the two-handed fighter archetype's overhand chop) do not affect your Dexterity bonus on damage rolls."

### Fractional base bonuses (PU p. 40)

> "Multiclass characters in the core rules are at a slight disadvantage when it comes to their statistics. This fractional base bonuses variant is designed to help multiclass characters fulfill their true potential and stand tall among their single-class peers. It is ideal for campaigns featuring many multiclass characters, particularly if those characters take levels in many different classes or prestige classes."

> "There are three base attack bonus progressions. For classes with a d6 Hit Die, their BAB increases by 1/2 per level. For classes with a d8 Hit Die, their BAB increases by 3/4 per level. For classes with a d10 or d12 Hit Die, their BAB increases by 1 per level (so it's not necessary to round the BAB for these classes). A multiclass character's base attack bonus will only ever improve using this variant."

> "When calculating each saving throw bonus, first determine whether each class you have levels in grants a good or poor saving throw progression for that type of save. To tell whether a class has a good or poor save progression for a particular saving throw, look at the 1st-level saving throw bonus it receives for that save in the core rules. If the bonus is +2, the class has a good save progression for that type of save. If it's +0, the class has a poor save progression for that type of save. Next, for each class, find the value in the table above corresponding to your level in that class and whether the saving throw progression is good or poor. Add the values from all your classes; if you have a good saving throw progression from at least one class, add 2 to the total (this is a one-time increase and doesn't stack)."

> "In the core Pathfinder rules, prestige classes advance at the same rate as base classes but have different class bonuses. These adjusted bonuses were meant to compensate for the leftover fractions from the character's base classes, since the only way to gain a prestige class is via multiclassing—taking levels in both your original class and the prestige class—or racial Hit Dice. Because fractional base bonuses already account for those fractions, instead use the base save bonuses from the table above just as you would for any other class. To tell whether a prestige class has a good or poor save progression for a saving throw, look at the 1st-level saving throw bonuses it receives for that save. If the bonus is +1, it has a good save progression. If it's +0, it has a poor save progression."

> "This rule affects only multiclass characters, and such characters will have a number of attacks depending on their combined base attack bonuses from several classes. ... Just remember that a second attack is gained when a character's total BAB reaches +6, a third at +11, and a fourth at +16, just as normal."

Table footnote: "* If at least one of the character's classes has a good saving throw progression for the save in question, add 2 to the total save bonus."

- **Reading:** BAB rate comes from the class's Hit Die, not from its printed BAB column.
- Some prestige classes have a BAB column that does not match their Hit Die. For example, the CRB dragon disciple has "Hit Die: d12." with BAB +0, +1, +2, +3 at levels 1 to 4, a 3/4 progression. The variant gives no rule for such classes. **Open (U3).**
- The variant's table covers class levels only. It does not say how racial Hit Dice progress under it. **Open (U3).**

### Staggered advancement (PU p. 42)

> "Instead of gaining all your new abilities when you advance to the next level, you divide them among four XP tiers: 25%, 50%, 75%, and 100%. Each XP tier represents a specific percentage of the XP required to advance to the next level."

> "First, select the class in which you'll gain your next level. You must meet all the prerequisites for that class level. Whenever you reach a new XP tier, gain the appropriate universal abilities and skill ranks for that class as detailed in Table 1–8: Staggered Advancement. Your feat, ability score, and spell progressions remain unchanged."

> "Universal abilities include your selected class's base attack bonus, hit points (hp), and saving throw bonuses. At the 25%, 50%, and 75% XP tiers, you can select one of the following options."

> "Each of the above options can only be selected once per level. Additionally, the base attack bonuses and saving throw bonuses of some classes don't increase each time they advance in level. If only one universal ability is applicable, incorporate it at the 75% tier. If two are applicable, incorporate one at the 50% tier and the other at the 75% tier (your choice)."

> "Class Features: Characters gain all class features upon reaching the next level."

> "Skill Ranks: Determine the total number of skill ranks you would gain for advancing to the next level in your selected class, and allocate 50% of the skill ranks (rounding down) when you reach the 50% XP tier. When you advance fully to the next level, you can spend the remaining skill ranks."

> "The following table assumes you are using the medium XP advancement track. If you use the fast or slow XP advancement track, you can use this table as a model from which to extrapolate the XP requirements for each XP tier."

- **Reading:** a character can sit part-way through a level, holding some of the next class level's BAB, hit points, saves and ranks.
- The tier XP values for the slow and fast tracks are left to extrapolation. **Open (U9).**

### Background skills (PU p. 46)

> "In a campaign that uses the background skills system, each character gains an additional 2 skill ranks per level, which must be spent on background skills."

> "In addition to their normal allotment of regular skill ranks, all characters gain 2 background skill ranks each time they gain a level in a PC class. The character's Intelligence modifier doesn't adjust this value. Background skill ranks can be used to gain ranks only in background skills, not adventuring skills. Characters can expend their regular skill ranks on background skills if they desire."

> "In the background skills system, classes use their standard class skill lists. Any class that gains Craft or Perform as a class skill also counts Artistry as a class skill. Lore is always considered a class skill for all characters."

> "NPCs gain background skills in the same fashion PCs do, but only for PC classes they possess."

On the two new skills, Artistry and Lore: "Even if you're not using the background skills system, you can still incorporate these skills into your game as normal skills."

> "Implementing background skills in an established campaign is easy. To convert a character's skill ranks into this system, first determine the total number of background skill ranks she has—this is equal to 2 × the PC's character level."

The background/adventuring split is in `pf1-tables.md`.

- **Reading:** the background ranks come from "each time they gain a level in a PC class". No text says whether they come from prestige class levels; prestige classes are neither listed as PC classes nor excluded. **Open (U10).**

### Consolidated skills (PU p. 54)

> "In some games, the GM might wish to use a smaller list to make characters more broadly talented, to group skills that characters typically choose together, and to speed up the leveling-up process. The consolidated skills system reduces the number of skills by combining related skills."

> "The bonus from class skills functions the same way under this system, and provides the same +3 bonus. However, the class skill lists change, with the following entries replacing the normal class skills lists. The number in parentheses indicates the number of skill ranks a character of this class gains at each level. Always add 1/2 the character's Intelligence modifier to this number, even if the modifier is negative. A character always gains a minimum of 1 skill rank per level."

> "Several skills are removed and not replicated by this system ... These are typically skills that are less important for adventuring, but can be put back into your game using the background skills variant."

> "Many traits offer a +1 trait bonus on core skill checks and make those skills class skills. With the consolidated skills system, those traits instead grant a +1 trait bonus on traits involving the functions of those consolidated skills corresponding to the traits' listed core skills, or a +4 trait bonus if the skills are not class skills. If you later receive that skill as a class skill, this trait bonus reduces to +1."

(The phrase "a +1 trait bonus on traits involving the functions" is as printed in the PRD.)

### Grouped skills (PU p. 70)

> "With this system, players don't need to worry about expending skill ranks. A character adds 1/2 her level when attempting skill checks for her chosen grouped skills, thereby making that character at least somewhat competent in skills she might otherwise neglect."

> "If a character has a specialty in a skill and that skill is also in a skill group she's trained in, her bonus on checks using the skill is equal to her relevant ability modifier + her character level. If only one applies—she only has a specialty in the skill or she is trained in that skill's group but doesn't have a specialty in the skill—her bonus is equal to her relevant ability modifier + 1/2 her character level (minimum 1)."

> "If a skill is on her class skill list, she gains the +3 bonus if she's trained in its skill group or has a specialty in it—she doesn't have to both be trained and have a specialty."

Grouped skills with the other skill variants:

> "With a bit of adaptation, skill groups can work alongside the background skills or consolidated skills systems."

With background skills, "Instead of gaining background skill ranks at every level, a character gains one additional skill specialty at 1st level that can be used only to select a background skill." With consolidated skills, "Reduce both the number of skill groups and the number of skill specialties characters gain by 1/2 (rounded down, to a minimum of 1)", and the skill groups are redefined.

- The PU text covers every pairing of the skill systems: consolidated with background (in the consolidated skills text), and grouped with either (above). It does not cover using all three together.

### Skill unlocks (PU p. 82)

> "Any character with the Signature Skill feat (see below) can earn skill unlocks for a single skill, and they are a prime feature of the revised version of the rogue, who uses her rogue's edge ability to gain skill unlocks for several of her most iconic skills. Alternatively, you might make skill unlocks a universal part of the game, but you should be aware they add significant power and flexibility to skills ... Another alternative is to eliminate access to the Signature Skill feat, limiting skill unlocks to rogues and rogues alone."

Signature Skill: "Prerequisite: 5 ranks in the chosen skill. Benefit: Choose one skill. You gain the ability listed in that skill's 5 Ranks entry. As you gain more ranks in the chosen skill, you gain additional abilities. ... This feat can be taken only once, but it stacks with the rogue's edge ability and the cutting edge rogue talent."

### Variant multiclassing (PU p. 88)

> "Under the core rules, multiclassing can lead to a wide disparity in character ability. With this system, each character can choose a secondary class at 1st level that she trains in throughout her career, without giving up levels in her primary class. Once selected, this choice is permanent (though if using the retraining rules from Ultimate Campaign, the secondary class can be retrained by paying half the cost of retraining all her class levels). A character who selects this option doesn't gain feats at 3rd, 7th, 11th, 15th, and 19th levels, but instead gains class features from her secondary class as described on Table: Multiclass Character Advancement. It is probably a good idea to use either this variant system or normal multiclassing, but it's possible for the two systems to be used together. In a game using both systems, a character can't take levels in the secondary class she gains from this variant."

- The secondary class is chosen at 1st level and is permanent.
- The general character-level feats at 3rd, 7th, 11th, 15th and 19th are replaced by secondary class features. The 1st-level secondary feature (such as Deity, Code, Bloodline or School) is gained with no feat given up; see the table.
- Secondary class features scale with character level, often as "character level – N". The full list for the core and APG/UC/UM base classes is in the PU text.
- **Reading:** only the general feats on Table: Character Advancement are named. Bonus feats from race or class are untouched.
- No text covers how VMC features combine with archetypes of the primary class, or with feats that require the secondary class's features. **Open (U4).**

### Stamina and combat tricks (PU p. 112)

> "There are several ways you can implement this system in your game.
> Feat Access: The easiest way to introduce stamina and combat tricks into your game is to grant access to the Combat Stamina feat, detailed below. ...
> Free for Fighters: If your goal is to provide an additional edge to the fighter class, you can allow fighters to gain the Combat Stamina feat as an additional bonus feat at 1st level.
> Fighter Bonus Feats Only: If you want to significantly strengthen fighters compared to all other classes and keep this system as a special fighter-only perk, you can restrict the Combat Stamina feat to fighters and limit the feats a character can use with his stamina pool to those gained with the fighter's bonus feats. ...
> Free for Everyone: If your goal is to immediately boost all martial characters and the whole group is ready to handle the stamina and combat tricks system, you can grant Combat Stamina as an additional bonus feat for all martial characters, or even for all characters."

> "When you have an ability that grants you stamina points, you gain a stamina pool with a maximum number of stamina points equal to your base attack bonus + your Constitution modifier."

> "Temporary increases to your Constitution score, such as those granted by the core barbarian's rage class feature or bear's endurance, do not increase the number of stamina points in your pool or your pool's maximum number of stamina points. However, permanent increases to Constitution, such as the bonus granted by a belt of mighty constitution worn for more than 24 hours, do adjust your stamina points."

Feats: Combat Stamina ("Prerequisite: Base attack bonus +1. Benefit: You gain a stamina pool. ..."), Extra Stamina ("Your stamina pool increases by 3 points." up to three times), Push the Limits (secondary pool "equal to your Constitution modifier").

### Wound thresholds (PU p. 136)

> "Consider using the following variant to add tension and increase the strategic value of healing, but be aware that it can lead to situations that punish the side that's already behind ..."

> "To prevent the need to divide on the fly, start out by calculating 3/4, 1/2, and 1/4 of your total hit points and add them to your character sheet as "Grazed (–1)," "Wounded (–2)," and "Critical (–3)." If you have a Constitution bonus of +1 or higher, also write down the negative of your Constitution bonus next to the word "Disabled." These terms indicate the conditions a character gains as her hit points drop."

> "These conditions are not cumulative—only the most severe one applies at a given time."

Grazed, wounded and critical each give the stated penalty "on all attack rolls, saving throws, skill checks, and ability checks, as well as to AC and caster level". The text also changes the Endurance feat: "You reduce the penalty from being grazed, wounded, or critical by 1 (to –0, –1, and –2, respectively)."

### Automatic bonus progression (PU p. 156)

> "All characters gain the abilities listed on the table below when they reach the appropriate level. Decrease character wealth by level to half the normal amount. The automatic bonuses are often more beneficial than that reduction in wealth, but characters have less flexibility, so the advantages and disadvantages balance out. Items that only grant bonuses to AC, saving throws, and ability scores don't exist in this variant, and wish and similar spells never grant inherent bonuses to ability scores. Magic weapons and armor do exist, but grant only special abilities, not enhancement bonuses; calculate their prices with the table below."

> "If you want to remove magic items entirely (or make them so exceedingly rare that there is no expectation of finding them), consider giving the characters bonuses from the following table as if they were 2 levels higher. The table extends to 22nd level to account for games without magic items."

The bonus types granted are resistance (saves), enhancement (attuned armor, shield and weapons), deflection (AC), enhancement to ability scores ("permanent +2 enhancement bonus"), enhancement to natural armor (toughening), and legendary gifts, including "a +1 inherent bonus to any ability score". The level table and each bonus's text are in `pf1-tables.md`.

### Innate item bonuses (PU p. 158)

> "Under this new system, characters gain the statistical bonuses they're expected to gain from magic items as they level up so long as they have any item in the relevant slot, instead of needing specific items. The system involves minimal alterations to existing items, and works especially well for campaigns with higher than normal wealth."

> "Removed Items: Remove all amulets of natural armor, cloaks of resistance, and items that grant enhancement bonuses to ability scores.
> Altered Item Slots: Remove the belt and headband slots."

- **Reading:** the text contrasts innate item bonuses with automatic bonus progression and presents them as alternatives. It does not forbid using both. **Open (U2).**

### Removing alignment (PU p. 100) and unchained alignment (PU p. 95)

> "Alignment is replaced by a new character aspect called loyalties, and class alignment restrictions are redefined in those terms."

> "For each character in the campaign, you'll need a copy of the alignment diagram below in Table: Changing Alignment. Whether the characters' positions are tracked by the GM or the players is up to you."

### Simplified spellcasting (PU p. 144)

> "With simplified spellcasting, you keep track of only your 3 highest levels of spells, and all the other spells are placed in a pool that you can use on the fly. ... Because this system affects only your 3 highest levels of spells, it doesn't change anything for a character who isn't yet able to cast 4th-level spells."

> "Your pool increases if you have a high spellcasting ability modifier, similar to how you gain bonus spells in slots you prepare. Add a number of spells to your pool equal to 1/4 the ability score modifier of the ability score you would normally use to calculate your number of bonus spells per day."

- Unlike most systems, this one never says whether the campaign adopts it or each caster chooses it. **Open (U5).** Spellcasting display is owned by #218.

### Systems that do not change the build

These are recorded for completeness. They change play procedures or items, not stored character statistics: revised action economy (p. 102), removing iterative attacks (p. 110), diseases and poisons (p. 138), spell alterations (p. 146), esoteric material components (p. 150), scaling items (p. 160), dynamic magic item creation (p. 180), and alternate crafting and profession rules (p. 72). Simple monster creation (ch. 5) is a GM monster tool. See the inventory table for the one-line effect of each.

## Edge Cases and Open Items

Each item quotes or points to the text it rests on in the topics above. None gives an answer.

**Archetypes**

- **A1. Adding an archetype after 1st level of the class.** The APG says the choice is made "When a character selects a class". No rule covers taking an archetype later in that class. "Adapting Existing Characters" is GM rebuild advice.
- **A2. "Alters" is undefined for APG archetypes.** The FAQ says APG archetypes "never include" the "this alters" language "even when they should". Alteration must be read from each ability's prose.
- **A3. Class-skill, proficiency and bonus-feat-list changes as alterations.** The FAQ makes "adding an additional class skill to the class" or "adding an additional bonus feat to the list" an alteration that blocks combinations. It does not say which class feature a class-skill change belongs to, nor whether two archetypes that each only add class skills conflict.
- **A4. Which class features have sub-features.** Only bardic performances and weapon training I to IV are named.
- **A5. Value of a later increment after a partial replacement.** The FAQ fixes when the feature is first held (for example fighter 9 for weapon training). It does not say whether the increment's bonus counts the replaced earlier increment.
- **A6. GM houserules for small overlaps.** The FAQ explicitly allows them. This is a GM override, not a rule.
- **A7. Archetype requirements.** "if they meet the requirements" has no defined format. The text does not say what happens if a requirement is later lost.
- **A8. Earlier monk archetypes with the unchained monk.** "with the exception of the monk" excludes the monk, with no further rule.
- **A9. Whether an archetype ability counts as the ability it replaced.** The CRB FAQ makes this depend on wording ("works like", "specific choice"), which needs a judgment for each ability.

**Prestige classes**

- **P1. Losing a requirement after entry.** The CRB checks requirements only before the first level. The UC FAQ covers losing them through retraining ("can't use that feat, prestige class, or ability until you meet the qualifications again") but not through alignment change, ability drain or similar.
- **P2. Requirements for later prestige levels.** The text speaks only of "their first level of a prestige class".

**Favored class**

- **F1. Changing an earlier level's favored class choice.** CRB: "cannot be changed once made for a particular level". APG: "not a permanent or irrevocable choice ... characters may freely alternate". Read together these allow a different choice at each level, but the APG sentence can also be read more widely.
- **F2. Rounding fractional favored class options that are not rolls.** "round down (minimum 0)" is stated only "when applying this result to the die roll".
- **F3. Racial Heritage and another race's favored class options.** The FAQ covers archetypes only.

**Traits**

- **T1. Number of traits.** It is GM-controlled: "your GM controls how many bonus traits a PC begins with; the default assumption is two traits". It is a campaign setting, not a rule with one value.
- **T2. What counts as a "list".** The APG defines eight lists. UC adds "Bloodline Race Traits" under Race Traits without saying whether it is a separate list. Trait categories from other Paizo books have no admitted list rule.
- **T3. More than one drawback.** UC allows "a drawback" for "a third trait". Neither book says whether more drawbacks buy more traits.
- **T4. Losing a religion trait.** The GM picks one of three outcomes ("She may simply rule ...", "or she might allow ...", "Another option is ...").

**Pathfinder Unchained**

- **U1. How a system is switched on.** There is no book-wide rule. The wording differs by system (see the inventory table): "In a campaign that uses", "the GM might wish", "you can", or none.
- **U2. Combining systems.** The skill variants address their pairings (consolidated with background, grouped with either), but not all three together. Innate item bonuses and automatic bonus progression are described as alternatives, and neither forbids nor describes using both. Other combinations, such as fractional base bonuses with variant multiclassing, are not mentioned.
- **U3. Fractional base bonuses for prestige classes whose BAB does not match their Hit Die, and for racial Hit Dice.** BAB is keyed to Hit Die. The CRB dragon disciple (d12, 3/4 BAB) does not fit, and racial Hit Dice are not covered.
- **U4. Variant multiclassing with archetypes and with feats that require secondary class features.** Not addressed.
- **U5. Who adopts simplified spellcasting.** Not stated.
- **U6. Stamina implementation.** The GM chooses one of four options: Feat Access, Free for Fighters, Fighter Bonus Feats Only or Free for Everyone. Each changes who may have a stamina pool.
- **U7. Unchained class exclusivity.** "individual characters must use one version or the other exclusively". The text does not say whether this also stops an unchained-class character from taking a prestige class or archetype that requires the original class's features by name. Archetypes are covered only by "as long as the classes still have the appropriate class features to replace".
- **U8. Errata.** The only Unchained FAQ entry concerns finesse training. This research found no separate errata document for the APG, UC or PU. Paizo's stated practice is to fold errata into reprinted books and updated PDFs. Errata that the FAQ prints as "Update:" entries is included above. It was not checked whether the 2019 Internet Archive copy of the PRD matches the latest printing of each book.
- **U9. Staggered advancement tiers on the slow and fast XP tracks.** These are left to extrapolation ("you can use this table as a model from which to extrapolate").
- **U10. Background skill ranks from prestige class levels.** The text gives ranks "each time they gain a level in a PC class". It neither includes nor excludes prestige classes.
