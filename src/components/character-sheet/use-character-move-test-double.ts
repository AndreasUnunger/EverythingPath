// A sheet whose owner has no campaign move: page-level tests render the
// whole sheet, and membership has its own presentation tests
// (character-move-control.test.tsx).
export function useCharacterMove() {
  return {
    isAvailable: false,
    isLoading: false,
    readError: null,
    progress: null,
    needsInspection: false,
    operatorStatus: null,
    isBusy: false,
    status: { kind: 'idle' as const },
  };
}
