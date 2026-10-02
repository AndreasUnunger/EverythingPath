// @vitest-environment node
import { expect, it } from 'vitest';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
  computeFingerprint,
} from '../../scripts/catalog/admission';
import type {
  AttributionAssessment,
  AttributionEvidence,
} from '../../src/lib/catalog/admission-schema';
import type { PreviewEntry } from '../../scripts/catalog/map';

function entry(externalKey = 'pf1/feat'): PreviewEntry {
  return {
    externalKey,
    upstreamKey: externalKey,
    pack: 'feats',
    name: 'Reviewed feat',
    description: '<p>Fixture content.</p>',
    detail: { kind: 'feat', featTypes: [], repeatable: 'unreviewed' },
    sources: [],
    modifiers: [],
    unsupported: [],
  };
}

function fixture(entries = [entry()]) {
  const summary = {
    upstreamRecords: entries.length,
    admitted: entries.length,
    excluded: 0,
    unassigned: 0,
    byKind: {},
  };
  const artifact = {
    catalog: {
      purpose: 'preview',
      releaseAdmission: 'not-evaluated',
      remaps: [],
      inputs: [],
      summary,
      entries,
      resources: [] as PreviewEntry[],
    },
    unsupported: {
      purpose: 'preview',
      summary: { entries: 0, issues: 0 },
      entries: [],
    },
    comparison: {
      coverageComplete: true,
      summary,
      packs: [],
      records: entries.map((item) => ({
        repo: 'pf1' as const,
        pack: item.pack,
        path: `${item.externalKey}.yaml`,
        externalKey: item.upstreamKey,
        name: item.name,
        status: 'admitted' as const,
        reason: 'In scope',
      })),
    },
  };
  const registry = {
    BOOK: {
      title: 'Fixture book',
      notice: 'Fixture copyright notice.',
      checkedAgainst: 'printed' as const,
      checkedOn: '2026-10-02',
      aliases: [] as string[],
      reviewStatus: 'reviewed' as const,
      provenance: ['Fixture printed book'],
    },
  };
  const evidence: AttributionEvidence = {
    comparison: {
      content: 'Whole fixture content compared with fixture book.',
    },
  };
  const assessments: AttributionAssessment[] = entries.map((item) => ({
    externalKey: item.externalKey,
    status: 'confirmed',
    ...buildAssessmentBinding({
      entry: item,
      artifact,
      evidence,
      registry,
      requiredNotices: ['BOOK'],
      evidenceIds: ['comparison'],
    }),
    requiredNotices: ['BOOK'],
    rationale: 'The complete definition matches the fixture book.',
    reviewedBy: 'Fixture reviewer',
    reviewedOn: '2026-10-02',
  }));
  return { artifact, registry, evidence, assessments };
}

it('admits a definition with a current content review and its reviewed notices', () => {
  const result = assessCatalogAdmission(fixture());
  expect(result.passed).toBe(true);
  expect(result.admitted).toEqual([
    expect.objectContaining({
      externalKey: 'pf1/feat',
      name: 'Reviewed feat',
      requiredNotices: ['BOOK'],
    }),
  ]);
  expect(result.failures).toEqual([]);
});

it('reports an intentional unresolved assessment without failing unrelated admission', () => {
  const input = fixture([entry(), entry('pf1/unresolved')]);
  input.assessments[1]!.status = 'unresolved';
  input.assessments[1]!.rationale =
    'Whole-content comparison is still missing.';
  input.assessments[1]!.requiredNotices = ['MISSING'];
  input.assessments[1]!.noticeFingerprints = {};
  const result = assessCatalogAdmission(input);
  expect(result.passed).toBe(true);
  expect(result.admitted.map((row) => row.externalKey)).toEqual(['pf1/feat']);
  expect(result.held).toEqual([
    expect.objectContaining({
      externalKey: 'pf1/unresolved',
      reason: 'Whole-content comparison is still missing.',
      missingNotices: ['MISSING'],
    }),
  ]);
});

it.each([{ books: [] }, { books: ['MISSING'] }])(
  'holds an inventoried definition without an Attribution Assessment for sources $books',
  ({ books }) => {
    const candidate = entry('pf1/new-unsourced-feat');
    candidate.sources = books.map((book) => ({ book }));
    const input = fixture([entry(), candidate]);
    input.assessments = input.assessments.slice(0, 1);
    const result = assessCatalogAdmission(input);
    expect(result.passed).toBe(true);
    expect(result.admitted.map((row) => row.externalKey)).toEqual(['pf1/feat']);
    expect(result.held).toEqual([
      {
        externalKey: 'pf1/new-unsourced-feat',
        name: 'Reviewed feat',
        reason: 'missing Attribution Assessment',
        requiredNotices: books,
        missingNotices: books,
        evidence: [],
      },
    ]);
    expect(result.failures).toEqual([]);
  },
);

it('identifies missing source notice attribution accurately for an otherwise reviewed unsourced definition', () => {
  const input = fixture();
  const assessment = input.assessments[0];
  if (!assessment) throw new Error('Fixture assessment missing');
  assessment.requiredNotices = [];
  assessment.noticeFingerprints = {};
  expect(assessCatalogAdmission(input).failures).toEqual([
    {
      externalKey: 'pf1/feat',
      reason:
        'Missing source notice attribution: no sources or required notices identified.',
    },
  ]);
});

it.each(['content', 'mapping'])(
  'keeps an unresolved definition held when its %s changes',
  (change) => {
    const input = fixture();
    const assessment = input.assessments[0];
    const candidate = input.artifact.catalog.entries[0];
    const record = input.artifact.comparison.records[0];
    if (!assessment || !candidate || !record)
      throw new Error('Fixture missing');
    assessment.status = 'unresolved';
    if (change === 'content') candidate.description = 'New unreviewed content';
    else {
      candidate.upstreamKey = 'pf1/new';
      record.externalKey = 'pf1/new';
    }
    expect(assessCatalogAdmission(input)).toMatchObject({
      passed: true,
      admitted: [],
      held: [{ externalKey: 'pf1/feat', reason: assessment.rationale }],
      failures: [],
    });
  },
);

it.each([
  [
    'an unaccounted definition',
    (input: ReturnType<typeof fixture>) => {
      input.artifact.comparison.records = [];
    },
    /unaccounted/i,
  ],
  [
    'changed content',
    (input: ReturnType<typeof fixture>) => {
      input.artifact.catalog.entries[0]!.description = 'Changed';
    },
    /stale.*content/i,
  ],
  [
    'changed mapping',
    (input: ReturnType<typeof fixture>) => {
      input.artifact.catalog.entries[0]!.upstreamKey = 'pf1/new';
      input.artifact.comparison.records[0]!.externalKey = 'pf1/new';
    },
    /stale/i,
  ],
  [
    'changed evidence',
    (input: ReturnType<typeof fixture>) => {
      input.evidence.comparison!.content = 'Corrected comparison';
    },
    /stale.*evidence/i,
  ],
  [
    'changed notices',
    (input: ReturnType<typeof fixture>) => {
      input.registry.BOOK.notice = 'Corrected notice';
    },
    /stale.*notice/i,
  ],
  [
    'missing notices',
    (input: ReturnType<typeof fixture>) => {
      input.registry = {
        ...input.registry,
        BOOK: { ...input.registry.BOOK, notice: '' },
      };
    },
    /missing.*notice/i,
  ],
  [
    'missing review evidence',
    (input: ReturnType<typeof fixture>) => {
      input.assessments[0]!.evidenceFingerprints = {};
    },
    /evidence/i,
  ],
])('fails admission for %s', (_, change, reason) => {
  const input = fixture();
  change(input);
  const result = assessCatalogAdmission(input);
  expect(result.passed).toBe(false);
  expect(result.admitted).toEqual([]);
  expect(result.failures).toContainEqual(
    expect.objectContaining({
      externalKey: 'pf1/feat',
      reason: expect.stringMatching(reason),
    }),
  );
});

it('omits parents and resources transitively when their referenced definition is held', () => {
  const feature = entry('pf1/feature');
  const parent = {
    ...entry('pf1/parent'),
    description: '<a href="catalog:pf1/feature">Feature</a>',
  };
  const resource = {
    ...entry('pf1/resource'),
    description: '<a href="catalog:pf1/parent">Parent</a>',
  };
  const input = fixture([feature, parent, resource]);
  input.artifact.catalog.resources.push(input.artifact.catalog.entries.pop()!);
  input.assessments[0]!.status = 'unresolved';
  const result = assessCatalogAdmission(input);
  expect(result.passed).toBe(true);
  expect(result.admitted).toEqual([]);
  expect(result.held.map((row) => row.externalKey)).toEqual(['pf1/feature']);
  expect(
    result.dependentOmissions.map((row) => row.externalKey).sort(),
  ).toEqual(['pf1/parent', 'pf1/resource']);
});

it('resolves cyclic dependencies and preserves transitive omission order when a dependency becomes held', () => {
  const first = entry('pf1/first');
  const second = entry('pf1/second');
  const dependency = entry('pf1/dependency');
  first.description =
    '<a href="catalog:pf1/second">Second</a><a href="catalog:pf1/dependency">Dependency</a>';
  second.description = '<a href="catalog:pf1/first">First</a>';
  const input = fixture([first, second, dependency]);
  expect(
    assessCatalogAdmission(input).admitted.map((row) => row.externalKey),
  ).toEqual(['pf1/first', 'pf1/second', 'pf1/dependency']);
  const assessment = input.assessments[2];
  if (!assessment) throw new Error('Fixture assessment missing');
  assessment.status = 'unresolved';
  const result = assessCatalogAdmission(input);
  expect(result.passed).toBe(true);
  expect(result.admitted).toEqual([]);
  expect(
    result.dependentOmissions.map((row) => ({
      key: row.externalKey,
      reason: row.reason,
    })),
  ).toEqual([
    { key: 'pf1/first', reason: 'Dependent omission: pf1/dependency.' },
    { key: 'pf1/second', reason: 'Dependent omission: pf1/first.' },
  ]);
});

it('reopens a whole-content comparison when referenced content changes at its stable identity', () => {
  const input = fixture([
    entry(),
    {
      ...entry('pf1/parent'),
      description: '<a href="catalog:pf1/feat">Feat</a>',
    },
  ]);
  input.artifact.catalog.entries[0]!.description = 'Changed linked definition';
  const result = assessCatalogAdmission(input);
  expect(result.failures).toContainEqual(
    expect.objectContaining({
      externalKey: 'pf1/parent',
      reason: expect.stringMatching(/stale.*content/i),
    }),
  );
});

it.each([
  [
    'duplicate identity',
    (input: ReturnType<typeof fixture>) => {
      input.artifact.catalog.resources.push(input.artifact.catalog.entries[0]!);
    },
  ],
  [
    'broken link',
    (input: ReturnType<typeof fixture>) => {
      input.artifact.catalog.entries[0]!.description =
        '<a href="catalog:pf1/absent">Absent</a>';
    },
  ],
  [
    'lost feature reference',
    (input: ReturnType<typeof fixture>) => {
      input.artifact.catalog.entries[0]!.unsupported.push({
        field: 'links.classAssociations',
        reason: 'Missing or out-of-scope feature reference.',
      });
    },
  ],
  [
    'omitted inventory record',
    (input: ReturnType<typeof fixture>) => {
      input.artifact.catalog.entries = [];
    },
  ],
])('fails %s even when its assessment is an intentional hold', (_, change) => {
  const input = fixture();
  input.assessments[0]!.status = 'unresolved';
  change(input);
  const result = assessCatalogAdmission(input);
  expect(result.passed).toBe(false);
  expect(
    result.failures.some((failure) =>
      /broken|duplicate|unaccounted/i.test(failure.reason),
    ),
  ).toBe(true);
});

function retainedInput() {
  return {
    ...fixture([]),
    retainedUses: [
      {
        useId: 'saved-copy',
        externalKey: 'pf1/withdrawn',
        name: 'Existing edited copy',
        characterId: 'character-one',
        definitionFingerprint: 'last-usable-definition',
        admittedRelease: 1,
        requiredNotices: ['UNAVAILABLE'],
      },
    ],
    retainedExceptions: [
      {
        useId: 'saved-copy',
        externalKey: 'pf1/withdrawn',
        definitionFingerprint: 'last-usable-definition',
        reason: 'Attribution revoked; existing copy preserved.',
        requiredNotices: ['UNAVAILABLE'],
      },
    ],
  };
}

it('reports retained copies absent from the candidate without implying their missing notice is supplied', () => {
  const result = assessCatalogAdmission(retainedInput());
  expect(result.passed).toBe(true);
  expect(result.retainedExceptions).toEqual([
    expect.objectContaining({
      externalKey: 'pf1/withdrawn',
      useId: 'saved-copy',
      characterId: 'character-one',
      definitionFingerprint: 'last-usable-definition',
      missingNotices: ['UNAVAILABLE'],
    }),
  ]);
  expect(result.requiredNotices).toEqual(['UNAVAILABLE']);
  expect(result.admitted).toEqual([]);
});

it.each([
  [
    'unreported existing use',
    (input: ReturnType<typeof retainedInput>) => {
      input.retainedExceptions = [];
    },
  ],
  [
    'invented previous admission',
    (input: ReturnType<typeof retainedInput>) => {
      input.retainedUses = [];
    },
  ],
  [
    'held revision replacing last usable definition',
    (input: ReturnType<typeof retainedInput>) => {
      input.retainedExceptions[0]!.definitionFingerprint = 'held-revision';
    },
  ],
  [
    'lost retained notice obligation',
    (input: ReturnType<typeof retainedInput>) => {
      input.retainedExceptions[0]!.requiredNotices = [];
    },
  ],
])('fails a retained exception with %s', (_, change) => {
  const input = retainedInput();
  change(input);
  const result = assessCatalogAdmission(input);
  expect(result.passed).toBe(false);
  expect(result.failures).toContainEqual(
    expect.objectContaining({
      externalKey: 'pf1/withdrawn',
      reason: expect.stringMatching(/retained/i),
    }),
  );
});

it('invalidates notice evidence through aliases and shared revoked evidence', () => {
  const input = fixture([entry(), entry('pf1/second')]);
  input.registry.BOOK.aliases = ['OLD_CODE'];
  input.assessments = input.artifact.catalog.entries.map((item) => ({
    ...input.assessments[0]!,
    externalKey: item.externalKey,
    requiredNotices: ['OLD_CODE'],
    ...buildAssessmentBinding({
      entry: item,
      artifact: input.artifact,
      evidence: input.evidence,
      registry: input.registry,
      requiredNotices: ['OLD_CODE'],
      evidenceIds: ['comparison'],
    }),
  }));
  expect(assessCatalogAdmission(input).passed).toBe(true);
  input.registry.BOOK.notice = 'Corrected canonical notice';
  expect(assessCatalogAdmission(input).failures).toHaveLength(2);
  input.evidence = {
    comparison: {
      content: 'Whole fixture content compared with fixture book.',
      revoked: true,
    },
  };
  expect(
    assessCatalogAdmission(input).failures.every((row) =>
      /evidence/i.test(row.reason),
    ),
  ).toBe(true);
});

it('carries explicit importer attribution holds without fabricating a review', () => {
  const input = fixture();
  input.artifact.catalog.entries[0]!.unsupported.push({
    field: 'attribution',
    reason: 'Known notice/evidence hold (#227/#241).',
  });
  input.artifact.catalog.entries[0]!.sources = [{ book: 'MISSING' }];
  input.assessments = [];
  const result = assessCatalogAdmission(input);
  expect(result.passed).toBe(true);
  expect(result.held).toEqual([
    expect.objectContaining({
      externalKey: 'pf1/feat',
      reason: 'Known notice/evidence hold (#227/#241).',
      missingNotices: ['MISSING'],
    }),
  ]);
});

it('requires actual reviewed notice provenance, not a reviewed status alone', () => {
  const input = fixture();
  input.registry.BOOK.provenance = [];
  input.assessments[0] = {
    ...input.assessments[0]!,
    ...buildAssessmentBinding({
      entry: input.artifact.catalog.entries[0]!,
      artifact: input.artifact,
      evidence: input.evidence,
      registry: input.registry,
      requiredNotices: ['BOOK'],
      evidenceIds: ['comparison'],
    }),
  };
  const result = assessCatalogAdmission(input);
  expect(result.passed).toBe(false);
  expect(result.failures[0]?.reason).toMatch(/missing.*notice/i);
});

it('accounts for a last usable candidate body as a retained exception without new admission', () => {
  const input = {
    ...fixture(),
    retainedUses: retainedInput().retainedUses,
    retainedExceptions: retainedInput().retainedExceptions,
  };
  input.assessments = [];
  const body = input.artifact.catalog.entries[0]!;
  input.retainedUses[0] = {
    ...input.retainedUses[0]!,
    externalKey: body.externalKey,
    definitionFingerprint: computeFingerprint(body),
  };
  input.retainedExceptions[0] = {
    ...input.retainedExceptions[0]!,
    externalKey: body.externalKey,
    definitionFingerprint: computeFingerprint(body),
  };
  const result = assessCatalogAdmission(input);
  expect(result.passed).toBe(true);
  expect(result.admitted).toEqual([]);
  expect(result.retainedExceptions).toHaveLength(1);
  body.description = 'A held revision cannot replace the saved body.';
  expect(assessCatalogAdmission(input)).toMatchObject({
    passed: true,
    admitted: [],
    held: [
      {
        externalKey: body.externalKey,
        reason: 'missing Attribution Assessment',
      },
    ],
    retainedExceptions: [
      { definitionFingerprint: input.retainedUses[0]?.definitionFingerprint },
    ],
    failures: [],
  });
});
