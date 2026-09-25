'use client';
// PROTOTYPE — Variant B: dice first, decisions second. One roll sheet holds
// every die the week needs (including the missing team's return check), so
// the table can roll everything and type it in one pass. Decisions follow as
// cards in a grid. Rules Exceptions are collected in one "Table rulings"
// block at the end instead of under each item.

import { AlertTriangle } from 'lucide-react';
import type React from 'react';
import { cn } from '~/lib/utils';
import { rank, signed } from './mock';
import {
  BonusLine,
  BoonChoice,
  DiceFields,
  DieField,
  IssuesFor,
  minimumGp,
  Outcome,
  ReasonField,
  RecoveryCost,
  SettlementChoice,
  SkippedNotice,
  TeamDecision,
  TransferForm,
  TransferList,
  type UpkeepProps,
} from './parts';

export const name = 'Roll sheet, then decisions';

function Block({ title, aside, children, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn('bg-card border-foreground/15 space-y-3 border p-3', className)}>
      <header className="flex items-baseline gap-2">
        <h3 className="text-muted-foreground text-xs tracking-widest uppercase">{title}</h3>
        {aside && <span className="text-muted-foreground ml-auto text-sm">{aside}</span>}
      </header>
      {children}
    </section>
  );
}

export function VariantB(p: UpkeepProps) {
  const { view, edit, disabled } = p;
  if (view.skipped) return <SkippedNotice />;
  const missing = view.teams.filter((t) => t.status === 'missing' && t.decision !== 'remove');
  const warnIcon = (subject: string) =>
    view.warnings.some((w) => w.subject === subject) && <AlertTriangle aria-label="Has a warning" className="size-4 text-amber-300" />;

  return (
    <div className="space-y-4">
      <Block title="Rolls" aside={`${view.rolls.filter((r) => r.total !== null).length + missing.filter((t) => t.roll !== undefined).length} of ${view.rolls.length + missing.length} entered`}>
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-left text-xs">
            <tr>
              <th className="pb-1 font-normal">Roll</th>
              <th className="pb-1 font-normal">Dice</th>
              <th className="pb-1 font-normal">Bonus · total</th>
              <th className="pb-1 font-normal">Result</th>
            </tr>
          </thead>
          <tbody className="divide-foreground/10 divide-y">
            {view.rolls.map((f) => (
              <tr key={f.id} className="align-middle">
                <td className="py-2 pr-3">
                  <span className="flex items-center gap-1.5">
                    <span className="text-muted-foreground font-mono text-xs">{f.step}</span>
                    {f.label}
                    {warnIcon(f.id)}
                  </span>
                  <span className="text-muted-foreground block pl-4 text-xs">{f.kind}</span>
                  <IssuesFor view={view} subject={f.id} className="pl-4" />
                </td>
                <td className="py-2 pr-3">
                  <DiceFields fact={f} edit={edit} disabled={disabled} />
                </td>
                <td className="py-2 pr-3">{f.modifiers.length ? <BonusLine modifiers={f.modifiers} bonus={f.bonus} total={f.total} dc={f.dc} compact /> : <span className="text-muted-foreground">—</span>}</td>
                <td className="py-2">
                  <Outcome text={f.outcome} />
                </td>
              </tr>
            ))}
            {view.rolls.length === 1 && (
              <tr>
                <td colSpan={4} className="text-muted-foreground py-2 text-sm">
                  Attrition training roll: 1d6 on a success, 2d4 + {rank} on a failure. It appears once the check is in.
                </td>
              </tr>
            )}
            {missing.map((t) => (
              <tr key={t.id}>
                <td className="py-2 pr-3">
                  <span className="flex items-center gap-1.5">
                    <span className="text-muted-foreground font-mono text-xs">0</span>
                    {t.name} return check {warnIcon(t.id)}
                  </span>
                  <span className="text-muted-foreground block pl-4 text-xs">Security DC 15 · natural 1 loses the team</span>
                </td>
                <td className="py-2 pr-3">
                  <DieField label={`${t.name} return die`} value={t.roll} disabled={disabled} onValue={(v) => edit({ kind: 'team', teamId: t.id, roll: v })} />
                </td>
                <td className="py-2 pr-3">
                  <BonusLine modifiers={t.rollModifiers} bonus={t.rollBonus} total={t.rollTotal} dc={15} compact />
                </td>
                <td className="py-2">
                  <Outcome text={t.rollOutcome} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-muted-foreground text-xs">Loyalty bonus: Rank and focus +6 · Officers (Amara, Ambassador) +2. Security: Rank and focus +2 · Officers (Ilse, Marshal) +1.</p>
      </Block>

      <div className="grid grid-cols-2 gap-4">
        {view.teams.map((team) => (
          <Block key={team.id} title={`${team.name} · ${team.status}`} aside={`${team.type} · tier ${team.tier}`}>
            <TeamDecision team={team} edit={edit} disabled={disabled} />
            {team.status === 'disabled' && team.decision === 'recover' && <RecoveryCost team={team} edit={edit} disabled={disabled} />}
            {team.status === 'missing' && team.decision !== 'remove' && (
              <p className="text-muted-foreground text-sm">Return check: {team.rollOutcome ?? 'enter it in the roll sheet'}.</p>
            )}
            <IssuesFor view={view} subject={team.id} />
          </Block>
        ))}
        {view.notoriety >= 100 && (
          <Block title="Nearest settlement" aside={view.settlementRequired ? 'required' : 'if the notoriety check fails'}>
            <SettlementChoice {...p} />
          </Block>
        )}
        <Block
          title="Rank"
          className={cn(view.teams.length % 2 === 0 && view.notoriety < 100 && 'col-span-2')}
          aside={view.rankAfter === null ? 'after the rolls' : view.rankAfter > rank ? `${rank} → ${view.rankAfter}` : `stays ${rank}`}
        >
          {view.rankAfter === null ? (
            <p className="text-muted-foreground text-sm">Worked out once every roll and team decision is in.</p>
          ) : view.rankAfter > rank ? (
            <>
              <p className="text-sm">Captain title for each PC: choose a feat.</p>
              {view.boons.map((b) => (
                <BoonChoice key={b.person.id} boon={b} edit={edit} disabled={disabled} />
              ))}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">Training {view.trainingAfter}; rank 9 needs 105.</p>
          )}
        </Block>
      </div>

      <Block title="Treasury" aside={`minimum ${minimumGp} gp`}>
        <ol className="flex flex-wrap items-center gap-2 font-mono text-sm">
          <li className="bg-foreground/10 rounded px-2 py-1">Start {view.treasuryStartGp}</li>
          {[...view.treasuryLines, ...view.adjustments.map((a) => ({ label: `Adjustment · ${a.label}`, value: a.value, subject: a.subject }))].map((l) => (
            <li key={l.label} className="flex items-center gap-2">
              <span className="text-muted-foreground">→</span>
              <span className="rounded px-2 py-1" title={l.label}>
                {signed(l.value)} <span className="text-muted-foreground font-sans text-xs">{l.label}</span>
              </span>
            </li>
          ))}
          <li className="flex items-center gap-2">
            <span className="text-muted-foreground">=</span>
            <span className="bg-primary/20 rounded px-2 py-1 font-semibold">{view.treasuryAfterGp} gp</span>
          </li>
        </ol>
        {view.shortage && <p className="text-sm text-amber-200">Below the minimum after recovery: the shortage roll is in the roll sheet.</p>}
        <TransferList {...p} inlineExceptions={false} />
        <TransferForm edit={edit} disabled={disabled} />
      </Block>

      {view.exceptions.length > 0 && (
        <Block title="Table rulings" aside={`${view.exceptions.filter((e) => !e.reason).length} need a reason`} className="border-amber-500/50">
          {view.exceptions.map((e) => (
            <div key={e.key} className="space-y-1">
              <p className="text-sm">
                <strong className="capitalize">{e.title}</strong> <span className="text-muted-foreground">· {e.text}</span>
              </p>
              <ReasonField
                label="Reason"
                value={e.reason}
                disabled={disabled}
                onSave={(reason) => edit({ kind: 'exception', key: e.key, reason })}
                onClear={() => edit({ kind: 'exception', key: e.key, reason: null })}
              />
            </div>
          ))}
        </Block>
      )}
    </div>
  );
}
