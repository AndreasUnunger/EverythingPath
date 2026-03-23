import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignInfo } from './campaignInfo';

describe('CampaignInfo', () => {
  it('renders live militia values and active marketplace visibility', () => {
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
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('250 gp')).toBeInTheDocument();
    expect(screen.getByText('30 gp')).toBeInTheDocument();
    expect(screen.getByText('South Gate Market')).toBeInTheDocument();
    expect(screen.getByText(/Active in week 6/)).toBeInTheDocument();
    expect(
      screen.getByText(/Through week 6 • Pending deliveries: 1/),
    ).toBeInTheDocument();
  });
});
