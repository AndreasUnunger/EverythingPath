# 01: Establish the Backend-Free Build Boundary

**What to build:** Make a clean checkout capable of typechecking and building the Next.js application without selecting or mutating a Convex deployment. Preserve the combined local development workflow while making deployment an explicit operation that binds a frontend build to one intended preview.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The generic build and explicit web build complete without Convex credentials or deployment side effects when given safe public configuration.
- [ ] Convex generated runtime utilities, declarations, and required AI guidance are available in a clean checkout and are treated as reviewable generated output.
- [ ] The combined local development command still runs the backend and web processes and refreshes generated output after backend edits.
- [ ] Any hosting path that previously relied on an implicit backend deployment uses an explicit deployment command instead.
- [ ] A disposable-preview rehearsal performs exactly one intended deployment and binds the frontend build to that preview.
- [ ] CI detects unexpected generated-code drift after deployment-time generation.
