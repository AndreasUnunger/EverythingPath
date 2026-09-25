'use client';
// PROTOTYPE — Variant E: the chosen combination (B's top bar + D's panel).
// Top bar with campaign switcher and section tabs, phase stepper under it on
// the week, and a docked reference panel beside the week. Officers live with
// characters. Phase is a query parameter.

import { ChevronDown, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useState } from 'react';
import { KeepIcon } from '~/components/keepIcon';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
} from '~/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import {
  baseCoverage,
  campaignById,
  campaigns,
  type Place,
  type Section,
} from './mock';
import {
  CampaignListBody,
  CorrectionBody,
  HistoryBody,
  MilitiaBody,
  PeopleBody,
  PhaseStepper,
  RecentWeeks,
  SaveStatus,
  SetupBody,
  WeekBody,
} from './screens';
import type { VariantProps } from './types';

export const name = 'Chosen: top bar + reference panel';

export function address(place: Place) {
  const base = `/campaigns/${place.campaignId}`;
  switch (place.section) {
    case 'campaigns':
      return '/campaigns';
    case 'home':
    case 'week':
      return `${base}/week?phase=${place.phase}`;
    case 'history':
      return `${base}/history?week=${place.historyWeek}`;
    case 'militia':
      return `${base}/militia`;
    case 'correct':
      return `${base}/militia/correct`;
    case 'people':
      return `${base}/characters`;
    case 'setup':
      return `${base}/setup`;
  }
}

export function coverage(place: Place) {
  const nav = ['NAV-02, 04…08 (top bar)', 'CAMP-01…02 (switcher)'];
  if (place.section === 'week' || place.section === 'home')
    return [
      ...nav,
      ...baseCoverage.week,
      'Panel: militia & teams, officers, recent weeks (read-only)',
    ];
  if (place.section === 'people')
    return [...nav, ...baseCoverage.people, 'LEDG-03 (officer roles)'];
  return [...nav, ...baseCoverage[place.section]];
}

export function VariantE({ place, go }: VariantProps) {
  const campaign = campaignById(place.campaignId);
  const militia = campaign.militia;
  const [panel, setPanel] = useState(true);
  const section: Section =
    !militia &&
    ['week', 'history', 'militia', 'correct', 'home'].includes(place.section)
      ? 'setup'
      : place.section;
  const tab = section === 'correct' ? 'militia' : section;
  const tabs = militia
    ? [
        ['week', `Week ${militia.week}`],
        ['history', 'Finished weeks'],
        ['militia', 'Militia'],
        ['people', 'Characters & officers'],
      ]
    : [
        ['setup', 'Set up militia'],
        ['people', 'Characters'],
      ];
  const onWeek = section === 'week' && militia;

  return (
    <div className="flex h-full flex-col">
      <header className="bg-sidebar border-b">
        <div className="flex items-center gap-4 px-4 py-2">
          <button onClick={() => go({ section: 'campaigns' })}>
            <KeepIcon />
          </button>
          <span className="text-muted-foreground">/</span>
          <Select
            value={place.campaignId}
            onValueChange={(v) =>
              v === '__all'
                ? go({ section: 'campaigns' })
                : go({ campaignId: v, section: 'week' })
            }
          >
            <SelectTrigger className="border-0 bg-transparent px-1 text-base shadow-none dark:bg-transparent [&>svg]:hidden">
              {section === 'campaigns' ? 'All campaigns' : campaign.name}
              <ChevronDown className="size-4 opacity-60" />
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
          {section !== 'campaigns' && (
            <Tabs
              value={tab}
              onValueChange={(v) => go({ section: v as Section })}
            >
              <TabsList className="bg-transparent">
                {tabs.map(([k, label]) => (
                  <TabsTrigger key={k} value={k!} className="px-4">
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
          <div className="ml-auto flex items-center gap-3">
            {onWeek && (
              <>
                <SaveStatus />
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
            <Avatar className="size-7">
              <AvatarFallback>AU</AvatarFallback>
            </Avatar>
          </div>
        </div>
        {onWeek && (
          <PhaseStepper
            militia={militia}
            phase={place.phase}
            onPhase={(p) => go({ phase: p })}
            size="lg"
            className="px-4 pb-2"
          />
        )}
      </header>
      {onWeek ? (
        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-auto p-6">
            <WeekBody
              militia={militia}
              phase={place.phase}
              showHeading={false}
            />
          </main>
          {panel && (
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
                    onClick={() => go({ section: 'militia' })}
                  >
                    Open militia
                  </Button>
                </TabsContent>
                <TabsContent value="officers" className="space-y-1 text-sm">
                  {militia.officers.map((o) => (
                    <p key={o.role}>
                      {o.role}: {o.holder ?? '—'}
                    </p>
                  ))}
                  <Button
                    variant="outline"
                    className="mt-2 w-full"
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
      ) : (
        <main className="mx-auto w-full max-w-6xl p-6">
          {section === 'campaigns' && (
            <CampaignListBody
              onOpen={(id) => go({ campaignId: id, section: 'week' })}
            />
          )}
          {section === 'history' && (
            <HistoryBody
              week={place.historyWeek}
              onWeek={(w) => go({ historyWeek: w })}
            />
          )}
          {section === 'militia' && militia && (
            <MilitiaBody
              militia={militia}
              showOfficers={false}
              onCorrect={() => go({ section: 'correct' })}
            />
          )}
          {section === 'correct' && (
            <CorrectionBody onClose={() => go({ section: 'militia' })} />
          )}
          {section === 'people' && (
            <PeopleBody
              militia={militia}
              onReassign={() => go({ section: 'correct' })}
            />
          )}
          {section === 'setup' && <SetupBody />}
        </main>
      )}
    </div>
  );
}
