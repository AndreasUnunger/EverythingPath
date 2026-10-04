'use client';
import { ArrowRight, Check, Search, X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { action, fieldLabel } from './sheet-parts';
import type { useCharacterMove } from './use-character-move';
import { departureText, privateDepartureText } from './character-move-copy';
import { isMovePreparingOrReady } from './character-move-state';

type Movement = ReturnType<typeof useCharacterMove>;

function ProgressBar({ prepared, total }: { prepared: number; total: number }) {
  const done = Math.min(prepared, total);
  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-label="Homebrew preserved"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} of ${total}`}
        className="bg-foreground/10 h-1.5 min-w-0 flex-1 overflow-hidden"
      >
        <div
          className="bg-primary h-full transition-[width] motion-reduce:transition-none"
          style={{ width: `${(done / total) * 100}%` }}
        />
      </div>
      <span className="text-muted-foreground font-mono text-xs whitespace-nowrap">
        {done} of {total}
      </span>
    </div>
  );
}

/**
 * A saved move that isn't finished: preserving homebrew in bounded steps,
 * ready to publish, or a lost reply to check. The Character, its campaign
 * and the old roster stay as they are until Complete move is saved, so
 * nothing here reads as moved. Check progress inspects the recorded move
 * rather than starting another.
 */
export function MoveProgress({
  movement,
  isMilitiaOnly = false,
}: {
  movement: Movement;
  isMilitiaOnly?: boolean;
}) {
  const { progress } = movement;
  if (movement.needsInspection)
    return (
      <div className="flex w-full flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className={action}
          disabled={!movement.canResume}
          onClick={() => void movement.resumeMove()}
        >
          <Search aria-hidden /> Check progress
        </Button>
      </div>
    );
  if (!isMovePreparingOrReady(progress)) return null;
  const isReady = progress.state === 'ready';
  return (
    <section
      aria-label="Move progress"
      className="border-foreground/15 bg-card flex w-full flex-col gap-2 border p-2"
    >
      <div className="flex flex-col gap-0.5">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className={fieldLabel}>Move</span>
          <span>{isReady ? 'Ready to move' : 'Preserving homebrew…'}</span>
        </p>
        <p className="text-muted-foreground text-xs">
          {isReady
            ? 'Nothing changes until you complete the move.'
            : 'Your character stays in its current campaign until the move completes.'}
        </p>
      </div>
      {!isReady && progress.total > 0 ? (
        <ProgressBar prepared={progress.prepared} total={progress.total} />
      ) : null}
      {isReady &&
      movement.currentCampaignId &&
      !(
        movement.pendingDestinationCampaignId ?? progress.destinationCampaignId
      ) ? (
        <p className="text-muted-foreground text-xs">
          {departureText(isMilitiaOnly, movement.departureRoles)}{' '}
          {privateDepartureText}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className={action}
          disabled={!movement.canResume}
          onClick={() => void movement.resumeMove()}
        >
          {isReady ? (
            <>
              <Check aria-hidden /> Complete move
            </>
          ) : (
            <>
              <ArrowRight aria-hidden /> Continue move
            </>
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={action}
          disabled={!movement.canCancel}
          onClick={() => void movement.cancelMove()}
        >
          <X aria-hidden /> Cancel move
        </Button>
      </div>
    </section>
  );
}
