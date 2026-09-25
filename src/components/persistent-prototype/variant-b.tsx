'use client';
// PROTOTYPE — Variant B: a ledger. The treasury and the buyoff wait lead as
// two small ledgers, then one table row per carried event with its decision
// as a dropdown and what this week does to it. Tapping a row opens that
// event's inputs, warnings and Rules Exception in a panel under the table.
// No choice cards: the decision is a select, the detail is a panel.

import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { cn } from '~/lib/utils';
import { buyoffGp, type DecisionKind, eventInfo, week } from './mock';
import {
  buyoffSummary,
  choose,
  ClearDecision,
  decisionChoices,
  DecisionInputs,
  EndedElsewhere,
  ExceptionsFor,
  IssuesFor,
  type PersistentProps,
  StagedLine,
} from './parts';

export const name = 'Ledger';

export function VariantB({ view, edit, disabled }: PersistentProps) {
  const [selectedId, setSelectedId] = useState(
    view.events.find((e) => e.requirements.length)?.id ?? view.events[0]!.id,
  );
  const selected =
    view.events.find((e) => e.id === selectedId) ?? view.events[0]!;
  const buyoff = buyoffSummary(view);
  const bought = view.events.filter(
    (e) => e.decision.kind === 'buyoff' && e.stagedTone === 'ends',
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <section
          aria-label="Treasury"
          className="border-foreground/20 border p-3"
        >
          <h3 className="text-muted-foreground text-xs tracking-widest uppercase">
            Treasury
          </h3>
          <dl className="mt-1 text-sm">
            <div className="flex justify-between">
              <dt>Now</dt>
              <dd className="font-mono">{view.treasuryStartGp} gp</dd>
            </div>
            {bought.map((e) => (
              <div
                key={e.id}
                className="text-muted-foreground flex justify-between"
              >
                <dt>
                  Buy off {e.name} (week {e.startedWeek})
                </dt>
                <dd className="font-mono">−{buyoffGp} gp</dd>
              </div>
            ))}
            <div className="border-foreground/15 mt-1 flex justify-between border-t pt-1 font-semibold">
              <dt>After the week</dt>
              <dd className="font-mono">{view.treasuryAfterGp} gp</dd>
            </div>
          </dl>
        </section>
        <section
          aria-label="Buyoff"
          className="border-foreground/20 border p-3"
        >
          <h3 className="text-muted-foreground text-xs tracking-widest uppercase">
            Buyoff · once every four weeks
          </h3>
          <dl className="mt-1 text-sm">
            <div className="flex justify-between">
              <dt>Cost (2 × minimum)</dt>
              <dd className="font-mono">{buyoffGp} gp</dd>
            </div>
            <div className="flex justify-between">
              <dt>Last buyoff</dt>
              <dd className="font-mono">
                {view.lastBuyoffWeek === null
                  ? 'never'
                  : `week ${view.lastBuyoffWeek}`}
              </dd>
            </div>
            <div
              className={cn(
                'flex justify-between',
                buyoff.cooldown && 'text-amber-300',
              )}
            >
              <dt>This week ({week})</dt>
              <dd>{buyoff.cooldown ? 'inside the wait' : 'allowed'}</dd>
            </div>
            <div className="border-foreground/15 mt-1 flex justify-between border-t pt-1 font-semibold">
              <dt>Next allowed</dt>
              <dd className="font-mono">
                week{' '}
                {view.buyoffsStaged
                  ? view.nextBuyoffWeek
                  : buyoff.cooldown
                    ? view.nextBuyoffWeek
                    : week}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-muted-foreground border-foreground/20 border-b text-left text-xs tracking-wider uppercase">
            <th className="py-1.5 pr-2 font-normal">#</th>
            <th className="py-1.5 pr-2 font-normal">Event</th>
            <th className="py-1.5 pr-2 font-normal">Since</th>
            <th className="py-1.5 pr-2 font-normal">Affects</th>
            <th className="py-1.5 pr-2 font-normal">Decision</th>
            <th className="py-1.5 pr-2 font-normal">This week</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {view.events.map((event) => {
            const active = event.id === selected.id;
            return (
              <tr
                key={event.id}
                aria-selected={active}
                className={cn(
                  'border-foreground/10 cursor-pointer border-b',
                  active && 'bg-primary/10',
                )}
                onClick={() => setSelectedId(event.id)}
              >
                <td className="py-2 pr-2 font-mono">{event.index}</td>
                <td className="py-2 pr-2 font-semibold">{event.name}</td>
                <td className="py-2 pr-2 whitespace-nowrap">
                  week {event.startedWeek}{' '}
                  <span className="text-muted-foreground">
                    ({event.ageWeeks} wk)
                  </span>
                </td>
                <td className="text-muted-foreground py-2 pr-2">
                  {event.targets.length ? event.targets.join(' & ') : 'Militia'}
                </td>
                <td className="py-2 pr-2" onClick={(e) => e.stopPropagation()}>
                  {event.endedElsewhere ? (
                    <span className="text-muted-foreground">
                      Reduce Danger (Activity)
                    </span>
                  ) : (
                    <Select
                      value={event.decision.kind}
                      disabled={disabled}
                      onValueChange={(kind) =>
                        choose(event, kind as DecisionKind, edit)
                      }
                    >
                      <SelectTrigger
                        className="h-9 w-64"
                        aria-label={`${event.name} decision`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {decisionChoices(event, view).map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </td>
                <td className="py-2 pr-2">
                  <StagedLine event={event} />
                  {event.requirements.length > 0 && (
                    <span className="text-primary block text-xs">
                      {event.requirements.length} to do
                    </span>
                  )}
                </td>
                <td className="py-2">
                  <ChevronRight
                    className={cn(
                      'size-4',
                      active ? 'opacity-100' : 'opacity-30',
                    )}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <section
        aria-label={`${selected.name} · Event ${selected.index} details`}
        className="bg-card border-foreground/20 space-y-3 border p-4"
      >
        <header className="flex items-baseline gap-3">
          <h3 className="font-semibold">
            {selected.name}{' '}
            <span className="text-muted-foreground font-normal">
              · since week {selected.startedWeek}
            </span>
          </h3>
          <p className="text-muted-foreground text-sm">
            {eventInfo[selected.type].effect}
          </p>
          <ClearDecision
            event={selected}
            edit={edit}
            disabled={disabled}
            className="ml-auto"
          />
        </header>
        {selected.endedElsewhere ? (
          <EndedElsewhere event={selected} />
        ) : selected.decision.kind === 'unattempted' ? (
          <p className="text-muted-foreground text-sm">
            Left as it is this week. Choose a decision in the table to act on
            it.
          </p>
        ) : (
          <>
            <p className="text-sm">
              {
                decisionChoices(selected, view).find(
                  (c) => c.value === selected.decision.kind,
                )?.note
              }
            </p>
            <DecisionInputs event={selected} edit={edit} disabled={disabled} />
          </>
        )}
        <IssuesFor event={selected} />
        <ExceptionsFor event={selected} edit={edit} disabled={disabled} />
      </section>
    </div>
  );
}
