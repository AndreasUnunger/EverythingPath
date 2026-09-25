'use client';
// PROTOTYPE — Variant D: one item at a time. A queue on the left lists every
// Upkeep item in rules order with its state. The focus card on the right
// shows one item large. Dice use a tap number pad instead of the keyboard,
// and entering the last die moves to the next open item. Transfers are an
// optional item at the end of the queue.

import { Check, ChevronRight, CircleDot, Delete, Minus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { rank, type RollFact, signed } from './mock';
import {
  BonusLine,
  BoonChoice,
  ExceptionsFor,
  IssuesFor,
  minimumGp,
  Outcome,
  RecoveryCost,
  SettlementChoice,
  SkippedNotice,
  TeamDecision,
  TransferForm,
  TransferList,
  type UpkeepProps,
} from './parts';

export const name = 'One at a time, number pad';

type Item = { key: string; title: string; note: string; done: boolean; na?: boolean };

function NumberPad({ sides, onPick, onClear }: { sides: number; onPick: (n: number) => void; onClear: () => void }) {
  return (
    <div className={cn('grid gap-1.5', sides > 6 ? 'grid-cols-10' : 'grid-cols-6')}>
      {Array.from({ length: sides }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onPick(n)}
          className={cn(
            'bg-background border-foreground/20 active:bg-primary active:text-primary-foreground h-12 touch-manipulation rounded-md border font-mono text-lg',
            (n === 1 || n === sides) && 'border-primary/50',
          )}
        >
          {n}
        </button>
      ))}
      <button type="button" onClick={onClear} aria-label="Clear dice" className="border-foreground/20 text-muted-foreground flex h-12 items-center justify-center rounded-md border">
        <Delete className="size-5" />
      </button>
    </div>
  );
}

function DiceFocus({ dice, sides, label, onDice }: { dice: (number | null)[]; sides: number; label: string; onDice: (dice: (number | null)[]) => void }) {
  const next = dice.findIndex((x) => x === null);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {dice.map((v, i) => (
          <span
            key={['first-die', 'second-die'][i]}
            aria-label={`${label} die ${i + 1}`}
            className={cn(
              'flex h-14 w-16 items-center justify-center rounded-md border-2 font-mono text-2xl',
              i === next ? 'border-primary' : 'border-foreground/20',
            )}
          >
            {v ?? '—'}
          </span>
        ))}
        <span className="text-muted-foreground ml-1 font-mono text-sm">
          {dice.length}d{sides}
        </span>
      </div>
      <NumberPad
        sides={sides}
        onClear={() => onDice(dice.map(() => null))}
        onPick={(n) => {
          const i = next === -1 ? 0 : next;
          const out = next === -1 ? dice.map(() => null) : [...dice];
          out[i] = n;
          onDice(out);
        }}
      />
    </div>
  );
}

export function VariantD(p: UpkeepProps) {
  const { view, state, edit, disabled } = p;
  const items: Item[] = [];
  for (const t of view.teams) {
    const open = view.requirements.some((r) => r.subject === t.id);
    items.push({
      key: `team:${t.id}`,
      title: `${t.name} · ${t.status}`,
      note: t.status === 'missing' ? (t.rollOutcome ?? 'Return check') : t.decision === 'recover' ? `Recover ${signed(-t.costGp)} gp` : t.decision === 'leave' ? 'Leave disabled' : 'Recover, leave or remove',
      done: !open,
    });
  }
  for (const r of view.rolls)
    items.push({ key: `roll:${r.id}`, title: r.label, note: r.outcome ?? r.kind, done: r.total !== null });
  if (view.rolls.length === 1)
    items.push({ key: 'roll:pending', title: 'Attrition training roll', note: 'After the Loyalty check', done: false, na: true });
  if (view.notoriety >= 100)
    items.push({
      key: 'settlement',
      title: 'Nearest settlement',
      note: view.settlementRequired ? 'Required' : 'Only if the notoriety check fails',
      done: !view.requirements.some((r) => r.subject === 'settlement'),
    });
  items.push({
    key: 'rank',
    title: 'Rank',
    note: view.rankAfter === null ? 'After the items above' : view.rankAfter > rank ? `${rank} → ${view.rankAfter} · Captain feats` : `Stays ${rank}`,
    done: view.rankAfter !== null && view.boons.every((b) => b.outcome),
    na: view.rankAfter === null,
  });
  items.push({
    key: 'transfers',
    title: 'Deposits and withdrawals',
    note: state.transfers.length ? `${state.transfers.length} staged · optional` : 'Optional',
    done: !view.requirements.some((r) => state.transfers.some((t) => t.id === r.subject)),
  });

  const firstOpen = items.find((i) => !i.done && !i.na)?.key ?? 'transfers';
  const [picked, setPicked] = useState<string | null>(null);
  const focusKey = items.some((i) => i.key === picked) ? picked! : firstOpen;
  const focus = items.find((i) => i.key === focusKey)!;
  const goNext = () => {
    const after = items.slice(items.indexOf(focus) + 1).find((i) => !i.done && !i.na) ?? items.find((i) => !i.done && !i.na);
    setPicked(after?.key ?? 'transfers');
  };

  if (view.skipped) return <SkippedNotice />;

  const rollFact = focusKey.startsWith('roll:') ? view.rolls.find((r) => `roll:${r.id}` === focusKey) : undefined;
  const team = focusKey.startsWith('team:') ? view.teams.find((t) => `team:${t.id}` === focusKey) : undefined;

  return (
    <div className="grid grid-cols-[17rem_1fr] items-start gap-4">
      <ol aria-label="Upkeep items" className="bg-card border-foreground/15 divide-foreground/10 divide-y border">
        {items.map((i) => (
          <li key={i.key}>
            <button
              type="button"
              disabled={i.na}
              onClick={() => setPicked(i.key)}
              className={cn('flex w-full items-start gap-2 px-3 py-2.5 text-left', i.key === focusKey && 'bg-primary/15', i.na && 'opacity-50')}
            >
              <span className="mt-0.5">
                {i.na ? <Minus className="size-4" /> : i.done ? <Check className="size-4 text-emerald-300" /> : <CircleDot className="text-primary size-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{i.title}</span>
                <span className="text-muted-foreground block truncate text-xs">{i.note}</span>
              </span>
              {view.warnings.some((w) => i.key.endsWith(w.subject)) && <span className="text-xs text-amber-300">!</span>}
            </button>
          </li>
        ))}
      </ol>

      <section aria-label={focus.title} className="bg-card border-foreground/15 space-y-4 border p-5">
        <header className="flex items-baseline gap-3">
          <h3 className="text-xl font-semibold">{focus.title}</h3>
          {rollFact && <span className="text-muted-foreground">{rollFact.kind}</span>}
          {team && <span className="text-muted-foreground">{team.type} · tier {team.tier}</span>}
        </header>

        {rollFact && (
          <RollFocus
            fact={rollFact}
            onDice={(dice) => {
              edit({ kind: 'roll', id: rollFact.id, dice });
              if (dice.every((x) => x !== null)) setPicked(null);
            }}
          />
        )}
        {rollFact && <IssuesFor view={view} subject={rollFact.id} />}

        {team && (
          <div className="space-y-4">
            <TeamDecision team={team} edit={edit} disabled={disabled} />
            {team.status === 'disabled' && team.decision === 'recover' && <RecoveryCost team={team} edit={edit} disabled={disabled} />}
            {team.status === 'missing' && (
              <div className="space-y-2">
                <p className="text-sm">
                  Return check · Security DC 15 <BonusLine modifiers={team.rollModifiers} bonus={team.rollBonus} total={team.rollTotal} dc={null} /> <Outcome text={team.rollOutcome} />
                </p>
                <DiceFocus
                  dice={[team.roll ?? null]}
                  sides={20}
                  label={`${team.name} return`}
                  onDice={([v]) => edit({ kind: 'team', teamId: team.id, roll: v ?? null })}
                />
              </div>
            )}
            <IssuesFor view={view} subject={team.id} />
            <ExceptionsFor view={view} subject={team.id} edit={edit} disabled={disabled} />
          </div>
        )}

        {focusKey === 'settlement' && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              {view.settlementRequired ? 'The notoriety check failed: this settlement’s reputation drops one step.' : 'Needed only if the notoriety Loyalty check fails.'}
            </p>
            <SettlementChoice {...p} />
          </div>
        )}

        {focusKey === 'rank' && (
          <div className="space-y-3">
            {view.rankAfter !== null && view.rankAfter > rank ? (
              <>
                <p>
                  Training {view.trainingAfter} reaches rank {view.rankAfter}. Each PC gains the <strong>Captain</strong> title: choose a feat.
                </p>
                {view.boons.map((b) => (
                  <BoonChoice key={b.person.id} boon={b} edit={edit} disabled={disabled} />
                ))}
              </>
            ) : (
              <p>Training {view.trainingAfter}: rank stays {rank}. Rank 9 needs 105.</p>
            )}
          </div>
        )}

        {focusKey === 'transfers' && (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Treasury after the rules: {view.treasuryAfterRulesGp} gp (minimum {minimumGp} gp). After transfers: {view.treasuryAfterGp} gp.
            </p>
            <TransferList {...p} />
            <TransferForm edit={edit} disabled={disabled} />
          </div>
        )}

        <footer className="flex justify-end pt-2">
          <Button variant="outline" onClick={goNext}>
            Next open item <ChevronRight />
          </Button>
        </footer>
      </section>
    </div>
  );
}

function RollFocus({ fact, onDice }: { fact: RollFact; onDice: (dice: (number | null)[]) => void }) {
  return (
    <div className="space-y-3">
      <DiceFocus dice={fact.dice} sides={fact.sides} label={fact.label} onDice={onDice} />
      <p className="flex flex-wrap items-baseline gap-3">
        {fact.modifiers.length > 0 && <BonusLine modifiers={fact.modifiers} bonus={fact.bonus} total={fact.total} dc={fact.dc} />}
        <Outcome text={fact.outcome} className="text-base" />
      </p>
    </div>
  );
}
