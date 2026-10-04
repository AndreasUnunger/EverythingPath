'use client';
import { LogOut } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Button } from '~/components/ui/button';
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { MoveFeedback } from './character-move-feedback';
import { privateDepartureText } from './character-move-copy';
import { action } from './sheet-parts';
import type { useCharacterMove } from './use-character-move';

export function CharacterLeaveDialog({
  characterName,
  campaignName,
  isMilitiaOnly,
  movement,
  onStay,
  onLeave,
  onCloseAutoFocus,
}: {
  characterName: string;
  campaignName?: string;
  isMilitiaOnly: boolean;
  movement: ReturnType<typeof useCharacterMove>;
  onStay: () => void;
  onLeave: () => void;
  onCloseAutoFocus?: ComponentProps<typeof DialogContent>['onCloseAutoFocus'];
}) {
  return (
    <DialogContent
      className="bg-card sm:max-w-md"
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <DialogHeader>
        <DialogTitle className="font-sans">
          Take {characterName} out of {campaignName ?? 'its campaign'}?
        </DialogTitle>
        <DialogDescription>What changes:</DialogDescription>
      </DialogHeader>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {movement.departureRoles.map((role) => (
          <li key={role}>
            {role} assignment removed. Finished weeks keep it as it was.
          </li>
        ))}
        <li>
          Campaign homebrew is kept as its own copy; the sheet doesn’t change.
        </li>
        {isMilitiaOnly ? (
          <li>Militia-only becomes Full, which can’t be undone.</li>
        ) : null}
        <li>{privateDepartureText}</li>
      </ul>
      <MoveFeedback movement={movement} outcome={null} />
      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          className={action}
          disabled={movement.isBusy}
          onClick={onStay}
        >
          Stay in {campaignName ?? 'campaign'}
        </Button>
        <Button
          type="button"
          variant="destructive"
          className={action}
          disabled={!movement.canLeave}
          onClick={onLeave}
        >
          <LogOut aria-hidden /> Leave campaign
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
