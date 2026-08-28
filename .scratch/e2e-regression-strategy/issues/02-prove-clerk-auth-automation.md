# Prove Safe Clerk Authentication Automation

Type: research
Status: resolved
Research branch: `research/e2e-clerk-auth`
Expected asset: `docs/research/e2e-clerk-auth.md`

## Question

What officially supported Clerk test setup and authentication flows can safely drive local and GitHub Actions browser tests with at least two users in one organization? Determine the applicable test-mode facilities, credential and storage-state handling, parallelism or rate constraints, and the guardrails that keep tests away from production.

## Answer

Use `@clerk/testing/playwright` against a dedicated Clerk development application with persistent GM/admin and player/member `+clerk_test` users in one fixture organization. A serial setup project should sign both users in through `clerk.signIn`, explicitly activate the organization, and generate separate per-run storage states for two browser contexts. Start the authenticated suite with one worker; parallelism requires a complete identity and organization cohort per worker. CI must reject live-key prefixes and production targets before writes, never upload auth state, and never run untrusted fork code with secrets.

Detailed evidence is committed at `docs/research/e2e-clerk-auth.md` on `research/e2e-clerk-auth` (`291464871cbcd40a12cee089585c5aa64916f4ba`).
