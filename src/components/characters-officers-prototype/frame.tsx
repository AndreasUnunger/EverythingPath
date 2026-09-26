'use client';
// PROTOTYPE — the settled top bar (navigation #102 variant E) with the
// Characters & officers tab active. Not under review here.

import { Check, ChevronDown, Loader2, StickyNote, Users } from 'lucide-react';
import type React from 'react';
import { KeepIcon } from '~/components/keepIcon';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import type { Projection } from './mock';

export function PageFrame({
  view,
  children,
}: {
  view: Projection;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-svh flex-col">
      <header className="bg-sidebar flex items-center gap-4 border-b px-4 py-2">
        <KeepIcon className="size-8" />
        <span className="text-muted-foreground">/</span>
        <span className="flex items-center gap-1">
          Ironfang Invasion <ChevronDown className="size-4 opacity-60" />
        </span>
        <nav className="flex gap-1 text-sm">
          {[
            'Week 14',
            'Finished weeks',
            'Militia',
            'Characters & officers',
          ].map((t, i) => (
            <span
              key={t}
              className={cn(
                'px-3 py-1.5',
                i === 3
                  ? 'bg-background rounded-md shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              {t}
            </span>
          ))}
        </nav>
        <span className="ml-auto flex items-center gap-2 text-sm">
          {view.state.remote && (
            <span className="inline-flex items-center gap-1">
              <Users className="size-4" /> {view.state.remote}
            </span>
          )}
          {view.state.feedback === 'Saving…' ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          <span role="status" aria-live="polite">
            {view.state.feedback}
          </span>
        </span>
        <Button variant="ghost" size="icon" aria-label="Setup notes">
          <StickyNote />
        </Button>
      </header>
      <div className="flex-1 px-5 py-4 pb-40">{children}</div>
    </main>
  );
}
