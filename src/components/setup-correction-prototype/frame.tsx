'use client';
// PROTOTYPE — the settled top bar (navigation #102 variant E). Not under review
// here; only what's below it changes between variants.

import { Check, ChevronDown, Loader2, StickyNote, Users } from 'lucide-react';
import type React from 'react';
import { KeepIcon } from '~/components/keepIcon';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import type { Screen, State } from './mock';

export function Shell({ state, screen, onScreen, children }: { state: State; screen: Screen; onScreen: (s: Screen) => void; children: React.ReactNode }) {
  const setupOnly = screen === 'setup';
  const tabs: { key: Screen | 'week' | 'history'; label: string }[] = setupOnly
    ? [{ key: 'setup', label: 'Set up militia' }]
    : [
        { key: 'week', label: `Week ${state.latest.week.week}` },
        { key: 'history', label: 'Finished weeks' },
        { key: 'militia', label: 'Militia' },
        { key: 'characters', label: 'Characters & officers' },
      ];
  return (
    <main className="flex min-h-svh flex-col">
      <header className="bg-sidebar flex items-center gap-4 border-b px-4 py-2">
        <KeepIcon className="size-8" />
        <span className="text-muted-foreground">/</span>
        <span className="flex items-center gap-1">
          Ironfang Invasion <ChevronDown className="size-4 opacity-60" />
        </span>
        <nav className="flex gap-1 text-sm">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => (t.key === 'militia' || t.key === 'characters' || t.key === 'setup') && onScreen(t.key)}
              className={cn('px-3 py-1.5', t.key === screen ? 'bg-background rounded-md shadow-sm' : 'text-muted-foreground')}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <span className="ml-auto flex items-center gap-2 text-sm">
          {state.remoteFlash && (
            <span className="inline-flex items-center gap-1">
              <Users className="size-4" /> {state.remoteFlash}
            </span>
          )}
          {state.scenario.setupDoneElsewhere && setupOnly ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          <span role="status" aria-live="polite">
            {state.scenario.setupDoneElsewhere && setupOnly ? 'Mira started the militia. Opening the week…' : setupOnly ? 'Not started yet' : state.feedback}
          </span>
        </span>
        {!setupOnly && (
          <Button variant="ghost" size="icon" aria-label="Setup notes">
            <StickyNote />
          </Button>
        )}
      </header>
      {state.scenario.setupDoneElsewhere && setupOnly && (
        <div className="bg-primary text-primary-foreground px-5 py-2 text-sm" role="status">
          Another player finished setup first. Your entries here are discarded and the week opens in a moment.
        </div>
      )}
      {children}
    </main>
  );
}
