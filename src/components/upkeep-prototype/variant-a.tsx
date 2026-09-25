'use client';
// PROTOTYPE — Variant A: the rules order. One numbered section per Upkeep
// step, from team conditions at the start of Upkeep to deposits and
// withdrawals. Each section header shows what it changes. Steps that don't
// apply this week shrink to one muted line that says why. Each item's
// warnings and Rules Exception sit right under it.

import { Check, Minus } from 'lucide-react';
import type React from 'react';
import { cn } from '~/lib/utils';
import { rank, signed } from './mock';
import {
  BonusLine,
  BoonChoice,
  DiceFields,
  ExceptionsFor,
  IssuesFor,
  minimumGp,
  Outcome,
  RecoveryCost,
  ReturnCheck,
  SettlementChoice,
  SkippedNotice,
  TeamDecision,
  TransferForm,
  TransferList,
  type UpkeepProps,
} from './parts';

export const name = 'Rules order';

function Step({
  n,
  title,
  effect,
  open,
  skipped,
  children,
}: {
  n: number;
  title: string;
  effect?: React.ReactNode;
  open: number;
  skipped?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section aria-label={title} className={cn('border-foreground/15 border-l-2 pb-1 pl-4', skipped && 'opacity-60')}>
      <header className="-ml-[1.6rem] flex items-center gap-3">
        <span
          className={cn(
            'bg-background flex size-7 items-center justify-center rounded-full border font-mono text-sm',
            skipped ? 'border-foreground/30' : open ? 'border-primary text-primary' : 'border-emerald-400 text-emerald-300',
          )}
        >
          {skipped ? <Minus className="size-3.5" /> : open ? n : <Check className="size-4" />}
        </span>
        <h3 className="font-semibold">{title}</h3>
        {skipped ? (
          <span className="text-muted-foreground text-sm">{skipped}</span>
        ) : (
          <span className="text-muted-foreground ml-auto text-sm">{effect}</span>
        )}
      </header>
      {!skipped && <div className="mt-2 space-y-3 pb-4">{children}</div>}
    </section>
  );
}

function RollRow({ fact, ...p }: UpkeepProps & { fact: UpkeepProps['view']['rolls'][number] }) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="w-52 text-sm">
          {fact.label}
          <span className="text-muted-foreground block text-xs">{fact.kind}</span>
        </span>
        <DiceFields fact={fact} edit={p.edit} disabled={p.disabled} />
        <BonusLine modifiers={fact.modifiers} bonus={fact.bonus} total={fact.modifiers.length ? fact.total : null} dc={null} />
        <Outcome text={fact.outcome} className="ml-auto" />
      </div>
      <IssuesFor view={p.view} subject={fact.id} />
    </div>
  );
}

export function VariantA(p: UpkeepProps) {
  const { view, state } = p;
  if (view.skipped) return <SkippedNotice />;
  const openFor = (subjects: string[]) => view.requirements.filter((r) => subjects.includes(r.subject)).length;
  const rolls = (step: number) => view.rolls.filter((r) => r.step === step);
  const recovery = view.treasuryLines.filter((l) => view.teams.some((t) => t.id === l.subject));
  const trainingDelta = (label: string) => view.trainingLines.find((l) => l.label === label)?.value;
  const effectText = (v: number | null | undefined, unit = '') => (v === null || v === undefined ? 'waiting for dice' : `Training ${signed(v)}${unit}`);
  const treasuryAfterRecovery = view.treasuryStartGp + recovery.reduce((a, b) => a + b.value, 0);

  return (
    <div className="space-y-2 pl-4">
      <Step
        n={0}
        title="Team conditions"
        open={openFor(view.teams.map((t) => t.id))}
        skipped={view.teams.length === 0 ? 'No disabled or missing teams' : undefined}
        effect={recovery.length ? `Treasury ${signed(recovery.reduce((a, b) => a + b.value, 0))} gp` : 'No cost'}
      >
        {view.teams.map((team) => (
          <div key={team.id} className="bg-card border-foreground/15 space-y-3 border p-3">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold">{team.name}</span>
              <span className="text-muted-foreground text-sm">
                {team.type} · tier {team.tier}
              </span>
              <span className={cn('ml-auto rounded px-1.5 text-xs uppercase', team.status === 'missing' ? 'bg-sky-500/20' : 'bg-amber-500/20')}>
                {team.status}
              </span>
            </div>
            <TeamDecision team={team} edit={p.edit} disabled={p.disabled} />
            {team.status === 'disabled' && team.decision === 'recover' && <RecoveryCost team={team} edit={p.edit} disabled={p.disabled} />}
            {team.status === 'missing' && team.decision !== 'remove' && <ReturnCheck team={team} edit={p.edit} disabled={p.disabled} />}
            <IssuesFor view={view} subject={team.id} />
            <ExceptionsFor view={view} subject={team.id} edit={p.edit} disabled={p.disabled} />
          </div>
        ))}
      </Step>

      <Step n={1} title="Training attrition" open={openFor(['check', 'training'])} effect={effectText(trainingDelta('Attrition'))}>
        {rolls(1).map((f) => (
          <RollRow key={f.id} fact={f} {...p} />
        ))}
        {rolls(1).length === 1 && <p className="text-muted-foreground text-sm">The training roll appears once the check is in: 1d6 on a success, 2d4 + {rank} on a failure.</p>}
      </Step>

      <Step
        n={2}
        title="Maximum notoriety"
        open={openFor(['notoriety', 'notorietyCheck', 'settlement'])}
        skipped={view.notoriety < 100 ? `Not this week · notoriety is ${view.notoriety} of 100` : undefined}
        effect={effectText(trainingDelta('Maximum notoriety'))}
      >
        {rolls(2).map((f) => (
          <RollRow key={f.id} fact={f} {...p} />
        ))}
        <div className="space-y-1.5">
          <p className="text-sm">
            Nearest settlement
            <span className="text-muted-foreground">
              {view.settlementRequired ? ' · required: its reputation drops one step' : ' · needed only if the Loyalty check fails'}
            </span>
          </p>
          <SettlementChoice {...p} />
        </div>
      </Step>

      <Step
        n={3}
        title="Treasury shortage"
        open={openFor(['loss'])}
        skipped={!view.shortage ? `Not this week · ${treasuryAfterRecovery} gp after recovery, minimum ${minimumGp} gp` : undefined}
        effect={effectText(trainingDelta('Treasury shortage'))}
      >
        <p className="text-muted-foreground text-sm">
          The treasury is {treasuryAfterRecovery} gp after recovery, below the {minimumGp} gp minimum.
        </p>
        {rolls(3).map((f) => (
          <RollRow key={f.id} fact={f} {...p} />
        ))}
      </Step>

      <Step
        n={4}
        title="Rank"
        open={view.rankAfter === null ? 1 : openFor(view.boons.map((b) => `boon:${b.person.id}`))}
        effect={
          view.rankAfter === null
            ? 'waiting for the steps above'
            : view.rankAfter > rank
              ? `Rank ${rank} → ${view.rankAfter}`
              : `Stays rank ${rank}`
        }
      >
        {view.rankAfter === null ? (
          <p className="text-muted-foreground text-sm">Rank is worked out once every roll and decision above is in.</p>
        ) : view.rankAfter > rank ? (
          <>
            <p className="text-sm">
              Training {view.trainingAfter} reaches rank {view.rankAfter}. Each PC gains the <strong>Captain</strong> title: choose one feat.
            </p>
            {view.boons.map((b) => (
              <BoonChoice key={b.person.id} boon={b} edit={p.edit} disabled={p.disabled} />
            ))}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">Training {view.trainingAfter} is short of the 105 that rank 9 needs.</p>
        )}
        <IssuesFor view={view} subject="rank" />
      </Step>

      <Step
        n={5}
        title="Deposits and withdrawals"
        open={openFor(state.transfers.map((t) => t.id))}
        effect={`Treasury ${view.treasuryAfterRulesGp} → ${view.treasuryAfterGp} gp`}
      >
        <TransferList {...p} />
        <TransferForm edit={p.edit} disabled={p.disabled} />
        {view.adjustments.length > 0 && (
          <p className="text-muted-foreground text-sm">
            Includes Table Adjustments: {view.adjustments.map((a) => `${a.label} ${signed(a.value)} gp`).join(', ')}.
          </p>
        )}
      </Step>
    </div>
  );
}
