# Safe browser harness

Issues #23 and #24 supply the harness and dedicated service cohort. Issue #25
adds the required organization-access journey and aggregate CI gate. Normal runs
verify existing Clerk users, roles and memberships; they never create or repair
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
creates fresh ignored role storage and runs the Chromium access journey at 1194×834 with
touch enabled. It starts with one authenticated worker. Local runs acquire an
exclusive slot lock under `e2e/.private`; CI must additionally serialize by the
preview name across machines. After an ungraceful process termination, verify no
run still owns the slot before removing its exact stale lock directory.

In CI, the trusted workflow binds `E2E_REVIEWED_SHA=GITHUB_SHA` to the tested
commit, including PR merge commits and merge-group commits. The workflow refuses
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

The `E2E access` workflow runs on pull requests, merge groups, pushes to `main`,
and manual dispatches. The stable aggregate check is **E2E required**. It always
runs after the access job and accepts only a successful job with an explicit
verified result output. Failed, cancelled, neutral, skipped or absent upstream
results fail closed. The reporter independently requires the named authentication
setup and access journey, each with exactly one passing attempt. Skips, expected
failures, quarantine annotations, focused runs, global errors and retry passes
cannot satisfy it. `forbidOnly` rejects focused tests before execution.

Only repository-owner actors and rerun actors can use service credentials; PRs
must additionally be owner-authored and originate in this repository. Other PRs
receive a red aggregate check and must be reviewed and brought onto a trusted
owner branch. Never use `pull_request_target` to execute submitted code.

Store `CLERK_SECRET_KEY` and `CONVEX_PREVIEW_DEPLOY_KEY` only in the `e2e`
environment, and `CLERK_PUBLISHABLE_KEY` as its variable. Before enabling PR or
merge-queue environment refs, require owner approval of environment deployments
and disable bypass. Review the exact merge commit, workflows, dependencies and
install scripts before approval. Branch patterns alone cannot establish trust
for PR code. Keep the existing main-only environment policy until these controls
are available. Do not move service keys to repository or organization secrets.

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

### Required-check rollout

Immediately after the journey reaches `main`, configure its branch protection or
active ruleset to require **E2E required** from GitHub Actions (app ID 15368),
retaining existing required checks. Require it for merge queue as well. Verify
with a fresh PR and merge-group run: a normal run must pass, and the forced failure
must remain red despite a successful diagnostic retry. Read back the protection
configuration and confirm the check name and expected app before declaring rollout
complete.

At implementation time (2026-09-09), GitHub returned HTTP 403 for both branch
protection and rulesets: this private repository needs GitHub Pro or public
visibility to enable those features. Required-check activation is therefore an
external rollout blocker. The environment is still main-only; enabling reviewed
PR and merge-group deployment access is also a prerequisite. Neither a checked-in
workflow nor a passing local run proves that branch protection is active.

References: [Clerk users API](https://clerk.com/docs/reference/backend-api/tag/users/post/users),
[Clerk organizations API](https://clerk.com/docs/reference/backend-api/tag/organizations/post/organizations),
[GitHub environment restrictions](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
