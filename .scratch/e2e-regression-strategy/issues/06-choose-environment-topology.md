# Choose the E2E Environment and Data-Isolation Contract

Type: grilling
Status: resolved
Blocked by: 02, 03, 11

## Question

Which local and CI topology should bind Next.js, Clerk, and Convex together, and what isolation unit should tests own: run, worker, browser context, organization, campaign, or another boundary? Decide provisioning, deterministic seeding, unique naming, cleanup, failure recovery, secret boundaries, safeguards against production access, and whether browser setup should exercise Clerk webhooks or seed the equivalent Convex identity projection while testing webhooks separately.

## Answer

Use the same production-style topology for local full-E2E runs and CI: a backend-free Next.js production build connected to a freshly recreated Convex cloud preview and a dedicated Clerk development instance. Playwright owns the frontend server lifecycle on an available localhost port. Fast local iteration remains in Vitest and `convex-test`; there is no lower-parity browser-E2E mode based on `next dev` or a persistent Convex development deployment.

Use a nested isolation contract rather than treating any one resource as the universal isolation unit:

- A CI shard or local execution slot owns one disposable Convex preview.
- A Playwright worker owns one persistent Clerk organization and two-user identity cohort.
- A test case owns one synthetic campaign-root fixture and every related record.
- A browser context owns only one authenticated session; it is not a data-isolation boundary.

Use stable, sanitized resource names: `e2e-pr-<number>-shard-<index>` in CI and `e2e-local-<developer>-slot-<index>` locally. Serialize or cancel overlapping executions for the same slot. Recreate the named preview at the start of every run so a failed or cancelled predecessor cannot contaminate its successor.

Provision persistent Clerk development users, organizations, memberships, and roles only through a separately invoked, idempotent bootstrap guarded by `E2E_ALLOW_FIXTURE_WRITES=true`. Normal runs verify the declared cohort without modifying Clerk. Fixture drift fails before preview creation and reports the exact bootstrap command required. Authorized local runs and CI use the same dedicated Clerk development instance with separate cohorts; contributors without its secrets retain the complete secretless test suite.

Keep a versioned synthetic fixture catalog in the repository and provider-specific user and organization identifiers in external non-secret configuration. A guarded Convex harness combines them into a temporary manifest through four operations:

- `seedSuite` verifies or upserts the exact Clerk identity projection and returns the fixture manifest.
- `resetCase` idempotently removes and recreates one case's campaign graph.
- `inspectCase` exposes deterministic state for diagnostics and assertions.
- `cleanupCase` removes only one case's campaign graph.

Every operation is internal, requires `E2E_ENABLED=true`, and validates an `e2e-` namespace, fixture version, worker key, and case key. Tests address domain objects by stable fixture keys rather than generated Convex IDs or display text. Time-dependent and random values are explicit fixture inputs. Browser setup seeds the same user and organization projection that Clerk webhooks would create; it does not deliver webhooks to ephemeral previews. Webhook verification and projection remain a separate HTTP/backend integration concern.

Use this configuration boundary:

- Convex preview defaults own the Clerk development issuer/hostname and `E2E_ENABLED=true`.
- CI or ignored local secret storage owns the preview deploy key and Clerk secret key.
- Non-secret run configuration owns cohort identifiers, execution owner/slot, fixture version, and production denylists.
- The deployment workflow injects `NEXT_PUBLIC_CONVEX_URL` into `pnpm build:web`.
- Browser setup creates fresh, ignored per-role authentication states for every run; they are never retained as artifacts.
- Browser previews do not receive a Clerk webhook secret.

The canonical lifecycle is: fail-closed preflight; read-only Clerk cohort verification; preview recreation and backend deployment plus frontend build; Convex identity and suite seeding; frontend start and fresh GM/player authentication; case reset before every initial attempt and retry; browser-context creation only after reset; then best-effort case cleanup. Reset-before-attempt is the correctness mechanism, while teardown is only hygiene.

Do not add a broad Convex management credential merely to delete previews. Recovery is layered through best-effort case cleanup, reset before retry, recreation of the stable preview name on the next run, and Convex preview expiry. Retain a failed preview temporarily for diagnosis and reconsider immediate deletion only if deployment quotas become an observed problem.

Before any network write, one preflight must reject runs unless Clerk keys have development/test prefixes, the Convex credential is a preview deploy key, the preview name starts with `e2e-`, inherited production deployment targeting is absent, and resolved Clerk/Convex targets are outside explicit production denylists. Secret-backed browser E2E runs only for trusted code; fork and Dependabot jobs run the secretless checks and skip this integration job.
