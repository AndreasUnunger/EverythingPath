import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CampaignInfo, getStatColumnCount } from './campaignInfo';

afterEach(() => {
  cleanup();
});

describe('CampaignInfo', () => {
  it('renders the campaign in-game date when available alongside live militia values', () => {
    render(
      <CampaignInfo
        campaign={{
          name: 'Alpha',
          description: '',
          ownerId: 'owner',
          organizationId: 'org_1',
          inGameDate: new Date('2026-03-22T00:00:00.000Z').toISOString(),
        }}
        militia={{
          _id: 'militia_1' as never,
          name: 'Ironfang Resistance',
          campaignId: 'camp_1',
          rank: 3,
          highestBoonReached: 3,
          HQLocation: 'Longshadow',
          treasury: 250,
          notoriety: 12,
          focus: 'Secrecy',
          training: 18,
          ambassador: 'char_ambassador',
          marshal: 'char_marshal',
          spymaster: 'char_spymaster',
          teams: [],
        }}
        militiaStateSetup={{
          currentWeekState: {
            weekNumber: 6,
            phase: 'activity',
            isFirstWeek: false,
            skippedUpkeepThisWeek: false,
            uneventfulBonusCarry: 0,
            queuedEffects: [],
          },
          teamStates: [],
          caches: [],
          orders: [],
          trackedPeople: [],
          eventStates: [],
        }}
        marketplaceLedger={{
          currentWeek: 6,
          marketplaces: [
            {
              _id: 'market_1',
              label: 'South Gate Market',
              sourceAction: 'broker_market',
              teamId: 'merchants',
              availabilityTier: 'small_town',
              availabilityThreshold: 75,
              saleValuePercent: 50,
              contrabandAllowed: false,
              createdWeek: 5,
              activeUntilWeek: 6,
              isActive: true,
              pendingOrderCount: 1,
              orders: [],
            },
          ],
        }}
        characters={[
          {
            _id: 'char_ambassador' as never,
            name: 'Ilya',
            kind: 'pc',
            isActive: true,
            level: 5,
            strength: 10,
            dexterity: 10,
            constitution: 12,
            wisdom: 10,
            charisma: 16,
            intelligence: 10,
          },
          {
            _id: 'char_marshal' as never,
            name: 'Roth',
            kind: 'pc',
            isActive: true,
            level: 5,
            strength: 14,
            dexterity: 10,
            constitution: 10,
            wisdom: 12,
            charisma: 10,
            intelligence: 10,
          },
          {
            _id: 'char_spymaster' as never,
            name: 'Vexa',
            kind: 'pc',
            isActive: true,
            level: 5,
            strength: 10,
            dexterity: 14,
            constitution: 10,
            wisdom: 10,
            charisma: 10,
            intelligence: 18,
          },
        ]}
      />,
    );

    expect(screen.getByText('Sunday, 22 Pharast 4726')).toBeInTheDocument();
    expect(getCardValue('Loyalty')).toHaveTextContent('+4');
    expect(getCardValue('Security')).toHaveTextContent('+3');
    expect(getCardValue('Secrecy')).toHaveTextContent('+7');
    expect(getCardValue('Event Chance')).toHaveTextContent('12%');
    expect(getCardValue('Drill Militia DC')).toHaveTextContent('13');
    expect(screen.getByText('250 gp')).toBeInTheDocument();
    expect(screen.getByText('30 gp')).toBeInTheDocument();
    expect(screen.getByText('South Gate Market')).toBeInTheDocument();
    expect(screen.getByText(/Active in week 6/)).toBeInTheDocument();
    expect(
      screen.getByText(/Through week 6 • Pending deliveries: 1/),
    ).toBeInTheDocument();
  });

  it('falls back to live militia week context when the campaign date is not set', () => {
    render(
      <CampaignInfo
        campaign={{
          name: 'Alpha',
          description: '',
          ownerId: 'owner',
          organizationId: 'org_1',
        }}
        militia={{
          _id: 'militia_1' as never,
          name: 'Ironfang Resistance',
          campaignId: 'camp_1',
          rank: 8,
          highestBoonReached: 8,
          HQLocation: 'Southern Fangwood',
          treasury: 1220,
          notoriety: 6,
          focus: 'Secrecy',
          training: 82,
          teams: [],
        }}
        militiaStateSetup={{
          currentWeekState: {
            weekNumber: 14,
            phase: 'activity',
            isFirstWeek: false,
            skippedUpkeepThisWeek: false,
            uneventfulBonusCarry: 0,
            queuedEffects: [],
          },
          teamStates: [],
          caches: [],
          orders: [],
          trackedPeople: [],
          eventStates: [],
        }}
        marketplaceLedger={{
          currentWeek: 14,
          marketplaces: [],
        }}
        characters={[]}
      />,
    );

    expect(screen.getByText('Week 14 • Activity')).toBeInTheDocument();
    expect(screen.getAllByText('Secrecy').length).toBeGreaterThan(0);
    expect(getCardValue('Loyalty')).toHaveTextContent('+2');
    expect(getCardValue('Secrecy')).toHaveTextContent('+6');
    expect(getCardValue('Event Chance')).toHaveTextContent('10%');
    expect(getCardValue('Drill Militia DC')).toHaveTextContent('18');
    expect(screen.getByText('1220 gp')).toBeInTheDocument();
    expect(screen.getByText('80 gp')).toBeInTheDocument();
  });

  it('falls back to campaign date when militia week context is unavailable', () => {
    render(
      <CampaignInfo
        campaign={{
          name: 'Alpha',
          description: '',
          ownerId: 'owner',
          organizationId: 'org_1',
          inGameDate: new Date('2026-03-22T00:00:00.000Z').toISOString(),
        }}
        militia={undefined}
        marketplaceLedger={{
          currentWeek: undefined,
          marketplaces: [],
        }}
      />,
    );

    expect(screen.getByText(/Sunday, 22 Pharast 4726/)).toBeInTheDocument();
  });
});

describe('getStatColumnCount', () => {
  it('fits five cards on one large-screen row after the narrower card sizing change', () => {
    expect(
      getStatColumnCount({
        containerWidth: 1280,
        cardCount: 14,
        minCardWidth: 248,
        maxCardWidth: 310,
      }),
    ).toBe(5);
  });

  it('adds a column when cards would grow past the 150% width cap', () => {
    expect(
      getStatColumnCount({
        containerWidth: 1000,
        cardCount: 14,
        minCardWidth: 272,
        maxCardWidth: 408,
      }),
    ).toBe(3);
    expect(
      getStatColumnCount({
        containerWidth: 1200,
        cardCount: 14,
        minCardWidth: 272,
        maxCardWidth: 408,
      }),
    ).toBe(3);
  });

  it('keeps fewer columns when another card would force widths below the minimum', () => {
    expect(
      getStatColumnCount({
        containerWidth: 500,
        cardCount: 14,
        minCardWidth: 272,
        maxCardWidth: 408,
      }),
    ).toBe(1);
    expect(
      getStatColumnCount({
        containerWidth: 2000,
        cardCount: 3,
        minCardWidth: 272,
        maxCardWidth: 408,
      }),
    ).toBe(3);
  });
});

function getCardValue(title: string) {
  const titleNode = screen
    .getAllByText(title)
    .find((node) => node.classList.contains('text-muted-foreground'));
  const card = titleNode?.closest('[data-slot="card"]') as HTMLElement | null;
  if (!card) {
    throw new Error(`Card not found for title: ${title}`);
  }
  return within(card).getByText((content, node) => {
    if (!node || node === titleNode) {
      return false;
    }
    return node.classList.contains('text-primary') && content.length > 0;
  });
}
