# Campaign initialization preparation (#65)

`convex/lib/campaignInitialization.ts` exposes unregistered preflight and
initializer functions for isolated transaction tests and the later paused-cutover
runner. There is no application endpoint, live migration, or activation switch.

1. Read `preflightCampaignInitialization` as the campaign GM. It returns the
   authoritative source, recoverable week-start values, preparation records,
   missing/preservation issues, and an exact reviewed-source token.
2. Complete the existing isolated roster and campaign-context preparation seams
   from #63/#64. Preserve legacy character IDs, `legacy-team:<document ID>` team
   IDs, settlement keys, and event/order/cache document IDs. Known legacy facts
   are checked against preparation. Unknown Hit Dice, event targets/order,
   day-based delivery and receipt facts require explicit preparation; character
   level and discarded choices are never used to fill them.
3. Repeat preflight until ready. Queues retain stable source keys
   `legacy-queue:<week document ID>:<index>`. Check modifiers and action blocks
   must preserve their arithmetic. Unsupported automatic variants block preflight until the canonical effect
   model can represent them faithfully; serializing them as narrative is not
   accepted. Original carry amounts and all original documents remain intact.
4. Pass the exact token and a freshly allocated, stable `initializationId` to
   `initializeCampaign` inside a single isolated mutation transaction. It opens
   an empty revision-zero draft at the existing week with fixed context and
   writes a receipt atomically. The initializer never saves prepared facts,
   changes balances, consumes queues, advances weeks, or invokes rules.
5. Retry with the same ID and token after a lost response. The receipt returns
   the original draft ID, including after subsequent edits, without resetting
   anything. Different source/identity attempts fail. Existing canonical drafts
   or history without a matching receipt are rejected rather than adopted.

The original militia, characters, assets, conditions, events, week/phase context,
unfinished choices and history remain untouched for recovery rehearsal. Only
canonical history is initially empty; legacy history is not copied into it.
All legacy asset metadata, including marketplaces and tracked-person status,
remains authoritative in its original tables and is included in source review.

Preparation is bounded to 256 documents per source collection and a 750 KB
receipt. Oversized campaigns fail closed and require a paginated cutover plan.
Missing/closed current-week records and cancelled orders also fail preflight
rather than guessing an open week or a receipt. Deployment pause, old-tab
rejection, backup/recovery and application cutover belong to later tickets.

Evidence: `convex/campaignInitialization.integration.test.ts` exercises real
isolated Convex transactions through the preparation/initialization/storage
interfaces. The rules catalog links the preservation and no-execution outcomes.
