import type { Id } from '@convex/_generated/dataModel';
import {
  calculateCharacterSheet,
  type SheetEntry,
} from '~/lib/character-sheet';
import { characterSheetClassFamily } from '~/lib/character-sheet-grants';
import { prerequisiteLabel } from '~/lib/character-sheet-prerequisites';
import { buildEntryPrerequisiteView } from './character-sheet-selections-view-model';
import type {
  CharacterSheetSnapshot,
  SheetWarningView,
} from './use-character-sheet';

type CatalogEntry = CharacterSheetSnapshot['catalogEntries'][number];
type ClassDefinition = Extract<
  CatalogEntry,
  { detail: { kind: 'class'; hitDie: number } }
>;
type ClassLevel = Extract<SheetEntry, { kind: 'classLevel' }>;
type StoredEntry = CharacterSheetSnapshot['entries'][number];
type StoredClassLevel = Extract<StoredEntry, { kind: 'classLevel' }>;
type ClassesSnapshot = Omit<CharacterSheetSnapshot, 'entries'> & {
  entries: (
    | Exclude<StoredEntry, { kind: 'classLevel' }>
    | (Omit<StoredClassLevel, 'active'> & { active: boolean })
  )[];
};

export const emptyClassCatalogChoices: readonly CatalogEntry[] = [];

function classCatalog(
  snapshot: ClassesSnapshot,
  catalogChoices: readonly CatalogEntry[],
) {
  return [
    ...new Map(
      [...catalogChoices, ...snapshot.catalogEntries].map((entry) => [
        entry._id,
        entry,
      ]),
    ).values(),
  ];
}

function previewClassLevels(
  snapshot: ClassesSnapshot,
  catalogEntries: CatalogEntry[],
  definition: ClassDefinition,
  entryId?: Id<'characterSheetEntry'>,
) {
  const replaced = entryId
    ? snapshot.entries.find((entry) => entry._id === entryId)
    : undefined;
  if (entryId && replaced?.kind !== 'classLevel') return null;
  const sourceEntries = snapshot.entries.flatMap((entry): SheetEntry[] => {
    if (entry.kind !== 'classLevel') return [entry];
    if (entry._id === replaced?._id) {
      return [
        {
          ...entry,
          active: true,
          state: { ...entry.state, classEntryId: definition._id },
        },
      ];
    }
    return entry.active ? [{ ...entry, active: true }] : [];
  });
  const existing = sourceEntries
    .filter(
      (entry): entry is ClassLevel =>
        entry.kind === 'classLevel' && entry.active,
    )
    .sort((a, b) => a.state.position - b.state.position)
    .find(
      (entry) =>
        catalogEntries.find(
          (candidate) => candidate._id === entry.state.classEntryId,
        )?.ruleIdentity === definition.ruleIdentity,
    );
  if (existing)
    return { entries: sourceEntries, first: existing, hasExisting: true };
  const position =
    Math.max(
      0,
      ...snapshot.entries.flatMap((entry) =>
        entry.kind === 'classLevel' && entry.active
          ? [entry.state.position]
          : [],
      ),
    ) + 1;
  const first: ClassLevel = {
    _id: 'preview-class-level',
    kind: 'classLevel',
    active: true,
    state: {
      kind: 'classLevel',
      classEntryId: definition._id,
      position,
      hpGained: null,
    },
  };
  return { entries: [...sourceEntries, first], first, hasExisting: false };
}

function entryStatusLabel(
  status: ReturnType<typeof buildEntryPrerequisiteView>['recordedStatus'],
) {
  if (status === 'met') return 'Entry requirements met';
  if (status === 'unmet') return 'Entry requirements not met';
  return null;
}

function entryRequirements(
  snapshot: ClassesSnapshot,
  catalogEntries: CatalogEntry[],
  definition: ClassDefinition,
  entryId?: Id<'characterSheetEntry'>,
) {
  if (definition.detail.classKind !== 'prestige') return null;
  const preview = previewClassLevels(
    snapshot,
    catalogEntries,
    definition,
    entryId,
  );
  if (!preview) return null;
  const { entries, first, hasExisting } = preview;
  const calculated = calculateCharacterSheet({
    entries,
    catalogEntries,
    characterKind: snapshot.character.kind,
  });
  const prerequisites = buildEntryPrerequisiteView({
    snapshot: {
      acceptedWarnings: snapshot.acceptedWarnings,
      catalogEntries,
      calculated,
    },
    entryId: first._id,
    recordedLevelPosition: first.state.position,
  });
  return {
    status: prerequisites.recordedStatus,
    currentStatus: hasExisting && !entryId ? prerequisites.currentStatus : null,
    label: entryStatusLabel(prerequisites.recordedStatus),
    prerequisiteText:
      definition.prerequisiteText ??
      (definition.prerequisites ?? [])
        .map((clause) => prerequisiteLabel(clause, catalogEntries))
        .join('; '),
    checks: prerequisites.recordedChecks,
    warnings: prerequisites.recordedWarnings,
    recordedLevelLabel: prerequisites.recordedLevelLabel,
  };
}

/** Class choices remain selectable regardless of advisory entry requirements. */
export function buildCharacterSheetClassesView(
  snapshot: ClassesSnapshot,
  catalogChoices: readonly CatalogEntry[] = emptyClassCatalogChoices,
) {
  const catalogEntries = classCatalog(snapshot, catalogChoices);
  const definitions = catalogEntries.filter(
    (entry): entry is ClassDefinition =>
      entry.detail.kind === 'class' && 'hitDie' in entry.detail,
  );
  const previews = new Map<string, ReturnType<typeof entryRequirements>>();
  function preview(
    classEntryId: Id<'catalogEntry'>,
    entryId?: Id<'characterSheetEntry'>,
  ) {
    const key = JSON.stringify([classEntryId, entryId ?? null]);
    if (previews.has(key)) return previews.get(key) ?? null;
    const definition = definitions.find((entry) => entry._id === classEntryId);
    const requirements = definition
      ? entryRequirements(snapshot, catalogEntries, definition, entryId)
      : null;
    previews.set(key, requirements);
    return requirements;
  }
  return {
    isVersionChange(previousClassId: string, nextClassId: string) {
      const previous = definitions.find(
        (entry) => entry._id === previousClassId,
      );
      const next = definitions.find((entry) => entry._id === nextClassId);
      return Boolean(
        previous &&
        next &&
        previous._id !== next._id &&
        characterSheetClassFamily(previous, catalogEntries) ===
          characterSheetClassFamily(next, catalogEntries),
      );
    },
    preview,
    warnings: snapshot.calculated.warnings
      .filter(
        (warning) =>
          warning.check === 'classVersions' ||
          warning.check === 'archetypeReplacementUnmatched' ||
          warning.check === 'archetypeUnchainedMonk',
      )
      .map(
        (warning): SheetWarningView => ({
          ...warning,
          accepted:
            warning.kind === 'rules' &&
            snapshot.acceptedWarnings.some(
              (accepted) =>
                accepted.check === warning.check &&
                accepted.subject === warning.subject &&
                accepted.fingerprint === warning.fingerprint,
            ),
        }),
      ),
    choices: definitions.map((definition) => ({
      classEntryId: definition._id,
      name: definition.name,
      classKind: definition.detail.classKind,
      hitDie: definition.detail.hitDie,
      isUnchained: Boolean(definition.detail.counterpartOf),
      definition,
      get entryRequirements() {
        return preview(definition._id);
      },
    })),
    versionChoicesFor(entryId: Id<'characterSheetEntry'>) {
      const row = snapshot.entries.find((entry) => entry._id === entryId);
      if (row?.kind !== 'classLevel' || !row.active) return [];
      const selected = definitions.find(
        (definition) => definition._id === row.state.classEntryId,
      );
      if (!selected) return [];
      const family = characterSheetClassFamily(selected, catalogEntries);
      const versions = definitions.filter(
        (definition) =>
          characterSheetClassFamily(definition, catalogEntries) === family,
      );
      if (!versions.some((definition) => definition.detail.counterpartOf))
        return [];
      return versions
        .map((definition) => {
          const kind: 'original' | 'unchained' = definition.detail.counterpartOf
            ? 'unchained'
            : 'original';
          return {
            kind,
            classEntryId: definition._id,
            name: definition.name,
            label: kind === 'unchained' ? 'Unchained' : 'Original',
            selected: definition._id === selected._id,
          };
        })
        .sort(
          (a, b) =>
            Number(a.kind === 'unchained') - Number(b.kind === 'unchained'),
        );
    },
  };
}
