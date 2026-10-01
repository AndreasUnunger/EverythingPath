# PF1 Core Rules (AI Search Pack)

This folder stores the **Pathfinder 1e Core Rulebook rules the character builder will encode** (map #201, research ticket #204), in AI-friendly, searchable form. It follows the layout of `docs/ai/ironfang-militia/`, minus a verbatim file: rules are stored as paraphrased rules with a source URL per section, not as long verbatim prose.

## Files

- `docs/ai/pf1-core-rules/pf1-rules.md`
  - Procedures, formulas and edge cases by topic (`## Topic:` headings).
- `docs/ai/pf1-core-rules/pf1-tables.md`
  - Structured tables: point buy, modifiers, XP tracks, class summary, BAB/save progression, skill matrix, size, carrying capacity, armor, bonus types.
- `docs/ai/pf1-core-rules/search-tags.md`
  - Keyword and abbreviation index for fast retrieval.

## Sources

Primary: the Core Rulebook as published on the Pathfinder Reference Document (PRD). Paizo's `paizo.com/pathfinderRPG/prd/...` URLs now 301-redirect to the Archives of Nethys legacy mirror `legacy.aonprd.com/coreRulebook/...`, which is the URL cited in each section. Archives of Nethys (`www.aonprd.com/Rules.aspx?...`) was used to cross-check ability scores and character advancement. The BAB/save progression table comes from the Bestiary (same PRD), because the CRB prints progressions only per class. Retrieved 2026-10-01.

## Coverage

- Character creation steps; ability score generation (all five methods), point buy costs and budgets (10/15/20/25), ability modifiers and bonus spells.
- Level-up: XP tracks (slow/medium/fast), ability increase every 4 levels, feats at 1st and every odd level, order of operations, hit dice and hp (first level max, Con, favored class, Toughness), skill ranks per level and maximum ranks.
- Class progression shape: BAB fast/medium/slow, saves good/poor with closed-form formulas, hit dice, skill ranks, starting wealth for all 11 core classes; full class-skill matrix.
- Multiclassing and favored class rules.
- All bonus types in use and the stacking rules (typed, untyped, same-source, dodge/racial/circumstance exceptions, penalties).
- Formulas: HP, BAB, saves, AC (normal, touch, flat-footed), CMB, CMD, initiative, skill totals, armor check penalty, carrying capacity and encumbrance; all size modifier tables.
- Supporting data: core race ability modifiers/size/speed, armor and shield table.

## Gaps and Ambiguities (read before encoding)

- No consolidated bonus-type list exists in the CRB. The type catalogue in `pf1-tables.md` is assembled from spell and item examples plus the CMD rule. Which circumstance bonuses do not stack is not enumerated ("most circumstance bonuses stack").
- Penalty stacking is stated two ways (Common Terms: penalties are typeless and mostly stack; Magic Basics: same-type penalties take the worst). `pf1-rules.md` gives a resolution.
- Point buy: the CRB does not say whether leftover points are allowed.
- Hit points after level 1: only rolling is defined. No fixed-average rule in the CRB.
- BAB and save closed forms (medium BAB = floor(3L/4), good save = 2 + floor(L/2), poor save = floor(L/3)) are derived from the printed tables, not stated as formulas in the CRB.
- Out of scope, not collected: full racial trait lists, alternate racial traits, racial favored-class bonuses (APG), traits (APG), Pathfinder Unchained variants (fractional bonuses, variant multiclassing), prestige-class rules, spellcasting tables (spells per day/known), feat prerequisites, equipment beyond armor/shields, character wealth by level for higher-level starts, ability damage/drain, and age/height/weight.
- Content from non-Core sources (APG, ACG, Ultimate books) is not covered; only the Bestiary summary table is used, for progressions.

## Suggested Search Patterns

- Find point-buy costs and budgets:
  - `rg -n "Point-Buy|Budgets|Ability Score Costs" docs/ai/pf1-core-rules`
- Find a derived formula:
  - `rg -n "^## Topic: (Hit Points|Armor Class|Combat Maneuver|Skills)" docs/ai/pf1-core-rules/pf1-rules.md`
- Find stacking rules:
  - `rg -n "Bonus Types and Stacking|stack" docs/ai/pf1-core-rules`
- Find class data:
  - `rg -n "Core Class Summary|Skill Summary|Hit die" docs/ai/pf1-core-rules/pf1-tables.md`
- Find XP and level tables:
  - `rg -n "Character Advancement|XP Slow" docs/ai/pf1-core-rules/pf1-tables.md`
- Find size modifiers:
  - `rg -n "^## Table: .*Size" docs/ai/pf1-core-rules/pf1-tables.md`
- Find a source URL:
  - `rg -n "legacy.aonprd.com|aonprd.com" docs/ai/pf1-core-rules`

## Retrieval Notes

- Prefer `pf1-tables.md` for numeric lookups.
- Prefer `pf1-rules.md` for formulas, order of operations, and ambiguities.
- Use `search-tags.md` for synonyms and abbreviations (example: `CMD` -> `combat maneuver defense`).
