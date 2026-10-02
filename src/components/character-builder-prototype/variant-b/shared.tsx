'use client';
// PROTOTYPE (throwaway, #208) — Variant B shared primitives: the sheet UI
// context (open breakdown, the Class Level ranks are spent on), tappable
// numbers with their breakdown popover, inline editable numbers, and
// inline advisory warnings.
//
// Round 3 (#216): the context also carries the situation lens (`situation`,
// `baseSheet`), the active sheet variant's slots, and `openStat` for
// breakdowns of any Stat (attack bonus, damage). The popover lists a Stat's
// `conditional` contributions under "Only when…" and ends with the variant's
// `BreakdownExtra` slot.

import { Check, ChevronDown, TriangleAlert, X } from 'lucide-react';
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { getStat } from '../resolve';
import { useBuilderStore } from '../store';
import type {
  Character,
  ResolvedSheet,
  SituationKey,
  Stat,
  StatPath,
  Suppressed,
} from '../types';
import {
  BONUS_TYPE_CLASS,
  BONUS_TYPE_LABEL,
  SEVERITY_CLASS,
  formatBonus,
} from '../ui-helpers';
import type { Warning } from '../warnings';
import type { SheetVariantKey, SheetVariantSlots } from './sheet-variants';

// ------------------------------------------------------------- stat paths

// StatPath and getStat moved to types.ts / resolve.ts (#216); re-exported.
export type { StatPath };
export { getStat };

// ---------------------------------------------------------------- context

export type OpenBreakdown = {
  /** Which number is open: its StatPath, or the `key` given to `openStat`. */
  key: string;
  title: string;
  rect: DOMRect;
  /** Signed value ("+6") instead of a plain score. */
  signed: boolean;
  /** A sheet statistic, read live from the sheet on screen. */
  path: StatPath | null;
  /** Any other Stat (attack bonus, damage), shown as given. */
  stat: Stat | null;
};

export type OpenStat = {
  /** Unique per number on the page, e.g. ResolvedAttack.key + ':bonus'. */
  key: string;
  title: string;
  stat: Stat;
  /** Default true. */
  signed?: boolean;
  /** The element the popover opens next to (usually `event.currentTarget`). */
  anchor: Element;
};

export type SheetUi = {
  open: OpenBreakdown | null;
  setOpen: (o: OpenBreakdown | null) => void;
  /** Opens the breakdown popover for any Stat; again on the same key closes it. */
  openStat: (o: OpenStat) => void;
  /** The Class Level the skills table assigns ranks to. */
  ranksLevelId: string | null;
  setRanksLevelId: (id: string | null) => void;
  /** The situation lens: view state only, never saved; null = the normal sheet. */
  situation: SituationKey | null;
  setSituation: (s: SituationKey | null) => void;
  /** The sheet rendered: resolved with `situation` when the lens is set. */
  sheet: ResolvedSheet;
  /** The normal sheet (no situation asked for). Same as `sheet` without a lens. */
  baseSheet: ResolvedSheet;
  character: Character;
  /** The active sheet variant and its slots. */
  variant: SheetVariantKey;
  slots: SheetVariantSlots;
};

export const SheetUiContext = createContext<SheetUi | null>(null);

export function useSheetUi() {
  const ui = useContext(SheetUiContext);
  if (!ui) throw new Error('useSheetUi needs <SheetUiContext.Provider>');
  return ui;
}

// ------------------------------------------------------------ styling bits

export const chip =
  'border-foreground/40 inline-flex items-center border px-1.5 py-0.5 font-mono text-xs leading-tight';
export const th =
  'text-muted-foreground px-2 py-1.5 text-left font-mono text-xs font-normal tracking-wide uppercase';
/** Shell C's list-page idiom (`app-shell-prototype/pages.tsx`). */
export const main = 'mx-auto w-full max-w-6xl p-4 md:p-6';
/** Character pages: the shell's Back row already sits above. */
export const characterMain = 'mx-auto w-full max-w-6xl p-4 pt-2 md:p-6 md:pt-3';
export const action = 'min-h-11 md:min-h-9';
export const listTh =
  'text-muted-foreground px-2 py-2 text-left font-mono text-xs font-normal tracking-wide uppercase first:pl-0 last:pr-0';
export const listTd = 'px-2 py-2.5 align-middle first:pl-0 last:pr-0';
export const rowButton =
  'hover:bg-foreground/5 focus-visible:ring-ring/50 flex min-h-11 w-full items-center gap-3 border-b border-foreground/15 px-1 py-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-inset last:border-b-0';
export const blockHeading =
  'font-sans text-muted-foreground text-xs tracking-[0.15em] uppercase';
export const todoRing = 'ring-2 ring-sky-400/80 ring-offset-0';

/** Scrolls an element into view and flashes it. */
export function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.classList.add('outline', 'outline-2', 'outline-sky-400');
  window.setTimeout(
    () => el.classList.remove('outline', 'outline-2', 'outline-sky-400'),
    1200,
  );
}

export function Block({
  id,
  title,
  aside,
  children,
  className,
}: {
  id: string;
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        'border-foreground/20 bg-card scroll-mt-24 border p-3',
        className,
      )}
    >
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className={blockHeading}>{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

// ----------------------------------------------------------- stat buttons

export type StatButtonProps = {
  title: string;
  signed?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
} & (
  | {
      /** A sheet statistic. Under the lens, pass the sheet on screen (`ui.sheet`). */
      path: StatPath;
      sheet: ResolvedSheet;
      stat?: undefined;
      statKey?: undefined;
      baseStat?: undefined;
    }
  | {
      /** Any Stat (an attack bonus, damage). */
      stat: Stat;
      /** Unique per number on the page (the breakdown's `key`). */
      statKey: string;
      /** The same number without the lens, for `data-situation-changed`. */
      baseStat?: Stat;
      path?: undefined;
      sheet?: undefined;
    }
);

/**
 * A tappable number: opens the breakdown popover. Gets
 * `data-situation-changed="true"` when the lens changes its value (compared
 * with `baseSheet`, or `baseStat` for an arbitrary Stat); unstyled here.
 */
export function StatButton(props: StatButtonProps) {
  const { title, signed = false, size = 'md', className } = props;
  const ui = useSheetUi();
  const path = props.path ?? null;
  const stat = props.stat ?? getStat(props.sheet, props.path);
  const base = path ? getStat(ui.baseSheet, path) : props.baseStat;
  const key = path ?? props.statKey!;
  const changed = base !== undefined && base.total !== stat.total;
  const buffed = stat.applied.some((c) => c.temporary);
  const fmt = (n: number) => (signed ? formatBonus(n) : String(n));
  const isOpen = ui.open?.key === key;
  return (
    <button
      type="button"
      data-situation-changed={changed ? 'true' : undefined}
      onClick={(e) =>
        ui.setOpen(
          isOpen
            ? null
            : {
                key,
                path,
                stat: path ? null : stat,
                title,
                signed,
                rect: e.currentTarget.getBoundingClientRect(),
              },
        )
      }
      title={`${title}: tap for the breakdown`}
      className={cn(
        'hover:bg-foreground/10 inline-flex min-h-8 items-center gap-1 border-b border-dotted px-1 font-mono leading-none',
        isOpen ? 'border-primary bg-foreground/10' : 'border-foreground/40',
        size === 'lg' && 'text-3xl',
        size === 'md' && 'text-xl',
        size === 'sm' && 'text-base',
        buffed && 'text-violet-200',
        className,
      )}
    >
      <span>{fmt(stat.total)}</span>
    </button>
  );
}

const REASON: Record<Suppressed['reason'], string> = {
  bonusType: 'same bonus type, only the highest applies',
  sameSource: 'same source, only the strongest applies',
  sameEntry: 'same entry',
  excluded: '',
};

/** Stable keys for contribution rows: label + type + value, deduplicated. */
function keyed<T extends { label: string; bonusType: string; value: number }>(
  list: T[],
): [string, T][] {
  const seen = new Map<string, number>();
  return list.map((c) => {
    const base = `${c.label}|${c.bonusType}|${c.value}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return [n ? `${base}#${n}` : base, c];
  });
}

/** The one breakdown popover, rendered by the sheet root; reads the sheet on screen from the context. */
export function BreakdownPopover() {
  const ui = useSheetUi();
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{ top: number; left: number } | null>(
    null,
  );
  const open = ui.open;

  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const w = ref.current.offsetWidth;
    const h = ref.current.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = Math.min(Math.max(open.rect.left, 8), vw - w - 8);
    if (left < 8) left = 8;
    let top = open.rect.bottom + 6;
    if (top + h > vh - 60) top = Math.max(8, open.rect.top - h - 6);
    setStyle({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => ui.setOpen(null);
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
    };
  }, [open, ui]);

  if (!open) return null;
  const stat = open.stat ?? getStat(ui.sheet, open.path!);
  const fmt = (n: number) => (open.signed ? formatBonus(n) : String(n));
  const Extra = ui.slots.BreakdownExtra;
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`${open.title} breakdown`}
      style={style ?? { top: -9999, left: -9999 }}
      className="bg-background border-foreground/40 fixed z-[90] w-[min(22rem,calc(100vw-1rem))] border p-3 text-sm shadow-xl"
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="font-sans">{open.title}</span>
        <span className="font-mono text-2xl">{fmt(stat.total)}</span>
        <button
          type="button"
          aria-label="Close"
          onClick={() => ui.setOpen(null)}
          className="text-muted-foreground hover:text-foreground -mr-1 p-1"
        >
          <X className="size-4" />
        </button>
      </div>
      <ul className="space-y-0.5">
        {keyed(stat.applied).map(([key, c]) => (
          <li key={key} className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate">
              {c.label}
              {c.conditionText && (
                <span className="text-muted-foreground">
                  {' '}
                  · {c.conditionText}
                </span>
              )}
              {c.temporary && (
                <span className="text-muted-foreground"> · temporary</span>
              )}
            </span>
            {c.bonusType !== 'base' && c.bonusType !== 'untyped' && (
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
        ))}
      </ul>
      {stat.suppressed.length > 0 && (
        <>
          <p className="text-muted-foreground mt-2 font-mono text-[11px] tracking-wide uppercase">
            Not applied
          </p>
          <ul className="space-y-0.5">
            {keyed(stat.suppressed.map((x) => x.contribution)).map(
              ([key], i) => {
                const s = stat.suppressed[i]!;
                return (
                  <li key={key} className="text-muted-foreground">
                    <div className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate line-through">
                        {s.contribution.label}
                      </span>
                      {s.contribution.bonusType !== 'untyped' && (
                        <span className="font-mono text-[11px]">
                          {BONUS_TYPE_LABEL[s.contribution.bonusType]}
                        </span>
                      )}
                      <span className="font-mono line-through">
                        {formatBonus(s.contribution.value)}
                      </span>
                    </div>
                    <div className="text-xs">
                      {s.reason === 'excluded'
                        ? s.by
                        : `by ${s.by} — ${REASON[s.reason]}`}
                    </div>
                  </li>
                );
              },
            )}
          </ul>
        </>
      )}
      {!ui.slots.replacesConditionalSection && stat.conditional.length > 0 && (
        <>
          <p className="text-muted-foreground mt-2 font-mono text-[11px] tracking-wide uppercase">
            Only when…
          </p>
          <ul className="space-y-0.5">
            {keyed(stat.conditional).map(([key, c]) => (
              <li key={key} className="text-muted-foreground">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  {c.bonusType !== 'untyped' && (
                    <span className="font-mono text-[11px]">
                      {BONUS_TYPE_LABEL[c.bonusType]}
                    </span>
                  )}
                  <span className="font-mono">{formatBonus(c.value)}</span>
                </div>
                <div className="text-xs">
                  {c.conditionText}
                  {c.waitingOn && ' (not active now)'}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {Extra && (
        <Extra
          path={open.path}
          openKey={open.key}
          title={open.title}
          stat={stat}
          character={ui.character}
          sheet={ui.sheet}
        />
      )}
    </div>,
    document.body,
  );
}

// ----------------------------------------------------------- field inputs

/** A compact inline number field; commits on change, keeps any typed value. */
export function NumField({
  value,
  onChange,
  className,
  ariaLabel,
  placeholder,
  todo,
  width = 'w-14',
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  className?: string;
  ariaLabel: string;
  placeholder?: string;
  /** Needs a decision: highlighted. */
  todo?: boolean;
  width?: string;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={ariaLabel}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) =>
        onChange(e.target.value === '' ? null : Number(e.target.value))
      }
      className={cn(
        'bg-field border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 [appearance:textfield] border px-1 text-center font-mono text-base outline-none focus-visible:ring-[3px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        width,
        todo && todoRing,
        className,
      )}
    />
  );
}

/** A compact inline text field. */
export function TextField({
  value,
  onChange,
  ariaLabel,
  placeholder,
  className,
  todo,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
  todo?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <input
      ref={inputRef}
      type="text"
      aria-label={ariaLabel}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'bg-field border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 min-w-0 border px-2 text-base outline-none focus-visible:ring-[3px]',
        todo && todoRing,
        className,
      )}
    />
  );
}

/** A native select styled like the inputs; options as `[value, label]`. */
export function PickField<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder = '—',
  className,
  todo,
}: {
  value: T | null;
  onChange: (v: T | null) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
  placeholder?: string;
  className?: string;
  todo?: boolean;
}) {
  return (
    <span className={cn('relative inline-flex', className)}>
      <select
        aria-label={ariaLabel}
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value || null) as T | null)}
        className={cn(
          'bg-field border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full min-w-0 appearance-none border py-0 pr-6 pl-2 text-sm outline-none focus-visible:ring-[3px]',
          value === null && 'text-muted-foreground',
          todo && todoRing,
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 size-3.5 -translate-y-1/2" />
    </span>
  );
}

/** A checkbox-like toggle for active entries. */
export function ActiveToggle({
  active,
  onChange,
  label,
}: {
  active: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={`${label}: ${active ? 'active' : 'inactive'}`}
      onClick={() => onChange(!active)}
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center border',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-foreground/40 hover:border-foreground text-transparent',
      )}
    >
      <Check className="size-4" />
    </button>
  );
}

// -------------------------------------------------------- inline warnings

/** The advisory warnings for one `where`, inline next to their field. */
export function FieldWarnings({
  warnings,
  where,
  characterId,
  className,
  compact,
}: {
  warnings: Warning[];
  where: string | ((w: Warning) => boolean);
  characterId: string;
  className?: string;
  /** One line each, no icon. */
  compact?: boolean;
}) {
  const store = useBuilderStore();
  const list = warnings.filter((w) =>
    typeof where === 'string' ? w.where === where : where(w),
  );
  if (list.length === 0) return null;
  return (
    <ul className={cn('space-y-0.5', className)}>
      {list.map((w) => (
        <li
          key={w.id}
          className={cn(
            'flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs',
            SEVERITY_CLASS[w.severity],
          )}
        >
          {!compact && w.severity === 'warning' && (
            <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
          )}
          <span className="min-w-0 [overflow-wrap:anywhere]">{w.message}</span>
          {w.action && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-xs"
              onClick={() =>
                store.addEntry(characterId, w.action!.catalogKey, {
                  gainedAtClassLevel: w.action!.gainedAtClassLevel,
                })
              }
            >
              {w.action.label}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
