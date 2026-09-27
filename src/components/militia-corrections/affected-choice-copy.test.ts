import { expect, test } from 'vitest';
import { acceptedCampaignSetup } from '../../../tests/rules/accepted-campaign';
import type { StagedReference } from '~/lib/correction-staged-choices';
import { noCapturedFacts, rememberFacts } from '~/lib/reference-restoration';
import {
  carriedDependencyError,
  describeChoice,
  heldItemError,
  identityNames,
  neededByNote,
  restoreFirstNote,
  restoreLabel,
  type IdentityNames,
} from './affected-choice-copy';

const names: IdentityNames = (kind, id) =>
  ({ scouts: 'Scouts', guards: 'Guards' })[id] ?? null;

const slot = (missing: StagedReference['missing']): StagedReference => ({
  key: 'activitySlot:two',
  phase: 'activity',
  location: {
    kind: 'activitySlot',
    slotId: 'two',
    position: 2,
    actionId: 'dismiss_team',
  },
  missing,
});

test('a choice is named by its slot, action and what it would lose, never by identity', () => {
  expect(
    describeChoice(
      slot([
        { kind: 'team', id: 'scouts' },
        { kind: 'team', id: 'guards' },
        { kind: 'event', id: 'e-1' },
      ]),
      'campaign',
      names,
    ),
  ).toEqual({
    key: 'activitySlot:two',
    label: 'Activity slot 2',
    action: 'Dismiss Team',
    detail: 'Dismiss Team · uses Scouts, Guards and a missing event',
    before: 'Removing Scouts, Guards and a missing event leaves',
    after: '(Dismiss Team) without 2 teams and an event.',
    href: '/campaigns/campaign/week?phase=activity',
  });
});

test('restoring names the identity when known, else the choice that needs it', () => {
  const unknown = slot([{ kind: 'team', id: 'lost' }]);
  expect(restoreLabel({ kind: 'team', id: 'scouts' }, [], names)).toBe(
    'Restore Scouts',
  );
  expect(restoreLabel({ kind: 'team', id: 'lost' }, [unknown], names)).toBe(
    'Restore missing team for Activity slot 2',
  );
});

test('carried context names what must stay', () => {
  expect(
    carriedDependencyError(
      {
        key: 'queuedEffect:q',
        phase: null,
        location: { kind: 'queuedEffect', effectId: 'q' },
        missing: [{ kind: 'team', id: 'scouts' }],
      },
      names,
    ),
  ).toBe('Keep Scouts: a queued effect still needs it.');
});

// Items and caches (#177).
function economyState() {
  const { state } = acceptedCampaignSetup('officer');
  const snapshot = structuredClone(state.militiaSnapshot);
  snapshot.economy!.items.push({
    itemId: 'ring',
    name: 'Ring',
    valueCopper: 500,
    weight: 0.1,
    location: 'cache',
  });
  snapshot.economy!.caches[0]!.itemIds = ['ring'];
  return snapshot;
}

test('items and caches are named from the militia, then from facts this device saw', () => {
  const snapshot = economyState();
  const seen = rememberFacts(noCapturedFacts, snapshot);
  const removed = {
    ...snapshot,
    economy: { ...snapshot.economy!, items: [], caches: [] },
  };
  for (const names of [
    identityNames(snapshot, noCapturedFacts, new Map()),
    identityNames(removed, seen, new Map()),
  ]) {
    expect(names('item', 'ring')).toBe('Ring');
    expect(names('cache', 'forest-cache')).toBe('Cache at Forest');
  }
  expect(
    identityNames(removed, noCapturedFacts, new Map())('item', 'ring'),
  ).toBeNull();
});

test('a cache whose contents are missing names the items to restore first', () => {
  const names: IdentityNames = (kind, id) =>
    ({ ring: 'Ring', gem: 'Gem' })[id] ?? null;
  expect(restoreFirstNote([{ kind: 'item', id: 'ring' }], names)).toBe(
    'Restore Ring in Items first.',
  );
  expect(
    restoreFirstNote(
      [
        { kind: 'item', id: 'ring' },
        { kind: 'item', id: 'gem' },
      ],
      names,
    ),
  ).toBe('Restore Ring and Gem in Items first.');
  expect(neededByNote(['Activity slot 2', 'Cache at Old Mill'])).toBe(
    'Needed by Activity slot 2 and Cache at Old Mill',
  );
});

test('removing an item a cache or order holds names the item and what holds it', () => {
  const snapshot = economyState();
  const names = identityNames(snapshot, noCapturedFacts, new Map());
  expect(
    heldItemError(
      'state.militiaSnapshot.economy.caches.0.itemIds.0',
      snapshot,
      names,
    ),
  ).toBe('Keep Ring: Cache at Forest holds it.');
  expect(
    heldItemError(
      'state.militiaSnapshot.economy.orders.0.itemId',
      snapshot,
      names,
    ),
  ).toBe('Keep Sword: an order from Town still needs it.');
  expect(
    heldItemError(
      'state.militiaSnapshot.economy.orders.0.settlementId',
      snapshot,
      names,
    ),
  ).toBeNull();
});
