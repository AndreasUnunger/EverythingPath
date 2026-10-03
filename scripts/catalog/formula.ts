import {
  FormulaError,
  parseFormula,
} from '../../src/lib/character-sheet-formulas.ts';

// Parse only the documented arithmetic grammar. No Foundry expression is executed.
export function mapFormula({
  input,
  classTag,
  allowCasterLevel = false,
}: {
  input: string;
  classTag?: string;
  allowCasterLevel?: boolean;
}): string | number | undefined {
  const formula = input
    .replace(/@abilities\.(str|dex|con|int|wis|cha)\.mod\b/g, '@ability.$1.mod')
    .replaceAll('@attributes.hd.total', '@hitDice')
    .replaceAll('@attributes.bab.total', '@bab')
    .replaceAll('@details.level', '@level')
    .replaceAll(
      '@class.level',
      classTag ? `@classLevel.${classTag}` : '@unresolvedClass',
    )
    .replace(/@item\.level\b/g, '@unresolvedItem');
  try {
    parseFormula(formula);
  } catch (error) {
    if (!(error instanceof FormulaError)) throw error;
    return undefined;
  }
  if (/^-?\d+$/.test(formula.trim())) {
    const number = Number(formula);
    return Number.isSafeInteger(number) ? number : undefined;
  }
  const variables = formula.match(/@[A-Za-z][A-Za-z0-9_.]*/g) ?? [];
  const supportedVariable =
    /^@(?:level|hitDice|bab|ability\.(?:str|dex|con|int|wis|cha)\.mod|classLevel\.[A-Za-z][A-Za-z0-9_.]*|casterLevel\.[A-Za-z][A-Za-z0-9_.]*)$/;
  if (
    variables.some(
      (name) =>
        !supportedVariable.test(name) &&
        !(allowCasterLevel && name === '@casterLevel'),
    )
  )
    return undefined;
  return formula.trim();
}
