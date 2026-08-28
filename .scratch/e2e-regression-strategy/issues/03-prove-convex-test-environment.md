# Prove an Isolated Convex E2E Environment

Type: research
Status: resolved
Research branch: `research/e2e-convex-environment`
Expected asset: `docs/research/e2e-convex-environment.md`

## Question

What officially supported Convex deployment and data-control model should a browser E2E suite use to deploy current functions, integrate Clerk auth, seed deterministic scenarios, isolate parallel workers or runs, clean up after failure, and make production access impossible? Distinguish browser E2E needs from the repo's existing in-memory `convex-test` coverage.

## Answer

Use one freshly recreated Convex cloud preview deployment per CI shard, backed only by a preview deploy key and paired with the dedicated Clerk development application. Partition workers by Clerk organization and application-data namespace, seed and reset through guarded idempotent Convex functions, and layer cleanup through per-case reset, next-run preview recreation, and preview expiry. Keep `convex-test` for exhaustive backend behavior. The current ignored `convex/_generated` directory and `build` script's nested `convex dev --once` create a bootstrap decision that must be resolved before implementing the E2E workflow.

Detailed evidence is committed at `docs/research/e2e-convex-environment.md` on `research/e2e-convex-environment` (`592a2f0a839125a7e87181a2cd92b467248c675a`).
