'use client';
// PROTOTYPE (throwaway, #208) — Variant A shared pieces: the step rail, the
// sticky live sheet with tap-for-breakdown numbers, warning lines and small
// inputs. Variant-local; the foundation is untouched.

import {
  ChevronLeft,
  ChevronRight,
  Info,
  Minus,
  Plus,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { cn } from '~/lib/utils';
import { ABILITY_SHORT, SKILL_BY_KEY } from '../catalog';
import { useBuilderStore, useCharacter, useResolved } from '../store';
import {
  ABILITIES,
  type AbilityKey,
  type ResolvedSheet,
  type SkillKey,
  type Stat,
} from '../types';
import {
  BONUS_TYPE_CLASS,
  BONUS_TYPE_LABEL,
  SEVERITY_CLASS,
  formatBonus,
  isBuffed,
} from '../ui-helpers';
import type { Warning } from '../warnings';

export const chip =
  'border-foreground/40 inline-flex items-center border px-1.5 py-0.5 font-mono text-xs leading-tight';

export const tableHead =
  'text-muted-foreground px-2 py-2 text-left font-mono text-xs font-normal tracking-wide uppercase';

// ------------------------------------------------------------------ steps

export type StepDef<K extends string> = {
  key: K;
  label: string;
  short: string;
};

/**
 * The step rail: vertical from `lg`, a horizontally scrollable row below.
 * Every step is always reachable; warnings per step show as a count.
 */
export function StepRail<K extends string>({
  steps,
  current,
  onSelect,
  counts,
}: {
  steps: readonly StepDef<K>[];
  current: K;
  onSelect: (key: K) => void;
  counts: Partial<Record<K, { warning: number; prompt: number; info: number }>>;
}) {
  return (
    <nav
      aria-label="Steps"
      className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:-mx-6 md:px-6 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
    >
      {steps.map((step, i) => {
        const count = counts[step.key];
        const active = step.key === current;
        return (
          <button
            key={step.key}
            type="button"
            onClick={() => onSelect(step.key)}
            aria-current={active ? 'step' : undefined}
            className={cn(
              'flex min-h-11 shrink-0 items-center gap-2 border px-3 text-left text-sm whitespace-nowrap md:min-h-9 lg:min-h-10 lg:w-full',
              active
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-foreground/20 text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'font-mono text-xs',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {i + 1}
            </span>
            <span className="lg:hidden">{step.short}</span>
            <span className="hidden lg:inline">{step.label}</span>
            {count && (count.warning > 0 || count.prompt > 0) && (
              <span
                className={cn(
                  'ml-auto font-mono text-xs',
                  count.warning > 0 ? 'text-amber-300' : 'text-sky-300',
                )}
                aria-label={`${count.warning + count.prompt} notes`}
              >
                {count.warning > 0 ? (
                  <TriangleAlert className="inline size-3.5" />
                ) : (
                  '●'
                )}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

export function StepFooter({
  onPrev,
  onNext,
  prevLabel = 'Back',
  nextLabel = 'Next',
  children,
}: {
  onPrev?: () => void;
  onNext?: () => void;
  prevLabel?: string;
  nextLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="border-foreground/10 bg-background z-20 flex flex-wrap items-center gap-2 border-t py-3 md:sticky md:bottom-14">
      {onPrev ? (
        <Button variant="outline" onClick={onPrev} className="min-h-11 md:min-h-9">
          <ChevronLeft aria-hidden /> {prevLabel}
        </Button>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        {children}
        {onNext ? (
          <Button onClick={onNext} className="min-h-11 md:min-h-9">
            {nextLabel} <ChevronRight aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function StepHeading({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="font-sans text-2xl">{title}</h2>
        {lede && <p className="text-muted-foreground text-sm">{lede}</p>}
      </div>
      {children}
    </div>
  );
}

// --------------------------------------------------------------- warnings

export function WarningLine({
  warning,
  onAction,
  onGo,
  goLabel,
}: {
  warning: Warning;
  onAction?: (w: Warning) => void;
  onGo?: () => void;
  goLabel?: string;
}) {
  const Icon = warning.severity === 'warning' ? TriangleAlert : Info;
  return (
    <div
      className={cn(
        'flex flex-wrap items-start gap-1.5 text-sm',
        SEVERITY_CLASS[warning.severity],
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 flex-1">{warning.message}</span>
      {warning.action && onAction && (
        <Button
          size="sm"
          variant="outline"
          className="border-sky-500/60 min-h-9 text-sky-300"
          onClick={() => onAction(warning)}
        >
          {warning.action.label}
        </Button>
      )}
      {onGo && (
        <Button size="sm" variant="link" className="h-auto p-0" onClick={onGo}>
          {goLabel ?? 'Open'}
        </Button>
      )}
    </div>
  );
}

export function WarningList({
  warnings,
  onAction,
  empty,
}: {
  warnings: Warning[];
  onAction?: (w: Warning) => void;
  empty?: ReactNode;
}) {
  if (warnings.length === 0)
    return empty ? (
      <p className="text-muted-foreground text-sm">{empty}</p>
    ) : null;
  return (
    <div className="space-y-1">
      {warnings.map((w) => (
        <WarningLine key={w.id} warning={w} onAction={onAction} />
      ))}
    </div>
  );
}

/** Applies a warning's one-click `addEntry` action. */
export function useApplyWarning(characterId: string) {
  const store = useBuilderStore();
  return (w: Warning) => {
    if (w.action?.kind === 'addEntry')
      store.addEntry(characterId, w.action.catalogKey, {
        gainedAtClassLevel: w.action.gainedAtClassLevel,
      });
  };
}

// ----------------------------------------------------------------- inputs

/** A touch-friendly number: −, typed value, +. Any value is accepted. */
export function NumberStepper({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  label,
  placeholder,
  className,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  label: string;
  placeholder?: string;
  className?: string;
}) {
  const current = value ?? 0;
  return (
    <div className={cn('inline-flex items-stretch', className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`${label}: less`}
        className="min-h-11 rounded-none md:min-h-9"
        onClick={() => onChange(Math.max(min, current - 1))}
      >
        <Minus aria-hidden />
      </Button>
      <Input
        aria-label={label}
        type="number"
        inputMode="numeric"
        placeholder={placeholder}
        value={value ?? ''}
        onChange={(e) =>
          onChange(e.target.value === '' ? null : Number(e.target.value))
        }
        className="min-h-11 w-14 rounded-none border-x-0 text-center font-mono text-base md:min-h-9"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`${label}: more`}
        className="min-h-11 rounded-none md:min-h-9"
        onClick={() => onChange(Math.min(max, current + 1))}
      >
        <Plus aria-hidden />
      </Button>
    </div>
  );
}

/** A row of exclusive choices rendered as buttons (never disabled). */
export function ChoiceRow<V extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: V; label: ReactNode; hint?: ReactNode }[];
  value: V | null;
  onChange: (v: V) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => (
        <Button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          variant={o.value === value ? 'default' : 'outline'}
          className="min-h-11 md:min-h-9"
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.hint && (
            <span className="font-mono text-xs opacity-80">{o.hint}</span>
          )}
        </Button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------- statistics

export type StatKey =
  | `ability.${AbilityKey}`
  | `skill.${SkillKey}`
  | 'hp'
  | 'ac'
  | 'touchAc'
  | 'flatFootedAc'
  | 'fort'
  | 'ref'
  | 'will'
  | 'bab'
  | 'cmb'
  | 'cmd'
  | 'flatFootedCmd'
  | 'init'
  | 'attackMelee'
  | 'attackRanged';

export function statOf(sheet: ResolvedSheet, key: StatKey): Stat {
  if (key.startsWith('ability.'))
    return sheet.abilities[key.slice(8) as AbilityKey];
  if (key.startsWith('skill.')) return sheet.skills[key.slice(6) as SkillKey];
  if (key === 'fort' || key === 'ref' || key === 'will')
    return sheet.saves[key];
  return sheet[key as Exclude<StatKey, `ability.${string}` | `skill.${string}` | 'fort' | 'ref' | 'will'>];
}

export function statLabel(key: StatKey): string {
  if (key.startsWith('ability.'))
    return ABILITY_SHORT[key.slice(8) as AbilityKey];
  if (key.startsWith('skill.')) return SKILL_BY_KEY[key.slice(6) as SkillKey].name;
  const labels: Record<string, string> = {
    hp: 'Hit points',
    ac: 'Armor Class',
    touchAc: 'Touch AC',
    flatFootedAc: 'Flat-footed AC',
    fort: 'Fortitude',
    ref: 'Reflex',
    will: 'Will',
    bab: 'Base attack bonus',
    cmb: 'CMB',
    cmd: 'CMD',
    flatFootedCmd: 'Flat-footed CMD',
    init: 'Initiative',
    attackMelee: 'Melee attack',
    attackRanged: 'Ranged attack',
  };
  return labels[key] ?? key;
}

const isSigned = (key: StatKey) =>
  !(
    key.startsWith('ability.') ||
    key === 'hp' ||
    key === 'ac' ||
    key === 'touchAc' ||
    key === 'flatFootedAc' ||
    key === 'cmd' ||
    key === 'flatFootedCmd'
  );

export function formatStat(key: StatKey, value: number) {
  return isSigned(key) ? formatBonus(value) : String(value);
}

/** A tappable number. Buffed (temporary contribution) numbers are marked. */
export function StatButton({
  label,
  value,
  stat,
  active,
  onClick,
  size = 'md',
  className,
}: {
  label: ReactNode;
  value: string;
  stat?: Stat;
  active?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const buffed = stat ? isBuffed(stat) : false;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex min-h-11 flex-col items-center justify-center border px-1 py-1 text-center md:min-h-9',
        active
          ? 'border-primary bg-primary/10'
          : 'border-foreground/20 hover:bg-foreground/5',
        className,
      )}
    >
      <span className="text-muted-foreground font-mono text-[11px] tracking-wide uppercase">
        {label}
      </span>
      <span
        className={cn(
          'font-mono leading-none',
          size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg' : 'text-2xl',
          buffed && 'text-rose-300',
        )}
      >
        {value}
      </span>
    </button>
  );
}

/** Applied and suppressed contributions of one statistic. */
export function Breakdown({
  stat,
  title,
  total,
  onClose,
}: {
  stat: Stat;
  title: string;
  total: string;
  onClose?: () => void;
}) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-sans">{title}</span>
        <span className="font-mono text-lg">{total}</span>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-8"
            aria-label="Close breakdown"
            onClick={onClose}
          >
            <X aria-hidden />
          </Button>
        )}
      </div>
      <ul className="space-y-0.5">
        {stat.applied.map((c) => (
          <li
            key={`${c.label}|${c.target}|${c.bonusType}|${c.value}`}
            className="flex items-baseline gap-2"
          >
            <span className="min-w-0 flex-1 truncate">
              {c.label}
              {c.temporary && (
                <span className="text-muted-foreground"> · temporary</span>
              )}
            </span>
            <span className="font-mono">{formatBonus(c.value)}</span>
            {c.bonusType !== 'untyped' && c.bonusType !== 'base' && (
              <span
                className={cn(
                  'font-mono text-xs',
                  BONUS_TYPE_CLASS[c.bonusType],
                )}
              >
                {BONUS_TYPE_LABEL[c.bonusType]}
              </span>
            )}
          </li>
        ))}
        {stat.applied.length === 0 && (
          <li className="text-muted-foreground">Nothing contributes.</li>
        )}
      </ul>
      {stat.suppressed.length > 0 && (
        <div>
          <div className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            Not applied
          </div>
          <ul className="space-y-0.5">
            {stat.suppressed.map((s) => (
              <li
                key={`${s.contribution.label}|${s.contribution.target}|${s.by}|${s.reason}`}
                className="text-muted-foreground flex flex-wrap items-baseline gap-x-2"
              >
                <span className="line-through">{s.contribution.label}</span>
                <span className="font-mono line-through">
                  {formatBonus(s.contribution.value)}
                </span>
                <span className="text-xs">
                  {suppressionText(s.reason, s.by)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function suppressionText(
  reason: 'sameSource' | 'bonusType' | 'sameEntry' | 'excluded',
  by: string,
) {
  switch (reason) {
    case 'bonusType':
      return `same bonus type as ${by}; only the highest counts`;
    case 'sameSource':
      return `same source as ${by}`;
    case 'sameEntry':
      return `another modifier of ${by} applies`;
    case 'excluded':
      return `left out of ${by}`;
  }
}

/** A breakdown in a dialog, for numbers outside the live sheet. */
export function BreakdownDialog({
  sheet,
  statKey,
  onClose,
}: {
  sheet: ResolvedSheet | null;
  statKey: StatKey | null;
  onClose: () => void;
}) {
  const stat = sheet && statKey ? statOf(sheet, statKey) : null;
  return (
    <Dialog open={!!stat} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-sans">
            {statKey ? statLabel(statKey) : ''}
          </DialogTitle>
          <DialogDescription>Where this number comes from.</DialogDescription>
        </DialogHeader>
        {stat && statKey && (
          <Breakdown
            stat={stat}
            title=""
            total={formatStat(statKey, stat.total)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------- live sheet

/** The compact live sheet: abilities, HP, AC, saves, attack, init. Tapping a number opens its breakdown inline. */
export function LiveSheet({
  characterId,
  dense,
}: {
  characterId: string;
  dense?: boolean;
}) {
  const character = useCharacter(characterId);
  const sheet = useResolved(characterId);
  const [selected, setSelected] = useState<StatKey | null>(null);
  if (!character || !sheet) return null;
  const pick = (key: StatKey) => setSelected(selected === key ? null : key);
  const stat = selected ? statOf(sheet, selected) : null;
  const row = (items: StatKey[]) => (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((key) => (
        <StatButton
          key={key}
          label={shortLabel(key)}
          value={formatStat(key, statOf(sheet, key).total)}
          stat={statOf(sheet, key)}
          active={selected === key}
          onClick={() => pick(key)}
          size="sm"
        />
      ))}
    </div>
  );
  return (
    <div className={cn('space-y-2', dense && 'text-sm')}>
      <div className="text-muted-foreground text-xs">
        {sheet.classes.map((c) => `${c.name} ${c.levels}`).join(' / ') ||
          'No levels'}{' '}
        · level {sheet.level}
      </div>
      <div className="grid grid-cols-6 gap-1 lg:grid-cols-3">
        {ABILITIES.map((a) => (
          <StatButton
            key={a}
            label={ABILITY_SHORT[a]}
            value={String(sheet.abilities[a].total)}
            stat={sheet.abilities[a]}
            active={selected === `ability.${a}`}
            onClick={() => pick(`ability.${a}`)}
            size="sm"
            className="relative"
          />
        ))}
      </div>
      <div className="grid grid-cols-6 gap-1 lg:grid-cols-3">
        {ABILITIES.map((a) => (
          <span
            key={a}
            className="text-muted-foreground text-center font-mono text-xs"
          >
            {formatBonus(sheet.abilityMods[a].total)}
          </span>
        ))}
      </div>
      {row(['hp', 'init', 'bab'])}
      {row(['ac', 'touchAc', 'flatFootedAc'])}
      {row(['fort', 'ref', 'will'])}
      {row(['cmb', 'cmd', 'flatFootedCmd'])}
      {stat && selected && (
        <div className="border-foreground/20 bg-card border p-2">
          <Breakdown
            stat={stat}
            title={statLabel(selected)}
            total={formatStat(selected, stat.total)}
            onClose={() => setSelected(null)}
          />
        </div>
      )}
      {!stat && (
        <p className="text-muted-foreground text-xs">
          Tap a number for its breakdown.
        </p>
      )}
    </div>
  );
}

function shortLabel(key: StatKey) {
  const labels: Record<string, string> = {
    hp: 'HP',
    ac: 'AC',
    touchAc: 'Touch',
    flatFootedAc: 'Flat',
    fort: 'Fort',
    ref: 'Ref',
    will: 'Will',
    bab: 'BAB',
    cmb: 'CMB',
    cmd: 'CMD',
    flatFootedCmd: 'FF CMD',
    init: 'Init',
  };
  return labels[key] ?? statLabel(key);
}

/** The live sheet beside the steps, from `lg`. */
export function LiveSheetPanel({ characterId }: { characterId: string }) {
  return (
    <aside className="hidden lg:block">
      <div className="border-foreground/20 bg-card sticky top-4 border p-3">
        <div className="text-muted-foreground mb-2 font-mono text-xs tracking-wide uppercase">
          Live sheet
        </div>
        <LiveSheet characterId={characterId} dense />
      </div>
    </aside>
  );
}

/** Below `lg`: a sticky strip with the headline numbers that opens the full live sheet as a bottom sheet. */
export function LiveSheetStrip({ characterId }: { characterId: string }) {
  const sheet = useResolved(characterId);
  const [open, setOpen] = useState(false);
  if (!sheet) return null;
  return (
    <>
      <div className="bg-background/95 border-foreground/20 sticky top-0 z-30 -mx-4 border-b px-4 py-1.5 backdrop-blur md:-mx-6 md:px-6 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-11 w-full items-center gap-3 overflow-x-auto font-mono text-sm md:min-h-9"
        >
          <span className="text-muted-foreground text-xs tracking-wide uppercase">
            Live
          </span>
          <span>HP {sheet.hp.total}</span>
          <span>AC {sheet.ac.total}</span>
          <span>
            F{formatBonus(sheet.saves.fort.total)} R
            {formatBonus(sheet.saves.ref.total)} W
            {formatBonus(sheet.saves.will.total)}
          </span>
          <span>BAB {formatBonus(sheet.bab.total)}</span>
          <span className="hidden sm:inline">
            {ABILITIES.map((a) => `${ABILITY_SHORT[a]} ${sheet.abilities[a].total}`).join(' ')}
          </span>
          <span className="text-primary ml-auto shrink-0 text-xs">Open</span>
        </button>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-sans">Live sheet</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            <LiveSheet characterId={characterId} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** A confirmation dialog that names what a destructive step removes. */
export function ConfirmDialog({
  open,
  title,
  description,
  items,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  items?: string[];
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-sans">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {items && items.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5 text-sm">
            {items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} className="min-h-11 md:min-h-9">
            Keep
          </Button>
          <Button variant="destructive" onClick={onConfirm} className="min-h-11 md:min-h-9">
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
