'use client';
// PROTOTYPE (throwaway, #208) — Variant C small presentational pieces.

import { Info, Lightbulb, Minus, Plus, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';
import type { Warning } from '../warnings';

/** Touch-sized on the phone, compact from 768px. */
export const action = 'min-h-11 md:min-h-9';

export const chip =
  'border-foreground/40 inline-flex items-center border px-1.5 py-0.5 font-mono text-xs leading-tight';

export function Chip({
  className,
  children,
  muted,
  title,
}: {
  className?: string;
  children: ReactNode;
  muted?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        chip,
        muted && 'border-foreground/20 text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  );
}

export const SEVERITY_BADGE = {
  warning: 'border-amber-500/60 text-amber-300',
  prompt: 'border-sky-500/60 text-sky-300',
  info: 'border-foreground/20 text-muted-foreground',
} as const;

const SEVERITY_ICON = {
  warning: TriangleAlert,
  prompt: Lightbulb,
  info: Info,
} as const;

/** One advisory warning as a chip-sized badge, with its optional one-click fix. */
export function WarningBadge({
  warning,
  onAction,
  short,
}: {
  warning: Warning;
  onAction?: (warning: Warning) => void;
  short?: boolean;
}) {
  const Icon = SEVERITY_ICON[warning.severity];
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-start gap-1 border px-1.5 py-0.5 font-mono text-[11px] leading-tight',
        SEVERITY_BADGE[warning.severity],
      )}
    >
      <Icon aria-hidden className="mt-px size-3 shrink-0" />
      <span className={cn('min-w-0', short ? 'truncate' : 'whitespace-normal')}>
        {warning.message}
      </span>
      {warning.action && onAction && (
        <button
          type="button"
          className="text-foreground ml-1 shrink-0 underline underline-offset-2"
          onClick={() => onAction(warning)}
        >
          {warning.action.label}
        </button>
      )}
    </span>
  );
}

/** Counts of warnings by severity: "2 ⚠ 1 ?" for a collapsed card. */
export function WarningCount({ warnings }: { warnings: Warning[] }) {
  const n = (s: Warning['severity']) =>
    warnings.filter((w) => w.severity === s).length;
  const parts = (['warning', 'prompt', 'info'] as const).filter((s) => n(s));
  if (!parts.length) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {parts.map((s) => {
        const Icon = SEVERITY_ICON[s];
        return (
          <span
            key={s}
            className={cn(
              'inline-flex items-center gap-0.5 border px-1 font-mono text-[11px]',
              SEVERITY_BADGE[s],
            )}
            title={warnings
              .filter((w) => w.severity === s)
              .map((w) => w.message)
              .join('\n')}
          >
            <Icon aria-hidden className="size-3" />
            {n(s)}
          </span>
        );
      })}
    </span>
  );
}

/** A field caption in the app's table-header style. */
export function Caption({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'text-muted-foreground font-mono text-xs tracking-wide uppercase',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A number with − / + and a typed field; never clamps (rules are advisory). */
export function Stepper({
  value,
  onChange,
  min,
  max,
  label,
  className,
  empty,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  label: string;
  className?: string;
  /** Placeholder when null. */
  empty?: string;
}) {
  const v = value ?? 0;
  return (
    <div className={cn('inline-flex items-stretch', className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn(action, 'rounded-none')}
        aria-label={`${label} down`}
        onClick={() => onChange(v - 1)}
        disabled={min !== undefined && v <= min}
      >
        <Minus />
      </Button>
      <Input
        type="number"
        inputMode="numeric"
        aria-label={label}
        value={value ?? ''}
        placeholder={empty}
        onChange={(e) =>
          onChange(e.target.value === '' ? null : Number(e.target.value))
        }
        className={cn(
          action,
          'w-14 border-x-0 px-1 text-center font-mono text-base',
        )}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn(action, 'rounded-none')}
        aria-label={`${label} up`}
        onClick={() => onChange(v + 1)}
        disabled={max !== undefined && v >= max}
      >
        <Plus />
      </Button>
    </div>
  );
}

/** A delta chip "+1" / "−2" in the app's palette. */
export function Delta({ value }: { value: number }) {
  if (!value) return null;
  return (
    <span
      className={cn(
        'font-mono text-xs',
        value > 0 ? 'text-emerald-300' : 'text-destructive',
      )}
    >
      {value > 0 ? `+${value}` : `−${Math.abs(value)}`}
    </span>
  );
}
