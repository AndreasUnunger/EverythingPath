**Characters & officers is complete.** Every implementation ticket is closed: #179, #180, #182, #183 and #196. #181 was closed as not planned: a read-only production check found no legacy rows, and the user confirmed there will be no data changes before release.

**Delivered**
- Record-owned PC/NPC kinds with atomic roster mirrors (#180), after the compatibility expand step (#179).
- Role-aware manager limits and the commandant Hit Dice fallback under Ruleset Version 8 (#196).
- The six-role officer board, an alphabetical character table and one validated Add/Edit dialog, which Setup reuses (#182).
- Correct roster and Correct officers with safe cascades, sharing the Militia correction lifecycle. The Militia People & officers fallback is retired (#183).
- **Final-review gaps closed:** phone and desktop passes for both correction modes. They exposed a real bug: during a breakpoint change, for example rotating or resizing mid-correction, the save point grabbed focus and the Assign picker swapped elements, closing menus and losing Escape. It's fixed in `9839bcf` and `349ad0c`, with component tests that reproduce it.

**Verification** (`implement/148-ui-rework`):
- Typecheck and lint pass. `rules:check` passed 2,231 tests with 0 errors at `349ad0c`.
- **Final nightly gate:** `everythingpath-e2e-fX7jhJ`, **42/42 on the first attempt**, parallel on 3 cohorts, with the isolation check clean.
- **Capability accounting:** `docs/ui-capability-inventory.md` records every Characters & officers capability exactly once, with its shipped location and coverage (`7184b37`). The legacy-kind readers and the Setup envelope v1 migration are listed in `docs/legacy-compatibility-inventory.md`.

The code is committed on `implement/148-ui-rework`, and a PR to `main` follows.

**Tracked follow-ups (not blocking):**
- Joining the roster should create missing facts for characters added before Setup.
- The conflict and "week changed" messages still take focus when a resize remounts them.
