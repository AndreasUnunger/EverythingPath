import { buildConditionCatalogArtifact } from './catalog/conditions.ts';
import { assessCatalogAdmission } from './catalog/admission.ts';
import {
  reviewedAdmission,
  legalResources,
} from '../src/lib/catalog/reviewed-data.ts';
import { buildLegalPageData } from '../src/lib/catalog/legal-page-data.ts';
import { conditionDefinitions } from '../src/lib/character-sheet-conditions.ts';

const artifact = await buildConditionCatalogArtifact();
const admission = assessCatalogAdmission({ artifact, ...reviewedAdmission });
const legal = buildLegalPageData({
  registry: reviewedAdmission.registry,
  resources: legalResources,
  requiredNotices: admission.requiredNotices,
  permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
});
process.stdout.write(
  JSON.stringify(
    {
      purpose: 'condition-admission',
      localResources: artifact.catalog.localResources,
      inventory: artifact.catalog.entries.length,
      admission,
      outstandingNotices: legal.outstandingNotices,
      quantities: conditionDefinitions.map((definition) => ({
        key: definition.key,
        unmodeled: definition.unmodeled,
      })),
    },
    null,
    2,
  ) + '\n',
);
if (
  !admission.passed ||
  admission.held.length ||
  legal.outstandingNotices.length
)
  process.exitCode = 1;
