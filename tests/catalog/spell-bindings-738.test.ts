// @vitest-environment node
import { expect, it } from 'vitest';
import { buildAssessmentBinding } from '../../scripts/catalog/admission';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { fullBindingContext738 } from './full-binding-context-738';

it('binds every missed or bounded #738 assessment to its verified full-corpus content', () => {
  expect(fullBindingContext738.rootKeys).toHaveLength(99);
  const entries = new Map(
    fullBindingContext738.entries.map((entry) => [entry.externalKey, entry]),
  );
  for (const key of fullBindingContext738.rootKeys) {
    const entry = entries.get(key);
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === key,
    );
    if (!entry || !assessment) throw new Error(`Missing assessed Spell ${key}`);
    expect(assessment, entry.name).toMatchObject(
      buildAssessmentBinding({
        entry,
        artifact: {
          catalog: fullBindingContext738,
          comparison: { records: [], packs: [] },
        },
        ...reviewedAdmission,
        requiredNotices: assessment.requiredNotices,
        evidenceIds: Object.keys(assessment.evidenceFingerprints),
      }),
    );
  }
});
