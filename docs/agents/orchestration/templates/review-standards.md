# Standards review brief (PRD #251 run)

**Review scope:** the full declared support boundary, unless a fix-round section at the end of this brief narrows it. Broader unfinished acceptance stays with its owner unless a launch dependency or regression is demonstrated.

For an initial review, use `git -C <WT> diff <BASE>...<COMMIT>` and `git -C <WT> log <BASE>..<COMMIT> --oneline`. Review exactly `<COMMIT>`.

Read the relevant parts of these sources:
- `<WT>/docs/standards.md`, and the Real-Time Collaboration Contract in `<WT>/docs/product/militia-board.md` for militia sync
- `<WT>/.claude/skills/deslop/style.md`
- `<WT>/.claude/skills/typescript-best-practices/`
- `<WT>/.claude/skills/codebase-design/SKILL.md`
- `<WT>/GLOSSARY.md`, the glossary
- `<WT>/convex/_generated/ai/guidelines.md`, for Convex code
- `<WT>/docs/agents/generated-artifacts.md`, when generated artifacts or their budgets change
- the conventions of the code around each change

For generated artifacts, judge whether repeated information can be referenced or generated on demand, and accept or reject each budget disposition; the gate verifies receipts, hashes and sizes. Correct decoded data alone does not establish an acceptable storage design.

Baseline smells, all judgement calls; a documented repo standard overrides them: Mysterious Name, Duplicated Code, Feature Envy, Data Clumps, Primitive Obsession, High Cyclomatic Complexity (more than 10 paths; Python, shell and JavaScript only, since lint measures TypeScript), Repeated Switches, Shotgun Surgery, Divergent Change, Speculative Generality, Message Chains, Middle Man. Lint enforces positional parameters (`max-params`), cyclomatic complexity in TypeScript (`complexity`), more than one component per file (`react/no-multi-comp`), tests bound to their environment (the `test-hygiene` block) and `toThrow()` without a message (`vitest/require-to-throw-message`), so they are not reviewer duties; don't report them.

Report, by file and hunk:
- (a) every place the diff breaks a documented standard, citing the source file and rule;
- (b) every baseline smell you spot.

Convex index names follow `by_a_and_b`, except that a name may abbreviate or drop `_and_` when the full name would exceed Convex's 64-character limit; don't flag those. Mark each finding as a hard violation or a judgement call. Skip anything that tsc, eslint or knip already enforce. Number the findings, and keep the report under 400 words. Parent-disposed deferrals appear once under Carried, never as findings.

Start the report with exactly two lines: line 1 is the verdict alone, exactly `LAND`, `LAND once fixed` or `FIX FIRST` (no formatting), and line 2 is `Reviewed: <full SHA of the commit you reviewed>`. You may answer `LAND once fixed` only when X is machine-checkable, for example a stale count or a commit message; then the last line of the report is exactly one line `LAND once fixed: paths=<p1>,<p2>; message=yes|no; check=<command or expected value>`: the files the repair may change (comma-separated repo paths; empty for none), whether it may change the commit message, and how to check it. Write no other line containing `LAND once fixed:`, not even quoted or in a code block. The gate grants a repair only from that header and that last line, and refuses a repair outside it; a `LAND` or `FIX FIRST` report grants none. Any other finding that must be fixed before landing gets an ordinary fix round. This review covers Standards only; Spec is a separate review.

Save the report to `<ORCH>/briefs/<N>-review-standards.out.md` before you finish.
