# Merge plan: 8 parallel tickets into `implement/148-ui-rework` (prepared 2026-09-27)

**Status: ready.** #163's final commits (labels `fa4564d`) are included; the simulation was re-run on 2026-09-27.

- **Target:** `implement/148-ui-rework` at `e5c4e90` (#156 complete). Merge in the main checkout; the only uncommitted files there are `.agents/skills/code-review/SKILL.md` and `skills-lock.json`, belonging to another session, so leave them alone.
- **Method:** `git merge --no-ff <branch>`, one ticket at a time, keeping the agents' commits. After each merge, run `pnpm -s typecheck` and that ticket's test files before moving on.

## Order and predicted conflicts (in-memory `git merge-tree` simulation)

| # | Ticket | Branch | Predicted conflicts | Resolution |
|---|---|---|---|---|
| 1 | #197 history query | `worktree-agent-aeee419badaec1270` | inventory | Combine the rows |
| 2 | #179 character kinds | `worktree-agent-a1871c8e9d56f62b3` | `militia-setup/form.test.tsx` (1 hunk, about 89 lines, against #156) | Keep both sets of tests |
| 3 | #187 campaign home | `worktree-agent-a3dd61b48c1bb7299` | none | — |
| 4 | #195 Setup editors | `worktree-agent-a970e33df0215b9f2` | `form.tsx` (9 lines); `roster.tsx` (236 lines, a rewrite); inventory | `form.tsx`: keep #156's `stagedChoiceNotice` prop and "Staged choices this week" panel in the rehosted form. `roster.tsx`: keep #195's rewrite and re-apply #179's 3-line change (a stored `npc` stays selectable via the shared kind helper) |
| 5 | #159 Activity slots | `worktree-agent-a764bae8230aee600` | `activity-view.test.tsx` (about 87 lines) | Keep #159's version and re-add the `week:` fixture field from #187 |
| 6 | #167 Persistent endings | `worktree-agent-a01fae2bd72bc60f6` | `activity-view.tsx` (161 lines, #159's rewrite); `summary-messages.ts` (9 lines); inventory | Keep #159's view and re-apply #167's anchor (`id={activitySlotAnchor(slot.slotId)}`, `tabIndex={-1}`, plus the import). Combine the message changes |
| 7 | #169 Review | `worktree-agent-acfb78bfb89a0ab70` | `summary-facts.ts` (6 lines); `summary-messages.ts` (3 small hunks) | Combine. #167 removed the buyoff-cost warning, so it must not come back |
| 8 | #163 Event preparation | `worktree-agent-a612faa6069bcb64f` | `event-view.tsx` (207 lines, #163's rewrite); `activity-facts.ts` (event-option labels against #159); `summary-facts.ts` and `summary-messages.ts` (small); inventory | Keep #163's view and re-apply #167's anchor (`id={eventOccurrenceAnchor(occurrence.eventId)}`, `tabIndex={-1}`, plus the import). In `activity-facts.ts`, keep #159's structure but use #163's hierarchical event labels for the event options. Combine the Summary files |

## Problems git won't flag (check after all merges)

1. **The workspace result needs `week` (from #187).** Test fixtures added on other branches that call `workspaceSourceSchema.parse(...)` without `week` fail at runtime, not at typecheck. New call sites: #159 (3), #163 (3), #167 (1), #169 (1). Add `week: <draft>.week` to each.
2. **Hierarchical event labels (from #163).** Anything in #167 or #169 that shows or asserts an "Event N" string, such as Summary lines, Persistent ended-elsewhere text or e2e locators, must use the new labels (1.1, 2A…). #163 says the likely places are carried-event "Event N" names in Persistent (#167) and the reference facts, plus any `.number` or `Event ${index + 1}` built for current-week events. Its rules: active top-level events are numbered in resolution order (automatic, rolled, then one number per candidate set, e.g. 2A/2B), then events not used this week. Nested events extend the parent: 1.1, 2A.1, 1.1.1.
3. **`npc` character kind (from #179) and Setup editors (from #195).** Check that the rehosted roster editor and the correction form still offer a stored `npc`, and that the #179 compatibility tests pass on the merged tree.
4. **Summary ownership overlap (#167 and #169).** The six-section renderer (#169) must not bring back the legacy buyoff-cost warning that #167 removed. Its one warnings list now carries #167's filtering.
5. **`gp-money` field rename (from #156).** No branch uses `parseGpInput` in new code; confirm with `rg "\.status" src | rg -i gp`.

## Inventory doc

Every branch updated `docs/ui-capability-inventory.md`, mostly in separate commits. Resolve each conflict by combining the rows, since each ticket owns different capability IDs. At the end, re-read the whole file once so there are no duplicated or contradictory rows, especially the NAV/CAMP/WEEK/SUM rows touched by several tickets.

## Verification after all eight

- On a quiet machine, run once each: `pnpm -s typecheck`, `pnpm -s lint`, `pnpm -s test`. The timeout flakes seen under load should disappear.
- **Browser gate:** one full isolated-preview run with `pnpm test:e2e`. It recreates the named preview deployment, so confirm before running. It covers the scenarios the agents wrote but never ran: #159, #163, #167, #169, #187 and #197.
- Then `/code-review` of the whole integration against `e5c4e90`, focusing on the combined files.

## Afterwards (needs sign-off)

- GitHub: completion comments on the eight tickets, then close them. Leave #94 open until the browser gate passes.
- Remove the eight agent worktrees and branches.
