// @vitest-environment node
import { expect, it } from 'vitest';
import {
  bodyParagraphs,
  describeLaunchFeature,
  prdText,
} from './class-abilities-596';

// #622, MVP launch subset (#596 run A): Armor Mastery, admitted. S3 attaches
// it at Fighter level 19; Foundry associates it with no level.
const { candidate, entry } = describeLaunchFeature({
  batch: 622,
  name: 'Armor Mastery',
  disposition: 'admitted',
});

it('states DR 5/— at 19th level in a Note and leaves the DR and its level-19 attachment outstanding', () => {
  const [sentence] = bodyParagraphs(candidate.mechanicsReview.descriptionText);
  expect(sentence).toBe(
    'At 19th level, a fighter gains damage reduction 5/— whenever he is wearing armor or using a shield.',
  );
  // The PRD says "DR 5/—" where the body spells it out.
  expect(prdText(candidate.prdComparison.lines[0]!.text)).toBe(
    sentence?.replace('damage reduction', 'DR'),
  );
  expect(entry.modifiers).toEqual([]);
  expect(entry.situationalNotes?.map((note) => note.text)).toEqual([sentence]);
  expect(candidate.grantEvidence.foundry).toBeNull();
  expect(candidate.grantEvidence.pcgen.map((row) => row.literalRow)).toEqual([
    expect.stringContaining(
      'Fighter ~ Armor Mastery|PREVAREQ:Fighter_CF_ArmorMastery,0|PREVARGTEQ:Fighter_CFP_Level,19',
    ),
  ]);
  expect(
    candidate.mechanicsReview.outstandingCalculations.map((row) => row.owner),
  ).toEqual(['#716', 'S3 (#596 run B; class release path)']);
});
