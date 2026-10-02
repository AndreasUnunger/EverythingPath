'use client';
// PROTOTYPE (throwaway, #233) — spellcasting variant 3, "Spells page": the
// one home for Spells recorded for a class without levels. The same group
// ("Not under any Spellcasting", same rows) renders on the sheet section
// and on the spells page. Contract: CONTRACT.md, "The spells page, second
// pass".

import { TriangleAlert, X } from 'lucide-react';
import { cn } from '~/lib/utils';
import { className as classNameOf } from '../sheet';
import { useBuilderStore } from '../store';
import { orphanedSpells } from '../spellcasting';
import type { Character } from '../types';
import type { Warning } from '../warnings';
import { Block, FieldWarnings, blockHeading, chip } from './shared';

export const ORPHANS_TITLE = 'Not under any Spellcasting';

function OrphansTitle() {
  return (
    <span className="flex items-center gap-1.5 text-amber-300">
      <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
      {ORPHANS_TITLE}
    </span>
  );
}

function OrphanRows({
  character,
  warnings,
}: {
  character: Character;
  warnings: Warning[];
}) {
  const store = useBuilderStore();
  return (
    <ul>
      {orphanedSpells(character).map((o) => (
        <li
          key={o.entry.id}
          id={`s3-entry-${o.entry.id}`}
          className="border-foreground/10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-b py-1 last:border-b-0"
        >
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-sans text-base leading-tight">
              {o.catalog.name}
            </span>
            <span className="text-muted-foreground text-xs">
              recorded for {classNameOf(o.castingClass)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => store.removeEntry(character.id, o.entry.id)}
            className={cn(
              chip,
              'hover:bg-foreground/10 min-h-11 gap-1 px-2 md:min-h-7',
            )}
          >
            <X aria-hidden className="size-3" />
            Remove
          </button>
          <FieldWarnings
            warnings={warnings}
            where={`entry:${o.entry.id}`}
            characterId={character.id}
            className="col-span-full"
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * The orphaned Spells group. `framed` renders it as its own Block (the spells
 * page); otherwise as a sub-section inside a Block (the sheet's Spellcasting
 * section). Null without orphans.
 */
export function Orphans({
  character,
  warnings,
  framed,
  className,
}: {
  character: Character;
  warnings: Warning[];
  framed?: boolean;
  className?: string;
}) {
  if (orphanedSpells(character).length === 0) return null;
  if (framed)
    return (
      <Block
        id="s3-orphans"
        title={<OrphansTitle />}
        className={cn('border-amber-500/60', className)}
      >
        <OrphanRows character={character} warnings={warnings} />
      </Block>
    );
  return (
    <section id="s3-orphans" aria-label={ORPHANS_TITLE} className={className}>
      <h3 className={cn(blockHeading, 'mb-1')}>
        <OrphansTitle />
      </h3>
      <OrphanRows character={character} warnings={warnings} />
    </section>
  );
}
