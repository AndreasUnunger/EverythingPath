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
  type AttackRoutineFixture,
} from './character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';

// The Attack Routine editor (#314): a panel whose every field saves at once,
// keeps refused and newer drafts, and returns focus where it came from.

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

const strike: AttackRoutineFixture = {
  id: 'strike',
  name: 'Sword strike',
  weaponEntryId: 'sword',
};
const sheet = (
  routine: Partial<AttackRoutineFixture> = {},
  input: Parameters<typeof buildSheet>[0] = {},
) =>
  buildSheet({
    levels: [{ id: 'level-1', hp: 10, classId: 'fighter' }],
    sheetEntries: [
      representativeWeapon('longsword', 'sword'),
      representativeWeapon('dagger', 'dagger'),
    ],
    attackRoutines: [{ ...strike, ...routine }],
    ...input,
  });

const page = () => <CharacterSheetBlocks blocks={['attacks']} />;
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
const editButton = (name = 'Sword strike') =>
  screen.getByRole('button', { name: `Edit ${name}` });
function openEditor(name?: string) {
  fireEvent.click(editButton(name));
  return screen.getByRole('dialog', { name: 'Attack routine' });
}
const nameField = (dialog: HTMLElement) =>
  within(dialog).getByRole('textbox', { name: 'Routine name' });
const choice = (dialog: HTMLElement, group: string, name: string) =>
  within(within(dialog).getByRole('radiogroup', { name: group })).getByRole(
    'radio',
    { name },
  );
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
const type = (dialog: HTMLElement, value: string) =>
  settle(() => fireEvent.change(nameField(dialog), { target: { value } }));

test('each field saves as it changes, with no Save step, and an empty name stays local while hands still save', async () => {
  renderSheet(sheet());
  const dialog = openEditor();
  expect(within(dialog).queryByRole('button', { name: /^Save/ })).toBeNull();

  await type(dialog, 'Cleave');
  expect(lastCall()).toMatchObject({
    name: 'editAttackRoutine',
    args: { entryId: 'strike', name: 'Cleave' },
  });
  expect(lastCall().args).not.toHaveProperty('hands');
  await settle(() => lastCall().resolve(1));
  expect(within(dialog).getByText('Saved')).toBeVisible();

  await settle(() => fireEvent.click(choice(dialog, 'Held in', 'Two hands')));
  expect(lastCall().args).toMatchObject({ hands: 'two' });
  await settle(() => lastCall().resolve(2));
  await settle(() => fireEvent.click(choice(dialog, 'Attack mode', 'Thrown')));
  expect(lastCall().args).toMatchObject({
    mode: 'thrown',
  });
  await settle(() => lastCall().resolve(3));

  const written = calls.length;
  await type(dialog, '   ');
  expect(calls).toHaveLength(written);
  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    'Routine name is required',
  );
  expect(nameField(dialog)).toHaveAttribute('aria-invalid', 'true');
  await settle(() => fireEvent.click(choice(dialog, 'Held in', 'One hand')));
  expect(lastCall().args).toMatchObject({ hands: 'one' });
  expect(nameField(dialog)).toHaveValue('   ');
});

test('a light weapon in two hands explains its Strength, and the preview shows the saved attacks', () => {
  renderSheet(sheet({ weaponEntryId: 'dagger', hands: 'two' }));
  const dialog = openEditor();
  expect(dialog).toHaveTextContent(
    'A light weapon in two hands still adds Strength once.',
  );
  const preview = within(dialog).getByRole('region', {
    name: 'As it attacks now',
  });
  expect(preview).toHaveTextContent(
    /Single attack\s*[+−]\d+ \(1d4\/19–20\/×2\)/,
  );
  expect(preview).toHaveTextContent(/Full attack\s*[+−]\d+ \(1d4\/19–20\/×2\)/);
});

test('a refused save keeps the draft with a local Try again, and another player’s change refreshes only untouched fields', async () => {
  const view = renderSheet(sheet());
  const dialog = openEditor();
  await type(dialog, 'Cleave');
  await settle(() =>
    lastCall().reject(new ConvexError('Character is read only')),
  );
  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    "Changes weren't saved",
  );
  expect(nameField(dialog)).toHaveValue('Cleave');

  view.show(
    sheet(
      { name: 'Remote strike', mode: 'ranged', revision: 3 },
      { lastOperationId: 'other-player' },
    ),
  );
  expect(nameField(dialog)).toHaveValue('Cleave');
  expect(choice(dialog, 'Attack mode', 'Ranged')).toBeChecked();
  expect(dialog).toHaveTextContent(
    'Changed by another player. Your edits are kept.',
  );

  const written = calls.length;
  await settle(() =>
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Try again saving routine name',
      }),
    ),
  );
  expect(calls).toHaveLength(written + 1);
  expect(lastCall().args).toMatchObject({
    entryId: 'strike',

    name: 'Cleave',
  });
  expect(lastCall().args).not.toHaveProperty('mode');
  fireEvent.click(
    within(dialog).getByRole('button', {
      name: 'Dismiss Remote strike update',
    }),
  );
  expect(dialog).not.toHaveTextContent('Changed by another player.');
});

test('acknowledgements and their echoes never overwrite newer typing', async () => {
  const view = renderSheet(sheet());
  const dialog = openEditor();
  await type(dialog, 'Sword');
  const first = lastCall();
  await type(dialog, 'Sword sweep');
  expect(calls).toHaveLength(1);
  await settle(() => first.resolve(1));
  await act(async () => {
    await Promise.resolve();
  });
  expect(lastCall().args).toMatchObject({
    name: 'Sword sweep',
  });
  view.show(
    sheet(
      { name: 'Sword', revision: 1 },
      { lastOperationId: first.args.operationId as string },
    ),
  );
  expect(nameField(dialog)).toHaveValue('Sword sweep');
  const second = lastCall();
  await settle(() => second.resolve(2));
  view.show(
    sheet(
      { name: 'Sword sweep', revision: 2 },
      { lastOperationId: second.args.operationId as string },
    ),
  );
  expect(nameField(dialog)).toHaveValue('Sword sweep');
  expect(dialog).not.toHaveTextContent('Changed by another player.');
});

test('keyboard and touch: native radios, Escape and Done return focus to Edit, and breakdowns pin and close by key', async () => {
  renderSheet(sheet());
  const edit = editButton();
  edit.focus();
  let dialog = openEditor();
  await waitFor(() =>
    expect(dialog).toContainElement(document.activeElement as HTMLElement),
  );
  expect(within(dialog).getByRole('form')).toHaveAttribute('novalidate');
  expect(dialog.querySelector('[required]')).toBeNull();
  const hands = choice(dialog, 'Held in', 'One hand');
  expect(hands.tagName).toBe('INPUT');
  expect(hands).toHaveAttribute('name', 'hands');
  expect(hands).toBeChecked();

  // A tap on the card itself selects it, like a click on the native radio.
  await settle(() => fireEvent.click(within(dialog).getByText('Thrown')));
  expect(lastCall().args).toMatchObject({ mode: 'thrown' });
  expect(choice(dialog, 'Attack mode', 'Thrown')).toBeChecked();

  fireEvent.keyDown(document.activeElement ?? dialog, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(edit).toHaveFocus());

  dialog = openEditor();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(edit).toHaveFocus());

  const attack = screen.getByRole('button', {
    name: /^Sword strike single attack: attack /,
  });
  attack.focus();
  fireEvent.click(attack);
  expect(attack).toHaveAttribute('aria-expanded', 'true');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(attack).toHaveAttribute('aria-expanded', 'false');
  expect(attack).toHaveFocus();
});

test('below 768px the editor is a bottom sheet that scrolls within 85% of the viewport', () => {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  try {
    renderSheet(sheet());
    const dialog = openEditor();
    expect(dialog).toHaveClass('bottom-0', 'max-h-[85vh]');
    expect(within(dialog).getByRole('form')).toHaveClass(
      'min-h-0',
      'overflow-y-auto',
    );
  } finally {
    window.matchMedia = original;
  }
});

test('maintenance leaves the editor readable with its reason and every write disabled', () => {
  maintenance.mockReturnValue({
    kind: 'maintenance',
    readOnly: true,
    message: 'Editing is paused for maintenance.',
  });
  renderSheet(sheet());
  const dialog = openEditor();
  expect(dialog).toHaveTextContent('Editing is paused for maintenance.');
  expect(nameField(dialog)).toBeDisabled();
  expect(choice(dialog, 'Held in', 'Two hands')).toBeDisabled();
  expect(choice(dialog, 'Main weapon', 'Dagger')).toBeDisabled();
  const remove = within(dialog).getByRole('button', { name: 'Remove routine' });
  expect(remove).toBeDisabled();
  expect(remove).toHaveAccessibleDescription(
    'Editing is paused for maintenance.',
  );
  expect(within(dialog).getByRole('button', { name: 'Done' })).toBeEnabled();
});

test('the editor displays routine advisories alongside calculated attack lines', () => {
  const snapshot = sheet();
  const routine = snapshot.calculated.attackRoutines[0];
  if (!routine) throw new Error('Missing routine');
  routine.warnings.push({
    kind: 'rules',
    check: 'unsuitableAttackHands',
    target: { kind: 'entry', entryId: routine.entryId },
    subject: routine.entryId,
    fingerprint: 'advisory-hands',
    message: 'This weapon normally needs two hands.',
  });
  renderSheet(snapshot);
  const preview = within(openEditor()).getByRole('region', {
    name: 'As it attacks now',
  });
  expect(preview).toHaveTextContent('Single attack');
  expect(preview).toHaveTextContent('This weapon normally needs two hands.');
});
