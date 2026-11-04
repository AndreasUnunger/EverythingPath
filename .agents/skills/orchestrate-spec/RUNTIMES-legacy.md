# Legacy CLI runtimes

Reached only when a run uses `scripts/orchestration/spawn.sh` and `await.sh` (their headers give the usage) instead of T3 `delegate_task`. Current dispatch is the T3 section of [`RUNTIMES.md`](RUNTIMES.md); these mappings do not establish the current T3 role selection.

- `spawn.sh` puts `docs/agents/orchestration/roles/common.md`, then the role file, at the top of every worker's prompt, and `curate.sh` does the same for a curation brief. `.claude/agents/*.md` are thin wrappers that point at the role files; each role file still tells a worker whose prompt lacks `common.md` to read it.
- `spawn.sh reviewer --author sol` still selects Claude; it is a compatible legacy CLI route, not proof of the current T3 selection. Prior Opus-authored work can still use the read-only Sol CLI reviewer. Legacy `spawn.sh reviewer` keeps its cross-model mappings and issue snapshots; it cannot stand in for T3 evidence.
- Legacy numbered worktrees and branches (`impl/<n>`, `cur/<n>`, `../ep-impl-<n>`, `../ep-cur-<n>`) and numbered queue arguments stay supported by the scripts.

## Claude Code

- **Dispatch:** the Agent tool, with `run_in_background: true` for implementers. Choose the worker with `subagent_type` (the project's agent definitions in `.claude/agents/`) and `model` when the overlay's role table says so.
- **Wait:** a background agent or command notifies you when it finishes. Do other work until the completion notice arrives.
- **Resume implementation:** SendMessage to the implementer's agent ID within its authorized task. Each review round instead starts a fresh independent reviewer under the overlay.
- **Load a skill:** call the Skill tool with its name, or tell a worker to do so in its brief.
- **Nested workers:** run nested subagents in the foreground (`run_in_background: false`). Background completion notices never reach a nested agent.
- **Shell jobs** (gates, landing scripts): Bash with `run_in_background: true`. Long-running waits belong in a script file. A `pgrep -f` or `pkill -f` pattern must never appear in the waiter's own command line.

## Codex CLI

- **Start:** `codex exec -m gpt-6.1-sol -c model_reasoning_effort=high --sandbox workspace-write -c sandbox_workspace_write.network_access=true -C <integration worktree> --add-dir <main checkout> --add-dir <run directory> --add-dir <worktree parent>`. Each writable root has one job, and nothing else is writable:
  - **`<main checkout>`:** landing fast-forwards it, and its `.git` holds every worktree's metadata (`.git/worktrees/`), so rebases and commits need it.
  - **`<run directory>`** (`$EP_ORCH`): briefs, logs, run records, answers and comment drafts.
  - **`<worktree parent>`** (the main checkout's parent): workers' worktrees and the gate's clean checkouts are created beside the main checkout. Anything else there stays out of bounds, and the pinned sources (`~/repos/everythingpath/sources/`) are read-only on disk too: they're kept `chmod -R a-w`, and `curate.sh` refuses to run while any file there is writable, printing the `chmod` to run.
  - **Network:** `gh` comments and issue reads need it.

  Scratch goes under the run's TMPDIR in `.ep-tmp`, never `/tmp`.
- **Dispatch:** `spawn.sh <role> --brief <file>`. It starts the role's worker detached and prints a run ID.
- **Wait:** `await.sh <id>... --timeout <seconds>`. It blocks until any run finishes, then prints the run ID, its exit code and its report path. Call it again for the rest. Keep each call under your shell timeout.
- **Resume:** start a new run of the same role, with a brief that points at the worker's earlier report and at what to fix. Codex workers keep no context between runs.
- **Load a skill:** skills live in `.agents/skills/<name>/SKILL.md`. Load them as Codex loads skills, or read the file directly. Tell a worker the same in its brief.
- **Quota:** a worker exits 75 on a provider usage limit. Pause that lane and report; don't retry. Report a blocked required UI role rather than deferring it.

## Legacy record-review procedure (`spawn.sh reviewer`)

Promotes drafted records from a `spawn.sh` reviewer run; T3 promotion reviews use [T3 review evidence](../../../docs/agents/orchestration/t3-reviews.md) instead. An agent report without run evidence cannot give a receipt.

1. The review brief names each record to confirm and asks for a verdict on each one.
2. Write the IDs the report confirms, one per line, to `$EP_ORCH/briefs/<n>-receipt-ids.txt`; `node --import tsx scripts/catalog-record-review.ts --list` in WT prints every record's status, receipt and ID. Leave out any the review didn't confirm; they stay drafted.
3. In WT: `node --import tsx scripts/catalog-record-review.ts --run $EP_ORCH/runs/<run id> --ids $EP_ORCH/briefs/<n>-receipt-ids.txt`. It refuses a run that isn't a finished reviewer run with a report, a record that isn't drafted, and a record the review didn't see as it is now: `spawn.sh` saves each reviewer run's `reviewed-records.json` (every record's ID, source hashes and payload hash) and its `reviewed_commit` when the review starts, for both runtimes. It checks the ledger's consistency only once the records are checked, so drafted merges and same-KEY splits can be promoted, and writes nothing if that fails. It adds the receipt (run id, report SHA-256, each record's ID, source hashes and payload hash) to `scripts/catalog/review-receipts.json`, commits a byte-identical copy of the run's report snapshot as `scripts/catalog/review-reports/<run id>.md`. `spawn.sh` takes that snapshot (`report.snapshot.md`, with its SHA-256) when the review finishes, from the `--report` file the reviewer wrote, else its final message; the step never reads the `--report` path or `report.md`, which can change later, and marks the records checked under it.
4. Commit as `wip: #<n> review receipt`, and run `pnpm test tests/catalog/review-receipts.test.ts`.

The legacy curation review: fill `docs/agents/orchestration/templates/review-curation.md` (`<N>`, `<WT>`, `<BRANCH>`, `<ORCH>`) into `briefs/curation-<n>-review.md` and launch the `reviewer` agent or `$S/spawn.sh reviewer --author sol --worktree <wt> --brief <brief> --report $EP_ORCH/briefs/curation-<n>-review.out.md`.

The legacy curation dispatch: `$S/curate.sh <n> <notice|content> [extra-notes-file]`, or `$S/spawn.sh curator <n> <notice|content> [--brief extra-notes-file]`. It creates the worktree, writes `briefs/curation-<n>.md` from the curator role and the template, and runs Sol. The curator leaves its changes uncommitted and does no git operations. Exit 75 means a Codex usage limit: pause the lane. Legacy numbered prep and landing: `$S/cur-prep.sh <n> "$EP_ORCH/briefs/cur-<n>-msg.txt"`, `$S/land-queue.sh <n>...`; for numbered branches an explicit `cur/<n>:<path>` works too. The separately authorized legacy landing CLI remains `land-queue.sh [--dry-run] "$BRANCH:$WT"` (curation: `"cur/<n>@$BRANCH:$WT"`); worktree removal: `git -C $MAIN worktree remove "$WT" && git -C $MAIN branch -d "$BRANCH"`.
