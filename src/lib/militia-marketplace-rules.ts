export type MarketplaceSourceAction = 'activate_black_market' | 'broker_market';
export type MarketplaceAvailabilityTier = 'small_town' | 'small_city';

export type MarketplaceProfile = {
  availabilityTier: MarketplaceAvailabilityTier;
  availabilityThreshold: number;
  saleValuePercent: number;
  contrabandAllowed: boolean;
};

export function getMarketplaceProfile({
  actionId,
  teamId,
}: {
  actionId: MarketplaceSourceAction;
  teamId?: string;
}) {
  if (actionId === 'activate_black_market') {
    return {
      availabilityTier: 'small_city',
      availabilityThreshold: 90,
      saleValuePercent: 55,
      contrabandAllowed: true,
    } satisfies MarketplaceProfile;
  }

  if (teamId === 'merchants') {
    return {
      availabilityTier: 'small_town',
      availabilityThreshold: 75,
      saleValuePercent: 50,
      contrabandAllowed: false,
    } satisfies MarketplaceProfile;
  }

  if (teamId === 'blackMarketeers' || teamId === 'fixers') {
    return {
      availabilityTier: 'small_city',
      availabilityThreshold: 75,
      saleValuePercent: 50,
      contrabandAllowed: false,
    } satisfies MarketplaceProfile;
  }

  return null;
}

export function getMarketplaceDefaultLabel({
  actionId,
  customLabel,
  weekNumber,
  slotIndex,
}: {
  actionId: MarketplaceSourceAction;
  customLabel?: string;
  weekNumber: number;
  slotIndex: number;
}) {
  const trimmedLabel = customLabel?.trim();
  if (trimmedLabel) {
    return trimmedLabel;
  }

  const base =
    actionId === 'activate_black_market' ? 'Black Market' : 'Brokered Market';
  return `${base} W${weekNumber}.${slotIndex + 1}`;
}

export function formatMarketplaceAvailabilityTier(
  tier: MarketplaceAvailabilityTier,
) {
  return tier === 'small_city' ? 'Small city' : 'Small town';
}

export function formatMarketplaceSourceAction(actionId: MarketplaceSourceAction) {
  return actionId === 'activate_black_market' ? 'Activate Black Market' : 'Broker Market';
}
