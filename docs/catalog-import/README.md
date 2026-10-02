# Pinned Foundry catalog preview

Ticket [#253](https://github.com/AndreasUnunger/EverythingPath/issues/253) provides a local, deterministic extraction for inspecting the approved Foundry PF1 release data. It does not create a Catalog Release or admit definitions for player selection.

```sh
pnpm catalog:preview \
  --system /path/to/foundryvtt-pathfinder1 \
  --content /path/to/pf1-content
```

The system checkout must be clean at `v11.11` (`418761d2e16a6037c0156bb4a241f7cea5a2986d`), and the content checkout at `11.4.0` (`02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`). Both manifest versions must match the pins and share a major. The command checks the repository roots, commits, tracked/untracked input changes and ignored YAML files. It reads the manifests and recursive YAML records; it never runs Foundry, imports its configuration, fetches data, writes to the checkouts or contacts Convex.

The default `.catalog-preview/` directory is git-ignored. `--out /path/to/output` selects another empty directory or one containing only the three existing preview reports. An output directory cannot overlap either source checkout. The command writes:

- `catalog.json`: mapped entries and supporting resources, input content hashes, pin verification, remaps and counts.
- `unsupported.json`: entries with unmapped mechanics, unresolved references, custom source evidence and fields awaiting feature curation.
- `comparison.json`: every manifest/on-disk pack and every YAML record, with its extraction disposition and reason.

Each file is deterministic for the same inputs and mapping: no timestamps or absolute checkout paths appear in the artifacts. The source fingerprints cover the manifest and ordered YAML paths/bytes. These are preview input hashes, not the complete future Catalog Release manifest. A later release must also fingerprint mapping, curation, legal evidence and supporting resources under the publication contract.

For the committed reduced fixtures, explicitly permit an unverified source snapshot:

```sh
pnpm catalog:preview \
  --system tests/fixtures/catalog/pf1 \
  --content tests/fixtures/catalog/pf1-content \
  --allow-unverified-checkouts
```

That flag marks the artifact `inputVerification.status: "unverified"`; it does not bypass manifest version checks or grant release admission. A successful exit means extraction completed. Inspect `comparison.coverageComplete` and the reports: extraction can succeed with unassigned records.

## Extraction interface and scope

The Node-only module at `scripts/catalog/import.ts` exposes:

```ts
importCatalog({ systemPath, contentPath, remaps })
// Promise<{ catalog, unsupported, comparison }>
```

It reads inputs and returns values without writes or deployment effects. Callers supply the reviewed remaps explicitly, using an empty array when none apply. The CLI loads `scripts/catalog/reviewed-remaps.json` and owns Git verification and output, reporting Catalog Entries and supporting resources separately. Keeping this module under `scripts/` prevents filesystem, YAML and HTML-parser dependencies from entering the application or Convex bundles. The runtime-independent JSON artifact is the seam available to future publication work.

The preview DTO is deliberately partial and is not the final `CatalogEntryDetail` database union. `detail.kind` names an extracted family; fields contain supported source mappings, and missing or uncurated facts are not asserted to be complete. Examples include class progression and feature references, spell class-tag levels, item weapon/armor details, spell-effect associations and creature-type seed data. `modifiers` use `target`, `bonusType`, and a numeric or validated formula-string `value`; no formula is evaluated during import. Unsupported formulas, targets, types and stage dependencies remain inert in `unsupported`. Spell definitions contribute no Modifiers. Handwritten target/skill mappings implement the project model without copying Foundry configuration.

The inventory in `scripts/catalog/inventory.ts` explicitly identifies every pack at both pins. `admitted` in these reports means **in scope for preview extraction**. The entire artifact has `purpose: "preview"` and `releaseAdmission: "not-evaluated"`. Neither a book citation nor a mapped record constitutes an accepted Attribution Assessment. All records still need the later attribution/notice, reference, note-overlay and feature-completeness gates before new selection. The importer flags all five known notice holds and does not resolve them: the Dynamite comics, Pathfinder Online: Thornkeep, PFS Scenario #4-12, Horror Realms (`PZO9297`), and Shattered Star #4 (`PZO9064`).

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

[`pinned-preview.json`](pinned-preview.json) records the observed full-checkout run: input verification/hashes, artifact hashes, per-kind/per-pack counts, exclusion reasons, unsupported categories and every unassigned record. The large complete artifacts remain local. [`tests/fixtures/catalog/README.md`](../../tests/fixtures/catalog/README.md) documents the real representative YAML records and intentional actor trims. Its `expected/` directory commits the pipeline's representative catalog and both reports. Fixture coverage is not full upstream coverage.

The pinned preview resolves 178 of 185 Spell Effect associations. Supporting both link syntaxes and removing parenthetical variant suffixes reproduces the earlier 177; comma inversion additionally matches “Greater Spell Immunity” to “Spell Immunity, Greater”. The report lists the seven unresolved effects, their proposed spell names where present, and the reason each still needs review.

`tests/catalog/import.test.ts` tests the extraction, inventory, mapping, sanitization, custom sources, remaps and deterministic artifacts through the import seam. `tests/catalog/preview.test.ts` spawns the operator command and checks argument errors, output handling, provenance and reproducibility. Run both with `pnpm test tests/catalog/import.test.ts tests/catalog/preview.test.ts`.

Later consuming features own full class schedules, prerequisites, casting tables, item abilities, conditional notes, companion progression, other structured resources and their coverage. Attribution review, the notice registry/legal page, immutable release preparation, publication and in-place sheet integration are separate work. This preview makes no claim of completed curation, complete upstream family coverage or legal sufficiency.
