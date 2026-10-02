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
import { beforeEach, expect, test, vi } from 'vitest';
import type { Id } from '@convex/_generated/dataModel';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  defaultAbilityScores,
  type AbilityScores,
} from '~/lib/character-sheet';
import { CharacterSheetPage } from './character-sheet-page';
import type { CharacterSheetSnapshot } from './use-character-sheet';

// The living sheet (#256): one Character's summary, Class Levels and base
// scores, edited by several players at once.

type Call = {
  name: string;
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
let calls: Call[] = [];
let snapshot: CharacterSheetSnapshot | null | undefined;
let scrollIntoView = vi.fn();
const maintenance = vi.fn<() => MigrationMaintenance>();

vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => maintenance(),
}));

vi.mock('@convex/_generated/api', () => ({
  api: {
    characterSheet: {
      read: 'read',
      editBaseScores: 'scores',
      editClassLevel: 'hp',
      addClassLevel: 'add',
      moveClassLevel: 'move',
      deleteClassLevel: 'delete',
      create: 'create',
    },
  },
}));
vi.mock('convex/react', () => ({
  useQuery: () => snapshot,
  useMutation: (name: string) => (args: Record<string, unknown>) =>
    new Promise((resolve, reject) => {
      calls.push({ name, args, resolve, reject });
    }),
}));
vi.mock('~/components/campaign-shell/navigation-guard', () => ({
  GuardedLink: ({
    href,
    children,
    ...props
  }: ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const characterId = 'character-1' as Id<'character'>;
type Level = { id: string; hp: number | null };
type Entry = CharacterSheetSnapshot['entries'][number];

function sheet({
  scores = defaultAbilityScores,
  levels = [{ id: 'level-1', hp: null }],
  lastOperationId = 'seed',
  name = 'Kesh',
}: {
  scores?: AbilityScores;
  levels?: Level[];
  lastOperationId?: string;
  name?: string;
} = {}): CharacterSheetSnapshot {
  const catalogEntry = {
    _id: 'base-catalogEntry' as Id<'catalogEntry'>,
    _creationTime: 1,
    scope: 'character',
    characterId,
    name: 'Base scores',
    ruleIdentity: 'base',
    stacksWithItself: false,
    detail: { kind: 'base' },
    sources: [],
    modifiers: abilityKeys.map((ability) => ({
      target: abilityTargets[ability],
      bonusType: 'base',
      value: scores[ability],
    })),
  } as unknown as CharacterSheetSnapshot['catalogEntries'][number];
  const entries: Entry[] = [
    {
      _id: 'base-entry' as Id<'characterSheetEntry'>,
      _creationTime: 1,
      characterId,
      kind: 'base',
      active: true,
      catalogEntryId: catalogEntry._id,
      state: {
        kind: 'base',
      },
    } as Entry,
    ...levels.map(
      (level, index) =>
        ({
          _id: level.id as Id<'characterSheetEntry'>,
          _creationTime: 2 + index,
          characterId,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            classEntryId: null,
            position: index + 1,
            hpGained: level.hp,
          },
        }) as Entry,
    ),
  ];
  return {
    character: {
      _id: characterId,
      _creationTime: 1,
      campaignId: 'campaign-1' as Id<'campaign'>,
      name,
      description: 'Rides with the militia.',
      ownerId: 'owner',
      kind: 'pc',
      isActive: true,
      sheetMode: 'full',
      level: 1,
      ...defaultAbilityScores,
    },
    entries,
    catalogEntries: [catalogEntry],
    baseScoresEntry: catalogEntry,
    calculated: calculateCharacterSheet({
      entries,
      catalogEntries: [catalogEntry],
    }),
    revision: 1,
    lastOperationId,
    updatedBy: 'owner',
  };
}

// A fresh element each time: React skips re-rendering an identical one.
const page = () => (
  <CharacterSheetPage
    organizationId="org"
    characterId={characterId}
    back={{
      href: '/campaigns/campaign-1/characters',
      label: 'Characters & officers',
    }}
    campaignName="Ironfang"
  />
);
function renderSheet(initial: CharacterSheetSnapshot) {
  snapshot = initial;
  const view = render(page());
  return {
    ...view,
    show(next: CharacterSheetSnapshot) {
      snapshot = next;
      view.rerender(page());
    },
  };
}
function row(name: string) {
  return screen.getByRole('listitem', { name });
}
function hpInput(name: string) {
  return within(row(name)).getByRole('textbox', { name: /^Hit points gained/ });
}
function scoresRegion() {
  return screen.getByRole('region', { name: 'Ability scores' });
}
function score(name: string) {
  return within(scoresRegion()).getByRole('textbox', { name });
}
function levelsRegion() {
  return screen.getByRole('region', { name: 'Class Levels' });
}
function fieldValue(label: string) {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling;
}
function deleteQuestion(level: number) {
  return within(row(`Level ${level}`)).getByRole('group', {
    name: `Delete Unspecified (level ${level})?`,
  });
}
function lastCall() {
  const call = calls.at(-1);
  if (!call) throw new Error('Expected a write');
  return call;
}
const operationOf = (call: Call) => String(call.args.operationId);

beforeEach(() => {
  calls = [];
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
  snapshot = undefined;
  scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
});

test('maintenance keeps the sheet readable and navigation available while disabling every edit with a nearby reason', async () => {
  const message = 'Editing is paused for maintenance.';
  maintenance.mockReturnValue({ kind: 'maintenance', readOnly: true, message });
  renderSheet(
    sheet({
      levels: [
        { id: 'a', hp: 8 },
        { id: 'b', hp: 5 },
      ],
    }),
  );

  expect(screen.getByRole('heading', { name: 'Kesh' })).toBeVisible();
  for (const input of within(scoresRegion()).getAllByRole('textbox')) {
    expect(input).toBeDisabled();
    expect(input).toHaveValue('10');
  }
  expect(screen.getByRole('button', { name: 'Save scores' })).toBeDisabled();
  expect(within(scoresRegion()).getByText(message)).toBeVisible();
  for (const level of [1, 2]) {
    const levelRow = within(row(`Level ${level}`));
    expect(hpInput(`Level ${level}`)).toBeDisabled();
    for (const name of [
      'Save hit points',
      `Move level ${level} up`,
      `Move level ${level} down`,
      `Delete level ${level}`,
    ]) {
      expect(levelRow.getByRole('button', { name })).toBeDisabled();
    }
    expect(levelRow.getByText(message)).toBeVisible();
  }
  expect(hpInput('Level 1')).toHaveValue('8');
  expect(hpInput('Level 2')).toHaveValue('5');
  const levelUp = screen.getByRole('button', { name: 'Level up' });
  expect(levelUp).toBeDisabled();
  const back = screen.getByRole('link', { name: 'Characters & officers' });
  expect(back).toHaveAttribute('href', '/campaigns/campaign-1/characters');
  back.focus();
  expect(back).toHaveFocus();
  fireEvent.click(levelUp);
  await act(async () => {
    fireEvent.submit(screen.getByRole('form', { name: 'Ability scores' }));
    fireEvent.submit(screen.getByRole('form', { name: 'Level 1 hit points' }));
  });
  expect(calls).toEqual([]);
});

test('a fresh sheet shows the name once, one blank Unspecified level and six tens, with Back to the origin', () => {
  renderSheet(sheet());
  expect(screen.getByRole('heading', { level: 1, name: 'Kesh' })).toBeVisible();
  expect(screen.getAllByText('Kesh')).toHaveLength(1);
  expect(
    screen.getByRole('link', { name: 'Characters & officers' }),
  ).toHaveAttribute('href', '/campaigns/campaign-1/characters');
  expect(within(levelsRegion()).getAllByRole('listitem')).toHaveLength(1);
  expect(within(row('Level 1')).getByText('Unspecified')).toBeVisible();
  expect(hpInput('Level 1')).toHaveValue('');
  expect(hpInput('Level 1')).toHaveAttribute('inputmode', 'decimal');
  for (const name of [
    'Strength',
    'Dexterity',
    'Constitution',
    'Intelligence',
    'Wisdom',
    'Charisma',
  ]) {
    expect(score(name)).toHaveValue('10');
    expect(score(name)).toBeEnabled();
  }
  // The summary: level and Hit Dice count the levels; HP waits for a choice.
  expect(fieldValue('HP')).toHaveTextContent('not complete');
  expect(fieldValue('Level')).toHaveTextContent('1');
  expect(screen.getByText('Level 2 as')).toBeVisible();
  // The kind is a Character field, not part of the pinned summary.
  expect(fieldValue('Kind')).toHaveTextContent('PC');
  expect(document.querySelector('[data-sheet-summary]')).not.toHaveTextContent(
    'PC',
  );
  expect(screen.getByText('Rides with the militia.')).toBeVisible();
  // No roll, average or maximum HP helpers; no mode or storage copy.
  expect(
    screen.queryByRole('button', { name: /roll|average|max/i }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText(/Full|Militia-only|revision|\/characters\//),
  ).not.toBeInTheDocument();
  // The base-scores entry cannot be removed or disabled.
  expect(
    within(scoresRegion()).queryByRole('button', {
      name: /delete|remove|disable/i,
    }),
  ).not.toBeInTheDocument();
  expect(
    within(scoresRegion()).queryByRole('checkbox'),
  ).not.toBeInTheDocument();
});

test('loading keeps the frame and a legacy character without a sheet is not initialized', () => {
  snapshot = undefined;
  const view = render(page());
  expect(
    screen.getByRole('status', { name: 'Loading character sheet…' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Characters & officers' }),
  ).toBeVisible();
  snapshot = null;
  view.rerender(page());
  expect(
    screen.getByText("This character's sheet is not available here yet."),
  ).toBeVisible();
  expect(
    screen.getByRole('link', { name: 'Characters & officers' }),
  ).toBeVisible();
  expect(calls).toEqual([]);
});

test('score fields tell an empty value from a malformed one, and unusual scores still save', async () => {
  renderSheet(sheet());
  fireEvent.change(score('Strength'), { target: { value: '' } });
  fireEvent.change(score('Dexterity'), { target: { value: 'twelve' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save scores' }));
  expect(
    await within(scoresRegion()).findByText('Strength is required'),
  ).toHaveAttribute('role', 'alert');
  expect(
    within(scoresRegion()).getByText('Dexterity must be a number'),
  ).toBeVisible();
  expect(score('Strength')).toHaveAttribute('aria-invalid', 'true');
  expect(score('Strength')).toHaveAccessibleDescription(/Strength is required/);
  expect(score('Constitution')).not.toHaveAttribute('aria-invalid', 'true');
  expect(calls).toEqual([]);
  fireEvent.change(score('Strength'), { target: { value: '-2' } });
  fireEvent.change(score('Dexterity'), { target: { value: '99.5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save scores' }));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('scores');
  expect(lastCall().args.scores).toEqual({ strength: -2, dexterity: 99.5 });
  expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  await act(async () => {
    lastCall().resolve(null);
  });
  expect(await within(scoresRegion()).findByRole('status')).toHaveTextContent(
    'Scores saved.',
  );
  expect(within(scoresRegion()).queryByRole('alert')).not.toBeInTheDocument();
});

test('hit points accept blank, zero and fractions, and refuse text in place', async () => {
  renderSheet(sheet({ levels: [{ id: 'a', hp: 8 }] }));
  const input = hpInput('Level 1');
  expect(input).toHaveValue('8');
  fireEvent.change(input, { target: { value: 'oops' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save hit points' }));
  expect(await within(row('Level 1')).findByRole('alert')).toHaveTextContent(
    'Hit points must be a number',
  );
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(calls).toEqual([]);
  for (const [typed, saved] of [
    ['0', 0],
    ['', null],
    ['4.5', 4.5],
  ] as const) {
    fireEvent.change(input, { target: { value: typed } });
    fireEvent.click(screen.getByRole('button', { name: 'Save hit points' }));
    await waitFor(() => expect(lastCall().args.hpGained).toBe(saved));
    expect(lastCall().name).toBe('hp');
    expect(lastCall().args.entryId).toBe('a');
    await act(async () => {
      lastCall().resolve(null);
    });
    expect(await within(row('Level 1')).findByRole('status')).toHaveTextContent(
      'Hit points saved.',
    );
  }
  expect(calls).toHaveLength(3);
  expect(within(row('Level 1')).queryByRole('alert')).not.toBeInTheDocument();
});

test('a refused score save is reported beside the scores while a hit points save still completes, and the refused edit stays editable', async () => {
  renderSheet(sheet({ levels: [{ id: 'a', hp: null }] }));
  fireEvent.change(score('Strength'), { target: { value: '14' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save scores' }));
  await waitFor(() => expect(calls).toHaveLength(1));
  fireEvent.change(hpInput('Level 1'), { target: { value: '8' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save hit points' }));
  await waitFor(() => expect(calls).toHaveLength(2));
  await act(async () => {
    calls[0]!.reject(new ConvexError('Editing is paused'));
  });
  const refused = await within(scoresRegion()).findByRole('alert');
  expect(refused).toHaveTextContent(
    "Changes weren't saved: Editing is paused. Your edits are kept. Save to try again.",
  );
  expect(score('Strength')).toHaveValue('14');
  expect(score('Strength')).toBeEnabled();
  expect(within(levelsRegion()).queryByRole('alert')).not.toBeInTheDocument();
  await act(async () => {
    calls[1]!.resolve(null);
  });
  expect(await within(row('Level 1')).findByRole('status')).toHaveTextContent(
    'Hit points saved.',
  );
  expect(within(scoresRegion()).getByRole('alert')).toBeVisible();
  expect(hpInput('Level 1')).toBeEnabled();
  // The scores can be corrected and saved again.
  fireEvent.change(score('Strength'), { target: { value: '15' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save scores' }));
  await waitFor(() => expect(calls).toHaveLength(3));
  expect(lastCall().args.scores).toEqual({ strength: 15 });
});

test("another player's scores update untouched fields and keep a dirty field with its error; an own echo is not another player", async () => {
  const view = renderSheet(sheet());
  fireEvent.change(score('Strength'), { target: { value: 'bad' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save scores' }));
  await within(scoresRegion()).findByText('Strength must be a number');
  view.show(
    sheet({
      scores: { ...defaultAbilityScores, strength: 14, dexterity: 16 },
      lastOperationId: 'other-player',
    }),
  );
  expect(score('Strength')).toHaveValue('bad');
  expect(
    within(scoresRegion()).getByText('Strength must be a number'),
  ).toBeVisible();
  expect(score('Dexterity')).toHaveValue('16');
  expect(
    within(scoresRegion()).getByText(/^Strength total/).parentElement,
  ).toHaveTextContent('Strength total 14');
  expect(
    within(scoresRegion()).getByText(/^Dexterity modifier/).parentElement,
  ).toHaveTextContent('Dexterity modifier +3');
  const notice = within(scoresRegion()).getByText(
    'Updated by another player. Your edits are kept.',
  );
  expect(notice).toBeVisible();
  fireEvent.click(
    within(scoresRegion()).getByRole('button', {
      name: 'Dismiss ability scores update',
    }),
  );
  expect(
    within(scoresRegion()).queryByText(/Updated by another player/),
  ).not.toBeInTheDocument();
  fireEvent.change(score('Strength'), { target: { value: '18' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save scores' }));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().args.scores).toEqual({ strength: 18 });
  await act(async () => {
    lastCall().resolve(null);
  });
  view.show(
    sheet({
      scores: { ...defaultAbilityScores, strength: 18, dexterity: 16 },
      lastOperationId: operationOf(lastCall()),
    }),
  );
  expect(
    within(scoresRegion()).queryByText(/Updated by another player/),
  ).not.toBeInTheDocument();
  expect(within(scoresRegion()).getByRole('status')).toHaveTextContent(
    'Scores saved.',
  );
  expect(
    within(levelsRegion()).queryByText(/updated by another player/),
  ).not.toBeInTheDocument();
});

test('a draft, focus and error travel with their row through a reorder, and a save binds to the row, not its position', async () => {
  const view = renderSheet(
    sheet({
      levels: [
        { id: 'a', hp: 8 },
        { id: 'b', hp: 5 },
      ],
    }),
  );
  const first = hpInput('Level 1');
  fireEvent.change(first, { target: { value: 'x' } });
  fireEvent.click(
    within(row('Level 1')).getByRole('button', { name: 'Save hit points' }),
  );
  await within(row('Level 1')).findByRole('alert');
  first.focus();
  const down = within(row('Level 1')).getByRole('button', {
    name: 'Move level 1 down',
  });
  expect(
    within(row('Level 1')).getByRole('button', { name: 'Move level 1 up' }),
  ).toBeDisabled();
  fireEvent.click(down);
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('move');
  expect(lastCall().args).toMatchObject({ entryId: 'a', position: 2 });
  expect(
    screen.getByRole('button', { name: 'Move level 2 down' }),
  ).toBeDisabled();
  view.show(
    sheet({
      levels: [
        { id: 'b', hp: 5 },
        { id: 'a', hp: 8 },
      ],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  await act(async () => {
    lastCall().resolve(null);
  });
  const moved = row('Level 2');
  expect(moved).toHaveAttribute('id', 'sheet-level-a');
  expect(hpInput('Level 2')).toBe(first);
  expect(first).toHaveValue('x');
  expect(first).toHaveFocus();
  expect(within(moved).getByRole('alert')).toHaveTextContent(
    'Hit points must be a number',
  );
  expect(hpInput('Level 1')).toHaveValue('5');
  expect(
    within(levelsRegion()).queryByText(/updated by another player/),
  ).not.toBeInTheDocument();
  expect(within(levelsRegion()).getByText('Class Levels saved.')).toBeVisible();
  fireEvent.change(first, { target: { value: '7' } });
  await waitFor(() =>
    expect(within(moved).queryByRole('alert')).not.toBeInTheDocument(),
  );
  fireEvent.click(
    within(moved).getByRole('button', { name: 'Save hit points' }),
  );
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toMatchObject({ entryId: 'a', hpGained: 7 });
});

test('a deleted row takes its pending save with it, focus lands on its successor, and the last deletion leaves the advisory with Level up', async () => {
  const view = renderSheet(
    sheet({
      levels: [
        { id: 'a', hp: 8 },
        { id: 'b', hp: 5 },
      ],
    }),
  );
  fireEvent.change(hpInput('Level 1'), { target: { value: '9' } });
  fireEvent.click(
    within(row('Level 1')).getByRole('button', { name: 'Save hit points' }),
  );
  await waitFor(() => expect(calls).toHaveLength(1));
  const lateReply = calls[0]!;
  const remove = within(row('Level 1')).getByRole('button', {
    name: 'Delete level 1',
  });
  remove.focus();
  fireEvent.click(remove);
  // The trash asks first: Keep has focus and writes nothing, then returns
  // focus to the trash. Only the confirming Delete removes the row.
  const keep = within(deleteQuestion(1)).getByRole('button', {
    name: 'Keep level 1',
  });
  expect(keep).toHaveFocus();
  fireEvent.click(keep);
  expect(calls).toHaveLength(1);
  expect(within(row('Level 1')).queryByRole('group')).not.toBeInTheDocument();
  expect(
    within(row('Level 1')).getByRole('button', { name: 'Delete level 1' }),
  ).toHaveFocus();
  fireEvent.click(
    within(row('Level 1')).getByRole('button', { name: 'Delete level 1' }),
  );
  fireEvent.click(
    within(deleteQuestion(1)).getByRole('button', { name: 'Delete level 1' }),
  );
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args.entryId).toBe('a');
  view.show(
    sheet({
      levels: [{ id: 'b', hp: 5 }],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  await act(async () => {
    lastCall().resolve(null);
    lateReply.resolve(null);
  });
  // The surviving row keeps its identity and HP; the late reply has no row.
  expect(row('Level 1')).toHaveAttribute('id', 'sheet-level-b');
  expect(hpInput('Level 1')).toHaveValue('5');
  expect(
    within(row('Level 1')).queryByText('Hit points saved.'),
  ).not.toBeInTheDocument();
  expect(
    within(row('Level 1')).getByRole('button', { name: 'Delete level 1' }),
  ).toHaveFocus();
  expect(
    within(row('Level 1')).getByRole('button', { name: 'Move level 1 up' }),
  ).toBeDisabled();
  expect(
    within(row('Level 1')).getByRole('button', { name: 'Move level 1 down' }),
  ).toBeDisabled();
  fireEvent.click(
    within(row('Level 1')).getByRole('button', { name: 'Delete level 1' }),
  );
  fireEvent.click(
    within(deleteQuestion(1)).getByRole('button', { name: 'Delete level 1' }),
  );
  await waitFor(() => expect(calls).toHaveLength(3));
  view.show(sheet({ levels: [], lastOperationId: operationOf(lastCall()) }));
  await act(async () => {
    lastCall().resolve(null);
  });
  expect(
    within(levelsRegion()).queryByRole('listitem'),
  ).not.toBeInTheDocument();
  expect(screen.getByText('No Class Levels yet.')).toBeVisible();
  expect(screen.getByText('This PC has no Class Levels.')).toBeVisible();
  expect(screen.getByText('Level 1 as')).toBeVisible();
  const levelUp = screen.getByRole('button', { name: 'Level up' });
  expect(levelUp).toBeEnabled();
  expect(levelUp).toHaveFocus();
  expect(fieldValue('HP')).toHaveTextContent('0');
  expect(fieldValue('Level')).toHaveTextContent('0');
});

test('Level up appends a new row that only the appending device focuses; a remote append is announced and dismissable', async () => {
  const view = renderSheet(sheet({ levels: [{ id: 'a', hp: 8 }] }));
  const levelUp = screen.getByRole('button', { name: 'Level up' });
  levelUp.focus();
  fireEvent.click(levelUp);
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('add');
  expect(levelUp).toBeDisabled();
  const own = operationOf(lastCall());
  await act(async () => {
    lastCall().resolve('new-row');
  });
  view.show(
    sheet({
      levels: [
        { id: 'a', hp: 8 },
        { id: 'new-row', hp: null },
      ],
      lastOperationId: own,
    }),
  );
  await waitFor(() => expect(hpInput('Level 2')).toHaveFocus());
  expect(row('Level 2')).toHaveAttribute('id', 'sheet-level-new-row');
  expect(hpInput('Level 2')).toHaveValue('');
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
  expect(
    within(levelsRegion()).queryByText(/updated by another player/),
  ).not.toBeInTheDocument();
  expect(screen.getByText('Level 3 as')).toBeVisible();
  // Another player's append: announced beside the list, no focus or scroll.
  score('Wisdom').focus();
  view.show(
    sheet({
      levels: [
        { id: 'a', hp: 8 },
        { id: 'new-row', hp: null },
        { id: 'theirs', hp: 6 },
      ],
      lastOperationId: 'other-player',
    }),
  );
  expect(score('Wisdom')).toHaveFocus();
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
  expect(
    within(levelsRegion()).getByText('Class Levels updated by another player.'),
  ).toBeVisible();
  fireEvent.click(
    screen.getByRole('button', { name: 'Dismiss Class Levels update' }),
  );
  expect(
    within(levelsRegion()).queryByText(/updated by another player/),
  ).not.toBeInTheDocument();
  expect(within(levelsRegion()).getAllByRole('listitem')).toHaveLength(3);
});

test('a refused structural change is reported beside the levels and the rows stay as they were', async () => {
  renderSheet(
    sheet({
      levels: [
        { id: 'a', hp: 8 },
        { id: 'b', hp: 5 },
      ],
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Move level 2 up' }));
  await waitFor(() => expect(calls).toHaveLength(1));
  await act(async () => {
    lastCall().reject(new ConvexError('Move refused'));
  });
  expect(await within(levelsRegion()).findByRole('alert')).toHaveTextContent(
    "Class Levels weren't saved: Move refused. Try again.",
  );
  expect(row('Level 1')).toHaveAttribute('id', 'sheet-level-a');
  expect(screen.getByRole('button', { name: 'Move level 2 up' })).toBeEnabled();
  expect(within(scoresRegion()).queryByRole('alert')).not.toBeInTheDocument();
});

test('Escape dismisses a level deletion and returns focus to its trash button without deleting', () => {
  renderSheet(sheet());
  fireEvent.click(screen.getByRole('button', { name: 'Delete level 1' }));
  const keep = within(deleteQuestion(1)).getByRole('button', {
    name: 'Keep level 1',
  });
  expect(keep).toHaveFocus();
  fireEvent.keyDown(keep, { key: 'Escape' });
  expect(within(row('Level 1')).queryByRole('group')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Delete level 1' })).toHaveFocus();
  expect(calls).toEqual([]);
});

test.each([
  { state: 'maintenance', dismiss: 'Keep' },
  { state: 'maintenance', dismiss: 'Escape' },
  { state: 'pending deletion', dismiss: 'Keep' },
  { state: 'pending deletion', dismiss: 'Escape' },
])(
  '$dismiss during $state dismisses confirmation and focuses the row heading when trash is disabled',
  async ({ state, dismiss }) => {
    const initial = sheet();
    const view = renderSheet(initial);
    fireEvent.click(screen.getByRole('button', { name: 'Delete level 1' }));
    if (state === 'maintenance') {
      maintenance.mockReturnValue({
        kind: 'maintenance',
        readOnly: true,
        message: 'Editing is paused for maintenance.',
      });
      view.show(initial);
    } else {
      fireEvent.click(
        within(deleteQuestion(1)).getByRole('button', {
          name: 'Delete level 1',
        }),
      );
      await waitFor(() => expect(calls).toHaveLength(1));
    }
    const keep = within(deleteQuestion(1)).getByRole('button', {
      name: 'Keep level 1',
    });
    expect(keep).toHaveFocus();
    if (dismiss === 'Keep') fireEvent.click(keep);
    else fireEvent.keyDown(keep, { key: 'Escape' });

    expect(within(row('Level 1')).queryByRole('group')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete level 1' }),
    ).toBeDisabled();
    expect(
      within(row('Level 1')).getByRole('heading', { name: 'Level 1' }),
    ).toHaveFocus();
    expect(calls).toHaveLength(state === 'maintenance' ? 0 : 1);
  },
);

test('maintenance starting during a deletion confirmation disables Delete and retains unsaved drafts', async () => {
  const initial = sheet();
  const view = renderSheet(initial);
  fireEvent.change(score('Strength'), { target: { value: '14' } });
  fireEvent.change(hpInput('Level 1'), { target: { value: '8' } });
  fireEvent.click(screen.getByRole('button', { name: 'Delete level 1' }));
  const message = 'Editing is paused for maintenance.';
  maintenance.mockReturnValue({ kind: 'maintenance', readOnly: true, message });
  view.show(initial);

  const question = deleteQuestion(1);
  const confirm = within(question).getByRole('button', {
    name: 'Delete level 1',
  });
  expect(confirm).toBeDisabled();
  expect(within(question).getByText(message)).toBeVisible();
  expect(score('Strength')).toBeDisabled();
  expect(score('Strength')).toHaveValue('14');
  expect(hpInput('Level 1')).toBeDisabled();
  expect(hpInput('Level 1')).toHaveValue('8');
  fireEvent.click(confirm);
  await act(async () => {
    fireEvent.submit(screen.getByRole('form', { name: 'Ability scores' }));
    fireEvent.submit(screen.getByRole('form', { name: 'Level 1 hit points' }));
  });
  expect(calls).toEqual([]);
  const keep = within(question).getByRole('button', { name: 'Keep level 1' });
  expect(keep).toBeEnabled();
  fireEvent.click(keep);
  expect(within(row('Level 1')).queryByRole('group')).not.toBeInTheDocument();

  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
  view.show(initial);
  expect(score('Strength')).toBeEnabled();
  expect(score('Strength')).toHaveValue('14');
  expect(hpInput('Level 1')).toBeEnabled();
  expect(hpInput('Level 1')).toHaveValue('8');
  expect(within(scoresRegion()).queryByText(message)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Delete level 1' })).toBeEnabled();
});

test('a refused deletion keeps its confirmation open with focus on an enabled answer', async () => {
  renderSheet(sheet());
  fireEvent.click(screen.getByRole('button', { name: 'Delete level 1' }));
  const confirm = within(deleteQuestion(1)).getByRole('button', {
    name: 'Delete level 1',
  });
  confirm.focus();
  fireEvent.click(confirm);
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(confirm).toBeDisabled();
  // The pending answer is disabled, so focus must move to an available answer.
  expect(
    within(deleteQuestion(1)).getByRole('button', { name: 'Keep level 1' }),
  ).toHaveFocus();
  await act(async () => {
    lastCall().reject(new ConvexError('Delete refused'));
  });
  expect(await within(levelsRegion()).findByRole('alert')).toHaveTextContent(
    "Class Levels weren't saved: Delete refused. Try again.",
  );
  const question = deleteQuestion(1);
  const focusedAnswer = within(question)
    .getAllByRole('button')
    .find((button) => button === document.activeElement);
  expect(focusedAnswer).toBeDefined();
  expect(focusedAnswer).toBeEnabled();
  expect(row('Level 1')).toBeVisible();
  expect(calls).toHaveLength(1);
});

test('Enter in one editor submits only that editor', async () => {
  renderSheet(sheet({ levels: [{ id: 'a', hp: null }] }));
  fireEvent.change(score('Charisma'), { target: { value: '12' } });
  fireEvent.change(hpInput('Level 1'), { target: { value: '6' } });
  fireEvent.submit(hpInput('Level 1').closest('form')!);
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('hp');
  expect(lastCall().args.hpGained).toBe(6);
  fireEvent.submit(score('Charisma').closest('form')!);
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().name).toBe('scores');
  expect(lastCall().args.scores).toEqual({ charisma: 12 });
});
