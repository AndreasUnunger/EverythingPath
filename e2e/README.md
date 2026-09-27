# Safe browser harness

Issues #23 and #24 supply the harness and dedicated service cohort. Issue #25
adds the required organization-access journey and aggregate CI gate. Issue #26
adds the existing-militia setup journey, and issue #27 adds the shared character
and officer ledger journey, to that same gate. Issue #28 adds the complete-week
journey, and issue #29 adds shared Action Slot staging. Normal runs verify existing Clerk users, roles and memberships; they never create or repair
them. Session sign-in and Clerk testing tokens are the expected authentication
writes.

## Declared resources

Copy `e2e/resources.example.json` to an ignored location such as
`e2e/.private/resources.json` and replace every placeholder. Use a dedicated
Clerk **development** application and a Convex **preview creation** key:
`preview:team:project|secret`. A deployment key, personal development target,
production key, project key or management token is not accepted.

Each cohort contains one GM/admin and player in its member organization and an
outsider in a separate organization. Each user must have exactly that membership.
Configure Clerk's `convex` JWT template as required by the existing application.
The public key's host, the secret key's development instance and both JWKS must
agree. Fill in the real production Clerk hosts and Convex URLs in the denylist.
If you have no Clerk production environment, set `production.clerkHosts` to `[]`.
Keep the field present and add production hosts when you create them. Development
Clerk keys are still required, and any listed production hosts remain blocked.
The checked-in example is documentation, not a runnable resource declaration.

Keep the following three secrets in an ignored, mode-600 file outside artifacts:

```dotenv
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CONVEX_DEPLOY_KEY=preview:your-team:your-project|...
```

Remove inherited `CONVEX_DEPLOYMENT`, frontend Convex URLs, Clerk endpoint overrides
and other target selectors from the invoking shell. The runner intentionally does
not load `.env.local`. It copies application sources into a temporary workspace,
provides an explicit Convex env file and builds using the URL returned by Convex's
preview creation callback. `next start` serves the production build on a free
IPv4 loopback port. Browsers use `127.0.0.1` because WebKit rejects Clerk's
`Domain=localhost` client cookie. The server uses `localhost` with IPv4-first
DNS resolution so Next's internal middleware rewrites use a consistent hostname. The callback installs the preview's Clerk issuer and fixture config.
Every child command pins Convex API authentication to the declared preview key.
The Convex CLI otherwise prefers a saved personal login over a preview key, which
can make an invalid key appear to work locally and then fail in CI. The harness
still rejects inherited authentication overrides; it creates this binding only
from the validated preview-key input.

## Run

Install the browser once with `pnpm exec playwright install chromium`.
Only enable trusted execution for code you have reviewed; this flag is not a
sandbox for hostile code.

```bash
E2E_TRUSTED_EXECUTION=true pnpm test:e2e \
  --resources /absolute/path/to/resources.json \
  --secrets /absolute/path/to/test-secrets.env --preflight

E2E_TRUSTED_EXECUTION=true pnpm test:e2e \
  --resources /absolute/path/to/resources.json \
  --secrets /absolute/path/to/test-secrets.env
```

The first command performs only local validation and Clerk GET requests. The
second **deletes and recreates the declared named preview**, deploys once, builds,
creates fresh ignored role storage and runs the five Chromium tablet journeys at 1194×834 with
touch enabled. It starts one Playwright worker per declared cohort, at most three
unless `--workers N` asks for up to the declared number; a single cohort runs
exactly serially. Local runs acquire an
exclusive slot lock under `e2e/.private`; CI must additionally serialize by the
preview name across machines. After an ungraceful process termination, verify no
run still owns the slot before removing its exact stale lock directory.

In CI, the trusted workflow binds `E2E_REVIEWED_SHA=GITHUB_SHA` to the tested
commit, including PR merge commits. The workflow refuses
fork PRs, bot actors and non-owner authors before accessing the environment.
`pull_request_target` and unknown CI events are refused by preflight. The
workflow must withhold secrets from untrusted code **before** checkout/execution;
an in-repository preflight cannot secure secrets already given to hostile code.

## Fixture contract

`fixtures/catalog.ts` versions the domain keys. `smoke` provides a rank-1 militia,
one officer and its first Activity week; `isolation` is an independent control
graph for lower-level isolation checks. Names and rules values are deterministic.
Each browser test must use its own catalog case (`test.use({ caseKey: ... })`);
reusing a case across different tests of a project fails. Worker N always uses
cohort `worker-N`, and Playwright never runs two workers with the same index at
once, so a cohort is never shared. A retry may run on another worker and cohort;
it resets its case before creating any browser context and restores that cohort's
role storage. Cleanup is best effort; reset and next-run preview recreation provide
correctness, and the isolation canary below turns a leftover campaign into a
failure instead of a silently changed campaign list.

`e2eFixtures` exposes only internal functions: `seedIdentityProjection`,
`resetCase`, `inspectCase`, `cleanupCase`. The harness sends every `resetCase`
(including `canonicalPersistenceFixtures:resetAndInitialize`) the cases its
running test owns (`isolatedWith`). In the same transaction, the isolation canary
fails the reset, rolling it back, if the cohort's member organization holds any
other campaign or its outsider organization holds any campaign. Every call verifies E2E mode, the bound
deployment URL against `CONVEX_CLOUD_URL`, the production denylist, namespace,
catalog version, worker and a separate capability for the case. Capabilities are
generated for the new run and never sent to a browser. Copying E2E flags to another
deployment fails the URL binding. Do not manually rebind fixture config to
production: deployment administrators are outside this harness's trust boundary.
Clerk projections are worker-owned and cannot overwrite unrelated users. Graph
cleanup follows only owned campaign relationships and rejects oversized graphs
atomically instead of leaving truncated cleanup.

Use `players.gm` and `players.player` for simultaneous contexts, and
`players.outsider` for the separate organization. `interactions.ts` uses semantic
locators, real pointer movement, visible keyboard/tap staging buttons and
auto-retrying domain assertions. Backend inspection is for fixture diagnostics;
journey assertions belong on player-visible behavior. No fixed sleeps, DOM
mutation hooks, fake authentication or hidden staging endpoints are provided.

## Evidence and checks

Only upload the current `e2e-artifacts/<previewName>/<runId>/`, with 30-day retention. The custom
reporter keeps safe assertion messages, test outcomes and timings; auth setup
errors are replaced with a fixed diagnostic. Each completed attempt is atomically
checkpointed in `progress.json`, so an outer deadline retains the first failure
even if `onEnd` cannot write the final report. Its status remains `running` and
can never satisfy the aggregate gate. `stages.log` records stage outcomes;
`timings.jsonl` adds command correlation IDs, timestamps and elapsed milliseconds
without command arguments, environment values or provider output;
`diagnostics.log` retains allowlisted application/service error categories (such
as schema validation, authentication, rate limits and connection failures) without
provider payloads. Failed multiplayer contexts retain application-page
screenshots. A first CI retry retains an action/screenshot trace with **network,
headers, cookies, storage, snapshots, source and evaluation payloads removed**.
Video is off. Traces consequently have less detail than raw Playwright traces.
Retry passes remain failed. Private role storage, raw traces, env files and the
temporary workspace are removed on normal completion/failure and excluded from
artifact paths. Do not upload temporary directories or conventional raw
Playwright reports.

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm test:build` without service
credentials. Safety, identity verification, reset ordering, namespace isolation,
artifact redaction and config discovery have lower-level tests. Live deployment,
auth and subscription parity still require the declared services; a secretless
pass is not evidence that a live smoke has succeeded.

API references: [Convex preview deployment](https://docs.convex.dev/cli/reference/deploy),
[Clerk Playwright authentication](https://clerk.com/docs/guides/development/testing/playwright/test-authenticated-flows),
[Playwright authentication](https://playwright.dev/docs/auth).

## Provision and repair the cohort (#24)

`e2e/resources.ci.json` records the non-secret cohort IDs, development host and
known production denylist. The dedicated **EverythingPath E2E** Clerk application
(`app_3J66fIZKu2oeO8fqN7S1nzHRPwM`) uses development instance
`ins_3J66fNgiREn4Um73GoNT1mpxgr1` at
`sought-gar-1424.clerk.accounts.dev`, with email sign-in, organizations and the
`convex` JWT template enabled. It is separate from the applications used for
normal development. Its preview slot is reserved for CI. Local runs use
`e2e/.private/resources.json` and a separate local slot. Review both declarations
when production targets change. An empty Clerk denylist means no production
Clerk application has been declared; it does not disable the development-key or
instance checks.

Provisioning is a separate, local-only command. Without `--bootstrap`, it only
verifies. The secrets file must be mode 600 and contain only the three keys above.

```bash
E2E_TRUSTED_EXECUTION=true pnpm e2e:provision \
  --resources e2e/.private/resources.json \
  --secrets e2e/.private/test-secrets.env

E2E_TRUSTED_EXECUTION=true pnpm e2e:provision \
  --resources e2e/.private/resources.json \
  --secrets e2e/.private/test-secrets.env --bootstrap
```

Bootstrap validates targets and matches the development instance's JWKS before
any service write. It creates missing synthetic `+clerk_test` users and member /
outsider organizations, restores missing memberships and their `org:admin` /
`org:member` roles, and removes incorrect memberships within the declared cohort.
It refuses to alter an ID belonging to a different email or remove access to an
undeclared organization. Resolve those cases manually. Existing users and
organizations retain their IDs; a recreated object's new ID is written atomically
to the supplied declaration after verification. New organizations carry a stable
private metadata marker so interrupted setup can find them again. Run bootstrap
from one machine at a time; its local lock cannot serialize across machines.
For initial creation, the example's placeholder IDs represent absent resources;
replace all target, denylist and email values before enabling bootstrap.

If bootstrap changes IDs, update both local and CI declarations before another
smoke. Configure the Clerk `convex` JWT template and organization support in the
dedicated development application before provisioning. Application creation,
JWT-template configuration and production inventory are operator setup steps;
bootstrap only manages the declared fixture cohort.

## Trusted CI configuration

The `E2E access` workflow runs on pull requests targeting `main`, pushes to `main`,
and manual dispatches. Merge-queue execution is deferred. The stable aggregate check is **E2E required**. It always
runs after the access job and accepts only a successful job with an explicit
verified result output. Failed, cancelled, neutral, skipped or absent upstream
results fail closed. The reporter independently requires the named authentication
setup, access journey, existing-militia journey, character/officer ledger
journey, complete-week journey, and realtime Action Slot journey, each with exactly
one passing attempt. Skips, expected failures, quarantine annotations, focused runs, global errors and retry passes
cannot satisfy it. `forbidOnly` rejects focused tests before execution.

Only repository-owner actors and rerun actors can use service credentials; PRs
must additionally be owner-authored and originate in this repository. Other PRs
receive a red aggregate check and must be reviewed and brought onto a trusted
owner branch. Never use `pull_request_target` to execute submitted code.

Store `CLERK_SECRET_KEY` and `CONVEX_PREVIEW_DEPLOY_KEY` only in the `e2e`
environment, and `CLERK_PUBLISHABLE_KEY` as its variable. The environment permits
`main` and `refs/pull/*/merge` branch refs. PR runs test GitHub's proposed merge
commit. This rollout trusts the owner's same-repository changes without an
additional environment approval gate; review workflows, dependencies and install
scripts before submitting them. Branch patterns alone do not establish trust.
Do not move service keys to repository or organization secrets. Revisit this
policy before giving other contributors write access.

The runner budgets 17.5 minutes across preview/build/browser execution. CI also
shares one 17.5-minute deadline across setup, installation and execution, with
interrupt then forced termination. Artifact upload has a separate one-minute cap.
The browser job has twenty minutes including installation and artifact finalization;
the aggregate has one minute, keeping those jobs' execution budget at twenty-one.
GitHub queue and environment approval wait time are outside job execution limits.
A hard job cancellation may prevent evidence finalization, and never passes the gate.

Dispatch with `force_failure: true` to exercise the evidence path. The first
attempt fails after the real access assertions; the CI-only diagnostic retry
repeats them and passes, while the overall run stays red. Inspect the safe console
summary, `report.html`, `report.json`, application screenshots, first-retry trace
ZIPs, `stages.log`, and allowlisted service diagnostics when present. CI retains
only the sanitized artifact directory for thirty days. Bootstrap never runs in CI.

Local verification on 2026-09-09 completed a normal journey against a recreated
preview and fresh role sessions. A separate run using CI retry settings completed
the intentional first-attempt failure followed by a passing retry, exited 1, and
retained the HTML/JSON reports, three application screenshots, three sanitized
retry traces and logs. These are local live-service checks, not evidence of a
GitHub Actions run or activated branch protection.

### Current rollout and deferred enforcement

Issue #25 targets the existing private, personally owned GitHub repository.
Owner-authored same-repository PRs targeting `main` receive the **E2E required**
aggregate result. Despite its stable name, this is an advisory check: the current
GitHub plan does not enforce it as a merge requirement. A red result must be
handled by the owner before merging. The `e2e` environment permits both `main`
and `refs/pull/*/merge`; fork and bot runs remain excluded by the workflow.

Mandatory branch protection, environment approval gates and merge queues are
explicitly deferred rather than prerequisites for PR testing. GitHub Pro can
provide private-repository branch protection, but private environment reviewers
and private merge queues require Enterprise Cloud, with organization ownership
also required for merge queues. An organization transfer would require replacing
the workflow's repository-owner/user comparisons with an explicit trusted-user
policy before enabling execution.

When those features become available, configure **E2E required** from GitHub
Actions as a required check while retaining other required checks. Add protected
merge-queue environment refs and restore `merge_group` support in all required
workflows and the E2E preflight. Validate actual PR and queue runs before declaring
mandatory enforcement active.

References: [Clerk users API](https://clerk.com/docs/reference/backend-api/tag/users/post/users),
[Clerk organizations API](https://clerk.com/docs/reference/backend-api/tag/organizations/post/organizations),
[GitHub environment restrictions](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

## Existing-militia journey

`existing-militia.spec.ts` owns the `existingMilitia` fixture and a separate
`isolation` comparison fixture. Both reset before every attempt and clean up
afterward; neither depends on the access journey's campaign. Setup starts with
an empty campaign and enters the militia, officer, teams, settlement, week context,
persistent sickness and next-week bonus through the Ledger.

The journey distinguishes an empty rank from a malformed rank using visible,
field-associated errors. It saves an intentional manager-limit exception with
an explanatory team note and checks the advisory warning. All observations use
production UI roles, labels and text, including reload and campaign switching.
No fixture inspection API is used to assert application behavior. The required
result evaluator rejects runs that omit this journey.

Live verification on 2026-09-09 passed authentication and both journeys on their
first attempts against the recreated local preview and a production web build.
The existing-militia journey completed in about 25 seconds, including reload,
the comparison campaign checks and switching back to the initialized militia.

## Character and officer ledger journey

`character-ledger.spec.ts` owns the `characterLedger` fixture. It starts with a
militia and an empty character ledger, while two separately authenticated member
contexts open the same campaign before changes begin. The GM creates and assigns
two characters through the production UI; the player observes each update without
reloading. The player then moves one character into the occupied Marshal role,
which replaces the former officer without deleting either record, and the GM
clears that assignment. Both contexts finally reopen the campaign and verify that
the two records and unassigned officer roles persisted. Assertions wait only on
visible ledger rows, role cards, and dialogs.

## Complete-week journey

`complete-week.spec.ts` owns the `completeWeek` fixture, independently reset and
cleaned for every attempt. It begins at week 2 Upkeep with rank 1, training 10,
treasury 100, no staged actions and no event carry. A regular player enters
attrition 2, stages Drill Militia with a successful check of 15 and training gain
4, and enters an event trigger roll of 100 against the default chance of 10.

The player reviews the saved inputs and Resolution Preview, then uses Confirm
Week to submit the reviewed Weekly Draft Revision. The journey checks training
12, treasury 90, notoriety 0, week 3 Upkeep, uneventful carry 1, and cleared draft
inputs through the production board and ledger, both immediately and after reload.
It does not inspect backend state or intercept mutations. Exact revision rejection,
atomicity, calculations, and rule permutations remain in the existing mutation
harness and rules tests. The required aggregate rejects runs missing this journey.

The journey exposed Activity roll edits being lost when phase navigation unmounted
the roll panel before its separate autosave timer fired. Valid edits now enter the
board's existing mutation queue directly; a component regression covers immediate
unmount and keeps malformed numeric input local.

Live verification on 2026-09-09 passed authentication and all four required
journeys on their first attempts against the recreated local preview, including
complete-week Confirmation and reload. Typecheck, lint, and all 318 tests passed.

## Realtime Action Slot journey

`realtime-action-slot.spec.ts` owns the `realtimeActionSlot` fixture. Two separately
signed-in members open the same week 1 Activity board and observe empty Action
Slot 1 before a regular player taps the visible staging control for Drill Militia.
Both contexts then observe that choice marked Staged in week 1, without reloading
or competing writes. The required aggregate rejects a missing or non-passing journey.

Actions have no individual confirmation. The local specification corrects the
original issue’s assumption about a Confirmed Action Choice: Confirm Week commits
the entire Weekly Draft and is covered by the complete-week journey. First-claim
locking, release, cancellation, timeout, reconnect, invalid-drop recovery, and GM
moderation coverage remain deferred until those capabilities exist.

Failure reports identify the journey, expected Action Slot state and choice,
player, and last rendered slot text from both contexts. The shared fixture also
retains application screenshots for both contexts and sanitized traces on CI retry.

Live verification on 2026-09-09 passed authentication and all five journeys on
first attempts against the recreated local preview and production web build.
The realtime Action Slot journey completed in about six seconds. Typecheck,
lint, all 320 tests, and the three build-boundary checks also passed.

## Nightly compatibility matrix (#30)

Run the same isolated harness with `--nightly`. The default command and **E2E
required** retain the five mandatory Chromium tablet journeys. Nightly selects:

| Project         | Viewport | Journeys                                                                   |
| --------------- | -------- | -------------------------------------------------------------------------- |
| Chromium tablet | 1194×834 | All five, plus navigation/form/persistence and reconnect steps             |
| WebKit tablet   | 1194×834 | All five critical journeys                                                 |
| Firefox desktop | 1440×900 | Access, existing-militia initialization, complete week                     |
| Chromium phone  | 390×844  | Access with focused navigation, form layout, reload and cross-layout edits |

The access journey's nightly extension creates a character, checks that form
controls fit the viewport, reloads the saved record, edits at the alternate
phone/tablet size, and reloads again at the original size. The Chromium tablet
Action Slot extension disconnects the observing member while the player replaces
the staged choice, then verifies the observer catches up **without reload** and
the player's reload retains the choice. These exercise existing behavior; claim
locks, individual action confirmation and GM moderation remain deferred.

Each concurrently running worker owns one reserved cohort; tests sharing a cohort
never run at the same time (see Parallel cohorts below). Each attempt resets
and cleans its case before the next test in that cohort uses it. Case ownership is
checked within each project; screenshot and trace filenames include the project so
cross-browser evidence cannot overwrite earlier failures. Contexts inherit actual
project viewport, touch and mobile settings. Desktop uses keyboard staging.
Authentication runs once with fresh sessions, then each browser gets independent
contexts. Nightly requires all 15 selected tests (including authentication) with
exactly one successful first attempt, using the mandatory gate's no-skip,
no-quarantine, secret, reset, retry and sanitized-artifact policies.

`.github/workflows/e2e-nightly.yaml` schedules default-branch execution at 02:23
UTC, or accepts an owner-reviewed manual SHA. It shares the CI preview slot's
concurrency group with the mandatory workflow. Its result is advisory: it is not
an input to **E2E required** and never changes a previous merge result. Install
Chromium, WebKit and Firefox with Playwright's supported OS dependencies before
running locally. The CI job runs in `mcr.microsoft.com/playwright:v1.63.0-noble`,
which already contains all three.

Safe reports include project, journey, assertion errors with expected state,
and observing roles' last rendered domain state on failure. Recurrence summaries
contain only fixed journey identifiers and hashes of failing step paths, never
provider payloads. The separate triage job has issue-write permission and no
Clerk or Convex credentials. It compares the current run to the preceding 19
completed workflow runs, counting a diagnostic retry only once. Two consecutive
failures or two failures within that window create or update one issue per
project/journey/failing step; a closed matching issue is reopened on recurrence.
Different failing steps do not count toward each other's threshold. Historical
summaries retain syntactically valid keys from retired journeys; those keys do
not prevent escalation for journeys in the current catalog. Setup failures
produce a dependency-free infrastructure summary. Missing/expired historical
artifacts are unknown, so they do not supply evidence of recurrence. Hard job
cancellation can prevent summary upload and is never treated as a pass.

The summary is retained for 30 days alongside the existing safe evidence. The
nightly schedule and automated issue writes take effect after this workflow lands
on the default branch; local tests do not publish issues.

Live verification on 2026-09-09 passed all 15 nightly tests on their first attempts
in Playwright's Ubuntu container against the dedicated local preview. This
includes all four browser/layout projects, reconnect catch-up before reload, and
phone/tablet persistence. All 17 fixture resets and cleanups completed. This is
local live-service evidence; the GitHub schedule and issue publication have not
been run. Secretless tests also cover the recurrence threshold and GitHub create,
update and reopen behavior using a fake GitHub command.

Both browser workflows call `.github/workflows/e2e-runner.yaml` for setup,
execution budgets, environment credentials, and evidence retention. The callers
own their trigger/trust rules and shared concurrency slot; the mandatory caller
keeps the fail-closed aggregate, while the nightly caller owns issue triage.

## Weekly Draft extraction gate (#60)

Every extraction under #57 must pass the complete supported-path **E2E required**
suite before merging, together with typecheck, lint and relevant lower-level tests.
Run it against the proposed merge commit. The existing owner-enforced merge policy
above still applies; this requirement does not activate GitHub branch protection.
The required result catalog remains independent of Playwright discovery: omitting
the multiplayer journey or passing only on retry leaves the aggregate red.
Reporter integration tests exercise both cases through actual Playwright results.

The required Action Slot journey now uses `support/transport.ts` on the regular
player's page, installed before navigation and restricted to the bound preview's
WebSocket host. It forwards unchanged frames to the actual Convex server using
[Playwright's WebSocket interception](https://playwright.dev/docs/api/class-websocketroute#web-socket-route-connect-to-server).
`next` arms one delayed mutation request, delayed mutation response, or dropped
acknowledgement, matched to the next outgoing mutation’s request ID so an older
response cannot satisfy the fault. `observed` supplies a bounded `expect.poll` synchronization point;
`release` forwards held frames in order. A delay holds subsequent frames in that
direction to avoid manufacturing protocol reordering. Dropping an acknowledgement
never drops or fabricates the transaction itself. Payloads remain in memory and
are never attached to reports.

Both authenticated members open the board before the player stages a choice.
The writer navigates to Event and back while its request is held; the observer
remains in Activity with no staged choice. The observer sees the replacement
while its response is held, and sees the final choice despite a dropped response.
Writer reloads prove persistence after the latter two cases. These are current
supported behaviors; reload recovery does not prove canonical idempotent retry.
The journey retains the same owned fixture, reset/cleanup, CI matrix and failure
screenshots/traces for both players. `force_failure` now also fails the multiplayer
journey's first attempt after the transport assertions, exercising both-player
failure evidence and a diagnostic retry that must remain red.

Extend this same gate as canonical behaviors land, without skipped placeholders:

- Workspace extraction: independent Phase Views, navigation during pending edits,
  immediate feedback and visible recovery after a rejected edit.
- Persistence extraction: disjoint edits, same-target failure, atomic choice
  moves/swaps, obsolete detail rejection, dropped-response idempotent retry and
  ordered/monotonic acknowledgement.
- Confirmation extraction: reviewed-source rejection, racing Confirmations with
  one history outcome and one successor, and delayed old-week edits rejected after
  advancement.

Use rendered domain outcomes for browser assertions and the shared real-adapter
contract suite for deeper transaction cases. Keep canonical behavior isolated
until its approved cutover. The accepted #36/#38 contract supersedes older claim,
lock and individual-confirmation wording elsewhere in this document.

The merged #58 SDK upgrade requires refreshed `convex/_generated` bindings:
platform environment declarations and the aggregate package's component API type.
These are generated output, verified byte-for-byte against the isolated preview;
the drift guard now names a mismatched file for diagnosis.

Live verification on 2026-09-09 passed authentication and all five mandatory
journeys on their first attempts against a recreated local preview and production
web build. A separate local run with CI retry settings reached the deliberate
access and multiplayer failures, then passed both diagnostic retries; its report
remained failed and the runner exited 1. Both multiplayer roles retained failure
screenshots and sanitized retry traces. The final request-ID matching helper was
exercised by that drill. This is local live-service evidence, not a hosted CI run
or activated branch protection. Typecheck, lint, all 347 tests, build-boundary
checks and the rules-catalog check also passed (the catalog retains its explicit
473 implementation gaps).

## Campaign context preparation (#64)

The additive `canonicalCampaignContext` table and unregistered preparation seam
retain settlement context, one-use bonuses, queues, first-use/carry metadata,
per-instance event targets/age/order/mitigation/ending, militia-wide buyoff week,
and copper-precise assets and order delivery/receipt facts. The reusable campaign
facts editor is available for isolated ledger/setup integration; no live route or
canonical endpoint is activated. Referenced teams must be removed from event and
queue facts before roster deletion. Missing facts remain explicit instead of
being inferred from legacy week numbers, rounded delivery weeks or character
levels. Later projection and cutover work still owns rule execution and activation.

Local verification on 2026-09-10 passed the isolated preview deployment,
production web build, authentication and all five required browser journeys.
Generated API declarations were refreshed from the preview and verified by the
harness. Typecheck, lint and all 394 tests passed. The rules catalog reports 21
covered cases and 473 explicit later implementation gaps with zero catalog errors.
New outcome tests cover shared round trips, reference ownership and removal,
unknown versus zero, repeated event instances, receipt consistency, fractional
enchantment input and field-level target repair. Both standards and specification
reviews have no outstanding findings. This is local preview evidence, not a
production deployment or canonical cutover.

## Upkeep extraction (#67)

Local verification on 2026-09-11 passed authentication and all five required
browser journeys on their first attempts against the recreated
`e2e-local-andreasununger-slot-0` preview and production web build. The successful
run is `everythingpath-e2e-sFMIfI`; its safe report records zero errors. This
preserves the supported legacy path while canonical Upkeep remains isolated.

The initial deployment attempt exposed `Array.at()` in the shared progression
module against Convex's older TypeScript library target. Equivalent indexing
restored compatibility. Both application and Convex typechecks, lint, all 541
Vitest tests, and the rules catalog now pass. The catalog records 140 covered
cases, 472 explicit remaining gaps, and zero errors. Upkeep parity compares seven
canonical scenarios through the browser-target bundle and Convex-test stored
source; complete Workspace and Confirmation parity remain later gates. Standards
and specification reviews have no remaining findings. This is local preview
verification, not hosted CI evidence or a production cutover.

Follow-up QA fixes passed on 2026-09-11 in `everythingpath-e2e-aVbLtS`:
all five supported browser journeys passed against the same isolated preview.
All 544 tests, both application and Convex typechecks, lint, and the rules catalog
passed. Independent QA exercised 21 schema-validated projections covering manager
bonus scope, transfer eligibility, funds ordering, Theft, and matching exceptions
without remaining findings. Canonical Workspace browser coverage remains a later
gate.

## Canonical persistence and Confirmation contracts (#79–80)

The mandatory and nightly gates include one `canonical-persistence` Chromium
project after authentication. It runs the same contract scenarios as the memory
adapter against the production Convex transport and actual isolated transactions.
This is service-contract verification; the five existing browser journeys still
exercise the supported user interface while the canonical Workspace is isolated.

Each scenario resets the owned `canonicalPersistence` fixture. Separate GM and
player browser sessions supply genuine Clerk Convex tokens to Node Convex clients;
the clients use production queries, mutations and subscriptions. Tokens stay in
memory, provider logging is disabled, and failures pass through the harness's
sanitizer. Outsider and anonymous sessions must fail to read or edit the draft;
a member request mixing its militia with another owned campaign must also fail,
leaving the entire original draft unchanged. Internal fixture
initialization and closing use the bound preview capability; normal editing still
passes the application's authentication and campaign checks. Existing fixture
cleanup removes the case after the test, including failed attempts.

The same project runs the shared Confirmation scenarios against real transactions:
exact accepted review, a local edit barrier, external source changes, concurrent
confirms, delayed edits, and dropped acknowledgements. An owned closed draft
with a colliding successor identity forces a failure after the outcome writes,
proving that the transaction rolls back. Internal inspection checks the stored
snapshot, history, and single open successor. An additional scenario verifies
literal treasury values after a Special action and table adjustment, and confirms
as an ordinary player. Outsider, anonymous, and cross-campaign Confirmation
requests use a ready accepted preview, so incomplete input cannot mask a missing
authorization check.

`E2E required` rejects a missing, skipped, failed, or retry-only persistence
contract. The nightly matrix runs this contract once, alongside the existing
browser/layout matrix. The aggregate and actual Playwright reporter tests cover
missing-contract and retry-only failures. Run through `pnpm test:e2e` with the
same dedicated resource declaration and secrets as the other journeys.

## Canonical Upkeep Workspace journey (#81)

The required `canonical-workspace` Chromium project opens the isolated Workspace
with two authenticated players. Its owned fixture starts in week four so the
journey enters real Upkeep rolls, checks calculated defaults and shared outcomes,
and stages an officer transfer. Keyboard and clipboard interactions verify that
invalid text preserves the current digits, zero remains distinct from clearing,
and field errors appear in the application.

The journey holds one outgoing edit at the browser's WebSocket boundary while
queries and authentication continue normally. A second player's same-field edit
then produces a real server rejection when the held edit is released. This checks
immediate pending feedback, independent phase navigation, the page-exit warning,
restoration of the latest accepted value, and a successful explicit retry. An
ordinary player confirms the complete week and both browsers observe its successor.

Successful runs save `canonical-upkeep-tablet.png`, `canonical-upkeep-phone.png`,
`canonical-upkeep-desktop.png`, and `canonical-upkeep-errors-tablet.png` for
visual inspection. The original five
campaign journeys and the deployed editing/Confirmation contracts remain required.
The Workspace route remains unavailable to live campaigns during this extraction.

## Independent service contract deadlines (PR #93)

CI run `34683202465` retained the first failure in `progress.json`: authentication
and all six application journeys passed on their first attempts, while the
combined service test exceeded its 300-second deadline. Its completed fixture
commands consumed about 145 seconds, with continued progress through editing and
Confirmation. The resulting diagnostic retry then reached the unchanged
720-second overall deadline. The isolated local baseline completed the combined
test in 226 seconds, so a local pass alone did not establish adequate CI margin.

The unchanged 11-scenario editing contract and eight-scenario Confirmation
contract now run as separately required tests, each retaining the 300-second
limit. Confirmation still includes its independent literal-state and authority
checks. `canonical-persistence` and `canonical-confirmation` use separate project
ownership namespaces for the existing declared fixture capabilities, with one
worker and a fresh reset per scenario. The fixture ownership guard is unchanged.
The mandatory matrix requires nine first-attempt results and nightly requires
18. Omitting either contract or passing only on a retry fails the aggregate;
neither the 720-second workflow budget nor retry acceptance was relaxed.

Local verification of the split passes 873 tests, typecheck, lint and the rules
catalog (380 covered cases, 290 explicit gaps, zero errors). The focused aggregate
regression first failed when Confirmation was absent, then passed with the new
required test. Actual reporter-protocol tests also reject missing and retry-only
Confirmation results. Fresh full isolated QA and the hosted CI rerun are pending.


## E2E failure follow-up (2026-09-14)

Required CI run `34721636351` reached the 720-second deadline while the final
Confirmation contract was still progressing. Each contract scenario now resets
and initializes its owned fixture in one guarded transaction, and each contract
test reuses its authenticated clients across scenarios. Reset isolation,
per-scenario authorization checks, transaction assertions, and required results
remain intact. A Convex integration regression proves fresh case creation and
rollback when initialization or capability validation fails.

Nightly runs `34745454875` and `34820347494` exhausted the existing-militia
journey's 60-second deadline at different controls. The traces showed continued
progress through more than fifty pointer interactions. That full onboarding and
reload journey now has a 120-second deadline; the aggregate budget stays at 720
seconds and retries still cannot satisfy the gate.

A full local nightly run then exposed WebKit's Clerk redirect loop during the
Action Slot reload assertions. A controlled cookie probe showed that WebKit
rejects `Domain=localhost` but accepts `Domain=127.0.0.1`. The harness now uses
the latter origin, with a localhost server hostname to avoid
[Next's loopback rewrite mismatch](https://github.com/vercel/next.js/issues/94745).
The final hostname pair passed a temporary 30-reload live WebKit stress probe
(`everythingpath-e2e-6JnKBJ`); that focused run intentionally did not satisfy the
aggregate gate. All temporary probes were removed, and the original real reload
assertions remain unchanged.


## Expanded suite deadline (2026-09-15)

PR #93 run `35006064700` was interrupted at the 720-second workflow deadline.
All eight completed required results passed on their first attempts; the ninth,
Confirmation, was still progressing through historical-view assertions. The
expanded canonical Workspace journey, now including new and mid-campaign setup,
took 230 seconds. Installation and preview/build consumed about two minutes
before browser execution, leaving insufficient room for the complete suite.

The aggregate execution budget is now 900 seconds in CI, the local runner,
Playwright, and its application server. The CI job allows another two minutes
for teardown and evidence retention. Individual test deadlines, one-worker
fixture isolation, all required results, and first-attempt acceptance are
unchanged. This explicitly supersedes the earlier 720-second budget; it does
not classify incomplete or retry-only results as passing.

## Expanded compatibility-suite deadline (2026-09-27)

The #154 run at `f9b08db` completed eighteen nightly journeys on their first
attempts with zero recorded errors before the 900-second outer deadline stopped
execution before the phone journey. It is an incomplete gate, not a pass.
The browser stage consumed about 843 seconds; the remaining phone journey
has previously taken about 48 seconds, while outer setup consumed about 57 seconds.
That suggests roughly 950 seconds for the full run before modest runtime variation.

The aggregate execution budget is 1,050 seconds (17.5 minutes) in CI, the local
runner, Playwright, and its application-server lifetime. The CI browser job allows
twenty minutes, leaving 2.5 minutes beyond execution for teardown and evidence.
This supersedes the 900-second aggregate limit above. All nineteen nightly journey
identities, first-attempt acceptance, individual test and assertion deadlines,
one-worker fixture isolation, preview authorization and redaction remain unchanged.
No incomplete run becomes a pass; the complete gate must still be rerun and verified.

## Accepted campaign regression (#91)

The mandatory matrix still contains ten journeys (nineteen for nightly).
The `canonical-cutover` project now verifies the supported post-cutover path:
an explicit accepted mid-campaign source enters ordinary setup, edits and
Confirmation, then retains its successor and immutable history after rejected
legacy calls and a browser reload. Missing or retried results fail the aggregate.

The completed paused migration, backup restore and bounded-cleanup rehearsals
remain in the private evidence referenced by [legacy retirement](../docs/legacy-retirement.md).
The compatible cleanup release is `b249911`; restore an old backup only with its
compatible release. The narrowed schema deliberately cannot run migration or
resume legacy gameplay. No operational campaign is advanced by these tests.

Ordinary `/campaigns` journeys use canonical-only fixtures and cover membership,
setup/reload, shared characters, persisted officer assignments, Confirmation,
history and shared action choices. The broader Workspace journey continues to
cover independent navigation, conflict recovery, input clearing and phase behavior.

## Parallel cohorts (2026-09-27)

With the owner's approval, one worker per cohort replaces the one-worker fixture
isolation recorded above. Tests are about 93 % of a nightly run, and each cohort
(member organization, outsider organization, GM, player and outsider) is a
complete isolation unit: its organizations are disjoint from every other cohort's.

- **Workers.** `pnpm test:e2e` starts one Playwright worker per declared cohort,
  capped at three. `--workers N` selects between 1 and the declared number; use
  `--workers 1` for a serial baseline on the same declaration. The runner refuses
  cohorts that are out of order (`worker-0`, `worker-1`, ...) or share a key,
  organization or identity. `fullyParallel` stays off: files run whole on one
  worker, except `canonical-workspace.spec.ts`, which opts in per test. The
  authentication setup seeds and signs in every used cohort one after another,
  because parallel sign-ins would exceed Clerk's per-IP limits. The limit is
  60 s per cohort and cohorts sign in sequentially, so its deadline is 60 s
  times the number of cohorts used (180 s for three). No cohort gets more time
  than the single-cohort setup had.
- **Isolation canary.** Every reset carries its test's owned and comparison
  cases (see Fixture contract). A second test in the cohort, a failed cleanup or
  a campaign created outside the fixtures fails the next reset in that cohort.
  Convex tests prove that the canary rejects each kind of foreign campaign and
  rolls the reset back.
- **Evidence.** Each attempt in `progress.json` and `report.json` records
  `workerKey` (`null` for authentication, which prepares all cohorts). The
  console line names the cohort too.
- **Order.** Projects are listed longest first (Confirmation, persistence,
  Workspace, then the access-heavy browser projects, and cutover last), so the
  parallel critical path stays close to the longest single test.

### Workspace journeys

`canonical-workspace` was one 242–255 s journey. It is now five independent
tests, split at its four existing reset boundaries. Each test owns a canonical
case, and each case keeps the `canonical-persistence-*` names so that the layout
and overflow assertions measure text of the same length. Moved steps are
unchanged. The first part installs the held-edit socket control on the GM page
where the single journey did. Parts two to four install their own control
before their first navigation, because their GM page had used that control. The
race part uses only fresh pages with their own controls, as before.

| Journey | Case | Starting state |
| --- | --- | --- |
| players prepare shared Upkeep with independent navigation and save recovery | `workspaceUpkeep` | New and mid-campaign setup through the UI, then `initializeUpkeep` (week 4) |
| players choose the nearest settlement at maximum notoriety and resolve team conditions | `workspaceNotoriety` | `resetCase`, then `initializeUpkeep` with choices, maximum notoriety and a missing team |
| players recover a team at an adjusted cost and confirm a week through Activity and Event | `workspaceRecovery` | `resetCase`, then `initializeUpkeep` with choices |
| players review and buy off carried persistent events before confirming the week | `workspacePersistent` | `resetCase`, then `initializeUpkeep` with persistent events |
| racing Confirmations commit one reviewed week and reject stale and delayed changes | `workspaceConfirmation` | `resetCase`, then plain `initializeUpkeep` on three fresh pages |

Each later step started with the same reset and seed, so the database state is
unchanged. The only browser state that crossed a boundary was also checked:

- Every part left both pages at 1194×834, the project viewport.
- The reference panel preference was open, the same as a fresh context.
- The clipboard permission is used only in the first part.
- Back/forward history is exercised only within a part.

The only lost coverage is one GM and player session surviving all five parts. The
first part keeps setup, both campaign states and the full Upkeep journey in one
session. The 420 s test deadline is split in proportion to the measured parts
(130, 30, 125, 80 and 55 s), and no part gets more than its share.

### Provision and declare the cohorts

`worker-1` and `worker-2` exist in the dedicated development instance.
`e2e/resources.ci.json` declares all three cohorts; CI and local runs
deliberately share them. After this change merges, the owner renames the
provisioned local `e2e/.private/resources-3-cohorts.json` over
`e2e/.private/resources.json`. To recreate the cohorts, declare each one with
distinct `+clerk_test` emails and placeholder IDs, as in
`resources.example.json`. Then run `pnpm e2e:provision ... --bootstrap` from one
machine and copy any rewritten IDs into both declarations.

A local run and a CI run at the same time still share these Clerk users and
organizations, as before: they sign in the same identities concurrently and
share Clerk's rate limits. Their previews are separate. The CI concurrency group
serializes only CI runs.

### Not yet changed: fixture-call overhead

Every fixture operation (`fixtureCall` and `canonicalPersistenceFixtureCall` in
`support/process.ts`) spawns one Convex CLI process through `command()`. Each
spawn takes about 1.0–1.4 s, which is roughly 150 calls and 18 % of nightly
browser time. The canary adds no call because it runs inside the reset. A
persistent guarded client could save an estimated 100–130 s. Measure that before
replacing the spawns.

Verified with live services on 2026-09-27: a three-worker (`JxnO44`) and a
serial (`xpy7vn`) nightly on the same fingerprint gave the same verdicts except
for a serial-only `canonical-cutover` race, since fixed (contract clients read
their token from a tab the journey never navigates). The canary never fired in
either run. Still to verify: a deliberate two-tests-on-one-cohort drill that
turns the canary red, and five consecutive parallel nightlies with no flakes.

## WebKit Clerk redirect loop and fresh role sessions (#187, 2026-09-27)

After #187 the WebKit access journey failed in most nightlies: a reload hit
"Too many redirects" (`C4MBwN`, `IKQBdO`), or Back stayed on
`/campaigns/<id>` (`xsix69`, `JxnO44`, `xpy7vn`). The app was not the cause:
nothing on the campaign list pushes, replaces or redirects. A diagnostic run
(`Jj2TKl`) recorded the document requests:

1. Role storage is created at the start of the run, so its 60 s session token
   has expired when a test loads its first page. Clerk's development middleware
   then sends the document through its handshake on `*.clerk.accounts.dev` and
   back.
2. A document that arrived through that cross-site redirect is still treated as
   cross-site when it reloads: WebKit withholds Clerk's `SameSite=Strict`
   `__client_uat` cookie on every reload of it. Chromium sends it. The
   middleware sees `session-token-but-no-client-uat` and handshakes again. It
   stopped after three rounds in `Jj2TKl`, guarded by its 2-second
   `__clerk_redirect_count` cookie. The likely cause of "Too many redirects" is
   rounds slow enough for that counter to expire, so the loop never stops.
3. In WebKit, a reload that redirects through another origin also adds a
   history entry, so Back lands on the same address.

Production Safari is not affected in the same way: production Clerk has no
cross-site development handshake. Reordering reloads only changed which symptom
appeared, and a separate test would still start with the handshake.

The fix is in the harness (`support/session-token.ts`). Before a test creates
any page, each role context gets a session token minted through Clerk's Backend
API (`POST /v1/sessions/<sid>/tokens`) for the session already in its storage,
so the first page load needs no handshake. Guards:

- The worker revalidates the targets on every call: trusted execution, a
  `sk_test_` secret key, a publishable key that encodes the declared
  development host, and the production denylist. The only inherited selector
  it sets aside is the harness's own `CONVEX_OVERRIDE_ACCESS_TOKEN` pin, which
  must equal the preview key. Once per worker it also
  confirms the development instance and the matching key pair (JWKS).
- The stored and the issued token must both come from the declared issuer,
  role user and session, the issued one must not have expired, and the cookies
  must belong to the browser host. Any mismatch fails the test before a page
  loads.
- Test workers use `CLERK_SECRET_KEY` only in memory, for this request, as the
  authentication setup already does. The key, tokens and cookie values never
  enter logs, annotations, errors or artifacts; errors name only the guard
  that failed.

It applies to every browser. The handshake belongs to Clerk's development
instance, not to the app, so skipping it in Chromium and Firefox hides no app
behaviour, and every project starts from the same session state. Later expiry
is refreshed by Clerk in the page, as before, and every reload assertion is
unchanged. With the change, the trial run `Fyy86A` passed 23/23, including
WebKit access.
