import { expect, test } from 'vitest';
import type { StagedReference } from '~/lib/correction-staged-choices';
import {
  carriedDependencyError,
  describeChoice,
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
