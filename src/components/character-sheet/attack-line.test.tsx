import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { defaultAbilityScores } from '~/lib/character-sheet';
import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import {
  buildSheet,
  emptyOwnerCandidates,
  representativeWeapon,
  type AttackRoutineFixture,
} from './character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';

// One routine's attack lines (#314): separate single and full attacks, each
// number a breakdown of its own resolver statistic.

let snapshot: CharacterSheetSnapshot | undefined;
const maintenance = vi.fn<() => MigrationMaintenance>();

vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => maintenance(),
}));
vi.mock('@convex/_generated/api', async () => {
  const { createCharacterSheetApiMock } =
    await import('./character-sheet-api-test-fixture');
  return createCharacterSheetApiMock();
});
vi.mock('convex/react', () => ({
  useQuery: (name: string) =>
    name === 'read' ? snapshot : name === 'companions' ? [] : undefined,
  usePaginatedQuery: () => emptyOwnerCandidates(),
  useMutation: () => () => new Promise(() => undefined),
}));

beforeEach(() => {
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
});

function fighter(level: number, routines: AttackRoutineFixture[]) {
  return buildSheet({
    scores: { ...defaultAbilityScores, strength: 16, dexterity: 14 },
    levels: Array.from({ length: level }, (_, index) => ({
      id: `level-${index + 1}`,
      hp: 10,
      classId: 'fighter' as const,
    })),
    classProficiencies: {
      fighter: [{ category: 'simple' }, { category: 'martial' }],
    },
    sheetEntries: [
      representativeWeapon('longsword', 'sword'),
      representativeWeapon('longbow', 'bow'),
    ],
    attackRoutines: routines,
  });
}
const strike = { id: 'strike', name: 'Sword strike', weaponEntryId: 'sword' };

function renderAttacks(sheet: CharacterSheetSnapshot) {
  snapshot = sheet;
  render(<CharacterSheetBlocks blocks={['attacks']} />);
  return screen.getByRole('listitem', { name: strike.name });
}
const list = (card: HTMLElement, name: string) =>
  within(card).getByRole('list', { name });
const numbers = (container: HTMLElement, statistic: string) =>
  within(container)
    .getAllByRole('button', { name: new RegExp(`: ${statistic} `) })
    .map((button) => button.getAttribute('aria-label'));

test.each([
  [6, ['+9', '+4']],
  [11, ['+14', '+9', '+4']],
  [16, ['+19', '+14', '+9', '+4']],
])(
  'a level %i fighter makes one single attack and an ordered full attack',
  (level, bonuses) => {
    const card = renderAttacks(fighter(level, [strike]));
    expect(numbers(list(card, 'Single attack'), 'attack')).toEqual([
      `Sword strike single attack: attack ${bonuses[0]}, breakdown`,
    ]);
    expect(numbers(list(card, 'Full attack'), 'attack')).toEqual(
      bonuses.map(
        (bonus, index) =>
          `Sword strike full attack ${index + 1} of ${bonuses.length}: attack ${bonus}, breakdown`,
      ),
    );
  },
);

test('each number opens its own breakdown, and damage credits its dice to the weapon', () => {
  const card = renderAttacks(fighter(6, [strike]));
  const second = within(list(card, 'Full attack')).getByRole('button', {
    name: 'Sword strike full attack 2 of 2: attack +4, breakdown',
  });
  fireEvent.click(second);
  const attack = screen.getByRole('group', {
    name: 'Sword strike full attack 2 of 2: attack breakdown',
  });
  expect(attack).toHaveTextContent('Iterative attack 2');
  expect(attack).toHaveTextContent('Strength');
  expect(screen.getAllByRole('group', { name: /breakdown$/ }).length).toBe(1);

  const damage = within(list(card, 'Single attack')).getByRole('button', {
    name: 'Sword strike single attack: damage 1d8+3, breakdown',
  });
  fireEvent.click(damage);
  const damageGroup = screen.getByRole('group', {
    name: 'Sword strike single attack: damage breakdown',
  });
  expect(damageGroup).toHaveTextContent(/Longsword\s*damage dice\s*1d8/);
  expect(damageGroup).toHaveTextContent('slashing');
  expect(damageGroup).toHaveTextContent(/Strength to damage\s*\+3/);
  expect(damageGroup).toHaveTextContent('1d8+3');

  fireEvent.click(
    within(list(card, 'Single attack')).getByRole('button', {
      name: 'Sword strike single attack: critical threat 19–20, breakdown',
    }),
  );
  expect(
    screen.getByRole('group', {
      name: 'Sword strike single attack: critical threat breakdown',
    }),
  ).toHaveTextContent(/Longsword critical threat\s*19/);
  fireEvent.click(
    within(list(card, 'Single attack')).getByRole('button', {
      name: 'Sword strike single attack: critical multiplier ×2, breakdown',
    }),
  );
  expect(
    screen.getByRole('group', {
      name: 'Sword strike single attack: critical multiplier breakdown',
    }),
  ).toHaveTextContent(/Longsword critical multiplier\s*×2/);
  expect(within(card).queryByRole('button', { name: /range increment/ })).toBe(
    null,
  );
});

test('a ranged routine shows its range increment and its source', () => {
  const card = renderAttacks(
    fighter(1, [
      { ...strike, weaponEntryId: 'bow', hands: 'two', mode: 'ranged' },
    ]),
  );
  const range = within(list(card, 'Single attack')).getByRole('button', {
    name: 'Sword strike single attack: range increment 100 ft., breakdown',
  });
  fireEvent.keyDown(range, { key: 'Enter' });
  fireEvent.click(range);
  expect(
    screen.getByRole('group', {
      name: 'Sword strike single attack: range increment breakdown',
    }),
  ).toHaveTextContent(/Longbow range increment\s*100 ft\./);
  expect(within(list(card, 'Single attack')).getByText('Ranged')).toBeVisible();
  expect(
    within(list(card, 'Single attack')).getByRole('button', {
      name: 'Sword strike single attack: attack +3, breakdown',
    }),
  ).toBeVisible();
});
