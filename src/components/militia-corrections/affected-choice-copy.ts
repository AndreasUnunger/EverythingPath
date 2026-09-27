import { activityLabel } from '~/components/weekly-draft-workspace/activity-labels';
import { eventName } from '~/components/weekly-draft-workspace/event-tree-facts';
import { weekPath } from '~/lib/campaign-routes';
import type { CanonicalWeekState } from '~/lib/canonical-weekly-source';
import type {
  ChoiceLocation,
  MissingReference,
  StagedReference,
} from '~/lib/correction-staged-choices';
import type { CapturedFacts } from '~/lib/reference-restoration';
import type { ReferenceKind } from '~/lib/weekly-draft-references';

// User-facing names for the open week's choices a correction affects and the
// identities they use. Opaque identities are never shown: an identity with
// no known name is described by its kind.

type Snapshot = CanonicalWeekState['militiaSnapshot'];

/** A name for an identity, or null when this device does not know one. */
export type IdentityNames = (kind: ReferenceKind, id: string) => string | null;

/**
 * Names from the accepted militia, then from facts this device saw before a
 * correction removed them, then character records.
 */
export function identityNames(
  snapshot: Snapshot,
  captured: CapturedFacts,
  characters: ReadonlyMap<string, string>,
): IdentityNames {
  return (kind, id) => {
    switch (kind) {
      case 'team':
        return (
          snapshot.roster.teams.find((team) => team.teamId === id)?.name ??
          captured.team.get(id)?.name ??
          null
        );
      case 'settlement':
        return (
          snapshot.settlements.find((town) => town.settlementId === id)?.name ??
          captured.settlement.get(id)?.name ??
          null
        );
      case 'item':
        return (
          snapshot.economy?.items.find((item) => item.itemId === id)?.name ??
          null
        );
      case 'cache': {
        const cache = snapshot.economy?.caches.find(
          (entry) => entry.cacheId === id,
        );
        return cache ? `Cache at ${cache.location}` : null;
      }
      case 'character':
        return characters.get(id) ?? null;
      default:
        return null;
    }
  };
}

// One and several of each kind, with the article for one.
const kindWords: Record<
  ReferenceKind,
  { one: string; article: 'a' | 'an'; many: string }
> = {
  team: { one: 'team', article: 'a', many: 'teams' },
  settlement: { one: 'settlement', article: 'a', many: 'settlements' },
  character: { one: 'character', article: 'a', many: 'characters' },
  item: { one: 'item', article: 'an', many: 'items' },
  cache: { one: 'cache', article: 'a', many: 'caches' },
  event: { one: 'event', article: 'an', many: 'events' },
  bonus: { one: 'one-use bonus', article: 'a', many: 'one-use bonuses' },
};

/** The identity's name, or null when this device does not know one. */
function knownName({ kind, id }: MissingReference, names: IdentityNames) {
  const name = names(kind, id)?.trim();
  return name !== undefined && name.length > 0 ? name : null;
}

/** "Scouts", or "a missing team" when no name is known. */
export function missingName(reference: MissingReference, names: IdentityNames) {
  return (
    knownName(reference, names) ?? `a missing ${kindWords[reference.kind].one}`
  );
}

/** "Scouts" or "A missing team", as the title of a missing identity. */
export function missingTitle(
  reference: MissingReference,
  names: IdentityNames,
) {
  const name = missingName(reference, names);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** "Restore Scouts", or "Restore missing team for Activity slot 2". */
export function restoreLabel(
  reference: MissingReference,
  neededBy: readonly StagedReference[],
  names: IdentityNames,
) {
  const name = knownName(reference, names);
  if (name) return `Restore ${name}`;
  const [first] = neededBy;
  const missing = `Restore missing ${kindWords[reference.kind].one}`;
  return first ? `${missing} for ${choiceLabel(first.location)}` : missing;
}

/** "Needed by Activity slot 2 and Upkeep team decision". */
export function neededByNote(neededBy: readonly StagedReference[]) {
  return `Needed by ${listed(neededBy.map((reference) => choiceLabel(reference.location)))}`;
}

/** "A", "A and B", "A, B and C". */
export const listed = (names: string[]) =>
  names.length <= 2
    ? names.join(' and ')
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

const event = (type: string | null) => eventName(type) ?? 'Unrolled event';

/** The choice, as its phase names it: "Activity slot 2", "Upkeep decision". */
export function choiceLabel(location: ChoiceLocation): string {
  switch (location.kind) {
    case 'upkeepTeam':
      return 'Upkeep team decision';
    case 'nearestSettlement':
      return 'Upkeep nearest settlement';
    case 'activitySlot':
      return `Activity slot ${location.position}`;
    case 'operatingSettlement':
      return 'Activity operating settlement';
    case 'consumables':
      return 'Activity one-use bonuses';
    case 'event':
      return `Event · ${event(location.eventType)}`;
    case 'persistentDecision':
      return `Persistent decision · ${event(location.eventType)}`;
    case 'tableAdjustment':
      return 'Table Adjustment in Review & confirm';
    case 'carriedEvent':
      return `Carried ${event(location.eventType)} event`;
    case 'queuedEffect':
      return 'A queued effect';
    case 'order':
      return 'A carried order';
    case 'operatedSettlements':
      return 'Settlements operated this week';
  }
}

export type AffectedChoice = {
  key: string;
  /** "Activity slot 2": the linked part. */
  label: string;
  /** "Drill Militia" for an Activity slot. */
  action: string | null;
  /** "Drill Militia · uses Scouts", after the label in lists of choices. */
  detail: string;
  /**
   * The open-week warning around the label: "Removing Scouts leaves",
   * label, "(Drill Militia) without a team."
   */
  before: string;
  after: string;
  /** The phase that repairs it; null for read-only carried context. */
  href: string | null;
};

// "a team", "2 teams", "a team and an item".
function without(missing: readonly MissingReference[]) {
  const counts = new Map<ReferenceKind, number>();
  for (const { kind } of missing) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  return listed(
    [...counts].map(([kind, count]) => {
      const word = kindWords[kind];
      return count === 1
        ? `${word.article} ${word.one}`
        : `${count} ${word.many}`;
    }),
  );
}

export function describeChoice(
  reference: StagedReference,
  campaignId: string,
  names: IdentityNames,
): AffectedChoice {
  const { location, missing } = reference;
  const subjects = listed(missing.map((item) => missingName(item, names)));
  const action =
    location.kind === 'activitySlot' ? activityLabel(location.actionId) : null;
  return {
    key: reference.key,
    label: choiceLabel(location),
    action,
    detail: action ? `${action} · uses ${subjects}` : `uses ${subjects}`,
    before: `Removing ${subjects} leaves`,
    after: `${action ? `(${action}) ` : ''}without ${without(missing)}.`,
    href: reference.phase ? weekPath(campaignId, reference.phase) : null,
  };
}

/**
 * The integrity error for carried context a correction would break: it
 * names what must stay and what needs it.
 */
export function carriedDependencyError(
  reference: StagedReference,
  names: IdentityNames,
) {
  const kept = listed(
    reference.missing.map((item) => missingName(item, names)),
  );
  return `Keep ${kept}: ${carriedPhrase(reference.location)} still needs ${reference.missing.length === 1 ? 'it' : 'them'}.`;
}

function carriedPhrase(location: ChoiceLocation) {
  switch (location.kind) {
    case 'carriedEvent':
      return `the carried ${event(location.eventType)} event`;
    case 'queuedEffect':
      return 'a queued effect';
    case 'order':
      return 'a carried order';
    case 'operatedSettlements':
      return 'the settlements operated this week';
    default:
      return choiceLabel(location);
  }
}
