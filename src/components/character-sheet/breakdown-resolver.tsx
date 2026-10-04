'use client';
import { createContext, useContext, type ReactNode } from 'react';
import type { useCharacterSheet } from './use-character-sheet';
import type { ResolvedSpellcasting } from '~/lib/character-sheet-spellcasting';
import type { FamiliarStatisticTarget } from '~/lib/character-sheet-familiar-targets';
import { UnresolvedStatisticsProvider } from './unresolved-statistics';

type Controller = ReturnType<typeof useCharacterSheet>;
type Adjustments = NonNullable<Controller['sheet']>['adjustments'];

/**
 * What a breakdown asks the sheet: the numbers resolved in a Situation, and
 * the name behind a prerequisite so "while … is active" names the entry.
 */
export type BreakdownResolver = {
  previewSituation: Controller['previewSituation'];
  findPrerequisiteName: (catalogEntryId: string) => string | null;
  findCastingClassName: (classTag: string) => string | null;
};

const BreakdownResolverContext = createContext<BreakdownResolver | null>(null);

/**
 * Provided once by the sheet; every number's breakdown resolves itself, and
 * a number the sheet cannot finish (a familiar's, #326) reads Unresolved.
 */
export function BreakdownResolverProvider({
  previewSituation,
  adjustments,
  spellcastings,
  unresolved = { targets: [], reason: '' },
  children,
}: {
  previewSituation: Controller['previewSituation'];
  adjustments: Adjustments;
  spellcastings: readonly ResolvedSpellcasting[];
  /** The statistics without a finished value, and why. */
  unresolved?: { targets: readonly FamiliarStatisticTarget[]; reason: string };
  children: ReactNode;
}) {
  const resolver: BreakdownResolver = {
    previewSituation,
    findCastingClassName: (classTag) =>
      spellcastings.find((casting) => casting.classTag === classTag)?.name ??
      null,
    findPrerequisiteName: (catalogEntryId) =>
      adjustments.find((row) => row.catalogEntryId === catalogEntryId)?.name ??
      null,
  };
  return (
    <BreakdownResolverContext value={resolver}>
      <UnresolvedStatisticsProvider {...unresolved}>
        {children}
      </UnresolvedStatisticsProvider>
    </BreakdownResolverContext>
  );
}

export function useBreakdownResolver() {
  const resolver = useContext(BreakdownResolverContext);
  if (!resolver)
    throw new Error(
      'StatBreakdown needs a BreakdownResolverProvider above it.',
    );
  return resolver;
}
