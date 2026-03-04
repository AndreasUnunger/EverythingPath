'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import {
  CardBoardVariantA,
  CardBoardVariantB,
  CardBoardVariantC,
  CardBoardVariantD,
  CardBoardVariantE,
  CardBoardVariantF,
} from './card-board-variants';

export function WeekBoardPrototypes() {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-primary font-sans text-2xl font-bold">Week Board Prototypes</h2>
        <p className="text-muted-foreground font-mono text-sm">
          Six card-based mock-data directions for the weekly militia flow.
        </p>
      </div>

      <Tabs defaultValue="card-a" className="w-full">
        <TabsList className="h-auto w-full justify-start gap-1 p-1">
          <TabsTrigger value="card-a" className="font-mono">Card A</TabsTrigger>
          <TabsTrigger value="card-b" className="font-mono">Card B</TabsTrigger>
          <TabsTrigger value="card-c" className="font-mono">Card C</TabsTrigger>
          <TabsTrigger value="card-d" className="font-mono">Card D</TabsTrigger>
          <TabsTrigger value="card-e" className="font-mono">Card E</TabsTrigger>
          <TabsTrigger value="card-f" className="font-mono">Card F</TabsTrigger>
        </TabsList>
        <TabsContent value="card-a">
          <CardBoardVariantA />
        </TabsContent>
        <TabsContent value="card-b">
          <CardBoardVariantB />
        </TabsContent>
        <TabsContent value="card-c">
          <CardBoardVariantC />
        </TabsContent>
        <TabsContent value="card-d">
          <CardBoardVariantD />
        </TabsContent>
        <TabsContent value="card-e">
          <CardBoardVariantE />
        </TabsContent>
        <TabsContent value="card-f">
          <CardBoardVariantF />
        </TabsContent>
      </Tabs>
    </div>
  );
}
