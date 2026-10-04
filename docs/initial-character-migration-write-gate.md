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

5. Prepare and validate private candidates using the [candidate-backfill runbook](initial-character-backfill.md), retaining this exact gate receipt. Its internal commands enumerate only while the gate remains closed for the current legacy-authority run. Candidate completion does not activate sheets; activation remains [#413](https://github.com/AndreasUnunger/EverythingPath/issues/413). Do not exceed the declared budget. Status reports `budgetExceeded: true` when the active Maintenance Window reaches its deadline; monitor it with fresh timestamps and abort promptly when preparation cannot finish. An expired deadline does not automatically reopen: an automatic reopen could race migration work. The operator explicitly aborts if preparation cannot finish within the budget, including after an abandoned worker or failed build/site publication. The isolated rehearsal ends by aborting.
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

Private-candidate writers (#319) use the separately reviewed internal `initialCharacterBackfill` interface. Every preparation/validation transaction verifies the current run identity, exact epoch, closed gate, legacy authority and current input capture before writing; abandoned, aborted, superseded or activated workers reject. The abort command fences the capture and reopens only its current unactivated run. The normal gate deliberately blocks writes during maintenance. Candidate rows remain private and never select active Character Sheet or Militia Character Facts authority. See the [runbook](initial-character-backfill.md) for capture receipts, bounded progress, reports and restart behavior.

`initialMigration:clientStatus` is an anonymous-safe reactive query exposing only status and epoch. The app's `MigrationConvexClient` stays lazy during construction, like the base Convex client, and starts its status subscription after the provider configures authentication or confirms that the visitor is signed out. It pins its first observed epoch for its loaded lifetime, includes it in every browser mutation and never updates pending commands to a newer epoch. Before initial status, or after a status error, writes fail closed without queuing. Route changes, sign-out and reauthentication do not reset the epoch or restart the lifetime subscription; closing the client releases it. Maintenance keeps reads alive; an epoch change requires an explicit full reload. An authoritative mutation rejection also updates the client notice immediately. Only known rejection codes produce maintenance/reload copy, never arbitrary object diagnostics.

`MaintenanceBanner` and the controls that disable editing use `useInitialMigrationMaintenance`. The hook supplies loading, unavailable, maintenance and reload-required notices; the banner presents the notice and the reload action, and controls explain why editing is unavailable. Existing saved data remains readable throughout; no client operation is automatically replayed. `cutover:status` has no application consumer; its compatibility projection remains covered by the accepted-campaign and initial-migration integration tests.

The gate distinguishes **legacy Character** writers from **general** writers. With `authority === 'sheet'`, only the legacy Character class rejects commands carrying the current Write Epoch. Catalog Release preparation, ordinary campaign/weekly writes, membership backfill and identity projection remain available. Maintenance closure still rejects every gated writer, and both command classes retain epoch fencing. Signed identity webhooks are general writes with their existing provider-timestamp exemption from browser epochs. The inventory records each registration's class; operator gate controls and retired/read-only endpoints are explicit exceptions.

Prepared Character and Character Sheet writers still update the legacy flat statistics and remain in the legacy Character class until the activation implementation migrates that behavior. Spell import/aggregate writers maintain legacy spell data. Fixture reset/cleanup and accepted-campaign construction write or remove flat Characters and therefore retain that fence. Fixture writes limited to canonical drafts, snapshots or history, including Upkeep initialization that only reads Characters, are general. Draft retirement's closed-only housekeeping gate remains the reviewed epoch-exempt general writer.

The #304 race writers (`selectRace`, `chooseRacialAbilityScore`, `setRacialTraitSelected`, `setRacialTraitReplacements` and `editRaceStatistics`) use the legacy Character class. `convex/characterSheetRaces.integration.test.ts` exercises every writer against maintenance closure, stale or missing epochs after reopening, and sheet authority with the current epoch; all refuse before changing the saved sheet. The same test covers membership and Character/campaign-scoped references. The inventory and `tests/initial-migration-writers.test.ts` verify their registrations and class assignments.

The #305 Archetype writers (`setArchetypeSelected` and `setArchetypePartChoices`) use the same legacy Character class. Their public API integration tests prove membership, scoped class/feature references, maintenance, stale epochs and sheet-authority rejection before changing saved state.

The #313 feat/trait slot writers (`fillSelectionSlot` and `clearSelectionSlot`) also use the legacy Character class. `convex/characterSheetSelections.integration.test.ts` verifies membership, private ownership, Character-scoped definitions and selections, maintenance closure, reopening epochs and sheet authority. Alignment and deity edits use the existing gated `editCreationSettings` writer.

The #261 `characterSheet:buildOut` writer uses the composed campaign gate. Ledger level and permanent-score edits enter through the inventoried `character:updateCharacter` writer; roster Hit Dice override edits, including zero, enter through `canonicalLedger:save`. All use the same maintenance and Write Epoch checks as their other edits. Prepared ledger edits and sheet persistence also refresh current Militia Character Facts within their already-gated transaction. Every prepared sheet writer, including ledger level/score edits and Build out, prunes Accepted Warnings against the in-memory sheet after the edit via `pruneWarningAcceptancesAndRecordChange`; the Hit Dice override remains a militia snapshot correction rather than a sheet edit. This isolated fixture behavior does not activate production sheets. `convex/characterMilitiaSheet.integration.test.ts` proves Build out and ledger edits reject while the gate is closed, preserve saved reads, reject stale commands after abort, and accept a fresh command carrying the reopened epoch.

The #308 `catalogCopies` module adds five public legacy Character writers: `createOneOff`, `editDefinition`, `saveToCatalog`, `customizeForCampaign` and `detach`. Each uses `legacyCharacterMutation`, preserving maintenance closure, Write Epoch fencing and legacy-authority checks before its handler. Character ownership or current campaign membership determines access; campaign-scoped definitions require the same campaign, and copy provenance grants no access to the origin. The `list` and `advisories` queries are read-only and remain outside the writer inventory. These prepared commands do not activate production sheets or publish a Catalog Release.

The #308 review adds a preferred-copy index on `catalogEntry` without changing document shapes or renaming persisted `campaignPreference`. Scope references remain optional in the schema until retained prepared and migration rows have been audited; the single `writeCatalogDefinition` helper validates the complete definition and scope before inserting or patching Catalog Copy definitions. No data backfill or authority change is part of this review. Fixture reset and cleanup also remove campaign-scoped homebrew created by Save or Customize, within the existing bounded cleanup contract.

## Inventory and completeness check

### Organization membership directory backfill (#300)

The additive `organizationMembership` table indexes `(organizationId, userId)` and `(userId, organizationId)` for member directories. `user.orgIds` remains the source of authorization; the directory query rechecks each surviving user before returning a profile. Accepted ordered profile/membership webhooks and the real fixture seed/replace paths synchronize directory rows in the same gated transaction. Older/repeated deliveries do not overwrite newer source state. Fixture replacement removes rows for memberships it no longer retains. Removed accounts or access cannot leak a candidate through a stale row.

To prepare the membership directory for existing accounts, an operator must invoke the internal `organizationMembership:backfill` with `{ cursor: null, writeEpoch: <current epoch> }`, then pass each returned `continueCursor` into the next call until `isDone` is true. Each transaction pages at most one existing account and reconciles its current memberships; an empty page can still require continuation. Repeating from null is idempotent. No external scheduler, ungated writer or public account-scan fallback is added. The general Write Gate rejects this backfill during maintenance and for an obsolete epoch; an open gate under sheet authority allows it. After reopening, issue a new command with the current epoch; never automatically replay a rejected batch. This backfill prepares only the membership directory: it enables neither production ownership reassignment nor the production member picker. Both remain restricted to prepared fixture campaigns, including legacy flat Characters, until an explicit release cutover. The deployment's schema/codegen verification and this operator backfill remain orchestrator work outside the sandbox.

### Registration audit

Run `pnpm -s check:initial-migration-writers`. The behavioral test `tests/initial-migration-writers.test.ts` also checks the current repository, so normal tests fail on uncovered writers or a stale inventory. The checker walks Convex TypeScript sources (excluding generated files and tests), resolves named/namespace registration imports, recognizes the reviewed builders in the two gate-owner modules, and explicitly lists every mutation/action/HTTP registration. Aliased raw imports, raw builder escapes/custom wrappers and re-exports fail closed outside the two reviewed gate owner modules. Every public mutation must accept an optional numeric `writeEpoch`: reviewed public builders provide it, while raw registrations declare it in their argument validator. A retired name is exempt from gating only while its handler is the imported `rejectRetiredWorkflow`; its `v.any()` argument validator preserves arbitrary legacy arguments, including `writeEpoch`, so requests reach the intended rejection.

General writers reject statically identifiable `insert`, `patch`, `delete` or `replace` calls targeting `character`, `characterSheetEntry`, `companionRelationship`, `catalogEntry`, `acceptedWarning`, `characterSpell`, `spell`, `spellCatalogIndex` or `spellCatalogSummary`; these writes require a legacy Character builder. The analysis follows inline and named handlers and direct module-local helper calls, including recursive calls. It recognizes literal table names, IDs declared as `Id<'table'>`, and handler argument IDs declared with direct `v.id('table')` validators. TypeScript bindings distinguish local calls from shadowed names and unrelated properties.

`characterSheetSpells:cleanupCatalog` is a reviewed housekeeping exception: a gated deletion has already removed the Character and revoked live access. Every continuation first refuses an existing Character, then deletes only that removed Character's isolated catalog/index/summary rows in bounded batches. It may finish across maintenance or an epoch change, so reopening cannot strand an authorized deletion. The large prepared-catalog integration test proves live-Character refusal and completion after maintenance closes.

The Write Epoch exemptions are the reviewed identity webhook builder and `retireClosedDraft`'s inline transactional gate described above. The only exemptions from a Write Gate builder are that explicitly reviewed retirement handler, the completed-deletion catalog housekeeping handler, the two authoritative gate controls, the nine private candidate operator commands (including the `resume` synonym), read-only fixture inspection, pure webhook signature verification and the HTTP webhook adapter whose actual writes delegate to gated user mutations. Candidate exceptions are limited to the exact `initialCharacterBackfill` module/export names and must register through the generated server's `internalMutation`; public registrations, other names and other modules fail. Their closed-gate run/capture checks are verified by integration tests and code review. Read-only exemptions reject obvious database writes or scheduling. Imported helper side effects, dynamic dispatch or table names, other inferred ID types, changes inside the two gate-owner modules and changes to the retirement handler still require code review plus integration tests; this static check is not a proof of arbitrary interprocedural behavior. Adding a writer requires its gate and a reviewed inventory update even if it uses a recognized wrapper.

The inventory contains 141 registrations, including the race, equipment, proficiency and Companion Relationship writers, both Archetype writers, both feat/trait slot writers, all five Catalog Copy writers, the four Spell collection registrations, the four Attack Routine writers and the nine private candidate operator commands. Imports (`spell:addNextHundredSpells`), aggregate rebuilding, identity/membership webhooks, fixture reset/seed/cleanup, accepted-campaign setup, corrections, confirmations and scheduled draft retirement appear individually below. Ownership and campaign references are frozen through Character, membership, Setup and correction writers; there are no separate ungated ownership endpoints. Historical rewrite is not yet a registered writer in this release and must enter this inventory when implemented.

<!-- prettier-ignore -->
| Registered writer | Class | Gate or reviewed exception |
| --- | --- | --- |
| `convex/campaign.ts:createCampaign` | general | Shared write gate (epoch + maintenance) |
| `convex/campaign.ts:updateCampaignDescription` | general | Shared write gate (epoch + maintenance) |
| `convex/campaign.ts:updateCampaignInGameDate` | general | Shared write gate (epoch + maintenance) |
| `convex/canonicalDraftPersistence.ts:confirm` | general | Shared write gate (epoch + maintenance) |
| `convex/canonicalDraftPersistence.ts:edit` | general | Shared write gate (epoch + maintenance) |
| `convex/canonicalDraftPersistence.ts:retireClosedDraft` | general | Write gate (maintenance defers); accepted draft retirement is idempotent across epochs and Character authority |
| `convex/canonicalLedger.ts:save` | general | Shared write gate (epoch + maintenance) |
| `convex/canonicalPersistenceFixtures.ts:acceptedCampaign` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/canonicalPersistenceFixtures.ts:appendHistory` | general | Shared write gate (epoch + maintenance) |
| `convex/canonicalPersistenceFixtures.ts:blockSuccessor` | general | Shared write gate (epoch + maintenance) |
| `convex/canonicalPersistenceFixtures.ts:changeSource` | general | Shared write gate (epoch + maintenance) |
| `convex/canonicalPersistenceFixtures.ts:close` | general | Shared write gate (epoch + maintenance) |
| `convex/canonicalPersistenceFixtures.ts:initialize` | general | Shared write gate (epoch + maintenance) |
| `convex/canonicalPersistenceFixtures.ts:initializeUpkeep` | general | Shared write gate (epoch + maintenance) |
| `convex/canonicalPersistenceFixtures.ts:inspect` | readOnly | Read-only fixture inspection; no writes or scheduling |
| `convex/canonicalPersistenceFixtures.ts:installAcceptanceSource` | general | Shared write gate (epoch + maintenance) |
| `convex/canonicalPersistenceFixtures.ts:resetAndInitialize` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/canonicalSetup.ts:initialize` | general | Shared write gate (epoch + maintenance) |
| `convex/catalogCopies.ts:createOneOff` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/catalogCopies.ts:customizeForCampaign` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/catalogCopies.ts:detach` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/catalogCopies.ts:editDefinition` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/catalogCopies.ts:saveToCatalog` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/catalogRelease.ts:begin` | general | Shared write gate (epoch + maintenance) |
| `convex/catalogRelease.ts:finalize` | general | Shared write gate (epoch + maintenance) |
| `convex/catalogRelease.ts:writeBatch` | general | Shared write gate (epoch + maintenance) |
| `convex/character.ts:archiveCharacter` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/character.ts:createCharacter` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/character.ts:deleteCharacter` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/character.ts:reassignOwner` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/character.ts:updateCharacter` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:acceptWarning` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:addClassLevel` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:archive` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:buildOut` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:chooseRacialAbilityScore` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:clearSelectionSlot` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:create` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:createAbilityChange` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:createAttackRoutine` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:createPersonalAdjustment` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:createSheetEntry` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:deleteAttackRoutine` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:deleteClassLevel` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:deletePrivate` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:discardDormantEntry` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:editAbilityChange` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:editAttackRoutine` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:editBaseScores` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:editClassLevel` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:editCreationSettings` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:editEquipment` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:editGrantState` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:editPersonalAdjustment` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:editRaceStatistics` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:editSelection` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:editSheetEntry` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:fillSelectionSlot` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:moveClassLevel` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:removeAbilityChange` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:removePersonalAdjustment` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:removeSheetEntry` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:reopenWarning` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:restoreAttackRoutine` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:selectEntry` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:selectRace` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:setArchetypePartChoices` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:setArchetypeSelected` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:setDormantEntryKept` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:setManualProficiency` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:setProficiencyChoice` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:setRacialTraitReplacements` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheet.ts:setRacialTraitSelected` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheetSpells.ts:cleanupCatalog` | housekeeping | Housekeeping: completes an authorized Character deletion; refuses live Characters, including during maintenance |
| `convex/characterSheetSpells.ts:installPreparedCatalog` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheetSpells.ts:record` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/characterSheetSpells.ts:remove` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/clerk.ts:fulfill` | readOnly | Signature verification only; no writes or scheduling |
| `convex/companionRelationships.ts:addSource` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/companionRelationships.ts:create` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/companionRelationships.ts:interrupt` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/companionRelationships.ts:link` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/companionRelationships.ts:replace` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/companionRelationships.ts:restore` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/companionRelationships.ts:setSourceEnabled` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/cutover.ts:activate` | retired | Retired: always rejects; never mutates |
| `convex/cutover.ts:initialize` | retired | Retired: always rejects; never mutates |
| `convex/cutover.ts:pause` | retired | Retired: always rejects; never mutates |
| `convex/cutover.ts:prepare` | retired | Retired: always rejects; never mutates |
| `convex/cutover.ts:recordBackup` | retired | Retired: always rejects; never mutates |
| `convex/cutover.ts:resumeLegacy` | retired | Retired: always rejects; never mutates |
| `convex/e2eFixtures.ts:cleanupCase` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/e2eFixtures.ts:resetCase` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/e2eFixtures.ts:seedIdentityProjection` | general | Shared write gate (epoch + maintenance) |
| `convex/http.ts:httpAction#1` | general | Webhook: verifies signature before database access; delegates to gated user mutations with signed event time |
| `convex/initialCharacterBackfill.ts:abortBeforeActivation` | operator | Operator: aborts the current capture and reopens only its unactivated run |
| `convex/initialCharacterBackfill.ts:batch` | operator | Operator: private candidate preparation requires the closed legacy gate, current run, epoch and input capture |
| `convex/initialCharacterBackfill.ts:drive` | operator | Operator: private candidate preparation requires the closed legacy gate, current run, epoch and input capture |
| `convex/initialCharacterBackfill.ts:resume` | operator | Operator: private candidate preparation requires the closed legacy gate, current run, epoch and input capture |
| `convex/initialCharacterBackfill.ts:start` | operator | Operator: private candidate preparation requires the closed legacy gate, current run, epoch and input capture |
| `convex/initialCharacterBackfill.ts:startDriver` | operator | Operator: private candidate preparation requires the closed legacy gate, current run, epoch and input capture |
| `convex/initialCharacterBackfill.ts:startValidation` | operator | Operator: private candidate preparation requires the closed legacy gate, current run, epoch and input capture |
| `convex/initialCharacterBackfill.ts:stopDriver` | operator | Operator: private candidate preparation requires the closed legacy gate, current run, epoch and input capture |
| `convex/initialCharacterBackfill.ts:validate` | operator | Operator: private candidate preparation requires the closed legacy gate, current run, epoch and input capture |
| `convex/initialMigration.ts:abortBeforeActivation` | operator | Operator: reopens only the current unactivated run and advances the epoch |
| `convex/initialMigration.ts:start` | operator | Operator: atomically closes the gate and records the run |
| `convex/legacyRetirement.ts:batch` | retired | Retired: always rejects; never mutates |
| `convex/migrations.ts:runLegacySchemaMigrationBatch` | retired | Retired: always rejects; never mutates |
| `convex/migrations.ts:startLegacySchemaMigration` | retired | Retired: always rejects; never mutates |
| `convex/militia.ts:assignOfficerRole` | retired | Retired: always rejects; never mutates |
| `convex/militia.ts:assignTeamManager` | retired | Retired: always rejects; never mutates |
| `convex/militia.ts:createMilitia` | retired | Retired: always rejects; never mutates |
| `convex/militia.ts:deleteCacheState` | retired | Retired: always rejects; never mutates |
| `convex/militia.ts:deleteEventState` | retired | Retired: always rejects; never mutates |
| `convex/militia.ts:deleteMarketplaceState` | retired | Retired: always rejects; never mutates |
| `convex/militia.ts:deleteOrderState` | retired | Retired: always rejects; never mutates |
| `convex/militia.ts:deleteSettlementState` | retired | Retired: always rejects; never mutates |
| `convex/militia.ts:deleteTrackedPersonState` | retired | Retired: always rejects; never mutates |
| `convex/militia.ts:updateMilitiaCoreState` | retired | Retired: always rejects; never mutates |
| `convex/militia.ts:upsertCacheState` | retired | Retired: always rejects; never mutates |
| `convex/militia.ts:upsertEventState` | retired | Retired: always rejects; never mutates |
| `convex/militia.ts:upsertMarketplaceState` | retired | Retired: always rejects; never mutates |
| `convex/militia.ts:upsertMilitiaTeamState` | retired | Retired: always rejects; never mutates |
| `convex/militia.ts:upsertOrderState` | retired | Retired: always rejects; never mutates |
| `convex/militia.ts:upsertSettlementState` | retired | Retired: always rejects; never mutates |
| `convex/militia.ts:upsertTrackedPersonState` | retired | Retired: always rejects; never mutates |
| `convex/militia.ts:upsertWeekContextState` | retired | Retired: always rejects; never mutates |
| `convex/organizationMembership.ts:backfill` | general | Shared write gate (epoch + maintenance) |
| `convex/spell.ts:addNextHundredSpells` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/spell.ts:addSpellMutation` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/spell.ts:rebuildSpellAggregate` | legacyCharacter | Shared write gate (epoch + maintenance + legacy Character authority) |
| `convex/user.ts:addOrgIdToUser` | general | Write gate (maintenance); idempotent webhook, epoch exempt |
| `convex/user.ts:createUser` | general | Write gate (maintenance); idempotent webhook, epoch exempt |
| `convex/user.ts:updateRoleInOrgForUser` | general | Write gate (maintenance); idempotent webhook, epoch exempt |
| `convex/user.ts:updateUser` | general | Write gate (maintenance); idempotent webhook, epoch exempt |
| `convex/weekBoard.ts:applyTreasuryTransaction` | retired | Retired: always rejects; never mutates |
| `convex/weekBoard.ts:buyOffPersistentEvent` | retired | Retired: always rejects; never mutates |
| `convex/weekBoard.ts:commitCurrentPhase` | retired | Retired: always rejects; never mutates |
| `convex/weekBoard.ts:goToPreviousWeek` | retired | Retired: always rejects; never mutates |
| `convex/weekBoard.ts:rankUpMilitia` | retired | Retired: always rejects; never mutates |
| `convex/weekBoard.ts:saveWeekBoardState` | retired | Retired: always rejects; never mutates |
