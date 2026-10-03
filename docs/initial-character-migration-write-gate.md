# Initial Character migration write gate (#258)

This is the recoverable **pre-activation** window for the initial Character Sheet release. It is separate from the retired weekly-board cutover. No command here activates sheets, publishes a Catalog Release, deploys code, or publishes the site. Complete legacy reads continue while all migration inputs are frozen. The gate covers all currently registered Character writers, organization membership and ownership inputs, roster references, militia data, spell imports and aggregate maintenance, fixtures and administrative writers. The prepared sheet commands support shared campaign sheets and owner-only private demos without campaigns, including campaign archive/restore and private deletion. These lifecycle writers use the same gate and appear in the inventory below; broader lifecycle and production activation remain later work.

## Operator procedure

1. Prepare and independently verify the compatible backend, frontend build and immutable catalog manifest. Record their identities and the intended deployment. Building, deploying and publishing do **not** start maintenance or activate anything. Tell players to save before the window; unsaved input is not preserved across reload. Rehearse on isolated seeded data first. Use the existing deployment-selection/production-consent procedure before executing any write command.
2. Run the local inventory check, `pnpm -s check:initial-migration-writers`, and relevant tests. Query `initialMigration:status` on the selected deployment with `{now}` sampled as the current Unix time in milliseconds. Record its `epoch`, `closed`, `authority`, `budgetExceeded` and current run. Do not start if it is already closed or uses sheet authority. Missing control state means legacy authority, open, epoch 0.
3. Choose a unique `operationId`, a reviewed frontend build identity, catalog manifest identity and a positive `maintenanceBudgetMs`. Execute internal `initialMigration:start` with `{operationId, expectedEpoch, frontendBuild, catalogManifest, maintenanceBudgetMs}`. `expectedEpoch` is the recorded status value. Save the returned `{runId, epoch}`. Example command shape, after selecting the authorized deployment:

   ```sh
   pnpm exec convex run initialMigration:start '{"operationId":"rehearsal-unique-id","expectedEpoch":0,"frontendBuild":"reviewed-build-id","catalogManifest":"reviewed-manifest-id","maintenanceBudgetMs":900000}'
   ```

   These identity strings are recorded evidence, not validation of build/catalog readiness. Those gates belong to the later activation implementation.

4. Query internal `initialMigration:status` with a fresh `{now}`. Confirm `closed: true`, `authority: "legacy"`, the expected run and epoch, and the recorded `startedAt`/`deadline`. Save the response in the deployment's rehearsal record. Read campaigns, Characters, membership-scoped data, saved drafts and history through their normal queries. Try representative writes: they must return maintenance without changes. The same status query is safe for monitoring or recovering a lost response; resample `now` on every poll so `budgetExceeded` reflects elapsed time. For example:

   ```sh
   pnpm exec convex run initialMigration:status "$(node -p 'JSON.stringify({now: Date.now()})')"
   ```

5. Do not exceed the declared budget. Status reports `budgetExceeded: true` when the active Maintenance Window reaches its deadline; monitor it with fresh timestamps and abort promptly when preparation cannot finish. This ticket has no candidate backfill/resume/activation endpoint. Until those later tickets exist, rehearsal ends by aborting. An expired deadline does not automatically reopen: an automatic reopen could race future migration work. The operator explicitly aborts if preparation cannot finish within the budget, including after an abandoned worker or failed build/site publication.
6. Before activation only, execute internal `initialMigration:abortBeforeActivation` with the exact saved `{runId, epoch}`. Example command shape:

   ```sh
   pnpm exec convex run initialMigration:abortBeforeActivation '{"runId":"<saved-run-id>","epoch":1}'
   pnpm exec convex run initialMigration:status "$(node -p 'JSON.stringify({now: Date.now()})')"
   ```

   Verify `closed: false`, `authority: "legacy"`, `run.state: "aborted"` and a newer control epoch. The older run receipt remains audit evidence. All accepted pre-closure data is still present; the abort does not restore a backup or discard accepted data. Any independently paused weekly-board gate remains paused.

7. Reload the browser before making a new edit; old tabs and delayed commands cannot resume. A page first loaded during maintenance also pins that maintenance epoch and must reload after an abort advances the epoch. Verify a freshly entered edit succeeds and the old command still fails. Do not substitute the fresh epoch into a rejected command or automatically retry it. Existing legacy browser bundles without epoch support must load the compatible frontend even after abort.
8. Verify identity provider redelivery after reopening. Signed Clerk identity and membership events receive retryable HTTP 503 only for the Write Gate rejections `MAINTENANCE` or `RELOAD_REQUIRED`. Invalid signatures, malformed payloads, invalid provider timestamps and membership events referencing unknown users receive HTTP 400; these permanent failures require correction, not unchanged redelivery. After reopening, redeliveries are accepted regardless of whether the event was emitted during the Maintenance Window. Idempotent upserts recheck current local state and compare the provider timestamp with the affected record's stored timestamp, preventing an older event from overwriting a newer projection. No explicit reconciliation or re-stamping of events is required for the Maintenance Window. Signature verification happens before any database access; the receiving mutation reads the Write Gate once.
9. A later attempt uses a **new** operation identity and the current epoch, takes a new source inventory, and validates all candidates again. Old completion markers cannot authorize activation. After sheet activation, abort must reject; recovery is forward-only under the later activation runbook.

Lost responses: retrying `start` with identical arguments returns the same active run receipt; different arguments or reuse after abort reject. Repeating `abortBeforeActivation` for the same current aborted run returns the reopened epoch. A stale run cannot abort a newer one. Inspect status before guessing about an uncertain response. Never invoke retired `cutover`, `migrations`, or `legacyRetirement` writers; their explicit rejection endpoints remain unchanged.

## Transaction and client contract

Every active writer uses `lib/writeGate.ts` directly or the composed `lib/campaignRuntime.ts` builders. Ordinary gated writers read the indexed singleton control row before their handler; the reviewed `retireClosedDraft` handler reads it inline before changing application data. Convex conflict detection orders concurrent closure against that read, including when the control row did not previously exist: a write commits before closure and is included, or retries against the closed gate and rejects or defers retirement. The close receipt marks the source inventory boundary; starting an HTTP request earlier is not evidence its write committed earlier.

`writeEpoch` is optional only for old callers while the control epoch is zero. Start and abort each advance the epoch. Closed state rejects with `MAINTENANCE`; stale/missing epochs after reopening reject with `RELOAD_REQUIRED`. Neither path runs the writer handler. Spell-import workers pass their captured Write Epoch to scheduled successors, so abandoned imports and old import jobs remain fenced after abort and across later windows. Closed Weekly Draft retirement is idempotent housekeeping: it checks only whether the Write Gate is closed and ignores the captured Write Epoch. If it runs while closed, it schedules itself again after 60 seconds and returns without changing the draft; each later batch follows the same rule. An accepted pre-closure Confirmation can therefore retire its closed draft after abort and reopening without relying on automatic retries of failed scheduled mutations. Identity provider upserts are also Write Epoch exempt, but still check closed state and legacy authority; their ordering comes from provider timestamps. Fixture/admin invocations after reopening must provide the current epoch with **new** commands; access and fixture-isolation checks still apply. Both e2e fixture helpers query `initialMigration:clientStatus` on the same selected preview before each new fixture write and attach its epoch. Read-only inspections omit it. If maintenance starts between that query and the write, the write rejects normally; the helpers never refresh and replay a rejected command.

Future private-candidate writers (#319) need a separate, reviewed migration interface: verify the current run identity, exact epoch, closed gate and legacy authority in every batch transaction before writing; reject abandoned, aborted, superseded or activated runs. The normal gate deliberately blocks writes during maintenance and is not a candidate-worker bypass. This ticket does not introduce a speculative candidate endpoint.

`initialMigration:clientStatus` is an anonymous-safe reactive query exposing only status and epoch. The app's `MigrationConvexClient` stays lazy during construction, like the base Convex client, and starts its status subscription after the provider configures authentication or confirms that the visitor is signed out. It pins its first observed epoch for its loaded lifetime, includes it in every browser mutation and never updates pending commands to a newer epoch. Before initial status, or after a status error, writes fail closed without queuing. Route changes, sign-out and reauthentication do not reset the epoch or restart the lifetime subscription; closing the client releases it. Maintenance keeps reads alive; an epoch change requires an explicit full reload. An authoritative mutation rejection also updates the client notice immediately. Only known rejection codes produce maintenance/reload copy, never arbitrary object diagnostics.

`MaintenanceBanner` and the controls that disable editing use `useInitialMigrationMaintenance`. The hook supplies loading, unavailable, maintenance and reload-required notices; the banner presents the notice and the reload action, and controls explain why editing is unavailable. Existing saved data remains readable throughout; no client operation is automatically replayed. `cutover:status` has no application consumer; its compatibility projection remains covered by the accepted-campaign and initial-migration integration tests.

The activation ticket must distinguish a **legacy Character writer** from **any writer**. Today `authority === 'sheet'` fences all ordinary gated writers and identity webhooks, including spell imports and fixtures, even with a current Write Epoch. Activation must deliberately preserve the required non-Character writers while retiring legacy Character writes. Draft retirement's closed-only housekeeping gate is the reviewed exception; this pre-activation ticket does not authorize a broader bypass.

The #261 `characterSheet:buildOut` writer uses the composed campaign gate. Ledger level and permanent-score edits enter through the inventoried `character:updateCharacter` writer; roster Hit Dice override edits, including zero, enter through `canonicalLedger:save`. All use the same maintenance and Write Epoch checks as their other edits. Prepared ledger edits and sheet persistence also refresh current Militia Character Facts within their already-gated transaction. Every prepared sheet writer, including ledger level/score edits and Build out, prunes Accepted Warnings against the in-memory sheet after the edit via `pruneWarningAcceptancesAndRecordChange`; the Hit Dice override remains a militia snapshot correction rather than a sheet edit. This isolated fixture behavior does not activate production sheets. `convex/characterMilitiaSheet.integration.test.ts` proves Build out and ledger edits reject while the gate is closed, preserve saved reads, reject stale commands after abort, and accept a fresh command carrying the reopened epoch.

## Inventory and completeness check

### Organization membership directory backfill (#300)

The additive `organizationMembership` table indexes `(organizationId, userId)` and `(userId, organizationId)` for member directories. `user.orgIds` remains the source of authorization; the directory query rechecks each surviving user before returning a profile. Accepted ordered profile/membership webhooks and the real fixture seed/replace paths synchronize directory rows in the same gated transaction. Older/repeated deliveries do not overwrite newer source state. Fixture replacement removes rows for memberships it no longer retains. Removed accounts or access cannot leak a candidate through a stale row.

To prepare the membership directory for existing accounts, an operator must invoke the internal `organizationMembership:backfill` with `{ cursor: null, writeEpoch: <current epoch> }`, then pass each returned `continueCursor` into the next call until `isDone` is true. Each transaction pages at most one existing account and reconciles its current memberships; an empty page can still require continuation. Repeating from null is idempotent. No external scheduler, ungated writer or public account-scan fallback is added. The ordinary Write Gate rejects this backfill during maintenance, after activation and for an obsolete epoch. After reopening, issue a new command with the current epoch; never automatically replay a rejected batch. This backfill prepares only the membership directory: it enables neither production ownership reassignment nor the production member picker. Both remain restricted to prepared fixture campaigns, including legacy flat Characters, until an explicit release cutover. The deployment's schema/codegen verification and this operator backfill remain orchestrator work outside the sandbox.

### Registration audit

Run `pnpm -s check:initial-migration-writers`. The behavioral test `tests/initial-migration-writers.test.ts` also checks the current repository, so normal tests fail on uncovered writers or a stale inventory. The checker walks Convex TypeScript sources (excluding generated files and tests), resolves named/namespace registration imports, recognizes the reviewed builders in the two gate-owner modules, and explicitly lists every mutation/action/HTTP registration. Aliased raw imports, raw builder escapes/custom wrappers and re-exports fail closed outside the two reviewed gate owner modules. Every public mutation must accept an optional numeric `writeEpoch`: reviewed public builders provide it, while raw registrations declare it in their argument validator. A retired name is exempt from gating only while its handler is the imported `rejectRetiredWorkflow`; its `v.any()` argument validator preserves arbitrary legacy arguments, including `writeEpoch`, so requests reach the intended rejection.

The Write Epoch exemptions are the reviewed identity webhook builder and `retireClosedDraft`'s inline transactional gate described above. The only exemptions from a Write Gate builder are that explicitly reviewed retirement handler, the two authoritative gate controls, read-only fixture inspection, pure webhook signature verification and the HTTP webhook adapter whose actual writes delegate to gated user mutations. Read-only exemptions reject obvious database writes or scheduling. Helper side effects, changes inside the two gate-owner modules and changes to the retirement handler still require code review plus integration tests; this static check is not a proof of arbitrary interprocedural behavior. Adding a writer requires its gate and a reviewed inventory update even if it uses a recognized wrapper.

Imports (`spell:addNextHundredSpells`), aggregate rebuilding, identity/membership webhooks, fixture reset/seed/cleanup, accepted-campaign setup, corrections, confirmations and scheduled draft retirement appear individually below. Ownership and campaign references are frozen through Character, membership, Setup and correction writers; there are no separate ungated ownership endpoints. Historical rewrite is not yet a registered writer in this release and must enter this inventory when implemented.

<!-- prettier-ignore -->
| Registered writer | Gate or reviewed exception |
| --- | --- |
| `convex/campaign.ts:createCampaign` | Shared write gate (epoch + maintenance) |
| `convex/campaign.ts:updateCampaignDescription` | Shared write gate (epoch + maintenance) |
| `convex/campaign.ts:updateCampaignInGameDate` | Shared write gate (epoch + maintenance) |
| `convex/canonicalDraftPersistence.ts:confirm` | Shared write gate (epoch + maintenance) |
| `convex/canonicalDraftPersistence.ts:edit` | Shared write gate (epoch + maintenance) |
| `convex/canonicalDraftPersistence.ts:retireClosedDraft` | Write gate (maintenance defers); accepted draft retirement is idempotent across epochs and Character authority |
| `convex/canonicalLedger.ts:save` | Shared write gate (epoch + maintenance) |
| `convex/canonicalPersistenceFixtures.ts:acceptedCampaign` | Shared write gate (epoch + maintenance) |
| `convex/canonicalPersistenceFixtures.ts:appendHistory` | Shared write gate (epoch + maintenance) |
| `convex/canonicalPersistenceFixtures.ts:blockSuccessor` | Shared write gate (epoch + maintenance) |
| `convex/canonicalPersistenceFixtures.ts:changeSource` | Shared write gate (epoch + maintenance) |
| `convex/canonicalPersistenceFixtures.ts:close` | Shared write gate (epoch + maintenance) |
| `convex/canonicalPersistenceFixtures.ts:initialize` | Shared write gate (epoch + maintenance) |
| `convex/canonicalPersistenceFixtures.ts:initializeUpkeep` | Shared write gate (epoch + maintenance) |
| `convex/canonicalPersistenceFixtures.ts:inspect` | Read-only fixture inspection; no writes or scheduling |
| `convex/canonicalPersistenceFixtures.ts:installAcceptanceSource` | Shared write gate (epoch + maintenance) |
| `convex/canonicalPersistenceFixtures.ts:resetAndInitialize` | Shared write gate (epoch + maintenance) |
| `convex/canonicalSetup.ts:initialize` | Shared write gate (epoch + maintenance) |
| `convex/character.ts:archiveCharacter` | Shared write gate (epoch + maintenance) |
| `convex/character.ts:createCharacter` | Shared write gate (epoch + maintenance) |
| `convex/character.ts:deleteCharacter` | Shared write gate (epoch + maintenance) |
| `convex/character.ts:reassignOwner` | Shared write gate (epoch + maintenance) |
| `convex/character.ts:updateCharacter` | Shared write gate (epoch + maintenance) |
| `convex/characterSheet.ts:acceptWarning` | Shared write gate (epoch + maintenance) |
| `convex/characterSheet.ts:addClassLevel` | Shared write gate (epoch + maintenance) |
| `convex/characterSheet.ts:archive` | Shared write gate (epoch + maintenance) |
| `convex/characterSheet.ts:buildOut` | Shared write gate (epoch + maintenance) |
| `convex/characterSheet.ts:create` | Shared write gate (epoch + maintenance) |
| `convex/characterSheet.ts:createAbilityChange` | Shared write gate (epoch + maintenance) |
| `convex/characterSheet.ts:createPersonalAdjustment` | Shared write gate (epoch + maintenance) |
| `convex/characterSheet.ts:createSheetEntry` | Shared write gate (epoch + maintenance) |
| `convex/characterSheet.ts:deleteClassLevel` | Shared write gate (epoch + maintenance) |
| `convex/characterSheet.ts:deletePrivate` | Shared write gate (epoch + maintenance) |
| `convex/characterSheet.ts:editAbilityChange` | Shared write gate (epoch + maintenance) |
| `convex/characterSheet.ts:editBaseScores` | Shared write gate (epoch + maintenance) |
| `convex/characterSheet.ts:editClassLevel` | Shared write gate (epoch + maintenance) |
| `convex/characterSheet.ts:editCreationSettings` | Shared write gate (epoch + maintenance) |
| `convex/characterSheet.ts:editPersonalAdjustment` | Shared write gate (epoch + maintenance) |
| `convex/characterSheet.ts:editSheetEntry` | Shared write gate (epoch + maintenance) |
| `convex/characterSheet.ts:moveClassLevel` | Shared write gate (epoch + maintenance) |
| `convex/characterSheet.ts:removeAbilityChange` | Shared write gate (epoch + maintenance) |
| `convex/characterSheet.ts:removePersonalAdjustment` | Shared write gate (epoch + maintenance) |
| `convex/characterSheet.ts:removeSheetEntry` | Shared write gate (epoch + maintenance) |
| `convex/characterSheet.ts:reopenWarning` | Shared write gate (epoch + maintenance) |
| `convex/clerk.ts:fulfill` | Signature verification only; no writes or scheduling |
| `convex/cutover.ts:activate` | Retired: always rejects; never mutates |
| `convex/cutover.ts:initialize` | Retired: always rejects; never mutates |
| `convex/cutover.ts:pause` | Retired: always rejects; never mutates |
| `convex/cutover.ts:prepare` | Retired: always rejects; never mutates |
| `convex/cutover.ts:recordBackup` | Retired: always rejects; never mutates |
| `convex/cutover.ts:resumeLegacy` | Retired: always rejects; never mutates |
| `convex/e2eFixtures.ts:cleanupCase` | Shared write gate (epoch + maintenance) |
| `convex/e2eFixtures.ts:resetCase` | Shared write gate (epoch + maintenance) |
| `convex/e2eFixtures.ts:seedIdentityProjection` | Shared write gate (epoch + maintenance) |
| `convex/http.ts:httpAction#1` | Webhook: verifies signature before database access; delegates to gated user mutations with signed event time |
| `convex/initialMigration.ts:abortBeforeActivation` | Operator: reopens only the current unactivated run and advances the epoch |
| `convex/initialMigration.ts:start` | Operator: atomically closes the gate and records the run |
| `convex/legacyRetirement.ts:batch` | Retired: always rejects; never mutates |
| `convex/migrations.ts:runLegacySchemaMigrationBatch` | Retired: always rejects; never mutates |
| `convex/migrations.ts:startLegacySchemaMigration` | Retired: always rejects; never mutates |
| `convex/militia.ts:assignOfficerRole` | Retired: always rejects; never mutates |
| `convex/militia.ts:assignTeamManager` | Retired: always rejects; never mutates |
| `convex/militia.ts:createMilitia` | Retired: always rejects; never mutates |
| `convex/militia.ts:deleteCacheState` | Retired: always rejects; never mutates |
| `convex/militia.ts:deleteEventState` | Retired: always rejects; never mutates |
| `convex/militia.ts:deleteMarketplaceState` | Retired: always rejects; never mutates |
| `convex/militia.ts:deleteOrderState` | Retired: always rejects; never mutates |
| `convex/militia.ts:deleteSettlementState` | Retired: always rejects; never mutates |
| `convex/militia.ts:deleteTrackedPersonState` | Retired: always rejects; never mutates |
| `convex/militia.ts:updateMilitiaCoreState` | Retired: always rejects; never mutates |
| `convex/militia.ts:upsertCacheState` | Retired: always rejects; never mutates |
| `convex/militia.ts:upsertEventState` | Retired: always rejects; never mutates |
| `convex/militia.ts:upsertMarketplaceState` | Retired: always rejects; never mutates |
| `convex/militia.ts:upsertMilitiaTeamState` | Retired: always rejects; never mutates |
| `convex/militia.ts:upsertOrderState` | Retired: always rejects; never mutates |
| `convex/militia.ts:upsertSettlementState` | Retired: always rejects; never mutates |
| `convex/militia.ts:upsertTrackedPersonState` | Retired: always rejects; never mutates |
| `convex/militia.ts:upsertWeekContextState` | Retired: always rejects; never mutates |
| `convex/organizationMembership.ts:backfill` | Shared write gate (epoch + maintenance) |
| `convex/spell.ts:addNextHundredSpells` | Shared write gate (epoch + maintenance) |
| `convex/spell.ts:addSpellMutation` | Shared write gate (epoch + maintenance) |
| `convex/spell.ts:rebuildSpellAggregate` | Shared write gate (epoch + maintenance) |
| `convex/user.ts:addOrgIdToUser` | Write gate (maintenance + legacy authority); idempotent webhook, epoch exempt |
| `convex/user.ts:createUser` | Write gate (maintenance + legacy authority); idempotent webhook, epoch exempt |
| `convex/user.ts:updateRoleInOrgForUser` | Write gate (maintenance + legacy authority); idempotent webhook, epoch exempt |
| `convex/user.ts:updateUser` | Write gate (maintenance + legacy authority); idempotent webhook, epoch exempt |
| `convex/weekBoard.ts:applyTreasuryTransaction` | Retired: always rejects; never mutates |
| `convex/weekBoard.ts:buyOffPersistentEvent` | Retired: always rejects; never mutates |
| `convex/weekBoard.ts:commitCurrentPhase` | Retired: always rejects; never mutates |
| `convex/weekBoard.ts:goToPreviousWeek` | Retired: always rejects; never mutates |
| `convex/weekBoard.ts:rankUpMilitia` | Retired: always rejects; never mutates |
| `convex/weekBoard.ts:saveWeekBoardState` | Retired: always rejects; never mutates |
