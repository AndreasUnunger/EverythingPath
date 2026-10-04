'use client';
import { SaveFeedback } from './sheet-parts';
import type { useCharacterMove } from './use-character-move';
import {
  moveOutcomeText,
  rosterNote,
  type MoveOutcome,
} from './use-move-outcome';

type Movement = ReturnType<typeof useCharacterMove>;

/**
 * Saving, a watched move's result, or the refusal or uncertain reply verbatim,
 * beside the control that started it. A saved preparation is acknowledged by
 * the progress panel, never as a moved Character.
 */
export function MoveFeedback({
  movement,
  outcome,
}: {
  movement: Movement;
  outcome: MoveOutcome;
}) {
  const { status } = movement;
  const shown =
    status.kind === 'error' || status.kind === 'saving'
      ? status
      : outcome
        ? ({ kind: 'saved' } as const)
        : ({ kind: 'idle' } as const);
  const savedText = outcome
    ? movement.currentCampaignHasMilitia &&
      (outcome === 'moved' || outcome === 'added')
      ? `${moveOutcomeText[outcome]} ${rosterNote}`
      : moveOutcomeText[outcome]
    : '';
  return (
    <SaveFeedback
      status={shown}
      savedText={savedText}
      savingText="Saving move…"
      shouldHideWhenIdle
    />
  );
}
