# Usability fixes on PR #198 (2026-09-28): shared brief

You fix a small set of findings from `.scratch/usability-review-2026-09-28.md` in the main checkout, which you may read. Other agents are fixing other findings in parallel, each in its own worktree. Read AGENTS.md first.

## Verify before fixing
The review was written from screenshots and code, and some of its line numbers and measurements are wrong. For example, it called the phone strip chevrons 40px, but they measure 45px, because `html { font-size: 18px }` makes every rem-based Tailwind size 1.125× larger. So for each finding:
1. Confirm the problem exists in the current code.
2. Check the owning spec. The area specs are GitHub issues #135–#147: read them with `gh issue view <n>`, including linked decision comments where relevant.
   - If the spec explicitly **requires** the current behaviour, do NOT change it. Report the conflict, citing the spec text, and propose the change for the user to decide.
   - If the spec is silent or compatible, fix it.
3. Keep the fix to the finding. No unrelated refactors.

## Out of scope: do not touch
- Tap-target sizes and the Event `<summary>` expanders (findings A1, B2, B3, B4). The user explicitly deferred these.
- The phone bottom bar, the section skeletons and the input-field contrast. These were just fixed.

## Who writes what
You are the orchestrator. You own diagnosis, logic, state, tests and integration. Delegate presentation-layer work (JSX, layout, styling, responsive behaviour, accessibility markup) to a sub-agent through the Agent tool with `model: "fable"`, ALWAYS in the foreground (`run_in_background: false`). Background completion notices never reach you, so the same applies to `/code-review` reviewers. Give the sub-agent a precise contract, then review and integrate its output.

## Worktree
- You are in a git worktree. Stay in it.
- Run `git log --oneline -1` first. It must show `7a3cdcc`, the tip of `implement/148-ui-rework`. If it doesn't and you have no commits, run `git reset --hard implement/148-ui-rework`.
- Record `BASE=$(git rev-parse HEAD)`.
- Install with `pnpm install --offline --frozen-lockfile`.
  - If a package is missing, use `--prefer-offline` instead.
  - If pnpm picks an empty store, add `--store-dir /home/andreas/.local/share/pnpm/store/v10`.
- Copy `.env` and `.env.local` from the main checkout if anything needs them.
- Never edit the main checkout `/home/andreas/repos/everythingpath/everythingpath` or run git in it. Reading `.scratch/` and `e2e-artifacts/` there is fine. The real screenshots from the latest green gate are in `e2e-artifacts/e2e-local-andreasununger-slot-0/everythingpath-e2e-PQFYGH/`.

## Rules
- Never read `e2e/.private/test-secrets.env`.
- Checks:
  - `pnpm -s typecheck` and single test files: run freely.
  - Heavy commands go through `flock /tmp/ep-heavy.lock`: `pnpm -s lint`, and at the end the full `pnpm -s test` and `pnpm -s rules:check` once each. `rules:check` must end with 0 errors.
  - Never drop or reuse a `[rules.X]` tag.
- Always `set -o pipefail` when piping. Never use bare `git stash`.
- Dev server: only on your assigned port. Never use port 3001.
- **Do NOT run `pnpm test:e2e` or `e2e:provision`.** Three agents share one E2E preview, and the integrator runs the gate after merging. DO write or update the browser assertions your change needs, keep them typechecking, and never weaken assertions or raise timeouts.
- No Convex deploys, no pushes, no PRs, no GitHub edits (reading issues is fine).
- Update `docs/ui-capability-inventory.md` only if a capability's shipped location or behaviour changes.
- Commit conventionally on your worktree branch, e.g. `fix(review): … (#198)`. End each message with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. Before the final commit, run `/code-review` against `$BASE` with reviewers in the foreground, and fix any real findings.

## Final report (≤250 words)
- Branch, worktree path and commits.
- Per finding: whether it was confirmed, the spec check, what changed, or why it was left unchanged.
- Actual typecheck, lint, test and rules:check results, with counts.
- Browser assertions written but not run.
- Files likely to conflict with the other agents.
- Don't claim anything you didn't verify.
