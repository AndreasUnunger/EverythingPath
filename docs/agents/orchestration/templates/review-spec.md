# Spec review brief (PRD #251 run)

**Review scope:** the full declared support boundary, unless a fix-round section at the end of this brief narrows it. Broader unfinished acceptance stays with its owner unless a launch dependency or regression is demonstrated.

For an initial review, use `git -C <WT> diff <BASE>...<COMMIT>` in <WT>. Review exactly `<COMMIT>`.

The spec is the ticket (`gh issue view <N>`) and the parent PRD (`gh issue view 251`), including the Implementation Decisions it cites and the acceptance appendix comment. Also check `<WT>/docs/pf-character-sheet-data-model.md` (an index; open the section files in `<WT>/docs/character-sheet/` it links), `<WT>/GLOSSARY.md` and `<WT>/docs/adr/`. The design-decision issues #201–#250 can be read with `gh issue view` (later resolutions override earlier ones).

Report:
- (a) required work that is missing or only partly done;
- (b) scope creep;
- (c) code that looks implemented but is wrong, including authorization holes, broken invariants and untested acceptance criteria;
- (d) if visuals changed, QA by reading the code against the approved prototype tag (`git -C <WT> show prototype-approved/<name>:<path>`).

You may run single test files read-only with `pnpm test <path>` in <WT>. Quote the spec line for each finding. Number the findings, mark each blocker, should-fix or nit, and keep the report under 400 words. Parent-disposed deferrals appear once under Carried, never as findings.

Start the report with exactly two lines: line 1 is the verdict alone, exactly `LAND`, `LAND once fixed` or `FIX FIRST` (no formatting), and line 2 is `Reviewed: <full SHA of the commit you reviewed>`. You may answer `LAND once fixed` only when X is machine-checkable, for example a stale count or a commit message; then the last line of the report is exactly one line `LAND once fixed: paths=<p1>,<p2>; message=yes|no; check=<command or expected value>`: the files the repair may change (comma-separated repo paths; empty for none), whether it may change the commit message, and how to check it. Write no other line containing `LAND once fixed:`, not even quoted or in a code block. The gate grants a repair only from that header and that last line, and refuses a repair outside it; a `LAND` or `FIX FIRST` report grants none. Any other finding that must be fixed before landing gets an ordinary fix round. This review covers Spec only; Standards is a separate review.

Save the report to `<ORCH>/briefs/<N>-review-spec.out.md` before you finish.
