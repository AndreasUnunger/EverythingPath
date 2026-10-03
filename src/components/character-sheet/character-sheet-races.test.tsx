import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import type { CharacterSheetCatalogEntry } from '~/lib/character-sheet';
import { CharacterSheetRaces } from './character-sheet-races';
import { buildSheet, type RacialTrait } from './character-sheet-test-fixture';
import { buildCharacterSheetView } from './character-sheet-view-model';
import type { SaveStatus } from './save-status';
import type {
  CharacterSheetSnapshot,
  useCharacterSheet,
} from './use-character-sheet';

// The race block (#304): the race chosen among cards, the +2 of choice, the
// race's traits with replaced standards beneath their alternates, alternates
// and subrace options as cards, manual replacements, and racial Hit Dice.

type Controller = ReturnType<typeof useCharacterSheet>;
type Write = { name: string; args: unknown[]; resolve: (o: boolean) => void };

let writes: Write[] = [];
let statuses: Record<string, SaveStatus> = {};
let hasRemoteChange = false;
const dismissRemoteChange = vi.fn();
const maintenance = vi.fn<() => MigrationMaintenance>();
const warningController: Controller['warnings'] = {
  accept: vi.fn(() => Promise.resolve()),
  reopen: vi.fn(() => Promise.resolve()),
  statusFor: () => ({ kind: 'idle' }),
  hasRemoteChange: false,
  dismissRemoteChange: vi.fn(),
};

vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => maintenance(),
}));
vi.mock(
  '~/components/ui/select',
  () => import('../weekly-draft-workspace/native-select-test-double'),
);

beforeEach(() => {
  writes = [];
  statuses = {};
  hasRemoteChange = false;
  vi.clearAllMocks();
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
});

const record =
  (name: string) =>
  (...args: unknown[]) =>
    new Promise<boolean>((resolve) => {
      writes.push({ name, args, resolve });
    });
const statusFor = (key: string) => statuses[key] ?? { kind: 'idle' as const };
function buildRaceActions(): Controller['races'] {
  return {
    statusFor,
    hasRemoteChange,
    dismissRemoteChange,
    selectRace: record('selectRace'),
    chooseAbilityScore: record('chooseAbilityScore'),
    setTraitSelected: record('setTraitSelected'),
    setReplacements: record('setReplacements'),
    chooseRaceEquivalence: record('chooseRaceEquivalence'),
    editStatistics: record('editStatistics'),
  };
}
function buildGrantActions(): Controller['grants'] {
  return {
    statusFor,
    hasRemoteChange: false,
    dismissRemoteChange: vi.fn(),
    setKept: record('setKept'),
    discard: record('discard'),
    edit: record('edit'),
  };
}

function renderRaces(initial: CharacterSheetSnapshot) {
  let snapshot = initial;
  const ui = () => {
    const sheet = buildCharacterSheetView(snapshot);
    return (
      <CharacterSheetRaces
        races={sheet.races}
        statistics={sheet.raceStatistics}
        raceNames={sheet.raceNames}
        calculated={sheet.calculated}
        actions={buildRaceActions()}
        grants={buildGrantActions()}
        warnings={sheet.warnings}
        warningController={warningController}
      />
    );
  };
  const view = render(ui());
  return {
    rerender(next = snapshot) {
      snapshot = next;
      view.rerender(ui());
    },
  };
}

const item = (name: string) => screen.getByRole('listitem', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const checkbox = (name: string) => screen.getByRole('checkbox', { name });
const radio = (name: RegExp) => screen.getByRole('radio', { name });
const select = (name: string) =>
  screen.getByRole<HTMLSelectElement>('combobox', { name });
function lastWrite() {
  const write = writes.at(-1);
  if (!write) throw new Error('Expected a write');
  return write;
}
function rowIdOf(snapshot: CharacterSheetSnapshot, name: string) {
  const row = snapshot.calculated.resolvedEntries.find(
    ({ entry }) =>
      'catalogEntryId' in entry &&
      snapshot.catalogEntries.find((c) => c._id === entry.catalogEntryId)
        ?.name === name,
  );
  if (!row) throw new Error(`Expected a row named ${name}`);
  return row.entry._id;
}

const streets: RacialTrait = { id: 'streets', key: 'human-heart-of-streets' };
const humanTrait = (facts: Partial<CharacterSheetCatalogEntry>) =>
  ({
    modifiers: [],
    sources: [],
    ...facts,
  }) as CharacterSheetCatalogEntry;
const unresolvedAlternate = humanTrait({
  _id: 'human-unresolved',
  name: 'Unresolved Alternate',
  ruleIdentity: 'human-unresolved',
  detail: {
    kind: 'racialTrait',
    raceEntryIds: ['human'],
    replaces: [],
    unresolvedReplacements: ['Skilled'],
  },
});
const secondAlternate = humanTrait({
  _id: 'human-alt-b',
  name: 'Second Alternate',
  ruleIdentity: 'human-alt-b',
  detail: {
    kind: 'racialTrait',
    raceEntryIds: ['human'],
    replaces: ['human-skilled'],
  },
});

test('the race cards select a race, "No race" clears it, and the cards wait on the race save', () => {
  const view = renderRaces(buildSheet({ hasRaces: true }));
  expect(radio(/^No race/)).toBeChecked();
  expect(
    screen.getByText('Choose a race to see its racial traits.'),
  ).toBeVisible();

  fireEvent.click(radio(/^Elf/));
  expect(lastWrite()).toMatchObject({ name: 'selectRace', args: ['elf'] });

  view.rerender(buildSheet({ race: { key: 'elf' } }));
  expect(radio(/^Elf/)).toBeChecked();
  expect(screen.getByText('medium · humanoid (elf)')).toBeVisible();
  fireEvent.click(radio(/^No race/));
  expect(lastWrite()).toMatchObject({ name: 'selectRace', args: [null] });

  statuses.race = { kind: 'saving' };
  view.rerender();
  expect(radio(/^Elf/)).toBeDisabled();
  expect(screen.getByText('Saving race…')).toBeVisible();
  statuses.race = { kind: 'saved' };
  view.rerender();
  expect(screen.getByText('Race saved.')).toBeVisible();
});

test('a human starts without its +2, prompted in blue, and chooses or clears it through the Grant target', () => {
  const snapshot = buildSheet({ race: { key: 'human' } });
  const view = renderRaces(snapshot);
  const ability = select('+2 ability score');
  expect(ability.value).toBe('none');
  expect(ability.className).toContain('ring-sky-400/80');
  expect(
    screen.getByText('Choose an ability score for this racial adjustment.'),
  ).toHaveClass('text-sky-300');
  expect(
    screen.getByText('No ability score adjustment from race is counting.'),
  ).toBeVisible();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

  fireEvent.change(ability, { target: { value: 'constitution' } });
  const grantKey = { source: 'human', entry: 'human-ability' };
  expect(lastWrite()).toMatchObject({
    name: 'chooseAbilityScore',
    args: [{ grantKey }, 'constitution', rowIdOf(snapshot, 'Ability Score')],
  });

  view.rerender(
    buildSheet({
      race: { key: 'human' },
      racialTraits: [
        {
          id: 'ability',
          key: 'human-ability',
          grantKey,
          choice: 'constitution',
        },
      ],
    }),
  );
  expect(select('+2 ability score').value).toBe('constitution');
  expect(select('+2 ability score').className).not.toContain('ring-sky');
  expect(screen.queryByText(/^Choice:/)).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Constitution 12, breakdown' }),
  ).toBeVisible();
  fireEvent.change(select('+2 ability score'), { target: { value: '' } });
  expect(lastWrite().args).toEqual([{ grantKey }, null, expect.any(String)]);
});

test('an alternate is selected and deselected by its card; selected it nests the replaced standard muted with Keep, and off it restores the standard', () => {
  const view = renderRaces(buildSheet({ race: { key: 'human' } }));
  expect(checkbox('Heart of the Streets selected')).not.toBeChecked();
  expect(screen.getByRole('switch', { name: 'Skilled: on' })).toBeVisible();
  fireEvent.click(checkbox('Heart of the Streets selected'));
  expect(lastWrite()).toMatchObject({
    name: 'setTraitSelected',
    args: ['human-heart-of-streets', true],
  });

  view.rerender(
    buildSheet({ race: { key: 'human' }, racialTraits: [streets] }),
  );
  const alternate = item('Heart of the Streets');
  expect(within(alternate).getByText('Replaces Skilled')).toBeVisible();
  const replaced = within(alternate).getByRole('listitem', { name: 'Skilled' });
  expect(
    within(replaced).getByText('Replaced by Heart of the Streets'),
  ).toBeVisible();
  expect(within(replaced).getByText('Not counting now')).toBeVisible();
  expect(
    within(replaced).getByRole('button', { name: 'Keep Skilled' }),
  ).toBeVisible();
  expect(checkbox('Heart of the Streets selected')).toBeChecked();
  fireEvent.click(checkbox('Heart of the Streets selected'));
  expect(lastWrite()).toMatchObject({
    name: 'setTraitSelected',
    args: ['human-heart-of-streets', false],
  });

  view.rerender(
    buildSheet({
      race: { key: 'human' },
      racialTraits: [{ ...streets, active: false }],
    }),
  );
  expect(screen.getByRole('switch', { name: 'Skilled: on' })).toBeChecked();
  expect(within(item('Heart of the Streets')).getByText('Off')).toBeVisible();
  expect(
    within(item('Skilled')).queryByText(/Replaced by/),
  ).not.toBeInTheDocument();
});

test('subrace options are chosen one at a time, and an unresolved alternate takes explicit replacements, none, or a reset', async () => {
  const view = renderRaces(buildSheet({ race: { key: 'elf' } }));
  const subrace = screen.getByRole('list', {
    name: 'Illustrative Elf Subrace',
  });
  expect(within(subrace).getAllByRole('checkbox')).toHaveLength(2);
  fireEvent.click(checkbox('Illustrative Elf Subrace selected'));
  expect(writes).toHaveLength(1);
  expect(lastWrite().args).toEqual(['elf-illustrative-subrace-ability', true]);

  const unresolved: RacialTrait = { id: 'unres-row', key: 'human-unresolved' };
  view.rerender(
    buildSheet({
      race: { key: 'human' },
      racialTraits: [unresolved],
      extraCatalog: [unresolvedAlternate],
    }),
  );
  const group = screen.getByRole('group', {
    name: 'Choose replaced traits: Skilled',
  });
  expect(
    within(group).queryByRole('button', { name: /Reset to definition/ }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    within(group).getByRole('button', { name: /^Save replaced traits/ }),
  );
  expect(lastWrite()).toMatchObject({
    name: 'setReplacements',
    args: ['unres-row', []],
  });
  fireEvent.click(checkbox('Unresolved Alternate replaces Skilled'));
  fireEvent.click(
    within(group).getByRole('button', { name: /^Save replaced traits/ }),
  );
  expect(lastWrite().args).toEqual(['unres-row', ['human-skilled']]);
  await act(async () => {
    lastWrite().resolve(false);
  });
  statuses['unres-row'] = {
    kind: 'error',
    message: "Replaced traits weren't saved. Try again.",
  };
  view.rerender();
  expect(within(group).getByRole('alert')).toHaveTextContent(
    "Replaced traits weren't saved. Try again.",
  );

  statuses = {};
  view.rerender(
    buildSheet({
      race: { key: 'human' },
      racialTraits: [{ ...unresolved, replaces: [] }],
      extraCatalog: [unresolvedAlternate],
    }),
  );
  fireEvent.click(button(/^Reset to definition/));
  expect(lastWrite().args).toEqual(['unres-row', null]);
});

test('a duplicate replacement warns with Accept while an unresolved replacement cannot be accepted', () => {
  renderRaces(
    buildSheet({
      race: { key: 'human' },
      racialTraits: [
        streets,
        { id: 'second', key: 'human-alt-b' },
        { id: 'unres-row', key: 'human-unresolved' },
      ],
      extraCatalog: [secondAlternate, unresolvedAlternate],
    }),
  );
  const skilled = screen.getAllByRole('listitem', { name: 'Skilled' })[0];
  if (!skilled) throw new Error('Expected the Skilled row');
  expect(
    within(skilled).getByText(
      'Skilled is replaced by more than one alternate.',
    ),
  ).toBeVisible();
  fireEvent.click(within(skilled).getByRole('button', { name: 'Accept' }));
  expect(warningController.accept).toHaveBeenCalledWith(
    expect.objectContaining({ check: 'racialReplacementDuplicate' }),
  );

  const unresolved = item('Unresolved Alternate');
  expect(
    within(unresolved).getByText(
      'Choose the standard traits replaced by Unresolved Alternate: Skilled.',
    ),
  ).toHaveClass('text-muted-foreground');
  expect(
    within(unresolved).queryByRole('button', { name: /Accept|Reopen/ }),
  ).not.toBeInTheDocument();
});

test('a trait of another race stays dormant with its notes, Keep and Discard through the grant methods', async () => {
  renderRaces(
    buildSheet({
      race: { key: 'elf' },
      racialTraits: [{ ...streets, notes: 'From before the elf' }],
    }),
  );
  expect(checkbox('Heart of the Streets selected')).toBeChecked();
  expect(
    within(
      screen.getByRole('list', { name: 'Traits of other races' }),
    ).getAllByText('Belongs to another race').length,
  ).toBeGreaterThan(0);
  fireEvent.click(button('Not counting now (1)'));
  const row = item('Heart of the Streets');
  expect(within(row).getByText('From before the elf')).toBeVisible();
  expect(
    within(row).getByText('Its source is no longer active.'),
  ).toBeVisible();

  fireEvent.click(
    within(row).getByRole('button', { name: 'Keep Heart of the Streets' }),
  );
  expect(lastWrite()).toMatchObject({
    name: 'setKept',
    args: [expect.objectContaining({ target: { entryId: 'streets' } }), true],
  });
  fireEvent.click(
    within(row).getByRole('button', { name: 'Discard Heart of the Streets' }),
  );
  fireEvent.click(
    within(row).getByRole('button', { name: /^Discard saved state/ }),
  );
  expect(lastWrite()).toMatchObject({
    name: 'discard',
    args: [expect.objectContaining({ target: { entryId: 'streets' } })],
  });
  await act(async () => {
    lastWrite().resolve(true);
  });
});

test("an empty catalog, a refused race save and another player's change are stated where the player works", () => {
  const view = renderRaces(buildSheet());
  expect(screen.getByText('No races available.')).toBeVisible();

  statuses.race = { kind: 'error', message: "Race wasn't saved. Try again." };
  hasRemoteChange = true;
  view.rerender(buildSheet({ hasRaces: true }));
  expect(screen.getByRole('alert')).toHaveTextContent(
    "Race wasn't saved. Try again.",
  );
  expect(radio(/^Human/)).toBeEnabled();
  expect(screen.getByText('Race or racial traits changed.')).toBeVisible();
  fireEvent.click(button('Dismiss race update'));
  expect(dismissRemoteChange).toHaveBeenCalledTimes(1);
});

test('racial Hit Dice start with unknown hit points, refuse malformed numbers and empty ranks, and save what was typed', async () => {
  renderRaces(buildSheet({ race: { key: 'human', hitDice: 3 } }));
  const form = screen.getByRole('form', { name: 'Racial Hit Dice' });
  expect(within(form).getByText('3 racial Hit Dice')).toBeVisible();
  const hitPoints = within(form).getByRole('textbox', {
    name: 'Racial hit points',
  });
  expect(hitPoints).toHaveValue('');
  expect(hitPoints).toHaveAttribute('placeholder', 'Enter racial hit points');

  fireEvent.change(hitPoints, { target: { value: 'abc' } });
  fireEvent.submit(form);
  expect(await within(form).findByRole('alert')).toHaveTextContent(
    'Racial hit points must be a whole number of 0 or more',
  );
  expect(writes).toHaveLength(0);

  fireEvent.change(hitPoints, { target: { value: '' } });
  fireEvent.click(within(form).getByRole('button', { name: 'Add skill' }));
  fireEvent.change(within(form).getByRole('textbox', { name: 'Skill 1' }), {
    target: { value: 'Perception' },
  });
  fireEvent.submit(form);
  expect(await within(form).findByText('Ranks are required')).toHaveAttribute(
    'role',
    'alert',
  );
  const ranks = within(form).getByRole('textbox', {
    name: 'Ranks for skill 1',
  });
  fireEvent.change(ranks, { target: { value: 'x' } });
  fireEvent.submit(form);
  expect(
    await within(form).findByText('Ranks must be a whole number of 0 or more'),
  ).toBeVisible();
  fireEvent.change(ranks, { target: { value: '2' } });
  fireEvent.submit(form);
  await act(() => Promise.resolve());
  expect(lastWrite()).toMatchObject({
    name: 'editStatistics',
    args: [
      'race-entry',
      { racialHpGained: null, racialSkillRanks: { Perception: 2 } },
    ],
  });
});

test("another player's replacements reach the open editor, and a reset to the definition drops the unsaved picks", () => {
  const unresolved: RacialTrait = { id: 'unres-row', key: 'human-unresolved' };
  const withReplaces = (replaces?: string[]) =>
    buildSheet({
      race: { key: 'human' },
      racialTraits: [{ ...unresolved, replaces }],
      extraCatalog: [unresolvedAlternate],
    });
  const view = renderRaces(withReplaces([]));
  const skilled = 'Unresolved Alternate replaces Skilled';
  expect(checkbox(skilled)).not.toBeChecked();

  view.rerender(withReplaces(['human-skilled']));
  expect(checkbox(skilled)).toBeChecked();

  fireEvent.click(checkbox(skilled));
  expect(checkbox(skilled)).not.toBeChecked();
  view.rerender(withReplaces([]));
  fireEvent.click(checkbox(skilled));
  fireEvent.click(button(/^Reset to definition/));
  expect(lastWrite().args).toEqual(['unres-row', null]);

  view.rerender(withReplaces(undefined));
  expect(checkbox(skilled)).not.toBeChecked();
  fireEvent.click(button(/^Save replaced traits/));
  expect(lastWrite().args).toEqual(['unres-row', []]);
});

test('racial Hit Dice follow saved values, and switching races starts the new race from its own row', async () => {
  const human = { key: 'human', id: 'human-row', hitDice: 2 } as const;
  const view = renderRaces(buildSheet({ race: human }));
  const hitPoints = () =>
    screen.getByRole('textbox', { name: 'Racial hit points' });
  expect(hitPoints()).toHaveValue('');

  view.rerender(
    buildSheet({
      race: { ...human, racialHpGained: 9, racialSkillRanks: { Climb: 2 } },
    }),
  );
  expect(hitPoints()).toHaveValue('9');
  expect(screen.getByRole('textbox', { name: 'Skill 1' })).toHaveValue('Climb');

  fireEvent.change(hitPoints(), { target: { value: '5' } });
  view.rerender(
    buildSheet({ race: { key: 'elf', id: 'elf-row', hitDice: 2 } }),
  );
  expect(hitPoints()).toHaveValue('');
  expect(
    screen.queryByRole('textbox', { name: 'Skill 1' }),
  ).not.toBeInTheDocument();
  fireEvent.submit(screen.getByRole('form', { name: 'Racial Hit Dice' }));
  await act(() => Promise.resolve());
  expect(lastWrite()).toMatchObject({
    name: 'editStatistics',
    args: ['elf-row', { racialHpGained: null, racialSkillRanks: {} }],
  });
});
