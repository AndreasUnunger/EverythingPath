import { z } from 'zod';

const requiredTests = [
  ['auth.setup.ts', 'authentication', 'prepare fresh role sessions'],
  [
    'access.spec.ts',
    'chromium-tablet',
    'organization members can open their campaign and outsiders cannot',
  ],
  [
    'existing-militia.spec.ts',
    'chromium-tablet',
    'existing militia state survives reload within its campaign',
  ],
];
const reportSchema = z.object({
  status: z.literal('passed'),
  errors: z.literal(0),
  tests: z
    .array(
      z.object({
        file: z.string(),
        project: z.string(),
        title: z.string(),
        expectedStatus: z.literal('passed'),
        tags: z
          .array(z.string())
          .refine(
            (tags) => !tags.some((tag) => /quarantin|skip|only/i.test(tag)),
          ),
        annotations: z
          .array(z.string())
          .refine(
            (annotations) =>
              !annotations.some((type) =>
                /only|skip|fixme|fail|quarantin/i.test(type),
              ),
          ),
        results: z.tuple([
          z.object({ status: z.literal('passed'), retry: z.literal(0) }),
        ]),
      }),
    )
    .length(requiredTests.length),
});

// Count and identify required tests independently of Playwright's selected suite.
// A green runner alone cannot prove that every journey actually ran.
export function evaluateResults(report: unknown): boolean {
  const parsed = reportSchema.safeParse(report);
  if (!parsed.success) return false;
  return requiredTests.every(([file, project, title]) =>
    parsed.data.tests.some(
      (test) =>
        test.file === file && test.project === project && test.title === title,
    ),
  );
}
