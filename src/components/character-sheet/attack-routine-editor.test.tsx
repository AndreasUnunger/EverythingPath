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

const offHandGroup = 'Off-hand weapon';
const offHandMode = 'Off-hand attack mode';
const hammer = representativeWeapon('gnome-hooked-hammer', 'hammer');

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
    // Off-hand cards and weapon details scroll with the rest of the routine.
    const form = within(dialog).getByRole('form');
    expect(
      within(form).getByRole('radiogroup', { name: offHandGroup }),
    ).toBeVisible();
    expect(
      within(form).getByRole('group', { name: 'Longsword' }),
    ).toBeVisible();
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
  renderSheet(
    sheet({
      offHand: { kind: 'weapon', weaponEntryId: 'dagger', mode: 'melee' },
    }),
  );
  const dialog = openEditor();
  expect(dialog).toHaveTextContent('Editing is paused for maintenance.');
  expect(nameField(dialog)).toBeDisabled();
  expect(choice(dialog, offHandGroup, 'None')).toBeDisabled();
  expect(choice(dialog, offHandGroup, 'Dagger')).toHaveAccessibleDescription(
    /Editing is paused for maintenance\./,
  );
  expect(choice(dialog, offHandMode, 'Thrown')).toBeDisabled();
  for (const weapon of ['Longsword', 'Dagger']) {
    const details = within(dialog).getByRole('group', { name: weapon });
    expect(
      within(details).getByRole('textbox', { name: 'Enhancement' }),
    ).toBeDisabled();
    expect(
      within(details).getByRole('checkbox', { name: 'Masterwork' }),
    ).toBeDisabled();
    expect(
      within(details).getByRole('textbox', { name: 'Material' }),
    ).toBeDisabled();
    for (const control of within(details).getAllByRole('textbox'))
      expect(control).toHaveAccessibleDescription(
        'Editing is paused for maintenance.',
      );
    expect(
      within(details).getByRole('checkbox', { name: 'Masterwork' }),
    ).toHaveAccessibleDescription('Editing is paused for maintenance.');
  }
  expect(choice(dialog, 'Held in', 'Two hands')).toBeDisabled();
  expect(choice(dialog, 'Main weapon', 'Dagger')).toBeDisabled();
  const remove = within(dialog).getByRole('button', { name: 'Remove routine' });
  expect(remove).toBeDisabled();
  expect(remove).toHaveAccessibleDescription(
    'Editing is paused for maintenance.',
  );
  expect(within(dialog).getByRole('button', { name: 'Done' })).toBeEnabled();
});

test('weapon details retain both their field error and the maintenance explanation', async () => {
  const initial = sheet();
  const view = renderSheet(initial);
  const dialog = openEditor();
  const details = within(dialog).getByRole('group', { name: 'Longsword' });
  const enhancement = within(details).getByRole('textbox', {
    name: 'Enhancement',
  });
  await settle(() => fireEvent.change(enhancement, { target: { value: '' } }));
  expect(enhancement).toHaveAccessibleDescription('Enhancement is required');
  maintenance.mockReturnValue({
    kind: 'maintenance',
    readOnly: true,
    message: 'Editing is paused for maintenance.',
  });
  view.show(initial);
  expect(enhancement).toBeDisabled();
  expect(enhancement).toHaveAccessibleDescription(
    'Editing is paused for maintenance. Enhancement is required',
  );
  expect(calls).toHaveLength(0);
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

test('an off-hand card saves its weapon and mode together, None clears it, and a new main weapon keeps it', async () => {
  renderSheet(sheet());
  const dialog = openEditor();
  expect(choice(dialog, offHandGroup, 'None')).toBeChecked();
  expect(within(dialog).queryByRole('radiogroup', { name: offHandMode })).toBe(
    null,
  );

  await settle(() => fireEvent.click(choice(dialog, offHandGroup, 'Dagger')));
  expect(lastCall()).toMatchObject({
    name: 'editAttackRoutine',
    args: {
      entryId: 'strike',
      offHand: { kind: 'weapon', weaponEntryId: 'dagger', mode: 'melee' },
    },
  });
  await settle(() => lastCall().resolve(1));
  expect(choice(dialog, offHandMode, 'Melee')).toBeChecked();
  // The separate off-hand weapon brings its own details.
  expect(within(dialog).getByRole('group', { name: 'Dagger' })).toBeVisible();

  await settle(() => fireEvent.click(choice(dialog, offHandMode, 'Thrown')));
  expect(lastCall().args).toMatchObject({
    offHand: { kind: 'weapon', weaponEntryId: 'dagger', mode: 'thrown' },
  });
  await settle(() => lastCall().resolve(2));

  await settle(() => fireEvent.click(choice(dialog, 'Main weapon', 'Dagger')));
  expect(lastCall().args).toMatchObject({ weaponEntryId: 'dagger' });
  expect(lastCall().args).not.toHaveProperty('offHand');
  await settle(() => lastCall().resolve(3));
  expect(choice(dialog, offHandGroup, 'Dagger')).toBeChecked();
  expect(choice(dialog, offHandMode, 'Thrown')).toBeChecked();

  await settle(() => fireEvent.click(choice(dialog, offHandGroup, 'None')));
  expect(lastCall().args).toMatchObject({ offHand: null });
  expect(within(dialog).queryByRole('radiogroup', { name: offHandMode })).toBe(
    null,
  );
});

test('a double weapon offers its other end, and unusual or switched-off off hands stay chosen with their warnings', async () => {
  const whirl = (offHand: string) =>
    sheet(
      {
        weaponEntryId: 'hammer',
        hands: 'two',
        offHand: { kind: 'weapon', weaponEntryId: offHand, mode: 'melee' },
      },
      {
        sheetEntries: [
          representativeWeapon('longsword', 'sword'),
          representativeWeapon('dagger', 'dagger', { active: false }),
          hammer,
        ],
      },
    );
  const view = renderSheet(whirl('sword'));
  const dialog = openEditor();
  const cards = () =>
    within(dialog).getByRole('radiogroup', { name: offHandGroup })
      .parentElement;
  expect(choice(dialog, offHandGroup, 'Longsword')).toBeChecked();
  expect(choice(dialog, 'Held in', 'Two hands')).toBeEnabled();
  expect(cards()).toHaveTextContent(
    'Off hand: The main weapon is held in two hands while an off-hand weapon is selected. This routine keeps both weapons.',
  );

  const switchedOff = choice(dialog, offHandGroup, 'Dagger, switched off');
  expect(switchedOff).toBeEnabled();
  await settle(() => fireEvent.click(switchedOff));
  expect(lastCall().args).toMatchObject({
    offHand: { kind: 'weapon', weaponEntryId: 'dagger', mode: 'melee' },
  });
  await settle(() => lastCall().resolve(1));
  view.show(whirl('dagger'));
  expect(switchedOff).toBeChecked();
  expect(cards()).toHaveTextContent(/Off hand: .*switched off/);

  await settle(() =>
    fireEvent.click(
      choice(dialog, offHandGroup, 'Other end of Gnome hooked hammer'),
    ),
  );
  expect(lastCall().args).toMatchObject({
    entryId: 'strike',
    offHand: { kind: 'otherEnd', mode: 'melee' },
  });
});

test('the preview shows the resolver two-weapon penalty summary for the selected off hand', () => {
  renderSheet(
    sheet({
      offHand: { kind: 'weapon', weaponEntryId: 'dagger', mode: 'melee' },
    }),
  );
  const preview = within(openEditor()).getByRole('region', {
    name: 'As it attacks now',
  });
  expect(preview).toHaveTextContent(
    'Two-weapon fighting, light off hand: −4 primary, −8 off hand',
  );
});

test('an other end the main weapon lacks stays recorded with its warning', () => {
  renderSheet(sheet({ offHand: { kind: 'otherEnd', mode: 'melee' } }));
  const dialog = openEditor();
  const cards = within(dialog).getByRole('radiogroup', { name: offHandGroup });
  expect(choice(dialog, offHandGroup, 'None')).not.toBeChecked();
  expect(choice(dialog, offHandGroup, 'Other end unavailable')).toBeChecked();
  expect(choice(dialog, offHandGroup, 'Other end unavailable')).toBeDisabled();
  expect(cards.parentElement).toHaveTextContent(
    'Off hand: Longsword has no recorded second end.',
  );
  expect(choice(dialog, offHandMode, 'Melee')).toBeChecked();
});

test('each end of a double weapon saves its own details, with separate acknowledgements, errors and Try again', async () => {
  const view = renderSheet(
    sheet(
      {
        weaponEntryId: 'hammer',
        hands: 'two',
        offHand: { kind: 'otherEnd', mode: 'melee' },
      },
      { sheetEntries: [hammer] },
    ),
  );
  const dialog = openEditor();
  const primary = within(dialog).getByRole('group', {
    name: 'Gnome hooked hammer, primary end',
  });
  const other = within(dialog).getByRole('group', {
    name: 'Gnome hooked hammer, other end',
  });
  // The other end in the off hand is the same weapon's: no second editor.
  expect(
    within(dialog).getAllByRole('group', { name: /^Gnome hooked hammer/ }),
  ).toHaveLength(2);
  const preview = within(dialog).getByRole('region', {
    name: 'As it attacks now',
  });
  expect(preview).toHaveTextContent(
    /Full attack\s*Main hand: Gnome hooked hammer [+−]\d+ \(1d8[^)]*×3\)\s*Off hand, other end: Gnome hooked hammer [+−]\d+ \(1d6[^)]*×4\)/,
  );
  expect(preview).toHaveTextContent(
    /Single attack\s*[+−]\d+ \(1d8[^)]*×3\)Full/,
  );

  await settle(() =>
    fireEvent.change(
      within(other).getByRole('textbox', { name: 'Enhancement' }),
      {
        target: { value: '2' },
      },
    ),
  );
  expect(lastCall()).toMatchObject({
    name: 'editEquipment',
    args: { entryId: 'hammer', end: 'otherEnd', enhancement: 2 },
  });
  expect(lastCall().args).not.toHaveProperty('masterwork');
  expect(lastCall().args).not.toHaveProperty('material');
  const otherSave = lastCall();

  await settle(() =>
    fireEvent.click(
      within(primary).getByRole('checkbox', { name: 'Masterwork' }),
    ),
  );
  expect(lastCall().args).toMatchObject({
    entryId: 'hammer',
    end: 'primary',
    masterwork: true,
  });
  expect(lastCall().args).not.toHaveProperty('enhancement');
  await settle(() => otherSave.resolve(null));
  await settle(() =>
    lastCall().reject(new ConvexError('Character is read only')),
  );
  expect(within(other).getByText('Saved')).toBeVisible();
  expect(within(other).queryByRole('alert')).toBe(null);
  expect(within(primary).getByRole('alert')).toHaveTextContent(
    "Changes weren't saved",
  );

  const enhancement = within(primary).getByRole('textbox', {
    name: 'Enhancement',
  });
  const written = calls.length;
  await settle(() => fireEvent.change(enhancement, { target: { value: '' } }));
  expect(within(primary).getByText('Enhancement is required')).toBeVisible();
  await settle(() =>
    fireEvent.change(enhancement, { target: { value: 'keen' } }),
  );
  expect(
    within(primary).getByText(
      'Enhancement must be a whole number of 0 or more',
    ),
  ).toBeVisible();
  expect(calls).toHaveLength(written);

  // Another player's change refreshes untouched fields and keeps refused drafts.
  view.show(
    sheet(
      {
        weaponEntryId: 'hammer',
        hands: 'two',
        offHand: { kind: 'otherEnd', mode: 'melee' },
      },
      {
        sheetEntries: [
          representativeWeapon('gnome-hooked-hammer', 'hammer', {
            itemState: { material: 'silver' },
          }),
        ],
        lastOperationId: 'other-player',
      },
    ),
  );
  expect(
    within(primary).getByRole('textbox', { name: 'Material' }),
  ).toHaveValue('silver');
  expect(enhancement).toHaveValue('keen');
  expect(
    within(primary).getByRole('checkbox', { name: 'Masterwork' }),
  ).toBeChecked();
  expect(primary).toHaveTextContent(
    'Changed by another player. Your edits are kept.',
  );

  await settle(() =>
    fireEvent.click(
      within(primary).getByRole('button', {
        name: 'Try again saving masterwork for Gnome hooked hammer, primary end',
      }),
    ),
  );
  expect(lastCall()).toMatchObject({
    name: 'editEquipment',
    args: { entryId: 'hammer', end: 'primary', masterwork: true },
  });
});
