'use client';
// PROTOTYPE — Variant D: the week is home; records dock beside it.
// The current week never leaves the screen during play. A docked reference
// panel on the right (Militia · Officers · Finished weeks) answers "who is
// strategist?" or "what happened last week?" without navigating away. Deeper
// work (corrections, character editing, full history, setup) opens as its own
// page with "Back to week".

import { ArrowLeft, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useState } from 'react';
import { KeepIcon } from '~/components/keepIcon';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import {
  baseCoverage,
  campaignById,
  campaigns,
  characters,
  type Place,
} from './mock';
import {
  CampaignListBody,
  CorrectionBody,
  HistoryBody,
  PeopleBody,
  PhaseStepper,
  RecentWeeks,
  SetupBody,
  WeekBody,
} from './screens';
import type { VariantProps } from './types';

export const name = 'Week + reference panel';

export function address(place: Place) {
  const base = `/campaigns/${place.campaignId}`;
  switch (place.section) {
    case 'campaigns':
      return '/campaigns';
    case 'home':
    case 'week':
    case 'militia':
      return `${base}?phase=${place.phase}`;
    case 'history':
      return `${base}/history?week=${place.historyWeek}`;
    case 'correct':
      return `${base}/militia/correct`;
    case 'people':
      return `${base}/characters`;
    case 'setup':
      return `${base}/setup`;
  }
}

export function coverage(place: Place) {
  if (
    place.section === 'week' ||
    place.section === 'home' ||
    place.section === 'militia'
  )
    return [
      ...baseCoverage.week,
      'Panel: militia values & teams (read-only), LEDG-03 officers (read-only), HIST-01 recent weeks',
      'LEDG-01 → Correct button in panel',
    ];
  return ['Back to week', ...baseCoverage[place.section]];
}

export function VariantD({ place, go }: VariantProps) {
  const campaign = campaignById(place.campaignId);
  const militia = campaign.militia;
  const [panel, setPanel] = useState(true);
  const back = () => go({ section: 'week' });

  const topBar = (
    <header className="bg-sidebar flex items-center gap-3 border-b px-4 py-2">
      <KeepIcon />
      <Select
        value={place.campaignId}
        onValueChange={(v) =>
          v === '__all'
            ? go({ section: 'campaigns' })
            : go({ campaignId: v, section: 'week' })
        }
      >
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {campaigns.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value="__all">All campaigns…</SelectItem>
        </SelectContent>
      </Select>
      {militia && ['week', 'home', 'militia'].includes(place.section) && (
        <>
          <PhaseStepper
            militia={militia}
            phase={place.phase}
            onPhase={(p) => go({ phase: p })}
            className="mx-4 flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle reference panel"
            onClick={() => setPanel(!panel)}
          >
            {panel ? <PanelRightClose /> : <PanelRightOpen />}
          </Button>
        </>
      )}
    </header>
  );

  if (place.section === 'campaigns')
    return (
      <div>
        {topBar}
        <main className="mx-auto max-w-5xl p-8">
          <CampaignListBody
            onOpen={(id) => go({ campaignId: id, section: 'week' })}
          />
        </main>
      </div>
    );

  if (!militia && place.section !== 'people')
    return (
      <div>
        {topBar}
        <main className="mx-auto max-w-5xl p-6">
          <div className="mb-4 flex justify-end">
            <Button variant="outline" onClick={() => go({ section: 'people' })}>
              Characters
            </Button>
          </div>
          <SetupBody />
        </main>
      </div>
    );

  if (['correct', 'people', 'history', 'setup'].includes(place.section))
    return (
      <div>
        {topBar}
        <div className="border-b px-4 py-2">
          <Button
            variant="ghost"
            onClick={militia ? back : () => go({ section: 'setup' })}
          >
            <ArrowLeft /> {militia ? 'Back to week' : 'Back to setup'}
          </Button>
        </div>
        <main className="mx-auto max-w-6xl p-6">
          {place.section === 'history' && (
            <HistoryBody
              week={place.historyWeek}
              onWeek={(w) => go({ historyWeek: w })}
            />
          )}
          {place.section === 'correct' && <CorrectionBody onClose={back} />}
          {place.section === 'people' && (
            <PeopleBody
              militia={militia}
              onReassign={() => go({ section: 'correct' })}
            />
          )}
          {place.section === 'setup' && <SetupBody />}
        </main>
      </div>
    );

  return (
    <div className="flex h-full flex-col">
      {topBar}
      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-auto p-6">
          {militia && <WeekBody militia={militia} phase={place.phase} />}
        </main>
        {panel && militia && (
          <aside className="bg-sidebar w-80 shrink-0 overflow-auto border-l p-3">
            <Tabs defaultValue="militia">
              <TabsList className="w-full">
                <TabsTrigger value="militia">Militia</TabsTrigger>
                <TabsTrigger value="officers">Officers</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
              <TabsContent value="militia" className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['Rank', militia.rank],
                    ['Training', militia.training],
                    ['Treasury', militia.treasury],
                    ['Notoriety', militia.notoriety],
                  ].map(([k, v]) => (
                    <Card key={k} className="gap-0 p-2">
                      <p className="text-muted-foreground text-xs uppercase">
                        {k}
                      </p>
                      <p>{v}</p>
                    </Card>
                  ))}
                </div>
                {militia.teams.map((t) => (
                  <p key={t.name}>
                    {t.name} · {t.condition}
                  </p>
                ))}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => go({ section: 'correct' })}
                >
                  Correct militia
                </Button>
              </TabsContent>
              <TabsContent value="officers" className="space-y-1 text-sm">
                {militia.officers.map((o) => (
                  <p key={o.role}>
                    {o.role}: {o.holder ?? '—'}
                  </p>
                ))}
                <p className="text-muted-foreground pt-2">
                  {characters.length} characters
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => go({ section: 'people' })}
                >
                  Characters & officers
                </Button>
              </TabsContent>
              <TabsContent value="history">
                <RecentWeeks
                  onOpen={(w) => go({ section: 'history', historyWeek: w })}
                />
                <Button
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => go({ section: 'history' })}
                >
                  All finished weeks
                </Button>
              </TabsContent>
            </Tabs>
          </aside>
        )}
      </div>
    </div>
  );
}
