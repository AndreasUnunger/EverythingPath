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
import { defaultAbilityScores } from '~/lib/character-sheet';
import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import {
  buildSheet,
  emptyOwnerCandidates,
  type CatalogSheetEntry,
} from './character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';

// Equipping armor and shields (#306): the Equipment block's rows, totals and
// gear-state editor, beside the Defenses and Skills that already include
// their effects.

type Call = {
  name: string;
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
let calls: Call[] = [];
let snapshot: CharacterSheetSnapshot | null | undefined;
const maintenance = vi.fn<() => MigrationMaintenance>();

vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => maintenance(),
}));
vi.mock('@convex/_generated/api', async () => {
  const { createCharacterSheetApiMock } =
    await import('./character-sheet-api-test-fixture');
  return createCharacterSheetApiMock({
    characterSheet: { editClassLevel: 'editClassLevel' },
  });
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

const fullPlate: CatalogSheetEntry = {
  id: 'plate',
  name: 'Full plate',
  detail: {
    kind: 'item',
    consumable: false,
    armor: {
      slot: 'armor',
      category: 'heavy',
      bonus: 9,
      maxDex: 1,
      armorCheckPenalty: 6,
      asf: 35,
    },
  },
  modifiers: [],
  itemState: { enhancement: 1 },
};
const heavyShield: CatalogSheetEntry = {
  id: 'shield',
  name: 'Heavy steel shield',
  detail: {
    kind: 'item',
    consumable: false,
    armor: {
      slot: 'shield',
      category: 'heavyShield',
      bonus: 2,
      maxDex: null,
      armorCheckPenalty: 2,
      asf: 15,
    },
  },
  modifiers: [],
};
const buckler: CatalogSheetEntry = {
  id: 'buckler',
  name: 'Buckler',
  detail: {
    kind: 'item',
    consumable: false,
    armor: {
      slot: 'shield',
      category: 'buckler',
      bonus: 1,
      armorCheckPenalty: 1,
    },
  },
  modifiers: [],
  active: false,
};
const nimble = { ...defaultAbilityScores, dexterity: 18 };
const armored = (
  input: Parameters<typeof buildSheet>[0] = {},
): Parameters<typeof buildSheet>[0] => ({
  scores: nimble,
  levels: [{ id: 'level-1', hp: 10, classId: 'fighter' }],
  sheetEntries: [fullPlate, heavyShield, buckler],
  ...input,
});

const page = () => (
  <CharacterSheetBlocks blocks={['defenses', 'equipment', 'skills']} />
);
function renderSheet(initial: CharacterSheetSnapshot | undefined) {
  snapshot = initial;
  const view = render(page());
  return {
    show(next: CharacterSheetSnapshot) {
      snapshot = next;
      view.rerender(page());
    },
  };
}
const equipment = () => screen.getByRole('region', { name: 'Equipment' });
const item = (name: string) =>
  within(equipment()).getByRole('listitem', { name });
const button = (name: string | RegExp) =>
  within(equipment()).getByRole('button', { name });
const editor = (name: string) =>
  within(equipment()).getByRole('form', { name: `Edit ${name}` });
const field = (form: HTMLElement, name: string) =>
  within(form).getByRole('textbox', { name });
const typeInto = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } });
function lastCall() {
  const call = calls.at(-1);
  if (!call) throw new Error('Expected a write');
  return call;
}

test('full plate and a shield show their authoritative totals, a numeric nonproficiency penalty and no warning; AC is capped, CMD is not, and skills carry the penalty once', () => {
  const sheet = buildSheet(armored());
  renderSheet(sheet);
  const { derivedStatistics, breakdowns } = sheet.calculated;
  expect(button('Armor check penalty −7, breakdown')).toBeVisible();
  expect(button('Arcane spell failure 50%, breakdown')).toBeVisible();
  expect(button('Maximum Dexterity bonus to AC +1, breakdown')).toBeVisible();
  expect(
    within(item('Full plate')).getByText(
      'Not proficient: Full plate −5 to attacks',
    ),
  ).toBeVisible();
  expect(
    within(item('Heavy steel shield')).getByText(
      'Not proficient: Heavy steel shield −2 to attacks',
    ),
  ).toBeVisible();
  expect(within(item('Buckler')).getByText('Not equipped')).toBeVisible();
  expect(
    within(item('Buckler')).queryByText(/Not proficient/),
  ).not.toBeInTheDocument();
  expect(within(equipment()).queryByRole('alert')).not.toBeInTheDocument();
  expect(
    within(equipment()).queryByRole('button', { name: 'Accept' }),
  ).not.toBeInTheDocument();

  fireEvent.click(button('Arcane spell failure 50%, breakdown'));
  const failure = within(equipment()).getByRole('group', {
    name: 'Arcane spell failure breakdown',
  });
  expect(within(failure).getByText('35%')).toBeVisible();
  expect(within(failure).getByText('15%')).toBeVisible();

  const defenses = within(screen.getByRole('region', { name: 'Defenses' }));
  fireEvent.click(
    defenses.getByRole('button', {
      name: `Armor Class ${derivedStatistics.ac.total}, breakdown`,
    }),
  );
  const ac = defenses.getByRole('group', { name: 'Armor Class breakdown' });
  expect(within(ac).getByText('Dexterity (armor maximum +1)')).toBeVisible();
  expect(within(ac).getByText('Full plate enhancement')).toBeVisible();
  expect(derivedStatistics.cmd.applied).toContainEqual(
    expect.objectContaining({ entryName: 'Dexterity', value: 4 }),
  );
  expect(breakdowns['skill.clm'].total).toBe(-7);
  expect(
    screen.getByRole('button', { name: 'Climb -7, breakdown' }),
  ).toBeVisible();
});

test('equip and unequip write the row identity with feedback on that row while other rows stay usable; a refusal is reported there and can be retried', async () => {
  const view = renderSheet(buildSheet(armored()));
  fireEvent.click(button('Unequip Full plate'));
  expect(lastCall()).toMatchObject({
    name: 'editEquipment',
    args: { entryId: 'plate', active: false },
  });
  expect(button('Unequip Full plate')).toBeDisabled();
  expect(within(item('Full plate')).getByText('Saving…')).toBeVisible();
  expect(button('Equip Buckler')).toBeEnabled();
  expect(
    within(item('Buckler')).queryByText('Saving…'),
  ).not.toBeInTheDocument();

  view.show(
    buildSheet(
      armored({
        sheetEntries: [{ ...fullPlate, active: false }, heavyShield, buckler],
        lastOperationId: String(lastCall().args.operationId),
      }),
    ),
  );
  await act(async () => lastCall().resolve(null));
  expect(within(item('Full plate')).getByText('Saved')).toBeVisible();
  expect(within(item('Full plate')).getByText('Not equipped')).toBeVisible();

  fireEvent.click(button('Equip Buckler'));
  await act(async () =>
    lastCall().reject(new ConvexError('Character is read only')),
  );
  expect(within(item('Buckler')).getByRole('alert')).toHaveTextContent(
    "Buckler wasn't saved: Character is read only. Try again.",
  );
  expect(
    within(item('Full plate')).queryByRole('alert'),
  ).not.toBeInTheDocument();
  fireEvent.click(button('Equip Buckler'));
  expect(calls).toHaveLength(3);
  expect(lastCall().args).toMatchObject({ entryId: 'buckler', active: true });
});

test('the editor prefills enhancement zero, refuses empty and invalid enhancement with distinct errors and no write, and saves masterwork, enhancement and material', async () => {
  renderSheet(buildSheet(armored()));
  fireEvent.click(button('Edit Heavy steel shield'));
  const form = editor('Heavy steel shield');
  expect(form).toHaveAttribute('novalidate');
  const enhancement = field(form, 'Enhancement');
  expect(enhancement).toHaveValue('0');
  expect(enhancement).toHaveFocus();

  typeInto(enhancement, '');
  fireEvent.submit(form);
  expect(await within(form).findByRole('alert')).toHaveTextContent(
    'Enhancement is required',
  );
  expect(enhancement).toHaveAccessibleDescription('Enhancement is required');
  typeInto(enhancement, 'two');
  fireEvent.submit(form);
  await waitFor(() =>
    expect(within(form).getByRole('alert')).toHaveTextContent(
      'Enhancement must be a whole number of 0 or more',
    ),
  );
  expect(calls).toEqual([]);

  typeInto(enhancement, '2');
  fireEvent.click(within(form).getByRole('checkbox', { name: 'Masterwork' }));
  typeInto(field(form, 'Material'), '  Darkwood ');
  fireEvent.submit(form);
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall()).toMatchObject({
    name: 'editEquipment',
    args: {
      entryId: 'shield',
      enhancement: 2,
      masterwork: true,
      material: 'Darkwood',
    },
  });
});

test('clearing material saves null; a remote edit refreshes pristine fields and keeps a dirty one with a notice; a refused save keeps the draft in the form', async () => {
  const mithral = {
    ...fullPlate,
    itemState: { enhancement: 1, material: 'mithral' },
  };
  const view = renderSheet(
    buildSheet(armored({ sheetEntries: [mithral, heavyShield] })),
  );
  fireEvent.click(button('Edit Full plate'));
  const form = editor('Full plate');
  typeInto(field(form, 'Material'), '');
  view.show(
    buildSheet(
      armored({
        sheetEntries: [
          { ...mithral, itemState: { enhancement: 3, material: 'mithral' } },
          heavyShield,
        ],
        lastOperationId: 'another-player',
      }),
    ),
  );
  expect(field(form, 'Enhancement')).toHaveValue('3');
  expect(field(form, 'Material')).toHaveValue('');
  expect(
    within(form).getByText('Changed by another player. Your edits are kept.'),
  ).toBeVisible();
  expect(
    within(item('Heavy steel shield')).queryByText(/another player/),
  ).not.toBeInTheDocument();

  fireEvent.submit(form);
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().args).toMatchObject({
    entryId: 'plate',
    enhancement: 3,
    material: null,
  });
  await act(async () =>
    lastCall().reject(new ConvexError('Character is read only')),
  );
  expect(within(form).getByRole('alert')).toHaveTextContent(
    "Changes weren't saved: Character is read only. Your edits are kept. Save to try again.",
  );
  expect(field(form, 'Material')).toHaveValue('');

  fireEvent.click(within(form).getByRole('button', { name: /^Cancel/ }));
  expect(screen.queryByRole('form', { name: 'Edit Full plate' })).toBeNull();
  expect(button('Edit Full plate')).toHaveFocus();
  expect(calls).toHaveLength(1);
});

test('a granted shield with no stored entry is equipped and edited through its row', async () => {
  const base = buildSheet(armored({ sheetEntries: [heavyShield] }));
  const catalog = base.catalogEntries.find(
    (entry) => entry.name === 'Heavy steel shield',
  );
  if (!catalog) throw new Error('Missing shield definition');
  const grantKey = { source: 'fighter', classLevel: 1, entry: 'shield' };
  const granted: CharacterSheetSnapshot = {
    ...base,
    entries: base.entries.filter((entry) => entry._id !== 'shield'),
    calculated: {
      ...base.calculated,
      resolvedEntries: [
        ...base.calculated.resolvedEntries.filter(
          (resolved) => resolved.entry._id !== 'shield',
        ),
        {
          entry: {
            _id: 'granted-shield',
            kind: 'item',
            active: false,
            catalogEntryId: catalog._id,
            grantKey,
            state: { kind: 'item' },
          },
          origin: 'grant',
          recorded: false,
          dormant: false,
          counting: true,
        },
      ],
    },
  };
  renderSheet(granted);
  fireEvent.click(button('Equip Heavy steel shield'));
  expect(lastCall().args).toMatchObject({ grantKey, active: true });
  expect(lastCall().args).not.toHaveProperty('entryId');
  fireEvent.click(button('Edit Heavy steel shield'));
  const form = editor('Heavy steel shield');
  typeInto(field(form, 'Enhancement'), '1');
  fireEvent.submit(form);
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toMatchObject({ grantKey, enhancement: 1 });
});

test('without armor the block says so, with no penalty and no Dexterity limit', () => {
  renderSheet(buildSheet({ levels: [{ id: 'level-1', hp: 10 }] }));
  expect(within(equipment()).getByText('No armor or shields.')).toBeVisible();
  expect(within(equipment()).getByText('No limit')).toBeVisible();
  expect(button('Armor check penalty 0, breakdown')).toBeVisible();
});

test('maintenance disables Equip with the reason stated once in the block and writes nothing', () => {
  const message = 'Editing is paused for maintenance.';
  maintenance.mockReturnValue({ kind: 'maintenance', readOnly: true, message });
  renderSheet(buildSheet(armored()));
  expect(button('Unequip Full plate')).toBeDisabled();
  expect(button('Unequip Full plate')).toHaveAccessibleDescription(message);
  expect(within(equipment()).getAllByText(message)).toHaveLength(1);
  fireEvent.click(button('Unequip Full plate'));
  expect(calls).toEqual([]);
});

test('no Equipment controls render before the sheet arrives', () => {
  renderSheet(undefined);
  expect(screen.queryByRole('region', { name: 'Equipment' })).toBeNull();
});
