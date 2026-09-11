import {
  actionChoiceEvents,
  type StagedActionChoice,
  type eventTargetSchema,
} from './weekly-draft-facts';
import type { z } from 'zod';
import type { WeeklyDraft } from './weekly-draft-contract';
import type { UpkeepSnapshot } from './rules-upkeep';

type Target = z.infer<typeof eventTargetSchema>;
type ReferenceKind = Target['kind'] | 'bonus';
type ReferenceCheck = (
  kind: ReferenceKind,
  value: string | undefined,
  path: string,
) => void;

function actionReferences(choice: StagedActionChoice, check: ReferenceCheck) {
  const id = choice.choiceId;
  check('team', choice.teamId, `${id}:team`);
  if ('targetTeamId' in choice)
    check('team', choice.targetTeamId, `${id}:target-team`);
  if ('characterId' in choice)
    check('character', choice.characterId, `${id}:character`);
  if ('chooserCharacterId' in choice)
    check('character', choice.chooserCharacterId, `${id}:chooser`);
  if ('settlementId' in choice)
    check('settlement', choice.settlementId, `${id}:settlement`);
  for (const bonusId of choice.consumableIds ?? [])
    check('bonus', bonusId, `${id}:consumable:${bonusId}`);
}
function targetIdentity(target: Target) {
  switch (target.kind) {
    case 'team':
      return target.teamId;
    case 'character':
      return target.characterId;
    case 'settlement':
      return target.settlementId;
    case 'item':
      return target.itemId;
    case 'cache':
      return target.cacheId;
    case 'event':
      return target.eventId;
  }
}
function eventReferences(
  events: { eventId: string; targets?: readonly Target[] }[],
  check: ReferenceCheck,
) {
  for (const event of events)
    for (const target of event.targets ?? [])
      check(
        target.kind,
        targetIdentity(target),
        `event:${event.eventId}:${target.kind}`,
      );
}
function contextReferences(draft: WeeklyDraft, check: ReferenceCheck) {
  for (const settlementId of draft.context.operatedSettlementIds ?? [])
    check(
      'settlement',
      settlementId,
      `context:operated-settlement:${settlementId}`,
    );
  for (const order of draft.context.orders) {
    check('item', order.itemId, `order:${order.orderId}:item`);
    check(
      'settlement',
      order.settlementId,
      `order:${order.orderId}:settlement`,
    );
  }
  for (const effect of draft.context.queuedEffects)
    if ('teamId' in effect.effect)
      check('team', effect.effect.teamId, `queue:${effect.effectId}:team`);
}
function preparationReferences(draft: WeeklyDraft, check: ReferenceCheck) {
  check(
    'settlement',
    draft.activity.operatingSettlementId,
    'activity:operating-settlement',
  );
  check(
    'settlement',
    draft.upkeep.nearestSettlementId,
    'upkeep:nearest-settlement',
  );
  for (const bonusId of draft.activity.consumableIds)
    check('bonus', bonusId, `activity:consumable:${bonusId}`);
  for (const transfer of draft.upkeep.treasuryTransfers)
    check(
      'character',
      transfer.characterId,
      `transfer:${transfer.transferId}:character`,
    );
  for (const decision of draft.upkeep.teamDecisions)
    check('team', decision.teamId, `team:${decision.teamId}`);
}

export function draftReferenceRequirements(
  draft: WeeklyDraft,
  before: UpkeepSnapshot,
  after: UpkeepSnapshot,
) {
  const requirements: string[] = [];
  const choices = draft.activity.slots.flatMap((slot) =>
    slot.choice ? [slot.choice] : [],
  );
  const events = [
    ...draft.context.carriedEvents,
    ...draft.event.occurrences,
    ...choices.flatMap(actionChoiceEvents),
  ];
  const references: Record<ReferenceKind, Set<string>> = {
    team: new Set(
      [...before.roster.teams, ...after.roster.teams].map((x) => x.teamId),
    ),
    character: new Set(before.characters.map((x) => x.characterId)),
    settlement: new Set(before.settlements.map((x) => x.settlementId)),
    item: new Set(
      [...(before.economy?.items ?? []), ...(after.economy?.items ?? [])].map(
        (x) => x.itemId,
      ),
    ),
    cache: new Set(
      [...(before.economy?.caches ?? []), ...(after.economy?.caches ?? [])].map(
        (x) => x.cacheId,
      ),
    ),
    event: new Set(events.map((x) => x.eventId)),
    bonus: new Set(before.bonuses.map((x) => x.bonusId)),
  };
  const check: ReferenceCheck = (kind, value, path) => {
    if (value !== undefined && !references[kind].has(value))
      requirements.push(`${path}:reference`);
  };
  contextReferences(draft, check);
  preparationReferences(draft, check);
  for (const choice of choices) actionReferences(choice, check);
  eventReferences(events, check);
  return requirements;
}
