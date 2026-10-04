# Prepared Attack Routine calculation

Ticket #321 extends the public `calculateCharacterSheet` seam. Fixtures in
`src/lib/character-sheet-attacks.test.ts` use printed CRB numbers and the settled
decisions #229, #235 and #237. The research branch's full attack-rules corpus is
not present on this base; source page numbers and retained CRB URLs are recorded
beside the fixtures without fetching network content.

| Rule                                                    | Source                                                                                                    | Fixture outcome                                                                                                     |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Normal/light off hand, without/with Two-Weapon Fighting | CRB p. 202, [Table 8–7](https://legacy.aonprd.com/coreRulebook/combat.html#two-weapon-fighting)           | Main/off penalties −6/−10, −4/−8, −4/−4, −2/−2                                                                      |
| Improved/Greater off-hand attacks                       | CRB pp. 125, 127, [feats](https://legacy.aonprd.com/coreRulebook/feats.html)                              | Independent additional attacks at −5 and −10; neither implies another feat                                          |
| Off-hand Strength and Double Slice                      | CRB pp. 122, 179, [Double Slice](https://legacy.aonprd.com/coreRulebook/feats.html#double-slice)          | Positive bonus halved and rounded down; negative modifier in full; Double Slice restores full positive bonus        |
| Double weapon ends                                      | CRB pp. 143, 147, 202, [weapons](https://legacy.aonprd.com/coreRulebook/equipment.html#weapons); #237 A10 | Gnome hooked hammer primary 1d8/×3 bludgeoning; other end 1d6/×4 piercing; other end light for two-weapon penalties |
| Double weapon Strength                                  | #237 A10 and the data model                                                                               | Both-end full attack primary Str ×1; single end held in two hands Str ×1½; off end ×½, or ×1 with Double Slice      |

Automatic rules recognize active feat entries by durable `ruleIdentity` only:
`two-weapon-fighting`, `improved-two-weapon-fighting`,
`greater-two-weapon-fighting`, and `double-slice`. A renamed Catalog Copy keeps
that identity and its behavior. A matching display name with another identity
does not qualify. Switched-off and dormant feats contribute nothing. The four
feats are ordinary #313 Selections in the representative selection catalog,
with combat feat types and typed CRB prerequisites. The prerequisite engine
reports current and recorded-build mismatches without blocking an active choice.
Greater Two-Weapon Fighting without Improved Two-Weapon Fighting therefore
keeps its −10 extra attack and warns about the missing prerequisite; it does
not invent the Improved feat's −5 attack. Imported opaque external keys need an explicit
curation mapping to these canonical identities rather than matching names.

Every full attack lists main-hand BAB iteratives before the off-hand chain. The
initial off-hand line uses the same BAB. When Two-Weapon Fighting determines
the penalties, both hands' penalty breakdowns identify its active Selection;
without it they identify the routine. Extra off-hand penalties identify their
own feat row. The resolver also supplies a full-attack penalty summary, or no
summary when two-weapon fighting cannot be calculated. Double Slice's added damage identifies its feat
row while the normal Strength contribution continues to identify the ability.
Each hand uses its own mode and proficiency penalty. Double ends inherit the
main weapon's proficiency identity and hands, but use independent enhancement
and masterwork state. Masterwork adds attack only. The primary end's state is
never inherited as the other end's enchantment.

An advisory off-hand composite-bow configuration caps its positive Strength
contribution at the bow's rating before halving it. Double Slice restores that
capped bonus; a Strength penalty remains in full. A crossbow never gains Strength
damage, and an ordinary bow only takes a negative Strength modifier.

Missing or unusable off-hand references retain their recorded choice, emit a
warning owned by the Attack Routine, and omit their lines and two-weapon
penalties. Choosing the same Gear row for both hands requires the explicit
`{ kind: 'otherEnd', mode }` choice; another copy of a weapon uses another Gear
row through `{ kind: 'weapon', weaponEntryId, mode }`. A separate
off hand with a two-handed main weapon, a two-handed off-hand weapon, or an
inconsistent double-end hand/mode choice remains calculable with an advisory.
Off-hand warnings are evaluated even when the main weapon is missing or switched
off, preserving unchanged Accepted Warnings. Warning copy names the affected
off-hand weapon and says that off-hand attacks are skipped. Weapon proficiency
uses carry the real routine ID and an explicit hand; warning subjects and
fingerprints distinguish the hands while their targets name the routine.

Power Attack's Routine Option belongs to #407. No option state or toggle is
introduced here. `resolveAttackLine` and `resolveDamageBonus` receive each
calculation's hand, end and `usesBothEnds` facts. The later Power Attack rule must
give a both-end primary full attack the ordinary bonus, its off end half, and a
single end in two hands the +50% bonus specified by #237 A10. Double Slice never
changes Power Attack's off-hand multiplier. Natural attacks, flurry, haste,
reload/throw rate and material mechanics remain their separate implementation
slices.
