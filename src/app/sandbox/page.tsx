'use client';

import { CharacterOfficerPrototypes } from '~/components/character-officer-prototypes';
import { LedgerPagePrototypes } from '~/components/ledger-page-prototypes';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { WeekBoardPrototypes } from '~/components/week-board-prototypes';

export default function Sandbox() {
  return (
    <main className="mx-auto max-w-7xl p-4 md:p-6">
      <Tabs defaultValue="week-board" className="space-y-3">
        <TabsList className="h-auto w-full justify-start gap-1 p-1">
          <TabsTrigger value="week-board" className="font-mono">
            Week Board
          </TabsTrigger>
          <TabsTrigger value="ledger" className="font-mono">
            Ledger Page
          </TabsTrigger>
          <TabsTrigger value="characters" className="font-mono">
            Characters + Officers
          </TabsTrigger>
        </TabsList>
        <TabsContent value="week-board">
          <WeekBoardPrototypes />
        </TabsContent>
        <TabsContent value="ledger">
          <LedgerPagePrototypes />
        </TabsContent>
        <TabsContent value="characters">
          <CharacterOfficerPrototypes />
        </TabsContent>
      </Tabs>
    </main>
  );
}
