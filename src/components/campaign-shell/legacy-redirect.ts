import { legacyCampaignPath } from '~/lib/campaign-routes';

export type RouteSearchParams = Record<string, string | string[] | undefined>;

// Next hands route pages a plain record; the redirect helper reads the first
// value of each key like a URL would.
export function legacyRedirectTarget(
  pathname: string,
  searchParams: RouteSearchParams,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) params.set(key, first);
  }
  return legacyCampaignPath(pathname, params);
}

// Dynamic segments may arrive percent-encoded; a malformed encoding keeps the
// raw value, which the campaign gate then reports as unavailable.
export function decodeCampaignId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
