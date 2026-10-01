# Section 15 sources for the imported PF1 catalog

Research for [Find the Section 15 text for every imported source book](https://github.com/AndreasUnunger/EverythingPath/issues/224), part of map #201. [Decide how the content dataset becomes the global catalog](https://github.com/AndreasUnunger/EverythingPath/issues/207) ships a generated in-app legal page. Its Section 15 is to be built from the imported entries' `sources` plus `pf1-content`'s Section 15 list (`docs/pf-character-sheet-data-model.md`, "Global catalog import", on `feature/pf1-character-builder`). This note checks whether that is enough. The scope is every source book cited by a pack the catalog imports, not only spells.

## Answer

- **The imported packs cite 352 product codes.** 348 are in the system's source registry. Four are not, and two of those could not be identified. One more source is cited by title only, a Paizo blog post. 7,447 of the 20,237 imported records (37%) cite no source at all, including 3,250 of `pf-content`'s 3,251 feats.
- **No upstream file covers them.**
  - The system's `OGL.txt` Section 15 lists only the OGL, the SRD and Foundry.
  - `pf1-content`'s `OGL.txt` lists 204 of the 352 books (58%). It has not changed since January 2021, and it lacks the other 148, including *Adventurer's Guide*, *Black Markets*, *Inner Sea Intrigue* and *Adventurer's Armory 2*.
  - Paizo's own PRD Section 15 covers 19 books, all but one of them already in `pf1-content`'s list.
  - Together, `pf1-content`'s list and the PRD cover **205 books**, which account for 82% of source citations.
- **Secondary compilations close most of the gap.**
  - The Archives of Nethys (AoN) Licenses page has a Section 15 block per book. It covers 318 of the 352 books, including 131 that neither `pf1-content` nor the PRD has.
  - d20pfsrd's Section 15 sheet covers 210. It is nearly the same list as `pf1-content`'s, and it adds two more books: the *Carrion Crown* and *Curse of the Crimson Throne* Player's Guides.
  - With all four sources, **338 books** are covered.
- **14 books have no Section 15 anywhere online:**
  - *Bestiary 6*, *Horror Realms*, *Faiths of Purity* and *Goblins of Golarion*;
  - the *Kingmaker* and *Serpent's Skull* Player's Guides;
  - *Shattered Star #4*, *We Be Goblins!*, *We Be 5uper Goblins!* and the *Pathfinder Society Roleplaying Guild Guide*;
  - two Dynamite comics;
  - two unidentified codes.

  Together they account for 216 citations. Their entries have to be transcribed from the printed books.
- **Every source has errors, so none can be copied blindly.**
  - `pf1-content`'s *Ultimate Combat* line carries *Ultimate Magic*'s author list. Its *Core Rulebook* line reads "© 2010 … Jason Buhlman".
  - AoN's *Occult Mysteries* block holds *Numeria*'s notice. AoN has no block at all for *Advanced Race Guide*, *Bestiary 5* or *Bestiary 6*.
  - Even the PRD has typos ("AUthors", "Schwwartz").
- **What the licence requires.**
  - Section 15 is only the place where notices go. The obligation is in Section 6: include "the exact text of the COPYRIGHT NOTICE of any Open Game Content You are copying", and add our own title, date and copyright holder for any original Open Game Content we distribute.
  - Section 10 requires shipping the licence text, and Section 8 requires marking which content is Open Game Content.
  - Paizo's Community Use Policy separately requires reproducing "Paizo's copyright and trademark notices from all Paizo Material that you use".
- **Recommendation.**
  - Keep a reviewed Section 15 registry file in the repo, keyed by product code. Seed it from the PRD, `pf1-content` and AoN, check each entry against the printed book, and transcribe the 14 gaps.
  - Generate the page from that registry plus both upstream notices verbatim and our own line.
  - Fail the import when an imported entry cites a product code the registry lacks.

  Details are in [Recommendation](#recommendation).

## Sources and method

- **Foundry pf1 system** ([foundryvtt-pathfinder1](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1)) at tag `v11.11` (`418761d2`, 2026-03-09), the release pinned by the earlier research:
  - every pack under `packs/`;
  - `module/registry/sources.mjs`, the source registry;
  - `OGL.txt`, `LICENSE.txt` and `README.md`.
- **pf1-content** ([pf1-content](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content)) at tag `11.4.0` (`02f4ab0d`, 2025-11-24):
  - every pack under `src/`;
  - `OGL.txt`, `LICENSE.md`, `README.md` and `CREDITS.md`;
  - the history of `OGL.txt` from the GitLab API;
  - one record on the unreleased `V12` branch.
- **Paizo, first-party:**
  - the PRD's Open Game License page. `paizo.com/pathfinderRPG/prd/openGameLicense.html` now redirects to [legacy.aonprd.com/openGameLicense.html](https://legacy.aonprd.com/openGameLicense.html), the archived PRD. Paizo's own PRD URL still points there, so it is treated as first-party;
  - the [Community Use Policy](https://paizo.com/licenses/communityuse), last updated 2024-08-22;
  - the store page for *Bestiary 6*, checked as a sample of how product codes appear as store SKUs.
- **Secondary compilations, flagged as such:**
  - **[Archives of Nethys, Licenses](https://aonprd.com/Licenses.aspx).** AoN publishes PF1 under a commercial licence from Paizo. Its Licenses page has 412 per-book `<h3>` blocks of Section 15 lines.
  - **[d20pfsrd legal page](https://www.d20pfsrd.com/extras/legal/).** Its Section 15 is an embedded [Google Sheet](https://docs.google.com/spreadsheets/d/1OhL3YCCMQqRJQ2MposZwk4UTcC465soWqwxQE9XuHv8) of 1,244 lines, exported as CSV on 2026-10-01.
- **Scope.** The imported packs are the ones named in "Global catalog import":
  - **System:** `races`, `classes`, `class-abilities`, `feats`, `items`, `armors-and-shields`, `weapons-and-ammo`, `buffs`.
  - **pf1-content:** `pf-class-abilities`, `pf-feats`, `pf-traits`, `pf-racial-traits`, `pf-items`, `pf-magic-items`, `pf-wondrous`, `pf-artifacts`, `pf-buffs`.
  - **"Every item pack"** is also read to include the system's `technology` and `pf1-content`'s `pf-cursed-items`, `pf-intelligent-items`, `pf-scaling-items` and `pf-special-qualities` (weapon and armour special abilities). These five add only 4 books.
  - **Left out:** the system's `ultimate-equipment` pack, which holds only roll tables. Also left out are the spell pack, goods and services, third-party, 3.5 and collaboration packs.
  - Spells are reported separately for comparison with `research/pf1-spell-data`.
- **Method.**
  - Every YAML record was parsed. Folder records were excluded.
  - Each `system.sources[].id` was resolved against the registry's `_defaultData`, which was evaluated as a literal.
  - Titles were normalised for case, curly quotes, `&`, HTML and punctuation, and series prefixes were stripped: "Pathfinder Player Companion:", "Pathfinder Campaign Setting:", "Pathfinder Roleplaying Game", "Pathfinder Adventure Path #N:", "Pathfinder N:", module codes such as "D0" and "LB1", and "volume #N". Each book was then matched against the title part of every Section 15 line (the text before "©" or "Copyright"). For AoN the match was against the block heading.
  - Every hit was checked to contain the book's own title, and every miss was searched again as a raw substring. Eight AoN headings that differ from the registry title were mapped by hand, for example "PRPG Core Rulebook" and "Pathfinder #91: Battle of Bloodmarch Hills".
  - This finds more than the plain title search in `research/pf1-spell-data`. On the same spell books it finds 128 of 195 in `pf1-content`'s list where that search found 97, mainly Adventure Path volumes numbered "Pathfinder 26:" and "#43".

## How product codes map to titles

- **Records cite a code, not a title.**
  - Records carry `system.sources: [{ id, pages }]`, where `id` is a Paizo product code such as `PZO1110`.
  - Rarer shapes: `errata` (5 records) and `edition` (1). Title-only `{ title, pages }` entries appear in scope only for *Paizo Blog: The Gauntlet Will Be Ours!* (7 citations).
  - In scope, 14,706 source citations name a code.
- **The registry turns codes into titles.** It is `module/registry/sources.mjs` in the system, and pf1-content uses the same codes.
  - It has 466 entries: 458 Paizo, 8 Dynamite comics.
  - Each entry has `_id` (the code), `name`, `abbr`, `date`, `pages`, `isbn`, `url`, `type` (core, setting, companion, pg, ap, module, pfs, comic) and `legacy` (3.5 material).
- **The codes are Paizo's own SKUs.** Paizo's store lists *Bestiary 6* as SKU `PZO1137E`, the registry's `PZO1137` plus a format suffix.
- **The registry's `url`s no longer work.** They point at `paizo.com/products/…`, which now redirects to the store's home page.
- **Registry defects that matter here:**
  - `PZO90119` appears twice. The first entry is *Ironfang Invasion #4: Siege of Stone*, which is really `PZO90118`. Three records cite `PZO90118`, which the registry therefore lacks.
  - `PZO1002-PGE` appears twice, for the original and the Anniversary *Rise of the Runelords Player's Guide*.
  - Four cited codes are not in the registry:
    - `PZO90118`, as above;
    - `PZO9000-S`, which AoN's *False Jewelry* page identifies as *Rise of the Runelords Player's Guide*, p. 11;
    - `PZOPSS0412`, which by the registry's own pattern (`PZOPSS0310E` is Scenario #3–10) is probably PFS Scenario #4–12, though this is unconfirmed;
    - `PZOGWK0001`, which is unidentified.
  - The title "The Infernal Syndrom" is misspelled.
- **Licence of the registry.** The registry is GPL code. The map allows only content fields from the GPL repos, so the code-to-title table we ship should be our own. The registry can still be read at import time as a cross-check.

## Records without a source

| Pack | Records | Without `sources` |
|---|---:|---:|
| `pf1/class-abilities` | 4,651 | 2,990 |
| `pf-content/pf-feats` | 3,251 | 3,250 |
| `pf-content/pf-class-abilities` | 767 | 751 |
| `pf-content/pf-buffs` | 254 | 202 |
| `pf1/items` | 1,031 | 164 |
| `pf1/armors-and-shields` | 66 | 37 |
| `pf-content/pf-traits` | 1,983 | 27 |
| other in-scope packs | 8,234 | 26 |
| **total** | **20,237** | **7,447** |

- **Links recover few of them.** 160 of the unsourced `pf-buffs` link to a spell that has sources. Of the unsourced system class abilities, 810 link to a sourced record and 262 more are linked from one, mostly from their class. Following links adds only 4 books to the 352.
- **The feats are unsourced upstream too.** The `V12` branch is no different. Per `CREDITS.md`, pf1-content's feats came from a Pathfinder Community CSV, and that sheet has a source column.
- **The current fail rule does not catch this.** The data model says the import fails if a pack has "neither per-entry sources nor a Section 15 list". `pf-feats` passes only because `pf1-content` has a list, and that list is the one that is 42% short.

## Coverage

What each source holds for the 352 books:

- **`pf1-content` `OGL.txt`:** 488 lines, of which the Section 15 has 463 entries, Tome of Horrors lines included. Last changed `39614c37` on 2021-01-26; the later commits only moved the file. It shares 204 books with our list, and 201 of those 204 lines are identical to d20pfsrd's.
- **System `OGL.txt`:** the OGL, the SRD and "Foundry Virtual Tabletop © 2019, Foundry Gaming LLC", and nothing else.
- **Paizo PRD:** 145 lines covering the PRD books: Core, APG, GMG, Bestiaries 1–5, ACG, ARG, Monster Codex, Mythic, NPC Codex, Occult, Unchained, UM, UC, UCampaign, UE and Technology Guide, plus their third-party chain. 19 of them are cited by the imported packs.
- **AoN:** one block per book. The block holds the book's own notice and the chain it inherits, such as Tome of Horrors monsters and *Book of Fiends*. The OGL and SRD lines are given once at the top. 412 blocks; 318 of our books.
- **d20pfsrd:** 1,244 flat lines; 210 of our books.

| Type | Books | `pf1-content` | PRD | AoN | d20pfsrd | `pf1-content` or PRD | Any | None |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Core rulebooks | 26 | 24 | 18 | 23 | 24 | 24 | 25 | 1 |
| Campaign setting | 63 | 49 | 1 | 54 | 49 | 50 | 62 | 1 |
| Player Companion | 93 | 57 | 0 | 87 | 57 | 57 | 91 | 2 |
| Player's guides | 25 | 8 | 0 | 21 | 10 | 8 | 23 | 2 |
| Adventure Path volumes | 114 | 57 | 0 | 112 | 61 | 57 | 113 | 1 |
| Modules | 26 | 9 | 0 | 21 | 9 | 9 | 24 | 2 |
| Pathfinder Society | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| Comics (Dynamite) | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| Not in registry | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| **Total** | **352** | **204** | **19** | **318** | **210** | **205** | **338** | **14** |

- **By citation.** Of 14,706 source citations, 12,007 (81.6%) cite a book in `pf1-content`'s list or the PRD, 2,483 (16.9%) cite a book found only in AoN or d20pfsrd, and 216 (1.5%) cite a book found nowhere.
- **By repo.** Of the 138 books the system packs cite, 88 are in `pf1-content`'s list. Of the 338 that `pf1-content`'s own packs cite, only 195 are.
- **Books found only in secondary sources (133).** Most are Adventure Path volumes (56), Player Companions (34), player's guides (15) and modules (15). The most cited are *Adventurer's Guide* (146), *Adventurer's Armory 2* (141), *Blood of the Sea* (114), *Alchemy Manual* (114), *Blood of the Moon* (91), *Kobolds of Golarion* (74), *People of the Stars* (73) and *Magical Marketplace* (64).
- **Spells, for comparison.** The 195 spell books are covered as follows: 128 in `pf1-content`'s list, 10 in the PRD, 178 in AoN, 132 in d20pfsrd and 191 in any source. The spell pack is not imported. Spell buffs are, and they cite their own sources.

### Gaps: no Section 15 found anywhere

| Code | Title | Type | Citations | Cited by |
|---|---|---|---:|---|
| PZO1137 | Bestiary 6 | core | 45 | `pf-racial-traits` 32, `pf-artifacts` 6, `races` 5, `pf-buffs` 2 |
| PZOPSS0000E | Pathfinder Society Roleplaying Guild Guide | pfs | 66 | `pf-traits` 66 |
| PZO9419 | Goblins of Golarion | companion | 32 | `pf-traits` 20, `pf-items` 7, `pf-wondrous` 4, `items` 1 |
| PZO9416 | Faiths of Purity | companion | 22 | `pf-traits` 22 |
| PZO9000-6E | Kingmaker Player's Guide | pg | 12 | `pf-traits` 12 |
| PZO9000-7E | Serpent's Skull Player's Guide | pg | 10 | `pf-traits` 10 |
| DYN0032-E | Worldscape #2 (Dynamite) | comic | 8 | `pf-racial-traits` 7, `races` 1 |
| PZO9297 | Horror Realms | setting | 7 | `class-abilities` 5, `pf-items` 1, `pf-artifacts` 1 |
| PZO9064 | Shattered Star #4: Beyond the Doomsday Door | ap | 6 | `pf-magic-items` 5, `pf-wondrous` 1 |
| PZO9500-5 | We Be Goblins! | module | 4 | `pf-traits` 4 |
| PZO9500-12 | We Be 5uper Goblins! | module | 1 | `pf-wondrous` 1 |
| DYN0046-HC | Spiral of Bones (Dynamite) | comic | 1 | `pf-wondrous` 1 |
| PZOPSS0412 | not in registry (probably PFS Scenario #4–12) | — | 1 | `pf-wondrous` 1 |
| PZOGWK0001 | not in registry, unidentified | — | 1 | `pf-wondrous` 1 |

- **Why they are missing.** AoN has blocks for *We Be Goblins Free!*, *Too!* and *B4*, but not for the original *We Be Goblins!*. Several gap books are free Paizo PDFs: the player's guides, *We Be Goblins!* and the Guild Guide. Their printed Section 15 can be read from the download.
- **The Dynamite comics are a separate question.** They may carry no OGL notice at all, in which case their content is not Open Game Content. Only 9 citations depend on them.

### Text quality

- **Comparison with the PRD.** For the 19 PRD books, each book's own line was compared with the PRD's, with whitespace, punctuation and case ignored:
  - **`pf1-content` differs on 6.** Its *Ultimate Combat* line lists *Ultimate Magic*'s authors ("Jason Bulmahn, Tim Hitchcock, Colin McComb, Rob McCreary, …"), where the PRD has "Dennis Baker, Jesse Benner, Benjamin Bruck, …". Its *Core Rulebook* line reads "Core Rulebook. © 2010, … Author: Jason Buhlman", where the PRD has "© 2009 … Jason Bulmahn". *Unchained* has "Ross Beyers" for "Ross Byers", and *Bestiary 5*, *GameMastery Guide* and *Ultimate Equipment* differ in small ways.
  - **d20pfsrd** repeats the same *Ultimate Combat* and *Core Rulebook* errors.
  - **AoN** agrees with the PRD on *Ultimate Combat*, but has the 2010 *Core Rulebook* date and "Ross Beyers".
- **The PRD has its own typos.** Examples are "AUthors", "David Schwwartz", "Wolfgang Buar" and "Amber Scorr". It is first-party, but it is not proof of what a given printing says.
- **Agreement between sources.** `pf1-content` and d20pfsrd agree on 201 of 204 shared books, which suggests `pf1-content`'s list was taken from d20pfsrd. AoN agrees with `pf1-content` on 172 of 185, and on year and holder for 181.
- **AoN errors.**
  - Its *Occult Mysteries* block holds *Numeria, Land of Fallen Stars*'s notice and not the book's own.
  - It has no block for 32 of our books, among them *Advanced Race Guide*, *Bestiary 5*, *Bestiary 6*, *Inner Sea Magic*, *The Inner Sea World Guide*, *Rival Guide* and *Pathfinder Society Field Guide*.
  - Its *Technology Guide* entry is correct. `pf1-content` has only *Technology Guide Update 1.0*, which is a different product.
- **"Exact text" is therefore not one string per book.** Printings differ, as the 2009 and 2010 *Core Rulebook* lines show. A reviewed registry should record which printing or source each line was checked against.

## What OGL 1.0a requires

Quoted from the licence as Paizo published it in the PRD ([legacy.aonprd.com/openGameLicense.html](https://legacy.aonprd.com/openGameLicense.html)). `pf1-content`'s `OGL.txt` has the same wording.

> 2. The License: This License applies to any Open Game Content that contains a notice indicating that the Open Game Content may only be Used under and in terms of this License. You must affix such a notice to any Open Game Content that you Use. No terms may be added to or subtracted from this License except as described by the License itself. No other terms or conditions may be applied to any Open Game Content distributed using this License.

> 6. Notice of License Copyright: You must update the COPYRIGHT NOTICE portion of this License to include the exact text of the COPYRIGHT NOTICE of any Open Game Content You are copying, modifying or distributing, and You must add the title, the copyright date, and the copyright holder's name to the COPYRIGHT NOTICE of any original Open Game Content you Distribute.

> 8. Identification: If you distribute Open Game Content You must clearly indicate which portions of the work that you are distributing are Open Game Content.

> 10. Copy of this License: You MUST include a copy of this License with every copy of the Open Game Content You distribute.

> 15. COPYRIGHT NOTICE

What these sections mean for the legal page:

- **Section 15 is only a heading.** It is the "COPYRIGHT NOTICE portion" that Section 6 refers to, and it imposes nothing of its own.
- **Copied content needs the exact notice it came with.** Section 6's first half applies to everything we take from the two repos. The content's own notice is the Section 15 it was distributed with. For the Foundry packs that is the upstream `OGL.txt`, which is incomplete, so the faithful notice for each entry is its source book's Section 15, including the chain that book inherited (for example "Genie, Marid from the Tome of Horrors Complete …" in *Adventurer's Guide*). This is why per-book entries are needed, and not just a list of titles.
- **Our own content needs our own line.** Section 6's second half covers anything original that we distribute as Open Game Content. The Curation Overlay's authored Modifiers and the CRB conditions written from our corpus count, if we publish them as Open Game Content. They need an EverythingPath line with title, year and copyright holder.
- **The page needs two further statements:**
  - a statement of which content is Open Game Content (Section 8), for example all imported rules text, with Product Identity excluded;
  - the full licence text (Section 10), plus a notice that the content is used under the OGL (Section 2).
- **Listing extra notices is allowed.** Nothing in the licence forbids notices that are not strictly needed, so a superset is safe and a missing entry is not.
- **The Community Use Policy adds a parallel duty.** It says: "You must reproduce Paizo's copyright and trademark notices from all Paizo Material that you use in your project," and "If the Paizo Material you're using clearly credits its authors or artists, you must reproduce that credit." It also prescribes its own notice text. The system and `pf1-content` READMEs carry an older wording that points to `paizo.com/communityuse`.

This is a reading of the licence text, not legal advice.

## Recommendation

1. **Keep a reviewed Section 15 registry file in the repo, keyed by product code.** It should sit beside the Curation Overlay and be reviewed the same way. Each record holds:
   - `title`, the full printed title, so the registry also serves as our own code-to-title map and the GPL registry is not shipped;
   - `notice`, the book's own Section 15 lines in printed order, verbatim, including inherited third-party lines but not the OGL and SRD lines;
   - `checkedAgainst`: `printed` (with printing or PDF version), `prd`, `aon` or `pf1-content`;
   - `checkedOn`;
   - optional `aliases` for the registry's broken codes (`PZO90118`, `PZO9000-S`).

   Title-only sources such as the Paizo blog get a record under a synthetic key.
2. **Seed it mechanically, then review it.**
   - Take the 19 PRD books from the PRD.
   - Take 301 more books from AoN's per-book blocks, which unlike the flat lists carry each book's inherited chain.
   - Take `pf1-content`'s line for the 16 books that only it covers, such as *Inner Sea Magic*, *The Inner Sea World Guide*, *Rival Guide* and *Pathfinder Society Field Guide*.
   - Take d20pfsrd's line for the *Carrion Crown* and *Curse of the Crimson Throne* Player's Guides.
   - That covers the 338 books with a known entry. *Advanced Race Guide* and *Bestiary 5* are among the PRD books, though AoN lacks them.
   - Flag every record where the sources disagree. That is about 13 books among those both AoN and `pf1-content` cover, plus the 6 PRD differences.
   - Then check records against the printed books, starting with the most cited (CRB, UE, ARG, ACG, APG, Occult Adventures), and correct the known errors: *Ultimate Combat*'s authors and AoN's *Occult Mysteries*.
3. **Transcribe the 14 gaps from the books.** The free PDFs (the player's guides, *We Be Goblins!*, the Guild Guide) can be read directly. *Bestiary 6*, *Horror Realms*, *Faiths of Purity*, *Goblins of Golarion* and *Shattered Star #4* need the purchased PDF. Settle whether the two Dynamite comics carry an OGL notice, and identify `PZOGWK0001` and `PZOPSS0412`, or exclude those three entries.
4. **Generate the page from the registry.** Its parts, in order:
   1. the OGL 1.0a text;
   2. a Section 15 made of: the OGL and SRD lines; both upstream `OGL.txt` notices verbatim, because we copy their distributions, errors and all; the registry notices for every code cited by any imported entry; and an EverythingPath line for our original Open Game Content;
   3. a Section 8 statement;
   4. the current Community Use notice.

   De-duplicate lines by normalised text. Where variants of the same line differ, keep the reviewed registry variant and keep the upstream copies only as part of the verbatim upstream blocks.
5. **Make the import gate per entry, not per pack.**
   - Fail the import when an imported entry cites a code, or a title-only source, that the registry lacks.
   - List unsourced entries in the import report by pack.
   - Cross-check registry titles against `sources.mjs` in the import report, so registry renames and fixes upstream are noticed.

   This replaces "fails if an imported pack has neither per-entry sources nor a Section 15 list", which passes `pf-feats` with 1 sourced feat out of 3,251.
6. **Unsourced entries.** The 7,447 records without a source are covered only by the upstream notices, which are incomplete. Until they have sources, the safe choice is a superset: give the page a registry notice for every product code cited anywhere in the imported packs (the 352), and accept that this cannot be shown to be exact. See the open item below.

## Open items

- **Sources for the 7,447 unsourced records.** Most are `pf-content` feats and class abilities and system class abilities. They could get sources through Curation Overlay records, an upstream contribution to `pf1-content` (its feats CSV has a source column), or a rule that inherits a class ability's source from its class or archetype. This needs a decision.
- **Printed-book review.** Someone with the PDFs has to check the registry. How much checking is enough before launch (all 352 books, or the most cited first) is a product decision.
- **Comics and unidentified codes.** Settle whether the Dynamite *Worldscape* and *Spiral of Bones* content is Open Game Content, and identify `PZOGWK0001` and `PZOPSS0412`.
- **Upstream fixes.** These could be reported or contributed upstream:
  - the registry's duplicate `PZO90119`, the missing `PZO90118`, `PZO9000-S`, the "Syndrom" typo and the dead `paizo.com/products` URLs;
  - `pf1-content`'s stale `OGL.txt`.

## Per-book coverage

`Y` means the book's own Section 15 entry was found in that source, and `–` means it was not. Citations count the in-scope records that cite the code, a record citing two books counting once for each. *(edge pack only)* marks books cited only by the five extra item packs.

### Core rulebooks (26)

| Code | Title | Citations | pf1-content `OGL.txt` | Paizo PRD | AoN | d20pfsrd |
|---|---|---:|:-:|:-:|:-:|:-:|
| PZO1129 | Advanced Class Guide | 529 | Y | Y | Y | Y |
| PZO1115 | Advanced Player's Guide | 460 | Y | Y | Y | Y |
| PZO1121 | Advanced Race Guide | 952 | Y | Y | – | Y |
| PZO1138 | Adventurer's Guide | 146 | – | – | Y | – |
| PZO1116 | Bestiary 2 | 53 | Y | Y | Y | Y |
| PZO1120 | Bestiary 3 | 38 | Y | Y | Y | Y |
| PZO1127 | Bestiary 4 | 72 | Y | Y | Y | Y |
| PZO1133 | Bestiary 5 | 66 | Y | Y | – | Y |
| PZO1137 | Bestiary 6 | 45 | – | – | – | – |
| PZO1112 | Bestiary [1] | 94 | Y | Y | Y | Y |
| PZO1139 | Book of the Damned | 27 | Y | – | Y | Y |
| PZO1110 | Core Rulebook | 1050 | Y | Y | Y | Y |
| PZO1114 | GameMastery Guide | 8 | Y | Y | Y | Y |
| PZO1135 | Horror Adventures | 125 | Y | – | Y | Y |
| PZO1130 | Monster Codex | 67 | Y | Y | Y | Y |
| PZO1126 | Mythic Adventures | 114 | Y | Y | Y | Y |
| PZO1132 | Occult Adventures | 299 | Y | Y | Y | Y |
| PZO1131 | Pathfinder Unchained | 164 | Y | Y | Y | Y |
| PZO1141 | Planar Adventures | 79 | Y | – | Y | Y |
| PZO1125 | Ultimate Campaign | 233 | Y | Y | Y | Y |
| PZO1118 | Ultimate Combat | 106 | Y | Y | Y | Y |
| PZO1123 | Ultimate Equipment | 2103 | Y | Y | Y | Y |
| PZO1134 | Ultimate Intrigue | 113 | Y | – | Y | Y |
| PZO1117 | Ultimate Magic | 76 | Y | Y | Y | Y |
| PZO1140 | Ultimate Wilderness | 208 | Y | – | Y | Y |
| PZO1136 | Villain Codex | 88 | Y | – | Y | Y |

### Campaign setting (63)

| Code | Title | Citations | pf1-content `OGL.txt` | Paizo PRD | AoN | d20pfsrd |
|---|---|---:|:-:|:-:|:-:|:-:|
| PZO92102 | Aquatic Adventures | 29 | – | – | Y | – |
| PZO9250 | Artifacts & Legends | 50 | Y | – | Y | Y |
| PZO9276 | Belkzen, Hold of the Orc Hordes | 9 | Y | – | Y | Y |
| PZO9257 | Castles of the Inner Sea | 3 | Y | – | Y | Y |
| PZO9287 | Cheliax, The Infernal Empire | 1 | Y | – | Y | Y |
| PZO9255 | Chronicle of the Righteous | 7 | Y | – | Y | Y |
| PZO9289 | Darklands Revisited | 8 | Y | – | Y | Y |
| PZO9261 | Demons Revisited | 1 | Y | – | Y | Y |
| PZO92109 | Distant Realms | 6 | Y | – | Y | Y |
| PZO9285 | Distant Shores | 17 | Y | – | Y | Y |
| PZO9243 | Distant Worlds | 1 | – | – | Y | – |
| PZO9240 | Dragon Empires Gazetteer | 36 | Y | – | Y | Y |
| PZO9234 | Dungeons of Golarion | 4 | Y | – | – | Y |
| PZO9245 | Giants Revisited | 2 | – | – | Y | – |
| PZO9291 | Heaven Unleashed | 2 | Y | – | – | Y |
| PZO9281 | Hell Unleashed | 3 | – | – | Y | – |
| PZO9297 | Horror Realms | 7 | – | – | – | – |
| PZO9239 | Horsemen of the Apocalypse | 1 | Y | – | Y | Y |
| PZO9251 | Inner Sea Bestiary | 32 | – | – | Y | – |
| PZO9268 | Inner Sea Combat | 90 | Y | – | Y | Y |
| PZO9267 | Inner Sea Gods | 257 | Y | – | Y | Y |
| PZO9292 | Inner Sea Intrigue | 44 | – | – | Y | – |
| PZO9237 | Inner Sea Magic | 6 | Y | – | – | Y |
| PZO9283 | Inner Sea Monster Codex | 6 | Y | – | Y | Y |
| PZO9280 | Inner Sea Races | 763 | Y | – | Y | Y |
| PZO9296 | Inner Sea Temples | 22 | – | – | Y | – |
| PZO9244 | Isles of the Shackles | 7 | Y | – | Y | Y |
| PZO9238 | Lands of the Linnorm Kings | 2 | Y | – | Y | Y |
| PZO9225 | Lords of Chaos | 4 | Y | – | Y | Y |
| PZO9229 | Lost Cities of Golarion | 2 | Y | – | Y | Y |
| PZO9246 | Lost Kingdoms | 7 | Y | – | Y | Y |
| PZO9275 | Lost Treasures | 44 | Y | – | Y | Y |
| PZO9248 | Magnimar, City of Monuments | 2 | – | – | Y | – |
| PZO9227 | Misfit Monsters Redeemed | 1 | Y | – | Y | Y |
| PZO9252 | Mystery Monsters Revisited | 7 | – | – | Y | – |
| PZO92108 | Nidal, Land of Shadows | 1 | – | – | Y | – |
| PZO9270 | Numeria, Land of Fallen Stars | 1 | Y | – | Y | Y |
| PZO9284 | Occult Bestiary | 14 | Y | – | Y | Y |
| PZO9269 | Occult Mysteries | 17 | Y | – | Y | Y |
| PZO9286 | Occult Realms | 9 | Y | – | Y | Y |
| PZO9293 | Path of the Hellknight | 32 | Y | – | Y | Y |
| PZO1111 | Pathfinder Chronicles: Campaign Setting | 17 | Y | – | – | Y |
| PZO9214 | Pathfinder Chronicles: Cities of Golarion | 1 | Y | – | Y | Y |
| PZO9223 | Pathfinder Chronicles: City of Strangers | 4 | Y | – | Y | Y |
| PZO9216 | Pathfinder Chronicles: Classic Horrors Revisited | 2 | Y | – | Y | Y |
| PZO1107 | Pathfinder Chronicles: Classic Monsters Revisited | 1 | Y | – | Y | Y |
| PZO9220 | Pathfinder Chronicles: Classic Treasures Revisited | 32 | Y | – | Y | Y |
| PZO9210 | Pathfinder Chronicles: Dungeon Denizens Revisited | 8 | Y | – | Y | Y |
| PZO9221 | Pathfinder Chronicles: Faction Guide | 46 | Y | – | Y | Y |
| PZO9202 | Pathfinder Chronicles: Gods and Magic | 4 | Y | – | Y | Y |
| PZO9217E | Pathfinder Chronicles: Guide to the River Kingdoms | 5 | Y | – | Y | Y |
| PZO9222 | Pathfinder Chronicles: Heart of the Jungle | 1 | Y | – | – | Y |
| PZO9211 | Pathfinder Chronicles: Seekers of Secrets | 104 | Y | – | Y | Y |
| PZO9235 | Pathfinder Society Field Guide | 26 | Y | – | – | Y |
| PZO9295 | Planes of Power | 10 | Y | – | Y | Y |
| PZO9299 | Qadira, Jewel of the East | 7 | – | – | Y | – |
| PZO9232 | Rival Guide | 26 | Y | – | – | Y |
| PZO9274 | Ships of the Inner Sea | 6 | Y | – | Y | Y |
| PZO9272 | Technology Guide | 259 | – | Y | Y | – |
| PZO9298 | The First World, Realm of the Fey | 2 | Y | – | Y | Y |
| PZO9226 | The Inner Sea World Guide | 25 | Y | – | – | Y |
| PZO9278 | Tombs of Golarion | 6 | – | – | Y | – |
| PZO9273 | Undead Unleashed | 7 | Y | – | Y | Y |

### Player Companion (93)

| Code | Title | Citations | pf1-content `OGL.txt` | Paizo PRD | AoN | d20pfsrd |
|---|---|---:|:-:|:-:|:-:|:-:|
| PZO9451 | Advanced Class Origins | 40 | – | – | Y | – |
| PZO9410 | Adventurer's Armory | 180 | Y | – | Y | Y |
| PZO9481 | Adventurer's Armory 2 | 141 | – | – | Y | – |
| PZO9464 | Agents of Evil | 49 | – | – | Y | – |
| PZO9445 | Alchemy Manual | 114 | – | – | Y | – |
| PZO9409 | Andoran, Spirit of Liberty | 17 | Y | – | Y | Y |
| PZO9429 | Animal Archive | 20 | – | – | Y | – |
| PZO9484 | Antihero's Handbook | 32 | Y | – | Y | Y |
| PZO9465 | Arcane Anthology | 7 | Y | – | Y | Y |
| PZO9467 | Armor Master's Handbook | 47 | Y | – | – | Y |
| PZO9442 | Bastards of Golarion | 52 | Y | – | Y | Y |
| PZO9462 | Black Markets | 43 | – | – | Y | – |
| PZO9424 | Blood of Angels | 39 | Y | – | Y | Y |
| PZO9423 | Blood of Fiends | 67 | Y | – | Y | Y |
| PZO9466 | Blood of Shadows | 117 | Y | – | Y | Y |
| PZO9490 | Blood of the Ancients | 19 | Y | – | Y | Y |
| PZO9473 | Blood of the Beast | 13 | – | – | Y | – |
| PZO9485 | Blood of the Coven | 42 | Y | – | Y | Y |
| PZO9447 | Blood of the Elements | 38 | Y | – | Y | Y |
| PZO9439 | Blood of the Moon | 91 | – | – | Y | – |
| PZO9427 | Blood of the Night | 47 | – | – | Y | – |
| PZO9482 | Blood of the Sea | 114 | – | – | Y | – |
| PZO9443 | Champions of Balance | 23 | Y | – | Y | Y |
| PZO9450 | Champions of Corruption | 46 | Y | – | Y | Y |
| PZO9431 | Champions of Purity | 26 | Y | – | Y | Y |
| PZO9407 | Cheliax, Empire of Devils | 25 | Y | – | Y | Y |
| PZO9496 | Chronicle of Legends | 16 | – | – | Y | – |
| PZO9457 | Cohorts and Companions | 15 | – | – | Y | – |
| PZO9437 | Demon Hunter's Handbook | 36 | Y | – | Y | Y |
| PZO9459 | Dirty Tactics Toolbox | 48 | Y | – | Y | Y |
| PZO9488 | Disciple's Doctrine | 20 | – | – | Y | – |
| PZO9472 | Divine Anthology | 45 | Y | – | Y | Y |
| PZO9421 | Dragon Empires Primer | 97 | Y | – | Y | Y |
| PZO9434 | Dragonslayer's Handbook | 37 | Y | – | Y | Y |
| PZO9430 | Dungeoneer's Handbook | 52 | Y | – | Y | Y |
| PZO9408 | Dwarves of Golarion | 24 | Y | – | Y | Y |
| PZO9483 | Elemental Master's Handbook | 56 | – | – | Y | – |
| PZO9402 | Elves of Golarion | 8 | Y | – | Y | Y |
| PZO9436 | Faiths & Philosophies | 46 | – | – | Y | – |
| PZO9418 | Faiths of Balance | 37 | Y | – | – | Y |
| PZO9420 | Faiths of Corruption | 24 | Y | – | Y | Y |
| PZO9416 | Faiths of Purity | 22 | – | – | – | – |
| PZO9454 | Familiar Folio | 12 | – | – | Y | – |
| PZO9453 | Giant Hunter's Handbook | 41 | Y | – | Y | Y |
| PZO9411 | Gnomes of Golarion | 19 | Y | – | Y | Y |
| PZO9419 | Goblins of Golarion | 32 | – | – | – | – |
| PZO9415 | Halflings of Golarion | 33 | Y | – | – | Y |
| PZO9471 | Haunted Heroes Handbook | 27 | Y | – | Y | Y |
| PZO9475 | Healer's Handbook | 54 | Y | – | Y | Y |
| PZO9491 | Heroes from the Fringe | 92 | Y | – | Y | Y |
| PZO9495 | Heroes of Golarion | 29 | Y | – | Y | Y |
| PZO9479 | Heroes of the Darklands | 42 | – | – | Y | – |
| PZO9476 | Heroes of the High Court | 34 | – | – | Y | – |
| PZO9460 | Heroes of the Streets | 48 | – | – | Y | – |
| PZO9456 | Heroes of the Wild | 57 | – | – | Y | – |
| PZO9417 | Humans of Golarion | 23 | Y | – | – | Y |
| PZO9414 | Inner Sea Primer | 78 | Y | – | Y | Y |
| PZO9426 | Knights of the Inner Sea | 36 | Y | – | Y | Y |
| PZO9432 | Kobolds of Golarion | 74 | – | – | Y | – |
| PZO9470 | Legacy of Dragons | 41 | Y | – | Y | Y |
| PZO9480 | Legacy of the First World | 32 | Y | – | Y | Y |
| PZO9468 | Magic Tactics Toolbox | 20 | Y | – | Y | Y |
| PZO9440 | Magical Marketplace | 64 | – | – | Y | – |
| PZO9493 | Martial Arts Handbook | 23 | – | – | Y | – |
| PZO9455 | Melee Tactics Toolbox | 77 | Y | – | Y | Y |
| PZO9489 | Merchant's Manifest | 30 | – | – | Y | – |
| PZO9478 | Monster Hunter's Handbook | 40 | – | – | Y | – |
| PZO9458 | Monster Summoner's Handbook | 22 | – | – | Y | – |
| PZO9438 | Mythic Origins | 6 | Y | – | Y | Y |
| PZO9461 | Occult Origins | 43 | Y | – | Y | Y |
| PZO9413 | Orcs of Golarion | 23 | Y | – | Y | Y |
| PZO9435 | Pathfinder Society Primer | 41 | Y | – | Y | Y |
| PZO9474 | Paths of the Righteous | 1 | – | – | Y | – |
| PZO9428 | People of the North | 33 | – | – | Y | – |
| PZO9448 | People of the River | 31 | Y | – | Y | Y |
| PZO9441 | People of the Sands | 38 | Y | – | Y | Y |
| PZO9449 | People of the Stars | 73 | – | – | Y | – |
| PZO9486 | People of the Wastes | 35 | Y | – | Y | Y |
| PZO9422 | Pirates of the Inner Sea | 46 | – | – | Y | – |
| PZO9492 | Plane-Hopper's Handbook | 45 | Y | – | Y | Y |
| PZO9487 | Potions & Poisons | 59 | Y | – | Y | Y |
| PZO9477 | Psychic Anthology | 50 | – | – | Y | – |
| PZO9406 | Qadira, Gateway to the East | 24 | Y | – | Y | Y |
| PZO9433 | Quests & Campaigns | 73 | Y | – | Y | Y |
| PZO9452 | Ranged Tactics Toolbox | 109 | Y | – | Y | Y |
| PZO9412 | Sargava, the Lost Colony | 25 | Y | – | Y | Y |
| PZO9469 | Spymaster's Handbook | 38 | Y | – | Y | Y |
| PZO9405 | Taldor, Echoes of Glory | 9 | Y | – | Y | Y |
| PZO9446 | The Harrow Handbook | 10 | Y | – | Y | Y |
| PZO9444 | Undead Slayer's Handbook | 34 | – | – | Y | – |
| PZO9425 | Varisia, Birthplace of Legends | 46 | – | – | Y | – |
| PZO9463 | Weapon Master's Handbook | 22 | Y | – | Y | Y |
| PZO9494 | Wilderness Origins | 42 | – | – | Y | – |

### Player's guides (25)

| Code | Title | Citations | pf1-content `OGL.txt` | Paizo PRD | AoN | d20pfsrd |
|---|---|---:|:-:|:-:|:-:|:-:|
| PZO9000-8E | Carrion Crown Player's Guide | 6 | – | – | – | Y |
| PZO9000-5E | Council of Thieves Player's Guide | 7 | Y | – | Y | Y |
| PZO9000-2S | Curse of the Crimson Throne Player's Guide | 3 | – | – | – | Y |
| PZO9000-16E | Giantslayer Player's Guide | 10 | – | – | Y | – |
| PZO9000-17E | Hell's Rebels Player's Guide | 10 | – | – | Y | – |
| PZO9000-18E | Hell's Vengeance Player's Guide | 10 | – | – | Y | – |
| PZO9000-15E | Iron Gods Player's Guide | 12 | – | – | Y | – |
| PZO9000-20E | Ironfang Invasion Player's Guide | 8 | – | – | Y | – |
| PZO9000-9E | Jade Regent Player's Guide | 8 | Y | – | Y | Y |
| PZO9000-6E | Kingmaker Player's Guide | 12 | – | – | – | – |
| PZO9404 | Legacy of Fire Player's Guide | 10 | Y | – | Y | Y |
| PZO9000-14E | Mummy's Mask Player's Guide | 10 | – | – | Y | – |
| PZO9000-12E | Reign of Winter Player's Guide | 7 | – | – | Y | – |
| PZO9000-23E | Return of the Runelords Player's Guide | 7 | – | – | Y | – |
| PZO1002-PGE | Rise of the Runelords Player's Guide | 11 | Y | – | Y | Y |
| PZO9000-S | Rise of the Runelords Player's Guide (code not in registry; title from AoN's False Jewelry page) | 1 | Y | – | Y | Y |
| PZO9000-21E | Ruins of Azlant Player's Guide | 12 | – | – | Y | – |
| PZO9401 | Second Darkness Player's Guide | 39 | Y | – | Y | Y |
| PZO9000-7E | Serpent's Skull Player's Guide | 10 | – | – | – | – |
| PZO9000-11E | Shattered Star Player's Guide | 17 | – | – | Y | – |
| PZO9000-10E | Skull and Shackles Player's Guide | 10 | Y | – | Y | Y |
| PZO9000-19E | Strange Aeons Player's Guide | 10 | – | – | Y | – |
| PZO9000-24E | Tyrant's Grasp Player's Guide | 8 | – | – | Y | – |
| PZO9000-22E | War for the Crown Player's Guide | 7 | – | – | Y | – |
| PZO9000-13E | Wrath of the Righteous Player's Guide | 6 | Y | – | Y | Y |

### Adventure Path volumes (114)

| Code | Title | Citations | pf1-content `OGL.txt` | Paizo PRD | AoN | d20pfsrd |
|---|---|---:|:-:|:-:|:-:|:-:|
| PZO9043 | Carrion Crown #1: The Haunting of Harrowstone | 10 | Y | – | Y | Y |
| PZO9045 | Carrion Crown #3: Broken Moon | 2 | Y | – | Y | Y |
| PZO9046 | Carrion Crown #4: Wake of the Watcher | 1 | Y | – | Y | Y |
| PZO9047 | Carrion Crown #5: Ashes at Dawn | 3 | Y | – | Y | Y |
| PZO9048 | Carrion Crown #6: Shadows of Gallowspire | 2 | Y | – | Y | Y |
| PZO9025 | Council of Thieves #1: The Bastards of Erebus | 6 | Y | – | Y | Y |
| PZO9026 | Council of Thieves #2: The Sixfold Trial | 1 | Y | – | Y | Y |
| PZO9027 | Council of Thieves #3: What Lies in Dust | 14 | Y | – | Y | Y |
| PZO9028 | Council of Thieves #4: The Infernal Syndrom | 1 | – | – | Y | – |
| PZO9029 | Council of Thieves #5: Mother of Flies | 6 | Y | – | Y | Y |
| PZO9030 | Council of Thieves #6: The Twice-Damned Prince | 2 | Y | – | Y | Y |
| PZO1021 | Curse of the Crimson Throne | 27 | – | – | Y | – |
| PZO9008 | Curse of the Crimson Throne #2: Seven Days to the Grave | 1 | – | – | Y | Y |
| PZO9010 | Curse of the Crimson Throne #4: A History of Ashes *(edge pack only)* | 1 | Y | – | Y | Y |
| PZO9091 | Giantslayer #1: Battle of Bloodmarch Hill | 13 | Y | – | Y | Y |
| PZO9092 | Giantslayer #2: The Hill Giant's Pledge | 6 | – | – | Y | – |
| PZO9093 | Giantslayer #3: Forge of the Giant God | 8 | – | – | Y | – |
| PZO9094 | Giantslayer #4: Ice Tomb of the Giant Queen | 4 | – | – | Y | – |
| PZO9095 | Giantslayer #5: Anvil of Fire | 5 | Y | – | Y | Y |
| PZO9096 | Giantslayer #6: Shadow of the Storm Tyrant | 4 | – | – | Y | – |
| PZO9099 | Hell's Rebels #3: Dance of the Damned | 2 | Y | – | Y | Y |
| PZO90100 | Hell's Rebels #4: A Song of Silver *(edge pack only)* | 2 | Y | – | Y | Y |
| PZO90101 | Hell's Rebels #5: The Kintargo Contract | 1 | – | – | Y | – |
| PZO90102 | Hell's Rebels #6: Breaking the Bones of Hell | 2 | – | – | Y | – |
| PZO90104 | Hell's Vengeance #2: Wrath of Thrune | 5 | – | – | Y | – |
| PZO90105 | Hell's Vengeance #3: The Inferno Gate | 3 | – | – | Y | – |
| PZO90106 | Hell's Vengeance #4: For Queen & Empire | 4 | – | – | Y | – |
| PZO90107 | Hell's Vengeance #5: Scourge of the Godclaw | 3 | – | – | Y | – |
| PZO90108 | Hell's Vengeance #6: Hell Comes to Westcrown | 7 | – | – | Y | – |
| PZO9085 | Iron Gods #1: Fires of Creation | 9 | – | – | Y | Y |
| PZO9086 | Iron Gods #2: Lords of Rust *(edge pack only)* | 7 | – | – | Y | Y |
| PZO9087 | Iron Gods #3: The Choking Tower | 4 | Y | – | Y | Y |
| PZO9088 | Iron Gods #4: Valley of the Brain Collectors | 10 | – | – | Y | – |
| PZO9089 | Iron Gods #5: Palace of Fallen Stars *(edge pack only)* | 11 | – | – | Y | – |
| PZO9090 | Iron Gods #6: The Divinity Drive | 11 | – | – | Y | – |
| PZO90115 | Ironfang Invasion #1: Trail of the Hunted | 14 | – | – | Y | – |
| PZO90116 | Ironfang Invasion #2: Fangs of War | 3 | – | – | Y | – |
| PZO90117 | Ironfang Invasion #3: Assault on Longshadow | 1 | – | – | Y | – |
| PZO90118 | Ironfang Invasion #4: Siege of Stone (registry lists it under PZO90119) | 3 | – | – | Y | – |
| PZO90119 | Ironfang Invasion #5: Prisoners of the Blight | 4 | – | – | Y | – |
| PZO90120 | Ironfang Invasion #6: Vault of the Onyx Citadel | 6 | – | – | Y | – |
| PZO9049 | Jade Regent #1: The Brinewall Legacy | 3 | Y | – | Y | Y |
| PZO9050 | Jade Regent #2: Night of Frozen Shadows | 6 | Y | – | Y | Y |
| PZO9051 | Jade Regent #3: The Hungry Storm | 13 | Y | – | Y | Y |
| PZO9052 | Jade Regent #4: Forest of Spirits | 4 | Y | – | Y | Y |
| PZO9053 | Jade Regent #5: Tide of Honor | 7 | Y | – | Y | Y |
| PZO9054 | Jade Regent #6: The Empty Throne | 5 | – | – | Y | – |
| PZO9031 | Kingmaker #1: Stolen Land | 1 | Y | – | Y | Y |
| PZO9033 | Kingmaker #3: The Varnhold Vanishing | 1 | Y | – | Y | Y |
| PZO9034 | Kingmaker #4: Blood for Blood | 9 | Y | – | Y | Y |
| PZO9036 | Kingmaker #6: Sound of a Thousand Screams | 1 | Y | – | Y | Y |
| PZO9079 | Mummy's Mask #1: The Half-Dead City | 6 | – | – | Y | – |
| PZO9080 | Mummy's Mask #2: Empty Graves | 4 | – | – | Y | – |
| PZO9081 | Mummy's Mask #3: Shifting Sands | 5 | Y | – | Y | Y |
| PZO9082 | Mummy's Mask #4: Secrets of the Sphinx | 7 | Y | – | Y | Y |
| PZO9083 | Mummy's Mask #5: The Slave Trenches of Hakotep | 14 | – | – | Y | – |
| PZO9084 | Mummy's Mask #6: Pyramid of the Sky Pharaoh | 15 | Y | – | Y | Y |
| PZO9067 | Reign of Winter #1: The Snows of Summer | 9 | – | – | Y | Y |
| PZO9068 | Reign of Winter #2: The Shackled Hut | 6 | – | – | Y | – |
| PZO9069 | Reign of Winter #3: Maiden, Mother, Crone | 6 | – | – | Y | – |
| PZO9070 | Reign of Winter #4: The Frozen Stars | 12 | – | – | Y | – |
| PZO9071 | Reign of Winter #5: Rasputin Must Die! | 19 | Y | – | Y | Y |
| PZO9072 | Reign of Winter #6: The Witch Queen's Revenge | 6 | Y | – | Y | Y |
| PZO90133 | Return of the Runelords #1: Secrets of Roderic's Cove | 2 | Y | – | Y | Y |
| PZO90134 | Return of the Runelords #2: It Came from Hollow Mountain | 2 | – | – | Y | – |
| PZO90135 | Return of the Runelords #3: Runeplague | 2 | – | – | Y | – |
| PZO90136 | Return of the Runelords #4: Temple of the Peacock Spirit | 1 | – | – | Y | – |
| PZO90137 | Return of the Runelords #5: The City Outside of Time | 13 | – | – | Y | – |
| PZO90138 | Return of the Runelords #6: Rise of New Thassilon | 6 | – | – | Y | – |
| PZO1002 | Rise of the Runelords Anniversary Edition | 25 | Y | – | Y | Y |
| PZO90121 | Ruins of Azlant #1: The Lost Outpost | 1 | – | – | Y | – |
| PZO90122 | Ruins of Azlant #2: Into the Shattered Continent | 17 | Y | – | Y | Y |
| PZO90123 | Ruins of Azlant #3: The Flooded Cathedral | 12 | Y | – | Y | Y |
| PZO90124 | Ruins of Azlant #4: City in the Deep | 8 | Y | – | Y | Y |
| PZO90125 | Ruins of Azlant #5: Tower of the Drowned Dead | 7 | Y | – | Y | Y |
| PZO90126 | Ruins of Azlant #6: Beyond the Veiled Past | 8 | – | – | Y | – |
| PZO9014 | Second Darkness #2: Children of the Void | 1 | Y | – | Y | Y |
| PZO9015 | Second Darkness #3: The Armageddon Echo | 3 | Y | – | Y | Y |
| PZO9038 | Serpent's Skull #2: Racing to Ruin | 3 | Y | – | Y | Y |
| PZO9039 | Serpent's Skull #3: City of Seven Spears | 24 | Y | – | Y | Y |
| PZO9040 | Serpent's Skull #4: Vaults of Madness | 1 | Y | – | Y | Y |
| PZO9041 | Serpent's Skull #5: The Thousand Fangs Below | 2 | Y | – | Y | Y |
| PZO9042 | Serpent's Skull #6: Sanctum of the Serpent God | 3 | Y | – | Y | Y |
| PZO9061 | Shattered Star #1: Shards of Sin | 15 | Y | – | Y | Y |
| PZO9062 | Shattered Star #2: Curse of the Lady's Light | 5 | Y | – | Y | Y |
| PZO9063 | Shattered Star #3: The Asylum Stone | 7 | Y | – | – | Y |
| PZO9064 | Shattered Star #4: Beyond the Doomsday Door | 6 | – | – | – | – |
| PZO9065 | Shattered Star #5: Into the Nightmare Rift | 5 | – | – | Y | – |
| PZO9066 | Shattered Star #6: The Dead Heart of Xin | 3 | – | – | Y | – |
| PZO9055 | Skull & Shackles #1: The Wormwood Mutiny | 5 | Y | – | Y | Y |
| PZO9056 | Skull & Shackles #2: Raiders of the Fever Sea | 6 | Y | – | Y | Y |
| PZO9057 | Skull & Shackles #3: Tempest Rising | 6 | Y | – | Y | Y |
| PZO9058 | Skull & Shackles #4: Island of Empty Eyes | 5 | Y | – | Y | Y |
| PZO9059 | Skull & Shackles #5: The Price of Infamy | 6 | – | – | Y | – |
| PZO9060 | Skull & Shackles #6: From Hell's Heart | 5 | Y | – | Y | Y |
| PZO90110 | Strange Aeons #2: The Thrushmoor Terror | 3 | – | – | Y | – |
| PZO90111 | Strange Aeons #3: Dreams of the Yellow King | 11 | – | – | Y | – |
| PZO90112 | Strange Aeons #4: The Whisper Out of Time | 4 | – | – | Y | – |
| PZO90113 | Strange Aeons #5: What Grows Within | 4 | – | – | Y | – |
| PZO90114 | Strange Aeons #6: Black Stars Beckon | 2 | – | – | Y | – |
| PZO90139 | Tyrant's Grasp #1: The Dead Roads | 27 | – | – | Y | – |
| PZO90140 | Tyrant's Grasp #2: Eulogy for Roslar's Coffer | 1 | Y | – | Y | Y |
| PZO90141 | Tyrant's Grasp #3: Last Watch | 2 | – | – | Y | – |
| PZO90143 | Tyrant's Grasp #5: Borne by the Sun's Grace | 3 | – | – | Y | – |
| PZO90127 | War for the Crown #1: Crownfall | 2 | – | – | Y | – |
| PZO90129 | War for the Crown #3: The Twilight Child | 1 | – | – | Y | – |
| PZO90131 | War for the Crown #5: The Reaper's Right Hand | 3 | Y | – | Y | Y |
| PZO90132 | War for the Crown #6: The Six-Legend Soul | 2 | – | – | Y | – |
| PZO9073 | Wrath of the Righteous #1: The Worldwound Incursion | 6 | Y | – | Y | Y |
| PZO9074 | Wrath of the Righteous #2: Sword of Valor | 23 | – | – | Y | – |
| PZO9075 | Wrath of the Righteous #3: Demon's Heresy | 6 | Y | – | Y | Y |
| PZO9076 | Wrath of the Righteous #4: The Midnight Isles | 7 | – | – | Y | – |
| PZO9077 | Wrath of the Righteous #5: Herald of the Ivory Labyrinth | 6 | Y | – | Y | Y |
| PZO9078 | Wrath of the Righteous #6: City of Locusts | 6 | Y | – | Y | Y |

### Modules (26)

| Code | Title | Citations | pf1-content `OGL.txt` | Paizo PRD | AoN | d20pfsrd |
|---|---|---:|:-:|:-:|:-:|:-:|
| PZO9502 | Conquest of Bloodsworn Vale | 1 | Y | – | – | Y |
| PZO9529 | Cult of the Ebon Destroyers | 1 | Y | – | – | Y |
| PZO9526 | Curse of the Riven Sky | 3 | Y | – | Y | Y |
| PZO9547 | Daughters of Fury | 33 | – | – | Y | – |
| PZO9541 | Doom Comes to Dustpawn | 2 | – | – | Y | – |
| PZO9550 | Down the Blighted Path | 12 | – | – | Y | – |
| PZO9540 | Fangwood Keep | 1 | – | – | Y | – |
| PZO9548 | Feast of Dust | 6 | – | – | Y | – |
| PZO9525 | From Shore to Sea | 2 | Y | – | Y | Y |
| PZO9552 | Gallows of Madness | 1 | – | – | Y | – |
| PZO9551 | Ire of the Storm | 2 | – | – | Y | – |
| PZO9538 | Murder's Mark | 2 | Y | – | Y | Y |
| PZO9536 | No Response from Deepmar | 1 | – | – | Y | – |
| PZO9546 | Plunder & Peril | 3 | Y | – | Y | Y |
| PZO9523 | Realm of the Fellnight Queen | 1 | – | – | Y | – |
| PZO9553 | Seers of the Drowned City | 12 | – | – | Y | – |
| PZO9544 | Tears at Bitter Manor | 9 | – | – | Y | – |
| PZO9545 | The Emerald Spire Superdungeon | 4 | Y | – | Y | Y |
| PZO9549 | The House on Hook Street | 4 | – | – | Y | – |
| PZO9535 | The Midnight Mirror | 1 | – | – | Y | – |
| PZO9537 | The Moonscar | 2 | Y | – | Y | Y |
| PZO9530 | Tomb of the Iron Medusa | 1 | Y | – | – | Y |
| PZO9543 | Wardens of the Reborn Forge | 7 | – | – | Y | – |
| PZO9500-12 | We Be 5uper Goblins! | 1 | – | – | – | – |
| PZO9500-7 | We Be Goblins Too! | 1 | – | – | Y | – |
| PZO9500-5 | We Be Goblins! | 4 | – | – | – | – |

### Pathfinder Society (1)

| Code | Title | Citations | pf1-content `OGL.txt` | Paizo PRD | AoN | d20pfsrd |
|---|---|---:|:-:|:-:|:-:|:-:|
| PZOPSS0000E | Pathfinder Society Roleplaying Guild Guide | 66 | – | – | – | – |

### Comics (2)

| Code | Title | Citations | pf1-content `OGL.txt` | Paizo PRD | AoN | d20pfsrd |
|---|---|---:|:-:|:-:|:-:|:-:|
| DYN0046-HC | Spiral of Bones | 1 | – | – | – | – |
| DYN0032-E | Worldscape #2 | 8 | – | – | – | – |

### Not in the registry (2)

| Code | Title | Citations | pf1-content `OGL.txt` | Paizo PRD | AoN | d20pfsrd |
|---|---|---:|:-:|:-:|:-:|:-:|
| PZOGWK0001 | unknown (not in registry) | 1 | – | – | – | – |
| PZOPSS0412 | unknown (not in registry; pattern suggests PFS Scenario #4–12) | 1 | – | – | – | – |

## Sources

- Foundry pf1 system v11.11 (`418761d2e16a6037c0156bb4a241f7cea5a2986d`): <https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/tree/v11.11>
  - [`module/registry/sources.mjs`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/v11.11/module/registry/sources.mjs), [`OGL.txt`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/v11.11/OGL.txt), [`README.md`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/v11.11/README.md), [`public/system.json`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/v11.11/public/system.json)
  - packs [`races`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/tree/v11.11/packs/races), [`classes`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/tree/v11.11/packs/classes), [`class-abilities`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/tree/v11.11/packs/class-abilities), [`feats`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/tree/v11.11/packs/feats), [`items`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/tree/v11.11/packs/items), [`armors-and-shields`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/tree/v11.11/packs/armors-and-shields), [`weapons-and-ammo`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/tree/v11.11/packs/weapons-and-ammo), [`buffs`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/tree/v11.11/packs/buffs), [`technology`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/tree/v11.11/packs/technology), [`spells`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/tree/v11.11/packs/spells) (comparison only)
- pf1-content 11.4.0 (`02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`): <https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/tree/11.4.0>
  - [`OGL.txt`](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/11.4.0/OGL.txt) and its [history](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/commits/11.4.0/OGL.txt) (content last changed in `39614c37`, 2021-01-26), [`README.md`](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/11.4.0/README.md), [`CREDITS.md`](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/11.4.0/CREDITS.md), [`LICENSE.md`](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/11.4.0/LICENSE.md)
  - packs under [`src/`](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/tree/11.4.0/src): `pf-class-abilities`, `pf-feats`, `pf-traits`, `pf-racial-traits`, `pf-items`, `pf-magic-items`, `pf-wondrous`, `pf-artifacts`, `pf-buffs`, `pf-cursed-items`, `pf-intelligent-items`, `pf-scaling-items`, `pf-special-qualities`
  - `V12` branch, [`src/pf-feats/Abeyance_0DDCq2L7ZsDwc2a3.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/V12/src/pf-feats/Abeyance_0DDCq2L7ZsDwc2a3.yaml)
- Paizo (first-party):
  - Pathfinder RPG Reference Document, Open Game License: <https://paizo.com/pathfinderRPG/prd/openGameLicense.html>, redirecting to <https://legacy.aonprd.com/openGameLicense.html>
  - Community Use Policy: <https://paizo.com/licenses/communityuse>
  - Store page, *Bestiary 6* (SKU `PZO1137E`): <https://store.paizo.com/pathfinder-roleplaying-game-bestiary-6-pfrpg-pdf/>
- Secondary compilations:
  - Archives of Nethys, Licenses: <https://aonprd.com/Licenses.aspx>
  - Archives of Nethys, *False Jewelry* (identifies `PZO9000-S`): <https://aonprd.com/EquipmentMiscDisplay.aspx?ItemName=False%20jewelry>
  - d20pfsrd, Legal Information/Open Game License: <https://www.d20pfsrd.com/extras/legal/>, Section 15 sheet <https://docs.google.com/spreadsheets/d/1OhL3YCCMQqRJQ2MposZwk4UTcC465soWqwxQE9XuHv8>
- This repo:
  - `docs/pf-character-sheet-data-model.md` on `feature/pf1-character-builder`, "Global catalog import";
  - issues [#207](https://github.com/AndreasUnunger/EverythingPath/issues/207) and [#217](https://github.com/AndreasUnunger/EverythingPath/issues/217);
  - `research/pf1-spell-data` (`docs/research/pf1-spell-data.md`).
