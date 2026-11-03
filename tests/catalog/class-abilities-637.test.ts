// @vitest-environment node
import { expect, it } from 'vitest';
import {
  bodyParagraphs,
  describeLaunchFeature,
  prdText,
} from './class-abilities-596';

// #637, MVP launch subset (#596 run A): Armor Training (Heavy Armor), admitted.
const { candidate, entry } = describeLaunchFeature({
  batch: 637,
  name: 'Armor Training (Heavy Armor)',
  disposition: 'admitted',
});

it('states heavy-armor speed from 7th level in a Note and leaves it outstanding', () => {
  const [sentence] = bodyParagraphs(candidate.mechanicsReview.descriptionText);
  expect(sentence).toBe(
    'At 7th level, a fighter can move at his normal speed while wearing heavy armor.',
  );
  expect(prdText(candidate.prdComparison.lines[0]!.text)).toMatch(
    new RegExp(`${sentence}$`),
  );
  expect(entry.modifiers).toEqual([]);
  expect(entry.situationalNotes?.map((note) => note.text)).toEqual([sentence]);
  expect(candidate.mechanicsReview.classFeatureReview.level).toBe(7);
  expect(
    candidate.mechanicsReview.classFeatureReview.schedule
      .filter((row) => row.value)
      .map((row) => row.level),
  ).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  expect(candidate.mechanicsReview.outstandingCalculations).toEqual([
    expect.objectContaining({ owner: '#716' }),
  ]);
  expect(candidate.comparison.literalRow).toContain(
    'UNENCUMBEREDMOVE:HeavyArmor',
  );
});
