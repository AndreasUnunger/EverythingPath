import type { CharacterMoveProgress } from './use-character-move';

export function isMovePreparingOrReady(
  progress: CharacterMoveProgress | null,
): progress is CharacterMoveProgress & { state: 'preparing' | 'ready' } {
  return progress?.state === 'preparing' || progress?.state === 'ready';
}
