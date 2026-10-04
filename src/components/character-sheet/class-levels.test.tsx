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
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import type * as NavigationGuard from '~/components/campaign-shell/navigation-guard';
import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import { calculateCharacterSheetProjections } from '~/lib/character-sheet';
import {
  buildSheet,
  emptyOwnerCandidates,
  findCalculatedWarning,
  isClassCatalogEntry,
  type Adjustment,
  type Level,
} from './character-sheet-test-fixture';
import { formatModifier } from './sheet-parts';
import type { CharacterSheetSnapshot } from './use-character-sheet';

// Advancing and revising Class Levels (#299): every row's class, hit points,
// favored class bonus and ability increase chosen in place; Level up and
// insertion; stable rows through moves and deletions; the derived numbers
// with their breakdowns.

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
vi.mock('@convex/_generated/api', async () => {
  const { createCharacterSheetApiMock } =
    await import('./character-sheet-api-test-fixture');
  return createCharacterSheetApiMock({
    characterSheet: {
      editClassLevel: 'editLevel',
    },
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
  <CharacterSheetBlocks
    blocks={[
      'scores',
      'levels',
      'favoredClasses',
      'summary',
      'defenses',
      'offense',
    ]}
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
const row = (level: number) =>
  screen.getByRole('listitem', { name: `Level ${level}` });
const levelsRegion = () => screen.getByRole('region', { name: 'Class Levels' });
const classPicker = (level: number) =>
  within(row(level)).getByRole('combobox', { name: `Class at level ${level}` });
const favoredPicker = (level: number) =>
  within(row(level)).getByRole('combobox', {
    name: `Favored class bonus at level ${level}`,
  });
const abilityPicker = (level: number) =>
  within(row(level)).getByRole('combobox', {
    name: `Ability increase at level ${level}`,
  });
const hpInput = (level: number) =>
  within(row(level)).getByRole('textbox', {
    name: `Hit points gained at level ${level}`,
  });
const noteInput = (level: number) =>
  within(row(level)).getByRole('textbox', {
    name: `Alternative favored class bonus at level ${level}`,
  });
const pick = (select: HTMLElement, value: string) =>
  fireEvent.change(select, { target: { value } });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
function lastCall() {
  const call = calls.at(-1);
  if (!call) throw new Error('Expected a write');
  return call;
}
const operationOf = (call: Call) => String(call.args.operationId);
/** Shows the snapshot as the own write's echo, then settles the write. */
async function settle(
  view: ReturnType<typeof renderSheet>,
  next: Parameters<typeof buildSheet>[0],
  reply: unknown = null,
) {
  view.show(buildSheet({ ...next, lastOperationId: operationOf(lastCall()) }));
  await act(async () => {
    lastCall().resolve(reply);
  });
}
const noWizard = () => {
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /roll|average|maximum|next step/i }),
  ).not.toBeInTheDocument();
};

beforeEach(() => {
  calls = [];
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
  snapshot = undefined;
  scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
});

test('a class, plain hit points, an alternative favored class bonus and an ability increase are chosen in place on a row and saved as recorded, with no wizard and no HP fill', async () => {
  const view = renderSheet(
    buildSheet({ hasClasses: true, levels: [{ id: 'a', hp: null }] }),
  );
  expect(classPicker(1)).toHaveValue('none');
  expect(classPicker(1)).toHaveClass('ring-sky-400/80');
  expect(hpInput(1)).toHaveValue('');

  pick(classPicker(1), 'fighter');
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('editLevel');
  expect(lastCall().args).toMatchObject({
    entryId: 'a',
    classEntryId: 'fighter',
  });
  expect(lastCall().args).not.toHaveProperty('hpGained');
  expect(
    within(row(1)).getByRole('button', { name: 'Saving…' }),
  ).toBeDisabled();
  const fighter: Level = { id: 'a', hp: null, classId: 'fighter' };
  await settle(view, { levels: [fighter] });
  expect(within(row(1)).getByText('Choices saved.')).toBeVisible();
  expect(within(row(1)).getByText('Fighter 1')).toBeVisible();
  expect(classPicker(1)).not.toHaveClass('ring-sky-400/80');
  expect(
    within(row(1)).queryByRole('button', { name: 'Save choices' }),
  ).not.toBeInTheDocument();
  // The hit die is a hint, never a fill.
  expect(hpInput(1)).toHaveValue('');
  expect(hpInput(1)).toHaveAccessibleDescription('d10');
  expect(within(row(1)).getByText('Enter hit points gained.')).toBeVisible();

  fireEvent.change(hpInput(1), { target: { value: '9' } });
  fireEvent.click(
    within(row(1)).getByRole('button', { name: 'Save hit points' }),
  );
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toEqual(
    expect.objectContaining({ entryId: 'a', hpGained: 9 }),
  );
  expect(lastCall().args).not.toHaveProperty('classEntryId');
  await settle(view, { levels: [{ ...fighter, hp: 9 }] });
  expect(within(row(1)).getByText('Hit points saved.')).toBeVisible();

  // "Other…" waits for its note; the note saves when left.
  pick(favoredPicker(1), 'alt');
  expect(calls).toHaveLength(2);
  fireEvent.change(noteInput(1), { target: { value: 'Extra rage round' } });
  fireEvent.blur(noteInput(1));
  await waitFor(() => expect(calls).toHaveLength(3));
  expect(lastCall().args).toMatchObject({
    entryId: 'a',
    favoredClassBonus: { choice: 'alt', note: 'Extra rage round' },
  });
  expect(lastCall().args).not.toHaveProperty('classEntryId');
  expect(lastCall().args).not.toHaveProperty('abilityIncrease');
  const withNote: Level = {
    ...fighter,
    hp: 9,
    favoredClassBonus: { choice: 'alt', note: 'Extra rage round' },
  };
  await settle(view, { levels: [withNote] });
  expect(noteInput(1)).toHaveValue('Extra rage round');

  pick(abilityPicker(1), 'strength');
  await waitFor(() => expect(calls).toHaveLength(4));
  expect(lastCall().args).toMatchObject({
    entryId: 'a',
    abilityIncrease: 'strength',
  });
  await settle(view, {
    levels: [{ ...withNote, abilityIncrease: 'strength' }],
  });
  expect(abilityPicker(1)).toHaveValue('strength');
  expect(
    within(screen.getByRole('region', { name: 'Ability scores' })).getByRole(
      'button',
      { name: 'Strength 11, breakdown' },
    ),
  ).toBeVisible();
  noWizard();
});

test('Level up as the chosen next class appends an empty-HP row that only this device scrolls to and focuses, honouring reduced motion; a remote append is announced without moving', async () => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true });
  const fighter: Level = { id: 'a', hp: 8, classId: 'fighter' };
  const view = renderSheet(buildSheet({ levels: [fighter] }));
  const nextClass = screen.getByRole('combobox', {
    name: 'Class for the next level',
  });
  expect(nextClass).toHaveValue('fighter');
  expect(screen.getByText('Level 2 as')).toBeVisible();
  pick(nextClass, 'wizard');
  fireEvent.click(button('Level up'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('add');
  expect(lastCall().args).toMatchObject({ classEntryId: 'wizard' });
  expect(lastCall().args).not.toHaveProperty('hpGained');
  expect(lastCall().args).not.toHaveProperty('position');
  expect(button('Level up')).toBeDisabled();
  const wizard: Level = { id: 'b', hp: null, classId: 'wizard' };
  await settle(view, { levels: [fighter, wizard] }, 'b');
  await waitFor(() => expect(hpInput(2)).toHaveFocus());
  expect(row(2)).toHaveAttribute('id', 'sheet-level-b');
  expect(hpInput(2)).toHaveValue('');
  expect(within(row(2)).getByText('Wizard 1')).toBeVisible();
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
  expect(scrollIntoView).toHaveBeenCalledWith({
    block: 'center',
    behavior: 'auto',
  });
  expect(screen.getByText('Level 3 as')).toBeVisible();
  expect(
    within(levelsRegion()).queryByText(/updated by another player/),
  ).not.toBeInTheDocument();

  classPicker(1).focus();
  view.show(
    buildSheet({
      levels: [fighter, wizard, { id: 'c', hp: 6, classId: 'rogue' }],
      lastOperationId: 'other-device',
    }),
  );
  expect(classPicker(1)).toHaveFocus();
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
  expect(
    within(levelsRegion()).getByText('Class Levels updated by another player.'),
  ).toBeVisible();
  fireEvent.click(button('Dismiss Class Levels update'));
  expect(within(levelsRegion()).getAllByRole('listitem')).toHaveLength(3);
  noWizard();
});

test('insert, move and change keep each row its identity, draft and choices; deleting a middle row closes positions and leaves its linked selection unplaced; deleting the last row leaves Level 1 available', async () => {
  const a: Level = {
    id: 'a',
    hp: 10,
    classId: 'fighter',
    favoredClassBonus: { choice: 'hp' },
  };
  const b: Level = { id: 'b', hp: 6, classId: 'rogue' };
  const c: Level = { id: 'c', hp: 4, classId: 'wizard' };
  const sneakAttack: Adjustment = {
    id: 'sneak',
    name: 'Sneak attack',
    modifiers: [{ target: 'damage.melee', bonusType: 'untyped', value: 1 }],
    gainedAtClassLevel: 'b',
  };
  const adjustments = [sneakAttack];
  const view = renderSheet(buildSheet({ levels: [a, b, c], adjustments }));
  expect(screen.queryByText(/Gained at a deleted/)).not.toBeInTheDocument();

  fireEvent.click(
    within(row(2)).getByRole('button', { name: 'Insert level before level 2' }),
  );
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('add');
  expect(lastCall().args).toMatchObject({ position: 2 });
  expect(lastCall().args).not.toHaveProperty('classEntryId');
  const inserted: Level = { id: 'n', hp: null };
  await settle(view, { levels: [a, inserted, b, c], adjustments }, 'n');
  await waitFor(() => expect(hpInput(2)).toHaveFocus());
  expect(row(2)).toHaveAttribute('id', 'sheet-level-n');
  expect(classPicker(2)).toHaveValue('none');
  expect(row(3)).toHaveAttribute('id', 'sheet-level-b');
  expect(within(row(3)).getByText('Rogue 1')).toBeVisible();
  expect(favoredPicker(1)).toHaveValue('hp');

  // A draft typed into the Rogue row travels with it up the list.
  fireEvent.change(hpInput(3), { target: { value: '7' } });
  fireEvent.click(
    within(row(3)).getByRole('button', { name: 'Move level 3 up' }),
  );
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toMatchObject({ entryId: 'b', position: 2 });
  await settle(view, { levels: [a, b, inserted, c], adjustments });
  expect(row(2)).toHaveAttribute('id', 'sheet-level-b');
  expect(hpInput(2)).toHaveValue('7');
  expect(classPicker(2)).toHaveValue('rogue');
  expect(favoredPicker(1)).toHaveValue('hp');
  expect(row(3)).toHaveAttribute('id', 'sheet-level-n');

  pick(classPicker(2), 'cleric');
  await waitFor(() => expect(calls).toHaveLength(3));
  expect(lastCall().args).toMatchObject({
    entryId: 'b',
    classEntryId: 'cleric',
  });
  const cleric: Level = { ...b, classId: 'cleric' };
  await settle(view, { levels: [a, cleric, inserted, c], adjustments });
  expect(within(row(2)).getByText('Cleric 1')).toBeVisible();
  expect(hpInput(2)).toHaveValue('7');

  fireEvent.click(
    within(row(2)).getByRole('button', { name: 'Delete level 2' }),
  );
  fireEvent.click(
    within(
      screen.getByRole('group', { name: 'Delete Cleric (level 2)?' }),
    ).getByRole('button', { name: 'Delete level 2' }),
  );
  await waitFor(() => expect(calls).toHaveLength(4));
  expect(lastCall().name).toBe('delete');
  expect(lastCall().args).toMatchObject({ entryId: 'b' });
  await settle(view, { levels: [a, inserted, c], adjustments });
  expect(within(levelsRegion()).getAllByRole('listitem')).toHaveLength(3);
  expect(row(2)).toHaveAttribute('id', 'sheet-level-n');
  expect(row(3)).toHaveAttribute('id', 'sheet-level-c');
  const unplaced = within(levelsRegion()).getByText(
    'Gained at a deleted Class Level:',
  );
  expect(unplaced).toBeVisible();
  expect(
    within(unplaced.parentElement!).getByText('Sneak attack'),
  ).toBeVisible();
  for (const level of [1, 2, 3]) {
    expect(
      within(row(level)).queryByText('Sneak attack'),
    ).not.toBeInTheDocument();
  }
  expect(screen.getByText('Level 4 as')).toBeVisible();

  view.show(buildSheet({ levels: [c], adjustments, hasClasses: true }));
  fireEvent.click(
    within(row(1)).getByRole('button', { name: 'Delete level 1' }),
  );
  fireEvent.click(
    within(
      screen.getByRole('group', { name: 'Delete Wizard (level 1)?' }),
    ).getByRole('button', { name: 'Delete level 1' }),
  );
  await waitFor(() => expect(calls).toHaveLength(5));
  await settle(view, { levels: [], adjustments, hasClasses: true });
  expect(
    within(levelsRegion()).queryByRole('listitem'),
  ).not.toBeInTheDocument();
  expect(screen.getByText('Level 1 as')).toBeVisible();
  expect(button('Level up')).toBeEnabled();
  expect(button('Level up')).toHaveFocus();
  expect(
    screen.getByRole('combobox', { name: 'Class for the next level' }),
  ).toBeEnabled();
  expect(within(levelsRegion()).getByText('Sneak attack')).toBeVisible();
});

test("a refused choice is reported on its row with the draft kept and retried from there; another player's pristine change refreshes while the dirty choice stays, acknowledged on the row", async () => {
  const fighter: Level = { id: 'a', hp: 8, classId: 'fighter' };
  const view = renderSheet(buildSheet({ levels: [fighter] }));
  pick(abilityPicker(1), 'strength');
  await waitFor(() => expect(calls).toHaveLength(1));
  await act(async () => {
    lastCall().reject(new ConvexError('Editing is paused'));
  });
  expect(await within(row(1)).findByRole('alert')).toHaveTextContent(
    "Changes weren't saved: Editing is paused. Your edits are kept. Save to try again.",
  );
  expect(abilityPicker(1)).toHaveValue('strength');
  expect(within(row(1)).getByText('Fighter 1')).toBeVisible();
  expect(snapshot?.entries.find((entry) => entry._id === 'a')).toMatchObject({
    state: { classEntryId: 'fighter', hpGained: 8 },
  });
  expect(
    within(row(1)).queryByText(
      'This level is outside the ability-increase milestones.',
    ),
  ).not.toBeInTheDocument();

  fireEvent.click(within(row(1)).getByRole('button', { name: 'Save choices' }));
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toMatchObject({
    entryId: 'a',
    abilityIncrease: 'strength',
  });
  await settle(view, { levels: [{ ...fighter, abilityIncrease: 'strength' }] });
  expect(within(row(1)).getByText('Choices saved.')).toBeVisible();
  expect(within(row(1)).queryByRole('alert')).not.toBeInTheDocument();
  expect(
    within(row(1)).queryByRole('button', { name: 'Save choices' }),
  ).not.toBeInTheDocument();

  pick(favoredPicker(1), 'alt');
  expect(calls).toHaveLength(2);
  view.show(
    buildSheet({
      levels: [{ ...fighter, classId: 'rogue', abilityIncrease: 'strength' }],
      lastOperationId: 'other-player',
    }),
  );
  expect(classPicker(1)).toHaveValue('rogue');
  expect(within(row(1)).getByText('Rogue 1')).toBeVisible();
  expect(favoredPicker(1)).toHaveValue('alt');
  expect(noteInput(1)).toBeVisible();
  const notice = within(row(1)).getByText(
    'Updated by another player. Your edits are kept.',
  );
  expect(notice).toBeVisible();
  fireEvent.click(button('Dismiss level 1 choices update'));
  expect(notice).not.toBeInTheDocument();
  expect(favoredPicker(1)).toHaveValue('alt');
});

test('a favored class is chosen for the Character; missing favored and milestone choices are marked inline, departures save with Accept, an acceptance survives an unrelated HP edit, and moving onto a milestone removes the warning', async () => {
  const fighter = (id: string, hp: number): Level => ({
    id,
    hp,
    classId: 'fighter',
    favoredClassBonus: id === 'a' ? null : { choice: 'hp' },
  });
  const levels = [
    fighter('a', 10),
    fighter('b', 6),
    fighter('c', 6),
    fighter('d', 6),
  ];
  const view = renderSheet(buildSheet({ levels }));
  expect(
    within(row(1)).queryByText('Choose a favored class bonus.'),
  ).not.toBeInTheDocument();
  const favoredFighter = screen.getByRole('checkbox', {
    name: 'Fighter favored',
  });
  expect(favoredFighter).not.toBeChecked();
  fireEvent.click(favoredFighter);
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('settings');
  expect(lastCall().args).toMatchObject({ favoredClassIds: ['fighter'] });
  await settle(view, { levels, favoredClassIds: ['fighter'] });
  expect(
    screen.getByRole('checkbox', { name: 'Fighter favored' }),
  ).toBeChecked();
  expect(screen.getByText('Favored class saved.')).toBeVisible();

  expect(within(row(1)).getByText('Choose a favored class bonus.')).toHaveClass(
    'text-sky-300',
  );
  expect(favoredPicker(1)).toHaveClass('ring-sky-400/80');
  expect(favoredPicker(2)).not.toHaveClass('ring-sky-400/80');
  expect(within(row(4)).getByText('Choose an ability increase.')).toHaveClass(
    'text-sky-300',
  );
  expect(abilityPicker(4)).toHaveClass('ring-sky-400/80');
  expect(abilityPicker(2)).not.toHaveClass('ring-sky-400/80');
  expect(abilityPicker(2)).toHaveClass('text-muted-foreground');
  expect(abilityPicker(2)).toBeEnabled();
  expect(
    screen.queryByRole('button', { name: /Accept|Reopen/ }),
  ).not.toBeInTheDocument();

  pick(abilityPicker(2), 'dexterity');
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toMatchObject({
    entryId: 'b',
    abilityIncrease: 'dexterity',
  });
  const departed = levels.map((level) =>
    level.id === 'b'
      ? { ...level, abilityIncrease: 'dexterity' as const }
      : level,
  );
  await settle(view, { levels: departed, favoredClassIds: ['fighter'] });
  const message = 'This level is outside the ability-increase milestones.';
  expect(within(row(2)).getByText(message).parentElement).toHaveClass(
    'text-amber-300',
  );
  const accept = within(row(2)).getByRole('button', {
    name: 'Accept',
    description: message,
  });
  fireEvent.click(accept);
  await waitFor(() => expect(calls).toHaveLength(3));
  const warning = findCalculatedWarning(
    buildSheet({ levels: departed, favoredClassIds: ['fighter'] }),
    'abilityIncreaseMilestone',
    'b',
  );
  expect(lastCall().args).toMatchObject({
    check: 'abilityIncreaseMilestone',
    subject: 'b',
    fingerprint: warning.fingerprint,
  });
  await settle(view, {
    levels: departed,
    favoredClassIds: ['fighter'],
    accepted: [warning],
  });
  expect(within(row(2)).getByText('Accepted')).toBeVisible();

  // An unrelated HP edit on another row leaves the acceptance standing.
  view.show(
    buildSheet({
      levels: departed.map((level) =>
        level.id === 'a' ? { ...level, hp: 11 } : level,
      ),
      favoredClassIds: ['fighter'],
      accepted: [warning],
    }),
  );
  expect(within(row(2)).getByText('Accepted')).toBeVisible();

  // Moved onto level 4, the increase is due: nothing to accept any more.
  const [first, second, third, fourth] = departed;
  view.show(
    buildSheet({
      levels: [first!, third!, fourth!, second!],
      favoredClassIds: ['fighter'],
      accepted: [warning],
    }),
  );
  expect(row(4)).toHaveAttribute('id', 'sheet-level-b');
  expect(abilityPicker(4)).toHaveValue('dexterity');
  expect(within(row(4)).queryByText(message)).not.toBeInTheDocument();
  expect(screen.queryByText('Accepted')).not.toBeInTheDocument();
  expect(abilityPicker(4)).not.toHaveClass('ring-sky-400/80');
  expect(
    within(row(3)).queryByText('Choose an ability increase.'),
  ).not.toBeInTheDocument();
});

test('BAB, the saves, Initiative, CMB, AC and CMD open accessible breakdowns naming their class sources, by click, keyboard and touch at every approved width, and focus returns to the number', () => {
  const sheet = buildSheet({
    levels: [
      { id: 'a', hp: 10, classId: 'fighter' },
      { id: 'b', hp: 6, classId: 'rogue' },
    ],
  });
  renderSheet(sheet);
  const derived = sheet.calculated.derivedStatistics;
  const figures: [string, number, boolean][] = [
    ['Base attack bonus', derived.bab.total, true],
    ['Fortitude save', derived.fortitude.total, true],
    ['Reflex save', derived.reflex.total, true],
    ['Will save', derived.will.total, true],
    ['Initiative', derived.initiative.total, true],
    ['Combat Maneuver Bonus', derived.cmb.total, true],
    ['Armor Class', derived.ac.total, false],
    ['Touch AC', derived.touchAc.total, false],
    ['Flat-footed AC', derived.flatFootedAc.total, false],
    ['Combat Maneuver Defense', derived.cmd.total, false],
    ['Flat-footed CMD', derived.flatFootedCmd.total, false],
  ];
  expect(derived.bab.total).toBe(1);
  expect(derived.fortitude.total).toBe(2);
  expect(derived.reflex.total).toBe(2);
  const triggers = figures.map(([title, total, isSigned]) =>
    button(`${title} ${isSigned ? formatModifier(total) : total}, breakdown`),
  );
  for (const trigger of triggers)
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

  for (const widthPx of [390, 1180, 1440]) {
    Object.defineProperty(window, 'innerWidth', {
      value: widthPx,
      configurable: true,
    });
    const fortitude = button('Fortitude save +2, breakdown');
    fireEvent.pointerEnter(fortitude, { pointerType: 'touch' });
    expect(
      screen.queryByRole('group', { name: 'Fortitude save breakdown' }),
    ).not.toBeInTheDocument();
    fireEvent.click(fortitude);
    const panel = screen.getByRole('group', {
      name: 'Fortitude save breakdown',
    });
    expect(panel).toBeVisible();
    expect(within(panel).getByText('Fighter 1')).toBeVisible();
    expect(within(panel).getByText('Constitution')).toBeVisible();
    expect(panel).not.toHaveTextContent(/builtin|entryId|revision/);
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(
      screen.queryByRole('group', { name: 'Fortitude save breakdown' }),
    ).not.toBeInTheDocument();
    expect(fortitude).toHaveFocus();
  }

  fireEvent.click(button('Base attack bonus +1, breakdown'));
  const bab = screen.getByRole('group', {
    name: 'Base attack bonus breakdown',
  });
  expect(within(bab).getByText('Fighter 1')).toBeVisible();
  fireEvent.click(within(bab).getByRole('button', { name: 'Close breakdown' }));
  expect(button('Base attack bonus +1, breakdown')).toHaveFocus();
  fireEvent.click(button('Combat Maneuver Defense 11, breakdown'));
  expect(
    screen.getByRole('group', { name: 'Combat Maneuver Defense breakdown' }),
  ).toBeVisible();
});

test('maintenance disables every Class Level choice, insertion, warning action and the favored classes; the block states the reason once and each disabled action is described by it; nothing is written', () => {
  const message = 'Editing is paused for maintenance.';
  maintenance.mockReturnValue({ kind: 'maintenance', readOnly: true, message });
  // Four hit points at a d10 class's first level: a rules warning in the row.
  renderSheet(buildSheet({ levels: [{ id: 'a', hp: 4, classId: 'fighter' }] }));
  const firstLevelRule =
    "A PC's first Class Level normally gains 10 hit points.";
  const accept = within(row(1)).getByRole('button', { name: 'Accept' });
  for (const control of [
    classPicker(1),
    favoredPicker(1),
    abilityPicker(1),
    hpInput(1),
    within(row(1)).getByRole('button', { name: 'Insert level before level 1' }),
    screen.getByRole('combobox', { name: 'Class for the next level' }),
    button('Level up'),
    accept,
    screen.getByRole('checkbox', { name: 'Fighter favored' }),
  ]) {
    expect(control).toBeDisabled();
  }
  expect(within(levelsRegion()).getAllByText(message)).toHaveLength(1);
  expect(within(row(1)).queryByText(message)).not.toBeInTheDocument();
  expect(
    within(row(1)).getByRole('button', { name: 'Save hit points' }),
  ).toHaveAccessibleDescription(message);
  expect(accept).toHaveAccessibleDescription(`${firstLevelRule} ${message}`);
  expect(button('Level up')).toHaveAccessibleDescription(message);
  pick(classPicker(1), 'wizard');
  fireEvent.click(accept);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Fighter favored' }));
  expect(calls).toEqual([]);
});

test('"Other…" with an empty or blank note is refused at the note field with the draft kept, from Enter, from leaving the field and from Save choices; a note then saves', async () => {
  const fighter: Level = { id: 'a', hp: 10, classId: 'fighter' };
  const view = renderSheet(buildSheet({ levels: [fighter] }));
  const error = 'Describe the alternative favored class bonus';
  pick(favoredPicker(1), 'alt');
  expect(calls).toEqual([]);
  fireEvent.keyDown(noteInput(1), { key: 'Enter' });
  expect(await within(row(1)).findByText(error)).toHaveAttribute(
    'role',
    'alert',
  );
  expect(noteInput(1)).toHaveAttribute('aria-invalid', 'true');
  expect(noteInput(1)).toHaveAccessibleDescription(error);
  expect(favoredPicker(1)).toHaveValue('alt');
  expect(calls).toEqual([]);

  fireEvent.change(noteInput(1), { target: { value: '   ' } });
  fireEvent.blur(noteInput(1));
  fireEvent.click(within(row(1)).getByRole('button', { name: 'Save choices' }));
  expect(await within(row(1)).findByText(error)).toBeVisible();
  expect(noteInput(1)).toHaveValue('   ');
  expect(calls).toEqual([]);

  fireEvent.change(noteInput(1), { target: { value: 'Extra rage round' } });
  fireEvent.blur(noteInput(1));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().args).toMatchObject({
    entryId: 'a',
    favoredClassBonus: { choice: 'alt', note: 'Extra rage round' },
  });
  const withNote: Level = {
    ...fighter,
    favoredClassBonus: { choice: 'alt', note: 'Extra rage round' },
  };
  await settle(view, { levels: [withNote] });
  expect(within(row(1)).queryByText(error)).not.toBeInTheDocument();
  expect(noteInput(1)).not.toHaveAttribute('aria-invalid', 'true');
  expect(within(row(1)).getByText('Choices saved.')).toBeVisible();
});

/** The fixture's Rogue as a prestige class, with the sheet recalculated. */
function withPrestigeRogue(input: CharacterSheetSnapshot) {
  const catalogEntries = input.catalogEntries.map((entry) =>
    entry._id === 'rogue' && isClassCatalogEntry(entry)
      ? {
          ...entry,
          detail: { ...entry.detail, classKind: 'prestige' as const },
        }
      : entry,
  );
  const calculated = calculateCharacterSheetProjections({
    characterKind: 'pc',
    entries: input.entries,
    catalogEntries,
  });
  return {
    ...input,
    catalogEntries,
    calculated: calculated.current,
    permanentCalculated: calculated.permanent,
  };
}

test('hit points above the hit die and a first PC level below it warn at the HP field with Accept; too many favored classes and a prestige favored class warn under the favored classes; a level of a deleted class reads Unspecified with its missing-class marker', async () => {
  const levels: Level[] = [
    { id: 'a', hp: 4, classId: 'fighter' },
    { id: 'b', hp: 12, classId: 'fighter' },
    { id: 'c', hp: 6, classId: 'deleted-class' },
  ];
  const input = withPrestigeRogue(
    buildSheet({ levels, favoredClassIds: ['fighter', 'rogue'] }),
  );
  renderSheet(input);
  const firstLevelRule =
    "A PC's first Class Level normally gains 10 hit points.";
  const aboveMaximum = 'Hit points gained exceed the d10 maximum.';
  expect(within(row(1)).getByText(firstLevelRule).parentElement).toHaveClass(
    'text-amber-300',
  );
  expect(
    within(row(1)).getByRole('button', {
      name: 'Accept',
      description: firstLevelRule,
    }),
  ).toBeEnabled();
  expect(within(row(2)).getByText(aboveMaximum).parentElement).toHaveClass(
    'text-amber-300',
  );
  expect(within(row(2)).queryByText(firstLevelRule)).not.toBeInTheDocument();
  expect(within(row(3)).queryByText(aboveMaximum)).not.toBeInTheDocument();

  const character = within(screen.getByRole('region', { name: 'Character' }));
  for (const rule of [
    'Choose up to 1 favored class.',
    'Rogue cannot normally be a favored class.',
  ]) {
    expect(character.getByText(rule).parentElement).toHaveClass(
      'text-amber-300',
    );
    expect(
      character.getByRole('button', { name: 'Accept', description: rule }),
    ).toBeEnabled();
  }
  expect(within(levelsRegion()).queryByText(/favored class\./)).toBeNull();

  expect(classPicker(3)).toHaveValue('none');
  expect(within(row(3)).getByText('Choose a class.')).toHaveClass(
    'text-sky-300',
  );
  expect(classPicker(3)).toHaveClass('ring-sky-400/80');
  expect(hpInput(3)).not.toHaveAccessibleDescription();
  fireEvent.click(
    within(row(3)).getByRole('button', { name: 'Delete level 3' }),
  );
  const question = screen.getByRole('group', {
    name: 'Delete Unspecified (level 3)?',
  });
  fireEvent.click(
    within(question).getByRole('button', { name: 'Keep level 3' }),
  );

  fireEvent.click(
    within(row(2)).getByRole('button', {
      name: 'Accept',
      description: aboveMaximum,
    }),
  );
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('accept');
  expect(lastCall().args).toMatchObject({
    check: 'hpGainedAboveMaximum',
    subject: 'b',
    fingerprint: findCalculatedWarning(input, 'hpGainedAboveMaximum', 'b')
      .fingerprint,
  });
});

test.each(['deleted', 'legacy'])(
  'a %s class definition remains Unspecified while another choice saves without replacing its reference',
  async (kind) => {
    let input = buildSheet({
      levels: [
        {
          id: 'a',
          hp: 8,
          classId: kind === 'deleted' ? 'deleted-class' : 'fighter',
        },
      ],
    });
    if (kind === 'legacy') {
      const catalogEntries = input.catalogEntries.map((entry) =>
        entry._id === 'fighter' && isClassCatalogEntry(entry)
          ? { ...entry, detail: { kind: 'class' as const } }
          : entry,
      );
      const calculated = calculateCharacterSheetProjections({
        characterKind: 'pc',
        entries: input.entries,
        catalogEntries,
      });
      input = {
        ...input,
        catalogEntries,
        calculated: calculated.current,
        permanentCalculated: calculated.permanent,
      };
    }
    renderSheet(input);
    expect(classPicker(1)).toHaveValue('none');
    expect(within(row(1)).getByText('Choose a class.')).toBeVisible();
    pick(abilityPicker(1), 'strength');
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(lastCall().args).toMatchObject({
      entryId: 'a',
      abilityIncrease: 'strength',
    });
    expect(lastCall().args).not.toHaveProperty('classEntryId');
    expect(snapshot?.entries.find((entry) => entry._id === 'a')).toMatchObject({
      state: { classEntryId: kind === 'deleted' ? 'deleted-class' : 'fighter' },
    });
  },
);

test('racial Hit Dice count toward Hit Dice but not Level, ability increases accept the character-level reading, and missing racial hit points leave HP not complete', () => {
  const levels: Level[] = ['a', 'b', 'c'].map((id) => ({
    id,
    hp: 6,
    classId: 'fighter',
  }));
  renderSheet(buildSheet({ race: { key: 'human', hitDice: 1 }, levels }));
  const summaryValue = (label: string) =>
    screen.getByText(label, { selector: 'dt' }).nextElementSibling;
  expect(summaryValue('Level')).toHaveTextContent('3');
  expect(summaryValue('Hit Dice')).toHaveTextContent('4');

  expect(
    within(row(3)).queryByText('Choose an ability increase.'),
  ).not.toBeInTheDocument();
  expect(abilityPicker(3)).not.toHaveClass('ring-sky-400/80');
  expect(
    within(row(2)).queryByText('Choose an ability increase.'),
  ).not.toBeInTheDocument();

  const hp = screen.getByRole('button', { name: 'HP not complete, breakdown' });
  fireEvent.click(hp);
  expect(
    within(screen.getByRole('group', { name: 'HP breakdown' })).getByText(
      'Not complete: racial Hit Dice have no hit points yet.',
    ),
  ).toBeVisible();
});

test('a Prestige Class shows its entry prerequisites now and at its first level apart, each accepted alone, and its later levels show none', () => {
  const input = withPrestigeRogue(
    buildSheet({
      levels: [
        { id: 'a', hp: 8, classId: 'rogue' },
        { id: 'b', hp: 8, classId: 'rogue' },
      ],
    }),
  );
  const catalogEntries = input.catalogEntries.map((entry) =>
    entry._id === 'rogue'
      ? { ...entry, prerequisites: [{ ability: 'strength' as const, min: 13 }] }
      : entry,
  );
  const calculated = calculateCharacterSheetProjections({
    characterKind: 'pc',
    entries: input.entries,
    catalogEntries,
  });
  renderSheet({
    ...input,
    catalogEntries,
    calculated: calculated.current,
    permanentCalculated: calculated.permanent,
  });
  const first = within(row(1));
  const now = within(first.getByRole('group', { name: 'Prerequisites now' }));
  const atLevel = within(
    first.getByRole('group', { name: 'Prerequisites at recorded level 1' }),
  );
  expect(now.getByText('Prerequisites not met')).toBeVisible();
  expect(
    now.getByRole('list', { name: 'Prerequisites now' }),
  ).toHaveTextContent('Strength 13 not met');
  expect(atLevel.getByText('Prerequisites not met')).toBeVisible();
  const accept = now.getByRole('button', { name: /^Accept / });
  fireEvent.click(accept);
  expect(calls.at(-1)).toMatchObject({
    name: 'accept',
    args: { check: 'prerequisites.current' },
  });
  expect(atLevel.getByRole('button', { name: /^Accept / })).toBeEnabled();
  expect(
    within(row(2)).queryByRole('group', { name: /^Prerequisites/ }),
  ).toBeNull();
  expect(
    screen.queryByRole('button', { name: /(earlier|later) at level/ }),
  ).toBeNull();
});
