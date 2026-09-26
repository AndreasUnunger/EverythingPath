import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useEffect, type ReactNode } from 'react';
import { CampaignShell } from './campaign-shell';
import { useCampaign, useWeekLabel } from './campaign-context';
import { useNavigationGuard } from './navigation-guard';

const auth = vi.fn();
const organization = vi.fn();
const convexAuth = vi.fn();
const cutover = vi.fn();
const campaigns = vi.fn();
const pathname = vi.fn();
const push = vi.fn();

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => auth(),
  useOrganization: () => organization(),
  OrganizationSwitcher: () => <button>Organization switcher</button>,
  SignInButton: ({ children }: { children: ReactNode }) => <>{children}</>,
  UserButton: () => <button>Account</button>,
}));
vi.mock('convex/react', () => ({
  useConvexAuth: () => convexAuth(),
  useQuery: () => cutover(),
  Authenticated: ({ children }: { children: ReactNode }) =>
    convexAuth().isAuthenticated ? children : null,
  Unauthenticated: ({ children }: { children: ReactNode }) =>
    !convexAuth().isLoading && !convexAuth().isAuthenticated ? children : null,
  AuthLoading: ({ children }: { children: ReactNode }) =>
    convexAuth().isLoading ? children : null,
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
      aria-label="Active campaign"
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectSeparator: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

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
}
beforeEach(member);

function Page() {
  const { campaign } = useCampaign();
  return <p>Page for {campaign.name}</p>;
}
function shell(campaignId: string, page: ReactNode = <Page />) {
  return <CampaignShell campaignId={campaignId}>{page}</CampaignShell>;
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
    screen.getAllByRole('button', { name: 'Organization switcher' }).length,
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
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
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
    screen.getAllByRole('option').map((option) => option.textContent),
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

test('the Week link shows the number announced by the mounted week editor', () => {
  function WeekProbe() {
    const { setWeek } = useWeekLabel();
    useEffect(() => {
      setWeek(7);
      return () => setWeek(null);
    }, [setWeek]);
    return null;
  }
  render(shell('alpha', <WeekProbe />));
  expect(screen.getAllByRole('link', { name: 'Week 7' })[0]).toHaveAttribute(
    'href',
    '/campaigns/alpha/week',
  );
});

test('pending editor work turns a section link into a confirmation instead of leaving silently', () => {
  function PendingProbe() {
    const { setPending } = useNavigationGuard();
    useEffect(() => {
      setPending(true);
      return () => setPending(false);
    }, [setPending]);
    return null;
  }
  render(shell('alpha', <PendingProbe />));
  const [link] = screen.getAllByRole('link', { name: 'Finished weeks' });
  fireEvent.click(link!);
  expect(
    screen.getByRole('dialog', { name: 'Changes are still saving' }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
  expect(push).not.toHaveBeenCalledWith('/campaigns/alpha/history');
  fireEvent.click(link!);
  fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));
  expect(push).toHaveBeenLastCalledWith('/campaigns/alpha/history');
});
