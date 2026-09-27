import { actionChoiceEvents } from './weekly-draft-facts';
import type { WeeklyDraft, WeeklyDraftEdit } from './weekly-draft-contract';

// The Overseer supports the organization checks of one chosen event a week
// (militia-rules.md, "Overseer"). The choice is shared by Event and
// Persistent and lives in the records that already own it: an occurrence's
// own `overseerCharacterId` (older editors also recorded it on a target
// check, a Sabotage reaction or a same-week persistent decision), or a
// carried event's Persistent mitigation decision. Nothing here is a new
// field or endpoint; moving support is a sequence of ordinary edits.

type Occurrence = WeeklyDraft['event']['occurrences'][number];
type Decision = WeeklyDraft['persistent']['decisions'][number];

/** The draft records that can hold Overseer support. */
export type OverseerSupportSource = {
  // The event tree and every Activity candidate, in draft order.
  occurrences: Occurrence[];
  // Carried events' Persistent decisions.
  decisions: Decision[];
};

export function overseerSupportSource(
  draft: Pick<WeeklyDraft, 'event' | 'activity' | 'persistent'>,
): OverseerSupportSource {
  return {
    occurrences: [
      ...draft.event.occurrences,
      ...draft.activity.slots.flatMap((slot) =>
        actionChoiceEvents(slot.choice),
      ),
    ],
    decisions: [...draft.persistent.decisions],
  };
}

/** Where one event records support; several places read as one event. */
export type OverseerSupportLocation =
  | 'occurrence'
  | 'target'
  | 'reaction'
  | 'same-week-decision'
  | 'carried-decision';

export type OverseerSupportHolder = {
  eventId: string;
  kind: 'occurrence' | 'carried';
  locations: OverseerSupportLocation[];
  characterIds: string[];
};

function occurrenceSelections(event: Occurrence) {
  const found: [OverseerSupportLocation, string | undefined][] = [
    ['occurrence', event.overseerCharacterId],
    ['reaction', event.sabotage?.overseerCharacterId],
    [
      'same-week-decision',
      event.persistentDecision?.kind === 'mitigate'
        ? event.persistentDecision.overseerCharacterId
        : undefined,
    ],
    ...(event.targetChecks ?? []).map(
      (target) =>
        ['target', target.overseerCharacterId] as [
          OverseerSupportLocation,
          string | undefined,
        ],
    ),
  ];
  return found.filter((entry): entry is [OverseerSupportLocation, string] =>
    Boolean(entry[1]),
  );
}

/**
 * Every event that records Overseer support, one entry per event identity
 * however many of its records hold it. More than one entry is a conflict
 * the rules resolve by giving support to the first event only.
 */
export function overseerSupportHolders(
  source: OverseerSupportSource,
): OverseerSupportHolder[] {
  const holders: OverseerSupportHolder[] = [];
  for (const event of source.occurrences) {
    const found = occurrenceSelections(event);
    if (found.length)
      holders.push({
        eventId: event.eventId,
        kind: 'occurrence',
        locations: [...new Set(found.map(([location]) => location))],
        characterIds: [...new Set(found.map(([, id]) => id))],
      });
  }
  for (const decision of source.decisions)
    if (decision.kind === 'mitigate' && decision.overseerCharacterId)
      holders.push({
        eventId: decision.eventId,
        kind: 'carried',
        locations: ['carried-decision'],
        characterIds: [decision.overseerCharacterId],
      });
  return holders;
}

function withoutSupport(event: Occurrence): Occurrence {
  const { overseerCharacterId: _own, ...next } = structuredClone(event);
  if (next.sabotage) delete next.sabotage.overseerCharacterId;
  if (next.persistentDecision?.kind === 'mitigate')
    delete next.persistentDecision.overseerCharacterId;
  if (next.targetChecks) {
    // A target check left naming only its target carries nothing.
    const targetChecks = next.targetChecks.flatMap((entry) => {
      const { overseerCharacterId: _target, ...rest } = entry;
      return Object.keys(rest).length > 1 ? [rest] : [];
    });
    if (targetChecks.length) next.targetChecks = targetChecks;
    else delete next.targetChecks;
  }
  return next;
}

/** Whether this event has a record that can hold support now. */
export function canHoldOverseerSupport(
  source: OverseerSupportSource,
  eventId: string,
) {
  return (
    source.occurrences.some((event) => event.eventId === eventId) ||
    source.decisions.some(
      (decision) =>
        decision.eventId === eventId && decision.kind === 'mitigate',
    )
  );
}

/**
 * The one ordinary edit removing every support selection recorded for this
 * event, keeping everything else in its record; null when it has none.
 */
export function clearOverseerSupportEdit(
  source: OverseerSupportSource,
  eventId: string,
): WeeklyDraftEdit | null {
  const event = source.occurrences.find((entry) => entry.eventId === eventId);
  if (event)
    return occurrenceSelections(event).length
      ? { kind: 'event_occurrence', occurrence: withoutSupport(event) }
      : null;
  const decision = source.decisions.find((entry) => entry.eventId === eventId);
  if (decision?.kind !== 'mitigate' || !decision.overseerCharacterId)
    return null;
  const { overseerCharacterId: _previous, ...rest } = decision;
  return { kind: 'persistent_decision', decision: rest };
}

/**
 * The one ordinary edit recording support on this event, in the record that
 * owns it: an occurrence's own selection (older nested copies on that same
 * occurrence fold into it) or a carried event's mitigation decision.
 * 'already' when nothing needs to change; 'unavailable' when the event has
 * no record able to hold it.
 */
export function assignOverseerSupportEdit(
  source: OverseerSupportSource,
  eventId: string,
  characterId: string,
): WeeklyDraftEdit | 'already' | 'unavailable' {
  const event = source.occurrences.find((entry) => entry.eventId === eventId);
  if (event) {
    const found = occurrenceSelections(event);
    const [only] = found;
    if (
      found.length === 1 &&
      only?.[0] === 'occurrence' &&
      only[1] === characterId
    )
      return 'already';
    return {
      kind: 'event_occurrence',
      occurrence: {
        ...withoutSupport(event),
        overseerCharacterId: characterId,
      },
    };
  }
  const decision = source.decisions.find((entry) => entry.eventId === eventId);
  if (decision?.kind !== 'mitigate') return 'unavailable';
  if (decision.overseerCharacterId === characterId) return 'already';
  return {
    kind: 'persistent_decision',
    decision: {
      ...structuredClone(decision),
      overseerCharacterId: characterId,
    },
  };
}

export type OverseerSupportSend = (
  edit: WeeklyDraftEdit,
) => Promise<'accepted' | 'failed'>;

export type OverseerSupportMoveResult =
  | { status: 'done'; cleared: string[] }
  // A clear was refused: support may still be on `eventId`.
  | { status: 'failed'; stage: 'clear'; eventId: string; cleared: string[] }
  // Every other selection is gone but support could not be recorded on
  // `eventId` (null when the move was removing it everywhere).
  | {
      status: 'failed';
      stage: 'assign';
      eventId: string | null;
      cleared: string[];
    };

/**
 * Moves Overseer support to one event (or removes it everywhere when `to` is
 * null) through ordered ordinary edits: first every other event's selection
 * is cleared, one edit at a time, then support is recorded on `to`. This is
 * not atomic. Each step is planned from `latest()`, the newest accepted and
 * pending draft, so a selection another device added meanwhile is cleared
 * too and an edit never replays facts captured before an earlier await. The
 * first refused edit stops the move and says where it stopped; the draft
 * then holds support on at most the events it already did, never on two
 * events because of this move, and running the move again resumes it.
 */
export async function moveOverseerSupport({
  to,
  characterId,
  latest,
  send,
}: {
  to: string | null;
  characterId: string;
  latest: () => OverseerSupportSource | null;
  send: OverseerSupportSend;
}): Promise<OverseerSupportMoveResult> {
  const cleared: string[] = [];
  const start = latest();
  if (!start)
    return { status: 'failed', stage: 'assign', eventId: to, cleared };
  // Bounded: every holder seen at the start plus a few a peer adds meanwhile.
  let budget = overseerSupportHolders(start).length + 3;
  for (;;) {
    const source = latest();
    if (!source)
      return { status: 'failed', stage: 'assign', eventId: to, cleared };
    const other = overseerSupportHolders(source).find(
      (holder) => holder.eventId !== to,
    );
    if (!other) break;
    const edit = clearOverseerSupportEdit(source, other.eventId);
    if (budget-- <= 0 || !edit || (await send(edit)) !== 'accepted')
      return {
        status: 'failed',
        stage: 'clear',
        eventId: other.eventId,
        cleared,
      };
    cleared.push(other.eventId);
  }
  if (to === null) return { status: 'done', cleared };
  const source = latest();
  const edit = source
    ? assignOverseerSupportEdit(source, to, characterId)
    : 'unavailable';
  if (edit === 'already') return { status: 'done', cleared };
  if (edit === 'unavailable' || (await send(edit)) !== 'accepted')
    return { status: 'failed', stage: 'assign', eventId: to, cleared };
  return { status: 'done', cleared };
}

type Mitigation = Extract<Decision, { kind: 'mitigate' }>;
/**
 * A carried event's mitigation decision as its check form edits it: the
 * support selection belongs to the shared toggle, not the form.
 */
export function withoutOverseerSupport(decision: Mitigation) {
  const { overseerCharacterId: _support, ...rest } = decision;
  return rest;
}
/** A saved check form keeps whatever support the decision records now. */
export function keepOverseerSupport(
  next: Decision,
  current: Decision | null,
): Decision {
  return next.kind === 'mitigate' &&
    current?.kind === 'mitigate' &&
    current.overseerCharacterId
    ? { ...next, overseerCharacterId: current.overseerCharacterId }
    : next;
}
