# PF1 Attack Rules

Official attack text for the Attack Routine, collected for [#235](https://github.com/AndreasUnunger/EverythingPath/issues/235) (map #201). [Decide which attack options an Attack Routine supports](https://github.com/AndreasUnunger/EverythingPath/issues/229) asks which routine options and attack-changing feats the builder supports. Foundry stores none of them as data, so the builder writes each rule from this corpus. Numbers derived from this text (scaling by BAB, Table 8–7, monk and natural-attack damage, the special-ability dice, the completeness sweep) live in `pf1-tables.md`.

Retrieved 2026-10-02. Source policy and provenance are in `README.md`. Short forms: **CRB** *Core Rulebook*, **B1** *Bestiary* (first), **APG** *Advanced Player's Guide*, **UM** *Ultimate Magic*, **UC** *Ultimate Combat*, **UE** *Ultimate Equipment*, **PU** *Pathfinder Unchained*, **ACG** *Advanced Class Guide*. "FAQ" means Paizo's official FAQ pages, cited with anchor and posting date. Every source that is not the CRB is flagged **(non-CRB)** where it is quoted.

Conventions (same as `docs/ai/pf1-spellcasting-rules/` on `research/pf1-spellcasting-rules`):

- `> "..."` blocks and inline quotes are verbatim official text. `...` marks an omission.
- **Reading:** a conclusion drawn from the quoted text. It adds no rule.
- **Open (An):** the official text is silent, ambiguous or contradicts itself. Open items give no answer. All of them are collected at the end.

Pages: Archives of Nethys prints "Source *Book* pg. N" for each feat, class, item and rules section. For rules sections that is the page where the section **starts**; a paragraph inside a long section (the Attack action, for example) may sit a page or two later. Feat, item and class-entry pages are the entry's first page.

Not repeated here: bonus types and stacking (`research/pf1-official-stacking-rules`, `docs/research/pf1-official-stacking-rules.md`); BAB progressions, size modifiers to attack and AC, and Table 1–3 (`research/pf1-core-rules`, `docs/ai/pf1-core-rules/`).

## Topic: Attack Bonus, Strength to Damage and Critical Hits

These base rules decide every line of the routine.

CRB p. 178, "Attack Bonus":

> "Your attack bonus with a melee weapon is the following: **Base attack bonus + Strength modifier + size modifier** With a ranged weapon, your attack bonus is the following: **Base attack bonus + Dexterity modifier + size modifier + range penalty**"

CRB p. 179, "Damage":

> "**Strength Bonus**: When you hit with a melee or thrown weapon, including a sling, add your Strength modifier to the damage result. A Strength penalty, but not a bonus, applies on damage rolls made with a bow that is not a composite bow."

> "*Off-Hand Weapon*: When you deal damage with a weapon in your off hand, you add only 1/2 your Strength bonus. If you have a Strength penalty, the entire penalty applies."

> "*Wielding a Weapon Two-Handed*: When you deal damage with a weapon that you are wielding two-handed, you add 1-1/2 times your Strength bonus (Strength penalties are not multiplied). You don't get this higher Strength bonus, however, when using a light weapon with two hands."

> "**Multiplying Damage**: Sometimes you multiply damage by some factor, such as on a critical hit. Roll the damage (with all modifiers) multiple times and total the results. *Note*: When you multiply damage more than once, each multiplier works off the original, unmultiplied damage. So if you are asked to double the damage twice, the end result is three times the normal damage. *Exception*: Extra damage dice over and above a weapon's normal damage are never multiplied."

CRB p. 182 ("Attack", Critical Hits paragraph):

> "A critical hit means that you roll your damage more than once, with all your usual bonuses, and add the rolls together. Unless otherwise specified, the threat range for a critical hit on an attack roll is 20, and the multiplier is ×2."

> "*Exception*: Precision damage (such as from a rogue's sneak attack class feature) and additional damage dice from weapon special abilities (such as *flaming*) are not multiplied when you score a critical hit."

> "*Increased Threat Range*: Sometimes your threat range is greater than 20. That is, you can score a threat on a lower number. In such cases, a roll of lower than 20 is not an automatic hit. Any attack roll that doesn't result in a hit is not a threat."

CRB p. 140, "Light, One-Handed, and Two-Handed Melee Weapons" (Weapons section; AoN start page):

> "*Light*: ... Add the wielder's Strength modifier to damage rolls for melee attacks with a light weapon if it's used in the primary hand, or half the wielder's Strength bonus if it's used in the off hand. Using two hands to wield a light weapon gives no advantage on damage; the Strength bonus applies as though the weapon were held in the wielder's primary hand only. An unarmed strike is always considered a light weapon."

> "*One-Handed*: ... If a one-handed weapon is wielded with two hands during melee combat, add 1-1/2 times the character's Strength bonus to damage rolls."

> "*Two-Handed*: Two hands are required to use a two-handed melee weapon effectively. Apply 1-1/2 times the character's Strength bonus to damage rolls for melee attacks with such a weapon."

CRB p. 140, proficiency: "A character who uses a weapon with which he is not proficient takes a –4 penalty on attack rolls." And: "All characters are proficient with unarmed strikes and any natural weapons possessed by their race."

FAQ CRB, "Weapons, Two-Handed in One Hand" (July 2013), https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9quw:

> "If you're wielding it in one hand (even if it is normally a two-handed weapon), treat it as a one-handed weapon for the purpose of how much Strength to apply, the Power Attack damage bonus, and so on."

FAQ CRB, "Bastard Sword" (October 2013), `#v5748eaic9rb5`: "For class abilities, feats, and other rule elements that vary based on or specifically depend on wielding a one-handed weapon, a two-handed weapon, or a one-handed weapon with two hands, the bastard sword counts as however many hands you are using to wield it." It goes on: wielded one-handed, "Power Attack only gets the one-handed bonus"; wielded two-handed, "Power Attack gets the increased damage bonus".

FAQ CRB, "Two-Handed Weapons" (March 2013), `#v5748eaic9qda`: removing a hand from a two-handed weapon or re-grabbing it are "Both ... free actions".

FAQ CRB, "Bonus Dice" (June 2011), `#v5748eaic9o61`: "The general rule is the only dice you multiply on a critical hit are the actual dice from the basic weapon (d8 for a longsword, 2d6 for a greatsword, and so on)."

FAQ CRB, "Critical Hits" (July 2013), `#v5748eaic9qv4`: "scoring a critical hit" and "confirming a critical hit" "mean the same thing".

- **Reading:** the Strength multiplier per line is 1 (primary hand, one-handed or light), 1/2 (off hand; full penalty), or 1-1/2 (two-handed or one-handed in two hands; not light weapons; penalties not multiplied). Bows: penalty only, unless composite. Thrown weapons and slings add Strength.

## Topic: Full Attack and Iterative Attacks

CRB p. 187, "Full Attack":

> "If you get more than one attack per round because your base attack bonus is high enough (see Base Attack Bonus in Chapter 3), because you fight with two weapons or a double weapon, or for some special reason, you must use a full-round action to get your additional attacks."

> "If you get multiple attacks because your base attack bonus is high enough, you must make the attacks in order from highest bonus to lowest. If you are using two weapons, you can strike with either weapon first. If you are using a double weapon, you can strike with either part of the weapon first."

> "**Deciding between an Attack or a Full Attack**: After your first attack, you can decide to take a move action instead of making your remaining attacks, depending on how the first attack turns out and assuming you have not already taken a move action this round."

CRB p. 182: "**Multiple Attacks**: A character who can make more than one attack per round must use the full-attack action (see Full-Round Actions) in order to get more than one attack."

FAQ CRB, "Multiple Weapons, Extra Attacks, and Two-Weapon Fighting" (November 2011), `#v5748eaic9onf`:

> "Yes. Basically, you only incur TWF penalties if you are trying to get an extra attack per round."

> "... once you decide you're using two-weapon fighting to get that extra attack on your turn (which you have to decide **before** you take any attacks on your turn), that decision locks you in to the format of "my primary weapon gets my main attack and my iterative attack, and my off hand weapon only gets the extra attack, and I apply two-weapon fighting penalties.""

*haste*, CRB p. 293 (the extra attack #216 prototyped):

> "When making a full attack action, a hasted creature may make one extra attack with one natural or manufactured weapon. The attack is made using the creature's full base attack bonus, plus any modifiers appropriate to the situation. (This effect is not cumulative with similar effects, such as that provided by a *speed* weapon, nor does it actually grant an extra action, so you can't use it to cast a second spell or otherwise take an extra action in the round.)"

FAQ CRB, "*Haste*" (February 2017), `#v5748eaic9ve1`: "Unarmed strikes and other attacks that work via full attacks ... all allow an extra attack with *haste*." FAQ CRB, "*Speed* Weapons" (June 2013), `#v5748eaic9qpr`: two *speed* weapons do not give two extra attacks; "a second *speed* weapon" is a similar effect.

## Topic: Routine Options

### Power Attack

CRB p. 131. Prerequisites: "Str 13, base attack bonus +1."

> "**Benefit**: You can choose to take a –1 penalty on all melee attack rolls and combat maneuver checks to gain a +2 bonus on all melee damage rolls. This bonus to damage is increased by half (+50%) if you are making an attack with a two-handed weapon, a one handed weapon using two hands, or a primary natural weapon that adds 1-1/2 times your Strength modifier on damage rolls. This bonus to damage is halved (–50%) if you are making an attack with an off-hand weapon or secondary natural weapon. When your base attack bonus reaches +4, and every 4 points thereafter, the penalty increases by –1 and the bonus to damage increases by +2. You must choose to use this feat before making an attack roll, and its effects last until your next turn. The bonus damage does not apply to touch attacks or effects that do not deal hit point damage."

The PRD and AoN wording match.

FAQ CRB, "Power Attack" (May 2013), `#v5748eaic9qno`: using a two-handed weapon with one hand "(such as a lance while mounted)", do you still get the +50%? "Yes." The later FAQ `#v5748eaic9quw` (July 2013, quoted above) covers the general case: a weapon wielded in one hand counts as one-handed for "the Power Attack damage bonus".

FAQ CRB, "Monk" (July 2011), `#v5748eaic9o72`: "The monk uses his improved flurrying BAB to determine the effect of those feats" (Power Attack and Combat Expertise).

FAQ CRB, "Two-Weapon Fighting" (March 2013), `#v5748eaic9qd4`: "penalties on attacks made during your turn do not carry over to attacks of opportunity unless they specifically state otherwise (such as the penalty from using Power Attack or Combat Expertise)."

- **Reading:** a melee-only option, applying to every melee attack and CMB until your next turn. Damage multiplier per line: ×1.5 two-handed, one-handed in two hands, or a primary natural weapon that gets 1-1/2 Strength (a sole natural attack); ×0.5 off-hand or secondary natural weapon (including natural attacks made secondary by weapon use, below); ×1 otherwise. The list does not name a light weapon in two hands, which also gets no extra Strength. Touch attacks get no bonus. The scale is in `pf1-tables.md`.
- How the halving applies to core flurry of blows, whose extra attacks are made "as if using the Two-Weapon Fighting feat" but all add full Strength, is not stated. **Open (A1).** The same goes for a two-handed monk weapon in a flurry. **Open (A2).**

### Deadly Aim

CRB p. 121. Prerequisites: "Dex 13, base attack bonus +1."

> "**Benefit**: You can choose to take a –1 penalty on all ranged attack rolls to gain a +2 bonus on all ranged damage rolls. When your base attack bonus reaches +4, and every +4 thereafter, the penalty increases by –1 and the bonus to damage increases by +2. You must choose to use this feat before making an attack roll and its effects last until your next turn. The bonus damage does not apply to touch attacks or effects that do not deal hit point damage."

- **Reading:** no hand-based multiplier (unlike Power Attack). Applies to all ranged attacks, thrown included ("Ranged weapons are thrown weapons or projectile weapons that are not effective in melee.", CRB p. 140).

### Combat Expertise

CRB p. 119. Prerequisite: "Int 13."

> "**Benefit**: You can choose to take a –1 penalty on melee attack rolls and combat maneuver checks to gain a +1 dodge bonus to your Armor Class. When your base attack bonus reaches +4, and every +4 thereafter, the penalty increases by –1 and the dodge bonus increases by +1. You can only choose to use this feat when you declare that you are making an attack or a full-attack action with a melee weapon. The effects of this feat last until your next turn."

Total Defense, CRB p. 185: "You can't combine total defense with fighting defensively or with the benefit of the Combat Expertise feat."

- **Reading:** dodge bonus, so it stacks with other dodge bonuses (CRB p. 179: "Unlike most sorts of bonuses, dodge bonuses stack with each other."), including fighting defensively. No text forbids combining Combat Expertise with fighting defensively; only total defense excludes both. The penalty carries over to attacks of opportunity (FAQ `#v5748eaic9qd4`).

### Arcane Strike

CRB p. 118. Prerequisite: "Ability to cast arcane spells."

> "**Benefit**: As a swift action, you can imbue your weapons with a fraction of your power. For 1 round, your weapons deal +1 damage and are treated as magic for the purpose of overcoming damage reduction. For every five caster levels you possess, this bonus increases by +1, to a maximum of +5 at 20th level."

FAQ CRB, "Weapon Attacks and Special Abilities" (September 2016), `#v5748eaic9uxg`: "Abilities like Arcane Strike that specifically enhance a character's weapon or weapons themselves never apply to special abilities (with the exception of special abilities like the warlock's mystic bolts that specifically call out that Arcane Strike applies)."

- **Reading:** untyped damage bonus on every weapon ("your weapons") for 1 round, melee and ranged; not multiplied by hand. The caster level is the character's ("caster levels you possess"), with no class named. Whether natural attacks and unarmed strikes are "your weapons" is not stated. **Open (A7).**

### Rapid Shot

CRB p. 132. Prerequisites: "Dex 13, Point-Blank Shot."

> "**Benefit**: When making a full-attack action with a ranged weapon, you can fire one additional time this round at your highest bonus. All of your attack rolls take a –2 penalty when using Rapid Shot."

- **Reading:** full attack only; one extra ranged attack at the highest bonus; –2 on every attack that round. Reload and draw rules still limit crossbows and thrown weapons (below).

### Manyshot

CRB p. 130. Prerequisites: "Dex 17, Point-Blank Shot, Rapid Shot, base attack bonus +6."

> "**Benefit**: When making a full-attack action with a bow, your first attack fires two arrows. If the attack hits, both arrows hit. Apply precision-based damage (such as sneak attack) and critical hit damage only once for this attack. Damage bonuses from using a composite bow with a high Strength bonus apply to each arrow, as do other damage bonuses, such as a ranger's favored enemy bonus. Damage reduction and resistances apply separately to each arrow."

FAQ CRB, "Manyshot" (March 2013), `#v5748eaic9qfz`: you cannot fire two arrows and then take a move: "Manyshot locks you into using a full attack action as soon as you use it to shoot two arrows."

- **Reading:** bows only (not crossbows, not thrown). No attack penalty of its own. One roll, two arrows' damage; precision damage and the crit multiplier's extra damage once.

### Vital Strike, Improved Vital Strike, Greater Vital Strike

Vital Strike, CRB p. 136. Prerequisite: "Base attack bonus +6."

> "**Benefit**: When you use the attack action, you can make one attack at your highest base attack bonus that deals additional damage. Roll the weapon's damage dice for the attack twice and add the results together before adding bonuses from Strength, weapon abilities (such as *flaming*), precision-based damage, and other damage bonuses. These extra weapon damage dice are not multiplied on a critical hit, but are added to the total."

Improved Vital Strike, CRB p. 128 (prerequisites "Vital Strike, base attack bonus +11"): the same text with "Roll the weapon's damage dice for the attack three times". Greater Vital Strike, CRB p. 126 (prerequisites "Improved Vital Strike, Vital Strike, base attack bonus +16"): "four times".

FAQ CRB, "Vital Strike" (November 2012), `#v5748eaic9pyy`:

> "No. Vital Strike can only be used as part of an attack action, which is a specific kind of standard action. Spring Attack is a special kind of full-round action that includes the ability to make one melee attack, not one attack action. Charging uses similar language and can also not be used in combination with Vital Strike."

- **Reading:** standard-action attack only; not on a charge, Spring Attack or a full attack. Works with any weapon, ranged included (no melee limit in the text). The higher feat's die count replaces the lower one: each feat states its own total ("twice", "three times", "four times"). The extra dice are not multiplied on a crit.
- "the weapon's damage dice" is not defined for natural attacks or unarmed strikes. **Open (A6).**

### Lunge

CRB p. 130. Prerequisite: "Base attack bonus +6."

> "**Benefit**: You can increase the reach of your melee attacks by 5 feet until the end of your turn by taking a –2 penalty to your AC until your next turn. You must decide to use this ability before any attacks are made."

- **Reading:** no attack or damage change; reach +5 ft for the turn and –2 AC (untyped penalty) until your next turn.

## Topic: Two-Weapon Fighting

CRB p. 202, "Two-Weapon Fighting":

> "If you wield a second weapon in your off hand, you can get one extra attack per round with that weapon. You suffer a –6 penalty with your regular attack or attacks with your primary hand and a –10 penalty to the attack with your off hand when you fight this way. You can reduce these penalties in two ways. First, if your off-hand weapon is light, the penalties are reduced by 2 each. An unarmed strike is always considered light. Second, the Two-Weapon Fighting feat lessens the primary hand penalty by 2, and the off-hand penalty by 6."

> "**Double Weapons**: You can use a double weapon to make an extra attack with the off-hand end of the weapon as if you were fighting with two weapons. The penalties apply as if the off-hand end of the weapon was a light weapon."

> "**Thrown Weapons**: The same rules apply when you throw a weapon from each hand. Treat a dart or shuriken as a light weapon when used in this manner, and treat a bolas, javelin, net, or sling as a one-handed weapon."

Table 8–7 is reproduced in `pf1-tables.md`.

Two-Weapon Fighting, CRB p. 136. Prerequisite: "Dex 15."

> "**Benefit**: Your penalties on attack rolls for fighting with two weapons are reduced. The penalty for your primary hand lessens by 2 and the one for your off hand lessens by 6. See Two-Weapon Fighting in Combat."

Improved Two-Weapon Fighting, CRB p. 128. Prerequisites: "Dex 17, Two-Weapon Fighting, base attack bonus +6."

> "**Benefit**: In addition to the standard single extra attack you get with an off-hand weapon, you get a second attack with it, albeit at a –5 penalty."

Greater Two-Weapon Fighting, CRB p. 126. Prerequisites: "Dex 19, Improved Two-Weapon Fighting, Two-Weapon Fighting, base attack bonus +11."

> "**Benefit**: You get a third attack with your off-hand weapon, albeit at a –10 penalty."

Double Slice, CRB p. 122. Prerequisites: "Dex 15, Two-Weapon Fighting."

> "**Benefit**: Add your Strength bonus to damage rolls made with your off-hand weapon. **Normal**: You normally add only half of your Strength modifier to damage rolls made with a weapon wielded in your off-hand."

Draw or Sheathe a Weapon, CRB p. 186: "If you have the Two-Weapon Fighting feat, you can draw two light or one-handed weapons in the time it would normally take you to draw one."

FAQ CRB:

- `#v5748eaic9qd4` (March 2013): "The penalties end as soon as you have completed the full-attack action that allowed you to attack with both weapons. Any attacks of opportunity you make are at your normal attack bonus."
- `#v5748eaic9qie` (April 2013), "Can I use two-weapon fighting to make two unarmed strikes in one round?" "Yes."
- `#v5748eaic9qw9` (July 2013), armor spikes as an off-hand attack while using a two-handed weapon: "No. Likewise, you couldn't use an armored gauntlet to do so, as you are using both of your hands to wield your two-handed weapon, therefore your off-hand is unavailable to make any attacks."
- `#v5748eaic9oga` (August 2011), shield bash: "you don't have to" make it an off-hand attack. Errata: "Page 152—In the Shield Bash Attacks section, in the first sentence, delete "using it as an off-hand weapon.""
- `#v5748eaic9vdp` (February 2017): "Shield Master allows a character to ignore the Two-Weapon Fighting penalties on attack rolls with a shield while wielding another weapon, but not any other penalties."

Shields and spikes as off-hand weapons (CRB p. 149 ff., Armor section; AoN start page): a heavy shield bash is treated "as a one-handed weapon" and a light shield bash "as a light weapon" "For the purpose of penalties on attack rolls"; "If you use your shield as a weapon, you lose its AC bonus until your next turn." Armor spikes: "You can also make a regular melee attack (or off-hand attack) with the spikes, and they count as a light weapon in this case. (You can't also make an attack with armor spikes if you have already made an attack with another off-hand weapon, and vice versa.)"

- **Reading:** primary and off-hand penalties come from Table 8–7. The off-hand iterative attacks from Improved and Greater TWF sit 5 and 10 below the first off-hand attack. The core monk's flurry table (`pf1-tables.md`) follows the same pattern. Off-hand damage adds 1/2 Strength, or full Strength with Double Slice. Power Attack's off-hand halving applies to the off-hand line.

## Topic: Weapon Finesse

CRB p. 136.

> "**Benefit**: With a light weapon, rapier, whip, or spiked chain made for a creature of your size category, you may use your Dexterity modifier instead of your Strength modifier on attack rolls. If you carry a shield, its armor check penalty applies to your attack rolls. **Special**: Natural weapons are considered light weapons."

Weapon descriptions, CRB p. 145 ff. (weapon description pages; AoN lists the weapons table at p. 142): the elven curve blade, rapier, spiked chain and whip each say "You can use the Weapon Finesse feat to apply your Dexterity modifier instead of your Strength modifier to attack rolls with [it] sized for you, even though it isn't a light weapon." Unarmed strike: "An unarmed strike is always considered a light weapon. Therefore, you can use the Weapon Finesse feat ... with an unarmed strike." Rapier: "You can't wield a rapier in two hands in order to apply 1-1/2 times your Strength bonus to damage."

FAQ CRB, "Weapon Finesse" (October 2011), `#v5748eaic9ojt`: Dexterity also replaces Strength on the combat maneuver check for disarm, sunder and trip made with a finessable weapon; "For other combat maneuvers, you use the normal rule for determining CMB (Str instead of Dex)."

- **Reading:** eligible lines: light weapons (including unarmed strikes, armor spikes, which "count as a light weapon" when attacking, and natural weapons), plus rapier, whip, spiked chain and elven curve blade (the last named only in its own description, not in the feat), each "made for a creature of your size category". Attack rolls only; damage keeps Strength. A carried shield's armor check penalty applies to attack rolls; the penalty value comes from the shield.
- The elven curve blade's eligibility is printed in the equipment chapter, not in the feat's list. That is not a contradiction (the specific item text grants it), so it is recorded here, not as an open item.

## Topic: Improved Critical and *keen*

Improved Critical, CRB p. 127. Prerequisites: "Proficient with weapon, base attack bonus +8."

> "**Benefit**: When using the weapon you selected, your threat range is doubled. **Special**: You can gain Improved Critical multiple times. The effects do not stack. Each time you take the feat, it applies to a new type of weapon. This effect doesn't stack with any other effect that expands the threat range of a weapon."

The PRD's copy of the CRB (legacy.aonprd.com) ends the Special at "it applies to a new type of weapon."; the last sentence is on AoN only. **Open (A15)**, a currency note.

*keen*, CRB p. 469 (PRD wording; the UE p. 144 reprint on AoN differs only in phrasing, e.g. "this special ability" and "any other effects"):

> "This ability doubles the threat range of a weapon. Only piercing or slashing melee weapons can be *keen*. If you roll this property randomly for an inappropriate weapon, reroll. This benefit doesn't stack with any other effect that expands the threat range of a weapon (such as the *keen edge* spell or the Improved Critical feat)."

FAQ CRB, "Weapon Specialization" (October 2010), `#v5748eaic9nef`: Improved Critical (ray) and Improved Critical (bomb) are "valid choices".

- **Reading:** *keen* and Improved Critical never stack, by *keen*'s own text in both sources. Doubling a range: 20 → 19–20, 19–20 → 17–20, 18–20 → 15–20 ("doubles the threat range"). Improvised Weapon Mastery sets 19–20 (completeness sweep).

## Topic: Crossbows and Rapid Reload

Weapon descriptions (CRB p. 145 ff.; AoN lists the weapons table at p. 142):

> "**Crossbow, Hand**: ... Loading a hand crossbow is a move action that provokes attacks of opportunity. You can shoot, but not load, a hand crossbow with one hand at no penalty. You can shoot a hand crossbow with each hand, but you take a penalty on attack rolls as if attacking with two light weapons."

> "**Crossbow, Heavy**: ... Loading a heavy crossbow is a full-round action that provokes attacks of opportunity. Normally, operating a heavy crossbow requires two hands. However, you can shoot, but not load, a heavy crossbow with one hand at a –4 penalty on attack rolls. You can shoot a heavy crossbow with each hand, but you take a penalty on attack rolls as if attacking with two one-handed weapons. This penalty is cumulative with the penalty for one-handed firing."

> "**Crossbow, Light**: ... Loading a light crossbow is a move action that provokes attacks of opportunity. Normally, operating a light crossbow requires two hands. However, you can shoot, but not load, a light crossbow with one hand at a –2 penalty on attack rolls. You can shoot a light crossbow with each hand, but you take a penalty on attack rolls as if attacking with two light weapons. This penalty is cumulative with the penalty for one-handed firing."

> "**Crossbow, Repeating**: The repeating crossbow (whether heavy or light) holds 5 crossbow bolts. As long as it holds bolts, you can reload it by pulling the reloading lever (a free action). Loading a new case of 5 bolts is a full-round action that provokes attacks of opportunity."

Rapid Reload, CRB p. 132, as printed in the PRD's copy of the CRB:

> "Choose a type of crossbow (hand, light, or heavy). You can reload such weapons quickly. **Prerequisite:** Weapon Proficiency (crossbow type chosen). **Benefit:** The time required for you to reload your chosen type of crossbow is reduced to a free action (for a hand or light crossbow) or a move action (for a heavy crossbow). Reloading a crossbow still provokes an attack of opportunity. If you have selected this feat for hand crossbow or light crossbow, you may fire that weapon as many times in a full-attack action as you could attack if you were using a bow. **Normal:** A character without this feat needs a move action to reload a hand or light crossbow, or a full-round action to reload a heavy crossbow. **Special:** You can gain Rapid Reload multiple times. Each time you take the feat, it applies to a new type of crossbow."

AoN prints a merged version (sources UC p. 115, *Inner Sea World Guide* p. 288, CRB p. 132) that adds firearms (**non-CRB**): reload "reduced to a free action (for a hand or light crossbow), a move action (for heavy crossbow or one-handed firearm), or a standard action (two-handed firearm)". The crossbow numbers are the same.

- **Reading (reload per crossbow):** hand and light: move action, free with Rapid Reload, and only with Rapid Reload "as many times in a full-attack action as you could attack if you were using a bow" (iteratives, Rapid Shot and *haste*). Heavy: full-round action, move action with Rapid Reload; the full-attack-rate sentence names only hand and light. Repeating: free lever reload while bolts remain; a new case of 5 is a full-round action, and Rapid Reload does not mention repeating crossbows.

## Topic: Weapon Focus and Weapon Specialization

Weapon Focus, CRB p. 136. Prerequisites: "Proficiency with selected weapon, base attack bonus +1."

> "Choose one type of weapon. You can also choose unarmed strike or grapple (or ray, if you are a spellcaster) as your weapon for the purposes of this feat. ... **Benefit**: You gain a +1 bonus on all attack rolls you make using the selected weapon. **Special**: You can gain this feat multiple times. Its effects do not stack. Each time you take the feat, it applies to a new type of weapon."

Greater Weapon Focus, CRB p. 126. Prerequisites: "Proficiency with selected weapon, Weapon Focus with selected weapon, base attack bonus +1, 8th-level fighter."

> "**Benefit**: You gain a +1 bonus on attack rolls you make using the selected weapon. This bonus stacks with other bonuses on attack rolls, including those from Weapon Focus."

Weapon Specialization, CRB p. 137. Prerequisites: "Proficiency with selected weapon, Weapon Focus with selected weapon, fighter level 4th."

> "**Benefit**: You gain a +2 bonus on all damage rolls you make using the selected weapon."

Greater Weapon Specialization, CRB p. 126. Prerequisites: "Proficiency with selected weapon, Greater Weapon Focus with selected weapon, Weapon Focus with selected weapon, Weapon Specialization with selected weapon, 12th-level fighter."

> "**Benefit**: You gain a +2 bonus on all damage rolls you make using the selected weapon. This bonus to damage stacks with other damage roll bonuses, including any you gain from Weapon Specialization."

Composite bows (CRB weapon descriptions): "For purposes of Weapon Proficiency and similar feats, a composite longbow is treated as if it were a longbow." The composite shortbow says "For purposes of Weapon Proficiency, Weapon Focus, and similar feats, a composite shortbow is treated as if it were a shortbow."

FAQ CRB `#v5748eaic9nef` (October 2010): Weapon Specialization (ray) and (bomb) are valid; "Weapon Specialization (ray) only adds to **hit point** damage caused by a ray attack".

- **Reading:** untyped bonuses that stack with each other by their own text: +1/+2 attack, +2/+4 damage on the chosen weapon type. Damage is not multiplied by hand.
- The CRB lists unarmed strike, grapple and ray as choices. It does not say whether a natural attack type (bite, claw) is a "type of weapon" for these feats. **Open (A8).**

## Topic: Fighter Weapon Training and Weapon Mastery

CRB p. 55 (fighter entry; Weapon Training is in the class features that follow).

> "**Weapon Training (Ex)**: Starting at 5th level, a fighter can select one group of weapons, as noted below. Whenever he attacks with a weapon from this group, he gains a +1 bonus on attack and damage rolls."

> "Every four levels thereafter (9th, 13th, and 17th), a fighter becomes further trained in another group of weapons. He gains a +1 bonus on attack and damage rolls when using a weapon from this group. In addition, the bonuses granted by previous weapon groups increase by +1 each. For example, when a fighter reaches 9th level, he receives a +1 bonus on attack and damage rolls with one weapon group and a +2 bonus on attack and damage rolls with the weapon group selected at 5th level. Bonuses granted from overlapping groups do not stack. Take the highest bonus granted for a weapon if it resides in two or more groups."

> "A fighter also adds this bonus to any combat maneuver checks made with weapons from this group. This bonus also applies to the fighter's Combat Maneuver Defense when defending against disarm and sunder attempts made against weapons from this group."

> "Weapon groups are defined as follows (GMs may add other weapons to these groups, or add entirely new groups):"

The CRB's 14 groups are listed in `pf1-tables.md`. AoN replaces the list with "A consolidated list of fighter weapon groups", which includes later books (**non-CRB**).

> "**Weapon Mastery (Ex)**: At 20th level, a fighter chooses one weapon, such as the longsword, greataxe, or longbow. Any attacks made with that weapon automatically confirm all critical threats and have their damage multiplier increased by 1 (×2 becomes ×3, for example). In addition, he cannot be disarmed while wielding a weapon of this type."

FAQ CRB `#v5748eaic9rdl` (*bane*, November 2013) compares: "fighter weapon training or ranger favored enemy bonuses, both of which say you use the highest bonus if more than one bonus applies." FAQ CRB `#v5748eaic9uxg` (September 2016): rays and other special abilities "are not part of any weapon group and don't qualify for the effects of fighter weapon training".

- **Reading:** the bonus belongs to the group, ranked by the order chosen: the newest group +1, each earlier group +1 more. A weapon in several trained groups takes the highest. It is untyped and applies to attack, damage, CMB with the weapon, and CMD against disarm and sunder of it. The #229 comment notes that `ModifierCondition.weapon` cannot yet target a group; the weapon detail already records `group`.

## Topic: Combat Actions as Situations

### Fighting defensively

CRB p. 182 (standard action) and p. 187 (full-round action), same wording:

> "**Fighting Defensively as a Standard Action**: You can choose to fight defensively when attacking. If you do so, you take a –4 penalty on all attacks in a round to gain a +2 dodge bonus to AC until the start of your next turn."

> "**Fighting Defensively as a Full-Round Action**: You can choose to fight defensively when taking a full-attack action. If you do so, you take a –4 penalty on all attacks in a round to gain a +2 dodge bonus to AC until the start of your next turn."

Acrobatics, CRB p. 87 (skill entry):

> "**Special**: If you have 3 or more ranks in Acrobatics, you gain a +3 dodge bonus to AC when fighting defensively instead of the usual +2, and a +6 dodge bonus to AC when taking the total defense action instead of the usual +4."

Two-Weapon Defense, CRB p. 136: "When wielding a double weapon or two weapons (not including natural weapons or unarmed strikes), you gain a +1 shield bonus to your AC. When you are fighting defensively or using the total defense action, this shield bonus increases to +2."

- **Reading:** –4 on all attacks that round; dodge +2 (+3 with 3+ Acrobatics ranks) until the start of your next turn. It stacks with Combat Expertise (both dodge). It does not combine with total defense.
- Whether the "–4 penalty on all attacks in a round" reaches attacks of opportunity made before your next turn is not stated. The FAQ names only Power Attack and Combat Expertise as carrying over. **Open (A11).**

### Total defense

CRB p. 185:

> "You can defend yourself as a standard action. You get a +4 dodge bonus to your AC for 1 round. Your AC improves at the start of this action. You can't combine total defense with fighting defensively or with the benefit of the Combat Expertise feat. You can't make attacks of opportunity while using total defense."

- **Reading:** total defense uses the turn's standard action, so there is no attack action or full attack that turn. AC +4 dodge (+6 with 3+ Acrobatics ranks; Two-Weapon Defense becomes +2 shield).

### Charge

CRB p. 198:

> "Charging is a special full-round action that allows you to move up to twice your speed and attack during the action."

> "**Attacking on a Charge**: After moving, you may make a single melee attack. You get a +2 bonus on the attack roll and take a –2 penalty to your AC until the start of your next turn."

> "Even if you have extra attacks, such as from having a high enough base attack bonus or from using multiple weapons, you only get to make one attack during a charge."

> "**Lances and Charge Attacks**: A lance deals double damage if employed by a mounted character in a charge."

> "**Weapons Readied against a Charge**: Spears, tridents, and other weapons with the brace feature deal double damage when readied (set) and used against a charging character."

FAQ CRB, "Ready" (June 2011), `#v5748eaic9o4q`: you cannot ready a charge. FAQ CRB, "Mounted Combat" (March 2014), `#v5748eaic9ru6`, replaces the third paragraph of "Combat while Mounted" (p. 202):

> "A mounted charge is a charge made by you and your mount. During a mounted charge, you deal double damage with your first melee attack made with a lance or with any weapon if you have Spirited Charge (or a similar effect), or you deal triple damage with a lance and Spirited Charge."

FAQ CRB, "Lance" (March 2012), `#v5748eaic9p1k`: with pounce, iterative lance attacks after the first do not get the charge multiplier.

Mounted combat, CRB p. 201: "When you attack a creature smaller than your mount that is on foot, you get the +1 bonus on melee attacks for being on higher ground. If your mount moves more than 5 feet, you can only make a single melee attack." "You can use ranged weapons while your mount is taking a double move, but at a –4 penalty on the attack roll. You can use ranged weapons while your mount is running (quadruple speed) at a –8 penalty."

Lance (CRB weapon descriptions): "A lance deals double damage when used from the back of a charging mount. While mounted, you can wield a lance with one hand."

- **Reading:** a charge is one melee attack at +2, AC –2 until your next turn, no Vital Strike (FAQ). Damage is doubled only by a lance in a mounted charge or by Spirited Charge; a lance with Spirited Charge triples. The multiplier follows the Multiplying Damage rule (×2 and ×2 on a crit give ×3).

## Topic: Natural Attacks

### Core Rulebook

CRB p. 182 ("Attack"):

> "**Natural Attacks**: Attacks made with natural weapons, such as claws and bites, are melee attacks that can be made against any creature within your reach (usually 5 feet). These attacks are made using your full attack bonus and deal an amount of damage that depends on their type (plus your Strength modifier, as normal). You do not receive additional natural attacks for a high base attack bonus. Instead, you receive additional attack rolls for multiple limb and body parts capable of making the attack (as noted by the race or ability that grants the attacks). If you possess only one natural attack (such as a bite—two claw attacks do not qualify), you add 1–1/2 times your Strength bonus on damage rolls made with that attack."

> "Some natural attacks are denoted as secondary natural attacks, such as tails and wings. Attacks with secondary natural attacks are made using your base attack bonus minus 5. These attacks deal an amount of damage depending on their type, but you only add half your Strength modifier on damage rolls."

> "You can make attacks with natural weapons in combination with attacks made with a melee weapon and unarmed strikes, so long as a different limb is used for each attack. For example, you cannot make a claw attack and also use that hand to make attacks with a longsword. When you make additional attacks in this way, all of your natural attacks are treated as secondary natural attacks, using your base attack bonus minus 5 and adding only 1/2 of your Strength modifier on damage rolls. Feats such as Two-Weapon Fighting and Multiattack can reduce these penalties."

CRB p. 182: "A monk, a character with the Improved Unarmed Strike feat, a spellcaster delivering a touch attack spell, and a creature with natural physical weapons all count as being armed (see natural attacks)."

FAQ CRB, "Natural Attacks" (August 2013), `#v5748eaic9qwt`: "Am I proficient in my natural attacks?" "Yes. Whether you get those natural attacks from your race (as stated in the *Bestiary* entry on natural attacks), your class (as stated in the druid proficiency list), a polymorph effect (as stated in the Magic chapter), or any other source (such as an alchemist's feral mutagen), you are proficient in your natural attacks."

### Bestiary universal monster rule (non-CRB)

B1 p. 301, "Natural Attacks" (Universal Monster Rules), as printed in the PRD's copy of B1 (https://legacy.aonprd.com/bestiary/universalMonsterRules.html):

> "Most creatures possess one or more natural attacks (attacks made without a weapon). These attacks fall into one of two categories, primary and secondary attacks. Primary attacks are made using the creature's full base attack bonus and add the creature's full Strength bonus on damage rolls. Secondary attacks are made using the creature's base attack bonus –5 and add only 1/2 the creature's Strength bonus on damage rolls. If a creature has only one natural attack, it is always made using the creature's full base attack bonus and adds 1-1/2 the creature's Strength bonus on damage rolls. This increase does not apply if the creature has multiple attacks but only takes one. If a creature has only one type of attack, but has multiple attacks per round, that attack is treated as a primary attack, regardless of its type. Table: Natural Attacks by Size lists some of the most common types of natural attacks and their classifications."

> "Some creatures treat one or more of their attacks differently, such as dragons, which always receive 1-1/2 times their Strength bonus on damage rolls with their bite attack. These exceptions are noted in the creature's description."

> "Creatures with natural attacks and attacks made with weapons can use both as part of a full attack action (although often a creature must forgo one natural attack for each weapon clutched in that limb, be it a claw, tentacle, or slam). Such creatures attack with their weapons normally but treat all of their natural attacks as secondary attacks during that attack, regardless of the attack's original type."

> "The Damage Type column refers to the sort of damage that the natural attack typically deals: bludgeoning (B), slashing (S), or piercing (P). Some attacks deal damage of more than one type, depending on the creature. In such cases all the damage is considered to be of all listed types for the purpose of overcoming damage reduction."

> "Some fey, humanoids, monstrous humanoids, and outsiders do not possess natural attacks. These creatures can make unarmed strikes, but treat them as weapons for the purpose of determining attack bonuses, and they must use the two-weapon fighting rules when making attacks with both hands."

AoN prints a merged version (sources *Bestiary* 1 to 6) with later wording, for example "although a creature must forgo one natural attack, be it a claw, slam, or tentacle attack, for each weapon clutched in a limb that would otherwise make a natural attack". The rules are the same. Table: Natural Attacks by Size (part of the same B1 entry; AoN "Table 3–1") is in `pf1-tables.md`, with the primary or secondary type of each attack.

Monster feats (**non-CRB**), B1 p. 315:

> Multiattack: "**Prerequisites**: Three or more natural attacks. **Benefit**: The creature's secondary attacks with natural weapons take only a –2 penalty. **Normal**: Without this feat, the creature's secondary attacks with natural weapons take a –5 penalty."

> Improved Natural Attack: "**Prerequisites**: Natural weapon, base attack bonus +4. **Benefit**: Choose one of the creature's natural attack forms (not an unarmed strike). The damage for this natural attack increases by one step on the following list, as if the creature's size had increased by one category. Damage dice increase as follows: 1d2, 1d3, 1d4, 1d6, 1d8, 2d6, 3d6, 4d6, 6d6, 8d6, 12d6. A weapon or attack that deals 1d10 points of damage increases as follows: 1d10, 2d8, 3d8, 4d8, 6d8, 8d8, 12d8."

Other official text on natural attacks (all **non-CRB** except the CRB FAQ):

- FAQ Bestiary, "Claws and Talons" (November 2013), https://paizo.com/paizo/faq/v5748nruor1fo#v5748eaic9rdk: a biped's claws "must go on your hands"; talons "go on a creature's feet"; "If you have claws on all of your feet, normally you can't use all of those claw attacks on your turn unless you have a special ability such as pounce or rake."
- FAQ UM, "Alchemist, Tentacle/Vestigial Arm" (November 2013), https://paizo.com/paizo/faq/v5748nruor1fz#v5748eaic9rc5: the discoveries are exceptions because "the standard rules for using natural weapons ... would normally allow you to make the natural weapon attack in addition to your other attacks". Its example is a two-weapon fighter.
- FAQ CRB, "*Amulet of Mighty Fists*" (July 2011), `#v5748eaic9oaf`: a *speed* amulet does not give each natural weapon an extra attack.
- FAQ CRB, "Size Changes ... and Damage Dice Progression" (March 2015), `#v5748eaic9t3f`: the general step chart for natural and manufactured weapon damage when size changes (in `pf1-tables.md`).

- **Reading (routine lines):** natural attacks never get iteratives. Primary: full attack bonus, full Strength. Secondary: –5, 1/2 Strength (–2 with Multiattack). A sole natural attack: full bonus, 1-1/2 Strength, unless the creature has multiple attacks and takes only one (B1). With any weapon or unarmed-strike attack in the same full attack, every natural attack becomes secondary, and a limb holding a weapon cannot also make its natural attack. Weapon Finesse treats natural weapons as light. Power Attack halves on secondary natural attacks and adds 50% on a primary natural weapon that adds 1-1/2 Strength.
- Neither text says how Two-Weapon Fighting "can reduce these penalties" when natural attacks are added to weapon attacks. Nor does it say whether the weapon attacks then take two-weapon penalties (the UM FAQ example implies natural attacks can be added on top of two-weapon fighting). **Open (A5).**

## Topic: Unarmed Strikes

CRB p. 182 ("Attack"):

> "*Unarmed Strike Damage*: An unarmed strike from a Medium character deals 1d3 points of bludgeoning damage (plus your Strength modifier, as normal). A Small character's unarmed strike deals 1d2 points of bludgeoning damage, while a Large character's unarmed strike deals 1d4 points of bludgeoning damage. All damage from unarmed strikes is nonlethal damage. Unarmed strikes count as light weapons (for purposes of two-weapon attack penalties and so on)."

> "*Dealing Lethal Damage*: You can specify that your unarmed strike will deal lethal damage before you make your attack roll, but you take a –4 penalty on your attack roll. If you have the Improved Unarmed Strike feat, you can deal lethal damage with an unarmed strike without taking a penalty on the attack roll."

> "*Attacks of Opportunity*: Attacking unarmed provokes an attack of opportunity from the character you attack, provided she is armed."

Unarmed strike (CRB weapons table p. 142, description p. 145 ff.): "1d2 (small), 1d3 (medium); Critical x2; ... Type B; Special nonlethal". Description:

> "A Medium character deals 1d3 points of nonlethal damage with an unarmed strike. A Small character deals 1d2 points of nonlethal damage. A monk or any character with the Improved Unarmed Strike feat can deal lethal or nonlethal damage with unarmed strikes, at his discretion. The damage from an unarmed strike is considered weapon damage for the purposes of effects that give you a bonus on weapon damage rolls. An unarmed strike is always considered a light weapon. Therefore, you can use the Weapon Finesse feat to apply your Dexterity modifier instead of your Strength modifier to attack rolls with an unarmed strike. Unarmed strikes do not count as natural weapons (see Combat)."

> "**Gauntlet**: This metal glove lets you deal lethal damage rather than nonlethal damage with unarmed strikes. A strike with a gauntlet is otherwise considered an unarmed attack." "**Gauntlet, Spiked**: ... An attack with a spiked gauntlet is considered an armed attack."

Improved Unarmed Strike, CRB p. 128:

> "**Benefit**: You are considered to be armed even when unarmed—you do not provoke attacks of opportunity when you attack foes while unarmed. Your unarmed strikes can deal lethal or nonlethal damage, at your choice. **Normal**: Without this feat, you are considered unarmed when attacking with an unarmed strike, and you can deal only nonlethal damage with such an attack."

FAQ CRB, "Unarmed Strike" (March 2013), `#v5748eaic9qd3`: "a creature's unarmed strike is its entire body, and a *magic fang* (or similar spell) cast on a creature's unarmed strike affects all unarmed strikes the creature makes."

- **Reading:** nonlethal by default; lethal at –4 to attack, or freely with Improved Unarmed Strike, a monk, or a gauntlet. Light weapon (finessable; light for Table 8–7; no 1-1/2 Strength in two hands). Damage 1d2/1d3/1d4 for Small/Medium/Large, ×2, bludgeoning. Other sizes use the CRB's Tiny and Large weapon damage table or the FAQ's step chart. For a monk at sizes other than Small, Medium and Large: **Open (A14).**

### Monk unarmed strike and flurry of blows (Core Rulebook)

CRB p. 56 (monk entry; Table: Monk and these features follow). Monk table columns and the Small/Large damage table are in `pf1-tables.md`.

> "**Flurry of Blows (Ex)**: Starting at 1st level, a monk can make a flurry of blows as a full-attack action. When doing so, he may make one additional attack, taking a –2 penalty on all of his attack rolls, as if using the Two-Weapon Fighting feat. These attacks can be any combination of unarmed strikes and attacks with a monk special weapon (he does not need to use two weapons to utilize this ability). For the purpose of these attacks, the monk's base attack bonus from his monk class levels is equal to his monk level. For all other purposes, such as qualifying for a feat or a prestige class, the monk uses his normal base attack bonus."

> "At 8th level, the monk can make two additional attacks when he uses flurry of blows, as if using Improved Two-Weapon Fighting (even if the monk does not meet the prerequisites for the feat)."

> "At 15th level, the monk can make three additional attacks using flurry of blows, as if using Greater Two-Weapon Fighting (even if the monk does not meet the prerequisites for the feat)."

> "A monk applies his full Strength bonus to his damage rolls for all successful attacks made with flurry of blows, whether the attacks are made with an off-hand or with a weapon wielded in both hands. A monk may substitute disarm, sunder, and trip combat maneuvers for unarmed attacks as part of a flurry of blows. A monk cannot use any weapon other than an unarmed strike or a special monk weapon as part of a flurry of blows. A monk with natural weapons cannot use such weapons as part of a flurry of blows, nor can he make natural attacks in addition to his flurry of blows attacks."

> "**Unarmed Strike**: At 1st level, a monk gains Improved Unarmed Strike as a bonus feat. A monk's attacks may be with fist, elbows, knees, and feet. This means that a monk may make unarmed strikes with his hands full. There is no such thing as an off-hand attack for a monk striking unarmed. A monk may thus apply his full Strength bonus on damage rolls for all his unarmed strikes."

> "Usually a monk's unarmed strikes deal lethal damage, but he can choose to deal nonlethal damage instead with no penalty on his attack roll. He has the same choice to deal lethal or nonlethal damage while grappling."

> "A monk's unarmed strike is treated as both a manufactured weapon and a natural weapon for the purpose of spells and effects that enhance or improve either manufactured weapons or natural weapons."

> "A monk also deals more damage with his unarmed strikes than a normal person would, as shown above on Table: Monk. The unarmed damage values listed on Table: Monk is for Medium monks. A Small monk deals less damage than the amount given there with his unarmed attacks, while a Large monk deals more damage; see Small or Large Monk Unarmed Damage on the table given below."

> "Weapon and Armor Proficiency: ... When wearing armor, using a shield, or carrying a medium or heavy load, a monk loses his AC bonus, as well as his fast movement and flurry of blows abilities."

> "*Ki* Pool (Su): ... By spending 1 point from his *ki* pool, a monk can make one additional attack at his highest attack bonus when making a flurry of blows attack. ... Each of these powers is activated as a swift action."

Weapon quality, CRB p. 144: "*Monk*: A monk weapon can be used by a monk to perform a flurry of blows (see Classes)."

FAQ CRB on core flurry:

- `#v5748eaic9naz` (September 2010): "A monk using flurry treats his BAB from monk levels as equal to his monk level. He still adds BAB from other sources (such as other classes or racial Hit Dice) normally to this total. So a fighter 19/monk 1 has a normal BAB of +19. When he flurries, he treats his monk BAB as +1 (for his 1 level of monk) and still gets BAB +19 from his fighter levels, for a total flurry BAB of +20."
- `#v5748eaic9o72` (July 2011): Power Attack and Combat Expertise use "his improved flurrying BAB".
- `#v5748eaic9pyx` (November 2012): "You can make all of your attacks with a single monk weapon. Alternatively, you can replace any number of these attacks with an unarmed strike. This FAQ specifically changes a previous ruling made in the blog concerning this issue."
- `#v5748eaic9qk0` (April 2013): the ki extra attack and *haste*'s extra attack stack: "the monk would get two additional attacks".
- `#v5748eaic9qd7` (March 2013): at 7th level, unarmed strikes count as cold iron and silver for damage reduction (now in the class text above).
- `#v5748eaic9qdb` (March 2013): the "monk" weapon feature "doesn't grant proficiency in the weapon".

FAQ UC (**non-CRB**), "Feral Combat Training" (February 2012), https://paizo.com/paizo/faq/v5748nruor1g1#v5748eaic9ozd: "Normally a monk who has natural attacks (such as a lizardfolk monk with claw attacks) cannot use those natural attacks as part of a flurry of blows (*Core Rulebook* 57)." This gives the CRB page of the flurry text as 57.

- **Reading (core flurry):** full-attack action; the monk-level portion of BAB becomes the monk level and other BAB adds. Attacks: the iteratives from that BAB plus one extra (two at 8th, three at 15th) at the TWF-style positions, all at –2. Unarmed strikes and monk weapons only, in any mix; no armor, shield or medium load; no natural attacks. Full Strength on every flurry attack. Ki adds one attack at the highest bonus; *haste* adds another. The "Flurry of Blows Attack Bonus" column of Table: Monk gives the result for a pure monk (`pf1-tables.md`).
- Open: Power Attack halving on flurry attacks (**A1**), two-handed monk weapons in a flurry (**A2**), and whether flurry counts as two-weapon fighting for feats keyed to it (Double Slice, Two-Weapon Rend, the TWF chain) (**A3**).

### Monk unarmed strike and flurry of blows (Pathfinder Unchained, non-CRB)

PU p. 14 (AoN class-entry page for the unchained monk; Table 1–2: Monk). Full BAB.

> "**Flurry of Blows (Ex)**: At 1st level, a monk can make a flurry of blows as a full-attack action. When making a flurry of blows, the monk can make one additional attack at his highest base attack bonus. This additional attack stacks with the bonus attacks from *haste* and other similar effects. When using this ability, the monk can make these attacks with any combination of his unarmed strikes and weapons that have the monk special weapon quality. He takes no penalty for using multiple weapons when making a flurry of blows, but he does not gain any additional attacks beyond what's already granted by the flurry for doing so. (He can still gain additional attacks from a high base attack bonus, from this ability, and from haste and similar effects)."

> "At 11th level, a monk can make an additional attack at his highest base attack bonus whenever he makes a flurry of blows. This stacks with the first attack from this ability and additional attacks from *haste* and similar effects."

> "**Unarmed Strike (Ex)**: At 1st level, a monk gains Improved Unarmed Strike as a bonus feat. A monk's attacks can be with fists, elbows, knees, and feet. This means that a monk can make unarmed strikes with his hands full. There is no such thing as an off-hand attack for a monk striking unarmed. A monk can apply his full Strength bonus on damage rolls for all his unarmed strikes. A monk's unarmed strikes deal lethal damage, although he can choose to deal nonlethal damage with no penalty on his attack roll. He can make this choice while grappling as well."

> "A monk's unarmed strike is treated as both a manufactured weapon and a natural weapon for the purpose of spells and effects that enhance or improve either manufactured weapons or natural weapons. The damage dealt by a monk's unarmed strike is determined by the unarmed damage column on Table 1–2: Monk. The damage listed is for Medium monks. The damage for Small or Large monks is listed below."

> "*Ki* Pool (Su): ... By spending 1 point from his ki pool as a swift action, a monk can make one additional unarmed strike at his highest attack bonus when making a flurry of blows attack. This bonus attack stacks with all bonus attacks gained from flurry of blows, as well as those from haste and similar effects."

The unchained proficiency list adds "any weapon with the monk special weapon quality". PU FAQ (May 2015, one entry, on the unchained rogue) has nothing on flurry.

- **Reading (unchained flurry):** no BAB substitution and no attack penalty. Attacks: normal iteratives plus one at the highest BAB (two from 11th), plus ki (an unarmed strike) and *haste*, all stacking. Unarmed damage per the table (the same dice as the core monk; `pf1-tables.md`).
- The unchained text gives full Strength for unarmed strikes but says nothing about Strength for a monk weapon used in a flurry (off hand, two hands), and nothing about Power Attack on those attacks. **Open (A4).**

## Topic: Thrown Weapons

Weapon categories, CRB p. 140 (Weapons section; AoN start page):

> "*Thrown Weapons*: Daggers, clubs, shortspears, spears, darts, javelins, throwing axes, light hammers, tridents, shuriken, and nets are thrown weapons. The wielder applies his Strength modifier to damage dealt by thrown weapons (except for splash weapons). It is possible to throw a weapon that isn't designed to be thrown (that is, a melee weapon that doesn't have a numeric entry in the Range column on Table: Weapons), and a character who does so takes a –4 penalty on the attack roll. Throwing a light or one-handed weapon is a standard action, while throwing a two-handed weapon is a full-round action. Regardless of the type of weapon, such an attack scores a threat only on a natural roll of 20 and deals double damage on a critical hit. Such a weapon has a range increment of 10 feet."

> "*Projectile Weapons*: ... A character gets no Strength bonus on damage rolls with a projectile weapon unless it's a specially built composite shortbow or longbow, or a sling. If the character has a penalty for low Strength, apply it to damage rolls when he uses a bow or a sling."

> Range: "Beyond this range, the attack takes a cumulative –2 penalty for each full range increment (or fraction thereof) of distance to the target. ... A thrown weapon has a maximum range of five range increments. A projectile weapon can shoot to 10 range increments."

Two-weapon thrown attacks, CRB p. 202 (quoted above): "Treat a dart or shuriken as a light weapon when used in this manner, and treat a bolas, javelin, net, or sling as a one-handed weapon."

Shuriken: "Although they are thrown weapons, shuriken are treated as ammunition for the purposes of drawing them". Drawing ammunition is a free action (CRB p. 186).

Quick Draw, CRB p. 131:

> "**Benefit**: You can draw a weapon as a free action instead of as a move action. You can draw a hidden weapon (see the Sleight of Hand skill) as a move action. A character who has selected this feat may throw weapons at his full normal rate of attacks (much like a character with a bow). Alchemical items, potions, scrolls, and wands cannot be drawn quickly using this feat."

Draw or Sheathe a Weapon, CRB p. 186: "Drawing a weapon ... requires a move action." "If you have a base attack bonus of +1 or higher, you may draw a weapon as a free action combined with a regular move."

- **Reading:** thrown attacks add Strength to damage (the text says "Strength modifier" without a hand multiplier). They use Dexterity to hit (ranged formula), take range penalties, and count for Deadly Aim, Rapid Shot and Point-Blank Shot as ranged attacks. Improvised throws: –4, 20/×2, range 10 ft.
- The CRB never states how many thrown attacks a full attack allows without Quick Draw. Quick Draw grants "full normal rate", and drawing otherwise takes a move action. **Open (A9).** Shuriken draw as ammunition and escape this limit.
- Whether a two-handed thrown weapon adds 1-1/2 Strength is not addressed; the Strength-multiplier rules are written for melee ("melee attacks with such a weapon"). This is folded into A9 as part of thrown-weapon damage.

## Topic: Double Weapons

Weapon categories, CRB p. 140 (Weapons section; AoN start page):

> "*Double Weapons*: Dire flails, dwarven urgroshes, gnome hooked hammers, orc double axes, quarterstaves, and two-bladed swords are double weapons. A character can fight with both ends of a double weapon as if fighting with two weapons, but he incurs all the normal attack penalties associated with two-weapon combat, just as though the character were wielding a one-handed weapon and a light weapon."

> "The character can also choose to use a double weapon two-handed, attacking with only one end of it. A creature wielding a double weapon in one hand can't use it as a double weapon—only one end of the weapon can be used in any given round."

Weapon qualities, CRB p. 144:

> "*Double*: You can use a double weapon to fight as if fighting with two weapons, but if you do, you incur all the normal attack penalties associated with fighting with two weapons, just as if you were using a one-handed weapon and a light weapon. You can choose to wield one end of a double weapon two-handed, but it cannot be used as a double weapon when wielded in this way—only one end of the weapon can be used in any given round."

> "**Dmg**: ... If two damage ranges are given, then the weapon is a double weapon. Use the second damage figure given for the double weapon's extra attack." "×*3/*×*4*: One head of this double weapon deals triple damage on a critical hit. The other head deals quadruple damage on a critical hit."

Gnome hooked hammer and dwarven urgrosh descriptions: "You can use either head as the primary weapon." (urgrosh: "The other becomes the off-hand weapon.")

FAQ CRB, "Paladin, divine bond" (August 2013), `#v5748eaic9qwv`: two uses can enhance "both sides of a double weapon". Masterwork and magic: "Adding the masterwork quality to a double weapon costs twice the normal increase"; each head is enchanted separately (CRB equipment, special materials).

- **Reading:** as a double weapon the off-hand end is light for Table 8–7 (–4/–8, or –2/–2 with Two-Weapon Fighting), and the off-hand end gets 1/2 Strength like any off-hand weapon. Used two-handed (one end only) it is a two-handed weapon: 1-1/2 Strength and Power Attack +50%.
- When used as a double weapon, the Strength multiplier and the Power Attack bonus for the **primary** end (1 or 1-1/2) are not stated. **Open (A10).**

## Topic: Weapon Special Abilities

General rules, CRB p. 468, "Magic Weapons":

> "Magic weapons have enhancement bonuses ranging from +1 to +5. They apply these bonuses to both attack and damage rolls when used in combat. All magic weapons are also masterwork weapons, but their masterwork bonuses on attack rolls do not stack with their enhancement bonuses on attack rolls."

> "**Additional Damage Dice**: Some magic weapons deal additional dice of damage. Unlike other modifiers to damage, additional dice of damage are not multiplied when the attacker scores a critical hit."

> "**Ranged Weapons and Ammunition**: The enhancement bonus from a ranged weapon does not stack with the enhancement bonus from ammunition. Only the higher of the two enhancement bonuses applies."

> "**Magic Weapons and Critical Hits**: Some weapon special abilities and some specific weapons have an extra effect on a critical hit. This special effect also functions against creatures not normally subject to critical hits. On a successful critical roll, apply the special effect, but do not multiply the weapon's regular damage."

Special ability descriptions, CRB pp. 469–471 (AoN cites p. 469 for each; UE pp. 135–149 reprints them):

> *Flaming*: "Upon command, a *flaming weapon* is sheathed in fire that deals an extra 1d6 points of fire damage on a successful hit. The fire does not harm the wielder. The effect remains until another command is given."

> *Frost*: "Upon command, a *frost weapon* is sheathed in icy cold that deals an extra 1d6 points of cold damage on a successful hit. ..."

> *Shock*: "Upon command, a *shock weapon* is sheathed in crackling electricity that deals an extra 1d6 points of electricity damage on a successful hit. ..."

> *Flaming Burst*: "A *flaming burst weapon* functions as a *flaming weapon* that also explodes with flame upon striking a successful critical hit. The fire does not harm the wielder. In addition to the extra fire damage from the *flaming* ability (see above), a *flaming burst weapon* deals an extra 1d10 points of fire damage on a successful critical hit. If the weapon's critical multiplier is ×3, add an extra 2d10 points of fire damage instead, and if the multiplier is ×4, add an extra 3d10 points of fire damage."

> *Icy Burst* and *Shocking Burst*: the same pattern for cold and electricity ("In addition to the extra damage from the *frost* ability ... an extra 1d10 points of cold damage on a successful critical hit. If the weapon's critical multiplier is ×3, add an extra 2d10 points of cold damage instead, and if the multiplier is ×4, add an extra 3d10 points.").

> *Thundering*: "A *thundering weapon* creates a cacophonous roar like thunder upon striking a successful critical hit. The sonic energy does not harm the wielder. A *thundering weapon* deals an extra 1d8 points of sonic damage on a successful critical hit. If the weapon's critical multiplier is ×3, add an extra 2d8 points of sonic damage instead, and if the multiplier is ×4, add an extra 3d8 points of sonic damage. Subjects dealt critical hits by a *thundering weapon* must make a DC 14 Fortitude save or be deafened permanently."

> *Holy*: "A *holy weapon* is imbued with holy power. This power makes the weapon good-aligned and thus bypasses the corresponding damage reduction. It deals an extra 2d6 points of damage against all creatures of evil alignment. It bestows one permanent negative level on any evil creature attempting to wield it. ..."

> *Unholy*: "... makes the weapon evil-aligned ... It deals an extra 2d6 points of damage against all creatures of good alignment. ..."

> *Axiomatic*: "... makes the weapon law-aligned ... It deals an extra 2d6 points of damage against chaotic creatures. ..."

> *Anarchic*: "... makes the weapon chaotically aligned ... It deals an extra 2d6 points of damage against all creatures of lawful alignment. ..."

> *Bane*: "A *bane weapon* excels against certain foes. Against a designated foe, the weapon's enhancement bonus is +2 better than its actual bonus. It also deals an extra 2d6 points of damage against the foe." (The designated-foe table lists creature types, with "Humanoids (pick one subtype)" and "Outsiders (pick one subtype)".)

> *Merciful*: "The weapon deals an extra 1d6 points of damage, and all damage it deals is nonlethal damage. On command, the weapon suppresses this ability until told to resume it (allowing it to deal lethal damage, but without any bonus damage from this ability)."

> *Keen*: quoted under Improved Critical.

> *Speed*: "When making a full-attack action, the wielder of a *speed weapon* may make one extra attack with it. The attack uses the wielder's full base attack bonus, plus any modifiers appropriate to the situation. (This benefit is not cumulative with similar effects, such as a *haste* spell.)"

> *Wounding*: "A *wounding weapon* deals 1 point of bleed damage when it hits a creature. Multiple hits from a wounding weapon increase the bleed damage. ... A critical hit does not multiply the bleed damage. Creatures immune to critical hits are immune to the bleed damage dealt by this weapon."

> *Disruption*: "Any undead creature struck in combat must succeed on a DC 14 Will save or be destroyed. A *disruption weapon* must be a bludgeoning melee weapon."

> *Vorpal*: "Upon a roll of natural 20 (followed by a successful roll to confirm the critical hit), the weapon severs the opponent's head (if it has one) from its body."

*Corrosive* and *corrosive burst* are **non-CRB** (APG p. 287; UE p. 138):

> *Corrosive*: "Upon command, a *corrosive* weapon becomes slick with acid that deals an extra 1d6 points of acid damage on a successful hit. The acid does not harm the wielder. The effect remains until another command is given."

> *Corrosive Burst*: "A *corrosive burst* weapon functions as a *corrosive* weapon that explodes with searing acid upon striking a successful critical hit. ... a *corrosive burst* weapon deals an extra 1d10 points of acid damage on a successful critical hit. If the weapon's critical modifier is 3, add an extra 2d10 points of acid damage instead, and if the modifier is 4, add an extra 3d10 points. Even if the *corrosive* ability is not active, the weapon still deals its extra acid damage on a successful critical hit."

UE (**non-CRB**) adds the same last sentence to *flaming burst*, *icy burst* and *shocking burst*, for example: "Even if the *flaming* ability is not active, the weapon still deals its extra fire damage on a successful critical hit." The CRB text does not have it. **Open (A12).**

FAQ CRB:

- `#v5748eaic9rdl` (*Bane*, November 2013): several *bane* abilities on one weapon are allowed, but against a creature that more than one applies to "the effects do not stack: the weapon's enhancement bonus is only +2 higher than its actual enhancement bonus, and it only deals +2d6 points of damage against that opponent."
- `#v5748eaic9qd9` (Weapon Bonuses, March 2013): "*Bane*: This allows the weapon to exceed the +5 limit, but only against the designated creature type." "The +10 bonus-equivalent limitation is a hard cap for all weapons".
- `#v5748eaic9vo0` (May 2017): ammunition fired from a +1 or better weapon counts as magic, and from an aligned weapon gains that alignment, for damage reduction, but the shared enhancement bonus does not overcome other DR types.

- **Reading:** when each applies is in `pf1-tables.md` (always while on, on a confirmed crit only, or only against a target type or alignment). None of these dice multiply on a crit. Burst dice scale with the weapon's critical multiplier, ×2 (1 die) to ×4 (3 dice). A multiplier above ×4 (fighter Weapon Mastery turns ×4 into ×5) is not covered. **Open (A13).**

## Topic: Completeness Sweep (CRB Chapter 5)

All 176 feat descriptions in the CRB feat chapter (the PRD's `coreRulebook/feats.html`, the same feats as Table 5–1) were read. Besides the ticket's list, these change an attack line's bonus, damage, critical or number of attacks. Quotes are the feat's Benefit (CRB page from AoN). `pf1-tables.md` sorts them by what they change.

Ranged:

- Point-Blank Shot (p. 131): "You get a +1 bonus on attack and damage rolls with ranged weapons at ranges of up to 30 feet." FAQ CRB `#v5748eaic9qnt` (May 2013): the damage applies only to the target of a direct hit with a splash weapon.
- Precise Shot (p. 131): "You can shoot or throw ranged weapons at an opponent engaged in melee without taking the standard –4 penalty on your attack roll." Base rule (CRB p. 182): the –4 for shooting into melee, reduced to –2 if the target is two sizes larger than the friendly characters, and no penalty at three sizes larger or 10 ft. from the nearest friend.
- Improved Precise Shot (p. 128): "Your ranged attacks ignore the AC bonus granted to targets by anything less than total cover, and the miss chance granted to targets by anything less than total concealment."
- Far Shot (p. 124): "You only suffer a –1 penalty per full range increment between you and your target when using a ranged weapon." (Normal –2.)
- Pinpoint Targeting (p. 131): "As a standard action, make a single ranged attack. The target does not gain any armor, natural armor, or shield bonuses to its Armor Class. You do not gain the benefit of this feat if you move this round."
- Shot on the Run (p. 133): "As a full-round action, you can move up to your speed and make a single ranged attack at any point during your movement."
- Mounted Archery (p. 131): "The penalty you take when using a ranged weapon while mounted is halved: –2 instead of –4 if your mount is taking a double move, and –4 instead of –8 if your mount is running."
- Quick Draw (p. 131): thrown weapons "at his full normal rate of attacks" (quoted under Thrown Weapons).
- Throw Anything (p. 135): "You do not suffer any penalties for using an improvised ranged weapon. You receive a +1 circumstance bonus on attack rolls made with thrown splash weapons."

Two weapons and shields:

- Two-Weapon Rend (p. 136): "If you hit an opponent with both your primary hand and your off-hand weapon, you deal an additional 1d10 points of damage plus 1-1/2 times your Strength modifier. You can only deal this additional damage once each round."
- Shield Master (p. 133): "You do not suffer any penalties on attack rolls made with a shield while you are wielding another weapon. Add your shield's enhancement bonus to attack and damage rolls made with the shield as if it was a weapon enhancement bonus." (FAQ `#v5748eaic9vdp` limits "any penalties" to the TWF penalties.)
- Improved Shield Bash (p. 128): keep the shield bonus to AC when bashing. Shield Slam (p. 133): a shield-bash hit also makes "a free bull rush attack, substituting your attack roll for the combat maneuver check". Two-Weapon Defense (p. 136): AC only (quoted under fighting defensively).

Critical hits:

- Critical Focus (p. 120): "You receive a +4 circumstance bonus on attack rolls made to confirm critical hits."
- Critical feats (each "**Special**: You can only apply the effects of one critical feat to a given critical hit unless you possess Critical Mastery"): Bleeding Critical (p. 118; 2d6 bleed, slashing or piercing; "The effects of this feat stack"), Blinding Critical (p. 119; Fort DC 10 + BAB), Deafening Critical (p. 121), Exhausting Critical (p. 123), Sickening Critical (p. 133), Staggering Critical (p. 134), Stunning Critical (p. 135), Tiring Critical (p. 135).
- Critical Mastery (p. 120): "When you score a critical hit, you can apply the effects of two critical feats in addition to the damage dealt."
- Improvised Weapon Mastery (p. 128): "You do not suffer any penalties for using an improvised weapon. Increase the amount of damage dealt by the improvised weapon by one step (for example, 1d4 becomes 1d6) to a maximum of 1d8 (2d6 if the improvised weapon is two-handed). The improvised weapon has a critical threat range of 19–20, with a critical multiplier of ×2." Catch Off-Guard (p. 119): "You do not suffer any penalties for using an improvised melee weapon. Unarmed opponents are flat-footed against any attacks you make with an improvised melee weapon." (Normal: improvised weapons –4, 20/×2, CRB p. 140.)

Extra or replacement attacks:

- Cleave (p. 119): "As a standard action, you can make a single attack at your full base attack bonus against a foe within reach. If you hit, you deal damage normally and can make an additional attack (using your full base attack bonus) against a foe that is adjacent to the first and also within reach. You can only make one additional attack per round with this feat. When you use this feat, you take a –2 penalty to your Armor Class until your next turn." Great Cleave (p. 124) continues to further adjacent foes. *Mighty cleaving* (CRB p. 469) adds one more Cleave attack. FAQ CRB `#v5748eaic9qd6`: no 5-foot step during Cleave.
- Whirlwind Attack (p. 137): "When you use the full-attack action, you can give up your regular attacks and instead make one melee attack at your highest base attack bonus against each opponent within reach. ... you also forfeit any bonus or extra attacks granted by other feats, spells, or abilities."
- Spring Attack (p. 134): "As a full-round action, you can move up to your speed and make a single melee attack without provoking any attacks of opportunity from the target of your attack." (No Vital Strike, FAQ `#v5748eaic9pyy`.)
- Medusa's Wrath (p. 130): "Whenever you use the full-attack action and make at least one unarmed strike, you can make two additional unarmed strikes at your highest base attack bonus. These bonus attacks must be made against a dazed, flat-footed, paralyzed, staggered, stunned, or unconscious foe."
- Deadly Stroke (p. 121): "As a standard action, make a single attack with the weapon for which you have Greater Weapon Focus against a stunned or flat-footed opponent. If you hit, you deal double the normal damage and the target takes 1 point of Constitution bleed (see Conditions). The additional damage and bleed is not multiplied on a critical hit."
- Stunning Fist (p. 135), Scorpion Style (p. 132) and Gorgon's Fist (p. 124): an unarmed attack with a rider (Stunning Fist: "declare that you are using this feat before you make your attack roll"; Scorpion Style and Gorgon's Fist: "as a standard action"). Damage and bonus unchanged.
- Combat Reflexes (p. 119): "You may make a number of additional attacks of opportunity per round equal to your Dexterity bonus." Strike Back (p. 135): a readied attack against a foe outside your reach. Both act outside the routine.

Damage riders and damage reduction:

- Channel Smite (p. 119): "Before you make a melee attack roll, you can choose to spend one use of your channel energy ability as a swift action. If you channel positive energy and you hit an undead creature, that creature takes an amount of additional damage equal to the damage dealt by your channel positive energy ability. ... Your target can make a Will save, as normal, to halve this additional damage." (FAQ `#v5748eaic9o61`: these dice are not multiplied on a crit.)
- Penetrating Strike (p. 131): "Your attacks made with weapons selected with Weapon Focus ignore up to 5 points of damage reduction. This feat does not apply to damage reduction without a type (such as DR 10/—)." Greater Penetrating Strike (p. 125): "up to 10 points ... reduced to 5 points for damage reduction without a type".
- Shatter Defenses (p. 133): "Any shaken, frightened, or panicked opponent hit by you this round is flat-footed to your attacks until the end of your next turn."

Proficiency:

- Simple (p. 133), Martial (p. 130) and Exotic Weapon Proficiency (p. 123) remove the "–4 penalty on attack rolls" for a nonproficient weapon. FAQ CRB `#v5748eaic9qut`: no one-handed bastard sword or dwarven waraxe without the exotic proficiency, even at –4. FAQ `#v5748eaic9r3w`: a shield bash is a martial weapon attack regardless of shield proficiency.

Mounted:

- Spirited Charge (p. 134): "When mounted and using the charge action, you deal double damage with a melee weapon (or triple damage with a lance)." (FAQ `#v5748eaic9ru6`: only the first melee attack.) Ride-By Attack (p. 132): move after a mounted charge attack. Unseat (p. 136): a free bull rush after a lance hit on a charge. Trample (p. 136): the mount's hoof attack against a knocked-down target "gaining the standard +4 bonus on attack rolls against prone targets".

Read and excluded (no attack-line change): Agile Maneuvers (CMB only), Blind-Fight (miss-chance reroll), Dazzling Display, Improved Shield Bash and Two-Weapon Defense (AC), Lightning Stance, Wind Stance, Mobility, Dodge, the combat-maneuver chains, Snatch Arrows, Deflect Arrows, Stand Still, Step Up, Disruptive, Spellbreaker, Mounted Combat, Defensive Combat Training, and the non-combat feats. The Bestiary monster feats Multiattack and Improved Natural Attack (**non-CRB**) are quoted under Natural Attacks.

## FAQ Index

Paizo FAQ pages read live (CRB `v5748nruor1fm`, APG `v5748nruor1fn`, Bestiary `v5748nruor1fo`, UC `v5748nruor1g1`, UE `v5748nruor1gg`, UM `v5748nruor1fz`, ACG `v5748nruor1gw`, ARG `v5748nruor1gh`, Ultimate Campaign `v5748nruor1gn`, PU `v5748nruor1h3`); 389 entries. The entries used above:

| Anchor | Page | Posted | Topic |
|---|---|---|---|
| `v5748eaic9qno` | CRB | May 2013 | Power Attack, two-handed weapon in one hand (lance) |
| `v5748eaic9quw` | CRB | Jul 2013 | Two-handed weapon used one-handed: Strength and Power Attack as one-handed |
| `v5748eaic9rb5` | CRB | Oct 2013 | Bastard sword handedness, Power Attack |
| `v5748eaic9qut` | CRB | Jul 2013 | No one-handed exotic use without the feat |
| `v5748eaic9qda` | CRB | Mar 2013 | Releasing and re-grabbing a two-handed weapon: free actions |
| `v5748eaic9o61` | CRB | Jun 2011 | Bonus dice never multiply on crits |
| `v5748eaic9qv4` | CRB | Jul 2013 | "Scoring" = "confirming" a crit |
| `v5748eaic9onf` | CRB | Nov 2011 | Different weapons on iteratives without TWF |
| `v5748eaic9qd4` | CRB | Mar 2013 | TWF penalties end with the full attack; Power Attack and Combat Expertise carry over |
| `v5748eaic9qie` | CRB | Apr 2013 | TWF with two unarmed strikes |
| `v5748eaic9qw9` | CRB | Jul 2013 | No off-hand armor spikes or gauntlet with a two-handed weapon |
| `v5748eaic9oga` | CRB | Aug 2011 | Shield bash need not be off-hand (errata p. 152) |
| `v5748eaic9vdp` | CRB | Feb 2017 | Shield Master ignores only TWF penalties |
| `v5748eaic9r3w` | CRB | Sep 2013 | Shield bash is a martial weapon attack |
| `v5748eaic9qfz` | CRB | Mar 2013 | Manyshot locks in the full attack |
| `v5748eaic9pyy` | CRB | Nov 2012 | Vital Strike: attack action only, not charge or Spring Attack |
| `v5748eaic9nef` | CRB | Oct 2010 | Weapon Specialization and Improved Critical (ray, bomb) |
| `v5748eaic9ojt` | CRB | Oct 2011 | Weapon Finesse on disarm, sunder, trip |
| `v5748eaic9qnt` | CRB | May 2013 | Point-Blank Shot and splash |
| `v5748eaic9uxg` | CRB | Sep 2016 | Weapon-attack modifiers vs special abilities; Arcane Strike; weapon groups |
| `v5748eaic9oag` | CRB | Jul 2011 | Rays count as weapons |
| `v5748eaic9ve1` | CRB | Feb 2017 | *Haste* extra attack with unarmed strikes |
| `v5748eaic9qpr` | CRB | Jun 2013 | Two *speed* weapons: one extra attack |
| `v5748eaic9oaf` | CRB | Jul 2011 | *Speed* amulet: not one extra per natural weapon |
| `v5748eaic9o72` | CRB | Jul 2011 | Flurry BAB for Power Attack and Combat Expertise |
| `v5748eaic9naz` | CRB | Sep 2010 | Flurry BAB with other classes |
| `v5748eaic9pyx` | CRB | Nov 2012 | Flurry with one weapon |
| `v5748eaic9qk0` | CRB | Apr 2013 | Ki extra attack stacks with *haste* |
| `v5748eaic9qd7` | CRB | Mar 2013 | Ki strike cold iron and silver at 7th |
| `v5748eaic9qdb` | CRB | Mar 2013 | "Monk" quality grants no proficiency |
| `v5748eaic9qd3` | CRB | Mar 2013 | Unarmed strike is the whole body |
| `v5748eaic9qwt` | CRB | Aug 2013 | Proficient with natural attacks |
| `v5748eaic9t3f` | CRB | Mar 2015 | Damage dice progression on size change |
| `v5748eaic9t5u` | CRB | Mar 2015 | Size and effective-size increases don't stack with themselves |
| `v5748eaic9ru6` | CRB | Mar 2014 | Mounted charge (replaces p. 202 text) |
| `v5748eaic9p1k` | CRB | Mar 2012 | Lance multiplier only on the first attack with pounce |
| `v5748eaic9o4q` | CRB | Jun 2011 | Cannot ready a charge |
| `v5748eaic9qd6` | CRB | Mar 2013 | Cleave: no 5-foot step mid-action |
| `v5748eaic9rdl` | CRB | Nov 2013 | Multiple *bane* don't stack; weapon training takes highest |
| `v5748eaic9qd9` | CRB | Mar 2013 | *Bane* exceeds +5 vs the foe; +10 hard cap |
| `v5748eaic9vo0` | CRB | May 2017 | Ammunition and the launcher's enhancement for DR |
| `v5748eaic9qwv` | CRB | Aug 2013 | Divine bond on both ends of a double weapon |
| `v5748eaic9rdk` | Bestiary | Nov 2013 | Claws on hands, talons on feet (non-CRB) |
| `v5748eaic9p05` | Bestiary | Feb 2012 | Pounce allows any full-attack sequence (non-CRB) |
| `v5748eaic9r4l` | Bestiary | Sep 2013 | Pounce and *haste* (non-CRB) |
| `v5748eaic9rc5` | UM | Nov 2013 | Natural attacks normally add to other attacks (non-CRB) |
| `v5748eaic9ozd` | UC | Feb 2012 | Natural attacks not in core flurry, CRB p. 57 (non-CRB) |

## Edge Cases and Open Items

Each item points to the quoted text it rests on. None gives an answer.

- **A1. Power Attack's off-hand halving in core flurry of blows.** Flurry is "as if using the Two-Weapon Fighting feat" and adds "full Strength bonus ... whether the attacks are made with an off-hand or with a weapon wielded in both hands". Power Attack halves "an attack with an off-hand weapon". Unarmed strikes have no off hand ("There is no such thing as an off-hand attack for a monk striking unarmed"); a monk weapon used for the extra attacks is not covered.
- **A2. Two-handed monk weapons in a core flurry.** "full Strength bonus ... with a weapon wielded in both hands" does not say whether this caps a quarterstaff at 1× Strength or only guarantees at least 1×. It also does not say whether Power Attack's +50% for "a two-handed weapon" still applies.
- **A3. Core flurry and feats keyed to two-weapon fighting.** "as if using the Two-Weapon Fighting feat" (and Improved and Greater) does not say whether a flurry counts as two-weapon fighting for Double Slice, Two-Weapon Rend or the TWF chain itself, or whether a monk with those feats gets extra attacks on top.
- **A4. Unchained flurry with monk weapons.** PU gives full Strength for unarmed strikes only. It does not state the Strength multiplier or Power Attack's treatment for a monk weapon used in the off hand or in two hands during a flurry ("He takes no penalty for using multiple weapons").
- **A5. Natural attacks alongside weapon attacks.** CRB p. 182 says "Feats such as Two-Weapon Fighting and Multiattack can reduce these penalties" but not how Two-Weapon Fighting does so. Neither the CRB nor B1 says whether the weapon attacks take two-weapon penalties when natural attacks are added, or how natural attacks combine with an off-hand weapon. A UM FAQ (non-CRB) implies natural attacks normally add on top of two-weapon fighting.
- **A6. Vital Strike with natural attacks and unarmed strikes.** "Roll the weapon's damage dice" is not defined for natural attacks or unarmed strikes (or monk unarmed damage).
- **A7. Arcane Strike with natural attacks and unarmed strikes.** "your weapons deal +1 damage"; the FAQ excludes special abilities but does not address natural weapons or unarmed strikes.
- **A8. Weapon Focus, Weapon Specialization and Improved Critical on a natural attack type.** The CRB names "unarmed strike or grapple (or ray ...)" as extra choices. It does not say whether "bite" or "claw" is a "type of weapon". Bestiary stat blocks use such choices, but stat blocks are not rules text.
- **A9. Thrown weapons: rate and Strength.** Without Quick Draw the CRB never states the number of thrown attacks in a full attack (drawing is a move action, or free with a move at BAB +1). Shuriken draw as ammunition. The 1-1/2 Strength rule for two-handed weapons is written for melee; a two-handed thrown weapon's multiplier is not stated.
- **A10. Double weapon used as a double weapon: the primary end.** The off-hand end is light (1/2 Strength). The primary end of a two-handed weapon wielded in both hands is not given a Strength multiplier (1 or 1-1/2) or a Power Attack multiplier when the weapon is used as a double weapon.
- **A11. Fighting defensively and attacks of opportunity.** "a –4 penalty on all attacks in a round". The FAQ says turn penalties don't carry to attacks of opportunity unless stated, and names Power Attack and Combat Expertise as stating it; fighting defensively is not named either way.
- **A12. Burst damage while the base energy ability is off.** CRB: a burst weapon "functions as a *flaming weapon* that also explodes". UE (non-CRB) adds "Even if the *flaming* ability is not active, the weapon still deals its extra fire damage on a successful critical hit"; the CRB is silent.
- **A13. Burst and *thundering* dice above ×4.** The text gives ×2, ×3 and ×4 only. Fighter Weapon Mastery raises the multiplier by 1 (×4 → ×5).
- **A14. Unarmed damage for sizes other than Small, Medium and Large.** The CRB gives non-monk unarmed damage for Small, Medium and Large, and the monk tables only for Small, Medium and Large. Tiny or Huge characters rely on the general weapon-size table or the FAQ step chart, which the monk text does not reference.
- **A15. PRD currency (Improved Critical).** AoN's Improved Critical ends "This effect doesn't stack with any other effect that expands the threat range of a weapon."; the PRD's copy of the CRB lacks the sentence. *Keen*'s own text forbids stacking with Improved Critical in both, so the routine result is the same. The sentence matters only for other expanders (Improvised Weapon Mastery's 19–20, *keen edge*). Other errata were not checked line by line.
