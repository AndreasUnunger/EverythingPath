# E2E gate parallelization: can it go faster without weaker evidence?

Short answer: **yes.** The fixture model was designed for per-worker cohorts. The safe unit of parallelism is **one Clerk cohort (member org + outsider org + 3 users) per concurrently running Playwright worker**. It is not tests sharing a cohort. The critical path afterwards is `canonical-workspace`, so it must be split too.

## Where the time goes (nightly, slot-0)

| Run | Tests pass | Deploy+build | Browser stage | Sum of test durations | Fixture CLI calls |
|---|---|---|---|---|---|
| `WTH1EO` (latest full pass) | 19/19 | 29 s (web build 4 s) | 887 s | 879 s | ~140 × ~1.1 s ≈ 155 s |
| `vfgGhJ` | 19/19 | 38 s | 804 s | 796 s | ≈ 150 s |
| `fUSm2x` | 19/19 | 32 s | 791 s | 781 s | ≈ 175 s |
| `XxSqla` | 3 failed, 2 timed out | 45 s | 889 s | 872 s | ≈ 158 s |

Per journey (WTH1EO): `canonical-workspace` 242 s (190 s in vfgGhJ, growing with every UI-rework step), `canonical-confirmation` 134 s, `canonical-persistence` 121 s, `access` 46–50 s ×4 projects, the other 11 each take 11–25 s, and auth takes 11 s. The **tests are ~93 % of wall time**. Serial setup (Clerk verification + workspace copy, not timed, about 20 s; preview create/deploy/build ≈ 30–45 s; Playwright/webServer ≈ 8–17 s) is small. Fixture calls spawn one Convex CLI process each: ~1.0–1.4 s per call, about 18 % of browser time.

Ideal scheduling of WTH1EO (longest-first, excluding auth): 1 worker takes 868 s, 2 take 438 s, 3 take 292 s, and 4+ take 242 s (the floor is `canonical-workspace`).

## 1. Existing isolation, and what blocks more workers

Already built:
- The fixture index is `(namespace, workerKey, caseKey)` (`convex/e2eFixtures.ts:47-57`). Every call is capability-guarded per worker and case (`e2e/fixtures/catalog.ts:171-197`). Tokens are generated per worker (`e2e/bind-preview.ts:17-29`).
- Resources already take a `workers[]` array with enforced distinct orgs and users (`catalog.ts:86-121`). Provisioning loops over all workers (`e2e/support/bootstrap.ts`).
- Worker-owned Clerk projections refuse cross-worker overwrite (`convex/e2eFixtures.ts:124-154`). Role storage is named `${workerKey}-${role}.json` (`e2e/support/fixtures.ts:161-165, 184-188`).
- Cohorts map to Playwright `parallelIndex` (`fixtures.ts:86`). Case claims are per `project-worker` (`fixtures.ts:98-103`, `case-attempt.ts`).
- The preview name regex already allows `slot-N` and `pr-N-shard-M` (`catalog.ts:86`).

Hard gates to one worker: `playwright.config.ts:17-18` (`fullyParallel:false, workers:1`), `run.ts:53-57` (only `worker-0`), `fixtures.ts:87` (`parallelIndex !== 0` throws), `auth.setup.ts:10,16` (seeds and signs in `workers[0]` only), the slot lock `run.ts:69-70`, and CI `concurrency: e2e-ci-slot-0` (`e2e.yaml:23`, `e2e-nightly.yaml:17`). README:363 and README:668 record one-worker isolation as an owner-approved invariant.

Leakage risks if concurrency were added naively:
- **Same case key across projects.** `smoke`, `existingMilitia` and the rest are reused by the chromium, webkit and firefox projects. `canonicalPersistence` (+ `isolation` comparison) is shared by cutover, workspace, persistence and confirmation (`*.spec.ts` `test.use`). On one cohort, a concurrent `resetCase` deletes another test's live graph (`e2eFixtures.ts:65`).
- **Org-wide campaign list (#187).** `/campaigns` auto-selects `campaigns[0]` (`src/components/campaign-home/home-state.ts:105`). `exerciseCampaignHome` expects this case to be selected, and the outsider org to show "No campaigns yet" (`campaign-home.ts:33-58`). Legacy redirects expect the same selection (`shell-navigation.ts` legacy loop). Any second campaign in the member org breaks or confuses these checks. Serial runs rely on the best-effort `cleanupCase`, whose failures are only logged (`fixtures.ts:110-118`).
- **Clerk Frontend API limits:** 5 sign-in creations and 3 attempts per 10 s per IP. Backend (dev): 100 req per 10 s. Parallel auth setup for several cohorts would exceed this.
- **Convex:** 16 concurrent mutations on Starter, 256 on Pro. Several workers are fine on Pro but marginal on Starter.
- **Shared filenames:** `cutover-evidence.json` and fixed `canonical-*.png` names are written by exactly one test each. That stays safe only while no test is duplicated.

## 2. Options

| Option | Gain (from timings) | Needs | Credibility risk |
|---|---|---|---|
| **a. N workers, N cohorts, one preview** | 3 workers: ~880 s → ~330–400 s browser (292 s ideal + contention); run ≈ 450–520 s | 2 extra cohorts (6 users, 4 orgs); lift the 4 gates; auth loops all cohorts **sequentially** (~11 s each) | Low, **if** one cohort = one worker (orgs disjoint, so no list leakage). CPU contention can cause false *reds*, not greens |
| **b. Browser projects sharded by worker** | Same as (a); pinning projects to cohorts adds nothing | Same as (a) | Same as (a). Plain Playwright `--shard` across processes needs (c) |
| **c. Several preview slots** | 2 slots ≈ 440 s tests + 2× setup ≈ 520 s; more CI minutes | Preview name per slot, lock and CI group per slot, per-shard resources, a merged aggregate over shards | Lowest data risk (separate DBs), but two builds and deploys to prove identical and an aggregate that must merge exact identities |
| **d. Cut serial overhead** | Deploy/build caching saves ≤ 30 s. Fixture calls through a persistent admin HTTP client instead of a CLI spawn: est. 100–130 s | Resolve the preview URL and admin key once, keeping them private | Low for assertions. Adds a new secret-handling path; keep the same guarded internal functions. Don't skip preview recreation |
| **e. Split `canonical-workspace`** | Critical path 242 s → ~60 s pieces, so 4 workers ≈ 200 s | 4–5 new case keys; boundaries already exist at `resetCase` (`canonical-workspace.spec.ts:416, 518, 720, 778`) | Low. Each piece installs its own `controlNextDraftEdit` (it is shared today, lines 352, 669-670). The only loss is the "one long-lived session across phases" coverage; keep it explicitly in one piece |
| **f1. CI browser install** | Minutes inside the CI `E2E_DEADLINE` (`e2e-runner.yaml` install step) | Run the job in `mcr.microsoft.com/playwright:v1.63.0-noble` | None; matches the verified local container |
| **f2. Longest-first ordering** | Keeps (a) near its ideal | Order the projects in `matrix.ts` | None |

Rejected: `fullyParallel` or several workers **on one cohort**. That brings #187 list leakage and case collisions.

## 3. Credibility rubric applied

| Rule | a | c | d | e |
|---|---|---|---|---|
| Isolation (incl. org lists) | ✔ disjoint orgs per worker; add a canary | ✔ | ✔ | ✔ new keys |
| Separate multi-device sessions | ✔ unchanged (gm/player/outsider are separate users and contexts) | ✔ | ✔ | ✔ |
| No new retries, same timeouts | ✔ config unchanged (`retries` CI 1, `failOnFlakyTests`, first-attempt only) | ✔ | ✔ | ✔ `test.setTimeout` split proportionally, never raised |
| Reproducible, exact identities | ✔ record `workerKey` in progress evidence | needs a merged identity check | ✔ | identities change: catalog update needs owner approval |
| Production denylisted | ✔ same preview binding | ✔ one binding per slot | ✔ keep `guardFixtureScope` | ✔ |
| Assertions identical | ✔ | ✔ | ✔ | moved, not changed; diff must show only boundaries |

## 4. Recommendation (in order)

1. **(e) Split `canonical-workspace`** at its four `resetCase` boundaries into 5 tests. Changes: `e2e/fixtures/catalog.ts` (caseKeys, `fixtureCatalog`, `deploymentFixtureSchema.cases`), `convex/e2eFixtures.ts:21` validator union, `e2e/bind-preview.ts` tokens, `convex/canonicalPersistenceFixtures.ts:24` (allow the workspace case set), `e2e/support/matrix.ts` identities, and the catalog regression test. On its own this changes nothing about speed, but it is required for step 2 to pay off.
2. **(a) 3 cohorts, 3 workers.** User provisions `worker-1` and `worker-2` in `e2e/.private/resources.json` and `e2e/resources.ci.json` (+clerk_test users, via `e2e:provision --bootstrap`). Changes: `playwright.config.ts` (`workers: 3`, `fullyParallel` stays false), `run.ts:53-57` (require ≥1 distinct cohorts, `workers ≤ cohorts`), `fixtures.ts:87` (require `parallelIndex < workers.length`), `auth.setup.ts` (seed and sign in every cohort sequentially), README invariant text. **Expected: ~450–520 s nightly, and ~300–350 s once (e) is in.** Update the README invariant with owner approval.
3. **(f1)** Run the CI job in the Playwright container. **(f2)** Put the long projects first.
4. **(d)** Measure first, then replace per-call CLI spawns with one guarded client if the saving holds.
5. **(c)** only if one machine saturates.

**Verification:**
- Run serial (`workers:1`) and parallel on the same commit and fingerprint. Both must show all 19+ exact identities first-attempt with 0 errors; compare durations per test.
- Add an **isolation canary**: an internal `inspectOrganization` check after each `resetCase` that fails if the cohort org holds any campaign other than the owned or comparison cases, and that the outsider org is empty.
- Prove the canary goes red: temporarily force two tests onto one cohort.
- Run 5 consecutive parallel nightlies with 0 flakes before retiring the serial baseline.
- Record `workerKey` per test in `progress.json`.
