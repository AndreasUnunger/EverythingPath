'use client';

import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';

type OfficerRole = {
  id: string;
  label: string;
  assignedTo?: string;
  bonus: string;
};

type Character = {
  id: string;
  name: string;
  kind: 'PC' | 'Officer NPC';
  level: number;
  role?: string;
  note?: string;
};

const roles: OfficerRole[] = [
  { id: 'ambassador', label: 'Ambassador', assignedTo: 'Kara Thorn', bonus: '+2 Loyalty focus checks' },
  { id: 'commandant', label: 'Commandant', assignedTo: 'Vesta Rill', bonus: '+1 HD on Drill Militia gain' },
  { id: 'marshal', label: 'Marshal', assignedTo: 'Soren Pike', bonus: '+2 Security checks' },
  { id: 'overseer', label: 'Overseer', assignedTo: 'Iri Vale', bonus: '+1 secondary organization checks' },
  { id: 'spymaster', label: 'Spymaster', bonus: '+2 Secrecy checks' },
  { id: 'strategist', label: 'Strategist', assignedTo: 'Dain Holt', bonus: '+1 action slot and +2 bonus action check' },
];

const characters: Character[] = [
  { id: 'kara', name: 'Kara Thorn', kind: 'PC', level: 8, role: 'Ambassador', note: 'High CHA, party face' },
  { id: 'vesta', name: 'Vesta Rill', kind: 'Officer NPC', level: 6, role: 'Commandant', note: 'Best for training weeks' },
  { id: 'soren', name: 'Soren Pike', kind: 'PC', level: 7, role: 'Marshal', note: 'Security specialist' },
  { id: 'iri', name: 'Iri Vale', kind: 'Officer NPC', level: 5, role: 'Overseer', note: 'Supports upkeep and events' },
  { id: 'dain', name: 'Dain Holt', kind: 'PC', level: 9, role: 'Strategist', note: 'Keeps bonus action online' },
  { id: 'mira', name: 'Mira Fen', kind: 'PC', level: 7, note: 'Likely Spymaster candidate' },
];

export function CharacterOfficerPrototypes() {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-primary font-sans text-2xl font-bold">
          Character + Officer UX Prototypes
        </h2>
        <p className="text-muted-foreground font-mono text-sm">
          Four mock-data directions for combining character management with officer assignment.
        </p>
      </div>

      <Tabs defaultValue="drawer" className="w-full">
        <TabsList className="h-auto w-full justify-start gap-1 p-1">
          <TabsTrigger value="drawer" className="font-mono">1. Drawer Split</TabsTrigger>
          <TabsTrigger value="board" className="font-mono">2. Officer Board</TabsTrigger>
          <TabsTrigger value="cards" className="font-mono">3. Character Cards</TabsTrigger>
          <TabsTrigger value="planner" className="font-mono">4. Two-Pane Planner</TabsTrigger>
        </TabsList>

        <TabsContent value="drawer">
          <DrawerSplitVariant />
        </TabsContent>
        <TabsContent value="board">
          <OfficerBoardVariant />
        </TabsContent>
        <TabsContent value="cards">
          <CharacterCardsVariant />
        </TabsContent>
        <TabsContent value="planner">
          <TwoPanePlannerVariant />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DrawerSplitVariant() {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
      <Card className="border-2">
        <CardHeader className="border-b-2">
          <CardTitle className="font-sans text-xl">Character Ledger</CardTitle>
          <CardDescription className="font-mono">
            Default workspace stays character-first. Officer assignment opens in a focused side drawer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between border-2 p-3">
            <div>
              <p className="font-sans text-lg font-bold">Active Characters</p>
              <p className="text-muted-foreground font-mono text-sm">
                6 active, 2 archived
              </p>
            </div>
            <Button type="button" variant="outline">Open Officer Drawer</Button>
          </div>
          <div className="grid gap-3">
            {characters.map((character) => (
              <div key={character.id} className="border-2 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-sans text-lg font-bold">{character.name}</p>
                    <p className="text-muted-foreground font-mono text-sm">
                      {character.kind} • lvl {character.level}
                    </p>
                  </div>
                  <Badge variant="outline" className="font-mono">
                    {character.role ?? 'Unassigned'}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-2 font-mono text-sm">
                  {character.note}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader className="border-b-2">
          <CardTitle className="font-sans text-xl">Officer Drawer</CardTitle>
          <CardDescription className="font-mono">
            Opened from the ledger. Roles stay visible while browsing candidates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {roles.map((role) => (
            <div key={role.id} className="border-2 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-sans text-lg font-bold">{role.label}</p>
                  <p className="text-muted-foreground font-mono text-sm">
                    {role.assignedTo ?? 'Unassigned'}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm">
                  Replace
                </Button>
              </div>
              <p className="text-muted-foreground mt-2 font-mono text-xs">
                {role.bonus}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function OfficerBoardVariant() {
  return (
    <Card className="border-2">
      <CardHeader className="border-b-2">
        <CardTitle className="font-sans text-xl">Officer Board First</CardTitle>
        <CardDescription className="font-mono">
          The fixed six-role board is primary. Character details become a follow-up picker action.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => (
            <div key={role.id} className="border-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-sans text-lg font-bold">{role.label}</p>
                <Badge variant="outline" className="font-mono">
                  {role.assignedTo ? 'Filled' : 'Open'}
                </Badge>
              </div>
              <p className="mt-3 font-mono text-base">
                {role.assignedTo ?? 'Select a character'}
              </p>
              <p className="text-muted-foreground mt-1 font-mono text-xs">
                {role.bonus}
              </p>
              <div className="mt-4 flex gap-2">
                <Button type="button" variant="outline" size="sm">
                  Choose Character
                </Button>
                <Button type="button" variant="outline" size="sm">
                  Clear
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="border-2 p-4">
          <p className="font-sans text-lg font-bold">Character Picker Preview</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {characters.map((character) => (
              <div key={character.id} className="border-2 p-3">
                <p className="font-sans text-lg font-bold">{character.name}</p>
                <p className="text-muted-foreground font-mono text-sm">
                  {character.kind} • lvl {character.level}
                </p>
                <p className="text-muted-foreground mt-2 font-mono text-xs">
                  Current role: {character.role ?? 'None'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CharacterCardsVariant() {
  return (
    <Card className="border-2">
      <CardHeader className="border-b-2">
        <CardTitle className="font-sans text-xl">Character Cards With Role Badges</CardTitle>
        <CardDescription className="font-mono">
          Character cards are the main object. Role assignment is layered on top through badges and quick actions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {characters.map((character) => (
            <div key={character.id} className="border-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-sans text-lg font-bold">{character.name}</p>
                  <p className="text-muted-foreground font-mono text-sm">
                    {character.kind} • lvl {character.level}
                  </p>
                </div>
                <Badge variant="outline" className="font-mono">
                  {character.role ?? 'No Role'}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-3 font-mono text-sm">
                {character.note}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm">
                  Change Role
                </Button>
                <Button type="button" variant="outline" size="sm">
                  Edit Sheet
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="border-2 p-4">
          <p className="font-sans text-lg font-bold">Role Strip</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {roles.map((role) => (
              <Badge key={role.id} variant="outline" className="px-3 py-1 font-mono">
                {role.label}: {role.assignedTo ?? 'Open'}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TwoPanePlannerVariant() {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <Card className="border-2">
        <CardHeader className="border-b-2">
          <CardTitle className="font-sans text-xl">Roster Pane</CardTitle>
          <CardDescription className="font-mono">
            Scan candidates on the left, assign into role slots on the right.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="border-2 p-3">
            <p className="font-sans text-lg font-bold">Candidate Queue</p>
            <p className="text-muted-foreground font-mono text-sm">
              Selecting a character highlights valid or current officer destinations.
            </p>
          </div>
          {characters.map((character) => (
            <div key={character.id} className="border-2 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-sans text-lg font-bold">{character.name}</p>
                  <p className="text-muted-foreground font-mono text-sm">
                    {character.kind} • lvl {character.level}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm">
                  Assign To...
                </Button>
              </div>
              <p className="text-muted-foreground mt-2 font-mono text-xs">
                Current: {character.role ?? 'No role'}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader className="border-b-2">
          <CardTitle className="font-sans text-xl">Officer Slots</CardTitle>
          <CardDescription className="font-mono">
            Always-visible destination slots. Fast for table-side reassignment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {roles.map((role) => (
            <div key={role.id} className="border-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-sans text-lg font-bold">{role.label}</p>
                  <p className="text-muted-foreground font-mono text-sm">
                    {role.assignedTo ?? 'Drop or assign a character'}
                  </p>
                </div>
                <Badge variant="outline" className="font-mono">
                  Slot
                </Badge>
              </div>
              <p className="text-muted-foreground mt-2 font-mono text-xs">
                {role.bonus}
              </p>
            </div>
          ))}
          <div className="border-2 p-3">
            <p className="font-mono text-sm">
              Archived characters would live in a collapsed strip below the left roster pane, not mixed into officer planning.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
