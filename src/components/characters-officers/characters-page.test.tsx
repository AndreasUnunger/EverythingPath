import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ConvexError } from 'convex/values';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Id } from '@convex/_generated/dataModel';
import { CharactersSection } from '~/components/campaign-sections/characters-section';
import type { CharacterRecordKind } from '~/lib/character-kind';

// Characters & officers (#182): the officer board over one alphabetical
// character table, and the shared Add/Edit record dialog.

type StoredCharacter = {
  _id: string;
  campaignId: string;
  name: string;
  description: string;
  kind?: CharacterRecordKind;
  level: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  isActive?: boolean;
};
type Call = {
  name: string;
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
let calls: Call[] = [];
let queries: Record<string, unknown> = {};

vi.mock('@convex/_generated/api', () => ({
  api: {
    character: {
      listByCampaign: 'listByCampaign',
      createCharacter: 'createCharacter',
      updateCharacter: 'updateCharacter',
      archiveCharacter: 'archiveCharacter',
    },
    canonicalDraftPersistence: { workspace: 'workspace', observe: 'observe' },
    canonicalLedger: { read: 'read', save: 'save' },
  },
}));
vi.mock('convex/react', () => ({
  useQuery: (name: string, args: unknown) =>
    args === 'skip' ? undefined : queries[name],
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
// Radix Select needs layout APIs jsdom lacks; a native select keeps the
// labelled control and its PC/NPC options.
vi.mock('~/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
  }) => (
    <select
      aria-label="Kind"
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

const campaignId = 'campaign' as Id<'campaign'>;
function character(
  _id: string,
  name: string,
  values: Partial<StoredCharacter> = {},
): StoredCharacter {
  return {
    _id,
    campaignId,
    name,
    description: '',
    kind: 'pc',
    level: 3,
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    isActive: true,
    ...values,
  };
}
const records = () => [
  character('sera', 'Sera of Phaendar', {
    kind: 'officer_npc',
    level: 4,
    charisma: 17,
    description: 'Innkeeper',
  }),
  character('bren', 'Bren Ironhand', { level: 7, strength: 18 }),
  character('dalla', 'Dalla Rook', { level: 4, isActive: false }),
  character('aria', 'aria Vell', { level: 6 }),
];
const facts = (list: StoredCharacter[]) =>
  list.map((record) => ({
    characterId: record._id,
    level: record.level,
    strength: record.strength,
    dexterity: record.dexterity,
    constitution: record.constitution,
    intelligence: record.intelligence,
    wisdom: record.wisdom,
    charisma: record.charisma,
    isActive: record.isActive !== false,
  }));
function militia(list = records()) {
  const onRoster = list.filter((record) => record._id !== 'aria');
  return {
    key: { campaignId, militiaId: 'militia', draftId: 'draft' },
    week: 3,
    sourceRevision: 1,
    people: [],
    snapshot: {
      focus: 'Loyalty',
      characters: facts(onRoster),
      roster: {
        people: onRoster.map((record) => ({
          characterId: record._id,
          kind: record._id === 'sera' ? 'npc' : 'pc',
          hitDice: record._id === 'bren' ? 5 : null,
        })),
        officers: [
          { role: 'marshal', characterId: 'bren' },
          { role: 'commandant', characterId: 'bren' },
          { role: 'commandant', characterId: 'dalla' },
          { role: 'ambassador', characterId: 'sera' },
        ],
        teams: ['Smugglers', 'Town Watch'].map((name) => ({
          teamId: name,
          teamType: 'patrons',
          name,
          status: 'active',
          rewardCapExempt: false,
          managerCharacterId: 'sera',
          notes: '',
        })),
      },
    },
  };
}
const openDraft = {
  status: 'open',
  draft: {
    activity: {
      slots: [
        { slotId: 's1', choice: null },
        {
          slotId: 's2',
          choice: {
            choiceId: 'c2',
            actionId: 'change_officer_role',
            characterId: 'bren',
            fromRole: 'marshal',
            toRole: 'spymaster',
          },
        },
      ],
    },
  },
};
// The accepted militia as the corrections read it, from the same facts.
const weekContext = {
  firstMilitiaWeek: false,
  startDay: 14,
  uneventfulCarry: false,
  carriedEvents: [],
  queuedEffects: [],
  orders: [],
  lastBuyoffWeek: null,
};
function ledgerOf(workspace: unknown, revision = 1) {
  if (!workspace) return undefined;
  const { week, snapshot } = workspace as ReturnType<typeof militia>;
  return {
    revision,
    state: { week, context: weekContext, militiaSnapshot: snapshot },
  };
}
function setQueries(
  list: StoredCharacter[] | undefined = records(),
  workspace: unknown = militia(list),
  observe: unknown = openDraft,
) {
  queries = {
    listByCampaign: list,
    workspace,
    observe,
    read: ledgerOf(workspace),
  };
}
const page = () => (
  <CharactersSection campaignId={campaignId} organizationId="org" />
);
const board = () => screen.getByRole('region', { name: 'Officers' });
const roleCard = (name: string) =>
  within(board()).getByRole('region', { name });
const table = () =>
  within(screen.getByRole('region', { name: 'Characters' })).getByRole('table');
const rowOf = (name: string) =>
  within(table())
    .getAllByRole('row')
    .find((row) =>
      within(row).queryByRole('rowheader', { name: new RegExp(`^${name}`) }),
    )!;
const dialog = () => screen.getByRole('dialog');
const field = (name: string) => within(dialog()).getByRole('textbox', { name });
const type = (name: string, value: string) =>
  fireEvent.change(field(name), { target: { value } });
async function press(name: string, container = dialog()) {
  await act(async () => {
    fireEvent.click(within(container).getByRole('button', { name }));
  });
}

beforeEach(() => {
  calls = [];
  setQueries();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('page states', () => {
  test('shows an accessible skeleton while records or the militia load', () => {
    queries = { workspace: null };
    const { rerender } = render(page());
    expect(
      screen.getByRole('status', { name: 'Loading characters…' }),
    ).toBeVisible();
    queries = { listByCampaign: records() };
    rerender(page());
    expect(
      screen.getByRole('status', { name: 'Loading characters…' }),
    ).toBeVisible();
  });

  test('before Setup, all six roles ask for a militia and records still work', async () => {
    setQueries(records(), null, undefined);
    render(page());
    for (const role of [
      'Marshal',
      'Ambassador',
      'Spymaster',
      'Strategist',
      'Commandant',
      'Overseer',
    ])
      expect(roleCard(role)).toHaveTextContent(
        'Set up militia to assign officers.',
      );
    expect(
      within(board()).getByRole('link', { name: 'Set up militia' }),
    ).toHaveAttribute('href', '/campaigns/campaign/setup');
    // No roster yet: no roster column, and records keep their own number.
    expect(
      within(table()).queryByRole('columnheader', { name: 'On roster' }),
    ).toBeNull();
    expect(rowOf('Bren Ironhand')).toHaveTextContent('7 HD');
    await press(
      'Add character',
      screen.getByRole('region', { name: 'Characters' }),
    );
    type('Name', 'Mira');
    await press('Save');
    expect(calls[0]).toMatchObject({
      name: 'createCharacter',
      args: {
        organizationId: 'org',
        character: { campaignId, name: 'Mira', kind: 'pc', level: 1 },
      },
    });
  });

  test('keeps the empty active and archived states', () => {
    setQueries([], null, undefined);
    render(page());
    expect(screen.getByText('No active characters.')).toBeVisible();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    expect(screen.getByText('No archived characters.')).toBeVisible();
  });
});

describe('officer board', () => {
  test('shows every role with its effect and source, vacancies, archived holders and pending changes', () => {
    render(page());
    expect(board()).toHaveTextContent('Focus: Loyalty');
    expect(roleCard('Marshal')).toHaveTextContent(
      'Security +4 (Bren Ironhand, Str)',
    );
    expect(roleCard('Ambassador')).toHaveTextContent(
      'Loyalty +3 (Sera of Phaendar, Cha)',
    );
    // Bren's override 5 and archived Dalla's level 4 both count.
    const commandant = roleCard('Commandant');
    expect(commandant).toHaveTextContent(
      '+9 training on a successful Drill (Bren Ironhand 5 HD + Dalla Rook 4 HD)',
    );
    expect(within(commandant).getByText('archived')).toBeVisible();
    // Dalla's row is hidden, but her card keeps the warning.
    expect(commandant).toHaveTextContent(
      'Dalla Rook is archived but still assigned.',
    );
    expect(roleCard('Strategist')).toHaveTextContent('Vacant: no extra action');
    // A pending change shows on both roles, and is not applied.
    const spymaster = roleCard('Spymaster');
    expect(spymaster).toHaveTextContent('Vacant: no Secrecy bonus');
    expect(spymaster).toHaveTextContent(
      'Pending this week: Bren Ironhand: Marshal → Spymaster (Activity, slot 2)',
    );
    expect(roleCard('Marshal')).toHaveTextContent('Pending this week');
  });

  test('pending changes above the table link to this campaign’s Activity', () => {
    render(page());
    const characters = screen.getByRole('region', { name: 'Characters' });
    expect(characters).toHaveTextContent(
      'Pending this week' +
        'Bren Ironhand: Marshal → Spymaster (Activity, slot 2)',
    );
    expect(
      within(characters).getByRole('link', { name: 'Go to Activity' }),
    ).toHaveAttribute('href', '/campaigns/campaign/week?phase=activity');
  });

  test('a closed or missing draft shows no pending changes', () => {
    setQueries(records(), militia(), { status: 'closed', draft: null });
    render(page());
    expect(screen.queryByText(/Pending this week/)).toBeNull();
  });

  test('a role chip moves focus to its card', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(page());
    fireEvent.click(
      within(rowOf('Bren Ironhand')).getByRole('button', {
        name: 'Commandant',
      }),
    );
    expect(roleCard('Commandant')).toHaveFocus();
    expect(scroll).toHaveBeenCalledWith({ block: 'center' });
  });
});

describe('character table', () => {
  test('lists active records alphabetically; Show archived reveals archived rows', () => {
    render(page());
    const names = () =>
      within(table())
        .getAllByRole('rowheader')
        .map((cell) => cell.textContent);
    expect(names()).toEqual([
      'aria Vell',
      'Bren Ironhand' + 'Bren Ironhand holds more than one officer role.',
      'Sera of Phaendar',
    ]);
    expect(
      within(screen.getByRole('region', { name: 'Characters' })).getByText(
        '3 on the roster · 1 not',
      ),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    expect(names()).toContain(
      'Dalla Rook' + 'archived' + 'Dalla Rook is archived but still assigned.',
    );
    expect(names()[2]).toMatch(/^Dalla Rook/);
  });

  test('shows kind, effective Hit Dice, roles and read-only managed teams', () => {
    render(page());
    const sera = rowOf('Sera of Phaendar');
    // A legacy NPC kind reads NPC; Sera's blank override follows her level.
    expect(sera).toHaveTextContent('NPC');
    expect(sera).toHaveTextContent('4 HD');
    const teams = within(sera).getByRole('link', {
      name: 'Manages 2 of 3 teams',
    });
    expect(teams).toHaveAttribute(
      'href',
      '/campaigns/campaign/militia?section=teams',
    );
    expect(rowOf('Bren Ironhand')).toHaveTextContent('5 HD');
    expect(rowOf('aria Vell')).toHaveTextContent('Not on roster');
    // Roster and officers are corrected here: the retired Militia fallback
    // is no longer linked.
    expect(
      screen.queryByRole('link', { name: 'People & officers' }),
    ).toBeNull();
  });

  test('phones get one card per character with the same facts and operations', () => {
    window.matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    render(page());
    expect(screen.queryByRole('table')).toBeNull();
    const card = screen
      .getByRole('heading', { name: 'Sera of Phaendar' })
      .closest('li')!;
    expect(card).toHaveTextContent('NPC');
    expect(within(card).getByRole('link', { name: 'Manages 2 of 3 teams' }));
    expect(
      within(card).getByRole('button', { name: 'Edit Sera of Phaendar' }),
    ).toBeVisible();
    // @ts-expect-error jsdom has no matchMedia by default
    delete window.matchMedia;
  });

  test('another player’s record change reaches the table', () => {
    const { rerender } = render(page());
    const list = records();
    list[1]!.level = 9;
    list.push(character('cara', 'Cara', { level: 2 }));
    setQueries(list, militia(list));
    rerender(page());
    expect(rowOf('Cara')).toHaveTextContent('2 HD');
    expect(roleCard('Commandant')).toHaveTextContent('Bren Ironhand 5 HD');
  });
});

describe('record dialog', () => {
  async function openEdit(name: string) {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: `Edit ${name}` }));
    });
    return screen.getByRole('dialog', { name: 'Edit character' });
  }

  test('validates a cleared or malformed Hit Dice field without writing', async () => {
    render(page());
    await openEdit('Bren Ironhand');
    expect(field('Hit Dice')).toHaveValue('7');
    type('Hit Dice', '');
    await press('Save');
    expect(within(dialog()).getByText('Hit Dice is required')).toBeVisible();
    type('Hit Dice', 'two');
    await press('Save');
    expect(
      within(dialog()).getByText('Hit Dice must be a whole number'),
    ).toBeVisible();
    type('Hit Dice', '0');
    await press('Save');
    expect(
      within(dialog()).getByText('Hit Dice must be at least 1'),
    ).toBeVisible();
    type('Name', ' ');
    type('CHA', '');
    await press('Save');
    expect(
      within(dialog()).getByText('Character name is required'),
    ).toBeVisible();
    expect(within(dialog()).getByText('CHA is required')).toBeVisible();
    // The save summary links each invalid field to its control.
    const summary = within(dialog()).getByRole('alert');
    expect(summary).toHaveTextContent('Fix these before saving');
    fireEvent.click(within(summary).getByRole('button', { name: 'CHA' }));
    await waitFor(() => expect(field('CHA')).toHaveFocus());
    expect(calls).toEqual([]);
  });

  test('edits a record, sending only changed fields and keeping its archive state', async () => {
    render(page());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    await openEdit('Dalla Rook');
    type('Hit Dice', '5');
    type('Notes', 'Back from the war');
    fireEvent.change(within(dialog()).getByRole('combobox', { name: 'Kind' }), {
      target: { value: 'npc' },
    });
    await press('Save');
    expect(calls[0]!.name).toBe('updateCharacter');
    expect(calls[0]!.args).toEqual({
      organizationId: 'org',
      characterId: 'dalla',
      patch: { description: 'Back from the war', kind: 'npc', level: 5 },
    });
    expect(
      within(dialog()).getByRole('button', { name: 'Saving…' }),
    ).toBeDisabled();
    await act(async () => calls[0]!.resolve(null));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  test('Archive keeps unsaved edits, warns what stays assigned and never unassigns', async () => {
    render(page());
    await openEdit('Sera of Phaendar');
    expect(dialog()).toHaveTextContent(
      'Archiving keeps Sera of Phaendar as Ambassador and manager of Smugglers and Town Watch.',
    );
    type('Notes', 'Left for Phaendar');
    await press('Archive');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.args).toEqual({
      organizationId: 'org',
      characterId: 'sera',
      patch: { description: 'Left for Phaendar', isActive: false },
    });
    // A refused archive keeps the dialog, its values and says why.
    await act(async () =>
      calls[0]!.reject(new ConvexError('You do not have access to this org')),
    );
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      'You do not have access to this org',
    );
    expect(field('Notes')).toHaveValue('Left for Phaendar');
    await press('Archive');
    await act(async () => calls[1]!.resolve(null));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Only the record changes: no roster or officer write exists here.
    expect(calls.map((call) => call.name)).toEqual([
      'updateCharacter',
      'updateCharacter',
    ]);
  });

  test('Archive with invalid edits shows the field errors and archives nothing', async () => {
    render(page());
    await openEdit('Bren Ironhand');
    type('Hit Dice', '');
    await press('Archive');
    expect(within(dialog()).getByText('Hit Dice is required')).toBeVisible();
    expect(calls).toEqual([]);
  });

  test('an archived record offers Un-archive', async () => {
    render(page());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    await openEdit('Dalla Rook');
    expect(
      within(dialog()).queryByRole('button', { name: 'Archive' }),
    ).toBeNull();
    // Without edits, only the archive state changes.
    await press('Un-archive');
    expect(calls[0]).toMatchObject({
      name: 'archiveCharacter',
      args: { organizationId: 'org', characterId: 'dalla', isActive: true },
    });
    await act(async () => calls[0]!.reject(new Error('')));
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      'Failed to un-archive character.',
    );
  });

  test("an edit keeps another player's change to a field this player left alone", async () => {
    const { rerender } = render(page());
    await openEdit('Bren Ironhand');
    // Another player raises Bren's Charisma while the dialog is open.
    const list = records();
    list[1]!.charisma = 14;
    setQueries(list, militia(list));
    rerender(page());
    type('Notes', 'Drillmaster');
    await press('Save');
    expect(calls[0]!.args).toEqual({
      organizationId: 'org',
      characterId: 'bren',
      patch: { description: 'Drillmaster' },
    });
  });

  test('another player confirming the week keeps the unsaved edit', async () => {
    const view = render(page());
    await openEdit('Bren Ironhand');
    type('Name', 'Unsaved new name');
    type('STR', '12');
    type('Notes', 'Drillmaster');
    // Confirmation opens week 4: its draft is briefly unobserved.
    const next = { ...militia(), week: 4 };
    next.key = { ...next.key, draftId: 'draft-4' };
    setQueries(records(), next);
    queries.observe = undefined;
    view.rerender(page());
    // The page stays behind the modal dialog, without last week's pending
    // change on the table or the Marshal card.
    const hidden = { hidden: true };
    expect(
      screen.queryByRole('status', { name: 'Loading characters…', ...hidden }),
    ).toBeNull();
    expect(
      screen.getByRole('region', { name: 'Officers', ...hidden }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Pending this week|→ Spymaster/)).toBeNull();
    expect(field('Name')).toHaveValue('Unsaved new name');
    setQueries(records(), next, {
      status: 'open',
      draft: {
        activity: {
          slots: [
            {
              slotId: 's1',
              choice: {
                choiceId: 'c1',
                actionId: 'change_officer_role',
                characterId: 'bren',
                fromRole: 'marshal',
                toRole: 'strategist',
              },
            },
          ],
        },
      },
    });
    view.rerender(page());
    // Only the new week's pending change shows.
    expect(screen.queryByText(/→ Spymaster/)).toBeNull();
    expect(screen.getAllByText(/Marshal → Strategist/).length).toBeGreaterThan(
      0,
    );
    expect(field('Name')).toHaveValue('Unsaved new name');
    expect(field('STR')).toHaveValue('12');
    expect(field('Notes')).toHaveValue('Drillmaster');
    await press('Save');
    expect(calls[0]!.args).toEqual({
      organizationId: 'org',
      characterId: 'bren',
      patch: {
        name: 'Unsaved new name',
        strength: 12,
        description: 'Drillmaster',
      },
    });
  });

  test('a campaign or organization change closes the dialog and loads again', async () => {
    const view = render(page());
    for (const [nextCampaign, nextOrganization] of [
      ['campaign-2', 'org'],
      ['campaign-2', 'org-2'],
    ] as const) {
      await openEdit('Bren Ironhand');
      type('Name', 'Unsaved new name');
      const next = () => (
        <CharactersSection
          campaignId={nextCampaign as Id<'campaign'>}
          organizationId={nextOrganization}
        />
      );
      queries = { workspace: undefined };
      view.rerender(next());
      expect(
        screen.getByRole('status', { name: 'Loading characters…' }),
      ).toBeVisible();
      setQueries();
      view.rerender(next());
      expect(screen.queryByRole('dialog')).toBeNull();
    }
  });

  test('a refused add keeps the values and a second press never writes twice', async () => {
    render(page());
    await press(
      'Add character',
      screen.getByRole('region', { name: 'Characters' }),
    );
    expect(screen.getByRole('dialog', { name: 'Add character' })).toBeVisible();
    expect(
      within(dialog()).queryByRole('button', { name: 'Archive' }),
    ).toBeNull();
    type('Name', 'Mira');
    type('Hit Dice', '4');
    await press('Save');
    await press('Saving…');
    expect(calls).toHaveLength(1);
    await act(async () =>
      calls[0]!.reject(new ConvexError('Character name cannot be empty')),
    );
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      'Character name cannot be empty',
    );
    expect(field('Name')).toHaveValue('Mira');
    expect(field('Hit Dice')).toHaveValue('4');
  });
});
