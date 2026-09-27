/**
 * The engine reports a missing check die twice: as its dice (`<check>:1d20`,
 * or `<choice>:check:1d20` for an Activity check) and as the check's absent
 * roll (`<check>:roll`). Both ask for the same entry, so every list a player
 * reads, and every count of decisions left, keeps only the dice code.
 */
export function withoutDuplicateRollCodes(codes: readonly string[]) {
  const dice = new Set(
    codes.flatMap((code) => /^(.*):\d+d\d+$/.exec(code)?.slice(1, 2) ?? []),
  );
  return codes.filter((code) => {
    const check = /^(.*):roll$/.exec(code)?.[1];
    return (
      check === undefined || !(dice.has(check) || dice.has(`${check}:check`))
    );
  });
}
