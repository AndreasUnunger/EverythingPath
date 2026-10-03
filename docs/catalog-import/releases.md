# Private Catalog Release preparation

Ticket [#310](https://github.com/AndreasUnunger/EverythingPath/issues/310) adds numbered immutable artifacts and private resumable preparation. These commands do not activate content, redirect active references, recalculate current Characters or change the initial migration's authority. Activation, affected-Character discovery and facts reconciliation belong to the later release tickets.

## Build the exact artifact

Use clean upstream checkouts at the pins documented in [the import runbook](README.md), reviewed attribution and curation inputs, and the required schema/calculation identities. The current calculation identity lives in [runtime-compatibility.ts](../../src/lib/catalog/runtime-compatibility.ts).

**Before first activation:** no Catalog Release has ever been activated, so the calculation compatibility identity is provisional. For an intentional calculator behavior change, review the change and its runtime dependencies. When calculator imports or reexports change, review new dependencies transitively and explicitly add any calculation implementation files to both `catalogCalculationV1Files` and the test's independent file list; update its exact import and reexport expectations as well. Keep the existing implementation files covered and the dependency assertions intact. Recompute SHA-256 using the unchanged algorithm in [catalogRuntimeCompatibility.test.ts](../../tests/catalogRuntimeCompatibility.test.ts): hash each path, a NUL byte, its exact file bytes and a NUL byte, in the explicit closure's order. In the same change, update the runtime pin, the test's independent literal expectation and current recorded expectations (including the build example below). Do not rewrite historical immutable artifacts or their observed evidence; any new preparation must use a fresh release number and the current identity. This procedure does not require a separate retained calculation implementation before first activation.

The current #312 identity includes racial rank contributions, creature-type class skills, HD-based feat warnings and prepared militia racial-HD facts. Its reviewed calculation file list and module import/reexport expectations remain unchanged. The new `character-sheet-creature-types.ts` table seeds recorded race progression through the prepared editor; the resolver calculates from those recorded fields and does not import the seed table. Import normalization also fixes playable races at zero racial HD, changing the parser inputs. Prepare a fresh numbered artifact for these changes; historical release evidence remains frozen. Weekly Resolution includes racial Hit Dice in militia Hit Dice only from Ruleset Version 10 onward; Version 9 keeps its Class-Level-based behavior. Reserved Version 10 stays inactive until the initial Character Sheet cutover.

**After first activation — deployment outage hazard:** the activated identity's implementation must be retained. The current runtime supports only its pinned v1 schema/calculation identities. `requireCompatibleActiveRelease` fails closed when a `catalogReleaseControl` row selects another identity; it does not retain or dispatch older calculation implementations. Deploying changed calculation code and a new identity while that control row still selects the prior identity can therefore make current sheet reads and writes unavailable. [#318](https://github.com/AndreasUnunger/EverythingPath/issues/318) and [#319](https://github.com/AndreasUnunger/EverythingPath/issues/319) must provide retained version dispatch and coordinated activation before such a deployment. After first activation, changing the identity alone does not make deployment safe, even if no release is currently active.

```sh
pnpm catalog:release build \
  --number 1 \
  --schema character-sheet-v1 \
  --calculation sha256:dc6fdd110c738d4b029221502a057c5282f8346c97189b333518e860f3ebe91a \
  --system /path/to/foundryvtt-pathfinder1 \
  --content /path/to/pf1-content \
  --artifact .catalog-preview/release-1/release.json
```

`--attribution`, `--curation`, `--remaps` and `--legal` select explicit reviewed JSON inputs instead of the committed defaults. `--previous` supplies the complete artifact of the authoritative active release when one exists. The number must increase beyond that comparison base. The backend checks the declared base number and artifact fingerprint against its actual active release, so a prepared private artifact cannot masquerade as an active comparison base. A fresh local directory does not grant reuse of a number already registered with the backend.

`--rule-resources PATH` supplies an array of `{ "key": "builtin:stable-name", "payload": ... }` supporting-resource records. Their structured bodies are frozen in the artifact, not merely hashed as input. The application's `convex/lib/representativeClassCatalog.ts` and `convex/lib/representativeRaceCatalog.ts` seed sources and definitions are always captured as `builtin:representative-class-catalog` and `builtin:representative-race-catalog`, with their source fingerprints and compatibility identities. These representative fixtures do not certify complete class or race curation, and capturing them as supporting resources does not admit them as new selectable content. The reviewed `scripts/catalog/reviewed-casting-tables.json` resource is always captured as `builtin:casting-tables`, including its complete cited table rows and casting-class metadata, source fingerprint and compatibility identities. It supplies seven shared families through level 20 plus adept, extract, Unchained summoner and occultist overrides; occultist availability is explicit while its choice-dependent known count stays unspecified. This supporting resource does not admit class definitions as selectable content. [Reviewed CRB conditions](conditions.md) are local selectable content supplied through `appendConditionResources` and the ordinary attribution/curation seam. Preview opts in with `catalog:preview --conditions`; `catalog:release build` has no conditions flag. A programmatic release build must explicitly append the candidates and fingerprint their `conditionReleaseResourcePaths` as documented in condition curation. New local content must use the attribution/curation import seam rather than disguising selectable definitions as authored resources.

The output directory must be empty or contain only its release artifact, and cannot overlap source inputs. Output is written only after the admission, curation, inventory/structure/reference and legal gates pass. Holds remain valid individually reported outcomes, including changed accepted assessments. A failing gate creates no release artifact. Repeating an identical build at the same path leaves identical bytes; changed inputs/output at that path fail without overwriting it. The immutable backend binding also rejects reuse across independent local directories.

The manifest fingerprints nine explicit input categories: upstream pins/content and verification, remaps, curation, local data/comparison provenance, importer/parser dependencies, sanitizers, rule resources, legal inputs and attribution. The local source graph includes the importer's mapping, formula, inventory/configuration and curation dependencies. The parsers fingerprint includes `src/lib/character-sheet.ts` because its shared schemas validate and shape imported definitions. Editing that file changes a declared release input and requires a new release number, even when the particular fixture's normalized output stays equal. Parser dependency identities also include the installed versions and exact relevant lock entries/integrities for YAML, parse5, its entities dependency and Zod. No whole-repository or whole-lockfile hash is used, and unrelated application changes do not alter a release.

Input fingerprints bind required schema and calculation identities and the exact active comparison base. Each deterministic batch has a SHA-256 fingerprint, row count and UTF-8 byte count; the output fingerprint commits the ordered batch descriptors. The artifact fingerprint commits the complete manifest excluding only its own fingerprint. The shared JSON validator and SHA implementation run in both Node and Convex; hashing uses WebCrypto's `crypto.subtle.digest('SHA-256', ...)` without filesystem or Node crypto dependencies.

Batches contain at most 100 rows and 512,000 canonical JSON bytes. The manifest allows at most 1,024 batches and 131,072 bytes. A single oversized row or manifest fails clearly before remote preparation. Row ordering and batching are deterministic; manual edits to an artifact are rejected by independent output verification before any remote call.

## Prepare, resume and inspect

Preparation uses Convex's installed administrative HTTP client, including the same internal-function seam used by its CLI. JSON travels in request bodies, so large records are not constrained by shell argument lengths. It never pushes code or runs codegen. Name the target explicitly, supply its matching URL, and read the deployment credential from a separate non-environment file. The command does not read `.env` files or infer a deployment from environment variables.

```sh
pnpm catalog:release prepare \
  --artifact .catalog-preview/release-1/release.json \
  --deployment-name your-preview \
  --deployment-url https://your-preview.convex.cloud \
  --target-kind preview \
  --admin-key-file /secure/path/convex-admin.key \
  --write-epoch 0

pnpm catalog:release inspect \
  --number 1 \
  --deployment-name your-preview \
  --deployment-url https://your-preview.convex.cloud \
  --target-kind preview \
  --admin-key-file /secure/path/convex-admin.key
```

Target kinds are `preview`, `development` and `production`; naming the target does not deploy or activate it. Follow the repository's deployment-selection and production-consent procedure when an agent is authorized to issue remote operations. This implementation's evidence executes no remote commands.

`begin` registers the immutable candidate against the active comparison base. `writeBatch` validates a complete bounded batch and its committed fingerprint before transactional writes. `finalize` requires the complete batch inventory, all five gate-certified report summaries and legal inputs. Only then does status become `prepared`. These operator writers use the general Write Gate class: after initial cutover they can prepare candidates under sheet authority while ordinary gameplay continues. Legacy Character writers remain fenced under sheet authority. A closed maintenance gate blocks every gated writer, including preparation, and stale epochs reject both classes. `--write-epoch` defaults to zero and is passed unchanged to every mutation; use the current open gate's epoch from authoritative migration status. The command never refreshes an epoch or replays a refused gameplay command automatically.

After interruption or a lost response, inspect the authoritative candidate, then rerun the same `prepare` command and artifact. Preparation resumes at the recorded next batch; exact batch retries and prepared retries are idempotent. An input/output change requires a manually incremented number and a new artifact. Candidate definitions/resources/remaps live in separate private rows and never enter ordinary pickers or current sheets. Workers cannot replace an existing number's manifest or write after it is prepared.

Inspect report or payload rows with a bounded page:

```sh
pnpm catalog:release inspect \
  --number 1 --kind report --limit 25 \
  --deployment-name your-preview \
  --deployment-url https://your-preview.convex.cloud \
  --target-kind preview \
  --admin-key-file /secure/path/convex-admin.key
```

Use the returned `continueCursor` as `--cursor` for the next page until `isDone`. Kinds are `definition`, `resource`, `remap`, `report` and `legal`; every page enforces row and byte read limits. Status inspection returns the immutable manifest, state, base release, next batch and staged counts.

## Committed reports and legal data

The artifact stages only newly admitted upstream definitions/resources and reviewed applied remaps, plus explicit authored supporting resources. It always contains five report summaries and individually keyed records:

- `content`: normalized added/changed/unchanged definitions, complete inventory records/pack coverage and unsupported details.
- `resources`: normalized upstream/authored resource changes and captured identities.
- `holds`: individual holds, dependent omissions, retained exceptions, failures/outstanding notices and the exact retained-required-notice certificate.
- `retirement`: held/removed prior identities and their last usable bodies, kinds and fingerprints. These bodies propagate across successive held/retired releases and never become new selections.
- `curation`: passed coverage, counts, missing/stale/applied/unused records and unresolved mechanics/description records.

The four legal rows persist `requiredNotices`, `permanentNoticeSuperset`, the exact Section 15 registry and legal resources. Notice versions are preserved by `(id,text)` across prior releases. Held-only books never become requirements for unrelated content. Each outstanding retained notice must be covered by the gate's per-code retained certificate; an unrelated exception count cannot authorize a missing notice. The public legal read selects these inputs only through a prepared active release and returns null when none exists. The frontend uses committed defaults for null or unavailable backend queries, so publishing the frontend before the backend does not interrupt the legal page. Preparation does not alter that public selection.

The readiness query checks the prepared candidate's required schema/calculation identities and active comparison base. It is a compatibility hook for later activation and does not claim that facts, discovery, frontend readiness or cutover are complete.

## Observed local evidence

The synthetic [command fixture](../../tests/fixtures/catalog-release/README.md) has one inert feat and a complete reduced inventory. Build it with the command above, substituting `tests/fixtures/catalog-release/pf1`, `tests/fixtures/catalog-release/pf1-content` and adding `--allow-unverified-checkouts`. This explicit flag records unverified source evidence in the manifest inputs and reports; it does not establish upstream provenance or attribution review.

[release-demonstration.json](release-demonstration.json) records the final observed artifact: 14 rows in one bounded batch, no admitted selectable definitions, one missing-assessment hold, one captured authored resource and four legal rows. The repeated local command produced identical bytes. Its hashes identify the historical #310 implementation state observed for that artifact; later calculator, parser or resource changes intentionally require a fresh numbered preparation.

The command-driver test injected failure at batch 1 of a 201-row, three-batch candidate, inspected next batch 1, resumed to exactly 201 rows and repeated preparation as a no-op. The script tests exercise the actual CLI build and the same preparation/inspection orchestration with an injected remote adapter. They also run the installed administrative client against mocked HTTP responses with a request body exceeding 128 KiB, prove fixed epoch propagation, and exercise bounded report inspection. The real reduced import fixture's gate failure leaves no artifact. These are isolated tests, not production preparation or activation.

Run `pnpm test tests/catalog/release.test.ts tests/catalog/release-command.test.ts tests/catalog/release-operator.test.ts convex/catalogRelease.integration.test.ts`. The Convex tests exercise the registered private commands against a representative active sheet, unchanged facts/review inputs and ordinary selection, including failed batches and retry isolation. Separate runtime compatibility tests pin the current calculation implementation. Later activation/reconciliation tickets own coherent publication; this work provides no activation mutation.
