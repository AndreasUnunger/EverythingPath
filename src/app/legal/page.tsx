import type { Metadata } from 'next';
import { LegalPage } from '~/components/legal/legal-page';

export const metadata: Metadata = { title: 'Legal notices' };

// Public: outside the campaign layout, and `proxy.ts` protects no route, so
// no sign-in or organization is needed.
export default function LegalRoute() {
  return <LegalPage />;
}
