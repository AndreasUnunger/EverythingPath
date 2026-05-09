'use client';

import { LayoutList, PanelsTopLeft, Rows3, Users } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { cn } from '~/lib/utils';

type PrototypeCharacter = {
  id: string;
  name: string;
  kind: 'PC' | 'Officer NPC';
  level: number;
  role?: string;
  note: string;
  location: string;
  stats: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
};

type PrototypeRole = {
  id: string;
  label: string;
  assignedTo?: string;
};

const roster: PrototypeCharacter[] = [
  {
    id: 'kara',
    name: 'Kara Thorn',
    kind: 'PC',
    level: 8,
    role: 'Ambassador',
    note: 'Party face with the cleanest settlement relationships.',
    location: 'Longshadow',
    stats: { str: 12, dex: 14, con: 13, int: 11, wis: 15, cha: 18 },
  },
  {
    id: 'vesta',
    name: 'Vesta Rill',
    kind: 'Officer NPC',
    level: 6,
    role: 'Commandant',
    note: 'Reliable training lead for weeks where militia growth matters most.',
    location: 'Camp Pike',
    stats: { str: 14, dex: 10, con: 15, int: 12, wis: 13, cha: 11 },
  },
  {
    id: 'soren',
    name: 'Soren Pike',
    kind: 'PC',
    level: 7,
    role: 'Marshal',
    note: 'Keeps danger reduction consistent and handles patrol discipline.',
    location: 'Phaendar Road',
    stats: { str: 16, dex: 12, con: 14, int: 10, wis: 13, cha: 9 },
  },
  {
    id: 'iri',
    name: 'Iri Vale',
    kind: 'Officer NPC',
    level: 5,
    role: 'Overseer',
    note: 'Useful for upkeep-heavy weeks with multiple resource pressures.',
    location: 'Supply Annex',
    stats: { str: 10, dex: 11, con: 12, int: 15, wis: 14, cha: 13 },
  },
  {
    id: 'dain',
    name: 'Dain Holt',
    kind: 'PC',
    level: 9,
    role: 'Strategist',
    note: 'Best pick when the table wants tighter action efficiency.',
    location: 'Signal Tent',
    stats: { str: 11, dex: 13, con: 12, int: 18, wis: 14, cha: 12 },
  },
  {
    id: 'mira',
    name: 'Mira Fen',
    kind: 'PC',
    level: 7,
    note: 'Strong spymaster candidate with spare room for table notes.',
    location: 'West Watch',
    stats: { str: 9, dex: 17, con: 11, int: 14, wis: 13, cha: 15 },
  },
];

const roles: PrototypeRole[] = [
  { id: 'ambassador', label: 'Ambassador', assignedTo: 'Kara Thorn' },
  { id: 'commandant', label: 'Commandant', assignedTo: 'Vesta Rill' },
  { id: 'marshal', label: 'Marshal', assignedTo: 'Soren Pike' },
  { id: 'overseer', label: 'Overseer', assignedTo: 'Iri Vale' },
  { id: 'spymaster', label: 'Spymaster' },
  { id: 'strategist', label: 'Strategist', assignedTo: 'Dain Holt' },
];

type TableVariant = 'plain' | 'banded' | 'compact';

export function LedgerPagePrototypes() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-primary font-sans text-2xl font-bold">
          Ledger Interior Variants
        </h2>
        <p className="text-muted-foreground font-mono text-sm">
          These keep the live character ledger structure intact. Only the inside
          roster treatment changes, moving from cards to table-like rows and using
          a few more gray values for hierarchy.
        </p>
      </div>

      <Tabs defaultValue="plain" className="space-y-4">
        <TabsList className="bg-card h-auto w-full justify-start gap-1 border-2 p-1">
          <TabsTrigger value="plain" className="font-mono">
            <Rows3 className="size-4" />
            Plain Table
          </TabsTrigger>
          <TabsTrigger value="banded" className="font-mono">
            <PanelsTopLeft className="size-4" />
            Banded Table
          </TabsTrigger>
          <TabsTrigger value="compact" className="font-mono">
            <LayoutList className="size-4" />
            Compact Table
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plain">
          <PrototypeLedger variant="plain" />
        </TabsContent>
        <TabsContent value="banded">
          <PrototypeLedger variant="banded" />
        </TabsContent>
        <TabsContent value="compact">
          <PrototypeLedger variant="compact" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PrototypeLedger({ variant }: { variant: TableVariant }) {
  return (
    <section className="bg-card border-2">
      <div className="border-b-2 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-primary font-sans text-2xl font-bold">
              Character Ledger
            </h3>
            <p className="text-muted-foreground mt-1 font-mono text-sm">
              Tracking 6 active characters
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline">
              Show Archived
            </Button>
            <Button
              type="button"
              className="border-primary text-primary hover:bg-primary/80 hover:text-primary-foreground border-2 bg-transparent font-mono text-base"
            >
              Add Character
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <OfficerAssignmentsPreview />
        <RosterTable variant={variant} />
      </div>
    </section>
  );
}

function OfficerAssignmentsPreview() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="text-muted-foreground size-4" />
        <p className="font-mono text-sm font-bold tracking-wide">
          Officer Assignments
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((role) => (
          <div
            key={role.id}
            className="border-2 p-3 transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-bold">{role.label}</p>
                <p className="mt-1 font-sans text-lg font-bold">
                  {role.assignedTo ?? 'Unassigned'}
                </p>
              </div>
              {role.assignedTo ? (
                <Button type="button" variant="outline" size="sm">
                  Unassign
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RosterTable({ variant }: { variant: TableVariant }) {
  if (variant === 'compact') {
    return (
      <div className="space-y-3">
        <p className="font-mono text-sm font-bold tracking-wide">Active Characters</p>

        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col style={{ width: '25%' }} />
              <col />
              <col />
              <col />
              <col />
              <col />
              <col />
              <col />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr className="border-b border-primary/8">
                <th className="px-3 py-2 text-left font-mono text-xs tracking-wide text-muted-foreground font-normal">
                  Character
                </th>
                <th className="px-3 py-2 text-left font-mono text-xs tracking-wide text-muted-foreground font-normal">
                  Level
                </th>
                <th className="px-3 py-2 text-left font-mono text-xs tracking-wide text-muted-foreground font-normal">
                  STR
                </th>
                <th className="px-3 py-2 text-left font-mono text-xs tracking-wide text-muted-foreground font-normal">
                  DEX
                </th>
                <th className="px-3 py-2 text-left font-mono text-xs tracking-wide text-muted-foreground font-normal">
                  CON
                </th>
                <th className="px-3 py-2 text-left font-mono text-xs tracking-wide text-muted-foreground font-normal">
                  INT
                </th>
                <th className="px-3 py-2 text-left font-mono text-xs tracking-wide text-muted-foreground font-normal">
                  WIS
                </th>
                <th className="px-3 py-2 text-left font-mono text-xs tracking-wide text-muted-foreground font-normal">
                  CHA
                </th>
                <th className="px-3 py-2 text-left font-mono text-xs tracking-wide text-muted-foreground font-normal">
                  Role
                </th>
                <th className="px-3 py-2 text-left font-mono text-xs tracking-wide text-muted-foreground font-normal">
                </th>
              </tr>
            </thead>
            <tbody>
              {roster.map((character, index) => (
                <tr
                  key={character.id}
                  className={cn(
                    'border-b border-primary/8 last:border-b-0',
                    index === 0
                      ? 'bg-background/36'
                      : index % 2 === 0
                        ? 'bg-background/18'
                        : 'bg-background/8',
                  )}
                >
                  <td className="px-3 py-3 align-top">
                    <p className="truncate font-sans text-lg font-bold">{character.name}</p>
                  </td>
                  <td className="px-3 py-3 align-top font-mono text-sm">
                    {character.level}
                  </td>
                  <td className="px-3 py-3 align-top font-mono text-sm">
                    {character.stats.str}
                  </td>
                  <td className="px-3 py-3 align-top font-mono text-sm">
                    {character.stats.dex}
                  </td>
                  <td className="px-3 py-3 align-top font-mono text-sm">
                    {character.stats.con}
                  </td>
                  <td className="px-3 py-3 align-top font-mono text-sm">
                    {character.stats.int}
                  </td>
                  <td className="px-3 py-3 align-top font-mono text-sm">
                    {character.stats.wis}
                  </td>
                  <td className="px-3 py-3 align-top font-mono text-sm">
                    {character.stats.cha}
                  </td>
                  <td className="px-3 py-3 align-top font-mono text-sm">
                    {character.role ?? 'Open'}
                  </td>
                  <td className="px-3 py-3 text-right align-top">
                    <Button type="button" variant="outline" size="sm">
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="font-mono text-sm font-bold tracking-wide">Active Characters</p>

      <div
        className={cn(
          'border-2',
          variant === 'plain' ? 'bg-card' : 'bg-background/20',
        )}
      >
        <div
          className={cn(
            'grid px-3 font-mono text-xs tracking-wide text-muted-foreground [&>p]:justify-self-start [&>p]:text-left',
            'grid-cols-[minmax(0,1.3fr)_80px_80px_130px_120px] py-3',
          )}
        >
          <p>Character</p>
          <p>Level</p>
          <p>CHA</p>
          <p>Role</p>
          <p>Location</p>
        </div>
        <Separator className="bg-border" />

        <div>
          {roster.map((character, index) => (
            <div key={character.id}>
              <div
                className={cn(
                  'grid gap-3 px-3',
                  'grid-cols-[minmax(0,1.3fr)_80px_80px_130px_120px] py-4',
                  rowToneClass(variant, index),
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4
                      className={cn(
                        'font-sans font-bold',
                        'text-xl',
                      )}
                    >
                      {character.name}
                    </h4>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {character.kind}
                    </Badge>
                  </div>
                  <p
                    className={cn(
                      'text-muted-foreground font-mono',
                      'mt-1 text-sm leading-6',
                    )}
                  >
                    {character.note}
                  </p>
                </div>

                <p className="font-mono text-sm">{character.level}</p>
                <p className="font-mono text-sm">{character.stats.cha}</p>
                <p className="font-mono text-sm">{character.role ?? 'Open'}</p>
                <p className="font-mono text-sm">{character.location}</p>
              </div>
              {index < roster.length - 1 ? (
                <Separator className={separatorToneClass(variant)} />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function rowToneClass(variant: TableVariant, index: number) {
  if (variant === 'plain') {
    return index === 0 ? 'bg-background/15' : '';
  }

  if (variant === 'banded') {
    if (index === 0) {
      return 'bg-background/40';
    }
    return index % 2 === 0
      ? 'bg-background/24 hover:bg-background/30'
      : 'bg-background/10 hover:bg-background/18';
  }

  if (index === 0) {
    return 'bg-background/36';
  }
  return index % 2 === 0 ? 'bg-background/18' : 'bg-background/8';
}

function separatorToneClass(variant: TableVariant) {
  if (variant === 'plain') return 'bg-border';
  if (variant === 'banded') return 'bg-primary/15';
  return 'bg-primary/8';
}
