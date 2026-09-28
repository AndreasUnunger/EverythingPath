## Amendment (2026-09-27): parallel work and right-sized tickets

User decision on 2026-09-27: work proceeds in parallel, and the unstarted implementation tickets are resized. This **supersedes the strict twelve-area shipping chain** from the [rollout decision](https://github.com/AndreasUnunger/EverythingPath/issues/122#issuecomment-5846600504) and from each area spec's "Routes and rollout" section, **for blocking purposes only**. Designs, payloads, scope, acceptance criteria and capability ownership are unchanged.

### Rules
- A ticket is natively blocked only by a real technical, data or contract dependency: code, schema or a contract it builds on; a UI host it renders inside; or ordered Ruleset Version allocation. Each ticket's **Blocked by** section gives the reason for every edge.
- Area-to-area chain edges (#140 → #142 → #143 → #144 → #145 → #138 → #139 → #141 → #146 → #147) are removed. An area still closes only when all of its tickets and its "Shippable when" criteria are met.
- The app stays shippable after each delivery. Existing editors stay reachable until their specified replacement works, even when a replacement ships out of the old area order.
- Ruleset Versions are allocated in order: T10 / #158 → T15b / #{{T15b}} → T32b / #{{T32b}}.
- #154, #155 (done) and #156 (in progress) are unchanged.

### Merges (the absorbed ticket is closed as not planned; no scope dropped)
- T12 / #160 → T11 / #159
- T26 / #174 → T25 / #173
- T38 / #186 → T36 / #184
- T40 / #188 → T39 / #187

### Splits (new tickets are sub-issues of the same owning spec)
- T13 / #161 → + T13b / #{{T13b}}: information, mission and event-influence actions
- T15 / #163 → + T15b / #{{T15b}}: Roll Twice candidate rule under the next Ruleset Version
- T16 / #164 → + T16b / #{{T16b}}: officer-check and persistent-producing events
- T17 / #165 → + T17b / #{{T17b}}: calm, morale, narrative and training events
- T21 / #169 → + T21b / #{{T21b}}: frozen Resolution Records through the shared six-section presentation
- T24 / #172 → + T24b / #{{T24b}}: shared Setup editors, validators and warning descriptors (consumed by Militia corrections)
- T32 / #180 → + T32b / #{{T32b}}: role-aware manager limits and commandant Hit Dice fallback (ships before #180's kind normalization)
- T36 / #184 → + T36b / #{{T36b}}: bounded finished-week listing query and record creation dates

### Resulting shape
The number of open tickets goes from 34 to 38, and the longest remaining dependency chain goes from 34 steps to 6. Ready once their blockers are done:
- **Now:** #159, #163, #167, #169, #179, #187, T24b / #{{T24b}}, T36b / #{{T36b}}
- **After #156:** #157 and #158

Drafts, before-state backups and the publish script are kept locally in `.scratch/ui-rework-tickets/rework-2026-09-27/`.
