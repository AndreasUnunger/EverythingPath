// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { beforeAll, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { importCatalog } from '../../scripts/catalog/import';
import {
  computeFingerprint,
  assessCatalogAdmission,
  buildAssessmentBinding,
} from '../../scripts/catalog/admission';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import {
  sourceDescription,
  upstreamRecord,
} from '../../scripts/catalog/records';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import { calculateCharacterSheetProjections } from '../../src/lib/character-sheet';
import {
  review,
  spells,
  preview,
  bindingPreview,
  provenance,
} from '../fixtures/spells-536/data';
import { spellFixture, recordedSpellSheet } from '../fixtures/spells-536/sheet';
import {
  findCommittedBatchOwnershipProblems,
  findRecordedBindingProblems,
} from './batch-ownership';
const root = resolve('tests/fixtures/spells-536');
const keys = spells.map((r) => r.externalKey);
const hash = (s: string | Buffer) =>
  createHash('sha256').update(s).digest('hex');
const inputs = {
  systemPath: join(root, 'pf1'),
  contentPath: join(root, 'pf1-content'),
  remaps: bindingPreview.remaps,
  curation: reviewedCuration,
};
it('retains independently reviewed manual effects even for protected historical roots', () => {
  expect(review.mechanicsSummary.protectedRoots).toBe(25);
  for (const row of spells) {
    const record = reviewedCuration.records.find(
      (r) => r.externalKey === row.externalKey && r.kind === 'description',
    );
    expect(record).toMatchObject({
      text: row.fullContentReview.descriptionText,
      status: 'checked',
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-12',
    });
    expect(record?.outputs).toEqual(
      row.mechanicsReview.protectedHistoricalContext
        ? []
        : row.mechanicsReview.reviewedOptionalOutputs,
    );
    expect(record?.diagnostics.map((d) => d.text)).toEqual(
      row.mechanicsReview.protectedHistoricalContext
        ? []
        : row.mechanicsReview.outstanding,
    );
    expect(row.mechanicsReview.outstanding).toHaveLength(1);
    expect(row.mechanicsReview.governingNoteCount).toBe(0);
    for (const output of row.mechanicsReview.reviewedOptionalOutputs) {
      expect(output.kind).toBe('note');
      if (output.kind === 'note')
        expect(output.text.length).toBeLessThanOrEqual(4096);
    }
  }
});
it.each([
  ['Corruption Resistance', '15 points at 11th level'],
  ['Jump', '+30 (the maximum) at caster level 9th'],
  ["Cat's Grace", '+4 enhancement bonus to Dexterity'],
  ['Guidance', '+1 competence bonus'],
  ['Power Word Stun', '151 or more hit points'],
  ['Freezing Sphere', 'DC 25 Escape Artist check'],
  ['Dimension Door', 'additional 4d6 points of damage'],
  ['Barbed Chains', 'a maximum of four at 10th level'],
])(
  'retains %s literal quantities without turning a recorded Spell into an effect',
  (name, value) => {
    expect(
      spells.find((r) => r.name === name)?.mechanicsReview.manualRule,
    ).toContain(value);
    const spell = spellFixture(name);
    const tag = Object.keys(spell.detail.levels)[0];
    if (!tag) throw new Error(name);
    const result = calculateCharacterSheetProjections(
      recordedSpellSheet(name, tag),
    );
    for (const projection of [result.current, result.permanent]) {
      expect(projection.abilities.strength.score).toBe(10);
      expect(projection.abilities.dexterity.score).toBe(10);
      expect(projection.spellEffects).toEqual([]);
    }
  },
);
it('keeps the attitude contradiction, missing base identity and holder-specific shared Situations explicit', () => {
  expect(
    spells
      .find((r) => r.name === 'Denounce')
      ?.mechanicsReview.discrepancies.join(' '),
  ).toContain('indifferent→unfriendly');
  expect(
    spells.find((r) => r.name === 'Hydraulic Push')?.mechanicsReview
      .sharedSituations,
  ).toEqual(['bullRush']);
  const hollow = spells.find((r) => r.name === 'Hollow Heroism, Greater');
  expect(hollow?.mechanicsReview.sharedSituations).toEqual(['fear']);
  expect(hollow?.mechanicsReview.reviewedOptionalOutputs).toContainEqual({
    kind: 'note',
    situation: 'fear',
    text: "Only after the caster reverses Hollow Heroism, Greater: the target's penalty increases to -8 against fear effects.",
  });
  expect(
    spells.find((r) => r.name === 'Forgetful Slumber')?.mechanicsReview
      .governingSpellBodies,
  ).toEqual([]);
  const dream = spells.find((r) => r.name === 'Demon Dream');
  expect(dream?.citedSources).toEqual([
    {
      date: '2013-10-23',
      name: 'Pathfinder Comics #10',
      pages: '',
      publisher: 'Dynamite Entertainment',
      url: 'https://paizo.com/products/btpy915f',
    },
  ]);
  expect(dream?.requiredNotices).toContain('DYN0010-A');
  expect(dream?.noticeHoldIds).toContain(
    'spells-536-notice-DYN0010-A-complete-chain',
  );
  expect(spellFixture('Demon Dream').sources).toEqual([
    { book: 'Pathfinder Comics #10', pages: '' },
  ]);
});
it('checks literal governing chains and consistent direct/indirect roles against the actual intermediate owner body', async () => {
  for (const row of spells)
    for (const body of row.mechanicsReview.governingSpellBodies) {
      expect(body.relationship.reason).toBe(
        body.relationshipAudit.relationshipBasis,
      );
      expect(body.relationshipAudit.path[0]?.externalKey).toBe(row.externalKey);
      const path = body.relationshipAudit.path;
      expect(path[path.length - 1]?.externalKey).toBe(body.externalKey);
      expect(body.relationship.kind).toBe(
        path.length > 2 ? 'indirect-governing-spell' : 'direct-governing-spell',
      );
      const raw = upstreamRecord.parse(
        parse((await readFile(join(root, body.fixturePath))).toString()),
      );
      expect(sourceDescription(raw)).toBe(body.descriptionText);
      expect(raw.name).toBe(body.name);
      const owner = [...provenance.rawSources, ...provenance.dependencies].find(
        (r) => r.externalKey === body.rootEvidenceOwner,
      );
      if (!owner) throw new Error(body.rootEvidenceOwner);
      const ownerRaw = upstreamRecord.parse(
        parse((await readFile(join(root, 'pf1', owner.path))).toString()),
      );
      expect(
        sourceDescription(ownerRaw).slice(
          body.rootEvidenceStart,
          body.rootEvidenceEnd,
        ),
      ).toBe(body.rootEvidence);
      expect(body.noteCount).toBe(0);
    }
  const dream = spells.find((r) => r.name === 'Demon Dream');
  expect(
    dream?.mechanicsReview.governingSpellBodies.map((r) => r.name),
  ).toEqual(['Dream', 'Nightmare']);
});
it('pins the ordinary Alchemist, Summoner and Warpriest rules and excludes item recipe branches', async () => {
  const bodies = spells.flatMap((r) => r.inheritedRuleSourceEvidence);
  expect(bodies).toHaveLength(5);
  for (const body of bodies) {
    const bytes = await readFile(join(root, body.fixturePath));
    expect(hash(bytes)).toBe(body.sha256);
    const raw = upstreamRecord.parse(parse(bytes.toString()));
    expect(raw.name).toBe(body.name);
    expect(raw._id).toBe(body.externalKey.split('/')[1]);
    if (body.ruleKind === 'class-feature') {
      const system = z
        .object({
          subType: z.string(),
          associations: z.object({ classes: z.array(z.string()) }),
        })
        .parse(raw.system);
      expect(system.subType).toBe('classFeat');
      expect(system.associations.classes).toContain(body.owningClassOrRace);
    }
    expect(body.relationship.reason).toBe(
      body.relationshipAudit.relationshipBasis,
    );
    expect(hash(body.descriptionText)).toBe(body.descriptionSha256);
    if (body.completeGoverningBody)
      expect(sourceDescription(raw)).toBe(body.descriptionText);
    else expect(sourceDescription(raw)).toContain(body.descriptionText);
  }
  const bag = spells.find((r) => r.name === 'Adhesive Spittle')
    ?.inheritedRuleSourceEvidence[0];
  expect(bag).toMatchObject({
    name: 'Tanglefoot Bag',
    role: 'partial-governing-body',
    completeGoverningBody: false,
  });
  expect(bag?.descriptionText).toContain(
    'Huge or larger creatures are unaffected',
  );
  expect(bag?.descriptionText).not.toContain('Alchemical Recipe');
  expect(bag?.descriptionText).not.toContain('Alchemical Power Component');
  const bomb = spells.find((r) => r.name === 'Languid Bomb Admixture')
    ?.inheritedRuleSourceEvidence[0];
  expect(bomb).toMatchObject({
    name: 'Bomb',
    owningClassOrRace: 'Alchemist',
    externalKey: 'pf1/7gHiZBNHjwefbBLI',
  });
  expect(bomb?.descriptionText).toContain('Splash damage');
  const eidolon = spells.find((r) => r.name === 'Anti-Summoning Shield')
    ?.inheritedRuleSourceEvidence[0];
  expect(eidolon).toMatchObject({
    name: 'Eidolon',
    owningClassOrRace: 'Summoner',
    externalKey: 'pf1/YmWKyC6bPUqHf9iQ',
  });
  expect(eidolon?.descriptionText).toContain('ritual that takes 1 minute');
});
let selected: Awaited<ReturnType<typeof importCatalog>>,
  context: Awaited<ReturnType<typeof importCatalog>>;
beforeAll(async () => {
  selected = await importCatalog({ ...inputs, candidateKeys: keys });
  context = await importCatalog({
    ...inputs,
    candidateKeys: bindingPreview.candidateKeys,
  });
});
it('reviews exactly the ordered100 Spell keys and keeps literal source identities intact', async () => {
  expect(review.ticket).toBe(536);
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(selected.catalog.entries.map((r) => r.externalKey)).toEqual(keys);
  expect(context.catalog.entries.map((r) => r.externalKey)).toEqual(
    bindingPreview.candidateKeys,
  );
  expect(hash(keys.join('\n'))).toBe(provenance.orderedTicketKeysSha256);
  expect(review.summary).toEqual({
    rawCandidates: 100,
    spellDefinitions: 100,
    held: 62,
    // #544 whole-content wave 2 admits Cure Light Wounds and Silent Image, so
    // Cure Serious Wounds and Programmed Image follow (root option B).
    admitted: 37,
    excluded: 0,
    dependentOmissions: 1,
    unsupportedProseOnly: 0,
    recordLevel35Holds: 0,
  });
  const tagged: string[] = [];
  const domainOnly: string[] = [];
  for (const row of spells) {
    const bytes = await readFile(join(inputs.systemPath, row.source.path));
    const raw = upstreamRecord.parse(parse(bytes.toString()));
    expect(hash(bytes)).toBe(row.source.sha256);
    expect(raw._key).toBe('!items!' + row.externalKey.split('/')[1]);
    expect(raw.type).toBe('spell');
    expect(sourceDescription(raw)).toBe(row.fullContentReview.descriptionText);
    expect(hash(sourceDescription(raw))).toBe(row.descriptionSha256);
    expect(raw.system).toEqual(row.fullContentReview.completeRawSystem);
    expect(raw.system.sources ?? []).toEqual(row.citedSources);
    const entry = selected.catalog.entries.find(
      (e) => e.externalKey === row.externalKey,
    );
    if (entry?.detail.kind !== 'spell') throw new Error(row.name);
    expect(entry.detail.levels).toEqual(
      z
        .object({ class: z.record(z.string(), z.number()).optional() })
        .parse(raw.system.learnedAt).class ?? {},
    );
    if (
      !Object.hasOwn(
        z.record(z.string(), z.unknown()).parse(raw.system.learnedAt),
        'class',
      )
    ) {
      domainOnly.push(row.name);
      expect(entry.detail.levels).toEqual({});
    }
    expect(entry.modifiers).toEqual([]);
    expect(row.mechanicsReview.outstanding.length).toBeGreaterThan(0);
    if (
      z
        .array(z.string())
        .parse(raw.system.tags ?? [])
        .includes('3.5')
    ) {
      tagged.push(row.name);
      expect(row.holdIds).toContain(
        'spells-536-' + raw._id + '-record-level3.5tag',
      );
    }
  }
  expect(tagged).toEqual([]);
  expect(domainOnly).toEqual([]);
});
it('enforces every inherited notice minimum and preserves current source-bound assessments', () => {
  for (const requirement of review.noticeRequirements) {
    if (requirement.book === 'PZO1110') {
      expect(requirement.registryKeys).toEqual(['CRB']);
      expect(requirement.holdId).toBeNull();
    } else
      expect(
        heldNotices.find((r) => r.id === requirement.holdId),
      ).toMatchObject({
        notices: expect.arrayContaining([
          requirement.book,
          ...requirement.registryKeys,
        ]),
        evidence: ['scripts/catalog/legal/spells-536.json'],
      });
  }
  for (const row of spells) {
    for (const dep of row.inheritedNoticeReview) {
      expect(row.requiredNotices).toContain(dep.book);
      expect(hash(dep.evidence)).toBe(dep.evidenceSha256);
    }
    expect(row.requiredNotices).toContain('PZO1110');
    const entry = context.catalog.entries.find(
      (e) => e.externalKey === row.externalKey,
    );
    if (!entry) throw new Error(row.name);
    const binding = buildAssessmentBinding({
      entry,
      artifact: context,
      ...reviewedAdmission,
      requiredNotices: row.requiredNotices,
      evidenceIds: [row.evidenceId],
    });
    expect(
      reviewedAdmission.assessments.find(
        (r) => r.externalKey === row.externalKey,
      ),
    ).toMatchObject({
      ...binding,
      status: row.assessmentStatus,
      requiredNotices: row.requiredNotices,
    });
    expect(
      findRecordedBindingProblems({
        recorded: row.binding,
        current: binding,
        evidenceId: row.evidenceId,
      }),
      row.name,
    ).toEqual([]);
  }
  const gate = assessCatalogAdmission({
    artifact: context,
    ...reviewedAdmission,
  });
  // #536 whole-content wave 1: the 35 admitted launch rows pass; the three
  // whose bodies link a spell still held elsewhere are dependently omitted.
  const ours = (rows: { externalKey: string }[]) =>
    rows
      .map((r) => r.externalKey)
      .filter((key) => keys.includes(key))
      .sort();
  expect(ours(gate.admitted)).toEqual(
    [...review.launchReassessment.admittedKeys].sort(),
  );
  expect(ours(gate.dependentOmissions)).toEqual(
    [...review.launchReassessment.dependentlyOmittedKeys].sort(),
  );
  expect(computeFingerprint(selected.catalog.entries)).toBe(
    computeFingerprint(preview.entries),
  );
  expect(computeFingerprint(context.catalog.entries)).toBe(
    computeFingerprint(bindingPreview.entries),
  );
  expect(selected.curation.passed).toBe(true);
  expect(selected.curation.summary.required).toBe(0);
  expect(selected.curation.summary.descriptions.checked).toBe(100);
});
it('keeps its own description records, assessments, evidence and holds as recorded', () => {
  expect(
    findCommittedBatchOwnershipProblems(
      'scripts/catalog/legal/spells-536.json',
    ),
  ).toEqual([]);
});
it('independently checks whole PCGen positive DisplayFullSpell branches and their textual comparisons', async () => {
  let count = 0,
    matches = 0;
  const normalized = (s: string) =>
    s
      .replace(/&amp;/g, '&')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
  for (const row of spells) {
    const comparison = row.fullContentReview.directComparison;
    if (!comparison) continue;
    const bytes = await readFile(join(root, comparison.source)),
      lines = bytes.toString().split('\n');
    expect(hash(bytes)).toBe(comparison.fileSha256);
    expect(lines[comparison.line - 1]).toBe(comparison.text);
    expect(hash(comparison.text)).toBe(comparison.lineSha256);
    const full = comparison.fullDescription;
    if (!full) {
      expect(row.name).toBe('Permanency');
      continue;
    }
    expect(lines[full.line - 1]).toBe(full.text);
    expect(hash(full.text)).toBe(full.lineSha256);
    expect(full.text).toContain('|PRERULE:1,DisplayFullSpell');
    expect(full.text).not.toContain('|!PRERULE:1,DisplayFullSpell');
    const body = full.text.split('DESC:')[1]?.split('|PRERULE:')[0];
    if (!body) throw new Error(row.name);
    const equal =
      normalized(row.mechanicsReview.manualRule) === normalized(body);
    expect(full.normalizedEqual, row.name).toBe(equal);
    count++;
    if (equal) matches++;
  }
  expect(count).toBe(24);
  expect(matches).toBe(20);
});

type LaunchRow = (typeof spells)[number];
type LaunchReview = NonNullable<LaunchRow['launchReview']>;

// The 41 launch rows cite four pinned PCGen files. The pinned store is never
// written, so each file's bytes are read, hashed and split once; every row
// still checks the recorded file hash and its literal rows.
const pinnedFiles = new Map<
  string,
  Promise<{ sha256: string; lines: readonly string[] }>
>();
function readPinnedPcgen(path: string) {
  let file = pinnedFiles.get(path);
  if (!file) {
    file = readFile(join('tests/fixtures/pinned/pcgen', path)).then(
      (bytes) => ({
        sha256: hash(bytes),
        lines: Object.freeze(bytes.toString().split('\n')),
      }),
    );
    pinnedFiles.set(path, file);
  }
  return file;
}

// Each launch row cites the literal pinned PCGen rows and its book pages.
async function expectPinnedPcgenRows(
  row: LaunchRow,
  launchReview: LaunchReview,
) {
  const { pcgen } = launchReview;
  const { sha256, lines } = await readPinnedPcgen(pcgen.path);
  expect(sha256, row.name).toBe(pcgen.fileSha256);
  expect(lines[pcgen.line - 1], row.name).toBe(pcgen.literalRow);
  expect(hash(pcgen.literalRow), row.name).toBe(pcgen.lineSha256);
  expect(lines[pcgen.baseRow.line - 1], row.name).toBe(
    pcgen.baseRow.literalRow,
  );
  expect(hash(pcgen.baseRow.literalRow), row.name).toBe(
    pcgen.baseRow.lineSha256,
  );
  expect(pcgen.textMatches, row.name).toBe(pcgen.wordDifferences.length === 0);
  const cited = z
    .array(z.object({ id: z.string(), pages: z.string() }))
    .parse(row.citedSources);
  expect(launchReview.books, row.name).toEqual(
    Object.fromEntries(cited.map((source) => [source.id, source.pages])),
  );
  for (const source of cited)
    expect(pcgen.baseRow.literalRow, row.name).toContain(
      `SOURCEPAGE:p.${source.pages}`,
    );
}

// A named hold keeps the row held; every other launch row is confirmed and
// supersedes its whole-content hold.
function expectLaunchOutcome(row: LaunchRow) {
  const launch = review.launchReassessment;
  const id = row.externalKey.split('/')[1];
  expect(row.assessmentHistory?.[0]?.holdIds, row.name).toEqual([
    `spells-536-whole-content-${id}`,
  ]);
  const assessment = reviewedAdmission.assessments.find(
    (r) => r.externalKey === row.externalKey,
  );
  const named = launch.namedHolds[row.externalKey];
  if (named) {
    expect(row, row.name).toMatchObject({
      disposition: 'held',
      assessmentStatus: 'unresolved',
      holdIds: [named],
    });
    expect(assessment?.rationale, row.name).toContain(named);
    return;
  }
  expect(row, row.name).toMatchObject({
    disposition: launch.admittedKeys.includes(row.externalKey)
      ? 'admitted'
      : 'dependently-omitted',
    assessmentStatus: 'confirmed',
    holdIds: [],
    noticeHoldIds: [],
  });
  expect(assessment?.rationale, row.name).toContain(
    `spells-536-whole-content-${id}`,
  );
}

it('pins the launch re-assessment of the 41 launch rows to the literal pinned PCGen rows (#536 whole-content wave 1)', async () => {
  const launch = review.launchReassessment;
  const assessed = spells.filter((row) => row.launchReview);
  expect(assessed).toHaveLength(41);
  // #544 whole-content wave 2 moved two omissions to admitted (option B).
  expect(launch.admittedKeys).toHaveLength(37);
  expect(launch.dependentlyOmittedKeys).toHaveLength(1);
  expect(Object.keys(launch.namedHolds)).toHaveLength(3);
  for (const row of assessed) {
    if (!row.launchReview) throw new Error(row.name);
    await expectPinnedPcgenRows(row, row.launchReview);
    expectLaunchOutcome(row);
  }
  // The batch's other 59 candidates keep their earlier review and holds.
  for (const row of spells.filter((r) => !r.launchReview)) {
    expect(row.disposition, row.name).toBe('held');
    expect(row.assessmentStatus, row.name).toBe('unresolved');
    expect(row.holdIds, row.name).toContain(
      `spells-536-whole-content-${row.externalKey.split('/')[1]}`,
    );
  }
  const spell = (name: string) => {
    const row = spells.find((r) => r.name === name);
    if (!row?.launchReview) throw new Error(name);
    return { row, pcgen: row.launchReview.pcgen };
  };
  const cat = spell("Cat's Grace");
  expect(cat.row.disposition).toBe('admitted');
  expect(cat.pcgen).toMatchObject({
    path: 'data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_spells.lst',
    line: 840,
    textMatches: true,
    baseRow: { line: 78 },
  });
  expect(cat.pcgen.literalRow).toContain('+4 enhancement bonus to Dexterity');
  const deflection = spell('Deflection');
  expect(deflection.row.disposition).toBe('admitted');
  expect(deflection.pcgen).toMatchObject({
    path: 'data/pathfinder/paizo/roleplaying_game/advanced_players_guide/apg_spells.lst',
    line: 1915,
    textMatches: true,
  });
  // Admitted once its linked Cure Light Wounds was (#544 whole-content wave 2).
  const cure = spell('Cure Serious Wounds');
  expect(cure.row.disposition).toBe('admitted');
  expect(cure.row.fullContentReview.descriptionText).toContain(
    '@UUID[Compendium.pf1.spells.Item.xoc3vhg3btmfjauq]',
  );
  const permanency = spell('Permanency');
  expect(permanency.row.disposition).toBe('held');
  expect(permanency.pcgen.wordDifferences).toEqual([
    { pinned: '12', pcgen: '7' },
  ]);
  expect(permanency.row.fullContentReview.descriptionText).toMatch(
    /wall of force<\/i><\/td><td>13th<\/td><td>12,500 gp/i,
  );
  expect(permanency.pcgen.literalRow).toContain(
    '[Wall of force 13th 7,500 gp]',
  );
  const geas = spell('Geas, Lesser');
  expect(geas.row.disposition).toBe('held');
  expect(geas.row.learnedAt).toMatchObject({ class: { bard: 3 } });
  expect(geas.pcgen.baseRow.literalRow).toContain(
    'CLASSES:Bard,Sorcerer,Wizard=4',
  );
});
