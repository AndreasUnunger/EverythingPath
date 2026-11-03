// @vitest-environment node
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import keys from '../../scripts/catalog/spells-516-candidates.json';
import review from '../../scripts/catalog/legal/spells-516-evidence.json';
import { reviewedCuration as curation } from '../../scripts/catalog/reviewed-curation-data';
import mechanics from '../../docs/catalog-import/spells-516-mechanics.json';
import { importCatalog } from '../../scripts/catalog/import';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
} from '../../scripts/catalog/admission';
import {
  sourceDescription,
  upstreamRecord,
} from '../../scripts/catalog/records';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { calculateCharacterSheetProjections } from '../../src/lib/character-sheet';
import provenance from '../fixtures/spells-516/provenance.json';
import preview from '../fixtures/spells-516/preview.json';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-516/sheet';

const fixtureRoot = resolve('tests/fixtures/spells-516');
const inputs = {
  systemPath: join(fixtureRoot, 'pf1'),
  contentPath: join(fixtureRoot, 'pf1-content'),
  candidateKeys: keys,
  remaps: [],
  curation,
};
const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');
const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

it('accounts exactly the 100 ticket identities with bound source bytes and named whole-content holds', async () => {
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(
    '21f434bc2e11c7d82738ff4c2307a55046927e2dd5ca85ec14f2c4175082b507',
  );
  expect(review.candidates.map((row) => row.externalKey)).toEqual(keys);
  expect(mechanics.candidates.map((row) => row.externalKey)).toEqual(keys);
  expect(
    reviewedAdmission.assessments.filter((row) =>
      keys.includes(row.externalKey),
    ),
  ).toHaveLength(100);
  expect(
    review.candidates.filter((row) => row.disposition === 'held'),
  ).toHaveLength(100);
  for (const candidate of review.candidates) {
    const raw = await readFile(
      join(inputs.systemPath, candidate.source.path),
      'utf8',
    );
    expect(sha256(raw), candidate.name).toBe(candidate.source.sha256);
    const record = upstreamRecord.parse(parse(raw));
    expect(`pf1/${record._id}`).toBe(candidate.externalKey);
    expect(sha256(sourceDescription(record))).toBe(candidate.descriptionSha256);
    expect(
      mechanics.candidates.find(
        (row) => row.externalKey === candidate.externalKey,
      ),
    ).toMatchObject({
      fileSha256: candidate.source.sha256,
      descriptionSha256: candidate.descriptionSha256,
      review: { description: 'checked' },
    });
    expect(candidate.noticeRequirementsComplete).toBe(false);
    expect(candidate.holdIds.length).toBeGreaterThan(0);
    expect(candidate.missingEvidence.length).toBeGreaterThan(0);
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    expect(assessment).toMatchObject({
      status: 'unresolved',
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-07',
      requiredNotices: candidate.requiredNotices,
    });
    expect(assessment?.evidenceFingerprints).toHaveProperty(
      candidate.evidenceId,
    );
    expect(reviewedAdmission.evidence[candidate.evidenceId]?.content).toContain(
      candidate.source.sha256,
    );
    expect(reviewedAdmission.evidence[candidate.evidenceId]?.content).toContain(
      candidate.source.location,
    );
  }
  for (const source of [...provenance.rawSources, ...provenance.dependencies]) {
    expect(
      sha256(await readFile(join(inputs.systemPath, source.path), 'utf8')),
    ).toBe(source.sha256);
  }
  expect(provenance.dependencies).toHaveLength(28);
});

it('reproduces all reviewed Spells without admitting held content or importing running Spell Effects', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.catalog.entries).toEqual(preview.entries);
  expect(
    artifact.catalog.entries.map((entry) => entry.externalKey).sort(),
  ).toEqual([...keys].sort());
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.summary).toMatchObject({
    required: 0,
    checked: 0,
    missing: 0,
    descriptions: { candidates: 44, checked: 44, drafted: 0 },
  });
  expect(artifact.curation.unresolvedMechanics).toEqual([]);
  expect(artifact.curation.unresolvedDescriptions).toHaveLength(14);
  for (const record of artifact.curation.unresolvedDescriptions) {
    expect(
      mechanics.candidates.find((row) => row.externalKey === record.externalKey)
        ?.outstandingCalculations.length,
    ).toBeGreaterThan(0);
  }
  for (const entry of artifact.catalog.entries) {
    expect(entry.detail.kind).toBe('spell');
    expect(entry.modifiers, entry.name).toEqual([]);
    expect(entry.sourceKey, entry.name).toBeUndefined();
    const candidate = review.candidates.find(
      (candidate) => candidate.externalKey === entry.externalKey,
    );
    if (!candidate)
      throw new Error(`Missing reviewed Spell: ${entry.externalKey}`);
    const raw = z
      .object({
        system: z.object({
          sources: z.array(z.object({ id: z.string(), pages: z.string() })),
        }),
      })
      .parse(
        parse(
          await readFile(
            join(inputs.systemPath, candidate.source.path),
            'utf8',
          ),
        ),
      );
    expect(entry.sources).toEqual(
      raw.system.sources.map((source: { id: string; pages: string }) => ({
        book: source.id,
        pages: source.pages,
      })),
    );
  }
  const gate = assessCatalogAdmission({ artifact, ...reviewedAdmission });
  expect(gate.admitted).toEqual([]);
  expect(
    [
      ...new Set(
        [...gate.held, ...gate.failures].map((row) => row.externalKey),
      ),
    ].sort(),
  ).toEqual([...keys].sort());
  const bull = gate.held.find(
    (row) => row.externalKey === 'pf1/05i5rxwim12hwktu',
  );
  expect(bull).toBeDefined();
  const entry = artifact.catalog.entries.find(
    (row) => row.externalKey === 'pf1/05i5rxwim12hwktu',
  );
  const assessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === entry?.externalKey,
  );
  if (!entry || !assessment)
    throw new Error('Missing source-bound Bull’s Strength');
  expect(assessment).toMatchObject(
    buildAssessmentBinding({
      entry,
      artifact,
      ...reviewedAdmission,
      requiredNotices: assessment.requiredNotices,
      evidenceIds: Object.keys(assessment.evidenceFingerprints),
    }),
  );
  expect(
    review.candidates.find((row) => row.externalKey === 'pf1/05i5rxwim12hwktu')
      ?.comparison?.completeDirectComparison,
  ).toBe(false);
});

it('pins Bull’s Strength’s class and grant levels separately from the +4 running effect described in its prose', () => {
  const bull = spellFixture("Bull's Strength");
  expect(bull.externalKey).toBe('pf1/05i5rxwim12hwktu');
  expect(bull.sources).toEqual([{ book: 'PZO1110', pages: '251' }]);
  expect(bull.detail.levels).toMatchObject({
    wizard: 2,
    cleric: 2,
    druid: 2,
    paladin: 2,
    alchemist: 2,
    summonerUnchained: 2,
  });
  expect(bull.detail.grantedLevels).toEqual({
    bloodline: { Abyssal: 2, Orc: 2 },
    domain: { Strength: 2 },
    subDomain: { Rage: 2 },
  });
  expect(bull.detail.school).toBe('trs');
  expect(bull.description).toContain('+4 enhancement bonus');
  expect(bull.modifiers).toEqual([]);
  expect(
    mechanics.candidates
      .find((row) => row.externalKey === bull.externalKey)
      ?.outstandingCalculations.join(' '),
  ).toContain('outside this batch');
  const result = calculateCharacterSheetProjections(
    recordedSpellSheet("Bull's Strength"),
  );
  for (const projection of [result.current, result.permanent]) {
    expect(projection.abilities.strength.score).toBe(10);
    expect(projection.breakdowns['attack.melee'].total).toBe(0);
    expect(
      projection.spellCollections.spellsWithoutSpellcasting,
    ).toContainEqual(
      expect.objectContaining({
        entryId: 'spell-row',
        spellLevel: 2,
        explicitLevel: 2,
      }),
    );
  }
});

it('keeps Protection from Spells’ +8 and Divine Power’s capped scaling as effect prose rather than unconditional bonuses', () => {
  const protection = spellFixture('Protection from Spells');
  expect(protection.detail).toMatchObject({
    school: 'abj',
    levels: { wizard: 8, summoner: 6 },
    grantedLevels: { domain: { Magic: 8 } },
  });
  expect(protection.sources).toEqual([{ book: 'PZO1110', pages: '328' }]);
  expect(protection.modifiers).toEqual([]);
  expect(protection.situationalNotes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        target: 'saves',
        situation: 'spells',
        text: expect.stringContaining('+8'),
      }),
      expect.objectContaining({
        target: 'saves',
        situation: 'spellLike',
        text: expect.stringContaining('+8'),
      }),
    ]),
  );
  const recordedProtection = calculateCharacterSheetProjections(
    recordedSpellSheet('Protection from Spells'),
    { situations: ['spells', 'spellLike'] },
  );
  for (const projection of [
    recordedProtection.current,
    recordedProtection.permanent,
  ]) {
    expect(projection.derivedStatistics.fortitude.total).toBe(0);
    expect(projection.derivedStatistics.reflex.total).toBe(0);
    expect(projection.derivedStatistics.will.total).toBe(0);
  }
  const divine = spellFixture('Divine Power');
  expect(divine.detail.levels).toMatchObject({
    cleric: 4,
    oracle: 4,
    warpriest: 4,
  });
  expect(divine.description).toContain('every three caster levels');
  expect(divine.description).toContain('maximum +6');
  expect(divine.modifiers).toEqual([]);
  const batchRecords = curation.records.filter((record) =>
    keys.includes(record.externalKey),
  );
  expect(batchRecords).toHaveLength(44);
  for (const record of batchRecords) {
    expect(record.kind).toBe('description');
    expect(record.status).toBe('checked');
    expect(record.outputs.every((output) => output.kind === 'note')).toBe(true);
  }
});

it('invalidates the exact checked description when the source bonus text changes', async () => {
  const work = resolve('.scratch/spells-516-test-work');
  await mkdir(work, { recursive: true });
  const root = await mkdtemp(join(work, 'changed-description-'));
  temporary.push(root);
  await cp(fixtureRoot, root, { recursive: true });
  const sourcePath = join(
    root,
    'pf1/packs/spells/protection-from-spells.0kppkhsencd6tzvh.yaml',
  );
  const raw = await readFile(sourcePath, 'utf8');
  expect(raw).toContain('+8 resistance bonus');
  await writeFile(
    sourcePath,
    raw.replace('+8 resistance bonus', '+9 resistance bonus'),
  );
  const artifact = await importCatalog({
    ...inputs,
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
  });
  expect(artifact.curation.stale).toContainEqual(
    expect.objectContaining({
      externalKey: 'pf1/0kppkhsencd6tzvh',
      kind: 'description',
    }),
  );
  expect(artifact.curation.summary.descriptions.checked).toBe(43);
  expect(
    artifact.curation.applied.some(
      (record) => record.externalKey === 'pf1/0kppkhsencd6tzvh',
    ),
  ).toBe(false);
  expect(
    artifact.catalog.entries.find(
      (entry) => entry.externalKey === 'pf1/0kppkhsencd6tzvh',
    )?.modifiers,
  ).toEqual([]);
  expect(
    assessCatalogAdmission({ artifact, ...reviewedAdmission }).admitted,
  ).toEqual([]);
});
