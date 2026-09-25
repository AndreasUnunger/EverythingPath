'use client';
// PROTOTYPE — Variant B: deck and board (closest to today, made touch-safe).
// A team strip shows who is free and who acts where. Slots sit in one row as
// big tap targets. The deck wraps (no sideways scroll) with filters. Tap a
// card, then tap a slot; or drag by the grip handle only, so swipes on cards
// still scroll. Details open in a bottom sheet.

import { GripVertical, Plus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '~/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import { cn } from '~/lib/utils';
import {
  actionById,
  actions,
  allowance,
  availability,
  type ActionAvailability,
  slotFacts,
  slotOfTeam,
  teams,
  teamStatusText,
} from './mock';
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

export const name = 'Deck + slot board, tap then tap';

type Picked = { kind: 'deck'; actionId: string } | { kind: 'slot'; slotId: string };
type Filter = 'all' | ActionAvailability;

export function VariantB({ state, edit, disabled }: ActivityProps) {
  const facts = slotFacts(state);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ actionId: string; x: number; y: number; over: string | null } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;

  const pickedName =
    picked?.kind === 'deck'
      ? actionById(picked.actionId).name
      : picked
        ? facts.find((f) => f.slot.slotId === picked.slotId)?.action?.name
        : null;

  function tapSlot(slotId: string) {
    if (picked?.kind === 'deck') edit({ kind: 'place', actionId: picked.actionId, slotId });
    else if (picked?.kind === 'slot') edit({ kind: 'move', from: picked.slotId, to: slotId });
    else {
      const f = facts.find((x) => x.slot.slotId === slotId)!;
      if (f.slot.choice) setPicked({ kind: 'slot', slotId });
      return;
    }
    setPicked(null);
  }

  const slotAt = (x: number, y: number) =>
    (document.elementFromPoint(x, y)?.closest('[data-slot]') as HTMLElement | null)?.dataset.slot ?? null;

  function handleDown(e: React.PointerEvent, actionId: string) {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ actionId, x: e.clientX, y: e.clientY, over: null });
  }
  function handleMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    setDrag({ ...dragRef.current, x: e.clientX, y: e.clientY, over: slotAt(e.clientX, e.clientY) });
  }
  function handleUp(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const over = slotAt(e.clientX, e.clientY);
    if (over) edit({ kind: 'place', actionId: d.actionId, slotId: over });
    setDrag(null);
  }

  const detailsFacts = facts.find((f) => f.slot.slotId === detailsFor);

  return (
    <section aria-label="Activity choices" className="space-y-4">
      {drag &&
        createPortal(
          <div
            aria-hidden
            className="bg-card pointer-events-none fixed z-[70] w-36 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 p-3 shadow-xl"
            style={{ left: drag.x, top: drag.y }}
          >
            {actionById(drag.actionId).name}
          </div>,
          document.body,
        )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-muted-foreground text-xs tracking-widest uppercase">Teams</h2>
        {teams.map((t) => {
          const i = slotOfTeam(state, t.id);
          return (
            <TeamChip
              key={t.id}
              team={t}
              note={t.status !== 'ready' ? teamStatusText[t.status].split(' · ')[0] : i >= 0 ? `Slot ${i + 1}` : 'Free'}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <AllowanceMeter state={state} />
        <Button variant="outline" disabled={disabled} onClick={() => edit({ kind: 'add_slot' })}>
          <Plus /> Add action slot
        </Button>
      </div>

      <ol aria-label="Action Slots" className="flex gap-2">
        {facts.map((f) => {
          const target = picked !== null || drag !== null;
          const isPicked = picked?.kind === 'slot' && picked.slotId === f.slot.slotId;
          return (
            <li key={f.slot.slotId} className="flex min-w-0 flex-1 gap-2">
              {f.index === allowance && <span className="w-0.5 shrink-0 bg-amber-600" title="Over the action allowance" />}
              <div
                data-slot={f.slot.slotId}
                role="button"
                tabIndex={0}
                aria-label={`Action Slot ${f.number}`}
                onClick={() => !disabled && tapSlot(f.slot.slotId)}
                className={cn(
                  'flex min-h-40 min-w-0 flex-1 touch-manipulation flex-col gap-1.5 rounded-lg border-2 p-2 text-left transition-colors',
                  f.slot.choice ? 'bg-card' : 'border-dashed',
                  f.overAllowance && 'border-amber-600',
                  target && !isPicked && 'border-primary bg-primary/5',
                  drag?.over === f.slot.slotId && 'bg-primary/20 ring-primary ring-2',
                  isPicked && 'ring-primary -translate-y-1 ring-2',
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
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailsFor(f.slot.slotId);
                      }}
                    >
                      Details
                    </Button>
                  </>
                ) : (
                  <span className="text-muted-foreground mt-auto text-sm">
                    {target ? 'Place here' : 'Empty'}
                  </span>
                )}
                {target && f.slot.choice && !isPicked && (
                  <span className="text-primary text-xs font-medium">
                    {picked?.kind === 'slot' ? 'Swap here' : 'Replace'}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {picked && (
        <div className="bg-primary text-primary-foreground sticky top-2 z-10 flex items-center gap-3 rounded-lg px-3 py-2">
          <span className="flex-1">
            <strong>{pickedName}</strong> — tap a slot to {picked.kind === 'slot' ? 'move or swap it' : 'place it'}.
          </span>
          {picked.kind === 'slot' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                edit({ kind: 'clear', slotId: picked.slotId });
                setPicked(null);
              }}
            >
              Clear from slot
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setPicked(null)}>
            <X /> Cancel
          </Button>
        </div>
      )}

      <section aria-label="Action deck" className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-lg">Action deck</h2>
          {(
            [
              ['all', 'All'],
              ['team', 'A ready team'],
              ['no-team', 'No team needed'],
              ['unavailable', 'No ready team'],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              aria-pressed={filter === k}
              onClick={() => setFilter(k)}
              className={cn(
                'min-h-9 touch-manipulation rounded-full border px-3 text-sm',
                filter === k ? 'bg-foreground text-background' : 'border-foreground/25',
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-3">
          {actions
            .filter((a) => filter === 'all' || availability(a) === filter)
            .map((a) => (
              <ActionCard
                key={a.id}
                action={a}
                selected={picked?.kind === 'deck' && picked.actionId === a.id}
                onClick={() =>
                  setPicked(picked?.kind === 'deck' && picked.actionId === a.id ? null : { kind: 'deck', actionId: a.id })
                }
                handle={
                  <span
                    aria-label={`Drag ${a.name}`}
                    onPointerDown={(e) => handleDown(e, a.id)}
                    onPointerMove={handleMove}
                    onPointerUp={handleUp}
                    onPointerCancel={() => setDrag(null)}
                    className="text-muted-foreground absolute right-0 bottom-0 flex size-10 cursor-grab touch-none items-center justify-center"
                  >
                    <GripVertical className="size-5" />
                  </span>
                }
              />
            ))}
        </div>
      </section>

      <SettlementPicker state={state} edit={edit} disabled={disabled} />

      <Sheet open={Boolean(detailsFacts)} onOpenChange={(open) => !open && setDetailsFor(null)}>
        <SheetContent side="bottom" className="z-[60] max-h-[85svh] overflow-y-auto">
          {detailsFacts && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  Action Slot {detailsFacts.number} · {detailsFacts.action?.name}
                  {detailsFacts.strategist && <StrategistBadge />}
                </SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-6">
                <ChoiceDetails facts={detailsFacts} state={state} edit={edit} disabled={disabled} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}
