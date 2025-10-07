'use client';

import { useState } from 'react';
import { Card } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Plus, Shield, Sword, Heart, Zap } from 'lucide-react';

interface Squad {
  id: string;
  name: string;
  size: number;
  officer: string;
  morale: number;
  hp: number;
  maxHp: number;
  boons: string[];
}

export function MilitiaSystem() {
  const [squads] = useState<Squad[]>([
    {
      id: '1',
      name: 'Phaendar Guard',
      size: 15,
      officer: 'Captain Aubrin',
      morale: 8,
      hp: 45,
      maxHp: 50,
      boons: ['Defensive Training', 'Local Knowledge'],
    },
    {
      id: '2',
      name: 'Forest Scouts',
      size: 12,
      officer: 'Ranger Kining',
      morale: 7,
      hp: 38,
      maxHp: 40,
      boons: ['Stealth Tactics', 'Archery'],
    },
    {
      id: '3',
      name: 'Civilian Militia',
      size: 20,
      officer: 'Sergeant Halk',
      morale: 5,
      hp: 30,
      maxHp: 45,
      boons: ['Improvised Weapons'],
    },
  ]);

  return (
    <div className="space-y-0">
      {/* Militia Header */}
      <div className="bg-card flex items-center justify-between border-2 border-b-0 p-4">
        <div>
          <h2 className="text-primary font-sans text-2xl font-bold">
            Militia Management
          </h2>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            Total Forces: {squads.reduce((acc, s) => acc + s.size, 0)} troops
            across {squads.length} squads
          </p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          New Squad
        </Button>
      </div>

      <div className="rune-divider" data-pattern="2" />

      {/* Squad Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {squads.map((squad, index) => (
          <div key={squad.id}>
            <Card className="bg-card border-primary/30 hover:border-primary/50 rounded-none border-t-0 border-l-0 p-4 transition-colors lg:odd:border-r-0">
              <div className="space-y-3">
                {/* Squad Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-primary font-sans text-xl font-bold">
                      {squad.name}
                    </h3>
                    <p className="text-muted-foreground mt-1 font-mono text-sm">
                      Officer: {squad.officer}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-primary/50 text-primary font-mono"
                  >
                    {squad.size} troops
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
                        {squad.hp}/{squad.maxHp}
                      </span>
                    </div>
                    <div className="bg-secondary h-2 w-full rounded-full">
                      <div
                        className="bg-destructive h-2 rounded-full transition-all"
                        style={{ width: `${(squad.hp / squad.maxHp) * 100}%` }}
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
                        {squad.morale}/10
                      </span>
                    </div>
                    <div className="bg-secondary h-2 w-full rounded-full">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${(squad.morale / 10) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Boons */}
                <div>
                  <h4 className="text-muted-foreground mb-1 flex items-center gap-2 font-mono text-sm">
                    <Shield className="h-4 w-4" />
                    Active Boons
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {squad.boons.map((boon) => (
                      <Badge
                        key={boon}
                        variant="secondary"
                        className="bg-accent/20 text-accent border-accent/50 font-mono text-xs"
                      >
                        {boon}
                      </Badge>
                    ))}
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
                    Deploy
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
            {index < squads.length - 1 && index % 2 === 1 && (
              <div className="rune-divider lg:col-span-2" data-pattern="3" />
            )}
          </div>
        ))}
      </div>

      <div className="rune-divider" data-pattern="4" />

      {/* Militia Resources */}
      <Card className="bg-card rounded-none border-2 border-x-0 border-b-0 p-4">
        <h3 className="text-primary mb-3 font-sans text-lg font-bold">
          Available Resources
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4">
          <div className="bg-secondary border-2 border-r border-b p-4 text-center">
            <p className="text-primary font-mono text-2xl font-bold">250</p>
            <p className="text-muted-foreground font-mono text-sm">Supplies</p>
          </div>
          <div className="bg-secondary border-2 border-r border-b p-4 text-center md:border-r">
            <p className="text-primary font-mono text-2xl font-bold">18</p>
            <p className="text-muted-foreground font-mono text-sm">Weapons</p>
          </div>
          <div className="bg-secondary border-2 border-r border-b p-4 text-center">
            <p className="text-primary font-mono text-2xl font-bold">12</p>
            <p className="text-muted-foreground font-mono text-sm">
              Armor Sets
            </p>
          </div>
          <div className="bg-secondary border-2 border-b p-4 text-center">
            <p className="text-primary font-mono text-2xl font-bold">5</p>
            <p className="text-muted-foreground font-mono text-sm">Healers</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
