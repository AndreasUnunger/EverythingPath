# Safe browser harness

Issue #23 supplies the harness and a two-member smoke test. Dedicated service
provisioning and the required CI gate are tracked separately in #24. Normal runs
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
creates fresh ignored role storage and runs the Chromium smoke at 1194×834 with
touch enabled. It starts with one authenticated worker. Local runs acquire an
exclusive slot lock under `e2e/.private`; CI must additionally serialize by the
preview name across machines. After an ungraceful process termination, verify no
run still owns the slot before removing its exact stale lock directory.

In CI, use a reviewed push or dispatch with `E2E_REVIEWED_SHA=GITHUB_SHA`.
Fork PR, `pull_request_target`, bot and unknown CI invocations are refused. The
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

Only upload `e2e-artifacts/<previewName>/`, with 30-day retention. The custom
reporter keeps safe assertion messages, test outcomes and timings; auth setup
errors are replaced with a fixed diagnostic. `stages.log` records stage outcomes,
not raw CLI/service output. Failed multiplayer contexts retain application-page
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
