import { redirect } from 'next/navigation';
import {
  legacyRedirectTarget,
  type RouteSearchParams,
} from '~/components/campaign-shell/legacy-redirect';

// Old bookmark: keep campaign and phase, normalize the phase, never render.
export default async function CanonicalWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<RouteSearchParams>;
}) {
  redirect(legacyRedirectTarget('/canonical-workspace', await searchParams));
}
