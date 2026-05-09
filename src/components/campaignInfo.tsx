'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BicepsFlexed,
  Calendar,
  ChartNoAxesCombined,
  Coins,
  Dumbbell,
  Eye,
  Flame,
  HandCoins,
  Heart,
  MapPin,
  Percent,
  Shield,
  Target,
} from 'lucide-react';
import type { Doc, Id } from '@convex/_generated/dataModel';
import type { WithoutSystemFields } from 'convex/server';
import { formatFantasyDate } from '~/helpers/ARDateConverter';
import type {
  IMarketplaceLedgerState,
  IMilitia,
  IMilitiaStateSetup,
} from '~/lib/types';
import {
  getOrganizationCheckBonusesForMilitia,
  getMinimumTrainingForRank,
  getMinimumTreasuryForRank,
} from '~/lib/militia-progression-rules';
import {
  formatMarketplaceAvailabilityTier,
  formatMarketplaceSourceAction,
} from '~/lib/militia-marketplace-rules';
import {
  formatFocusLabel,
  formatWeekPhaseLabel,
} from '~/lib/militia-state-options';
import { buildOfficerEffects } from '~/components/week-board/officer-effects';
import { Card } from './ui/card';
import { CampaignInfoCard } from './ui/campaignInfoCard';

type CampaignInfoCharacter = Pick<
  Doc<'character'>,
  | '_id'
  | 'name'
  | 'kind'
  | 'level'
  | 'strength'
  | 'dexterity'
  | 'constitution'
  | 'intelligence'
  | 'wisdom'
  | 'charisma'
  | 'isActive'
>;

const STAT_CARD_MIN_WIDTH_REM = 15.5;
const STAT_CARD_MAX_WIDTH_RATIO = 1.25;
const STAT_CARD_COUNT = 14;

export function CampaignInfo({
  campaign,
  militia,
  militiaStateSetup,
  marketplaceLedger,
  characters,
}: {
  campaign: WithoutSystemFields<Doc<'campaign'>> | undefined;
  militia?: IMilitia | null;
  militiaStateSetup?: IMilitiaStateSetup;
  marketplaceLedger?: IMarketplaceLedgerState;
  characters?: CampaignInfoCharacter[];
}) {
  const statsContainerRef = useRef<HTMLDivElement | null>(null);
  const [statColumns, setStatColumns] = useState(1);

  if (!campaign) {
    return null;
  }

  const marketplaces = marketplaceLedger?.marketplaces ?? [];
  const campaignDate = campaign.inGameDate
    ? formatFantasyDate(new Date(campaign.inGameDate))
    : undefined;
  const weekStateLabel = militiaStateSetup
    ? `Week ${militiaStateSetup.currentWeekState.weekNumber} • ${formatWeekPhaseLabel(militiaStateSetup.currentWeekState.phase)}`
    : undefined;
  const headlineDate = campaignDate ?? weekStateLabel ?? '';
  const nextRankTraining = militia
    ? getMinimumTrainingForRank(militia.rank + 1)
    : undefined;
  const minimumTreasury = militia
    ? getMinimumTreasuryForRank(militia.rank)
    : undefined;
  const activeMarketplaces = marketplaces.filter(
    (marketplace) => marketplace.isActive,
  );
  const inactiveMarketplacesCount =
    marketplaces.length - activeMarketplaces.length;
  const hasTrackedMarketplaces = marketplaces.length > 0;
  const currentWeek = marketplaceLedger?.currentWeek;
  const marketplaceSubtitle =
    activeMarketplaces.length > 0
      ? `Active in week ${currentWeek ?? 'now'}`
      : `No active marketplaces${currentWeek ? ` in week ${currentWeek}` : ''}`;
  const baseCheckBonuses = militia
    ? getOrganizationCheckBonusesForMilitia({
        rank: militia.rank,
        focus: militia.focus,
      })
    : undefined;
  const officerEffects = militia
    ? buildOfficerEffects({
        focus: militia.focus,
        rank: militia.rank,
        characters:
          (characters ?? []).map((character) => ({
            _id: character._id,
            name: character.name,
            kind: character.kind ?? 'pc',
            level: character.level,
            strength: character.strength,
            dexterity: character.dexterity,
            constitution: character.constitution,
            intelligence: character.intelligence,
            wisdom: character.wisdom,
            charisma: character.charisma,
          })) ?? [],
        baseAssignments: {
          ambassador: militia.ambassador as Id<'character'> | undefined,
          commandant: militia.commandant as Id<'character'> | undefined,
          marshal: militia.marshal as Id<'character'> | undefined,
          overseer: militia.overseer as Id<'character'> | undefined,
          spymaster: militia.spymaster as Id<'character'> | undefined,
          strategist: militia.strategist as Id<'character'> | undefined,
        },
        slots: [],
        activityOfficerOperations: {
          changes: [],
        },
      })
    : undefined;
  const loyaltyBonus =
    baseCheckBonuses && officerEffects
      ? baseCheckBonuses.loyalty + officerEffects.loyaltyBonus
      : undefined;
  const secrecyBonus =
    baseCheckBonuses && officerEffects
      ? baseCheckBonuses.secrecy + officerEffects.secrecyBonus
      : undefined;
  const securityBonus =
    baseCheckBonuses && officerEffects
      ? baseCheckBonuses.security + officerEffects.securityBonus
      : undefined;
  const eventChance =
    militia && militiaStateSetup
      ? clampPercent(
          militia.notoriety + militiaStateSetup.currentWeekState.uneventfulBonusCarry,
        )
      : militia
        ? clampPercent(militia.notoriety)
        : undefined;
  const drillMilitiaDc = militia ? 10 + militia.rank : undefined;

  useEffect(() => {
    const container = statsContainerRef.current;
    if (!container) {
      return;
    }

    const updateColumns = () => {
      const rootFontSize = Number.parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );
      const minCardWidth = STAT_CARD_MIN_WIDTH_REM * rootFontSize;
      const maxCardWidth = minCardWidth * STAT_CARD_MAX_WIDTH_RATIO;
      const nextColumns = getStatColumnCount({
        containerWidth: container.clientWidth,
        cardCount: STAT_CARD_COUNT,
        minCardWidth,
        maxCardWidth,
      });
      setStatColumns((currentColumns) =>
        currentColumns === nextColumns ? currentColumns : nextColumns,
      );
    };

    updateColumns();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateColumns);
      return () => {
        window.removeEventListener('resize', updateColumns);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      updateColumns();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="space-y-2 pb-4">
      <div
        ref={statsContainerRef}
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${statColumns}, minmax(0, 1fr))`,
        }}
      >
        <CampaignInfoCard title="Date" value={headlineDate}>
          <Calendar className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard title="Rank" value={militia?.rank ?? '—'}>
          <ChartNoAxesCombined className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard title="Training" value={militia?.training ?? '—'}>
          <BicepsFlexed className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard
          title="Next rank at Training"
          value={nextRankTraining ?? 'Max'}
        >
          <Dumbbell className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard
          title="HQ Location"
          value={militia?.HQLocation ?? '—'}
        >
          <MapPin className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard
          title="Focus"
          value={formatFocusLabel(militia?.focus)}
        >
          <Target className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard
          title="Loyalty"
          value={loyaltyBonus !== undefined ? formatSignedBonus(loyaltyBonus) : '—'}
        >
          <Heart className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard
          title="Secrecy"
          value={secrecyBonus !== undefined ? formatSignedBonus(secrecyBonus) : '—'}
        >
          <Eye className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard
          title="Security"
          value={securityBonus !== undefined ? formatSignedBonus(securityBonus) : '—'}
        >
          <Shield className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard
          title="Notoriety"
          value={militia?.notoriety ?? '—'}
        >
          <Flame className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard
          title="Treasury"
          value={militia ? `${militia.treasury} gp` : '—'}
        >
          <Coins className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard
          title="Minimum Treasury"
          value={minimumTreasury !== undefined ? `${minimumTreasury} gp` : '—'}
        >
          <HandCoins className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard
          title="Event Chance"
          value={eventChance !== undefined ? `${eventChance}%` : '—'}
        >
          <Percent className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard
          title="Drill Militia DC"
          value={drillMilitiaDc ?? '—'}
        >
          <Dumbbell className="h-4 w-4" />
        </CampaignInfoCard>

      </div>

      {hasTrackedMarketplaces ? (
        <Card className="bg-card border-2 p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-sans text-xl font-bold">
                  Tracked Marketplaces
                </h2>
                <p className="text-muted-foreground font-mono text-sm">
                  {marketplaceSubtitle}
                </p>
              </div>
              {inactiveMarketplacesCount > 0 ? (
                <p className="text-muted-foreground font-mono text-xs">
                  {inactiveMarketplacesCount} inactive still tracked in ledger
                </p>
              ) : null}
            </div>

            {activeMarketplaces.length > 0 ? (
              <div className="grid gap-2 md:grid-cols-2">
                {activeMarketplaces.map((marketplace) => (
                  <div
                    key={marketplace._id}
                    className="border-primary/40 bg-card border-2 p-2"
                  >
                    <p className="font-mono text-sm font-bold">
                      {marketplace.label}
                    </p>
                    <p className="text-muted-foreground font-mono text-xs">
                      {formatMarketplaceSourceAction(marketplace.sourceAction)}{' '}
                      •{' '}
                      {formatMarketplaceAvailabilityTier(
                        marketplace.availabilityTier,
                      )}{' '}
                      • {marketplace.teamId}
                    </p>
                    <p className="text-muted-foreground font-mono text-xs">
                      Through week {marketplace.activeUntilWeek} • Pending
                      deliveries: {marketplace.pendingOrderCount}
                      {marketplace.contrabandAllowed ? ' • Contraband' : ''}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function clampPercent(value: number) {
  return Math.max(10, Math.min(95, Math.floor(value)));
}

function formatSignedBonus(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}

export function getStatColumnCount({
  containerWidth,
  cardCount,
  minCardWidth,
  maxCardWidth,
}: {
  containerWidth: number;
  cardCount: number;
  minCardWidth: number;
  maxCardWidth: number;
}) {
  if (containerWidth <= 0 || cardCount <= 1) {
    return 1;
  }

  const maxColumnsAtMinimumWidth = Math.max(
    1,
    Math.floor(containerWidth / minCardWidth),
  );
  const maxUsableColumns = Math.min(cardCount, maxColumnsAtMinimumWidth);
  const minimumColumnsBeforeCardsGetTooWide = Math.max(
    1,
    Math.ceil(containerWidth / maxCardWidth),
  );

  return Math.min(maxUsableColumns, minimumColumnsBeforeCardsGetTooWide);
}
