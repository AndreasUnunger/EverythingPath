# PF1 Spellcasting Rules (AI Search Pack)

This folder holds the **official Pathfinder 1e spellcasting rules the Character Sheet needs** (map #201, research ticket [#231](https://github.com/AndreasUnunger/EverythingPath/issues/231)). [Decide how spellcasting fits the Character Sheet](https://github.com/AndreasUnunger/EverythingPath/issues/218) settled that the sheet stores spells known, prepared spells and spellbooks per casting class, and derives caster level, spells per day with bonus spells, spells known limits, save DCs and concentration. This pack is the rules text behind those values. It follows the layout of `docs/ai/pf1-archetype-prestige-trait-rules/` (branch `research/pf1-archetype-prestige-trait-rules`): rules are **quoted exactly**, with book, page and FAQ date.

## Files

- `docs/ai/pf1-spellcasting-rules/pf1-rules.md`
  - Quoted rules by topic (`## Topic:` headings): caster level (including the bloodrager), save DC, concentration, bonus spells per class type, preparing, spontaneous casting and swaps, spellbooks and Spell Mastery, domain and school slots, spontaneous conversion, metamagic, multiclass casters, prestige advancement, the CRB classes, each non-CRB casting class, psychic magic, and modifiers to caster level, DC and concentration. Ends with every open item.
- `docs/ai/pf1-spellcasting-rules/pf1-tables.md`
  - Rule locations, a per-class casting summary (28 classes), swap schedules, the 0-level metamagic clause by class, concentration DCs, spellbook writing costs, the four tables Foundry's journal lacks (alchemist, investigator, adept, unchained summoner), and the FAQ index.

## Scope

In: the CRB Magic chapter rules a sheet derives or stores; the CRB classes' Spells sections; the spellcasting section of each non-CRB casting class the ticket names (alchemist, inquisitor, oracle, summoner, unchained summoner, witch, magus, antipaladin, arcanist, bloodrager, hunter, investigator, shaman, skald, warpriest, medium, mesmerist, occultist, psychic, spiritualist, adept), admitted for that class only; prestige "+1 level of existing class" advancement; feats and traits that change caster level, DC or concentration.

Out, and not repeated: spell data and Foundry's casting summaries and code tables (`research/pf1-spell-data`, `docs/research/pf1-spell-data.md`); CRB Table 1–3 (`research/pf1-core-rules`); the prestige FAQ limits already quoted on `research/pf1-archetype-prestige-trait-rules` (cited by anchor); archetypes, bloodline and domain catalogs, individual spells, arcane spell failure numbers, magic items that raise caster level, mythic, Pathfinder Unchained simplified spellcasting (handled on the archetype branch, U5), vigilante and other classes the ticket does not name.

## Source Policy

Official Paizo text only: CRB, APG, UM, UC, ACG, OA, PU, plus Paizo's FAQ pages. Nothing from d20pfsrd, forums, Foundry or PCGen.

- **Rules text and pages:** Archives of Nethys (`aonprd.com`, live), which prints "Source *Book* pg. N" for each class, feat, trait, prestige class and rules section. Its pages are the class entry's first page; a class feature may sit a page or two later.
- **Cross-check:** Paizo's Pathfinder Reference Document. `paizo.com/pathfinderRPG/prd/...` now redirects to `legacy.aonprd.com/...`, which carries Paizo's partnership banner. The CRB Magic chapter, getting started, feats, classes, prestige classes, NPC classes, bloodrager, psychic magic, and the four tables were read there too. Wording matched AoN except the mystic theurge's second Combined Spells paragraph, which only AoN prints (open item S14).
- **FAQ:** read live from `paizo.com/paizo/faq/...`: CRB (`v5748nruor1fm`), APG (`v5748nruor1fn`), ACG (`v5748nruor1gw`), OA (`v5748nruor1h5`); also checked UM (`v5748nruor1fz`), Ultimate Combat (`v5748nruor1g1`), UC (`v5748nruor1gn`) and PU (`v5748nruor1h3`), which have nothing on these topics. Each entry is cited with its anchor and posting date.

Retrieved 2026-10-02.

## Key Findings

1. **Caster level is per class:** "equal to her class level in the class she's using to cast the spell" (CRB p. 208). Composition: class level, plus prestige levels assigned to that class, plus a class offset (only paladin, ranger and antipaladin: level – 3, none before 4th), plus adjustments (Magical Knack +2 trait bonus capped at Hit Dice, Spell Specialization +2 for one spell's level-variable effects, arcanist reservoir +1 per casting). Adjustments also apply to SR and dispel checks.
2. **Bloodrager caster level = bloodrager level.** ACG's Spells feature has no offset sentence, unlike the paladin, ranger and antipaladin, and no FAQ adds one, so the CRB default applies (caster level 4 at 4th level).
3. **DC = 10 + spell level (in that class) + that class's casting ability modifier.** Metamagic does not raise the DC; Heighten Spell does. Spell Focus and Greater Spell Focus are untyped +1s that stack by their own text.
4. **Concentration = d20 + caster level + the ability modifier the class uses for bonus spells.** DCs in `pf1-tables.md`. A metamagic spell counts at its slot level for concentration (FAQ, October 2013). Thought components add 10 (OA). Combat Casting +4 (defensive or grappled only), Focused Mind +2 trait.
5. **Bonus spells** only for spell levels the class already has access to (FAQ, July 2011). They add to spells per day: prepared slots for prepared casters, casts for spontaneous casters and the arcanist, extracts for the alchemist and investigator. They never add spells known or the arcanist's preparation count. "0" table entries (paladin, ranger, antipaladin, adept) mean only bonus spells.
6. **Multiclass casters:** separate caster level, slots, list and bonus spells per class. No casting from another class's slots without a feature like Combined Spells (FAQ, July 2014). Class abilities that modify spellcasting apply to every class (FAQ, October 2010).
7. **Prestige "+1 level of existing class"** advances caster level, spells per day and (spontaneous) spells known only, for a class of the named kind (arcane or divine) the character "belonged to before adding the prestige class". With several eligible classes, the player "must decide to which class he adds the new level". The mystic theurge advances one arcane and one divine class every level. No bloodline, mystery, patron or free spellbook spells.
8. **Metamagic:** prepared casters (and arcanists, if they choose) bake it in at preparation; spontaneous casters, spontaneous cure/inflict/*summon nature's ally*, shaman spirit magic and arcanists casting unprepared metamagic apply it at casting, with the longer casting time (full-round for a standard-action spell; Quicken excepted).
9. **Spellbooks:** wizard starts with all 0-level spells (minus opposition schools), 3 + Int modifier 1st-level spells, +2 free spells per level; others copied with Spellcraft DC 15 + level, 1 page per level (0-level: 1), 100 pages, cost 10 gp × level² (0-level 5 gp). Spell Mastery: Int-modifier spells per feat prepared without the book. Magus, arcanist, alchemist and investigator formula books and the witch's familiar follow similar rules.
10. **Classes that deviate from the plain prepared or spontaneous pattern:** arcanist (prepares, casts spontaneously from what is prepared, separate preparation table), alchemist and investigator (extracts, formula book, no 0-level), witch (familiar is the book), shaman (prepared plus spirit magic slots), cleric and druid (domain slots, spontaneous cure/inflict or *summon nature's ally*), warpriest (spontaneous cure/inflict, no domain slots), wizard (school slot, double slots for opposition schools), inquisitor (domain without slots), oracle and hunter (auto-known cure/inflict or *summon nature's ally*), occultist (spells known per implement school, no table), psychic, sorcerer, bloodrager (extra class-granted spells known), medium (knacks from 1st, spells from 4th), paladin, ranger, antipaladin, adept ("0" entries), bloodrager and medium (1 spell at 4th, not 0).
11. **The four missing tables:** alchemist and investigator extracts per day are identical to each other and to the bard's Spells per Day for levels 1 to 6, with no 0-level column. The unchained summoner's spells per day and spells known are identical to the bard's (and the APG summoner's). The adept has its own table: 3 orisons per day, spell levels 1 to 5, with "0" entries the level a new spell level opens.

## Open Items (read before encoding)

Wording and quotes are in `pf1-rules.md`, "Edge Cases and Open Items". 14 items:

- **S1** Caster level before spells (bloodrager 1–3, medium 1–3) for other rules. **S2** Investigator lacks the alchemist's caster-level sentence. **S3** Bonus spells for shaman spirit magic slots. **S4** 0-level spells in metamagic slots for classes without the "expended normally" clause. **S5** Adept 0-level spells: no Orisons feature.
- **S6** Whether prestige levels may be split across eligible classes. **S7** Psychic classes and arcane/divine prestige advancement (strict wording). **S8** Alchemist and investigator extracts under prestige advancement. **S9** Advancing a class that has no spells yet. **S10** Paladin-style "level – 3" with prestige levels. **S11** Prestige levels beyond class level 20. **S12** Arcanist preparation count under prestige advancement.
- **S13** Magical Knack's Hit Dice cap with prestige levels. **S14** PRD currency (mystic theurge second paragraph only on AoN; other errata not checked line by line).

## Suggested Search Patterns

- A formula:
  - `rg -n "^## Topic: (Caster Level|Save DC|Concentration|Bonus Spells)" docs/ai/pf1-spellcasting-rules/pf1-rules.md`
- One class:
  - `rg -n "Bloodrager|bloodrager" docs/ai/pf1-spellcasting-rules`
- Prestige advancement:
  - `rg -n "belonged to before|must decide to which class|mystic theurge" docs/ai/pf1-spellcasting-rules/pf1-rules.md`
- Metamagic:
  - `rg -n "metamagic|Heighten" docs/ai/pf1-spellcasting-rules`
- Spellbooks:
  - `rg -n "spellbook|formula book|familiar" docs/ai/pf1-spellcasting-rules/pf1-rules.md`
- Open items:
  - `rg -n "Open \(S[0-9]+\)|^- \*\*S[0-9]+\." docs/ai/pf1-spellcasting-rules/pf1-rules.md`
- FAQ anchors:
  - `rg -n "v5748eaic9" docs/ai/pf1-spellcasting-rules`

## Retrieval Notes

- Prefer `pf1-rules.md` for exact wording and open items.
- Prefer `pf1-tables.md` for per-class facts (ability, kind, spell levels, first spell level, swap schedule) and the four tables.
- For the other 24 classes' spells per day and known, use Foundry's journal tables as `research/pf1-spell-data` recommends.
