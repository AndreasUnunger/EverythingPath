'use client';
// PROTOTYPE — Variant A: slots first. A numbered slot list on the left, the
// selected slot's details always open on the right. Tapping an empty slot (or
// "Change action") opens a picker sheet of action cards grouped by who can
// take them. No deck on screen, no drag. Move/swap via a "Move to" menu.

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '~/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import { cn } from '~/lib/utils';
import { actions, allowance, availability, slotFacts } from './mock';
import {
  ActionCard,
  type ActivityProps,
  AllowanceMeter,
  ChoiceDetails,
  RemoteMark,
  SettlementPicker,
  SlotStatus,
  StrategistBadge,
  TeamChip,
} from './parts';

export const name = 'Slot list + picker sheet';

const groups = [
  { key: 'team', title: 'A ready team can take these' },
  { key: 'no-team', title: 'No team needed' },
  { key: 'unavailable', title: 'No ready team (needs a Rules Exception)' },
] as const;

export function VariantA({ state, edit, disabled }: ActivityProps) {
  const facts = slotFacts(state);
  const [selectedId, setSelectedId] = useState(facts[1]?.slot.slotId ?? facts[0]!.slot.slotId);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const selected = facts.find((f) => f.slot.slotId === selectedId) ?? facts[0]!;

  return (
    <section aria-label="Activity choices" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AllowanceMeter state={state} />
        <SettlementPicker state={state} edit={edit} disabled={disabled} />
      </div>

      <div className="grid grid-cols-[17rem_1fr] gap-4">
        <ol aria-label="Action Slots" className="space-y-2">
          {facts.map((f) => (
            <li key={f.slot.slotId}>
              {f.index === allowance && (
                <p className="mb-2 border-t-2 border-dashed border-amber-600 pt-1 text-xs text-amber-700 dark:text-amber-300">
                  Over the action allowance
                </p>
              )}
              <button
                type="button"
                aria-current={f.slot.slotId === selected.slot.slotId}
                onClick={() => {
                  setSelectedId(f.slot.slotId);
                  if (!f.slot.choice) setPickerFor(f.slot.slotId);
                }}
                className={cn(
                  'flex min-h-16 w-full touch-manipulation items-center gap-3 rounded-lg border-2 px-3 py-2 text-left',
                  f.slot.slotId === selected.slot.slotId ? 'border-primary bg-primary/10' : 'border-foreground/20',
                  !f.slot.choice && 'border-dashed',
                )}
              >
                <span className="font-mono text-2xl opacity-60">{f.number}</span>
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="block truncate font-medium">
                    {f.action?.name ?? <span className="text-muted-foreground">Tap to choose an action</span>}
                  </span>
                  <span className="flex flex-wrap items-center gap-1">
                    {f.team && <TeamChip team={f.team} className="px-1 py-0 text-xs" />}
                    {f.action?.teamTypes && !f.team && <span className="text-xs">No team yet</span>}
                    {f.strategist && <StrategistBadge />}
                    {state.remoteSlotId === f.slot.slotId && <RemoteMark />}
                  </span>
                </span>
                <SlotStatus facts={f} />
              </button>
            </li>
          ))}
          <li>
            <Button variant="outline" className="w-full" disabled={disabled} onClick={() => edit({ kind: 'add_slot' })}>
              <Plus /> Add action slot
            </Button>
          </li>
        </ol>

        <div className="bg-card min-h-80 rounded-lg border border-foreground/20 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-lg">
              Action Slot {selected.number}
              {selected.action && <span className="text-muted-foreground"> · {selected.action.name}</span>}
            </h2>
            {selected.strategist && <StrategistBadge />}
            {selected.slot.choice && (
              <>
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
              </>
            )}
          </div>
          {selected.strategist && (
            <p className="text-muted-foreground mb-3 text-sm">
              The Strategist’s bonus action. Adds +2 to organization checks for the action in this slot.
            </p>
          )}
          {selected.slot.choice ? (
            <ChoiceDetails facts={selected} state={state} edit={edit} disabled={disabled} />
          ) : (
            <div className="flex flex-col items-start gap-2">
              <p className="text-muted-foreground">This slot is empty.</p>
              <Button disabled={disabled} onClick={() => setPickerFor(selected.slot.slotId)}>
                Choose an action
              </Button>
            </div>
          )}
        </div>
      </div>

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
                          setSelectedId(pickerFor!);
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
