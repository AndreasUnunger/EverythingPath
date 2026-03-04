import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { mockActions, mockEvents, mockWeekState } from './mock-data';

export function WeekBoardCommandCenter() {
  return (
    <Card className="bg-card border-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div>
          <h3 className="text-primary font-sans text-xl font-bold">Version A: Command Center</h3>
          <p className="text-muted-foreground font-mono text-sm">
            Week {mockWeekState.week} • {mockWeekState.inGameDate}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 font-mono text-sm">
          <Badge variant="outline">Rank {mockWeekState.rank}</Badge>
          <Badge variant="outline">Training {mockWeekState.training}</Badge>
          <Badge variant="outline">Treasury {mockWeekState.treasury}</Badge>
          <Badge variant="outline">Notoriety {mockWeekState.notoriety}</Badge>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="border p-3">
          <p className="font-mono text-sm font-bold">1. Upkeep</p>
          <p className="text-muted-foreground mt-1 font-mono text-sm">Resolve attrition, resources, and rank checks.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline">Open</Button>
            <Button size="sm">Confirm</Button>
          </div>
        </Card>

        <Card className="border-primary/60 bg-primary/5 border p-3">
          <p className="font-mono text-sm font-bold">2. Activity (Current)</p>
          <div className="mt-2 space-y-2">
            {mockActions.slice(0, 3).map((action) => (
              <div key={action.id} className="flex items-center justify-between border p-2">
                <div>
                  <p className="font-mono text-sm">{action.title}</p>
                  <p className="text-muted-foreground font-mono text-xs">{action.team}</p>
                </div>
                <Badge variant="outline" className="font-mono text-xs uppercase">{action.status}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="border p-3">
          <p className="font-mono text-sm font-bold">3. Event</p>
          <div className="mt-2 space-y-2">
            {mockEvents.slice(0, 2).map((event) => (
              <div key={event.id} className="flex items-center justify-between border p-2">
                <p className="font-mono text-sm">{event.name}</p>
                <Badge variant="outline" className="font-mono text-xs uppercase">
                  {event.tags[0] ?? 'event'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Card>
  );
}
