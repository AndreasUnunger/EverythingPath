import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Children, isValidElement, type ReactNode } from 'react';
import { CampaignShell } from './campaign-shell';
import { useCampaign } from './campaign-context';
import { useWeeklyDraftWorkspace } from '~/components/weekly-draft-workspace/use-weekly-draft-workspace';
import {
  upkeepRoll,
  workspaceFixture,
} from '~/components/weekly-draft-workspace/workspace-test-fixture';

const auth = vi.fn();
const organization = vi.fn();
const convexAuth = vi.fn();
const cutover = vi.fn();
const campaigns = vi.fn();
const pathname = vi.fn();
const push = vi.fn();
const setActive = vi.fn();
const gateway = vi.fn();
const openCreateOrganization = vi.fn();
const openOrganizationProfile = vi.fn();

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => auth(),
  useOrganization: () => organization(),
  useClerk: () => ({ openCreateOrganization, openOrganizationProfile }),
  useOrganizationList: () => ({
    isLoaded: true,
    setActive,
    userMemberships: {
      data: [
        { organization: { id: 'org', name: 'Thursday table' } },
        { organization: { id: 'other', name: 'Other table' } },
      ],
      hasNextPage: false,
      isFetching: false,
      fetchNext: vi.fn(),
    },
  }),
  SignInButton: ({ children }: { children: ReactNode }) => <>{children}</>,
  UserButton: () => <button>Account</button>,
}));
const convex = {};
vi.mock('convex/react', () => ({
  useConvex: () => convex,
  useConvexAuth: () => convexAuth(),
  useQuery: () => cutover(),
  Authenticated: ({ children }: { children: ReactNode }) =>
    convexAuth().isAuthenticated ? children : null,
  Unauthenticated: ({ children }: { children: ReactNode }) =>
    !convexAuth().isLoading && !convexAuth().isAuthenticated ? children : null,
  AuthLoading: ({ children }: { children: ReactNode }) =>
    convexAuth().isLoading ? children : null,
}));
vi.mock('~/components/weekly-draft-workspace/gateway', () => ({
  createConvexWorkspaceGateway: (...args: unknown[]) => gateway(...args),
}));
vi.mock('~/lib/sharedQueries', () => ({
  campaignQuery: (...args: unknown[]) => campaigns(...args),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => pathname(),
}));
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
// A native select that keeps the trigger's accessible name and its items.
vi.mock('~/components/ui/select', () => {
  const SelectTrigger = () => null;
  return {
    Select: ({
      value,
      onValueChange,
      disabled,
      children,
    }: {
      value?: string;
      onValueChange?: (value: string) => void;
      disabled?: boolean;
      children: ReactNode;
    }) => {
      const trigger = Children.toArray(children).find(
        (child) => isValidElement(child) && child.type === SelectTrigger,
      );
      const label = isValidElement<{ 'aria-label'?: string }>(trigger)
        ? trigger.props['aria-label']
        : undefined;
      return (
        <select
          aria-label={label}
          value={value}
          disabled={disabled}
          onChange={(event) => onValueChange?.(event.target.value)}
        >
          {children}
        </select>
      );
    },
    SelectTrigger,
    SelectValue: () => null,
    SelectSeparator: () => null,
    SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectItem: ({
      value,
      children,
    }: {
      value: string;
      children: ReactNode;
    }) => <option value={value}>{children}</option>,
  };
});

afterEach(cleanup);

const alpha = { _id: 'alpha', name: 'Alpha' };
const beta = { _id: 'beta', name: 'Beta' };
function member() {
  auth.mockReturnValue({ isLoaded: true, isSignedIn: true });
  organization.mockReturnValue({
    isLoaded: true,
    organization: { id: 'org', name: 'Thursday table' },
  });
  convexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true });
  cutover.mockReturnValue('canonical');
  campaigns.mockReturnValue({
    data: { state: 'ready', campaigns: [alpha, beta] },
    refetch: vi.fn(),
  });
  pathname.mockReturnValue('/campaigns/alpha/militia');
  setActive.mockResolvedValue(undefined);
}
beforeEach(member);

function Page() {
  const { campaign } = useCampaign();
  return <p>Page for {campaign.name}</p>;
}
function shell(campaignId: string, page: ReactNode = <Page />) {
  return <CampaignShell campaignId={campaignId}>{page}</CampaignShell>;
}
// A week page stand-in that edits through the shared Workspace.
function Editor() {
  const workspace = useWeeklyDraftWorkspace();
  if (workspace.status !== 'ready') return <p>Week not ready</p>;
  return (
    <>
      <button onClick={() => void workspace.edit(upkeepRoll('check', 10))}>
        Edit week {workspace.week}
      </button>
      <p>Feedback: {workspace.feedback}</p>
    </>
  );
}
function onWeekWithFixture() {
  const fixture = workspaceFixture();
  gateway.mockImplementation(() => fixture.gateway);
  pathname.mockReturnValue('/campaigns/alpha/week');
  return fixture;
}

test('renders the shell with skeletons while access resolves and mounts no page', () => {
  auth.mockReturnValue({ isLoaded: false });
  convexAuth.mockReturnValue({ isLoading: true, isAuthenticated: false });
  campaigns.mockReturnValue({});
  render(shell('alpha'));
  expect(
    screen.getByRole('link', { name: 'Keep: all campaigns' }),
  ).toBeVisible();
  expect(screen.getByRole('status', { name: 'Loading account' })).toBeVisible();
  expect(screen.getByText('Loading campaign…')).toBeInTheDocument();
  expect(screen.queryByText(/Page for/)).not.toBeInTheDocument();
  expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
});

test('signed out shows one neutral sign-in state without campaign details', () => {
  auth.mockReturnValue({ isLoaded: true, isSignedIn: false });
  convexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false });
  campaigns.mockReturnValue({});
  render(shell('alpha'));
  expect(
    screen.getByRole('heading', { name: 'Sign in to open this campaign.' }),
  ).toBeVisible();
  expect(
    screen.getAllByRole('button', { name: 'Sign in' }).length,
  ).toBeGreaterThan(0);
  expect(screen.queryByText(/Page for/)).not.toBeInTheDocument();
  expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
});

test('without an organization the chooser is offered and no organization name is invented', () => {
  organization.mockReturnValue({ isLoaded: true, organization: null });
  campaigns.mockReturnValue({});
  render(shell('alpha'));
  expect(
    screen.getByRole('heading', { name: "This campaign isn't available." }),
  ).toBeVisible();
  expect(
    screen.getAllByRole('combobox', { name: 'Organization' }).length,
  ).toBeGreaterThan(0);
  expect(
    screen.getByRole('link', { name: 'Back to campaigns' }),
  ).toHaveAttribute('href', '/campaigns');
  expect(screen.queryByText(/Page for/)).not.toBeInTheDocument();
});

test('an id outside the active organization is unavailable and never falls back to another campaign', () => {
  const view = render(shell('gamma'));
  expect(
    screen.getByRole('heading', {
      name: "This campaign isn't available in Thursday table.",
    }),
  ).toBeVisible();
  expect(screen.queryByText(/Page for/)).not.toBeInTheDocument();
  expect(
    screen.queryByRole('combobox', { name: 'Active campaign' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: 'Militia' }),
  ).not.toBeInTheDocument();
  campaigns.mockReturnValue({ data: { state: 'no_access' }, refetch: vi.fn() });
  view.rerender(shell('alpha'));
  expect(
    screen.getByRole('heading', {
      name: "This campaign isn't available in Thursday table.",
    }),
  ).toBeVisible();
  expect(screen.queryByText(/Page for/)).not.toBeInTheDocument();
});

test('a member campaign renders its page with the switcher, section links and the active section', () => {
  render(shell('alpha'));
  expect(screen.getByText('Page for Alpha')).toBeVisible();
  const switcher = screen.getByRole('combobox', { name: 'Active campaign' });
  expect(switcher).toHaveValue('alpha');
  expect(
    Array.from(switcher.querySelectorAll('option')).map(
      (option) => option.textContent,
    ),
  ).toEqual(['Alpha', 'Beta', 'All campaigns…']);
  const militia = screen.getAllByRole('link', { name: 'Militia' });
  expect(militia).toHaveLength(2);
  for (const link of militia) {
    expect(link).toHaveAttribute('href', '/campaigns/alpha/militia');
    expect(link).toHaveAttribute('aria-current', 'page');
  }
  expect(screen.getAllByRole('link', { name: 'Week' })[0]).toHaveAttribute(
    'href',
    '/campaigns/alpha/week',
  );
  expect(
    screen.getAllByRole('link', { name: 'Finished weeks' })[0],
  ).toHaveAttribute('href', '/campaigns/alpha/history');
  expect(
    screen.getAllByRole('link', { name: 'Characters & officers' })[0],
  ).not.toHaveAttribute('aria-current');
  expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  expect(gateway).not.toHaveBeenCalled();
  fireEvent.change(switcher, { target: { value: 'beta' } });
  expect(push).toHaveBeenLastCalledWith('/campaigns/beta');
  fireEvent.change(switcher, { target: { value: '__all' } });
  expect(push).toHaveBeenLastCalledWith('/campaigns');
});

test('a failed campaign list keeps the shell and offers a page-local retry', () => {
  const refetch = vi.fn();
  campaigns.mockReturnValue({ error: new Error('offline'), refetch });
  render(shell('alpha'));
  expect(screen.getByRole('alert')).toHaveTextContent(
    'The campaign could not be loaded.',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole('link', { name: 'Keep: all campaigns' }),
  ).toBeVisible();
});

test('maintenance shows a non-blocking banner while the page stays readable', () => {
  cutover.mockReturnValue('paused');
  render(shell('alpha'));
  expect(
    screen.getByText(
      'Campaign editing is paused for maintenance. Please try again shortly.',
    ),
  ).toBeVisible();
  expect(screen.getByText('Page for Alpha')).toBeVisible();
});

test('switching organization drops the old campaign before the new list resolves', () => {
  const view = render(shell('alpha'));
  expect(screen.getByText('Page for Alpha')).toBeVisible();
  organization.mockReturnValue({
    isLoaded: true,
    organization: { id: 'other', name: 'Other table' },
  });
  campaigns.mockReturnValue({});
  view.rerender(shell('alpha'));
  expect(screen.queryByText(/Alpha/)).not.toBeInTheDocument();
  expect(screen.getByText('Loading campaign…')).toBeInTheDocument();
  campaigns.mockReturnValue({
    data: { state: 'ready', campaigns: [beta] },
    refetch: vi.fn(),
  });
  view.rerender(shell('alpha'));
  expect(
    screen.getByRole('heading', {
      name: "This campaign isn't available in Other table.",
    }),
  ).toBeVisible();
});

test('on the Week route one shared owner feeds both the page and the Week link', async () => {
  onWeekWithFixture();
  render(shell('alpha', <Editor />));
  await screen.findByRole('button', { name: 'Edit week 4' });
  expect(screen.getAllByRole('link', { name: 'Week 4' })[0]).toHaveAttribute(
    'href',
    '/campaigns/alpha/week',
  );
  expect(gateway).toHaveBeenCalledTimes(1);
});

test('pending editor work turns a section link into a confirmation instead of leaving silently', async () => {
  const fixture = onWeekWithFixture();
  render(shell('alpha', <Editor />));
  const release = fixture.hold();
  fireEvent.click(await screen.findByRole('button', { name: 'Edit week 4' }));
  const [link] = screen.getAllByRole('link', { name: 'Finished weeks' });
  fireEvent.click(link!);
  expect(
    screen.getByRole('dialog', { name: 'Changes are still saving' }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
  expect(push).not.toHaveBeenCalled();
  fireEvent.click(link!);
  fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));
  expect(push).toHaveBeenCalledTimes(1);
  expect(push).toHaveBeenLastCalledWith('/campaigns/alpha/history');
  release();
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
});

test('changing organization waits for the departure decision before Clerk activates it', async () => {
  const fixture = onWeekWithFixture();
  render(shell('alpha', <Editor />));
  await screen.findByRole('button', { name: 'Edit week 4' });
  const [control] = screen.getAllByRole('combobox', { name: 'Organization' });
  expect(control).toHaveValue('org');
  fireEvent.change(control!, { target: { value: 'org' } });
  expect(setActive).not.toHaveBeenCalled();
  const release = fixture.hold();
  fireEvent.click(screen.getByRole('button', { name: 'Edit week 4' }));
  fireEvent.change(control!, { target: { value: 'other' } });
  expect(
    screen.getByRole('dialog', { name: 'Changes are still saving' }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
  expect(setActive).not.toHaveBeenCalled();
  expect(control).toHaveValue('org');
  fireEvent.change(control!, { target: { value: 'other' } });
  fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));
  await waitFor(() => expect(setActive).toHaveBeenCalledTimes(1));
  expect(setActive).toHaveBeenLastCalledWith({
    organization: 'other',
    redirectUrl: '/campaigns',
  });
  release();
  await waitFor(() => expect(control).not.toBeDisabled());
  fireEvent.change(control!, { target: { value: '__personal' } });
  await waitFor(() => expect(setActive).toHaveBeenCalledTimes(2));
  expect(setActive).toHaveBeenLastCalledWith({
    organization: null,
    redirectUrl: '/campaigns',
  });
});

test('organization creation and management stay reachable through Clerk, and creation is offered without an organization', () => {
  const view = render(shell('alpha'));
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Manage organization' })[0]!,
  );
  expect(openOrganizationProfile).toHaveBeenCalledTimes(1);
  fireEvent.click(
    screen.getAllByRole('button', { name: 'New organization' })[0]!,
  );
  expect(openCreateOrganization).toHaveBeenCalledTimes(1);
  expect(openCreateOrganization).toHaveBeenLastCalledWith({
    afterCreateOrganizationUrl: '/campaigns',
  });
  organization.mockReturnValue({ isLoaded: true, organization: null });
  campaigns.mockReturnValue({});
  view.rerender(shell('alpha'));
  expect(
    screen.getByRole('heading', { name: "This campaign isn't available." }),
  ).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Manage organization' }),
  ).not.toBeInTheDocument();
  // The top bar and the state card both offer creation without an organization.
  expect(
    screen.getAllByRole('button', { name: 'New organization' }),
  ).toHaveLength(2);
  fireEvent.click(
    screen.getAllByRole('button', { name: 'New organization' })[1]!,
  );
  expect(openCreateOrganization).toHaveBeenCalledTimes(2);
});

test('opening Clerk organization flows waits for the departure decision while work is pending', async () => {
  const fixture = onWeekWithFixture();
  render(shell('alpha', <Editor />));
  const release = fixture.hold();
  fireEvent.click(await screen.findByRole('button', { name: 'Edit week 4' }));
  const [create] = screen.getAllByRole('button', { name: 'New organization' });
  fireEvent.click(create!);
  expect(
    screen.getByRole('dialog', { name: 'Changes are still saving' }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
  expect(openCreateOrganization).not.toHaveBeenCalled();
  fireEvent.click(create!);
  fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));
  await waitFor(() => expect(openCreateOrganization).toHaveBeenCalledTimes(1));
  const [manage] = screen.getAllByRole('button', {
    name: 'Manage organization',
  });
  fireEvent.click(manage!);
  fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
  expect(openOrganizationProfile).not.toHaveBeenCalled();
  fireEvent.click(manage!);
  fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));
  await waitFor(() => expect(openOrganizationProfile).toHaveBeenCalledTimes(1));
  release();
  await screen.findByText('Feedback: saved');
  fireEvent.click(manage!);
  await waitFor(() => expect(openOrganizationProfile).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
