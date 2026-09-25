'use client';
// PROTOTYPE — low-fidelity screen bodies shared by every navigation variant.
// Only the shells around them differ; per-area designs are other tickets.

import { Check, History, Pencil, UserPlus } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { cn } from '~/lib/utils';
import {
  campaigns,
  characters,
  finishedWeeks,
  mockCards,
  phaseLabels,
  phases,
  type MockCampaign,
  type Phase,
} from './mock';

type Militia = NonNullable<MockCampaign['militia']>;

export function PhaseStepper({
  militia,
  phase,
  onPhase,
  className,
  size = 'default',
}: {
  militia: Militia;
  phase: Phase;
  onPhase: (phase: Phase) => void;
  className?: string;
  size?: 'default' | 'lg';
}) {
  return (
    <nav aria-label="Week phases" className={cn('flex gap-1', className)}>
      {phases.map((p, i) => {
        const disabled = p === 'persistent' && !militia.persistentAvailable;
        return (
          <Button
            key={p}
            size={size}
            variant={p === phase ? 'default' : 'outline'}
            disabled={disabled}
            aria-current={p === phase ? 'page' : undefined}
            onClick={() => onPhase(p)}
            className="flex-1"
          >
            <span className="text-muted-foreground mr-1 text-xs">{i + 1}</span>
            {phaseLabels[p]}
            {militia.ready.includes(p) && <Check className="size-3" />}
          </Button>
        );
      })}
    </nav>
  );
}

export function SaveStatus() {
  return (
    <p role="status" className="text-muted-foreground text-sm">
      Changes saved.
    </p>
  );
}

export function WeekBody({
  militia,
  phase,
  showHeading = true,
}: {
  militia: Militia;
  phase: Phase;
  showHeading?: boolean;
}) {
  return (
    <div className="space-y-4">
      {showHeading && (
        <div className="flex items-end justify-between">
          <h1 className="text-2xl">
            Week {militia.week} · {phaseLabels[phase]}
          </h1>
          <SaveStatus />
        </div>
      )}
      {phase === 'activity' ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            {militia.teams.map((t) => (
              <Card key={t.name} className="border-dashed p-3">
                <p className="text-muted-foreground text-xs uppercase">
                  {t.name} · {t.condition}
                </p>
                <div className="bg-muted/40 mt-2 flex h-20 items-center justify-center border border-dashed text-xs">
                  Action Slot
                </div>
              </Card>
            ))}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {mockCards.map((c) => (
              <Card
                key={c}
                className="flex h-32 w-28 shrink-0 items-center justify-center p-2 text-center text-sm"
              >
                {c}
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card className="p-6">
          <p className="text-muted-foreground text-sm">
            {phaseLabels[phase]} Phase View placeholder. Its layout is decided
            in the week-screen ticket.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="bg-muted/40 h-16 border border-dashed" />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export function HistoryBody({
  week,
  onWeek,
  showList = true,
}: {
  week: number;
  onWeek: (week: number) => void;
  showList?: boolean;
}) {
  return (
    <div className="flex gap-4">
      {showList && (
        <Card className="w-44 shrink-0 gap-0 p-2">
          {finishedWeeks.map((w) => (
            <Button
              key={w}
              variant={w === week ? 'secondary' : 'ghost'}
              className="justify-start"
              onClick={() => onWeek(w)}
            >
              Week {w}
            </Button>
          ))}
        </Card>
      )}
      <div className="flex-1 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl">Week {week} · Finished</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={week <= 1}
              onClick={() => onWeek(week - 1)}
            >
              Previous week
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={week >= 11}
              onClick={() => onWeek(week + 1)}
            >
              Next week
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground text-sm">
          Confirmed week · effective record · read-only
        </p>
        {[
          'Recorded choices',
          'Militia at confirmation',
          'Final plan',
          'Rules Exceptions',
          'Final outcome',
        ].map((s) => (
          <Card key={s} className="p-3 text-sm">
            ▸ {s}
          </Card>
        ))}
      </div>
    </div>
  );
}

export function MilitiaBody({
  militia,
  onCorrect,
  showOfficers = true,
}: {
  militia: Militia;
  onCorrect: () => void;
  showOfficers?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Militia</h1>
        <Button variant="outline" onClick={onCorrect}>
          <Pencil /> Correct militia
        </Button>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {[
          ['Rank', militia.rank],
          ['Training', militia.training],
          ['Treasury', militia.treasury],
          ['Notoriety', militia.notoriety],
          ['Focus', militia.focus],
        ].map(([k, v]) => (
          <Card key={k} className="gap-1 p-3">
            <p className="text-muted-foreground text-xs uppercase">{k}</p>
            <p className="text-xl">{v}</p>
          </Card>
        ))}
      </div>
      <div className={cn('grid gap-4', showOfficers && 'grid-cols-2')}>
        <Card>
          <CardHeader>
            <CardTitle>Teams</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {militia.teams.map((t) => (
              <p key={t.name}>
                {t.name} ({t.type}) · {t.condition} · manager {t.manager}
              </p>
            ))}
          </CardContent>
        </Card>
        {showOfficers && <OfficersCard militia={militia} />}
      </div>
      <p className="text-muted-foreground text-sm">
        Settlements, items, caches, orders, marketplaces and benefits sit below,
        read-only until Correct militia.
      </p>
    </div>
  );
}

export function OfficersCard({
  militia,
  onReassign,
}: {
  militia: Militia;
  onReassign?: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Officers</CardTitle>
        {onReassign && (
          <Button size="sm" variant="outline" onClick={onReassign}>
            Reassign
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {militia.officers.map((o) => (
          <p key={o.role}>
            {o.role}:{' '}
            {o.holder ?? <span className="text-muted-foreground">vacant</span>}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}

export function PeopleBody({
  militia,
  onReassign,
}: {
  militia: Militia | null;
  onReassign?: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Characters{militia && ' & officers'}</h1>
        <div className="flex gap-2">
          <Button variant="outline">Show archived</Button>
          <Button>
            <UserPlus /> Add character
          </Button>
        </div>
      </div>
      <div className={cn('grid gap-4', militia && 'grid-cols-[2fr_1fr]')}>
        <Card className="gap-0 p-0">
          {characters.map((c) => (
            <div
              key={c.name}
              className="flex items-center justify-between border-b p-3 text-sm last:border-0"
            >
              <span>{c.name}</span>
              <span className="text-muted-foreground">
                L{c.level} · {c.kind} · {c.stats}
              </span>
            </div>
          ))}
        </Card>
        {militia && <OfficersCard militia={militia} onReassign={onReassign} />}
      </div>
    </div>
  );
}

export function CorrectionBody({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Correct militia</h1>
        <Button variant="outline" onClick={onClose}>
          Close correction
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">
        The existing correction form: values, people & officer roles, teams &
        managers, world, assets, benefits. Reason required.
      </p>
      {[
        'Militia values',
        'People & officer roles',
        'Teams',
        'Settlements',
        'Assets',
      ].map((s) => (
        <Card key={s} className="p-3 text-sm">
          ▸ {s}
        </Card>
      ))}
    </div>
  );
}

export function SetupBody() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Set up militia</h1>
      <p className="text-muted-foreground text-sm">
        The existing setup form (New / Existing militia). Its shape is decided
        in the setup-and-corrections ticket.
      </p>
      {[
        'Militia values',
        'Week context',
        'People & roles',
        'Teams',
        'World',
        'Carry-over',
      ].map((s) => (
        <Card key={s} className="p-3 text-sm">
          ▸ {s}
        </Card>
      ))}
      <Button>Start militia week</Button>
    </div>
  );
}

export function CampaignListBody({
  onOpen,
}: {
  onOpen: (campaignId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Campaigns</h1>
        <Button>New campaign</Button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {campaigns.map((c) => (
          <Card
            key={c.id}
            role="button"
            onClick={() => onOpen(c.id)}
            className="hover:border-primary cursor-pointer p-4"
          >
            <p className="text-lg">{c.name}</p>
            <p className="text-muted-foreground text-sm">{c.description}</p>
            <Badge variant="outline">
              {c.militia
                ? `Week ${c.militia.week} · ${phaseLabels[c.militia.phase]}`
                : 'No militia yet'}
            </Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function RecentWeeks({ onOpen }: { onOpen: (week: number) => void }) {
  return (
    <div className="space-y-1">
      {finishedWeeks.slice(0, 3).map((w) => (
        <Button
          key={w}
          variant="ghost"
          className="w-full justify-start"
          onClick={() => onOpen(w)}
        >
          <History /> Week {w}
        </Button>
      ))}
    </div>
  );
}
