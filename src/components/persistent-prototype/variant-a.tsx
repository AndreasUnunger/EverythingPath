'use client';
// PROTOTYPE — Variant A: the rules order. A one-line buyoff overview, then one
// numbered section per carried event, oldest first, like Upkeep's numbered
// steps. Each section header shows what this week does to the event; the
// decision cards sit in a row under it, and the chosen decision's inputs,
// warnings and Rules Exception sit right under those.

import { Check, Coins } from 'lucide-react';
import { cn } from '~/lib/utils';
import { eventInfo } from './mock';
import {
  buyoffSummary,
  DecisionCards,
  DecisionInputs,
  EndedElsewhere,
  ExceptionsFor,
  IssuesFor,
  Meta,
  type PersistentProps,
  StagedLine,
} from './parts';

export const name = 'Rules order';

export function VariantA({ view, edit, disabled }: PersistentProps) {
  const buyoff = buyoffSummary(view);
  return (
    <div className="space-y-5">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <Coins className="text-muted-foreground size-4" />
        <span
          className={cn(
            'whitespace-nowrap',
            buyoff.cooldown && 'text-amber-300',
          )}
        >
          {buyoff.head}
        </span>
        <span className="whitespace-nowrap">
          <span className="text-muted-foreground">· </span>
          <strong className="font-mono">{buyoff.cost}</strong>{' '}
          <span className="text-muted-foreground">(2 × minimum treasury)</span>
        </span>
        <span className="text-muted-foreground whitespace-nowrap">
          · Next buyoff {buyoff.next}
        </span>
      </p>

      <ol className="space-y-5">
        {view.events.map((event) => {
          const open = event.requirements.length > 0;
          return (
            <li key={event.id}>
              <section
                aria-label={`${event.name} · Event ${event.index}`}
                className="border-foreground/15 border-l-2 pb-1 pl-4"
              >
                <header className="-ml-[1.6rem] flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span
                    className={cn(
                      'bg-background flex size-7 items-center justify-center rounded-full border font-mono text-sm',
                      open
                        ? 'border-primary text-primary'
                        : event.ended
                          ? 'border-emerald-400 text-emerald-300'
                          : 'border-foreground/30',
                    )}
                  >
                    {event.ended && !open ? (
                      <Check className="size-4" />
                    ) : (
                      event.index
                    )}
                  </span>
                  <h3 className="font-semibold">{event.name}</h3>
                  <Meta event={event} />
                  <StagedLine event={event} className="basis-full pl-10 md:ml-auto md:basis-auto md:pl-0" />
                </header>
                <div className="mt-2 space-y-3">
                  {event.endedElsewhere ? (
                    <EndedElsewhere event={event} />
                  ) : (
                    <>
                      <DecisionCards
                        event={event}
                        view={view}
                        edit={edit}
                        disabled={disabled}
                      />
                      <DecisionInputs
                        event={event}
                        edit={edit}
                        disabled={disabled}
                      />
                    </>
                  )}
                  <IssuesFor event={event} />
                  <ExceptionsFor
                    event={event}
                    edit={edit}
                    disabled={disabled}
                  />
                  {!event.endedElsewhere &&
                    event.decision.kind === 'unattempted' && (
                      <p className="text-muted-foreground text-xs">
                        {eventInfo[event.type].effect}
                      </p>
                    )}
                </div>
              </section>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
