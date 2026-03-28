import { Badge } from '~/components/ui/badge';
import { Card } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { mockActions, mockTeams, mockWeekState } from './mock-data';

const statusClassMap: Record<string, string> = {
  available: 'border-primary/40 bg-card',
  claimed: 'border-amber-500/60 bg-amber-500/5',
  confirmed: 'border-emerald-500/60 bg-emerald-500/5',
};

export function WeekBoardTacticalCards() {
  return (
    <Card className="bg-card border-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-primary font-sans text-xl font-bold">Version B: Tactical Cards</h3>
          <p className="text-muted-foreground font-mono text-sm">Card-first staging board for fast table decisions.</p>
        </div>
        <Badge variant="outline" className="font-mono">
          Phase: {mockWeekState.phase}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="border p-3 xl:col-span-3">
          <p className="mb-2 font-mono text-sm font-bold">Action Cards</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {mockActions.map((action) => (
              <Card
                key={action.id}
                className={`border-2 p-3 transition-transform hover:-translate-y-0.5 ${statusClassMap[action.status]}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-base font-bold">{action.title}</p>
                    <p className="text-muted-foreground font-mono text-xs">{action.team}</p>
                  </div>
                  <Badge variant="outline" className="font-mono text-[11px] uppercase">
                    {action.status}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-3 font-mono text-xs">Cost: {action.cost}</p>
              </Card>
            ))}
          </div>
        </Card>

        <Card className="border p-3 xl:col-span-2">
          <p className="mb-2 font-mono text-sm font-bold">Drop Slots</p>
          <div className="space-y-2">
            {['Slot 1', 'Slot 2', 'Slot 3'].map((slot, index) => (
              <div key={slot} className="border-primary/30 bg-primary/5 min-h-20 border-2 border-dashed p-3">
                <p className="font-mono text-sm">{slot}</p>
                <p className="text-muted-foreground mt-1 font-mono text-xs">
                  {index === 0 ? 'Reduce Danger staged by Aubrin' : 'Drag a card here to stage'}
                </p>
              </div>
            ))}
          </div>
          <Button className="mt-3 w-full">Confirm Staged Actions</Button>
        </Card>
      </div>

      <Card className="mt-4 border p-3">
        <p className="mb-2 font-mono text-sm font-bold">Team Status</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {mockTeams.map((team) => (
            <div key={team.id} className="border p-2">
              <p className="font-mono text-sm">{team.name}</p>
              <Badge variant="outline" className="mt-1 font-mono text-[11px] uppercase">
                {team.status}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </Card>
  );
}
