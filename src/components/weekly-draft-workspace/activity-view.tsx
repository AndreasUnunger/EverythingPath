'use client';
import { createPortal } from 'react-dom';
import { GripVertical } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { ActivityView as Facts } from './types';
import { activityWarning } from './activity-warnings';
import { activityLabel } from './activity-facts';
import { useActivityPlacement } from './use-activity-placement';
import { ActivityDetails } from './activity-details';
import { ChoiceCards } from './choice-cards';
export function ActivityView({
  view,
  edit,
  disabled,
}: {
  view: Facts;
  edit: (edit: WeeklyDraftEdit) => unknown;
  disabled: boolean;
}) {
  const placement = useActivityPlacement(view, edit, disabled);
  function dragButton(
    picked: Parameters<typeof placement.down>[1],
    label: string,
    name: string,
  ) {
    const moving =
      placement.drag?.moved &&
      (picked.kind === 'deck'
        ? placement.drag.selection.kind === 'deck' &&
          picked.actionId === placement.drag.selection.actionId
        : placement.drag.selection.kind === 'slot' &&
          picked.choiceId === placement.drag.selection.choiceId);
    return (
      <Button
        type="button"
        disabled={disabled}
        variant="outline"
        aria-label={label}
        onClick={(event) => placement.choose(picked, event)}
        onPointerDown={(event) => placement.down(event, picked)}
        onPointerMove={placement.move}
        onPointerUp={placement.up}
        onPointerCancel={placement.cancel}
        onLostPointerCapture={placement.lostCapture}
        onKeyDown={(event) => {
          if (event.key === 'Escape') placement.cancel();
        }}
        style={moving ? { opacity: 0.4 } : undefined}
        className="h-auto min-h-24 w-full min-w-0 cursor-grab touch-none flex-col items-start justify-between gap-3 rounded-lg border-2 p-3 text-left whitespace-normal transition-transform select-none hover:-translate-y-1 focus-visible:-translate-y-1 active:cursor-grabbing motion-reduce:transform-none"
      >
        <GripVertical aria-hidden className="size-4" />
        <span>{name}</span>
      </Button>
    );
  }
  return (
    <section className="space-y-4" aria-label="Activity choices">
      {placement.drag?.moved &&
        createPortal(
          <div
            aria-hidden
            className="bg-card text-card-foreground pointer-events-none fixed z-50 w-40 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 p-4 shadow-xl"
            style={{ left: placement.drag.x, top: placement.drag.y }}
          >
            {activityLabel(
              placement.drag.selection.kind === 'deck'
                ? placement.drag.selection.actionId
                : (view.slots.find(
                    (slot) =>
                      slot.slotId ===
                      (placement.drag?.selection.kind === 'slot'
                        ? placement.drag.selection.slotId
                        : ''),
                  )?.choice?.actionId ?? 'action'),
            )}
          </div>,
          document.body,
        )}

      <p className="text-sm">
        Prepare actions together. Move a whole choice with its team and details,
        swap occupied slots, or drag a staged card outside the slots to clear
        it.
      </p>
      <p role="status" className="text-muted-foreground text-sm">
        {placement.feedback}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() =>
            edit({ kind: 'add_slot', slotId: crypto.randomUUID() })
          }
        >
          Add action slot
        </Button>
        {placement.selection && (
          <>
            <Button variant="outline" onClick={placement.cancel}>
              Cancel placement
            </Button>
            {placement.selection.kind === 'slot' && (
              <Button
                variant="outline"
                disabled={disabled}
                onClick={() => placement.place(null)}
              >
                Clear selected choice
              </Button>
            )}
          </>
        )}
      </div>
      <section aria-label="Action deck" className="space-y-3">
        <h2 className="text-lg font-semibold">Action deck</h2>
        <div className="flex gap-3 overflow-x-auto p-1 pb-3">
          {view.actions.map((action) => (
            <div key={action.actionId} className="w-40 shrink-0">
              {dragButton(
                { kind: 'deck', actionId: action.actionId },
                `Choose ${action.name}`,
                action.name,
              )}
            </div>
          ))}
        </div>
      </section>
      <div className="grid items-start gap-4 md:grid-cols-2">
        {view.slots.map((slot, index) => (
          <Card
            key={slot.slotId}
            ref={(node) => placement.targetRef(slot.slotId, node)}
            aria-label={`Action Slot ${index + 1}`}
            data-drop-active={
              placement.drag?.target === slot.slotId ||
              Boolean(placement.selection)
            }
            className="data-[drop-active=true]:border-primary data-[drop-active=true]:bg-primary/5 min-w-0 space-y-3 border-2 p-4 transition-colors"
          >
            <h2 className="font-semibold">Action Slot {index + 1}</h2>
            {slot.overAllowance && (
              <p className="text-amber-700 dark:text-amber-300">
                This choice exceeds the action allowance. Move it, clear it, or
                record an exception with a reason.
              </p>
            )}
            {slot.choice &&
              slot.warnings.map((warning) => (
                <p
                  key={warning}
                  className="text-sm text-amber-700 dark:text-amber-300"
                >
                  {activityWarning(warning, slot.choice!.choiceId)}
                </p>
              ))}
            {slot.choice ? (
              dragButton(
                {
                  kind: 'slot',
                  slotId: slot.slotId,
                  choiceId: slot.choice.choiceId,
                },
                `Move ${activityLabel(slot.choice.actionId)} from Action Slot ${index + 1}`,
                activityLabel(slot.choice.actionId),
              )
            ) : (
              <p className="text-muted-foreground text-sm">Empty slot</p>
            )}
            {placement.selection && (
              <Button
                disabled={disabled}
                variant="outline"
                className="w-full"
                onClick={() => placement.place(slot.slotId)}
              >
                {slot.choice
                  ? placement.selection.kind === 'slot'
                    ? 'Swap with'
                    : 'Replace'
                  : 'Place in'}{' '}
                Action Slot {index + 1}
              </Button>
            )}
            {slot.choice && (
              <details key={slot.choice.choiceId} className="space-y-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Edit {activityLabel(slot.choice.actionId)} details
                </summary>
                <ActivityDetails
                  slot={slot}
                  view={view}
                  edit={edit}
                  disabled={disabled}
                />
              </details>
            )}
          </Card>
        ))}
      </div>

      {view.settlements.length > 0 && (
        <ChoiceCards
          label="Operating settlement"
          value={view.operatingSettlementId}
          choices={[{ value: '', label: 'No settlement' }, ...view.settlements]}
          disabled={disabled}
          onChange={(value) =>
            edit({ kind: 'operating_settlement', settlementId: value || null })
          }
        />
      )}
    </section>
  );
}
