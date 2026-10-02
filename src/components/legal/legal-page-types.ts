import type { buildLegalPageData } from '~/lib/catalog/legal-page-data';

export type LegalPageData = ReturnType<typeof buildLegalPageData>;
export type LegalSection = LegalPageData['sections'][number];
export type OutstandingNotice = LegalPageData['outstandingNotices'][number];
