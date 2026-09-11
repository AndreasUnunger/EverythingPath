import { projectRulesFoundations } from './rules-foundations';
import { activityCheckEffects } from './rules-activity';
import type { EventOutcomeProjection } from './rules-event-outcomes';
import type { WeeklyDraft } from './weekly-draft-contract';
import type { EventDispatch } from './rules-event-selection';
type Event = EventDispatch['event'];
type Raw = Event['tableRoll'];

export function eventDie(
  result: Pick<EventOutcomeProjection, 'requirements' | 'warnings'>,
  raw: Raw,
  id: string,
  sides: number,
) {
  if (raw?.sides !== sides || raw.dice.length !== 1) {
    result.requirements.push(`${id}:1d${sides}`);
    return null;
  }
  const value = raw.dice[0]!;
  if (value < 1 || value > sides) result.warnings.push(`${id}:roll-range`);
  return value;
}
export function eventCheck(
  draft: WeeklyDraft,
  result: EventOutcomeProjection,
  event: Event,
  check: 'loyalty' | 'secrecy' | 'security',
  raw: Raw,
  id: string,
  phase: 'event' | 'persistent' = 'event',
) {
  draft = {
    ...draft,
    context: {
      ...draft.context,
      carriedEvents: result.persistentEvents,
      queuedEffects: result.queuedEffects,
    },
  };
  const die = eventDie(result, raw, id, 20);
  const facts = projectRulesFoundations({
    ...result.outcome,
    week: draft.week,
    slots: draft.activity.slots,
    checks: [
      {
        checkId: id,
        phase,
        check,
        die: die ?? undefined,
        overseerCharacterId: event.overseerCharacterId,
        bonusIds: raw?.modifiers.flatMap((modifier) =>
          modifier.sourceId.startsWith('bonus:')
            ? [modifier.sourceId.slice(6)]
            : [],
        ),
      },
    ],
    operatingSettlementId: draft.activity.operatingSettlementId ?? null,
    queuedEffects: activityCheckEffects(draft),
    checkUsage: result.checkUsage,
    activity: result.teamUse,
  });
  result.requirements.push(
    ...facts.requirements.filter(
      (key) =>
        key.startsWith(id) ||
        key.startsWith('officer:') ||
        key === 'rank' ||
        key === 'focus',
    ),
  );
  result.warnings.push(...facts.warnings);
  const projected = facts.checks[0]!;
  const known = new Set([
    ...projected.modifiers.map((modifier) => modifier.source),
    ...result.outcome.characters.map((character) => character.characterId),
    ...draft.context.carriedEvents.map((event) => event.eventId),
    ...draft.context.queuedEffects.flatMap((effect) => [
      effect.effectId,
      effect.sourceId,
    ]),
    'rank-focus',
    'officers',
    'overseer-support',
    'helpful',
    'strategist',
  ]);
  for (const modifier of raw?.modifiers ?? []) {
    if (
      known.has(modifier.sourceId) ||
      /^(bonus|queued|officer|manager):/.test(modifier.sourceId)
    )
      continue;
    known.add(modifier.sourceId);
    projected.modifiers.push({
      source: modifier.sourceId,
      value: modifier.value,
    });
    projected.modifier += modifier.value;
    if (projected.total !== null) projected.total += modifier.value;
  }
  result.checks.push(projected);
  result.checkUsage = facts.checkUsage;
  for (const bonusId of result.checkUsage.bonusIds) {
    const bonus = result.outcome.bonuses.find(
      (bonus) => bonus.bonusId === bonusId,
    );
    if (bonus) bonus.consumedWeek = draft.week;
  }
  return die === null || facts.requirements.some((key) => key.startsWith(id))
    ? null
    : projected.total;
}
