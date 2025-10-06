'use client';

import { useState } from 'react';
import { Card } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { Plus, User } from 'lucide-react';

interface Character {
  id: string;
  name: string;
  type: 'PC' | 'NPC' | 'Enemy';
  class: string;
  level: number;
  status: 'Active' | 'Injured' | 'Dead';
  location: string;
}

export function CharacterManager() {
  const [characters] = useState<Character[]>([
    {
      id: '1',
      name: 'Valeria Stormwind',
      type: 'PC',
      class: 'Fighter',
      level: 5,
      status: 'Active',
      location: 'Phaendar',
    },
    {
      id: '2',
      name: 'Theron Leafwhisper',
      type: 'PC',
      class: 'Ranger',
      level: 5,
      status: 'Active',
      location: 'Phaendar',
    },
    {
      id: '3',
      name: 'Mira Goldenheart',
      type: 'PC',
      class: 'Cleric',
      level: 4,
      status: 'Injured',
      location: 'Phaendar',
    },
    {
      id: '4',
      name: 'Aubrin the Green',
      type: 'NPC',
      class: 'Ranger',
      level: 6,
      status: 'Active',
      location: 'Phaendar',
    },
    {
      id: '5',
      name: 'General Azaersi',
      type: 'Enemy',
      class: 'Warlord',
      level: 12,
      status: 'Active',
      location: 'Unknown',
    },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-primary/20 text-primary border-primary/50';
      case 'Injured':
        return 'bg-destructive/20 text-destructive border-destructive/50';
      case 'Dead':
        return 'bg-muted text-muted-foreground border-border';
      default:
        return 'bg-secondary text-secondary-foreground border-border';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'PC':
        return 'bg-primary/20 text-primary border-primary/50';
      case 'NPC':
        return 'bg-accent/20 text-accent border-accent/50';
      case 'Enemy':
        return 'bg-destructive/20 text-destructive border-destructive/50';
      default:
        return 'bg-secondary text-secondary-foreground border-border';
    }
  };

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="bg-card flex items-center justify-between border-2 border-b-0 p-4">
        <div>
          <h2 className="text-primary font-sans text-2xl font-bold">
            Character Registry
          </h2>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            Tracking {characters.length} entities
          </p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          Add Character
        </Button>
      </div>

      <div className="rune-divider" data-pattern="5" />

      {/* Character List */}
      <div className="grid grid-cols-1">
        {characters.map((character, index) => (
          <div key={character.id}>
            <Card className="bg-card hover:border-primary/30 rounded-none border-2 border-x-0 border-t-0 p-4 transition-colors">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <Avatar className="border-primary/50 h-16 w-16 border-2">
                  <AvatarFallback className="bg-primary/20 text-primary font-mono text-lg font-bold">
                    {character.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-foreground font-sans text-xl font-bold">
                      {character.name}
                    </h3>
                    <Badge
                      variant="outline"
                      className={
                        getTypeColor(character.type) + ' font-mono text-xs'
                      }
                    >
                      {character.type}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        getStatusColor(character.status) + ' font-mono text-xs'
                      }
                    >
                      {character.status}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-3 font-mono text-sm">
                    <span>
                      <span className="text-primary">Class:</span>{' '}
                      {character.class}
                    </span>
                    <span>
                      <span className="text-primary">Level:</span>{' '}
                      {character.level}
                    </span>
                    <span>
                      <span className="text-primary">Location:</span>{' '}
                      {character.location}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-primary/50 text-primary hover:bg-primary/10 bg-transparent"
                  >
                    <User className="mr-2 h-3 w-3" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hover:bg-secondary border-2 bg-transparent"
                  >
                    Edit
                  </Button>
                </div>
              </div>
            </Card>
            {index < characters.length - 1 && (
              <div
                className="rune-divider"
                data-pattern={String((index % 5) + 1)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
