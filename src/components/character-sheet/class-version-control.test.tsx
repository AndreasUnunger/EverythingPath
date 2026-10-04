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
  calculateFixtureSheetProjections as calculateCharacterSheetProjections,
  emptyOwnerCandidates,
  withClasses,
  type Accepted,
  type ExtraClass,
  type Level,
} from './character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';

// Original and Unchained versions of a class (#406): one switch for all of
// the class's levels, waiting, refused and retried beside the control that
// asked, and the mixed-version warning beside the Class Levels.

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
    characterSheet: { editClassLevel: 'editLevel' },
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
  '~/components/ui/select',
  () => import('../weekly-draft-workspace/native-select-test-double'),
);

const unchainedRogue: ExtraClass = {
  id: 'unchained-rogue',
  name: 'Rogue (Unchained)',
  like: 'rogue',
  counterpartOf: 'rogue',
};
const mixedMessage =
  'Original and Unchained versions of the same class are both present.';

/** Rogue levels (with any other levels), some of them moved to Unchained. */
function rogueSheet({
  levels = [
    { id: 'a', hp: 8, classId: 'rogue', abilityIncrease: null },
    { id: 'b', hp: 7, classId: 'rogue', abilityIncrease: null },
  ],
  unchained = [],
  lastOperationId,
  accepted,
}: {
  levels?: Level[];
  unchained?: string[];
  lastOperationId?: string;
  accepted?: Accepted[];
} = {}) {
  return withClasses(
    buildSheet({ levels, lastOperationId, accepted }),
    [unchainedRogue],
    Object.fromEntries(unchained.map((id) => [id, unchainedRogue.id])),
  );
}

const page = () => <CharacterSheetBlocks blocks={['levels']} />;
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
const versions = (level: number) =>
  within(row(level)).getByRole('group', { name: 'Version of Rogue' });
const version = (level: number, name: 'Original' | 'Unchained') =>
  within(versions(level)).getByRole('button', { name });
const hpInput = (level: number) =>
  within(row(level)).getByRole('textbox', {
    name: `Hit points gained at level ${level}`,
  });
function lastCall() {
  const call = calls.at(-1);
  if (!call) throw new Error('Expected a write');
  return call;
}
const ownEcho = (next: Parameters<typeof rogueSheet>[0]) =>
  rogueSheet({ ...next, lastOperationId: String(lastCall().args.operationId) });

beforeEach(() => {
  calls = [];
  snapshot = undefined;
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });
});

test('Original and Unchained stay apart in the picker; one switch changes every Rogue level in a single write, keeps each level and its values, keeps focus and stays quiet about its own echo', async () => {
  const view = renderSheet(rogueSheet());
  fireEvent.click(classPicker(1));
  const cards = within(screen.getByRole('dialog'));
  expect(cards.getByRole('radio', { name: 'Rogue' })).toBeChecked();
  expect(
    cards.getByRole('radio', { name: 'Rogue (Unchained)' }),
  ).toHaveAccessibleDescription(/Unchained/);
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(() => expect(classPicker(1)).toHaveFocus());

  for (const level of [1, 2]) {
    expect(version(level, 'Original')).toHaveAttribute('aria-pressed', 'true');
    expect(version(level, 'Unchained')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(version(level, 'Unchained')).toHaveAccessibleDescription(
      'Change all Rogue levels',
    );
  }
  const unchained = version(1, 'Unchained');
  unchained.focus();
  fireEvent.click(unchained);
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall()).toMatchObject({
    name: 'switchClassVersion',
    args: { entryId: 'a', classEntryId: 'unchained-rogue' },
  });
  // The family waits; the displayed version is still the saved one.
  expect(within(row(1)).getByText('Saving…')).toBeVisible();
  expect(within(row(2)).queryByText('Saving…')).not.toBeInTheDocument();
  for (const level of [1, 2]) {
    expect(version(level, 'Unchained')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(version(level, 'Original')).toHaveAttribute('aria-pressed', 'true');
  }
  expect(classPicker(1)).toHaveTextContent('Rogue');
  fireEvent.click(version(2, 'Unchained'));
  expect(calls).toHaveLength(1);

  view.show(ownEcho({ unchained: ['a', 'b'] }));
  await act(async () => {
    lastCall().resolve(null);
  });
  expect(within(row(1)).getByText('Class version saved.')).toBeVisible();
  expect(within(row(2)).queryByText('Class version saved.')).toBeNull();
  expect(unchained).toHaveFocus();
  for (const [level, id, hp] of [
    [1, 'a', '8'],
    [2, 'b', '7'],
  ] as const) {
    expect(row(level)).toHaveAttribute('id', `sheet-level-${id}`);
    expect(classPicker(level)).toHaveTextContent('Rogue (Unchained)');
    expect(hpInput(level)).toHaveValue(hp);
    expect(version(level, 'Unchained')).toHaveAttribute('aria-pressed', 'true');
  }
  expect(calls).toHaveLength(1);
  expect(
    screen.queryAllByText('Updated by another player.', { exact: true }),
  ).toHaveLength(0);
  expect(
    within(levelsRegion()).queryByText(/^Class (Levels|versions) updated/),
  ).not.toBeInTheDocument();
});

test('a refused switch leaves the original shown with its reason and Retry, which asks for the same version again and then reports it saved', async () => {
  const view = renderSheet(rogueSheet());
  fireEvent.click(version(2, 'Unchained'));
  await act(async () => {
    lastCall().reject(new ConvexError('Editing is paused'));
  });
  expect(within(row(2)).getByRole('alert')).toHaveTextContent(
    "Class version wasn't saved: Editing is paused. Try again.",
  );
  expect(version(2, 'Original')).toHaveAttribute('aria-pressed', 'true');
  expect(classPicker(2)).toHaveTextContent('Rogue');
  expect(version(1, 'Unchained')).not.toHaveAttribute('aria-disabled');

  fireEvent.click(
    within(row(2)).getByRole('button', { name: 'Retry version of Rogue' }),
  );
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toMatchObject({
    entryId: 'b',
    classEntryId: 'unchained-rogue',
  });
  view.show(ownEcho({ unchained: ['a', 'b'] }));
  await act(async () => {
    lastCall().resolve(null);
  });
  expect(within(row(2)).getByText('Class version saved.')).toBeVisible();
  expect(within(row(2)).queryByRole('alert')).not.toBeInTheDocument();
  expect(
    within(row(2)).queryByRole('button', { name: /Retry/ }),
  ).not.toBeInTheDocument();
});

test('another player’s switch is announced once for the section; Unspecified and single-version levels have no switch', () => {
  const levels: Level[] = [
    { id: 'a', hp: 8, classId: 'rogue' },
    { id: 'b', hp: null },
    { id: 'c', hp: 10, classId: 'fighter' },
  ];
  const view = renderSheet(rogueSheet({ levels }));
  expect(versions(1)).toBeVisible();
  for (const level of [2, 3])
    expect(
      within(row(level)).queryByRole('group', { name: /^Version of/ }),
    ).not.toBeInTheDocument();
  expect(screen.queryByText(/Change all/)).toHaveTextContent(
    'Change all Rogue levels',
  );

  view.show(
    rogueSheet({ levels, unchained: ['a'], lastOperationId: 'other-player' }),
  );
  expect(classPicker(1)).toHaveTextContent('Rogue (Unchained)');
  expect(version(1, 'Unchained')).toHaveAttribute('aria-pressed', 'true');
  expect(
    within(levelsRegion()).getAllByText(/^Class (Levels|versions) updated/),
  ).toHaveLength(1);
  expect(
    screen.queryAllByText('Updated by another player.', { exact: true }),
  ).toHaveLength(0);
  fireEvent.click(
    within(levelsRegion()).getByRole('button', {
      name: 'Dismiss Class Levels update',
    }),
  );
  expect(
    within(levelsRegion()).queryByText(/^Class (Levels|versions) updated/),
  ).not.toBeInTheDocument();
  expect(calls).toEqual([]);
});

test('a remote version switch has one section notice while an ordinary changed row choice retains its own notice', () => {
  const first: Level = {
    id: 'a',
    hp: 8,
    classId: 'rogue',
    abilityIncrease: null,
  };
  const second: Level = {
    id: 'b',
    hp: 7,
    classId: 'rogue',
    abilityIncrease: null,
  };
  const levels = [first, second];
  const view = renderSheet(rogueSheet({ levels }));
  view.show(
    rogueSheet({
      levels: [{ ...first, abilityIncrease: 'dexterity' }, second],
      unchained: ['a', 'b'],
      lastOperationId: 'other-player',
    }),
  );
  expect(
    within(levelsRegion()).getAllByText(/^Class (Levels|versions) updated/),
  ).toHaveLength(1);
  expect(
    within(row(1)).getByText('Updated by another player.', { exact: true }),
  ).toBeVisible();
  expect(
    within(row(2)).queryByText('Updated by another player.', { exact: true }),
  ).not.toBeInTheDocument();
  expect(
    screen.getAllByText('Updated by another player.', { exact: true }),
  ).toHaveLength(1);
  expect(calls).toEqual([]);
});

test('mixed versions warn beside the Class Levels with Accept and Reopen; the warning never disables a version switch or a class choice', async () => {
  const view = renderSheet(rogueSheet({ unchained: ['b'] }));
  const warning = within(levelsRegion()).getByText(mixedMessage);
  expect(warning).toBeVisible();
  expect(version(1, 'Original')).toHaveAttribute('aria-pressed', 'true');
  expect(version(2, 'Unchained')).toHaveAttribute('aria-pressed', 'true');
  for (const level of [1, 2]) {
    expect(version(level, 'Original')).toBeEnabled();
    expect(classPicker(level)).toBeEnabled();
  }
  fireEvent.click(
    within(levelsRegion()).getByRole('button', { name: 'Accept' }),
  );
  await waitFor(() => expect(calls).toHaveLength(1));
  const accept = lastCall();
  expect(accept).toMatchObject({
    name: 'accept',
    args: { check: 'classVersions' },
  });
  view.show(
    rogueSheet({
      unchained: ['b'],
      lastOperationId: String(accept.args.operationId),
      accepted: [
        {
          check: 'classVersions',
          subject: String(accept.args.subject),
          fingerprint: String(accept.args.fingerprint),
        },
      ],
    }),
  );
  await act(async () => {
    accept.resolve(null);
  });
  expect(within(levelsRegion()).getByText('Accepted')).toBeVisible();
  expect(
    within(levelsRegion()).getByRole('button', { name: 'Reopen' }),
  ).toBeEnabled();
  expect(version(1, 'Unchained')).toBeEnabled();
});

test('maintenance disables every version switch, described by the one reason beside Level up, and writes nothing', () => {
  const message = 'Editing is paused for maintenance.';
  maintenance.mockReturnValue({ kind: 'maintenance', readOnly: true, message });
  renderSheet(rogueSheet());
  for (const level of [1, 2]) {
    expect(version(level, 'Unchained')).toBeDisabled();
    expect(version(level, 'Unchained')).toHaveAccessibleDescription(
      `Change all Rogue levels ${message}`,
    );
  }
  expect(within(levelsRegion()).getAllByText(message)).toHaveLength(1);
  fireEvent.click(version(1, 'Unchained'));
  expect(calls).toEqual([]);
});

type CatalogEntry = CharacterSheetSnapshot['catalogEntries'][number];
type Entry = CharacterSheetSnapshot['entries'][number];

/**
 * An Unchained Rogue level with Scout, whose replaced feature the Unchained
 * schedule lacks, and an Unchained Monk level with an original Monk
 * Archetype. Synthetic test facts, not curated content.
 */
function archetypeSheet(accepted: Accepted[] = []) {
  const classes = withClasses(
    buildSheet({
      levels: [
        { id: 'a', hp: 8, classId: 'rogue' },
        { id: 'b', hp: 8, classId: 'fighter' },
      ],
      accepted,
    }),
    [
      { ...unchainedRogue, detail: { featuresByLevel: [] } },
      { id: 'monk', name: 'Monk' },
      {
        id: 'unchained-monk',
        name: 'Monk (Unchained)',
        counterpartOf: 'monk',
      },
    ],
    { a: 'unchained-rogue', b: 'unchained-monk' },
  );
  const definition = (id: string, name: string, detail: unknown) =>
    ({
      _id: id,
      _creationTime: 7,
      scope: 'character',
      characterId: classes.character._id,
      name,
      ruleIdentity: id,
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail,
    }) as unknown as CatalogEntry;
  const selection = (id: string, catalogEntryId: string) =>
    ({
      _id: id,
      _creationTime: 60,
      characterId: classes.character._id,
      kind: 'archetype',
      active: true,
      catalogEntryId,
      state: { kind: 'archetype' },
    }) as unknown as Entry;
  const catalogEntries = [
    ...classes.catalogEntries.map((entry) =>
      entry._id === 'rogue' && entry.detail.kind === 'class'
        ? ({
            ...entry,
            detail: {
              ...entry.detail,
              featuresByLevel: [{ classLevel: 1, catalogEntryId: 'uncanny' }],
            },
          } as CatalogEntry)
        : entry,
    ),
    definition('uncanny', 'Uncanny Dodge', { kind: 'classFeature' }),
    definition('scout', 'Scout', {
      kind: 'archetype',
      classEntryIds: ['rogue'],
      replaces: [{ classLevel: 1, catalogEntryId: 'uncanny', scope: 'whole' }],
      adds: [],
    }),
    definition('drunken-master', 'Drunken Master', {
      kind: 'archetype',
      classEntryIds: ['monk'],
      replaces: [],
      adds: [],
    }),
  ];
  const entries = [
    ...classes.entries,
    selection('scout-row', 'scout'),
    selection('drunken-row', 'drunken-master'),
  ];
  const calculated = calculateCharacterSheetProjections({
    characterKind: 'pc',
    entries,
    catalogEntries,
  });
  return {
    ...classes,
    entries,
    catalogEntries,
    calculated: calculated.current,
    permanentCalculated: calculated.permanent,
  };
}

test('an unmatched replacement and an original Monk Archetype warn verbatim at their Archetypes, each accepted alone, and nothing disabled', async () => {
  snapshot = archetypeSheet();
  const view = render(
    <CharacterSheetBlocks blocks={['levels', 'archetypes']} />,
  );
  const archetypes = within(screen.getByRole('region', { name: 'Archetypes' }));
  const unmatched = archetypes.getByText(
    'Scout: the replaced feature has no matching row in Rogue (Unchained).',
  );
  const monk = archetypes.getByText(
    "Drunken Master was written for the original class and cannot automatically replace this class's features.",
  );
  for (const message of [unmatched, monk]) expect(message).toBeVisible();
  expect(
    within(levelsRegion()).queryByText(mixedMessage),
  ).not.toBeInTheDocument();

  const acceptMonk = archetypes.getByRole('button', {
    name: 'Accept',
    description: /Drunken Master was written/,
  });
  fireEvent.click(acceptMonk);
  await waitFor(() => expect(calls).toHaveLength(1));
  const accept = lastCall();
  expect(accept).toMatchObject({
    name: 'accept',
    args: { check: 'archetypeUnchainedMonk' },
  });
  snapshot = archetypeSheet([
    {
      check: 'archetypeUnchainedMonk',
      subject: String(accept.args.subject),
      fingerprint: String(accept.args.fingerprint),
    },
  ]);
  view.rerender(<CharacterSheetBlocks blocks={['levels', 'archetypes']} />);
  await act(async () => {
    accept.resolve(null);
  });
  expect(
    archetypes.getByRole('button', {
      name: 'Reopen',
      description: /Drunken Master was written/,
    }),
  ).toBeEnabled();
  expect(
    archetypes.getByRole('button', {
      name: 'Accept',
      description: /Scout: the replaced feature/,
    }),
  ).toBeEnabled();
  expect(classPicker(1)).toBeEnabled();
  expect(
    within(row(2)).getByRole('button', { name: 'Unchained' }),
  ).toHaveAttribute('aria-pressed', 'true');
});
