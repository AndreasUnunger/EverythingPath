import { z } from 'zod';
import { skillDefinitions } from '../character-sheet-skill-definitions';
import {
  linkedInputKey,
  type CompanionLinkedInput,
  type CompanionLinkedInputCandidate,
} from '../character-sheet-linked-inputs';

// Representative prepared-sheet rules, not complete companion progression or a
// curated Catalog Release. Progression transformations/allocations belong to #325.
export const companionSourceRuleKindSchema = z.enum([
  'animalCompanion',
  'familiar',
  'cohort',
  'eidolon',
  'unchainedEidolon',
  'wizardFamiliar',
  'sorcererFamiliar',
  'witchFamiliar',
  'druidCompanion',
  'rangerCompanion',
]);
export type CompanionSourceRuleKind = z.infer<
  typeof companionSourceRuleKindSchema
>;
type Binding = {
  input: CompanionLinkedInput;
  sourceInput: CompanionLinkedInput;
  role?: CompanionLinkedInputCandidate['role'];
  precedence?: number;
};
type Rule = {
  contributingClassRuleIdentity?: string;
  inputs: Binding[];
  sources: { book: string; pages: string; url: string }[];
};
const sameInput = (input: CompanionLinkedInput): Binding => ({
  input,
  sourceInput: input,
});
const classLevels = (classRuleIdentity: string): CompanionLinkedInput => ({
  kind: 'classLevels',
  classRuleIdentity,
});
const familiarInputs: Binding[] = [
  sameInput({ kind: 'characterLevel' }),
  sameInput({ kind: 'actualHitDice' }),
  sameInput({ kind: 'maximumHp' }),
  sameInput({ kind: 'baseAttackBonus' }),
  ...(['fort', 'ref', 'will'] as const).map((save) =>
    sameInput({ kind: 'baseSave', save }),
  ),
  ...skillDefinitions.map(({ key }) =>
    sameInput({ kind: 'skillRanks', skill: key }),
  ),
];
const crb = {
  book: 'Pathfinder RPG Core Rulebook',
  pages: '51–54, 67, 78, 82–83',
  url: 'https://legacy.aonprd.com/coreRulebook/classes.html',
};
const witch = {
  book: 'Pathfinder RPG Advanced Player’s Guide',
  pages: '66–69',
  url: 'https://legacy.aonprd.com/advancedPlayersGuide/baseClasses/witch.html',
};
const apg = {
  book: 'Pathfinder RPG Advanced Player’s Guide',
  pages: '54–63',
  url: 'https://legacy.aonprd.com/advancedPlayersGuide/baseClasses/summoner.html',
};
const unchained = {
  book: 'Pathfinder Unchained',
  pages: '25–34',
  url: 'https://legacy.aonprd.com/unchained/classes/summoner.html',
};
export const representativeCompanionRules: Record<
  CompanionSourceRuleKind,
  Rule
> = {
  familiar: {
    inputs: [
      ...familiarInputs,
      sameInput({ kind: 'familiarProgressionLevels' }),
      sameInput(classLevels('wizard')),
      sameInput(classLevels('sorcerer')),
      sameInput(classLevels('witch')),
    ],
    sources: [crb, witch],
  },
  wizardFamiliar: {
    contributingClassRuleIdentity: 'wizard',
    inputs: [
      ...familiarInputs,
      sameInput(classLevels('wizard')),
      {
        input: { kind: 'familiarProgressionLevels' },
        sourceInput: { kind: 'familiarProgressionLevels' },
        role: 'alternative',
        precedence: 1,
      },
    ],
    sources: [crb],
  },
  sorcererFamiliar: {
    contributingClassRuleIdentity: 'sorcerer',
    inputs: [
      ...familiarInputs,
      sameInput(classLevels('sorcerer')),
      {
        input: { kind: 'familiarProgressionLevels' },
        sourceInput: { kind: 'familiarProgressionLevels' },
        role: 'alternative',
        precedence: 1,
      },
    ],
    sources: [crb],
  },
  witchFamiliar: {
    contributingClassRuleIdentity: 'witch',
    inputs: [
      ...familiarInputs,
      sameInput(classLevels('witch')),
      {
        input: { kind: 'familiarProgressionLevels' },
        sourceInput: { kind: 'familiarProgressionLevels' },
        role: 'alternative',
        precedence: 0,
      },
    ],
    sources: [witch],
  },
  animalCompanion: {
    inputs: [sameInput(classLevels('druid')), sameInput(classLevels('ranger'))],
    sources: [crb],
  },
  druidCompanion: { inputs: [sameInput(classLevels('druid'))], sources: [crb] },
  rangerCompanion: {
    inputs: [sameInput(classLevels('ranger'))],
    sources: [crb],
  },
  cohort: {
    inputs: [sameInput({ kind: 'characterLevel' })],
    sources: [
      {
        book: crb.book,
        pages: '129',
        url: 'https://legacy.aonprd.com/coreRulebook/feats.html#leadership',
      },
    ],
  },
  eidolon: { inputs: [sameInput(classLevels('summoner'))], sources: [apg] },
  unchainedEidolon: {
    inputs: [sameInput(classLevels('summoner'))],
    sources: [unchained],
  },
};

const classLabels: Record<string, string> = {
  wizard: 'Wizard',
  sorcerer: 'Sorcerer',
  witch: 'Witch',
  druid: 'Druid',
  ranger: 'Ranger',
  summoner: 'Summoner',
};
export function listCuratedCompanionInputs({
  kind,
  sources,
}: {
  kind: CompanionSourceRuleKind;
  sources: readonly { ruleKind?: CompanionSourceRuleKind }[];
}) {
  const inputs = new Map<
    string,
    { input: CompanionLinkedInput; classLabel?: string }
  >();
  for (const source of sources)
    for (const { input } of representativeCompanionRules[
      source.ruleKind ?? kind
    ].inputs)
      inputs.set(linkedInputKey(input), {
        input,
        ...(input.kind === 'classLevels'
          ? { classLabel: classLabels[input.classRuleIdentity] }
          : {}),
      });
  return [...inputs.values()];
}
