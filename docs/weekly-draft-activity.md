# Ordered Activity projection (#68)

`projectActivity(draft, snapshot)` takes the canonical Weekly Draft and the
projected **post-Upkeep** snapshot (`projectUpkeep(...).outcome`). It folds slots
in order and returns a partial outcome, ordered baseline change plan, check
modifier explanations, retained slots, requirements, warnings, and team/check
usage for subsequent phase work. Carried Low Morale and Double Agent penalties
apply to Activity checks once, including when queued copies also exist. It never
writes state or applies Table
Adjustments. Missing inputs leave the projection unready.

The implemented actions are Change Officer Role, Dismiss Team, Drill Militia,
Recruit Team, Upgrade Team, and Lie Low. Other actions explicitly require
resolution; they cannot silently produce a ready, incomplete plan. The next
Activity extraction extends this same fold.

Each eligibility warning uses `choiceId:ruleId`; an exception matches the
choice identity and rule ID and requires a reason. Rule IDs currently include
`action-capacity`, `team-capacity`, `team-condition`, `team-action-limit`,
`team-upgrade-limit`, `upgrade-tree`, `treasury`, `maximum-rank`, `drill-limit`,
`lie-low-exclusivity`, `officer-pc`, `officer-role-limit`, and `recruit-tier`.
Exceptions permit choices without changing costs, dice arithmetic, or removing
required references. Higher-tier recruitment has no rules-defined check/DC:
its exception therefore also requires `recruitmentCheck`. Tier-1 recruitment
always uses its published check/DC, regardless of that field.

Recruitment allocates the stable domain team identity `recruit:<choiceId>`;
subsequent choices can reference it. Upgrades preserve that identity, manager,
condition, exemption, name, and notes. Strategist changes affect later slots;
the first slot beyond the rank allowance receives the Strategist bonus while
a Strategist is assigned. Removing the assignment retains occupied extra slots
and requires an exception before resolving them.

This canonical slice remains isolated from live legacy campaigns under the
accepted #55 cutover sequence. Legacy drafts lack raw dice, independent team
identities, and complete officer facts, so they cannot faithfully delegate the
whole ordered calculation. Existing live consumers switch together when the
canonical Workspace/persistence cutover lands. No legacy scenarios were deleted.

`rules-activity.test.ts` asserts named outcomes and ordered recomputation.
`activityProjection.integration.test.ts` compares the browser bundle with the
same projection of a persisted Convex draft for all six actions. The existing
isolated browser harness protects the currently supported application path;
it does not claim the future canonical Workspace UI is already connected.

Verification for this extraction (2026-09-11): typecheck and lint; 572 tests in
63 files; rules catalog validation with zero errors; and the mandatory browser
journeys on disposable preview `e2e-local-andreasununger-slot-0`. Standards and
spec review findings were addressed, including stale Strategist provenance and
Helpful settlement eligibility/one-use consumption. The catalog retains explicit
gaps for subsequent extraction and cutover work.
