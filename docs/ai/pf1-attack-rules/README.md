# PF1 Attack Rules (AI Search Pack)

This folder holds the **official Pathfinder 1e attack rules the Attack Routine needs** (map #201, research ticket [#235](https://github.com/AndreasUnunger/EverythingPath/issues/235)). [Decide which attack options an Attack Routine supports](https://github.com/AndreasUnunger/EverythingPath/issues/229) asks which routine options and attack-changing feats the builder supports, and whether natural attacks, unarmed strikes, flurry of blows, double weapons and thrown weapons are in scope. Foundry stores none of these as data (Power Attack is in its GPL attack-dialog code; the others are prose), so the builder writes each rule from this pack. It follows the layout of `docs/ai/pf1-spellcasting-rules/` (branch `research/pf1-spellcasting-rules`): rules are **quoted exactly**, with book, page and FAQ date.

## Files

- `docs/ai/pf1-attack-rules/pf1-rules.md`
  - Quoted rules by topic (`## Topic:` headings): attack bonus, Strength to damage and critical hits; full attack and iteratives (with *haste*); the routine options (Power Attack, Deadly Aim, Combat Expertise, Arcane Strike, Rapid Shot, Manyshot, the Vital Strike chain, Lunge); two-weapon fighting and its feats, shields and armor spikes; Weapon Finesse; Improved Critical and *keen*; crossbows and Rapid Reload; Weapon Focus and Specialization; fighter Weapon Training and Weapon Mastery; fighting defensively, total defense and charge; natural attacks (CRB and Bestiary); unarmed strikes; core and unchained flurry of blows; thrown and double weapons; weapon special abilities; the completeness sweep of the CRB feat chapter; the FAQ index. Ends with every open item.
- `docs/ai/pf1-attack-rules/pf1-tables.md`
  - Rule locations; Strength multiplier per line; Power Attack, Deadly Aim and Combat Expertise by BAB; Arcane Strike by caster level; Vital Strike dice; Table 8–7 and the off-hand attack count; combat actions as situations; crossbow reload actions; Weapon Training by level and the CRB weapon groups; Natural Attacks by Size with primary or secondary type; natural attack lines; unarmed damage, weapon size and the FAQ dice chart; the core monk table (flurry bonus, unarmed damage, Small and Large); the unchained monk; double weapons; special-ability dice (always, crit, target); the completeness sweep by kind.

## Scope

In: every topic #235 lists. Routine options; automatic feats (two-weapon chain, Double Slice, Weapon Finesse, Improved Critical and *keen*, Rapid Reload, Weapon Focus and Specialization chains, Weapon Training); combat actions as situations; natural attacks with the Bestiary's types; unarmed strikes, Improved Unarmed Strike and both monks' unarmed damage and flurry; thrown and double weapons; weapon special-ability dice; a sweep of all 176 CRB feats for anything else that changes an attack line's bonus, damage, critical or number of attacks.

Out, and not repeated: bonus types and stacking (`research/pf1-official-stacking-rules`); BAB progressions, size modifiers to attack and AC (`research/pf1-core-rules`); combat maneuvers beyond the CMB effects quoted; sneak attack and other class damage features except fighter and monk; non-CRB feats other than the Bestiary's Multiattack and Improved Natural Attack; archetypes; mythic; firearms (only noted where AoN merges them into Rapid Reload).

## Source Policy

Official Paizo text only. CRB for all rules; the *Bestiary* (B1) for the natural-attack universal monster rule and monster feats; *Pathfinder Unchained* for the unchained monk; APG and UE only for *corrosive* and the UE burst sentence. Every non-CRB source is flagged **(non-CRB)** where quoted. Nothing from Foundry (GPL code or data), d20pfsrd, forums or PCGen.

- **Rules text and pages:** Archives of Nethys (`aonprd.com`, live). It prints "Source *Book* pg. N" for each feat, class, item, skill and rules section. Rules-section pages are the page where the section starts.
- **Cross-check:** Paizo's PRD (`paizo.com/pathfinderRPG/prd/...` redirects to `legacy.aonprd.com/...`). Read there: the CRB Combat, Feats, Equipment and Magic Weapons chapters, the monk, fighter and Acrobatics entries, the B1 Universal Monster Rules, Monster Creation and Monster Feats, and the PU monk. Wording matched AoN except: Improved Critical's last Special sentence (AoN only; open item A15); Rapid Reload (AoN prints a merged CRB/UC/*Inner Sea World Guide* text with firearms; the CRB crossbow text is quoted from the PRD); the burst abilities' "Even if ... not active" sentence (UE only); the Natural Attacks UMR (AoN merges Bestiaries 1–6 with later wording; the B1 text is quoted from the PRD).
- **FAQ:** read live from `paizo.com/paizo/faq/...`: CRB (`v5748nruor1fm`), APG (`v5748nruor1fn`), Bestiary (`v5748nruor1fo`), UC (`v5748nruor1g1`), UE (`v5748nruor1gg`), UM (`v5748nruor1fz`), ACG (`v5748nruor1gw`), ARG (`v5748nruor1gh`), Ultimate Campaign (`v5748nruor1gn`), PU (`v5748nruor1h3`): 389 entries in all. Each entry is cited with its anchor and posting date.

Retrieved 2026-10-02.

## Key Findings

1. **Strength per line:** ×1 primary, ×1/2 off hand (full penalty), ×1-1/2 two-handed or one-handed in two hands (not light weapons; penalties not multiplied). Thrown and sling add Strength; bows take only a penalty unless composite (capped at the rating); crossbows none. A weapon used in one hand counts as one-handed for Strength and Power Attack (FAQ July 2013).
2. **Power Attack** (melee, until your next turn, carries to AoOs): –1/+2 per 4 BAB steps. Damage ×1.5 for two-handed, one-handed in two hands, or a sole primary natural attack; ×0.5 off hand or secondary natural. **Deadly Aim** is the ranged twin with no hand multiplier. **Combat Expertise** gives –1/+1 dodge per step, melee only, stacks with fighting defensively, never with total defense.
3. **Rapid Shot:** one extra ranged attack at the highest bonus, –2 on all, full attack. **Manyshot:** bows only; the first full-attack shot fires two arrows, and precision and crit damage apply once. **Vital Strike** ×2/×3/×4 weapon dice: attack action only (not charge or Spring Attack, FAQ), dice not multiplied on a crit. **Lunge:** reach +5 ft, –2 AC. **Arcane Strike:** +1 damage per 5 caster levels (max +5) on "your weapons" for a round.
4. **Two-weapon fighting:** Table 8–7 (–6/–10; light off hand –4/–8; feat –4/–4; both –2/–2). Improved and Greater add off-hand attacks at –5 and –10; Double Slice gives the off hand full Strength. TWF penalties only apply when taking the extra attack (FAQ). Double weapons: off-hand end light. Thrown from each hand: dart and shuriken light; bolas, javelin, net and sling one-handed.
5. **Weapon Finesse:** Dex to attack (not damage) with light weapons (unarmed strike, natural weapons, armor spikes), rapier, whip, spiked chain and, by its own entry, the elven curve blade, sized for you. A carried shield's armor check penalty applies to attack rolls. **Improved Critical** doubles the threat range and never stacks with *keen* (by *keen*'s text). **Rapid Reload:** hand and light crossbows reload as a free action and fire at the full bow rate; the heavy crossbow reloads as a move action and is not given the full rate.
6. **Weapon Focus +1, Greater +1, Specialization +2, Greater +2**, stacking by their text. **Weapon Training:** +1 to the newest group, +1 more for each earlier group (5th/9th/13th/17th), highest if a weapon is in several groups. It applies to attack, damage, CMB and CMD against disarm and sunder. Weapon Mastery (20th) auto-confirms and adds +1 to the multiplier.
7. **Situations:** fighting defensively –4 attack, +2 dodge (+3 with 3+ Acrobatics ranks). Total defense +4 dodge (+6), no attacks. Charge: one attack at +2, AC –2. Lance doubles in a mounted charge, Spirited Charge doubles any melee weapon and triples a lance, first attack only (FAQ 2014).
8. **Natural attacks:** no iteratives. Primary at full bonus, ×1 Strength. Secondary at –5, ×1/2 Strength (–2 with Multiattack, B1). A sole natural attack gets ×1-1/2. Any weapon or unarmed attack in the same full attack makes all natural attacks secondary, and a limb holding a weapon cannot make its natural attack. Type per B1: bite, claw, gore, slam, sting, talons primary; hoof, tentacle, wing, pincers, tail slap and "other" secondary.
9. **Unarmed:** 1d2/1d3/1d4 (Small/Medium/Large), light, nonlethal or lethal at –4. Improved Unarmed Strike removes the penalty and makes you armed. Monk unarmed damage runs 1d6 to 2d10 (Medium) on the same bands in core and unchained. **Core flurry:** monk-level BAB, +1/+2/+3 extra attacks (1st/8th/15th) as TWF, –2 on all, full Strength on all, monk weapons and unarmed only. **Unchained flurry:** +1 attack at the highest BAB (+2 from 11th), no penalty, stacks with ki and *haste*.
10. **Special abilities:** *flaming*, *frost*, *shock* and *corrosive* (APG): 1d6 on every hit while on. Bursts: +1d10/2d10/3d10 by ×2/×3/×4 on a confirmed crit. *Thundering*: 1d8/2d8/3d8 on a crit. *Holy*, *unholy*, *axiomatic*, *anarchic*: 2d6 against the opposed alignment. *Bane*: +2 enhancement and 2d6 against the designated foe, not stacking across banes. *Merciful*: 1d6 nonlethal. None multiply on a crit.
11. **Completeness sweep:** 44 more CRB feats change an attack line, and 2 add attacks outside the routine. Ranged: Point-Blank Shot, Precise Shot, Improved Precise Shot, Far Shot, Pinpoint Targeting, Shot on the Run, Mounted Archery, Quick Draw, Throw Anything. Improvised and proficiency: Catch Off-Guard, Improvised Weapon Mastery, the three weapon proficiencies. Two weapons and shields: Two-Weapon Rend, Shield Master, Shield Slam. Criticals: Critical Focus, 8 critical feats, Critical Mastery. Extra attacks and riders: Cleave, Great Cleave, Whirlwind Attack, Spring Attack, Medusa's Wrath, Deadly Stroke, Stunning Fist, Scorpion Style, Gorgon's Fist, Channel Smite, Penetrating Strike, Greater Penetrating Strike, Shatter Defenses. Mounted: Spirited Charge, Ride-By Attack, Unseat, Trample. Outside the routine: Combat Reflexes, Strike Back.

## Open Items (read before encoding)

Wording and quotes are in `pf1-rules.md`, "Edge Cases and Open Items". 15 items:

- **A1** Power Attack's off-hand halving in core flurry. **A2** Two-handed monk weapon in core flurry (Strength and Power Attack). **A3** Core flurry and TWF-keyed feats (Double Slice, Rend, the TWF chain). **A4** Unchained flurry: Strength and Power Attack for monk weapons.
- **A5** Natural attacks with weapon attacks: how TWF reduces the penalties, and TWF penalties on the weapons. **A6** Vital Strike with natural attacks and unarmed strikes. **A7** Arcane Strike with natural attacks and unarmed strikes. **A8** Weapon Focus, Specialization and Improved Critical on a natural attack type.
- **A9** Thrown weapons: attacks per full attack without Quick Draw, and Strength for two-handed thrown weapons. **A10** Double weapon as a double weapon: Strength and Power Attack on the primary end. **A11** Fighting defensively's –4 on attacks of opportunity.
- **A12** Burst damage while the base energy is off (CRB silent; UE says yes). **A13** Burst and *thundering* dice above ×4. **A14** Unarmed and monk damage for sizes other than Small, Medium and Large. **A15** PRD currency: Improved Critical's non-stacking sentence on AoN only.

## Suggested Search Patterns

- A routine option:
  - `rg -n "^### (Power Attack|Deadly Aim|Combat Expertise|Arcane Strike|Rapid Shot|Manyshot|Vital Strike|Lunge)" docs/ai/pf1-attack-rules/pf1-rules.md`
- Strength multipliers:
  - `rg -n "1-1/2|1/2 your Strength|off hand|Off-Hand" docs/ai/pf1-attack-rules`
- Natural attacks:
  - `rg -n "natural attack|Natural Attack|secondary|Multiattack" docs/ai/pf1-attack-rules`
- Flurry of blows:
  - `rg -n "flurry|Flurry" docs/ai/pf1-attack-rules`
- Special-ability dice:
  - `rg -n "burst|Burst|2d6|1d10" docs/ai/pf1-attack-rules/pf1-tables.md`
- Open items:
  - `rg -n "Open \(A[0-9]+\)|^- \*\*A[0-9]+\." docs/ai/pf1-attack-rules/pf1-rules.md`
- FAQ anchors:
  - `rg -n "v5748eaic9" docs/ai/pf1-attack-rules`

## Retrieval Notes

- Prefer `pf1-rules.md` for exact wording, FAQ rulings and open items.
- Prefer `pf1-tables.md` for per-BAB and per-level numbers, Table 8–7, the natural attack and monk tables, and the special-ability dice.
- Weapon statistics (damage, critical, group, light or two-handed) for weapons other than the double weapons are in Foundry's item data, which the builder already imports; this pack only adds the rules that use them.
