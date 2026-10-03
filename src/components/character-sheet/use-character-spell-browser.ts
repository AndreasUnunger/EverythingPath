'use client';

import { api } from '@convex/_generated/api';
import { usePaginatedQuery, useQuery } from 'convex/react';
import type { CharacterScope } from './character-scope';
import type { SpellsPageSheet } from './character-spells-page-types';
import { schoolChoice } from './spell-school-choice';
import type { useCharacterSpellsRoute } from './use-character-spells-route';

export function useCharacterSpellBrowser({
  scope,
  sheet,
  route,
}: {
  scope: CharacterScope;
  sheet: SpellsPageSheet;
  route: ReturnType<typeof useCharacterSpellsRoute>;
}) {
  const { selected, params, isBrowsing, includeOtherLists, query } = route;
  const castingClass = sheet?.classChoices.find(
    (entry) => entry._id === selected?.classEntryId,
  );
  const queryScope =
    sheet && castingClass
      ? {
          ...scope,
          characterId: sheet.character._id,
          castingClassId: castingClass._id,
        }
      : null;
  const browserInfo = useQuery(
    api.characterSheetSpells.browserInfo,
    isBrowsing && queryScope
      ? {
          ...queryScope,
          ...(includeOtherLists ? { includeOtherLists: true } : {}),
        }
      : 'skip',
  );
  const levels = browserInfo?.levels ?? [];
  const rawLevel = params.get('level');
  const selectedLevel =
    rawLevel !== null &&
    /^\d+$/.test(rawLevel) &&
    levels.includes(Number(rawLevel))
      ? Number(rawLevel)
      : (browserInfo?.defaultLevel ?? 1);
  const schools = (browserInfo?.schools ?? []).map(schoolChoice);
  const school = schools.some((item) => item.value === params.get('school'))
    ? params.get('school')
    : null;
  const searching = query.trim().length > 0;
  const browser = usePaginatedQuery(
    api.characterSheetSpells.browse,
    isBrowsing && queryScope && browserInfo
      ? {
          ...queryScope,
          ...(searching
            ? { search: query.trim() }
            : { spellLevel: selectedLevel }),
          ...(school ? { school } : {}),
          ...(includeOtherLists ? { includeOtherLists: true } : {}),
        }
      : 'skip',
    { initialNumItems: 25 },
  );
  return {
    levels,
    selectedLevel,
    schools,
    school,
    searching,
    browser,
    isLoading:
      isBrowsing && (!browserInfo || browser.status === 'LoadingFirstPage'),
    loadMore: () => {
      if (isBrowsing && browser.status === 'CanLoadMore') browser.loadMore(25);
    },
    setLevel: (spellLevel: number) => {
      if (levels.includes(spellLevel))
        route.update({ changes: { level: String(spellLevel), q: null } });
    },
    setSchool: (value: string | null) => {
      if (value === null || schools.some((school) => school.value === value))
        route.update({ changes: { school: value } });
    },
  };
}
