'use client';
// PROTOTYPE — width helpers and the surfaces the variants disagree about:
// a bottom sheet, a pushed full-screen page, an accordion row, and the
// loading / failed / empty states from #119 shaped for each layout.

import { ChevronLeft, RefreshCw, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useSyncExternalStore } from 'react';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { cn } from '~/lib/utils';

// phone < 768 (below `md`), tablet 768–1279, desktop ≥ 1280 (`xl`).
export type Width = 'phone' | 'tablet' | 'desktop';
const query = (min: number) => `(min-width: ${min}px)`;
function subscribe(cb: () => void) {
  const a = window.matchMedia(query(768));
  const b = window.matchMedia(query(1280));
  a.addEventListener('change', cb);
  b.addEventListener('change', cb);
  return () => {
    a.removeEventListener('change', cb);
    b.removeEventListener('change', cb);
  };
}
function read(): Width {
  if (window.matchMedia(query(1280)).matches) return 'desktop';
  if (window.matchMedia(query(768)).matches) return 'tablet';
  return 'phone';
}
export const useWidth = () =>
  useSyncExternalStore(subscribe, read, () => 'tablet' as Width);

// ---------- bottom sheet (phone) ----------

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  tall,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  tall?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        className={cn(
          'bg-background relative flex flex-col rounded-t-xl border-t shadow-2xl',
          tall ? 'h-[92svh]' : 'max-h-[75svh]',
        )}
      >
        <header className="flex items-center gap-2 border-b px-4 py-2">
          <span className="bg-foreground/20 absolute top-1.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full" />
          <h2 className="mt-1 flex-1 text-base font-semibold">{title}</h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close"
            onClick={onClose}
          >
            <X />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </section>
    </div>
  );
}

// ---------- pushed page (phone drill-in) ----------

export function PushedPage({
  title,
  onBack,
  actions,
  children,
  footer,
}: {
  title: React.ReactNode;
  onBack: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-background sticky top-0 z-10 flex items-center gap-1 border-b px-2 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          aria-label="Back"
          className="px-1.5"
        >
          <ChevronLeft /> Back
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold">
          {title}
        </h1>
        <span className="flex min-w-16 justify-end gap-1">{actions}</span>
      </header>
      <div className="flex-1 space-y-4 p-4">{children}</div>
      {footer}
    </div>
  );
}

// ---------- accordion row (phone stacked) ----------

export function AccordionRow({
  open,
  onToggle,
  head,
  children,
  className,
}: {
  open: boolean;
  onToggle: () => void;
  head: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <li className={cn('border-foreground/15 border-b', className)}>
      <button
        aria-expanded={open}
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-3 text-left text-sm',
          open && 'bg-primary/10',
        )}
      >
        {head}
      </button>
      {open && <div className="space-y-4 px-3 pt-1 pb-4">{children}</div>}
    </li>
  );
}

// ---------- #119 states ----------

export type Status = 'ready' | 'loading' | 'failed' | 'empty';
export type PageKey =
  | 'campaigns'
  | 'setup'
  | 'militia'
  | 'characters'
  | 'history';

const emptyCopy: Record<
  PageKey,
  { title: string; body?: string; action?: string }
> = {
  campaigns: {
    title: 'Create a campaign to get started.',
    action: 'New campaign',
  },
  setup: {
    title: 'No militia yet.',
    body: 'Set it up from the current table state; play continues from there.',
    action: 'Set up militia',
  },
  militia: {
    title: 'No militia yet.',
    body: 'Set it up from the current table state; play continues from there.',
    action: 'Set up militia',
  },
  characters: { title: 'No characters yet.', action: 'Add character' },
  history: {
    title: 'No finished weeks yet.',
    body: 'The first one appears here when week 15 is confirmed. Until then the Week tab holds everything in play.',
  },
};

/** Loading skeleton shaped like the variant's layout, the shared failed card, or the page's empty state. */
export function StatusView({
  status,
  page,
  onRetry,
  skeleton,
}: {
  status: Exclude<Status, 'ready'>;
  page: PageKey;
  onRetry: () => void;
  skeleton: 'stack' | 'split' | 'three';
}) {
  if (status === 'loading')
    return (
      <div role="status" className="flex flex-1 gap-4 p-4">
        <span className="sr-only">Loading…</span>
        {skeleton !== 'stack' && (
          <div className="hidden w-56 shrink-0 space-y-2 md:block">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        )}
        <div className="flex-1 space-y-3">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-2/3" />
        </div>
        {skeleton === 'three' && (
          <div className="hidden w-64 shrink-0 space-y-2 xl:block">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
      </div>
    );
  if (status === 'failed')
    return (
      <div className="flex flex-1 items-start p-4 md:p-6">
        <div
          role="alert"
          className="bg-card border-foreground/20 w-full max-w-md space-y-3 border p-4"
        >
          <p className="font-semibold">This page could not be loaded.</p>
          <p className="text-muted-foreground text-sm">
            The other tabs still work. Try again in a moment.
          </p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw /> Try again
          </Button>
        </div>
      </div>
    );
  const e = emptyCopy[page];
  return (
    <div className="m-auto max-w-md space-y-3 p-6 text-center">
      <p className="text-lg">{e.title}</p>
      {e.body && <p className="text-muted-foreground text-sm">{e.body}</p>}
      {e.action && <Button onClick={onRetry}>{e.action}</Button>}
    </div>
  );
}
