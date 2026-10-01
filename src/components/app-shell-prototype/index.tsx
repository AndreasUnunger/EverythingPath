'use client';
// PROTOTYPE — harness for the app-shell prototype: owns the URL state
// (`?variant=A|B|C&page=&c=&ch=&from=&org=`), renders the chosen variant
// shell around the page body, and surfaces the state in a dev badge.
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, type ReactNode } from 'react';
import { PrototypeSwitcher } from '~/components/prototype-switcher';
import { getCampaign } from './mock';
import { renderPage } from './pages';
import { campaignOf, type Location, type Page, type ShellProps } from './types';
import { VariantA } from './variant-a';
import { VariantB } from './variant-b';
import { VariantC } from './variant-c';

const variants: {
  key: string;
  name: string;
  Shell: (p: ShellProps) => ReactNode;
}[] = [
  { key: 'A', name: 'Stacked bars', Shell: VariantA },
  { key: 'B', name: 'Campaign as a place', Shell: VariantB },
  { key: 'C', name: 'Militia rail', Shell: VariantC },
];

const PAGES: Page[] = [
  'campaigns',
  'characters',
  'campaign-home',
  'campaign-characters',
  'week',
  'history',
  'militia',
  'officers',
  'setup',
  'sheet',
];

function asPage(value: string | null): Page | undefined {
  return PAGES.find((p) => p === value);
}

export function AppShellPrototype() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const variant =
    variants.find((v) => v.key === params.get('variant')) ?? variants[0]!;
  const orgId = params.get('org') ?? 'o1';
  const location: Location = {
    page: asPage(params.get('page')) ?? 'campaigns',
    campaignId: params.get('c') ?? undefined,
    characterId: params.get('ch') ?? undefined,
    from: asPage(params.get('from')),
  };

  const replace = useCallback(
    (next: Record<string, string | undefined>) => {
      const search = new URLSearchParams(params);
      for (const [key, value] of Object.entries(next)) {
        if (value === undefined) search.delete(key);
        else search.set(key, value);
      }
      router.replace(`${pathname}?${search.toString()}`);
    },
    [params, pathname, router],
  );

  const setOrgId = useCallback((id: string) => replace({ org: id }), [replace]);

  // Keeps `variant` and `org`; entering a campaign of another organization
  // (a campaign page, or a sheet whose Character is in one) switches the org.
  const go = useCallback(
    (to: Location) => {
      const campaign = getCampaign(campaignOf(to));
      replace({
        page: to.page,
        c: to.campaignId,
        ch: to.characterId,
        from: to.from,
        ...(campaign ? { org: campaign.orgId } : {}),
      });
    },
    [replace],
  );

  const content = renderPage(location, go, orgId);
  const { Shell } = variant;
  return (
    <>
      <Shell
        location={location}
        go={go}
        orgId={orgId}
        setOrgId={setOrgId}
        content={content}
      />
      <DevBadge location={location} orgId={orgId} />
    </>
  );
}

// State readout, visually apart from the design like the switcher. Sits
// above the phone bottom bar; bottom-left from tablet width.
function DevBadge({ location, orgId }: { location: Location; orgId: string }) {
  return (
    <div className="pointer-events-none fixed bottom-16 left-2 z-50 flex flex-col items-start gap-1 md:bottom-2">
      <div className="pointer-events-auto">
        <PrototypeSwitcher variants={variants} />
      </div>
      <code className="rounded bg-yellow-300/90 px-2 py-0.5 font-mono text-xs text-black shadow">
        org={orgId} page={location.page}
        {location.campaignId && ` c=${location.campaignId}`}
        {location.characterId && ` ch=${location.characterId}`}
        {location.from && ` from=${location.from}`}
      </code>
    </div>
  );
}
