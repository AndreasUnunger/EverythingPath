# PF1 Spellcasting Rules

Official spellcasting text for the character sheet, collected for [#231](https://github.com/AndreasUnunger/EverythingPath/issues/231) (map #201). [Decide how spellcasting fits the Character Sheet](https://github.com/AndreasUnunger/EverythingPath/issues/218) settled that the sheet stores spells known, prepared spells and spellbooks per casting class, and derives caster level, spells per day with bonus spells, spells known limits, save DCs and concentration. This file holds the rules text behind those values. Numbers (spells per day and spells known, costs, swap schedules, the per-class summary) live in `pf1-tables.md`.

Retrieved 2026-10-02. Source policy and provenance are in `README.md`. Short forms: **CRB** *Core Rulebook*, **APG** *Advanced Player's Guide*, **UM** *Ultimate Magic*, **UC** *Ultimate Campaign*, **ACG** *Advanced Class Guide*, **OA** *Occult Adventures*, **PU** *Pathfinder Unchained*. "FAQ" means Paizo's official FAQ pages, cited with anchor and posting date.

Conventions (same as `docs/ai/pf1-archetype-prestige-trait-rules/` on `research/pf1-archetype-prestige-trait-rules`):

- `> "..."` blocks and inline quotes are verbatim official text. `...` marks an omission.
- **Reading:** a conclusion drawn from the quoted text. It adds no rule.
- **Open (Sn):** the official text is silent, ambiguous or contradicts itself. Open items give no answer. All of them are collected at the end.

Not repeated here: the spell data and Foundry's casting summaries (`research/pf1-spell-data`, `docs/research/pf1-spell-data.md`); CRB Table 1–3 Ability Modifiers and Bonus Spells (`research/pf1-core-rules`, `docs/ai/pf1-core-rules/pf1-tables.md`); the prestige-class FAQ limits already quoted in `docs/ai/pf1-archetype-prestige-trait-rules/pf1-rules.md` (they are cited here by anchor and only quoted again where a modelling decision hangs on the exact words).

## Topic: Caster Level

Source: CRB p. 208, "Caster Level". PRD https://legacy.aonprd.com/coreRulebook/magic.html (Paizo's `paizo.com/pathfinderRPG/prd/coreRulebook/magic.html` redirects there); page from https://aonprd.com/Rules.aspx?Name=Magic&Category=Rules%20of%20the%20Game (same wording).

> "A spell's power often depends on its caster level, which for most spellcasting characters is equal to her class level in the class she's using to cast the spell."

> "You can cast a spell at a lower caster level than normal, but the caster level you choose must be high enough for you to cast the spell in question, and all level-dependent features must be based on the same caster level."

> "In the event that a class feature or other special ability provides an adjustment to your caster level, that adjustment applies not only to effects based on caster level (such as range, duration, and damage dealt), but also to your caster level check to overcome your target's spell resistance and to the caster level used in dispel checks (both the dispel check and the DC of the check)."

CRB p. 374, "Definitions of Terms" (prestige classes chapter; PRD https://legacy.aonprd.com/coreRulebook/prestigeClasses.html):

> "Caster Level: Generally equal to the number of class levels (see below) in a spellcasting class. Some prestige classes add caster levels to an existing class."

CRB p. 217, "Spell Resistance": "you must make a caster level check (1d20 + caster level) at least equal to the creature's spell resistance ... Include any adjustments to your caster level to this caster level check."

- **Reading:** caster level is held per casting class: "her class level in the class she's using to cast the spell". Levels in two casting classes do not add together. The composition is: class level in that class, plus prestige levels assigned to that class (see Prestige Classes), plus any class-level offset the class states, plus caster-level adjustments from feats, traits and features.

### Classes that state an offset

- Paladin (CRB p. 60): "Through 3rd level, a paladin has no caster level. At 4th level and higher, her caster level is equal to her paladin level – 3."
- Ranger (CRB p. 64): "Through 3rd level, a ranger has no caster level. At 4th level and higher, his caster level is equal to his ranger level – 3."
- Antipaladin (APG p. 118): "Through 3rd level, an antipaladin has no caster level. At 4th level and higher, his caster level is equal to his antipaladin level –3."

No other class in scope states an offset.

### Bloodrager caster level (settled from the text)

ACG p. 15 (class entry; the ticket cites p. 16 for the Spells feature), https://aonprd.com/ClassDisplay.aspx?ItemName=Bloodrager, same wording on the PRD https://legacy.aonprd.com/advancedClassGuide/classes/bloodrager.html:

> "**Spells**: Beginning at 4th level, a bloodrager gains the ability to cast a small number of arcane spells drawn from the bloodrager spell list. To learn or cast a spell, a bloodrager must have a Charisma score equal to at least 10 + the spell level. He can cast spells he knows without preparing them ahead of time. The saving throw DC against a bloodrager's spell is 10 + the spell level + the bloodrager's Charisma modifier."

> "For all spell-like bloodline powers, treat the character's bloodrager level as the caster level."

- The Spells feature has no caster-level sentence. The paladin, ranger and antipaladin each print "Through 3rd level ... has no caster level ... level – 3". The bloodrager, which also starts casting at 4th level, prints neither sentence. No ACG FAQ entry (page last updated August 2017) addresses it.
- **Reading:** the CRB p. 208 default applies, so a bloodrager's caster level for bloodrager spells equals his bloodrager level. At 4th level that is caster level 4, not 1. Foundry's lack of an offset (noted on `research/pf1-spell-data`) agrees with this reading.
- The text does not say whether a bloodrager of levels 1 to 3, who has no spells yet, "has" a caster level for other rules (feat prerequisites, for example). **Open (S1).** The medium raises the same question at levels 1 to 3 for 1st-level spells, though he has knacks from 1st level.

### Extract casters

- Alchemist (APG p. 26): "The alchemist uses his level as the caster level to determine any effect based on caster level."
- Investigator (ACG p. 30): extracts "can be dispelled by *dispel magic* and similar effects, using the investigator's level as the caster level." The investigator text has no general "uses his level as the caster level" sentence. **Reading:** the CRB default (class level) gives the same number. The omission is noted as **Open (S2)** only because the ACG FAQ (July 2015, `v5748eaic9tmk`) says another sentence missing from the investigator's copy of the alchemist text was omitted on purpose.

### Occultist without an implement

OA p. 46, Implements: "Spells cast by an occultist without the appropriate implement are always treated as if they were cast at the minimum caster level for the spell in question (caster level 1st for a 1st-level spell, caster level 4th for a 2nd-level spell, and so on)."

## Topic: Save DC

Source: CRB p. 216, "Saving Throw". PRD and page as above.

> "**Saving Throw Difficulty Class**: A saving throw against your spell has a DC of 10 + the level of the spell + your bonus for the relevant ability (Intelligence for a wizard, Charisma for a bard, paladin, or sorcerer, or Wisdom for a cleric, druid, or ranger). A spell's level can vary depending on your class. Always use the spell level applicable to your class."

Every casting class repeats the formula in its Spells feature with its own ability, for example the wizard (CRB p. 77): "The Difficulty Class for a saving throw against a wizard's spell is 10 + the spell level + the wizard's Intelligence modifier." The ability per class is in `pf1-tables.md`.

- **DC formula: 10 + spell level (as that class has it) + the casting ability modifier of the class used to cast it**, plus DC modifiers (Spell Focus and others, below).
- Metamagic does not change the spell level for the DC. CRB pp. 112–113, Metamagic Feats: "Spells modified by a metamagic feat use a spell slot higher than normal. This does not change the level of the spell, so the DC for saving throws against it does not go up." Heighten Spell is the exception (below).
- Alchemist and investigator extracts: "The Difficulty Class for a saving throw against an alchemist's extract is 10 + the extract level + the alchemist's Intelligence modifier." (APG p. 26; the investigator has an equivalent sentence, ACG p. 30: "The saving throw DC for an investigator’s extract is equal to 10 + the extract’s level + the investigator’s Intelligence modifier.")

FAQ CRB, "Abilities that work 'as a spell'" (posted February 2016), https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9ucw:

> "Some abilities that work as a spell tell you what their DC is, like the bard's fascinate performance. An ability that doesn't tell you anything about its DC has a DC of 10 + the spell level + the key spellcasting ability score of the class that granted it (or Charisma otherwise). In the case of a spell with multiple spell levels, use the spell level from the class that granted the ability if that class has the spell on its spell list, and otherwise use the spell level that's most appropriate (usually sorcerer/wizard for an arcane ability, cleric for a divine ability, and psychic for a psychic ability)."

FAQ CRB, "Cleric domains, sorcerer bloodlines, wizard schools ... What's the effective spell level for these abilities?" (posted July 2011), https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9o6x:

> "The effective spell level for these spell-like abilities is equal to the highest-level spell that a character of that class could normally cast at the level the ability is gained."

FAQ APG, "Oracle: Can I use my Charisma modifier for cleric spells and effects that use Wisdom" (posted May 2013), https://paizo.com/paizo/faq/v5748nruor1fn#v5748eaic9qlk: "As written, those effects say "Wisdom" ... so an oracle has to use her Wisdom modifier. However, it is a perfectly reasonable house rule to allow an oracle to use her Charisma modifier".

## Topic: Concentration

Source: CRB p. 206, "Concentration". PRD and page as above.

> "To cast a spell, you must concentrate. If something interrupts your concentration while you're casting, you must make a concentration check or lose the spell. When you make a concentration check, you roll d20 and add your caster level and the ability score modifier used to determine bonus spells of the same type. Clerics, druids, and rangers add their Wisdom modifier. Bards, paladins, and sorcerers add their Charisma modifier. Finally, wizards add their Intelligence modifier. The more distracting the interruption and the higher the level of the spell you are trying to cast, the higher the DC (see Table: Concentration Check DCs). If you fail the check, you lose the spell just as if you had cast it to no effect."

- **Concentration bonus: caster level (of the casting class) + the ability modifier that class uses for bonus spells**, plus concentration modifiers (Combat Casting, Focused Mind, below).
- **Reading:** "of the same type" names the class's own bonus-spell ability. For classes after the CRB that ability is the one each Spells feature names for bonus spells (for example Charisma for the oracle, Intelligence for the witch).

The check DCs (Table: Concentration Check DCs) are in `pf1-tables.md`. Defensive casting, quoted because the sheet may display it:

> "**Casting Defensively**: If you want to cast a spell without provoking any attacks of opportunity, you must make a concentration check (DC 15 + double the level of the spell you're casting) to succeed. You lose the spell if you fail."

FAQ CRB, "Metamagic: At what spell level does the spell count for concentration DCs, magus spell recall, or a *pearl of power*?" (posted October 2013), https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9r9w:

> "The spell counts as the level of the spell slot necessary to cast it.
> For example, an empowered *burning hands* uses a 3rd-level spell slot, counts as a 3rd-level spell for making concentration checks, counts as a 3rd-level spell for a magus's spell recall or a *pearl of power*.
> In general, use the (normal, lower) spell level or the (higher) spell slot level, *whichever is more of a disadvantage* for the caster. The advantages of the metamagic feat are spelled out in the Benefits section of the feat, and the increased spell slot level is a disadvantage.
> Heighten Spell is really the only metamagic feat that makes using a higher-level spell slot an advantage instead of a disadvantage."

Psychic spells add 10 to concentration DCs for thought components (OA p. 144, see Psychic Magic). Two class features set their own concentration DCs: the wizard's bonded object ("If a wizard attempts to cast a spell without his bonded object worn or in hand, he must make a concentration check or lose the spell. The DC for this check is equal to 20 + the spell's level.", CRB p. 77) and the occultist without an implement ("concentration check (DC = 20 + the spell's level)", OA p. 46).

## Topic: Bonus Spells and Minimum Ability

Source: CRB p. 16, "Abilities and Spellcasters"; Table 1–3 is on p. 17 (PU p. 25, ACG p. 60 and OA classes cite "Table 1–3 ... on page 17 of the *Core Rulebook*"). PRD https://legacy.aonprd.com/coreRulebook/gettingStarted.html; page from https://aonprd.com/Rules.aspx?Name=Ability%20Scores&Category=Getting%20Started. The table itself is in `docs/ai/pf1-core-rules/pf1-tables.md` on `research/pf1-core-rules`.

> "The ability that governs bonus spells depends on what type of spellcaster your character is: Intelligence for wizards; Wisdom for clerics, druids, and rangers; and Charisma for bards, paladins, and sorcerers. In addition to having a high ability score, a spellcaster must be of a high enough class level to be able to cast spells of a given spell level. See the class descriptions in Classes for details."

FAQ CRB, "Bonus Spells from a High Ability Score" (posted July 2011), https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9o91:

> "No. You only get the bonus spells if your class level grants you access to those spell levels. You can't even use them for lower-level spells. ...
> Basically, ignore the columns for higher-level spells on table 1–3: Ability Modifiers and Bonus Spells until your class grants you access to those spell levels."

The entry's example: a 1st-level wizard with Intelligence 18 uses only the 1st-level bonus spell; the 2nd- and 3rd-level ones arrive at wizard levels 3 and 5. "—" in a class table means "no access to spells of this level".

### Where bonus spells go, per class type

- **Prepared casters** (cleric, druid, wizard, witch, magus, shaman, warpriest, adept, paladin, ranger, antipaladin): each Spells feature says the class "receives bonus spells per day if [it] has a high [ability] score". **Reading:** bonus spells add to that class's spells per day, that is, to the slots it prepares.
- **"0" entries (paladin, ranger, antipaladin, adept):** "When Table: Paladin indicates that the paladin gets 0 spells per day of a given spell level, she gains only the bonus spells she would be entitled to based on her Charisma score for that spell level." (CRB p. 60; the ranger, CRB p. 64, antipaladin, APG p. 118, and adept, CRB p. 448, say the same with their own table and ability.) A "0" is access with no base slot; a "—" is no access.
- **Spontaneous casters** (bard, sorcerer, inquisitor, oracle, summoner, unchained summoner, bloodrager, hunter, skald, medium, mesmerist, occultist, psychic, spiritualist): bonus spells add to spells per day. Spells known are not affected: "(Unlike spells per day, the number of spells a bard knows is not affected by his Charisma score. The numbers on Table: Bard Spells Known are fixed.)" (CRB p. 34; every spontaneous class has the same sentence for its own ability.)
- **Bloodrager exception wording:** "Unlike spells per day, the number of spells a bloodrager knows is not affected by his Charisma score, but it is affected by any bonus spells he gains from his bloodline." (ACG p. 15). "Bonus spells" here means the bloodline spells learned at 7th, 10th, 13th and 16th, not ability bonus spells.
- **Arcanist (hybrid):** bonus spells add to spells per day (casts). "Unlike the number of spells she can cast per day, the number of spells an arcanist can prepare each day is not affected by her Intelligence score." (ACG p. 8)
- **Extract casters:** "he receives bonus extracts per day if he has a high Intelligence score, in the same way a wizard receives bonus spells per day." (alchemist, APG p. 26; investigator, ACG p. 30)
- **Shaman spirit magic slots:** "She has one spell slot per day of each shaman spell level she can cast, not including orisons." (ACG p. 35) The text does not say whether ability bonus spells add spirit magic slots. **Open (S3).**
- **0-level spells:** Table 1–3 has no bonus at spell level 0 (its 0-level column is all "—", per `research/pf1-core-rules`).

### Minimum ability score

Every Spells feature sets a minimum: "To learn, prepare, or cast a spell, the wizard must have an Intelligence score equal to at least 10 + the spell level." (CRB p. 77). CRB p. 218, Spell Slots, for a caster below the minimum:

> "A spellcaster always has the option to fill a higher-level spell slot with a lower-level spell. A spellcaster who lacks a high enough ability score to cast spells that would otherwise be his due still gets the slots but must fill them with spells of lower levels."

The divine-spell section (CRB p. 220) repeats the paragraph.

## Topic: Preparing Spells

### Arcane (wizard)

Source: CRB p. 218, "Preparing Wizard Spells". PRD and page as above.

> "A wizard's level limits the number of spells he can prepare and cast. His high Intelligence score might allow him to prepare a few extra spells. He can prepare the same spell more than once, but each preparation counts as one spell toward his daily limit. To prepare a spell, the wizard must have an Intelligence score of at least 10 + the spell's level."

> "**Spell Selection and Preparation**: ... When preparing spells for the day, a wizard can leave some of these spell slots open. Later during that day, he can repeat the preparation process as often as he likes, time and circumstances permitting. During these extra sessions of preparation, the wizard can fill these unused spell slots. He cannot, however, abandon a previously prepared spell to replace it with another one or fill a slot that is empty because he has cast a spell in the meantime."

> "**Recent Casting Limit/Rest Interruptions**: ... When he prepares spells for the coming day, all the spells he has cast within the last 8 hours count against his daily limit."

FAQ CRB, "Preparing Spells in Open Slots" (posted August 2013), https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9qwu: "That text was written when wizard was the only class that prepares arcane spells. This option is also available to magus and witch characters (both of which are classes that prepare arcane spells)." Divine casters have the same open-slot rule in their own section (below).

### Divine

Source: CRB p. 220, "Preparing Divine Spells".

> "Divine spellcasters prepare their spells in largely the same manner as wizards do, but with a few differences. The relevant ability for most divine spells is Wisdom (Charisma for paladins). To prepare a divine spell, a character must have a Wisdom score (or Charisma score for paladins) of 10 + the spell's level. Likewise, bonus spells are based on Wisdom."

> "Divine spellcasters do not require spellbooks. However, a divine spellcaster's spell selection is limited to the spells on the list for her class."

> "**Spells Gained at a New Level**: Characters who can cast divine spells undertake a certain amount of study between adventures. Each time such a character receives a new level of divine spells, she learns all of the spells from that level automatically." (CRB p. 221)

- **Reading:** a prepared divine caster (cleric, druid, paladin, ranger, and by their own text antipaladin, shaman, warpriest and adept) has no spells-known list to store; it prepares from its whole class list at levels it can cast.

### Cantrips and orisons (prepared)

Wizard, CRB p. 77: "Wizards can prepare a number of cantrips, or 0-level spells, each day, as noted on Table: Wizard under "Spells per Day." These spells are cast like any other spell, but they are not expended when cast and may be used again. A wizard can prepare a cantrip from a prohibited school, but it uses up two of his available slots (see below)." The cleric (CRB p. 38) and druid (CRB p. 48) have the same wording for orisons, without the prohibited-school sentence.

- Later prepared classes add a metamagic clause. Witch (APG p. 65): "Cantrips prepared using other spell slots, due to metamagic feats for example, are expended normally." The CRB classes, magus, shaman and warpriest have no such clause. **Open (S4).**
- The wizard's cantrip sentence says "prohibited school"; the Arcane School feature it points to ("see below") uses "opposition schools" throughout. **Reading:** the same thing is meant; the CRB uses both words (the spellbook sentence also says "prohibited schools").
- The adept's table has a 0-level column but the adept has no Cantrips or Orisons feature, so the text never says adept 0-level spells are not expended. **Open (S5).**

## Topic: Spontaneous Casting

Source: CRB p. 220, "Sorcerers and Bards".

> "Sorcerers and bards cast arcane spells, but they do not use spellbooks or prepare spells. Their class level limits the number of spells she can cast (see these class descriptions). Her high Charisma score might allow her to cast a few extra spells. A member of either class must have a Charisma score of at least 10 + the spell's level to cast the spell."

> "**Adding Spells to a Sorcerer's or Bard's Repertoire**: A sorcerer or bard gains spells each time she attains a new level in her class and never gains spells any other way. When your sorcerer or bard gains a new level, consult Table: Bard Spells Known or Table: Sorcerer Spells Known to learn how many spells from the appropriate spell list she now knows. With permission from the GM, sorcerers and bards can also select the spells they gain from new and unusual spells that they come across while adventuring."

CRB p. 206, Choosing a Spell: "If you're a bard or sorcerer, you can select any spell you know, provided you are capable of casting spells of that level or higher." ... "If you're a bard or sorcerer, casting a spell counts against your daily limit for spells of that spell level, but you can cast the same spell again if you haven't reached your limit."

### Swapping spells known

Sorcerer, CRB p. 70:

> "Upon reaching 4th level, and at every even-numbered sorcerer level after that (6th, 8th, and so on), a sorcerer can choose to learn a new spell in place of one she already knows. In effect, the sorcerer loses the old spell in exchange for the new one. The new spell's level must be the same as that of the spell being exchanged. A sorcerer may swap only a single spell at any given level, and must choose whether or not to swap the spell at the same time that she gains new spells known for the level."

Bard, CRB p. 34:

> "Upon reaching 5th level, and at every third bard level after that (8th, 11th, and so on), a bard can choose to learn a new spell in place of one he already knows. ... The new spell's level must be the same as that of the spell being exchanged, and it must be at least one level lower than the highest-level bard spell the bard can cast. A bard may swap only a single spell at any given level and must choose whether or not to swap the spell at the same time that he gains new spells known for the level."

The schedule and the "one level lower" condition differ per class; `pf1-tables.md` has the full list. Spells a class adds automatically (bloodline, mystery, discipline spells, oracle cure/inflict, hunter *summon nature's ally*) cannot be swapped; each class says so.

### Spontaneous 0-level spells

Bard, CRB p. 34: "Bards learn a number of cantrips, or 0-level spells, as noted on Table: Bard Spells Known under "Spells Known." These spells are cast like any other spell, but they do not consume any slots and may be used again." The sorcerer (CRB p. 70) is the same. Later spontaneous classes add a metamagic clause, for example the inquisitor (APG p. 38): "Orisons prepared using other spell slots, such as those due to metamagic feats, are expended normally." Classes with and without the clause are listed in `pf1-tables.md`.

### Spells known from outside the class list

FAQ CRB, "New Spells Known" (posted July 2014), https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9s54:

> "No. Adding a spell to your list of spells known does not add it to the spell list of that class unless they are added by a class feature of that same class. For example, sorcerers add their bloodline spells to their sorcerer spell list and oracles add their mystery spells to their oracle spell list. The spell slots of a class can only be used to cast spells that appear on the spell list of that class."

### Feats that raise spells known

Expanded Arcana (APG p. 159), https://aonprd.com/FeatDisplay.aspx?ItemName=Expanded%20Arcana:

> "**Benefit**: Add one spell from your class's spell list to your list of spells known. This is in addition to the number of spells normally gained at each new level in your class. You may instead add two spells from your class's spell list to your list of spells known, but both of these spells must be at least one level lower than the highest level spell you can cast in that class. Once made, these choices cannot be changed.
> **Special**: You can only take this feat if you possess levels in a class whose spellcasting relies on a limited list of spells known, such as the bard, oracle, and sorcerer.
> You can gain Expanded Arcana multiple times."

The arcanist redirects such effects (ACG p. 8): "Feats and other effects that modify the number of spells known by a spellcaster instead affect the number of spells an arcanist can prepare."

## Topic: Spellbooks

### Magic chapter rules

Source: CRB pp. 218–220, "Arcane Magical Writings" to "Selling a Spellbook". PRD and page as above.

> "**Spells Gained at a New Level**: Wizards perform a certain amount of spell research between adventures. Each time a character attains a new wizard level, he gains two spells of his choice to add to his spellbook. The two free spells must be of spell levels he can cast."

> "**Spells Copied from Another's Spellbook or a Scroll**: ... he must spend 1 hour studying the spell. At the end of the hour, he must make a Spellcraft check (DC 15 + spell's level). A wizard who has specialized in a school of spells gains a +2 bonus on the Spellcraft check if the new spell is from his specialty school. If the check succeeds, the wizard understands the spell and can copy it into his spellbook ... a spell successfully copied from a magic scroll disappears from the parchment.
> If the check fails, the wizard cannot understand or copy the spell. He cannot attempt to learn or copy that spell again until one week has passed."

> "In most cases, wizards charge a fee for the privilege of copying spells from their spellbooks. This fee is usually equal to half the cost to write the spell into a spellbook ... Rare and unique spells might cost significantly more."

> "**Time**: The process takes 1 hour per spell level. Cantrips (0 levels spells) take 30 minutes to record.
> **Space in the Spellbook**: A spell takes up one page of the spellbook per spell level. Even a 0-level spell (cantrip) takes one page. A spellbook has 100 pages.
> **Materials and Costs**: The cost for writing a new spell into a spellbook depends on the level of the spell, as noted on the following table. Note that a wizard does not have to pay these costs in time or gold for spells he gains for free at each new level."

> "Duplicating an existing spellbook uses the same procedure as replacing it, but the task is much easier. The time requirement and cost per page are halved."

> "Captured spellbooks can be sold for an amount equal to half the cost of purchasing and inscribing the spells within."

The writing-cost table is in `pf1-tables.md`. A blank spellbook costs 15 gp and weighs 3 lbs. (CRB equipment, "Spellbook, wizard's (blank)", PRD https://legacy.aonprd.com/coreRulebook/equipment.html; page not verified).

### Wizard class feature

CRB p. 77, Spellbooks:

> "A wizard must study his spellbook each day to prepare his spells. He cannot prepare any spell not recorded in his spellbook, except for *read magic*, which all wizards can prepare from memory.
> A wizard begins play with a spellbook containing all 0-level wizard spells (except those from his prohibited schools, if any; see Arcane Schools) plus three 1st-level spells of his choice. The wizard also selects a number of additional 1st-level spells equal to his Intelligence modifier to add to the spellbook. At each new wizard level, he gains two new spells of any spell level or levels that he can cast (based on his new wizard level) for his spellbook. At any time, a wizard can also add spells found in other wizards' spellbooks to his own (see Magic)."

CRB p. 219: "A wizard can only learn new spells that belong to the wizard spell lists."

### Spell Mastery

CRB p. 134, https://aonprd.com/FeatDisplay.aspx?ItemName=Spell%20Mastery:

> "**Prerequisites**: 1st-level wizard
> **Benefit**: Each time you take this feat, choose a number of spells that you already know equal to your Intelligence modifier. From that point on, you can prepare these spells without referring to a spellbook.
> **Normal**: Without this feat, you must use a spellbook to prepare all your spells, except *read magic*."

FAQ CRB, "Spell Mastery: Can an alchemist, magus, or witch select this feat?" (posted May 2013), https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9qny: "As written, no, as the feat's prerequisite is "1st-level wizard." However, ... it is a perfectly reasonable house rule to allow those classes to select the feat".

The wizard's bonus feats (5th, 10th, 15th, 20th) may be "a metamagic feat, an item creation feat, or Spell Mastery" (CRB p. 77).

### Other book-like stores

- **Magus** (UM p. 9): "A magus begins play with a spellbook containing all 0-level magus spells plus three 1st-level magus spells of his choice. The magus also selects a number of additional 1st-level magus spells equal to his Intelligence modifier ... At each new magus level, he gains two new magus spells of any spell level or levels that he can cast". "A magus can learn spells from a wizard's spellbook, just as a wizard can from a magus's spellbook. The spells learned must be on the magus spell list, as normal. An alchemist ... can learn formulae from a magus's spellbook, if the spells are also on the alchemist spell list. A magus cannot learn spells from an alchemist." Knowledge Pool (7th level) lets him "treat any one spell from the magus spell list as if it were in his spellbook" per arcane pool point for that day.
- **Arcanist** (ACG p. 8): spellbook "containing all 0-level wizard/sorcerer spells plus three 1st-level spells of her choice", plus Int modifier 1st-level spells, plus "two new spells of any spell level or levels that she can cast" per level; "can also add spells found in wizards' or other arcanists' spellbooks to her own".
- **Alchemist formula book** (APG p. 26): "An alchemist begins play with two 1st-level formulae of his choice, plus a number of additional forumlae equal to his Intelligence modifier. At each new alchemist level, he gains one new formula of any level that he can create. An alchemist can also add formulae to his book just like a wizard adds spells to his spellbook, using the same costs, pages, and time requirements. An alchemist can study a wizard's spellbook to learn any formula that is equivalent to a spell the spellbook contains. A wizard, however, cannot learn spells from a formula book. An alchemist does not need to decipher arcane writings before copying them."
- **Investigator formula book** (ACG p. 30): same start (two 1st-level formulae plus Int modifier) and one formula per level; "A formula book costs as much as a spellbook." "An investigator can also learn formulae from another investigator's or an alchemist's formula book (and vice versa)."
- **Witch's familiar** (APG p. 65): "Familiars store all of the spells that a witch knows, and a witch cannot prepare a spell that is not stored by her familiar. A witch's familiar begins play storing all of the 0-level witch spells plus three 1st-level spells of the witch's choice. The witch also selects a number of additional 1st-level spells equal to her Intelligence modifier to store in her familiar. At each new witch level, she adds two new spells of any spell level or levels that she can cast (based on her new witch level) to her familiar." Patron spells "are also automatically added to the list of spells stored by the familiar." Additional spells come from "Familiar Teaching Familiar" or "Learn from a Scroll" (each 1 hour per spell level and a Spellcraft check, DC 15 + spell level). A replacement familiar "begins knowing all of the 0-level spells plus two spells of every level the witch is able to cast" plus patron spells.

## Topic: Domain, School and Similar Extra Slots

- **Cleric domains** (CRB p. 38): "A cleric gains one domain spell slot for each level of cleric spell she can cast, from 1st on up. Each day, a cleric can prepare one of the spells from her two domains in that slot. If a domain spell is not on the cleric spell list, a cleric can prepare it only in her domain spell slot. Domain spells cannot be used to cast spells spontaneously."
- **Druid domain option** (CRB p. 48, Nature Bond): "When determining the powers and bonus spells granted by this domain, the druid's effective cleric level is equal to her druid level. A druid that selects this option also receives additional domain spell slots, just like a cleric. She must prepare the spell from her domain in this slot and this spell cannot be used to cast a spell spontaneously."
- **Any domain gained elsewhere** — FAQ APG, "Paladin: The sacred servant archetype ... gets a domain" (posted August 2010), https://paizo.com/paizo/faq/v5748nruor1fn#v5748eaic9n9z: "Unless the text specifically says otherwise, when a character gains a cleric domain, they gain all benefits associated with that domain: granted powers, access to domain spells, and a domain spell slot at each spell level they can cast."
- **Inquisitor domain** (APG p. 38): "An inquisitor does not gain the bonus spells listed for each domain, nor does she gain bonus spell slots. ... Levels of cleric and inquisitor stack for the purpose of determining domain powers and abilities, but not for bonus spells."
- **Wizard school slot and opposition schools** (CRB p. 77): "A wizard who prepares spells from his opposition schools must use two spell slots of that level to prepare the spell." "specialist wizards receive an additional spell slot of each spell level he can cast, from 1st on up. Each day, a wizard can prepare a spell from his specialty school in that slot. This spell must be in the wizard's spellbook. A wizard can select a spell modified by a metamagic feat to prepare in his school slot, but it uses up a higher-level spell slot. Wizards with the universalist school do not receive a school slot."
- **Shaman spirit magic** (ACG p. 35): "A shaman can spontaneously cast a limited number of spells per day beyond those she prepared ahead of time. She has one spell slot per day of each shaman spell level she can cast, not including orisons. She can choose these spells from the list of spells granted by her spirits (see the spirit class feature and the wandering spirit class feature) at the time she casts them. She can enhance these spells using any metamagic feat that she knows, using up a higher-level spell slot as required by the feat and increasing the time to cast the spell". The wandering spirit (4th level) is chosen "each day when preparing her spells" and adds its spells to spirit magic.

## Topic: Spontaneous Conversion of Prepared Spells

- **Cleric** (CRB p. 38): "A good cleric (or a neutral cleric of a good deity) can channel stored spell energy into healing spells that she did not prepare ahead of time. The cleric can "lose" any prepared spell that is not an orison or domain spell in order to cast any cure spell of the same spell level or lower (a cure spell is any spell with "cure" in its name)." Evil clerics convert to inflict spells; a cleric "who is neither good nor evil and whose deity is neither good nor evil can convert spells to either cure spells or inflict spells (player's choice). Once the player makes this choice, it cannot be reversed. This choice also determines whether the cleric channels positive or negative energy".
- The Magic chapter (CRB p. 220) words it from the other side: "can spontaneously cast a cure spell in place of a prepared spell of the same level or higher, but not in place of a bonus domain spell." It does not mention orisons; the class text excludes them. **Reading:** the class text is the narrower rule and does not conflict.
- **Druid** (CRB p. 48): "She can "lose" a prepared spell in order to cast any *summon nature's ally* spell of the same level or lower." Domain-slot spells excepted (Nature Bond, above).
- **Warpriest** (ACG p. 60): "The warpriest can expend any prepared spell that isn't an orison to cast any cure spell of the same spell level or lower." Evil and neutral wording as the cleric's.
- **Adept** (CRB p. 448): "Unlike a cleric, an adept cannot spontaneously cast *cure* or *inflict* spells."
- **Other classes' slots** — FAQ CRB, "Spontaneous Casting and Multiple Classes" (posted July 2014), https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9s55: "No. This is only possible if you have a class feature that explicitly allows it, such as Combined Spells. This applies even if the two classes share a spell list or if one of the classes allows you to spontaneously convert that class's spell slots into certain spells on that class's spell list, such as cleric and druid."

## Topic: Metamagic

Source: CRB pp. 112–113, "Metamagic Feats" (the arcanist and shaman texts cite "Spontaneous Casting and Metamagic Feats on page 113 of the *Core Rulebook*"). PRD https://legacy.aonprd.com/coreRulebook/feats.html.

> "Spells modified by a metamagic feat use a spell slot higher than normal. This does not change the level of the spell, so the DC for saving throws against it does not go up. Metamagic feats do not affect spell-like abilities."

> "**Wizards and Divine Spellcasters**: Wizards and divine spellcasters must prepare their spells in advance. During preparation, the character chooses which spells to prepare with metamagic feats (and thus which ones take up higher-level spell slots than normal)."

> "**Sorcerers and Bards**: Sorcerers and bards choose spells as they cast them. They can choose when they cast their spells whether to apply their metamagic feats to improve them. As with other spellcasters, the improved spell uses up a higher-level spell slot. Because the sorcerer or bard has not prepared the spell in a metamagic form in advance, he must apply the metamagic feat on the spot. Therefore, such a character must also take more time to cast a metamagic spell (one enhanced by a metamagic feat) than he does to cast a regular spell. If the spell's normal casting time is a standard action, casting a metamagic version is a full-round action for a sorcerer or bard. (This isn't the same as a 1-round casting time.) The only exception is for spells modified by the Quicken Spell metamagic feat, which can be cast as normal using the feat.
> For a spell with a longer casting time, it takes an extra full-round action to cast the spell."

> "**Spontaneous Casting and Metamagic Feats**: A cleric spontaneously casting a cure or inflict spell, or a druid spontaneously casting a *summon nature's ally* spell, can cast a metamagic version of it instead. Extra time is also required in this case. Casting a standard action metamagic spell spontaneously is a full-round action, and a spell with a longer casting time takes an extra full-round action to cast. The only exception is for spells modified by the Quicken Spell feat, which can be cast as a swift action."

> "**Effects of Metamagic Feats on a Spell**: In all ways, a metamagic spell operates at its original spell level, even though it is prepared and cast using a higher-level spell slot. Saving throw modifications are not changed unless stated otherwise in the feat description."

> "**Multiple Metamagic Feats on a Spell**: A spellcaster can apply multiple metamagic feats to a single spell. Changes to its level are cumulative. You can't apply the same metamagic feat more than once to a single spell."

- **Reading for the sheet:** a prepared slot holds (spell, metamagic feats applied); its slot level is the spell's level plus each feat's adjustment. A spontaneous caster stores no metamagic in advance; it applies it when casting, using a higher-level slot.
- **Arcanist** (ACG p. 8): "Like a sorcerer, an arcanist can choose to apply any metamagic feats she knows to a prepared spell as she casts it, with the same increase in casting time ... However, she may also prepare a spell with any metamagic feats she knows and cast it without increasing casting time like a wizard. She cannot combine these options—a spell prepared with metamagic feats cannot be further modified with another metamagic feat at the time of casting (unless she has the metamixing arcanist exploit, detailed below)."

### Heighten Spell

CRB p. 126: "A heightened spell has a higher spell level than normal (up to a maximum of 9th level). Unlike other metamagic feats, Heighten Spell actually increases the effective level of the spell that it modifies. All effects dependent on spell level (such as saving throw DCs and ability to penetrate a *lesser globe of invulnerability*) are calculated according to the heightened level. The heightened spell is as difficult to prepare and cast as a spell of its effective level."

FAQ CRB, "Heighten Spell" (posted June 2013), https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9qpo (excerpt): "*having Heighten Spell doesn't mean any spell you cast with a higher-level slot is automatically heightened*; you still have to make the decision to prepare or cast the spell an normal or heightened." ... "If you are a spontaneous caster, heightening a spell when using a higher-level spell slot still increases the casting time, just like any other use of metamagic". "*you can't apply Heighten Spell to a spell at no cost*: any increase to the effective spell level of the spell must be tracked and paid for by using a higher-level spell slot, above and beyond any other spell level increases from the other metamagic feats." Example: a quickened *fireball* needs a 7th-level slot and keeps "the DC of a 3rd-level spell"; heightened to 4th as well, it needs an 8th-level slot.

### Metamagic level reducers

Magical Lineage (trait; APG p. 329, UC p. 57), https://aonprd.com/TraitDisplay.aspx?ItemName=Magical%20Lineage: "Pick one spell when you choose this trait. When you apply metamagic feats to this spell that add at least 1 level to the spell, treat its actual level as 1 lower for determining the spell's final adjusted level." FAQ APG, "Magical Lineage (trait)" (posted May 2013), https://paizo.com/paizo/faq/v5748nruor1fn#v5748eaic9qns: "No. For example, it won't allow you to alter a wizard's *fireball* into 2nd-level spell."

## Topic: Multiclass Spellcasters

No CRB section is titled for multiclass spellcasters. The rules come from the per-class wording and the FAQ.

- Caster level is per class: "equal to her class level in the class she's using to cast the spell" (CRB p. 208).
- Slots are per class: each Spells feature gives "Her base daily spell allotment ... on Table: [Class]", and the FAQ "Spontaneous Casting and Multiple Classes" (above) forbids casting one class's spells with another class's slots without an explicit feature such as Combined Spells.
- Spell lists are per class: FAQ "New Spells Known" (above): "The spell slots of a class can only be used to cast spells that appear on the spell list of that class."
- Bonus spells are per class: each class's Spells feature grants them from its own table and ability. **Reading:** a cleric/wizard gets Wisdom bonus spells on cleric slots and Intelligence bonus spells on wizard slots.
- Class features that modify spellcasting reach all classes. FAQ CRB, "Sorcerer: Do the bonuses granted from Bloodline Arcana apply to all of the spells cast by the sorcerer" (posted October 2010), https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9ne8:

  > "General rule: If a class ability modifies your spellcasting, it applies to your spells from all classes, not just spells from the class that grants the ability. (The exception is if the class ability specifically says it only applies to spells from that class.)"

- Arcane spell failure across classes: "A multiclass bard still incurs the normal arcane spell failure chance for arcane spells received from other classes." (CRB p. 34; the magus has the same sentence, UM p. 9.)
- Classes that must match: "If the bloodrager takes levels in another class that grants a bloodline, the bloodlines must be the same type, even if that means that the bloodline of one of the classes must change." (ACG p. 15) "If the shaman takes levels in another class that grants a mystery (such as the oracle), the spirit and mystery must match" (ACG p. 35). An inquisitor with cleric levels: "one of her two domain selections must be the same domain selected as an inquisitor" (APG p. 38).
- Items as spellcasting — FAQ CRB, "Items as Spells" (posted August 2010), https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9n9y: "Unless they specifically state otherwise, feats and abilities that modify spells you cast only affect actual spellcasting, not using magic items that emulate spellcasting or work like spellcasting."

## Topic: Prestige Classes That Advance Spellcasting

### The standard ability

Eldritch knight (CRB p. 384), https://aonprd.com/PrestigeClassesDisplay.aspx?ItemName=Eldritch%20Knight (the arcane archer, CRB p. 374, and dragon disciple, CRB p. 380, use the same paragraph with their own name):

> "**Spells per Day**: At the indicated levels, an eldritch knight gains new spells per day as if he had also gained a level in an arcane spellcasting class he belonged to before adding the prestige class. He does not, however, gain any other benefit a character of that class would have gained, except for additional spells per day, spells known (if he is a spontaneous spellcaster), and an increased effective level of spellcasting. If a character had more than one arcane spellcasting class before becoming an eldritch knight, he must decide to which class he adds the new level for purposes of determining spells per day."

The class table writes this per level as "+1 level of existing arcane spellcasting class". The eldritch knight's 1st level and the dragon disciple's 1st, 5th and 9th levels give none.

- **How the class is chosen:** it must be a class of the stated kind ("arcane spellcasting class", or divine where a prestige class says so) "he belonged to before adding the prestige class". If there is more than one, the player "must decide to which class he adds the new level". **Reading:** the choice is made per prestige level ("the new level"), and a casting class first taken after entering the prestige class cannot receive it. Whether a later prestige level may go to a different eligible class than an earlier one is not stated. **Open (S6).**
- **What advances:** spells per day, spells known for spontaneous casters, and "an increased effective level of spellcasting" (caster level). FAQ CRB "Prestige Class" (posted October 2013, `v5748eaic9rae`) and "Prestige Classes and Spellcasters" (posted November 2010, `v5748eaic9nib`), and FAQ APG "Witch" (posted November 2010, `v5748eaic9nii`), are quoted in `docs/ai/pf1-archetype-prestige-trait-rules/pf1-rules.md`. Their effect: no bloodline spells or feats, no mystery spells, no patron spells, no school powers, no free spellbook spells; "Prestige classes which advance spellcasting only advance caster level, spells per day, and (for spontaneous casters) spells known—essentially, the spellcasting features described in your class's Spells class feature description." The same October 2013 entry adds that an oracle's higher-level *cure* or *inflict* spells do come, "as those are part of the oracle's Spells class feature".
- Dragon disciple's blood of dragons is an explicit exception (CRB p. 380): "A dragon disciple adds his level to his sorcerer levels when determining the powers gained from his bloodline. ... This ability does not grant bonus spells to a sorcerer unless he possesses spell slots of an appropriate level. Such bonus spells are automatically granted if the sorcerer gains spell slots of the spell's level." FAQ ACG (posted July 2015, https://paizo.com/paizo/faq/v5748nruor1gw#v5748eaic9tml): "Yes, dragon disciple's blood of dragons ability should also increase draconic bloodragers' bloodline powers."

### Two classes at once (mystic theurge)

CRB p. 387, https://aonprd.com/PrestigeClassesDisplay.aspx?ItemName=Mystic%20Theurge. Requirement: "**Spells**: Able to cast 2nd-level divine spells and 2nd-level arcane spells."

> "**Spells per Day**: When a new mystic theurge level is gained, the character gains new spells per day as if he had also gained a level in any one arcane spellcasting class he belonged to before he added the prestige class and any one divine spellcasting class he belonged to previously. He does not, however, gain other benefits a character of that class would have gained. This essentially means that he adds the level of mystic theurge to the level of whatever other arcane spellcasting class and divine spellcasting class the character has, then determines spells per day, spells known, and caster level accordingly. If a character had more than one arcane spellcasting class or more than one divine spellcasting class before he became a mystic theurge, he must decide to which class he adds each level of mystic theurge for the purpose of determining spells per day."

Every mystic theurge level, 1st to 10th, advances one arcane and one divine class. Combined Spells lets him prepare or cast spells of one class with another class's slots one level higher. AoN prints a second paragraph the 2019 PRD lacks:

> "Spontaneous spellcasters can only select spells that they have prepared that day using non-spontaneous classes for this ability, even if the spells have already been cast. For example, a cleric/sorcerer/mystic theurge can use this ability to spontaneously cast a *bless* spell using a 2nd-level sorcerer spell slot, if the character had a prepared *bless* spell using a 1st-level cleric spell slot, even if that spell had already been cast that day."

FAQ CRB, "Mystic Theurge: How does the second paragraph affect dual-spontaneous casters" (posted August 2013), https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9qx6, restates it: "*If one of the theurge's spellcasting classes is a non-spontaneous spellcaster (such as a cleric) and the other is a spontaneous caster (such as a sorcerer), he can only spontaneously cast spells from the non-spontaneous class that he actually prepared that day (whether or not he has cast those prepared spells).*"

### "Arcane", "divine" and other kinds of caster

- "Arcane" and "divine" come from each class's Spells feature ("A wizard casts arcane spells", "A cleric casts divine spells"). CRB p. 206: "Spells come in two types: arcane (cast by bards, sorcerers, and wizards) and divine (cast by clerics, druids, and experienced paladins and rangers)." The kind per class is in `pf1-tables.md`.
- Psychic casters (medium, mesmerist, occultist, psychic, spiritualist) — OA p. 144: "Psychic spellcasters aren't affected by effects that target only arcane or divine spellcasters, nor can they use arcane or divine scrolls or other items or feats that state they can be utilized by only arcane or divine spellcasters." **Reading:** a "+1 level of existing arcane (or divine) spellcasting class" cannot go to a psychic class. The text speaks of "effects", "items or feats", not prestige class levels. **Open (S7)** for the strict wording.
- Spell-like abilities never satisfy "Ability to cast arcane spells" (FAQ CRB `v5748eaic9qow`, quoted in the archetype corpus).
- Alchemists — FAQ APG, "Alchemist: Is an alchemist a spellcaster for the purpose of crafting magic items other than potions?" (posted March 2013), https://paizo.com/paizo/faq/v5748nruor1fn#v5748eaic9qdk: "As written, no, alchemists are not spellcasters, and therefore can't select feats such as Craft Wondrous Item." Whether a "+1 level of existing arcane spellcasting class" can go to an alchemist or investigator is not stated. **Open (S8).**
- A class that changes its kind of magic through an option: FAQ OA, "Psychic Bloodline Sorcerer" (posted July 2016), https://paizo.com/paizo/faq/v5748nruor1h5#v5748eaic9utw, says a psychic-bloodline sorcerer is not the "arcane spellcasting class sorcerer" for an ability that named it, because the bloodline changes the spells to psychic. **Reading:** the kind a prestige level needs is the kind the character's class actually casts, after archetypes and bloodlines.

### Gaps in the standard ability

- **Classes without spells yet.** A paladin, ranger, antipaladin or bloodrager of levels 1 to 3 "belongs to" a divine or arcane spellcasting class but has no spells. Whether such a class can take the "+1 level" is not stated. **Open (S9).**
- **Class offsets.** For a paladin advanced by prestige levels, the text does not say whether "paladin level – 3" uses the paladin level alone or paladin plus prestige levels. **Reading:** the mystic theurge text ("adds the level of mystic theurge to the level of whatever other ... class ... then determines spells per day, spells known, and caster level accordingly") suggests the sum, but only the mystic theurge says this. **Open (S10).**
- **Beyond 20th.** Class tables stop at 20. The text does not say what a 20th-level class plus prestige levels yields. **Open (S11).**
- **Arcanist and other hybrid counts.** The standard ability names "spells known (if he is a spontaneous spellcaster)". The arcanist's daily preparation count (Table 1–2) is in its Spells feature, which the October 2013 FAQ says advances, but the arcanist is not a spontaneous caster. **Open (S12).**

## Topic: The CRB Classes' Spells Sections

Full Spells paragraphs are in each class entry: bard CRB p. 34, cleric p. 38, druid p. 48, paladin p. 60, ranger p. 64, sorcerer p. 70, wizard p. 77 (pages from https://aonprd.com/ClassDisplay.aspx?ItemName=<Class>; PRD https://legacy.aonprd.com/coreRulebook/classes/<class>.html). Each repeats the generic pattern (list, minimum ability, DC, spells per day from the class table, bonus spells). Quoted above where they matter: minimum ability and DC (Save DC), swap schedules (Spontaneous Casting), domains and school slots, spontaneous cure/inflict and *summon nature's ally*, cantrips and orisons, paladin and ranger caster level. The remaining class-specific sentences:

- **Bard** (CRB p. 34): "A bard begins play knowing four 0-level spells and two 1st-level spells of the bard's choice. At each new bard level, he gains one or more new spells, as indicated on Table: Bard Spells Known." "Every bard spell has a verbal component (song, recitation, or music)."
- **Cleric** (CRB p. 38): "Each cleric must choose a time when she must spend 1 hour each day in quiet contemplation or supplication to regain her daily allotment of spells. A cleric may prepare and cast any spell on the cleric spell list, provided that she can cast spells of that level". "A cleric can't cast spells of an alignment opposed to her own or her deity's (if she has one)." The druid has the same alignment rule (CRB p. 48).
- **Paladin and ranger:** prepared, from 4th level, with the "0" rule and the "– 3" caster level quoted above. "A paladin may prepare and cast any spell on the paladin spell list, provided that she can cast spells of that level".
- **Sorcerer** (CRB p. 70): "A sorcerer begins play knowing four 0-level spells and two 1st-level spells of her choice. ... These new spells can be common spells chosen from the sorcerer/wizard spell list, or they can be unusual spells that the sorcerer has gained some understanding of through study." Bloodline: "At 3rd level, and every two levels thereafter, a sorcerer learns an additional spell, derived from her bloodline. These spells are in addition to the number of spells given on Table: Sorcerer Spells Known. These spells cannot be exchanged for different spells at higher levels." FAQ APG (posted February 2012, `v5748eaic9oyl`): the aquatic bloodline's *geyser* at sorcerer level 9 is learned "as a 4th-level spell", showing a bloodline spell can sit at a different level than on the sorcerer/wizard list.
- **Wizard** (CRB p. 77): "A wizard may know any number of spells. He must choose and prepare his spells ahead of time by getting 8 hours of sleep and spending 1 hour studying his spellbook." Arcane bond object: "A bonded object can be used once per day to cast any one spell that the wizard has in his spellbook and is capable of casting, even if the spell is not prepared. ... This spell cannot be modified by metamagic feats or other abilities. The bonded object cannot be used to cast spells from the wizard's opposition schools".

## Topic: Non-CRB Casting Classes

Each class is admitted for its own spellcasting only. Pages are the class entry's first page as AoN prints it (`https://aonprd.com/ClassDisplay.aspx?ItemName=<Class>`). Every class below has the generic minimum-ability sentence and the DC sentence with its own ability, and bonus spells from Table 1–3; those are not repeated. What follows is what each class prepares, knows or writes down, and how it differs from the CRB pattern. Per-class numbers (spell levels, first level, swap schedule, 0-level name) are in `pf1-tables.md`.

- **Alchemist** (APG p. 26). Extracts, not spells: "In effect, an alchemist prepares his spells by mixing ingredients into a number of extracts, and then "casts" his spells by drinking the extract." "Although the alchemist doesn't actually cast spells, he does have a formulae list that determines what extracts he can create." "An extract is "cast" by drinking it, as if imbibing a potion—the effects of an extract exactly duplicate the spell upon which its formula is based, save that the spell always affects only the drinking alchemist." "Mixing an extract takes 1 minute of work ... it's not uncommon for an alchemist to keep some (or even all) of his daily extract slots open so that he can prepare extracts in the field as needed." No 0-level extracts. Formula book above.
- **Investigator** (ACG p. 30). "Like an alchemist, an investigator prepares his spells by mixing ingredients ... into a number of extracts". "An investigator uses the alchemist formula list to determine the extracts he can know." No 0-level extracts.
- **Inquisitor** (APG p. 38). Spontaneous divine, Wisdom: "She can cast any spell she knows at any time without preparing it ahead of time". Domain without bonus spells or slots (above).
- **Oracle** (APG p. 42). Spontaneous divine from the cleric list, Charisma. "each oracle also adds all of either the cure spells or the inflict spells to her list of spells known ... These spells are added as soon as the oracle is capable of casting them. This choice is made when the oracle gains her first level and cannot be changed." Mystery: "At 2nd level, and every two levels thereafter, an oracle learns an additional spell derived from her mystery. These spells are in addition to the number of spells given on Table 2–6. They cannot be exchanged for different spells at higher levels." "Oracles do not need to provide a divine focus to cast spells that list divine focus (DF) as part of the components."
- **Summoner** (APG p. 54) and **unchained summoner** (PU p. 25). Spontaneous arcane, Charisma, 6 spell levels. "(The unchained summoner's spell list is different from that presented in the *Advanced Player's Guide*.)" Tables: `pf1-tables.md` (the unchained summoner's are identical to the bard's).
- **Witch** (APG p. 65). Prepared arcane, Intelligence, 9 levels; the familiar is the spellbook: "She must choose and prepare her spells ahead of time by getting 8 hours of sleep and spending 1 hour communing with her familiar." Patron spells: "At 2nd level, and every two levels thereafter, a witch's patron adds new spells to a witch's list of spells known." Open slots allowed (FAQ above).
- **Magus** (UM p. 9). Prepared arcane, Intelligence, 6 levels, spellbook, open slots allowed. "He can cast magus spells while wearing light armor without incurring the normal arcane spell failure chance" (medium armor at 7th, heavy at 13th). Spell Recall (4th): "he can recall any single magus spell that he has already prepared and cast that day by expending a number of points from his arcane pool equal to the spell's level (minimum 1)."
- **Antipaladin** (APG p. 118). As the paladin: prepared divine, Charisma, from 4th level, "His base daily spell allotment is the same as that of a paladin", the "0" rule, caster level antipaladin level – 3.
- **Arcanist** (ACG p. 8). Hybrid: "An arcanist must prepare her spells ahead of time, but unlike a wizard, her spells are not expended when they're cast. Instead, she can cast any spell that she has prepared consuming a spell slot of the appropriate level". "At 1st level, she can prepare four 0-level spells and two 1st-level spells each day. At each new arcanist level, the number of spells she can prepare each day increases, adding new spell levels as indicated on Table 1–2." Cantrips "do not consume spell slots". Arcane reservoir: "the arcanist can expend 1 point from her arcane reservoir as a free action whenever she casts an arcanist spell. If she does, she can choose to increase the caster level by 1 or increase the spell's DC by 1. She can expend no more than 1 point from her reservoir on a given spell in this way." Consume Spells (1st) spends an unused slot for reservoir points.
- **Bloodrager** (ACG p. 15). Spontaneous arcane, Charisma, from 4th level, 4 spell levels; caster level above. "At 4th level, a bloodrager knows two 1st-level spells of his choice." Bloodline spells at 7th, 10th, 13th and 16th "in addition to the number of spells given on Table 1–4". "At 8th level and every 3 levels thereafter, a bloodrager can choose to learn a new spell in place of one he already knows. This swap follows all the same rules as for a sorcerer." No 0-level spells. Unlike the paladin, his table gives 1 spell per day at 4th level, not 0.
- **Hunter** (ACG p. 26). Spontaneous divine, Wisdom, 6 levels, from two lists: "Only druid spells of 6th level and lower and ranger spells are considered to be part of the hunter spell list. If a spell appears on both the druid and ranger spell lists, the hunter uses the lower of the two spell levels listed for the spell." "each hunter also automatically adds all *summon nature's ally* spells to her list of spells known. These spells are added as soon as the hunter is capable of casting them." Swap: "At 5th level and at every 3 levels thereafter ... The new spell's level must be the same as that of the spell being exchanged." (no "one level lower" condition).
- **Shaman** (ACG p. 35). Prepared divine, Wisdom, 9 levels, prepares from the whole shaman list ("A shaman can prepare and cast any spell on the shaman spell list"), plus spirit magic slots (above). FAQ ACG (posted August 2017, `v5748eaic9vv1`): "An oracle doesn't prepare spells", so a spirit guide oracle's "arcane enlightenment" hex adds nothing.
- **Skald** (ACG p. 49). Spontaneous arcane from the bard list, Charisma; bard pattern including the "one level lower" swap.
- **Warpriest** (ACG p. 60). Prepared divine from the cleric list, Wisdom: "A warpriest's highest level of spells is 6th. Cleric spells of 7th level and above are not on the warpriest class spell list". Spontaneous cure/inflict (above). No domain slots.
- **Medium** (OA p. 30). Spontaneous psychic, Charisma, 4 levels, knacks from 1st: "At 1st level, a medium knows two 0-level spells of his choice." Swap at 5th and every 3 levels, same level, with no "one level lower" condition. First 1st-level spell at 4th level (1 per day).
- **Mesmerist** (OA p. 38). Spontaneous psychic, Charisma, 6 levels, bard pattern with "one level lower" swap.
- **Occultist** (OA p. 46). Spontaneous psychic, Intelligence, 6 levels, no spells-known table: "For each implement school he learns to use, he can add one spell of each level he can cast to his list of spells known, chosen from that school's spell list. If he selects the same implement school multiple times, he adds one spell of each level from that school's list for each time he has selected that school." Implement schools: "At 1st level, an occultist learns to use two implement schools. At 2nd level and every 4 occultist levels thereafter, the occultist learns to use one additional implement school, to a maximum of seven schools at 18th level." "No spells from any other school are considered to be on the occultist's spell list until he selects the associated implement school." Knacks: "An occultist learns one knack, or 0-level psychic spell, each time he selects an implement school". Swap: "The spell learned must come from the same list of spells provided by the implement school of the spell lost."
- **Psychic** (OA p. 60). Spontaneous psychic, Intelligence, 9 levels. Discipline spells: "At 1st level, a psychic learns an additional spell determined by her discipline. She learns another additional spell at 4th level and every 2 levels thereafter, until learning the final one at 18th level. These spells are in addition to the number of spells given on Table 1–8. Spells learned from a discipline can't be exchanged". Swap at 4th and even levels, with the "1 level lower" condition (unlike the sorcerer and oracle).
- **Spiritualist** (OA p. 72). Spontaneous psychic, Wisdom, 6 levels, bard pattern with "1 level lower" swap.
- **Adept** (CRB p. 448, NPC class). Prepared divine, Wisdom, 0 to 5th level, "0" rule: "Like a cleric, an adept must choose and prepare her spells in advance. Unlike a cleric, an adept cannot spontaneously cast *cure* or *inflict* spells." "Adepts, unlike wizards, do not acquire their spells from books or scrolls, nor do they prepare them through study. Instead, they meditate or pray for their spells". Table in `pf1-tables.md`.

## Topic: Psychic Magic

Source: OA p. 144, "Psychic Magic", https://aonprd.com/Rules.aspx?Name=Psychic%20Magic&Category=Occult%20Rules; PRD https://legacy.aonprd.com/occultAdventures/psychicMagic.html.

> "A psychic spell largely functions like any other spell. It's another type of magic, similar to arcane or divine magic ... Metamagic feats and any other rules that alter or trigger from spells can usually be used with psychic spells (though see the Components section below for a few exceptions). Psychic spellcasters aren't affected by effects that target only arcane or divine spellcasters, nor can they use arcane or divine scrolls or other items or feats that state they can be utilized by only arcane or divine spellcasters."

> "**Thought Components**: ... The DC for any concentration check for a spell with a thought component increases by 10. A psychic spellcaster casting a spell with a thought component can take a move action before beginning to cast the spell to center herself; she can then use the normal DC instead of the increased DC."

Undercasting (affects spells known):

> "Some psychic spells can be undercast. This means that the spellcaster can cast the spell at the level that he knows, or as any lower-level version of that spell, using the appropriate spell slot. ... Whenever a spontaneous spellcaster adds a spell to his list of spells known that can be undercast, he can immediately learn a spell in place of each lower-level version of that spell he knows. In essence, he loses each earlier version and can replace it with another spell of the same level that is on his spell list."

## Topic: Modifiers to Caster Level, DC and Concentration

Official wording, with the bonus type as printed. Untyped bonuses stack except with themselves from the same source (CRB p. 208, Bonus Types: "Bonuses without a type always stack, unless they are from the same source.").

| Effect | Source | Text | Type as printed |
|---|---|---|---|
| Magical Knack (trait) | APG p. 329, UC p. 57 | "Pick a class when you gain this trait—your caster level in that class gains a +2 trait bonus as long as this bonus doesn't raise your caster level above your current Hit Dice." | trait bonus to caster level of one class, capped at Hit Dice |
| Spell Focus | CRB p. 134 | "Add +1 to the Difficulty Class for all saving throws against spells from the school of magic you select." | untyped |
| Greater Spell Focus | CRB (feats chapter) | "Add +1 to the Difficulty Class for all saving throws against spells from the school of magic you select. This bonus stacks with the bonus from Spell Focus." | untyped, stacks with Spell Focus by its text |
| Spell Specialization | UM p. 156 | "Select one spell of a school for which you have taken the Spell Focus feat. Treat your caster level as being two higher for all level-variable effects of the spell." Reselectable "Every time you gain an even level in the spellcasting class you chose your spell from". | not a bonus; +2 effective caster level for one spell's level-variable effects |
| Greater Spell Specialization | UM p. 152 | "By sacrificing a prepared spell of the same or higher level than your specialized spell, you may spontaneously cast your specialized spell." | conversion, no number |
| Arcanist reservoir | ACG p. 8 | "she can choose to increase the caster level by 1 or increase the spell's DC by 1" | untyped, per casting, one point per spell |
| Varisian Tattoo (campaign-setting feat) | *Inner Sea World Guide* p. 289 | "you cast spells from this school at +1 caster level" | untyped |
| Combat Casting | CRB p. 119 | "You get a +4 bonus on concentration checks made to cast a spell or use a spell-like ability when casting on the defensive or while grappled." | untyped, situational |
| Focused Mind (trait) | APG p. 329, UC p. 57 | "You gain a +2 trait bonus on concentration checks." | trait bonus |
| Spell Penetration / Greater | CRB (feats chapter) | "+2 bonus on caster level checks (1d20 + caster level) made to overcome a creature's spell resistance" (Greater: "This bonus stacks with the one from Spell Penetration.") | untyped, SR checks only |
| Sorcerer bloodline arcana (examples) | CRB p. 70 | Arcane: "Whenever you apply a metamagic feat to a spell that increases the slot used by at least one level, increase the spell's DC by +1. This bonus does not stack with itself and does not apply to spells modified by the Heighten Spell feat." Fey: "Whenever you cast a spell of the compulsion subschool, increase the spell's DC by +2." Infernal: same for charm. | untyped; applies to spells of all classes (FAQ `v5748eaic9ne8`) |

- Trait bonuses do not stack with each other (CRB/APG rule recorded in the archetype corpus). **Reading:** Magical Knack is a typed bonus that stacks with untyped caster-level increases.
- Magical Knack picks "a class". How its Hit Dice cap combines with prestige levels added to that class is not stated. **Open (S13).**
- Magic items that raise caster level (for example an *orange prism ioun stone*) are out of scope here.
- FAQ APG, "Effective Level Increases From Magic Items" (posted November 2010), https://paizo.com/paizo/faq/v5748nruor1fn#v5748eaic9ni3: the *robes of arcane heritage* raise sorcerer level only for bloodline powers; "bloodline powers, bloodline arcana, bonus spells, and bloodline feats are three separate abilities of the sorcerer class; the robes only affect the bloodline powers." FAQ ACG (posted August 2016, `v5748eaic9ux4`): a bloodrager cannot use such sorcerer-level items.

## Edge Cases and Open Items

Each item points to the quoted text it rests on. None gives an answer.

- **S1. Caster level before spells (bloodrager, medium).** The bloodrager's caster level for his spells is his bloodrager level (settled above from the CRB p. 208 default and the absence of an offset). The text does not say whether a bloodrager of levels 1 to 3 has a caster level for other rules, or whether a medium of levels 1 to 3 has one beyond his knacks.
- **S2. Investigator caster level sentence.** The investigator lacks the alchemist's "uses his level as the caster level to determine any effect based on caster level". The CRB default gives the same number. The ACG FAQ calls a different omitted sentence intentional.
- **S3. Bonus spells for shaman spirit magic slots.** "one spell slot per day of each shaman spell level she can cast"; bonus spells are not mentioned.
- **S4. 0-level spells in metamagic slots for CRB classes, magus, shaman, warpriest and others without the clause.** Later classes say such 0-level spells are expended; the CRB classes say only "not expended when cast" / "do not consume any slots".
- **S5. Adept 0-level spells.** The adept table has a 0-level column (3 per day) but no Orisons feature, so the text never says they are not expended.
- **S6. Splitting prestige levels across classes.** "he must decide to which class he adds the new level" is per level, but nothing says whether later levels may go to a different eligible class.
- **S7. Psychic classes and "+1 level of existing arcane/divine spellcasting class".** OA p. 144 excludes psychic casters from "effects", "items or feats" for arcane or divine casters, not by name from prestige class advancement.
- **S8. Alchemist and investigator extracts and prestige advancement.** The APG FAQ says alchemists are "not spellcasters" for crafting; nothing says whether an arcane "+1 level" can advance extracts.
- **S9. Advancing a class that has no spells yet** (paladin, ranger, antipaladin, bloodrager below 4th level).
- **S10. Class offsets with prestige levels.** Whether "paladin level – 3" counts prestige levels added to paladin spellcasting. Only the mystic theurge says caster level is determined from the summed level.
- **S11. Prestige levels on a 20th-level class.** Class tables stop at 20.
- **S12. Arcanist preparation count under a prestige class.** The standard ability advances "spells known (if he is a spontaneous spellcaster)"; the arcanist's preparation count is in her Spells feature, which the FAQ says advances.
- **S13. Magical Knack cap and prestige levels.** "your caster level in that class gains a +2 trait bonus as long as this bonus doesn't raise your caster level above your current Hit Dice" does not say how prestige levels assigned to that class count.
- **S14. PRD currency.** The legacy PRD text matched AoN for the CRB rules quoted here, but AoN prints the mystic theurge's Combined Spells second paragraph, which the 2019 PRD lacks. Other later errata were not checked line by line.
