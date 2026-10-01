'use client';
// PROTOTYPE — page bodies (no shell chrome) for every Page of the app-shell
// prototype. Dense enough to judge the shell around them, cheap otherwise.
import {
  ArrowRight,
  Check,
  ChevronRight,
  Hammer,
  LogOut,
  Minus,
  Plus,
  Shield,
  UserPlus,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { cn } from '~/lib/utils';
import {
  addToCampaign,
  buildOut,
  campaigns,
  campaignsInOrg,
  charactersInCampaign,
  createCharacter,
  getCampaign,
  getCharacter,
  getOrg,
  leaveCampaign,
  levelLine,
  ME,
  myCharacters,
  orgs,
  useMockStore,
  userName,
  type Character,
} from './mock';
import { StatusBadge } from './parts';
import type { Location, Page } from './types';

type PageProps = {
  location: Location;
  go: (to: Location) => void;
  /** The active organization (the harness's `?org=`). */
  orgId: string;
};

const main = 'mx-auto w-full max-w-6xl p-4 md:p-6';
const narrow = 'mx-auto w-full max-w-3xl p-4 md:p-6';
const action = 'min-h-11 md:min-h-9';
const chip =
  'border-foreground/40 inline-flex items-center border px-1.5 py-0.5 font-mono text-xs leading-tight';
const th =
  'text-muted-foreground px-2 py-2 text-left text-xs font-normal tracking-wide uppercase first:pl-0 last:pr-0';
const td = 'px-2 py-2.5 align-middle first:pl-0 last:pr-0';
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

function OnRoster({ character }: { character: Character }) {
  if (character.officer)
    return (
      <span className={cn(chip, 'border-primary text-primary')}>
        {character.officer}
      </span>
    );
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
      {character.onRoster ? (
        <Check aria-hidden className="text-foreground size-4" />
      ) : (
        <Minus aria-hidden className="size-4" />
      )}
      {character.onRoster ? 'On roster' : 'Not on roster'}
    </span>
  );
}

// Campaigns (top-level area)

export function CampaignsPage({ orgId, go }: PageProps) {
  useMockStore();
  const list = campaignsInOrg(orgId);
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
        {list.map((campaign) => (
          <li key={campaign.id}>
            <button
              type="button"
              className={cn(rowButton, 'border-b-0 py-3')}
              onClick={() =>
                go({ page: 'campaign-home', campaignId: campaign.id })
              }
            >
              <span className="min-w-0 flex-1">
                <span className="block text-lg">{campaign.name}</span>
                <span className="text-muted-foreground block text-sm">
                  {campaign.militia
                    ? `Week ${campaign.militia.week}`
                    : 'No militia'}
                  {' · '}
                  {charactersInCampaign(campaign.id).length} characters
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
          </li>
        ))}
        {list.length === 0 && (
          <li className="text-muted-foreground py-6 text-sm">
            No campaigns in this organization yet.
          </li>
        )}
      </ul>
    </main>
  );
}

// Characters (top-level area, across organizations)

function CharacterRow({
  character,
  onOpen,
  showOwner = false,
}: {
  character: Character;
  onOpen: () => void;
  showOwner?: boolean;
}) {
  const inMilitia = getCampaign(character.campaignId)?.militia;
  return (
    <button type="button" className={rowButton} onClick={onOpen}>
      <span className="min-w-0 flex-1">
        <span className="block">{character.name}</span>
        <span className="text-muted-foreground block text-sm">
          {levelLine(character)}
          {showOwner && ` · ${userName(character.ownerId)}`}
          {character.minimal && ' · sheet barely started'}
        </span>
      </span>
      {inMilitia && <OnRoster character={character} />}
      <StatusBadge status={character.status} />
      <ChevronRight
        aria-hidden
        className="text-muted-foreground size-4 shrink-0"
      />
    </button>
  );
}

export function CharactersPage({ go }: PageProps) {
  useMockStore();
  const mine = myCharacters();
  const groups: {
    key: string;
    title: string;
    org?: string;
    rows: Character[];
  }[] = [
    {
      key: 'none',
      title: 'No campaign',
      rows: mine.filter((c) => !c.campaignId),
    },
    ...campaigns.map((campaign) => ({
      key: campaign.id,
      title: campaign.name,
      org: getOrg(campaign.orgId)?.name,
      rows: mine.filter((c) => c.campaignId === campaign.id),
    })),
  ];
  return (
    <main className={main}>
      <Title
        actions={
          <Button
            type="button"
            className={action}
            onClick={() =>
              go({
                page: 'sheet',
                characterId: createCharacter({}),
                from: 'characters',
              })
            }
          >
            <Plus /> New character
          </Button>
        }
      >
        Characters
      </Title>
      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`group-${group.key}`}>
            <h2
              id={`group-${group.key}`}
              className="text-muted-foreground mb-1 flex items-baseline gap-2 text-xs tracking-widest uppercase"
            >
              {group.title}
              {group.org && (
                <span className="font-mono tracking-normal normal-case">
                  · {group.org}
                </span>
              )}
            </h2>
            {group.rows.length === 0 ? (
              <p className="text-muted-foreground py-2 text-sm">None.</p>
            ) : (
              group.rows.map((character) => (
                <CharacterRow
                  key={character.id}
                  character={character}
                  onOpen={() =>
                    go({
                      page: 'sheet',
                      characterId: character.id,
                      from: 'characters',
                    })
                  }
                />
              ))
            )}
          </section>
        ))}
      </div>
    </main>
  );
}

// Campaign home

export function CampaignHomePage({ location, go }: PageProps) {
  useMockStore();
  const campaign = getCampaign(location.campaignId);
  if (!campaign) return <Missing noun="campaign" />;
  const party = charactersInCampaign(campaign.id).filter(
    (c) => c.status === 'full',
  );
  return (
    <main className={main}>
      <Title eyebrow={getOrg(campaign.orgId)?.name}>{campaign.name}</Title>
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
              {campaign.militia.finishedWeeks} finished weeks ·{' '}
              {
                charactersInCampaign(campaign.id).filter((c) => c.onRoster)
                  .length
              }{' '}
              on roster
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className={action}
                onClick={() => go({ page: 'week', campaignId: campaign.id })}
              >
                Continue Week {campaign.militia.week} <ArrowRight />
              </Button>
              <Button
                type="button"
                variant="outline"
                className={action}
                onClick={() => go({ page: 'history', campaignId: campaign.id })}
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
                go({ page: 'campaign-characters', campaignId: campaign.id })
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
                    go({
                      page: 'sheet',
                      characterId: character.id,
                      from: 'campaign-home',
                    })
                  }
                >
                  <span className="min-w-0 flex-1">
                    <span className="block">{character.name}</span>
                    <span className="text-muted-foreground block text-sm">
                      {levelLine(character)} · {userName(character.ownerId)}
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

// Campaign characters (everyone's, with Add from my characters)

function AddFromMineDialog({
  campaignId,
  open,
  onOpenChange,
}: {
  campaignId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const candidates = myCharacters().filter((c) => c.campaignId !== campaignId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add from my characters</DialogTitle>
          <DialogDescription>
            A Character is in one campaign at a time; adding one that is
            elsewhere moves it here.
          </DialogDescription>
        </DialogHeader>
        <ul className="-mx-1">
          {candidates.map((character) => {
            const from = getCampaign(character.campaignId);
            return (
              <li key={character.id}>
                <button
                  type="button"
                  className={rowButton}
                  onClick={() => {
                    addToCampaign(character.id, campaignId);
                    onOpenChange(false);
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block">{character.name}</span>
                    <span className="text-muted-foreground block text-sm">
                      {levelLine(character)}
                      {from ? ` · Moves from ${from.name}` : ' · No campaign'}
                    </span>
                  </span>
                  <UserPlus aria-hidden className="size-4" />
                </button>
              </li>
            );
          })}
          {candidates.length === 0 && (
            <li className="text-muted-foreground py-4 text-sm">
              All your characters are already here.
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export function CampaignCharactersPage({ location, go }: PageProps) {
  useMockStore();
  const [adding, setAdding] = useState(false);
  const campaign = getCampaign(location.campaignId);
  if (!campaign) return <Missing noun="campaign" />;
  const rows = charactersInCampaign(campaign.id);
  return (
    <main className={main}>
      <Title
        eyebrow={campaign.name}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className={action}
              onClick={() => setAdding(true)}
            >
              <UserPlus /> Add from my characters
            </Button>
            <Button
              type="button"
              className={action}
              onClick={() =>
                go({
                  page: 'sheet',
                  characterId: createCharacter({ campaignId: campaign.id }),
                  from: 'campaign-characters',
                })
              }
            >
              <Plus /> New character
            </Button>
          </>
        }
      >
        Characters
      </Title>
      <p className="text-muted-foreground mb-3 text-sm">
        Everyone in {campaign.name} can edit these.
      </p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-foreground/20 border-b">
            <th scope="col" className={cn(th, 'w-full')}>
              Name
            </th>
            <th scope="col" className={cn(th, 'hidden md:table-cell')}>
              Owner
            </th>
            <th scope="col" className={th}>
              Level
            </th>
            <th scope="col" className={cn(th, 'hidden md:table-cell')}>
              Status
            </th>
            {campaign.militia && (
              <th scope="col" className={cn(th, 'whitespace-nowrap')}>
                Militia
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((character) => (
            <tr key={character.id} className="border-foreground/15 border-b">
              <td className={td}>
                <button
                  type="button"
                  className="hover:text-primary min-h-11 text-left underline-offset-4 hover:underline md:min-h-0"
                  onClick={() =>
                    go({
                      page: 'sheet',
                      characterId: character.id,
                      from: 'campaign-characters',
                    })
                  }
                >
                  {character.name}
                </button>
                <span className="text-muted-foreground block text-xs md:hidden">
                  {userName(character.ownerId)} ·{' '}
                  {character.status === 'militia-only'
                    ? 'Militia-only'
                    : 'Full'}
                </span>
              </td>
              <td className={cn(td, 'hidden md:table-cell')}>
                {userName(character.ownerId)}
                {character.ownerId === ME && (
                  <span className="text-muted-foreground"> (me)</span>
                )}
              </td>
              <td className={cn(td, 'whitespace-nowrap')}>
                {levelLine(character)}
              </td>
              <td className={cn(td, 'hidden md:table-cell')}>
                <StatusBadge status={character.status} />
              </td>
              {campaign.militia && (
                <td className={cn(td, 'whitespace-nowrap')}>
                  <OnRoster character={character} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <AddFromMineDialog
        campaignId={campaign.id}
        open={adding}
        onOpenChange={setAdding}
      />
    </main>
  );
}

// Militia: Week

const phases = ['Upkeep', 'Activity', 'Events', 'Summary'];

export function WeekPage({ location }: PageProps) {
  const campaign = getCampaign(location.campaignId);
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
          'Scout the Narlmarches',
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
            <div className="mt-1 grid grid-cols-3 gap-2">
              <Input defaultValue={i < 3 ? '2' : ''} placeholder="d6" />
              <Input defaultValue={i < 3 ? '5' : ''} placeholder="d6" />
              <Input defaultValue={i < 3 ? '3' : ''} placeholder="d6" />
            </div>
          </Card>
        ))}
      </div>
      <div className="border-foreground/15 mt-2 flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" className={action}>
          Save draft
        </Button>
        <Button type="button" className={action}>
          Finish week
        </Button>
      </div>
    </main>
  );
}

// Militia: Finished weeks

export function HistoryPage({ location }: PageProps) {
  const campaign = getCampaign(location.campaignId);
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

export function MilitiaPage({ location }: PageProps) {
  useMockStore();
  const campaign = getCampaign(location.campaignId);
  if (!campaign?.militia) return <Missing noun="militia" />;
  const roster = charactersInCampaign(campaign.id).filter((c) => c.onRoster);
  const stats = [
    ['Soldiers', '24'],
    ['Morale', '+2'],
    ['Supplies', '11 weeks'],
    ['Roster', String(roster.length)],
    ['Officers', String(roster.filter((c) => c.officer).length)],
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
              {8 - i} soldiers · led by {roster[i]?.name ?? 'nobody'}
            </p>
          </Card>
        ))}
      </div>
    </main>
  );
}

// Militia: Characters & officers

export function OfficersPage({ location, go }: PageProps) {
  useMockStore();
  const campaign = getCampaign(location.campaignId);
  if (!campaign?.militia) return <Missing noun="militia" />;
  const rows = charactersInCampaign(campaign.id);
  return (
    <main className={main}>
      <Title
        eyebrow={campaign.name}
        actions={
          <Button
            type="button"
            className={action}
            onClick={() =>
              go({
                page: 'sheet',
                characterId: createCharacter({
                  campaignId: campaign.id,
                  status: 'militia-only',
                }),
                from: 'officers',
              })
            }
          >
            <Plus /> New militia-only character
          </Button>
        }
      >
        Characters & officers
      </Title>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-foreground/20 border-b">
            <th scope="col" className={cn(th, 'w-full')}>
              Name
            </th>
            <th scope="col" className={th}>
              Level
            </th>
            <th scope="col" className={cn(th, 'hidden md:table-cell')}>
              Owner
            </th>
            <th scope="col" className={cn(th, 'whitespace-nowrap')}>
              Roster
            </th>
            <th scope="col" className={th}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((character) => (
            <tr key={character.id} className="border-foreground/15 border-b">
              <td className={td}>
                <button
                  type="button"
                  className="hover:text-primary min-h-11 text-left underline-offset-4 hover:underline md:min-h-0"
                  onClick={() =>
                    go({
                      page: 'sheet',
                      characterId: character.id,
                      from: 'officers',
                    })
                  }
                >
                  {character.name}
                </button>{' '}
                <StatusBadge status={character.status} className="ml-1" />
              </td>
              <td className={cn(td, 'whitespace-nowrap')}>{character.level}</td>
              <td className={cn(td, 'hidden md:table-cell')}>
                {userName(character.ownerId)}
              </td>
              <td className={cn(td, 'whitespace-nowrap')}>
                <OnRoster character={character} />
              </td>
              <td className={cn(td, 'text-right whitespace-nowrap')}>
                {character.status === 'militia-only' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={action}
                    onClick={() => buildOut(character.id)}
                  >
                    <Hammer /> Build out
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

// Militia: Setup

export function SetupPage({ location }: PageProps) {
  const campaign = getCampaign(location.campaignId);
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
            <Input id="setup-start" defaultValue="4710 AR, Pharast 1" />
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
        <div className="grid gap-1.5">
          <Label htmlFor="setup-teams">Teams</Label>
          <Input id="setup-teams" defaultValue="Alpha, Bravo, Reserve" />
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

// Character sheet

function AddToCampaignDialog({
  characterId,
  open,
  onOpenChange,
}: {
  characterId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to campaign</DialogTitle>
          <DialogDescription>
            Everyone in that campaign will be able to edit this Character.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-1 flex flex-col gap-3">
          {orgs.map((org) => (
            <div key={org.id}>
              <p className="text-muted-foreground px-1 text-xs tracking-widest uppercase">
                {org.name}
              </p>
              {campaignsInOrg(org.id).map((campaign) => (
                <button
                  key={campaign.id}
                  type="button"
                  className={rowButton}
                  onClick={() => {
                    addToCampaign(characterId, campaign.id);
                    onOpenChange(false);
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block">{campaign.name}</span>
                    <span className="text-muted-foreground block text-sm">
                      {campaign.militia
                        ? `Militia · Week ${campaign.militia.week}`
                        : 'No militia'}
                    </span>
                  </span>
                  <ArrowRight aria-hidden className="size-4" />
                </button>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const abilities: [string, number][] = [
  ['STR', 16],
  ['DEX', 13],
  ['CON', 14],
  ['INT', 10],
  ['WIS', 12],
  ['CHA', 8],
];
const skills: [string, number, number][] = [
  ['Acrobatics', 1, 4],
  ['Climb', 3, 8],
  ['Intimidate', -1, 5],
  ['Perception', 1, 6],
  ['Ride', 1, 5],
  ['Survival', 1, 5],
  ['Swim', 3, 6],
];

export function SheetPage({ location }: PageProps) {
  useMockStore();
  const [adding, setAdding] = useState(false);
  const character = getCharacter(location.characterId);
  if (!character) return <Missing noun="character" />;
  const campaign = getCampaign(character.campaignId);
  const militiaOnly = character.status === 'militia-only';
  return (
    <main className={main}>
      <p className="text-muted-foreground mb-2 font-mono text-xs">
        /characters/{character.id}
      </p>
      <Title
        eyebrow={
          <>
            {levelLine(character)} · {userName(character.ownerId)}
            {character.ownerId === ME && ' (me)'}
          </>
        }
        actions={
          militiaOnly && (
            <Button
              type="button"
              className={action}
              onClick={() => buildOut(character.id)}
            >
              <Hammer /> Build out
            </Button>
          )
        }
      >
        <span className="flex flex-wrap items-center gap-2">
          {character.name}
          <StatusBadge status={character.status} />
        </span>
      </Title>

      <div className="bg-sidebar/60 border-foreground/15 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
        {campaign ? (
          <>
            <span>
              In <strong>{campaign.name}</strong>
              <span className="text-muted-foreground">
                {' '}
                · {getOrg(campaign.orgId)?.name}
                {campaign.militia &&
                  (character.onRoster
                    ? ` · on the militia roster${character.officer ? ` as ${character.officer}` : ''}`
                    : ' · not on the militia roster')}
              </span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={action}
              onClick={() => leaveCampaign(character.id)}
            >
              <LogOut /> Leave campaign
            </Button>
          </>
        ) : (
          <>
            <span>
              <strong>No campaign</strong>
              <span className="text-muted-foreground">
                {' '}
                · only you can see this Character
              </span>
            </span>
            <Button
              type="button"
              size="sm"
              className={action}
              onClick={() => setAdding(true)}
            >
              <UserPlus /> Add to campaign
            </Button>
          </>
        )}
      </div>

      {militiaOnly ? (
        <Card className="gap-3 p-4">
          <p className="text-muted-foreground text-sm">
            Militia-only: name, level and ability scores, edited in place. Build
            out to open the whole sheet.
          </p>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
            {abilities.map(([name, score]) => (
              <div key={name} className="grid gap-1">
                <Label htmlFor={`ab-${name}`} className="font-mono text-xs">
                  {name}
                </Label>
                <Input id={`ab-${name}`} defaultValue={String(score)} />
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="flex flex-col gap-4">
            <Card className="gap-3 p-4">
              <h2 className="text-lg">Ability scores</h2>
              <div className="grid grid-cols-3 gap-2">
                {abilities.map(([name, score]) => (
                  <div
                    key={name}
                    className="border-foreground/15 rounded-md border p-2 text-center"
                  >
                    <p className="text-muted-foreground font-mono text-xs">
                      {name}
                    </p>
                    <p className="text-2xl">{score}</p>
                    <p className="text-muted-foreground text-xs">
                      {score >= 10 ? '+' : ''}
                      {Math.floor((score - 10) / 2)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="gap-3 p-4">
              <h2 className="text-lg">Class levels</h2>
              <ol className="text-sm">
                {Array.from({ length: character.level }, (_, i) => (
                  <li
                    key={i}
                    className="border-foreground/15 flex justify-between border-t py-1.5 first:border-t-0"
                  >
                    <span>
                      {i + 1}. {character.className ?? 'Unrecorded'}
                    </span>
                    <span className="text-muted-foreground">
                      {character.minimal ? 'd10 · no choices' : 'd10 · feat'}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
          <Card className="gap-3 p-4">
            <h2 className="text-lg">Skills</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-foreground/20 border-b">
                  <th scope="col" className={cn(th, 'w-full')}>
                    Skill
                  </th>
                  <th scope="col" className={th}>
                    Ranks
                  </th>
                  <th scope="col" className={th}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {skills.map(([name, ranks, total]) => (
                  <tr key={name} className="border-foreground/15 border-b">
                    <td className={td}>{name}</td>
                    <td className={cn(td, 'text-right font-mono')}>
                      {character.minimal ? 0 : ranks}
                    </td>
                    <td className={cn(td, 'text-right font-mono')}>
                      {character.minimal ? 0 : total >= 0 ? `+${total}` : total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
      <AddToCampaignDialog
        characterId={character.id}
        open={adding}
        onOpenChange={setAdding}
      />
    </main>
  );
}

function Missing({ noun }: { noun: string }) {
  return (
    <main className={narrow}>
      <Card className="p-6">
        <p>This {noun} isn’t available here.</p>
      </Card>
    </main>
  );
}

const pages: Record<Page, (props: PageProps) => ReactNode> = {
  campaigns: CampaignsPage,
  characters: CharactersPage,
  'campaign-home': CampaignHomePage,
  'campaign-characters': CampaignCharactersPage,
  week: WeekPage,
  history: HistoryPage,
  militia: MilitiaPage,
  officers: OfficersPage,
  setup: SetupPage,
  sheet: SheetPage,
};

export function renderPage(
  location: Location,
  go: (to: Location) => void,
  orgId: string,
) {
  const Body = pages[location.page];
  return <Body location={location} go={go} orgId={orgId} />;
}
