'use client';
// PROTOTYPE — Variant C: campaign hub with focused spokes, no persistent nav.
// Opening a campaign lands on its hub: one tile per area showing live status.
// Each area is a focused full-screen page with a single "back to hub" control.
// The week runs in focus mode with the phase stepper docked at the bottom.

import { ArrowLeft, ArrowRight, History } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import {
  baseCoverage,
  campaignById,
  characters,
  phaseLabels,
  type Place,
} from './mock';
import {
  CampaignListBody,
  CorrectionBody,
  HistoryBody,
  MilitiaBody,
  PeopleBody,
  PhaseStepper,
  RecentWeeks,
  SetupBody,
  WeekBody,
} from './screens';
import type { VariantProps } from './types';

export const name = 'Campaign hub';
export const landing = 'home' as const;

export function address(place: Place) {
  const base = `/campaigns/${place.campaignId}`;
  switch (place.section) {
    case 'campaigns':
      return '/campaigns';
    case 'home':
      return base;
    case 'week':
      return `${base}/week?phase=${place.phase}`;
    case 'history':
      return `${base}/history?week=${place.historyWeek}`;
    case 'militia':
      return `${base}/militia`;
    case 'correct':
      return `${base}/militia/correct`;
    case 'people':
      return `${base}/people`;
    case 'setup':
      return `${base}/setup`;
  }
}

export function coverage(place: Place) {
  if (place.section === 'home')
    return [
      'CAMP-06 (description on hub)',
      'NAV-10…13 replaced by hub tiles',
      'WEEK-01 (status), HIST-01 (recent), LEDG-03 (officers tile)',
    ];
  if (place.section === 'campaigns')
    return [
      'NAV-02…09 (campaign list header)',
      ...baseCoverage.campaigns,
      'CAMP-02',
    ];
  return ['Back to hub', ...baseCoverage[place.section]];
}

function SpokeHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  return (
    <header className="flex items-center gap-3 border-b px-4 py-2">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft /> {title}
      </Button>
      <div className="ml-auto flex items-center gap-3">{right}</div>
    </header>
  );
}

export function VariantC({ place, go }: VariantProps) {
  const campaign = campaignById(place.campaignId);
  const militia = campaign.militia;
  const hub = () => go({ section: 'home' });

  if (place.section === 'campaigns')
    return (
      <main className="mx-auto max-w-5xl p-8">
        <CampaignListBody
          onOpen={(id) => go({ campaignId: id, section: 'home' })}
        />
      </main>
    );

  if (place.section === 'home' || (!militia && place.section === 'week'))
    return (
      <main className="mx-auto max-w-6xl space-y-6 p-8">
        <div className="flex items-start justify-between">
          <div>
            <Button
              variant="link"
              className="px-0"
              onClick={() => go({ section: 'campaigns' })}
            >
              <ArrowLeft /> All campaigns
            </Button>
            <h1 className="text-3xl">{campaign.name}</h1>
            <p className="text-muted-foreground">{campaign.description}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {militia ? (
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle className="text-xl">
                  Week {militia.week} · {phaseLabels[militia.phase]}
                </CardTitle>
                <CardDescription>
                  Ready:{' '}
                  {militia.ready.map((p) => phaseLabels[p]).join(', ') ||
                    'none'}
                </CardDescription>
                <CardAction>
                  <Button
                    size="lg"
                    onClick={() =>
                      go({ section: 'week', phase: militia.phase })
                    }
                  >
                    Continue the week <ArrowRight />
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="grid grid-cols-5 gap-2 text-sm">
                {[
                  ['Rank', militia.rank],
                  ['Training', militia.training],
                  ['Treasury', militia.treasury],
                  ['Notoriety', militia.notoriety],
                  ['Focus', militia.focus],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-muted-foreground text-xs uppercase">
                      {k}
                    </p>
                    <p>{v}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle className="text-xl">No militia yet</CardTitle>
                <CardDescription>
                  Start a new militia or bring in one already running at the
                  table.
                </CardDescription>
                <CardAction>
                  <Button size="lg" onClick={() => go({ section: 'setup' })}>
                    Set up militia <ArrowRight />
                  </Button>
                </CardAction>
              </CardHeader>
            </Card>
          )}
          {militia && (
            <Card>
              <CardHeader>
                <CardTitle>Finished weeks</CardTitle>
                <CardAction>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => go({ section: 'history' })}
                  >
                    All
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                <RecentWeeks
                  onOpen={(w) => go({ section: 'history', historyWeek: w })}
                />
              </CardContent>
            </Card>
          )}
          {militia && (
            <Card
              role="button"
              className="cursor-pointer"
              onClick={() => go({ section: 'militia' })}
            >
              <CardHeader>
                <CardTitle>Militia</CardTitle>
                <CardDescription>
                  Teams, settlements, assets · corrections
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {militia.teams.map((t) => (
                  <p key={t.name}>
                    {t.name} <Badge variant="outline">{t.condition}</Badge>
                  </p>
                ))}
              </CardContent>
            </Card>
          )}
          <Card
            role="button"
            className="cursor-pointer"
            onClick={() => go({ section: 'people' })}
          >
            <CardHeader>
              <CardTitle>Characters{militia && ' & officers'}</CardTitle>
              <CardDescription>
                {characters.length} active characters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {militia
                ? militia.officers.map((o) => (
                    <p key={o.role}>
                      {o.role}: {o.holder ?? '—'}
                    </p>
                  ))
                : characters.map((c) => <p key={c.name}>{c.name}</p>)}
            </CardContent>
          </Card>
        </div>
      </main>
    );

  if (place.section === 'week' && militia)
    return (
      <div className="flex h-full flex-col">
        <SpokeHeader
          title={campaign.name}
          onBack={hub}
          right={
            <Button
              variant="outline"
              size="sm"
              onClick={() => go({ section: 'history' })}
            >
              <History /> Finished weeks
            </Button>
          }
        />
        <main className="flex-1 overflow-auto p-6">
          <WeekBody militia={militia} phase={place.phase} />
        </main>
        <footer className="bg-sidebar border-t p-2">
          <PhaseStepper
            militia={militia}
            phase={place.phase}
            onPhase={(p) => go({ phase: p })}
            size="lg"
          />
        </footer>
      </div>
    );

  return (
    <div>
      <SpokeHeader title={campaign.name} onBack={hub} />
      <main className="mx-auto max-w-6xl p-6">
        {place.section === 'history' && (
          <HistoryBody
            week={place.historyWeek}
            onWeek={(w) => go({ historyWeek: w })}
          />
        )}
        {place.section === 'militia' && militia && (
          <MilitiaBody
            militia={militia}
            showOfficers={false}
            onCorrect={() => go({ section: 'correct' })}
          />
        )}
        {place.section === 'correct' && (
          <CorrectionBody onClose={() => go({ section: 'militia' })} />
        )}
        {place.section === 'people' && (
          <PeopleBody
            militia={militia}
            onReassign={() => go({ section: 'correct' })}
          />
        )}
        {place.section === 'setup' && <SetupBody />}
      </main>
    </div>
  );
}
