// Plain-language text for review facts. Pure and mode-agnostic: every name
// comes from the caller's resolver, so a frozen record never borrows today's
// labels and no opaque identity is ever returned as text.

export type ReviewNames = {
  team(id: string): string;
  settlement(id: string): string;
  character(id: string): string;
  event(id: string): string;
  item(id: string): string;
  cache(id: string): string;
  /** A recorded source: an event's name when it names one, else its text. */
  source(value: string): string;
};

const goldFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/** Copper is stored; gp is shown. Exact to one copper, signed with a true minus. */
export function gp(copper: number) {
  const text = `${goldFormat.format(Math.abs(copper) / 100)} gp`;
  return copper < 0 ? `−${text}` : text;
}
export function signed(value: number) {
  return value < 0 ? `−${Math.abs(value)}` : `+${value}`;
}
export function signedGp(copper: number) {
  return copper < 0 ? gp(copper) : `+${gp(copper)}`;
}
export function words(value: string) {
  const spaced = value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return spaced ? spaced[0]!.toUpperCase() + spaced.slice(1) : value;
}
export function count(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

// Identity-only fields carry no player-facing meaning.
const identityFields = new Set([
  'acknowledgementId',
  'adjustmentId',
  'benefitId',
  'bonusId',
  'choiceId',
  'effectId',
  'exceptionId',
  'marketId',
  'orderId',
  'slotId',
  'subjectId',
  'targetChoiceId',
  'transferId',
  'kind',
]);
const fieldLabels: Record<string, string> = {
  treasuryCopper: 'Treasury',
  costCopper: 'Cost',
  priceCopper: 'Price',
  valueCopper: 'Value',
  characterIds: 'Characters',
  settlementIds: 'Settlements',
  sourceEventIds: 'Source events',
  itemIds: 'Items',
  managerCharacterId: 'Manager',
  ownerCharacterId: 'Owner',
  firstMilitiaWeek: 'Skip first Upkeep',
  uneventfulCarry: 'Uneventful-week benefit',
};
export function fieldLabel(field: string) {
  return (
    fieldLabels[field] ??
    words(field.replace(/Copper$/, '').replace(/Ids?$/, ''))
  );
}

function referenceName(field: string, id: string, names: ReviewNames) {
  const key = field.replace(/Ids$/, 'Id');
  if (/characterId$/i.test(key)) return names.character(id);
  if (key === 'teamId') return names.team(id);
  if (key === 'settlementId') return names.settlement(id);
  if (key === 'itemId') return names.item(id);
  if (key === 'cacheId') return names.cache(id);
  if (/eventId$/i.test(key) || key === 'sourceEventId' || key === 'sourceId')
    return names.event(id);
  return null;
}

/**
 * The general readable fallback for any recorded fact: nested values are
 * flattened to "Label: value" text with references named and identities
 * omitted, so older or unfamiliar facts remain readable rather than dropped.
 */
export function describeValue(
  value: unknown,
  names: ReviewNames,
  field = '',
): string {
  if (value === null || value === undefined) return 'Not recorded';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number')
    return field.endsWith('Copper') ? gp(value) : String(value);
  if (typeof value === 'string') {
    if (!value.trim()) return 'None';
    if (field === 'source') return names.source(value);
    if (/Ids?$/.test(field) || field === 'sourceId') {
      return referenceName(field, value, names) ?? 'Recorded reference';
    }
    return /^[a-z]+(_[a-z]+)+$/.test(value) || /^[a-z]+$/.test(value)
      ? words(value)
      : value;
  }
  if (Array.isArray(value))
    return value.length
      ? value.map((entry) => describeValue(entry, names, field)).join(', ')
      : 'None';
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([key, entry]) => !identityFields.has(key) && entry !== undefined,
  );
  const kind = (value as { kind?: unknown }).kind;
  const parts = entries.map(
    ([key, entry]) => `${fieldLabel(key)}: ${describeValue(entry, names, key)}`,
  );
  if (typeof kind === 'string') parts.unshift(words(kind));
  return parts.join(' · ') || 'Recorded';
}
