import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import type { TeamRecord } from './types';

export function TeamListCard({
  teams,
  pendingTeamId,
  onEdit,
}: {
  teams: TeamRecord[];
  pendingTeamId?: string;
  onEdit: (team: TeamRecord) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {teams.map((team) => (
        <Card key={team.id} className="bg-card border-2 p-4">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-primary font-sans text-lg font-bold">
                  {team.name}
                </h3>
                <p className="text-muted-foreground font-mono text-sm">
                  {team.type} tier {team.tier} • {team.size} troops
                </p>
              </div>
              <Badge variant="outline" className="font-mono">
                {formatTeamStatus(team.status)}
              </Badge>
            </div>

            <div className="border-primary/30 bg-background/40 border p-3">
              <p className="font-mono text-sm font-bold">Manager</p>
              {team.manager ? (
                <div className="mt-1 space-y-1">
                  <p className="font-mono text-sm">
                    {team.manager.displayName} • {formatManagerKind(team.manager.kind)}
                  </p>
                  <p className="text-muted-foreground font-mono text-xs">
                    CHA {team.manager.charisma} • bonus{' '}
                    {formatSigned(team.manager.charismaBonus)} • managing{' '}
                    {team.manager.managedTeamCount}/{team.manager.maxTeams} teams
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground mt-1 font-mono text-sm">
                  No manager assigned
                </p>
              )}
            </div>

            {team.manager?.warnings.length ? (
              <div className="border-primary/40 bg-primary/10 space-y-1 border p-3">
                {team.manager.warnings.map((warning) => (
                  <p key={warning} className="font-mono text-xs">
                    {warning}
                  </p>
                ))}
              </div>
            ) : null}

            <div className="space-y-1">
              <p className="text-muted-foreground font-mono text-xs">
                Granted actions
              </p>
              <p className="font-mono text-sm">
                {team.grantedActions.length
                  ? team.grantedActions.join(', ')
                  : 'None'}
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onEdit(team)}
                disabled={pendingTeamId === team.id}
              >
                {pendingTeamId === team.id ? 'Saving...' : 'Edit Manager'}
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function formatTeamStatus(status: TeamRecord['status']) {
  if (status === 'disabled') return 'Disabled';
  if (status === 'missing') return 'Missing';
  if (status === 'blocked') return 'Blocked';
  return 'Active';
}

function formatManagerKind(kind: 'pc' | 'officer_npc' | 'other_npc') {
  if (kind === 'officer_npc') return 'Officer NPC';
  if (kind === 'other_npc') return 'Other NPC';
  return 'PC';
}

function formatSigned(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}
