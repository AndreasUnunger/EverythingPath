'use client';
// PROTOTYPE — Variant A: campaign-scoped sidebar.
// The app sidebar becomes the campaign's table of contents: campaign switcher
// on top, the week with its phases nested under it, then finished weeks,
// militia and characters & officers. Content fills the rest.

import {
  BookOpen,
  CalendarDays,
  ChevronsUpDown,
  History,
  Shield,
  Swords,
  Users,
} from 'lucide-react';
import { KeepIcon } from '~/components/keepIcon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
} from '~/components/ui/select';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '~/components/ui/sidebar';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import {
  baseCoverage,
  campaignById,
  campaigns,
  phaseLabels,
  phases,
  type Place,
} from './mock';
import {
  CampaignListBody,
  CorrectionBody,
  HistoryBody,
  MilitiaBody,
  PeopleBody,
  SetupBody,
  WeekBody,
} from './screens';
import type { VariantProps } from './types';

export const name = 'Campaign sidebar';

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
  const nav = ['NAV-01…09 (sidebar)', 'CAMP-01…02 (sidebar switcher)'];
  if (place.section === 'people')
    return [
      ...nav,
      ...baseCoverage.people,
      'LEDG-03 (officers shown; Reassign → correction)',
    ];
  return [...nav, ...baseCoverage[place.section]];
}

export function VariantA({ place, go }: VariantProps) {
  const campaign = campaignById(place.campaignId);
  const militia = campaign.militia;
  const section =
    !militia &&
    ['week', 'history', 'militia', 'correct', 'home'].includes(place.section)
      ? 'setup'
      : place.section;

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-1 py-1 text-lg font-bold">
            <KeepIcon />
            <span className="group-data-[collapsible=icon]:hidden">
              KEEPNET
            </span>
          </div>
          <Select
            value={place.campaignId}
            onValueChange={(v) =>
              v === '__all'
                ? go({ section: 'campaigns' })
                : go({ campaignId: v, section: 'week' })
            }
          >
            <SelectTrigger className="w-full group-data-[collapsible=icon]:hidden">
              <span className="truncate">{campaign.name}</span>
              <ChevronsUpDown className="ml-auto size-4 opacity-50" />
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
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Play</SidebarGroupLabel>
            <SidebarMenu>
              {militia ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={section === 'week'}
                    onClick={() => go({ section: 'week' })}
                  >
                    <Swords />
                    <span>Week {militia.week}</span>
                  </SidebarMenuButton>
                  <SidebarMenuSub>
                    {phases.map((p) => (
                      <SidebarMenuSubItem key={p}>
                        <SidebarMenuSubButton
                          isActive={section === 'week' && place.phase === p}
                          aria-disabled={
                            p === 'persistent' && !militia.persistentAvailable
                          }
                          onClick={() => go({ section: 'week', phase: p })}
                        >
                          <span>
                            {phaseLabels[p]}
                            {militia.ready.includes(p) && ' ✓'}
                          </span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </SidebarMenuItem>
              ) : (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={section === 'setup'}
                    onClick={() => go({ section: 'setup' })}
                  >
                    <Shield />
                    <span>Set up militia</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {militia && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={section === 'history'}
                    onClick={() => go({ section: 'history' })}
                  >
                    <History />
                    <span>Finished weeks</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Records</SidebarGroupLabel>
            <SidebarMenu>
              {militia && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={section === 'militia' || section === 'correct'}
                    onClick={() => go({ section: 'militia' })}
                  >
                    <BookOpen />
                    <span>Militia</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={section === 'people'}
                  onClick={() => go({ section: 'people' })}
                >
                  <Users />
                  <span>Characters{militia && ' & officers'}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup className="mt-auto">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={section === 'campaigns'}
                  onClick={() => go({ section: 'campaigns' })}
                >
                  <CalendarDays />
                  <span>All campaigns</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center gap-2 p-1 text-sm">
            <Avatar className="size-7">
              <AvatarFallback>AU</AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground truncate group-data-[collapsible=icon]:hidden">
              Thursday Group ▾
            </span>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-w-0">
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <SidebarTrigger />
          <span className="text-muted-foreground text-sm">{campaign.name}</span>
        </div>
        <div className="p-6">
          {section === 'campaigns' && (
            <CampaignListBody
              onOpen={(id) => go({ campaignId: id, section: 'week' })}
            />
          )}
          {section === 'week' && militia && (
            <WeekBody militia={militia} phase={place.phase} />
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
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
