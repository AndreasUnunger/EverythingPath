'use client';
import type { Id } from '@convex/_generated/dataModel';
import { useState, type ComponentProps } from 'react';
import { Button } from '~/components/ui/button';
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { MoveFeedback } from './character-move-feedback';
import { MoveReadError } from './character-move-read-error';
import { action } from './sheet-parts';
import { departureText } from './character-move-copy';
import type { useCharacterMove } from './use-character-move';

type Movement = ReturnType<typeof useCharacterMove>;

/**
 * The campaign choice for Add to campaign or Move to campaign, inside the
 * control's Dialog: the accessible prepared campaigns other than the
 * current one as cards, then one action that starts the move. Mounted only
 * while open, so a reopened picker starts with no choice; a refusal keeps it
 * open, with the choice, beside the reason.
 */
export function CharacterMovePicker({
  characterName,
  campaignName,
  isMilitiaOnly,
  movement,
  onCloseAutoFocus,
}: {
  characterName: string;
  campaignName?: string;
  isMilitiaOnly: boolean;
  movement: Movement;
  onCloseAutoFocus?: ComponentProps<typeof DialogContent>['onCloseAutoFocus'];
}) {
  const [selected, setSelected] = useState<Id<'campaign'> | null>(null);
  const isMove = movement.currentCampaignId !== undefined;
  const chosen = movement.destinations.find(
    (destination) => destination.campaignId === selected,
  );
  return (
    <DialogContent
      className="bg-card sm:max-w-md"
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <DialogHeader>
        <DialogTitle className="font-sans">
          {isMove ? 'Move to campaign' : 'Add to campaign'}
        </DialogTitle>
        <DialogDescription>
          {isMove
            ? `${characterName} leaves ${campaignName ?? 'its campaign'} when the move completes. ${departureText(isMilitiaOnly)}`
            : `Everyone in the campaign you choose can see and edit ${characterName}. It isn’t added to a militia roster.`}
        </DialogDescription>
      </DialogHeader>
      {movement.destinations.length ? (
        <RadioGroup
          aria-label="Campaigns"
          value={selected ?? ''}
          disabled={!movement.canStart}
          onValueChange={(value) =>
            setSelected(
              movement.destinations.find(
                (destination) => destination.campaignId === value,
              )?.campaignId ?? null,
            )
          }
          className="max-h-[50dvh] gap-1 overflow-y-auto"
        >
          {movement.destinations.map((destination) => (
            <RadioGroupItem
              key={destination.campaignId}
              value={destination.campaignId}
              className="justify-start font-sans"
            >
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                {destination.campaignName}
              </span>
            </RadioGroupItem>
          ))}
        </RadioGroup>
      ) : (
        <p className="text-muted-foreground text-sm">
          No other campaigns are available.
        </p>
      )}
      <MoveReadError movement={movement} />
      <MoveFeedback movement={movement} outcome={null} />
      <DialogFooter>
        <Button
          type="button"
          className={action}
          disabled={!movement.canStart || !chosen}
          onClick={() => {
            if (chosen) void movement.startMove(chosen.campaignId);
          }}
        >
          {isMove ? 'Move character' : 'Join campaign'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
