import { fireEvent, render, screen, within } from '@testing-library/react';
import type { Id } from '@convex/_generated/dataModel';
import type { ComponentProps } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { useCharacterMove } from '~/components/character-sheet/use-character-move';
import { campaignPath, characterSheetPath } from '~/lib/campaign-routes';
import { AddFromMyCharacters } from './add-from-my-characters';

// Add from my characters on a campaign's Characters page (#316): my own
// Characters from elsewhere, each joined or moved here by its own movement
// controller (use-character-move.test.ts covers the controller).

type Movement = ReturnType<typeof useCharacterMove>;
type Owned = { _id: string; name: string; level: number; kind: string };
type Group =
  | { kind: 'noCampaign'; characters: Owned[] }
  | {
      kind: 'campaign';
      campaignId: string;
      campaignName: string;
      organizationId: string;
      characters: Owned[];
    };
const transport = vi.hoisted(() => ({
  owned: undefined as Group[] | undefined,
  movements: {} as Record<string, Movement>,
}));
vi.mock('@convex/_generated/api', () => ({
  api: { character: { listOwned: 'listOwned' } },
}));
vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useQuery: (name: string) => {
    if (name !== 'listOwned') throw new Error(`Unexpected read ${name}`);
    return transport.owned;
  },
}));
vi.mock('~/components/character-sheet/use-character-move', () => ({
  useCharacterMove: ({ characterId }: { characterId: string }) =>
    transport.movements[characterId],
}));
vi.mock('~/components/campaign-shell/navigation-guard', () => ({
  GuardedLink: ({ children, ...props }: ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));

const here = 'ironfang' as Id<'campaign'>;
const elsewhere = 'kingmaker' as Id<'campaign'>;
const handlers = {
  startMove: vi.fn<Movement['startMove']>(),
  resumeMove: vi.fn<Movement['resumeMove']>(),
  cancelMove: vi.fn<Movement['cancelMove']>(),
  retryRead: vi.fn<Movement['retryRead']>(),
};
function movement(overrides: Partial<Movement> = {}): Movement {
  return {
    isAvailable: true,
    isLoading: false,
    isDisabled: false,
    isBusy: false,
    canStart: true,
    canResume: false,
    canCancel: false,
    canLeave: false,
    currentCampaignId: undefined,
    currentCampaignHasMilitia: true,
    departureRoles: [],
    pendingDestinationCampaignId: undefined,
    isPickerOpen: false,
    setIsPickerOpen: () => undefined,
    destinations: [
      {
        campaignId: here,
        campaignName: 'Ironfang',
        organizationId: 'org',
        hasMilitia: true,
      },
    ],
    status: { kind: 'idle' },
    progress: null,
    needsInspection: false,
    operatorStatus: null,
    readError: null,
    ...handlers,
    ...overrides,
  };
}
const character = (id: string, name: string): Owned => ({
  _id: id,
  name,
  level: 2,
  kind: 'pc',
});
const control = () => (
  <AddFromMyCharacters
    campaignId={here}
    campaignName="Ironfang"
    organizationId="org"
  />
);
function open() {
  fireEvent.click(
    screen.getByRole('button', { name: 'Add from my characters' }),
  );
  return within(screen.getByRole('dialog', { name: 'Add from my characters' }));
}
const choose = (
  dialog: ReturnType<typeof open>,
  name: string,
): ReturnType<typeof open> => {
  fireEvent.click(dialog.getByRole('radio', { name: new RegExp(`^${name}`) }));
  return within(dialog.getByRole('region', { name: `Add ${name}` }));
};

beforeEach(() => {
  vi.clearAllMocks();
  handlers.startMove.mockResolvedValue(true);
  transport.owned = [
    { kind: 'noCampaign', characters: [character('mira', 'Mira')] },
    {
      kind: 'campaign',
      campaignId: elsewhere,
      campaignName: 'Kingmaker',
      organizationId: 'other',
      characters: [character('oren', 'Oren')],
    },
    {
      kind: 'campaign',
      campaignId: here,
      campaignName: 'Ironfang',
      organizationId: 'org',
      characters: [character('alia', 'Alia')],
    },
  ];
  transport.movements = {
    mira: movement(),
    oren: movement({ currentCampaignId: elsewhere }),
  };
});

test('lists my characters from elsewhere once, saying where each comes from, and joins or moves the chosen one here', () => {
  render(control());
  const dialog = open();
  expect(
    dialog
      .getAllByRole('radio')
      .map((radio) => radio.closest('label')?.textContent),
  ).toEqual([
    'MiraLevel 2 · PC · No campaign',
    'OrenLevel 2 · PC · Moves from Kingmaker',
  ]);
  expect(dialog.queryByRole('radio', { name: /Alia/ })).toBeNull();

  const mira = choose(dialog, 'Mira');
  expect(mira.getByText(/isn’t added to a militia roster/)).toBeVisible();
  fireEvent.click(mira.getByRole('button', { name: 'Join campaign' }));
  expect(handlers.startMove).toHaveBeenCalledTimes(1);
  expect(handlers.startMove).toHaveBeenCalledWith(here);

  const oren = choose(dialog, 'Oren');
  expect(
    oren.getByText(/Oren leaves Kingmaker when the move completes/),
  ).toBeVisible();
  fireEvent.click(oren.getByRole('button', { name: 'Move character' }));
  expect(handlers.startMove).toHaveBeenLastCalledWith(here);
});

test('a move already under way is continued rather than started again; reads, refusals and ineligible characters are stated before anything is saved', () => {
  transport.movements.oren = movement({
    currentCampaignId: elsewhere,
    canStart: false,
    canResume: true,
    canCancel: true,
    progress: {
      generation: 0,
      operationId: 'op',
      destinationCampaignId: here,
      state: 'preparing',
      prepared: 1,
      total: 4,
    },
  });
  transport.movements.mira = movement({ isAvailable: false, isLoading: true });
  render(control());
  const dialog = open();
  const oren = choose(dialog, 'Oren');
  expect(oren.getByText('Preserving homebrew…')).toBeVisible();
  expect(oren.queryByRole('button', { name: 'Move character' })).toBeNull();
  fireEvent.click(oren.getByRole('button', { name: 'Continue move' }));
  expect(handlers.resumeMove).toHaveBeenCalledTimes(1);

  const loading = choose(dialog, 'Mira');
  expect(loading.getByRole('status')).toHaveTextContent(
    'Loading campaign choices…',
  );
  expect(loading.queryByRole('button')).toBeNull();
  expect(handlers.startMove).not.toHaveBeenCalled();
});

test('a character that can’t come here, or whose start was refused, says so in place', () => {
  transport.movements.mira = movement({ destinations: [] });
  const refused = "Move wasn't saved: Choose a different campaign. Try again.";
  transport.movements.oren = movement({
    currentCampaignId: elsewhere,
    status: { kind: 'error', message: refused },
  });
  render(control());
  const dialog = open();
  const mira = choose(dialog, 'Mira');
  expect(mira.getByText('Mira can’t be added to Ironfang.')).toBeVisible();
  expect(mira.queryByRole('button')).toBeNull();
  const oren = choose(dialog, 'Oren');
  expect(oren.getByRole('alert')).toHaveTextContent(refused);
  expect(oren.getByRole('button', { name: 'Move character' })).toBeEnabled();
});

test('an arrival opens the same sheet with this campaign’s Characters as origin and adds no roster place', () => {
  transport.movements.mira = movement({
    canStart: false,
    canResume: true,
    progress: {
      generation: 0,
      operationId: 'op',
      destinationCampaignId: here,
      state: 'ready',
      prepared: 4,
      total: 4,
    },
  });
  const view = render(control());
  const mira = choose(open(), 'Mira');
  fireEvent.click(mira.getByRole('button', { name: 'Complete move' }));
  expect(handlers.resumeMove).toHaveBeenCalledTimes(1);

  // Published: Mira is listed here now, and leaves the candidates.
  transport.movements.mira = movement({
    currentCampaignId: here,
    destinations: [],
    status: { kind: 'saved' },
    progress: {
      generation: 0,
      operationId: 'op',
      destinationCampaignId: here,
      state: 'completed',
      prepared: 4,
      total: 4,
    },
  });
  transport.owned = transport.owned!.map((group) =>
    group.kind === 'noCampaign'
      ? { ...group, characters: [] }
      : group.campaignId === here
        ? {
            ...group,
            characters: [...group.characters, character('mira', 'Mira')],
          }
        : group,
  );
  view.rerender(control());
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.queryByRole('radio', { name: /^Mira/ })).toBeNull();
  const arrived = within(dialog.getByRole('region', { name: 'Add Mira' }));
  expect(arrived.getByRole('status')).toHaveTextContent(
    'Added to campaign. Add this character to the militia roster separately.',
  );
  expect(
    arrived.getByRole('link', { name: 'Open Mira’s sheet' }),
  ).toHaveAttribute(
    'href',
    characterSheetPath('mira', {
      href: campaignPath(here, 'characters'),
      organization: { kind: 'organization', id: 'org' },
    }),
  );
});

test('loading and empty lists read plainly', () => {
  transport.owned = undefined;
  const view = render(control());
  expect(open().getByRole('status')).toHaveTextContent(
    'Loading your characters…',
  );
  transport.owned = [{ kind: 'noCampaign', characters: [] }];
  view.rerender(control());
  expect(
    screen.getByText('All your available characters are already here.'),
  ).toBeVisible();
  expect(screen.queryByRole('radio')).toBeNull();
});

test('a move to another campaign is shown disabled and cannot be continued here', () => {
  transport.movements.oren = movement({
    currentCampaignId: elsewhere,
    canStart: false,
    canResume: true,
    canCancel: true,
    progress: {
      generation: 0,
      operationId: 'other',
      state: 'ready',
      prepared: 4,
      total: 4,
      destinationCampaignId: 'thornkeep' as Id<'campaign'>,
      destinationCampaignName: 'Thornkeep',
    },
  });
  render(control());
  const oren = choose(open(), 'Oren');
  expect(
    oren.getByRole('button', { name: 'Moving to Thornkeep' }),
  ).toBeDisabled();
  expect(oren.queryByRole('button', { name: 'Complete move' })).toBeNull();
  expect(handlers.resumeMove).not.toHaveBeenCalled();
});

test('a lost move response for another campaign stays disabled while awaiting inspection', () => {
  const thornkeep = 'thornkeep' as Id<'campaign'>;
  transport.movements.oren = movement({
    currentCampaignId: elsewhere,
    canStart: false,
    canResume: true,
    progress: null,
    needsInspection: true,
    pendingDestinationCampaignId: thornkeep,
    destinations: [
      {
        campaignId: thornkeep,
        campaignName: 'Thornkeep',
        organizationId: 'org',
        hasMilitia: false,
      },
    ],
  });
  render(control());
  const oren = choose(open(), 'Oren');
  expect(
    oren.getByRole('button', { name: 'Moving to Thornkeep' }),
  ).toBeDisabled();
  expect(oren.queryByRole('button', { name: 'Check progress' })).toBeNull();
  expect(oren.queryByRole('button', { name: 'Complete move' })).toBeNull();
  expect(handlers.resumeMove).not.toHaveBeenCalled();
});
