# Runtimes

How the orchestrator dispatches, waits for and briefs workers. `SKILL.md` names the roles and the steps; this file names the mechanics. Current dispatch is T3. The Claude Code and Codex CLI routes through `spawn.sh` and `await.sh` are in [`RUNTIMES-legacy.md`](RUNTIMES-legacy.md); read it only when a run uses them.

**Reviews cross models:** the reviewer is the other model from the one that authored the work. The overlay's role table (`docs/agents/orchestration.md`) names each selection.

## T3 Code

- **Selection:** resolve the role table against `orchestrator_capabilities` once per session, record IDs and options under Now in `open-decisions.md`, and re-resolve only after a refused dispatch.
- **Dispatch:** `delegate_task` with the explicit provider instance, model and every option, and `mode:"async"`. A separate coding checkout uses `isolation:"worktree"` from the parent's committed base (uncommitted changes are not copied). Verify the returned provider, model and every effective option against the request; an unsupported selection stops the dispatch. Keep the task ID and the app-owned branch and path, and work in that worktree with the shared `EP_ORCH`.
- **Waiting:** dispatch is async. Between dispatch and the completion notice do other queue work or end the turn. `task_status` answers a stale notice or an owner question, not a wait. Bounded jobs: one `await.sh <id> --timeout 7200` in a background shell, never repeated slices.
- **Completion** is task/run status, including `workState` and pending child runs, not a saved report.
- **Review rounds:** each is a fresh independent `delegate_task` with a distinct stable `clientRequestId`, carrying what [runbook §7](../../../docs/agents/orchestration/runbook.md#7-fix-round) lists; never another round on the backing child thread. Reviews that promote records need [T3 evidence](../../../docs/agents/orchestration/t3-reviews.md) before dispatch.
- **Resources:** T3 workers do not inherit `spawn.sh`'s resource wrapper. The brief tells them to hold a curator slot only while a heavy command runs, to run it through `$EP_ORCH/capped.sh`, and to leave gates and preps to bounded units. Numbers: `$EP_ORCH/resource-policy.md`.
- **Outward operations:** no PR, issue close or Cloud operation; the only push is a frozen landing candidate as `gate/<label>` (overlay, GitHub).

## Writing briefs

- Start with `docs/agents/orchestration/roles/common.md`, then the role file, then the brief.
- Name the worktree, the branch, the report path and the TMPDIR (`~/repos/everythingpath/.ep-tmp/<task>`). A T3 brief names the actual provider/model/options, frozen commit, app branch/worktree, shared `EP_ORCH`, durable inputs/report and task/run completion criterion.
- Name launch outcome, included records/behaviors, demonstrated dependencies, excluded owners/remaining acceptance and shared-path behavior outside the selection. Preserve supported behavior or explicitly refuse unsupported inputs.
- Give testable completion criteria and one impact-based validation plan; use the runbook's evidence reuse and invalidation procedure.
- Point at the spec, the tickets, the notes and the commits instead of quoting them.
- Say which skills to load (`tdd` for implementers; reviewers get a review template).
- Say what the worker must not touch: the main checkout, env files, the shared stash, and git, if the worker's sandbox can't write `.git`.
