'use client';
// PROTOTYPE — Variant B: list with a detail pane. The list is the campaign
// home: `/campaigns/<id>` is the same screen with that campaign selected.
// The org switcher sits in the breadcrumb here and in the top bar's right
// cluster on campaign pages. Create turns the pane into the form; Edit changes
// the description and in-game date in place.

import { ChevronRight, History, Pencil, Plus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { FantasyDatePicker } from '~/components/ui/fantasy-date-picker';
import { Label } from '~/components/ui/label';
import { cn } from '~/lib/utils';
import { CreateFields } from './frame';
import {
  continuePhase,
  formatInGameDate,
  militiaLine,
  provenanceBadge,
  statusLine,
  type Campaign,
  type Place,
  type ProtoProps,
} from './mock';

export const name = 'List with detail pane (the list is the home)';

export const shell = {
  orgPlacement: 'breadcrumb' as const,
  openCampaign: (c: Campaign): Place =>
    c.militia
      ? { page: 'week', id: c.id, phase: continuePhase(c.militia) }
      : { page: 'setup', id: c.id },
  allCampaigns: (currentId: string): Place => ({
    page: 'list',
    selected: currentId || undefined,
  }),
};

export function VariantB({ campaigns, place, go, create, update }: ProtoProps) {
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (place.page === 'home') go({ page: 'list', selected: place.id });
  }, [place, go]);

  const empty = campaigns.length === 0;
  const selectedId = place.page === 'list' ? place.selected : undefined;
  const selected = campaigns.find((c) => c.id === selectedId) ?? campaigns[0];

  async function onCreate(name: string, description: string) {
    const c = create(name, description);
    setCreating(false);
    // createCampaign returns the new id (approved), so select it.
    go({ page: 'list', selected: c.id });
  }

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="bg-sidebar w-80 shrink-0 border-r">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg">Campaigns</h1>
          {!empty && (
            <Button
              size="icon"
              variant="ghost"
              aria-label="New campaign"
              onClick={() => setCreating(true)}
            >
              <Plus />
            </Button>
          )}
        </div>
        <nav className="space-y-1 px-2">
          {campaigns.map((c) => {
            const active = !creating && c.id === selected?.id;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setCreating(false);
                  go({ page: 'list', selected: c.id });
                }}
                className={cn(
                  'w-full rounded-md border-l-4 border-transparent px-3 py-2.5 text-left',
                  active
                    ? 'bg-background border-primary shadow-sm'
                    : 'hover:bg-background/50',
                )}
              >
                <p>{c.name}</p>
                <p className="text-muted-foreground text-sm">{statusLine(c)}</p>
              </button>
            );
          })}
          {empty && (
            <p className="text-muted-foreground px-3 py-2">No campaigns yet</p>
          )}
          {creating && (
            <div className="bg-background border-primary rounded-md border-l-4 px-3 py-2.5 italic shadow-sm">
              New campaign
            </div>
          )}
        </nav>
      </aside>
      <section className="min-w-0 flex-1 overflow-y-auto p-6">
        {creating || empty || !selected ? (
          <div className="max-w-xl space-y-4">
            <h2 className="text-2xl">
              {empty ? 'Create a campaign to get started.' : 'New campaign'}
            </h2>
            <CreateFields
              multiline
              onCreate={onCreate}
              onCancel={empty ? undefined : () => setCreating(false)}
            />
          </div>
        ) : (
          <Pane key={selected.id} campaign={selected} go={go} update={update} />
        )}
      </section>
    </div>
  );
}

function Pane({
  campaign: c,
  go,
  update,
}: {
  campaign: Campaign;
  go: ProtoProps['go'];
  update: ProtoProps['update'];
}) {
  const m = c.militia;
  const [editing, setEditing] = useState(false);
  return (
    <div className="max-w-3xl space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <h2 className="text-3xl">{c.name}</h2>
          {c.inGameDate && (
            <Badge variant="outline">{formatInGameDate(c.inGameDate)}</Badge>
          )}
          {!editing && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setEditing(true)}
            >
              <Pencil /> Edit
            </Button>
          )}
        </div>
        {editing ? (
          <EditDetails
            campaign={c}
            onSave={(patch) => {
              update(c.id, patch);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          c.description && (
            <p className="text-muted-foreground max-w-prose">{c.description}</p>
          )
        )}
      </header>

      <div className="flex items-center gap-4">
        {m ? (
          <>
            <Button
              size="lg"
              className="h-12 px-6 text-base"
              onClick={() =>
                go({ page: 'week', id: c.id, phase: continuePhase(m) })
              }
            >
              Continue week {m.week} <ChevronRight />
            </Button>
          </>
        ) : (
          <Button
            size="lg"
            className="h-12 px-6 text-base"
            onClick={() => go({ page: 'setup', id: c.id })}
          >
            Set up militia <ChevronRight />
          </Button>
        )}
      </div>

      {m && (
        <Card className="gap-2 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm tracking-wide uppercase">Militia</h3>
            <Button
              variant="link"
              size="sm"
              onClick={() => go({ page: 'militia', id: c.id })}
            >
              Open militia
            </Button>
          </div>
          <p>{militiaLine(m)}</p>
        </Card>
      )}

      {m && (
        <Card className="gap-2 p-4">
          <h3 className="text-sm tracking-wide uppercase">
            Recent finished weeks
          </h3>
          {m.finished.length === 0 ? (
            <p className="text-muted-foreground">No finished weeks yet</p>
          ) : (
            <ul>
              {m.finished.slice(0, 3).map((w) => (
                <li key={w.week}>
                  <button
                    className="hover:bg-muted flex w-full items-center gap-3 rounded-md px-2 py-2 text-left"
                    onClick={() =>
                      go({ page: 'history', id: c.id, week: w.week })
                    }
                  >
                    <History className="size-4 opacity-60" />
                    Week {w.week}
                    {provenanceBadge[w.provenance] && (
                      <Badge variant="secondary">
                        {provenanceBadge[w.provenance]}
                      </Badge>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {m.finished.length > 3 && (
            <Button
              variant="link"
              size="sm"
              className="self-start"
              onClick={() => go({ page: 'history', id: c.id })}
            >
              All finished weeks
            </Button>
          )}
        </Card>
      )}

      <Button
        variant="outline"
        onClick={() => go({ page: 'characters', id: c.id })}
      >
        <Users /> {m ? 'Characters & officers' : 'Characters'}
      </Button>
    </div>
  );
}

function EditDetails({
  campaign: c,
  onSave,
  onCancel,
}: {
  campaign: Campaign;
  onSave: (patch: { description: string; inGameDate?: string }) => void;
  onCancel: () => void;
}) {
  const [description, setDescription] = useState(c.description);
  const [date, setDate] = useState(c.inGameDate ?? '');
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        await new Promise((r) => setTimeout(r, 400));
        onSave({
          description: description.trim(),
          inGameDate: date || undefined,
        });
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="edit-description">Description</Label>
        <textarea
          id="edit-description"
          autoFocus
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:ring-[3px] md:text-sm"
        />
      </div>
      <div className="grid gap-2">
        <Label>In-game date</Label>
        <FantasyDatePicker
          value={date}
          onChange={setDate}
          ariaLabel="In-game date"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
