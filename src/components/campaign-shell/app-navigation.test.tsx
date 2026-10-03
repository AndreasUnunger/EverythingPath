import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { buildAppNavigation } from '~/lib/app-navigation';
import { AppMilitiaRail } from './app-militia-rail';
import { AppPageStrip } from './app-page-strip';
import { AppPhoneBar } from './app-phone-bar';
import { AppTopBar } from './app-top-bar';

const navigate = vi.fn();

vi.mock('./navigation-guard', () => ({
  GuardedLink: ({ children, ...props }: React.ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
  BeforeDeparture: ({ children }: { children: React.ReactNode }) => children,
  useNavigationGuard: () => ({ navigate: (href: string) => navigate(href) }),
}));
vi.mock('./shell-slots', () => ({ ShellSlotHost: () => null }));
vi.mock('./shell-frame', () => ({
  AccountControl: () => <button>Account</button>,
  OrganizationControl: () => <button>Choose organization</button>,
}));
vi.mock('./account-actions', () => ({
  AccountActions: () => <button>Sign out</button>,
}));
vi.mock('./scroll-padding', () => ({ useScrollPaddingFor: () => undefined }));
vi.mock('~/components/ui/select', async () =>
  (await import('./shell-test-helpers')).selectModule(),
);

afterEach(() => {
  vi.unstubAllGlobals();
});

const kingmaker = { id: 'c1', name: 'Kingmaker', hasMilitia: true };
const runelords = {
  id: 'c2',
  name: 'Rise of the Runelords',
  hasMilitia: false,
};

function stubViewport(wide: boolean) {
  vi.stubGlobal('matchMedia', () => ({
    matches: wide,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

test('phone navigation keeps four areas and explains an absent militia', () => {
  const nav = buildAppNavigation({
    pathname: '/campaigns/c2',
    campaigns: [runelords],
  });
  render(<AppPhoneBar nav={nav} />);
  const areas = screen.getByRole('navigation', { name: 'Areas' });
  expect(within(areas).getByRole('link', { name: 'Campaign' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(
    within(areas).getByRole('link', { name: 'Characters' }),
  ).toHaveAttribute('href', '/characters');
  // Dimmed, not disabled: the tap opens the explanation.
  const militia = within(areas).getByRole('button', { name: 'Militia' });
  expect(militia).toHaveAttribute('aria-disabled', 'true');
  expect(militia).toHaveAttribute('aria-haspopup', 'dialog');
  expect(militia).not.toBeDisabled();
  expect(within(areas).getByRole('button', { name: 'More' })).toHaveAttribute(
    'aria-haspopup',
    'dialog',
  );
  fireEvent.click(militia);
  const explanation = screen.getByRole('dialog', { name: 'No militia' });
  expect(explanation).toHaveTextContent('This campaign has no militia.');
  expect(
    within(explanation).getByRole('link', { name: 'Switch campaign' }),
  ).toHaveAttribute('href', '/campaigns');
});

const militiaPages = buildAppNavigation({
  pathname: '/campaigns/c1/week',
  campaigns: [kingmaker],
  week: 12,
}).militiaPages;

test.each([
  { wide: false, label: 'tablet' },
  { wide: true, label: 'desktop' },
])(
  'the rail names its pages at every width and the $label toggle reverses the presentation',
  ({ wide }) => {
    stubViewport(wide);
    render(<AppMilitiaRail links={militiaPages} />);
    const rail = screen.getByRole('complementary', { name: 'Militia' });
    const pages = within(rail).getByRole('navigation', {
      name: 'Militia pages',
    });
    const toggle = within(rail).getByRole('button', {
      name: 'Militia navigation',
    });
    expect(toggle).toHaveAttribute('aria-expanded', String(wide));
    expect(toggle).toHaveAttribute('aria-controls', pages.id);
    const names = within(pages)
      .getAllByRole('link')
      .map((link) => link.getAttribute('aria-label'));
    expect(names).toEqual([
      'Week 12',
      'Finished weeks',
      'Militia',
      'Characters & officers',
      'Setup',
    ]);
    expect(pages.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(
      within(pages).getByRole('link', { name: 'Week 12' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(pages).getByRole('link', { name: 'Characters & officers' }),
    ).toHaveAttribute('href', '/campaigns/c1/officers');
    // Expanded, the open week is tagged; collapsed, each label is the
    // decorative hover/focus text beside its icon.
    const week = within(pages).getByRole('link', { name: 'Week 12' });
    const tagged = () => within(week).queryByText('current') !== null;
    const decorativeLabel = () =>
      within(week).getByText('Week 12').getAttribute('aria-hidden') === 'true';
    expect(tagged()).toBe(wide);
    expect(decorativeLabel()).toBe(!wide);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', String(!wide));
    expect(tagged()).toBe(!wide);
    expect(decorativeLabel()).toBe(wide);
  },
);

test('the top bar names the place, lights one section and offers the areas and campaigns', () => {
  const nav = buildAppNavigation({
    pathname: '/campaigns/c1/characters',
    campaigns: [kingmaker, runelords],
    campaign: kingmaker,
  });
  render(<AppTopBar nav={nav} />);
  const place = screen.getByRole('combobox', { name: 'Where you are' });
  expect(place).toHaveValue('c1');
  expect(place).toHaveAttribute('title', 'Kingmaker');
  expect(
    Array.from(place.querySelectorAll('option')).map(
      (option) => option.textContent,
    ),
  ).toEqual(['Campaigns', 'Characters', 'Kingmaker', 'Rise of the Runelords']);
  const sections = screen.getByRole('navigation', { name: 'Sections' });
  expect(
    within(sections)
      .getAllByRole('link')
      .map((link) => link.textContent),
  ).toEqual(['Home', 'Characters', 'Militia']);
  expect(sections.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  expect(
    within(sections).getByRole('link', { name: 'Characters' }),
  ).toHaveAttribute('aria-current', 'page');
  fireEvent.change(place, { target: { value: 'c2' } });
  expect(navigate).toHaveBeenLastCalledWith('/campaigns/c2');
  fireEvent.change(place, { target: { value: '__characters' } });
  expect(navigate).toHaveBeenLastCalledWith('/characters');
});

test.each([
  { pathname: '/characters', searchParams: '', place: '__characters' },
  {
    pathname: '/characters/hero',
    searchParams: 'from=%2Fcampaigns',
    place: '__campaigns',
  },
])(
  'outside a campaign the place picker follows the area ($place)',
  ({ pathname, searchParams, place }) => {
    const nav = buildAppNavigation({ pathname, searchParams, campaigns: [] });
    render(<AppTopBar nav={nav} />);
    expect(screen.getByRole('combobox', { name: 'Where you are' })).toHaveValue(
      place,
    );
    expect(
      screen.queryByRole('navigation', { name: 'Pages' }),
    ).not.toBeInTheDocument();
  },
);

test('sheet phone navigation preserves its militia origin page and shows one active area', () => {
  const sheetModel = buildAppNavigation({
    pathname: '/characters/hero',
    searchParams: 'from=%2Fcampaigns%2Fc1%2Fofficers',
    campaigns: [kingmaker],
    week: 12,
  });
  render(
    <>
      <AppPageStrip links={sheetModel.pageStrip} />
      <AppPhoneBar nav={sheetModel} />
    </>,
  );
  const pages = screen.getByRole('navigation', { name: 'Pages' });
  expect(
    within(pages).getByRole('link', { name: 'Characters & officers' }),
  ).toHaveAttribute('aria-current', 'page');
  expect(pages.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  const areas = screen.getByRole('navigation', { name: 'Areas' });
  expect(within(areas).getByRole('link', { name: 'Militia' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(
    within(areas).getByRole('link', { name: 'Characters' }),
  ).not.toHaveAttribute('aria-current');
});
