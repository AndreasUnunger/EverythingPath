'use client';

import type { ReactNode } from 'react';
import { Card } from '~/components/ui/card';
import type {
  CacheLedgerEntry,
  MarketplaceLedgerEntry,
  OrderLedgerEntry,
  SettlementLedgerEntry,
  TrackedPersonLedgerEntry,
} from '~/components/week-board/activity-asset-operations';
import {
  formatMarketplaceAvailabilityTier,
  formatMarketplaceSourceAction,
} from '~/lib/militia-marketplace-rules';

export function AssetLedgerPanel({
  settlements,
  caches,
  marketplaces,
  orders,
  trackedPeople,
  stickyOnWide = true,
}: {
  settlements: SettlementLedgerEntry[];
  caches: CacheLedgerEntry[];
  marketplaces: MarketplaceLedgerEntry[];
  orders: OrderLedgerEntry[];
  trackedPeople: TrackedPersonLedgerEntry[];
  stickyOnWide?: boolean;
}) {
  const hasSettlements = settlements.length > 0;
  const hasCaches = caches.length > 0;
  const hasMarketplaces = marketplaces.length > 0;
  const hasOrders = orders.length > 0;
  const hasTrackedPeople = trackedPeople.length > 0;

  if (
    !hasSettlements &&
    !hasCaches &&
    !hasMarketplaces &&
    !hasOrders &&
    !hasTrackedPeople
  ) {
    return null;
  }

  return (
    <div
      className={stickyOnWide ? 'space-y-3 xl:sticky xl:top-4' : 'space-y-3'}
    >
      {hasSettlements ? (
        <LedgerSection
          title="Tracked Settlements"
          items={settlements.map((settlement) => (
            <LedgerRow
              key={settlement._id}
              title={settlement.settlementKey}
              lines={[
                `Reputation: ${settlement.reputation}`,
                `Secured: ${settlement.isSecured ? 'Yes' : 'No'}`,
                ...(settlement.temporaryShift
                  ? [
                      `Temporary reputation modifier: ${formatSignedNumber(settlement.temporaryShift)}`,
                    ]
                  : []),
                ...(settlement.refugeActiveUntilWeek
                  ? [
                      `Active refuge through week ${settlement.refugeActiveUntilWeek}`,
                    ]
                  : []),
              ]}
            />
          ))}
        />
      ) : null}

      {hasCaches ? (
        <LedgerSection
          title="Tracked Caches"
          items={caches.map((cache) => (
            <LedgerRow
              key={cache._id}
              title={cache.label}
              lines={[
                `${capitalize(cache.cacheClass)} cache in ${cache.location}`,
                `Status: ${cache.status.replace('_', ' ')}`,
                `Contents: ${cache.contentsSummary}`,
                `Secure location: ${cache.isSecureLocation ? 'Yes' : 'No'}`,
                ...(cache.retrievedWeek
                  ? [`Retrieved week ${cache.retrievedWeek}`]
                  : []),
                ...(cache.lostWeek ? [`Lost week ${cache.lostWeek}`] : []),
              ]}
            />
          ))}
        />
      ) : null}

      {hasMarketplaces ? (
        <LedgerSection
          title="Tracked Marketplaces"
          items={marketplaces.map((marketplace) => (
            <LedgerRow
              key={marketplace._id}
              title={marketplace.label}
              lines={[
                `Source: ${formatMarketplaceSourceAction(marketplace.sourceAction)}`,
                `Availability: ${formatMarketplaceAvailabilityTier(marketplace.availabilityTier)} (${marketplace.availabilityThreshold}% threshold)`,
                `Sale value: ${marketplace.saleValuePercent}%`,
                `Contraband sales: ${marketplace.contrabandAllowed ? 'Yes' : 'No'}`,
                `Active through week ${marketplace.activeUntilWeek}`,
                ...(marketplace.marketDayDiscountPercent
                  ? [
                      `Market Day discount: ${marketplace.marketDayDiscountPercent}% (week ${marketplace.marketDayAppliedWeek})`,
                    ]
                  : []),
                ...(marketplace.notes ? [`Notes: ${marketplace.notes}`] : []),
              ]}
            />
          ))}
        />
      ) : null}

      {hasOrders ? (
        <LedgerSection
          title="Tracked Orders"
          items={orders.map((order) => (
            <LedgerRow
              key={order._id}
              title={order.description}
              lines={[
                `Status: ${order.status}`,
                ...(order.costPaid !== undefined
                  ? [`Cost paid: ${order.costPaid} gp`]
                  : []),
                `Ordered week ${order.orderedWeek}, due week ${order.dueWeek}`,
                `Delivery time: ${order.deliveryDays} day(s)`,
                ...(order.sourceAction
                  ? [`Source: ${formatOrderSource(order.sourceAction)}`]
                  : []),
                ...(order.notes ? [`Notes: ${order.notes}`] : []),
                ...(order.deliveredWeek
                  ? [`Delivered week ${order.deliveredWeek}`]
                  : []),
              ]}
            />
          ))}
        />
      ) : null}

      {hasTrackedPeople ? (
        <LedgerSection
          title="Tracked People"
          items={trackedPeople.map((person) => (
            <LedgerRow
              key={person._id}
              title={person.displayName}
              lines={[
                `Status: ${person.status.replace('_', ' ')}`,
                `Type: ${person.personKind.replace('_', ' ')}`,
                ...(person.level !== undefined
                  ? [`Level: ${person.level}`]
                  : []),
                `Location: ${formatTrackedPersonLocation(person)}`,
                ...(person.rescueDcOverride !== undefined
                  ? [`Rescue DC override: ${person.rescueDcOverride}`]
                  : []),
                ...(person.notes ? [`Notes: ${person.notes}`] : []),
                ...(person.activeUntilWeek
                  ? [`Active through week ${person.activeUntilWeek}`]
                  : []),
              ]}
            />
          ))}
        />
      ) : null}
    </div>
  );
}

function LedgerSection({
  title,
  items,
}: {
  title: string;
  items: ReactNode[];
}) {
  return (
    <Card className="border p-3">
      <p className="mb-2 font-mono text-sm font-bold">{title}</p>
      <div className="space-y-2">{items}</div>
    </Card>
  );
}

function LedgerRow({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="border-primary/30 bg-primary/5 border p-2">
      <p className="font-mono text-xs font-bold">{title}</p>
      <div className="mt-1 space-y-1">
        {lines.map((line) => (
          <p key={line} className="text-muted-foreground font-mono text-xs">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

function formatSignedNumber(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatOrderSource(
  sourceAction: NonNullable<OrderLedgerEntry['sourceAction']>,
) {
  if (sourceAction === 'activate_black_market') {
    return 'Activate Black Market';
  }
  if (sourceAction === 'broker_market') {
    return 'Broker Market';
  }
  return 'Special Order';
}

function formatTrackedPersonLocation(person: TrackedPersonLedgerEntry) {
  if (person.locationType === 'site' && person.siteName) {
    return `Site: ${person.siteName}`;
  }
  if (
    (person.locationType === 'settlement' ||
      person.locationType === 'refuge') &&
    person.settlementKey
  ) {
    return `${capitalize(person.locationType)}: ${person.settlementKey}`;
  }
  if (person.locationType === 'hq') {
    return 'Headquarters';
  }
  return capitalize(person.locationType);
}
