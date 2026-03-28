import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CampaignInfo } from './campaignInfo';

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
      />,
    );

    expect(screen.getByText('Sunday, 22 Pharast 4726')).toBeInTheDocument();
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
      />,
    );

    expect(screen.getByText('Week 14 • Activity')).toBeInTheDocument();
    expect(screen.getAllByText('Secrecy').length).toBeGreaterThan(0);
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
