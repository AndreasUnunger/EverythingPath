# Companion progression rules and pinned catalog coverage

Research for [Collect companion progression rules and catalog coverage](https://github.com/AndreasUnunger/EverythingPath/issues/247), supporting [Decide how companions fit the Character Sheet](https://github.com/AndreasUnunger/EverythingPath/issues/246) on [Pathfinder 1e character builder map](https://github.com/AndreasUnunger/EverythingPath/issues/201). Retrieved 2026-10-02. This is evidence for the decision, not a product specification or an implementation plan.

## Scope and method

The map has already selected calculated build-time statistics for all five companion kinds and a separate linked Character Sheet for each. Read alongside `CONTEXT.md`, ADR 0001 and the map's current reconciliation decisions. Research does not adopt an additional rules subsystem, change the manual-edit/advisory-validation policy, or add play-time tracking.

Rules authority is Paizo text hosted in the official legacy PRD/Archives of Nethys and Paizo's own FAQ. Reads were targeted pages, not a crawl. This is a bounded review of core companion rules and consequential examples, not an exhaustive FAQ, errata, archetype or supplement survey. Separate errata PDFs were not checked. Paizo's FAQ returned HTTP 403 on direct open; the relevant first-party FAQ entries were available in the search index. Their text is distinguished below from inference.

Catalog evidence comes only from content YAML at the selected release tags:

| Repository                                                                                           | Tag      | Commit                                     |
| ---------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------ |
| [Foundry pf1](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/tree/v11.11/packs) | `v11.11` | `418761d2e16a6037c0156bb4a241f7cea5a2986d` |
| [pf1-content](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/tree/11.4.0/src)              | `11.4.0` | `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d` |

No GPL implementation modules were read or copied. Formula strings described below are observed content fields, not authority for the rules. Counts include all records in the named packs, before attribution holds, rules-scope filtering, or deduplication; they are not a count of admitted Paizo choices.

## Rules by kind

### Animal companion — CRB druid

The [druid rules](https://legacy.aonprd.com/coreRulebook/classes/druid.html#animal-companions-184) provide **Animal Companion Base Statistics**, Animal Skills, Animal Feats and species starting/advancement blocks. Effective druid level selects the row; actual d8 HD come from that row, not the associated Character's total level. Compatible sources sum effective druid levels. BAB is three-quarters HD, Fortitude/Reflex good, Will poor; the table supplies feats, skills, armor, Strength/Dexterity and bonus tricks. Intelligence changes can alter available skills/feats and ranks. Companion ability increases occur at effective levels 4/9/14/20; species advancement is additional, with +2 Dexterity/Constitution available instead. Choices include species, advancement alternative, ability increases, feats, ranks and tricks. Multiattack may instead grant another attack at −5.

The class expressly permits release/replacement by a 24-hour ceremony, and ex-druids lose their companion. It does **not** state the released animal's residual statistics or define arbitrary class-edit removal. Those are unresolved, rather than evidence for either freezing or erasing progression. [Nature Bond and Ex-Druids](https://legacy.aonprd.com/coreRulebook/classes/druid.html#nature-bond).

### Familiar — CRB wizard

[Familiar Basics and Familiar Ability Descriptions](https://legacy.aonprd.com/coreRulebook/classes/wizard.html#familiars) distinguish:

| Quantity                                     | Rule input                                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Actual HD/feats                              | Normal creature, retained                                                                                       |
| HD for HD-related effects                    | Greater of normal HD and master's character level                                                               |
| HP                                           | Half master's total, rounded down; excludes temporary HP                                                        |
| BAB                                          | Master's BAB from all classes                                                                                   |
| Each base save                               | Better of creature's or master's class-derived base save; own ability modifier, no inherited other save bonuses |
| Skill ranks                                  | Better of creature's or master's ranks; own ability modifier                                                    |
| Intelligence, natural armor, familiar powers | Combined levels in familiar-granting classes                                                                    |

The advancement table runs levels 1–20; Intelligence rises 6→15 and added natural armor +1→+10. Creature choice supplies the master's benefit, normally within one mile; Alertness requires arm's reach. Only an ordinary unmodified animal qualifies by default; an animal companion cannot simultaneously be a familiar. This table's effective level does not create actual racial HD or new ordinary feat slots. The text excludes temporary **HP**, not all temporary effects, and does not explicitly define whether “total” HP means maximum versus currently remaining HP. That reading needs recording.

### Cohort — CRB Leadership

[Leadership](https://legacy.aonprd.com/coreRulebook/feats.html#leadership) attracts an independently built NPC. Prerequisite: character level 7. Recruitment ceiling is the lower of the Leadership table's cohort level and leader level−2; it is not a grant of class levels. Leadership score uses leader level + Charisma modifier and reputation/situational modifiers. Existing familiar/mount/animal companion gives −2 for attracting a cohort; different alignment gives −1, while opposed alignment is barred. Thus different companion kinds can coexist. Deaths the leader caused modify later recruitment. The cohort advances through its own XP rule, remaining at least two levels behind. No rule says removing Leadership erases its class levels, feats, gear or identity.

[Improved Familiar](https://legacy.aonprd.com/coreRulebook/feats.html#improved-familiar) supplies an additional familiar selection table and eligibility requirements. Non-animal types remain unchanged; the ordinary same-kind speech power is absent. This is a familiar variant, not another progression kind. The [official FAQ](https://paizo.com/paizo/faq/v5748nruor1fm) permits effective wizard level to substitute for arcane spellcaster level, with exceptions for temporary familiars and incompatible variant abilities.

### Eidolon — Advanced Player's Guide

The [APG summoner](https://legacy.aonprd.com/advancedPlayersGuide/baseClasses/summoner.html#eidolons) supplies **Eidolon Base Statistics**, three base forms, class-skill choices and evolution definitions. Summoner level determines actual d10 HD, full-HD BAB, two good saves, ranks (6 + own Intelligence modifier per HD), feats, armor allocation, Strength/Dexterity, evolution pool and attack ceiling. Base form determines good saves and starting statistics; Small is a choice. Four additional class skills, ranks, feats, ability increases, armor/natural-armor split, evolutions and evolution parameters are recorded choices. Natural attacks alone count toward the original attack ceiling.

A summoner repeatedly calls the same outsider; dismissal/death means return to its plane, not replacement by a new identity. Arbitrary source-removal/residual statistics are unspecified. Link shares magic-item slots, with summoner items winning conflicts. Aspect/Greater Aspect divert evolution capacity to the summoner. Evolution changes can invalidate retained feats. These are dependencies across sheets even without tracking combat. No general cross-class stacking rule analogous to the druid's is given. [APG summoner features](https://legacy.aonprd.com/advancedPlayersGuide/baseClasses/summoner.html).

### Unchained eidolon — Pathfinder Unchained

The [unchained summoner](https://legacy.aonprd.com/unchained/classes/summoner.html#eidolon-base-statistics) has its own table and evolutions. Its HD/BAB/save/rank/feat/armor progression matches the original, but the evolution pool is smaller. Its attack ceiling includes manufactured-weapon attacks and BAB iteratives. A subtype restricts alignment, forms and evolutions and adds free abilities, commonly at levels 1/4/8/12/16/20. The twelve printed subtypes are agathion, angel, archon, azata, daemon, demon, devil, div, elemental, inevitable, protean and psychopomp. Subtype alone does not grant every monster-subtype trait.

Choices must distinguish base-form grants, subtype grants and purchased evolutions. For example, Pounce costs 3 points and requires summoner level 7 plus quadruped form; original Pounce costs 1 point without that level requirement. Alignment can differ by one step; a larger mismatch makes the eidolon refuse summons until restored. This is not a creature deletion rule. Link still shares item slots; death/dismissal still returns the same creature. This book's classes are already admitted by [Decide which Pathfinder Unchained rules the builder supports](https://github.com/AndreasUnunger/EverythingPath/issues/226); this finding does not admit its unrelated alternate systems.

### Numeric checkpoints

These are checkpoints against the linked official tables, not a substitute for their complete rows or feature schedules. `L` is effective druid level or applicable summoner level, respectively; none is the companion's count of Class Levels.

| L   | Animal actual HD | Eidolon actual HD (both) | Original evolution pool | Unchained pool |
| --- | ---------------- | ------------------------ | ----------------------- | -------------- |
| 1   | 2                | 1                        | 3                       | 1              |
| 4   | 4                | 3                        | 7                       | 3              |
| 7   | 6                | 6                        | 10                      | 6              |
| 10  | 9                | 8                        | 14                      | 8              |
| 15  | 12               | 12                       | 20                      | 12             |
| 20  | 16               | 15                       | 26                      | 15             |

Sources: [animal table](https://legacy.aonprd.com/coreRulebook/classes/druid.html#animal-companions-184), [original eidolon table](https://legacy.aonprd.com/advancedPlayersGuide/baseClasses/summoner.html#eidolons), [unchained eidolon table](https://legacy.aonprd.com/unchained/classes/summoner.html#eidolon-base-statistics).

## Other granting sources and explicit exceptions

| Source                                                                                                                      | Consequence                                                                                                                                                                                                                                                                                       | Admission boundary                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [CRB ranger, Hunter's Bond](https://legacy.aonprd.com/coreRulebook/classes/ranger.html#hunter-s-bond)                       | At ranger 4, effective druid level = ranger−3; restricted species list; shares favored enemy/terrain bonuses.                                                                                                                                                                                     | Core; bonuses are another cross-sheet dependency.                                                                                                                                                     |
| [CRB cleric, Animal domain](https://legacy.aonprd.com/coreRulebook/classes/cleric.html#animal-domain)                       | At cleric 4, effective druid level = cleric−3. A druid choosing this domain also uses druid−3.                                                                                                                                                                                                    | Core; avoid counting the same druid level again through both exclusive Nature Bond choices.                                                                                                           |
| [CRB paladin, Divine Bond](https://legacy.aonprd.com/coreRulebook/classes/paladin.html#divine-bond)                         | Mount uses full paladin effective druid level, Intelligence at least 6, later celestial template and spell resistance. Ex-paladins lose its service. Death permits replacement after 30 days or a paladin level, whichever first.                                                                 | Core grant; celestial template's actual rules additionally require Bestiary content. No residual-stat reset is specified.                                                                             |
| [CRB sorcerer, Arcane bloodline](https://legacy.aonprd.com/coreRulebook/classes/sorcerer.html#arcane)                       | Sorcerer levels stack with wizard for the bond's powers; cannot gain both a familiar and bonded item through it.                                                                                                                                                                                  | Core.                                                                                                                                                                                                 |
| [APG witch, Witch's Familiar](https://legacy.aonprd.com/advancedPlayersGuide/baseClasses/witch.html#witchs-familiar)        | Levels in familiar-granting classes stack, but witch familiar rules govern the combined familiar. It stores witch spells, not other classes' spells. Replacement has different delay/cost and a specific initial spell complement. A dead witch's familiar retains spell knowledge only 24 hours. | Flag the noncasting familiar mechanics for explicit admission; this does not authorize automatic deletion of existing spell records under the map's retention policy.                                 |
| [APG ranger, Beast Master](https://legacy.aonprd.com/advancedPlayersGuide/coreClasses/ranger.html#beast-master)             | Multiple animals divide effective druid levels. Allocation is recorded per companion; release/death permits redistribution, and later Strong Bond changes the level budget.                                                                                                                       | APG archetype example already within archetype scope; multiplicity cannot universally be capped at one creature per kind.                                                                             |
| [Ultimate Magic, Broodmaster](https://legacy.aonprd.com/ultimateMagic/spellcastingClassOptions/summoner.html#eidolon-brood) | Eidolons share the table's BAB/base saves, but divide HD, ranks, feats, armor, Strength/Dexterity, evolution points and attack counts. Each HD allocation is at least 1.                                                                                                                          | Flagged additional book mechanics; splitting effective summoner levels is insufficient. Same page's Master Summoner halves effective level; Synthesist replaces the normal independent-body behavior. |
| [Boon Companion](https://aonprd.com/FeatDisplay.aspx?ItemName=Boon%20Companion)                                             | +4 effective levels, capped at character level, assigned to one companion/familiar; repeat selections affect different creatures and can follow replacements.                                                                                                                                     | Catalog feat, cited to Ultimate Wilderness/Seekers of Secrets/Animal Archive; not an authority to import every subsystem in those books.                                                              |
| [Bestiary, Monster Cohorts](https://legacy.aonprd.com/bestiary/monsterCohorts.html)                                         | Monster's cohort-level equivalence is a separate value from actual HD/class levels. E.g. pegasus is cohort level 6; young dragon uses CR+8. Later class levels advance it.                                                                                                                        | Flagged Bestiary section beyond the already-admitted creature-type table. The legacy page aggregates later Bestiaries too; do not call the whole page CRB coverage.                                   |

The core spellcaster rules combine grants belonging to the **same** associated Character. No reviewed rule supplies a calculation for one companion simultaneously receiving advancement from multiple different Characters. That absence is not an explicit prohibition; a single-active-association restriction would be a product integrity choice.

## Dismissal, loss and permanent/current dependencies

The [Paizo CRB FAQ](https://paizo.com/paizo/faq/v5748nruor1fm), “Sorcerer/Wizard: Can I dismiss my familiar…”, expressly says a dismissed familiar returns to a normal creature of its type. When a character takes the Improved Familiar feat, the familiar can be replaced immediately without cost or additional time; the FAQ assumes this happens during level-up preparation. That exception applies to taking the feat, not to every later replacement of an improved familiar. This resolves familiar **dismissal**; it does not expressly describe arbitrary removal of granting choices from an editable build. Its replacement-price wording differs from the class text, so keep the lifecycle distinction rather than inventing a unified cost rule.

The same FAQ's temporary-ability entry says temporary ability bonuses affect the same statistics as permanent bonuses; “permanent only” is not a general companion rule. Whether changing recruitment conditions later affects an existing cohort is a separate question from calculating a current Leadership score. The research found no explicit current-versus-permanent cutoff in Leadership's Charisma formula.

The [Ultimate Campaign companion chapter](https://legacy.aonprd.com/ultimateCampaign/campaignSystems/companions.html#reviving-and-replacing-companions) is **flagged, not admitted by this research**. It explicitly describes recruiting an existing NPC as a cohort and purchased/rescued animals as companions, with no mechanical difference from other replacement routes. It also distinguishes creatures with no character levels (animals/familiars) from classed cohorts for resurrection. Its narrative guidance does not specify residual released-animal statistics.

For calculations, the evidence supports separate dependency categories rather than a single inherited “level” or “stats” object:

- Granting class/effective levels: progression budgets; no general dependency on the associated Character's ability scores.
- Familiar: class-derived BAB/base saves, total HP with a specific exclusion, recorded skill ranks, and distinct total-character-level versus familiar-progression inputs.
- Companion's own statistics: Constitution contributes to actual-HD HP; Intelligence contributes to its rank rules; evolutions can read its own HD/abilities. A familiar borrows ranks, not the master's complete skill bonus.
- Bidirectional effects: familiar benefits, ranger enemy/terrain bonuses, eidolon slot conflicts, evolution-point diversion. Distance/condition prerequisites stay conditions rather than unexplained always-on totals.

This is a dependency inventory, not a choice of current/permanent projection or a mandate to track range, death, sleep, summoning, HP loss, ritual time or daily usage at launch.

## Pinned catalog observations

### Reproducible pack counts

Each count is the number of top-level `*.yaml` records in the linked tag directory, excluding embedded `items`. The system familiar directory contains one folder record: 11 YAML records means 10 substantive content items plus that folder.

| Pin / directory                                                                                                                            | Records | Top-level types                   | Observed coverage                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------- | --------------------------------- | ----------------------------------------------------------------------------------------------- |
| [pf1 `packs/companion-features`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/tree/v11.11/packs/companion-features) | 11      | 9 `feat`, 1 `class`, 1 `Item`     | Familiar progression item, nine powers, one folder (`_key: !folders!…`)                         |
| [content `src/pf-companions`](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/tree/11.4.0/src/pf-companions)                      | 205     | `character`                       | Creature templates with embedded Animal Companion class/features                                |
| [content `src/pf-familiars`](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/tree/11.4.0/src/pf-familiars)                        | 175     | `npc`                             | Normal/improved candidate creatures; all embed conversion buffs                                 |
| [content `src/pf-companion-features`](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/tree/11.4.0/src/pf-companion-features)      | 12      | 11 `feat`, 1 `class`              | Animal progression and its features                                                             |
| [content `src/pf-eidolon-forms`](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/tree/11.4.0/src/pf-eidolon-forms)                | 14      | `character`                       | Seven forms, each default/Small: aberrant, aquatic, avian, biped, quadruped, serpentine, tauric |
| [content `src/pf-eidolon-evolutions`](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/tree/11.4.0/src/pf-eidolon-evolutions)      | 109     | 98 `feat`, 10 `attack`, 1 `class` | 79 names containing ` EP)`; remaining records include progression/support/attack items          |

Within those content directories, all 394 actor templates and all 12 animal feature records omit top-level `system.sources`; 108 of 109 eidolon records do too. Absence of that field is **not** proof of missing attribution: 174/175 familiar templates contain `Source` in their notes. These counts flag work for the already-agreed Attribution Assessment, not automatic legal conclusions or a new admission policy.

### Stable identifiers and data shape

Under the map's `<repo>/<_id>` identity rule, useful examples are:

| Stable key                                                     | Path relative to repository                                                                      | Evidence                                                                                                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pf1/EbgtpUXqVup5iXeD`                                         | `packs/companion-features/familiar.EbgtpUXqVup5iXeD.yaml`                                        | Intelligence/natural-armor content formulas, complete HTML advancement table, level-keyed feature UUIDs. Prose instructs manual BAB/saves/HP setup. |
| `pf1/R3a1OV18RwDJftvq`                                         | `packs/feats/leadership.R3a1OV18RwDJftvq.yaml`                                                   | Leadership rules/table in description; not a cohort character build.                                                                                |
| `pf1/YmWKyC6bPUqHf9iQ`, `pf1/Yr1ZNxgxDVsRwxtj`                 | `packs/class-abilities/eidolon.*.yaml`, `eidolon-uc.*.yaml`                                      | Original/unchained summoner granting features; prose is separate, not a full structured companion resolver.                                         |
| `pf1-content/oczJR5oLDOOxV8mk`                                 | `src/pf-companion-features/Animal_Companion_oczJR5oLDOOxV8mk.yaml`                               | `customHD`, BAB/save/class-skill fields and HTML table. Its level is effective progression, not a normal Character Class Level.                     |
| `pf1-content/9gMnOdTPE6GA1DGi`                                 | `src/pf-companions/Wolf_9gMnOdTPE6GA1DGi.yaml`                                                   | Base scores/speed/armor and embedded attack/features; seventh-level growth is HTML in notes, not a structured advancement object.                   |
| `pf1-content/41b7l5R6nGWaJdEu`                                 | `src/pf-familiars/Cat_41b7l5R6nGWaJdEu.yaml`                                                     | Normal cat template with source/statblock in notes. No embedded class item; normal HD cannot be inferred merely by summing such items.              |
| `pf1-content/cbkMD4yvgLyrkYKq`                                 | `src/pf-eidolon-evolutions/Eidolon_cbkMD4yvgLyrkYKq.yaml`                                        | d10/custom-HD progression; HTML original table, class skills and feature links.                                                                     |
| `pf1-content/gQahVj8GpA8Yvguq`, `pf1-content/B2McodEGU4IGjGqi` | `src/pf-eidolon-evolutions/Evolution_Pool__Chained__*.yaml`, `Evolution_Pool__Unchained__*.yaml` | Separate original/unchained point formulas in charge fields.                                                                                        |
| `pf1-content/WRk36VbOw70z0KKP`                                 | `src/pf-eidolon-evolutions/Requires_Manual_Setup_WRk36VbOw70z0KKP.yaml`                          | Explicit manual class-skill selection and choice of which pool item to use.                                                                         |
| `pf1-content/IZ2U32kCaPZADdNS`                                 | `src/pf-eidolon-evolutions/Pounce__1_EP__IZ2U32kCaPZADdNS.yaml`                                  | Original one-point Pounce; no parallel unchained Pounce record in this pack.                                                                        |

Content paths above are relative to the two pinned repository roots linked under Scope. Embedded copies have their own IDs: wolf's embedded Animal Companion is `XSTiHEsmmEiZqR4H`, different from the standalone definition. A catalog importer cannot treat each embedded copy as a new canonical rules identity without reconciliation.

### Consequential gaps and checks

1. **No structured companion relationship.** The inspected actors/features supply templates and content; they do not supply this app's associated-Character identity, ownership or authorization contract. The familiar content itself calls for manual master-derived setup.
2. **Progression is only partly structured.** Animal/eidolon classes use `customHD` formulas and per-class fields; tables are HTML. Advancement choices, alternate species advancement, allocation of armor, effective-source combining and pool assignment still need interpretation. A full named table is available in the content, but that is not equivalent to every rule being a machine-readable record.
3. **Familiars are incomplete normal-creature inputs.** Only 53/175 templates embed any class item; 173 have race items, all 175 have `sbc | Conversion Buff`. None has an explicit actor `system.attributes.hd` field. The cat's original HD is visible in its descriptive statblock. This audit does not establish all original ranks/feats/HD can be reconstructed from uniform structured fields.
4. **Unchained coverage is not furnished by the second pool alone.** No eidolon-subtype definitions were found in these packs or by targeted subtype-name/description searches across their class-ability content. `Agathion` (`CE77da3E2MyxRTG9`) is a Medium outsider spirit, not an eidolon subtype. The pinned Pounce record demonstrates an actual rules-version difference, alongside the different weapon-attack cap. Version-specific definitions need official-text verification.
5. **Examples require curation.** Biped form `hbjII7pJ4ECZ2Z5k` carries an avian description in `system.details.biography.value` and both pool-support items. Treat it as a template requiring review, not a ready-made rule baseline. Seven forms in the pack exceed the three APG forms; this audit does not establish that all seven belong to either admitted summoner version.
6. **Formula-bearing records are a minority.** In the eidolon pack, 12/109 records have nonempty top-level `system.changes`; animal features have 3/12. Other numbers can exist in attack actions or charge formulas, so these are presence counts, not a percentage of automated mechanics. Costs and prerequisites commonly remain in names/prose. Counts alone do not demonstrate complete evolution support.
7. **Cohorts reuse character content.** No dedicated cohort progression pack exists in these pins. Leadership content exists, but a cohort's race/classes/build must be recorded separately. Bestiary cohort-level mappings are a distinct source requirement if adopted.

### Reproduction

Check out the two tags above, then run this content-only inspection from anywhere with Python and PyYAML installed. Set the two paths to those checkouts. It counts top-level records only and prints identifiers without importing any runtime code.

```python
from collections import Counter
from pathlib import Path
import yaml

roots = {
    "pf1": Path("/path/to/foundryvtt-pathfinder1/packs"),
    "pf1-content": Path("/path/to/pf1-content/src"),
}
for repo, root in roots.items():
    for pack in sorted(root.iterdir()):
        if not pack.is_dir() or not any(
            word in pack.name for word in ("companion", "familiar", "eidolon")
        ):
            continue
        records = [yaml.safe_load(p.read_text()) for p in pack.glob("*.yaml")]
        print(repo, pack.name, len(records), Counter(r.get("type") for r in records))
        print("changes", sum(bool(r.get("system", {}).get("changes")) for r in records))
        print("sources", sum(bool(r.get("system", {}).get("sources")) for r in records))
        print("EP names", sum(" EP)" in r["name"] for r in records))
```

The formulas and checkpoint values were compared with their official tables; no app behavior or upstream GPL resolver behavior was assumed or tested.

## Open decisions and limits

These are questions for [Decide how companions fit the Character Sheet](https://github.com/AndreasUnunger/EverythingPath/issues/246) or a later sharp decision ticket, not decisions made by the researcher. Later user answers take precedence over this inventory.

- **Progression vocabulary:** the current glossary says racial Hit Dice never advance and total Hit Dice is Class Levels plus racial Hit Dice. Companion progression introduces changing actual HD without ordinary class levels. Decide its home without making familiar effective HD into actual HD or class levels.
- **Source loss:** distinguish dismissal, ordinary replacement, missing source after build edit, alignment estrangement and loss of data access. Familiar dismissal has a rule; the reviewed texts do not supply one universal residual-stat policy for all those events. No source specifies database deletion or frozen stats.
- **Combination:** which sources legally combine, restrictions on species, multi-companion allocation and per-source exceptions must remain distinct. Do not infer arbitrary cross-Character stacking from same-Character multiclass rules.
- **Current versus permanent facts:** record the intended familiar-HP reading and how existing current/permanent projections apply to imported dependencies. Temporary HP is not the same category as HP derived from a temporary Constitution bonus. The existing permanent-Int rank policy is a product decision; this research does not rewrite it.
- **Bidirectional effects:** decide how the chosen build-time scope represents shared slots, species benefits, ranger bonuses and Aspect allocation. Situational/duration behavior does not imply adding a play-time tracker.
- **Witch spell storage:** decide whether companion replacement changes the current usable spell set while preserving the existing recorded spells. Retention and availability are separate; the text's replacement spell complement is evidence, not permission to delete records.
- **Book admission:** explicitly bound Bestiary familiar creature statistics/templates/monster cohorts, APG noncasting companion class features, Ultimate Magic variants and other named catalog content. Finding an imported row does not admit a whole subsystem.
- **Catalog completeness:** there is no evidence here for every companion option, archetype, evolution variant or subtype being ready to calculate from the pins. Identified missing structures and attribution gaps remain visible within the map's existing catalog/overlay/hold contract.
- **Application integrity:** account ownership, campaign moves, permissions, relationship retention, references to unavailable Characters and cycle prevention are product rules. Paizo rules supply no access-control or database lifecycle contract.
