# Note curation operators

`catalog:curate` drafts content-bound records; `catalog:preview` applies them and evaluates coverage together with attribution admission. This workflow prepares catalog content locally. It does not publish a release or change a Character Sheet.

## Commands

Use clean checkouts at the catalog pins. Both commands verify Git identity and the manifests. `--allow-unverified-checkouts` is the explicit fixture/development override; reports record it and it does not bypass either coverage or attribution admission.

```sh
pnpm -s catalog:curate --system /path/to/pf1 --content /path/to/pf1-content --out /tmp/note-drafts
pnpm -s catalog:preview --system /path/to/pf1 --content /path/to/pf1-content --curation /tmp/note-drafts/records.json --out /tmp/catalog-preview
```

The default input overlay is [`scripts/catalog/reviewed-curation.json`](../../scripts/catalog/reviewed-curation.json), beside reviewed identity remaps. It is deliberately empty until content batches contribute their records. An alternative file is supplied with `--records` to the drafter or `--curation` to preview. Commands reject source-overlapping output paths, unrelated output files and symlink report files before writing. A drafter can resume into the same directory when its `--records` is exactly that directory's regular `records.json`.

The drafter writes `records.json` and `curation.json`; extraction errors and malformed records write no new reports. Its successful exit means drafting completed, even if diagnostics remain. Preview writes `catalog.json`, `comparison.json`, `unsupported.json`, `curation.json` and `admission.json` before exiting nonzero for a coverage/admission failure. Named attribution holds remain holds; missing curation fails even when the content is held for attribution.

## Record contract

A record has `externalKey`, `kind`, `target`, `text`, `textSha256`, `status`, `outputs`, `rationale`, `diagnostics` and `seedBindings`. The strict schema and inferred TypeScript types live in [`scripts/catalog/curation.ts`](../../scripts/catalog/curation.ts). Identities use the reviewed remap's retained external key before matching. Repeated text on another entry never shares a record.

- `note` binds the Foundry target and exact raw note string, before sanitization. `textSha256` is SHA-256 of those UTF-8 bytes.
- `conditional` binds `actionId` and `conditionalId`, the ordered Foundry `target/subTarget` values, and the entire serialized conditional (name, formula, critical mode, damage type and other mechanics). The exact serialized payload is stored as `text`; its hash is calculated the same way. Reordering actions with stable IDs preserves bindings. A record without IDs falls back to position, so reorder requires fresh drafts.
- `itemAbility` binds the exact raw imported description, even when the ability has no notes or conditionals. Helper seed dependencies retain their own complete bindings, so changed helper mechanics invalidate a seeded draft even when the ability's description stays the same.
- `description` binds the raw description but belongs to the separate prose pass, outside the required note gate.

The output list contains strict discriminated variants:

| `kind`        | Output                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modifier`    | Closed runtime target/bonus type, finite number or `{ formula }`, optional condition and `stacksWithinEntry: true`.                                                       |
| `note`        | Plain text for rules not represented by structured output, optional closed target and Situation; absent target means entry-level text.                                    |
| `itemAbility` | `bonusEquivalent`, `damageDice` (`dice`, `on: hit/crit`, `damageType`, optional Situation), `doublesThreat`, `weaponDamageTypes`, `choice: creatureType`, or `sourceKey`. |

Modifiers append to the entry's `modifiers`; Notes append sanitized plain text to `situationalNotes`. Foundry inline-roll delimiters and roll commands are removed, and formula references become readable labels (for example `+[[@resources.rage]]` becomes `+rage`); no expression is executed. Item Ability mechanics enrich `detail.kind: itemAbility`, using the data model's names, and damage dice from multiple outputs are preserved in order. Structured Item Ability mechanics do not produce duplicate description Notes; only uncovered nonnumeric rules remain Notes. `sourceKey` belongs to the common entry. Weapon/action Modifiers use `condition.weapon: '$self'`. A Modifier without a weapon condition, such as Shadow's Stealth bonus, follows the active item. The existing sheet resolver consumes the numeric/formula Modifier shape; attack and Item Ability consumers implement their model-specific weapon/dice/choice behavior in their own tickets.

An intentional `outputs: []` means explicit covered/no-output, with a nonempty rationale explaining what other record supplies the behavior. A prose draft that cannot be parsed can also have no outputs, but its review diagnostic means it is pending review rather than deliberately covered. Duplicate bindings, unknown output properties/targets/bonus types, mismatched text hashes and malformed review metadata are rejected. Unresolved numeric/action/helper Notes use the reserved text `Review required: replace this placeholder with readable rules text or structured outputs.` instead of raw mechanics or serialized conditionals. Checking a record or removing its diagnostics while that placeholder remains is rejected; replace the output with readable rules text, structured mechanics or deliberate covered/no-output first.

Both `drafted` and `checked` records apply under #228. The #303 workflow adds a conservative exception: drafted records carrying any diagnostic contribute no output until checked. Each diagnostic has `{ kind: 'unresolved' | 'review', text }`; its wording does not determine behavior. `checked` requires `reviewedBy` and a valid `reviewedOn` date. Check against the imported description and record the reason; this is distinct from the Attribution Assessment and does not establish permission or book-level attribution. Only checked records may set `stacksWithinEntry`. The drafter flags “stacks with” for review and never sets it itself. Curation status remains operator data.

Shared Situations are declared in `situations` with `key`, `label`, exact case-insensitive `aliases`, reviewer and date. Only those reviewed aliases map automatically; ambiguous/new wording stays local. Unknown shared keys are rejected, including keys in Item Ability dice. Keys are flat and imply nothing else. Promote a local Situation deliberately when a second entry names it.

## Draft, review and resume

The parser handles leading inline/plain numeric notes, several numeric clauses, multi-situation notes, recognized targets, granting-class formulas, readable prose Notes, action numeric conditionals, and bounded Item Ability patterns. The named Common Conditional Modifiers and Weapon Enchant Conditional Modifiers helpers remain excluded from catalog entries and the coverage requirement. The second helper supplies seeds to abilities matched by name; hit/critical dice remain distinct.

Conservative drafts preserve candidate outputs and diagnostics for mechanics the parser cannot complete, but diagnosed drafts do not apply them. Metadata such as an ability's price never covers an unparsed numerical effect. Target-dependent helper abilities require an operator to provide their Situation/choice rather than applying unconditional damage. Unsupported note formulas retain runtime-shaped candidate contributions, with readable Note text and a review diagnostic. The draft is held until checked; once checked, its unsupported formula warning remains and the formula contributes nothing, preserving #228's runtime behavior. The closed parser is reused; no Foundry expression is executed. Rewrites beyond supported variable mappings, such as complex `if(gte(...))` formulas, must be drafted into the closed arithmetic grammar by the operator.

The named Item Ability policies live in [`reviewed-item-ability-policies.json`](../../scripts/catalog/reviewed-item-ability-policies.json), beside the overlay. Each policy cites the exact offline pf1-content 11.4.0 data path, pinned commit and upstream book/page metadata, with a review rationale and date. The table supplies Speed's shared haste Source and the target-dependent helper holds. Draft rationales include the relevant citation. This parser-policy review used local pinned descriptions, without a network lookup or printed-book verification, and does not establish an Attribution Assessment or complete content review.

Read `diagnostics` and compare every output with the imported description. Complete or correct the outputs, clear resolved `unresolved` diagnostics, supply an explicit covered/no-output rationale where appropriate, and mark checked when reviewed. A diagnosed drafted record for a required note, conditional or ability fails coverage even though its binding exists and is not listed as missing. Checked records apply their outputs for either diagnostic kind; retained `review` diagnostics do not fail coverage, while retained `unresolved` mechanics still do. Prose-pass diagnostics appear in `unresolvedDescriptions` and remain outside the required gate.

Resume supplies the existing file:

```sh
pnpm -s catalog:curate --system /path/to/pf1 --content /path/to/pf1-content --records /tmp/note-drafts/records.json --out /tmp/note-drafts
```

Valid existing drafts, checks, rationales and outputs are retained. Only absent exact bindings are added. An unchanged rerun writes identical records and adds none. Changed source text/target produces a fresh record and the old binding is reported stale; it never applies. Changed helper seeds replace only the unusable seeded record, reporting `replaced` and resetting its status to drafted. Description/seed disagreements remain unresolved. Removed or retargeted records on present entries are stale; records for entries outside this import are `unused`, not falsely stale.

The prose-only pass visits description candidates containing “vs.”, “against” or “when”, independently of the note requirement:

```sh
pnpm -s catalog:curate --system /path/to/pf1 --content /path/to/pf1-content --records /tmp/note-drafts/records.json --descriptions --out /tmp/prose-drafts
```

It can produce ordinary overlay Modifiers. Unparsed or partially parsed prose receives a review diagnostic and no applicable draft output; it does not fall back to making the entire description a Note. Review and supply explicit outputs before checking it. Optional prose diagnostics do not turn a candidate into a missing-note failure. Reruns add only missing description bindings.

## Reports and the bounded demonstration

`curation.json` itemises `missing`, `stale`, `unused`, `applied` records by status, `unresolvedMechanics`, `unresolvedDescriptions`, and summary counts. `summary.required`, `drafted`, `checked` and `missing` count only required notes, action conditionals and Item Abilities. `summary.descriptions` reports optional prose candidates and their drafted/checked matches separately; prose diagnostics never fail the required gate. Held diagnosed drafts appear in the unresolved lists and matched status counts, but not in `applied`. Draft reports also list `added`, `replaced`, input verification/fingerprints and the canonical records fingerprint. Preview's admission report contains the coverage report and individual missing/unresolved failures; its extraction fingerprint covers applied outputs and curation report. A changed output therefore invalidates existing attribution content bindings.

[`tests/fixtures/curation`](../../tests/fixtures/curation/README.md) commits synthetic category fixtures, two real excluded helpers, initial drafts, the optional prose pass, fixture-only checked/no-output examples, gap-only resume, missing and covered preview reports, and the deterministic public import artifact. Observed command statuses and counts are in [`observed.json`](../../tests/fixtures/curation/observed.json). The tests exercise exact invalidation, raw sanitizer-equivalent changes, stable action IDs, identity remaps, partial resume, helper-only changes, schema rejection, unsupported formulas and real sheet calculation.

This establishes the workflow and bounded coverage gate for #303. It does not curate the upstream corpus, review real content records, complete per-entry attribution, or meet CRB launch review. The enumerated content batches own those steps and commit their own records and reports at each pin bump.

## Locally authored CRB conditions

The complete 34-condition batch has no Foundry pack/raw-note bindings. Its reviewed definitions, literal combination rules, explicitly unmodeled quantities, attribution/notice accounting and release fingerprint contract are documented in [conditions.md](conditions.md). Full-builder release preparation appends these candidates through `appendConditionResources`; `catalog:preview --conditions` applies the ordinary admission gate to them alongside upstream content. `catalog:conditions` reproduces the committed standalone condition admission report without upstream/network inputs. Static assessments reopen on changed content or supporting resources; neither command grants fresh approval automatically.
