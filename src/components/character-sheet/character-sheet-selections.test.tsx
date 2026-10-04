import type { Id } from '@convex/_generated/dataModel';
import { representativeSelectionCatalog } from '@convex/lib/representativeSelectionCatalog';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { calculateCharacterSheet } from '~/lib/character-sheet';
import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import {
  buildSheet,
  characterId,
  emptyOwnerCandidates,
  findCalculatedWarning,
  type Accepted,
  type Level,
} from './character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';

// Feats & traits (#313): slots with their counts, the picker's advisory
// prerequisite preview, saved rows with current and recorded-level checks,
// alignment and deity, and Grants and dormant entries kept with their own
// controls. The real controller runs against recorded mutations.

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
vi.mock(
  '~/components/ui/select',
  () => import('../weekly-draft-workspace/native-select-test-double'),
);

beforeEach(() => {
  calls = [];
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
});

type CatalogEntry = CharacterSheetSnapshot['catalogEntries'][number];
type Entry = CharacterSheetSnapshot['entries'][number];
type Selection = {
  id: string;
  key: string;
  slot?: [string, number];
  level?: string;
  order?: number;
  choice?: string;
  notes?: string;
  active?: boolean;
  kept?: boolean;
  /** A bonus slot's source Class Level. */
  bonusFrom?: string;
};

const selectionCatalog = representativeSelectionCatalog.map(
  (entry) =>
    ({
      ...entry,
      _id: entry.ruleIdentity,
      _creationTime: 7,
      scope: 'character',
      characterId,
    }) as unknown as CatalogEntry,
);
const faithful = {
  ...selectionCatalog[0]!,
  _id: 'faithful-strike',
  name: 'Faithful Strike',
  ruleIdentity: 'faithful-strike',
  prerequisites: [{ alignment: ['LG'] }],
  prerequisiteText: 'Lawful good.',
} as unknown as CatalogEntry;

function selectionEntry(selection: Selection): Entry {
  const catalog =
    selectionCatalog.find((entry) => entry._id === selection.key) ?? faithful;
  const source = selection.bonusFrom
    ? {
        kind: 'slot' as const,
        grantedBy: { kind: 'entry' as const, entryId: selection.bonusFrom },
        slotIndex: 0,
      }
    : undefined;
  const kind = catalog.detail.kind as 'feat' | 'trait';
  return {
    _id: selection.id as Id<'characterSheetEntry'>,
    _creationTime: 60,
    characterId,
    kind,
    active: selection.active ?? true,
    catalogEntryId: catalog._id,
    ...(selection.slot
      ? {
          selectionSlot: {
            id: selection.slot[0],
            position: selection.slot[1],
          },
        }
      : {}),
    ...(source ? { selectionSource: source } : {}),
    ...(selection.level ? { gainedAtClassLevel: selection.level } : {}),
    ...(selection.order !== undefined ? { choiceOrder: selection.order } : {}),
    ...(selection.notes !== undefined ? { notes: selection.notes } : {}),
    ...(selection.kept ? { kept: true } : {}),
    state:
      kind === 'feat'
        ? {
            kind: 'feat',
            choice: selection.choice ?? null,
            slot: source
              ? { grantedBy: source.grantedBy, slotIndex: 0 }
              : 'general',
          }
        : { kind: 'trait', choice: selection.choice ?? null },
  } as Entry;
}

function selectionSheet({
  levels = [{ id: 'level-1', hp: 10, classId: 'fighter' }],
  selections = [],
  bonusSlot,
  grantedFeat = false,
  bonusFeatLevels = [],
  alignment,
  deity,
  accepted = [],
  lastOperationId = 'seed',
  id = characterId,
}: {
  levels?: Level[];
  selections?: Selection[];
  bonusSlot?: { ignoresPrerequisites?: boolean };
  grantedFeat?: boolean;
  /** Fighter levels whose Fighter Bonus Feat opens a slot of its own. */
  bonusFeatLevels?: number[];
  alignment?: string;
  deity?: string;
  accepted?: Accepted[];
  lastOperationId?: string;
  id?: Id<'character'>;
} = {}): CharacterSheetSnapshot {
  const sheet = buildSheet({ levels, hasClasses: true, lastOperationId });
  const featuresByLevel = [
    ...(grantedFeat ? [{ classLevel: 1, catalogEntryId: 'skill-focus' }] : []),
    ...bonusFeatLevels.map((classLevel) => ({
      classLevel,
      catalogEntryId: 'fighter-bonus-feat',
    })),
  ];
  const catalogEntries = [
    ...sheet.catalogEntries.map((entry) =>
      entry._id === 'fighter'
        ? ({
            ...entry,
            ...(bonusSlot
              ? {
                  grantsSlots: [
                    {
                      kind: 'feat',
                      count: 1,
                      featTypes: ['combat'],
                      ...bonusSlot,
                    },
                  ],
                }
              : {}),
            ...(featuresByLevel.length > 0
              ? { detail: { ...entry.detail, featuresByLevel } }
              : {}),
          } as CatalogEntry)
        : entry,
    ),
    ...selectionCatalog,
    faithful,
  ];
  const entries = [
    ...sheet.entries.map((entry) =>
      entry.kind === 'base'
        ? ({
            ...entry,
            state: {
              ...entry.state,
              ...(alignment ? { alignment } : {}),
              ...(deity ? { deity } : {}),
            },
          } as Entry)
        : entry,
    ),
    ...selections.map(selectionEntry),
  ];
  const input = { entries, catalogEntries, characterKind: 'pc' as const };
  const calculated = calculateCharacterSheet(input);
  return {
    ...sheet,
    character: { ...sheet.character, _id: id },
    entries,
    catalogEntries,
    calculated,
    permanentCalculated: calculateCharacterSheet(input, {
      permanentOnly: true,
    }),
    acceptedWarnings: accepted.map((warning, index) => ({
      _id: `accepted-${index}` as Id<'acceptedWarning'>,
      _creationTime: 10 + index,
      characterId: id,
      acceptedBy: 'other-player',
      acceptedAt: 10 + index,
      ...warning,
    })),
  };
}

function renderSelections(initial: CharacterSheetSnapshot) {
  snapshot = initial;
  const view = render(<CharacterSheetBlocks blocks={['selections']} />);
  return {
    rerender(next: CharacterSheetSnapshot, scopeCharacterId = characterId) {
      snapshot = next;
      view.rerender(
        <CharacterSheetBlocks
          blocks={['selections']}
          scopeCharacterId={scopeCharacterId}
        />,
      );
    },
  };
}

const slot = (name: string) => within(screen.getByRole('group', { name }));
const row = (name: string) => within(screen.getByRole('listitem', { name }));
const picker = (name: RegExp) => within(screen.getByRole('group', { name }));
function lastCall(name: string) {
  const call = calls.filter((candidate) => candidate.name === name).at(-1);
  if (!call) throw new Error(`Expected a ${name} call`);
  return call;
}
async function submit(button: HTMLElement) {
  fireEvent.click(button);
  await act(async () => undefined);
}
async function settle(call: Call, value: unknown = null) {
  await act(async () => {
    call.resolve(value);
  });
}

/** The innermost element holding both, such as one line of a row. */
function commonAncestor(first: Element, second: Element) {
  let node: Element | null = first;
  while (node && !node.contains(second)) node = node.parentElement;
  if (!node) throw new Error('Expected a shared ancestor');
  return node;
}
function isBefore(first: Element, second: Element) {
  return Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}
/** Catalog prose the calculation never reads, set on the snapshot alone. */
function withCatalogText(
  sheet: CharacterSheetSnapshot,
  catalogEntryId: string,
  text: { description?: string },
): CharacterSheetSnapshot {
  return {
    ...sheet,
    catalogEntries: sheet.catalogEntries.map((entry) =>
      entry._id === catalogEntryId ? { ...entry, ...text } : entry,
    ),
  };
}

const powerAttack: Selection = {
  id: 'power-attack-entry',
  key: 'power-attack',
  slot: ['feat:general', 0],
  level: 'level-1',
  order: 0,
};

test('the first Hit Die opens one general feat, the class its bonus feat, and Additional Traits two more traits beside Traits and the Drawback', () => {
  renderSelections(
    selectionSheet({
      bonusSlot: {},
      selections: [
        {
          id: 'additional',
          key: 'additional-traits',
          slot: ['feat:general', 0],
          level: 'level-1',
          order: 0,
        },
      ],
    }),
  );
  const block = within(screen.getByRole('region', { name: 'Feats & traits' }));
  expect(block.getByText('1/2 feats · 0/4 traits')).toBeVisible();
  expect(slot('General feats').getByText('1/1')).toBeVisible();
  expect(
    slot('General feats').getByRole('listitem', { name: 'Additional Traits' }),
  ).toBeVisible();
  const bonus = slot('Fighter feats');
  expect(bonus.getByText('0/1')).toBeVisible();
  expect(bonus.getByText('1 open')).toHaveClass('text-sky-300');
  expect(bonus.getByText('Usually combat feats')).toBeVisible();
  expect(bonus.getByText('1 fighter feat remains to select.')).toHaveClass(
    'text-sky-300',
  );
  expect(bonus.getByRole('button', { name: 'Add a feat' }).className).toContain(
    'ring-sky-400',
  );
  expect(slot('Traits').getByText('0/2')).toBeVisible();
  expect(slot('Additional Traits').getByText('0/2')).toBeVisible();
  expect(slot('Drawback').getByText('0/1')).toBeVisible();
  for (const [group, name] of [
    ['Traits', 'Add a trait'],
    ['Additional Traits', 'Add a trait'],
    ['Drawback', 'Add a drawback'],
  ] as const) {
    expect(slot(group).getByRole('button', { name }).className).not.toContain(
      'ring-sky-400',
    );
    expect(slot(group).queryByText(/remain to select/)).toBeNull();
  }
  expect(screen.queryByText('Not tied to a level')).toBeNull();
});

test('budget copy is singular for one open choice, and Fighter bonus feats from different levels have labels of their own', () => {
  renderSelections(
    selectionSheet({
      levels: [
        { id: 'level-1', hp: 10, classId: 'fighter' },
        { id: 'level-2', hp: 10, classId: 'fighter' },
      ],
      bonusFeatLevels: [1, 2],
    }),
  );
  expect(
    slot('General feats').getByText('1 general feat remains to select.'),
  ).toHaveClass('text-sky-300');
  for (const level of [1, 2]) {
    const bonus = slot(`Fighter Bonus Feat (level ${level})`);
    expect(bonus.getByText('0/1')).toBeVisible();
    expect(
      bonus.getByText(
        `1 fighter bonus feat (level ${level}) remains to select.`,
      ),
    ).toBeVisible();
  }
});

test('the picker shows unmet supported prerequisites, still adds the feat, and returns focus to Add', async () => {
  renderSelections(selectionSheet());
  const add = slot('General feats').getByRole('button', { name: 'Add a feat' });
  fireEvent.click(add);
  const choose = picker(/Choose a feat/);
  expect(choose.getByRole('searchbox', { name: 'Search feats' })).toHaveFocus();
  fireEvent.click(choose.getByRole('button', { name: 'Power Attack' }));
  const staged = within(
    choose.getByRole('group', { name: 'General feats selection' }),
  );
  expect(staged.getByText('Prerequisites not met')).toBeVisible();
  const now = within(staged.getByRole('list', { name: 'Prerequisites now' }));
  expect(now.getByText(/Strength 13/)).toHaveTextContent('not met');
  expect(now.getByText(/BAB \+1/)).toHaveTextContent('met');
  expect(
    staged.getByText('Prerequisites: Str 13, base attack bonus +1.'),
  ).toBeVisible();
  fireEvent.change(choose.getByRole('combobox', { name: 'Level gained' }), {
    target: { value: 'level-1' },
  });
  expect(
    staged.getByRole('list', { name: 'Prerequisites at recorded level 1' }),
  ).toBeVisible();
  await submit(choose.getByRole('button', { name: 'Add Power Attack' }));
  expect(lastCall('fillSelectionSlot').args).toMatchObject({
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: 'power-attack',
    choice: null,
    gainedAtClassLevel: 'level-1',
  });
  await settle(lastCall('fillSelectionSlot'), 'power-attack-entry');
  expect(screen.queryByRole('group', { name: /Choose a feat/ })).toBeNull();
  expect(add).toHaveFocus();
});

test('a trait with only unmodeled prose stays readable without a failed or unchecked status', async () => {
  renderSelections(selectionSheet());
  fireEvent.click(slot('Traits').getByRole('button', { name: 'Add a trait' }));
  const choose = picker(/Choose a trait/);
  fireEvent.click(
    choose.getByRole('button', { name: 'Prepared campaign trait' }),
  );
  const staged = within(
    choose.getByRole('group', { name: 'Traits selection' }),
  );
  expect(
    staged.getByText('Prerequisites: Campaign-specific background agreement.'),
  ).toBeVisible();
  expect(staged.queryByText(/Prerequisites (not )?met/)).toBeNull();
  expect(staged.queryByText(/not checked/i)).toBeNull();
  expect(staged.queryByRole('list')).toBeNull();
  await submit(
    choose.getByRole('button', { name: 'Add Prepared campaign trait' }),
  );
  expect(lastCall('fillSelectionSlot').args).not.toHaveProperty(
    'gainedAtClassLevel',
  );
});

class TestPointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? 'mouse';
    this.isPrimary = init.isPrimary ?? true;
  }
}

test('a card dropped outside the selection area returns with feedback, one dropped inside is staged, and a card the slot cannot take is refused', async () => {
  vi.stubGlobal('PointerEvent', TestPointerEvent);
  const view = renderSelections(selectionSheet());
  fireEvent.click(
    slot('General feats').getByRole('button', { name: 'Add a feat' }),
  );
  const choose = picker(/Choose a feat/);
  const area = choose.getByRole('group', { name: 'General feats selection' });
  vi.spyOn(area, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(100, 100, 120, 80),
  );
  const card = choose.getByRole('button', { name: 'Cleave' });
  fireEvent.pointerDown(card, { button: 0, clientX: 20, clientY: 20 });
  fireEvent.pointerMove(card, { clientX: 40, clientY: 45 });
  fireEvent.pointerUp(card, { clientX: 40, clientY: 45 });
  expect(choose.getByText(/Your selection is unchanged/)).toBeVisible();
  expect(card).toHaveAttribute('aria-pressed', 'false');
  fireEvent.pointerDown(card, { button: 0, clientX: 20, clientY: 20 });
  fireEvent.pointerMove(card, { clientX: 150, clientY: 130 });
  expect(area).toHaveAttribute('data-drop-active', 'true');
  fireEvent.pointerUp(card, { clientX: 150, clientY: 130 });
  expect(card).toHaveAttribute('aria-pressed', 'true');
  expect(within(area).getByText('Cleave')).toBeVisible();

  // Another player's change turns the staged card into a trait: it cannot
  // fill a feat slot, so Add explains and changes nothing.
  const next = selectionSheet();
  view.rerender({
    ...next,
    catalogEntries: next.catalogEntries.map((entry) =>
      entry._id === 'cleave'
        ? ({ ...entry, detail: { kind: 'trait' } } as CatalogEntry)
        : entry,
    ),
  });
  expect(
    within(area).getByText(
      "Cleave is a trait, so it can't fill this feat slot. Nothing changed.",
    ),
  ).toBeVisible();
  await submit(choose.getByRole('button', { name: 'Add Cleave' }));
  expect(calls.filter((call) => call.name === 'fillSelectionSlot')).toEqual([]);
  vi.unstubAllGlobals();
});

test('an ordinary trait in the Drawback slot is allowed and its advisory can be accepted', async () => {
  const view = renderSelections(selectionSheet());
  fireEvent.click(
    slot('Drawback').getByRole('button', { name: 'Add a drawback' }),
  );
  const choose = picker(/Choose a drawback/);
  fireEvent.click(choose.getByRole('button', { name: 'Reactionary' }));
  await submit(choose.getByRole('button', { name: 'Add Reactionary' }));
  expect(lastCall('fillSelectionSlot').args).toMatchObject({
    slotId: 'trait:drawback',
    position: 0,
    catalogEntryId: 'reactionary',
  });
  await settle(lastCall('fillSelectionSlot'));
  view.rerender(
    selectionSheet({
      selections: [
        {
          id: 'reactionary-entry',
          key: 'reactionary',
          slot: ['trait:drawback', 0],
        },
      ],
    }),
  );
  const saved = row('Reactionary');
  const message = 'This slot normally holds a drawback.';
  expect(saved.getByText(message)).toBeVisible();
  fireEvent.click(saved.getByRole('button', { name: `Accept ${message}` }));
  expect(lastCall('accept').args).toMatchObject({
    check: 'traitSlotType',
    subject: 'reactionary-entry',
  });
});

test('a saved feat keeps its name, Level gained and Remove on the first line, with its description below and Order, Edit and Replace after', () => {
  const description = 'Trade melee accuracy for bonus damage.';
  renderSelections(
    withCatalogText(
      selectionSheet({ selections: [powerAttack] }),
      'power-attack',
      {
        description,
      },
    ),
  );
  const saved = row('Power Attack');
  const name = saved.getByRole('heading', { name: 'Power Attack' });
  const remove = saved.getByRole('button', { name: 'Remove Power Attack' });
  const firstLine = commonAncestor(name, remove);
  expect(firstLine).toContainElement(
    saved.getByRole('combobox', { name: 'Level gained' }),
  );
  const below = [
    saved.getByText(description),
    saved.getByText('Prerequisites: Str 13, base attack bonus +1.'),
    saved.getByText('Order 1'),
    saved.getByRole('button', { name: 'Edit Power Attack' }),
    saved.getByRole('button', { name: 'Replace Power Attack' }),
  ];
  for (const element of below) {
    expect(firstLine).not.toContainElement(element);
    expect(isBefore(firstLine, element)).toBe(true);
  }
  expect(isBefore(below[0]!, below[3]!)).toBe(true);
});

test('drawback guidance reads under its own label, never as a prerequisite, in the picker and on the saved row', () => {
  const guidance =
    'Record the chosen drawback and its narrative consequences in notes.';
  function expectOwnLabel(text: HTMLElement) {
    const paragraph = text.closest('p');
    if (!paragraph) throw new Error('Expected the guidance paragraph');
    expect(within(paragraph).getByText('Guidance')).toBeVisible();
    expect(paragraph).not.toHaveTextContent(/Prerequisites/);
  }
  const view = renderSelections(selectionSheet());
  fireEvent.click(
    slot('Drawback').getByRole('button', { name: 'Add a drawback' }),
  );
  const choose = picker(/Choose a drawback/);
  fireEvent.click(choose.getByRole('button', { name: 'Prepared drawback' }));
  const staged = within(
    choose.getByRole('group', { name: 'Drawback selection' }),
  );
  expectOwnLabel(staged.getByText(guidance));
  expect(staged.queryByText(/^Prerequisites:/)).toBeNull();
  fireEvent.click(choose.getByRole('button', { name: 'Close picker' }));

  view.rerender(
    selectionSheet({
      selections: [
        {
          id: 'drawback-entry',
          key: 'prepared-drawback',
          slot: ['trait:drawback', 0],
        },
      ],
    }),
  );
  const saved = row('Prepared drawback');
  expectOwnLabel(saved.getByText(guidance));
  expect(saved.queryByText(/^Prerequisites:/)).toBeNull();
  expect(saved.queryByRole('combobox', { name: 'Level gained' })).toBeNull();
  const firstLine = commonAncestor(
    saved.getByRole('heading', { name: 'Prepared drawback' }),
    saved.getByRole('button', { name: 'Remove Prepared drawback' }),
  );
  expect(firstLine).not.toContainElement(saved.getByText(guidance));
});

test('current and recorded-level warnings are separate and each Accept or Reopen changes only its own warning', async () => {
  const sheet = selectionSheet({ selections: [powerAttack] });
  const view = renderSelections(sheet);
  const saved = row('Power Attack');
  expect(saved.getAllByText('Prerequisites not met')).toHaveLength(2);
  const current = 'Power Attack: Strength 13 not met now.';
  const recorded = 'Power Attack: Strength 13 not met at level 1 as recorded.';
  expect(saved.getByText(current)).toBeVisible();
  const atLevel = within(
    saved.getByRole('group', { name: 'Prerequisites at recorded level 1' }),
  );
  expect(atLevel.getByText(recorded)).toBeVisible();
  expect(atLevel.queryByText(current)).toBeNull();
  expect(screen.queryByText(/ineligible/i)).toBeNull();

  fireEvent.click(atLevel.getByRole('button', { name: `Accept ${recorded}` }));
  const accept = lastCall('accept');
  expect(accept.args).toMatchObject({
    check: 'prerequisites.recordedLevel',
  });
  expect(
    saved.getByRole('button', { name: `Accept ${current}` }),
  ).toBeEnabled();
  await settle(accept);
  view.rerender(
    selectionSheet({
      selections: [powerAttack],
      accepted: [findCalculatedWarning(sheet, 'prerequisites.recordedLevel')],
    }),
  );
  expect(atLevel.getByText('Accepted')).toBeVisible();
  expect(
    saved.getByRole('button', { name: `Accept ${current}` }),
  ).toBeVisible();
  fireEvent.click(atLevel.getByRole('button', { name: `Reopen ${recorded}` }));
  expect(lastCall('reopen').args).toMatchObject({
    check: 'prerequisites.recordedLevel',
  });
});

test('a saved feat edits its choice and same-level order, and undoing its level keeps only the current check', async () => {
  const view = renderSelections(selectionSheet({ selections: [powerAttack] }));
  const saved = row('Power Attack');
  expect(saved.getByText('Order 1')).toBeVisible();
  fireEvent.click(saved.getByRole('button', { name: 'Edit Power Attack' }));
  const editor = within(
    screen.getByRole('form', { name: 'Edit Power Attack' }),
  );
  fireEvent.change(editor.getByRole('textbox', { name: /Choice for/ }), {
    target: { value: ' Longsword ' },
  });
  fireEvent.change(editor.getByRole('textbox', { name: 'Choice order' }), {
    target: { value: '2' },
  });
  fireEvent.click(editor.getByRole('button', { name: 'Save Power Attack' }));
  await act(async () => undefined);
  expect(lastCall('editSelection').args).toMatchObject({
    entryId: 'power-attack-entry',
    choice: 'Longsword',
    choiceOrder: 1,
  });
  expect(lastCall('editSelection').args).not.toHaveProperty('notes');
  await settle(lastCall('editSelection'));
  expect(screen.queryByRole('form', { name: 'Edit Power Attack' })).toBeNull();
  expect(
    saved.getByRole('button', { name: 'Edit Power Attack' }),
  ).toHaveFocus();

  fireEvent.change(saved.getByRole('combobox', { name: 'Level gained' }), {
    target: { value: '' },
  });
  expect(lastCall('editSelection').args).toMatchObject({
    entryId: 'power-attack-entry',
    gainedAtClassLevel: null,
  });
  await settle(lastCall('editSelection'));
  view.rerender(
    selectionSheet({ selections: [{ ...powerAttack, level: undefined }] }),
  );
  expect(
    saved.queryByRole('group', { name: /Prerequisites at recorded level/ }),
  ).toBeNull();
  expect(
    saved.getByText('Power Attack: Strength 13 not met now.'),
  ).toBeVisible();
  expect(saved.queryByText(/^Order/)).toBeNull();
});

test('choice order is required once recorded and must be a whole number, in the field, without a write', async () => {
  renderSelections(selectionSheet({ selections: [powerAttack] }));
  fireEvent.click(
    row('Power Attack').getByRole('button', { name: 'Edit Power Attack' }),
  );
  const editor = within(
    screen.getByRole('form', { name: 'Edit Power Attack' }),
  );
  const order = editor.getByRole('textbox', { name: 'Choice order' });
  const save = editor.getByRole('button', { name: 'Save Power Attack' });
  for (const [value, message] of [
    ['', 'Enter a choice order.'],
    ['first', 'Choice order must be a number.'],
    ['1.5', 'Choice order must be a whole number of 1 or more.'],
    ['0', 'Choice order must be a whole number of 1 or more.'],
  ] as const) {
    fireEvent.change(order, { target: { value } });
    fireEvent.click(save);
    await act(async () => undefined);
    expect(editor.getByRole('alert')).toHaveTextContent(message);
    expect(order).toHaveAttribute('aria-invalid', 'true');
  }
  expect(calls.filter((call) => call.name === 'editSelection')).toEqual([]);
});

test('Remove clears one slot and keeps the other rows, Replace refills a trait in place, and a Grant offers no ordinary removal', async () => {
  const selections: Selection[] = [
    powerAttack,
    { id: 'reactionary-entry', key: 'reactionary', slot: ['trait:general', 0] },
  ];
  const view = renderSelections(
    selectionSheet({ selections, grantedFeat: true }),
  );
  fireEvent.click(
    row('Power Attack').getByRole('button', { name: 'Remove Power Attack' }),
  );
  expect(lastCall('clearSelectionSlot').args).toMatchObject({
    entryId: 'power-attack-entry',
  });
  await settle(lastCall('clearSelectionSlot'));
  view.rerender(
    selectionSheet({ selections: selections.slice(1), grantedFeat: true }),
  );
  expect(screen.queryByRole('listitem', { name: 'Power Attack' })).toBeNull();
  expect(
    row('Reactionary').getByRole('heading', { name: 'Reactionary' }),
  ).toBeVisible();
  expect(
    slot('General feats').getByRole('button', { name: 'Add a feat' }),
  ).toHaveFocus();

  fireEvent.click(
    row('Reactionary').getByRole('button', { name: 'Replace Reactionary' }),
  );
  const choose = picker(/Replace Reactionary/);
  fireEvent.click(choose.getByRole('button', { name: 'Indomitable Faith' }));
  await submit(
    choose.getByRole('button', { name: 'Replace with Indomitable Faith' }),
  );
  expect(lastCall('fillSelectionSlot').args).toMatchObject({
    slotId: 'trait:general',
    position: 0,
    catalogEntryId: 'indomitable-faith',
  });

  const granted = row('Skill Focus');
  expect(granted.getByText('Prerequisites waived')).toBeVisible();
  expect(granted.queryByRole('button', { name: /Remove|Discard/ })).toBeNull();
  expect(
    granted.getByRole('button', { name: 'Edit Skill Focus' }),
  ).toBeVisible();
});

test('alignment and deity save through the sheet settings and refresh the prerequisite they meet', async () => {
  const selections: Selection[] = [
    { id: 'faithful-entry', key: 'faithful-strike', slot: ['feat:general', 0] },
  ];
  const view = renderSelections(
    selectionSheet({ selections, alignment: 'CE' }),
  );
  expect(
    row('Faithful Strike').getByText('Prerequisites not met'),
  ).toBeVisible();
  fireEvent.change(screen.getByRole('combobox', { name: 'Alignment' }), {
    target: { value: 'LG' },
  });
  expect(lastCall('settings').args).toMatchObject({
    settings: {},
    alignment: 'LG',
  });
  expect(screen.getByText('Saving…')).toBeVisible();
  await settle(lastCall('settings'));
  expect(screen.getByText('Alignment and deity saved.')).toBeVisible();
  view.rerender(selectionSheet({ selections, alignment: 'LG' }));
  expect(row('Faithful Strike').getByText('Prerequisites met')).toBeVisible();
  expect(
    screen.getByRole<HTMLSelectElement>('combobox', { name: 'Alignment' })
      .value,
  ).toBe('LG');

  const deity = screen.getByRole('textbox', { name: 'Deity' });
  fireEvent.change(deity, { target: { value: '  Iomedae ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save deity' }));
  await act(async () => undefined);
  expect(lastCall('settings').args).toMatchObject({ deity: 'Iomedae' });
  await settle(lastCall('settings'));
  view.rerender(
    selectionSheet({ selections, alignment: 'LG', deity: 'Iomedae' }),
  );
  fireEvent.change(deity, { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save deity' }));
  await act(async () => undefined);
  expect(lastCall('settings').args).toMatchObject({ deity: null });
  fireEvent.change(screen.getByRole('combobox', { name: 'Alignment' }), {
    target: { value: 'none' },
  });
});

test('a failed fill keeps the picker and its input for a retry, another player’s change is acknowledged, and another Character starts clean', async () => {
  const view = renderSelections(selectionSheet());
  fireEvent.click(
    slot('General feats').getByRole('button', { name: 'Add a feat' }),
  );
  const choose = picker(/Choose a feat/);
  fireEvent.click(choose.getByRole('button', { name: 'Skill Focus' }));
  fireEvent.change(choose.getByRole('textbox', { name: 'Choice' }), {
    target: { value: 'Perception' },
  });
  fireEvent.click(choose.getByRole('button', { name: 'Add Skill Focus' }));
  await act(async () => undefined);
  expect(choose.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  expect(
    slot('Traits').getByRole('button', { name: 'Add a trait' }),
  ).toBeEnabled();
  await act(async () => {
    lastCall('fillSelectionSlot').reject(
      new ConvexError('Character is read only'),
    );
  });
  expect(choose.getByRole('alert')).toHaveTextContent(
    "Selection wasn't saved: Character is read only. Try again.",
  );
  expect(choose.getByRole('textbox', { name: 'Choice' })).toHaveValue(
    'Perception',
  );
  fireEvent.click(choose.getByRole('button', { name: 'Add Skill Focus' }));
  await act(async () => undefined);
  expect(
    calls.filter((call) => call.name === 'fillSelectionSlot'),
  ).toHaveLength(2);
  expect(lastCall('fillSelectionSlot').args).toMatchObject({
    choice: 'Perception',
  });

  view.rerender(
    selectionSheet({
      selections: [
        { id: 'dodge-entry', key: 'cleave', slot: ['feat:general', 1] },
      ],
      lastOperationId: 'another-player',
    }),
  );
  const notice = screen.getByText('Feats and traits changed.');
  expect(notice).toBeVisible();
  fireEvent.click(
    screen.getByRole('button', { name: 'Dismiss feats and traits update' }),
  );
  expect(screen.queryByText('Feats and traits changed.')).toBeNull();

  const other = 'character-2' as Id<'character'>;
  view.rerender(selectionSheet({ id: other }), other);
  expect(screen.queryByRole('group', { name: /Choose a feat/ })).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByText('Saving…')).toBeNull();
});

test('off, dormant, kept and restored feats keep their state, and an exempt slot raises no prerequisite failure', async () => {
  const bonus: Selection = {
    id: 'bonus-entry',
    key: 'power-attack',
    slot: ['feat:level-1:0', 0],
    bonusFrom: 'level-1',
  };
  const view = renderSelections(
    selectionSheet({
      bonusSlot: { ignoresPrerequisites: true },
      selections: [{ ...powerAttack, key: 'cleave', active: false }, bonus],
    }),
  );
  const off = row('Cleave');
  expect(off.getByText('Off')).toBeVisible();
  fireEvent.click(off.getByRole('switch', { name: 'Cleave: off' }));
  expect(lastCall('editSelection').args).toMatchObject({
    entryId: 'power-attack-entry',
    active: true,
  });
  const exempt = within(
    slot('Fighter feats').getByRole('listitem', { name: 'Power Attack' }),
  );
  expect(exempt.getByText('Prerequisites waived')).toBeVisible();
  expect(exempt.queryByText(/not met/)).toBeNull();
  expect(exempt.queryByRole('button', { name: /^Accept/ })).toBeNull();

  // The fighter level goes: the bonus feat waits under Not counting now.
  const levels = [{ id: 'level-2', hp: 10, classId: 'wizard' as const }];
  view.rerender(
    selectionSheet({
      levels,
      bonusSlot: { ignoresPrerequisites: true },
      selections: [bonus],
    }),
  );
  expect(screen.queryByRole('group', { name: 'Fighter feats' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Not counting now (1)' }));
  const dormant = row('Power Attack');
  expect(dormant.getByText('Not counting now')).toBeVisible();
  expect(dormant.queryByText(/Prerequisites (not )?met/)).toBeNull();
  fireEvent.click(dormant.getByRole('button', { name: 'Keep Power Attack' }));
  expect(lastCall('setDormantEntryKept').args).toMatchObject({
    target: { entryId: 'bonus-entry' },
    kept: true,
  });
  await settle(lastCall('setDormantEntryKept'));
  view.rerender(
    selectionSheet({
      levels,
      bonusSlot: { ignoresPrerequisites: true },
      selections: [{ ...bonus, kept: true }],
    }),
  );
  expect(row('Power Attack').getByText('Kept')).toBeVisible();
  expect(
    row('Power Attack').getByRole('button', { name: 'Unkeep Power Attack' }),
  ).toBeVisible();

  view.rerender(
    selectionSheet({
      bonusSlot: { ignoresPrerequisites: true },
      selections: [bonus],
    }),
  );
  expect(
    slot('Fighter feats').getByRole('listitem', { name: 'Power Attack' }),
  ).toBeVisible();
  expect(screen.queryByRole('button', { name: /Not counting now/ })).toBeNull();
});

test('dense rows wrap long names and prose, keep touch-sized controls on the phone, and the picker opens and closes from the keyboard', () => {
  const long = 'Exceptionally Long Feat Name '.repeat(6).trim();
  const sheet = selectionSheet({ selections: [powerAttack] });
  renderSelections({
    ...sheet,
    catalogEntries: sheet.catalogEntries.map((entry) =>
      entry._id === 'power-attack' ? { ...entry, name: long } : entry,
    ),
    calculated: calculateCharacterSheet({
      entries: sheet.entries,
      catalogEntries: sheet.catalogEntries.map((entry) =>
        entry._id === 'power-attack' ? { ...entry, name: long } : entry,
      ),
      characterKind: 'pc',
    }),
  });
  const saved = row(long);
  expect(saved.getByRole('heading', { name: long }).className).toContain(
    '[overflow-wrap:anywhere]',
  );
  expect(saved.getByRole('switch').className).toContain('size-11');
  expect(
    saved.getByRole('button', { name: `Remove ${long}` }).className,
  ).toContain('size-11');
  const add = slot('Traits').getByRole('button', { name: 'Add a trait' });
  expect(add.className).toContain('min-h-11');

  add.focus();
  fireEvent.click(add, { detail: 0 });
  expect(add).toHaveAttribute('aria-expanded', 'true');
  const choose = picker(/Choose a trait/);
  const card = choose.getByRole('button', { name: 'Reactionary' });
  expect(card.className).toContain('min-h-11');
  card.focus();
  fireEvent.click(card, { detail: 0 });
  expect(card).toHaveAttribute('aria-pressed', 'true');
  fireEvent.keyDown(card, { key: 'Escape' });
  expect(screen.queryByRole('group', { name: /Choose a trait/ })).toBeNull();
  expect(add).toHaveFocus();
  expect(add).toHaveAttribute('aria-expanded', 'false');
});
