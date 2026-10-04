'use client';
import { useState } from 'react';
import { isMovePreparingOrReady } from './character-move-state';
import type { useCharacterMove } from './use-character-move';

type Movement = ReturnType<typeof useCharacterMove>;

export type MoveOutcome = 'moved' | 'added' | 'left' | 'cancelled' | null;

/**
 * What a move that this control watched ended as. The status read keeps a
 * Character's latest move, so a move finished before the control opened says
 * nothing; one seen preparing or ready here reports its completion or
 * cancellation. The Character's campaign stays authoritative until the move
 * is published, so the campaign seen while it was pending tells a move from
 * a join. A newer refusal always wins over an earlier success.
 */
export function useMoveOutcome(movement: Movement): MoveOutcome {
  const [watched, setWatched] = useState<{
    operationId: string;
    hadCampaign: boolean;
  } | null>(null);
  const progress = movement.progress;
  const isPending = isMovePreparingOrReady(progress);
  if (isPending && watched?.operationId !== progress.operationId)
    setWatched({
      operationId: progress.operationId,
      hadCampaign: movement.currentCampaignId !== undefined,
    });
  if (
    !progress ||
    watched?.operationId !== progress.operationId ||
    movement.status.kind === 'error' ||
    movement.isBusy
  )
    return null;
  if (progress.state === 'cancelled') return 'cancelled';
  if (progress.state !== 'completed') return null;
  if (movement.currentCampaignId === undefined) return 'left';
  return watched.hadCampaign ? 'moved' : 'added';
}

export const moveOutcomeText: Record<Exclude<MoveOutcome, null>, string> = {
  moved: 'Character moved.',
  added: 'Added to campaign.',
  left: 'Left campaign.',
  cancelled: 'Move cancelled. Your character stays in its current campaign.',
};

/** Joining or moving never puts the Character on a militia roster. */
export const rosterNote =
  'Add this character to the militia roster separately.';
