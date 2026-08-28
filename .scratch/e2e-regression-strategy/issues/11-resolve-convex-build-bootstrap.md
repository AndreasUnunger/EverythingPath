# Resolve the Convex Build Bootstrap Contract

Type: grilling
Status: resolved
Claimed by: AndreasUnunger
Blocked by: 03

## Question

Should the repository follow Convex's documented generated-code convention by tracking `convex/_generated` and adding a backend-free `build:web` command, or retain ignored generated output and use a two-deploy transitional bootstrap in E2E? Decide the permanent build boundary, how current local development remains ergonomic, and what evidence is required before changing the existing `build` command.

## Answer

Adopt a source-controlled generated-code boundary and reject the transitional two-deploy bootstrap. Track `convex/_generated`, including the Convex AI guidance required by this repository, so a clean checkout has the generated runtime utilities and TypeScript declarations needed to typecheck and build without first selecting or contacting a Convex deployment. Convex deployment commands may regenerate these files, but generated changes remain ordinary reviewable repository changes.

Make both `build` and an explicit `build:web` backend-free Next.js builds. A generic build must never implicitly select or mutate a Convex deployment. Hosting and E2E workflows own deployment explicitly and invoke the frontend boundary through `convex deploy --cmd "pnpm build:web"`, with `--cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL` when required. This yields one explicit deployment path rather than nesting `convex dev --once` inside a deploy command.

Preserve the existing local-development workflow: `pnpm dev` continues to run `dev:convex` and `dev:web` together; `dev:convex` synchronizes the personal development deployment and refreshes tracked generated files; and `dev:web` runs only Next.js against the generated files already in the checkout.

Require this evidence when implementing the change:

1. Audit the active hosting configuration. If it relies on `pnpm build` to deploy Convex implicitly, migrate it in the same change to the explicit `convex deploy --cmd "pnpm build:web"` boundary.
2. From a clean checkout without Convex credentials, run typecheck, lint, relevant tests, and `pnpm build:web` using safe non-production public configuration. This proves the checkout is self-contained and the build has no deployment dependency or side effect.
3. Rehearse the complete command against one disposable Convex preview. Confirm it creates only the intended preview, performs one deployment, and binds the frontend build to that preview URL.
4. Smoke-test `pnpm dev` and confirm backend edits still regenerate the tracked files without disrupting the combined local workflow.
5. After deployment-time code generation, fail CI if `convex/_generated` has an unexpected diff. Because Convex runs the `--cmd` frontend build before regenerating generated code, this catches a build that consumed stale checked-in declarations.
