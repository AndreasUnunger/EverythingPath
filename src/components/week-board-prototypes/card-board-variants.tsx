'use client';

import { useMemo, useState } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';
import { mockActions, mockEvents, mockTeams, mockWeekState } from './mock-data';

const activityCards = mockActions.filter((action) => action.allowedInPhase === 'activity');
const eventCards = mockActions.filter((action) => action.allowedInPhase === 'event');
const weekPhases = ['upkeep', 'activity', 'event'] as const;
type WeekPhase = (typeof weekPhases)[number];

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="text-primary font-sans text-xl font-bold">{title}</h3>
        <p className="text-muted-foreground font-mono text-sm">{subtitle}</p>
      </div>
      <Badge variant="outline" className="font-mono">
        Week {mockWeekState.week} • {mockWeekState.phase}
      </Badge>
    </div>
  );
}

function RulesStrip() {
  return (
    <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-4">
      <div className="border-primary/40 bg-primary/5 border p-2 font-mono text-xs">
        Upkeep order: Step 1-5
      </div>
      <div className="border-primary/40 bg-primary/5 border p-2 font-mono text-xs">
        Activity cap at rank {mockWeekState.rank}: {mockWeekState.maxActions} actions
      </div>
      <div className="border-primary/40 bg-primary/5 border p-2 font-mono text-xs">
        Teams usually act once per Activity phase
      </div>
      <div className="border-primary/40 bg-primary/5 border p-2 font-mono text-xs">
        Event chance preview: {mockWeekState.eventChancePreview}% (min 10, max 95)
      </div>
      <div className="border-primary/40 bg-primary/5 border p-2 font-mono text-xs md:col-span-2">
        Conflict policy: {mockWeekState.conflictPolicy}. Week advance: {mockWeekState.weekAdvancePolicy}.
      </div>
    </div>
  );
}

function DragCard({
  card,
  compact,
  assigned,
  className,
}: {
  card: (typeof activityCards)[number];
  compact?: boolean;
  assigned?: boolean;
  className?: string;
}) {
  return (
    <Card
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/action-card-id', card.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      className={cn(
        'border-primary/50 bg-card border-2 p-3 transition-transform hover:-translate-y-0.5',
        compact ? 'p-2' : '',
        assigned ? 'opacity-40' : '',
        className,
      )}
    >
      <div>
        <p className={cn('font-mono font-bold', compact ? 'text-sm' : 'text-base')}>
          {card.title}
        </p>
        <p className="text-muted-foreground font-mono text-xs">{card.team}</p>
      </div>
      <p className="text-muted-foreground mt-2 font-mono text-xs">Cost: {card.cost}</p>
      <ul className="mt-1 space-y-1">
        {card.fullText.map((line) => (
          <li key={`${card.id}-${line}`} className="text-muted-foreground font-mono text-xs">
            {line}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SlotArea({
  title,
  slots,
  onDropToSlot,
  onClearSlot,
  cardMap,
  className,
}: {
  title: string;
  slots: string[];
  onDropToSlot: (index: number, cardId: string) => void;
  onClearSlot: (index: number) => void;
  cardMap: Record<string, (typeof activityCards)[number]>;
  className?: string;
}) {
  return (
    <Card className={cn('border p-3', className)}>
      <p className="mb-2 font-mono text-sm font-bold">{title}</p>
      <div className="space-y-2">
        {slots.map((cardId, index) => {
          const slotLabel = `Activity Slot ${index + 1}`;
          const card = cardMap[cardId];
          return (
            <div
              key={slotLabel}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const droppedId = event.dataTransfer.getData('text/action-card-id');
                if (!droppedId) return;
                onDropToSlot(index, droppedId);
              }}
              className="border-primary/30 bg-primary/5 min-h-24 border-2 border-dashed p-2"
            >
              <p className="font-mono text-sm">{slotLabel}</p>
              {card ? (
                <div className="mt-2 space-y-2">
                  <DragCard card={card} compact />
                  <Button size="sm" variant="outline" onClick={() => onClearSlot(index)}>
                    Clear
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground mt-1 font-mono text-xs">
                  Drag a legal Activity action card here.
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="border-amber-500/40 bg-amber-500/10 mt-2 p-2 font-mono text-xs">
        Lie Low is exclusive and should replace other choices if selected.
      </div>
    </Card>
  );
}

function useActivitySlots() {
  const [slots, setSlots] = useState<string[]>(Array.from({ length: mockWeekState.maxActions }, () => ''));

  const cardMap = useMemo(
    () => Object.fromEntries(activityCards.map((card) => [card.id, card])) as Record<string, (typeof activityCards)[number]>,
    [],
  );

  const assignedIds = useMemo(() => new Set(slots.filter(Boolean)), [slots]);

  function onDropToSlot(index: number, cardId: string) {
    if (!cardMap[cardId]) return;

    setSlots((previous) => {
      const next = [...previous];
      const existingIndex = next.findIndex((id) => id === cardId);
      if (existingIndex >= 0) {
        next[existingIndex] = '';
      }
      next[index] = cardId;
      return next;
    });
  }

  function onClearSlot(index: number) {
    setSlots((previous) => {
      const next = [...previous];
      next[index] = '';
      return next;
    });
  }

  function clearAll() {
    setSlots(Array.from({ length: mockWeekState.maxActions }, () => ''));
  }

  return {
    slots,
    cardMap,
    assignedIds,
    onDropToSlot,
    onClearSlot,
    clearAll,
  };
}

function PhaseSelector({
  phase,
  onPhaseChange,
}: {
  phase: WeekPhase;
  onPhaseChange: (next: WeekPhase) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {weekPhases.map((item) => (
        <Button
          key={item}
          variant={phase === item ? 'default' : 'outline'}
          onClick={() => onPhaseChange(item)}
          className="font-mono capitalize"
        >
          {item}
        </Button>
      ))}
    </div>
  );
}

function UpkeepPhasePanel() {
  const [attritionRoll, setAttritionRoll] = useState('');
  const [notorietyPenaltyRoll, setNotorietyPenaltyRoll] = useState('');
  const [treasuryPenaltyRoll, setTreasuryPenaltyRoll] = useState('');

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
      <Card className="border p-3 lg:col-span-3">
        <p className="mb-2 font-mono text-sm font-bold">Upkeep Steps (1-5)</p>
        <div className="space-y-2">
          <div className="border p-2 font-mono text-xs">
            <p>Step 1: Training Attrition (DC 10 Loyalty).</p>
            <Input
              value={attritionRoll}
              onChange={(event) => setAttritionRoll(event.target.value)}
              placeholder="Enter total attrition result"
              className="mt-2 font-mono"
            />
          </div>
          <div className="border p-2 font-mono text-xs">
            <p>Step 2: Max Notoriety Penalty only if Notoriety is 100.</p>
            <Input
              value={notorietyPenaltyRoll}
              onChange={(event) => setNotorietyPenaltyRoll(event.target.value)}
              placeholder="If applicable, enter 1d20 + rank result"
              className="mt-2 font-mono"
            />
          </div>
          <div className="border p-2 font-mono text-xs">
            <p>Step 3: Treasury shortage penalty only if below minimum treasury.</p>
            <Input
              value={treasuryPenaltyRoll}
              onChange={(event) => setTreasuryPenaltyRoll(event.target.value)}
              placeholder="If applicable, enter 2d4 + rank result"
              className="mt-2 font-mono"
            />
          </div>
          <div className="border p-2 font-mono text-xs">
            Step 4: Increase Rank based on training thresholds (Table 6-1).
          </div>
          <div className="border p-2 font-mono text-xs">
            Step 5: Deposits/withdrawals by officer before Activity phase.
          </div>
        </div>
      </Card>
      <Card className="border p-3 lg:col-span-2">
        <p className="font-mono text-sm font-bold">Upkeep Summary</p>
        <div className="mt-2 space-y-1 font-mono text-xs">
          <p>Rank: {mockWeekState.rank}</p>
          <p>Training: {mockWeekState.training}</p>
          <p>Treasury: {mockWeekState.treasury}</p>
          <p>Notoriety: {mockWeekState.notoriety}</p>
        </div>
        <Button className="mt-3 w-full">Commit Upkeep</Button>
      </Card>
    </div>
  );
}

function EventPhasePanel() {
  const [eventRoll, setEventRoll] = useState('');
  const [rollTwiceFirst, setRollTwiceFirst] = useState('');
  const [rollTwiceSecond, setRollTwiceSecond] = useState('');

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      <Card className="border p-3 lg:col-span-4">
        <p className="font-mono text-sm font-bold">Event Trigger</p>
        <div className="mt-2 space-y-2">
          <div className="border p-2 font-mono text-xs">
            Event chance preview: {mockWeekState.eventChancePreview}% (Notoriety plus uneventful bonus carry).
          </div>
          <div className="border p-2 font-mono text-xs">
            Bounds apply: minimum 10%, maximum 95%.
          </div>
          <div className="border p-2 font-mono text-xs">
            Roll Twice semantics enabled; duplicate uses event's Twice clause.
          </div>
          <div className="border p-2 font-mono text-xs">
            <p>Enter event percentile roll result manually:</p>
            <Input
              value={eventRoll}
              onChange={(event) => setEventRoll(event.target.value)}
              placeholder="Enter d% result (1-100)"
              className="mt-2 font-mono"
            />
          </div>
          <div className="border p-2 font-mono text-xs">
            <p>If Roll Twice occurs, enter both event rolls manually:</p>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              <Input
                value={rollTwiceFirst}
                onChange={(event) => setRollTwiceFirst(event.target.value)}
                placeholder="First event roll"
                className="font-mono"
              />
              <Input
                value={rollTwiceSecond}
                onChange={(event) => setRollTwiceSecond(event.target.value)}
                placeholder="Second event roll"
                className="font-mono"
              />
            </div>
          </div>
        </div>
      </Card>
      <Card className="border p-3 lg:col-span-5">
        <p className="font-mono text-sm font-bold">Resolved/Queued Events</p>
        <div className="mt-2 space-y-2">
          {mockEvents.map((event) => (
            <div key={event.id} className="border p-2">
              <p className="font-mono text-sm">{event.name}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {event.tags.map((tag) => (
                  <Badge
                    key={`${event.id}-${tag}`}
                    variant="outline"
                    className="font-mono text-[10px] uppercase"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
              <ul className="mt-2 space-y-1">
                {event.fullText.map((line) => (
                  <li key={`${event.id}-${line}`} className="text-muted-foreground font-mono text-xs">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
      <Card className="border p-3 lg:col-span-3">
        <p className="font-mono text-sm font-bold">Reactive Action</p>
        <div className="mt-2 space-y-2">
          {eventCards.map((action) => (
            <Card key={action.id} className="border-primary/40 bg-primary/5 border p-2">
              <p className="font-mono text-sm font-bold">{action.title}</p>
              <ul className="mt-1 space-y-1">
                {action.fullText.map((line) => (
                  <li key={`${action.id}-${line}`} className="text-muted-foreground font-mono text-xs">
                    {line}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        <Button className="mt-3 w-full">Commit Event Phase</Button>
      </Card>
    </div>
  );
}

export function CardBoardVariantA() {
  const [phase, setPhase] = useState<WeekPhase>(mockWeekState.phase);
  const { slots, cardMap, assignedIds, onDropToSlot, onClearSlot, clearAll } = useActivitySlots();

  return (
    <Card className="bg-card border-2 p-4">
      <Header
        title="Card Board A: Balanced Rules"
        subtitle="Full weekly board with Upkeep, Activity (drag/drop), and Event."
      />
      <RulesStrip />
      <PhaseSelector phase={phase} onPhaseChange={setPhase} />

      {phase === 'upkeep' ? <UpkeepPhasePanel /> : null}

      {phase === 'activity' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:col-span-3">
            {activityCards.map((action) => (
              <DragCard key={action.id} card={action} assigned={assignedIds.has(action.id)} />
            ))}
          </div>
          <div className="space-y-2 xl:col-span-2">
            <SlotArea
              title="Activity Staging"
              slots={slots}
              onDropToSlot={onDropToSlot}
              onClearSlot={onClearSlot}
              cardMap={cardMap}
            />
            <div className="flex gap-2">
              <Button className="flex-1">Commit Activity Selections</Button>
              <Button className="flex-1" variant="outline" onClick={clearAll}>
                Reset Slots
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {phase === 'event' ? <EventPhasePanel /> : null}
    </Card>
  );
}

export function CardBoardVariantB() {
  const { slots, cardMap, assignedIds, onDropToSlot, onClearSlot, clearAll } = useActivitySlots();

  return (
    <Card className="bg-card border-2 p-4">
      <Header
        title="Card Board B: Carousel Rules"
        subtitle="Horizontal card lane with explicit drag-to-slot staging."
      />
      <RulesStrip />
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3">
          {activityCards.map((action) => (
            <div key={action.id} className="w-80 shrink-0">
              <DragCard card={action} assigned={assignedIds.has(action.id)} />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <SlotArea
          title="Stage Slot 1"
          slots={slots.slice(0, 1)}
          onDropToSlot={(index, cardId) => onDropToSlot(index, cardId)}
          onClearSlot={(index) => onClearSlot(index)}
          cardMap={cardMap}
        />
        <SlotArea
          title="Stage Slot 2"
          slots={slots.slice(1, 2)}
          onDropToSlot={(index, cardId) => onDropToSlot(index + 1, cardId)}
          onClearSlot={(index) => onClearSlot(index + 1)}
          cardMap={cardMap}
        />
        <Card className="border p-3">
          <p className="font-mono text-sm font-bold">Commit</p>
          <p className="text-muted-foreground mt-2 font-mono text-xs">
            Any player can commit. Conflicts resolve last-write-wins.
          </p>
          <Button className="mt-3 w-full">Commit Week Actions</Button>
          <Button className="mt-2 w-full" variant="outline" onClick={clearAll}>
            Clear Slots
          </Button>
        </Card>
      </div>
    </Card>
  );
}

export function CardBoardVariantC() {
  const { slots, cardMap, assignedIds, onDropToSlot, onClearSlot } = useActivitySlots();

  return (
    <Card className="bg-card border-2 p-4">
      <Header
        title="Card Board C: Team Eligibility"
        subtitle="Shows which teams can legally execute which actions."
      />
      <RulesStrip />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        {mockTeams.slice(0, 3).map((team) => (
          <Card key={team.id} className="border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-sm font-bold">{team.name}</p>
              <Badge variant="outline" className="font-mono text-[11px] uppercase">
                {team.status}
              </Badge>
            </div>
            <div className="space-y-2">
              {activityCards
                .filter((action) => action.team === team.name || action.team === 'No Team Required')
                .slice(0, 2)
                .map((action) => (
                  <DragCard
                    key={`${team.id}-${action.id}`}
                    card={action}
                    compact
                    assigned={assignedIds.has(action.id)}
                  />
                ))}
              {team.status !== 'active' ? (
                <p className="border-amber-500/40 bg-amber-500/10 p-2 font-mono text-xs">
                  Team is not active; action card should be disabled.
                </p>
              ) : null}
            </div>
          </Card>
        ))}
        <SlotArea
          title="Activity Slots"
          slots={slots}
          onDropToSlot={onDropToSlot}
          onClearSlot={onClearSlot}
          cardMap={cardMap}
        />
      </div>
    </Card>
  );
}

export function CardBoardVariantD() {
  const { slots, cardMap, assignedIds, onDropToSlot, onClearSlot } = useActivitySlots();

  return (
    <Card className="bg-card border-2 p-4">
      <Header
        title="Card Board D: Priority + Constraints"
        subtitle="Queue with guardrails for once-per-phase and exclusivity rules."
      />
      <RulesStrip />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="border p-3 lg:col-span-2">
          <p className="font-mono text-sm font-bold">Priority Queue (drag into slots)</p>
          <SlotArea
            title="Ordered Slots"
            slots={slots}
            onDropToSlot={onDropToSlot}
            onClearSlot={onClearSlot}
            cardMap={cardMap}
          />
        </Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:col-span-3">
          {activityCards.map((action) => (
            <DragCard key={action.id} card={action} assigned={assignedIds.has(action.id)} />
          ))}
        </div>
      </div>
    </Card>
  );
}

export function CardBoardVariantE() {
  const { slots, cardMap, assignedIds, onDropToSlot, onClearSlot } = useActivitySlots();

  return (
    <Card className="bg-card border-2 p-4">
      <Header
        title="Card Board E: Event-Aware"
        subtitle="Activity board with event-phase consequences and reactions visible."
      />
      <RulesStrip />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-8">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {activityCards.map((action) => (
              <DragCard key={action.id} card={action} assigned={assignedIds.has(action.id)} />
            ))}
          </div>
          <SlotArea
            title="Activity Slots"
            slots={slots}
            onDropToSlot={onDropToSlot}
            onClearSlot={onClearSlot}
            cardMap={cardMap}
          />
        </div>
        <Card className="border p-3 lg:col-span-4">
          <p className="font-mono text-sm font-bold">Event Phase Preview</p>
          <div className="mt-2 space-y-2">
            {mockEvents.map((event) => (
              <div key={event.id} className="border p-2">
                <p className="font-mono text-sm">{event.name}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {event.tags.map((tag) => (
                    <Badge
                      key={`${event.id}-${tag}`}
                      variant="outline"
                      className="font-mono text-[10px] uppercase"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
                <ul className="mt-2 space-y-1">
                  {event.fullText.map((line) => (
                    <li key={`${event.id}-${line}`} className="text-muted-foreground font-mono text-xs">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-2 font-mono text-xs font-bold">Reactive Event Action</p>
          {eventCards.map((action) => (
            <Card key={action.id} className="border-primary/40 bg-primary/5 mt-2 border p-2">
              <p className="font-mono text-sm font-bold">{action.title}</p>
              <ul className="mt-1 space-y-1">
                {action.fullText.map((line) => (
                  <li key={`${action.id}-${line}`} className="text-muted-foreground font-mono text-xs">
                    {line}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </Card>
      </div>
    </Card>
  );
}

export function CardBoardVariantF() {
  const { slots, cardMap, assignedIds, onDropToSlot, onClearSlot } = useActivitySlots();
  const activeCard = activityCards[1] ?? activityCards[0];

  if (!activeCard) {
    return (
      <Card className="bg-card border-2 p-4">
        <Header
          title="Card Board F: Focus Mode"
          subtitle="One active decision with rules prompts and next-up queue."
        />
        <p className="text-muted-foreground font-mono text-sm">No mock actions loaded.</p>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-2 p-4">
      <Header
        title="Card Board F: Focus Mode"
        subtitle="One active decision with rules prompts and next-up queue."
      />
      <RulesStrip />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="border p-3 xl:col-span-7">
          <p className="font-mono text-sm font-bold">Now Acting</p>
          <DragCard card={activeCard} assigned={assignedIds.has(activeCard.id)} className="mt-2" />
          <div className="border-primary/30 bg-primary/5 mt-3 p-2 font-mono text-xs">
            Prompt: drag cards into slots, then any player can commit when advancing week.
          </div>
          <SlotArea
            className="mt-3"
            title="Focus Slots"
            slots={slots}
            onDropToSlot={onDropToSlot}
            onClearSlot={onClearSlot}
            cardMap={cardMap}
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline">Review</Button>
            <Button>Commit</Button>
          </div>
        </Card>

        <Card className="border p-3 xl:col-span-5">
          <p className="font-mono text-sm font-bold">Deck</p>
          <div className="mt-2 space-y-2">
            {activityCards.map((action) => (
              <DragCard key={action.id} card={action} compact assigned={assignedIds.has(action.id)} />
            ))}
          </div>
        </Card>
      </div>
    </Card>
  );
}
