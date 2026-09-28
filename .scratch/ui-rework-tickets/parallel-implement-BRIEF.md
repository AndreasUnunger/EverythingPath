# Parallel implementation brief (#148 tickets, started 2026-09-27)

You implement exactly ONE ticket, following the repo's `/implement` skill (`.claude/skills/implement/SKILL.md`). In short, the steps are:

1. Implement the ticket.
2. Use `/tdd` at pre-agreed seams.
3. Typecheck and run single test files regularly.
4. Run the full test suite once at the end.
5. Review the work with `/code-review`.
6. Commit.

Eight tickets are running in parallel, each in its own git worktree.

## Where you work
- You are in an isolated git worktree. Stay in it. Check with `git rev-parse --show-toplevel`.
- **Never touch the main checkout** at `/home/andreas/repos/everythingpath/everythingpath`: no edits, git commands, installs or servers there. Another session is actively working in it on Upkeep #156–#158. The only exception is reading this brief and the files under `.scratch/`.
- Worktree setup:
  - `pnpm install --offline --frozen-lockfile`. If a package is missing, use `--prefer-offline`. If pnpm picks an empty store, add `--store-dir /home/andreas/.local/share/pnpm/store/v10`.
  - Copy `.env` and `.env.local` from the main checkout if anything needs them.
- **Base.** Your worktree may be created from `main` (`eef41f7`) by mistake, so check first with `git log --oneline -1`. You must start at the current tip of `implement/148-ui-rework`. If you don't, and you have no commits yet, run `git reset --hard implement/148-ui-rework`. Then record `BASE=$(git rev-parse HEAD)` before your first commit.
- **Other agents on the machine.** The main checkout is also used by an E2E agent running browser gates. Heavy load from you can skew its timings, so keep heavy commands behind the shared lock.

## Models: who writes what
- You are the orchestrator for this ticket. You write everything except the presentation layer yourself: domain and rule logic, Convex schema and functions, validators, state and hooks, data adapters, tests and integration.
- **Delegate the presentation layer to sub-agents with the Agent tool and `model: "fable"`, always in the FOREGROUND (`run_in_background: false`).** Background completion notices don't reach you, so you'd stall waiting for them. The same goes for `/code-review` reviewers. That means React components' JSX, layout, styling, responsive tablet/phone/desktop behaviour, accessibility markup and visual states. Give them precise contracts: the props/hooks you provide, the prototype focus line and screenshot, and the spec's layout acceptance. Review what they produce, and integrate and test it yourself.

## Sources to read first
1. The ticket: `gh issue view <n>`.
2. The owning spec, including its §3 "Reference screenshots and deviations" and §6 Validation.
3. The linked decision comments where needed.
4. `CONTEXT.md`, AGENTS.md, and the relevant `docs/*.md`.

- Rules come from `docs/ai/ironfang-militia/`.
- Prototypes are visual reference only, and each spec lists behaviour not to copy. To run one, see the "How to run a pinned prototype" section in #148. If you run a dev server, use only your assigned port.
- If you hit a genuine spec ambiguity, follow #148's traceability rule: cite the conflicting sources. Resolve it conservatively if you can. Otherwise stop that part and report it; don't invent behaviour.

## TDD seams
Treat the owning spec's §6 "Validation and coverage" and the ticket's acceptance criteria as the pre-agreed seams. No separate user confirmation is needed. Before writing tests, list the seams you will test in your final report.

## Commands and shared resources (the machine is shared by 8 agents)
- **Typecheck:** `pnpm -s typecheck`, run freely. It now also typechecks `convex/tsconfig.json`, whose library target is ES2023, matching Convex's current template, so modern built-ins such as `Array.at()` are fine. **Single test files:** `pnpm -s test <path>`, run freely.
- **Heavy commands must be serialized with the shared lock:**
  - `flock /tmp/ep-heavy.lock pnpm -s lint`
  - `flock /tmp/ep-heavy.lock pnpm -s test`, the full suite, once at the end
  - `flock /tmp/ep-heavy.lock pnpm -s rules:check`, once at the end. It runs the suite and checks the rule-coverage tags; it must end with 0 errors. Never drop a `[rules.X]` tag when rewriting a test, and never reuse one on a second test. Give the second test its own tag, and register it if the script requires that.
- **Browser scenarios.** `canonical-workspace` is now five independent journeys, each with its own fixture case: Upkeep, Notoriety, Recovery through Activity and Event, Persistent, and Confirmation. Add your browser steps to the journey that owns your phase. Don't add page loads or waits to journeys that are already near their time limit. Never change timeouts, deadlines or budgets.
- **Do NOT run `pnpm test:e2e` or `e2e:provision`.** The isolated-preview gate recreates one shared named preview and holds an exclusive lock. It will run once after integration. Do write or update the browser scenarios your ticket needs, and make sure they typecheck.
- **Do not deploy to or mutate any Convex deployment** (dev, preview or prod). If Convex generated files need refreshing, use the repo's documented offline method (`pnpm check:convex-generated` and the docs). If that's impossible offline, report it.
- **Do not push**, and do not open PRs. **Do not change GitHub issues:** no comments, edits or closes.

## Capability inventory
Update `docs/ui-capability-inventory.md` for shipped work only, in a **separate final commit**. The other branches will conflict on it, so the integrator may redo that commit by hand.

## Review and commit
- Commit your work to your worktree's current branch using conventional commit messages that reference the ticket, e.g. `feat: … (#159)`, as earlier commits do. End each message with:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
- When the implementation is done, run `/code-review` with fixed point `$BASE`. Fix real findings, then commit again.

## Final report (at most 250 words)
Include:
- the branch name and worktree path
- the commit list
- the seams tested
- the actual results of typecheck, lint and the full suite, with counts
- which browser scenarios were written but not run
- review outcome, as findings fixed or remaining
- files most likely to conflict with the other parallel tickets
- any spec ambiguity or unfinished acceptance criteria. Be honest: don't claim anything you didn't verify.
