'use client';
// PROTOTYPE — Variant B: top bar with section tabs, no sidebar.
// All width goes to content. One slim bar holds the campaign switcher (as a
// breadcrumb), the campaign's sections as tabs, and the save status. On the
// week tab a full-width phase stepper sits directly under it.

import { ChevronDown } from 'lucide-react';
import { KeepIcon } from '~/components/keepIcon';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
} from '~/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs';
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
  SaveStatus,
  SetupBody,
  WeekBody,
} from './screens';
import type { VariantProps } from './types';

export const name = 'Top bar tabs';

export function address(place: Place) {
  const base = `/campaigns/${place.campaignId}`;
  switch (place.section) {
    case 'campaigns':
      return '/campaigns';
    case 'home':
    case 'week':
      return `${base}/week/${place.phase}`;
    case 'history':
      return `${base}/weeks/${place.historyWeek}`;
    case 'militia':
      return `${base}/militia`;
    case 'correct':
      return `${base}/militia?correct=1`;
    case 'people':
      return `${base}/characters`;
    case 'setup':
      return `${base}/setup`;
  }
}

export function coverage(place: Place) {
  const nav = ['NAV-02, 05…09 (top bar)', 'CAMP-01…02 (breadcrumb switcher)'];
  if (place.section === 'militia')
    return [
      ...nav,
      ...baseCoverage.militia,
      'LEDG-03 (officers roster shown here)',
    ];
  return [...nav, ...baseCoverage[place.section]];
}

export function VariantB({ place, go }: VariantProps) {
  const campaign = campaignById(place.campaignId);
  const militia = campaign.militia;
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
        ['militia', 'Militia & officers'],
        ['people', 'Characters'],
      ]
    : [
        ['setup', 'Set up militia'],
        ['people', 'Characters'],
      ];

  return (
    <div className="flex min-h-full flex-col">
      <header className="bg-sidebar sticky top-0 z-10 border-b">
        <div className="flex items-center gap-4 px-4 py-2">
          <button
            className="flex items-center gap-2 font-bold"
            onClick={() => go({ section: 'campaigns' })}
          >
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
            {section === 'week' && <SaveStatus />}
            <Avatar className="size-7">
              <AvatarFallback>AU</AvatarFallback>
            </Avatar>
          </div>
        </div>
        {section === 'week' && militia && (
          <PhaseStepper
            militia={militia}
            phase={place.phase}
            onPhase={(p) => go({ phase: p })}
            size="lg"
            className="px-4 pb-2"
          />
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl p-6">
        {section === 'campaigns' && (
          <CampaignListBody
            onOpen={(id) => go({ campaignId: id, section: 'week' })}
          />
        )}
        {section === 'week' && militia && (
          <WeekBody militia={militia} phase={place.phase} showHeading={false} />
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
            onCorrect={() => go({ section: 'correct' })}
          />
        )}
        {section === 'correct' && (
          <CorrectionBody onClose={() => go({ section: 'militia' })} />
        )}
        {section === 'people' && <PeopleBody militia={null} />}
        {section === 'setup' && <SetupBody />}
      </main>
    </div>
  );
}
