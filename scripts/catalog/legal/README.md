# Catalog legal resources

These committed inputs implement the product's attribution and notice policy from PRD #251 decision 17 and decisions #224, #227 and #241. They do not establish legal sufficiency or admit any catalog definition.

The application-facing legal data and schemas live in `src/lib/catalog/`. Its `reviewed-data.ts` validates the Section 15 Registry, Attribution Assessments, evidence and legal resources at the loading boundary. `data/resources.json` supplies the legal-page text and the committed permanent notice superset. The pure `buildLegalPageData` function in `src/lib/catalog/legal-page-data.ts` accepts release requirements and the persisted notice superset explicitly, includes reviewed registry notices required by admitted or retained content, preserves every supplied historic notice version, and reports missing or unreviewed requirements separately. The script-only known hold catalog remains in this directory.

## Evidence present

- Both pinned upstream Section 15 blocks are reproduced verbatim from Foundry PF1 `v11.11` and pf1-content `11.4.0`. Their provenance records the source URLs and SHA-256 of the complete original OGL files. The OGL text preceding those notices is copied from the pinned system file.
- The Paizo Community Use text comes from the pinned pf1-content `Legal.txt` template. Only the website identity/placeholders are adapted. Section 8 identifies the content designated as Open Game Content under the already decided distribution policy.
- `src/lib/catalog/data/section15-registry.json` preserves the owner's three complete transcriptions from [decision #227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948776405), including all nineteen inherited lines in Bestiary 6. These are **unreviewed owner transcriptions**, not printed verification. Their `checkedOn` date records this seed comparison on 2026-10-02; it does not claim a book review happened then.
- The pinned compilation's Occult Mysteries book line is another unreviewed seed. It is not the erroneous AoN Numeria notice and does not establish the full inherited chain.

No available evidence supplies a complete content-bound accepted assessment. The assessments and evidence files therefore start empty. Inventory-accounted, structurally valid candidates without assessments are individually held with the reason `missing Attribution Assessment` and missing evidence or notices; no review is fabricated. Unresolved or explicit holds remain held after content changes. Unaccounted inventory records, broken references, stale assessments used for admission and missing admitted notices still fail the gate. Review tickets #264–#289 must supply actual content comparisons, reviewers, dates, books and notice evidence before acceptance. An unsourced definition stays unsourced after an assessment is added.

## Outstanding reviews

`known-notice-holds.json` is the single hold catalog read by the importer/gate for the five named groups: Dynamite comics, Thornkeep, PFS Scenario #4-12, Horror Realms and Shattered Star #4. Dynamite source codes `DYN0032-E`, `DYN0046-HC` and `DYN0010-A` trigger a hold even without a publisher field. Stable upstream keys identify the Thark Rifle and both Radium weapons without adding sources their records lack. The preview report names matching definitions individually; missing assessments also hold other unsourced content. The [observed pinned preview](../../../docs/catalog-import/admission-preview.json) reports 32 known notice holds across the five groups.

`src/lib/catalog/data/notice-reviews.json` preserves the Ultimate Combat and Occult Mysteries correction requirements and the free-PDF/owner verification work. The research branch and issue text describe the Ultimate Combat error but do not supply the complete corrected notice. Decision #227 says the free-PDF notices were transcribed but the available documents do not contain their verbatim blocks. Those gaps remain pending; no replacement text is fabricated. Upstream notice reproduction retains known upstream errors and does not promote them to reviewed book notices.

The owner-authorized project copyright notice is exactly `Keepnet © 2026 Andreas Ununger`. It appears in Section 15. Public legal text identifies the product as Keepnet.

## Notice retention

The initial permanent notice superset contains both pinned upstream notice blocks. Never remove or replace historic entries in `permanentNoticeSuperset`. [Catalog Release #310](https://github.com/AndreasUnunger/EverythingPath/issues/310) must persist the gate's `requiredNotices` and the builder's returned `permanentNoticeSuperset` as immutable release inputs and feed them to the public legal page. The route passes the current committed defaults explicitly until release persistence lands. #257 adds no persistence. The builder retains different notice text under the same notice identity, so corrections and rollback cannot erase an earlier version. A previously shipped notice does not make missing or revoked current review evidence valid.

The builder's `requiredNotices` must come from admitted and retained content requirements. Do not pass held-only books as release-blocking requirements. The public page includes available reviewed notices and reports outstanding requirements; it never manufactures text for a missing book. The registry may contain unreviewed seeds, but those cannot satisfy admission or appear as newly supplied notices. A required unreviewed seed shows `Notice review pending`; its unverified text is withheld from newly supplied notices.
