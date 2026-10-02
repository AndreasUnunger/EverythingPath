import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import IndependentCharacterError from '~/app/characters/error';
import IndependentCharactersLayout from '~/app/characters/layout';

// The independent Characters route (#260): a sheet outside every campaign
// and organization, in a shell with only the Keep and the account.

const auth = vi.fn();
const convexAuth = vi.fn();
const resetQueries = vi.fn();

vi.mock('@clerk/nextjs', async () => {
  const { clerkModule, organizationList } =
    await import('~/components/campaign-shell/shell-test-helpers');
  return clerkModule({
    auth: () => auth(),
    organization: () => ({ isLoaded: true }),
    clerk: () => ({ status: 'ready' }),
    organizations: () => organizationList({ organizations: [] }),
  });
});
vi.mock('convex/react', async () =>
  (
    await import('~/components/campaign-shell/shell-test-helpers')
  ).convexReactModule(() => convexAuth()),
);
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({
    kind: 'ready',
    readOnly: false,
    message: '',
  }),
}));
vi.mock('next/navigation', async () =>
  (
    await import('~/components/campaign-shell/shell-test-helpers')
  ).navigationModule({ pathname: () => '/characters/character-1' }),
);
vi.mock('next/link', async () =>
  (await import('~/components/campaign-shell/shell-test-helpers')).linkModule(),
);
vi.mock('@tanstack/react-query', () => ({
  useQueryErrorResetBoundary: () => ({ reset: resetQueries }),
}));

beforeEach(() => {
  auth.mockReturnValue({ isLoaded: true, isSignedIn: true });
  convexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true });
});

function renderLayout() {
  return render(
    <IndependentCharactersLayout>
      <main>
        <h1>Private hero</h1>
      </main>
    </IndependentCharactersLayout>,
  );
}
function keepLink() {
  return screen.getByRole('link', { name: 'Keep: all campaigns' });
}
function backLink() {
  return screen.getByRole('link', { name: 'Campaigns' });
}

test('while the session loads, the loading sheet sits under a top bar without any organization', () => {
  convexAuth.mockReturnValue({ isLoading: true, isAuthenticated: false });
  renderLayout();
  expect(
    screen.getByRole('status', { name: 'Loading character sheet…' }),
  ).toBeInTheDocument();
  expect(keepLink()).toHaveAttribute('href', '/campaigns');
  expect(backLink()).toHaveAttribute('href', '/campaigns');
  expect(screen.queryByText('Private hero')).not.toBeInTheDocument();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('status', { name: /Loading organizations/ }),
  ).not.toBeInTheDocument();
});

test('signed out, nothing of the character is shown and sign-in is offered with Back to Campaigns', () => {
  auth.mockReturnValue({ isLoaded: true, isSignedIn: false });
  convexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false });
  renderLayout();
  expect(screen.getByText('Sign in to open this character.')).toBeVisible();
  expect(
    screen.getAllByRole('button', { name: 'Sign in' }).length,
  ).toBeGreaterThan(0);
  expect(screen.queryByText('Private hero')).not.toBeInTheDocument();
  expect(backLink()).toHaveAttribute('href', '/campaigns');
  expect(
    within(screen.getByRole('contentinfo')).getByRole('link', {
      name: 'Legal notices',
    }),
  ).toHaveAttribute('href', '/legal');
});

test('signed in, the page renders inside the shell and its links take keyboard focus', () => {
  renderLayout();
  expect(screen.getByRole('heading', { name: 'Private hero' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Account' })).toBeVisible();
  expect(
    screen.queryByRole('status', { name: 'Loading character sheet…' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Sign in' }),
  ).not.toBeInTheDocument();
  keepLink().focus();
  expect(keepLink()).toHaveFocus();
  expect(screen.getByRole('banner')).toContainElement(keepLink());
});

test('a missing character and an inaccessible one read the same: a generic failure with Try again', () => {
  const reset = vi.fn();
  render(<IndependentCharacterError reset={reset} />);
  const failure = screen.getByRole('alert');
  expect(failure).toHaveTextContent('The character sheet could not be loaded.');
  expect(failure).not.toHaveTextContent(/not found|access|permission|owner/i);
  expect(backLink()).toHaveAttribute('href', '/campaigns');
  fireEvent.click(within(failure).getByRole('button', { name: 'Try again' }));
  expect(resetQueries).toHaveBeenCalledTimes(1);
  expect(reset).toHaveBeenCalledTimes(1);
});
