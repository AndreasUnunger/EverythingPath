'use client';
// PROTOTYPE — the settled navigation shell (#102 variant E) with the Finished
// weeks tab active. Not under review; only what's inside changes per variant.

import { Check, ChevronDown, StickyNote } from 'lucide-react';
import type React from 'react';
import { KeepIcon } from '~/components/keepIcon';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { currentWeek } from './mock';

export function Shell({ children }: { children: React.ReactNode }) {
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
            `Week ${currentWeek}`,
            'Finished weeks',
            'Militia',
            'Characters & officers',
          ].map((t, i) => (
            <span
              key={t}
              className={cn(
                'px-3 py-1.5',
                i === 1
                  ? 'bg-background rounded-md shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              {t}
            </span>
          ))}
        </nav>
        <span className="ml-auto flex items-center gap-2 text-sm">
          <Check className="size-4" />
          <span role="status">Up to date</span>
        </span>
        <Button variant="ghost" size="icon" aria-label="Setup notes">
          <StickyNote />
        </Button>
      </header>
      <div className="flex flex-1 flex-col px-5 py-3">{children}</div>
    </main>
  );
}
