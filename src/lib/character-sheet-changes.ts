type WarningStates = Readonly<Record<string, boolean>> | null;

export function detectRemoteWarningChange({
  previous,
  next,
  expectedOperations,
  isOwnOperation,
}: {
  previous: WarningStates;
  next: WarningStates;
  expectedOperations: ReadonlyMap<string, { accepted: boolean }>;
  isOwnOperation: boolean;
}) {
  const previousKeys = Object.keys(previous ?? {});
  const nextEntries = Object.entries(next ?? {});
  const changedFacts =
    previousKeys.length !== nextEntries.length ||
    previousKeys.some((key) => !Object.hasOwn(next ?? {}, key));
  const changedAcceptances = nextEntries.filter(
    ([key, accepted]) => accepted !== previous?.[key],
  );
  const acknowledged = changedAcceptances
    .filter(
      ([key, accepted]) => expectedOperations.get(key)?.accepted === accepted,
    )
    .map(([key]) => key);
  const unexpectedAcceptance = changedAcceptances.some(
    ([key, accepted]) =>
      expectedOperations.get(key)?.accepted !== accepted &&
      (accepted || previous?.[key] === true),
  );
  return {
    changed:
      (previous === null) !== (next === null) ||
      changedFacts ||
      changedAcceptances.length > 0,
    hasRemoteChange:
      previous !== null &&
      next !== null &&
      (unexpectedAcceptance || (changedFacts && !isOwnOperation)),
    acknowledged,
  };
}
