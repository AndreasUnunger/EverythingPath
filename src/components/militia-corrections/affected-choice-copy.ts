import { activityLabel } from '~/components/weekly-draft-workspace/activity-labels';
import { eventName } from '~/components/weekly-draft-workspace/event-tree-facts';
import { weekPath } from '~/lib/campaign-routes';
import type { CanonicalWeekState } from '~/lib/canonical-weekly-source';
import type {
  ChoiceLocation,
  MissingReference,
  StagedReference,
} from '~/lib/correction-staged-choices';
import { MILITIA_SECTIONS } from '~/lib/militia-correction-sections';
import {
  restoringSection,
  type CapturedFacts,
} from '~/lib/reference-restoration';
import type { ReferenceKind } from '~/lib/weekly-draft-references';
import type { SetupErrorDescriptor } from '~/lib/setup-validation';

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
          captured.item.get(id)?.name ??
          null
        );
      case 'cache': {
        const cache =
          snapshot.economy?.caches.find((entry) => entry.cacheId === id) ??
          captured.cache.get(id);
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

/** "Needed by Activity slot 2 and Cache at Old Mill", from their labels. */
export function neededByNote(labels: readonly string[]) {
  return `Needed by ${listed([...labels])}`;
}

/**
 * "Restore Ring in Items first.": what a restoration needs restored before
 * it, in the section that restores it.
 */
export function restoreFirstNote(
  requires: readonly MissingReference[],
  names: IdentityNames,
) {
  const sections = [
    ...new Set(
      requires.flatMap(({ kind }) => {
        const section = restoringSection(kind);
        return section ? [MILITIA_SECTIONS[section]] : [];
      }),
    ),
  ];
  const subjects = listed(requires.map((item) => missingName(item, names)));
  return `Restore ${subjects} in ${listed(sections)} first.`;
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

/**
 * What needs a missing identity: a staged choice, linked to the phase that
 * repairs it, or another restoration (a cache holding a missing item).
 */
export type NeededBy = Pick<
  AffectedChoice,
  'key' | 'label' | 'action' | 'href'
>;

/** "Cache at Old Mill": a restoration that needs a missing identity first. */
export function restorationNeed(
  reference: MissingReference,
  names: IdentityNames,
): NeededBy {
  return {
    key: `${reference.kind}:${reference.id}`,
    label: missingTitle(reference, names),
    action: null,
    href: null,
  };
}

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

const heldItemPath =
  /^state\.militiaSnapshot\.economy\.(caches|orders)\.(\d+)\.(itemIds\.(\d+)|itemId)$/;

type HeldItem = { itemId: string; holder: string; orderId: string | null };

// The item a cache holds or an order is for at a form field path, and a
// phrase naming what holds it; null for any other field.
function heldItemAt(
  field: string,
  snapshot: Snapshot,
  names: IdentityNames,
): HeldItem | null {
  const match = heldItemPath.exec(field);
  if (!match) return null;
  const [, list, row, , content] = match;
  if (list === 'caches') {
    const cache = snapshot.economy?.caches[Number(row)];
    const itemId = cache?.itemIds[Number(content)];
    if (!cache || itemId === undefined) return null;
    return { itemId, holder: `Cache at ${cache.location}`, orderId: null };
  }
  const order = snapshot.economy?.orders[Number(row)];
  if (!order || content !== undefined) return null;
  const town = knownName({ kind: 'settlement', id: order.settlementId }, names);
  return {
    itemId: order.itemId,
    holder: `an order${town ? ` from ${town}` : ''}`,
    orderId: order.orderId,
  };
}

const capitalized = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Names the integrity errors for items a cache holds or an order is for
 * that the militia lacks, in place of the general reference error: "Keep
 * Ring: Cache at Old Mill holds it." when this correction removes the item
 * (`removing`), else "Cache at Old Mill holds Ring, which is no longer in
 * the militia." Orders carried into the week (`carriedOrders`) are named as
 * carried context instead. `snapshot` holds the rows the fields locate.
 */
export function namedItemReferences(
  descriptors: readonly SetupErrorDescriptor[],
  snapshot: Snapshot,
  {
    removing,
    carriedOrders,
    names,
  }: {
    removing: boolean;
    carriedOrders: ReadonlySet<string>;
    names: IdentityNames;
  },
): SetupErrorDescriptor[] {
  return descriptors.flatMap((descriptor) => {
    const held = descriptor.field
      ? heldItemAt(descriptor.field, snapshot, names)
      : null;
    if (!held) return [descriptor];
    if (held.orderId !== null && carriedOrders.has(held.orderId)) return [];
    const item = missingName({ kind: 'item', id: held.itemId }, names);
    if (removing)
      return [
        {
          message: `Keep ${item}: ${held.holder} ${held.orderId === null ? 'holds it' : 'still needs it'}.`,
          kind: 'refinement' as const,
        },
      ];
    const has = held.orderId === null ? 'holds' : 'is for';
    return [
      {
        ...descriptor,
        message: `${capitalized(held.holder)} ${has} ${item}, which is no longer in the militia.`,
      },
    ];
  });
}
