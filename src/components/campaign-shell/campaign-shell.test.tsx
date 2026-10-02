import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Children, isValidElement, type ReactNode } from 'react';
import { CampaignShell } from './campaign-shell';
import { PhoneStatusStrip } from './shell-slots';
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
const openUserProfile = vi.fn();
const signOut = vi.fn();
let avatarPending = false;
let clerkStatus: 'loading' | 'ready' | 'degraded' | 'error' = 'ready';

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => auth(),
  useOrganization: () => organization(),
  useClerk: () => ({
    status: clerkStatus,
    openCreateOrganization,
    openOrganizationProfile,
    openUserProfile,
    signOut,
  }),
  useUser: () => ({
    isLoaded: true,
    user: {
      fullName: 'Andreas',
      primaryEmailAddress: { emailAddress: 'andreas@example.com' },
    },
  }),
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
  // Clerk shows `fallback` until it has rendered the avatar button.
  UserButton: ({ fallback }: { fallback?: ReactNode }) =>
    avatarPending ? fallback : <button>Account</button>,
}));
const convex = {};
vi.mock('convex/react', () => ({
  useConvex: () => convex,
  useConvexAuth: () => convexAuth(),
  Authenticated: ({ children }: { children: ReactNode }) =>
    convexAuth().isAuthenticated ? children : null,
  Unauthenticated: ({ children }: { children: ReactNode }) =>
    !convexAuth().isLoading && !convexAuth().isAuthenticated ? children : null,
  AuthLoading: ({ children }: { children: ReactNode }) =>
    convexAuth().isLoading ? children : null,
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: cutover() }),
}));
vi.mock('~/components/weekly-draft-workspace/gateway', () => ({
  createConvexWorkspaceGateway: (...args: unknown[]) => gateway(...args),
}));
vi.mock('~/lib/sharedQueries', () => ({
  useCampaignQuery: (...args: unknown[]) => campaigns(...args),
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
      const { 'aria-label': label, title } = isValidElement<{
        'aria-label'?: string;
        title?: string;
      }>(trigger)
        ? trigger.props
        : {};
      return (
        <select
          aria-label={label}
          title={title}
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

afterEach(() => {
  vi.unstubAllGlobals();
  avatarPending = false;
});

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
  clerkStatus = 'ready';
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

test('the account slot keeps its placeholder until Clerk has rendered the avatar', () => {
  avatarPending = true;
  render(shell('alpha'));
  expect(screen.getByText('Page for Alpha')).toBeVisible();
  expect(screen.getByRole('status', { name: 'Loading account' })).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Account' }),
  ).not.toBeInTheDocument();
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
  // A truncated name stays readable in full.
  expect(switcher).toHaveAttribute('title', 'Alpha');
  for (const control of screen.getAllByRole('combobox', {
    name: 'Organization',
  }))
    expect(control).toHaveAttribute('title', 'Thursday table');
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

test('a session that could not start shows one failure with a page reload as its retry', () => {
  // A failed Clerk load: its status is 'error' and auth stays unloaded.
  clerkStatus = 'error';
  auth.mockReturnValue({ isLoaded: false });
  organization.mockReturnValue({ isLoaded: false });
  convexAuth.mockReturnValue({ isLoading: true, isAuthenticated: false });
  campaigns.mockReturnValue({});
  const reload = vi.fn();
  vi.stubGlobal('location', { ...window.location, reload });
  render(shell('alpha'));
  expect(screen.getByRole('alert')).toHaveTextContent(
    'The campaign could not be loaded. Check your connection and try again.',
  );
  expect(screen.queryByText('Loading campaign…')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('heading', { name: /isn't available/ }),
  ).not.toBeInTheDocument();
  expect(
    within(screen.getByRole('main')).queryByRole('button', { name: 'Sign in' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/Page for/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(reload).toHaveBeenCalledTimes(1);
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

test('More opens a sheet with stacked organization and account controls and closes once a choice commits', async () => {
  render(shell('alpha'));
  const more = screen.getByRole('button', { name: 'More' });
  expect(more).toHaveAttribute('aria-haspopup', 'dialog');
  fireEvent.click(more);
  const sheet = await screen.findByRole('dialog', { name: 'More' });
  const organization = within(sheet).getByRole('group', {
    name: 'Organization',
  });
  expect(
    within(organization).getByRole('combobox', { name: 'Organization' }),
  ).toBeVisible();
  expect(
    within(organization).getByRole('button', { name: 'New organization' }),
  ).toBeVisible();
  const account = within(sheet).getByRole('group', { name: 'Account' });
  expect(within(account).getByText('Andreas')).toBeVisible();
  expect(
    within(account).getByRole('button', { name: 'Manage account' }),
  ).toBeVisible();
  expect(
    within(account).getByRole('button', { name: 'Sign out' }),
  ).toBeVisible();
  // The stock avatar menu is not offered inside the sheet; it is in the top bar.
  expect(
    within(account).queryByRole('button', { name: 'Account' }),
  ).not.toBeInTheDocument();
  fireEvent.change(
    within(organization).getByRole('combobox', { name: 'Organization' }),
    { target: { value: 'other' } },
  );
  await waitFor(() => expect(setActive).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'More' }),
    ).not.toBeInTheDocument(),
  );
});

test('phone account actions open Clerk account management and sign out through the guard, closing More on commit', async () => {
  signOut.mockResolvedValue(undefined);
  render(shell('alpha'));
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  const sheet = await screen.findByRole('dialog', { name: 'More' });
  fireEvent.click(
    within(sheet).getByRole('button', { name: 'Manage account' }),
  );
  expect(openUserProfile).toHaveBeenCalledTimes(1);
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'More' }),
    ).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  const reopened = await screen.findByRole('dialog', { name: 'More' });
  fireEvent.click(within(reopened).getByRole('button', { name: 'Sign out' }));
  await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  expect(signOut).toHaveBeenLastCalledWith({ redirectUrl: '/campaigns' });
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'More' }),
    ).not.toBeInTheDocument(),
  );
});

test('pending work turns phone sign-out into the departure decision: Stay keeps More and the session, Leave signs out once', async () => {
  signOut.mockResolvedValue(undefined);
  const fixture = onWeekWithFixture();
  render(shell('alpha', <Editor />));
  const release = fixture.hold();
  fireEvent.click(await screen.findByRole('button', { name: 'Edit week 4' }));
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  const sheet = await screen.findByRole('dialog', { name: 'More' });
  const out = within(sheet).getByRole('button', { name: 'Sign out' });
  fireEvent.click(out);
  const warning = screen.getByRole('dialog', {
    name: 'Changes are still saving',
  });
  fireEvent.click(within(warning).getByRole('button', { name: 'Stay' }));
  expect(signOut).not.toHaveBeenCalled();
  expect(openUserProfile).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: 'More' })).toBeInTheDocument();
  fireEvent.click(out);
  fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));
  await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'More' }),
    ).not.toBeInTheDocument(),
  );
  release();
});

test('a refused sign-out is reported after More has closed, and Try again repeats it once', async () => {
  signOut
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValue(undefined);
  render(shell('alpha'));
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  const sheet = await screen.findByRole('dialog', { name: 'More' });
  fireEvent.click(within(sheet).getByRole('button', { name: 'Sign out' }));
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'More' }),
    ).not.toBeInTheDocument(),
  );
  const failure = await screen.findByRole('dialog', {
    name: "That didn't finish",
  });
  expect(within(failure).getByRole('alert')).toHaveTextContent(
    'Sign-out could not be completed. You are still signed in.',
  );
  expect(screen.getByText('Page for Alpha')).toBeVisible();
  fireEvent.click(within(failure).getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(signOut).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: "That didn't finish" }),
    ).not.toBeInTheDocument(),
  );
});

test('Try again re-checks pending work: an edit held since the first sign-out attempt gets Stay/Leave before any retry', async () => {
  let reject: (error: Error) => void = () => undefined;
  signOut
    .mockImplementationOnce(
      () =>
        new Promise<void>((_, fail) => {
          reject = fail;
        }),
    )
    .mockResolvedValue(undefined);
  const fixture = onWeekWithFixture();
  render(shell('alpha', <Editor />));
  await screen.findByRole('button', { name: 'Edit week 4' });
  // No pending work: sign-out starts at once and More closes.
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  const sheet = await screen.findByRole('dialog', { name: 'More' });
  fireEvent.click(within(sheet).getByRole('button', { name: 'Sign out' }));
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'More' }),
    ).not.toBeInTheDocument(),
  );
  expect(signOut).toHaveBeenCalledTimes(1);
  // The page is still editable; a save is held while sign-out is in flight.
  const release = fixture.hold();
  fireEvent.click(screen.getByRole('button', { name: 'Edit week 4' }));
  reject(new Error('network'));
  const failure = await screen.findByRole('dialog', {
    name: "That didn't finish",
  });
  fireEvent.click(within(failure).getByRole('button', { name: 'Try again' }));
  expect(
    screen.getByRole('dialog', { name: 'Changes are still saving' }),
  ).toBeVisible();
  expect(signOut).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByText('Feedback: pending')).toBeVisible();
  // Retrying again while still pending offers the same decision; Leave runs once.
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  fireEvent.click(
    within(await screen.findByRole('dialog', { name: 'More' })).getByRole(
      'button',
      { name: 'Sign out' },
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));
  await waitFor(() => expect(signOut).toHaveBeenCalledTimes(2));
  release();
  await screen.findByText('Feedback: saved');
  expect(signOut).toHaveBeenCalledTimes(2);
});

test('a refused sign-out after Leave anyway is reported and can be dismissed', async () => {
  signOut.mockRejectedValue(new Error('network'));
  const fixture = onWeekWithFixture();
  render(shell('alpha', <Editor />));
  const release = fixture.hold();
  fireEvent.click(await screen.findByRole('button', { name: 'Edit week 4' }));
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  const sheet = await screen.findByRole('dialog', { name: 'More' });
  fireEvent.click(within(sheet).getByRole('button', { name: 'Sign out' }));
  fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));
  const failure = await screen.findByRole('dialog', {
    name: "That didn't finish",
  });
  expect(signOut).toHaveBeenCalledTimes(1);
  fireEvent.click(within(failure).getByRole('button', { name: 'Dismiss' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  // The guard is usable again after a failed Leave.
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  fireEvent.click(
    within(await screen.findByRole('dialog', { name: 'More' })).getByRole(
      'button',
      { name: 'Sign out' },
    ),
  );
  expect(
    screen.getByRole('dialog', { name: 'Changes are still saving' }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
  expect(signOut).toHaveBeenCalledTimes(1);
  release();
});

test('More stays open while the departure decision is pending and closes on Leave', async () => {
  const fixture = onWeekWithFixture();
  render(shell('alpha', <Editor />));
  const release = fixture.hold();
  fireEvent.click(await screen.findByRole('button', { name: 'Edit week 4' }));
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  const sheet = await screen.findByRole('dialog', { name: 'More' });
  fireEvent.click(
    within(sheet).getByRole('button', { name: 'New organization' }),
  );
  const warning = screen.getByRole('dialog', {
    name: 'Changes are still saving',
  });
  fireEvent.click(within(warning).getByRole('button', { name: 'Stay' }));
  expect(openCreateOrganization).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: 'More' })).toBeInTheDocument();
  fireEvent.click(
    within(sheet).getByRole('button', { name: 'New organization' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));
  await waitFor(() => expect(openCreateOrganization).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'More' }),
    ).not.toBeInTheDocument(),
  );
  release();
});

// The Week frame later fills this position; the shell only reserves it.
function StripPage() {
  return (
    <>
      <p>Week page</p>
      <PhoneStatusStrip>
        <span>Training 3 → 4</span>
      </PhoneStatusStrip>
    </>
  );
}

test('the week page can fill the phone status strip above the bottom bar; the top bar reserves no status position', () => {
  pathname.mockReturnValue('/campaigns/alpha/week');
  render(shell('alpha', <StripPage />));
  const strip = screen.getByText('Training 3 → 4');
  const bar = strip.closest('[data-shell-slot="phone-status-strip"]');
  expect(bar).not.toBeNull();
  // The strip host sits directly before the phone tabs, inside the sticky bar.
  const tabs = bar!.parentElement!.querySelector('nav');
  expect(tabs).toHaveAccessibleName('Campaign sections');
  expect(bar!.nextElementSibling).toBe(tabs);
  // The top-bar save status was removed (2026-09-28, amending #137).
  expect(
    document.querySelector('[data-shell-slot="top-bar-status"]'),
  ).toBeNull();
});

test('only the week route gets the bounded desktop host; other sections keep document scrolling', () => {
  pathname.mockReturnValue('/campaigns/alpha/week');
  const view = render(shell('alpha'));
  expect(document.querySelector('[data-week-host]')).not.toBeNull();
  pathname.mockReturnValue('/campaigns/alpha/militia');
  view.rerender(shell('alpha'));
  expect(document.querySelector('[data-week-host]')).toBeNull();
});

test('the phone bottom bar reserves its measured height as document scroll padding, follows resizes, and clears it once hidden or gone', () => {
  // jsdom has no ResizeObserver and no layout: stand in for both so the
  // bar can report a height, grow with its strip and collapse to hidden.
  const observed: { target: Element; notify: () => void }[] = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: () => void) {}
      observe(target: Element) {
        observed.push({ target, notify: this.callback });
      }
      disconnect() {
        observed.length = 0;
      }
    },
  );
  let height = 0;
  const view = render(shell('alpha'));
  const bar = document.querySelector(
    '[data-shell-slot="phone-status-strip"]',
  )!.parentElement!;
  Object.defineProperty(bar, 'offsetHeight', { get: () => height });
  expect(observed.map((entry) => entry.target)).toEqual([bar]);
  const resize = (to: number) => {
    height = to;
    for (const entry of observed) entry.notify();
  };
  const root = document.documentElement.style;
  resize(49);
  expect(root.scrollPaddingBottom).toBe('65px');
  resize(120);
  expect(root.scrollPaddingBottom).toBe('136px');
  resize(0);
  expect(root.scrollPaddingBottom).toBe('');
  resize(49);
  expect(root.scrollPaddingBottom).toBe('65px');
  view.unmount();
  expect(root.scrollPaddingBottom).toBe('');
  expect(observed).toHaveLength(0);
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
