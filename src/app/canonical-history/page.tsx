import { redirect } from 'next/navigation';
import {
  legacyRedirectTarget,
  type RouteSearchParams,
} from '~/components/campaign-shell/legacy-redirect';

// Old bookmark: forward supported week, record and audit paging selection.
export default async function CanonicalHistoryPage({
  searchParams,
}: {
  searchParams: Promise<RouteSearchParams>;
}) {
  redirect(legacyRedirectTarget('/canonical-history', await searchParams));
}
