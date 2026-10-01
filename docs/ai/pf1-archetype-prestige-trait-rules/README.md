# PF1 Archetype, Prestige Class, Trait and Unchained Rules (AI Search Pack)

This folder holds the **official rules text that [Set the coverage bar for archetypes and prestige classes](https://github.com/AndreasUnunger/EverythingPath/issues/219) admitted** for the Pathfinder 1e character builder (map #201, research ticket [#225](https://github.com/AndreasUnunger/EverythingPath/issues/225)). It follows the layout of `docs/ai/pf1-core-rules/` on branch `research/pf1-core-rules`, with one difference: rules here are **quoted exactly**, not paraphrased, because the ticket asks for the official wording. It feeds [Decide which rules checks the builder warns about](https://github.com/AndreasUnunger/EverythingPath/issues/215) and [Decide which Pathfinder Unchained rules the builder supports](https://github.com/AndreasUnunger/EverythingPath/issues/226).

## Files

- `docs/ai/pf1-archetype-prestige-trait-rules/pf1-rules.md`
  - Quoted rules by topic (`## Topic:` headings): archetypes, prestige classes, favored class and the APG options, traits (APG and UC), Pathfinder Unchained. Ends with every open item.
- `docs/ai/pf1-archetype-prestige-trait-rules/pf1-tables.md`
  - Rule locations with page numbers, the Unchained character-building inventory (sheet effect and how each system is adopted), fractional bonuses, staggered advancement, variant multiclassing, automatic bonus progression, background and grouped skills, wound thresholds, trait selection, favored class choices, and the FAQ index.
- `docs/ai/pf1-archetype-prestige-trait-rules/search-tags.md`
  - Keyword and abbreviation index.

## Source policy

Authority is official Paizo text only: the *Advanced Player's Guide* (APG), *Core Rulebook* (CRB), *Ultimate Campaign* (UC) and *Pathfinder Unchained* (PU), plus Paizo's official FAQ pages. Nothing comes from d20pfsrd, forums, Foundry, PCGen or PSRD-Data.

- **Rules text:** Paizo's own Pathfinder Reference Document (PRD), `http://paizo.com/pathfinderRPG/prd/...`. Those URLs now redirect to the Archives of Nethys legacy mirror, so the original Paizo pages were read from Internet Archive snapshots (`https://web.archive.org/web/2019id_/http://paizo.com/pathfinderRPG/prd/...`). The PRD carries the legacy banner "Paizo Inc. has now partnered with Archives of Nethys to provide the online version of the Pathfinder RPG rules".
- **Page numbers:** the PRD prints none. Page numbers come from Archives of Nethys Rules, Feat, Trait and Class pages, which print "Source *Book* pg. N". Those AoN pages were also read from Internet Archive snapshots, so **no live AoN page was fetched**. Where an AoN snapshot gives longer wording than the PRD (CRB p. 374), both are quoted and the difference is noted. Pages that could not be confirmed this way are marked "page not verified".
- **FAQ:** read live from `paizo.com/paizo/faq/...`: Core Rulebook (`v5748nruor1fm`), Advanced Player's Guide (`v5748nruor1fn`), Ultimate Campaign (`v5748nruor1gn`) and Pathfinder Unchained (`v5748nruor1h3`). Each entry is cited with its anchor and posting date.
- **Errata:** this research found no separate errata document for these books. Errata printed in the FAQ as "Update" entries is included. Whether the 2019 PRD snapshot reflects the latest printing of each book was not checked (open item U8).

Retrieved 2026-10-01.

## Coverage

- **Archetypes (APG p. 72):** choosing at class selection, all-or-nothing replacement, unmentioned features unchanged, replaced features not counting for prerequisites, taking several archetypes, and the no-same-feature rule. FAQ: sub-features versus the whole parent feature, APG archetypes lacking "alters", partial and delayed replacement of scaling features, when an archetype ability counts as the original, race requirements (Racial Heritage, half-elf and half-orc). Unchained class compatibility.
- **Prestige classes (CRB p. 374, p. 30):** requirements before the first level, the order of operations at level-up, no favored class bonus, the GM gate on allowing a prestige class, definitions. FAQ: inclusive numeric requirements, spell-like abilities and "able to cast", spellcasting advancement limits, and no self-qualifying (UC FAQ).
- **Favored class (CRB p. 31) and APG favored class options (APG p. 8):** three choices per level, stacking, caps, rounding of fractions, alternating between levels, half-elf and half-orc. FAQ: NPC classes, racial Hit Dice.
- **Traits (APG p. 326, UC p. 51 and p. 64):** nature and the trait bonus, default count, the five types and eight lists, the one-per-list rule, campaign trait requirement, race, regional and religion conditions, NPCs, Additional Traits (APG p. 150), drawbacks, bloodline race traits, the background generator.
- **Pathfinder Unchained:** an inventory of all 26 rule systems in chapters 1 to 4 plus the monster tool in chapter 5. For each: page, what it changes on the sheet, the wording that says how it is adopted, and the per-character choices. Full quotes and tables for the systems that change the build.

Not covered here: retraining and *Mythic Adventures* (out of scope per #219); the lists of individual archetypes, prestige classes, favored class options and traits (catalog content, not rules); APG alternate racial traits; and "+1 level of existing spellcasting class" beyond the FAQ limits (handed to #218).

## Key Findings

1. An archetype is chosen "When a character selects a class", is all-or-nothing, and leaves unmentioned features as normal. A replaced feature never counts for prerequisites.
2. Several archetypes may combine unless two of them "replace or alter the same class feature". The 2015 FAQ refines this to sub-features: two archetypes may replace weapon training at different levels, but an archetype that changes how the whole parent feature works blocks every other archetype touching it, even through an added class skill or bonus-feat-list entry.
3. APG archetypes never print "alters"; the FAQ says alteration must be read from the prose.
4. Partial replacement of a scaling feature means the character does not have that feature until the next unreplaced increment (FAQ).
5. Prestige class requirements must be met before any benefit of the first prestige level, against the character before the level-up steps. No favored class bonus is gained on prestige levels. A prestige class cannot help qualify for itself (UC FAQ).
6. Each favored class level gives +1 hp, +1 skill rank, or the race's APG option for that class. The choice is fixed per level, may alternate between levels, and stacks unless noted.
7. Traits: two by default (the GM sets the count), at most one per list, one campaign trait if the GM uses them. Trait bonuses do not stack. One drawback buys a third trait.
8. Every PU system is optional. The table records which ones the campaign adopts and what each player then chooses. Variant multiclassing, unchained classes, skill unlocks (Signature Skill) and stamina (under Feat Access) involve per-character choices. Fractional bonuses, background, consolidated and grouped skills, automatic bonus progression, wound thresholds and staggered advancement apply campaign-wide.

## Open Items (read before encoding)

Full wording and quotes are in `pf1-rules.md`, section "Edge Cases and Open Items".

- **A1** Adding an archetype after 1st level in the class. **A2** "Alters" is undefined for APG archetypes. **A3** Class-skill and bonus-feat-list changes as conflicting alterations. **A4** Which features have sub-features. **A5** Value of a later increment after partial replacement. **A6** GM houserules for small overlaps. **A7** Archetype requirement format and losing a requirement. **A8** Earlier monk archetypes with the unchained monk. **A9** Whether an archetype ability counts as the one it replaced (case by case).
- **P1** Losing a prestige class requirement after entry (only retraining is covered). **P2** Requirements for later prestige levels.
- **F1** Changing an earlier level's favored class choice (CRB and APG wording). **F2** Rounding fractional favored class options that are not die rolls. **F3** Racial Heritage and another race's favored class options.
- **T1** The trait count is a campaign setting. **T2** What counts as a "list" (UC bloodline race traits, other books' categories). **T3** More than one drawback. **T4** Losing a religion trait has three GM outcomes.
- **U1** No book-wide adoption switch for Unchained systems. **U2** Combining systems (all three skill variants together; ABP with innate item bonuses). **U3** Fractional BAB for prestige classes whose BAB does not match their Hit Die (dragon disciple), and racial Hit Dice. **U4** Variant multiclassing with archetypes. **U5** Who adopts simplified spellcasting. **U6** Four stamina implementations. **U7** Unchained class exclusivity and prerequisites that name original-class features. **U8** Errata currency of the PRD snapshot. **U9** Staggered tiers on the slow and fast tracks. **U10** Background skill ranks from prestige class levels.

## Suggested Search Patterns

- Archetype combination rules:
  - `rg -n "alter|sub-feature|subfeature|Archetype Stacking" docs/ai/pf1-archetype-prestige-trait-rules`
- Prestige class entry:
  - `rg -n "requirements|before gaining any benefits|qualify" docs/ai/pf1-archetype-prestige-trait-rules/pf1-rules.md`
- Favored class options:
  - `rg -n "favored class" docs/ai/pf1-archetype-prestige-trait-rules`
- Trait limits:
  - `rg -n "same list|drawback|Additional Traits|campaign trait" docs/ai/pf1-archetype-prestige-trait-rules`
- An Unchained system:
  - `rg -n "^\| (Fractional|Variant multiclassing|Background skills|Automatic bonus)" docs/ai/pf1-archetype-prestige-trait-rules/pf1-tables.md`
- Open items:
  - `rg -n "\*\*Open \(|^- \*\*[APFTU][0-9]+\." docs/ai/pf1-archetype-prestige-trait-rules/pf1-rules.md`
- FAQ anchors:
  - `rg -n "paizo.com/paizo/faq" docs/ai/pf1-archetype-prestige-trait-rules`

## Retrieval Notes

- Prefer `pf1-rules.md` for exact wording and open items.
- Prefer `pf1-tables.md` for page numbers, the Unchained inventory and numeric progressions.
- Use `search-tags.md` for synonyms and abbreviations (example: `VMC` -> `variant multiclassing`, `ABP` -> `automatic bonus progression`).
