// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  reviewedScheduleSlots,
  scheduleSlotRules,
} from '../../scripts/catalog/pcgen/schedule-slots';
import {
  bodyParagraphs,
  describeLaunchFeature,
  prdText,
  RUN_B_REVIEWED_ON,
} from './class-abilities-596';

// #613, MVP launch subset (#596 run B): Bonus Feats, admitted. Its ten
// everythingpath/fighter-bonus-feats-N increments take its assessment
// through attributionFrom.
const { candidate, entry } = describeLaunchFeature({
  batch: 613,
  name: 'Bonus Feats (FGT)',
  disposition: 'admitted',
  reviewedOn: RUN_B_REVIEWED_ON,
});

const SLOT = { kind: 'feat', count: 1, featTypes: ['Combat'] };
const INCREMENTS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map(
  (level) => `everythingpath/fighter-bonus-feats-${level}`,
);

it("gives the 1st-level acquisition one Combat feat slot, from the reviewed slot rule, and leaves Foundry's bonusFeats change unmapped", () => {
  expect(entry.grantsSlots).toEqual([SLOT]);
  expect(reviewedScheduleSlots().get(candidate.externalKey)).toEqual(SLOT);
  expect(
    scheduleSlotRules.find((rule) => rule.className === 'Fighter'),
  ).toEqual({
    className: 'Fighter',
    feature: 'bonus-feats',
    featTypes: ['Combat'],
    printed: 'coreRulebook/classes/fighter.html:380',
  });
  // Foundry's own count contributes nothing, so no slot is doubled.
  expect(entry.modifiers).toEqual([]);
  expect(entry.unsupported).toContainEqual({
    field: 'changes',
    reason:
      'Unmapped target, bonus type, formula or calculation-stage dependency; contributes nothing.',
    value: {
      target: 'bonusFeats',
      formula: '1 + floor(@class.level / 2)',
      type: 'untyped',
    },
  });
});

it('admits the ten increments with Bonus Feats, each with its own Combat slot, so a 20th-level Fighter has 11', () => {
  // The Fighter's committed full-corpus closure (classes-596) holds them.
  const { closure } = JSON.parse(
    readFileSync('tests/fixtures/classes-596/preview.json', 'utf8'),
  ) as {
    closure: {
      externalKey: string;
      upstreamKey: string;
      attributionFrom?: string;
      grantsSlots?: unknown[];
      detail: { parentFeature?: string };
    }[];
  };
  const increments = closure.filter(
    (row) => row.attributionFrom === candidate.externalKey,
  );
  expect(increments.map((row) => row.externalKey)).toEqual(
    expect.arrayContaining(INCREMENTS),
  );
  expect(increments).toHaveLength(10);
  for (const row of increments) {
    expect(row.upstreamKey).toBe(candidate.externalKey);
    expect(row.detail.parentFeature).toBe(candidate.externalKey);
    expect(row.grantsSlots).toEqual([SLOT]);
  }
  // Bonus feats by level: 1 + floor(level / 2), one more at 1st and each even level.
  const schedule = candidate.mechanicsReview.classFeatureReview.schedule;
  expect(schedule.map((row) => row.value)).toEqual(
    schedule.map((row) => 1 + Math.floor(row.level / 2)),
  );
  expect(
    schedule
      .filter((row, index) => row.value !== (schedule[index - 1]?.value ?? 0))
      .map((row) => row.level),
  ).toEqual([1, ...INCREMENTS.map((key) => Number(key.split('-').at(-1)))]);
  expect(schedule.at(-1)?.value).toBe(1 + increments.length);
  // PCGen grants the same count: BONUS:ABILITYPOOL|Fighter Bonus Feat|FighterLvl/2+1.
  expect(candidate.comparison.literalRow).toContain(
    'BONUS:ABILITYPOOL|Fighter Bonus Feat|FighterLvl/2+1',
  );
});

it('states the retraining rule as a Note and checks both paragraphs against the PRD', () => {
  const paragraphs = bodyParagraphs(candidate.mechanicsReview.descriptionText);
  const prd = candidate.prdComparison.lines.map((row) =>
    prdText(row.text).replace(/^Bonus Feats: /, ''),
  );
  expect(paragraphs[0]?.replace('Combat Feats', 'combat feats')).toBe(
    prd[0]?.replaceAll('&quot;', '"'),
  );
  expect(paragraphs[1]).toBe(prd[1]);
  // The first paragraph is the slots; retraining stays prose.
  expect(entry.situationalNotes?.map((note) => note.text)).toEqual([
    paragraphs[1],
  ]);
  expect(
    candidate.mechanicsReview.outstandingCalculations.map((row) => row.owner),
  ).toEqual(['#716', '#313']);
});
