'use client';
// PROTOTYPE — Variant C: card grid plus a campaign home page. Cards lead to
// `/campaigns/<id>`, a home inside the campaign's shell with the description,
// this week's phase readiness and recent finished weeks. Create is a dialog.

import { Check, ChevronRight, History, Lock, Plus } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { cn } from '~/lib/utils';
import { CreateFields } from './frame';
import {
  continuePhase,
  militiaLine,
  phaseLabels,
  phases,
  provenanceBadge,
  statusLine,
  type Campaign,
  type Place,
  type ProtoProps,
} from './mock';

export const name = 'Card grid + campaign home page';

export const shell = {
  orgPlacement: 'right' as const,
  openCampaign: (c: Campaign): Place => ({ page: 'home', id: c.id }),
  allCampaigns: (): Place => ({ page: 'list' }),
};

export function VariantC(props: ProtoProps) {
  const { place, campaigns } = props;
  if (place.page === 'home') {
    const c = campaigns.find((x) => x.id === place.id);
    return c ? <Home campaign={c} go={props.go} /> : null;
  }
  return <List {...props} />;
}

function List({
  campaigns,
  scenario,
  go,
  create,
  highlight,
  setHighlight,
}: ProtoProps) {
  const [open, setOpen] = useState(false);
  const single = campaigns.length === 1;

  async function onCreate(name: string, description: string) {
    const c = create(name, description);
    setOpen(false);
    if (scenario.createReturnsId) go({ page: 'home', id: c.id });
    else setHighlight(c.id);
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Campaigns</h1>
        {campaigns.length > 0 && (
          <Button onClick={() => setOpen(true)}>
            <Plus /> New campaign
          </Button>
        )}
      </div>
      {campaigns.length === 0 ? (
        <div className="grid place-items-center gap-4 py-24">
          <p className="text-lg">Create a campaign to get started.</p>
          <Button onClick={() => setOpen(true)}>
            <Plus /> New campaign
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 2xl:grid-cols-3">
          {campaigns.map((c) => (
            <Card
              key={c.id}
              role="link"
              tabIndex={0}
              onClick={() => go({ page: 'home', id: c.id })}
              onKeyDown={(e) =>
                e.key === 'Enter' && go({ page: 'home', id: c.id })
              }
              className={cn(
                'hover:border-primary min-h-48 cursor-pointer justify-between gap-3 p-5',
                single && 'col-span-2',
                highlight === c.id && 'border-primary ring-primary/40 ring-2',
              )}
            >
              <div className="space-y-1">
                <p className="text-xl">{c.name}</p>
                {c.description && (
                  <p className="text-muted-foreground line-clamp-2 text-sm">
                    {c.description}
                  </p>
                )}
              </div>
              <div className="flex items-end justify-between gap-3">
                <Badge variant="outline">{statusLine(c)}</Badge>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      go({ page: 'home', id: c.id });
                    }}
                  >
                    Overview
                  </Button>
                  <Button
                    variant={c.militia ? 'default' : 'outline'}
                    onClick={(e) => {
                      e.stopPropagation();
                      go(
                        c.militia
                          ? {
                              page: 'week',
                              id: c.id,
                              phase: continuePhase(c.militia),
                            }
                          : { page: 'setup', id: c.id },
                      );
                    }}
                  >
                    {c.militia
                      ? `Continue week ${c.militia.week}`
                      : 'Set up militia'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
          </DialogHeader>
          <CreateFields
            multiline
            onCreate={onCreate}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Home({
  campaign: c,
  go,
}: {
  campaign: Campaign;
  go: ProtoProps['go'];
}) {
  const m = c.militia;
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl">{c.name}</h1>
          {c.inGameDate && <Badge variant="outline">{c.inGameDate}</Badge>}
        </div>
        {c.description && (
          <p className="text-muted-foreground max-w-prose">{c.description}</p>
        )}
      </header>

      {!m ? (
        <Card className="max-w-xl items-start p-6">
          <p className="text-lg">No militia yet</p>
          <div className="flex gap-2">
            <Button onClick={() => go({ page: 'setup', id: c.id })}>
              Set up militia <ChevronRight />
            </Button>
            <Button
              variant="ghost"
              onClick={() => go({ page: 'characters', id: c.id })}
            >
              Characters
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card className="col-span-2 gap-3 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl">Week {m.week}</h2>
                <Button
                  onClick={() =>
                    go({ page: 'week', id: c.id, phase: continuePhase(m) })
                  }
                >
                  Continue <ChevronRight />
                </Button>
              </div>
              <ul className="divide-y">
                {phases.map((p) => {
                  const r = m.readiness[p];
                  return (
                    <li key={p}>
                      <button
                        disabled={r.state === 'locked'}
                        onClick={() => go({ page: 'week', id: c.id, phase: p })}
                        className="hover:bg-muted flex w-full items-center gap-3 px-2 py-2.5 text-left disabled:opacity-50"
                      >
                        {r.state === 'ready' ? (
                          <Check className="text-primary size-4" />
                        ) : r.state === 'locked' ? (
                          <Lock className="size-4" />
                        ) : (
                          <span className="border-muted-foreground size-4 rounded-full border" />
                        )}
                        <span className="w-40">{phaseLabels[p]}</span>
                        <span className="text-muted-foreground text-sm">
                          {r.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
            <Card className="gap-2 p-5">
              <h2 className="text-sm tracking-wide uppercase">
                Recent finished weeks
              </h2>
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
              <Button
                variant="link"
                size="sm"
                className="mt-auto self-start"
                onClick={() => go({ page: 'history', id: c.id })}
              >
                All finished weeks
              </Button>
            </Card>
          </div>
          <Card className="flex-row items-center justify-between p-4">
            <p>{militiaLine(m)}</p>
            <Button
              variant="outline"
              onClick={() => go({ page: 'militia', id: c.id })}
            >
              Open militia
            </Button>
          </Card>
        </>
      )}
    </div>
  );
}
