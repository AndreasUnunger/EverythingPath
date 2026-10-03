import { fireEvent, render, screen, within } from '@testing-library/react';
import { OrganizationSwitchNotice } from './organization-switch-notice';
import { expect, test, vi } from 'vitest';
import { CampaignCharactersView } from './campaign-characters-view';
import { CharactersListLoading } from './characters-list-loading';
import { OwnedCharactersView } from './owned-characters-view';

vi.mock('~/components/campaign-shell/navigation-guard', () => ({
  GuardedLink: ({ children, ...props }: React.ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));

test('owned characters show No campaign before campaign and organization with accessible sheet links', () => {
  render(
    <OwnedCharactersView
      groups={[
        {
          key: 'none',
          title: 'No campaign',
          characters: [
            {
              id: 'private',
              name: 'Mira',
              level: 1,
              kind: 'PC',
              active: true,
              href: '/characters/private?from=%2Fcharacters',
            },
          ],
        },
        {
          key: 'kingmaker',
          title: 'Kingmaker',
          organizationName: 'Thursday table',
          characters: [
            {
              id: 'shared',
              name: 'Oren',
              level: 3,
              kind: 'NPC',
              active: false,
              href: '/characters/shared?from=%2Fcharacters',
            },
          ],
        },
      ]}
      newHref="/characters/new"
    />,
  );
  expect(
    screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent),
  ).toEqual(['No campaign', 'Kingmaker']);
  const group = screen.getByRole('region', { name: 'Kingmaker' });
  expect(group).toHaveTextContent('Thursday table');
  expect(group).toHaveTextContent('Archived');
  expect(within(group).getByRole('link', { name: /Oren/ })).toHaveAttribute(
    'href',
    '/characters/shared?from=%2Fcharacters',
  );
  expect(screen.getByRole('link', { name: 'New character' })).toHaveAttribute(
    'href',
    '/characters/new',
  );
});

test('empty and loading states announce what the player is waiting for', () => {
  const { rerender } = render(
    <OwnedCharactersView
      groups={[{ key: 'none', title: 'No campaign', characters: [] }]}
      newHref="/characters/new"
    />,
  );
  expect(screen.getByText('No characters yet.')).toBeVisible();
  rerender(<CharactersListLoading />);
  expect(
    screen.getByRole('status', { name: 'Loading characters' }),
  ).toBeInTheDocument();
});

test('campaign characters table every owner, active state and roster membership', () => {
  render(
    <CampaignCharactersView
      campaignName="Kingmaker"
      characters={[
        {
          id: '1',
          name: 'Alia',
          level: 3,
          kind: 'PC',
          active: true,
          href: '/characters/1',
          ownerName: 'Andreas',
          isOnRoster: true,
        },
        {
          id: '2',
          name: 'Borin',
          level: 2,
          kind: 'NPC',
          active: false,
          href: '/characters/2',
          ownerName: null,
          isOnRoster: false,
        },
      ]}
      newHref="/characters/new"
    />,
  );
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Characters',
  );
  expect(
    screen.getByText('Everyone in Kingmaker can edit these.'),
  ).toBeVisible();
  expect(
    screen.getAllByRole('columnheader').map((header) => header.textContent),
  ).toEqual(['Name', 'Owner', 'Level', 'Status', 'Roster']);
  const alia = screen.getByRole('link', { name: 'Alia' }).closest('tr')!;
  expect(screen.getByRole('link', { name: 'Alia' })).toHaveAttribute(
    'href',
    '/characters/1',
  );
  expect(alia).toHaveTextContent('Andreas');
  expect(alia).toHaveTextContent('On roster');
  expect(alia).toHaveTextContent('Active');
  const borin = screen.getByRole('link', { name: 'Borin' }).closest('tr')!;
  expect(borin).toHaveTextContent('Unassigned owner');
  expect(borin).toHaveTextContent('Archived');
  expect(borin).toHaveTextContent('Not on roster');
});

test('an empty campaign says so under its title', () => {
  render(
    <CampaignCharactersView
      campaignName="Kingmaker"
      characters={[]}
      newHref="/characters/new"
    />,
  );
  expect(screen.getByText('No characters in this campaign yet.')).toBeVisible();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

test('a campaign Character without a destination keeps its plain name and row information', () => {
  render(
    <CampaignCharactersView
      campaignName="Kingmaker"
      characters={[
        {
          id: 'legacy',
          name: 'Legacy hero',
          level: 3,
          kind: 'PC',
          active: false,
          ownerName: 'Alice',
          isOnRoster: false,
        },
      ]}
    />,
  );
  const name = screen.getByText('Legacy hero');
  expect(name).toBeVisible();
  expect(name.closest('a')).toBeNull();
  const row = name.closest('tr')!;
  expect(row).toHaveTextContent('Alice');
  expect(row).toHaveTextContent('Archived');
  expect(row).toHaveTextContent('Not on roster');
  expect(
    screen.queryByRole('link', { name: 'New character' }),
  ).not.toBeInTheDocument();
});

test('owned Characters omit creation when no creation destination is available', () => {
  render(
    <OwnedCharactersView
      groups={[{ key: 'none', title: 'No campaign', characters: [] }]}
    />,
  );
  expect(
    screen.getByRole('heading', { name: 'Characters', level: 1 }),
  ).toBeVisible();
  expect(
    screen.queryByRole('link', { name: 'New character' }),
  ).not.toBeInTheDocument();
});

test.each([
  '/campaigns/kingmaker/officers',
  '/characters/prepared?from=%2Fcampaigns%2Fkingmaker%2Fcharacters',
])('campaign Characters retain their supplied destination %s', (href) => {
  render(
    <CampaignCharactersView
      campaignName="Kingmaker"
      characters={[
        {
          id: 'hero',
          name: 'Hero',
          level: 3,
          kind: 'PC',
          active: true,
          href,
          ownerName: 'Alice',
          isOnRoster: true,
        },
      ]}
    />,
  );
  expect(screen.getByRole('link', { name: 'Hero' })).toHaveAttribute(
    'href',
    href,
  );
});

test('an organization change announces progress and lets the player retry a failure', () => {
  const retry = vi.fn();
  const { rerender } = render(
    <OrganizationSwitchNotice status={{ kind: 'switching', retry }} />,
  );
  expect(screen.getByRole('status')).toHaveTextContent(
    'Changing organization…',
  );
  rerender(<OrganizationSwitchNotice status={{ kind: 'failed', retry }} />);
  const failure = screen.getByRole('alert');
  expect(failure).toHaveTextContent('The organization could not be changed.');
  fireEvent.click(within(failure).getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalledTimes(1);
  rerender(<OrganizationSwitchNotice status={{ kind: 'idle', retry }} />);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
