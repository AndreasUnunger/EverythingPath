import { Badge } from '~/components/ui/badge';
import { Card } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { mockActions, mockEvents, mockTeams, mockWeekState } from './mock-data';

export function WeekBoardPhaseLanes() {
  return (
    <Card className="bg-card border-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-primary font-sans text-xl font-bold">Version C: Phase Lanes</h3>
          <p className="text-muted-foreground font-mono text-sm">
            Compact lane layout for tablet landscape play.
          </p>
        </div>
        <div className="text-right font-mono text-sm">
          <p>Week {mockWeekState.week}</p>
          <p className="text-muted-foreground">{mockWeekState.inGameDate}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Card className="border p-3 lg:col-span-3">
          <p className="font-mono text-sm font-bold">Militia Snapshot</p>
          <div className="mt-2 space-y-1 font-mono text-sm">
            <p>Rank: {mockWeekState.rank}</p>
            <p>Training: {mockWeekState.training}</p>
            <p>Treasury: {mockWeekState.treasury}</p>
            <p>Notoriety: {mockWeekState.notoriety}</p>
          </div>
          <p className="mt-3 font-mono text-xs font-bold">Reputation</p>
          <div className="mt-1 space-y-1">
            {Object.entries(mockWeekState.reputation).map(([place, value]) => (
              <div key={place} className="flex items-center justify-between font-mono text-xs">
                <span>{place}</span>
                <Badge variant="outline">{value}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="border p-3 lg:col-span-6">
          <p className="font-mono text-sm font-bold">Current Queue</p>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            {mockActions.map((action) => (
              <div key={action.id} className="border p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-sm">{action.title}</p>
                  <Badge variant="outline" className="text-[11px] uppercase">
                    {action.status}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1 font-mono text-xs">{action.team}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline">Release Claims</Button>
            <Button size="sm">Advance to Event</Button>
          </div>
        </Card>

        <Card className="border p-3 lg:col-span-3">
          <p className="font-mono text-sm font-bold">Events + Teams</p>
          <div className="mt-2 space-y-2">
            {mockEvents.map((event) => (
              <div key={event.id} className="border p-2">
                <p className="font-mono text-xs">{event.name}</p>
                <p className="text-muted-foreground font-mono text-[11px] uppercase">
                  {event.tags.join(' • ')}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1">
            {mockTeams.slice(0, 3).map((team) => (
              <div key={team.id} className="flex items-center justify-between font-mono text-xs">
                <span>{team.name}</span>
                <Badge variant="outline" className="text-[11px] uppercase">{team.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Card>
  );
}
