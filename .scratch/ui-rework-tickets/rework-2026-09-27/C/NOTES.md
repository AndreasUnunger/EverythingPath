# C: Characters & officers, Finished weeks, Campaign home

## Deviations
- **#180 → T32b is inverted.** `getTeamManagerMaxTeams` sets 1 for `other_npc` and uses Charisma for `officer_npc`. Normalizing both to `npc` in #180 would erase that distinction, so the role-aware rule (T32b) ships first. T32b needs only #179's adapters and T15b.
- **#180 is blocked by #173.** The migration upgrades #173's versioned envelope, which main doesn't have yet.
- **#182** needs both #180 and T32b.
- **#183:** #175 supplies the conflict flow and #176 the affected-choice helper and restoration. #178 leaves the People & officers fallback that #183 removes.
- **#184+#186** no longer wait on #185. Audit paging uses the existing renderer.
- **#185** is blocked by #179, T21b and #169 (the renderer).
- **#182** manager links open Teams locally once #176 ships. A link target isn't a host, so #176 is not a blocker.
- The T15b and T21b link titles are provisional.
- IDs are partitioned strictly between the split tickets.

## Ruleset Version order
#158 → T15b → T32b. No other ticket in #141, #146 or #147 allocates a version.
