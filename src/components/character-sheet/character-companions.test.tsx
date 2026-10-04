import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { Id } from '@convex/_generated/dataModel';
import { getFunctionName } from 'convex/server';
import { ConvexError } from 'convex/values';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type * as NavigationGuard from '~/components/campaign-shell/navigation-guard';
import {
  characterSheetPath,
  type CharacterSheetOrigin,
} from '~/lib/campaign-routes';
import { BreakdownResolverProvider } from './breakdown-resolver';
import { CharacterCompanions } from './character-companions';
import { buildSheet } from './character-sheet-test-fixture';
import { buildCharacterSheetView } from './character-sheet-view-model';
import { buildSpellSheet, spells } from './character-spells-test-fixture';
import { SpellcastingBlock } from './spellcasting-block';
import {
  useCharacterCompanions,
  type CompanionRelationship,
} from './use-character-companions';
import type { CharacterSheetSnapshot } from './use-character-sheet';

// The Companions section (#309): both directions of a relationship with
// their history, link/create/replace/source editors in place, interruption
// asked first, and inaccessible endpoints that disclose nothing.

const server = vi.hoisted(() => ({
  relationships: undefined as unknown[] | undefined,
  candidates: [] as unknown[],
  linkedInput: undefined as unknown,
  write: vi.fn(),
  maintenance: { kind: 'ready', readOnly: false, message: '' },
}));
vi.mock('convex/react', () => ({
  useQuery: (
    reference: Parameters<typeof getFunctionName>[0],
    args: unknown,
  ) => {
    if (args === 'skip') return undefined;
    const name = getFunctionName(reference);
    if (name === 'companionRelationships:list') return server.relationships;
    if (name === 'character:listCampaignCharacters') return server.candidates;
    if (name === 'characterSheetLinkedInputs:list')
      return server.linkedInput ? [server.linkedInput] : undefined;
    throw new Error(`Unexpected query: ${name}`);
  },
  useMutation:
    (reference: Parameters<typeof getFunctionName>[0]) => (args: unknown) =>
      server.write(getFunctionName(reference), args),
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => server.maintenance,
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

const whisper = {
  relationshipId: 'rel-whisper' as Id<'companionRelationship'>,
  role: 'companion',
  kind: 'familiar',
  status: 'active',
  interruption: null,
  endpoint: { characterId: 'owl' as Id<'character'>, name: 'Whisper' },
  sources: [
    { key: 'bond', label: 'Arcane Bond', enabled: true, available: true },
  ],
  linkedInputs: [],
  lastOperationId: 'seed',
} satisfies CompanionRelationship;
const lord = {
  ...whisper,
  relationshipId: 'rel-lord' as Id<'companionRelationship'>,
  role: 'associated',
  kind: 'cohort',
  endpoint: { characterId: 'lord' as Id<'character'>, name: 'Lord Varn' },
  sources: [
    { key: 'leadership', label: 'Leadership', enabled: true, available: true },
  ],
} satisfies CompanionRelationship;
const ash = {
  ...whisper,
  relationshipId: 'rel-ash' as Id<'companionRelationship'>,
  kind: 'animalCompanion',
  status: 'replaced',
  endpoint: { characterId: 'wolf' as Id<'character'>, name: 'Ash' },
} satisfies CompanionRelationship;
const pip = {
  ...whisper,
  relationshipId: 'rel-pip' as Id<'companionRelationship'>,
  status: 'interrupted',
  interruption: 'support',
  endpoint: { characterId: 'cat' as Id<'character'>, name: 'Pip' },
  sources: [
    { key: 'bond', label: 'Arcane Bond', enabled: true, available: false },
  ],
} satisfies CompanionRelationship;

beforeEach(() => {
  server.relationships = [];
  server.candidates = [];
  server.linkedInput = undefined;
  server.maintenance = { kind: 'ready', readOnly: false, message: '' };
  server.write.mockReset().mockResolvedValue(null);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function Host({
  snapshot,
  origin,
}: {
  snapshot: CharacterSheetSnapshot;
  origin?: CharacterSheetOrigin;
}) {
  const controller = useCharacterCompanions(
    { characterId: snapshot.character._id },
    snapshot,
    origin,
  );
  return (
    <main>
      <CharacterCompanions
        controller={controller}
        characterId={snapshot.character._id}
      />
    </main>
  );
}
function renderCompanions({
  snapshot = buildSheet(),
  origin,
}: { snapshot?: CharacterSheetSnapshot; origin?: CharacterSheetOrigin } = {}) {
  const view = render(<Host snapshot={snapshot} origin={origin} />);
  return {
    rerender: () => view.rerender(<Host snapshot={snapshot} origin={origin} />),
  };
}
const item = (name: string) => screen.getByRole('listitem', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const radio = (name: string | RegExp) => screen.getByRole('radio', { name });
const toggle = (name: string) => screen.getByRole('switch', { name });
const field = (name: string) => screen.getByRole('textbox', { name });
const form = (name: string) => screen.getByRole('form', { name });
const namedItems = () =>
  screen
    .getAllByRole('listitem')
    .map((element) => element.getAttribute('aria-label'))
    .filter((label) => label !== null);
const lastCall = () => server.write.mock.calls.at(-1);

test('loading disables edits, an empty section keeps its actions, and both directions with their history stay discoverable once', () => {
  server.relationships = undefined;
  const view = renderCompanions();
  expect(screen.getByRole('region', { name: 'Companions' })).toBeVisible();
  expect(screen.getByText('Loading companions…')).toBeVisible();
  expect(button('Link existing Character')).toBeDisabled();
  expect(button('Create Companion')).toBeDisabled();

  server.relationships = [];
  view.rerender();
  expect(screen.getByText('No Companion Relationships.')).toBeVisible();
  expect(button('Link existing Character')).toBeEnabled();
  expect(button('Create Companion')).toBeEnabled();

  server.relationships = [ash, whisper, pip, lord];
  view.rerender();
  expect(namedItems()).toEqual([
    'Companion Whisper',
    'Associated Character Lord Varn',
    'Companion Ash',
    'Companion Pip',
  ]);
  expect(
    screen.getByRole('heading', { name: 'Former and interrupted' }),
  ).toBeVisible();
  const inWhisper = within(item('Companion Whisper'));
  expect(inWhisper.getByText('Familiar')).toBeVisible();
  expect(inWhisper.getByText('Active')).toBeVisible();
  expect(inWhisper.getByText('Companion')).toBeVisible();
  const inLord = within(item('Associated Character Lord Varn'));
  expect(inLord.getByText('Associated Character')).toBeVisible();
  expect(inLord.getByText('Cohort')).toBeVisible();
  const inAsh = within(item('Companion Ash'));
  expect(inAsh.getByText('Replaced')).toBeVisible();
  expect(
    inAsh.getByText(
      'The former relationship and Character Sheet are retained.',
    ),
  ).toBeVisible();
  const inPip = within(item('Companion Pip'));
  expect(inPip.getByText('Interrupted')).toBeVisible();
  expect(
    inPip.getByText(
      'No supporting source currently supports this relationship.',
    ),
  ).toBeVisible();
  expect(inPip.getByRole('switch', { name: 'Arcane Bond' })).toBeChecked();
  expect(inPip.getByText('Not counting now')).toBeVisible();
  expect(server.write).not.toHaveBeenCalled();
});

test('an inaccessible endpoint reads only as unavailable: no link, name or details; a forward row can still be replaced, a reverse row edits nothing', () => {
  server.relationships = [
    { ...whisper, endpoint: null },
    { ...lord, endpoint: null, sources: [] },
  ];
  renderCompanions();
  const forward = item('Companion Character unavailable');
  expect(within(forward).queryByRole('link')).toBeNull();
  expect(forward).toHaveTextContent('This Character is not available to you.');
  expect(
    within(forward).getByRole('button', {
      name: 'Replace Companion Character unavailable',
    }),
  ).toBeEnabled();
  expect(
    within(forward).queryByRole('button', { name: /Restore|Reselect/ }),
  ).toBeNull();
  const reverse = item('Associated Character Character unavailable');
  expect(within(reverse).queryAllByRole('button')).toHaveLength(0);
  expect(within(reverse).queryAllByRole('switch')).toHaveLength(0);
  expect(within(reverse).queryByRole('link')).toBeNull();
  const text = document.body.textContent ?? '';
  expect(text).not.toContain('Whisper');
  expect(text).not.toContain('Lord Varn');
  expect(document.body.innerHTML).not.toMatch(/owl|rel-lord|rel-whisper/);
});

test('an accessible sheet link uses the guarded href and keeps the navigation origin', () => {
  const origin: CharacterSheetOrigin = {
    href: '/campaigns/campaign-1/characters',
    organization: { kind: 'organization', id: 'org' },
  };
  server.relationships = [whisper];
  renderCompanions({ origin });
  expect(screen.getByRole('link', { name: 'Whisper' })).toHaveAttribute(
    'href',
    characterSheetPath('owl', origin),
  );
});

test('Create validates in place, keeps a refused draft with its reason, writes the kind once and then offers the new sheet', async () => {
  renderCompanions();
  fireEvent.click(button('Create Companion'));
  const editor = form('Create Companion');
  expect(editor).toHaveAttribute('novalidate');
  expect(field('Name')).toHaveFocus();
  expect(radio('Animal companion')).toBeChecked();
  const submit = () =>
    fireEvent.click(
      within(editor).getByRole('button', { name: 'Create Companion' }),
    );
  submit();
  await waitFor(() => expect(screen.getByText('Enter a name.')).toBeVisible());
  expect(screen.getByText('Enter a supporting source.')).toBeVisible();
  expect(field('Name')).toHaveAttribute('aria-invalid', 'true');
  expect(server.write).not.toHaveBeenCalled();

  fireEvent.change(field('Name'), { target: { value: 'Whisper' } });
  fireEvent.click(radio('Familiar'));
  fireEvent.change(field('Supporting source name'), {
    target: { value: 'Arcane Bond' },
  });
  server.write.mockRejectedValueOnce(new ConvexError('Not allowed'));
  submit();
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Companion wasn't saved: Not allowed. Try again.",
    ),
  );
  expect(form('Create Companion')).toBeVisible();
  expect(field('Name')).toHaveValue('Whisper');
  expect(radio('Familiar')).toBeChecked();

  server.write.mockResolvedValueOnce({
    relationshipId: 'new',
    companionCharacterId: 'owl',
  });
  submit();
  await waitFor(() =>
    expect(screen.queryByRole('form', { name: 'Create Companion' })).toBeNull(),
  );
  expect(server.write).toHaveBeenCalledTimes(2);
  expect(lastCall()).toEqual([
    'companionRelationships:create',
    expect.objectContaining({ name: 'Whisper', kind: 'familiar' }),
  ]);
  expect(screen.getByText('Companion created.')).toBeVisible();
  expect(
    screen.getByRole('link', { name: 'Open Companion Sheet' }),
  ).toHaveAttribute('href', '/characters/owl');
  expect(button('Create Companion')).toHaveFocus();
  fireEvent.click(button('Dismiss created Companion notice'));
  expect(screen.queryByText('Companion created.')).toBeNull();
});

test('Link and Replace choose a Character from cards, never a typed ID; a vanished choice is refused by the hook and replacement adds no kind or source', async () => {
  const snapshot = buildSheet();
  const ashCharacter = { ...snapshot.character, _id: 'wolf', name: 'Ash' };
  server.relationships = [whisper];
  server.candidates = [{ character: ashCharacter }];
  const view = renderCompanions({ snapshot });
  fireEvent.click(button('Link existing Character'));
  const linkForm = form('Link existing Character');
  expect(within(linkForm).getAllByRole('textbox')).toHaveLength(1);
  expect(field('Supporting source name')).toBeVisible();
  fireEvent.click(radio('Ash'));
  fireEvent.change(field('Supporting source name'), {
    target: { value: 'Animal Companion' },
  });

  server.candidates = [];
  view.rerender();
  expect(screen.getByText('No compatible Characters to link.')).toBeVisible();
  fireEvent.click(button('Link Character'));
  await waitFor(() =>
    expect(screen.getByText('Choose an available Character.')).toBeVisible(),
  );
  expect(server.write).not.toHaveBeenCalled();

  server.candidates = [{ character: ashCharacter }];
  view.rerender();
  expect(radio('Ash')).toBeChecked();
  fireEvent.click(button('Link Character'));
  await waitFor(() =>
    expect(
      screen.queryByRole('form', { name: 'Link existing Character' }),
    ).toBeNull(),
  );
  expect(lastCall()).toEqual([
    'companionRelationships:link',
    expect.objectContaining({ companionCharacterId: 'wolf' }),
  ]);

  fireEvent.click(button('Replace Companion Whisper'));
  const replaceForm = within(item('Companion Whisper')).getByRole('form', {
    name: 'Replace Companion',
  });
  expect(within(replaceForm).queryAllByRole('textbox')).toHaveLength(0);
  expect(
    within(replaceForm).queryByRole('radio', { name: 'Familiar' }),
  ).toBeNull();
  expect(
    within(replaceForm).getByText(
      'The former relationship and Character Sheet are retained.',
    ),
  ).toBeVisible();
  fireEvent.click(within(replaceForm).getByRole('radio', { name: 'Ash' }));
  fireEvent.click(
    within(replaceForm).getByRole('button', { name: 'Replace Companion' }),
  );
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(2));
  expect(lastCall()).toEqual([
    'companionRelationships:replace',
    expect.objectContaining({
      relationshipId: 'rel-whisper',
      companionCharacterId: 'wolf',
    }),
  ]);
  expect(item('Companion Whisper')).toBeVisible();
});

test('Supporting sources: a switch per contribution, real sheet entries as cards with a Not counting now advisory, or a named source', async () => {
  const sheet = buildSheet({
    adjustments: [{ id: 'armor', name: 'Armor Training', modifiers: [] }],
  });
  const snapshot = {
    ...sheet,
    calculated: {
      ...sheet.calculated,
      resolvedEntries: sheet.calculated.resolvedEntries.map((resolved) =>
        resolved.entry._id === 'armor'
          ? { ...resolved, counting: false }
          : resolved,
      ),
    },
  };
  server.relationships = [whisper];
  const view = renderCompanions({ snapshot });
  fireEvent.click(toggle('Arcane Bond'));
  expect(lastCall()).toEqual([
    'companionRelationships:setSourceEnabled',
    expect.objectContaining({
      relationshipId: 'rel-whisper',
      sourceKey: 'bond',
      enabled: false,
    }),
  ]);
  await waitFor(() =>
    expect(
      within(item('Companion Whisper')).getByRole('status'),
    ).toHaveTextContent('Saved'),
  );

  fireEvent.click(button('Add supporting source for Whisper'));
  const editor = form('Add supporting source');
  expect(field('Supporting source name')).toBeVisible();
  const level = within(editor).getByRole('radio', {
    name: /^Armor Training/,
  });
  expect(level).toHaveAccessibleName(/Not counting now/);
  fireEvent.click(level);
  expect(
    screen.getByText(
      'This supporting source is not counting now. The relationship can be retained without its support.',
    ),
  ).toBeVisible();
  expect(
    screen.queryByRole('textbox', { name: 'Supporting source name' }),
  ).toBeNull();

  fireEvent.click(radio('Other supporting source'));
  expect(
    screen.queryByText(/This supporting source is not counting now/),
  ).toBeNull();
  fireEvent.change(field('Supporting source name'), {
    target: { value: 'Witch Familiar' },
  });
  fireEvent.click(button('Add supporting source'));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(2));
  expect(lastCall()).toEqual([
    'companionRelationships:addSource',
    expect.objectContaining({
      relationshipId: 'rel-whisper',
      source: expect.objectContaining({
        label: 'Witch Familiar',
        enabled: true,
      }),
    }),
  ]);

  server.relationships = [
    { ...whisper, sources: [{ ...whisper.sources[0], available: false }] },
  ];
  view.rerender();
  expect(toggle('Arcane Bond')).toBeChecked();
  expect(
    within(item('Companion Whisper')).getByText('Not counting now'),
  ).toBeVisible();
});

test('interruption asks first and differs from replacement; replaced history offers no Replace; Restore and Reselect follow the supplied permissions, never write on view, and show a refusal', async () => {
  server.relationships = [whisper, ash, pip];
  renderCompanions();
  expect(server.write).not.toHaveBeenCalled();
  fireEvent.click(button('Interrupt relationship with Whisper'));
  const question = screen.getByRole('group', {
    name: 'Interrupt the relationship with Whisper?',
  });
  expect(question).toHaveAccessibleDescription(
    'The Character Sheet and supporting source choices are retained.',
  );
  expect(button('Cancel Whisper')).toHaveFocus();
  expect(server.write).not.toHaveBeenCalled();
  fireEvent.click(button('Interrupt relationship Whisper'));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual([
    'companionRelationships:interrupt',
    expect.objectContaining({ relationshipId: 'rel-whisper' }),
  ]);
  await waitFor(() =>
    expect(
      screen.queryByRole('group', {
        name: 'Interrupt the relationship with Whisper?',
      }),
    ).toBeNull(),
  );

  const inAsh = within(item('Companion Ash'));
  expect(inAsh.queryByRole('button', { name: /Replace/ })).toBeNull();
  expect(inAsh.getByRole('link', { name: 'Ash' })).toBeVisible();
  fireEvent.click(button('Reselect Companion Ash'));
  expect(lastCall()).toEqual([
    'companionRelationships:restore',
    expect.objectContaining({ relationshipId: 'rel-ash' }),
  ]);
  server.write.mockRejectedValueOnce(
    new ConvexError('Restoring this relationship would create a cycle.'),
  );
  fireEvent.click(button('Restore relationship Pip'));
  await waitFor(() =>
    expect(within(item('Companion Pip')).getByRole('alert')).toHaveTextContent(
      "Companion wasn't saved: Restoring this relationship would create a cycle. Try again.",
    ),
  );
  expect(
    screen.queryByRole('button', { name: /Restore relationship Ash/ }),
  ).toBeNull();
});

test('Saving appears only on the edited row, a repeated press is ignored, and another row keeps its draft', async () => {
  server.relationships = [whisper, lord];
  let finish: ((value: null) => void) | undefined;
  server.write.mockReturnValueOnce(
    new Promise<null>((resolve) => {
      finish = resolve;
    }),
  );
  renderCompanions();
  fireEvent.click(button('Add supporting source for Lord Varn'));
  fireEvent.change(field('Supporting source name'), {
    target: { value: 'Leadership feat' },
  });
  fireEvent.click(toggle('Arcane Bond'));
  const inWhisper = within(item('Companion Whisper'));
  expect(inWhisper.getByRole('status')).toHaveTextContent('Saving…');
  expect(toggle('Arcane Bond')).toBeDisabled();
  expect(button('Replace Companion Whisper')).toBeDisabled();
  const inLord = within(item('Associated Character Lord Varn'));
  expect(inLord.getByRole('switch', { name: 'Leadership' })).toBeEnabled();
  expect(inLord.getByRole('status')).toHaveTextContent('');
  expect(field('Supporting source name')).toHaveValue('Leadership feat');
  fireEvent.click(toggle('Arcane Bond'));
  expect(server.write).toHaveBeenCalledTimes(1);

  await act(async () => finish?.(null));
  expect(inWhisper.getByRole('status')).toHaveTextContent('Saved');
  expect(toggle('Arcane Bond')).toBeEnabled();
  expect(field('Supporting source name')).toHaveValue('Leadership feat');
});

test("another player's change is announced once and dismissed without resetting an open draft", () => {
  server.relationships = [whisper];
  const view = renderCompanions();
  fireEvent.click(button('Create Companion'));
  fireEvent.change(field('Name'), { target: { value: 'Pip' } });
  server.relationships = [
    {
      ...whisper,
      lastOperationId: 'other-player',
      status: 'interrupted',
      interruption: 'manual',
    },
  ];
  view.rerender();
  expect(
    screen.getAllByText('Companion Relationships updated by another player.'),
  ).toHaveLength(1);
  expect(field('Name')).toHaveValue('Pip');
  expect(
    screen.getByText(
      'This relationship was interrupted. Restore it when ready.',
    ),
  ).toBeVisible();
  fireEvent.click(button('Dismiss companions update'));
  expect(
    screen.queryByText('Companion Relationships updated by another player.'),
  ).toBeNull();
  expect(field('Name')).toHaveValue('Pip');
});

test('maintenance disables every writer with one reason while the sheet link stays; Escape and Cancel close without writing and return focus', () => {
  const message = 'Editing is paused for maintenance.';
  server.maintenance = { kind: 'maintenance', readOnly: true, message };
  server.relationships = [whisper];
  const view = renderCompanions();
  for (const name of [
    'Link existing Character',
    'Create Companion',
    'Add supporting source for Whisper',
    'Replace Companion Whisper',
    'Interrupt relationship with Whisper',
  ]) {
    expect(button(name)).toBeDisabled();
    expect(button(name)).toHaveAccessibleDescription(message);
  }
  expect(toggle('Arcane Bond')).toBeDisabled();
  expect(screen.getAllByText(message)).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Whisper' })).toHaveAttribute(
    'href',
    '/characters/owl',
  );

  server.maintenance = { kind: 'ready', readOnly: false, message: '' };
  view.rerender();
  expect(screen.queryByText(message)).toBeNull();
  fireEvent.click(button('Create Companion'));
  fireEvent.keyDown(field('Name'), { key: 'Escape' });
  expect(screen.queryByRole('form')).toBeNull();
  expect(button('Create Companion')).toHaveFocus();
  fireEvent.click(button('Link existing Character'));
  fireEvent.click(button('Cancel Link existing Character'));
  expect(screen.queryByRole('form')).toBeNull();
  expect(button('Link existing Character')).toHaveFocus();
  expect(server.write).not.toHaveBeenCalled();
});

test('a relationship names the values it borrows beneath its row, sharing the one maintenance reason', () => {
  const message = 'Editing is paused for maintenance.';
  server.maintenance = { kind: 'maintenance', readOnly: true, message };
  const level = { kind: 'characterLevel' } as const;
  server.relationships = [
    {
      ...whisper,
      linkedInputs: [{ input: level }],
    },
    lord,
  ];
  server.linkedInput = {
    input: level,
    status: 'unavailable',
    resolution: 'unresolved',
    value: null,
    fallback: null,
    fallbackState: 'none',
    candidates: [],
    contributions: [],
    prerequisiteStatus: 'unresolved',
    interpretation: null,
    revision: 1,
    lastOperationId: 'seed',
    updatedBy: null,
    sources: [],
    unavailableReason: 'interrupted',
  };
  renderCompanions();
  const linked = within(item('Companion Whisper')).getByRole('list', {
    name: 'Linked values',
  });
  expect(
    within(linked).getByRole('group', { name: 'Character level' }),
  ).toHaveTextContent('Unresolved');
  expect(
    within(item('Associated Character Lord Varn')).queryByRole('list', {
      name: 'Linked values',
    }),
  ).toBeNull();
  expect(button('Set fallback for Character level')).toBeDisabled();
  expect(
    button('Set fallback for Character level'),
  ).toHaveAccessibleDescription(message);
  expect(screen.getAllByText(message)).toHaveLength(1);
});

test('curated linked values remain editable when the associated Character and its sources are hidden', async () => {
  const input = {
    kind: 'classLevels',
    classRuleIdentity: 'class:wizard',
  } as const;
  server.relationships = [
    {
      ...lord,
      endpoint: null,
      sources: [],
      linkedInputs: [{ input, classLabel: 'Wizard' }],
    },
  ];
  server.linkedInput = {
    input,
    status: 'unavailable',
    resolution: 'unresolved',
    value: null,
    fallback: null,
    fallbackState: 'none',
    candidates: [],
    contributions: [],
    prerequisiteStatus: 'unresolved',
    interpretation: null,
    revision: 1,
    lastOperationId: null,
    updatedBy: null,
    sources: [],
    unavailableReason: 'inaccessible',
  };
  renderCompanions();
  const linked = screen.getByRole('group', { name: 'Wizard class levels' });
  expect(linked).toHaveTextContent('Unresolved');
  expect(linked).toHaveTextContent(
    'Wizard class levels is unavailable because the linked Character cannot be accessed.',
  );
  expect(screen.queryByText('Lord Varn')).toBeNull();
  expect(screen.queryByText('Leadership')).toBeNull();
  fireEvent.click(button('Set fallback for Wizard class levels'));
  fireEvent.change(field('Fallback for Wizard class levels'), {
    target: { value: '-3' },
  });
  await act(async () => fireEvent.click(button('Save fallback')));
  expect(server.write).toHaveBeenLastCalledWith(
    'characterSheetLinkedInputs:saveFallback',
    expect.objectContaining({ input, value: -3 }),
  );
});

// Phone below 768px, tablet above; reduced motion asked for at both.
function stubViewport(isWide: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion') || isWide,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

test.each([
  { isWide: false, label: 'phone' },
  { isWide: true, label: 'tablet' },
])(
  'on the $label every control is named once and touch-sized, and the cards hold still for reduced motion',
  ({ isWide }) => {
    stubViewport(isWide);
    server.relationships = [whisper, lord, ash];
    renderCompanions();
    for (const name of [
      'Link existing Character',
      'Create Companion',
      'Add supporting source for Whisper',
      'Replace Companion Whisper',
      'Interrupt relationship with Whisper',
      'Add supporting source for Lord Varn',
      'Reselect Companion Ash',
    ]) {
      const [control, ...duplicates] = screen.getAllByRole('button', { name });
      expect(duplicates).toHaveLength(0);
      expect(control).toBeEnabled();
      expect(control).toHaveClass('min-h-11');
    }
    expect(
      within(item('Companion Whisper')).getByRole('switch', {
        name: 'Arcane Bond',
      }),
    ).toHaveClass('min-h-11', 'md:min-h-7');
    expect(screen.getAllByRole('link', { name: 'Whisper' })).toHaveLength(1);

    fireEvent.click(button('Create Companion'));
    expect(field('Name')).toHaveClass('h-11', 'md:h-8');
    const card = radio('Familiar').closest('label');
    expect(card).toHaveClass(
      'min-h-11',
      'hover:-translate-y-0.5',
      'motion-reduce:transition-none',
      'motion-reduce:hover:translate-y-0',
    );
  },
);

// #326: the witch's Familiar collection belongs to the witch. Replacing or
// restoring its familiar writes only the relationship and leaves the
// collection, its count and its note exactly as they were.
const spellWrites = {
  record: vi.fn(),
  editLevel: vi.fn(),
  remove: vi.fn(),
  statusForSpell: () => ({ kind: 'idle' as const }),
  statusForEntry: () => ({ kind: 'idle' as const }),
  hasRemoteChange: false,
  dismissRemoteChange: vi.fn(),
};
const warningControls = {
  accept: vi.fn(),
  reopen: vi.fn(),
  statusFor: () => ({ kind: 'idle' as const }),
  hasRemoteChange: false,
  dismissRemoteChange: vi.fn(),
};
function WitchHost({ snapshot }: { snapshot: CharacterSheetSnapshot }) {
  const controller = useCharacterCompanions(
    { characterId: snapshot.character._id },
    snapshot,
  );
  const view = buildCharacterSheetView(snapshot);
  return (
    <main>
      <CharacterCompanions
        controller={controller}
        characterId={snapshot.character._id}
      />
      <BreakdownResolverProvider
        previewSituation={() => null}
        adjustments={[]}
        spellcastings={view.calculated.spellcastings}
      >
        <SpellcastingBlock
          characterName={snapshot.character.name}
          spellcastings={view.calculated.spellcastings}
          unresolved={view.calculated.spellcastingUnresolved}
          spells={{
            characterId: snapshot.character._id,
            collections: view.calculated.spellCollections,
            warnings: view.warnings,
            warningController: warningControls,
            writes: spellWrites,
          }}
        />
      </BreakdownResolverProvider>
    </main>
  );
}

test('replacing and restoring the witch’s familiar writes only the relationship; the witch keeps the same Familiar Spells, count and note, and an inaccessible familiar stays unlinked', async () => {
  const witch = buildSpellSheet({
    classes: ['witch'],
    recorded: [
      { id: 'row-detect', spell: spells.detectMagic, castingClassId: 'witch' },
      {
        id: 'row-cure',
        spell: spells.cureLightWounds,
        castingClassId: 'witch',
      },
    ],
  });
  const hidden = {
    ...whisper,
    relationshipId: 'rel-hidden' as Id<'companionRelationship'>,
    status: 'replaced',
    endpoint: null,
  } satisfies CompanionRelationship;
  server.relationships = [whisper, hidden];
  server.candidates = [
    { character: { ...witch.character, _id: 'cat', name: 'Pip' } },
  ];
  const view = render(<WitchHost snapshot={witch} />);
  const spellcasting = () =>
    within(screen.getByRole('region', { name: 'Spellcasting' }));
  const witchLine = () =>
    within(
      spellcasting()
        .getByRole('button', {
          name: 'View Witch spellcasting',
        })
        .closest('li') as HTMLElement,
    );
  const note =
    'Witch Spells stay with the witch through familiar replacement and restoration.';
  const expectCollectionKept = () => {
    expect(witchLine().getByText('Familiar')).toBeVisible();
    expect(witchLine().getByText('2 in familiar')).toBeVisible();
    expect(witchLine().getByText(note)).toBeVisible();
    expect(screen.getAllByText(note)).toHaveLength(1);
  };
  expectCollectionKept();
  expect(
    within(item('Companion Character unavailable')).queryByRole('link'),
  ).toBeNull();

  fireEvent.click(button('Replace Companion Whisper'));
  const replaceForm = within(item('Companion Whisper')).getByRole('form', {
    name: 'Replace Companion',
  });
  fireEvent.click(within(replaceForm).getByRole('radio', { name: 'Pip' }));
  fireEvent.click(
    within(replaceForm).getByRole('button', { name: 'Replace Companion' }),
  );
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()?.[0]).toBe('companionRelationships:replace');

  server.relationships = [
    { ...whisper, status: 'replaced' },
    {
      ...whisper,
      relationshipId: 'rel-pip' as Id<'companionRelationship'>,
      endpoint: { characterId: 'cat' as Id<'character'>, name: 'Pip' },
    },
    hidden,
  ];
  view.rerender(<WitchHost snapshot={witch} />);
  expectCollectionKept();
  fireEvent.click(button('Reselect Companion Whisper'));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(2));
  expect(lastCall()?.[0]).toBe('companionRelationships:restore');
  expectCollectionKept();
  expect(
    server.write.mock.calls.every(([name]) =>
      String(name).startsWith('companionRelationships:'),
    ),
  ).toBe(true);
  expect(spellWrites.record).not.toHaveBeenCalled();
  expect(spellWrites.remove).not.toHaveBeenCalled();
  expect(
    within(screen.getByRole('region', { name: 'Companions' }))
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
      .sort(),
  ).toEqual(['/characters/cat', '/characters/owl']);
});

test('a familiar’s own sheet has no Familiar Spells collection of its own', () => {
  const owl = buildSheet({ name: 'Whisper', levels: [] });
  server.relationships = [{ ...lord, kind: 'familiar' }];
  render(<WitchHost snapshot={owl} />);
  expect(screen.getByText('Whisper has no Spellcasting.')).toBeVisible();
  expect(
    screen.queryByText(
      'Witch Spells stay with the witch through familiar replacement and restoration.',
    ),
  ).toBeNull();
  expect(screen.queryByRole('region', { name: 'Familiar' })).toBeNull();
});
