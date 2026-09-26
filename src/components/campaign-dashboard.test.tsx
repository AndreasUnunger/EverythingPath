import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CampaignDashboard } from './campaign-dashboard';

const organization = vi.fn();
const campaigns = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/campaigns',
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
vi.mock('@clerk/nextjs', () => ({ useOrganization: () => organization() }));
vi.mock('~/lib/sharedQueries', () => ({ campaignQuery: () => campaigns() }));
vi.mock('~/app/campaigns/createCampaignDialog', () => ({
  default: () => <button>Create campaign</button>,
}));
vi.mock('./campaign-selector', () => ({
  default: ({
    campaigns: items,
    selectedCampaign,
    setSelectedCampaign,
  }: {
    campaigns: { _id: string; name: string }[] | undefined;
    selectedCampaign: string | undefined;
    setSelectedCampaign: (value: string) => void;
  }) => (
    <select
      aria-label="Active campaign"
      value={selectedCampaign}
      onChange={(event) => setSelectedCampaign(event.target.value)}
    >
      {items?.map((item) => (
        <option key={item._id} value={item._id}>
          {item.name}
        </option>
      ))}
    </select>
  ),
}));

afterEach(cleanup);

beforeEach(() => {
  organization.mockReturnValue({ organization: { id: 'org' }, isLoaded: true });
  campaigns.mockReturnValue({ data: { state: 'ready', campaigns: [] } });
});
test('waits for organization context', () => {
  organization.mockReturnValue({ isLoaded: false });
  render(<CampaignDashboard />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading campaigns');
});
test('shows organization selection and a page-local retry for failed campaign loading', () => {
  organization.mockReturnValue({ isLoaded: true });
  const view = render(<CampaignDashboard />);
  expect(
    screen.getByText('Select an organization with campaign access.'),
  ).toBeVisible();
  const refetch = vi.fn();
  campaigns.mockReturnValue({ error: new Error('Unavailable'), refetch });
  view.rerender(<CampaignDashboard />);
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Campaigns could not be loaded.',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalledTimes(1);
});
test('the empty organization keeps the create entry', () => {
  render(<CampaignDashboard />);
  expect(screen.getByText('Create a campaign to get started.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Create campaign' })).toBeVisible();
});
test('selects the first campaign by default and links to its screens instead of embedding the week', () => {
  campaigns.mockReturnValue({
    data: {
      state: 'ready',
      campaigns: [
        { _id: 'alpha', name: 'Alpha' },
        { _id: 'beta', name: 'Beta' },
      ],
    },
  });
  render(<CampaignDashboard />);
  expect(screen.getByRole('combobox', { name: 'Active campaign' })).toHaveValue(
    'alpha',
  );
  expect(screen.getByRole('link', { name: 'Open week' })).toHaveAttribute(
    'href',
    '/campaigns/alpha/week',
  );
  expect(screen.getByRole('link', { name: 'Finished weeks' })).toHaveAttribute(
    'href',
    '/campaigns/alpha/history',
  );
  expect(screen.getByRole('link', { name: 'Militia' })).toHaveAttribute(
    'href',
    '/campaigns/alpha/militia',
  );
  expect(
    screen.getByRole('link', { name: 'Characters & officers' }),
  ).toHaveAttribute('href', '/campaigns/alpha/characters');
  expect(screen.getByRole('link', { name: 'Set up militia' })).toHaveAttribute(
    'href',
    '/campaigns/alpha/setup',
  );
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  expect(screen.queryByText(/Militia week/)).not.toBeInTheDocument();
});
test('choosing another campaign opens its own address', () => {
  campaigns.mockReturnValue({
    data: {
      state: 'ready',
      campaigns: [
        { _id: 'alpha', name: 'Alpha' },
        { _id: 'beta', name: 'Beta' },
      ],
    },
  });
  render(<CampaignDashboard />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Active campaign' }), {
    target: { value: 'beta' },
  });
  expect(push).toHaveBeenLastCalledWith('/campaigns/beta');
});
