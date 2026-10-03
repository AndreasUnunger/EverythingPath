import { renderHook } from '@testing-library/react';
import type { Doc, Id } from '@convex/_generated/dataModel';
import { beforeEach, expect, test, vi } from 'vitest';
import {
  useCampaignCharacters,
  useOwnedCharacters,
} from './use-character-lists';

const state = vi.hoisted(() => ({
  org: null as string | null,
  userGroups: [] as unknown[],
  campaignRows: [] as unknown[],
  user: { characterSheetDemo: true } as
    | { characterSheetDemo?: true }
    | null
    | undefined,
  campaigns: {
    state: 'ready',
    campaigns: [{ _id: 'alpha', e2eFixture: 'characterSheet' }],
  } as
    | {
        state: 'ready';
        campaigns: { _id: string; e2eFixture?: string }[];
      }
    | { state: 'no_access' }
    | undefined,
  contexts: [{ campaignId: 'alpha', hasMilitia: true }] as
    | { campaignId: string; hasMilitia: boolean }[]
    | undefined,
  calls: vi.fn(),
}));
vi.mock('@convex/_generated/api', () => ({
  api: {
    character: { listOwned: 'owned', listCampaignCharacters: 'campaign' },
    user: { getMe: 'user' },
    campaign: {
      getCampaigns: 'campaigns',
      listNavigationContexts: 'contexts',
    },
  },
}));
vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useQuery: (name: string, args: unknown) => {
    state.calls(name, args);
    switch (name) {
      case 'owned':
        return state.userGroups;
      case 'campaign':
        return state.campaignRows;
      case 'user':
        return state.user;
      case 'campaigns':
        return state.campaigns;
      case 'contexts':
        return state.contexts;
    }
  },
}));
vi.mock('@clerk/nextjs', () => ({
  useOrganization: () => ({
    organization: state.org ? { id: state.org } : null,
  }),
}));
vi.mock('~/components/campaign-shell/use-organization-memberships', () => ({
  useOrganizationMemberships: () => [
    { organization: { id: 'other', name: 'Other table' } },
  ],
}));
function character(patch: Partial<Doc<'character'>> = {}): Doc<'character'> {
  return {
    _id: 'hero' as Id<'character'>,
    _creationTime: 0,
    name: 'Hero',
    description: '',
    kind: 'pc',
    isActive: true,
    level: 3,
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    ...patch,
  };
}
beforeEach(() => {
  state.org = null;
  state.calls.mockReset();
  state.userGroups = [];
  state.campaignRows = [];
  state.user = { characterSheetDemo: true };
  state.campaigns = {
    state: 'ready',
    campaigns: [{ _id: 'alpha', e2eFixture: 'characterSheet' }],
  };
  state.contexts = [{ campaignId: 'alpha', hasMilitia: true }];
});

test.each([undefined, null, {}])(
  'owned Characters offer no creation link without a private sheet demo grant (%j)',
  (user) => {
    state.user = user;
    const view = renderHook(() => useOwnedCharacters());
    expect(view.result.current.newHref).toBeUndefined();
  },
);

test('campaign Characters offer creation only for the selected prepared fixture campaign', () => {
  state.campaigns = {
    state: 'ready',
    campaigns: [
      { _id: 'alpha' },
      { _id: 'prepared', e2eFixture: 'characterSheet' },
    ],
  };
  const view = renderHook(() =>
    useCampaignCharacters({
      campaignId: 'alpha' as Id<'campaign'>,
      organizationId: 'other',
    }),
  );
  expect(view.result.current.newHref).toBeUndefined();
});

test.each([
  undefined,
  { state: 'no_access' as const },
  { state: 'ready' as const, campaigns: [] },
])(
  'campaign Characters offer no creation while campaign eligibility is unavailable (%j)',
  (campaigns) => {
    state.campaigns = campaigns;
    const view = renderHook(() =>
      useCampaignCharacters({
        campaignId: 'alpha' as Id<'campaign'>,
        organizationId: 'other',
      }),
    );
    expect(view.result.current.newHref).toBeUndefined();
  },
);

test('a prepared fixture campaign offers creation with its campaign and organization origin', () => {
  state.user = {};
  const view = renderHook(() =>
    useCampaignCharacters({
      campaignId: 'alpha' as Id<'campaign'>,
      organizationId: 'other',
    }),
  );
  expect(view.result.current.newHref).toBe(
    '/characters/new?campaignId=alpha&from=%2Fcampaigns%2Falpha%2Fcharacters&organizationId=other',
  );
});

test('legacy campaign Characters open the militia ledger before a week is initialized', () => {
  state.campaignRows = [
    {
      character: character(),
      ownerName: 'Alice',
      owner: { userId: 'alice' as Id<'user'>, name: 'Alice', isMine: false },
      isOnRoster: false,
    },
  ];
  const view = renderHook(() =>
    useCampaignCharacters({
      campaignId: 'alpha' as Id<'campaign'>,
      organizationId: 'other',
    }),
  );
  expect(view.result.current.characters?.[0]?.href).toBe(
    '/campaigns/alpha/officers',
  );
});

test('campaign rows offer ownership only after their own campaign is prepared', () => {
  state.campaignRows = [
    {
      character: character(),
      ownerName: 'Alice',
      owner: { userId: 'alice' as Id<'user'>, name: 'Alice', isMine: false },
      isOnRoster: false,
    },
  ];
  state.campaigns = {
    state: 'ready',
    campaigns: [
      { _id: 'alpha' },
      { _id: 'other', e2eFixture: 'characterSheet' },
    ],
  };
  const view = renderHook(() =>
    useCampaignCharacters({
      campaignId: 'alpha' as Id<'campaign'>,
      organizationId: 'other',
    }),
  );
  expect(view.result.current.characters?.[0]?.ownershipAvailable).toBe(false);
  state.campaigns = undefined;
  view.rerender();
  expect(view.result.current.characters?.[0]?.ownershipAvailable).toBe(false);
  state.campaigns = {
    state: 'ready',
    campaigns: [{ _id: 'alpha', e2eFixture: 'characterSheet' }],
  };
  view.rerender();
  expect(view.result.current.characters?.[0]?.ownershipAvailable).toBe(true);
});

test('legacy campaign Characters have no sheet or ledger destination without a militia', () => {
  state.contexts = [
    { campaignId: 'alpha', hasMilitia: false },
    { campaignId: 'another', hasMilitia: true },
  ];
  state.campaignRows = [
    {
      character: character(),
      ownerName: 'Alice',
      owner: { userId: 'alice' as Id<'user'>, name: 'Alice', isMine: false },
      isOnRoster: false,
    },
  ];
  const view = renderHook(() =>
    useCampaignCharacters({
      campaignId: 'alpha' as Id<'campaign'>,
      organizationId: 'other',
    }),
  );
  expect(view.result.current.characters?.[0]?.href).toBeUndefined();
});

test('prepared campaign Characters keep their independent sheet without a militia', () => {
  state.contexts = [{ campaignId: 'alpha', hasMilitia: false }];
  state.campaignRows = [
    {
      character: character({ sheetMode: 'full' }),
      ownerName: 'Alice',
      owner: { userId: 'alice' as Id<'user'>, name: 'Alice', isMine: false },
      isOnRoster: false,
    },
  ];
  const view = renderHook(() =>
    useCampaignCharacters({
      campaignId: 'alpha' as Id<'campaign'>,
      organizationId: 'other',
    }),
  );
  expect(view.result.current.characters?.[0]?.href).toBe(
    '/characters/hero?from=%2Fcampaigns%2Falpha%2Fcharacters&organizationId=other',
  );
});

test('owned groups retain No campaign first, organization names and a personal origin even for campaign sheets', () => {
  state.userGroups = [
    { kind: 'noCampaign', characters: [character()] },
    {
      kind: 'campaign',
      campaignId: 'alpha',
      campaignName: 'Ironfang',
      organizationId: 'other',
      characters: [character()],
    },
  ];
  const view = renderHook(() => useOwnedCharacters());
  expect(view.result.current.groups?.map(({ title }) => title)).toEqual([
    'No campaign',
    'Ironfang',
  ]);
  expect(view.result.current.groups?.[1]?.organizationName).toBe('Other table');
  expect(view.result.current.groups?.[1]?.characters[0]).toMatchObject({
    kind: 'PC',
    href: '/characters/hero?from=%2Fcharacters&organizationId=',
  });
  expect(view.result.current.newHref).toBe(
    '/characters/new?from=%2Fcharacters&organizationId=',
  );
  expect(state.calls).toHaveBeenCalledWith('owned', {});
});

test('campaign list keeps archived Characters, owner and roster information and campaign origin', () => {
  state.campaignRows = [
    {
      character: character({
        isActive: false,
        sheetMode: 'full',
        ownerLastOperationId: 'owner-save',
      }),
      ownerName: 'Alice',
      owner: { userId: 'alice' as Id<'user'>, name: 'Alice', isMine: false },
      isOnRoster: true,
    },
  ];
  const view = renderHook(() =>
    useCampaignCharacters({
      campaignId: 'alpha' as Id<'campaign'>,
      organizationId: 'other',
    }),
  );
  expect(view.result.current.characters?.[0]).toMatchObject({
    active: false,
    ownerLastOperationId: 'owner-save',
    ownerName: 'Alice',
    owner: { userId: 'alice' as Id<'user'>, name: 'Alice', isMine: false },
    isOnRoster: true,
    href: '/characters/hero?from=%2Fcampaigns%2Falpha%2Fcharacters&organizationId=other',
  });
  expect(state.calls).toHaveBeenCalledWith('campaign', {
    campaignId: 'alpha',
    organizationId: 'other',
  });
});
