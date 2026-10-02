import { z } from 'zod';

const text = z.string().trim().min(1);
const fingerprints = z.record(text, z.string().regex(/^[a-f0-9]{64}$/));
const reviewedSources = ['printed', 'prd', 'aon', 'pf1-content'] as const;
const section15NoticeSchema = z.object({
  title: text,
  notice: z.string(),
  checkedAgainst: z.enum([
    ...reviewedSources,
    'owner-transcription',
    'unreviewed',
  ]),
  checkedOn: z.iso.date(),
  aliases: z.array(text),
  reviewStatus: z.enum(['reviewed', 'unreviewed']),
  provenance: z.array(text),
});

export function isReviewedNotice(
  notice: z.infer<typeof section15NoticeSchema> | undefined,
) {
  return (
    notice?.reviewStatus === 'reviewed' &&
    reviewedSources.some((source) => source === notice.checkedAgainst) &&
    notice.provenance.some((source) => source.trim().length > 0) &&
    notice.notice.trim().length > 0
  );
}

const section15RegistrySchema = z.record(
  text,
  section15NoticeSchema.refine(
    (notice) => notice.reviewStatus !== 'reviewed' || isReviewedNotice(notice),
    {
      message:
        'Reviewed notices require checked source provenance and notice text.',
    },
  ),
);
const attributionEvidenceSchema = z.record(
  text,
  z.object({ content: text, revoked: z.boolean().optional() }),
);
const attributionAssessmentSchema = z.object({
  externalKey: text,
  status: z.enum(['confirmed', 'reviewed-coverage', 'unresolved']),
  contentFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  mappingFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  evidenceFingerprints: fingerprints,
  noticeFingerprints: fingerprints,
  requiredNotices: z.array(text),
  rationale: text,
  reviewedBy: text,
  reviewedOn: z.iso.date(),
});

const retainedUseSchema = z.object({
  useId: text,
  externalKey: text,
  name: text,
  characterId: text,
  definitionFingerprint: text,
  admittedRelease: z.number().int().positive(),
  requiredNotices: z.array(text),
});
const retainedExceptionSchema = z.object({
  useId: text,
  externalKey: text,
  definitionFingerprint: text,
  reason: text,
  requiredNotices: z.array(text),
});

export const reviewedAdmissionSchema = z.object({
  assessments: z.array(attributionAssessmentSchema),
  evidence: attributionEvidenceSchema,
  registry: section15RegistrySchema,
  retainedUses: z.array(retainedUseSchema).default([]),
  retainedExceptions: z.array(retainedExceptionSchema).default([]),
});

export type RetainedUse = z.infer<typeof retainedUseSchema>;
export type RetainedException = z.infer<typeof retainedExceptionSchema>;
export type AttributionAssessment = z.infer<typeof attributionAssessmentSchema>;
export type AttributionEvidence = z.infer<typeof attributionEvidenceSchema>;
export type Section15Registry = z.infer<typeof section15RegistrySchema>;
