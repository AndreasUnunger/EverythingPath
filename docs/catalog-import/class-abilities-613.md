# Class abilities #613: Bonus Feats (MVP launch subset, #596 run B)

MVP launch subset of #613: this inventory curates only pf1/CV8BsY3ciUb9TA1Y (Bonus Feats); the ticket's other 99 keys stay remaining acceptance under #613. The 99 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-613.json`](../../scripts/catalog/legal/class-abilities-613.json)) and stay this ticket's acceptance.

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
