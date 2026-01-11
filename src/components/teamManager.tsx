'use client';

import { Card } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Sword, Heart, Zap } from 'lucide-react';
import AddButton from './ui/AddButton';
import { useOrganization } from '@clerk/nextjs';
import { militiaQuery } from '~/lib/sharedQueries';

export function TeamManager({
  selectedCampaignId,
}: {
  selectedCampaignId: string | undefined;
}) {
  const { organization } = useOrganization();
  const { data: militia } = militiaQuery(selectedCampaignId, organization?.id);

  if (!militia) {
    return <p>Create a militia to be able to assign teams</p>;
  }
  return (
    <div className="space-y-4">
      {/* Militia Header */}
      <div className="bg-card corner-brackets flex items-center justify-between p-4">
        <div>
          <h2 className="text-primary font-sans text-2xl font-bold">
            Team Management
          </h2>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            Total Forces: {militia.teams.reduce((acc, s) => acc + s.size, 0)}{' '}
            troops across {militia.teams.length} teams
          </p>
        </div>
        <AddButton title={'NEW TEAM'} />
      </div>

      {/* Team Cards */}
      <div className="grid grid-cols-1 gap-4 pb-4 lg:grid-cols-2">
        {militia?.teams.map((team) => (
          <div key={team.id}>
            <Card className="bg-card corner-brackets border-primary/30 hover:border-primary/50 border-t-0 border-l-0 p-4 transition-colors lg:odd:border-r-0">
              <div className="space-y-3">
                {/* Team Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-primary font-sans text-xl font-bold">
                      {team.name}
                    </h3>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-primary/50 text-primary font-mono"
                  >
                    {team.size} troops
                  </Badge>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Heart className="text-destructive h-4 w-4" />
                      <span className="text-muted-foreground font-mono">
                        HP:
                      </span>
                      <span className="text-foreground font-mono font-bold">
                        {34}/{45}
                      </span>
                    </div>
                    <div className="bg-secondary h-2 w-full">
                      <div
                        className="bg-destructive h-2 transition-all"
                        style={{ width: `${(34 / 45) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Zap className="text-primary h-4 w-4" />
                      <span className="text-muted-foreground font-mono">
                        Morale:
                      </span>
                      <span className="text-foreground font-mono font-bold">
                        {4}/10
                      </span>
                    </div>
                    <div className="bg-secondary h-2 w-full">
                      <div
                        className="bg-primary h-2 transition-all"
                        style={{ width: `${(4 / 10) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-primary/50 text-primary hover:bg-primary/10 flex-1 bg-transparent"
                  >
                    <Sword className="mr-2 h-3 w-3" />
                    Set Status
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hover:bg-secondary flex-1 border-2 bg-transparent"
                  >
                    Edit
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
