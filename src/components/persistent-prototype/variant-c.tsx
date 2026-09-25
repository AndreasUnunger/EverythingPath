'use client';
// PROTOTYPE — Variant C: event cards and one buyoff token. The buyoff is the
// scarce thing (once every four weeks), so it leads as a single token that
// shows where it is spent. Under it, each carried event is a tall card in a
// two-column grid. The decision is a tab strip inside the card, the tab's
// inputs fill the card body, and the card footer says what this week does.

import { Check, Coins, Lock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { cn } from '~/lib/utils';
import { buyoffGp, type DecisionKind, eventInfo, week } from './mock';
import {
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

export const name = 'Cards + buyoff token';

export function VariantC({ view, edit, disabled }: PersistentProps) {
  const cooldown =
    view.lastBuyoffWeek !== null && week < view.lastBuyoffWeek + 4;
  const spentOn = view.events.filter(
    (e) => e.decision.kind === 'buyoff' && !e.endedElsewhere,
  );
  const first = spentOn[0];
  return (
    <div className="space-y-4">
      <section
        aria-label="Buyoff"
        className={cn(
          'flex items-center gap-4 rounded-md border-2 px-4 py-3',
          cooldown
            ? 'border-dashed border-amber-500/60'
            : first
              ? 'border-emerald-400/60'
              : 'border-primary',
        )}
      >
        {cooldown ? (
          <Lock className="size-6 shrink-0 text-amber-300" />
        ) : (
          <Coins
            className={cn(
              'size-6 shrink-0',
              first ? 'text-emerald-300' : 'text-primary',
            )}
          />
        )}
        <div className="flex-1 text-sm">
          <p className="font-semibold">
            {cooldown
              ? `Buyoff locked until week ${view.lastBuyoffWeek! + 4}`
              : first
                ? `Buyoff spent on ${first.name} (week ${first.startedWeek})`
                : 'One buyoff available'}
            <span className="text-muted-foreground font-normal">
              {' '}
              · {buyoffGp} gp, 2 × the minimum treasury
            </span>
          </p>
          <p className="text-muted-foreground">
            {cooldown
              ? `The last buyoff was week ${view.lastBuyoffWeek}. Using it this week needs a Rules Exception on the event.`
              : first
                ? `Treasury ${view.treasuryStartGp} → ${view.treasuryAfterGp} gp. Next buyoff week ${view.nextBuyoffWeek}.${spentOn.length > 1 ? ` A second buyoff this week needs a Rules Exception.` : ''}`
                : `Once every four weeks. Tap Buy off on an event to spend it; the next would be week ${week + 4}.`}
          </p>
        </div>
        {spentOn.length > 1 && (
          <span className="text-sm text-amber-300">
            +{spentOn.length - 1} more staged
          </span>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        {view.events.map((event) => {
          const choices = decisionChoices(event, view);
          return (
            <article
              key={event.id}
              aria-label={`${event.name} · Event ${event.index}`}
              className={cn(
                'bg-card flex flex-col rounded-md border-2 p-3',
                event.ended
                  ? 'border-emerald-400/50'
                  : event.requirements.length
                    ? 'border-primary/60'
                    : 'border-foreground/20',
              )}
            >
              <header className="flex items-start gap-2">
                <span className="text-muted-foreground font-mono text-sm">
                  {event.index}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{event.name}</h3>
                  <Meta event={event} className="block" />
                </div>
                {event.ended && <Check className="size-4 text-emerald-300" />}
              </header>
              <p className="text-muted-foreground mt-1 text-xs">
                {eventInfo[event.type].effect}
              </p>

              {event.endedElsewhere ? (
                <div className="mt-3 flex-1">
                  <EndedElsewhere event={event} />
                </div>
              ) : (
                <Tabs
                  value={event.decision.kind}
                  onValueChange={(kind) =>
                    choose(event, kind as DecisionKind, edit)
                  }
                  className="mt-3 flex-1"
                >
                  <TabsList
                    className="grid w-full"
                    style={{
                      gridTemplateColumns: `repeat(${choices.length}, minmax(0, 1fr))`,
                    }}
                  >
                    {choices.map((c) => (
                      <TabsTrigger
                        key={c.value}
                        value={c.value}
                        disabled={disabled}
                        className="text-xs"
                      >
                        {c.value === 'unattempted'
                          ? 'Leave'
                          : c.value === 'mitigate'
                            ? 'Check'
                            : c.value === 'buyoff'
                              ? 'Buy off'
                              : 'Ended'}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {choices.map((c) => (
                    <TabsContent
                      key={c.value}
                      value={c.value}
                      className="mt-2 space-y-2"
                    >
                      <p className="text-muted-foreground text-xs">
                        {c.value === 'unattempted'
                          ? 'Nothing changes this week.'
                          : c.note}
                      </p>
                      {event.decision.kind === c.value && (
                        <DecisionInputs
                          event={event}
                          edit={edit}
                          disabled={disabled}
                        />
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              )}
              <IssuesFor event={event} className="mt-2" />
              <ExceptionsFor
                event={event}
                edit={edit}
                disabled={disabled}
                className="mt-2"
              />
              <footer className="border-foreground/10 mt-3 flex items-center border-t pt-2">
                <StagedLine event={event} />
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}
