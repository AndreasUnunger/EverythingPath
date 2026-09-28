import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { ConvexError } from 'convex/values';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Doc } from '@convex/_generated/dataModel';
import type { CampaignWeek } from './use-campaign-week';
import type { CampaignHomeContentState } from './use-campaign-home-content';
import { CampaignHomeScreen } from './campaign-home-screen';

type Call = {
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
const calls: Record<string, Call[]> = {};
const session = vi.fn();
const list = vi.fn();
const refetch = vi.fn();
const params = vi.fn();
const navigate = vi.fn();
const weeks = new Map<string, CampaignWeek>();
const contents = new Map<string, CampaignHomeContentState>();

vi.mock('@convex/_generated/api', () => ({
  api: {
    campaign: {
      createCampaign: 'create',
      updateCampaignDescription: 'description',
      updateCampaignInGameDate: 'date',
    },
  },
}));
vi.mock('convex/react', () => ({
  useMutation: (name: string) => (args: Record<string, unknown>) =>
    new Promise((resolve, reject) => {
      (calls[name] ??= []).push({ args, resolve, reject });
    }),
}));
vi.mock('next/navigation', () => ({ useParams: () => params() }));
vi.mock('~/components/campaign-shell/session', () => ({
  useSession: () => session(),
}));
vi.mock('~/lib/sharedQueries', () => ({
  campaignQuery: (orgId: string | undefined, enabled: boolean) =>
    list(orgId, enabled),
}));
vi.mock('./use-campaign-week', () => ({
  useCampaignWeek: (id: string) => weeks.get(id) ?? { kind: 'loading' },
}));
vi.mock('./use-campaign-home-content', () => ({
  useCampaignHomeContent: (id: string) =>
    contents.get(id) ?? { kind: 'no_militia' },
}));
vi.mock('~/components/campaign-shell/navigation-guard', () => ({
  useNavigationGuard: () => ({ navigate }),
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
vi.mock('~/components/campaign-shell/shell-frame', () => ({
  SignIn: () => <button>Sign in</button>,
  OrganizationControl: () => <button>Organization</button>,
}));

const thursday = { id: 'org', name: 'Thursday table' };
const member = (organization = thursday) => ({ kind: 'member', organization });
const campaign = (id: string, patch: Partial<Doc<'campaign'>> = {}) =>
  ({
    _id: id,
    _creationTime: 0,
    name: id,
    ownerId: 'gm',
    organizationId: 'org',
    description: '',
    ...patch,
  }) as Doc<'campaign'>;
const ironfang = campaign('ironfang', {
  name: 'Ironfang Invasion',
  description: 'Book 2, Thursday group.\nThe Lastwall refugees regroup.',
  inGameDate: '2017-03-12',
});
const second = campaign('second', { name: 'Second Table' });
const wardens = campaign('wardens', { name: 'Wardens of Longshadow' });

function ready(campaigns: Doc<'campaign'>[]) {
  list.mockReturnValue({ data: { state: 'ready', campaigns }, refetch });
}
function show(campaignId?: string) {
  params.mockReturnValue(campaignId ? { campaignId } : {});
  return render(<CampaignHomeScreen />);
}
const rows = () => within(screen.getByRole('navigation', { name: 'Campaigns' }));
const selected = () =>
  rows()
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page');

beforeEach(() => {
  for (const key of Object.keys(calls)) delete calls[key];
  navigate.mockClear();
  refetch.mockClear();
  session.mockReturnValue(member());
  ready([ironfang, second, wardens]);
  weeks.clear();
  weeks.set('ironfang', { kind: 'week', week: 14 });
  weeks.set('second', { kind: 'failed' });
  weeks.set('wardens', { kind: 'not_set_up' });
  contents.clear();
  contents.set('ironfang', {
    kind: 'militia',
    summary: ['Rank 3', 'Secrecy'],
    continueWeek: {
      kind: 'ready',
      week: 14,
      phase: 'activity',
      href: '/campaigns/ironfang/week?phase=activity',
    },
    recent: { kind: 'ready', weeks: [] },
  });
});
afterEach(cleanup);

test('loading shows a layout-shaped skeleton and reads no list before the session settles', () => {
  session.mockReturnValue({ kind: 'resolving' });
  show();
  expect(screen.getByRole('status')).toHaveTextContent('Loading campaigns…');
  expect(list).toHaveBeenLastCalledWith(undefined, false);
});

test('signed-out, no organization, no access and failure are distinct states', () => {
  session.mockReturnValue({ kind: 'signed_out' });
  const view = show();
  expect(screen.getByRole('heading')).toHaveTextContent(
    'Sign in to see your campaigns.',
  );
  params.mockReturnValue({ campaignId: 'ironfang' });
  view.rerender(<CampaignHomeScreen />);
  expect(screen.getByRole('heading')).toHaveTextContent(
    'Sign in to open this campaign.',
  );
  expect(screen.queryByText('Ironfang Invasion')).toBeNull();

  session.mockReturnValue({ kind: 'no_organization' });
  view.rerender(<CampaignHomeScreen />);
  expect(screen.getByRole('heading')).toHaveTextContent(
    'Choose an organization to see its campaigns.',
  );

  session.mockReturnValue(member());
  list.mockReturnValue({ data: { state: 'no_access' }, refetch });
  view.rerender(<CampaignHomeScreen />);
  expect(screen.getByRole('heading')).toHaveTextContent(
    "You don't have access to this organization's campaigns.",
  );

  list.mockReturnValue({ error: new Error('down'), refetch });
  view.rerender(<CampaignHomeScreen />);
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Campaigns could not be loaded. Please try again.',
  );
  expect(screen.queryByText('No campaigns yet')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalledTimes(1);
});

test('the bare list selects the first campaign and labels each row from its own read', () => {
  show();
  expect(selected().map((link) => link.textContent)).toEqual([
    'Ironfang InvasionWeek 14Book 2, Thursday group.\nThe Lastwall refugees regroup.',
  ]);
  const links = rows().getAllByRole('link');
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    '/campaigns/ironfang',
    '/campaigns/second',
    '/campaigns/wardens',
  ]);
  expect(links[1]).toHaveTextContent('Week unavailable');
  expect(links[2]).toHaveTextContent('Not set up');
  weeks.set('second', { kind: 'loading' });
  cleanup();
  show();
  expect(rows().getAllByRole('link')[1]).toHaveTextContent('Loading week');
  expect(rows().getAllByRole('link')[1]).not.toHaveTextContent('Not set up');
});

test('the home header shows the full description and the Golarion date; the name is its heading', () => {
  show('ironfang');
  const home = screen.getByRole('region', { name: 'Ironfang Invasion' });
  expect(within(home).getByText(/Book 2, Thursday group\./)).toHaveTextContent(
    'Book 2, Thursday group. The Lastwall refugees regroup.',
  );
  expect(home).toHaveTextContent('12 Pharast 4717');
  expect(
    within(home).getByRole('link', { name: 'Continue week 14' }),
  ).toHaveAttribute('href', '/campaigns/ironfang/week?phase=activity');
  expect(
    within(home).queryByRole('link', { name: 'Set up militia' }),
  ).toBeNull();
  // No date recorded is an ordinary empty value.
  cleanup();
  show('wardens');
  const other = screen.getByRole('region', { name: 'Wardens of Longshadow' });
  expect(other).not.toHaveTextContent(/Pharast|Abadius/);
  expect(
    within(other).getByRole('link', { name: 'Set up militia' }),
  ).toHaveAttribute('href', '/campaigns/wardens/setup');
});

test('an explicit unavailable id never falls back to another campaign', () => {
  show('foreign');
  expect(selected()).toEqual([]);
  expect(
    screen.getByRole('heading', {
      name: "This campaign isn't available in Thursday table.",
    }),
  ).toBeVisible();
  expect(screen.queryByRole('region', { name: 'Ironfang Invasion' })).toBeNull();
});

test('an empty organization offers the create form without a fake row', () => {
  ready([]);
  show();
  expect(screen.getByText('No campaigns yet')).toBeVisible();
  expect(
    screen.getByRole('heading', { name: 'Create a campaign to get started.' }),
  ).toBeVisible();
  expect(rows().queryAllByRole('link')).toEqual([]);
  fireEvent.change(screen.getByRole('textbox', { name: 'Campaign name' }), {
    target: { value: 'Draft' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByRole('textbox', { name: 'Campaign name' })).toHaveValue('');
  expect(
    screen.getByRole('heading', { name: 'Create a campaign to get started.' }),
  ).toBeVisible();
});

async function submitCreate(name: string, description = '') {
  fireEvent.change(screen.getByRole('textbox', { name: 'Campaign name' }), {
    target: { value: name },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), {
    target: { value: description },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  });
}

test('create validates the name in the form, never with a browser popup', async () => {
  show('second');
  fireEvent.click(screen.getByRole('button', { name: 'New campaign' }));
  expect(rows().getByText('New campaign')).toBeVisible();
  expect(selected()).toEqual([]);
  const form = screen.getByRole('button', { name: 'Create' }).closest('form')!;
  expect(form).toHaveAttribute('novalidate');
  await submitCreate('');
  expect(screen.getByText('Enter a name.')).toBeVisible();
  await submitCreate('A');
  expect(screen.getByText('Name must be at least 2 characters.')).toBeVisible();
  await submitCreate('x'.repeat(51));
  expect(screen.getByText('Name must be 50 characters or fewer.')).toBeVisible();
  expect(calls.create).toBeUndefined();
  // Cancel returns to the previous selection.
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(selected()[0]).toHaveAttribute('href', '/campaigns/second');
});

test('create sends once, then opens the returned id even with a duplicate name', async () => {
  const view = show('second');
  fireEvent.click(screen.getByRole('button', { name: 'New campaign' }));
  await submitCreate('Second Table', 'Line one\nLine two');
  expect(calls.create?.map((call) => call.args)).toEqual([
    {
      name: 'Second Table',
      description: 'Line one\nLine two',
      organizationId: 'org',
    },
  ]);
  expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: 'Creating…' }).closest('form')!);
  });
  expect(calls.create).toHaveLength(1);

  await act(async () => calls.create![0]!.resolve('created'));
  expect(navigate).toHaveBeenCalledWith('/campaigns/created');
  expect(screen.getByText('Opening Second Table…')).toBeVisible();
  // The address arrives before the list has observed the new campaign.
  params.mockReturnValue({ campaignId: 'created' });
  view.rerender(<CampaignHomeScreen />);
  expect(screen.getByText('Opening Second Table…')).toBeVisible();
  expect(screen.queryByText(/isn't available/)).toBeNull();
  const created = campaign('created', { name: 'Second Table' });
  weeks.set('created', { kind: 'not_set_up' });
  ready([ironfang, second, wardens, created]);
  view.rerender(<CampaignHomeScreen />);
  expect(selected()[0]).toHaveAttribute('href', '/campaigns/created');
  const home = screen.getByRole('region', { name: 'Second Table' });
  expect(
    within(home).getByRole('link', { name: 'Set up militia' }),
  ).toHaveAttribute('href', '/campaigns/created/setup');
  expect(screen.getByText('Created Second Table.')).toBeVisible();
});

test('a refused create keeps the entries; an unconfirmed one is not retried', async () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: 'New campaign' }));
  await submitCreate('Night Watch', 'Notes');
  await act(async () =>
    calls.create![0]!.reject(
      new ConvexError(
        'Campaign editing is paused for maintenance. Please try again later.',
      ),
    ),
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    "The campaign wasn't created: Campaign editing is paused for maintenance. Please try again later. Your entries are kept.",
  );
  expect(screen.getByRole('textbox', { name: 'Campaign name' })).toHaveValue(
    'Night Watch',
  );
  expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue(
    'Notes',
  );
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  });
  await act(async () =>
    calls.create![1]!.reject(new Error('ConvexClient has already been closed.')),
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    "We couldn't confirm whether the campaign was created.",
  );
  expect(calls.create).toHaveLength(2);
  expect(navigate).not.toHaveBeenCalled();
});

test('editing saves only the changed field and reports a partial save truthfully', async () => {
  const view = show('ironfang');
  fireEvent.click(screen.getByRole('button', { name: 'Edit campaign details' }));
  const description = screen.getByRole('textbox', { name: 'Description' });
  expect(description).toHaveFocus();
  expect(description).toHaveValue(
    'Book 2, Thursday group.\nThe Lastwall refugees regroup.',
  );
  // Cancel before submission writes nothing.
  fireEvent.change(description, { target: { value: 'Discarded' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(calls.description).toBeUndefined();
  expect(screen.getByRole('button', { name: 'Edit campaign details' })).toHaveFocus();

  fireEvent.click(screen.getByRole('button', { name: 'Edit campaign details' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), {
    target: { value: '' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Clear date' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(calls.description?.map((call) => call.args)).toEqual([
    { campaignId: 'ironfang', organizationId: 'org', description: '' },
  ]);
  expect(calls.date?.map((call) => call.args)).toEqual([
    { campaignId: 'ironfang', organizationId: 'org' },
  ]);
  expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  await act(async () => {
    calls.description![0]!.resolve({ ...ironfang, description: '' });
    calls.date![0]!.reject(new ConvexError('No campaign exists for this organization'));
  });
  ready([{ ...ironfang, description: '' }, second, wardens]);
  view.rerender(<CampaignHomeScreen />);
  expect(screen.getByText('Description saved.')).toBeVisible();
  expect(
    screen.getByText(
      "In-game date wasn't saved: No campaign exists for this organization. Your date is kept. Save to try again.",
    ),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(calls.description).toHaveLength(1);
  expect(calls.date).toHaveLength(2);
});

test('a remote edit refreshes the header without moving the selection', () => {
  const view = show('second');
  ready([{ ...ironfang, description: 'Changed by the GM.' }, second, wardens]);
  view.rerender(<CampaignHomeScreen />);
  expect(selected()[0]).toHaveAttribute('href', '/campaigns/second');
  cleanup();
  const other = show('ironfang');
  ready([{ ...ironfang, description: 'Changed again.' }, second, wardens]);
  other.rerender(<CampaignHomeScreen />);
  const home = screen.getByRole('region', { name: 'Ironfang Invasion' });
  expect(home).toHaveTextContent('Changed again.');
  expect(home).toHaveTextContent('Campaign details were updated.');
});

test('changing organization drops every local form and name from the old scope', () => {
  const view = show();
  fireEvent.click(screen.getByRole('button', { name: 'New campaign' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Campaign name' }), {
    target: { value: 'Half typed' },
  });
  session.mockReturnValue(member({ id: 'other', name: 'Other table' }));
  list.mockReturnValue({ data: undefined, refetch });
  view.rerender(<CampaignHomeScreen />);
  expect(screen.queryByText('Ironfang Invasion')).toBeNull();
  expect(list).toHaveBeenLastCalledWith('other', true);
  ready([campaign('theirs', { name: 'Their campaign' })]);
  view.rerender(<CampaignHomeScreen />);
  expect(screen.queryByDisplayValue('Half typed')).toBeNull();
  expect(screen.queryByText('Ironfang Invasion')).toBeNull();
  expect(selected()[0]).toHaveTextContent('Their campaign');
});
