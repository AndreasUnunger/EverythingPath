# Canonical militia setup (#87)

`/canonical-setup?campaign=<campaign>` lets campaign members initialize either a
new militia or an existing table's militia. The route and its Convex endpoints
use the existing owned-preview isolation gate. Live campaigns remain on their
current workflow until the approved cutover.

Both starting points submit the same canonical setup contract and use one
atomic initializer. New values begin at rank 1, training 0, 10 gp and zero
Notoriety, with a selectable focus. Existing values may depart from the rules;
rank/training, treasury, Notoriety, PC-level caps, and roster
warnings are advisory. Structural errors and foreign references block saving.
The form uses React Hook Form and Zod with styled field errors, including
separate missing-value and malformed-number messages.

Setup carries the roster and individual team conditions, character Hit Dice,
officer assignments and managers, settlements, assets and orders, persistent
event targets/order, queued effects, bonuses, buyoff bookkeeping and explicit
first-use/day/week context. Characters are selected from the campaign ledger;
the server checks membership and the reviewed character facts. Numeric week
position never determines whether Upkeep is skipped. The selected opening
Phase View is local to the browser and does not move other players.

Initialization creates the canonical source and one empty revision-zero Weekly
Draft, with fixed Persistent Phase Eligibility. It neither resolves Upkeep nor
consumes carry, charges costs, receives orders, or advances the week. A retained
initialization receipt makes identical retries safe even after edits or
Confirmation. Different initialization requests cannot reset an established
source. Setup notes remain visible in the Workspace after advancement.

The regular Workspace query, editing adapter, Rules Projection, Confirmation,
and successor lifecycle take over immediately. Existing legacy militia data is
left intact on the isolated path. The separate paused-cutover preflight in
`convex/lib/campaignInitialization.ts` still owns preservation and review of
existing application storage; this onboarding form is not a migration runner.

## Verification

Observable tests cover defaults, preservation, initialization retries, ordinary
player Confirmation, reference rejection, the live-activation gate, form input
errors, advisory deviations and independent Phase Views. The rules catalog
maps these under F01 and P11. `e2e/support/setup-workspace.ts` extends the existing
canonical Workspace journey with both setup modes, shared edits and player
Confirmation; it reuses the existing authenticated contexts and owned fixture
reset/cleanup used by the onboarding and ledger journeys.

Local verification passed: `pnpm -s typecheck`, `pnpm -s lint`, and
`pnpm -s rules:check` (933 tests across 98 files; 388 covered rule cases,
287 explicitly recorded gaps, zero catalog errors). Standards and specification
reviews reported no remaining material findings.

The mandatory browser gate passed on isolated preview
`e2e-local-andreasununger-slot-0`, run `everythingpath-e2e-0YkMlY`.
Tablet and phone setup screenshots were reviewed, including long character
names and populated carried-state fields. Control bounds, both setup modes,
shared editing, player Confirmation, existing journeys, and persistence and
Confirmation contracts passed. Live activation remains gated.
