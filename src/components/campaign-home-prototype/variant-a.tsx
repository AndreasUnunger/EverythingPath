'use client';
// PROTOTYPE — Variant A: roster, straight to the table. `/campaigns` is a
// list of rows whose job is to get you into the week. No campaign home:
// `/campaigns/<id>` redirects to the week (or setup). Create is an inline row.

import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import { cn } from '~/lib/utils';
import { CreateFields } from './frame';
import {
  continuePhase,
  statusLine,
  type Campaign,
  type Place,
  type ProtoProps,
} from './mock';

export const name = 'Roster, straight to the table';

export const shell = {
  orgPlacement: 'right' as const,
  openCampaign: open,
  allCampaigns: (): Place => ({ page: 'list' }),
};

function open(c: Campaign): Place {
  return c.militia
    ? { page: 'week', id: c.id, phase: continuePhase(c.militia) }
    : { page: 'setup', id: c.id };
}

export function VariantA({
  campaigns,
  scenario,
  place,
  go,
  create,
  highlight,
  setHighlight,
}: ProtoProps) {
  const [creating, setCreating] = useState(false);

  // `/campaigns/<id>` is only a redirect here.
  useEffect(() => {
    if (place.page !== 'home' && !(place.page === 'list' && place.selected))
      return;
    const id = place.page === 'home' ? place.id : place.selected;
    const c = campaigns.find((x) => x.id === id);
    if (c) go(open(c));
  }, [place, campaigns, go]);

  const empty = campaigns.length === 0;

  async function onCreate(name: string, description: string) {
    const c = create(name, description);
    setCreating(false);
    if (scenario.createReturnsId) go({ page: 'setup', id: c.id });
    else setHighlight(c.id);
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Campaigns</h1>
        {!empty && !creating && (
          <Button variant="outline" onClick={() => setCreating(true)}>
            <Plus /> New campaign
          </Button>
        )}
      </div>
      {empty && <p>Create a campaign to get started.</p>}
      <div className="space-y-2">
        {campaigns.map((c) => (
          <Row
            key={c.id}
            campaign={c}
            fresh={highlight === c.id}
            onOpen={() => go(open(c))}
          />
        ))}
        {(creating || empty) && (
          <Card className="p-4">
            <CreateFields
              inline
              onCreate={onCreate}
              onCancel={empty ? undefined : () => setCreating(false)}
            />
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({
  campaign: c,
  fresh,
  onOpen,
}: {
  campaign: Campaign;
  fresh: boolean;
  onOpen: () => void;
}) {
  const last = c.militia?.finished[0];
  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className={cn(
        'hover:border-primary flex cursor-pointer flex-row items-center gap-6 px-5 py-4',
        fresh && 'border-primary ring-primary/40 ring-2',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-lg">{c.name}</p>
        {c.description && (
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-muted-foreground truncate text-sm">
                {c.description}
              </p>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              {c.description}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="w-64 shrink-0 text-sm">
        <p>{statusLine(c)}</p>
        <p className="text-muted-foreground">
          {c.militia
            ? last
              ? `Last finished: Week ${last.week}`
              : 'No finished weeks yet'
            : fresh
              ? 'Just created'
              : ''}
        </p>
      </div>
      <Button
        className="w-44 shrink-0"
        variant={c.militia ? 'default' : 'outline'}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
      >
        {c.militia ? `Continue week ${c.militia.week}` : 'Set up militia'}
      </Button>
    </Card>
  );
}
