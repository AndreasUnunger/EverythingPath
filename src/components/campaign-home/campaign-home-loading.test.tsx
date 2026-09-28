import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import RouteLoading from '~/app/campaigns/loading';
import { CampaignHomeSkeleton } from './campaign-home-status';

afterEach(cleanup);

test('[STATE-02.route-loading] the campaigns route fallback is the list/home-shaped skeleton with Loading campaigns… for screen readers', () => {
  const home = render(<CampaignHomeSkeleton />).container.innerHTML;
  cleanup();
  const { container } = render(<RouteLoading />);
  const status = screen.getByRole('status');
  expect(status).toHaveTextContent('Loading campaigns…');
  expect(status).toHaveClass('sr-only');
  // Index rows beside the pane, exactly as the home screen shows while it
  // resolves, so nothing jumps when the route has loaded.
  expect(container.innerHTML).toContain(home);
  expect(
    container.querySelectorAll('[aria-hidden="true"] [data-slot="skeleton"]')
      .length,
  ).toBeGreaterThanOrEqual(3);
});
