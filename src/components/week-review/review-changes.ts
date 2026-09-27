import type { CanonicalResolutionEffects } from '~/lib/canonical-weekly-resolution';
import type { ReviewPhase } from './review-facts';
import {
  count,
  describeValue,
  gp,
  signed,
  signedGp,
  words,
  type ReviewNames,
} from './review-text';

// Pure descriptions of ordered phase-plan entries. Shared by the live Summary
// and frozen Resolution Records: both hold the same plan shapes, so both read
// the same subjects, effects and check details in actual execution order.

export type PlanChange =
  | CanonicalResolutionEffects['upkeep'][number]
  | CanonicalResolutionEffects['activity'][number]
  | CanonicalResolutionEffects['event'][number]
  | CanonicalResolutionEffects['persistent'][number];
export type PlanAcknowledgement = {
  acknowledgementId: string;
  subjectId: string;
  outcome: string;
};
export type DescribedChange = {
  /** Stable grouping key of the consequence this change belongs to. */
  subject: string;
  /** Default title for that consequence when no richer skeleton names it. */
  title: string;
  /** Chip text; null when the change is purely explanatory. */
  effect: string | null;
  /** Check detail or other explanation line. */
  detail: string | null;
  acknowledgement: PlanAcknowledgement | null;
};

const statusLabels: Record<string, string> = {
  active: 'Active',
  disabled: 'Disabled',
  missing: 'Missing',
};
export function statusLabel(status: string) {
  return statusLabels[status] ?? words(status);
}
const stepTitles: Record<string, string> = {
  attrition: 'Training attrition',
  notoriety: 'Notoriety',
  shortage: 'Treasury shortage',
};
// A numeric change of zero is not a consequence; its line stays explanatory.
function delta(label: string, value: number, money = false) {
  return value === 0
    ? null
    : `${label} ${money ? signedGp(value) : signed(value)}`;
}
function outcome(succeeded: boolean | null) {
  return succeeded === null
    ? 'awaiting roll'
    : succeeded
      ? 'succeeded'
      : 'failed';
}
function check(label: string, total: number, dc: number, succeeded: boolean) {
  return `${label} ${total} vs DC ${dc} · ${outcome(succeeded)}`;
}
function acknowledgementOf(change: object): PlanAcknowledgement | null {
  const value = (change as { acknowledgement?: unknown }).acknowledgement;
  if (!value || typeof value !== 'object') return null;
  const ack = value as Partial<PlanAcknowledgement>;
  return typeof ack.acknowledgementId === 'string' &&
    typeof ack.subjectId === 'string' &&
    typeof ack.outcome === 'string'
    ? (ack as PlanAcknowledgement)
    : null;
}

export function choiceSubject(choiceId: string) {
  return `choice:${choiceId}`;
}
export function eventSubject(eventId: string) {
  return `event:${eventId}`;
}
export function teamSubject(teamId: string) {
  return `team:${teamId}`;
}
export function transferSubject(transferId: string) {
  return `transfer:${transferId}`;
}

function describeUpkeep(
  change: CanonicalResolutionEffects['upkeep'][number],
  names: ReviewNames,
): Omit<DescribedChange, 'acknowledgement'> {
  switch (change.kind) {
    case 'training':
      return {
        subject: `upkeep:${change.step}`,
        title: stepTitles[change.step] ?? words(change.step),
        effect: delta('Training', change.after - change.before),
        detail: null,
      };
    case 'settlement_reputation':
      return {
        subject: 'upkeep:notoriety',
        title: stepTitles.notoriety!,
        effect: `${names.settlement(change.settlementId)} ${words(change.before)} → ${words(change.after)}`,
        detail: null,
      };
    case 'treasury': {
      const effect = delta('Treasury', change.after - change.before, true);
      if (change.sourceId.startsWith('recovery:')) {
        const teamId = change.sourceId.slice('recovery:'.length);
        return {
          subject: teamSubject(teamId),
          title: names.team(teamId),
          effect,
          detail: null,
        };
      }
      if (change.sourceId.startsWith('theft:')) {
        const [, eventId = '', transferId = ''] = change.sourceId.split(':');
        return {
          subject: transferSubject(transferId),
          title: 'Treasury transfer',
          effect: `${names.event(eventId)} ${signedGp(change.after - change.before)}`,
          detail: null,
        };
      }
      return {
        subject: transferSubject(change.sourceId),
        title:
          change.after >= change.before
            ? 'Treasury deposit'
            : 'Treasury withdrawal',
        effect,
        detail: change.characterId
          ? `By ${names.character(change.characterId)}`
          : null,
      };
    }
    case 'team_status':
      return {
        subject: teamSubject(change.teamId),
        title: names.team(change.teamId),
        effect: `${change.timing === 'start' ? 'Recovered' : 'Returns'} · ${statusLabel(change.status)}`,
        detail: null,
      };
    case 'remove_team':
      return {
        subject: teamSubject(change.teamId),
        title: names.team(change.teamId),
        effect: 'Lost',
        detail: null,
      };
    case 'rank':
      return {
        subject: 'upkeep:rank',
        title: 'Rank',
        effect: `Rank ${change.before} → ${change.after}`,
        detail: null,
      };
    case 'boon':
      return {
        subject: change.subjectId,
        title: `Rank ${change.reward.rank} boon · ${names.character(change.characterId)}`,
        effect: null,
        detail: null,
      };
    case 'consume_bonus':
      return {
        subject: 'upkeep:bonuses',
        title: 'Check bonuses used',
        effect: 'Bonus used',
        detail: null,
      };
    default:
      return generic(change, 'upkeep', names);
  }
}

function describeActivity(
  change: CanonicalResolutionEffects['activity'][number],
  names: ReviewNames,
): Omit<DescribedChange, 'acknowledgement'> {
  const subject =
    'choiceId' in change && typeof change.choiceId === 'string'
      ? choiceSubject(change.choiceId)
      : null;
  const within = (effect: string | null, detail: string | null = null) => ({
    subject: subject ?? `activity:${change.kind}`,
    title: 'Action',
    effect,
    detail,
  });
  switch (change.kind) {
    case 'training':
      return within(delta('Training', change.after - change.before));
    case 'notoriety':
      return within(delta('Notoriety', change.after - change.before));
    case 'treasuryCopper':
      return within(delta('Treasury', change.after - change.before, true));
    case 'recruit_team':
      return within(`Recruits ${change.team.name}`);
    case 'upgrade_team':
      return within(
        `${names.team(change.teamId)} ${words(change.before)} → ${words(change.after)}`,
      );
    case 'remove_team':
      return within(`${names.team(change.teamId)} leaves`);
    case 'end_persistent_event':
      return within(`Ends ${names.event(change.eventId)}`);
    case 'officers': {
      const key = (entry: { role: string; characterId: string }) =>
        `${entry.role}:${entry.characterId}`;
      const before = new Set(change.before.map(key));
      const after = new Set(change.after.map(key));
      const lines = [
        ...change.after
          .filter((entry) => !before.has(key(entry)))
          .map(
            (entry) =>
              `${names.character(entry.characterId)} becomes ${words(entry.role)}`,
          ),
        ...change.before
          .filter((entry) => !after.has(key(entry)))
          .map(
            (entry) =>
              `${names.character(entry.characterId)} leaves ${words(entry.role)}`,
          ),
      ];
      return within(lines.join(' · ') || 'Officers unchanged');
    }
    case 'settlement': {
      const fields = Object.keys(change.after).filter(
        (key) =>
          key !== 'settlementId' &&
          key !== 'name' &&
          JSON.stringify(change.before[key as keyof typeof change.before]) !==
            JSON.stringify(change.after[key as keyof typeof change.after]),
      );
      return within(
        `${change.after.name} ${
          fields.includes('reputation')
            ? `${words(change.before.reputation ?? 'unknown')} → ${words(change.after.reputation ?? 'unknown')}`
            : fields.map((field) => words(field)).join(', ') || 'unchanged'
        }`,
      );
    }
    case 'settlement_benefit':
      return within(
        `${names.settlement(change.settlementId)} ${words(change.benefit)} until week ${change.expiresWeek}`,
      );
    case 'propaganda_attempt':
      return within(
        null,
        `Propaganda in ${names.settlement(change.settlementId)}`,
      );
    case 'rescue_result':
      return within(
        null,
        `Rescue ${names.character(change.characterId)} · ${check('Check', change.total, change.dc, change.succeeded)}`,
      );
    case 'information':
      return within(
        null,
        `Information on ${change.subject} · total ${change.total}${change.achievedDc === null ? '' : ` reaches DC ${change.achievedDc}`} · ${outcome(change.succeeded)}`,
      );
    case 'restoration':
      return within(
        `${words(change.effect)} for ${change.characterIds.map((id) => names.character(id)).join(', ') || 'the party'}`,
      );
    case 'tracked_character':
      return within(
        `${names.character(change.after.characterId)} ${words(change.before.status)} → ${words(change.after.status)}`,
      );
    case 'item':
      return within(
        `${change.after.name} ${change.before ? 'updated' : 'acquired'}`,
      );
    case 'cache':
      return within(
        `Cache at ${change.after.location} ${change.before ? words(change.after.status) : 'established'}`,
      );
    case 'order':
      return within(`Order placed · ${names.item(change.order.itemId)}`);
    case 'market':
      return within(
        `${words(change.market.source)} in ${names.settlement(change.market.settlementId)}`,
      );
    case 'expire_market':
      return {
        subject: `market:${change.marketId}`,
        title: 'Market closes',
        effect: 'Market closes',
        detail: null,
      };
    case 'receive_order':
      return {
        subject: `order:${change.orderId}`,
        title: 'Special order delivered',
        effect: `Received on day ${change.receipt.receivedDay}`,
        detail: null,
      };
    case 'consume_bonus':
      return {
        subject: 'activity:bonuses',
        title: 'Check bonuses used',
        effect: 'Bonus used',
        detail: null,
      };
    case 'covert_augmentation':
      return within(`Supports another action ${signed(change.bonus)}`);
    case 'covert_site':
      return within(
        `${words(change.mode)} at ${change.location} · weeks ${change.availableWeek}–${change.expiresWeek}`,
      );
    case 'event_guarantee':
      return within(
        change.selectedEventId
          ? `Guarantees ${names.event(change.selectedEventId)}`
          : 'Guarantees an event',
      );
    default: {
      const described = generic(change, 'activity', names);
      return { ...described, subject: subject ?? described.subject };
    }
  }
}

function describeEvent(
  change: CanonicalResolutionEffects['event'][number],
  names: ReviewNames,
): Omit<DescribedChange, 'acknowledgement'> {
  const base = {
    subject: eventSubject(change.eventId),
    title: names.event(change.eventId),
  };
  const line = (effect: string | null, detail: string | null = null) => ({
    ...base,
    effect,
    detail,
  });
  switch (change.kind) {
    case 'event_training':
      return line(delta('Training', change.after - change.before));
    case 'event_treasury':
      return line(delta('Treasury', change.after - change.before, true));
    case 'event_team_status':
      return line(
        `${names.team(change.teamId)} ${statusLabel(change.before)} → ${statusLabel(change.after)}`,
      );
    case 'event_team_recovery':
      return line(`${names.team(change.teamId)} Disabled → Active`);
    case 'event_team_loss':
      return line(`${names.team(change.teamId)} lost`);
    case 'event_persistent':
      return line('Becomes persistent');
    case 'event_end':
      return line(`Ends ${names.event(change.endedEventId)}`);
    case 'event_activity_bonus':
      return line(`Next Activity ${signed(change.value)}`);
    case 'event_check_bonus':
      return line(
        `${words(change.bonus.check)} ${signed(change.bonus.value)} bonus`,
      );
    case 'event_queue':
      return line(
        `Queued for week ${change.effect.startsWeek}: ${describeValue(change.effect.effect, names)}`,
      );
    case 'event_item':
      return line(`${change.item.name} gained`);
    case 'event_identification':
      return line(`${names.item(change.itemId)} identified`);
    case 'event_item_location':
      return line(`${names.item(change.itemId)} ${words(change.after)}`);
    case 'event_cache':
      return line(
        `Cache at ${change.after.location} ${words(change.before.status)} → ${words(change.after.status)}`,
      );
    case 'event_refuge':
      return line(`${names.settlement(change.settlementId)} refuge ends`);
    case 'event_person':
      return line(
        `${names.character(change.after.characterId)} ${words(change.before.status)} → ${words(change.after.status)}`,
      );
    case 'event_capture':
      return line(
        change.captured
          ? `${names.character(change.characterId)} captured`
          : null,
        `Capture of ${names.character(change.characterId)} · ${change.chance}% chance${change.roll === null ? '' : ` · roll ${change.roll}`} · ${change.captured ? 'captured' : 'escaped'}`,
      );
    case 'event_encounter':
      return line(
        null,
        `Encounter CR ${change.challengeRating} for average party level ${change.averagePartyLevel}`,
      );
    case 'event_officer_check':
      return line(
        null,
        `${names.character(change.characterId)} · ${check(words(change.skill), change.total, change.dc, change.succeeded)}`,
      );
    case 'event_skill_benefit':
    case 'event_market_benefit':
      return line(describeValue(change.benefit, names));
    case 'event_acknowledgement':
      return line(null);
    default:
      return { ...generic(change, 'event', names), ...base };
  }
}

function describePersistent(
  change: CanonicalResolutionEffects['persistent'][number],
  names: ReviewNames,
): Omit<DescribedChange, 'acknowledgement'> {
  if (change.kind === 'upkeep_team_return')
    return {
      subject: teamSubject(change.teamId),
      title: names.team(change.teamId),
      effect: `Returns · ${statusLabel(change.status)}`,
      detail: null,
    };
  const base = {
    subject: eventSubject(change.eventId),
    title: names.event(change.eventId),
  };
  switch (change.kind) {
    case 'persistent_retained':
      return { ...base, effect: 'Carries on', detail: null };
    case 'persistent_ended':
      return {
        ...base,
        effect: 'Ends',
        detail:
          change.reason === 'buyoff'
            ? 'Bought off'
            : change.reason === 'officer'
              ? 'Ended by an officer'
              : 'Ended as recorded',
      };
    case 'persistent_buyoff':
      return {
        ...base,
        effect: delta('Treasury', change.after - change.before, true),
        detail: `Buyoff costs ${gp(change.costCopper)}`,
      };
    case 'persistent_mitigation':
      return {
        ...base,
        effect: change.succeeded ? 'Mitigated this week' : null,
        detail: check('Mitigation', change.total, change.dc, change.succeeded),
      };
    case 'persistent_officer_check':
      return {
        ...base,
        effect: null,
        detail: `${names.character(change.characterId)} · ${check(words(change.skill), change.total, change.dc, change.succeeded)}`,
      };
    default:
      return { ...generic(change, 'persistent', names), ...base };
  }
}

// Unknown or older entries stay readable through the general fact text.
function generic(
  change: object,
  phase: ReviewPhase,
  names: ReviewNames,
): Omit<DescribedChange, 'acknowledgement'> {
  const kind = (change as { kind?: unknown }).kind;
  const label = typeof kind === 'string' ? words(kind) : 'Recorded change';
  const { acknowledgement: _ignored, ...rest } = change as {
    acknowledgement?: unknown;
  };
  return {
    subject: `${phase}:other`,
    title: `Other ${phase === 'upkeep' ? 'Upkeep' : words(phase)} changes`,
    effect: label,
    detail: describeValue(rest, names),
  };
}

export function describeChange(
  phase: ReviewPhase,
  change: PlanChange,
  names: ReviewNames,
): DescribedChange {
  const described =
    phase === 'upkeep'
      ? describeUpkeep(
          change as CanonicalResolutionEffects['upkeep'][number],
          names,
        )
      : phase === 'activity'
        ? describeActivity(
            change as CanonicalResolutionEffects['activity'][number],
            names,
          )
        : phase === 'event'
          ? describeEvent(
              change as CanonicalResolutionEffects['event'][number],
              names,
            )
          : describePersistent(
              change as CanonicalResolutionEffects['persistent'][number],
              names,
            );
  return { ...described, acknowledgement: acknowledgementOf(change) };
}

export type SabotageFact = CanonicalResolutionEffects['sabotage'][number];
export function sabotageSubject(
  item: Pick<SabotageFact, 'eventId' | 'choiceId'>,
) {
  return `sabotage:${item.eventId}:${item.choiceId}`;
}
/** Reactive Sabotage is described under the occurrence it reacts to. */
export function describeSabotage(item: SabotageFact) {
  return {
    subject: sabotageSubject(item),
    detail:
      item.total === null || item.succeeded === null
        ? `Sabotage check against DC ${item.dc} · awaiting roll`
        : check('Sabotage', item.total, item.dc, item.succeeded),
    effects: [
      ...(item.succeeded ? ['Event negated'] : []),
      ...(item.notoriety ? [`Notoriety ${signed(item.notoriety)}`] : []),
    ],
    acknowledgement: item.acknowledgement,
  };
}

/**
 * Net phase changes for the section header, from the phase's own plan only.
 * Table Adjustments are never included: they apply after the Rules Baseline.
 */
export function phaseChips(
  phase: ReviewPhase,
  plan: readonly PlanChange[],
  sabotage: readonly SabotageFact[] = [],
) {
  let training = 0;
  let treasury = 0;
  let notoriety = 0;
  const rank: { before: number | null; after: number | null } = {
    before: null,
    after: null,
  };
  const teamsBack = new Set<string>();
  const teamsDown = new Map<string, string>();
  const teamsLost = new Set<string>();
  let recruited = 0;
  let ended = 0;
  let persistent = 0;
  const settlements = new Set<string>();
  for (const change of plan) {
    switch (change.kind) {
      case 'training':
      case 'event_training':
        training += change.after - change.before;
        break;
      case 'treasury':
      case 'treasuryCopper':
      case 'event_treasury':
      case 'persistent_buyoff':
        treasury += change.after - change.before;
        break;
      case 'notoriety':
        notoriety += change.after - change.before;
        break;
      case 'rank':
        rank.before ??= change.before;
        rank.after = change.after;
        break;
      case 'team_status':
      case 'upkeep_team_return':
      case 'event_team_recovery':
        teamsBack.add(change.teamId);
        break;
      case 'event_team_status':
        if (change.after === 'active') teamsBack.add(change.teamId);
        else teamsDown.set(change.teamId, change.after);
        break;
      case 'remove_team':
      case 'event_team_loss':
        teamsLost.add(change.teamId);
        break;
      case 'recruit_team':
        recruited += 1;
        break;
      case 'persistent_ended':
      case 'event_end':
      case 'end_persistent_event':
        ended += 1;
        break;
      case 'event_persistent':
        persistent += 1;
        break;
      case 'settlement_reputation':
        settlements.add(change.settlementId);
        break;
      case 'settlement':
        if (change.before.reputation !== change.after.reputation)
          settlements.add(change.after.settlementId);
        break;
    }
  }
  if (phase === 'event')
    for (const item of sabotage) notoriety += item.notoriety ?? 0;
  const disabled = [...teamsDown.values()].filter((s) => s === 'disabled');
  const missing = [...teamsDown.values()].filter((s) => s === 'missing');
  return [
    ...(rank.before !== null && rank.before !== rank.after
      ? [`Rank ${rank.before} → ${rank.after}`]
      : []),
    ...(training ? [`Training ${signed(training)}`] : []),
    ...(treasury ? [`Treasury ${signedGp(treasury)}`] : []),
    ...(notoriety ? [`Notoriety ${signed(notoriety)}`] : []),
    ...(teamsBack.size
      ? [`${count(teamsBack.size, 'team', 'teams')} back`]
      : []),
    ...(disabled.length
      ? [`${count(disabled.length, 'team', 'teams')} disabled`]
      : []),
    ...(missing.length
      ? [`${count(missing.length, 'team', 'teams')} missing`]
      : []),
    ...(teamsLost.size
      ? [`${count(teamsLost.size, 'team', 'teams')} lost`]
      : []),
    ...(recruited ? [`${count(recruited, 'team', 'teams')} recruited`] : []),
    ...(settlements.size
      ? [`${count(settlements.size, 'settlement', 'settlements')} changed`]
      : []),
    ...(persistent
      ? [count(persistent, 'event carries on', 'events carry on')]
      : []),
    ...(ended ? [count(ended, 'event ends', 'events end')] : []),
  ];
}

export type TableAdjustment =
  CanonicalResolutionEffects['adjudication']['tableAdjustments'][number];
const adjustmentKinds: Record<string, string> = {
  militia_value: 'Militia value',
  team_status: 'Team condition',
  settlement_reputation: 'Settlement reputation',
  event_end: 'End persistent event',
};
const militiaFields: Record<string, string> = {
  training: 'Training',
  treasuryCopper: 'Treasury',
  notoriety: 'Notoriety',
  rank: 'Rank',
};
/** An ordered Table Adjustment's kind and effect chip. */
export function describeAdjustment(
  adjustment: TableAdjustment,
  names: ReviewNames,
) {
  const kind = adjustmentKinds[adjustment.kind] ?? words(adjustment.kind);
  switch (adjustment.kind) {
    case 'militia_value': {
      const field = militiaFields[adjustment.field] ?? words(adjustment.field);
      const money = adjustment.field === 'treasuryCopper';
      return {
        kind,
        effect:
          adjustment.operation === 'set'
            ? `${field} set to ${money ? gp(adjustment.value) : adjustment.value}`
            : `${field} ${money ? signedGp(adjustment.value) : signed(adjustment.value)}`,
      };
    }
    case 'team_status':
      return {
        kind,
        effect: `${names.team(adjustment.teamId)} → ${statusLabel(adjustment.status)}`,
      };
    case 'settlement_reputation':
      return {
        kind,
        effect: `${names.settlement(adjustment.settlementId)} → ${words(adjustment.reputation)}`,
      };
    case 'event_end':
      return { kind, effect: `Ends ${names.event(adjustment.eventId)}` };
    default:
      return { kind, effect: describeValue(adjustment, names) };
  }
}
