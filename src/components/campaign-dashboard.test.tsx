import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import { CampaignDashboard } from './campaign-dashboard';

const organization = vi.fn();
const campaigns = vi.fn();
const source = vi.fn();
const runtime = vi.fn<() => 'canonical' | 'paused' | undefined>();
vi.mock('convex/react', () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(ref) === 'cutover:status' ? runtime() : source(),
  useMutation: () => vi.fn(),
}));
vi.mock('@clerk/nextjs', () => ({ useOrganization: () => organization() }));
vi.mock('~/lib/sharedQueries', () => ({ campaignQuery: () => campaigns() }));
vi.mock('~/app/campaigns/createCampaignDialog', () => ({
  default: () => <button>Create campaign</button>,
}));
vi.mock('./weekly-draft-workspace/board', () => ({
  CanonicalWorkspaceScreen: ({ campaign }: { campaign: string }) => (
    <p>Militia week: {campaign}</p>
  ),
}));

afterEach(cleanup);

beforeEach(() => {
  runtime.mockReturnValue('canonical');
  source.mockReturnValue(null);
  organization.mockReturnValue({ organization: { id: 'org' }, isLoaded: true });
  campaigns.mockReturnValue({ data: { state: 'ready', campaigns: [] } });
});
test('waits for runtime and organization context', () => {
  runtime.mockReturnValue(undefined);
  const view = render(<CampaignDashboard />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading campaigns');
  runtime.mockReturnValue('canonical');
  organization.mockReturnValue({ isLoaded: false });
  view.rerender(<CampaignDashboard />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading campaigns');
});
test('maintenance hides the board until canonical editing resumes', () => {
  runtime.mockReturnValue('paused');
  const view = render(<CampaignDashboard />);
  expect(screen.getByRole('status')).toHaveTextContent(
    'paused for maintenance',
  );
  runtime.mockReturnValue('canonical');
  view.rerender(<CampaignDashboard />);
  expect(screen.getByText('Create a campaign to get started.')).toBeVisible();
});
test('shows organization selection and failed campaign loading', () => {
  organization.mockReturnValue({ isLoaded: true });
  const view = render(<CampaignDashboard />);
  expect(
    screen.getByText('Select an organization with campaign access.'),
  ).toBeVisible();
  campaigns.mockReturnValue({ error: new Error('Unavailable') });
  view.rerender(<CampaignDashboard />);
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Campaigns could not be loaded',
  );
});
test('opens the first campaign through the canonical Workspace', () => {
  campaigns.mockReturnValue({
    data: { state: 'ready', campaigns: [{ _id: 'alpha', name: 'Alpha' }] },
  });
  render(<CampaignDashboard />);
  expect(screen.getByText('Militia week: alpha')).toBeVisible();
});

test('ledger waits for campaign source before exposing character controls', () => {
  campaigns.mockReturnValue({
    data: { state: 'ready', campaigns: [{ _id: 'alpha', name: 'Alpha' }] },
  });
  source.mockReturnValue(undefined);
  render(<CampaignDashboard />);
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Ledger' }), {
    button: 0,
    ctrlKey: false,
  });
  expect(screen.getByRole('status')).toHaveTextContent(
    'Loading militia ledger',
  );
  expect(
    screen.queryByRole('button', { name: 'Add Character' }),
  ).not.toBeInTheDocument();
});
