# Standing owner decisions

These bind every orchestrator and worker until the owner changes them. Owner records are `$EP_ORCH/mvp-20261023/owner-decision-<date>-<topic>.md`; record a new decision here as one line with its date and a pointer.

## Workflow

- **Instructions (2026-10-08):** all workflow instructions live in the repo: `docs/agents/orchestration.md`, this folder and `scripts/orchestration/`. `$EP_ORCH` holds only run state.
- **Models and runtime (2026-10-27):** the [overlay role table](../orchestration.md#roles-and-models) is the current selection; coding work uses T3 worktrees with the shared `EP_ORCH`. Retain actual historical model/options and receipt formats; historical receipts keep their actual identities.
- **Authorization and failures (2026-10-27):** apply the runbook's explicit support boundary, delta review and evidence reuse procedure. Authorizing a run authorizes its specified successful local phase transitions once. Ordinary diagnosed implementation or fixture failures may be fixed and checked at the affected seam in the same task, without a new worker or parent permission handshake; a safe setup omission before any child launch may be corrected in-task with proof that nothing launched. Live gate failures and resource or observer safety events keep their evidence and need diagnosis before a fresh attempt; OOM never triggers an automatic retry. Full original-suite all-green, admission and promotion receipts and checked landing stay required.
- **Fix rounds:** no numerical cap; [runbook §7](runbook.md#7-fix-round).
- **Resources (2026-10-29, workers 2026-10-30):** `$EP_ORCH/resource-policy.md` is the source; read it before scheduling. All locks, caps, heaps, timeouts and the admission budget stay.
- **Remote heavy checks (2026-10-30):** a verified Boat manifest for the exact tree may replace or be compared with the local typecheck, lint and full suite: [remote heavy checks](operations.md#remote-heavy-checks).
- **Rebase-only reviews (2026-10-31):** a mechanical rebase of accepted work keeps its reviews: [mechanical-rebase proof](operations.md#mechanical-rebase-proof).
- **Single-axis fix reviews (2026-10-31):** when only one axis had findings, only that axis re-reviews: [single-axis fix review](operations.md#single-axis-fix-review).
- **Light landing lane (2026-11-01):** skip full gates when provably unnecessary, on a bounded-risk basis: [light landing lane](operations.md#light-landing-lane).
- Default gates are unchanged by these four modes. Pairs are excluded from all four; curation from the rebase proof, single-axis review and light lane.
- **Deployment boundary:** the campaign target is Convex Cloud production, but setup and implementation authorize no Cloud operation. Checks stay local unless separately authorized.
- **GitHub (D1, 2026-11-01):** comment on each issue as it lands. No PRs and no closes. The integration branch stays local; frozen landing candidates may be pushed to `origin` as `gate/<label>` so CI runs the heavy checks.
- **Content:** no made-up test cases or seeds; use published content, or homebrew a player can create in the app. Run a research check before review or coding on rules work, and a targeted example check before drafting issue text.

## Sources

- The pinned sources are in `~/repos/everythingpath/sources/`: foundryvtt-pathfinder1 v11.11 (418761d2) and pf1-content 11.4.0 (02f4ab0d). They're read-only on disk (`chmod -R a-w`), and `curate.sh` refuses to run while they're writable.
- Comparison sources are the PRD, PCGen and the books. AoN only for a few pages, never scraped. d20pfsrd only to find a name.
- No book PDFs for now. Non-CRB content may be admitted (2026-10-30, `owner-decision-20261030-notice-holds.md`). Every notice hold is cleared ([`notice-clearances.json`](../../../scripts/catalog/legal/notice-clearances.json)), and a matched, checked PCGen `OGL.txt` block counts as notice evidence for every candidate of its book. Content still needs its comparison evidence, and a cleared notice still needs a reviewed Registry identity. The owner supplies any notice text still owed before the final merge.
- The PRD and PCGen licences are sufficient; there are no book spot-checks.
- Archetypes and prestige classes come from the PRD and PCGen (#716). The remaining ~210 archetypes and 32 prestige classes are deferred.

## Curation lane

- The curator is the curation selection in the [overlay's role table](../orchestration.md#roles-and-models), and a reviewer samples each batch; every admission gets an admission review.
- Batches run typecheck, lint, the writer check, `catalog:pin`, the gates and their own tests. The orchestrator's post-rebase triage is the landing gate.
- Briefs require the shared Situations and must not break full-corpus `catalog:curate`.
- Record-level `3.5` tags are held, never excluded (2026-10-08).
- Trailing whitespace in notice keys is normalized: the text is stored trimmed, so `sha256(notice)` equals the key (2026-10-08).

## Settled behaviour

Product behaviour later tickets keep is in [`docs/product/settled-behaviour.md`](../../product/settled-behaviour.md).

## Hygiene

- **TMPDIR** is `<repo parent>/.ep-tmp/<run-id>` (`~/repos/everythingpath/.ep-tmp/`), never `/tmp` and outside every checkout: tests write scripts into it that run as ESM under the repo's `"type": "module"`. The orchestration scripts make one per run and remove it; a worker started without one makes its own there.
- Worktrees hold only `.env.example`; `.env*` files and `e2e/.private` are never read. The owner's uncommitted files and the shared stash stay untouched.
- **Machine load:** one heavy job at a time while the owner is using the machine.
