'use client';
// PROTOTYPE — Variant E: the chosen combination (B's slot board + A's picker
// sheet), without B's team strip. One row of slot cards on top; an empty slot
// past the action allowance carries a remove button (approved: new
// `remove_slot` edit, rule-based, no schema change). Tapping an empty slot
// opens the grouped picker sheet; tapping a staged slot selects it and shows
// its details under the board, with Change action and a Move to menu. Team
// choice is a dropdown (eligible teams, divider, other teams). No deck
// on screen, no drag.

import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import { cn } from '~/lib/utils';
import { actions, allowance, availability, settlements, slotFacts } from './mock';
import {
  ActionCard,
  type ActivityProps,
  AllowanceMeter,
  ChoiceDetails,
  RemoteMark,
  SlotStatus,
  StrategistBadge,
  TeamChip,
} from './parts';

export const name = 'Chosen: slot board + picker sheet';

const groups = [
  { key: 'team', title: 'A ready team can take these' },
  { key: 'no-team', title: 'No team needed' },
  { key: 'unavailable', title: 'No ready team (needs a Rules Exception)' },
] as const;

export function VariantE({ state, edit, disabled }: ActivityProps) {
  const facts = slotFacts(state);
  const [selectedId, setSelectedId] = useState<string | null>(facts[1]?.slot.slotId ?? null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const selected = facts.find((f) => f.slot.slotId === selectedId && f.slot.choice);

  return (
    <section aria-label="Activity choices" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <AllowanceMeter state={state} />
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Operating from</span>
            <Select
              value={state.settlementId || '__none'}
              disabled={disabled}
              onValueChange={(v) => edit({ kind: 'settlement', settlementId: v === '__none' ? '' : v })}
            >
              <SelectTrigger className="h-10 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[70]">
                {settlements.map((o) => (
                  <SelectItem key={o.id || '__none'} value={o.id || '__none'} className="min-h-11">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
        <Button variant="outline" disabled={disabled} onClick={() => edit({ kind: 'add_slot' })}>
          <Plus /> Add action slot
        </Button>
      </div>

      <ol aria-label="Action Slots" className="flex gap-2">
        {facts.map((f) => {
          const isSelected = selected?.slot.slotId === f.slot.slotId;
          return (
            <li key={f.slot.slotId} className="flex min-w-0 flex-1 gap-2">
              {f.index === allowance && <span className="w-0.5 shrink-0 bg-amber-600" title="Over the action allowance" />}
              <div className="relative flex min-w-0 flex-1">
              <button
                type="button"
                aria-label={`Action Slot ${f.number}`}
                aria-pressed={isSelected}
                disabled={disabled}
                onClick={() => (f.slot.choice ? setSelectedId(f.slot.slotId) : setPickerFor(f.slot.slotId))}
                className={cn(
                  'flex min-h-36 w-full min-w-0 touch-manipulation flex-col gap-1.5 rounded-lg border-2 p-2 text-left transition-transform',
                  f.slot.choice ? 'bg-card' : 'border-dashed',
                  f.overAllowance && 'border-amber-600',
                  isSelected && 'border-primary ring-primary/40 -translate-y-1 ring-2',
                )}
              >
                <span className="flex items-center justify-between gap-1">
                  <span className="text-muted-foreground font-mono text-sm">Slot {f.number}</span>
                  <SlotStatus facts={f} />
                </span>
                {f.strategist && <StrategistBadge />}
                {f.action ? (
                  <>
                    <span className="leading-tight font-semibold">{f.action.name}</span>
                    {f.team ? (
                      <TeamChip team={f.team} className="w-fit px-1 py-0 text-xs" />
                    ) : (
                      f.action.teamTypes && <span className="text-xs">No team yet</span>
                    )}
                    {state.remoteSlotId === f.slot.slotId && <RemoteMark />}
                  </>
                ) : (
                  <span className="text-muted-foreground mt-auto text-sm">Tap to choose an action</span>
                )}
                
              </button>
              {f.index >= allowance && !f.slot.choice && (
                <button
                  type="button"
                  aria-label={`Remove Action Slot ${f.number}`}
                  disabled={disabled}
                  onClick={() => edit({ kind: 'remove_slot', slotId: f.slot.slotId })}
                  className="bg-background absolute -top-1.5 -right-1.5 flex size-5 touch-manipulation items-center justify-center rounded-full border shadow"
                >
                  <X className="size-3" />
                </button>
              )}
              </div>
            </li>
          );
        })}
      </ol>

      {selected ? (
        <div className="bg-card rounded-lg border border-foreground/20 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-lg">
              Action Slot {selected.number}
              <span className="text-muted-foreground"> · {selected.action?.name}</span>
            </h2>
            {selected.strategist && <StrategistBadge />}
            <Button variant="outline" disabled={disabled} onClick={() => setPickerFor(selected.slot.slotId)}>
              Change action
            </Button>
            <Select
              value=""
              onValueChange={(to) => {
                edit({ kind: 'move', from: selected.slot.slotId, to });
                setSelectedId(to);
              }}
            >
              <SelectTrigger className="w-auto" disabled={disabled}>
                Move to…
              </SelectTrigger>
              <SelectContent>
                {facts
                  .filter((f) => f.slot.slotId !== selected.slot.slotId)
                  .map((f) => (
                    <SelectItem key={f.slot.slotId} value={f.slot.slotId}>
                      Action Slot {f.number}
                      {f.action ? ` (swap with ${f.action.name})` : ' (empty)'}
                      {f.strategist ? ' · Strategist +2' : ''}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          {selected.strategist && (
            <p className="text-muted-foreground mb-3 text-sm">
              The Strategist’s bonus action. Adds +2 to organization checks for the action in this slot.
            </p>
          )}
          <ChoiceDetails facts={selected} state={state} edit={edit} disabled={disabled} teamControl="select" />
        </div>
      ) : (
        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          Tap a staged slot to see and edit its details.
        </p>
      )}


      <Sheet open={pickerFor !== null} onOpenChange={(open) => !open && setPickerFor(null)}>
        <SheetContent side="bottom" className="z-[60] max-h-[80svh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Choose an action for Action Slot {facts.findIndex((f) => f.slot.slotId === pickerFor) + 1}
            </SheetTitle>
            <SheetDescription>Tap a card to place it. Another player sees it straight away.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            {groups.map((g) => (
              <section key={g.key} className="space-y-2">
                <h3 className="text-muted-foreground text-sm">{g.title}</h3>
                <div className="grid grid-cols-6 gap-3">
                  {actions
                    .filter((a) => availability(a) === g.key)
                    .map((a) => (
                      <ActionCard
                        key={a.id}
                        action={a}
                        selected={facts.find((f) => f.slot.slotId === pickerFor)?.action?.id === a.id}
                        onClick={() => {
                          edit({ kind: 'place', actionId: a.id, slotId: pickerFor! });
                          setSelectedId(pickerFor);
                          setPickerFor(null);
                        }}
                      />
                    ))}
                </div>
              </section>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
