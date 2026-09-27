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
} from '../week-review/review-changes';
import { compareWeekStates } from '../week-review/review-comparison';
import type {
  ReviewItem,
  ReviewNote,
  ReviewPhase,
  ReviewSection,
  WeekReviewFacts,
} from '../week-review/review-facts';
import { findOwner } from '../week-review/review-notes';
import {
  gp,
  signed,
  words,
  type ReviewNames,
} from '../week-review/review-text';
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
// Preview (Rules Baseline and Final). It only reads; the renderer never sees
// the draft, the store or the resolver.

type Summary = Extract<PhaseView, { phase: 'summary' }>;
type Item = ReviewItem & { subjects: string[] };
type Ack = PlanAcknowledgement;

const titles: Record<ReviewPhase, string> = {
  upkeep: 'Upkeep',
  activity: 'Activity',
  event: 'Event',
  persistent: 'Persistent',
};

function item(key: string, title: string, subjects: string[] = []): Item {
  return {
    key,
    title,
    details: [],
    effects: [],
    notes: [],
    missing: false,
    subjects,
  };
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
  };
}

function checkLine(
  label: string,
  check: Pick<UpkeepCheck<string>, 'total' | 'dc' | 'modifier'> & {
    result: string | null;
  },
) {
  if (check.total === null)
    return `${label} against DC ${check.dc ?? '—'} · awaiting roll`;
  return `${label} ${check.total} vs DC ${check.dc ?? '—'} · ${words(check.result ?? 'recorded')}`;
}
function sectionWait(status: string) {
  return status === 'waiting'
    ? 'Waiting for an earlier Upkeep step.'
    : status === 'open'
      ? 'Needs a roll or decision in Upkeep.'
      : null;
}

function upkeepItems(upkeep: UpkeepView, source: WorkspaceSource): Item[] {
  const sections = upkeep.sections;
  if (!sections) return [];
  const items: Item[] = [];
  const disabled = new Map(sections.teams.disabled.map((t) => [t.teamId, t]));
  const missing = new Map(sections.teams.missing.map((t) => [t.teamId, t]));
  for (const team of source.snapshot.roster.teams) {
    const recovery = disabled.get(team.teamId);
    const absent = missing.get(team.teamId);
    if (!recovery && !absent) continue;
    const entry = item(teamSubject(team.teamId), team.name, [
      team.teamId,
      teamSubject(team.teamId),
    ]);
    if (recovery)
      entry.details.push(
        recovery.decision === 'recover'
          ? `Recovered · pays ${gp(recovery.enteredCostCopper)}`
          : recovery.decision === 'leave'
            ? 'Left disabled'
            : 'Recovery decision needed',
      );
    if (absent?.return?.kind === 'scheduled')
      entry.details.push(`Returns in week ${absent.return.week} as scheduled`);
    else if (absent?.return?.kind === 'check')
      entry.details.push(checkLine('Return · Security', absent.return.check));
    items.push(entry);
  }
  const { attrition, notoriety, shortage, rank } = sections;
  if (attrition.status !== 'inapplicable') {
    const entry = item('upkeep:attrition', 'Training attrition', [
      'upkeep:attrition',
      'upkeep:attrition-training',
    ]);
    entry.details.push(checkLine('Loyalty', attrition.check));
    const wait = sectionWait(attrition.status);
    if (wait) entry.details.push(wait);
    items.push(entry);
  }
  if (notoriety.status !== 'inapplicable') {
    const entry = item('upkeep:notoriety', 'Notoriety', [
      'upkeep:notoriety',
      'upkeep:notoriety-training',
    ]);
    entry.details.push(
      `Notoriety ${notoriety.notoriety} reaches ${notoriety.threshold}`,
    );
    if (notoriety.check)
      entry.details.push(checkLine('Loyalty', notoriety.check));
    const wait = sectionWait(notoriety.status);
    if (wait) entry.details.push(wait);
    items.push(entry);
  }
  if (shortage.status !== 'inapplicable') {
    const entry = item('upkeep:shortage', 'Treasury shortage', [
      'upkeep:shortage',
    ]);
    entry.details.push(
      `Treasury ${gp(shortage.treasuryAfterRecoveryCopper)} is below the ${gp(shortage.minimumCopper)} minimum`,
    );
    const wait = sectionWait(shortage.status);
    if (wait) entry.details.push(wait);
    items.push(entry);
  }
  const rankItem = item('upkeep:rank', 'Rank', ['upkeep:rank', 'rank']);
  rankItem.details.push(
    rank.after === null
      ? 'Rank is known once the earlier Upkeep steps are complete.'
      : rank.after === rank.before
        ? `Rank stays ${rank.before}`
        : `Rank ${rank.before} → ${rank.after}`,
  );
  items.push(rankItem);
  for (const transfer of upkeep.transfers) {
    const person =
      upkeep.officers.find(
        (entry) => entry.characterId === transfer.characterId,
      )?.name ?? null;
    items.push(
      item(
        transferSubject(transfer.transferId),
        `Treasury ${transfer.direction === 'deposit' ? 'deposit' : 'withdrawal'}${person ? ` · ${person}` : ''}`,
        [transfer.transferId, transferSubject(transfer.transferId)],
      ),
    );
  }
  return items;
}

function activityItems(
  activity: ActivityView,
  results: readonly { choiceId: string; succeeded: boolean | null }[],
  names: ReviewNames,
): Item[] {
  return activity.slots.flatMap((slot, index) => {
    const choice = slot.choice;
    if (!choice) return [];
    const team = choice.teamId ? ` · ${names.team(choice.teamId)}` : '';
    const entry = item(
      choiceSubject(choice.choiceId),
      `Slot ${index + 1} · ${activityLabel(choice.actionId)}${team}`,
      [
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
      ],
    );
    if (slot.overAllowance)
      entry.details.push(
        'Beyond this week’s action allowance, so it is not resolved.',
      );
    const check = activity.checks.find((c) => c.checkId === choice.choiceId);
    if (check)
      entry.details.push(
        check.total === null
          ? `Check bonus ${signed(check.modifier)} · awaiting roll`
          : `Check ${check.total} (bonus ${signed(check.modifier)})`,
      );
    const result = results.find((r) => r.choiceId === choice.choiceId);
    if (result && result.succeeded !== null)
      entry.details.push(result.succeeded ? 'Succeeded' : 'Failed');
    return [entry];
  });
}

function eventItems(
  event: EventView,
  sabotage: CanonicalResolutionEffects['sabotage'],
): Item[] {
  const items: Item[] = [];
  const chance = item('event:chance', 'Event chance', ['event:chance']);
  const roll = normalizeRawRoll(event.chanceRoll, RULE_ROLL_SPECS.percentile);
  chance.details.push(
    event.guaranteed
      ? `Event chance ${event.chance}% · an event is guaranteed`
      : roll.status !== 'complete'
        ? `Event chance ${event.chance}% · roll not entered`
        : `Event chance ${event.chance}% · roll ${roll.diceTotal}${event.chanceModifier ? ` ${signed(event.chanceModifier)}` : ''} · ${
            event.chanceModifier !== null &&
            roll.diceTotal + event.chanceModifier < event.chance
              ? 'an event occurs'
              : 'no event occurs'
          }`,
  );
  items.push(chance);
  const labels = new Map<string, string>();
  event.occurrences.forEach((entry, index) => {
    const occurrence = entry.occurrence;
    const title = `${activityLabel(entry.resolvedType ?? 'event')} · Event ${index + 1}`;
    labels.set(occurrence.eventId, `Event ${index + 1}`);
    const current = item(eventSubject(occurrence.eventId), title, [
      occurrence.eventId,
      eventSubject(occurrence.eventId),
      ...(occurrence.rewards ?? []).map((reward) => reward.itemId),
    ]);
    if ('parentEventId' in occurrence.origin)
      current.details.push(
        `${occurrence.origin.kind === 'roll_twice' ? 'Rolled twice from' : 'Replaces'} ${labels.get(occurrence.origin.parentEventId) ?? 'an earlier event'}`,
      );
    if (entry.owner)
      current.details.push(
        `From ${activityLabel(entry.owner.choice.actionId)}`,
      );
    if (entry.mode === 'twice') current.details.push('Occurs twice');
    if (entry.negated) current.details.push('Negated by Sabotage');
    for (const check of event.checks.filter(
      (c) =>
        c.checkId.startsWith(`${occurrence.eventId}:`) &&
        !c.checkId.includes(':sabotage:'),
    ))
      current.details.push(
        check.total === null
          ? `${words(check.checkId.split(':').at(-1) ?? 'event')} check bonus ${signed(check.modifier)} · awaiting roll`
          : `${words(check.checkId.split(':').at(-1) ?? 'event')} check ${check.total} (bonus ${signed(check.modifier)})`,
      );
    items.push(current);
    const reactive = occurrence.sabotage;
    if (reactive) {
      const subject = sabotageSubject({
        eventId: occurrence.eventId,
        choiceId: reactive.choiceId,
      });
      const entryItem = item(subject, `${title} · Sabotage`, [
        subject,
        reactive.choiceId,
      ]);
      const fact = sabotage.find(
        (s) =>
          s.eventId === occurrence.eventId && s.choiceId === reactive.choiceId,
      );
      if (fact) {
        const described = describeSabotage(fact);
        entryItem.details.push(described.detail);
        entryItem.effects.push(
          ...described.effects.map((text, i) => ({
            key: `${subject}:effect:${i}`,
            text,
          })),
        );
      } else entryItem.details.push('Sabotage check · awaiting roll');
      items.push(entryItem);
    }
  });
  return items;
}

function persistentItems(persistent: PersistentView): Item[] {
  return persistent.events.map((event) => {
    const entry = item(eventSubject(event.eventId), event.name, [
      event.eventId,
      eventSubject(event.eventId),
    ]);
    if (event.targetNames.length)
      entry.details.push(`Affects ${event.targetNames.join(', ')}`);
    entry.details.push(
      event.decision
        ? `Decision: ${words(event.decision.kind)}`
        : 'Carries on unless the table decides otherwise',
    );
    for (const check of event.checks)
      entry.details.push(
        check.total === null
          ? `${words(check.checkId.split(':').at(-1) ?? 'event')} check bonus ${signed(check.modifier)} · awaiting roll`
          : `${words(check.checkId.split(':').at(-1) ?? 'event')} check ${check.total} (bonus ${signed(check.modifier)})`,
      );
    return entry;
  });
}

/** Order plan lines into the skeleton; unknown subjects keep plan order. */
function applyPlan(
  phase: ReviewPhase,
  skeleton: Item[],
  plan: readonly PlanChange[],
  names: ReviewNames,
  place: (item: Item, ack: Ack) => void,
) {
  const leading: Item[] = [];
  const trailing: Item[] = [];
  let seenSkeleton = false;
  const byKey = new Map(skeleton.map((entry) => [entry.key, entry]));
  plan.forEach((change, index) => {
    const described = describeChange(phase, change, names);
    let target = byKey.get(described.subject);
    if (target) seenSkeleton = true;
    else {
      target = item(described.subject, described.title, [
        described.subject,
        described.subject.replace(/^[a-z]+:/, ''),
      ]);
      byKey.set(described.subject, target);
      (seenSkeleton || skeleton.length === 0 ? trailing : leading).push(target);
    }
    if (described.effect)
      target.effects.push({
        key: `${described.subject}:effect:${index}`,
        text: described.effect,
      });
    if (described.detail) target.details.push(described.detail);
    if (described.acknowledgement) place(target, described.acknowledgement);
  });
  return [...leading, ...skeleton, ...trailing];
}

export function liveWeekReview({
  draft,
  source,
  preview,
  upkeep,
  activity,
  event,
  persistent,
  summary,
  message,
}: {
  draft: WeeklyDraft;
  source: WorkspaceSource;
  preview: CanonicalResolutionPreview;
  upkeep: UpkeepView;
  activity: ActivityView;
  event: EventView;
  persistent: PersistentView;
  summary: Pick<
    Summary,
    'options' | 'exceptions' | 'acknowledgements' | 'warnings'
  >;
  message: (code: string, warning: boolean) => string;
}): WeekReviewFacts {
  const names = liveNames(source, preview, summary);
  const phases = preview.phases;
  const placed = new Set<string>();
  const place = (target: Item, ack: Ack) => {
    if (placed.has(ack.acknowledgementId) || !ack.outcome.trim()) return;
    placed.add(ack.acknowledgementId);
    target.notes.push({
      kind: 'outcome',
      key: `outcome:${ack.acknowledgementId}`,
      text: ack.outcome,
    });
  };
  const skeletons: Record<ReviewPhase, Item[]> = {
    upkeep: upkeepItems(upkeep, source),
    activity: activityItems(
      activity,
      phases?.activity.actionResults ?? [],
      names,
    ),
    event: eventItems(event, phases?.event.sabotage ?? []),
    persistent: persistentItems(persistent),
  };
  const items: Record<ReviewPhase, Item[]> = {
    upkeep: applyPlan(
      'upkeep',
      skeletons.upkeep,
      phases?.upkeep.plan ?? [],
      names,
      place,
    ),
    activity: applyPlan(
      'activity',
      skeletons.activity,
      phases?.activity.plan ?? [],
      names,
      place,
    ),
    event: applyPlan(
      'event',
      skeletons.event,
      phases?.event.plan ?? [],
      names,
      place,
    ),
    persistent: applyPlan(
      'persistent',
      skeletons.persistent,
      phases?.persistent.plan ?? [],
      names,
      place,
    ),
  };
  const all = () => Object.values(items).flat();
  const byKey = (key: string) => all().find((entry) => entry.key === key);

  // Outcomes recorded on the item itself, then shared acknowledgements by subject.
  for (const fact of phases?.event.sabotage ?? []) {
    const target = byKey(sabotageSubject(fact));
    if (target && fact.acknowledgement) place(target, fact.acknowledgement);
  }
  for (const slot of draft.activity.slots) {
    const target = slot.choice && byKey(choiceSubject(slot.choice.choiceId));
    if (target)
      for (const ack of slot.choice?.acknowledgements ?? []) place(target, ack);
  }
  for (const occurrence of event.occurrences.map((entry) => entry.occurrence)) {
    const target = byKey(eventSubject(occurrence.eventId));
    const decision = occurrence.persistentDecision;
    if (target && decision?.kind === 'end')
      place(target, decision.acknowledgement);
    const reactive = occurrence.sabotage;
    const saboteur =
      reactive &&
      byKey(
        sabotageSubject({
          eventId: occurrence.eventId,
          choiceId: reactive.choiceId,
        }),
      );
    if (saboteur)
      for (const ack of reactive.acknowledgements ?? []) place(saboteur, ack);
  }
  for (const decision of draft.persistent.decisions) {
    const target = items.persistent.find(
      (entry) => entry.key === eventSubject(decision.eventId),
    );
    if (target && decision.kind === 'end')
      place(target, decision.acknowledgement);
  }
  const unassociated: ReviewNote[] = [];
  for (const ack of summary.acknowledgements) {
    if (placed.has(ack.acknowledgementId)) continue;
    const owner = findOwner(ack.subjectId, all());
    if (owner) place(owner, ack);
    else if (ack.outcome.trim()) {
      placed.add(ack.acknowledgementId);
      unassociated.push({
        kind: 'outcome',
        key: `outcome:${ack.acknowledgementId}`,
        text: `${ack.name}: ${ack.outcome}`,
      });
    }
  }

  // A fact whose item is gone stays at the end of its known phase.
  const phaseCodes = (phase: ReviewPhase) =>
    phases ? [...phases[phase].requirements, ...phases[phase].warnings] : [];
  const knownPhase = (subjectOrCode: string, ruleId?: string) =>
    (['upkeep', 'activity', 'event', 'persistent'] as const).find((phase) =>
      phaseCodes(phase).some(
        (code) =>
          code === subjectOrCode || code.startsWith(`${subjectOrCode}:`),
      ),
    ) ??
    (ruleId?.startsWith('upkeep-')
      ? 'upkeep'
      : ruleId === 'action-capacity'
        ? 'activity'
        : null);
  for (const exception of summary.exceptions) {
    const note: ReviewNote = {
      kind: 'exception',
      key: `exception:${exception.exceptionId}`,
      exceptionId: exception.exceptionId,
      subjectId: exception.subjectId,
      ruleId: exception.ruleId,
      // Plain module: this adapter also runs in the non-React acceptance bundle.
      rule: activityLabel(exception.ruleId.replaceAll('-', '_')),
      reason: exception.reason,
      obsolete: exception.ruleId === 'action-capacity',
    };
    const owner = findOwner(exception.subjectId, all());
    if (owner) {
      owner.notes.push(note);
      continue;
    }
    const phase = knownPhase(exception.subjectId, exception.ruleId);
    if (!phase) {
      unassociated.push(note);
      continue;
    }
    const orphan = item(`missing:${exception.exceptionId}`, exception.name);
    orphan.missing = true;
    orphan.notes.push(note);
    items[phase].push(orphan);
  }
  const adjustmentWarnings = new Map<string, ReviewNote[]>();
  const phaseWarnings: Record<ReviewPhase, Item | null> = {
    upkeep: null,
    activity: null,
    event: null,
    persistent: null,
  };
  for (const code of summary.warnings) {
    const note: ReviewNote = {
      kind: 'warning',
      key: `warning:${code}`,
      message: message(code, true),
    };
    const adjustment = draft.tableAdjustments.find((entry) =>
      code.startsWith(`adjustment:${entry.adjustmentId}:`),
    );
    if (adjustment) {
      // Each adjustment's reason is echoed as a warning; the numbered
      // adjustment already shows it, so only other adjustment facts attach.
      if (code !== `adjustment:${adjustment.adjustmentId}:${adjustment.reason}`)
        adjustmentWarnings.set(adjustment.adjustmentId, [
          ...(adjustmentWarnings.get(adjustment.adjustmentId) ?? []),
          note,
        ]);
      continue;
    }
    const owner = findOwner(code, all());
    if (owner) {
      owner.notes.push(note);
      continue;
    }
    const phase = knownPhase(code);
    if (!phase) {
      unassociated.push(note);
      continue;
    }
    const general = (phaseWarnings[phase] ??= item(
      `general:${phase}`,
      `Other ${titles[phase]} warnings`,
    ));
    general.notes.push(note);
  }
  for (const phase of Object.keys(phaseWarnings) as ReviewPhase[]) {
    const general = phaseWarnings[phase];
    if (general) items[phase].push(general);
  }
  for (const code of preview.requirements)
    for (const adjustment of draft.tableAdjustments)
      if (code.startsWith(`adjustment:${adjustment.adjustmentId}:`))
        adjustmentWarnings.set(adjustment.adjustmentId, [
          ...(adjustmentWarnings.get(adjustment.adjustmentId) ?? []),
          {
            kind: 'warning',
            key: `requirement:${code}`,
            message: message(code, false),
          },
        ]);

  const readiness: Record<ReviewPhase, boolean> = {
    upkeep: upkeep.ready,
    activity: activity.ready,
    event: event.ready,
    persistent: persistent.ready,
  };
  const empty: Record<ReviewPhase, string> = {
    upkeep: 'No Upkeep consequences this week.',
    activity: 'No actions were chosen this Activity.',
    event: 'No event consequences this week.',
    persistent: 'No persistent event consequences this week.',
  };
  const section = (
    phase: ReviewPhase,
    number: 1 | 2 | 3 | 4,
  ): ReviewSection => {
    const list = items[phase].map(({ subjects: _subjects, ...rest }) => rest);
    const notApplicable =
      phase === 'upkeep'
        ? upkeep.skipped
          ? 'Upkeep is skipped in the militia’s first week.'
          : null
        : phase === 'persistent' && !draft.context.persistentPhaseEligible
          ? 'No persistent events carried into this week.'
          : null;
    const base = {
      phase,
      number,
      title: titles[phase],
      chips: phases
        ? phaseChips(
            phase,
            phases[phase].plan as readonly PlanChange[],
            phase === 'event' ? phases.event.sabotage : [],
          )
        : [],
      items: list,
    };
    if (!phases)
      return {
        ...base,
        status: 'incomplete',
        statusText:
          'Consequences are not available until the week’s entries are valid.',
      };
    if (notApplicable && list.length === 0)
      return { ...base, status: 'not-applicable', statusText: notApplicable };
    if (!readiness[phase])
      return {
        ...base,
        status: 'incomplete',
        statusText:
          'Some decisions in this phase are still open, so these consequences are partial.',
      };
    if (list.length === 0)
      return { ...base, status: 'empty', statusText: empty[phase] };
    return { ...base, status: 'complete', statusText: null };
  };

  const baseline = preview.baselinePlan?.after ?? null;
  const final = preview.finalPlan?.after ?? null;
  return {
    mode: 'live',
    sections: [
      section('upkeep', 1),
      section('activity', 2),
      section('event', 3),
      section('persistent', 4),
    ],
    unassociated,
    adjustments: draft.tableAdjustments.map((adjustment, index) => ({
      key: `adjustment:${adjustment.adjustmentId}`,
      adjustmentId: adjustment.adjustmentId,
      number: index + 1,
      ...describeAdjustment(adjustment, names),
      reason: adjustment.reason,
      notes: adjustmentWarnings.get(adjustment.adjustmentId) ?? [],
    })),
    result: {
      nextWeek: final?.week ?? draft.week + 1,
      complete: baseline !== null && final !== null,
      rows: compareWeekStates({
        now: {
          week: draft.week,
          militiaSnapshot: source.snapshot,
          context: draft.context,
        },
        baseline,
        final,
        names,
      }),
    },
  };
}
