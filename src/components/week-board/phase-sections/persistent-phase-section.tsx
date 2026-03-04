'use client';

import type { Id } from '@convex/_generated/dataModel';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';

export type PersistentPhaseViewModel = {
  persistentEvents: Array<{
    _id: Id<'militiaEventState'>;
    eventType: string;
    startedWeek: number;
  }>;
  currentTreasury: number;
  buyoffCost: number;
  buyoffWeeksRemaining: number;
  canBuyoffNow: boolean;
  onBuyOffPersistentEventAction: (eventStateId: Id<'militiaEventState'>) => void;
};

function formatPersistentEventTypeLabel(eventType: string) {
  return eventType
    .split('_')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

export function PersistentPhaseSection({
  viewModel,
}: {
  viewModel: PersistentPhaseViewModel;
}) {
  const {
    persistentEvents,
    currentTreasury,
    buyoffCost,
    buyoffWeeksRemaining,
    canBuyoffNow,
    onBuyOffPersistentEventAction,
  } = viewModel;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Card className="border p-3">
        <p className="mb-2 font-mono text-sm font-bold">Persistent Events</p>
        <div className="space-y-2">
          {persistentEvents.map((eventState) => (
            <div key={eventState._id} className="border p-2">
              <p className="font-mono text-sm font-bold">
                {formatPersistentEventTypeLabel(eventState.eventType)}
              </p>
              <p className="text-muted-foreground font-mono text-xs">
                Active since week {eventState.startedWeek}
              </p>
              <div className="mt-2">
                <Button
                  variant="outline"
                  disabled={!canBuyoffNow || currentTreasury < buyoffCost}
                  onClick={() => onBuyOffPersistentEventAction(eventState._id)}
                >
                  Buy Off ({buyoffCost} gp)
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="border p-3">
        <p className="font-mono text-sm font-bold">Persistent Rules</p>
        <ul className="text-muted-foreground mt-2 space-y-1 font-mono text-xs">
          <li>Persistent events apply week-to-week until ended.</li>
          <li>Oldest persistent events are resolved first by effects that end them.</li>
          <li>Buyoff is available once every 4 weeks.</li>
        </ul>
        {!canBuyoffNow ? (
          <p className="text-muted-foreground mt-2 font-mono text-xs">
            Buyoff cooldown: {buyoffWeeksRemaining} week
            {buyoffWeeksRemaining === 1 ? '' : 's'} remaining.
          </p>
        ) : null}
        {currentTreasury < buyoffCost ? (
          <p className="text-muted-foreground mt-2 font-mono text-xs">
            Not enough treasury for buyoff ({currentTreasury}/{buyoffCost} gp).
          </p>
        ) : null}
      </Card>
    </div>
  );
}
