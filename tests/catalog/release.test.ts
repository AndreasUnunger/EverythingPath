// @vitest-environment node
import { expect, it } from 'vitest';
import { buildCatalogRelease } from '../../scripts/catalog/release';
import {
  releaseFingerprint,
  releaseInputCategories,
  type ReleaseRow,
} from '../../src/lib/catalog/release-schema';

it('binds a manually numbered release to normalized inputs and bounded immutable output', async () => {
  const inputs = {
    upstream: 'upstream',
    remaps: 'remaps',
    curation: 'curation',
    localData: 'localData',
    parsers: 'parsers',
    sanitizers: 'sanitizers',
    ruleResources: 'ruleResources',
    legal: 'legal',
    attribution: 'attribution',
  };
  const release = await buildCatalogRelease({
    releaseNumber: 1,
    compatibility: { schema: 'sheet-v1', calculation: 'facts-v1' },
    inputs,
    rows: [
      {
        kind: 'definition',
        key: 'pf1/feat',
        payload: { name: 'Fixture feat' },
      },
    ],
  });
  expect(release.manifest.releaseNumber).toBe(1);
  expect(release.manifest.inputs.upstream).toMatch(/^[a-f0-9]{64}$/);
  expect(release.manifest.outputFingerprint).toBe(
    await releaseFingerprint(release.manifest.batches),
  );
  expect(
    await buildCatalogRelease({
      releaseNumber: 1,
      compatibility: { schema: 'sheet-v1', calculation: 'facts-v1' },
      inputs,
      rows: release.batches.flat(),
    }),
  ).toEqual(release);
});

it('refuses independently tampered output before any operator command runs', async () => {
  const { validateCatalogReleaseArtifact } =
    await import('../../src/lib/catalog/release-schema');
  const release = await buildCatalogRelease({
    releaseNumber: 1,
    compatibility: { schema: 'sheet-v1', calculation: 'facts-v1' },
    inputs: {
      upstream: [],
      remaps: [],
      curation: [],
      localData: [],
      parsers: [],
      sanitizers: [],
      ruleResources: [],
      legal: [],
      attribution: [],
    },
    rows: [
      {
        kind: 'definition',
        key: 'pf1/feat',
        payload: { name: 'Reviewed feat' },
      },
    ],
  });
  release.batches[0]![0]!.payload = { name: 'Tampered feat' };
  await expect(validateCatalogReleaseArtifact(release)).rejects.toThrow(
    'output fingerprint mismatch',
  );
});

it('holds changed accepted content and carries every previously shipped notice version', async () => {
  const { importCatalog } = await import('../../scripts/catalog/import');
  const { createCatalogRelease } =
    await import('../../scripts/catalog/release');
  const { buildAssessmentBinding } =
    await import('../../scripts/catalog/admission');
  const { legalResources } =
    await import('../../src/lib/catalog/reviewed-data');
  const { mkdir, mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const root = await mkdtemp(join(tmpdir(), 'release-admission-'));
  try {
    const system = join(root, 'system');
    const content = join(root, 'content');
    await mkdir(join(system, 'public'), { recursive: true });
    await mkdir(join(system, 'packs/feats'), { recursive: true });
    await mkdir(join(content, 'src'), { recursive: true });
    await writeFile(
      join(system, 'public/system.json'),
      JSON.stringify({ version: '11.11', packs: [{ name: 'feats' }] }),
    );
    await writeFile(
      join(content, 'module.json'),
      JSON.stringify({ version: '11.4.0', packs: [] }),
    );
    await writeFile(
      join(system, 'packs/feats/fixture.yaml'),
      JSON.stringify({
        _id: 'FixtureFeat',
        _key: '!items!FixtureFeat',
        name: 'Fixture feat',
        type: 'feat',
        system: {},
      }),
    );
    const artifact = await importCatalog({
      systemPath: system,
      contentPath: content,
      remaps: [],
    });
    const entry = artifact.catalog.entries[0]!;
    const evidence = {
      review: { content: 'Synthetic whole-content comparison' },
    };
    const registry = {
      BOOK: {
        title: 'Fixture book',
        notice: 'Old printed notice',
        checkedAgainst: 'printed' as const,
        checkedOn: '2026-10-03',
        aliases: [],
        reviewStatus: 'reviewed' as const,
        provenance: ['Synthetic print'],
      },
    };
    const attribution = {
      evidence,
      registry,
      assessments: [
        {
          externalKey: entry.externalKey,
          status: 'confirmed' as const,
          ...buildAssessmentBinding({
            entry,
            artifact,
            evidence,
            registry,
            requiredNotices: ['BOOK'],
            evidenceIds: ['review'],
          }),
          requiredNotices: ['BOOK'],
          rationale: 'Synthetic review',
          reviewedBy: 'Fixture',
          reviewedOn: '2026-10-03',
        },
      ],
    };
    const options = {
      artifact,
      attribution,
      legalResources,
      inputValues: {
        remaps: [],
        curation: [],
        localData: [],
        parsers: 'test-parser',
        sanitizers: 'test-sanitizer',
        ruleResources: [],
      },
      compatibility: { schema: 'sheet-v1', calculation: 'facts-v1' },
    };
    const prior = await createCatalogRelease({ ...options, releaseNumber: 1 });
    entry.description = '<p>Changed after acceptance</p>';
    registry.BOOK.notice = 'New corrected notice';
    const next = await createCatalogRelease({
      ...options,
      previous: prior,
      releaseNumber: 2,
    });
    expect(
      next.batches.flat().filter((row) => row.kind === 'definition'),
    ).toEqual([]);
    expect(
      next.batches.flat().find((row) => row.key === 'holds:pf1/FixtureFeat')
        ?.payload,
    ).toMatchObject({ reason: expect.stringContaining('current content') });
    expect(
      next.batches.flat().find((row) => row.key === 'permanentNoticeSuperset')
        ?.payload,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'Old printed notice' }),
      ]),
    );
    expect(
      next.batches
        .flat()
        .find((row) => row.key === 'retirement:pf1/FixtureFeat')?.payload,
    ).toMatchObject({
      state: 'held',
      lastUsableDefinition: expect.objectContaining({ description: '' }),
    });
    const third = await createCatalogRelease({
      ...options,
      previous: next,
      releaseNumber: 3,
    });
    expect(
      third.batches.flat().filter((row) => row.kind === 'definition'),
    ).toEqual([]);
    expect(
      third.batches
        .flat()
        .find((row) => row.key === 'retirement:pf1/FixtureFeat')?.payload,
    ).toMatchObject({
      state: 'held',
      lastUsableDefinition: expect.objectContaining({ description: '' }),
    });
    const broken = {
      ...artifact,
      curation: { ...artifact.curation, passed: false },
    };
    await expect(
      createCatalogRelease({ ...options, artifact: broken, releaseNumber: 4 }),
    ).rejects.toThrow('gates failed');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it.each(releaseInputCategories)(
  'changing %s binds a different artifact without relying on application code',
  async (category) => {
    const inputs = {
      upstream: { version: 1 },
      remaps: { version: 1 },
      curation: { version: 1 },
      localData: { version: 1 },
      parsers: { version: 1 },
      sanitizers: { version: 1 },
      ruleResources: { version: 1 },
      legal: { version: 1 },
      attribution: { version: 1 },
    };
    const options = {
      releaseNumber: 1,
      compatibility: { schema: 'sheet-v1', calculation: 'facts-v1' },
      inputs,
      rows: [{ kind: 'definition' as const, key: 'feat', payload: {} }],
    };
    const original = await buildCatalogRelease(options);
    const changed = await buildCatalogRelease({
      ...options,
      inputs: { ...inputs, [category]: { version: 2 } },
    });
    expect(changed.manifest.inputs[category]).not.toBe(
      original.manifest.inputs[category],
    );
    expect(changed.manifest.artifactFingerprint).not.toBe(
      original.manifest.artifactFingerprint,
    );
    expect(changed.manifest.outputFingerprint).toBe(
      original.manifest.outputFingerprint,
    );
    const withUnrelatedInput = {
      ...inputs,
      unrelatedApplication: 'new navbar',
    };
    expect(
      await buildCatalogRelease({
        ...options,
        inputs: withUnrelatedInput,
      }),
    ).toEqual(original);
  },
);

it('splits batches at row and UTF-8 byte limits and rejects one oversized record', async () => {
  const inputs = {
    upstream: [],
    remaps: [],
    curation: [],
    localData: [],
    parsers: [],
    sanitizers: [],
    ruleResources: [],
    legal: [],
    attribution: [],
  };
  const options = {
    releaseNumber: 1,
    compatibility: { schema: 's', calculation: 'c' },
    inputs,
  };
  const release = await buildCatalogRelease({
    ...options,
    rows: [
      { kind: 'report', key: 'a', payload: 'é'.repeat(150000) },
      { kind: 'report', key: 'b', payload: 'é'.repeat(150000) },
    ],
  });
  expect(release.batches.map((batch) => batch.length)).toEqual([1, 1]);
  await expect(
    buildCatalogRelease({
      ...options,
      rows: [{ kind: 'report', key: 'too-big', payload: 'é'.repeat(260000) }],
    }),
  ).rejects.toThrow('exceeds byte limit');
});

it('uses standard SHA-256, including multi-block and UTF-8 values', async () => {
  const { createHash } = await import('node:crypto');
  const { canonicalReleaseJson } =
    await import('../../src/lib/catalog/release-schema');
  for (const value of [
    '',
    'abc',
    'é'.repeat(500),
    { b: [1, true, null], a: 'text' },
  ]) {
    expect(await releaseFingerprint(value)).toBe(
      createHash('sha256').update(canonicalReleaseJson(value)).digest('hex'),
    );
  }
});

it('fingerprints the importer dependency graph and actual authored resources while excluding application modules', async () => {
  const { catalogImplementationInputs } =
    await import('../../scripts/catalog/release-inputs');
  const input = await catalogImplementationInputs();
  expect(input.parsers.files).toHaveProperty('scripts/catalog/map.ts');
  expect(input.parsers.files).toHaveProperty(
    'scripts/catalog/reviewed-item-ability-policies.json',
  );
  expect(
    Object.keys(input.parsers.files).some(
      (path) =>
        path.startsWith('src/app/') || path.startsWith('src/components/'),
    ),
  ).toBe(false);
  expect(input.ruleResources.representativeClassCatalog.definitions).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: 'Fighter' })]),
  );
  expect(input.ruleResources.castingTables).toMatchObject({
    definitions: {
      version: 1,
      tables: {
        'prepared-full': {
          rows: expect.arrayContaining([
            {
              spellsPerDay: [
                3,
                1,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
              ],
            },
          ]),
        },
      },
      classes: { wizard: { ability: 'intelligence', record: 'book' } },
    },
  });
  expect(input.ruleResources.castingTables?.source).toContain(
    '"prepared-full"',
  );
});

it('reports authored resource changes without retiring still-present resources and retains removed resources', async () => {
  const { importCatalog } = await import('../../scripts/catalog/import');
  const { createCatalogRelease } =
    await import('../../scripts/catalog/release');
  const { reviewedAdmission, legalResources } =
    await import('../../src/lib/catalog/reviewed-data');
  const artifact = await importCatalog({
    systemPath: 'tests/fixtures/catalog-release/pf1',
    contentPath: 'tests/fixtures/catalog-release/pf1-content',
    remaps: [],
  });
  const options = {
    artifact,
    attribution: reviewedAdmission,
    legalResources,
    inputValues: {
      remaps: [],
      curation: [],
      localData: [],
      parsers: 'fixture-parser',
      sanitizers: 'fixture-sanitizer',
      ruleResources: [],
    },
    compatibility: { schema: 's', calculation: 'c' },
  };
  const authoredResources = [
    { key: 'builtin:casting-fixture', payload: { values: [1] } },
  ];
  const first = await createCatalogRelease({
    ...options,
    releaseNumber: 1,
    authoredResources,
  });
  const same = await createCatalogRelease({
    ...options,
    releaseNumber: 2,
    previous: first,
    authoredResources,
  });
  expect(
    same.batches
      .flat()
      .find((row) => row.key === 'resources:builtin:casting-fixture')?.payload,
  ).toMatchObject({ state: 'unchanged' });
  expect(
    same.batches
      .flat()
      .find((row) => row.key === 'retirement:builtin:casting-fixture'),
  ).toBeUndefined();
  const changed = await createCatalogRelease({
    ...options,
    releaseNumber: 3,
    previous: same,
    authoredResources: [
      { key: 'builtin:casting-fixture', payload: { values: [2] } },
    ],
  });
  expect(
    changed.batches
      .flat()
      .find((row) => row.key === 'resources:builtin:casting-fixture')?.payload,
  ).toMatchObject({ state: 'changed' });
  expect(
    changed.batches
      .flat()
      .find((row) => row.key === 'retirement:builtin:casting-fixture'),
  ).toBeUndefined();
  const removed = await createCatalogRelease({
    ...options,
    releaseNumber: 4,
    previous: changed,
  });
  expect(
    removed.batches
      .flat()
      .find((row) => row.key === 'retirement:builtin:casting-fixture')?.payload,
  ).toMatchObject({
    kind: 'resource',
    state: 'retired',
    lastUsableDefinition: { values: [2] },
  });
});

it('rejects one stable catalog identity shared by a definition and resource within or across batches', async () => {
  const inputs = {
    upstream: [],
    remaps: [],
    curation: [],
    localData: [],
    parsers: [],
    sanitizers: [],
    ruleResources: [],
    legal: [],
    attribution: [],
  };
  const options = {
    releaseNumber: 1,
    compatibility: { schema: 's', calculation: 'c' },
    inputs,
  };
  const definition: ReleaseRow = {
    kind: 'definition',
    key: 'shared-key',
    payload: {},
  };
  const resource: ReleaseRow = {
    kind: 'resource',
    key: 'shared-key',
    payload: {},
  };
  await expect(
    buildCatalogRelease({ ...options, rows: [definition, resource] }),
  ).rejects.toThrow('Duplicate release row');
  await expect(
    buildCatalogRelease({
      ...options,
      rows: [
        definition,
        ...Array.from(
          { length: 100 },
          (_, index): ReleaseRow => ({
            kind: 'definition',
            key: `other-${index}`,
            payload: {},
          }),
        ),
        resource,
      ],
    }),
  ).rejects.toThrow('Duplicate release row');
});

it('requires a new identity for accepted kind changes, including after an intervening retirement', async () => {
  const { importCatalog } = await import('../../scripts/catalog/import');
  const { createCatalogRelease } =
    await import('../../scripts/catalog/release');
  const { buildAssessmentBinding } =
    await import('../../scripts/catalog/admission');
  const { legalResources } =
    await import('../../src/lib/catalog/reviewed-data');
  const artifact = await importCatalog({
    systemPath: 'tests/fixtures/catalog-release/pf1',
    contentPath: 'tests/fixtures/catalog-release/pf1-content',
    remaps: [],
  });
  const entry = artifact.catalog.entries[0]!;
  const evidence = {
    comparison: { content: 'Synthetic whole-content comparison' },
  };
  const registry = {
    BOOK: {
      title: 'Fixture',
      notice: 'Fixture notice',
      checkedAgainst: 'printed' as const,
      checkedOn: '2026-10-03',
      aliases: [],
      reviewStatus: 'reviewed' as const,
      provenance: ['Synthetic fixture'],
    },
  };
  const accepted = () => ({
    evidence,
    registry,
    assessments: [
      {
        externalKey: entry.externalKey,
        status: 'confirmed' as const,
        ...buildAssessmentBinding({
          entry,
          artifact,
          evidence,
          registry,
          requiredNotices: ['BOOK'],
          evidenceIds: ['comparison'],
        }),
        requiredNotices: ['BOOK'],
        rationale: 'Synthetic comparison',
        reviewedBy: 'Fixture',
        reviewedOn: '2026-10-03',
      },
    ],
  });
  const options = {
    artifact,
    legalResources,
    inputValues: {
      remaps: [],
      curation: [],
      localData: [],
      parsers: 'p',
      sanitizers: 's',
      ruleResources: [],
    },
    compatibility: { schema: 's', calculation: 'c' },
  };
  const first = await createCatalogRelease({
    ...options,
    attribution: accepted(),
    releaseNumber: 1,
  });
  const retired = await createCatalogRelease({
    ...options,
    attribution: { evidence, registry, assessments: [] },
    previous: first,
    releaseNumber: 2,
  });
  entry.detail = { kind: 'item', consumable: false, price: 0, weight: 0 };
  await expect(
    createCatalogRelease({
      ...options,
      attribution: accepted(),
      previous: first,
      releaseNumber: 2,
    }),
  ).rejects.toThrow('changed kind; use a new stable identity');
  await expect(
    createCatalogRelease({
      ...options,
      attribution: accepted(),
      previous: retired,
      releaseNumber: 3,
    }),
  ).rejects.toThrow('changed kind; use a new stable identity');
});

it('digests only the supplied UTF-8 byte view asynchronously', async () => {
  const { sha256 } = await import('../../src/lib/catalog/release-sha256');
  const bytes = new TextEncoder().encode('xabcx');
  await expect(sha256(bytes.subarray(1, 4))).resolves.toBe(
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});
