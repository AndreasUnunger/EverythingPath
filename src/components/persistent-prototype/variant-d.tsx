'use client';
// PROTOTYPE — Variant D: one event at a time. A queue strip across the top
// shows every carried event, oldest first, with what this week does to it.
// Below it one event fills the column: the decision cards stacked on the
// left, the chosen decision's inputs, warnings and Rules Exception on the
// right, and previous / next at the bottom. Made for resolving in order.

import { ArrowLeft, ArrowRight, Check, Coins } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { eventInfo } from './mock';
import {
  buyoffSummary,
  ChoiceCard,
  choose,
  decisionChoices,
  DecisionInputs,
  EndedElsewhere,
  ExceptionsFor,
  IssuesFor,
  Meta,
  type PersistentProps,
  StagedLine,
} from './parts';

export const name = 'One at a time';

export function VariantD({ view, edit, disabled }: PersistentProps) {
  const [index, setIndex] = useState(
    Math.max(
      0,
      view.events.findIndex((e) => e.requirements.length),
    ),
  );
  const event = view.events[Math.min(index, view.events.length - 1)]!;
  const buyoff = buyoffSummary(view);
  return (
    <div className="space-y-4">
      <ol aria-label="Carried events" className="flex gap-2">
        {view.events.map((e, i) => (
          <li key={e.id} className="min-w-0 flex-1">
            <button
              type="button"
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                'bg-card flex w-full flex-col items-start rounded-md border-2 px-3 py-2 text-left',
                i === index ? 'border-primary' : 'border-foreground/20',
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <span className="text-muted-foreground font-mono">
                  {e.index}
                </span>
                {e.name}
                {e.ended && <Check className="size-3.5 text-emerald-300" />}
              </span>
              <span className="text-muted-foreground text-xs">
                week {e.startedWeek}
              </span>
              <StagedLine event={e} className="line-clamp-2 text-xs" />
            </button>
          </li>
        ))}
      </ol>
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Coins className="size-4" />
        <span className={cn(buyoff.cooldown && 'text-amber-300')}>
          {buyoff.head}
        </span>{' '}
        · {buyoff.cost} · next {buyoff.next}
      </p>

      <section
        aria-label={`${event.name} · Event ${event.index}`}
        className="bg-card border-foreground/20 border p-4"
      >
        <header className="flex flex-wrap items-baseline gap-x-3">
          <h3 className="text-xl font-semibold">
            <span className="text-muted-foreground font-mono text-base">
              {event.index} of {view.events.length}
            </span>{' '}
            {event.name}
          </h3>
          <Meta event={event} />
          <StagedLine event={event} className="ml-auto" />
        </header>
        <p className="text-muted-foreground mt-1 text-sm">
          {eventInfo[event.type].effect}
        </p>

        {event.endedElsewhere ? (
          <div className="mt-4">
            <EndedElsewhere event={event} />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-[15rem_1fr] gap-5">
            <div
              role="radiogroup"
              aria-label={`${event.name} decision`}
              className="flex flex-col gap-2"
            >
              {decisionChoices(event, view).map((c) => (
                <ChoiceCard
                  key={c.value}
                  selected={event.decision.kind === c.value}
                  disabled={disabled}
                  title={c.title}
                  note={c.note}
                  onClick={() => choose(event, c.value, edit)}
                />
              ))}
            </div>
            <div className="space-y-3">
              {event.decision.kind === 'unattempted' ? (
                <p className="text-muted-foreground text-sm">
                  Left as it is this week. It carries into next week unchanged.
                </p>
              ) : (
                <DecisionInputs event={event} edit={edit} disabled={disabled} />
              )}
              <IssuesFor event={event} />
              <ExceptionsFor event={event} edit={edit} disabled={disabled} />
            </div>
          </div>
        )}

        <footer className="mt-4 flex items-center gap-2">
          <Button
            variant="ghost"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
          >
            <ArrowLeft /> Previous
          </Button>
          <Button
            variant="outline"
            className="ml-auto"
            disabled={index >= view.events.length - 1}
            onClick={() => setIndex(index + 1)}
          >
            Next event <ArrowRight />
          </Button>
        </footer>
      </section>
    </div>
  );
}
