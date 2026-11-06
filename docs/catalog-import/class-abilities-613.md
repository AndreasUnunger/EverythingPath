# Class abilities #613: Bonus Feats (MVP launch subset, #596 run B; Fast Movement (MNK), #631 wave A)

MVP launch subset of #613: this inventory curates only pf1/CV8BsY3ciUb9TA1Y (Bonus Feats (FGT)) and pf1/CK5L0YJDENqBxLqv (Fast Movement (MNK)); the ticket's other 98 keys stay remaining acceptance under #613. The 98 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-613.json`](../../scripts/catalog/legal/class-abilities-613.json)) and stay this ticket's acceptance.

| Key                                      | Disposition | Assessment | Required notices | Evidence                               |
| ---------------------------------------- | ----------- | ---------- | ---------------- | -------------------------------------- |
| `pf1/CV8BsY3ciUb9TA1Y` Bonus Feats (FGT) | admitted    | confirmed  | PZO1110          | `class-abilities-613-CV8BsY3ciUb9TA1Y` |

Its ten increments, `everythingpath/fighter-bonus-feats-{2,4,6,8,10,12,14,16,18,20}`, have no assessment of their own. Each has `attributionFrom: pf1/CV8BsY3ciUb9TA1Y` and that upstream key, so it takes this assessment, holds and notices and is admitted exactly when Bonus Feats is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

## #596 run B

This report belongs to run B of [#596](https://github.com/AndreasUnunger/EverythingPath/issues/596), after S3. Run B curates the Fighter class root (#596) and Bonus Feats (#613); the run report is [classes-596.md](classes-596.md). Reviewer: Sol (AI curator) for the owner, 2026-11-01. Sources: pf1 v11.11 (`418761d2`), the PRD capture `prd-2026-10-20` (`pages/coreRulebook/classes/fighter.html`, sha256 `80143dd3…`) and PCGen `25523dbc` (`core_rulebook/cr_abilities_class.lst`, sha256 `5e1035eb…`). No book PDFs; Archives of Nethys not used.

Full-corpus preview at the pins (`inputVerification: verified`): base `be92b07c` **120 admitted, 23,688 held, 165 dependent omissions, 1,761 failures**; with run B **131, 23,676, 166, 1,761**. Newly admitted: Bonus Feats and its ten increments. The Fighter moves from held to dependently omitted. Failures are identical.

## Evidence

- **Body:** [`packs/class-abilities/bonus-feats-fgt.CV8BsY3ciUb9TA1Y.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/bonus-feats-fgt.CV8BsY3ciUb9TA1Y.yaml) (sha256 `ab7655c67684…`), Core Rulebook p. 55.
- **PRD:** `fighter.html:380-381`. Both paragraphs are identical to the body after the heading, apart from Foundry's capitalised, emphasised "Combat Feats" where the PRD links "combat feats".
- **PCGen:** `cr_abilities_class.lst:893`, the Core Rulebook Fighter ~ Bonus Feats row. Its DESC reproduces both paragraphs, and `BONUS:ABILITYPOOL|Fighter Bonus Feat|FighterLvl/2+1` gives 1 + floor(level / 2) bonus feats, the schedule's count.
- **Grant:** Fighter level 1: Foundry classAssociations level 1 (`classes/fighter.WLqBCT5DqmGAx8Wd.yaml:42-43`); PCGen `ABILITY:Fighter Class Feature|AUTOMATIC|Fighter ~ Bonus Feats` at Fighter_CFP_Level 1 (`:257`); the PRD table's "Bonus feat" at 1st and every even level (`:357-376`).
- **Schedule through level 20:** bonus feats = 1 + floor(level / 2). Per level: 1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 4, 7: 4, 8: 5, 9: 5, 10: 6, 11: 6, 12: 7, 13: 7, 14: 8, 15: 8, 16: 9, 17: 9, 18: 10, 19: 10, 20: 11.

## Slots

- **The slot:** S3's reviewed rule (`scripts/catalog/pcgen/schedule-slots.ts:35-38`, printed at `fighter.html:380`) gives `{ kind: 'feat', count: 1, featTypes: ['Combat'] }` to the acquisition at 1st level and to each of the ten increments, 11 slots at 20th. Slots apply to the row whether or not the class is imported (`class-schedules.ts`), so a bounded import binds the same body.
- **No double slot:** Foundry's change `{ target: bonusFeats, formula: 1 + floor(@class.level / 2) }` has no mapped target. The importer keeps it as an unsupported `changes` field that contributes nothing (`scripts/catalog/map.ts`), and the entry has no Modifiers.

## Records

- `description` on `description` (`50ad6ce0…`), checked: one Note, the retraining paragraph: "Upon reaching 4th level, and every four levels thereafter (8th, 12th, and so on), a fighter can choose to learn a new bonus feat…". The first paragraph is the slots, so it adds no output.

The drafter wrote no required draft for this body, and the prose pass found no candidate (no "vs.", "against" or "when"). The description record is written and checked by hand, as every key needs one.

## Attribution

Complete CRB class feature (p. 55) compared with the PRD capture (coreRulebook/classes/fighter.html:380-381, identical apart from Foundry's capitalised "Combat Feats") and PCGen's Core Rulebook row (cr_abilities_class.lst:893). Granted at 1st level (PCGen :257; Foundry classAssociations level 1) and at every even level: S3's reviewed schedule gives the acquisition and its ten everythingpath/fighter-bonus-feats-N increments (2nd to 20th) one feat slot each, {kind: feat, count: 1, featTypes: ['Combat']} (scripts/catalog/pcgen/schedule-slots.ts, printed at fighter.html:380), and the increments take this assessment through attributionFrom. Foundry's bonusFeats change (1 + floor(@class.level / 2)) has no mapped target and contributes nothing, so the slots are not doubled. The Note states the feat retraining rule (4th, 8th, ... 20th), which stays prose; retraining and the slot-type warning stay outstanding calculations. Existing reviewed CRB notice covers it.

## Outstanding mechanics

- Feat retraining at 4th, 8th, 12th, 16th and 20th level — owner #716. The sheet has no retraining action; the Note states the rule.
- A feat of another type in a Combat slot warns rather than refuses — owner #313. The sheet warns, never refuses, on a feat whose type the slot doesn't name.

Calculations stay outstanding with their owners, never attribution holds. Combat tag fidelity belongs to the feat pool review, not this batch.

## Source discrepancies

- Foundry names the body "Bonus Feats (FGT)"; the PRD and PCGen name it "Bonus Feats". Recorded, not resolved.
- Foundry capitalises and emphasises "Combat Feats"; the PRD and PCGen read "combat feats". Recorded, not resolved.

## Cross-batch bindings and protected records

The Note is new curation on a body inside the Fighter's closure. The only assessment whose full-corpus content closure reaches Bonus Feats is the Fighter's (`pf1/WLqBCT5DqmGAx8Wd`, [classes-596.json](../../scripts/catalog/legal/classes-596.json), `tests/catalog/classes-596.test.ts`), which run B writes at the same time over the final records. A full scan of every assessment's closure found no other. Bonus Feats' own closure is the entry alone (`collectReferences` is empty), so no binding is re-bound.

## Binding

`currentBinding` and the assessment come from `buildAssessmentBinding` over the full-corpus `catalog:preview` of the final records (content `d3c231bfa758…`). The batch test re-extracts the entry from the shared store, checks it equals the committed [`tests/fixtures/class-abilities-613/preview.json`](../../tests/fixtures/class-abilities-613/preview.json) entry, re-binds it against the committed evidence and Registry, and runs the gate.

## Tests

[`class-abilities-613.test.ts`](../../tests/catalog/class-abilities-613.test.ts) uses run A's shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts), widened to take run B's review date. They cover the inventory and launch-subset statement; the pinned body, checked record, PRD lines and PCGen rows from the shared store; and a re-extraction and gate run with the binding re-built. They also check the batch's own rows. The test adds:

- the slot and the unmapped Foundry change;
- the ten increments in the Fighter's committed closure, each with its own Combat slot and attribution owner;
- the 1 + floor(level / 2) schedule against PCGen;
- both paragraphs against the PRD, with the retraining Note.

## Preservation and gates

The shared files gain only run B's entries: two description records, two assessments and two evidence entries (Bonus Feats and the Fighter), plus Weapon Training's re-bound assessment and evidence. No Registry, `held-notices.json`, `notice-clearances.json` or `section15-confirmations-716.json` change. Run B adds nothing to the shared store; [classes-596.md](classes-596.md) carries the count and the commands and their results.

## #631 wave A: Fast Movement (MNK)

This report belongs to #631 wave A (curation [#631](https://github.com/AndreasUnunger/EverythingPath/issues/631), increment parents wave A), which assesses ten class-feature parents across eight batches so that their 87 schedule increments admit with them. The run report is [class-abilities-631.md](class-abilities-631.md). Reviewer: Opus (AI curator) for the owner, 2026-11-04. Sources: pf1 v11.11 (`418761d2`), the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

| Key                                        | Disposition | Assessment | Required notices | Increments | Evidence                               |
| ------------------------------------------ | ----------- | ---------- | ---------------- | ---------- | -------------------------------------- |
| `pf1/CK5L0YJDENqBxLqv` Fast Movement (MNK) | admitted    | confirmed  | PZO1110, PZO1131 | 10         | `class-abilities-613-CK5L0YJDENqBxLqv` |

Its 10 increments (`everythingpath/monk-fast-movement-12`, `everythingpath/monk-fast-movement-15`, `everythingpath/monk-fast-movement-18`, `everythingpath/monk-fast-movement-6`, `everythingpath/monk-fast-movement-9`, `everythingpath/unchained-monk-fast-movement-12`, `everythingpath/unchained-monk-fast-movement-15`, `everythingpath/unchained-monk-fast-movement-18`, `everythingpath/unchained-monk-fast-movement-6`, `everythingpath/unchained-monk-fast-movement-9`) have no assessment of their own. Each has `attributionFrom: pf1/CK5L0YJDENqBxLqv`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Fast Movement (MNK) is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

### Fast Movement (MNK) (`pf1/CK5L0YJDENqBxLqv`)

- **Body:** [`packs/class-abilities/fast-movement-mnk.CK5L0YJDENqBxLqv.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/fast-movement-mnk.CK5L0YJDENqBxLqv.yaml) (sha256 `aad8cd57937f…`); Core Rulebook p. 59, Pathfinder Unchained p. 15.
- **PRD:** `coreRulebook/classes/monk.html:405`. Fast Movement (CRB): the body's second sentence is identical; its first reads "as seen below" where the PRD reads "as shown on Table: Monk". Its table is the Fast Movement column of Table: Monk (:357-376).
- **PRD:** `unchained/classes/monk.html:439`. Fast Movement (Pathfinder Unchained): as the CRB line, with "as shown on Table 1-2"; the table is the Fast Movement column of Table 1-2 (:375-394).
- **PCGen:** `pu_abilities_class.lst:466`. Pathfinder Unchained Unchained Monk ~ Fast Movement row: DESC is the PRD paragraph ("as shown on Table 1-2").
- **PCGen:** `cr_abilities_class.lst:1098`. Core Rulebook Monk ~ Fast Movement row: DESC summarises the rule ("+%1 feet enhancement bonus to your land speed").
- **Grant:** Granted at Monk level 3, Monk (Unchained) level 3: Foundry classAssociations; PCGen cr_abilities_class.lst:177, pu_abilities_class.lst:161. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Enhancement bonus to land speed by monk level = 10 ft. x floor(level / 3): +10 ft. at 3rd, +60 ft. at 18th (the body's table; the Fast Movement column of Table: Monk :357-376 and of Table 1-2 :375-394). Per level: 1: 0, 2: 0, 3: 10, 4: 10, 5: 10, 6: 20, 7: 20, 8: 20, 9: 30, 10: 30, 11: 30, 12: 40, 13: 40, 14: 40, 15: 50, 16: 50, 17: 50, 18: 60, 19: 60, 20: 60.
- **Increment names:** each checked against its class table row: `monk-fast-movement-6` "Fast Movement +20 ft." (`monk.html:362`, "+20 ft."); `monk-fast-movement-9` "Fast Movement +30 ft." (`monk.html:365`, "+30 ft."); `monk-fast-movement-12` "Fast Movement +40 ft." (`monk.html:368`, "+40 ft."); and the other 7 likewise.
- **Record:** `description` on `description` (`38b6de2a…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1110, PZO1131, each reviewed with no hold in force. PZO1110: Core Rulebook class feature Fast Movement (MNK) and the rules it applies (granted by Monk, Monk (Unchained)). PZO1131: Pathfinder Unchained class feature Fast Movement (MNK) and the rules it applies (granted by Monk, Monk (Unchained)).
- **Outstanding calculations** (never holds):
  - Enhancement bonus to land speed, 10 ft. x floor(monk level / 3) (Foundry change on landSpeed, imported unsupported) — owner #613. Speed is not a sheet statistic, so the description states it (docs/character-sheet/modifiers.md).
  - Loss of the extra speed in armor or with a medium or heavy load — owner #613. No armor/load condition; the description states it.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #613. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - Foundry names the body "Fast Movement (MNK)"; the PRD and PCGen name it "Fast Movement". Recorded, not resolved.
  - The body says "as seen below" and prints its own table where the PRD refers to Table: Monk (CRB) or Table 1-2 (PU); the table's six rows equal both tables' Fast Movement column. Recorded, not resolved; the table is the acquisition and its ten increments' names, so it adds no Note.
  - The body emphasises "enhancement bonus". Recorded; the text stays verbatim.
- **Binding:** content `8738b162de71…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

### Tests

[`class-abilities-613.test.ts`](../../tests/catalog/class-abilities-613.test.ts) adds a `describeIncrementParent` block for the new row. The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts), generalised in this run (`describeIncrementParent`): the inventory and launch-subset statement; the pinned body, checked record, PRD lines, PCGen rows, Foundry associations and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting the parent with exactly its increments (an edited body admits neither); and the batch's own rows. Its preview is [`tests/fixtures/class-abilities-613/binding-preview.json`](../../tests/fixtures/class-abilities-613/binding-preview.json); the run's `preview.json` is unchanged. The inventory keeps its earlier row, reviewer and date; the new row records its own (`reviewedBy`, `reviewedOn`).
