import type { Id } from '@convex/_generated/dataModel';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { CompanionRelationship } from '~/components/character-sheet/character-companions-view-model';
import {
  characterSheetPath,
  type CharacterSheetOrigin,
} from '~/lib/campaign-routes';
import { OrganizationSwitchNotice } from './organization-switch-notice';
import { beforeEach, expect, test, vi } from 'vitest';
import { CampaignCharactersView } from './campaign-characters-view';
import { CharactersListLoading } from './characters-list-loading';
import { OwnedCharactersView } from './owned-characters-view';

const transport = vi.hoisted(() => ({
  isWide: true,
  readOnly: false,
  mutate: vi.fn(),
  relationships: undefined as CompanionRelationship[] | undefined,
  relationshipReads: [] as unknown[],
}));
vi.mock('convex/react', () => ({
  useQuery: (_reference: unknown, args: unknown) => {
    if (args === 'skip') return undefined;
    transport.relationshipReads.push(args);
    return transport.relationships;
  },
  useMutation: () => transport.mutate,
  usePaginatedQuery: () => ({
    results: [{ userId: 'member', name: 'Bryn', isMine: true }],
    status: 'Exhausted',
    loadMore: vi.fn(),
  }),
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({
    kind: transport.readOnly ? 'maintenance' : 'ready',
    readOnly: transport.readOnly,
    message: transport.readOnly ? 'Editing is paused for maintenance.' : '',
  }),
}));
vi.mock('~/components/use-breakpoint', () => ({
  useBreakpoint: () => transport.isWide,
}));
const campaignScope = {
  campaignId: 'campaign' as Id<'campaign'>,
  organizationId: 'org',
};
beforeEach(() => {
  transport.isWide = true;
  transport.readOnly = false;
  transport.mutate.mockReset().mockResolvedValue(null);
  transport.relationships = undefined;
  transport.relationshipReads = [];
});

vi.mock('~/components/campaign-shell/navigation-guard', () => ({
  GuardedLink: ({ children, ...props }: React.ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));

test('owned characters show No campaign before campaign and organization with accessible sheet links', () => {
  render(
    <OwnedCharactersView
      groups={[
        {
          key: 'none',
          title: 'No campaign',
          characters: [
            {
              id: 'private',
              name: 'Mira',
              level: 1,
              kind: 'PC',
              active: true,
              href: '/characters/private?from=%2Fcharacters',
            },
          ],
        },
        {
          key: 'kingmaker',
          title: 'Kingmaker',
          organizationName: 'Thursday table',
          characters: [
            {
              id: 'shared',
              name: 'Oren',
              level: 3,
              kind: 'NPC',
              active: false,
              href: '/characters/shared?from=%2Fcharacters',
            },
          ],
        },
      ]}
      newHref="/characters/new"
    />,
  );
  expect(
    screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent),
  ).toEqual(['No campaign', 'Kingmaker']);
  const group = screen.getByRole('region', { name: 'Kingmaker' });
  expect(group).toHaveTextContent('Thursday table');
  expect(group).toHaveTextContent('Archived');
  expect(within(group).getByRole('link', { name: /Oren/ })).toHaveAttribute(
    'href',
    '/characters/shared?from=%2Fcharacters',
  );
  expect(screen.getByRole('link', { name: 'New character' })).toHaveAttribute(
    'href',
    '/characters/new',
  );
});

test('empty and loading states announce what the player is waiting for', () => {
  const { rerender } = render(
    <OwnedCharactersView
      groups={[{ key: 'none', title: 'No campaign', characters: [] }]}
      newHref="/characters/new"
    />,
  );
  expect(screen.getByText('No characters yet.')).toBeVisible();
  rerender(<CharactersListLoading />);
  expect(
    screen.getByRole('status', { name: 'Loading characters' }),
  ).toBeInTheDocument();
});

test('campaign characters table every owner, active state and roster membership', () => {
  render(
    <CampaignCharactersView
      scope={campaignScope}
      campaignName="Kingmaker"
      characters={[
        {
          id: '1' as Id<'character'>,
          name: 'Alia',
          level: 3,
          kind: 'PC',
          active: true,
          href: '/characters/1',
          ownershipAvailable: true,
          ownerName: 'Andreas',
          owner: {
            userId: 'andreas' as Id<'user'>,
            name: 'Andreas',
            isMine: false,
          },
          isOnRoster: true,
        },
        {
          id: '2' as Id<'character'>,
          name: 'Borin',
          level: 2,
          kind: 'NPC',
          active: false,
          href: '/characters/2',
          ownershipAvailable: true,
          ownerName: null,
          owner: null,
          isOnRoster: false,
        },
      ]}
      newHref="/characters/new"
    />,
  );
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Characters',
  );
  expect(
    screen.getByText('Everyone in Kingmaker can edit these.'),
  ).toBeVisible();
  expect(
    screen.getAllByRole('columnheader').map((header) => header.textContent),
  ).toEqual(['Name', 'Owner', 'Level', 'Status', 'Roster']);
  const alia = screen.getByRole('link', { name: 'Alia' }).closest('tr')!;
  expect(screen.getByRole('link', { name: 'Alia' })).toHaveAttribute(
    'href',
    '/characters/1',
  );
  expect(alia).toHaveTextContent('Andreas');
  expect(alia).toHaveTextContent('On roster');
  expect(alia).toHaveTextContent('Active');
  const borin = screen.getByRole('link', { name: 'Borin' }).closest('tr')!;
  expect(borin).toHaveTextContent('Needs an owner');
  expect(borin).toHaveTextContent('Archived');
  expect(borin).toHaveTextContent('Not on roster');
});

test('an empty campaign says so under its title', () => {
  render(
    <CampaignCharactersView
      scope={campaignScope}
      campaignName="Kingmaker"
      characters={[]}
      newHref="/characters/new"
    />,
  );
  expect(screen.getByText('No characters in this campaign yet.')).toBeVisible();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

test('a campaign Character without a destination keeps its plain name and row information', () => {
  render(
    <CampaignCharactersView
      scope={campaignScope}
      campaignName="Kingmaker"
      characters={[
        {
          id: 'legacy' as Id<'character'>,
          name: 'Legacy hero',
          level: 3,
          kind: 'PC',
          active: false,
          ownershipAvailable: true,
          ownerName: 'Alice',
          owner: {
            userId: 'alice' as Id<'user'>,
            name: 'Alice',
            isMine: false,
          },
          isOnRoster: false,
        },
      ]}
    />,
  );
  const name = screen.getByText('Legacy hero');
  expect(name).toBeVisible();
  expect(name.closest('a')).toBeNull();
  const row = name.closest('tr')!;
  expect(row).toHaveTextContent('Alice');
  expect(row).toHaveTextContent('Archived');
  expect(row).toHaveTextContent('Not on roster');
  expect(
    screen.queryByRole('link', { name: 'New character' }),
  ).not.toBeInTheDocument();
});

test('owned Characters omit creation when no creation destination is available', () => {
  render(
    <OwnedCharactersView
      groups={[{ key: 'none', title: 'No campaign', characters: [] }]}
    />,
  );
  expect(
    screen.getByRole('heading', { name: 'Characters', level: 1 }),
  ).toBeVisible();
  expect(
    screen.queryByRole('link', { name: 'New character' }),
  ).not.toBeInTheDocument();
});

test.each([
  '/campaigns/kingmaker/officers',
  '/characters/prepared?from=%2Fcampaigns%2Fkingmaker%2Fcharacters',
])('campaign Characters retain their supplied destination %s', (href) => {
  render(
    <CampaignCharactersView
      scope={campaignScope}
      campaignName="Kingmaker"
      characters={[
        {
          id: 'hero' as Id<'character'>,
          name: 'Hero',
          level: 3,
          kind: 'PC',
          active: true,
          href,
          ownershipAvailable: true,
          ownerName: 'Alice',
          owner: {
            userId: 'alice' as Id<'user'>,
            name: 'Alice',
            isMine: false,
          },
          isOnRoster: true,
        },
      ]}
    />,
  );
  expect(screen.getByRole('link', { name: 'Hero' })).toHaveAttribute(
    'href',
    href,
  );
});

test('an organization change announces progress and lets the player retry a failure', () => {
  const retry = vi.fn();
  const { rerender } = render(
    <OrganizationSwitchNotice status={{ kind: 'switching', retry }} />,
  );
  expect(screen.getByRole('status')).toHaveTextContent(
    'Changing organization…',
  );
  rerender(<OrganizationSwitchNotice status={{ kind: 'failed', retry }} />);
  const failure = screen.getByRole('alert');
  expect(failure).toHaveTextContent('The organization could not be changed.');
  fireEvent.click(within(failure).getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalledTimes(1);
  rerender(<OrganizationSwitchNotice status={{ kind: 'idle', retry }} />);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test.each([true, false])(
  'a campaign Character can receive an owner from its row at tablet or phone width (%s)',
  async (isWide) => {
    transport.isWide = isWide;
    render(
      <CampaignCharactersView
        scope={campaignScope}
        campaignName="Ironfang"
        characters={[
          {
            id: 'hero' as Id<'character'>,
            name: 'Hero',
            level: 3,
            kind: 'PC',
            active: false,
            ownershipAvailable: true,
            ownerName: null,
            owner: null,
            isOnRoster: false,
          },
        ]}
      />,
    );
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    fireEvent.click(
      screen.getByRole('button', { name: 'Assign owner for Hero' }),
    );
    const picker = within(screen.getByRole('dialog', { name: 'Choose owner' }));
    fireEvent.click(picker.getByRole('radio', { name: /^Bryn/ }));
    await act(async () =>
      fireEvent.click(picker.getByRole('button', { name: 'Assign owner' })),
    );
    expect(transport.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        ...campaignScope,
        characterId: 'hero',
        ownerUserId: 'member',
        operationId: expect.any(String),
      }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Owner assigned.');
  },
);

test('a legacy production campaign row keeps its ledger link and offers no owner assignment', () => {
  render(
    <CampaignCharactersView
      scope={campaignScope}
      campaignName="Ironfang"
      characters={[
        {
          id: 'hero' as Id<'character'>,
          name: 'Hero',
          level: 3,
          kind: 'PC',
          active: true,
          ownerName: 'Ada',
          owner: { userId: 'ada' as Id<'user'>, name: 'Ada', isMine: false },
          ownershipAvailable: false,
          isOnRoster: false,
          href: '/campaigns/campaign/officers',
        },
      ]}
    />,
  );
  expect(screen.getByRole('link', { name: 'Hero' })).toHaveAttribute(
    'href',
    '/campaigns/campaign/officers',
  );
  expect(
    screen.queryByRole('button', { name: /Assign owner/ }),
  ).not.toBeInTheDocument();
  expect(transport.mutate).not.toHaveBeenCalled();
});

test('rotating the campaign list preserves a pending owner assignment and its late failure', async () => {
  let rejectAssignment: ((error: Error) => void) | undefined;
  transport.mutate.mockReturnValue(
    new Promise<void>((_resolve, reject) => {
      rejectAssignment = reject;
    }),
  );
  const list = () => (
    <CampaignCharactersView
      scope={campaignScope}
      campaignName="Ironfang"
      characters={[
        {
          id: 'hero' as Id<'character'>,
          name: 'Hero',
          level: 3,
          kind: 'PC',
          active: true,
          ownershipAvailable: true,
          ownerName: null,
          owner: null,
          isOnRoster: false,
        },
      ]}
    />
  );
  const view = render(list());
  fireEvent.click(
    screen.getByRole('button', { name: 'Assign owner for Hero' }),
  );
  const picker = () =>
    within(screen.getByRole('dialog', { name: 'Choose owner' }));
  fireEvent.click(picker().getByRole('radio', { name: /^Bryn/ }));
  fireEvent.click(picker().getByRole('button', { name: 'Assign owner' }));
  expect(picker().getByRole('status')).toHaveTextContent('Assigning owner…');
  transport.isWide = false;
  view.rerender(list());
  expect(picker().getByRole('status')).toHaveTextContent('Assigning owner…');
  expect(picker().getByRole('radio', { name: /^Bryn/ })).toBeChecked();
  expect(picker().getByRole('button', { name: 'Assign owner' })).toBeDisabled();
  await act(async () => rejectAssignment?.(new Error('Disconnected')));
  expect(picker().getByRole('alert')).toHaveTextContent(
    'Owner may have changed. Check the current owner before trying again.',
  );
  expect(transport.mutate).toHaveBeenCalledTimes(1);
  expect(picker().getByRole('button', { name: 'Assign owner' })).toBeEnabled();
  transport.isWide = true;
  view.rerender(list());
  expect(picker().getByRole('radio', { name: /^Bryn/ })).toBeChecked();
  expect(picker().getByRole('alert')).toHaveTextContent(
    'Owner may have changed. Check the current owner before trying again.',
  );
});

test('rotating the campaign list preserves a pending assignment until its success is acknowledged', async () => {
  let resolveAssignment: (() => void) | undefined;
  transport.mutate.mockReturnValue(
    new Promise<void>((resolve) => {
      resolveAssignment = resolve;
    }),
  );
  const list = () => (
    <CampaignCharactersView
      scope={campaignScope}
      campaignName="Ironfang"
      characters={[
        {
          id: 'hero' as Id<'character'>,
          name: 'Hero',
          level: 3,
          kind: 'PC',
          active: true,
          ownershipAvailable: true,
          ownerName: null,
          owner: null,
          isOnRoster: false,
        },
      ]}
    />
  );
  const view = render(list());
  fireEvent.click(
    screen.getByRole('button', { name: 'Assign owner for Hero' }),
  );
  const picker = () =>
    within(screen.getByRole('dialog', { name: 'Choose owner' }));
  fireEvent.click(picker().getByRole('radio', { name: /^Bryn/ }));
  fireEvent.click(picker().getByRole('button', { name: 'Assign owner' }));
  transport.isWide = false;
  view.rerender(list());
  expect(picker().getByRole('status')).toHaveTextContent('Assigning owner…');
  expect(picker().getByRole('button', { name: 'Assign owner' })).toBeDisabled();
  await act(async () => resolveAssignment?.());
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Owner assigned.');
  expect(
    screen.getByRole('button', { name: 'Assign owner for Hero' }),
  ).toBeEnabled();
  expect(transport.mutate).toHaveBeenCalledTimes(1);
});

test.each([true, false])(
  'maintenance explains itself once above the campaign list while every Assign owner is disabled (wide: %s)',
  (isWide) => {
    transport.isWide = isWide;
    transport.readOnly = true;
    const longName =
      'Bartholomew Fitzgerald-Montgomery of the Northern Reaches and Beyond';
    render(
      <CampaignCharactersView
        scope={campaignScope}
        campaignName="Ironfang"
        characters={[
          {
            id: 'hero' as Id<'character'>,
            name: 'Hero',
            level: 3,
            kind: 'PC',
            active: true,
            ownershipAvailable: true,
            ownerName: longName,
            owner: {
              userId: 'member' as Id<'user'>,
              name: longName,
              isMine: true,
            },
            isOnRoster: false,
          },
          {
            id: 'sidekick' as Id<'character'>,
            name: 'Sidekick',
            level: 1,
            kind: 'NPC',
            active: true,
            ownershipAvailable: true,
            ownerName: null,
            owner: null,
            isOnRoster: false,
          },
        ]}
      />,
    );
    expect(
      screen.getAllByText('Editing is paused for maintenance.'),
    ).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: 'Assign owner for Hero' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Assign owner for Sidekick' }),
    ).toBeDisabled();
    const hero = screen.getByText('Hero').closest('tr')!;
    expect(within(hero).getByText(longName)).toBeVisible();
    expect(within(hero).getByText('(me)')).toBeVisible();
    for (const region of screen.getAllByRole('status')) {
      expect(region).toBeEmptyDOMElement();
    }
  },
);

const charactersOrigin: CharacterSheetOrigin = {
  href: '/characters',
  organization: { kind: 'personal' },
};
const whisper = {
  relationshipId: 'rel-whisper' as Id<'companionRelationship'>,
  role: 'companion',
  kind: 'familiar',
  status: 'active',
  interruption: null,
  endpoint: { characterId: 'owl' as Id<'character'>, name: 'Whisper' },
  sources: [],
  linkedInputs: [],
  lastOperationId: 'seed',
} satisfies CompanionRelationship;
const hiddenLord = {
  ...whisper,
  relationshipId: 'rel-lord' as Id<'companionRelationship'>,
  role: 'associated',
  kind: 'cohort',
  status: 'replaced',
  endpoint: null,
} satisfies CompanionRelationship;

function companionsOwner(companions = true) {
  return (
    <OwnedCharactersView
      groups={[
        {
          key: 'none',
          title: 'No campaign',
          characters: [
            {
              id: 'mira',
              name: 'Mira',
              level: 1,
              kind: 'PC',
              active: true,
              href: '/characters/mira',
              companions: companions
                ? {
                    characterId: 'mira' as Id<'character'>,
                    origin: charactersOrigin,
                  }
                : undefined,
            },
          ],
        },
      ]}
    />
  );
}

test('a Character row discloses its Companion Relationships on request, linking accessible sheets and never naming an unavailable one', () => {
  const view = render(companionsOwner());
  const toggle = screen.getByRole('button', { name: 'Companions of Mira' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(transport.relationshipReads).toEqual([]);

  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('status')).toHaveTextContent('Loading companions…');
  expect(transport.relationshipReads.at(-1)).toEqual({ characterId: 'mira' });

  transport.relationships = [];
  view.rerender(companionsOwner());
  expect(screen.getByText('No Companion Relationships.')).toBeVisible();

  transport.relationships = [whisper, hiddenLord];
  view.rerender(companionsOwner());
  const list = screen.getByRole('list', { name: 'Companions of Mira' });
  expect(
    within(list)
      .getAllByRole('listitem')
      .map((item) => item.getAttribute('aria-label')),
  ).toEqual([
    'Companion Whisper',
    'Associated Character Character unavailable',
  ]);
  const companion = within(list).getByRole('listitem', {
    name: 'Companion Whisper',
  });
  expect(within(companion).getByText('Familiar')).toBeVisible();
  expect(within(companion).getByText('Active')).toBeVisible();
  expect(
    within(companion).getByRole('link', { name: 'Whisper' }),
  ).toHaveAttribute('href', characterSheetPath('owl', charactersOrigin));
  const hidden = within(list).getByRole('listitem', {
    name: 'Associated Character Character unavailable',
  });
  expect(within(hidden).queryByRole('link')).toBeNull();
  expect(within(hidden).getByText('Replaced')).toBeVisible();
  expect(document.body.innerHTML).not.toMatch(/rel-lord|rel-whisper/);

  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('list', { name: 'Companions of Mira' })).toBeNull();

  view.rerender(companionsOwner(false));
  expect(screen.queryByRole('button', { name: /Companions/ })).toBeNull();
});

test('a campaign row offers Companions only for a Character with a sheet', () => {
  const sheetless = {
    id: 'legacy' as Id<'character'>,
    name: 'Legacy hero',
    level: 3,
    kind: 'PC',
    active: true,
    ownershipAvailable: false,
    ownerName: null,
    owner: null,
    isOnRoster: true,
  };
  render(
    <CampaignCharactersView
      scope={campaignScope}
      campaignName="Kingmaker"
      characters={[
        sheetless,
        {
          ...sheetless,
          id: 'alia' as Id<'character'>,
          name: 'Alia',
          href: '/characters/alia',
          companions: {
            characterId: 'alia' as Id<'character'>,
            origin: charactersOrigin,
          },
        },
      ]}
    />,
  );
  expect(
    screen.queryByRole('button', { name: 'Companions of Legacy hero' }),
  ).toBeNull();
  transport.relationships = [whisper];
  fireEvent.click(screen.getByRole('button', { name: 'Companions of Alia' }));
  const alia = screen.getByRole('link', { name: 'Alia' }).closest('tr');
  expect(alia).not.toBeNull();
  expect(
    within(alia as HTMLElement).getByRole('link', { name: 'Whisper' }),
  ).toBeVisible();
});
