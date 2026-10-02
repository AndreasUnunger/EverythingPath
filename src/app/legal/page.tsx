import type { Metadata } from 'next';
import { LegalPage } from '~/components/legal/legal-page';
import { buildLegalPageData } from '~/lib/catalog/legal-page-data';
import { legalResources, section15Registry } from '~/lib/catalog/reviewed-data';

export const metadata: Metadata = { title: 'Legal notices' };

// Public: outside the campaign layout, and `proxy.ts` protects no route, so
// no sign-in or organization is needed. The notices are read from committed
// files on the server; the page ships no state of its own.
export default function LegalRoute() {
  return (
    <LegalPage
      data={buildLegalPageData({
        registry: section15Registry,
        resources: legalResources,
        permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
        requiredNotices: [],
      })}
    />
  );
}
