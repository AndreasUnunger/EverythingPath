import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import {
  buildSheet,
  emptyOwnerCandidates,
  representativeWeapon,
} from './character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';

// The Attacks block (#314): adding weapons and routines, routine cards with
// their warnings and repair, and removal with Undo of the same routine.

type Call = {
  name: string;
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
let calls: Call[] = [];
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
  useMutation: (name: string) => (args: Record<string, unknown>) =>
    new Promise((resolve, reject) => {
      calls.push({ name, args, resolve, reject });
    }),
}));

beforeEach(() => {
  calls = [];
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
});

const sword = representativeWeapon('longsword', 'sword');
const strike = { id: 'strike', name: 'Sword strike', weaponEntryId: 'sword' };
const sheet = (input: Parameters<typeof buildSheet>[0] = {}) =>
  buildSheet({
    levels: [{ id: 'level-1', hp: 10, classId: 'fighter' }],
    classProficiencies: {
      fighter: [{ category: 'simple' }, { category: 'martial' }],
    },
    ...input,
  });

const page = () => <CharacterSheetBlocks blocks={['equipment', 'attacks']} />;
function renderSheet(initial: CharacterSheetSnapshot) {
  snapshot = initial;
  const view = render(page());
  return {
    show(next: CharacterSheetSnapshot) {
      snapshot = next;
      view.rerender(page());
    },
  };
}
const attacksBlock = () => screen.getByRole('region', { name: 'Attacks' });
const card = (name: string) =>
  within(attacksBlock()).getByRole('listitem', { name });
const lastCall = () => {
  const call = calls.at(-1);
  if (!call) throw new Error('Expected a write');
  return call;
};
const settle = (action: () => void) =>
  act(async () => {
    action();
    await Promise.resolve();
  });

test('a catalog weapon card adds Gear with its default routine, and another routine reuses that Gear', async () => {
  const view = renderSheet(sheet({ catalogOnly: [sword] }));
  expect(attacksBlock()).toHaveTextContent(
    'Add a weapon under Gear, then save how it attacks here.',
  );
  expect(
    within(attacksBlock()).getByRole('button', { name: 'Add attack routine' }),
  ).toBeDisabled();

  const addWeapon = within(attacksBlock()).getByRole('button', {
    name: 'Add weapon',
  });
  fireEvent.click(addWeapon);
  expect(addWeapon).toHaveAttribute('aria-expanded', 'true');
  const catalog = within(attacksBlock()).getByRole('region', {
    name: 'Add weapon',
  });
  fireEvent.click(within(catalog).getByRole('button', { name: 'Longsword' }));
  expect(lastCall()).toMatchObject({
    name: 'selectEntry',
    args: { catalogEntryId: 'sword-catalog' },
  });
  expect(within(catalog).getByRole('status')).toHaveTextContent(
    'Adding Longsword…',
  );
  await settle(() => lastCall().resolve('sword'));
  view.show(
    sheet({
      sheetEntries: [sword],
      attackRoutines: [{ ...strike, name: 'Longsword' }],
    }),
  );
  expect(
    within(attacksBlock()).getAllByRole('button', { name: /^Edit / }),
  ).toHaveLength(1);
  expect(card('Longsword')).toHaveTextContent('Longsword · One hand · Melee');

  fireEvent.click(
    within(attacksBlock()).getByRole('button', { name: 'Add attack routine' }),
  );
  fireEvent.click(
    within(
      within(attacksBlock()).getByRole('region', {
        name: 'Add attack routine',
      }),
    ).getByRole('button', { name: 'Longsword' }),
  );
  expect(lastCall()).toMatchObject({
    name: 'createAttackRoutine',
    args: { weaponEntryId: 'sword' },
  });
  expect(calls.filter((call) => call.name === 'selectEntry')).toHaveLength(1);
  await settle(() => lastCall().resolve('second'));
  expect(screen.queryByRole('dialog')).toBeNull();
  view.show(
    sheet({
      sheetEntries: [sword],
      attackRoutines: [
        { ...strike, name: 'Longsword' },
        { ...strike, id: 'second', name: 'Longsword' },
      ],
    }),
  );
  const dialog = screen.getByRole('dialog', { name: 'Attack routine' });
  expect(
    within(dialog).getByRole('textbox', { name: 'Routine name' }),
  ).toHaveValue('Longsword');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
  await waitFor(() =>
    expect(
      within(attacksBlock()).getByRole('button', {
        name: 'Add attack routine',
      }),
    ).toHaveFocus(),
  );
});

test('Gear offers the same weapon cards', () => {
  renderSheet(sheet({ catalogOnly: [sword] }));
  const equipment = screen.getByRole('region', { name: 'Equipment' });
  fireEvent.click(
    within(equipment).getByRole('button', { name: 'Add weapon' }),
  );
  fireEvent.click(
    within(
      within(equipment).getByRole('region', { name: 'Add weapon' }),
    ).getByRole('button', { name: 'Longsword' }),
  );
  expect(lastCall()).toMatchObject({
    name: 'selectEntry',
    args: { catalogEntryId: 'sword-catalog' },
  });
});

test('a switched-off weapon keeps its named card, warning and repair; a new weapon brings its natural hands', async () => {
  renderSheet(
    sheet({
      sheetEntries: [
        { ...sword, active: false },
        representativeWeapon('greatsword', 'greatsword'),
      ],
      attackRoutines: [strike],
    }),
  );
  const routine = card('Sword strike');
  expect(routine).toHaveTextContent(
    "Sword strike's weapon is switched off. Switch it on in Gear or choose another weapon to use this routine.",
  );
  expect(within(routine).getByRole('button', { name: 'Accept' })).toBeVisible();
  expect(within(routine).queryByRole('list', { name: 'Single attack' })).toBe(
    null,
  );
  fireEvent.click(
    within(routine).getByRole('button', {
      name: 'Choose a weapon for Sword strike',
    }),
  );
  const dialog = screen.getByRole('dialog', { name: 'Attack routine' });
  const weapons = within(dialog).getByRole('radiogroup', {
    name: 'Main weapon',
  });
  expect(
    within(weapons).getByRole('radio', { name: 'Longsword, switched off' }),
  ).toBeChecked();
  await settle(() =>
    fireEvent.click(within(weapons).getByRole('radio', { name: 'Greatsword' })),
  );
  expect(lastCall()).toMatchObject({
    name: 'editAttackRoutine',
    args: {
      entryId: 'strike',

      weaponEntryId: 'greatsword',
      hands: 'two',
      mode: 'melee',
    },
  });
});

test('a routine whose weapon left Gear keeps its card, and duplicate Gear names are numbered', () => {
  renderSheet(
    sheet({
      sheetEntries: [sword, representativeWeapon('longsword', 'sword-2')],
      attackRoutines: [
        { ...strike, weaponEntryId: 'sword-2' },
        { id: 'lost', name: 'Lost blade', weaponEntryId: 'gone' },
      ],
    }),
  );
  expect(card('Sword strike')).toHaveTextContent(
    'Longsword 2 · One hand · Melee',
  );
  const lost = card('Lost blade');
  expect(lost).toHaveTextContent("Lost blade's weapon is no longer in Gear.");
  fireEvent.click(
    within(lost).getByRole('button', { name: 'Edit Lost blade' }),
  );
  const dialog = screen.getByRole('dialog', { name: 'Attack routine' });
  expect(dialog).toHaveTextContent(
    "Lost blade's weapon is no longer in Gear. Choose another weapon to use this routine.",
  );
  expect(
    within(dialog).queryByText(
      'Its weapon is no longer in Gear. Choose another weapon.',
    ),
  ).toBeNull();
  const weapons = within(dialog).getByRole('radiogroup', {
    name: 'Main weapon',
  });
  expect(
    within(weapons)
      .getAllByRole('radio')
      .map((radio) => (radio as HTMLInputElement).checked),
  ).toEqual([false, false]);
  expect(
    within(weapons).getByRole('radio', { name: 'Longsword 1' }),
  ).toBeVisible();
  expect(
    within(weapons).getByRole('radio', { name: 'Longsword 2' }),
  ).toBeVisible();
});

test('removal waits for its acknowledgement, and Undo restores the same routine and stays retryable', async () => {
  const view = renderSheet(
    sheet({ sheetEntries: [sword], attackRoutines: [strike] }),
  );
  fireEvent.click(
    within(card('Sword strike')).getByRole('button', {
      name: 'Remove Sword strike',
    }),
  );
  expect(lastCall()).toMatchObject({
    name: 'deleteAttackRoutine',
    args: { entryId: 'strike' },
  });
  expect(card('Sword strike')).toBeVisible();
  await settle(() => lastCall().resolve(1));
  expect(
    within(attacksBlock()).queryByRole('listitem', { name: 'Sword strike' }),
  ).toBeNull();
  expect(screen.getByRole('heading', { name: 'Attacks' })).toHaveFocus();
  expect(
    within(attacksBlock()).getByText('Removed “Sword strike”.'),
  ).toHaveAttribute('role', 'status');

  const undo = within(attacksBlock()).getByRole('button', { name: 'Undo' });
  fireEvent.click(undo);
  expect(lastCall()).toMatchObject({
    name: 'restoreAttackRoutine',
    args: { entryId: 'strike' },
  });
  await settle(() =>
    lastCall().reject(new ConvexError('Character is read only')),
  );
  expect(within(attacksBlock()).getByRole('alert')).toHaveTextContent(
    'Character is read only',
  );
  expect(undo).toBeEnabled();
  fireEvent.click(undo);
  await settle(() => lastCall().resolve(2));
  expect(within(attacksBlock()).queryByRole('button', { name: 'Undo' })).toBe(
    null,
  );
  expect(attacksBlock()).toHaveTextContent('Restored “Sword strike”.');
  view.show(
    sheet({
      sheetEntries: [sword],
      attackRoutines: [{ ...strike, revision: 2 }],
    }),
  );
  expect(card('Sword strike')).toBeVisible();
  fireEvent.click(
    within(attacksBlock()).getByRole('button', { name: 'Dismiss' }),
  );
  expect(attacksBlock()).not.toHaveTextContent('Restored “Sword strike”.');
});

test('a refused removal keeps the card with its error and offers no Undo', async () => {
  renderSheet(sheet({ sheetEntries: [sword], attackRoutines: [strike] }));
  fireEvent.click(
    within(card('Sword strike')).getByRole('button', {
      name: 'Remove Sword strike',
    }),
  );
  await settle(() =>
    lastCall().reject(new ConvexError('Character is read only')),
  );
  expect(within(card('Sword strike')).getByRole('alert')).toHaveTextContent(
    'Character is read only',
  );
  expect(within(attacksBlock()).queryByRole('button', { name: 'Undo' })).toBe(
    null,
  );
});

test('Remove routine in the editor closes it once saved and returns focus to Attacks', async () => {
  renderSheet(sheet({ sheetEntries: [sword], attackRoutines: [strike] }));
  fireEvent.click(
    within(card('Sword strike')).getByRole('button', {
      name: 'Edit Sword strike',
    }),
  );
  const dialog = screen.getByRole('dialog', { name: 'Attack routine' });
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Remove routine' }),
  );
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await settle(() => lastCall().resolve(1));
  expect(screen.queryByRole('dialog')).toBeNull();
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: 'Attacks' })).toHaveFocus(),
  );
  expect(attacksBlock()).toHaveTextContent('Removed “Sword strike”.');
});

test('another player’s change is announced in Attacks until dismissed', () => {
  const view = renderSheet(
    sheet({ sheetEntries: [sword], attackRoutines: [strike] }),
  );
  view.show(
    sheet({
      sheetEntries: [sword],
      attackRoutines: [{ ...strike, name: 'Remote strike', revision: 1 }],
      lastOperationId: 'other-player',
    }),
  );
  expect(card('Remote strike')).toBeVisible();
  expect(attacksBlock()).toHaveTextContent('Changed by another player.');
  fireEvent.click(
    within(attacksBlock()).getByRole('button', {
      name: 'Dismiss attack routines update',
    }),
  );
  expect(attacksBlock()).not.toHaveTextContent('Changed by another player.');
});

test('maintenance disables writes with its reason while breakdowns stay usable', () => {
  maintenance.mockReturnValue({
    kind: 'maintenance',
    readOnly: true,
    message: 'Editing is paused for maintenance.',
  });
  renderSheet(
    sheet({
      sheetEntries: [sword],
      catalogOnly: [representativeWeapon('dagger', 'dagger')],
      attackRoutines: [strike],
    }),
  );
  const remove = within(card('Sword strike')).getByRole('button', {
    name: 'Remove Sword strike',
  });
  expect(remove).toBeDisabled();
  expect(remove).toHaveAccessibleDescription(
    'Editing is paused for maintenance.',
  );
  fireEvent.click(
    within(attacksBlock()).getByRole('button', { name: 'Add weapon' }),
  );
  expect(
    within(
      within(attacksBlock()).getByRole('region', { name: 'Add weapon' }),
    ).getByRole('button', { name: 'Dagger' }),
  ).toBeDisabled();
  const attack = within(card('Sword strike')).getByRole('button', {
    name: /^Sword strike single attack: attack /,
  });
  fireEvent.click(attack);
  expect(attack).toHaveAttribute('aria-expanded', 'true');
});
