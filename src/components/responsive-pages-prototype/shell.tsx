'use client';
// PROTOTYPE — a stand-in for the settled top bar (#102 variant E). How the
// bar itself adapts is ticket #120's question, not this one; here it just has
// to fit: one row from tablet up, and on a phone a compact row with the tabs
// in a scrolling strip beneath.

import { Check, ChevronDown, StickyNote } from 'lucide-react';
import type React from 'react';
import { KeepIcon } from '~/components/keepIcon';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import type { PageKey } from './primitives';

export type Page = PageKey | 'week';

export function Shell({
  page,
  go,
  campaign,
  setupOnly,
  feedback,
  children,
}: {
  page: Page;
  go: (p: Page) => void;
  campaign: string;
  setupOnly: boolean;
  feedback: string;
  children: React.ReactNode;
}) {
  const tabs: { key: Page; label: string }[] = setupOnly
    ? [
        { key: 'setup', label: 'Set up militia' },
        { key: 'characters', label: 'Characters' },
      ]
    : [
        { key: 'week', label: 'Week 14' },
        { key: 'history', label: 'Finished weeks' },
        { key: 'militia', label: 'Militia' },
        { key: 'characters', label: 'Characters & officers' },
      ];
  const onList = page === 'campaigns';
  const nav = (
    <nav className="flex gap-1 text-sm">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => go(t.key)}
          className={cn(
            'px-3 py-1.5 whitespace-nowrap',
            t.key === page
              ? 'bg-background rounded-md shadow-sm'
              : 'text-muted-foreground',
          )}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
  return (
    <main className="flex min-h-svh flex-col">
      <header className="bg-sidebar border-b">
        <div className="flex items-center gap-3 px-3 py-2 md:gap-4 md:px-4">
          <button aria-label="All campaigns" onClick={() => go('campaigns')}>
            <KeepIcon className="size-8" />
          </button>
          <span className="text-muted-foreground">/</span>
          <button
            className="flex min-w-0 items-center gap-1"
            onClick={() => go('campaigns')}
          >
            <span className="truncate">
              {onList ? 'Thursday Group' : campaign}
            </span>{' '}
            <ChevronDown className="size-4 shrink-0 opacity-60" />
          </button>
          {!onList && <span className="hidden md:block">{nav}</span>}
          <span className="ml-auto flex items-center gap-2 text-sm">
            <Check className="size-4" />
            <span role="status" className="hidden sm:inline">
              {feedback}
            </span>
          </span>
          {!onList && !setupOnly && (
            <Button variant="ghost" size="icon" aria-label="Setup notes">
              <StickyNote />
            </Button>
          )}
        </div>
        {!onList && (
          <div className="overflow-x-auto px-2 pb-1.5 md:hidden">{nav}</div>
        )}
      </header>
      {children}
    </main>
  );
}
