import { readFile } from 'node:fs/promises';
import { runCapturedProcess } from '../../scripts/catalog/process';
import { appendConditionResources } from '../../scripts/catalog/conditions';
import { importCatalog } from '../../scripts/catalog/import';
import { resolve } from 'node:path';
// @vitest-environment node
import { expect, test } from 'vitest';
import { buildConditionCatalogArtifact } from '../../scripts/catalog/conditions';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';

test('all 34 locally authored condition candidates pass the ordinary attribution and notice admission gate', async () => {
  const artifact = await buildConditionCatalogArtifact();
  const report = assessCatalogAdmission({ artifact, ...reviewedAdmission });
  expect(report.failures).toEqual([]);
  expect(report.held).toEqual([]);
  expect(report.admitted).toHaveLength(34);
  expect(report.requiredNotices).toEqual(['CRB']);
  expect(
    artifact.catalog.localResources.map((resource) => resource.path),
  ).toEqual([
    'src/lib/catalog/data/reviewed-conditions.json',
    'docs/ai/pf1-core-rules/pf1-crb-conditions.md',
    'src/lib/character-sheet-conditions.ts',
    'src/lib/character-sheet.ts',
  ]);
});

test('edited condition definitions and lost notices reopen attribution rather than receiving fresh approvals', async () => {
  const artifact = await buildConditionCatalogArtifact();
  const blinded = artifact.catalog.entries.find(
    (entry) => entry.name === 'Blinded',
  );
  if (!blinded) throw new Error('Missing Blinded');
  blinded.modifiers = [{ target: 'ac', bonusType: 'untyped', value: -7 }];
  const changed = assessCatalogAdmission({ artifact, ...reviewedAdmission });
  expect(changed.held).toContainEqual(
    expect.objectContaining({
      name: 'Blinded',
      reason: expect.stringContaining('no longer matches current content'),
    }),
  );
  expect(changed.admitted).toHaveLength(33);
  const { CRB: _crb, ...registry } = reviewedAdmission.registry;
  const missing = assessCatalogAdmission({
    artifact: await buildConditionCatalogArtifact(),
    ...reviewedAdmission,
    registry,
  });
  expect(missing.admitted).toEqual([]);
  expect(missing.held).toHaveLength(34);
});

test('local candidates are genuinely inventoried and metadata changes are content-bound', async () => {
  const artifact = await buildConditionCatalogArtifact();
  artifact.comparison.records = artifact.comparison.records.filter(
    (entry) => entry.name !== 'Panicked',
  );
  const missing = assessCatalogAdmission({ artifact, ...reviewedAdmission });
  expect(missing.failures).toContainEqual(
    expect.objectContaining({
      externalKey: 'local/crb-condition/panicked',
      reason: 'Unaccounted candidate: absent from import inventory.',
    }),
  );
  const panicked = artifact.catalog.entries.find(
    (entry) => entry.name === 'Panicked',
  );
  if (panicked?.detail.kind !== 'condition')
    throw new Error('Missing Panicked');
  panicked.detail.unmodeled = [];
  artifact.comparison.records = (
    await buildConditionCatalogArtifact()
  ).comparison.records;
  expect(
    assessCatalogAdmission({ artifact, ...reviewedAdmission }).held,
  ).toContainEqual(
    expect.objectContaining({
      name: 'Panicked',
      reason: expect.stringContaining('no longer matches current content'),
    }),
  );
  const modified = assessCatalogAdmission({
    artifact: await buildConditionCatalogArtifact(),
    ...reviewedAdmission,
    evidence: {
      ...reviewedAdmission.evidence,
      'crb-conditions-311': { content: 'Changed supporting corpus' },
    },
  });
  expect(modified.held).toHaveLength(34);
  const changed = await buildConditionCatalogArtifact();
  const first = changed.catalog.entries[0];
  if (first?.detail.kind !== 'condition') throw new Error('Missing condition');
  first.detail.deniesDexterityBonus = true;
  expect(
    assessCatalogAdmission({ artifact: changed, ...reviewedAdmission }).held,
  ).toContainEqual(expect.objectContaining({ name: 'Bleed' }));
});

test('the public offline condition command reproduces the committed admission report', async () => {
  const result = runCapturedProcess({
    command: process.execPath,
    args: ['--import', 'tsx', 'scripts/catalog-conditions.ts'],
  });
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  const committed = JSON.parse(
    await readFile('docs/catalog-import/conditions-admission.json', 'utf8'),
  );
  expect(JSON.parse(result.stdout)).toEqual(committed);
});

test('release preparation explicitly appends local definitions, inventory and fingerprint resources to upstream extraction', async () => {
  const upstream = await importCatalog({
    systemPath: resolve('tests/fixtures/catalog/pf1'),
    contentPath: resolve('tests/fixtures/catalog/pf1-content'),
    remaps: [],
  });
  const complete = await appendConditionResources(upstream);
  expect(
    complete.catalog.entries.filter(
      (entry) => entry.detail.kind === 'condition',
    ),
  ).toHaveLength(34);
  expect(
    complete.comparison.records.filter((entry) => entry.repo === 'local'),
  ).toHaveLength(34);
  expect(complete.catalog.localResources).toHaveLength(4);
  expect(
    assessCatalogAdmission({
      artifact: complete,
      ...reviewedAdmission,
    }).admitted.filter((entry) =>
      entry.externalKey.startsWith('local/crb-condition/'),
    ),
  ).toHaveLength(34);
  await expect(appendConditionResources(complete)).rejects.toThrow(
    'already present',
  );
});
