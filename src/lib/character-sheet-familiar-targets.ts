import { z } from 'zod';
import { skillDefinitions } from './character-sheet-skill-definitions';

export const familiarUnresolvedTargetSchema = z.enum([
  'hitDice',
  'size',
  'ability.int',
  'ac.natural',
  'familiar.progression',
  'familiar.effectiveHitDice',
  'hp',
  'bab',
  'attack.melee',
  'attack.ranged',
  'cmb',
  'cmd',
  'save.fort',
  'save.ref',
  'save.will',
  ...skillDefinitions.map(({ key }) => key),
]);
export type FamiliarUnresolvedTarget = z.infer<
  typeof familiarUnresolvedTargetSchema
>;

export const familiarStatisticTargetSchema = z.enum([
  ...familiarUnresolvedTargetSchema.options,
  'derived.ac',
  'derived.touchAc',
  'derived.flatFootedAc',
  'derived.fortitude',
  'derived.reflex',
  'derived.will',
  'derived.bab',
  'derived.cmb',
  'derived.cmd',
  'derived.flatFootedCmd',
  'attackRoutine.attackBonus',
]);
export type FamiliarStatisticTarget = z.infer<
  typeof familiarStatisticTargetSchema
>;

const derivedDependencies = {
  'derived.ac': ['ac.natural', 'size'],
  'derived.touchAc': ['size'],
  'derived.flatFootedAc': ['ac.natural', 'size'],
  'derived.fortitude': ['save.fort'],
  'derived.reflex': ['save.ref'],
  'derived.will': ['save.will'],
  'derived.bab': ['bab'],
  'derived.cmb': ['cmb', 'bab', 'size'],
  'derived.cmd': ['cmd', 'bab', 'size'],
  'derived.flatFootedCmd': ['cmd', 'bab', 'size'],
  'attackRoutine.attackBonus': ['bab', 'attack.melee', 'attack.ranged', 'size'],
} satisfies Partial<
  Record<FamiliarStatisticTarget, FamiliarUnresolvedTarget[]>
>;

export function familiarAffectedStatisticTargets(
  targets: readonly FamiliarUnresolvedTarget[],
): FamiliarStatisticTarget[] {
  const unresolved = new Set(targets);
  const affected: FamiliarStatisticTarget[] = [...targets];
  for (const [target, dependencies] of Object.entries(derivedDependencies)) {
    if (dependencies.some((dependency) => unresolved.has(dependency)))
      affected.push(familiarStatisticTargetSchema.parse(target));
  }
  if (unresolved.has('ability.int')) {
    for (const skill of skillDefinitions)
      if (skill.ability === 'intelligence') affected.push(skill.key);
  }
  return [...new Set(affected)];
}
