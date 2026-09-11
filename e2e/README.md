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
loopback port. The callback installs the preview's Clerk issuer and fixture config.
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
touch enabled. It starts with one authenticated worker. Local runs acquire an
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
reusing a case across different tests fails. Retry workers reuse the same logical
worker and case, reset before creating any browser context, and then restore the
role storage. Cleanup is best effort; reset and next-run preview recreation provide
correctness.

`e2eFixtures` exposes only internal functions: `seedIdentityProjection`,
`resetCase`, `inspectCase`, `cleanupCase`. Every call verifies E2E mode, the bound
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
errors are replaced with a fixed diagnostic. `stages.log` records stage outcomes;
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

The runner budgets twelve minutes across preview/build/browser execution. CI also
shares one twelve-minute deadline across setup, installation and execution, with
interrupt then forced termination. Artifact upload has a separate one-minute cap. The
access job has fourteen minutes including installation and artifact finalization;
the aggregate has one minute, keeping the jobs' execution budget at fifteen.
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

| Project | Viewport | Journeys |
| --- | --- | --- |
| Chromium tablet | 1194×834 | All five, plus navigation/form/persistence and reconnect steps |
| WebKit tablet | 1194×834 | All five critical journeys |
| Firefox desktop | 1440×900 | Access, existing-militia initialization, complete week |
| Chromium phone | 390×844 | Access with focused navigation, form layout, reload and cross-layout edits |

The access journey's nightly extension creates a character, checks that form
controls fit the viewport, reloads the saved record, edits at the alternate
phone/tablet size, and reloads again at the original size. The Chromium tablet
Action Slot extension disconnects the observing member while the player replaces
the staged choice, then verifies the observer catches up **without reload** and
the player's reload retains the choice. These exercise existing behavior; claim
locks, individual action confirmation and GM moderation remain deferred.

All projects run serially against the same reserved cohort. Each attempt resets
and cleans its case before the next project uses it. Case ownership is checked
within each project; screenshot and trace filenames include the project so
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
running locally. The CI workflow installs all three within the existing deadline.

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
