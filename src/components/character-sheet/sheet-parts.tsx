'use client';
import { TriangleAlert, X } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import type { SaveStatus } from './save-status';

// The living sheet's shared idioms (approved prototype, #208): ruled block
// headings, the small mono field labels, chips, and the blue outline on a
// choice the sheet still needs.

export const blockHeading =
  'text-muted-foreground font-sans text-xs tracking-[0.15em] uppercase';
export const fieldLabel =
  'text-muted-foreground font-mono text-[11px] tracking-wide uppercase';
export const chip =
  'border-foreground/40 inline-flex items-center border px-1.5 py-0.5 font-mono text-xs leading-tight';
export const missingChoice = 'ring-2 ring-sky-400/80';
/** Touch-sized on the phone, compact from 768px. */
export const action = 'min-h-11 md:min-h-9';

export function Block({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cn('border-foreground/20 bg-card border p-3', className)}
    >
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={id} className={blockHeading}>
          {title}
        </h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

/** Saved text politely; a failure as an alert, verbatim, beside its editor. */
export function SaveFeedback({
  status,
  savedText,
}: {
  status: SaveStatus;
  savedText: string;
}) {
  return (
    <>
      <p role="status" className="text-muted-foreground text-xs">
        {status.kind === 'saved' ? savedText : null}
      </p>
      {status.kind === 'error' ? (
        <p
          role="alert"
          className="text-destructive w-full text-xs [overflow-wrap:anywhere]"
        >
          {status.message}
        </p>
      ) : null}
    </>
  );
}

/** Another player's change, beside what it touched, until dismissed. */
export function RemoteNotice({
  isShown,
  message,
  subject,
  onDismiss,
}: {
  isShown: boolean;
  message: string;
  /** Names the dismiss button: "Dismiss <subject> update". */
  subject: string;
  onDismiss: () => void;
}) {
  if (!isShown) return null;
  return (
    <p
      role="status"
      className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-xs text-sky-300"
    >
      <span>{message}</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-1.5 text-xs md:h-6"
        onClick={onDismiss}
      >
        <X aria-hidden className="size-3.5" />
        Dismiss <span className="sr-only">{subject} update</span>
      </Button>
    </p>
  );
}

/** An advisory rule note: isShown, never blocking. */
export function Advisory({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-sm text-amber-300">
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
    </p>
  );
}

export function formatModifier(modifier: number) {
  return modifier >= 0 ? `+${modifier}` : String(modifier);
}

/** Honour reduced motion for the scroll to an appended level. */
export function getScrollBehavior(): ScrollBehavior {
  const shouldReduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return shouldReduceMotion ? 'auto' : 'smooth';
}
