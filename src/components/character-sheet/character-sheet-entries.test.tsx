import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ConvexError } from 'convex/values';
import type { ComponentProps } from 'react';
import type * as NavigationGuard from '~/components/campaign-shell/navigation-guard';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { CharacterSheetPage } from './character-sheet-page';
import {
  buildSheet,
  characterId,
  emptyOwnerCandidates,
  type CatalogSheetEntry,
} from './character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';

// Sheet entries (#298): Spell Effects, conditions, items and recorded Spells
// entered from cards with their classification, edited, switched off and
// removed on the living sheet.

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
vi.mock('@convex/_generated/api', () => ({
  api: {
    character: {
      reassignOwner: 'reassignOwner',
      listOwnerCandidates: 'listOwnerCandidates',
    },
    characterSheet: {
      read: 'read',
      createSheetEntry: 'createSheetEntry',
      editSheetEntry: 'editSheetEntry',
      removeSheetEntry: 'removeSheetEntry',
    },
  },
}));
vi.mock('convex/react', () => ({
  useQuery: () => snapshot,
  usePaginatedQuery: () => emptyOwnerCandidates(),
  useMutation: (name: string) => (args: Record<string, unknown>) =>
    new Promise((resolve, reject) => {
      calls.push({ name, args, resolve, reject });
    }),
}));
vi.mock(
  '~/components/campaign-shell/navigation-guard',
  async (importOriginal) => {
    const actual = await importOriginal<typeof NavigationGuard>();
    return {
      ...actual,
      GuardedLink: ({
        href,
        children,
        ...props
      }: ComponentProps<'a'> & { href: string }) => (
        <a href={href} {...props}>
          {children}
        </a>
      ),
    };
  },
);
vi.mock(
  '~/components/ui/select',
  () => import('../weekly-draft-workspace/native-select-test-double'),
);

const page = () => (
  <CharacterSheetPage
    organizationId="org"
    characterId={characterId}
    back={{ href: '/campaigns/campaign-1/characters', label: 'Characters' }}
    campaignName="Ironfang"
  />
);
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
const region = () => screen.getByRole('region', { name: 'Sheet entries' });
const row = (name: string) => within(region()).getByRole('listitem', { name });
const editor = (kind: 'New' | 'Edit') =>
  screen.getByRole('form', { name: `${kind} entry` });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const radio = (name: string) => screen.getByRole('radio', { name });
const field = (name: string) => screen.getByRole('textbox', { name });
const queryField = (name: string) => screen.queryByRole('textbox', { name });
const check = (name: string) => screen.getByRole('checkbox', { name });
const picker = (name: string) => screen.getByRole('combobox', { name });
const strength = (total: number) =>
  screen.getByRole('button', { name: `Strength ${total}, breakdown` });
function lastCall() {
  const call = calls.at(-1);
  if (!call) throw new Error('Expected a write');
  return call;
}
const operationOf = (call: Call) => String(call.args.operationId);

const shield: CatalogSheetEntry = {
  id: 'entry-1',
  name: 'Shield',
  detail: {
    kind: 'spellEffect',
    lastsOverOneDay: false,
    defaultCasterLevel: 6,
  },
  modifiers: [{ target: 'ac.other', bonusType: 'deflection', value: 4 }],
};
const bullStrength: CatalogSheetEntry = {
  id: 'entry-2',
  name: "Bull's strength",
  detail: {
    kind: 'spellEffect',
    lastsOverOneDay: false,
    defaultCasterLevel: 5,
  },
  modifiers: [{ target: 'ability.str', bonusType: 'enhancement', value: 4 }],
};

beforeEach(() => {
  calls = [];
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
  snapshot = undefined;
});

// The Shield draft: its name and its one Modifier, typed into the open editor.
function fillShield() {
  fireEvent.change(field('Name'), { target: { value: 'Shield' } });
  fireEvent.change(picker('Modifier 1 statistic'), {
    target: { value: 'ac.other' },
  });
  fireEvent.change(picker('Modifier 1 bonus type'), {
    target: { value: 'deflection' },
  });
  fireEvent.change(field('Modifier 1 value'), { target: { value: '4' } });
}

// Shield already on the sheet with its editor open.
function openShieldEditor(entry: CatalogSheetEntry = shield) {
  const view = renderSheet(buildSheet({ sheetEntries: [entry] }));
  fireEvent.click(button('Edit Shield'));
  expect(editor('Edit')).toBeVisible();
  return view;
}

test('a new entry starts as a Condition; choosing Spell Effect from the cards shows its duration and caster levels with the default prefilled, and each caster level has its own whole-number message', async () => {
  renderSheet(buildSheet());
  expect(within(region()).getByText('No entries.')).toBeVisible();
  fireEvent.click(button('Add entry'));
  expect(editor('New')).toBeVisible();
  expect(radio('Condition')).toBeChecked();
  expect(queryField('Caster level')).not.toBeInTheDocument();
  expect(within(editor('New')).queryByRole('checkbox')).not.toBeInTheDocument();

  fireEvent.click(radio('Spell Effect'));
  expect(radio('Spell Effect')).toHaveAccessibleDescription(
    /Temporary unless it lasts more than one day/,
  );
  expect(check('Lasts more than one day')).not.toBeChecked();
  expect(field('Default caster level')).toHaveValue('1');
  expect(field('Caster level')).toHaveValue('');
  fireEvent.change(field('Default caster level'), { target: { value: '' } });
  fillShield();
  fireEvent.click(button('Save entry'));
  expect(
    await screen.findByText('Default caster level is required'),
  ).toHaveAttribute('role', 'alert');
  fireEvent.change(field('Default caster level'), { target: { value: 'six' } });
  fireEvent.change(field('Caster level'), { target: { value: '1.5' } });
  fireEvent.click(button('Save entry'));
  expect(
    await screen.findByText(
      'Default caster level must be a whole number of 0 or more',
    ),
  ).toBeVisible();
  expect(
    screen.getByText('Caster level must be a whole number of 0 or more'),
  ).toBeVisible();
  expect(calls).toEqual([]);
});

test('a blank caster level saves as the default, the editor closes after a clean save and the row reads its classification', async () => {
  const view = renderSheet(buildSheet());
  fireEvent.click(button('Add entry'));
  fireEvent.click(radio('Spell Effect'));
  fillShield();
  fireEvent.change(field('Default caster level'), { target: { value: '6' } });
  expect(field('Caster level')).toHaveAttribute('placeholder', '6');
  fireEvent.change(field('Caster level'), { target: { value: '' } });
  fireEvent.click(button('Save entry'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('createSheetEntry');
  expect(lastCall().args).toMatchObject({
    name: 'Shield',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 6,
    },
    casterLevel: 6,
    modifiers: shield.modifiers,
  });
  expect(button('Saving…')).toBeDisabled();
  await act(async () => {
    lastCall().resolve('entry-1');
  });
  view.show(
    buildSheet({
      sheetEntries: [shield],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole('form', { name: 'New entry' })).toBeNull(),
  );
  expect(within(row('Shield')).getByText('Spell Effect · CL 6')).toBeVisible();
  expect(within(row('Shield')).getByText('Temporary')).toBeVisible();
  expect(row('Shield')).toHaveTextContent('+4 deflection to Other AC');
});

test('an existing Spell Effect keeps its kind fixed while its caster level is overridden', async () => {
  const view = openShieldEditor();
  expect(radio('Spell Effect')).toBeChecked();
  for (const kind of ['Spell Effect', 'Condition', 'Item', 'Spell'])
    expect(radio(kind)).toBeDisabled();
  expect(field('Caster level')).toHaveValue('6');
  fireEvent.change(field('Caster level'), { target: { value: '12' } });
  fireEvent.click(button('Save entry'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('editSheetEntry');
  expect(lastCall().args).toMatchObject({
    entryId: 'entry-1',
    casterLevel: 12,
    detail: shield.detail,
  });
  await act(async () => {
    lastCall().resolve(null);
  });
  view.show(
    buildSheet({
      sheetEntries: [{ ...shield, casterLevel: 12 }],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  expect(within(row('Shield')).getByText('Spell Effect · CL 12')).toBeVisible();
  expect(within(editor('Edit')).getByRole('status')).toHaveTextContent(
    'Saved.',
  );
});

test('blanking an overridden caster level restores the default, and a Spell Effect lasting more than one day is no longer Temporary', async () => {
  const view = openShieldEditor({ ...shield, casterLevel: 12 });
  expect(field('Caster level')).toHaveValue('12');
  fireEvent.change(field('Caster level'), { target: { value: '' } });
  fireEvent.click(check('Lasts more than one day'));
  fireEvent.click(button('Save entry'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().args).toMatchObject({
    casterLevel: 6,
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: true,
      defaultCasterLevel: 6,
    },
  });
  await act(async () => {
    lastCall().resolve(null);
  });
  const lasting: CatalogSheetEntry = {
    ...shield,
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: true,
      defaultCasterLevel: 6,
    },
  };
  view.show(
    buildSheet({
      sheetEntries: [lasting],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  expect(
    within(row('Shield')).queryByText('Temporary'),
  ).not.toBeInTheDocument();
  expect(field('Caster level')).toHaveValue('6');
});

/** Saves the new entry, settles its write as `entryId` and shows `next`. */
async function settleNewEntry(
  view: ReturnType<typeof renderSheet>,
  entryId: string,
  next: CatalogSheetEntry[],
) {
  await act(async () => {
    lastCall().resolve(entryId);
  });
  view.show(
    buildSheet({
      sheetEntries: next,
      lastOperationId: operationOf(lastCall()),
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole('form', { name: 'New entry' })).toBeNull(),
  );
}

test('an Item is consumable or lasting and has no caster level; every field has a name', async () => {
  const view = renderSheet(buildSheet());
  fireEvent.click(button('Add entry'));
  fireEvent.click(radio('Item'));
  expect(check('Consumable')).not.toBeChecked();
  expect(queryField('Caster level')).not.toBeInTheDocument();
  expect(queryField('Default caster level')).not.toBeInTheDocument();
  fireEvent.click(check('Consumable'));
  fireEvent.change(field('Name'), { target: { value: 'Potion of heroism' } });
  fireEvent.change(picker('Modifier 1 statistic'), {
    target: { value: 'saves' },
  });
  fireEvent.change(picker('Modifier 1 bonus type'), {
    target: { value: 'morale' },
  });
  fireEvent.change(field('Modifier 1 value'), { target: { value: '2' } });
  for (const textbox of within(editor('New')).getAllByRole('textbox'))
    expect(textbox).toHaveAccessibleName();
  fireEvent.click(button('Save entry'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().args).toMatchObject({
    name: 'Potion of heroism',
    detail: { kind: 'item', consumable: true },
  });
  expect(lastCall().args).not.toHaveProperty('casterLevel');
  const potion: CatalogSheetEntry = {
    id: 'entry-3',
    name: 'Potion of heroism',
    detail: { kind: 'item', consumable: true },
    modifiers: [{ target: 'saves', bonusType: 'morale', value: 2 }],
  };
  await settleNewEntry(view, 'entry-3', [potion]);
  expect(
    within(row('Potion of heroism')).getByText('Consumable item'),
  ).toBeVisible();
  expect(within(row('Potion of heroism')).getByText('Temporary')).toBeVisible();
});

test('a new entry starts as a Condition, which needs nothing more and is Temporary', async () => {
  const view = renderSheet(buildSheet());
  fireEvent.click(button('Add entry'));
  expect(radio('Condition')).toBeChecked();
  expect(within(editor('New')).queryByRole('checkbox')).not.toBeInTheDocument();
  fireEvent.change(field('Name'), { target: { value: 'Shaken' } });
  fireEvent.change(picker('Modifier 1 statistic'), {
    target: { value: 'saves' },
  });
  fireEvent.change(field('Modifier 1 value'), { target: { value: '-2' } });
  fireEvent.click(button('Save entry'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().args).toMatchObject({
    name: 'Shaken',
    detail: { kind: 'condition' },
  });
  const shaken: CatalogSheetEntry = {
    id: 'entry-4',
    name: 'Shaken',
    detail: { kind: 'condition' },
    modifiers: [{ target: 'saves', bonusType: 'untyped', value: -2 }],
  };
  await settleNewEntry(view, 'entry-4', [shaken]);
  expect(within(row('Shaken')).getByText('Condition')).toBeVisible();
  expect(within(row('Shaken')).getByText('Temporary')).toBeVisible();
});

test('a recorded Spell grants no Modifiers and is not Temporary', async () => {
  const view = renderSheet(buildSheet());
  fireEvent.click(button('Add entry'));
  fireEvent.click(radio('Spell'));
  expect(radio('Spell')).toHaveAccessibleDescription(/Grants no Modifiers/);
  expect(screen.queryByRole('list', { name: 'Modifiers' })).toBeNull();
  expect(
    within(editor('New')).getByText('A recorded Spell grants no Modifiers.'),
  ).toBeVisible();
  fireEvent.change(field('Name'), { target: { value: 'Magic missile' } });
  fireEvent.click(button('Save entry'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().args).toMatchObject({
    name: 'Magic missile',
    detail: { kind: 'spell' },
    modifiers: [],
  });
  const missile: CatalogSheetEntry = {
    id: 'entry-5',
    name: 'Magic missile',
    detail: { kind: 'spell' },
    modifiers: [],
  };
  await settleNewEntry(view, 'entry-5', [missile]);
  expect(within(row('Magic missile')).getByText('Spell')).toBeVisible();
  expect(row('Magic missile')).toHaveTextContent('Grants no Modifiers.');
  expect(
    within(row('Magic missile')).queryByText('Temporary'),
  ).not.toBeInTheDocument();
});

test('an entry switched off keeps its definition and its Modifiers stop counting; it leaves with the subscription when removed', async () => {
  const view = renderSheet(buildSheet({ sheetEntries: [bullStrength] }));
  expect(strength(14)).toBeVisible();
  fireEvent.click(button("Edit Bull's strength"));
  const toggle = screen.getByRole('switch', {
    name: "Bull's strength: active",
  });
  fireEvent.click(toggle);
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('editSheetEntry');
  expect(lastCall().args).toMatchObject({ entryId: 'entry-2', active: false });
  expect(lastCall().args).not.toHaveProperty('name');
  expect(toggle).toBeDisabled();
  await act(async () => {
    lastCall().resolve(null);
  });
  view.show(
    buildSheet({
      sheetEntries: [{ ...bullStrength, active: false }],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  expect(
    screen.getByRole('switch', { name: "Bull's strength: inactive" }),
  ).toHaveAttribute('aria-checked', 'false');
  expect(within(row("Bull's strength")).getByText('Inactive')).toBeVisible();
  expect(strength(10)).toBeVisible();
  expect(field('Modifier 1 value')).toHaveValue('4');
  expect(field('Modifier 1 value')).toBeEnabled();
  expect(within(region()).getByText('Sheet entries saved.')).toBeVisible();

  fireEvent.click(button("Remove Bull's strength"));
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().name).toBe('removeSheetEntry');
  await act(async () => {
    lastCall().resolve(null);
  });
  expect(row("Bull's strength")).toBeVisible();
  view.show(
    buildSheet({ sheetEntries: [], lastOperationId: operationOf(lastCall()) }),
  );
  expect(within(region()).getByText('No entries.')).toBeVisible();
  expect(
    within(region()).getByText('This entry is no longer on the sheet.'),
  ).toBeVisible();
});

test("a refused save keeps the classification and Modifier drafts; another player's classification change is announced while an own echo is quiet", async () => {
  const view = renderSheet(buildSheet({ sheetEntries: [shield] }));
  fireEvent.click(button('Edit Shield'));
  fireEvent.change(field('Caster level'), { target: { value: '9' } });
  fireEvent.change(field('Modifier 1 value'), { target: { value: '5' } });
  fireEvent.click(button('Save entry'));
  await waitFor(() => expect(calls).toHaveLength(1));
  await act(async () => {
    lastCall().reject(new ConvexError('Not now'));
  });
  expect(within(editor('Edit')).getByRole('alert')).toHaveTextContent(
    "Changes weren't saved: Not now. Your edits are kept. Save to try again.",
  );
  expect(field('Caster level')).toHaveValue('9');
  expect(field('Modifier 1 value')).toHaveValue('5');
  expect(within(editor('Edit')).queryByText('Saved.')).not.toBeInTheDocument();

  view.show(
    buildSheet({
      sheetEntries: [{ ...shield, casterLevel: 7 }],
      lastOperationId: 'other-player',
    }),
  );
  expect(within(row('Shield')).getByText('Spell Effect · CL 7')).toBeVisible();
  expect(field('Caster level')).toHaveValue('9');
  expect(field('Modifier 1 value')).toHaveValue('5');
  expect(within(region()).getByText('Sheet entries changed.')).toBeVisible();
  expect(
    within(editor('Edit')).getByText(
      'This entry changed while you were editing. Your edits are kept.',
    ),
  ).toBeVisible();
  fireEvent.click(button('Dismiss entries update'));
  fireEvent.click(button('Dismiss entry update'));
  expect(
    within(region()).queryByText(/changed|another player/),
  ).not.toBeInTheDocument();

  fireEvent.click(button('Save entry'));
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toMatchObject({
    entryId: 'entry-1',
    casterLevel: 9,
    modifiers: [{ target: 'ac.other', bonusType: 'deflection', value: 5 }],
  });
  await act(async () => {
    lastCall().resolve(null);
  });
  view.show(
    buildSheet({
      sheetEntries: [
        {
          ...shield,
          casterLevel: 9,
          modifiers: [
            { target: 'ac.other', bonusType: 'deflection', value: 5 },
          ],
        },
      ],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  expect(
    within(region()).queryByText(/changed|another player/),
  ).not.toBeInTheDocument();
  expect(within(editor('Edit')).getByRole('status')).toHaveTextContent(
    'Saved.',
  );
});

test('maintenance disables adding, switching, removing and every editor field, with the reason beside them', () => {
  const message = 'Editing is paused for maintenance.';
  maintenance.mockReturnValue({ kind: 'maintenance', readOnly: true, message });
  renderSheet(buildSheet({ sheetEntries: [shield] }));
  expect(button('Add entry')).toBeDisabled();
  expect(screen.getByRole('switch', { name: 'Shield: active' })).toBeDisabled();
  expect(button('Remove Shield')).toBeDisabled();
  expect(within(region()).getAllByText(message).length).toBeGreaterThan(0);
  fireEvent.click(button('Edit Shield'));
  expect(field('Name')).toBeDisabled();
  expect(field('Caster level')).toBeDisabled();
  expect(check('Lasts more than one day')).toBeDisabled();
  expect(field('Modifier 1 value')).toBeDisabled();
  expect(button('Modifier 1 as formula')).toBeDisabled();
  expect(button('Save entry')).toBeDisabled();
  fireEvent.submit(editor('Edit'));
  expect(calls).toEqual([]);
});
