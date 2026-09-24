import type { InitializationSource } from './campaignInitialization';
import type { CanonicalRoster } from '../../src/lib/canonical-roster';
import type { CampaignContext } from '../../src/lib/canonical-campaign-context';
import {
  militiaSnapshotSchema,
  weeklySourceKey,
} from '../../src/lib/canonical-weekly-source';

// Preparation supplies facts legacy storage never recorded (weights, item
// locations and cache contents). Never infer them from discarded choices.
export function prepareInitializationSnapshot(
  source: InitializationSource,
  roster: CanonicalRoster,
  context: CampaignContext,
  issues: string[],
) {
  const assets = context.resolutionAssets;
  if (!assets) {
    issues.push(
      'Prepare complete resolution assets, including explicit empty collections.',
    );
    return null;
  }
  const preserve = (actual: unknown, expected: unknown, label: string) => {
    if (weeklySourceKey(actual) !== weeklySourceKey(expected))
      issues.push(`Preserve ${label} in resolution assets.`);
  };
  for (const item of context.items) {
    const mapped = assets.economy.items.find((x) => x.itemId === item.itemId);
    preserve(
      mapped && {
        itemId: mapped.itemId,
        name: mapped.name,
        valueCopper: mapped.valueCopper,
      },
      item,
      `item ${item.itemId}`,
    );
  }
  for (const cache of context.caches) {
    const mapped = assets.economy.caches.find(
      (x) => x.cacheId === cache.cacheId,
    );
    preserve(
      mapped && {
        cacheClass: mapped.cacheClass,
        location: mapped.location,
        secure: mapped.secure,
        status: mapped.status,
      },
      {
        cacheClass: cache.cacheClass,
        location: cache.location,
        secure: cache.secure,
        status: cache.status,
      },
      `cache ${cache.cacheId}`,
    );
  }
  preserveOrders(context, assets, preserve, issues);
  // These legacy models have facts without canonical equivalents. Keep the
  // source intact and require a reviewed mapping before permitting cutover.
  for (const market of source.marketplaces) {
    const mapped = assets.economy.markets.find(
      (x) => x.marketId === market._id,
    );
    preserve(
      mapped && {
        source: mapped.source,
        availableWeek: mapped.availableWeek,
        expiresWeek: mapped.expiresWeek,
        availability: mapped.availability,
        availabilityPercent: mapped.availabilityPercent,
        salePercent: mapped.salePercent,
        contraband: mapped.contraband,
      },
      {
        source: market.sourceAction,
        availableWeek: market.createdWeek,
        expiresWeek: market.activeUntilWeek,
        availability: market.availabilityTier,
        availabilityPercent: market.availabilityThreshold,
        salePercent: market.saleValuePercent,
        contraband: market.contrabandAllowed,
      },
      `marketplace ${market._id}`,
    );
    if (
      market.marketDayDiscountPercent !== undefined ||
      market.marketDayAppliedWeek !== undefined
    )
      issues.push(
        `Resolve Market Day benefit mapping for marketplace ${market._id}.`,
      );
  }
  if (source.people.length)
    issues.push('Resolve legacy tracked-person mapping before cutover.');
  validateCurrentEvents(context, source.week?.weekNumber, issues);
  const parsed = militiaSnapshotSchema.safeParse({
    rank: source.militia.rank,
    training: source.militia.training,
    treasuryCopper: context.treasuryCopper,
    notoriety: source.militia.notoriety,
    focus: source.militia.focus ?? null,
    roster,
    characters: source.characters.map((character) => ({
      characterId: character._id,
      level: character.level,
      strength: character.strength,
      dexterity: character.dexterity,
      constitution: character.constitution,
      intelligence: character.intelligence,
      wisdom: character.wisdom,
      charisma: character.charisma,
      isActive: character.isActive !== false,
    })),
    settlements: context.settlements,
    bonuses: context.bonuses,
    ...assets,
  });
  if (!parsed.success) {
    issues.push(
      ...parsed.error.issues.map(
        (issue) =>
          `Resolve canonical source ${issue.path.join('.')}: ${issue.message}`,
      ),
    );
    return null;
  }
  return parsed.data;
}

function preserveOrders(
  context: CampaignContext,
  assets: NonNullable<CampaignContext['resolutionAssets']>,
  preserve: (actual: unknown, expected: unknown, label: string) => void,
  issues: string[],
) {
  for (const order of context.orders) {
    const mapped = assets.economy.orders.find(
      (x) => x.orderId === order.orderId,
    );
    if (order.enchantment !== null) {
      issues.push(
        `Resolve enchantment value and duration mapping for order ${order.orderId} before cutover.`,
      );
    } else {
      preserve(
        mapped && {
          mode: mapped.mode,
          enchantmentValueCopper: mapped.enchantmentValueCopper,
        },
        { mode: 'purchase', enchantmentValueCopper: 0 },
        `purchase semantics for order ${order.orderId}`,
      );
    }
    preserve(
      mapped && {
        itemId: mapped.itemId,
        source: mapped.source,
        settlementId: mapped.settlementId,
        orderedWeek: mapped.orderedWeek,
        orderedDay: mapped.orderedDay,
        dueDay: mapped.dueDay,
        dueActivityWeek: mapped.dueActivityWeek,
        priceCopper: mapped.priceCopper,
        deliveryDays: mapped.deliveryDays,
        receipt: mapped.receipt,
      },
      {
        itemId: order.itemId,
        source: order.source,
        settlementId: order.settlementId,
        orderedWeek: order.orderedWeek,
        orderedDay: order.orderedDay,
        dueDay: order.dueDay,
        dueActivityWeek: order.dueActivityWeek,
        priceCopper: order.priceCopper,
        deliveryDays: order.deliveryDays,
        receipt: order.receipt,
      },
      `order ${order.orderId}`,
    );
  }
}

function validateCurrentEvents(
  context: CampaignContext,
  week: number | undefined,
  issues: string[],
) {
  for (const event of context.events) {
    if (
      week !== undefined &&
      ((!event.resolved &&
        (!event.persistent ||
          (event.startedWeek !== null && event.startedWeek >= week))) ||
        (event.endedWeek !== null && event.endedWeek >= week))
    )
      issues.push(
        `Resolve current event state for ${event.eventId} before cutover; an empty draft cannot preserve this midweek transition.`,
      );
  }
}
