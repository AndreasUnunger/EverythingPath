# Legacy retirement (#91)

The operator confirmed production cutover completion in the implementation
session on 2026-09-24. Dev acceptance is recorded in
[the dev cutover evidence](dev-cutover-2026-09-24.md). Both private paused backup
archives were rehashed before preparing retirement and match their recorded
hashes. Reopening ended automatic rollback; neither retirement nor a later
release may replace canonical state with the old backup.

## Application retirement

The supported dashboard has one Weekly Draft Workspace and one canonical
persistence/rules authority. It no longer mounts the legacy board, phase builders,
autosave controller, old ledgers, or the alternate resolution implementation.
Legacy query and mutation names remain as unconditional rejection endpoints.
They perform no reads or writes, including when no cutover control row exists.
Character changes always update canonical source, and archived character records
cannot be deleted out from under history. Officer assignment remains in the
canonical militia ledger.

Existing canonical resolution, rules, Workspace, history and persistence scenarios
replace the old controller/mutation harness tests. The rule catalog still requires
all 487 reviewed cases. Replaced browser journeys exercise the ordinary
`/campaigns` route for membership, mid-campaign setup/reload, shared character and
officer changes, complete-week Confirmation/history and shared Action Slots.
The broader canonical Workspace journey retains conflict recovery, input clearing,
card movement and full phase behavior. The recovery journey additionally retires
legacy storage after Confirmation and checks the accepted successor and immutable
history are unchanged.

## Bounded storage cleanup

`legacyRetirement:batch` is internal and requires the exact accepted cutover
operation, its retained backup hash, a militia in its recorded campaign inventory,
a canonical source and exactly one open draft. Each call removes at most four
legacy documents from one allowlisted table. The batch also bounds document bytes for legacy rows containing rollback history. Repeat until `done: true`; repeating
a completed cleanup is safe. The final call retains the militia ID and name but
removes its obsolete gameplay fields.

The allowlist comprises legacy teams, week state, resolution records, settlements,
caches, markets, orders, character conditions, team conditions, events, override
notes, and the two migration preparation tables. It never deletes characters,
canonical state, drafts, conflict/deduplication records, source corrections,
initialization receipts, canonical history, or the cutover/backup record.

The current schema intentionally accepts both the old militia shape and the
identity-only shape so the cleanup can be deployed to populated databases.
Legacy table declarations and migration preparation readers remain only for
cleanup and backup rehearsal. They are not an active gameplay authority.
After authorized cleanup reports completion for every operational militia,
remove those compatibility declarations and preparation/rehearsal modules in the
narrowing release. Removing them before the data operation would make it
impossible to deploy and execute this typed cleanup safely. Live cleanup and that
final schema narrowing are outstanding operational steps, not claimed complete
by this implementation commit.

Invoke on an explicitly selected deployment after preserving the private evidence:

```bash
pnpm exec convex run --deployment <target> legacyRetirement:batch \
  '{"operationId":"<accepted-operation>","backupSha256":"<verified-hash>","militiaId":"<id>"}'
```

Use the recorded inventory, inspect each returned `deleted`/`done`, and verify
ordinary canonical Workspace and history reads before and after. Do not confirm
or advance an operational campaign as a test. Record results privately alongside
the backup. Production deployment/cleanup requires explicit authorization; the
implementation session has not performed either.

## Retained backup disposition

| Target | Private archive | SHA-256 | Retain through (UTC) |
| --- | --- | --- | --- |
| Dev | `e2e/.private/dev-cutover-2026-09-24/paused-backup.zip` | `07c28c9ee1b36a8a8e95eee3eedf76895ff9fb38c41f004dbc0c801bb2c55821` | 2026-10-08 17:26:57 |
| Production | `e2e/.private/prod-cutover-2026-09-24/paused-backup.zip` | `8e20befc01c416d85daeee254c8054887124f1c98f8f76251fbbfee9b0442192` | 2026-10-08 19:27:01.310 |

The backup archives, restore comparisons, preparations and acceptance evidence
remain private and untouched. Recovery previews are retained. Expiration of the
window is not an instruction to delete a backup or discard post-cutover work.
Use the compatible pre-retirement release for old-backup recovery; this release
intentionally cannot resume legacy gameplay.

## Standards review

No outstanding documented-standard violations or blocking findings. Review
follow-up removed obsolete deletion interfaces and empty layout/exception blocks,
separated cleanup validation, and bounded the cleanup to four documents per call.

## Spec review

No identified unsafe cleanup or canonical history regression. One partial
requirement remains: execute authorized live cleanup, then remove compatibility
schema and preparation modules. Do not close #91 before those steps finish.

## Validation evidence

The strict acceptance gate passed on 2026-09-24 at 20:52 UTC: typecheck, lint,
three build checks, 815 tests across 81 files, and all 487 rules cases with zero
gaps or errors. All ten mandatory browser journeys passed without retries on
the isolated preview `e2e-local-andreasununger-slot-0`.

- Browser report: `e2e-artifacts/e2e-local-andreasununger-slot-0/everythingpath-e2e-PTp8Ow/report.json`
- Acceptance report: `coverage/acceptance.json`
- Verified source fingerprint: `2ef6eec5727623e5a1beb266e34bbe86b711fc68382fd30a735ab9c16f2f3dfa`

The character journey checks live character delivery and persisted officer
assignment across players. The cutover journey verifies bounded cleanup leaves
the accepted successor and immutable history unchanged. None of these tests
performed live dev or production cleanup.
