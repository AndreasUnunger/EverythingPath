'use client';
import { Check, Coins } from 'lucide-react';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '~/components/ui/form';
import { cn } from '~/lib/utils';
import type { PersistentCard } from './persistent-sections';
import type { PersistentView } from './types';
import { phaseLabels } from './week-frame/labels';
import { formatGold } from './week-frame/reference-copy';

// Pieces the Persistent sections share: the buyoff overview line, the
// numbered section frame, the playing-card decision buttons and the two
// small reasoned forms. Everything here renders derived facts; the hook and
// the pure helpers decide what each control sends.

type Event = PersistentView['events'][number];
type Exception = Event['exceptions'][number];
type SaveResult = 'accepted' | 'failed';

export function Overview({ view }: { view: PersistentView }) {
  const items = [
    view.buyoffAvailability,
    view.buyoffCostCopper === null
      ? 'cost waits for earlier phases'
      : `${formatGold(view.buyoffCostCopper)} (2 × minimum treasury)`,
    'once every four weeks',
    ...(view.nextBuyoffWeek === null
      ? []
      : [`Next buyoff week ${view.nextBuyoffWeek}`]),
  ];
  return (
    <div className="space-y-1">
      <p className="flex min-w-0 items-start gap-2 text-sm">
        <Coins
          aria-hidden
          className="text-muted-foreground mt-0.5 size-4 shrink-0"
        />
        <span className="min-w-0 [overflow-wrap:anywhere]">
          {items.join(' · ')}
        </span>
      </p>
      {view.earlierPhases.length > 0 && (
        <p className="text-muted-foreground pl-6 text-xs">
          Earlier phases still need preparation:{' '}
          {view.earlierPhases.map((phase) => phaseLabels[phase]).join(', ')}.
        </p>
      )}
    </div>
  );
}

// The header's projected result, coloured by tone. Only a staged ending is
// emerald and carries the check.
export function ProjectedResult({ result }: { result: Event['result'] }) {
  return (
    <p
      className={cn(
        'flex min-w-0 items-center gap-1 text-sm [overflow-wrap:anywhere] sm:ml-auto',
        result.tone === 'ends'
          ? 'text-emerald-500'
          : result.tone === 'attention'
            ? 'text-amber-300'
            : 'text-muted-foreground',
      )}
    >
      {result.tone === 'ends' && (
        <Check aria-hidden className="size-4 shrink-0" />
      )}
      <span className="min-w-0">{result.text}</span>
    </p>
  );
}

// The circle on the section's vertical rule: the 1-based number, or a check
// once the event's ending is staged.
export function SectionMarker({
  number,
  ended,
}: {
  number: number;
  ended: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'bg-background absolute top-0 -left-3.5 flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-sm',
        ended
          ? 'border-emerald-500 text-emerald-500'
          : 'border-primary text-primary',
      )}
    >
      {ended ? <Check className="size-4" /> : number}
    </span>
  );
}

export type DecisionCardFacts = {
  card: PersistentCard;
  title: string;
  note: string;
};

export function decisionCards(
  event: Pick<Event, 'leaveNote' | 'check'>,
  buyoffCostCopper: number | null,
): DecisionCardFacts[] {
  return [
    { card: 'unattempted', title: 'Leave it', note: event.leaveNote },
    ...(event.check
      ? [
          {
            card: 'mitigate' as const,
            title: event.check.label,
            note: event.check.note,
          },
        ]
      : []),
    {
      card: 'buyoff',
      title:
        buyoffCostCopper === null
          ? 'Buy off · cost pending'
          : `Buy off · ${formatGold(buyoffCostCopper)}`,
      note: 'Once every four weeks, 2 × the minimum treasury.',
    },
    {
      card: 'end',
      title: 'Ended at the table',
      note: 'Record what happened. Needs a Rules Exception.',
    },
  ];
}

// The decision cards in a row on a tablet and 2×2 on a phone. Each is a
// plain button whose name is the title alone; the note describes it.
export function DecisionCards({
  label,
  cards,
  selected,
  disabled,
  onChoose,
}: {
  label: string;
  cards: DecisionCardFacts[];
  selected: string;
  disabled: boolean;
  onChoose: (card: PersistentCard) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'grid min-w-0 grid-cols-2 items-stretch gap-3',
        cards.length >= 4 ? 'md:grid-cols-4' : 'md:grid-cols-3',
      )}
    >
      {cards.map((card) => (
        <DecisionCard
          key={card.card}
          card={card}
          selected={selected === card.card}
          disabled={disabled}
          onChoose={() => onChoose(card.card)}
        />
      ))}
    </div>
  );
}

function DecisionCard({
  card,
  selected,
  disabled,
  onChoose,
}: {
  card: DecisionCardFacts;
  selected: boolean;
  disabled: boolean;
  onChoose: () => void;
}) {
  const noteId = useId();
  return (
    <button
      type="button"
      aria-label={card.title}
      aria-describedby={noteId}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onChoose}
      // Hover only lifts and tints the border so it never resembles the
      // selected card's fill.
      className={cn(
        'bg-background flex h-auto min-h-24 max-w-full min-w-0 flex-col items-start gap-1.5 rounded-lg border-2 p-3 text-left [overflow-wrap:anywhere] whitespace-normal transition-transform select-none',
        'hover:border-primary/60 hover:-translate-y-1 focus-visible:-translate-y-1 motion-reduce:transform-none',
        'focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]',
        'disabled:pointer-events-none disabled:opacity-50',
        selected
          ? 'border-primary bg-primary/15 hover:border-primary'
          : 'border-border',
      )}
    >
      <span className="flex w-full min-w-0 items-start gap-2 text-sm font-semibold">
        {selected && <Check aria-hidden className="mt-0.5 size-4 shrink-0" />}
        <span className="min-w-0 break-words">{card.title}</span>
      </span>
      <span
        id={noteId}
        className="text-muted-foreground min-w-0 text-xs font-normal"
      >
        {card.note}
      </span>
    </button>
  );
}

const endingSchema = z.object({
  outcome: z.string().trim().min(1, 'Describe how it ended.'),
});

// How an event ended at the table. The saved outcome prefills the field;
// typed text survives re-renders and a failed save keeps it for a retry.
export function EndingForm({
  saved,
  notice,
  disabled,
  onSave,
}: {
  saved: string;
  notice: string | null;
  disabled: boolean;
  onSave: (outcome: string) => Promise<SaveResult>;
}) {
  const [failed, setFailed] = useState(false);
  const form = useForm({
    values: { outcome: saved },
    resolver: zodResolver(endingSchema),
  });
  const saving = form.formState.isSubmitting;
  const submit = form.handleSubmit(async (values) => {
    setFailed(false);
    const result = await onSave(values.outcome);
    setFailed(result !== 'accepted');
  });
  return (
    <Form {...form}>
      <form noValidate onSubmit={submit} className="space-y-2">
        {notice && (
          <p role="status" className="text-sm text-amber-300">
            {notice}
          </p>
        )}
        <FormField
          control={form.control}
          name="outcome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>How it ended</FormLabel>
              <FormControl>
                <Input {...field} autoComplete="off" disabled={disabled} />
              </FormControl>
              <FormMessage role="alert" />
            </FormItem>
          )}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            aria-label="Save how it ended"
            disabled={disabled || saving}
          >
            {saving ? 'Saving…' : 'Save how it ended'}
          </Button>
          {failed && (
            <p role="alert" className="text-destructive text-sm">
              This ending wasn’t saved. Try again.
            </p>
          )}
        </div>
      </form>
    </Form>
  );
}

const reasonSchema = z.object({
  reason: z.string().trim().min(1, 'A reason is required.'),
});

// One Rules Exception the decision needs, with the table's reason.
export function ExceptionBlock({
  message,
  exception,
  disabled,
  onSave,
  onRemove,
}: {
  message: string;
  exception: Exception;
  disabled: boolean;
  onSave: (exception: Exception, reason: string) => Promise<SaveResult>;
  onRemove: (exception: Exception) => Promise<SaveResult>;
}) {
  const form = useForm({
    values: { reason: exception.reason },
    resolver: zodResolver(reasonSchema),
  });
  return (
    <div className="space-y-2 border-l-2 border-amber-500/60 pl-3">
      <p role="note" className="text-sm text-amber-300">
        {message}
      </p>
      <Form {...form}>
        <form
          noValidate
          onSubmit={form.handleSubmit((values) => {
            void onSave(exception, values.reason);
          })}
          className="space-y-2"
        >
          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rules Exception reason</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="off" disabled={disabled} />
                </FormControl>
                <FormMessage role="alert" />
              </FormItem>
            )}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={disabled}>
              Save reason
            </Button>
            {exception.reason && (
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() => {
                  void onRemove(exception);
                }}
              >
                Remove exception
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
