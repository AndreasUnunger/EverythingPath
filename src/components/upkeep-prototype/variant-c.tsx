'use client';
// PROTOTYPE — Variant C: sorted by what each item changes. Teams sit in a
// strip on top. Below them, two ledgers side by side: training (attrition,
// maximum notoriety, shortage, then rank and boons) and treasury (recovery,
// Table Adjustments, deposits and withdrawals). Every line shows its running
// value, so you can see where the numbers in the right panel come from.

import type React from 'react';
import { cn } from '~/lib/utils';
import { rank, type RollFact, signed } from './mock';
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

export const name = 'Training and treasury ledgers';

function Ledger({ title, start, end, children }: { title: string; start: string; end: string; children: React.ReactNode }) {
  return (
    <section aria-label={`${title} ledger`} className="bg-card border-foreground/15 flex flex-col border">
      <header className="border-foreground/15 flex items-baseline border-b px-3 py-2">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-muted-foreground ml-auto font-mono text-sm">{start}</span>
      </header>
      <div className="divide-foreground/10 flex-1 divide-y">{children}</div>
      <footer className="border-foreground/15 flex items-baseline border-t px-3 py-2">
        <span className="text-sm">After Upkeep</span>
        <span className="ml-auto font-mono text-lg font-semibold">{end}</span>
      </footer>
    </section>
  );
}

function Line({ label, note, value, children, muted }: { label: string; note?: string; value?: React.ReactNode; children?: React.ReactNode; muted?: boolean }) {
  return (
    <div className={cn('space-y-2 px-3 py-2.5', muted && 'opacity-55')}>
      <div className="flex items-baseline gap-2">
        <span className="text-sm">{label}</span>
        {note && <span className="text-muted-foreground text-xs">{note}</span>}
        <span className="ml-auto font-mono text-sm">{value}</span>
      </div>
      {children}
    </div>
  );
}

function RollInLedger({ fact, ...p }: UpkeepProps & { fact: RollFact }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-muted-foreground w-16 text-xs">{fact.short}</span>
        <DiceFields fact={fact} edit={p.edit} disabled={p.disabled} className="h-10 w-12" />
        {fact.modifiers.length > 0 && <BonusLine modifiers={fact.modifiers} bonus={fact.bonus} total={fact.total} dc={fact.dc} compact />}
      </div>
      <Outcome text={fact.outcome} className="block pl-[4.75rem] text-xs" />
      <IssuesFor view={p.view} subject={fact.id} />
    </div>
  );
}

export function VariantC(p: UpkeepProps) {
  const { view, edit, disabled } = p;
  if (view.skipped) return <SkippedNotice />;
  const roll = (id: RollFact['id']) => view.rolls.find((r) => r.id === id);
  const delta = (label: string) => {
    const v = view.trainingLines.find((l) => l.label === label)?.value;
    return v === null || v === undefined ? '…' : signed(v);
  };
  const recovery = view.treasuryLines.filter((l) => view.teams.some((t) => t.id === l.subject));
  const afterRecovery = view.treasuryStartGp + recovery.reduce((a, b) => a + b.value, 0);

  return (
    <div className="space-y-4">
      {view.teams.length > 0 && (
        <section aria-label="Teams out of action" className="grid grid-cols-2 gap-3">
          {view.teams.map((team) => (
            <div key={team.id} className="bg-card border-foreground/15 space-y-2.5 border p-3">
              <p className="flex items-baseline gap-2">
                <span className="font-semibold">{team.name}</span>
                <span className="text-muted-foreground text-sm">
                  {team.type} · {team.status}
                </span>
              </p>
              <TeamDecision team={team} edit={edit} disabled={disabled} />
              {team.status === 'missing' && <ReturnCheck team={team} edit={edit} disabled={disabled} />}
              {team.status === 'disabled' && team.decision === 'recover' && (
                <p className="text-muted-foreground text-sm">Cost in the treasury ledger →</p>
              )}
              <IssuesFor view={view} subject={team.id} />
              <ExceptionsFor view={view} subject={team.id} edit={edit} disabled={disabled} />
            </div>
          ))}
        </section>
      )}

      <div className="grid grid-cols-2 items-start gap-4">
        <Ledger title="Training" start={`${view.trainingStart}`} end={`${view.trainingAfter ?? '…'}`}>
          <Line label="1 · Attrition" value={delta('Attrition')}>
            {roll('check') && <RollInLedger fact={roll('check')!} {...p} />}
            {roll('training') && <RollInLedger fact={roll('training')!} {...p} />}
          </Line>
          <Line
            label="2 · Maximum notoriety"
            note={view.notoriety < 100 ? `notoriety ${view.notoriety}, not at 100` : undefined}
            value={view.notoriety < 100 ? '—' : delta('Maximum notoriety')}
            muted={view.notoriety < 100}
          >
            {roll('notoriety') && <RollInLedger fact={roll('notoriety')!} {...p} />}
            {roll('notorietyCheck') && <RollInLedger fact={roll('notorietyCheck')!} {...p} />}
            {view.notoriety >= 100 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Nearest settlement{view.settlementRequired ? ' (required)' : ''}</span>
                <SettlementChoice {...p} variant="select" />
              </div>
            )}
          </Line>
          <Line
            label="3 · Treasury shortage"
            note={view.shortage ? `${afterRecovery} gp < ${minimumGp} gp` : `${afterRecovery} gp ≥ ${minimumGp} gp`}
            value={view.shortage ? delta('Treasury shortage') : '—'}
            muted={!view.shortage}
          >
            {roll('loss') && <RollInLedger fact={roll('loss')!} {...p} />}
          </Line>
          <Line
            label="4 · Rank"
            value={view.rankAfter === null ? '…' : view.rankAfter > rank ? `${rank} → ${view.rankAfter}` : `${rank}`}
            muted={view.rankAfter === null}
          >
            {view.rankAfter !== null && view.rankAfter > rank && (
              <>
                <p className="text-muted-foreground text-xs">Captain title: one feat per PC</p>
                {view.boons.map((b) => (
                  <BoonChoice key={b.person.id} boon={b} edit={edit} disabled={disabled} />
                ))}
              </>
            )}
            {view.rankAfter !== null && view.rankAfter === rank && <p className="text-muted-foreground text-xs">Rank 9 needs 105.</p>}
            <IssuesFor view={view} subject="rank" />
          </Line>
        </Ledger>

        <Ledger title="Treasury" start={`${view.treasuryStartGp} gp`} end={`${view.treasuryAfterGp} gp`}>
          {view.teams
            .filter((t) => t.status === 'disabled')
            .map((team) => (
              <Line key={team.id} label={`Recover ${team.name}`} value={team.decision === 'recover' ? signed(-team.ruleCostGp) : '—'} muted={team.decision !== 'recover'}>
                {team.decision === 'recover' ? (
                  <RecoveryCost team={team} edit={edit} disabled={disabled} />
                ) : (
                  <p className="text-muted-foreground text-xs">Only if the team is recovered.</p>
                )}
              </Line>
            ))}
          {view.adjustments.map((a) => (
            <Line key={a.subject} label={`Table Adjustment · ${a.label}`} value={signed(a.value)} note={a.reason ? `“${a.reason}”` : 'reason needed'} />
          ))}
          <Line label="Minimum treasury" value={`${minimumGp}`} note={view.shortage ? 'short after recovery' : 'met'} muted />
          <Line label="5 · Deposits and withdrawals" value={signed(view.treasuryAfterGp - view.treasuryAfterRulesGp - view.adjustments.reduce((a, b) => a + b.value, 0))}>
            <TransferList {...p} />
            <TransferForm edit={edit} disabled={disabled} />
          </Line>
        </Ledger>
      </div>
    </div>
  );
}
