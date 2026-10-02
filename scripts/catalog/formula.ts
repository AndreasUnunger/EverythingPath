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
  if (/^-?\d+$/.test(formula.trim())) return Number(formula);
  const tokens =
    formula.match(/@[A-Za-z][A-Za-z0-9_.]*|[A-Za-z]+|\d+|[^\s]/g) ?? [];
  let index = 0;
  const variables =
    /^@(?:level|hitDice|bab|ability\.(?:str|dex|con|int|wis|cha)\.mod|classLevel\.[A-Za-z][A-Za-z0-9]*|casterLevel\.[A-Za-z][A-Za-z0-9]*)$/;
  function atom(): boolean {
    const token = tokens[index++];
    if (!token) return false;
    if (token === '+' || token === '-') return atom();
    if (
      /^\d+$/.test(token) ||
      variables.test(token) ||
      (allowCasterLevel && token === '@casterLevel')
    )
      return true;
    if (token === '(') return expression() && tokens[index++] === ')';
    if (
      !['floor', 'ceil', 'min', 'max'].includes(token) ||
      tokens[index++] !== '(' ||
      !expression()
    )
      return false;
    let argumentsCount = 1;
    while (tokens[index] === ',') {
      index++;
      if (!expression()) return false;
      argumentsCount++;
    }
    return (
      tokens[index++] === ')' &&
      (['floor', 'ceil'].includes(token)
        ? argumentsCount === 1
        : argumentsCount >= 2)
    );
  }
  function product(): boolean {
    if (!atom()) return false;
    while (tokens[index] === '*' || tokens[index] === '/') {
      index++;
      if (!atom()) return false;
    }
    return true;
  }
  function expression(): boolean {
    if (!product()) return false;
    while (tokens[index] === '+' || tokens[index] === '-') {
      index++;
      if (!product()) return false;
    }
    return true;
  }
  if (tokens.length > 200 || !expression() || index !== tokens.length)
    return undefined;
  return formula.trim();
}
