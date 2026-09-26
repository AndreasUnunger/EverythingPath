'use client';
// PROTOTYPE — the settled top bar (navigation #102 variant E) plus the parts
// all variants share: org switcher and user button stand-ins, list states,
// the create fields and a placeholder for screens outside this ticket.

import { Building2, ChevronDown, Loader2 } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { KeepIcon } from '~/components/keepIcon';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
} from '~/components/ui/select';
import { Skeleton } from '~/components/ui/skeleton';
import { cn } from '~/lib/utils';
import {
  address,
  continuePhase,
  organizations,
  phaseLabels,
  validateName,
  type Campaign,
  type Organization,
  type Place,
  type Scenario,
} from './mock';

export function OrgSwitcher({
  scenario,
  setOrg,
  bare,
}: {
  scenario: Scenario;
  setOrg: (org: Organization) => void;
  bare?: boolean;
}) {
  return (
    <Select
      value={scenario.org}
      onValueChange={(v) => setOrg(v as Organization)}
    >
      <SelectTrigger
        aria-label="Organization"
        className={cn(
          'gap-2',
          bare &&
            'border-0 bg-transparent px-1 text-base shadow-none dark:bg-transparent [&>svg]:hidden',
        )}
      >
        {!bare && <Building2 className="size-4 opacity-70" />}
        {scenario.orgState === 'none' ? 'Choose organization' : scenario.org}
        {bare && <ChevronDown className="size-4 opacity-60" />}
      </SelectTrigger>
      <SelectContent>
        {organizations.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function UserSlot({ scenario }: { scenario: Scenario }) {
  if (scenario.loading) return <Skeleton className="size-8 rounded-full" />;
  if (scenario.signedOut) return <Button size="sm">Sign in</Button>;
  return (
    <Avatar className="size-8" aria-label="Account">
      <AvatarFallback>AU</AvatarFallback>
    </Avatar>
  );
}

type ShellProps = {
  place: Place;
  campaigns: Campaign[];
  scenario: Scenario;
  go: (place: Place) => void;
  setOrg: (org: Organization) => void;
  // A and C: org switcher in the right cluster everywhere. B: in the
  // breadcrumb on the list page, in the right cluster on campaign pages.
  orgPlacement: 'right' | 'breadcrumb';
  // Where picking a campaign in the switcher lands.
  openCampaign: (c: Campaign) => Place;
  allCampaigns: (currentId: string) => Place;
  children: React.ReactNode;
};

export function Shell({
  place,
  campaigns,
  scenario,
  go,
  setOrg,
  orgPlacement,
  openCampaign,
  allCampaigns,
  children,
}: ShellProps) {
  const onList = place.page === 'list';
  const campaign = onList
    ? undefined
    : campaigns.find((c) => c.id === place.id);
  const tabs: [Place['page'], string][] = campaign?.militia
    ? [
        ['week', `Week ${campaign.militia.week}`],
        ['history', 'Finished weeks'],
        ['militia', 'Militia'],
        ['characters', 'Characters & officers'],
      ]
    : [
        ['setup', 'Set up militia'],
        ['characters', 'Characters'],
      ];

  return (
    <main className="flex min-h-svh flex-col">
      <header className="bg-sidebar flex items-center gap-4 border-b px-4 py-2">
        <button aria-label="All campaigns" onClick={() => go({ page: 'list' })}>
          <KeepIcon className="size-8" />
        </button>
        <span className="text-muted-foreground">/</span>
        {onList && orgPlacement === 'breadcrumb' ? (
          <OrgSwitcher scenario={scenario} setOrg={setOrg} bare />
        ) : (
          <Select
            value={campaign?.id ?? ''}
            onValueChange={(v) => {
              if (v === '__all') return go(allCampaigns(campaign?.id ?? ''));
              const next = campaigns.find((c) => c.id === v);
              if (next) go(openCampaign(next));
            }}
          >
            <SelectTrigger
              aria-label="Active campaign"
              className="border-0 bg-transparent px-1 text-base shadow-none dark:bg-transparent [&>svg]:hidden"
            >
              {campaign?.name ?? 'All campaigns'}
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
        )}
        {campaign && (
          <nav className="flex gap-1 text-sm">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                onClick={() =>
                  go({
                    page: key as 'week',
                    id: campaign.id,
                    phase: campaign.militia
                      ? continuePhase(campaign.militia)
                      : undefined,
                  })
                }
                className={cn(
                  'px-3 py-1.5',
                  key === place.page
                    ? 'bg-background rounded-md shadow-sm'
                    : 'text-muted-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-3">
          {(orgPlacement === 'right' || !onList) && !scenario.signedOut && (
            <OrgSwitcher scenario={scenario} setOrg={setOrg} />
          )}
          <UserSlot scenario={scenario} />
        </div>
      </header>
      {children}
    </main>
  );
}

// Loading, no organization, no access and error: the same in every variant.
// Returns null when the list is ready to render.
export function ListStates({
  scenario,
  setOrg,
}: {
  scenario: Scenario;
  setOrg: (org: Organization) => void;
}) {
  if (scenario.loading)
    return (
      <div className="space-y-3" role="status">
        <span className="sr-only">Loading campaigns…</span>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  if (scenario.signedOut)
    return (
      <Card className="items-start p-6">
        <p>Sign in to see your campaigns.</p>
        <Button>Sign in</Button>
      </Card>
    );
  if (scenario.orgState === 'none')
    return (
      <Card className="items-start p-6">
        <p>Choose an organization to see its campaigns.</p>
        <OrgSwitcher scenario={scenario} setOrg={setOrg} />
      </Card>
    );
  if (scenario.orgState === 'denied')
    return (
      <Card className="p-6">
        You don&apos;t have access to this organization&apos;s campaigns.
      </Card>
    );
  if (scenario.orgState === 'error')
    return (
      <Card role="alert" className="p-6">
        Campaigns could not be loaded. Please try again.
      </Card>
    );
  return null;
}

// Name and description with the create rules. Each variant decides the
// surface around it (inline row, pane, dialog).
export function CreateFields({
  onCreate,
  onCancel,
  multiline,
  inline,
  submitLabel = 'Create',
}: {
  onCreate: (name: string, description: string) => Promise<void> | void;
  onCancel?: () => void;
  multiline?: boolean;
  inline?: boolean;
  submitLabel?: string;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validateName(name);
    setError(problem);
    if (problem) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    await onCreate(name.trim(), description.trim());
    setSaving(false);
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      className={cn(inline ? 'flex items-start gap-3' : 'space-y-4')}
    >
      <div className={cn('grid gap-2', inline && 'w-64')}>
        <Label htmlFor="campaign-name" className={cn(inline && 'sr-only')}>
          Campaign name
        </Label>
        <Input
          id="campaign-name"
          autoFocus
          placeholder={inline ? 'Campaign name' : undefined}
          value={name}
          aria-invalid={!!error}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(validateName(e.target.value));
          }}
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>
      <div className={cn('grid gap-2', inline && 'flex-1')}>
        <Label
          htmlFor="campaign-description"
          className={cn(inline && 'sr-only')}
        >
          Description
        </Label>
        {multiline ? (
          <textarea
            id="campaign-description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:ring-[3px] md:text-sm"
          />
        ) : (
          <Input
            id="campaign-description"
            placeholder={inline ? 'Description (optional)' : undefined}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

// Screens other tickets own. Only shows where the tap landed.
export function Destination({
  place,
  campaign,
}: {
  place: Place;
  campaign?: Campaign;
}) {
  if (place.page === 'list' || place.page === 'home') return null;
  const what = {
    week: `Week ${campaign?.militia?.week} · ${phaseLabels[place.phase ?? 'upkeep']}`,
    setup: 'Set up militia (guided, #113)',
    history: place.week ? `Finished week ${place.week}` : 'Finished weeks',
    militia: 'Militia (#113)',
    characters: 'Characters & officers (#114)',
  }[place.page];
  return (
    <div className="grid flex-1 place-items-center p-8">
      <div className="border-muted-foreground/40 text-muted-foreground max-w-md rounded-lg border-2 border-dashed p-8 text-center font-mono text-sm">
        <p className="text-foreground text-lg">{what}</p>
        <p className="mt-2">{address(place)}</p>
        <p className="mt-4">PROTOTYPE: another ticket designs this screen.</p>
      </div>
    </div>
  );
}
