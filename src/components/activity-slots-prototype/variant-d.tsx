'use client';
// PROTOTYPE — Variant D: one row per slot. A dense table where each Action
// Slot is a row: action (tap opens a card picker dialog), team (inline team
// cards for the eligible teams), check die, status. Up/down arrows reorder.
// Expand a row for the full details. Most done without leaving the table.

import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';
import { actions, allowance, availability, checkBonus, slotFacts, teamsFor } from './mock';
import {
  ActionCard,
  type ActivityProps,
  AllowanceMeter,
  ChoiceDetails,
  RemoteMark,
  SettlementPicker,
  SlotStatus,
  StrategistBadge,
} from './parts';

export const name = 'One row per slot';

export function VariantD({ state, edit, disabled }: ActivityProps) {
  const facts = slotFacts(state);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const pickerFacts = facts.find((f) => f.slot.slotId === pickerFor);

  return (
    <section aria-label="Activity choices" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AllowanceMeter state={state} />
        <SettlementPicker state={state} edit={edit} disabled={disabled} />
      </div>

      <table className="w-full border-separate border-spacing-y-1.5 text-sm">
        <thead className="text-muted-foreground text-left text-xs">
          <tr>
            <th className="w-16 pl-2">Slot</th>
            <th className="w-44">Action</th>
            <th>Team</th>
            <th className="w-40">Check</th>
            <th className="w-20">Status</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {facts.map((f) => {
            const open = expanded === f.slot.slotId;
            const eligible = f.action ? teamsFor(f.action) : [];
            return (
              <Fragment key={f.slot.slotId}>
                {f.index === allowance && (
                  <tr>
                    <td colSpan={6} className="border-t-2 border-dashed border-amber-600 pt-1 text-xs text-amber-700 dark:text-amber-300">
                      Over the action allowance
                    </td>
                  </tr>
                )}
                <tr className={cn('bg-card', state.remoteSlotId === f.slot.slotId && 'bg-sky-500/10')}>
                  <td className="rounded-l-lg border-y border-l py-1.5 pl-2 align-middle">
                    <div className="flex items-center gap-0.5">
                      <span className="font-mono text-xl">{f.number}</span>
                      <div className="flex flex-col">
                        <button
                          aria-label={`Move Slot ${f.number} up`}
                          disabled={f.index === 0 || !f.slot.choice}
                          className="flex size-7 touch-manipulation items-center justify-center disabled:opacity-20"
                          onClick={() => edit({ kind: 'move', from: f.slot.slotId, to: facts[f.index - 1]!.slot.slotId })}
                        >
                          <ArrowUp className="size-3.5" />
                        </button>
                        <button
                          aria-label={`Move Slot ${f.number} down`}
                          disabled={f.index === facts.length - 1 || !f.slot.choice}
                          className="flex size-7 touch-manipulation items-center justify-center disabled:opacity-20"
                          onClick={() => edit({ kind: 'move', from: f.slot.slotId, to: facts[f.index + 1]!.slot.slotId })}
                        >
                          <ArrowDown className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="border-y py-1.5">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => setPickerFor(f.slot.slotId)}
                      className={cn(
                        'flex min-h-12 w-40 touch-manipulation flex-col justify-center rounded-md border-2 px-2 text-left',
                        f.action ? 'border-foreground/25' : 'text-muted-foreground border-dashed',
                      )}
                    >
                      <span className="font-medium">{f.action?.name ?? 'Choose action'}</span>
                      <span className="flex gap-1">
                        {f.strategist && <StrategistBadge />}
                        {state.remoteSlotId === f.slot.slotId && <RemoteMark />}
                      </span>
                    </button>
                  </td>
                  <td className="border-y py-1.5">
                    {!f.action ? null : !f.action.teamTypes ? (
                      <span className="text-muted-foreground">No team needed</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {eligible.map((t) => {
                          const selected = f.team?.id === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              aria-pressed={selected}
                              disabled={disabled}
                              onClick={() => edit({ kind: 'team', slotId: f.slot.slotId, teamId: selected ? undefined : t.id })}
                              className={cn(
                                'min-h-11 touch-manipulation rounded-md border-2 px-2 text-left text-xs',
                                selected ? 'border-primary bg-primary/10' : 'border-foreground/20',
                                t.status !== 'ready' && 'border-dashed opacity-60',
                              )}
                            >
                              <span className="block text-sm">{t.name}</span>
                              <span className="text-muted-foreground">{t.status === 'ready' ? `${t.type} ${t.tier}` : t.status}</span>
                            </button>
                          );
                        })}
                        {eligible.length === 0 && <span className="text-muted-foreground">No team of yours</span>}
                      </div>
                    )}
                  </td>
                  <td className="border-y py-1.5">
                    {f.action?.check ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          aria-label={`Slot ${f.number} check die`}
                          inputMode="numeric"
                          className="h-11 w-14 text-center font-mono text-lg"
                          value={f.slot.choice?.roll ?? ''}
                          onChange={(e) => {
                            const n = Number.parseInt(e.target.value, 10);
                            edit({ kind: 'roll', slotId: f.slot.slotId, roll: Number.isNaN(n) ? undefined : n });
                          }}
                        />
                        <span className="font-mono">
                          +{checkBonus(f)} = {f.checkTotal ?? '–'}
                        </span>
                      </div>
                    ) : (
                      f.action && <span className="text-muted-foreground">No check</span>
                    )}
                  </td>
                  <td className="border-y py-1.5">
                    <SlotStatus facts={f} />
                  </td>
                  <td className="rounded-r-lg border-y border-r py-1.5">
                    {f.slot.choice && (
                      <button
                        aria-label={`${open ? 'Hide' : 'Show'} Slot ${f.number} details`}
                        aria-expanded={open}
                        className="flex size-10 touch-manipulation items-center justify-center"
                        onClick={() => setExpanded(open ? null : f.slot.slotId)}
                      >
                        {open ? <ChevronDown /> : <ChevronRight />}
                      </button>
                    )}
                  </td>
                </tr>
                {open && (
                  <tr>
                    <td colSpan={6} className="bg-card rounded-lg border p-3">
                      <ChoiceDetails facts={f} state={state} edit={edit} disabled={disabled} hideTeam />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <Button variant="outline" disabled={disabled} onClick={() => edit({ kind: 'add_slot' })}>
        <Plus /> Add action slot
      </Button>

      <Dialog open={Boolean(pickerFacts)} onOpenChange={(o) => !o && setPickerFor(null)}>
        <DialogContent className="z-[60] max-h-[85svh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Action for Slot {pickerFacts?.number}</DialogTitle>
            <DialogDescription>
              Tap a card. {pickerFacts?.action && 'It replaces the current action; details reset.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-5 gap-3">
            {[...actions]
              .sort((a, b) => ['team', 'no-team', 'unavailable'].indexOf(availability(a)) - ['team', 'no-team', 'unavailable'].indexOf(availability(b)))
              .map((a) => (
                <ActionCard
                  key={a.id}
                  action={a}
                  selected={pickerFacts?.action?.id === a.id}
                  onClick={() => {
                    edit({ kind: 'place', actionId: a.id, slotId: pickerFor! });
                    setPickerFor(null);
                  }}
                />
              ))}
          </div>
          {pickerFacts?.slot.choice && (
            <Button
              variant="outline"
              onClick={() => {
                edit({ kind: 'clear', slotId: pickerFor! });
                setPickerFor(null);
              }}
            >
              Clear this slot
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
