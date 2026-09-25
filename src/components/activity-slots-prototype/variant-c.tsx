'use client';
// PROTOTYPE — Variant C: team first. Each team is a row and picks at most one
// of its own action cards (radio cards). Picking stages the choice in the
// team's slot, or in the first empty one. A "Militia" row holds actions that
// need no team. Slot order (it matters for the Strategist bonus and Covert
// Action) is a compact strip on top with a Move menu. Details open inline.
//
// Data note: a team-first pick is `place` then a team `detail` edit today,
// i.e. two edits. No payload change needed, but it isn't atomic.

import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import {
  type Action,
  actions,
  allowance,
  availability,
  type SlotFacts,
  slotFacts,
  teams,
  teamStatusText,
  actionsFor,
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

export const name = 'Team rows choose their action';

export function VariantC({ state, edit, disabled }: ActivityProps) {
  const facts = slotFacts(state);
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const [showOthers, setShowOthers] = useState(false);

  const factsFor = (pred: (f: SlotFacts) => boolean) => facts.filter((f) => f.slot.choice && pred(f));

  // A render function, not a component, so inputs keep focus across edits.
  function renderStaged(f: SlotFacts) {
    const open = openSlot === f.slot.slotId;
    return (
      <div key={f.slot.slotId} className={cn('rounded-md border', f.overAllowance && 'border-amber-600')}>
        <button
          type="button"
          onClick={() => setOpenSlot(open ? null : f.slot.slotId)}
          className="flex min-h-11 w-full touch-manipulation items-center gap-2 px-3 text-left text-sm"
        >
          <span className="font-mono">Slot {f.number}</span>
          <span className="font-medium">{f.action?.name}</span>
          {f.strategist && <StrategistBadge />}
          {state.remoteSlotId === f.slot.slotId && <RemoteMark />}
          <span className="ml-auto">
            <SlotStatus facts={f} />
          </span>
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        {open && (
          <div className="border-t p-3">
            <ChoiceDetails facts={f} state={state} edit={edit} disabled={disabled} />
          </div>
        )}
      </div>
    );
  }

  const noTeam = actions.filter((a) => availability(a) === 'no-team');
  const othersList = actions.filter((a) => availability(a) === 'unavailable');

  return (
    <section aria-label="Activity choices" className="space-y-4">
      <div className="bg-card space-y-2 rounded-lg border border-foreground/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AllowanceMeter state={state} />
          <Button size="sm" variant="outline" disabled={disabled} onClick={() => edit({ kind: 'add_slot' })}>
            <Plus /> Add action slot
          </Button>
        </div>
        <ol aria-label="Slot order" className="flex flex-wrap gap-1.5">
          {facts.map((f) => (
            <li key={f.slot.slotId} className="flex items-center gap-1">
              {f.index === allowance && <span className="mx-1 h-8 w-0.5 bg-amber-600" title="Over the allowance" />}
              <span
                className={cn(
                  'flex min-h-10 items-center gap-1.5 rounded-md border px-2 text-sm',
                  !f.slot.choice && 'text-muted-foreground border-dashed',
                  f.strategist && 'border-primary',
                )}
              >
                <span className="font-mono">{f.number}</span>
                {f.action?.name ?? 'empty'}
                {f.team && <span className="text-muted-foreground text-xs">· {f.team.name}</span>}
                {f.strategist && <span className="text-primary text-xs">+2</span>}
                {f.slot.choice && (
                  <>
                    <button
                      aria-label={`Move Slot ${f.number} earlier`}
                      disabled={f.index === 0}
                      className="flex size-8 touch-manipulation items-center justify-center disabled:opacity-30"
                      onClick={() => edit({ kind: 'move', from: f.slot.slotId, to: facts[f.index - 1]!.slot.slotId })}
                    >
                      <ChevronUp className="size-4 -rotate-90" />
                    </button>
                    <button
                      aria-label={`Move Slot ${f.number} later`}
                      disabled={f.index === facts.length - 1}
                      className="flex size-8 touch-manipulation items-center justify-center disabled:opacity-30"
                      onClick={() => edit({ kind: 'move', from: f.slot.slotId, to: facts[f.index + 1]!.slot.slotId })}
                    >
                      <ChevronDown className="size-4 -rotate-90" />
                    </button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <ul className="space-y-2">
        {teams.map((t) => {
          const staged = factsFor((f) => f.team?.id === t.id);
          const current = staged[0]?.action?.id;
          const own = actionsFor(t);
          return (
            <li key={t.id} className={cn('rounded-lg border border-foreground/20 p-3', t.status !== 'ready' && 'bg-muted/40')}>
              <div className="grid grid-cols-[11rem_1fr] gap-3">
                <div className="space-y-1">
                  <TeamChip team={t} />
                  <p className="text-muted-foreground text-xs">
                    {t.type} · tier {t.tier}
                  </p>
                  <p className="text-xs">{teamStatusText[t.status]}</p>
                </div>
                <div role="radiogroup" aria-label={`${t.name} action`} className="flex flex-wrap gap-2">
                  {own.map((a) => (
                    <ActionCard
                      key={a.id}
                      size="sm"
                      action={a}
                      className="w-36"
                      teamNote={t.status === 'ready' ? '' : 'Team can’t act'}
                      selected={current === a.id}
                      onClick={() =>
                        current === a.id
                          ? edit({ kind: 'unassign_team', teamId: t.id })
                          : edit({ kind: 'assign', actionId: a.id, teamId: t.id })
                      }
                    />
                  ))}
                  <button
                    type="button"
                    aria-pressed={!current}
                    onClick={() => edit({ kind: 'unassign_team', teamId: t.id })}
                    className={cn(
                      'min-h-24 w-28 touch-manipulation rounded-lg border-2 border-dashed p-2 text-sm',
                      !current ? 'border-foreground/60' : 'border-foreground/20 text-muted-foreground',
                    )}
                  >
                    Not acting
                  </button>
                </div>
              </div>
              {staged.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {staged.map((f) => (
                    renderStaged(f)
                  ))}
                </div>
              )}
            </li>
          );
        })}

        <li className="rounded-lg border border-foreground/20 p-3">
          <div className="grid grid-cols-[11rem_1fr] gap-3">
            <div>
              <p className="font-medium">Militia</p>
              <p className="text-muted-foreground text-xs">No team needed. Each tap adds a choice.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {noTeam.map((a) => (
                <ActionCard
                  key={a.id}
                  size="sm"
                  action={a}
                  className="w-36"
                  selected={facts.some((f) => f.action?.id === a.id && !f.team)}
                  onClick={() => edit({ kind: 'assign', actionId: a.id })}
                />
              ))}
            </div>
          </div>
          <div className="mt-2 space-y-1.5">
            {factsFor((f) => !f.team && !f.action?.teamTypes).map((f) => (
              renderStaged(f)
            ))}
          </div>
        </li>

        {factsFor((f) => !f.team && Boolean(f.action?.teamTypes)).length > 0 && (
          <li className="rounded-lg border border-dashed p-3">
            <p className="mb-2 font-medium">Waiting for a team</p>
            <div className="space-y-1.5">
              {factsFor((f) => !f.team && Boolean(f.action?.teamTypes)).map((f) => (
                renderStaged(f)
              ))}
            </div>
          </li>
        )}

        <li>
          <button className="text-muted-foreground text-sm underline" onClick={() => setShowOthers(!showOthers)}>
            {showOthers ? 'Hide' : 'Show'} actions none of your ready teams can take ({othersList.length})
          </button>
          {showOthers && (
            <div className="mt-2 flex flex-wrap gap-2">
              {othersList.map((a: Action) => (
                <ActionCard key={a.id} size="sm" action={a} className="w-36" onClick={() => edit({ kind: 'assign', actionId: a.id })} />
              ))}
            </div>
          )}
        </li>
      </ul>

      <SettlementPicker state={state} edit={edit} disabled={disabled} />
    </section>
  );
}
