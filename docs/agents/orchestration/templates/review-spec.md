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

Save the report to `<ORCH>/briefs/<N>-review-spec.out.md` before you finish.
