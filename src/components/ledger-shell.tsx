'use client';

import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

export function LedgerShell({
  title,
  subtitle,
  meta,
  isOpen,
  onToggle,
  actions,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border-2 p-4">
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggle();
          }
        }}
        className="flex cursor-pointer items-center justify-between gap-4"
        aria-expanded={isOpen}
      >
        <div>
          <h2 className="text-primary font-sans text-2xl font-bold">{title}</h2>
          {meta ? (
            <p className="text-muted-foreground mt-1 font-mono text-sm">{meta}</p>
          ) : null}
          {subtitle ? (
            <p className="text-muted-foreground mt-1 font-mono text-xs">{subtitle}</p>
          ) : null}
        </div>
        <div
          className="flex items-center gap-2"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {actions}
          <Button type="button" variant="outline" onClick={onToggle}>
            {isOpen ? 'Close' : 'Open'}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          isOpen ? 'mt-4 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              'origin-top transition-[transform,opacity,filter] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
              isOpen
                ? 'opacity-100'
                : 'scale-y-[0.03] opacity-0 blur-[1px] brightness-125',
            )}
          >
            <div className="space-y-4">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
