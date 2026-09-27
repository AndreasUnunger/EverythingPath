import type {
  CanonicalResolutionEffects,
  CanonicalResolutionPreview,
} from '~/lib/canonical-weekly-resolution';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import { normalizeRawRoll } from '~/lib/raw-roll';
import { RULE_ROLL_SPECS } from '~/lib/rules-roll-spec';
import {
  choiceSubject,
  describeAdjustment,
  describeChange,
  describeSabotage,
  eventSubject,
  phaseChips,
  sabotageSubject,
  teamSubject,
  transferSubject,
  type PlanAcknowledgement,
  type PlanChange,
} from '~/components/week-review/review-changes';
import { compareWeekStates } from '~/components/week-review/review-comparison';
import type {
  ReviewItem,
  ReviewNote,
  ReviewPhase,
  ReviewSection,
  WeekReviewFacts,
} from '~/components/week-review/review-facts';
import { findOwner } from '~/components/week-review/review-notes';
import {
  gp,
  signed,
  words,
  type ReviewNames,
} from '~/components/week-review/review-text';
import { activityLabel } from './activity-labels';
import type {
  ActivityView,
  EventView,
  PersistentView,
  PhaseView,
  UpkeepCheck,
  UpkeepView,
} from './types';

// Live adapter for the shared six-section presentation: the current week's
// source snapshot (Now), the optimistic Weekly Draft and one Resolution
// Preview (Rules Baseline and Final). It only reads resolver output; the
// renderer never sees the draft, the store or the resolver. It must stay a
// plain module: the non-React acceptance bundle runs it too.

type Summary = Extract<PhaseView, { phase: 'summary' }>;
type Phases = NonNullable<CanonicalResolutionPreview['phases']>;
// Internal bookkeeping stripped before the facts leave the adapter: the
// subjects that own codes, and bare check totals a resolved check replaces.
type Item = ReviewItem & { subjects: string[]; checkTotals: string[] };
type ItemsByPhase = Record<ReviewPhase, Item[]>;

const phaseOrder = ['upkeep', 'activity', 'event', 'persistent'] as const;
const titles: Record<ReviewPhase, string> = {
  upkeep: 'Upkeep',
  activity: 'Activity',
  event: 'Event',
  persistent: 'Persistent',
};
const emptyText: Record<ReviewPhase, string> = {
  upkeep: 'No Upkeep consequences this week.',
  activity: 'No actions were chosen this Activity.',
  event: 'No event consequences this week.',
  persistent: 'No persistent event consequences this week.',
};

function newItem(key: string, title: string, subjects: string[] = []): Item {
  return {
    key,
    title,
    details: [],
    effects: [],
    notes: [],
    missing: false,
    subjects,
    checkTotals: [],
  };
}
function addCheckTotal(entry: Item, line: string) {
  entry.checkTotals.push(line);
  entry.details.push(line);
}

function liveNames(
  source: WorkspaceSource,
  preview: CanonicalResolutionPreview,
  summary: Pick<Summary, 'options'>,
): ReviewNames {
  const states = [
    source.snapshot,
    preview.baseline?.militiaSnapshot,
    preview.outcome?.militiaSnapshot,
    preview.phases?.persistent.outcome,
  ].filter((state) => state !== undefined);
  const option = (field: string, id: string) =>
    summary.options[field]?.find((entry) => entry.value === id)?.label;
  return {
    team: (id) =>
      states
        .flatMap((state) => state.roster.teams)
        .find((team) => team.teamId === id)?.name ?? 'Unavailable team',
    settlement: (id) =>
      states
        .flatMap((state) => state.settlements)
        .find((entry) => entry.settlementId === id)?.name ??
      'Unavailable settlement',
    character: (id) =>
      source.people.find((person) => person.characterId === id)?.name ??
      'Unnamed character',
    event: (id) =>
      option('eventId', id) ?? option('subjectId', id) ?? 'Recorded event',
    item: (id) =>
      option('itemId', id) ??
      states
        .flatMap((state) => state.economy?.items ?? [])
        .find((entry) => entry.itemId === id)?.name ??
      'Recorded item',
    cache: (id) => option('cacheId', id) ?? 'Recorded cache',
    source: (value) =>
      option('eventId', value) ?? option('sourceId', value) ?? value,
  };
}

function upkeepCheckLine(
  label: string,
  check: Pick<UpkeepCheck<string>, 'total' | 'dc'> & { result: string | null },
) {
  if (check.total === null)
    return `${label} against DC ${check.dc ?? '—'} · awaiting roll`;
  return `${label} ${check.total} vs DC ${check.dc ?? '—'} · ${words(check.result ?? 'recorded')}`;
}
/** A check total from the resolver, named by the last segment of its id. */
function checkTotalLine(
  check: { checkId: string; total: number | null; modifier: number },
  label = words(check.checkId.split(':').at(-1) ?? 'event'),
) {
  return check.total === null
    ? `${label} check bonus ${signed(check.modifier)} · awaiting roll`
    : `${label} check ${check.total} (bonus ${signed(check.modifier)})`;
}
function waitingLine(status: string) {
  if (status === 'waiting') return 'Waiting for an earlier Upkeep step.';
  if (status === 'open') return 'Needs a roll or decision in Upkeep.';
  return null;
}
function recoveryLine(decision: 'recover' | 'leave' | null, cost: number) {
  if (decision === 'recover') return `Recovered · pays ${gp(cost)}`;
  if (decision === 'leave') return 'Left disabled';
  return 'Recovery decision needed';
}
function rankLine(before: number, after: number | null) {
  if (after === null)
    return 'Rank is known once the earlier Upkeep steps are complete.';
  return after === before
    ? `Rank stays ${before}`
    : `Rank ${before} → ${after}`;
}

function upkeepTeamItems(upkeep: UpkeepView, source: WorkspaceSource) {
  const teams = upkeep.sections?.teams;
  if (!teams) return [];
  const disabled = new Map(teams.disabled.map((t) => [t.teamId, t]));
  const missing = new Map(teams.missing.map((t) => [t.teamId, t]));
  // Recovery and returns run in roster order, as the resolver does.
  return source.snapshot.roster.teams.flatMap((team) => {
    const recovery = disabled.get(team.teamId);
    const absent = missing.get(team.teamId);
    if (!recovery && !absent) return [];
    const entry = newItem(teamSubject(team.teamId), team.name, [
      team.teamId,
      teamSubject(team.teamId),
    ]);
    if (recovery)
      entry.details.push(
        recoveryLine(recovery.decision, recovery.enteredCostCopper),
      );
    if (absent?.return?.kind === 'scheduled')
      entry.details.push(`Returns in week ${absent.return.week} as scheduled`);
    else if (absent?.return?.kind === 'check')
      entry.details.push(
        upkeepCheckLine('Return · Security', absent.return.check),
      );
    return [entry];
  });
}

function transferItems(upkeep: UpkeepView): Item[] {
  return upkeep.transfers.map((transfer) => {
    const person = upkeep.officers.find(
      (entry) => entry.characterId === transfer.characterId,
    )?.name;
    const kind = transfer.direction === 'deposit' ? 'deposit' : 'withdrawal';
    return newItem(
      transferSubject(transfer.transferId),
      `Treasury ${kind}${person ? ` · ${person}` : ''}`,
      [transfer.transferId, transferSubject(transfer.transferId)],
    );
  });
}

function upkeepItems(upkeep: UpkeepView, source: WorkspaceSource): Item[] {
  const sections = upkeep.sections;
  if (!sections) return [];
  const { attrition, notoriety, shortage, rank } = sections;
  const step = (
    key: string,
    title: string,
    status: string,
    lines: (string | null)[],
  ) => {
    if (status === 'inapplicable') return [];
    const entry = newItem(`upkeep:${key}`, title, [
      `upkeep:${key}`,
      `upkeep:${key}-training`,
    ]);
    entry.details.push(
      ...[...lines, waitingLine(status)].filter((line) => line !== null),
    );
    return [entry];
  };
  const rankItem = newItem('upkeep:rank', 'Rank', ['upkeep:rank', 'rank']);
  rankItem.details.push(rankLine(rank.before, rank.after));
  return [
    ...upkeepTeamItems(upkeep, source),
    ...step('attrition', 'Training attrition', attrition.status, [
      upkeepCheckLine('Loyalty', attrition.check),
    ]),
    ...step('notoriety', 'Notoriety', notoriety.status, [
      `Notoriety ${notoriety.notoriety} reaches ${notoriety.threshold}`,
      notoriety.check ? upkeepCheckLine('Loyalty', notoriety.check) : null,
    ]),
    ...step('shortage', 'Treasury shortage', shortage.status, [
      `Treasury ${gp(shortage.treasuryAfterRecoveryCopper)} is below the ${gp(shortage.minimumCopper)} minimum`,
    ]),
    rankItem,
    ...transferItems(upkeep),
  ];
}

function choiceSubjects(
  choice: NonNullable<ActivityView['slots'][number]['choice']>,
) {
  return [
    choice.choiceId,
    ...('orderId' in choice && typeof choice.orderId === 'string'
      ? [choice.orderId]
      : []),
    // Market and order outcomes are acknowledged per offered item.
    ...('purchases' in choice
      ? (choice.purchases ?? []).map((p) => `availability:${p.itemId}`)
      : []),
    ...('itemId' in choice && typeof choice.itemId === 'string'
      ? [`availability:${choice.itemId}`]
      : []),
  ];
}

function activityItems(
  activity: ActivityView,
  results: Phases['activity']['actionResults'],
  names: ReviewNames,
): Item[] {
  return activity.slots.flatMap((slot, index) => {
    const choice = slot.choice;
    if (!choice) return [];
    const team = choice.teamId ? ` · ${names.team(choice.teamId)}` : '';
    const entry = newItem(
      choiceSubject(choice.choiceId),
      `Slot ${index + 1} · ${activityLabel(choice.actionId)}${team}`,
      choiceSubjects(choice),
    );
    if (slot.overAllowance)
      entry.details.push(
        'Beyond this week’s action allowance, so it is not resolved.',
      );
    const check = activity.checks.find((c) => c.checkId === choice.choiceId);
    const result = results.find((r) => r.choiceId === choice.choiceId);
    const outcome =
      result?.succeeded == null
        ? ''
        : result.succeeded
          ? ' · succeeded'
          : ' · failed';
    if (check) addCheckTotal(entry, checkTotalLine(check, 'Check') + outcome);
    else if (outcome) entry.details.push(words(outcome.slice(3)));
    return [entry];
  });
}

/** The chance line states only what the resolver decided. */
function chanceLine(event: EventView, phase: Phases['event'] | undefined) {
  const prefix = `Event chance ${event.chance}%`;
  if (event.guaranteed) return `${prefix} · an event is guaranteed`;
  const roll = normalizeRawRoll(event.chanceRoll, RULE_ROLL_SPECS.percentile);
  if (roll.status !== 'complete') return `${prefix} · roll not entered`;
  const rolled = `${prefix} · roll ${roll.diceTotal}${event.chanceModifier ? ` ${signed(event.chanceModifier)}` : ''}`;
  if (event.chanceModifier === null)
    return `${rolled} · the operating settlement’s reputation is needed`;
  const occurs =
    phase?.requirements.includes('event:root:1') === true ||
    event.occurrences.some(
      (entry) => entry.selected && entry.occurrence.origin.kind === 'rolled',
    );
  return `${rolled} · ${occurs ? 'an event occurs' : 'no event occurs'}`;
}

function sabotageItem(
  entry: EventView['occurrences'][number],
  title: string,
  sabotage: CanonicalResolutionEffects['sabotage'],
) {
  const { occurrence } = entry;
  const reactive = occurrence.sabotage;
  if (!reactive) return [];
  const subject = sabotageSubject({
    eventId: occurrence.eventId,
    choiceId: reactive.choiceId,
  });
  const item = newItem(subject, `${title} · Sabotage`, [
    subject,
    reactive.choiceId,
  ]);
  const fact = sabotage.find(
    (s) => s.eventId === occurrence.eventId && s.choiceId === reactive.choiceId,
  );
  if (!fact) {
    item.details.push('Sabotage check · awaiting roll');
    return [item];
  }
  const described = describeSabotage(fact);
  item.details.push(described.detail);
  item.effects.push(
    ...described.effects.map((text, i) => ({
      key: `${subject}:effect:${i}`,
      text,
    })),
  );
  return [item];
}

function eventItems(event: EventView, phase: Phases['event'] | undefined) {
  const chance = newItem('event:chance', 'Event chance', ['event:chance']);
  chance.details.push(chanceLine(event, phase));
  const numbers = new Map(
    event.occurrences.map((entry, index) => [
      entry.occurrence.eventId,
      `Event ${index + 1}`,
    ]),
  );
  const occurrences = event.occurrences.flatMap((entry, index) => {
    const { occurrence } = entry;
    const title = `${activityLabel(entry.resolvedType ?? 'event')} · Event ${index + 1}`;
    const item = newItem(eventSubject(occurrence.eventId), title, [
      occurrence.eventId,
      eventSubject(occurrence.eventId),
      ...(occurrence.rewards ?? []).map((reward) => reward.itemId),
    ]);
    if ('parentEventId' in occurrence.origin)
      item.details.push(
        `${occurrence.origin.kind === 'roll_twice' ? 'Rolled twice from' : 'Replaces'} ${numbers.get(occurrence.origin.parentEventId) ?? 'an earlier event'}`,
      );
    if (entry.owner)
      item.details.push(`From ${activityLabel(entry.owner.choice.actionId)}`);
    if (entry.mode === 'twice') item.details.push('Occurs twice');
    if (entry.negated) item.details.push('Negated by Sabotage');
    for (const check of event.checks)
      if (
        check.checkId.startsWith(`${occurrence.eventId}:`) &&
        !check.checkId.includes(':sabotage:')
      )
        addCheckTotal(item, checkTotalLine(check));
    return [item, ...sabotageItem(entry, title, phase?.sabotage ?? [])];
  });
  return [chance, ...occurrences];
}

function persistentItems(persistent: PersistentView): Item[] {
  return persistent.events.map((event) => {
    const item = newItem(eventSubject(event.eventId), event.name, [
      event.eventId,
      eventSubject(event.eventId),
    ]);
    if (event.targetNames.length)
      item.details.push(`Affects ${event.targetNames.join(', ')}`);
    item.details.push(
      event.decision
        ? `Decision: ${words(event.decision.kind)}`
        : 'Carries on unless the table decides otherwise',
    );
    for (const check of event.checks)
      addCheckTotal(item, checkTotalLine(check));
    return item;
  });
}

/** Outcome notes: each acknowledgement is placed at most once in the review. */
function createOutcomes() {
  const placed = new Set<string>();
  const note = (ack: PlanAcknowledgement, text: string): ReviewNote => {
    placed.add(ack.acknowledgementId);
    return { kind: 'outcome', key: `outcome:${ack.acknowledgementId}`, text };
  };
  return {
    isPlaced: (ack: PlanAcknowledgement) => placed.has(ack.acknowledgementId),
    place(target: Item, ack: PlanAcknowledgement) {
      if (placed.has(ack.acknowledgementId) || !ack.outcome.trim()) return;
      target.notes.push(note(ack, ack.outcome));
    },
    /** An outcome no consequence owns, kept with its subject's name. */
    unlinked(ack: Summary['acknowledgements'][number]) {
      return ack.outcome.trim()
        ? note(ack, `${ack.name}: ${ack.outcome}`)
        : null;
    },
  };
}
type Outcomes = ReturnType<typeof createOutcomes>;

function addPlanLine(
  target: Item,
  described: ReturnType<typeof describeChange>,
  index: number,
  outcomes: Outcomes,
) {
  if (described.effect)
    target.effects.push({
      key: `${described.subject}:effect:${index}`,
      text: described.effect,
    });
  if (described.resolvesCheck)
    target.details = target.details.filter(
      (line) => !target.checkTotals.includes(line),
    );
  if (described.detail) target.details.push(described.detail);
  if (described.acknowledgement)
    outcomes.place(target, described.acknowledgement);
}

/** Order plan lines into the skeleton; unknown subjects keep plan order. */
function applyPlan(
  phase: ReviewPhase,
  skeleton: Item[],
  plan: readonly PlanChange[],
  names: ReviewNames,
  outcomes: Outcomes,
) {
  const leading: Item[] = [];
  const trailing: Item[] = [];
  const byKey = new Map(skeleton.map((entry) => [entry.key, entry]));
  let reachedSkeleton = false;
  plan.forEach((change, index) => {
    const described = describeChange(phase, change, names);
    const known = byKey.get(described.subject);
    reachedSkeleton ||= known !== undefined;
    const target =
      known ??
      newItem(described.subject, described.title, [
        described.subject,
        described.subject.replace(/^[a-z]+:/, ''),
      ]);
    if (!known) {
      byKey.set(described.subject, target);
      const before = !reachedSkeleton && skeleton.length > 0;
      (before ? leading : trailing).push(target);
    }
    addPlanLine(target, described, index, outcomes);
  });
  return [...leading, ...skeleton, ...trailing];
}

function phaseItems(
  source: WorkspaceSource,
  views: Views,
  phases: Phases | null,
  names: ReviewNames,
  outcomes: Outcomes,
): ItemsByPhase {
  const skeletons: ItemsByPhase = {
    upkeep: upkeepItems(views.upkeep, source),
    activity: activityItems(
      views.activity,
      phases?.activity.actionResults ?? [],
      names,
    ),
    event: eventItems(views.event, phases?.event),
    persistent: persistentItems(views.persistent),
  };
  return Object.fromEntries(
    phaseOrder.map((phase) => [
      phase,
      applyPlan(
        phase,
        skeletons[phase],
        (phases?.[phase].plan ?? []) as readonly PlanChange[],
        names,
        outcomes,
      ),
    ]),
  ) as ItemsByPhase;
}

/** Acknowledgements recorded on a choice, Sabotage or decision, by owner key. */
function recordedOutcomes(
  draft: WeeklyDraft,
  views: Views,
  phases: Phases | null,
): { key: string; acks: readonly PlanAcknowledgement[] }[] {
  const sabotage = (eventId: string, choiceId: string) =>
    sabotageSubject({ eventId, choiceId });
  return [
    ...(phases?.event.sabotage ?? []).map((fact) => ({
      key: sabotageSubject(fact),
      acks: fact.acknowledgement ? [fact.acknowledgement] : [],
    })),
    ...draft.activity.slots.flatMap((slot) =>
      slot.choice
        ? [
            {
              key: choiceSubject(slot.choice.choiceId),
              acks: slot.choice.acknowledgements ?? [],
            },
          ]
        : [],
    ),
    ...views.event.occurrences.flatMap(({ occurrence }) => {
      const decision = occurrence.persistentDecision;
      return [
        {
          key: eventSubject(occurrence.eventId),
          acks: decision?.kind === 'end' ? [decision.acknowledgement] : [],
        },
        ...(occurrence.sabotage
          ? [
              {
                key: sabotage(occurrence.eventId, occurrence.sabotage.choiceId),
                acks: occurrence.sabotage.acknowledgements ?? [],
              },
            ]
          : []),
      ];
    }),
    ...draft.persistent.decisions.map((decision) => ({
      key: eventSubject(decision.eventId),
      acks: decision.kind === 'end' ? [decision.acknowledgement] : [],
    })),
  ];
}

// Outcomes recorded on an item itself first, then shared acknowledgements by
// subject; anything left over is kept as an unlinked fact.
function placeOutcomes(
  review: ReviewState,
  acknowledgements: Summary['acknowledgements'],
  outcomes: Outcomes,
) {
  const all = Object.values(review.items).flat();
  for (const { key, acks } of recordedOutcomes(
    review.draft,
    review.views,
    review.phases,
  )) {
    const target = all.find((entry) => entry.key === key);
    if (target) for (const ack of acks) outcomes.place(target, ack);
  }
  for (const ack of acknowledgements) {
    if (outcomes.isPlaced(ack)) continue;
    const owner = findOwner(ack.subjectId, all);
    if (owner) {
      outcomes.place(owner, ack);
      continue;
    }
    const note = outcomes.unlinked(ack);
    if (note) review.unassociated.push(note);
  }
}

/** The phase whose own requirements or warnings mention a subject or code. */
function knownPhase(
  phases: Phases | null,
  subjectOrCode: string,
  ruleId?: string,
): ReviewPhase | null {
  const found = phaseOrder.find((phase) =>
    [
      ...(phases?.[phase].requirements ?? []),
      ...(phases?.[phase].warnings ?? []),
    ].some(
      (code) => code === subjectOrCode || code.startsWith(`${subjectOrCode}:`),
    ),
  );
  if (found) return found;
  if (ruleId?.startsWith('upkeep-')) return 'upkeep';
  if (ruleId === actionCapacity) return 'activity';
  return null;
}
const actionCapacity = 'action-capacity';

function exceptionNote(exception: Summary['exceptions'][number]): ReviewNote {
  return {
    kind: 'exception',
    key: `exception:${exception.exceptionId}`,
    exceptionId: exception.exceptionId,
    subjectId: exception.subjectId,
    ruleId: exception.ruleId,
    rule: activityLabel(exception.ruleId.replaceAll('-', '_')),
    reason: exception.reason,
    obsolete: exception.ruleId === actionCapacity,
  };
}

function placeExceptions(
  review: ReviewState,
  exceptions: Summary['exceptions'],
) {
  for (const exception of exceptions) {
    const note = exceptionNote(exception);
    const owner = findOwner(
      exception.subjectId,
      Object.values(review.items).flat(),
    );
    if (owner) {
      owner.notes.push(note);
      continue;
    }
    // A fact whose item is gone stays at the end of its known phase.
    const phase = knownPhase(
      review.phases,
      exception.subjectId,
      exception.ruleId,
    );
    if (!phase) {
      review.unassociated.push(note);
      continue;
    }
    const orphan = newItem(`missing:${exception.exceptionId}`, exception.name);
    orphan.missing = true;
    orphan.notes.push(note);
    review.items[phase].push(orphan);
  }
}

function adjustmentOf(draft: WeeklyDraft, code: string) {
  return draft.tableAdjustments.find((entry) =>
    code.startsWith(`adjustment:${entry.adjustmentId}:`),
  );
}

/** Every live warning appears once: under its item, adjustment or phase. */
function placeWarnings(
  review: ReviewState,
  warnings: readonly string[],
  message: Message,
) {
  const byAdjustment = new Map<string, ReviewNote[]>();
  const general: Partial<Record<ReviewPhase, Item>> = {};
  const all = Object.values(review.items).flat();
  for (const code of warnings) {
    const note: ReviewNote = {
      kind: 'warning',
      key: `warning:${code}`,
      message: message(code, true),
    };
    const adjustment = adjustmentOf(review.draft, code);
    if (adjustment) {
      appendNote(byAdjustment, adjustment.adjustmentId, note);
      continue;
    }
    const owner = findOwner(code, all);
    if (owner) {
      owner.notes.push(note);
      continue;
    }
    const phase = knownPhase(review.phases, code);
    if (!phase) {
      review.unassociated.push(note);
      continue;
    }
    general[phase] ??= newItem(
      `general:${phase}`,
      `Other ${titles[phase]} warnings`,
    );
    general[phase].notes.push(note);
  }
  for (const phase of phaseOrder) {
    const entry = general[phase];
    if (entry) review.items[phase].push(entry);
  }
  return byAdjustment;
}

/** An unavailable target or overflow is a requirement of that adjustment. */
function addAdjustmentRequirements(
  draft: WeeklyDraft,
  requirements: readonly string[],
  message: Message,
  byAdjustment: Map<string, ReviewNote[]>,
) {
  for (const code of requirements) {
    const adjustment = adjustmentOf(draft, code);
    if (adjustment)
      appendNote(byAdjustment, adjustment.adjustmentId, {
        kind: 'warning',
        key: `requirement:${code}`,
        message: message(code, false),
      });
  }
}

function appendNote(
  map: Map<string, ReviewNote[]>,
  key: string,
  note: ReviewNote,
) {
  map.set(key, [...(map.get(key) ?? []), note]);
}

function sectionChips(phase: ReviewPhase, phases: Phases) {
  const plan = phases[phase].plan as readonly PlanChange[];
  if (phase !== 'event') return phaseChips(phase, plan);
  // Sabotage requests a Notoriety change the resolver keeps in 0–100.
  const applied =
    phases.event.outcome.notoriety - phases.activity.outcome.notoriety;
  return phaseChips(phase, plan, phases.event.sabotage, applied);
}

function notApplicableText(
  phase: ReviewPhase,
  draft: WeeklyDraft,
  views: Views,
) {
  if (phase === 'upkeep' && views.upkeep.skipped)
    return 'Upkeep is skipped in the militia’s first week.';
  if (phase === 'persistent' && !draft.context.persistentPhaseEligible)
    return 'No persistent events carried into this week.';
  return null;
}

/** The honest one-line state of a phase section, from least to most known. */
function sectionStatus(
  phase: ReviewPhase,
  count: number,
  review: ReviewState,
): Pick<ReviewSection, 'status' | 'statusText'> {
  if (!review.phases)
    return {
      status: 'incomplete',
      statusText:
        'Consequences are not available until the week’s entries are valid.',
    };
  const notApplicable = notApplicableText(phase, review.draft, review.views);
  if (notApplicable && count === 0)
    return { status: 'not-applicable', statusText: notApplicable };
  if (!review.views[phase].ready)
    return {
      status: 'incomplete',
      statusText:
        'Some decisions in this phase are still open, so these consequences are partial.',
    };
  if (count === 0) return { status: 'empty', statusText: emptyText[phase] };
  return { status: 'complete', statusText: null };
}

function sectionFacts(
  phase: ReviewPhase,
  number: ReviewSection['number'],
  review: ReviewState,
): ReviewSection {
  const items = review.items[phase].map(
    ({ subjects: _subjects, checkTotals: _checkTotals, ...rest }) => rest,
  );
  return {
    phase,
    number,
    title: titles[phase],
    chips: review.phases ? sectionChips(phase, review.phases) : [],
    items,
    ...sectionStatus(phase, items.length, review),
  };
}

function adjustmentFacts(
  draft: WeeklyDraft,
  names: ReviewNames,
  notes: Map<string, ReviewNote[]>,
): WeekReviewFacts['adjustments'] {
  return draft.tableAdjustments.map((adjustment, index) => ({
    key: `adjustment:${adjustment.adjustmentId}`,
    adjustmentId: adjustment.adjustmentId,
    number: index + 1,
    ...describeAdjustment(adjustment, names),
    reason: adjustment.reason,
    notes: notes.get(adjustment.adjustmentId) ?? [],
  }));
}

/** Now is this week's source; Rules Baseline and Final share one preview. */
function resultFacts(
  draft: WeeklyDraft,
  source: WorkspaceSource,
  preview: CanonicalResolutionPreview,
  names: ReviewNames,
): WeekReviewFacts['result'] {
  const baseline = preview.baselinePlan?.after ?? null;
  const final = preview.finalPlan?.after ?? null;
  const now = {
    week: draft.week,
    militiaSnapshot: source.snapshot,
    context: draft.context,
  };
  return {
    nextWeek: final?.week ?? draft.week + 1,
    complete: baseline !== null && final !== null,
    rows: compareWeekStates({ now, baseline, final, names }),
  };
}

type Views = {
  upkeep: UpkeepView;
  activity: ActivityView;
  event: EventView;
  persistent: PersistentView;
};
type Message = (code: string, warning: boolean) => string;
/** What placement reads and extends while the review is assembled. */
type ReviewState = {
  draft: WeeklyDraft;
  views: Views;
  phases: Phases | null;
  items: ItemsByPhase;
  unassociated: ReviewNote[];
};

export function liveWeekReview({
  draft,
  source,
  preview,
  views,
  summary,
  message,
}: {
  draft: WeeklyDraft;
  source: WorkspaceSource;
  preview: CanonicalResolutionPreview;
  views: Views;
  summary: Pick<
    Summary,
    'options' | 'exceptions' | 'acknowledgements' | 'warnings'
  >;
  message: Message;
}): WeekReviewFacts {
  const names = liveNames(source, preview, summary);
  const outcomes = createOutcomes();
  const review: ReviewState = {
    draft,
    views,
    phases: preview.phases,
    items: phaseItems(source, views, preview.phases, names, outcomes),
    unassociated: [],
  };
  placeOutcomes(review, summary.acknowledgements, outcomes);
  placeExceptions(review, summary.exceptions);
  const adjustmentNotes = placeWarnings(review, summary.warnings, message);
  addAdjustmentRequirements(
    draft,
    preview.requirements,
    message,
    adjustmentNotes,
  );
  return {
    mode: 'live',
    sections: [
      sectionFacts('upkeep', 1, review),
      sectionFacts('activity', 2, review),
      sectionFacts('event', 3, review),
      sectionFacts('persistent', 4, review),
    ],
    unassociated: review.unassociated,
    adjustments: adjustmentFacts(draft, names, adjustmentNotes),
    result: resultFacts(draft, source, preview, names),
  };
}
