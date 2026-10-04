# Pinned Foundry catalog preview

Tickets [#253](https://github.com/AndreasUnunger/EverythingPath/issues/253), [#257](https://github.com/AndreasUnunger/EverythingPath/issues/257) and [#303](https://github.com/AndreasUnunger/EverythingPath/issues/303) provide local deterministic extraction, attribution admission and note-curation coverage reports for inspecting the approved Foundry PF1 release data. The command does not create a Catalog Release or publish definitions for player selection.

```sh
pnpm catalog:preview \
  --system /path/to/foundryvtt-pathfinder1 \
  --content /path/to/pf1-content
```

The system checkout must be clean at `v11.11` (`418761d2e16a6037c0156bb4a241f7cea5a2986d`), and the content checkout at `11.4.0` (`02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`). Both manifest versions must match the pins and share a major. The command checks the repository roots, commits, tracked/untracked input changes and ignored YAML files. It reads the manifests and recursive YAML records; it never runs Foundry, imports its configuration, fetches data, writes to the checkouts or contacts Convex.

The default `.catalog-preview/` directory is git-ignored. `--out /path/to/output` selects another empty directory or one containing only the preview reports below. An output directory cannot overlap either source checkout. The command writes:

- `catalog.json`: mapped entries and supporting resources, input content hashes, pin verification, remaps and counts.
- `unsupported.json`: entries with unmapped mechanics, unresolved references, custom source evidence and fields awaiting feature curation.
- `comparison.json`: every manifest/on-disk pack and every YAML record, with its extraction disposition and reason.
- `curation.json`: exact-bound missing/stale/applied/unused records, drafted/checked counts and unresolved mechanics. See [the curation operator runbook](curation.md) for `catalog:curate`, gap-only resume and the separate prose pass.
- `admission.json`: individually named admitted candidates, holds, dependent omissions, retained exceptions and failures, with input verification and fingerprints binding the report to its extraction, reviewed inputs and legal resources (OGL, Section 8, Paizo notice, project line and permanent notice superset). Outstanding required notices are reported explicitly.

Each file is deterministic for the same inputs and mapping: no timestamps or absolute checkout paths appear in the artifacts. The source fingerprints cover the manifest and ordered YAML paths/bytes. These are preview input hashes, not the complete future Catalog Release manifest. A later release must also fingerprint mapping, curation, legal evidence and supporting resources under the publication contract.

The numbered release's parsers fingerprint includes `src/lib/character-sheet.ts`: its shared schemas validate and shape imported definitions. Editing it therefore requires a new release number even when the normalized output is unchanged. See [the release runbook](releases.md) for the complete fingerprint categories and compatibility deployment requirements.

For the committed reduced fixtures, explicitly permit an unverified source snapshot:

```sh
pnpm catalog:preview \
  --system tests/fixtures/catalog/pf1 \
  --content tests/fixtures/catalog/pf1-content \
  --allow-unverified-checkouts
```

That flag marks the artifacts `inputVerification.status: "unverified"`; it does not bypass manifest version checks or grant release admission. A successful exit means extraction completed and the admission and curation gates passed. Named holds, including reopened accepted assessments and missing or unreviewed notice requirements, do not fail the gate. Duplicate identity, broken structure/reference, unaccounted inventory, missing note/action/Item Ability records, unresolved required curation mechanics and retained-exception reconciliation failures fail the gate. A final admission invariant also fails any admitted candidate lacking required reviewed notices. Admitted content must have a current accepted assessment and all required reviewed notices. An admission failure still writes all five reports and exits nonzero; an extraction or argument error writes no new reports. Inspect `comparison.coverageComplete` as well: this preview is not the complete release-readiness gate.

## Attribution admission

The default reviewed inputs live in `src/lib/catalog/data/`: content-bound Attribution Assessments, evidence and the Section 15 Registry. No accepted content assessments have been inferred from notice lists. A structurally valid, inventory-accounted candidate without an Attribution Assessment is held and listed individually with the reason `missing Attribution Assessment`, its identity and its missing evidence or notices. Explicit importer holds and unresolved assessments also remain held when their content or mapping changes.

An accepted assessment reopens as an individual hold when its content, identity mapping, evidence or notice bindings change. Missing, blank or revoked evidence, missing or unreviewed required notices, absent notice bindings and unidentified source notices also hold the candidate for review. The hold names the review gap, associated evidence IDs and missing notices; stale assessments never admit content. Unrelated reviewed candidates can still be admitted. Review can restore selection at the same stable identity. Changed linked content reopens its parent's whole-content comparison; otherwise accepted parents whose dependencies are held become reported dependent omissions. Inventory, structure/reference, duplicate metadata and retained-exception integrity failures remain release failures.

`--attribution /path/to/reviewed.json` evaluates an explicit reviewed input bundle for a local rehearsal. Its schema, `reviewedAdmissionSchema` in `src/lib/catalog/admission-schema.ts`, requires `assessments`, `evidence` and `registry`, and optionally `retainedUses` and `retainedExceptions`. Inputs are validated at the loading boundary before the gate runs. The input file cannot be inside the output directory. Synthetic test evidence is not shipping review evidence.

The pure `assessCatalogAdmission({ artifact, assessments, evidence, registry, retainedUses, retainedExceptions })` module in `scripts/catalog/admission.ts` evaluates both extracted entries and supporting resources. Its binding helper records the reviewed content, identity mapping, evidence and notices; it does not perform review or establish legal sufficiency. Reports keep source fields unchanged. Output names and fingerprints distinguish the complete extraction from the admission decision, and repeated identical inputs produce identical reports.

The legal-page builder in `src/lib/catalog/legal-page-data.ts` accepts explicit required notices, the persisted permanent notice superset, the selected registry and legal resources. Requirements come from the gate's admitted and retained content; held-only books do not become requirements for unrelated content. Unreviewed registry text is omitted from newly supplied notices and appears as `Notice review pending` when required. Missing text remains an outstanding notice. The owner-authorized project notice is exactly `Keepnet © 2026 Andreas Ununger`, included in Section 15. The owner-approved Section 8 wording (2026-10-03) designates only reproduced Pathfinder rules, mechanics and rules text identified as Open Game Content by their contributors; no other Keepnet content is Open Game Content.

[Private Catalog Release preparation](releases.md) now persists the gate's `requiredNotices`, the builder's returned `permanentNoticeSuperset`, registry and legal resources with each immutable numbered candidate. It preserves previously shipped notice versions and supplies the legal page through the active-release read. Committed defaults remain until an explicit activation selects a prepared release. #257 provides the input seam and local preview; #310 adds private preparation and inspection, while publication remains separate. A passing preview does not establish publication readiness.

The retained-use policy in `src/lib/catalog/retained-use-policy.ts` is exposed for subsequent Catalog Release and Character Sheet writers. This ticket does not create or modify Convex sheet tables, enforce selection writes, publish a release or activate content. Those writers must supply the complete prior-use inventory, preserve each last usable definition and invoke the retained-use policy before selections, copies, Grants or departure preservation.

The #257 registry records `reviewStatus` and provenance for unreviewed seed text; `checkedAgainst: "unreviewed"` or `"owner-transcription"` describes a seed's source without establishing reviewed coverage. The preview writes a separate `admission.json` report. Content assessment batches and outstanding notice corrections/reviews remain required before content can be admitted. The pure retained-use policy awaits enforcement by Catalog Release and Character Sheet writers after their tables land.

## Extraction interface and scope

The Character Sheet uses a small typed table for the thirteen editable creature-type progressions. The production `src/lib/catalog/data/resources.json` contains attribution resources, not creature-type records; the imported progressions currently live in pinned test fixtures and the Node-only importer. Importing the full fixture or parser into the client would add unrelated content or server dependencies. The import parity test checks each seed against its pinned resource. Stable creature-type tags identify choices; editable progression names use display names such as "Magical Beast". Older saved tags are shown as display names and save in that form, while custom names are retained.

The Node-only module at `scripts/catalog/import.ts` exposes:

```ts
importCatalog({ systemPath, contentPath, remaps, curation? });
// Promise<{ catalog, unsupported, comparison, curation }>
draftCatalogCuration({ systemPath, contentPath, remaps, curation?, descriptions? });
// Promise<{ records, situations, added, replaced }>
```

It reads inputs and returns values without writes or deployment effects. Callers supply the reviewed remaps explicitly, using an empty array when none apply. Optional curation data holds strict content-bound records and reviewed shared Situations; absent data means no records. The CLI loads `scripts/catalog/reviewed-remaps.json` and `scripts/catalog/reviewed-curation.json` by default, and owns Git verification and output, reporting Catalog Entries and supporting resources separately. The drafter uses the same inventory, loading and retained identity mapping to add only missing bindings. Keeping this module under `scripts/` prevents filesystem, YAML and HTML-parser dependencies from entering the application or Convex bundles. The runtime-independent JSON artifact is the seam available to future publication work.

The preview DTO is deliberately partial and is not the final `CatalogEntryDetail` database union. `detail.kind` names an extracted family; fields contain supported source mappings, and missing or uncurated facts are not asserted to be complete. Examples include class progression and feature references, spell class-tag levels, item weapon/armor details, spell-effect associations and creature-type seed data. Original extracted and curated `modifiers` use `target`, `bonusType`, and a numeric or validated `{ formula }` `value`. Curated Modifiers may also carry conditions; Notes populate `situationalNotes`, and Item Ability mechanics enrich `detail.kind: itemAbility`. No formula is evaluated during import. Unsupported formulas, targets, types and stage dependencies remain flagged in `unsupported`; curated unsupported formulas are retained for runtime warnings and contribute nothing. Spell definitions contribute no ordinary extracted Modifiers. Handwritten target/skill mappings implement the project model without copying Foundry configuration. See [the concrete curation contract](curation.md).

The inventory in `scripts/catalog/inventory.ts` explicitly identifies every pack at both pins. `admitted` in the extraction catalog and comparison reports means **in scope for preview extraction**. The extraction artifact retains `purpose: "preview"` and `releaseAdmission: "not-evaluated"`; the separate `admission.json` reports the attribution gate. Neither a book citation nor a mapped record constitutes an accepted Attribution Assessment. The preview now evaluates note-overlay coverage; records still need corpus curation, publication and feature-completeness gates before new selection. `scripts/catalog/legal/known-notice-holds.json` is the single source for the importer/gate's five known notice-hold groups: the Dynamite comics (including source codes `DYN0032-E`, `DYN0046-HC` and `DYN0010-A`), Pathfinder Online: Thornkeep, PFS Scenario #4-12, Horror Realms (`PZO9297`), and Shattered Star #4 (`PZO9064`). Matching does not depend on Dynamite publisher metadata being present. Stable upstream-key holds cover Thark Rifle, Radium Pistol and Radium Rifle, whose pinned descriptions cite Worldscape #2 without structured sources; their `sources` remain empty.

The six companion sources are included: system `companion-features` and content `pf-companions`, `pf-familiars`, `pf-companion-features`, `pf-eidolon-forms`, `pf-eidolon-evolutions`. Their actors, classes, attacks and features become supporting resources, not playable Character definitions. Actor-owned embedded game content remains attached to its resource and never receives a global identity. Creature-type records from `racial-hd` also remain resources.

Explicit exclusions include folders, goods/services, third-party and 3.5 packs, the ARG Race Builder folder subtree, and the two named conditional-modifier helpers. ARG exclusion follows folder ancestry, not `racePoints`: ordinary racial traits can have that field. All 12 generic natural attacks, including Swarm Attack, and Unarmed Strike are included by stable ID.

General monster actors/templates/template abilities may contain companion or cohort dependencies, so they remain unassigned pending review. Mixed collaboration, maladies, rituals and universal monster rules likewise remain visible as unassigned. The whole `pf-society` pack awaits an admission decision; its content records remain unassigned in the comparison report. Unknown directories, unexpected record types, undeclared packs and missing manifest packs prevent coverage from being complete. The importer never silently classifies a new family as excluded or complete.

Descriptions use a parsed HTML allowlist. Script/style/embedded content and unsafe attributes/URLs are removed; resolvable Foundry UUIDs become `catalog:<stable-key>` links, and unresolved targets become labels with report entries. Selected uncurated game fields and actor embedded items remain inspectable as inert report data; runtime command/script/macro/token/configuration fields are not exported. Custom sources retain their actual title and source evidence without inventing a product code. The `gameContent` warning deliberately includes partially mapped records so a missing feature mapping is not confused with complete rules support.

## Reviewed identity remaps

Keys are `<repo>/<_id>` (`pf1` or `pf1-content`), with pack and name stored independently. Upstream redirect tables are never loaded. The committed `scripts/catalog/reviewed-remaps.json` is initially empty because this first extraction has no previously published identities.

Each future record requires `from`, `to`, `kind`, `reason`, `evidence`, `reviewedBy`, and ISO `reviewedOn`. Two orientations are supported:

- A current upstream `from` to an absent historical `to` retains the historical output identity after a move or recreated ID.
- An absent historical `from` to a current `to` records an alias after a reviewed merge; several historical aliases may resolve to that one definition.

Entries, description links and mapped references resolve through the same identity map, including links that already contain a retained identity. Kind mismatches, duplicate origins, cycles/chains and attempts to combine two present definitions fail. Resolving competing live definitions requires explicit curation before supplying a remap. Unused remaps are reported as `applied: false`.

## Evidence and follow-on work

[`pinned-preview.json`](pinned-preview.json) records the observed full-checkout run: input verification/hashes, artifact hashes, per-kind/per-pack counts, exclusion reasons, unsupported categories and every unassigned record. The large complete artifacts remain local. [`tests/fixtures/catalog/README.md`](../../tests/fixtures/catalog/README.md) documents the real representative YAML records and intentional actor trims. Its `expected/` directory commits the representative catalog, inventory, unsupported and curation reports. Fixture coverage is not full upstream coverage.

[`admission-preview.json`](admission-preview.json) records the observed #257 fixture and pinned admission runs, regenerated after the owner's 2026-10-03 decisions, including reproducible commands, verification, fingerprints, artifact hashes, hold/failure groups and all individual known notice holds. Both commands exited 1. The fixture extracted 41 entries and 20 resources: 0 admitted, 41 held for missing assessments and 20 unresolved-reference failures. The verified pinned run extracted 23,037 entries and 538 resources: 0 admitted, 23,183 held and 1,107 failures. Holds comprise 23,151 missing assessments and 32 known notice holds: 16 Dynamite comics, 1 Thornkeep, 1 Refuge of Time, 7 Horror Realms and 7 Shattered Star #4. Failures comprise 715 unaccounted inventory records and 392 unresolved references. Neither run had dependent omissions or retained exceptions, and neither supplied a prior-use inventory. The complete reports individually identify every held and failed candidate in local preview artifacts; committed evidence retains their counts and the 32 known-hold rows. The reproducible commands use `$PF1_PINNED_CHECKOUT` and `$PF1_CONTENT_PINNED_CHECKOUT` for the clean full checkouts at the recorded tags and commits, and write to git-ignored `.catalog-preview/fixture` and `.catalog-preview/pinned` directories. The committed evidence contains no machine-specific paths.

These results establish that the gate holds unreviewed content, preserves explicit holds and reports existing extraction/reference gaps. They do not establish accepted attribution, complete source coverage or legal sufficiency. Content batches #264–#289 and the documented notice reviews remain necessary; runtime selection/departure enforcement and Catalog Release publication remain follow-on integration work.

The pinned preview resolves 178 of 185 Spell Effect associations. Supporting both link syntaxes and removing parenthetical variant suffixes reproduces the earlier 177; comma inversion additionally matches “Greater Spell Immunity” to “Spell Immunity, Greater”. The report lists the seven unresolved effects, their proposed spell names where present, and the reason each still needs review.

`tests/catalog/import.test.ts` tests the extraction, inventory, mapping, sanitization, custom sources, remaps and deterministic artifacts through the import seam. `tests/catalog/preview.test.ts` spawns the operator command and checks argument errors, output handling, provenance and reproducibility. Run both with `pnpm test tests/catalog/import.test.ts tests/catalog/preview.test.ts`.

The note-curation workflow now supplies the required record gate, bounded parser/Item Ability drafts and optional prose pass. Enumerated content batches own corpus execution and record review; later consuming features own full class schedules, prerequisites, casting tables, attack/Item Ability calculation, companion progression and other structured resources. Per-content attribution and notice review, immutable release preparation, publication and in-place sheet integration remain separate work. This preview makes no claim of completed corpus curation, complete upstream family coverage or legal sufficiency.

The prerequisite parser supports exact known class identities with ordinal level forms (`fighter level 4th`, `4th-level fighter`), standalone character levels (`4th-level`), and explicit alignment sets such as `any chaotic` or `any good`. `Requirements` headings and explicit worship requirements preserve their context: only deity names recorded in the source-evidenced list in `scripts/catalog/selection-import-rules.ts` become deity clauses; unknown region, faction and deity text, including nonliteral requirements such as “worshipper of one of the good gods”, remains readable prose. The representative Iomedae requirement is backed by the pinned A Shining Beacon fixture. Newly imported prerequisite atoms include `kind`; older stored atoms may omit it and are normalized when evaluated.

`selection-import-rules.ts` also holds the typed Additional Traits import rule, citing Advanced Player’s Guide p. 150. It supplies the feat’s NPC entitlement marker and two trait slots together. The importer does not infer these mechanics from arbitrary names or prose, and its unreviewed repeatability state is preserved.
