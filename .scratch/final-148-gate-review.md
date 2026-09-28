# #148 completion gate review (read-only)

Reviewed on 2026-09-28 at `implement/148-ui-rework` `9589fe1`. Sources: the #148 body and its 3 comments (including the [2026-09-27 amendment](https://github.com/AndreasUnunger/EverythingPath/issues/148#issuecomment-5855238252)), the native sub-issue tree, `docs/ui-capability-inventory.md`, baseline `66697d0` (PR #105), `ff01a54` (PR #136), `e2e/`, `convex/*.test.ts`, local gate artifacts in `e2e-artifacts/` and `coverage/`. I ran no checks myself. Per-area acceptance is left to `.scratch/final-area-review-A.md` and `-B.md`.

## Verdict

| Gate item | Result |
| --- | --- |
| 1. Twelve child specs closed | **FAIL**: all implementation tickets are closed, but 10 of the 12 area specs are open |
| 2. Capability inventory | **FAIL (documentation)**: all 183 IDs are present and every removal is approved, but 30 rows are stale "gate pending", 23 rows cite no coverage, and a merge with `main` will bring back #136's 700 lines of "planned" sections |
| 3. Isolation, multi-device, viewports, Confirmation and history | **PASS with one gap**: Characters & officers has no browser layout check at phone or desktop sizes |
| 4. Typecheck, lint, tests, E2E equivalence, linked evidence | **PARTIAL**: tests, `rules:check` and E2E are green at HEAD, but typecheck and lint have no recorded result at HEAD, and the evidence exists only locally |
| 5. #94 | **PASS**, with a caveat: it closed before the owning area #147 and before any merge |

## 1. Child specs

Checked through the GraphQL `subIssues` tree of #148.

- **Implementation tickets:** all 44 in-scope tickets are closed as COMPLETED: #149–#159, #161–#173, #175–#180, #182–#185, #187, #189–#197.
- **Closed as NOT_PLANNED:** #160, #174, #186 and #188 were absorbed by the amendment's merges. #181 was closed on 2026-09-28 because production has no live rows to migrate: all 6 are `pc`, the user confirmed no data changes before release, and #180 normalizes writes ([comment](https://github.com/AndreasUnunger/EverythingPath/issues/181#issuecomment-5864452449)). That is consistent with the amendment's rule of "no scope dropped", because the migration would have converted zero rows.
- **Closed area specs:** #135 Navigation shell and #137 Week frame.
- **Open area specs:** #140 Upkeep, #142 Activity, #143 Event, #144 Persistent, #145 Review & confirm, #138 Setup, #139 Militia corrections, #141 Characters & officers, #146 Finished weeks and #147 Campaign list/home. Each still needs its acceptance and "Shippable when" review (review files A and B), then closing.
- **Not merged:** every completion comment says "committed locally … not yet merged to `main`". The branch is 98 commits ahead of `origin/implement/148-ui-rework`, whose head is `1d4093b`.

## 2. Capability inventory

### Counts

`docs/ui-capability-inventory.md` has **183 ID rows** with no duplicates:

| Group | Count |
| --- | --- |
| Original baseline IDs (identical at `66697d0` and at `d438dd1^`) | 160, **none missing** |
| New IDs planned by #136 (ACT-19; CAMP-07–12; CHAR-10–13; HIST-08; LEDG-11–13; NAV-17; SETUP-24–27; STATE-07; WEEK-19) | 22, **all present** |
| New ID added during implementation (NAV-18, bounded Week host) | 1 |

No ID cited in any area spec, ticket body or comment is missing from the inventory. No row is still marked "planned".

### Classification

Browser keys are those in the E2E scenario table.

| Class | Count | IDs |
| --- | --- | --- |
| Shipped, browser E2E recorded as passed | 111 | all rows not listed below |
| Shipped, browser E2E marked **"written, gate pending"** or **"written, not yet run"** | 30 | NAV-13, CAMP-03, CAMP-12, SETUP-22, SETUP-24, SETUP-26, UPK-04, UPK-05, UPK-07, UPK-08, UPK-10, PER-01, PER-06, SUM-02, SUM-05, HIST-02, HIST-03, HIST-04, HIST-08, LEDG-03, LEDG-04, LEDG-11, CHAR-01, CHAR-02, CHAR-03, CHAR-04, CHAR-08, CHAR-10, CHAR-12, STATE-02 |
| Shipped, unit or component tests only | 16 | UPK-09, ACT-14, ACT-15, ACT-18, EVT-02, EVT-05, EVT-06, EVT-10, EVT-11, EVT-12, EVT-14, HIST-07, LEDG-07, LEDG-08, LEDG-09, LEDG-10 |
| Shipped, **no coverage cited** (E2E column is `—`) | 23 | NAV-05, NAV-08, SETUP-09–14, SETUP-16, UPK-02, PER-10, **SUM-09**, **SUM-11**, CHAR-05, CHAR-06, CHAR-07, CHAR-09, **CHAR-11**, **CHAR-13**, STATE-01, STATE-03, STATE-04, STATE-05 ("see those") |
| Removed or retired as a whole | 3 | ACT-03, PER-05, PER-09 |

Notes on the classes:

- **The 30 pending rows are stale.** Gate `everythingpath-e2e-YIg0cp` started at 08:28:45Z, 22 s after `9589fe1` was committed. It passed **40/40 with 0 retries**, so every journey written at HEAD passed. Its `sourceFingerprint` is `20d5ded…`. The rows still need to cite that run.
- **The 23 rows without cited coverage** were mostly `—` in the baseline too, so this is not a regression. Tests do exist for CHAR-11 and CHAR-13 (`src/lib/officer-board.test.ts`, `characters-page.test.tsx`) and for SUM-09 (`summary-view.test.tsx`), but the inventory doesn't cite them.
- **#136 promises that are unmet:** #136 promised "Add browser coverage" for **SUM-09** and "Add browser assertions" for **SUM-11**. Both still have no browser coverage.

### Removals and approvals

Every removal matches an explicit approval that #136 also accounted for:

| IDs | Approval |
| --- | --- |
| NAV-01 and NAV-03 | [#102](https://github.com/AndreasUnunger/EverythingPath/issues/102#issuecomment-5831173561) |
| NAV-09 | [#120](https://github.com/AndreasUnunger/EverythingPath/issues/120#issuecomment-5846493929) |
| PER-05 and PER-09 | [#109](https://github.com/AndreasUnunger/EverythingPath/issues/109#issuecomment-5837634317) |
| EVT-13 buttons | [#108](https://github.com/AndreasUnunger/EverythingPath/issues/108#issuecomment-5837858373) |
| CHAR-01 panel | [#114](https://github.com/AndreasUnunger/EverythingPath/issues/114#issuecomment-5844673552) |
| CHAR-09 fragments | [#119](https://github.com/AndreasUnunger/EverythingPath/issues/119#issuecomment-5846266381) |
| Partial WEEK-18 retirement | [#155](https://github.com/AndreasUnunger/EverythingPath/issues/155#issuecomment-5853745587) |
| ACT-03 | "approved in #106" |
| SETUP-19 hint | "approved #113" |
| WEEK-15 per-die entry | "#107/#122" |

The last three cite issue numbers without comment permalinks, but #136 lists them as approved. The only baseline browser coverage that was lost is ACT-03's `slot`, and ACT-03 is retired.

### Documentation defects to fix

1. **The branch was cut from `eef41f7`, before #136 (`ff01a54`) merged to `main`.** `git merge-tree HEAD origin/main` merges cleanly, but the result appends #136's "Planned implementation ownership" sections (inventory lines 416–1115), which say "planned … not a claim that … shipped". Before or during the merge, these sections must be reconciled with the shipped rows: dropped or rewritten.
2. **WEEK-15 cites a deleted file.** Its "Where" cell lists `team-recovery.tsx`, which was deleted in `b572755` (#156).
3. **"Observations" is stale.** It still says campaign creation and history navigation have no browser coverage.

## 3. Isolation, multi-device, viewports, Confirmation and history

### Gate-wide evidence

- **Isolation canary:** every nightly run applies it, per `e2e/support/process.ts:189`, `e2e/README.md` and the `isolation` fixture in `e2e/fixtures/catalog.ts`. The #158/#172/#194 comments record "isolation check clean on 42 of 42 resets".
- **Browser matrix:** tablet on Chromium and WebKit at 1194×834, phone on Chromium at 390×844 and desktop on Firefox at 1440×900. In-journey resizes add 844×390 and other sizes.

### Per area

| Area | Membership/campaign isolation | Multi-device | Viewports | Contracts and compatibility |
| --- | --- | --- | --- | --- |
| #135 Nav | outsider on every section (`shell-navigation.ts:80`), `campaign-shell.test.tsx` | departure guard, More sheet | phone, tablet, desktop and 844×390 | `legacy-addresses`, `legacy-week-links` |
| #137 Week frame | `ws` outsider (STATE-07) | `ws` independent navigation; WEEK-19 notice on both devices | six-size frame checks (`week-frame.ts`, `responsive-shell.ts`) | — |
| #140 Upkeep | `canonicalDraftPersistence` P79 outsider or mismatched campaign | staged Remove on two devices; live return check | `workspaceUpkeepLayout` (passed in YIg0cp) | `roll-compatibility`, legacy arrays (#154) |
| #142 Activity | same authority test | `slot` | activity phone, tablet and desktop | — |
| #143 Event | same authority test | `ws:event` | event phone, tablet and desktop | Ruleset Version regression (#191) |
| #144 Persistent | `persistentEventProjection` | `ws:persistent` | phone, landscape, tablet, desktop and panel closed | — |
| #145 Review & confirm | `canonicalHistory` P86 | racing Confirmations journey | reviewer-summary phone, tablet and desktop | `canonical-confirmation` contract, stale and delayed rejection |
| #138 Setup | `canonicalSetup` "[setup.authority] outsiders cannot initialize" | other member follows accepted setup (`setup-workspace.ts:203`) | phone and tablet screenshots; desktop only via Firefox `existing` | envelope v1→v2 migration |
| #139 Militia corrections | `militiaCorrection` "outsiders cannot correct" | two-player `slot` #176 steps | `militia-phone` at 390 on all four browsers | reference restoration tests |
| #141 Characters | `characterKindCompatibility` outsider and signed-out rejection; `acceptedCampaign` `[ledger.shared]` | `ledger` two-session conflict | **tablet only** | kind compatibility |
| #146 Finished weeks | `canonicalHistory` "listing requires membership and stays within the campaign and militia" | WEEK-19 | history phone, tablet and desktop | immutable records ("closed drafts stay immutable") and `canonical-cutover` |
| #147 Campaign home | `campaign.integration` rejects outsider and mismatched writes; `home` outsider | second member watching | three sizes × four browsers, plus skeleton | — |

**Gap: Characters & officers (#141).** `character-ledger` runs only on the Chromium and WebKit tablet projects. The phone and desktop layouts of the board, table and record dialog (CHAR-10's "two across on phones", CHAR-12's "phone inline, desktop floating panel") have no browser check. Shell checks at phone sizes only confirm that the Characters region renders. The area reviewers should confirm whether #141's acceptance requires this.

Physical-device limits are recorded in the inventory as known limits, not as verification.

## 4. Checks, E2E equivalence and linked evidence

### Checks at HEAD (from recorded evidence only)

- **Unit tests and `rules:check`: pass.** `coverage/rules-tests.json` and `rules-evidence.json`, generated 08:27:30Z, record **2,208/2,208 tests passed in 217 files**, 0 errors and 469/488 cases covered with 29 explicit gaps. Their `sourceFingerprint` `20d5ded…` equals YIg0cp's, so these checks ran on the same source as the green gate at HEAD.
- **Browser gate: pass.** YIg0cp passed 40/40. The "production application server: failed" line in `stages.log` also appears in every green run, so it is teardown noise.
- **Typecheck and lint: no recorded result at `9589fe1`.** The last recorded pass is #183's completion comment at `3fd61d3`. After that, `1da1fba` and `9589fe1` changed 9 `src` files, `globals.css` and 2 e2e files. `tsconfig.tsbuildinfo` was modified at 10:25 local time, which suggests a typecheck ran, but no result is recorded. **Remaining:** record `pnpm typecheck && pnpm lint` at HEAD.

### Completion comments on the 44 closed tickets

- **Evidence present:** every comment names a gate run and commit SHAs, plus typecheck and lint.
- **Unit-test results missing:** the #158, #172 and #194 comments don't state them. They cite the wave-2 run `tgDave`, which was 26/27, with its one failure in #164's step. #194 has no browser surface (#185 carries it).
- **Evidence can't be followed from GitHub:** all gate IDs point to git-ignored local `e2e-artifacts/`, and most cited SHAs (for example `3fd61d3`, `76a7b23`, `ae0bf02`, `8ca8c2a`, `1606b38`) are unpushed.

### E2E equivalence

The rework didn't delete any `e2e/` file (`git diff --name-status d438dd1^ HEAD -- e2e` shows only additions and modifications).

All 19 pre-rework nightly identities in `d438dd1^:e2e/support/matrix.ts` are present in today's matrix and in YIg0cp's 40 results. The old list was: authentication; cutover; the workspace Upkeep journey; persistence; confirmation; 5 critical journeys × Chromium tablet and WebKit tablet; Firefox access, existing and complete-week; phone access.

The only rename is a deliberate one: `complete-week` changed from "…and reloads its outcome" to "…, every device moves to the next week once it is usable, and the outcome survives reload".

The mandatory set of 10 is kept as well. Scenarios added since: 4 journeys split from access on every project, and 5 extra workspace parts. The 6 original baseline scenario keys are still used; `access` was split into `home`, `access-parts` and `shell`, with CAMP-01, 04 and 05 moved to `home`.

## 5. #94

#94 closed as COMPLETED on 2026-09-27 at 18:19Z, together with #187, with the comment "Resolved by #187" and gate `9y4QG8` 27/27. The body says to "resolve it when that feature [Campaign list/home] is delivered". #187 delivers the creation form, so this is consistent in substance. However, owning area #147 is still open and nothing is merged or deployed. That is acceptable if "delivered" means implemented on the branch. If it means shipped, #94 should be reopened until then.

## What remains before #148 can close

1. Finish the area reviews (A and B), fix what they find, and close #140, #142, #143, #144, #145, #138, #139, #141, #146 and #147 against their "Shippable when" criteria.
2. Record `pnpm typecheck` and `pnpm lint` passing at the final HEAD, with the existing 2,208 tests and `rules:check` result, or rerun all of them on the final commit.
3. Update the inventory:
   - Replace the 30 "written, gate pending" and "not yet run" markers with YIg0cp (or the final gate).
   - Cite the existing tests for the 23 uncovered rows, at least CHAR-11, CHAR-13, SUM-09 and SUM-11.
   - Fix WEEK-15's deleted `team-recovery.tsx` and the stale Observations bullet.
4. Add the browser coverage #136 promised for SUM-09 and SUM-11, or record an explicit waiver.
5. Resolve the Characters & officers phone and desktop browser-coverage gap, or confirm that #141 doesn't require it.
6. Merge `main` (`ff01a54`/#136) into the branch, and rewrite or remove the reintroduced "Planned … ownership" sections so the inventory claims shipped status only.
7. Push and merge the branch (98 unpushed commits) so the SHAs cited in the completion comments resolve. Run a final nightly gate on the merge commit.
8. Refresh #148's "Implementation progress" section, which stops at #156, and decide whether #94 stays closed before #147 ships and merges.
