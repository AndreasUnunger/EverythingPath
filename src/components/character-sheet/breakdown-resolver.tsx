'use client';
import { createContext, useContext, type ReactNode } from 'react';
import type { useCharacterSheet } from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type Adjustments = NonNullable<Controller['sheet']>['adjustments'];

/**
 * What a breakdown asks the sheet: the numbers resolved in a Situation, and
 * the name behind a prerequisite so "while … is active" names the entry.
 */
export type BreakdownResolver = {
  previewSituation: Controller['previewSituation'];
  findPrerequisiteName: (catalogEntryId: string) => string | null;
};

const BreakdownResolverContext = createContext<BreakdownResolver | null>(null);

/** Provided once by the sheet; every number's breakdown resolves itself. */
export function BreakdownResolverProvider({
  previewSituation,
  adjustments,
  children,
}: {
  previewSituation: Controller['previewSituation'];
  adjustments: Adjustments;
  children: ReactNode;
}) {
  const resolver: BreakdownResolver = {
    previewSituation,
    findPrerequisiteName: (catalogEntryId) =>
      adjustments.find((row) => row.catalogEntryId === catalogEntryId)?.name ??
      null,
  };
  return (
    <BreakdownResolverContext value={resolver}>
      {children}
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
