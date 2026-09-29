import { fireEvent, render, screen } from '@testing-library/react';
import { Component, type ComponentProps, type ReactNode } from 'react';
import { expect, test, vi } from 'vitest';
import MilitiaRoute from '~/app/campaigns/[campaignId]/militia/page';
import CampaignPageError from '~/app/campaigns/[campaignId]/error';

// The Militia page inside its campaign route: a failed read throws to the
// route's error boundary, which shows the shell's shared failure card for
// this page only, and Try again renders the page again.

let workspace: () => unknown = () => undefined;
vi.mock('@convex/_generated/api', () => ({
  api: {
    canonicalDraftPersistence: { workspace: 'workspace', observe: 'observe' },
    canonicalLedger: { read: 'read', save: 'save' },
  },
}));
vi.mock('convex/react', () => ({
  useQuery: (name: string, args: unknown) =>
    args === 'skip' || name !== 'workspace' ? undefined : workspace(),
  useMutation: () => () => Promise.resolve(),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/campaigns/campaign/militia',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('~/components/campaign-shell/campaign-context', () => ({
  useCampaign: () => ({
    campaign: { _id: 'campaign', name: 'Ironfang' },
    organizationId: 'org',
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

// Next's segment error boundary: the route's error component replaces the
// page, and its reset renders the page again.
class SegmentErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <CampaignPageError reset={() => this.setState({ failed: false })} />
    ) : (
      this.props.children
    );
  }
}

test('[LEDG-10.failure] a failed militia read shows The militia could not be loaded. with Try again, which loads the page again', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  workspace = () => {
    throw new Error('[CONVEX Q(canonicalDraftPersistence:workspace)] failed');
  };
  render(
    <SegmentErrorBoundary>
      <MilitiaRoute />
    </SegmentErrorBoundary>,
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    'The militia could not be loaded.',
  );
  expect(screen.queryByText(/CONVEX/)).toBeNull();
  // The read succeeds on the retry: this campaign has no militia yet.
  workspace = () => null;
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('heading', { name: 'Militia' })).toBeVisible();
  expect(screen.getByText('No militia yet.')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Set up militia' })).toHaveAttribute(
    'href',
    '/campaigns/campaign/setup',
  );
});
