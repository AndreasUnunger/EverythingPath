'use client';
// PROTOTYPE (throwaway, #216) — sheet variant 2, "Attack table": the
// situation pieces. `AltTotals` puts a statistic's alternate totals beside
// its number (one clickable number per situation that changes it, worked out
// with stacking by the resolver); `SituationsStrip` is the row of toggle
// chips that sets the lens and marks every changed number; `V2SkillExtra`
// and `V2BreakdownExtra` are the skill cell's alternate and the breakdown's
// per-situation stacking section. Owned by the variant 2 agent.

import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '~/lib/utils';
import { SKILL_BY_KEY } from '../catalog';
import { getStat, resolveInSituation, situationalTotals } from '../resolve';
import type {
  SituationKey,
  SkillKey,
  SkillStat,
  Stat,
  StatPath,
} from '../types';
import { BONUS_TYPE_CLASS, BONUS_TYPE_LABEL, formatBonus } from '../ui-helpers';
import type { SheetSlotProps } from './sheet-variants';
import { useSheetUi } from './shared';

/** Shorter chip labels for the long situation texts. */
const SHORT_TEXT: Partial<Record<SituationKey, string>> = {
  spells: 'vs. spells…',
  enchantment: 'vs. enchantment…',
  bullRushTrip: 'vs. bull rush and trip',
  sneak: 'when flanking…',
};

/**
 * Marks every number the lens changed. `StatButton` sets the attribute; the
 * sheet's vitals and skills live outside this variant's blocks, so the rule
 * is a small scoped style sheet rendered by the strip (mounted only with
 * this variant). Unlayered, so it wins over the utility classes.
 */
const LENS_CSS =
  '[data-situation-changed="true"]{color:var(--color-sky-300,#7dd3fc);border-color:var(--color-sky-300,#7dd3fc);}';

export const altTone = {
  sky: 'text-sky-300 border-sky-300/50 hover:bg-sky-400/10',
  muted: 'text-muted-foreground border-foreground/30 hover:bg-foreground/10',
  /** The sheet's own tappable-number look, for a main number that isn't a plain total (damage). */
  main: 'text-foreground border-foreground/40 hover:bg-foreground/10',
} as const;

/**
 * A clickable alternate number in the sheet's tappable-number idiom (dotted
 * underline), opening the breakdown of the Stat it stands for.
 */
export function AltButton({
  id,
  title,
  stat,
  signed = true,
  tone = 'sky',
  changed,
  className,
  children,
}: {
  /** Unique per number on the page (the breakdown's key). */
  id: string;
  title: string;
  stat: Stat;
  signed?: boolean;
  tone?: keyof typeof altTone;
  /** Marks the number as changed by the lens. */
  changed?: boolean;
  className?: string;
  /** The text shown; defaults to the Stat's total. */
  children?: ReactNode;
}) {
  const ui = useSheetUi();
  const isOpen = ui.open?.key === id;
  return (
    <button
      type="button"
      data-situation-changed={changed ? 'true' : undefined}
      title={`${title}: tap for the breakdown`}
      onClick={(e) =>
        ui.openStat({ key: id, title, stat, signed, anchor: e.currentTarget })
      }
      className={cn(
        'inline-flex min-h-6 items-center border-b border-dotted px-1 font-mono text-sm leading-none whitespace-nowrap',
        altTone[tone],
        isOpen && 'border-primary bg-foreground/10',
        className,
      )}
    >
      {children ?? (signed ? formatBonus(stat.total) : stat.total)}
    </button>
  );
}

/**
 * The alternate totals of one sheet statistic: one clickable number per
 * situation that changes it, each with the situation's text. The situation
 * the lens is on is left out: its total is the main number then.
 */
export function AltTotals({
  path,
  title,
  signed,
  nowrap,
  className,
}: {
  path: StatPath;
  title: string;
  signed?: boolean;
  /** Keep each alternate on one line (a narrow table cell). */
  nowrap?: boolean;
  className?: string;
}) {
  const ui = useSheetUi();
  const alts = situationalTotals(ui.character, ui.baseSheet, path).filter(
    (a) => a.key !== ui.situation,
  );
  if (alts.length === 0) return null;
  return (
    <span
      className={cn(
        'inline-flex flex-wrap items-baseline justify-end gap-x-2 gap-y-0.5',
        className,
      )}
    >
      {alts.map((a) => (
        <span
          key={a.key}
          className={cn('text-right', nowrap && 'whitespace-nowrap')}
        >
          <AltButton
            id={`${path}@${a.key}`}
            title={`${title} ${a.text}`}
            stat={getStat(resolveInSituation(ui.character, a.key), path)}
            signed={!!signed}
            className="mr-1 align-baseline"
          />
          <span className="text-xs text-sky-300/80">{a.text}</span>
        </span>
      ))}
    </span>
  );
}

// ----------------------------------------------------------- the strip

/** The situations strip (the `AboveSheet` slot): toggle chips that set the lens. */
export function SituationsStrip(_: SheetSlotProps) {
  const ui = useSheetUi();
  const situations = ui.baseSheet.situations;
  const active = situations.find((s) => s.key === ui.situation) ?? null;
  return (
    <div className="mb-3 space-y-1.5">
      <style>{LENS_CSS}</style>
      {situations.length > 0 && (
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          <span className="text-muted-foreground shrink-0 font-mono text-xs tracking-wide uppercase">
            See the sheet
          </span>
          {situations.map((s) => {
            const on = s.key === ui.situation;
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={on}
                title={s.text}
                onClick={() => ui.setSituation(on ? null : s.key)}
                className={cn(
                  'inline-flex min-h-11 shrink-0 items-center border px-2 font-mono text-sm leading-tight whitespace-nowrap md:min-h-9',
                  on
                    ? 'border-sky-400 bg-sky-400/15 text-sky-200'
                    : 'border-foreground/40 hover:bg-foreground/10',
                )}
              >
                {SHORT_TEXT[s.key] ?? s.text}
              </button>
            );
          })}
        </div>
      )}
      {active && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sky-300">
          <span>
            Showing the sheet {active.text}. Every number it changes is marked.
          </span>
          <button
            type="button"
            onClick={() => ui.setSituation(null)}
            className="inline-flex min-h-7 items-center gap-1 border border-sky-400/60 px-1.5 hover:bg-sky-400/10"
          >
            <X aria-hidden className="size-3" />
            Clear
          </button>
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------- skills and breakdown

/** Stable list keys from a text per item, deduplicated. */
function keyed<T>(list: T[], text: (item: T) => string): [string, T][] {
  const seen = new Map<string, number>();
  return list.map((item) => {
    const base = text(item);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return [n ? `${base}#${n}` : base, item];
  });
}

/** Under a skill's total: its alternate total, when a situation changes it. */
export function V2SkillExtra({
  skill,
}: SheetSlotProps & { skill: SkillKey; stat: SkillStat }) {
  return (
    <AltTotals
      path={`skills.${skill}`}
      title={SKILL_BY_KEY[skill].name}
      signed
      nowrap
      className="flex"
    />
  );
}

/**
 * The breakdown's last section for a sheet statistic with situations: each
 * situation's alternate total with the lines it adds and the lines it
 * suppresses, so the stacking is visible.
 */
export function V2BreakdownExtra({
  path,
  character,
}: SheetSlotProps & {
  path: StatPath | null;
  openKey: string;
  title: string;
  stat: Stat;
}) {
  const ui = useSheetUi();
  if (!path) return null;
  const base = getStat(ui.baseSheet, path);
  const alts = situationalTotals(character, ui.baseSheet, path).filter(
    (a) => a.key !== ui.situation,
  );
  if (alts.length === 0) return null;
  const signed = ui.open?.signed ?? true;
  const fmt = (n: number) => (signed ? formatBonus(n) : String(n));
  return (
    <>
      <p className="text-muted-foreground mt-2 font-mono text-[11px] tracking-wide uppercase">
        In a situation
      </p>
      <ul className="space-y-1.5">
        {alts.map((a) => {
          const sit = getStat(resolveInSituation(character, a.key), path);
          const added = sit.applied.filter((c) => c.situationKey === a.key);
          const suppressed = sit.suppressed.filter(
            (s) =>
              !base.suppressed.some(
                (b) =>
                  b.contribution.label === s.contribution.label &&
                  b.contribution.value === s.contribution.value &&
                  b.by === s.by,
              ),
          );
          return (
            <li key={a.key}>
              <div className="flex items-baseline gap-2 text-sky-300">
                <span className="min-w-0 flex-1">{a.text}</span>
                <span className="font-mono">{fmt(a.total)}</span>
              </div>
              <ul className="text-muted-foreground space-y-0.5 text-xs">
                {keyed(added, (c) => `${c.label}|${c.value}`).map(
                  ([key, c]) => (
                    <li key={key} className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate">{c.label}</span>
                      {c.bonusType !== 'untyped' && c.bonusType !== 'base' && (
                        <span
                          className={cn(
                            'font-mono text-[11px]',
                            BONUS_TYPE_CLASS[c.bonusType],
                          )}
                        >
                          {BONUS_TYPE_LABEL[c.bonusType]}
                        </span>
                      )}
                      <span className="font-mono">{formatBonus(c.value)}</span>
                    </li>
                  ),
                )}
                {keyed(
                  suppressed,
                  (s) => `${s.contribution.label}|${s.by}`,
                ).map(([key, s]) => (
                  <li key={key} className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate">
                      <span className="line-through">
                        {s.contribution.label}
                      </span>{' '}
                      · by {s.by}
                    </span>
                    {s.contribution.bonusType !== 'untyped' && (
                      <span className="font-mono text-[11px]">
                        {BONUS_TYPE_LABEL[s.contribution.bonusType]}
                      </span>
                    )}
                    <span className="font-mono line-through">
                      {formatBonus(s.contribution.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </>
  );
}
