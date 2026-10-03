'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { Spellcasting } from './character-spells-page-types';

const browserParams = ['add', 'level', 'school', 'q', 'other'] as const;

export function useCharacterSpellsRoute(spellcastings: Spellcasting[]) {
  const router = useRouter();
  const pathname = usePathname();
  const incoming = useSearchParams()?.toString() ?? '';
  const [route, setRoute] = useState({ source: incoming, value: incoming });
  if (route.source !== incoming)
    setRoute({ source: incoming, value: incoming });
  const params = new URLSearchParams(
    route.source === incoming ? route.value : incoming,
  );
  const selected =
    spellcastings.find(
      (casting) => casting.classEntryId === params.get('spellcasting'),
    ) ??
    spellcastings[0] ??
    null;
  const readOnly = selected?.record === 'none';

  function update({
    changes,
    clearBrowser = false,
  }: {
    changes: Record<string, string | null>;
    clearBrowser?: boolean;
  }) {
    const next = new URLSearchParams(params);
    if (clearBrowser) browserParams.forEach((key) => next.delete(key));
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    const value = next.toString();
    setRoute({ source: incoming, value });
    router.replace(`${pathname}${value ? `?${value}` : ''}`, { scroll: false });
  }

  return {
    params,
    selected,
    readOnly,
    isBrowsing: Boolean(selected) && (readOnly || params.get('add') === '1'),
    query: params.get('q') ?? '',
    includeOtherLists: !readOnly && params.get('other') === '1',
    update,
    selectSpellcasting: (classEntryId: string) => {
      if (
        spellcastings.some((casting) => casting.classEntryId === classEntryId)
      )
        update({ changes: { spellcasting: classEntryId }, clearBrowser: true });
    },
    enterBrowser: () => {
      if (selected && !readOnly)
        update({ changes: { add: '1' }, clearBrowser: true });
    },
    leaveBrowser: () => {
      if (!readOnly) update({ changes: {}, clearBrowser: true });
    },
    setQuery: (value: string) => update({ changes: { q: value } }),
    setIncludeOtherLists: (include: boolean) => {
      if (selected && !readOnly)
        update({ changes: { other: include ? '1' : null } });
    },
  };
}
