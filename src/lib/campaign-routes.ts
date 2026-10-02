import type { MilitiaEntryKey } from './militia-correction-sections';

export type CampaignSection =
  | 'home'
  | 'week'
  | 'history'
  | 'militia'
  | 'characters'
  | 'setup';

// Dynamic segments may arrive percent-encoded; a malformed encoding keeps the
// raw value, which the campaign gate then reports as unavailable.
export function decodeRouteSegment(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function campaignPath(
  campaignId: string,
  section: CampaignSection = 'home',
): string {
  const base = `/campaigns/${encodeURIComponent(campaignId)}`;
  return section === 'home' ? base : `${base}/${section}`;
}

/** Campaign origins stay in their shell until the navigation migration (#297). */
export function characterSheetPath(
  campaignId: string | undefined,
  characterId: string,
): string {
  const base = campaignId
    ? campaignPath(campaignId, 'characters')
    : '/characters';
  return `${base}/${encodeURIComponent(characterId)}`;
}

/** Militia, optionally with one page entry selected (`?section=teams`). */
export function militiaPath(
  campaignId: string,
  entry?: MilitiaEntryKey,
): string {
  const path = campaignPath(campaignId, 'militia');
  return entry ? `${path}?section=${encodeURIComponent(entry)}` : path;
}

export type PhaseView =
  | 'upkeep'
  | 'activity'
  | 'event'
  | 'persistent'
  | 'summary';

export function normalizePhase(value: string | null | undefined): PhaseView {
  switch (value) {
    case 'activity':
    case 'event':
    case 'persistent':
    case 'summary':
      return value;
    default:
      return 'upkeep';
  }
}

export function weekPath(campaignId: string, phase?: string | null): string {
  return `${campaignPath(campaignId, 'week')}?phase=${normalizePhase(phase)}`;
}

export type HistorySelection = {
  week?: number;
  recordId?: string;
  beforeSequence?: number;
};

type SearchParams = Pick<URLSearchParams, 'get'>;

function parseHistoryNumber(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : undefined;
}

export function parseHistorySelection(params: SearchParams): HistorySelection {
  const selection: HistorySelection = {};
  const week = parseHistoryNumber(params.get('week'));
  const recordId = params.get('recordId');
  const beforeSequence = parseHistoryNumber(params.get('beforeSequence'));
  if (week !== undefined) selection.week = week;
  if (recordId) selection.recordId = recordId;
  if (beforeSequence !== undefined) selection.beforeSequence = beforeSequence;
  return selection;
}

export function historyPath(
  campaignId: string,
  selection: HistorySelection = {},
): string {
  const params = new URLSearchParams();
  if (selection.week !== undefined) params.set('week', String(selection.week));
  if (selection.recordId) params.set('recordId', selection.recordId);
  if (selection.beforeSequence !== undefined) {
    params.set('beforeSequence', String(selection.beforeSequence));
  }
  const query = params.toString();
  return `${campaignPath(campaignId, 'history')}${query ? `?${query}` : ''}`;
}
