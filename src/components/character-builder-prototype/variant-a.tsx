'use client';
// PROTOTYPE (throwaway, #208) — Variant A "Guided steps". STUB: replaced by the
// variant's own implementation (see CONTRACT.md). It may grow a
// variant-a/ folder.

import { Button } from '~/components/ui/button';
import type { FrameNavFn } from './frame';
import { PAGES, useProtoNav } from './nav';
import { useCharacter, useResolved, useWarnings } from './store';
import type { VariantProps } from './types';
import { formatBonus } from './ui-helpers';

export const name = 'Guided steps';

/** Optional: change the frame's section links. undefined = the real app's four sections. */
export const frameNav: FrameNavFn | undefined = undefined;

export function VariantA({ page, campaignId, characterId }: VariantProps) {
  const nav = useProtoNav();
  const character = useCharacter(characterId);
  const sheet = useResolved(characterId);
  const warnings = useWarnings(characterId);
  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <h1 className="text-2xl">
        Variant A · {name} · {page}
      </h1>
      <p className="text-muted-foreground text-sm">
        Campaign {campaignId}
        {character && ` · ${character.name}`}
        {sheet &&
          ` · AC ${sheet.ac.total} · HP ${sheet.hp.total} · BAB ${formatBonus(sheet.bab.total)}`}
        {` · ${warnings.length} warnings`}
      </p>
      <div className="flex flex-wrap gap-2">
        {PAGES.map((p) => (
          <Button
            key={p}
            variant={p === page ? 'default' : 'outline'}
            onClick={() => nav.go(p)}
          >
            {p}
          </Button>
        ))}
      </div>
    </main>
  );
}
