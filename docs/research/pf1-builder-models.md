# How existing PF1 builders model characters

Research for [#203](https://github.com/AndreasUnunger/EverythingPath/issues/203), part of the map [#201](https://github.com/AndreasUnunger/EverythingPath/issues/201). Researched 2026-10-01.

**Question.** How do existing Pathfinder 1e builders model class levels and multiclassing, favoured class bonuses (FCB), skill ranks, feat and trait slots, ability increases, level-up history and derived stats (HP, BAB, saves, AC, CMB/CMD, skill totals)? How do they implement bonus stacking, and what traps do they document? What does that mean for [`docs/pf-character-sheet-data-model.md`](../pf-character-sheet-data-model.md)?

## Sources surveyed

Each claim below links to the file and line it comes from. The code links are pinned to the commit that was read.

| Tool | What was read | Pinned at |
|---|---|---|
| **Foundry VTT `pf1` system** (v11.11), open source | Actor and item data models, the Changes engine, the level-up app, in-repo help | [`b0d719e1`][fvtt] (2026-10-01) |
| **PCGen**, open source | Pathfinder game mode files, Core Rulebook LST data, LST docs, `.pcg` save writer | [`adc7fb97`][pcgen] (2026-09-27) |
| **Hero Lab Classic** (closed source; the authoring kit is documented) | HL Kit wiki concept pages, plus a community list of PF1 data macros | [hlkitwiki][hl-picks] |
| **Roll20 "Pathfinder Community" sheet**, open source | Buff stacking (`PFBuffs.js`) and the class grid (`PFClassRaceGrid.js`) | [`4a4fe30b`][r20] (2026-09-29) |
| **PF1 rules text** (d20pfsrd, which reproduces the OGL Core Rulebook) | Bonus and stacking glossary, character advancement, skills, combat, magic | [glossary][r-gloss], [advancement][r-adv], [skills][r-skills], [combat][r-combat], [magic][r-magic] |

Hero Lab's Pathfinder data files are proprietary, so the HL section covers only the engine concepts in the official kit wiki, plus one community-maintained macro reference. The macro reference is a secondary source and is marked as such.

## Summary

- **Every tool uses the same overall shape.** A rule definition (Foundry *Item* in a compendium, PCGen LST object, Hero Lab *thing*) is instantiated onto the character (Foundry embedded Item, PCGen chosen ability, Hero Lab *pick*). Totals are recomputed from bonuses carried by the active instances. The data model's catalog entry / sheet entry split and "never store totals" match this.
- **Class levels are aggregated, except in PCGen.** Foundry and Roll20 keep one record per class with a `level` count and per-class FCB counters. Only PCGen saves an ordered per-level history: class, HP for that level, stat increases and skill points gained and remaining. The rules make FCB and ability-increase choices per level and fixed once made, so the aggregate model loses information the rules care about.
- **Derived stats come out as built-in modifiers.** Foundry generates BAB, base saves, HP per class, ability modifiers, skill ranks, the +3 class-skill bonus, size and armor check penalty as synthetic "MetaChanges". They pass through the same stacking pipeline as item bonuses, so the sheet can show one breakdown for everything.
- **Bonus stacking is a lookup on bonus type, with three known gaps.** All three tools stack untyped, dodge and circumstance bonuses and take the highest of every other type. Foundry and PCGen also stack **racial**, which matches the rules text. The three gaps:
  - **Penalties.** The rules say most penalties stack. Roll20 sums them. Hero Lab's macro takes the worst per type. Foundry's result depends on processing order.
  - **The same-source rule.** None of the surveyed resolvers implements it.
  - **Bonuses aimed at a parent target.** A bonus to "AC" and a same-type bonus to "touch AC" can double-count unless stacking is evaluated after fan-out.
- **Most documented traps come from processing order.** Foundry applies changes one at a time in priority order. Its changelog has a long series of stacking bugs, and its source carries TODO, HACK and BUG notes about ordering, Dex-to-AC and wound thresholds. Hero Lab exposes phase and priority to data authors and warns that "assigning the correct phase and priority is often critical" ([evaluation cycle][hl-eval]). A pure resolver that groups modifiers and picks winners, run in a fixed stage order, avoids this whole class of bugs.

## Comparison by topic

### Class levels and multiclassing

- **Foundry.** A class is one Item with an integer `level`, a hit die size, `bab` (`low`/`med`/`high`/`custom`), a good or poor progression per save, `skillsPerLevel`, and the `fc` counters ([class-model.mjs L42–L84][fvtt-class-schema]). A class `subType` (`base`, `prestige`, `npc`, `racial`, `mythic`) selects the save formulas ([config.mjs L159–L165][fvtt-classtypes]). Each class computes its own BAB and saves from its own level with `floor`, and the actor sums the per-class results. Examples: `floor(@hitDice * 0.75)` for medium BAB, `2 + floor(@hitDice / 2)` for a good base-class save, `floor((1 + @hitDice) / 2)` for a good prestige save ([config.mjs L189–L241][fvtt-babsave]; [class-model.mjs L324–L372][fvtt-class-prep]). Unchained "fractional base bonuses" is an optional rule that sums the unfloored fractions and adds +2 once for any good save ([config.mjs L245–L275][fvtt-frac]; [base-character-model.mjs L1677–L1740][fvtt-saves]; [Optional.md][fvtt-optional]). Class features are linked to the class with a `level` and are created or deleted as actor items when the class level crosses that number ([link-model.mjs][fvtt-link]; [item.mjs L401–L420][fvtt-item-assoc]).
- **PCGen.** A `CLASS:` line carries `HD:`, `TYPE:Base.PC`, `MAXLEVEL:` and per-class bonus formulas: `BONUS:COMBAT|BASEAB|classlevel(...)|TYPE=Base.REPLACE` and `BONUS:SAVE|BASE.Fortitude|classlevel(...)/2+2` ([cr_classes.lst L139][pcgen-fighter]). Level-numbered lines below it grant features at that class level ([cr_classes.lst L142–L143][pcgen-fighter-lvl]). Using `.REPLACE` for base BAB matters: `.REPLACE` values of a type are *summed together* before being compared with the plain values of that type, so each class's base BAB adds up instead of competing for "highest" ([globalfilesbonus docs][pcgen-bonusdoc]).
- **Roll20.** A fixed grid of six class rows, each holding level, HD, HP, FCB HP/skill/alt, BAB and Fort/Ref/Will numbers, totalled across rows ([PFClassRaceGrid.js L11, L144–L151][r20-classgrid]).
- **Rules.** A multiclass character "adds all of the hit points, base attack bonuses, and saving throw bonuses" of each class. Effects keyed to "level or Hit Dice" use the character total, and class abilities use the level in that class ([advancement][r-adv]).

### Favoured class bonuses

- **Rules.** One favoured class is chosen at creation and never changes. Each level in it grants +1 HP or +1 skill rank (or a racial alternative from the APG). The choice "cannot be changed once made for a particular level", and prestige classes "can never be a favored class" ([advancement][r-adv]).
- **Foundry.** Three counters per class: `fc.hp.value`, `fc.skill.value` and `fc.alt.value` (with free-text `notes`) ([class-model.mjs L65–L84][fvtt-class-schema]). The level-up dialog increments one counter ([level-up.mjs L1249–L1262][fvtt-levelup-commit]). Which levels got which choice is not recorded. A class only counts as "favoured" when its counters are non-zero. Trap: the HP code accepts FCB from `favoredClassTypes = base, prestige, npc` ([config.mjs L2460][fvtt-fctypes]; [base-character-model.mjs L2302–L2350][fvtt-health]), but the actor registration only exposes FCB for base classes ([class-model.mjs L402–L447][fvtt-register]). The two disagree, and neither enforces the rules' prestige ban.
- **PCGen.** The favoured class is an ability chosen from a one-slot "Favored Class" pool. Each candidate class then opens a "Favored Class Bonus" pool sized to that class's level, and each FCB is a separately chosen ability. "Bonus Hit Point" adds `BONUS:HP|CURRENTMAX|1`. "Bonus Skill Rank" adds `BONUS:SKILLRANK|LIST|1` to a chosen skill ([cr_abilitycategories.lst L21–L23][pcgen-abcat]; [cr_abilities_class.lst L68–L94][pcgen-fcb]). That makes it a counted pool of discrete choices, which is closer to per-level than Foundry's counters.
- **Roll20.** Per-class-row numbers `fchp`, `fcskill`, `fcalt` ([PFClassRaceGrid.js L11][r20-classgrid]).

### Skill ranks

- **Rules.** Ranks can never exceed total Hit Dice. Class skills with at least one rank get +3, and that +3 does not stack across classes. Each class level grants ranks from its table, and humans get +1 ([skills][r-skills]).
- **Foundry.** One `rank` integer per skill item, the total across all levels ([skill-model.mjs L33][fvtt-skill]). The rank budget is computed in the *sheet*, not the model: Σ per class `max(1, skillsPerLevel + Int mod) × HD`, plus FCB skill counters, plus a bonus formula. Optional background-skill and consolidated-skill variants follow the same pattern ([base-character-sheet.mjs L856–L895][fvtt-skillbudget]). Ranks, the +3 class bonus, the ability modifier and armor check penalty each become a built-in modifier on the skill ([base-character-model.mjs L1801–L1866][fvtt-skillchanges]). The rank cap and budget are warnings only.
- **PCGen.** The game mode table sets the max rank per character level (`CSKILLMAX:LEVEL`) ([level.lst L9][pcgen-level]). Skill ranks are saved per skill *and per class they were bought in* (`CLASSBOUGHT:[CLASS:…|RANKS:…|COST:…|CLASSSKILL:…]`) ([PCGVer2Creator.java L309–L321][pcgen-skillsave]). Each level-history row also stores skill points gained and remaining ([PCGVer2Creator.java L955–L962][pcgen-levelinfo-write]). When the saved number is missing, PCGen recalculates it ([PCLevelInfo.java L128–L137][pcgen-levelinfo]). A game-mode rule toggles whether bonus skill points are retroactive ([rules.lst L48][pcgen-rules]). `BONUS:SKILLPOINTS` is documented as "Not retroactive" ([globalfilesbonus docs][pcgen-bonusdoc]).

### Feat and trait slots

- **Foundry.** Counts only, no slots. `getFeatCount()` returns `max = ceil(HD/2) + ceil(mythicTier/2) + bonus formula + changes` and compares it with the number of owned feats of subtype `feat` ([actor.mjs L2015–L2075][fvtt-featcount]). A feat item does not record which slot it fills. Traits are feat items of subtype `trait`, alongside `classFeat`, `racial`, `misc` and `template` ([config.mjs L1432–L1439][fvtt-feattypes]).
- **PCGen.** Typed slot pools. Each `ABILITYCATEGORY` is a pool with its own size and allowed types. Example: "Fighter Bonus Feat" draws from `CATEGORY:FEAT` restricted to `TYPE:Combat`, and "Traits" has its own `POOL:Pool_Traits` ([cr_abilitycategories.lst L55, L88][pcgen-abcat]). The general feat cadence comes from the game mode: `BONUSFEATLEVELSTARTINTERVAL:3|2`, and ability increases from `BONUSSTATLEVELSTARTINTERVAL:4|4` ([miscinfo.lst L92–L104][pcgen-misc]). GM awards adjust a pool with `BONUS:ABILITYPOOL|FEAT|±1` ([cr_abilities.lst L437, L489][pcgen-awards]).
- **Rules.** Feats come at 1st and every odd level, and traits come at creation ([advancement][r-adv]).

### Ability score increases

- **Rules.** +1 to one score at 4, 8, 12, 16 and 20. It is "a typeless, nonmagical bonus that cannot be changed once selected" and "stacks with all other bonuses" ([advancement][r-adv]).
- **Foundry.** The level-up dialog writes increases into **one** cumulative feat item flagged `levelUp`, adding to an existing change's number or creating an `untypedPerm` change ([level-up.mjs L1401–L1470][fvtt-levelup-abl]; table at [config.mjs L83–L89][fvtt-ablincr]). Which level gave which point is lost.
- **PCGen.** Each level-history row records stat changes before and after that level (`PRESTAT`) ([PCLevelInfo.java L40–L44][pcgen-levelinfo]; [PCGVer2Creator.java L935–L953][pcgen-levelinfo-write]).

### Level-up history

- **PCGen is the only tool that keeps it.** `.pcg` files hold one `CLASSABILITIESLEVEL:` line per level "in the order of levelling" ([PCGVer2Creator.java L870–L962][pcgen-levelinfo-write]). Each line holds the class key and class level, `HITPOINTS` for that level, per-level save bonuses and special abilities, the choices made for that level's `ADD:` tokens, stat increases, and skill points gained and remaining.
- **Foundry keeps none.** Its level-up dialog posts a chat card and mutates the aggregate class item ([level-up.mjs L1207–L1300][fvtt-levelup-commit]). HP is either `hp` per class or auto-average. "Maximized" hit dice go to the first classes in *sheet sort order*, not to the class actually taken at 1st level ([base-character-model.mjs L2302–L2420][fvtt-health]), because the model doesn't know which class came first.

### Derived stats

| Stat | How it is built (Foundry, unless noted) | Source |
|---|---|---|
| HP | Per class: HD × average (or manual `hp`), plus FCB HP, plus `Con mod × total HD`, all as `untypedPerm`/`base` changes on `mhp`. The source carries a HACK note about rounding with multiclassing. | [base-character-model.mjs L1734–L1745, L2302–L2420][fvtt-health] |
| BAB | Per-class floored value emitted as an `untyped` change on `bab` | [class-model.mjs L374–L395][fvtt-class-bab] |
| Saves | Per-class base as `untypedPerm`, plus ability mod, minus negative levels | [base-character-model.mjs L1677–L2040][fvtt-saves] |
| AC | The target `ac` fans out by **bonus type**. Every type reaches normal and touch AC. Dodge and haste also reach CMD but not flat-footed. Deflection, circumstance, insight, luck, morale, profane and sacred reach flat-footed and both CMDs. Armor, shield and natural armor are separate targets (`aac`/`sac`/`nac`), each with its own base/enhancement/misc parts, and never reach touch AC. | [base-character-model.mjs L3553–L3662][fvtt-ac] |
| Dex to AC | Applied *outside* the change system (marked "TODO: Move to actual changes"). Capped by max Dex from armor and encumbrance; flat-footed keeps only a negative Dex; `loseDexToAC` also drops positive dodge. | [base-character-model.mjs L2507–L2540][fvtt-dexac]; [change.mjs L507][fvtt-dodge] |
| CMB | BAB-derived shared attack + general attack bonuses + ability mod + special size mod + CMB bonuses | [base-character-model.mjs L2619–L2632][fvtt-cmb] |
| CMD | BAB + Str (configurable) + Dex + size, plus the AC types listed above. AC *penalties* of any type also hit CMD. | [base-character-model.mjs L1917–L1950, L3574–L3588][fvtt-ac] |
| Skills | rank (`base`) + 3 class skill (`untyped`) + ability mod + armor check penalty + size (Stealth/Fly) + racial climb/swim speed bonus | [base-character-model.mjs L1801–L2180][fvtt-skillchanges] |

The rules agree with Foundry's AC and CMD fan-out. Touch AC excludes "any armor bonus, shield bonus, or natural armor bonus". CMD adds "circumstance, deflection, dodge, insight, luck, morale, profane, and sacred bonuses to AC", and "any penalties to a creature's AC also apply to its CMD" ([combat][r-combat]).

## Bonus-stacking implementations

| | Foundry pf1 | PCGen | Hero Lab Classic | Roll20 PF Community |
|---|---|---|---|---|
| Modifier shape | `Change {formula, operator: add\|set, target, type, priority}` on an Item ([change.mjs L33–L46][fvtt-change-schema]) | `BONUS:<category>\|<target>\|<formula>\|TYPE=<type>[.REPLACE\|.STACK]` ([docs][pcgen-bonusdoc]) | Scripts on things and picks, run per phase and priority ([evaluation cycle][hl-eval]); PF macros `#applybonus[type, pick, value]` / `#applypenalty` ([community list][hl-macros], secondary) | Buff rows `{bonus column, bonusType, value}` ([PFBuffs.js L26–L31][r20-buffs-types]) |
| Stacking types | untyped, untypedPerm, dodge, racial, circumstance ([config.mjs L1660][fvtt-stacking]) | Untyped always; typed only if listed: `BONUSSTACKS:Defense.Dodge.Circumstance.Racial.NotRanged.NotFlatFooted` ([miscinfo.lst L17][pcgen-misc]) | Non-stacking via `#applybonus` for alchemical, competence, insight, luck, morale, sacred, profane ([community list][hl-macros]) | untyped, circumstance, dodge, plus "penalty" as a pseudo-type ([PFBuffs.js L112–L113][r20-buffs-stack]) |
| Penalties | Same path as bonuses. Non-stacking negatives are applied incrementally (see the order trap below). | Same `TYPE` rules as bonuses | `#applypenalty`: "only the worst will apply" per type ([community list][hl-macros]) | **All negatives summed** regardless of type ([PFBuffs.js L631–L642][r20-buffs-stack]) |
| Same-source rule | Not implemented. Grouping is by target path and type only. ([apply-changes.mjs L223–L262][fvtt-highest]) | Not in the BONUS engine. `STACK:NO` on an ability stops it being taken twice, not its bonus from stacking. ([docs][pcgen-bonusdoc]) | n/a | Not implemented |
| Algorithm | Incremental: sort by priority, then target, then type, and apply one at a time. A non-stacking change adds `max(0, value − currentBest)`. | Group and pick: sum `.REPLACE`, compare with the highest plain value, add `.STACK` | Script order (phase and priority) | Group and pick per column, then subtract same-type bonuses already applied through a parent column |

Sources for the Foundry algorithm row: [apply-changes.mjs L19–L91][fvtt-apply] and [change.mjs L500–L540][fvtt-change-apply].

## Documented traps

1. **Incremental, order-dependent application (Foundry).** The engine sorts by `priority` and admits "priority overrides all other considerations … Any alteration of this can however completely break how users use changes" ([apply-changes.mjs L30–L37][fvtt-apply]). The help tells users priority is "Usually … best left untouched" ([Changes.md][fvtt-help-changes]). Skill ability modifiers need `priority: -10` because "Stat buffing items don't work correctly without this" ([base-character-model.mjs L1840–L1850][fvtt-skillchanges]). The changelog lists repeated stacking regressions: "Non-stacking bonuses stacked with each other" (#1749), "Racial and circumstance modifiers didn't stack", "Allowed circumstance bonuses to stack by default" (#1287), and "Changes targeting critical confirmation would incorrectly stack regardless of bonus type" (#3757) ([CHANGELOG.md L477, L1252, L2310, L4674][fvtt-changelog]).
2. **Typed penalties depend on order (Foundry, from reading the code).** For a non-stacking type, the first change applies at its full value, and the stored best becomes `max(0, value)`. A −2 morale followed by a +2 morale nets 0. The reverse order nets +2 ([change.mjs L526–L540][fvtt-change-apply]; override init at [actor.mjs L500–L512][fvtt-overrides]). The rules say "most penalties do stack" and "penalties and bonuses generally stack with one another" ([glossary][r-gloss]).
3. **Stacking keyed on the wrong grain.** Enhancement to armor and enhancement to a shield must both apply. Foundry gets this right by making armor, shield and natural armor separate targets, so stacking groups by (target, type) ([base-character-model.mjs L3590–L3646][fvtt-ac]). Roll20 has parent targets (`ac` → `touch`, `flatfooted`, `cmd`; `attack` → `melee`, `ranged`, `cmb`; `saves` → `fort`, `ref`, `will`) and must subtract same-type parent bonuses from the child to avoid double counting ([PFBuffs.js L38–L46, L644–L659][r20-buffs-affect]).
4. **Logic outside the pipeline goes missing from breakdowns and buffs.** Dex-to-AC ("TODO: Move to actual changes") and the wound-threshold skill penalty ("BUG: This does nothing since the penalty is calculated independent of the change system") ([base-character-model.mjs L2189, L2507][fvtt-dexac]).
5. **Aggregate class records lose rule-relevant history.** These include the per-level FCB choice, the per-level ability increase, which class was 1st level (for max HP), and HP rolls (Foundry, Roll20). PCGen recalculates skill points when history is missing ([PCLevelInfo.java L128–L137][pcgen-levelinfo]).
6. **Temporary and permanent bonuses differ.** Ability increases lasting a day or less "give only temporary bonuses", and longer ones count fully, including retroactive skill ranks and HP ([ability scores][r-abl]). Foundry encodes this with a separate type `untypedPerm`, "Untyped (Permanent)", which also writes the ability's `base` ([base-character-model.mjs L3352–L3362][fvtt-ac]). PCGen has a retroactive-skill-points toggle ([rules.lst L48][pcgen-rules]).
7. **Rounding with multiple classes.** Per-class floors versus fractional sums (above). Foundry's HP code carries "HACK: Do not allow decimals … May cause incorrect values with multiclassing" ([base-character-model.mjs L2324][fvtt-health]).

## Implications for `docs/pf-character-sheet-data-model.md`

### Keep

- **Catalog entry plus sheet entry, with modifiers only on the catalog entry.** This is the Foundry item-in-actor and Hero Lab thing/pick pattern ([picks][hl-picks]).
- **Never store totals, and use a pure resolver.** Every surveyed tool recomputes. Foundry's main bugs come from the *incremental* way it recomputes, not from recomputing at all.
- **Bonus type → stacking rule as a lookup table**, a `suppressed` breakdown, and `base` for the base-scores entry (Foundry and PCGen both model rank, armor and base values as type `base`).

### Change

- **Racial bonuses should stack.** Move `racial` to `stack`: the rules list it as an exception ([glossary][r-gloss]), and Foundry and PCGen both stack it.
- **Penalties.** Replace "worst penalty per type" with: negative values sum, subject only to the same-source rule. That is the rules default ([glossary][r-gloss]) and Roll20's behaviour. If a typed-penalty exception is ever needed, put it on the stacking table per type instead of making it the general rule.
- **Same-source grain.** The doc says "two sheet entries of one catalog entry count as two sources". The rules say identical spells "usually do not stack with themselves" and that "only the one with the highest strength applies" ([magic][r-magic]). So the source key should be the **catalog entry** (or an explicit `sourceKey`), not the sheet entry. None of the surveyed tools implements this, so it needs its own tests.
- **Group by (leaf target, bonus type).** Stacking groups must use the *leaf* target, and armor, shield and natural armor must be separate targets. Resolve a parent target like `ac`, `attack` or `saves` into its leaves *before* stacking, so a bonus to the parent and a same-type bonus to the child compete instead of both applying (Roll20 trap 3).

### Add

1. **Class levels as ordered per-level entries**, PCGen-style, instead of one record per class with a count. Each class-level sheet entry holds: class catalog ref, character level ordinal, class level, HP gained (roll or average), FCB choice (`hp` / `skill` / `alt`+note), ability increase (if the level grants one), skill ranks spent at that level, and feat/trait choices made at that level. The rules fix FCB and ability choices per level ([advancement][r-adv]), so this is the faithful grain. Aggregates (class level, HD, FCB totals) are then derived, which avoids Foundry's "first class in sort order" problem. It also replaces the doc's `levelUp` modifier entries with a single level-history row each.
2. **Built-in (synthetic) modifiers from rules state.** The resolver should emit BAB, base saves, HP per level, ability mod → dependent stat, skill rank (`base`), class skill +3 (once, not per class), size and armor check penalty as `SourcedModifier`s with a synthetic source. The breakdown and suppression UI then treats them like any item bonus (Foundry `MetaChange` with `builtIn: true`, [base-character-model.mjs L1642–L2300][fvtt-skillchanges]). Dex-to-AC should be one of them, unlike Foundry (trap 4).
3. **Staged resolution, not priorities.** Fixed stage order: ability scores → ability modifiers → class-derived bases (BAB, saves, HD) → everything that reads modifiers (AC/touch/flat-footed/CMD, CMB, saves, skills, HP). Each stage groups and picks. No user-visible priority field.
4. **Per-class progressions in the class catalog entry**: hit die, BAB progression, the three save progressions, skill ranks per level, class skills, and a class kind (`base`/`prestige`/`npc`/`racial`). Compute floors per class and sum; prestige saves use their own formula (Foundry [config.mjs L213–L241][fvtt-babsave]). Treat fractional bonuses as a later option.
5. **AC as components plus fan-out.** Targets `ac.armor`, `ac.shield`, `ac.natural` and `ac` (general), with touch, flat-footed and CMD derived by bonus type per the combat rules ([combat][r-combat]; Foundry [L3553–L3662][fvtt-ac]). Extend `BonusType` with `armor`, `shield`, `naturalArmor`, `deflection`, `dodge`, `competence`, `resistance`, `trait`, and probably `haste` (Foundry's list: [config.mjs L1634–L1655][fvtt-bonustypes]).
6. **A permanence flag** (`temporary` versus `permanent`) on modifiers, or derived from entry kind, so Int and Con bonuses only feed skill-rank budgets and HP when permanent (trap 6).
7. **Slot pools for feats and traits, advisory only.** General feats (`ceil(level / 2)`), class bonus-feat pools with a type filter (PCGen's typed `ABILITYCATEGORY`), traits (2), and FCB per favoured-class level. A feat sheet entry may point at the slot it fills, but nothing blocks (AGENTS.md "Validation Philosophy").
8. **Skill-rank budget and cap as derived warnings.** Σ per class level `max(1, ranks + Int mod)` + FCB skill + racial (human +1), cap = total HD ([skills][r-skills]). Storing ranks per level entry (item 1) makes "ranks spent at level N" checkable. Otherwise store a per-skill total, as Foundry does.
9. **Later: formula-valued modifiers.** Many effects scale with level, for example "+1 per 4 levels". Foundry's `formula` field covers this ([change.mjs L37][fvtt-change-schema]). Not needed for the first slice, but keep `value: number` open to becoming `number | formula`.

[fvtt]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/tree/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc
[fvtt-apply]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/utils/apply-changes.mjs#L19-91
[fvtt-highest]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/utils/apply-changes.mjs#L223-262
[fvtt-change-schema]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/models/components/change.mjs#L33-46
[fvtt-change-apply]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/models/components/change.mjs#L500-540
[fvtt-dodge]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/models/components/change.mjs#L507
[fvtt-overrides]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/documents/actor.mjs#L500-512
[fvtt-featcount]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/documents/actor.mjs#L2015-2075
[fvtt-class-schema]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/models/item/class-model.mjs#L42-84
[fvtt-class-prep]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/models/item/class-model.mjs#L324-372
[fvtt-class-bab]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/models/item/class-model.mjs#L374-395
[fvtt-register]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/models/item/class-model.mjs#L402-447
[fvtt-link]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/models/components/link-model.mjs
[fvtt-item-assoc]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/documents/item.mjs#L401-420
[fvtt-skill]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/models/item/skill-model.mjs#L33
[fvtt-skillbudget]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/applications/actor/abstract/base-character-sheet.mjs#L856-895
[fvtt-skillchanges]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/models/actor/abstract/base-character-model.mjs#L1642-2300
[fvtt-saves]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/models/actor/abstract/base-character-model.mjs#L1677-2040
[fvtt-health]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/models/actor/abstract/base-character-model.mjs#L2302-2420
[fvtt-dexac]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/models/actor/abstract/base-character-model.mjs#L2507-2540
[fvtt-cmb]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/models/actor/abstract/base-character-model.mjs#L2619-2632
[fvtt-ac]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/models/actor/abstract/base-character-model.mjs#L3336-3662
[fvtt-levelup-commit]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/applications/level-up.mjs#L1207-1300
[fvtt-levelup-abl]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/applications/level-up.mjs#L1401-1470
[fvtt-ablincr]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/config.mjs#L83-89
[fvtt-classtypes]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/config.mjs#L159-165
[fvtt-babsave]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/config.mjs#L189-241
[fvtt-frac]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/config.mjs#L245-275
[fvtt-feattypes]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/config.mjs#L1432-1439
[fvtt-bonustypes]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/config.mjs#L1634-1655
[fvtt-stacking]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/config.mjs#L1660-1662
[fvtt-fctypes]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/module/config.mjs#L2460
[fvtt-help-changes]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/help/en/Items/Changes.md
[fvtt-optional]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/help/en/Rules/Optional.md
[fvtt-changelog]: https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/b0d719e1e2d1111eb863555db60d0cbbf6cc64bc/CHANGELOG.md
[pcgen]: https://github.com/PCGen/pcgen/tree/adc7fb977ad414ccb5ff61baa5fed6f428d065fd
[pcgen-misc]: https://github.com/PCGen/pcgen/blob/adc7fb977ad414ccb5ff61baa5fed6f428d065fd/system/gameModes/Pathfinder/miscinfo.lst#L17
[pcgen-level]: https://github.com/PCGen/pcgen/blob/adc7fb977ad414ccb5ff61baa5fed6f428d065fd/system/gameModes/Pathfinder/level.lst#L9
[pcgen-rules]: https://github.com/PCGen/pcgen/blob/adc7fb977ad414ccb5ff61baa5fed6f428d065fd/system/gameModes/Pathfinder/rules.lst#L48
[pcgen-fighter]: https://github.com/PCGen/pcgen/blob/adc7fb977ad414ccb5ff61baa5fed6f428d065fd/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_classes.lst#L139
[pcgen-fighter-lvl]: https://github.com/PCGen/pcgen/blob/adc7fb977ad414ccb5ff61baa5fed6f428d065fd/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_classes.lst#L142-L143
[pcgen-abcat]: https://github.com/PCGen/pcgen/blob/adc7fb977ad414ccb5ff61baa5fed6f428d065fd/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_abilitycategories.lst#L21-L88
[pcgen-fcb]: https://github.com/PCGen/pcgen/blob/adc7fb977ad414ccb5ff61baa5fed6f428d065fd/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_abilities_class.lst#L68-L94
[pcgen-awards]: https://github.com/PCGen/pcgen/blob/adc7fb977ad414ccb5ff61baa5fed6f428d065fd/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_abilities.lst#L437
[pcgen-bonusdoc]: https://github.com/PCGen/pcgen/blob/adc7fb977ad414ccb5ff61baa5fed6f428d065fd/docs/listfilepages/globalfilestagpages/globalfilesbonus.html
[pcgen-levelinfo]: https://github.com/PCGen/pcgen/blob/adc7fb977ad414ccb5ff61baa5fed6f428d065fd/code/src/java/pcgen/core/pclevelinfo/PCLevelInfo.java#L38-L137
[pcgen-levelinfo-write]: https://github.com/PCGen/pcgen/blob/adc7fb977ad414ccb5ff61baa5fed6f428d065fd/code/src/java/pcgen/io/PCGVer2Creator.java#L870-L962
[pcgen-skillsave]: https://github.com/PCGen/pcgen/blob/adc7fb977ad414ccb5ff61baa5fed6f428d065fd/code/src/java/pcgen/io/PCGVer2Creator.java#L309-L321
[hl-picks]: https://hlkitwiki.wolflair.com/index.php?title=Picks
[hl-eval]: https://hlkitwiki.wolflair.com/index.php?title=Evaluation_Cycle_Basics
[hl-macros]: https://docs.google.com/spreadsheets/d/1n2a-RlfV6-W4tS_GQR7e4pi8aDIxsEX3gITJEJPgoSM/edit
[r20]: https://github.com/Roll20/roll20-character-sheets/tree/4a4fe30bf4f75790e2d47b130c7fef4dd4f7a4a2/Pathfinder%20Community/dev/src
[r20-buffs-types]: https://github.com/Roll20/roll20-character-sheets/blob/4a4fe30bf4f75790e2d47b130c7fef4dd4f7a4a2/Pathfinder%20Community/dev/src/PFBuffs.js#L26-L31
[r20-buffs-affect]: https://github.com/Roll20/roll20-character-sheets/blob/4a4fe30bf4f75790e2d47b130c7fef4dd4f7a4a2/Pathfinder%20Community/dev/src/PFBuffs.js#L38-L659
[r20-buffs-stack]: https://github.com/Roll20/roll20-character-sheets/blob/4a4fe30bf4f75790e2d47b130c7fef4dd4f7a4a2/Pathfinder%20Community/dev/src/PFBuffs.js#L112-L113
[r20-classgrid]: https://github.com/Roll20/roll20-character-sheets/blob/4a4fe30bf4f75790e2d47b130c7fef4dd4f7a4a2/Pathfinder%20Community/dev/src/PFClassRaceGrid.js#L11-L151
[r-gloss]: https://www.d20pfsrd.com/basics-ability-scores/glossary/
[r-adv]: https://www.d20pfsrd.com/classes/character-advancement/
[r-skills]: https://www.d20pfsrd.com/skills/
[r-combat]: https://www.d20pfsrd.com/gamemastering/combat/
[r-magic]: https://www.d20pfsrd.com/magic/
[r-abl]: https://www.d20pfsrd.com/basics-ability-scores/ability-scores/
