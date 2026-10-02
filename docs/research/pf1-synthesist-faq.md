# PF1 Synthesist FAQ calculations

Research for [Verify Synthesist combined-form FAQ calculations](https://github.com/AndreasUnunger/EverythingPath/issues/250), supporting [Decide companion progression and cross-sheet calculations](https://github.com/AndreasUnunger/EverythingPath/issues/249). Verified 2026-10-02. This closes the narrow FAQ retrieval gap in [the companion progression research](pf1-companion-models.md).

## Verified clarifications

The official Ultimate Magic FAQ supplies both missing entries, posted August 2011:

| Calculation                       | Inputs and result                                                                                                                                                                                                | Primary source                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Multiclass fused BAB              | Replace the summoner class's BAB contribution with the eidolon's BAB; retain contributions from other sources. The published fighter 19/summoner 1 example changes from +19 to +20: fighter +19 plus eidolon +1. | [HD/BAB FAQ](https://paizo.com/paizo/faq/v5748nruor1fz#v5748eaic9obc)          |
| HD-dependent evolutions           | Use the eidolon's HD for evolution effects, rather than summoner-class HD or total character HD.                                                                                                                 | [HD/BAB FAQ](https://paizo.com/paizo/faq/v5748nruor1fz#v5748eaic9obc)          |
| Skilled evolution                 | An eidolon's Skilled selection supplies its skill bonus to the synthesist.                                                                                                                                       | [Skilled/ability FAQ](https://paizo.com/paizo/faq/v5748nruor1fz#v5748eaic9obb) |
| Mental Ability Increase evolution | Increasing the eidolon's mental ability score does not increase the synthesist's mental score: the synthesist uses his own.                                                                                      | [Skilled/ability FAQ](https://paizo.com/paizo/faq/v5748nruor1fz#v5748eaic9obb) |

Skilled supplies a **+8 racial bonus** to the selected skill, not skill ranks. Repeated selections target different skills; their effects do not stack. The original Ability Increase evolution adds **+2 to an eidolon ability score**, with repeat limits based on summoner level. These magnitudes come from the evolution descriptions, not the FAQ. [APG evolutions](https://legacy.aonprd.com/advancedPlayersGuide/baseClasses/summoner.html#evolutions).

Do not confuse that evolution with the eidolon progression's **Ability Score Increase**, which adds **+1** and appears at summoner levels 5, 10, and 15, or with the table's separate Strength/Dexterity bonus. All modify the eidolon's own scores. [APG eidolon progression](https://legacy.aonprd.com/advancedPlayersGuide/baseClasses/summoner.html#eidolons).

For physical scores, the printed Fused Eidolon rule uses the eidolon's Strength, Dexterity, and Constitution; mental scores remain the summoner's. Consequently, an eidolon's physical increase changes the physical score used in the fused calculation. That consequence follows from substitution; it does not add the same increase again to the summoner's original score. [Ultimate Magic, Fused Eidolon](https://legacy.aonprd.com/ultimateMagic/spellcastingClassOptions/summoner.html#fused-eidolon).

## Errata and version boundary

Paizo's **Ultimate Magic, First Printing, Update 1.0**, dated 2012-03-30, contains the Synthesist corrections on PDF page 2. They address fusion description, armor, creature type, limbs for somatic casting, eidolon death, and restoration of temporary HP. This document contains no replacement calculation for multiclass BAB, Skilled, or ability increases. The specific clarifications above therefore come from the FAQ. [Official errata ZIP](https://paizo.com/download/pathfinder/PFRPG-UM-ErrataV1.0.zip), containing `PFRPG-UM-ErrataV1.0.pdf`; [Paizo product listing](https://store.paizo.com/pathfinder-roleplaying-game-ultimate-magic-ogl-pdf/).

These entries concern the original Ultimate Magic archetype and APG summoner. Unchained's general introduction permits earlier archetypes, except for the monk, when the necessary features remain available to replace; it also requires review of rules that may not work with the revised classes. That is conditional compatibility guidance, not a Synthesist-specific conversion. [Pathfinder Unchained, Introduction](https://legacy.aonprd.com/unchained/classes/index.html).

The [official Unchained FAQ](https://paizo.com/paizo/faq/v5748nruor1h3), inspected on the same date, contains no Synthesist or summoner entry. This note does not certify or reject Unchained compatibility, substitute its progression table into the examples, or resolve subtype/evolution interactions.

## Evidence and remaining limits

Direct web-tool requests to the Ultimate Magic FAQ still returned HTTP 403. Opening the same official URL in the T3 collaborative browser succeeded; the two linked entries were read directly from Paizo's page. Forum quotations were navigation aids only. The current store's relative errata link resolved to a 404 under `store.paizo.com`; the same download path on `paizo.com`, linked above, returned the official six-page PDF in a ZIP.

The recovered ability FAQ specifically addresses the evolution applied to mental scores. It does not establish a universal transfer rule for every bonus, spell, item, or advancement choice. Neither recovered FAQ defines a builder's source-loss lifecycle, manual fallback policy, or Militia Character Facts projection. Those remain product decisions in #249; the accepted separate identities and static fused-form view remain unchanged.
