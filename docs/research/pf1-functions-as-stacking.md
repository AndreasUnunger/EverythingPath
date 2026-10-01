# PF1 "Functions As" Wordings and Stacking

Research for [#210](https://github.com/AndreasUnunger/EverythingPath/issues/210) (part of #201, feeds #206 question S4: what counts as the same source). Builds on `docs/research/pf1-official-stacking-rules.md` on branch `research/pf1-official-stacking-rules` (#209), whose section 4 lists the same-source FAQ rulings. Those rulings are not repeated here unless they are needed for a case below. Retrieved 2026-10-01.

## Source policy

Same policy as #209:

- **CRB**: Pathfinder RPG Core Rulebook text as published on Archives of Nethys (`legacy.aonprd.com/coreRulebook/...`, the former paizo.com PRD, and `www.aonprd.com`, which gives page numbers).
- **FAQ**: Paizo's official FAQ pages on `paizo.com/paizo/faq/...`. Each FAQ page belongs to one book; the book is named with every FAQ citation.
- **Non-CRB rulebook text** is quoted only where an official FAQ entry rules on it, and is marked **[non-CRB: book]**.

Nothing comes from d20pfsrd, forums, Foundry, PCGen or other builders. Every rule is quoted exactly. Where the official text is silent or ambiguous, the entry says **open: rules silent/ambiguous**, quotes the nearest text, and gives no answer.

Source keys:

| Key | Book | URL |
|---|---|---|
| CRB Combining Magic Effects (p. 208) | CRB | https://www.aonprd.com/Rules.aspx?Name=Combining%20Magic%20Effects&Category=Magic%20Basics, https://legacy.aonprd.com/coreRulebook/magic.html |
| CRB Bonus Types (p. 208) | CRB | same page as above, "Bonus Types" |
| CRB Special Abilities (p. 221) | CRB | https://legacy.aonprd.com/coreRulebook/magic.html (Special Abilities) |
| CRB Appendix 1 Special Abilities | CRB | https://legacy.aonprd.com/coreRulebook/glossary.html |
| CRB Spell Lists | CRB | https://legacy.aonprd.com/coreRulebook/spellLists.html |
| CRB spell `<name>` | CRB | `https://legacy.aonprd.com/coreRulebook/spells/<name>.html` |
| CRB Magic Items | CRB | https://legacy.aonprd.com/coreRulebook/magicItems.html |
| CRB Rings / Wondrous / Weapons / Potions | CRB | `https://legacy.aonprd.com/coreRulebook/magicItems/{rings,wondrousItems,weapons,potions}.html` |
| CRB class `<name>` | CRB | `https://legacy.aonprd.com/coreRulebook/classes/<name>.html`, `.../prestigeClasses/<name>.html` |
| FAQ CRB | CRB FAQ | https://paizo.com/paizo/faq/v5748nruor1fm |
| FAQ APG | Advanced Player's Guide FAQ | https://paizo.com/paizo/faq/v5748nruor1fn |
| FAQ UC | Ultimate Combat FAQ | https://paizo.com/paizo/faq/v5748nruor1g1 |
| FAQ UE | Ultimate Equipment FAQ | https://paizo.com/paizo/faq/v5748nruor1gg |
| FAQ ACG | Advanced Class Guide FAQ | https://paizo.com/paizo/faq/v5748nruor1gw |

Also searched with no relevant hit: the Bestiary, Ultimate Magic, Advanced Race Guide, Mythic Adventures, Ultimate Campaign, Pathfinder Unchained, Occult Adventures and Ultimate Intrigue FAQs.

## Summary

| Wording | Official ruling for stacking | Basis |
|---|---|---|
| Spell "functions like" another spell (*mass bull's strength* / *bull's strength*; *greater magic weapon* / *magic weapon*) | Their bonuses are typed (enhancement), so the bonus-type rule already stops them stacking. Whether the two count as the same spell or the same source: **open** | CRB Combining Magic Effects; no CRB definition of "functions like" |
| Item that grants the same bonus type as a spell (*belt of giant strength* / *bull's strength*) | Do not stack: same bonus type | CRB Bonus Types, item and spell texts |
| Item that acts "as" a spell (*boots of speed* / *haste*) | Do not stack. The boots call their effect a "haste effect", and haste says "Multiple haste effects don't stack." | CRB haste, boots of speed |
| Item ability that copies a spell's effect (*impact* / *lead blades*; *speed* / *haste*) | Do not stack: "similar effects" | FAQ UE (impact); CRB speed text; FAQ CRB (two speed weapons) |
| SLA or Su ability that "functions as" a spell | Usually works like the spell. The CRB rules on stacking only case by case (Copycat / *mirror image*: no; Healer's Blessing / Empower Spell: no; polymorph: one at a time). No general rule: **open** | CRB Special Abilities p. 221; CRB domain and class texts |
| Same class feature from two classes | Does not stack unless the text says so or the feature scales on total class levels | FAQ CRB (Channel Energy) |
| Class feature "as the fighter ability" from two classes (myrmidarch weapon/armor training) | Stacks | FAQ UC |
| Archetype ability that "works like" the standard ability | Counts as that ability for rules that improve it | FAQ CRB (Archetype) |
| Different "forms of rage" (rage, bloodrage, *rage* spell) | Do not stack: you keep one | FAQ ACG |
| "Counts as" (feat prerequisites, class levels, weapon types) | Defined only for qualifying or for what improves the ability. Effect on bonus stacking: **open** | FAQ CRB; CRB class texts |

## 1. What "functions like" means in general

**Open: rules silent/ambiguous.** The CRB does not define "functions like", "functions as", "works like" or "as the spell", and gives no general rule on whether a spell that functions like another is the same spell for stacking.

Nearest text:

- Spell chains are mentioned only as an ordering rule: "Order of Presentation: In the spell lists and the short descriptions that follow them, the spells are presented in alphabetical order by name except for those belonging to certain spell chains. When a spell's name begins with "lesser," "greater," or "mass," the spell is alphabetized under the second word of the spell name instead." (CRB Spell Lists)
- "Descriptive Text: This portion of a spell description details what the spell does and how it works." (CRB Magic). Nothing about spells that reference other spells.
- The only general statement about special abilities: "A number of classes and creatures gain the use of special abilities, many of which function like spells." (CRB Special Abilities, p. 221)

The FAQ uses "works like" in two places with a stated consequence:

- Archetypes: "If the archetype ability says it works like the standard ability, it counts as that ability." (FAQ CRB, Archetype, [#v5748eaic9qto](https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9qto)). This is about counting as the ability "for the purpose of rules that improve the original ability", not about stacking.
- Monk and haste: "Yes. The extra attack described in the ki pool ability doesn't say it works like haste, nor does it say that it doesn't stack with haste, so the monk would get two additional attacks (one from spending a ki point as part of a flurry, one from haste)." (FAQ CRB, Monk, [#v5748eaic9qk0](https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9qk0)). The FAQ gives "doesn't say it works like haste" as one of its reasons for allowing the two to stack. It does not say outright that an ability which *does* say it works like haste would not stack: **open: rules silent/ambiguous** (the converse is not stated).

## 2. Spells that "function like" another spell

### 2.1 Texts

- *Bull's strength* (CRB p. 251): "The spell grants a +4 enhancement bonus to Strength, adding the usual benefits to melee attack rolls, melee damage rolls, and other uses of the Strength modifier."
- *Bull's strength, mass* (CRB p. 251): "This spell functions like bull's strength, except that it affects multiple creatures."
- *Magic weapon* (CRB p. 310): "Magic weapon gives a weapon a +1 enhancement bonus on attack and damage rolls. An enhancement bonus does not stack with a masterwork weapon's +1 bonus on attack rolls."
- *Magic weapon, greater* (CRB p. 310): "This spell functions like magic weapon, except that it gives a weapon an enhancement bonus on attack and damage rolls of +1 per four caster levels (maximum +5)."

### 2.2 Ruling

Both pairs grant **enhancement** bonuses to the same thing (Strength; the weapon's attack and damage). The bonus-type rule settles them:

- "More generally, two bonuses of the same type don't stack even if they come from different spells (or from effects other than spells; see Bonus Types, above)." (CRB Combining Magic Effects, p. 208)
- "only the better bonus of a given type works" (CRB Bonus Types, p. 208)

So *mass bull's strength* + *bull's strength* gives +4 Strength, not +8. *Greater magic weapon* + *magic weapon* gives only the higher enhancement bonus. This follows from the type rule alone; it does not need the two spells to be the same spell or the same source.

### 2.3 Open

- **Whether a "functions like" spell is the same spell, an "identical spell", or the same source. Open: rules silent/ambiguous.** It matters only when the effects are untyped or not bonuses. Nearest text: "Spells that provide bonuses or penalties on attack rolls, damage rolls, saving throws, and other attributes usually do not stack with themselves." "In cases when two or more identical spells are operating in the same area or on the same target, but at different strengths, only the one with the highest strength applies." "The same spell can sometimes produce varying effects if applied to the same recipient more than once. Usually the last spell in the series trumps the others." (CRB Combining Magic Effects, p. 208). The CRB does not say whether a "mass" or "greater" version is "the same spell" or "identical" for these rules.
- One spell spells it out for its own family, so the question does not arise there: "Multiple haste effects don't stack." (CRB haste, p. 293)

## 3. Magic items that function as, or replicate, a spell

### 3.1 General CRB text

- "Magic items produce spells or spell-like effects." (CRB Magic Items, Saving Throws Against Magic Item Powers)
- "Some individual items, notably those that just store spells, don't get full-blown descriptions. Reference the spell's description for details, modified by the form of the item (potion, scroll, wand, and so on)." (CRB Magic Items)
- Potions: "Potions are like spells cast upon the imbiber. ... The drinker of a potion is both the effective target and the caster of the effect" (CRB Potions)
- FAQ on "as the spell" items: "When I use a magic item like ring of invisibility or hat of disguise that can be activated to gain the effects of a spell, does the wording "as the spell" also include the spell's duration?" "Yes, such items' effects have a duration, as indicated by the spell's duration and the item's caster level. If the item has no daily use limit, however, you can simply use the item again to reset the duration." (FAQ CRB, [#v5748eaic9smr](https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9smr)). This rules on duration only, not stacking.

### 3.2 Examples

| Item | Item wording | Spell | Official stacking result |
|---|---|---|---|
| *Belt of giant strength* | "The belt grants the wearer an enhancement bonus to Strength of +2, +4, or +6." Requirements: "Craft Wondrous Item, bull's strength" (CRB Wondrous) | *bull's strength* (+4 enhancement to Str) | Do not stack: same bonus type (CRB Bonus Types). The higher one applies. |
| *Ring of protection* | "a deflection bonus of +1 to +5 to AC". Requirements: "Forge Ring, shield of faith" (CRB Rings) | *shield of faith* (deflection) | Do not stack: same bonus type. |
| *Cloak of resistance* | "a +1 to +5 resistance bonus on all saving throws". Requirements: "Craft Wondrous Item, resistance" (CRB Wondrous) | *resistance* | Do not stack: same bonus type. |
| *Boots of speed* | "letting her act as though affected by a haste spell for up to 10 rounds each day. The haste effect's duration need not be consecutive rounds." (CRB Wondrous) | *haste* | Do not stack. The boots' own text calls the effect a "haste effect", and *haste* says "Multiple haste effects don't stack." (CRB haste, p. 293) |
| *Speed* weapon | "When making a full-attack action, the wielder of a speed weapon may make one extra attack with it. ... (This benefit is not cumulative with similar effects, such as a haste spell.)" (CRB Weapons) | *haste* ("This effect is not cumulative with similar effects, such as that provided by a speed weapon") | Do not stack (both texts). Two speed weapons do not stack either: "No. The benefits of speed are not cumulative with similar effects, and "a second speed weapon" is a similar effect." (FAQ CRB, [#v5748eaic9qpr](https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9qpr)) |
| *Impact* weapon **[non-CRB: Ultimate Equipment p. 143]** | "dealing damage as if the weapon were one size category larger". Requirements include "lead blades" | *lead blades* **[non-CRB: APG p. 230]**: "deal damage as if one size category larger" | Do not stack: "No. The weapon special ability and the spell are similar effects; note that impact lists lead blades as a construction requirement." (FAQ UE, [#v5748eaic9qx4](https://paizo.com/paizo/faq/v5748nruor1gg#v5748eaic9qx4)). The CRB FAQ on effective size increases says the same for this kind of effect ("size changes do not stack", FAQ CRB [#v5748eaic9t5u](https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9t5u), quoted in #209). |
| *Ring of feather falling* | "It acts exactly like a feather fall spell" (CRB Rings) | *feather fall* | No bonus involved. **Open: rules silent/ambiguous** whether the ring's effect and the spell are "the same spell" for the Combining Magic Effects rules. |
| *Ring of invisibility* | "the wearer can benefit from invisibility, as the spell." (CRB Rings) | *invisibility* | No bonus involved; same open question as above. |

Links: [Wondrous](https://legacy.aonprd.com/coreRulebook/magicItems/wondrousItems.html), [Rings](https://legacy.aonprd.com/coreRulebook/magicItems/rings.html), [Weapons](https://legacy.aonprd.com/coreRulebook/magicItems/weapons.html), [haste](https://legacy.aonprd.com/coreRulebook/spells/haste.html), [impact](https://www.aonprd.com/MagicWeaponsDisplay.aspx?ItemName=Impact), [lead blades](https://www.aonprd.com/SpellDisplay.aspx?ItemName=Lead%20Blades).

### 3.3 Open

- **Whether an item effect that "functions as" a spell is the same source as that spell for an untyped bonus. Open: rules silent/ambiguous.** Nearest text: "Bonuses without a type always stack, unless they are from the same source." (CRB Bonus Types, p. 208); "Magic items produce spells or spell-like effects." (CRB Magic Items). No CRB or FAQ text says an item's effect *is* the spell it replicates.
- **Whether a construction requirement makes an item and the required spell "similar effects" in general. Open: rules silent/ambiguous.** The UE FAQ cites the requirement as supporting evidence ("note that impact lists lead blades as a construction requirement") for one item. It does not state a general rule. Many items list a spell as a requirement without granting that spell's effect (for example the *ring of evasion*: "Requirements Forge Ring, jump").
- **What counts as a "similar effect". Open: rules silent/ambiguous.** The CRB uses the phrase in specific texts (haste, speed, keen: "This benefit doesn't stack with any other effect that expands the threat range of a weapon (such as the keen edge spell or the Improved Critical feat)") without defining it. The APG FAQ rules on what "does not stack with ... similar effects" suppresses ("the effects that apply to the same rules component or situation do not stack", FAQ APG [#v5748eaic9u3g](https://paizo.com/paizo/faq/v5748nruor1fn#v5748eaic9u3g), quoted in #209), but not on what makes two effects similar.

## 4. Class features that duplicate another class's feature

### 4.1 General FAQ rule

"Channel Energy: If I have this ability from more than one class, do they stack?" "No—unless an ability specifically says it stacks with similar abilities (such as an assassin's sneak attack), or adds in some way based on the character's total class levels (such as improved uncanny dodge), the abilities don't stack and you have to use them separately. Therefore, cleric channeling doesn't stack with paladin channeling, necromancer channeling, oracle of life channeling, and so on." (FAQ CRB, [#v5748eaic9o80](https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9o80))

The question is about channel energy, but the answer is phrased as a general rule ("the abilities don't stack").

### 4.2 Features whose own CRB text rules on duplicates

| Feature | Official wording | Result |
|---|---|---|
| Uncanny Dodge (barbarian, rogue, assassin, shadowdancer) | "If a barbarian already has uncanny dodge from a different class, she automatically gains improved uncanny dodge (see below) instead." The rogue, assassin and shadowdancer texts say the same. (CRB barbarian, rogue; CRB prestige assassin, shadowdancer) | A second Uncanny Dodge becomes Improved Uncanny Dodge. |
| Improved Uncanny Dodge | "If a character already has uncanny dodge (see above) from another class, the levels from the classes that grant uncanny dodge stack to determine the minimum rogue level required to flank the character." (CRB barbarian, rogue; assassin and shadowdancer equivalent) | Class levels add for the flanking threshold. |
| Sneak Attack (assassin, arcane trickster) | "This is exactly like the rogue ability of the same name. ... If an assassin gets a sneak attack bonus from another source, the bonuses on damage stack." Arcane trickster: same wording. (CRB assassin, arcane trickster) | Dice stack. |
| Trap Sense | "Trap sense bonuses gained from multiple classes stack." (CRB barbarian, rogue) | Stacks. |
| Animal companion | "If a character receives an animal companion from more than one source, her effective druid levels stack for the purposes of determining the statistics and abilities of the companion." (CRB druid). Ranger: "This ability functions like the druid animal companion ability ... except that the ranger's effective druid level is equal to his ranger level – 3." Paladin mount: "This mount functions as a druid's animal companion, using the paladin's level as her effective druid level." (CRB ranger, paladin) | Levels stack. |
| Familiar | "Levels of different classes that are entitled to familiars stack for the purpose of determining any familiar abilities that depend on the master's level." (CRB wizard) | Levels stack. |
| Arcane Bond (arcane bloodline sorcerer) | "Your sorcerer levels stack with any wizard levels you possess when determining the powers of your familiar or bonded object." (CRB sorcerer) | Levels stack. |
| Favored enemy / terrain overlap (one class) | "If a specific creature falls into more than one category of favored enemy, the ranger's bonuses do not stack; he simply uses whichever bonus is higher." (CRB ranger) | Higher applies. |

### 4.3 FAQ rulings on "as the [class] ability" and look-alike features

- **Myrmidarch weapon and armor training [non-CRB: Ultimate Combat p. 56].** Archetype text: "a myrmidarch gains weapon training, as the fighter ability" and "a myrmidarch gains armor training, as the fighter ability." ([AoN](https://www.aonprd.com/ArchetypeDisplay.aspx?FixedName=Magus%20Myrmidarch)). FAQ: "Magus, Myrmidarch: Do my weapon training and armor training abilities stack if I multiclass into fighter?" "Yes." It adds that fighter armor training 1 plus myrmidarch armor training 1 "gains the ability to overcome the speed reduction of heavy armor (as it is the equivalent of armor training 2, which grants that ability)." (FAQ UC, [#v5748eaic9qm4](https://paizo.com/paizo/faq/v5748nruor1g1#v5748eaic9qm4))
- **Archetype abilities.** "If the archetype ability says it works like the standard ability, it counts as that ability. If the archetype's ability requires you to make a specific choice for the standard ability, it counts as that ability. Otherwise, the archetype ability doesn't count as the standard ability. (It doesn't matter if the archetype's ability name is different than the standard class ability it is replacing; it is the description and game mechanics of the archetype ability that matter.)" (FAQ CRB, [#v5748eaic9qto](https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9qto))
- **Rage family [non-CRB: Advanced Class Guide FAQ].** "No. When you either activate or are affected by a new form of rage (such as a barbarian's rage, a skald's raging song, a bloodrager's bloodrage, and the rage spell), you can choose whether to keep your current rage or to accept the new rage instead, much like a creature affected by multiple polymorph effects. ... The exception to this rule is the skald's master skald ability, which explicitly allows the skald's raging song to stack with other rage effects." (FAQ ACG, [#v5748eaic9t91](https://paizo.com/paizo/faq/v5748nruor1gw#v5748eaic9t91))
- **Cavalier mount + druid companion [non-CRB: APG FAQ].** Levels stack only "If the animal is on the cavalier mount list and on the list of animal companions for your other class" (FAQ APG, [#v5748eaic9qqn](https://paizo.com/paizo/faq/v5748nruor1fn#v5748eaic9qqn)).

### 4.4 Open

- **Evasion from two classes. Open: rules silent/ambiguous.** No CRB evasion text (rogue, monk, ranger, shadowdancer) and no FAQ addresses a duplicate. The *ring of evasion* "continually grants the wearer the ability to avoid damage as if she had evasion" (CRB Rings) is also not addressed. Nearest text: the Channel Energy FAQ in 4.1.
- **Domain powers from two classes. Open: rules silent/ambiguous.** The CRB cleric is the only CRB class with domains; it says "a cleric gains the listed powers from both of her domains". No CRB or FAQ text covers the same domain from two classes. Nearest text: the Channel Energy FAQ in 4.1.
- **"As the fighter ability" vs. the Channel Energy default. Open: rules silent/ambiguous.** The Channel Energy FAQ says duplicate abilities don't stack unless the text says so or they scale on "total class levels". The Myrmidarch FAQ says weapon and armor training from two classes stack, with no reason given. Neither FAQ says which wordings put an ability on which side.

## 5. Spell-like and supernatural abilities that duplicate a spell

### 5.1 General CRB text

- "Spell-Like Abilities: Usually, a spell-like ability works just like the spell of that name. ... A spell-like ability has a casting time of 1 standard action unless noted otherwise in the ability or spell description. In all other ways, a spell-like ability functions just like a spell." (CRB Special Abilities, p. 221)
- "Spell-like abilities, as the name implies, are magical abilities that are very much like spells." "Supernatural abilities are magical but not spell-like." (CRB Appendix 1)
- FAQ: "A spell-like ability is not a spell, having a spell-like ability is not part of a class's spell list" (FAQ CRB, [#v5748eaic9ofm](https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9ofm)). This is about activating spell completion and spell trigger items.
- FAQ, DCs: "Abilities that work "as a spell": How do I calculate the DC of an ability that says it works as or like a particular spell?" "An ability that doesn't tell you anything about its DC has a DC of 10 + the spell level + the key spellcasting ability score of the class that granted it (or Charisma otherwise)." (FAQ CRB, [#v5748eaic9ucw](https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9ucw)). DCs only, not stacking.

### 5.2 CRB abilities that rule on stacking with their spell

| Ability | Official wording | Result |
|---|---|---|
| Copycat (Trickery domain, CRB p. 48) | "This double functions as a single mirror image ... This ability does not stack with the mirror image spell." (CRB cleric) | Does not stack with *mirror image*. |
| Healer's Blessing (Healing domain) | "all of your cure spells are treated as if they were empowered ... This does not stack with the Empower Spell metamagic feat." (CRB cleric) | Does not stack with Empower Spell. |
| Wild shape and other polymorph effects | "This ability functions like the beast shape I spell" (CRB druid). "You can only be affected by one polymorph spell at a time. If a new polymorph spell is cast on you (or you activate a polymorph effect, such as wild shape), you can decide whether or not to allow it to affect you, taking the place of the old spell." (CRB Magic, Polymorph) | One polymorph at a time, wild shape included. |
| Monk ki extra attack vs. *haste* | FAQ CRB [#v5748eaic9qk0](https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9qk0) (section 1) | Stacks, because it neither "works like haste" nor says it doesn't stack. |
| Fast bombs **[non-CRB: APG]** | "As written, yes, all of these apply because fast bombs "functions just like a full-attack with a ranged weapon."" (FAQ APG, [#v5748eaic9n8l](https://paizo.com/paizo/faq/v5748nruor1fn#v5748eaic9n8l)) | The "functions just like" wording is taken literally, so effects that modify a full attack apply. |

Other CRB abilities that "function as" a spell but say nothing about stacking: Master's Illusion ("This ability otherwise functions like the spell veil"), Lightning Lord ("This ability otherwise functions as call lightning"), Fleeting Glance ("This ability functions as greater invisibility"), Invisibility Field, Elemental Wall, Change Shape (CRB cleric, sorcerer, wizard); Detect Evil ("as the spell"), Abundant Step ("as if using the spell dimension door"), Divine Presence ("treated as if under the effects of a sanctuary spell") (CRB paladin, monk, cleric).

### 5.3 Open

- **Whether an SLA that "works just like the spell of that name" is the same spell as that spell for the Combining Magic Effects rules or the same-source rule. Open: rules silent/ambiguous.** Nearest text: "In all other ways, a spell-like ability functions just like a spell." (CRB p. 221). Copycat needs its own sentence to say it does not stack with *mirror image*. The CRB does not say whether that sentence restates the general rule or creates an exception.
- **Supernatural abilities that "function as" a spell. Open: rules silent/ambiguous.** The CRB has no "functions just like a spell" rule for supernatural abilities. Nearest text: "Supernatural abilities are magical but not spell-like." (CRB Appendix 1)

## 6. "Counts as" wordings

| Wording | Official text | What it affects |
|---|---|---|
| SLA counts as casting a named spell | "Only if the pre-requisite calls out the name of a spell explicitly. ... However, the barghest's dimension door would not meet requirements such as "Ability to cast 4th level spells" or "Ability to cast arcane spells"." (FAQ CRB, [#v5748eaic9qow](https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9qow)) | Prerequisites |
| SLA as a crafting requirement | "Yes. Core Rulebook page 461 ... "or through the use of a spell completion or spell trigger magic item or a spell-like ability that produces the desired spell effect."" (FAQ CRB, [#v5748eaic9qp1](https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9qp1)) | Item creation |
| Bonus feats without prerequisites | "Feat prerequisites are not inclusive, as it is possible for a creature to have a feat without meeting that feat's prerequisites." (FAQ CRB, [#v5748eaic9r95](https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9r95)) | Prerequisites |
| Eldritch knight levels as fighter levels | "An eldritch knight adds his level to any levels of fighter he might have for the purpose of meeting the prerequisites for feats (if he has no fighter levels, treat his eldritch knight levels as levels of fighter)." (CRB eldritch knight) | Feat prerequisites only |
| Monk unarmed strike | "A monk's unarmed strike is treated as both a manufactured weapon and a natural weapon for the purpose of spells and effects that enhance or improve either manufactured weapons or natural weapons." (CRB monk) | Which spells and effects apply |
| Archetype ability "works like" the standard one | FAQ CRB [#v5748eaic9qto](https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9qto) (section 4.3) | "rules that improve the original ability" |
| Bloodrage **[non-CRB: Advanced Class Guide p. 15]** | "Bloodrage counts as the barbarian's rage class feature for the purpose of feat prerequisites, feat abilities, magic item abilities, and spell effects." ([AoN](https://www.aonprd.com/ClassDisplay.aspx?ItemName=Bloodrager)). Stacking with rage: FAQ ACG in 4.3 (does not stack). | Prerequisites, feats, items, spells |

**Open: rules silent/ambiguous:** whether "counts as X" makes an ability the same source as X for bonus stacking. Every official "counts as" text found names its purpose (prerequisites, improving effects, weapon type). None mentions stacking. The rage case is settled by its own FAQ, not by the "counts as" wording.

## 7. All open items

1. No CRB definition of "functions like" / "functions as" / "works like" / "as the spell" (section 1).
2. Whether "doesn't say it works like haste" in the monk FAQ means an ability that does say so would not stack (section 1).
3. Whether a "functions like" spell (mass, greater) is the same spell, an "identical spell", or the same source when effects are untyped or not bonuses (section 2.3).
4. Whether an item effect that "functions as" a spell is the same source as the spell for untyped bonuses (section 3.3).
5. Whether a construction requirement generally makes an item and a spell "similar effects" (section 3.3).
6. What counts as a "similar effect" (section 3.3).
7. Evasion from two classes, and a ring of evasion plus class evasion (section 4.4).
8. Domain powers from the same domain from two classes (section 4.4).
9. Channel Energy FAQ default vs. Myrmidarch FAQ: which wordings make same-named class features stack (section 4.4).
10. Whether an SLA counts as the same spell for Combining Magic Effects and same-source (section 5.3).
11. Supernatural abilities that "function as" a spell (section 5.3).
12. Whether "counts as" wordings affect bonus stacking (section 6).
