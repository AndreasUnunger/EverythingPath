# Foundry pf1 record ID stability across releases

Research for [Check whether Foundry pf1 record IDs stay stable across releases](https://github.com/AndreasUnunger/EverythingPath/issues/211), part of map #201. It tests the upsert key `<repo>/<pack>/<_id>` chosen in [Decide how the content dataset becomes the global catalog](https://github.com/AndreasUnunger/EverythingPath/issues/207) (see `docs/pf-character-sheet-data-model.md`, "Global catalog import").

## Answer

- **`_id` is stable.** Both repos keep a record's `_id` when it is edited, renamed or moved to another pack. Records are almost never deleted and re-created under a new `_id`:
  - in the system, 4 cases in 3 years;
  - in `pf1-content`, about 130 in its 2023–2024 cleanups (mostly rebuilt journals and roll tables), plus 51 given new IDs when moved to the third-party pack, and none since 11.0.0.
- **The pack segment is not stable.** Packs get renamed, and records move between packs and even between the two repos, keeping their `_id`. With the pack in the key, every such change would retire the old catalog entry and create a duplicate. Sheets would then stay on the retired copy.
- **Recommendation.** Match on `<repo>/<_id>`, and store the pack as an ordinary attribute that may change. Do not fall back to pack plus name, because names change far more often than IDs. Handle the rest with a small reviewed remap list in the Curation Overlay. Details are in [Recommendation](#recommendation).

## Sources and method

- **System.** [foundryvtt-pathfinder1](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1):
  - every tag from v9.0 (2023-07-17) to v11.11 (2026-03-09);
  - v0.82.5, the last release before per-record source files;
  - `master` at `fab25a15`, which is unreleased v12 development and does not descend from v11.11.
- **Module.** [pf1-content](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content):
  - every tag from 0.2.5 (2022-01-28) to 11.4.0 (2025-11-24);
  - the unreleased `V12` branch at `73685c65`, which forks from 11.3.2 and is compared against 11.3.2.
- **Records.**
  - In each snapshot, every top-level document under `packs/` (system) or `src/` (module) was parsed for `_id`, `name` and `_key`.
  - Embedded documents that 0.3.5–0.3.7 stored as separate files (`!tables.results!…`, `!scenes.tokens…`) were excluded.
  - The pack is the Foundry compendium `name` from `system.json` / `module.json`, because that is what appears in a `Compendium.<pkg>.<pack>.…` UUID. It is not the source directory, which sometimes differs (`racial-hd` was the directory of pack `racialhd` until v11.0).
- **Classification.** For each consecutive release pair:
  - **kept** means the same pack and `_id` exist in both;
  - **renamed** means it was kept but the `name` changed;
  - **moved** means the `_id` left its pack and now exists in another pack of the same repo;
  - **re-created** means the `_id` is gone, and a new `_id` with the same name (case and punctuation ignored) appeared in the same pack or another pack;
  - **dropped** covers everything else that disappeared.
- **Cross-checks.** Dropped IDs were checked against the other repo. Every `Compendium.pf1.…` / `Compendium.pf-content.…` reference in the sources was resolved against the records.

## Findings: pf1 system

| Release step | Records after | Kept (same pack + `_id`) | Renamed (same `_id`) | Moved pack (same `_id`) | Re-created (new `_id`) | Dropped |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| v0.82.5 → v9.0 (JSON to per-record files) | 9,582 | 9,375 of 9,387 | 21 | 0 | 0 | 12 |
| v9.0 → v9.6 (6 releases) | 9,680 | — | 40 | 0 | 1 | 11 |
| v9.6 → v10.0 | 10,164 | 9,629 of 9,680 | 103 | 0 | 1 | 50 |
| v10.0 → v10.8 (8 releases) | 10,237 | — | 72 | 0 | 1 | 47 |
| v10.8 → v11.0 | 10,581 | 10,141 of 10,237 | 128 | **82** (pack renames) | 0 | 14 |
| v11.0 → v11.11 (11 releases) | 10,652 | 10,581 of 10,581 | 10 | 0 | 0 | 0 |
| v11.11 → master (unreleased v12) | 11,770 | 10,614 of 10,652 | 107 | 0 | 2 | 36 |

Rows that span several releases sum the per-release steps.

- **Cumulative v9.0 → v11.11.**
  - 9,462 of 9,582 v9.0 IDs (98.7%) still exist: 9,403 in the same pack and 59 in a renamed pack.
  - 332 of the kept records (3.5%) changed name.
  - 4 were re-created with a new ID.
  - 116 were dropped.
- **Uniqueness.** `_id` is unique across all packs in every system snapshot, with 0 duplicates. Pack plus name is not unique: 7 duplicate pairs at v11.11 and 74 on master, such as `class-abilities` "Iron Skin" and `buffs` "Resistance".
- **Pack renames (v11.0).**
  - `racialhd`→`racial-hd` (13 records), `commonbuffs`→`buffs` (54), `mythicpaths`→`mythic-paths` (6), `sample-macros`→`macros` (5) and `pf1e-rules`→`rules` (4).
  - Every `_id` was kept. The [v11.0 changelog](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/v11.11/CHANGELOG.md) flags this as breaking (issue 3538).
  - The system registers `CONFIG.compendium.uuidRedirects` from the old pack prefix to the new one (`compendiumRenames` in [`module/migration.mjs`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/v11.11/module/migration.mjs)).
- **Re-creations** (same name and pack, new `_id`):
  - `class-abilities` "Spell Storing" `qnL3oisZNJSCFy57` → `eSTdrPzQdLLt04Fq` (v9.5);
  - "Sneak Attack (UC)" `RQhe13icVRkOH5Ru` → `rg0FL5INDBUt2oSK` (v10.0);
  - on master, `items` "Vial of Efficacious Medicine" `iozygnukcjnalblv` → `AkzQ5jZYhVLo1sQ0`, and one `ultimate-equipment` roll table.
- **Drops** are mostly class abilities merged into one generic ability, such as "Trap Sense (INV)" folding into "Trap Sense".
  - Upstream redirects 9 of them with an explicit old-UUID → new-UUID table: `moved` in `module/migration.mjs` at v11.11 and `module/migration/migration-data.mjs` on master. Examples are Trapfinding, Trap Sense, Danger Sense, Fast Movement and Poison Use (v10–v11), and Still Mind (v12).
  - The other drops have no redirect.
  - The 36 drops in v10.3 were the Vampire Hunter D collaboration content. It moved to `pf1-content` pack `pf-collab-content` with the **same `_id`s**, a cross-repo move.
- **Renames** keep the ID and are frequent. Examples are "Godsbrew" → "Caydenbrew", "Hook, Grappling (Common)" → "Grappling hook, common", "Chaos Blessing: Battle Companion" → "Battle Companion (Chaos)" and "Overbearing Assault (UC)" → "Overbearing Assault".
- **Stated policy.**
  - [CONTRIBUTING.md](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/v11.11/CONTRIBUTING.md) has no ID-stability rule. It says compendium content should preferably be edited inside Foundry and extracted with `npm run packs:extract`, which round-trips the existing `_id`.
  - The redirect tables are the de facto policy: when an ID or pack goes away, upstream sometimes adds a redirect.

## Findings: pf1-content

| Release step | Records after | Kept | Renamed | Moved pack (same `_id`) | Re-created (new `_id`) | Dropped |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 0.2.5 → 0.3.4 (9 releases) | 21,547 | all | 2 | 0 | 0 | 0 |
| 0.3.4 → 0.3.5 (source re-extraction) | 21,230 | 21,226 | 0 | 27 | 0 | 294 |
| 0.3.5 → 0.3.6 | 16,986 | 16,888 | 8 | 0 | 77 | 4,265 |
| 0.3.7 → 10.0.0 | 16,310 | 15,959 | 1,973 | 77 | 46 | 903 |
| 10.0.0 → 10.1.1 | 16,486 | 16,237 | 151 | 0 | 0 | 73 |
| 10.1.1 → 10.2.0 | 16,271 | 15,428 | 4 | **815** | 27 (other pack) | 216 |
| 10.2.0 → 11.0.0 | 16,069 | 16,029 | 17 | 0 | 24 (other pack) | 218 |
| 11.0.0 → 11.3.2 (5 releases) | 16,341 | — | 96 | 0 | 0 | 71 |
| 11.3.2 → 11.4.0 | 16,399 | 16,281 | 1 | 56 | 0 | 4 |
| 11.3.2 → V12 branch (unreleased) | 16,194 | 16,143 | 1 | 50 | 0 | 148 |

Rows that span several releases sum the per-release steps.

- **Cumulative 10.0.0 → 11.4.0.**
  - 15,696 of 16,310 IDs (96.2%) still exist: 14,846 in the same pack and 850 in a different pack.
  - 252 of the kept records changed name.
  - 60 were re-created, 59 of them in another pack.
  - 554 were dropped.
- **Uniqueness.**
  - `_id` is unique across packs in every release since 0.3.5.
  - 0.3.4 had 27 IDs in two packs, because the Elephant in the Room records existed both in `pf-elephant` and in its per-category source folders.
  - Pack plus name is not unique: 128 duplicate pairs at 11.4.0, such as `pf-class-abilities` "Air" and `pf-artifacts` "Sihedron".
- **Pack renames and moves.**
  - In 10.2.0, `pf-magicitems` became `pf-magic-items` (780 records) and `pf-elephant` became `pf-third-party` (35 records).
  - In 10.0.0, 77 cursed items moved from `pf-artifacts` to `pf-cursed-items`.
  - In 11.4.0, 50 items moved to `pf-society`, 5 to `pf-scaling-items` and 1 to `pf-intelligent-items`.
  - All of these kept their `_id`.
  - The module's own redirect table in [`pf-content.js`](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/main/pf-content.js) is wrong. It maps `pf-elephant`→`pf-3rd-party` and `pf-magic`→`pf-magic-items`, but the real names are `pf-third-party` and `pf-magicitems`. Old UUIDs into those packs do not redirect.
- **Re-creations** with a new `_id` happen in a few cases:
  - the Harrow deck journals were rebuilt in 0.3.6 (60);
  - encounter tables were rebuilt in 10.0.0 (32);
  - Iron Gods tech in 0.3.6 (14);
  - items moved into `pf-third-party` in 10.2.0 and 11.0.0 got new IDs (51), such as "Dacris" `vnH6gYayxAj1m2ra` → `yWmoC0fhqa1W9NF3` and "Chaos Diamond" `XsWn3Z3fjgCiWQyC` → `9RHlP6A99LTi9azx`;
  - one same-pack case since 10.0.0: `pf-wondrous` "Incandescent Blue Sphere Ioun Stone" `795YaQN5z26ewvLF` → `4LqB3gonqhdaoEgE`.
- **Drops** are mostly deliberate de-duplication against the system. The [changelog](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/main/CHANGELOG.md) has entries such as "Removed duplicate items that existed in the system", "removed clothing items already in system", "moved quick stow feat to system" and "Technology has been moved to the system itself".
  - Of 5,840 dropped records across all releases, 4,107 have a same-named record in the system under a **different** `_id`.
  - 418 reappear in the system under the **same** `_id`. These are 279 `pf-tech` records that became system `technology` in v10.0, 15 feats and monster rules in 11.x, and 124 items on the V12 / system-master pair, such as "Litchina" `pByaFdX4Ih1Yty0t`.
  - Kingdom-building content was removed in 10.2.0 (199 records) with no replacement.
- **Name churn is large.** 1,973 renames in 10.0.0 alone, such as "Drakesbane Horn [Artifact]" → "Drakesbane Horn", "Ring Of Feather Falling" → "Ring of Feather Falling" and "Winner's Luck (Varisia; Riddleport)" → "Winner's Luck (Riddleport)".
- **Stated policy.** [CONTRIBUTING.md](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/main/CONTRIBUTING.md), "Item renaming", says: *"Every item in the database has a unique id field `_id` … When new items are inserted a new `_id` is generated, if you want to keep the original entry's id so that existing games using the item get the updates rather than a new item, you need to preserve this ID."* Preserving the ID is the documented intent, but it depends on the contributor.

## Cross-repo ID overlap

- Each repo's IDs are unique within that repo. The same `_id` can exist in both repos at once, because records are copied from `pf1-content` into the system before the module drops them.
- The overlap is 1 ID between v11.11 and 11.4.0, and 62 IDs between system master and the V12 branch. The repo segment must therefore stay in the key.

## Compendium UUID references

Upstream content links to other records by `Compendium.<pkg>.<pack>.<Type>.<_id>`. Re-creating a record breaks these links, and so does renaming a pack unless a redirect is registered.

- **System v11.11.**
  - Its pack sources hold 11,109 such references.
  - 10,571 resolve directly.
  - 533 still use pre-v11.0 pack names and resolve only through the `compendiumRenames` redirect.
  - 5 are broken. One example is `Compendium.pf1.class-abilities.Item.kKaz5A6XbuxgVvhO`, which is covered by the `moved` redirect. Another is `aQ0aWLmgTI3TIGXo`, which now lives in `pf-content.pf-collab-content`.
- **pf1-content 11.4.0.**
  - It holds 11,690 references: 5,006 into `pf1` and 6,684 into `pf-content`.
  - 11,355 resolve directly.
  - 146 resolve through the system's pack-rename redirect.
  - 178 point at an `_id` that now lives in another pack or repo. 126 of them are `Compendium.pf-content.pf-feats.Item.n1wLrcwaqOSDqrOo` (Improved Natural Armor), which moved to system `feats` with the same `_id`.
  - 11 are dangling.

The upstream authors depend on IDs staying fixed, and the evidence shows they mostly do. The links that break come from moves and pack renames, not from re-issued IDs.

## Recommendation

1. **`<repo>/<pack>/<_id>` is not a safe upsert key, but only because of the pack segment.** In the window the importer cares about (system v10–v11, module 10.x–11.x), these changes keep the `_id` while changing the pack:
   - 82 system records in pack renames;
   - about 850 module records in pack renames and moves, such as `pf-magicitems`→`pf-magic-items` and `pf-wondrous`→`pf-society`.

   Each of these would retire the old entry and create a duplicate.
2. **Upsert by `<repo>/<_id>`.** Store the pack as a mutable field and update it on import.
   - `_id` was unique across packs in every release checked: since v9.0 in the system and since 0.3.5 in the module.
   - Assert this uniqueness in the importer, and fail the import if it ever breaks.
   - The `externalKey` string can keep its current format for display. Matching must ignore the pack segment, or the key must drop it. Changing the format in `docs/pf-character-sheet-data-model.md` is a follow-up and is not done here.
3. **Do not fall back to pack plus name.**
   - Names change far more often than IDs are re-issued. The system had 332 renames against 4 re-creations from v9.0 to v11.11. The module had 252 renames against 1 same-pack re-creation from 10.0.0 to 11.4.0.
   - Pack plus name is not unique (7–128 duplicate pairs per snapshot).
   - Name matching would also merge different records, such as the per-element "Air" abilities.
4. **Handle what remains with a remap list in the Curation Overlay.** It is a reviewed map from old key to new key, applied before retirement. The import report should propose candidates for:
   - **Cross-repo moves with the same `_id`**, from `pf1-content` to `pf1` or back. There were 418 of these, plus the 36 Vampire Hunter D records. The same `_id` turning up in the other repo is a strong automatic signal.
   - **Upstream merges and redirects.** Seed these from the system's `moved` table (9 entries) and read `CONFIG.compendium.uuidRedirects`-style tables on every pin bump. The module's own table is currently wrong, so check it rather than trusting it.
   - **Rare re-creations.** These are a retired entry plus a new entry with the same normalised name in the same pack, roughly 0–2 per release.
   - **Duplicates the module removes in favour of a system record** with a different `_id` (4,107 historically, about 270 since 10.0.0). These are optional. Without a remap, sheets stay on the retired module copy, which is safe but no longer updated.

   Remapping repoints Character Sheet Entries from the retired row to its successor. Candidates the report finds but nobody reviews stay retired, which matches the existing "never deleted" rule.
5. **Expect churn at major versions, not patches.**
   - Every rename, move and re-issue above happened at a major release (v10.0, v11.0, 10.0.0, 10.2.0, 11.0.0) or on an unreleased v12 branch.
   - The system's v11.0–v11.11 patch line had zero dropped, moved or re-created IDs across 11 releases.
   - Pin bumps across a major version deserve a closer read of the import report.
