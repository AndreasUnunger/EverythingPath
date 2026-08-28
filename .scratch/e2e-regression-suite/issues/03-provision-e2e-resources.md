# 03: Provision the Non-Production E2E Resources

**What to build:** Give trusted local and CI executions a dedicated Clerk development fixture cohort, a Convex preview deployment capability, explicit production denylists, and safely stored configuration while keeping untrusted code completely secretless.

**Blocked by:** 02: Build the Safe Playwright and Fixture Harness.

**Status:** ready-for-human

- [ ] A dedicated Clerk development application contains the declared admin/GM-fixture user, player/member user, outsider user, organization, memberships, and roles.
- [ ] The explicitly enabled idempotent bootstrap can create or repair that cohort, while a normal run only verifies it and reports fixture drift.
- [ ] Non-secret cohort identifiers are available to the harness without embedding credentials.
- [ ] The Clerk secret and Convex preview deploy key are stored only in approved local and CI secret stores.
- [ ] Explicit Clerk and Convex production denylists cover every known production target.
- [ ] A trusted smoke run passes preflight and reaches only the declared development and preview resources.
- [ ] Fork and dependency-update jobs cannot receive service secrets and perform only safe secretless checks.
- [ ] No credential or reusable auth state appears in source, tickets, logs, reports, or retained artifacts.
