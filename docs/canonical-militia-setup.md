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

Setup at `/campaigns/<id>/setup` is one form presented as nine freely
navigable steps (#172): Starting point, Week, People & officers, Teams,
Settlements, Character conditions, Assets, Carried effects and Review & start.
Moving between steps never validates or submits, and values stay in the form
while a step is closed. Each step shows its status (errors, then warnings, then
completion; Character conditions, Assets and Carried effects are optional for a
New militia). Review lists warnings by step and, after a start attempt, a
linked summary of blocking errors; only those errors block Start. Tablets show
a step index beside one detail pane, phones one list of rows with one open, and
desktops a wider index with previews. The step statuses, previews and summary
lines are derived in `src/lib/setup-steps.ts`; the form controller is
`src/components/militia-setup/use-guided-setup.ts`.

Unfinished setup resumes in the same browser (#173). A versioned envelope in
`localStorage` (`src/lib/setup-envelope.ts`) holds the raw form values,
including empty and malformed numbers, the open step, the visited steps and
the start attempt's `initializationId`. It is keyed and checked by the signed-
in account, the organization and the campaign, and it is read only after
`canonicalSetup.options` resolves. A stored envelope is restored only when its
lists and choices still fit the form; anything else is discarded with a short
notice. Restored roster characters take the ledger's current facts, so a
reload recovers from a stale-character rejection. When storage is refused,
Setup still works and says entries won't be kept. Nothing is saved to Convex
and there is no shared or mirrored setup draft.

`src/components/militia-setup/use-setup-session.ts` decides the page from the
first `options` result. A militia that had already started shows "This
militia is already set up." with **Open week N** (from
`canonicalDraftPersistence.workspace`) and **Open militia**, and retires any
stale envelope. If another member starts the militia while the form is open,
the envelope is retired and the page opens the current week. This player's own
start disables Start while pending, ignores the racing `started` observation
and opens the requested phase exactly once, then retires the envelope. Every
attempt, including one after a reload, reuses the envelope's
`initializationId`, so the server's same-ID/same-source idempotence and its
rejection of any other source keep an accepted setup from being replaced. A
failed start keeps all entries; if `options` then reports the militia started,
the page follows it. Leaving the page during a start never navigates the next
page. **Add character** in People & officers opens the shared character dialog
(`character.createCharacter`); the new record arrives through `options` and
joins the roster only when chosen.

Envelope version 1 stores this stage's character-record kinds
(`pc | officer_npc`), roster kinds (`pc | officer_npc | other_npc`) and
required commandant Hit Dice. The Characters & officers kind migration (#180)
must bump `SETUP_ENVELOPE_VERSION` and migrate version-1 envelopes in
`parseSetupEnvelope`, alongside the Setup schema, roster kinds, character
options, the inline dialog, manager warnings and Hit Dice fallback.

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
