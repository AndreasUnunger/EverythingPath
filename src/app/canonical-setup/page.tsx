import { redirect } from 'next/navigation';
import {
  legacyRedirectTarget,
  type RouteSearchParams,
} from '~/components/campaign-shell/legacy-redirect';

// Old bookmark: the scoped setup route still shows a started militia's state.
export default async function CanonicalSetupPage({
  searchParams,
}: {
  searchParams: Promise<RouteSearchParams>;
}) {
  redirect(legacyRedirectTarget('/canonical-setup', await searchParams));
}
