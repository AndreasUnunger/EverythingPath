'use client';

import { Card } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Calendar, MapPin, Users, Trophy } from 'lucide-react';

export function CampaignOverview() {
  return (
    <div className="space-y-0">
      {/* Campaign Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4">
        <Card className="bg-card border-primary/30 glow-border arcane-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground font-mono text-sm">Session</p>
              <p className="text-primary font-mono text-3xl font-bold">12</p>
            </div>
            <Calendar className="text-primary/50 h-8 w-8" />
          </div>
        </Card>

        <Card className="bg-card border-primary/30 glow-border arcane-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground font-mono text-sm">
                Location
              </p>
              <p className="text-primary font-mono text-lg font-bold">
                Phaendar
              </p>
            </div>
            <MapPin className="text-primary/50 h-8 w-8" />
          </div>
        </Card>

        <Card className="bg-card border-primary/30 glow-border arcane-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground font-mono text-sm">
                Militia Size
              </p>
              <p className="text-primary font-mono text-3xl font-bold">47</p>
            </div>
            <Users className="text-primary/50 h-8 w-8" />
          </div>
        </Card>

        <Card className="bg-card border-primary/30 glow-border arcane-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground font-mono text-sm">
                Victories
              </p>
              <p className="text-primary font-mono text-3xl font-bold">3</p>
            </div>
            <Trophy className="text-primary/50 h-8 w-8" />
          </div>
        </Card>
      </div>

      {/* Rune Divider */}
      <div className="rune-divider" data-pattern="1" />

      {/* Campaign Info */}
      <Card className="bg-card rounded-none border-2 border-x-0 border-b-0 p-4">
        <h2 className="text-primary mb-3 font-sans text-2xl font-bold">
          Campaign: Trail of the Hunted
        </h2>
        <div className="space-y-3">
          <div>
            <h3 className="text-muted-foreground mb-1 font-mono text-sm">
              STATUS
            </h3>
            <Badge className="bg-primary/20 text-primary border-primary/50">
              Active - Book 1
            </Badge>
          </div>
          <div>
            <h3 className="text-muted-foreground mb-1 font-mono text-sm">
              CURRENT OBJECTIVE
            </h3>
            <p className="text-foreground font-mono text-sm">
              Defend Phaendar from the Ironfang Legion invasion. Evacuate
              civilians and establish militia defenses.
            </p>
          </div>
          <div>
            <h3 className="text-muted-foreground mb-1 font-mono text-sm">
              RECENT EVENTS
            </h3>
            <ul className="space-y-1 font-mono text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary">▸</span>
                <span>Hobgoblin forces spotted near the eastern gate</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">▸</span>
                <span>Militia training completed - 12 new recruits</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">▸</span>
                <span>Supply cache discovered in abandoned warehouse</span>
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
