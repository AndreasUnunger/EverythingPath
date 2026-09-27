'use client';
import { Card } from '~/components/ui/card';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { UpkeepSections, UpkeepView as UpkeepFacts } from './types';
import { IssueNotes, ReasonedDecision, Step } from './upkeep-parts';
import { Attrition, Notoriety, Shortage } from './upkeep-steps';
import { TeamConditions } from './upkeep-teams';
import { Deposits } from './upkeep-transfers';

// Upkeep as the numbered rules steps: team conditions, training attrition,
// maximum notoriety, treasury shortage, rank, then deposits and withdrawals.
// Each section reports only its own effect; the week frame carries readiness
// and the whole-week totals.

function Rank({
  view,
  rank,
  edit,
  disabled,
}: {
  view: UpkeepFacts;
  rank: UpkeepSections['rank'];
  edit: (edit: WeeklyDraftEdit) => unknown;
  disabled: boolean;
}) {
  return (
    <Step
      number={4}
      title="Rank"
      status={rank.status}
      effect={
        rank.status === 'waiting'
          ? 'Waiting for the steps above'
          : rank.after === null
            ? 'Highest player-character level needed'
            : rank.after === rank.before
              ? `Stays rank ${rank.before}`
              : `Rank ${rank.before} → ${rank.after}`
      }
    >
      {rank.status === 'waiting' && (
        <p className="text-muted-foreground text-sm">
          Rank is worked out once every roll and decision above is in.
        </p>
      )}
      {view.boons.map((boon) => (
        <Card key={boon.subjectId} className="space-y-3 p-4">
          <h4 className="font-semibold">
            Rank {boon.reward.rank} boon ·{' '}
            {view.officers.find(
              (person) => person.characterId === boon.characterId,
            )?.name ?? 'Character'}
          </h4>
          <p className="text-sm">
            {boon.reward.kind === 'gift'
              ? `${boon.reward.gift}, up to ${boon.reward.maxValueCopper} copper${boon.reward.fullyChargedWands ? '; wands fully charged' : ''}`
              : boon.reward.kind === 'skilled'
                ? `${boon.reward.skillRanks} skill rank`
                : boon.reward.kind === 'title'
                  ? `${boon.reward.title}: ${boon.reward.feats.join(', ')}`
                  : `${boon.reward.xpPerPc ?? 0} XP per character`}
          </p>
          <ReasonedDecision
            label="Boon outcome"
            current={boon.acknowledgement?.outcome ?? ''}
            disabled={disabled}
            onSave={(outcome) =>
              edit({
                kind: 'acknowledge',
                acknowledgement: {
                  acknowledgementId:
                    boon.acknowledgement?.acknowledgementId ??
                    `ack:${boon.subjectId}`,
                  subjectId: boon.subjectId,
                  outcome,
                },
              })
            }
            onClear={() => {
              if (boon.acknowledgement)
                edit({
                  kind: 'clear_acknowledgement',
                  acknowledgementId: boon.acknowledgement.acknowledgementId,
                });
            }}
          />
        </Card>
      ))}
      <IssueNotes issues={rank.issues} />
    </Step>
  );
}
// `correctionsHref` links a retained Remove choice to Militia corrections,
// where teams are removed now; without it the link stays off.
export function UpkeepView({
  view,
  edit,
  disabled,
  correctionsHref,
}: {
  view: UpkeepFacts;
  edit: (edit: WeeklyDraftEdit) => unknown;
  disabled: boolean;
  correctionsHref?: string;
}) {
  const sections = view.sections;
  if (view.skipped || !sections)
    return (
      <section aria-label="Upkeep">
        <Card className="space-y-1 p-4">
          <p>Upkeep is skipped for the militia’s first week.</p>
          <p className="text-muted-foreground text-sm">
            No team recovery, attrition, rank or transfers this week.
          </p>
        </Card>
      </section>
    );
  return (
    <section aria-label="Upkeep" className="space-y-6">
      <TeamConditions
        teams={sections.teams}
        correctionsHref={correctionsHref}
        edit={edit}
        disabled={disabled}
      />
      <Attrition
        attrition={sections.attrition}
        rank={view.before.rank}
        edit={edit}
        disabled={disabled}
      />
      <Notoriety
        notoriety={sections.notoriety}
        edit={edit}
        disabled={disabled}
      />
      <Shortage shortage={sections.shortage} edit={edit} disabled={disabled} />
      <Rank view={view} rank={sections.rank} edit={edit} disabled={disabled} />
      <Deposits
        transfers={sections.transfers}
        edit={edit}
        disabled={disabled}
      />
      {sections.general.length > 0 && (
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">Also this week</p>
          <IssueNotes issues={sections.general} />
        </div>
      )}
    </section>
  );
}
