'use client';
// PROTOTYPE (throwaway, #208) — page bodies outside the character builder,
// copied from the approved app shell's `pages.tsx` (Campaigns, Campaign
// home, Week, Finished weeks, Militia, Setup). Cheap stand-ins, dense enough
// to judge the builder's pages around them.
import { ArrowRight, ChevronRight, Plus, Shield } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { cn } from '~/lib/utils';
import { ORGS } from '../mock-characters';
import { useProtoNav } from '../nav';
import {
  characterLevel,
  useCampaignCharacters,
  useCampaigns,
  userName,
} from '../store';

const main = 'mx-auto w-full max-w-6xl p-4 md:p-6';
const narrow = 'mx-auto w-full max-w-3xl p-4 md:p-6';
const action = 'min-h-11 md:min-h-9';
const rowButton =
  'hover:bg-foreground/5 focus-visible:ring-ring/50 flex min-h-11 w-full items-center gap-3 border-b border-foreground/15 px-1 py-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-inset last:border-b-0';

function Title({
  children,
  actions,
  eyebrow,
}: {
  children: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-muted-foreground text-xs tracking-widest uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl md:text-xl">{children}</h1>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Missing({ noun }: { noun: string }) {
  return (
    <main className={narrow}>
      <Card className="p-6">
        <p>This {noun} isn’t available here.</p>
      </Card>
    </main>
  );
}

// Campaigns (top-level area, the homepage)

function CampaignRow({ id }: { id: string }) {
  const nav = useProtoNav();
  const campaigns = useCampaigns();
  const rows = useCampaignCharacters(id);
  const campaign = campaigns.find((c) => c.id === id)!;
  return (
    <button
      type="button"
      className={cn(rowButton, 'border-b-0 py-3')}
      onClick={() => nav.go('campaign-home', { campaign: campaign.id })}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-lg">{campaign.name}</span>
        <span className="text-muted-foreground block text-sm">
          {campaign.militia ? `Week ${campaign.militia.week}` : 'No militia'}
          {' · '}
          {rows.length} characters
        </span>
        <span className="text-muted-foreground hidden truncate pt-0.5 text-xs xl:block">
          {campaign.description}
        </span>
      </span>
      <ChevronRight
        aria-hidden
        className="text-muted-foreground size-4 shrink-0"
      />
    </button>
  );
}

export function CampaignsPage() {
  const campaigns = useCampaigns();
  return (
    <main className={main}>
      <Title
        actions={
          <Button type="button" className={action}>
            <Plus /> New campaign
          </Button>
        }
      >
        Campaigns
      </Title>
      <ul role="list" className="divide-foreground/15 divide-y">
        {campaigns.map((campaign) => (
          <li key={campaign.id}>
            <CampaignRow id={campaign.id} />
          </li>
        ))}
      </ul>
    </main>
  );
}

// Campaign home

export function CampaignHomePage() {
  const nav = useProtoNav();
  const campaign = nav.campaign;
  const rows = useCampaignCharacters(campaign?.id);
  if (!campaign) return <Missing noun="campaign" />;
  const party = rows
    .map((r) => r.character)
    .filter((c) => c.sheetMode === 'full');
  const onRoster = rows.filter((r) => r.roster).length;
  return (
    <main className={main}>
      <Title eyebrow={ORGS[0]!.name}>{campaign.name}</Title>
      <p className="text-muted-foreground mb-6 max-w-prose">
        {campaign.description}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {campaign.militia ? (
          <Card className="gap-3 p-4">
            <div className="flex items-center gap-2">
              <Shield aria-hidden className="size-4" />
              <h2 className="text-lg">Militia</h2>
            </div>
            <p className="text-muted-foreground text-sm">
              Week {campaign.militia.week} in progress ·{' '}
              {campaign.militia.finishedWeeks} finished weeks · {onRoster} on
              roster
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className={action}
                onClick={() => nav.go('week', { campaign: campaign.id })}
              >
                Continue Week {campaign.militia.week} <ArrowRight />
              </Button>
              <Button
                type="button"
                variant="outline"
                className={action}
                onClick={() => nav.go('history', { campaign: campaign.id })}
              >
                Finished weeks
              </Button>
            </div>
            <ul className="text-muted-foreground mt-1 text-sm">
              {[0, 1, 2].map((i) => (
                <li
                  key={i}
                  className="border-foreground/15 flex justify-between border-t py-1.5"
                >
                  <span>Week {campaign.militia!.week - 1 - i}</span>
                  <span>Finished · morale +1</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card className="gap-2 p-4">
            <h2 className="text-lg">No militia</h2>
            <p className="text-muted-foreground text-sm">
              This campaign tracks characters only.
            </p>
          </Card>
        )}
        <Card className="gap-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg">Party</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                nav.go('campaign-characters', { campaign: campaign.id })
              }
            >
              All characters <ArrowRight />
            </Button>
          </div>
          <ul>
            {party.map((character) => (
              <li key={character.id}>
                <button
                  type="button"
                  className={rowButton}
                  onClick={() =>
                    nav.go('sheet', {
                      character: character.id,
                      from: 'campaign-home',
                    })
                  }
                >
                  <span className="min-w-0 flex-1">
                    <span className="block">{character.name}</span>
                    <span className="text-muted-foreground block text-sm">
                      Level {characterLevel(character)} ·{' '}
                      {userName(character.ownerId)}
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden
                    className="text-muted-foreground size-4"
                  />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </main>
  );
}

// Militia: Week

const phases = ['Upkeep', 'Activity', 'Events', 'Summary'];

export function WeekPage() {
  const { campaign } = useProtoNav();
  if (!campaign?.militia) return <Missing noun="militia" />;
  return (
    <main className={cn(main, 'flex flex-col gap-4')}>
      <Title eyebrow={campaign.name}>Week {campaign.militia.week}</Title>
      <ol className="flex flex-wrap gap-1 text-sm">
        {phases.map((phase, i) => (
          <li
            key={phase}
            className={cn(
              'rounded-md px-3 py-1.5',
              i === 1 ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
            )}
          >
            {i + 1}. {phase}
          </li>
        ))}
      </ol>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[
          'Patrol the north road',
          'Drill the recruits',
          'Repair the palisade',
          'Scout the Fangwood',
          'Rest',
        ].map((slot, i) => (
          <Card key={slot} className="gap-2 p-4">
            <p className="text-muted-foreground text-xs tracking-widest uppercase">
              Slot {i + 1}
            </p>
            <p>{slot}</p>
            <p className="text-muted-foreground text-sm">
              {i < 3 ? 'Team Alpha · 6 soldiers' : 'Unassigned'}
            </p>
          </Card>
        ))}
      </div>
    </main>
  );
}

// Militia: Finished weeks

export function HistoryPage() {
  const { campaign } = useProtoNav();
  if (!campaign?.militia) return <Missing noun="militia" />;
  const weeks = Array.from(
    { length: campaign.militia.finishedWeeks },
    (_, i) => campaign.militia!.finishedWeeks - i,
  );
  return (
    <main className={narrow}>
      <Title eyebrow={campaign.name}>Finished weeks</Title>
      <ul className="divide-foreground/15 divide-y">
        {weeks.map((week) => (
          <li key={week}>
            <button type="button" className={cn(rowButton, 'border-b-0')}>
              <span className="min-w-0 flex-1">
                <span className="block">Week {week}</span>
                <span className="text-muted-foreground block text-sm">
                  {week % 3 === 0 ? 'Skirmish won' : 'Quiet week'} · morale{' '}
                  {week % 2 === 0 ? '+1' : '0'} · {12 + week} soldiers
                </span>
              </span>
              <ChevronRight
                aria-hidden
                className="text-muted-foreground size-4"
              />
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

// Militia: summary

export function MilitiaPage() {
  const { campaign } = useProtoNav();
  const rows = useCampaignCharacters(campaign?.id);
  if (!campaign?.militia) return <Missing noun="militia" />;
  const roster = rows.filter((r) => r.roster);
  const stats = [
    ['Soldiers', '24'],
    ['Morale', '+2'],
    ['Supplies', '11 weeks'],
    ['Roster', String(roster.length)],
    ['Officers', String(roster.filter((r) => r.roster!.roles.length).length)],
    ['Teams', '3'],
  ];
  return (
    <main className={main}>
      <Title eyebrow={campaign.name}>Militia</Title>
      <dl className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map(([label, value]) => (
          <Card key={label} className="gap-0 p-3">
            <dt className="text-muted-foreground text-xs tracking-widest uppercase">
              {label}
            </dt>
            <dd className="text-2xl">{value}</dd>
          </Card>
        ))}
      </dl>
      <h2 className="mb-2 text-lg">Teams</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {['Alpha', 'Bravo', 'Reserve'].map((team, i) => (
          <Card key={team} className="gap-1 p-4">
            <p>Team {team}</p>
            <p className="text-muted-foreground text-sm">
              {8 - i} soldiers · led by {roster[i]?.character.name ?? 'nobody'}
            </p>
          </Card>
        ))}
      </div>
    </main>
  );
}

// Militia: Setup

export function SetupPage() {
  const { campaign } = useProtoNav();
  if (!campaign?.militia) return <Missing noun="militia" />;
  return (
    <main className={narrow}>
      <Title eyebrow={campaign.name}>Militia setup</Title>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="setup-name">Militia name</Label>
          <Input id="setup-name" defaultValue={`${campaign.name} militia`} />
        </div>
        <div className="grid gap-1.5 md:grid-cols-2 md:gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="setup-start">Campaign start</Label>
            <Input id="setup-start" defaultValue="4714 AR, Pharast 1" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="setup-week">Current week</Label>
            <Input
              id="setup-week"
              defaultValue={String(campaign.militia.week)}
              readOnly
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className={action}>
            Discard
          </Button>
          <Button type="submit" className={action}>
            Save
          </Button>
        </div>
      </form>
    </main>
  );
}
