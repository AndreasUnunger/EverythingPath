import {
  selectionMetadata,
  buildSelectionEntry,
  replaceRecordedSelection,
} from '~/lib/character-sheet-selection';
import {
  calculateCharacterSheet,
  type SheetEntry,
  type SheetWarning,
} from '~/lib/character-sheet';
import {
  prerequisiteLabel,
  type Prerequisite,
  type PrerequisiteCheck,
} from '~/lib/character-sheet-prerequisites';
import type {
  CharacterSheetSnapshot,
  SheetWarningView,
} from './use-character-sheet';
import type { FillSelectionSlotInput } from './use-character-sheet-selections';
import { ignoresPrerequisites } from '~/lib/character-sheet-proficiency-prerequisites';

type SelectionKind = 'feat' | 'trait';
type StoredSelection = Extract<
  CharacterSheetSnapshot['entries'][number],
  { kind: SelectionKind }
>;
type RequirementStatus = 'met' | 'unmet' | 'none' | 'exempt' | null;

function acceptedWarning(
  snapshot: CharacterSheetSnapshot,
  warning: SheetWarning,
): SheetWarningView {
  return {
    ...warning,
    accepted:
      warning.kind === 'rules' &&
      snapshot.acceptedWarnings.some(
        (accepted) =>
          accepted.check === warning.check &&
          accepted.subject === warning.subject &&
          accepted.fingerprint === warning.fingerprint,
      ),
  };
}

function requirementStatus(
  checks: readonly PrerequisiteCheck[],
  exempt = false,
): RequirementStatus {
  if (exempt) return 'exempt';
  if (checks.some((check) => check.met === false)) return 'unmet';
  if (checks.some((check) => check.met === null)) return null;
  return checks.length ? 'met' : 'none';
}

function readableProse(clauses: readonly Prerequisite[]): string[] {
  return clauses.flatMap((clause) =>
    'unchecked' in clause
      ? [clause.unchecked]
      : 'anyOf' in clause
        ? readableProse(clause.anyOf)
        : [],
  );
}

function selectionGuidance(
  catalog: CharacterSheetSnapshot['catalogEntries'][number],
) {
  return catalog.guidanceText ?? '';
}

function selectionPrerequisiteText(
  catalog: CharacterSheetSnapshot['catalogEntries'][number],
) {
  return (
    catalog.prerequisiteText ??
    readableProse(catalog.prerequisites ?? []).join('; ')
  );
}

function entryChecks(
  calculated: CharacterSheetSnapshot['calculated'],
  entryId: string,
): PrerequisiteCheck[] {
  return calculated.prerequisites.filter((check) => check.entryId === entryId);
}

function isCurrentWarning(warning: SheetWarning, entryId: string) {
  return (
    warning.check === 'prerequisites.current' ||
    (warning.check === 'proficiencyPrerequisite' &&
      warning.subject.startsWith(`${entryId}:current:`))
  );
}

function isRecordedWarning(warning: SheetWarning, entryId: string) {
  return (
    warning.check === 'prerequisites.recordedLevel' ||
    (warning.check === 'proficiencyPrerequisite' &&
      warning.subject.startsWith(`${entryId}:recorded:`))
  );
}

export function buildCharacterSheetSelectionsView(
  snapshot: CharacterSheetSnapshot,
) {
  const warnings = snapshot.calculated.warnings.map((warning) =>
    acceptedWarning(snapshot, warning),
  );
  const slots = snapshot.calculated.selectionRules.slots;
  const levels = snapshot.entries
    .filter((entry) => entry.kind === 'classLevel')
    .map((entry) => ({
      entryId: entry._id,
      position: entry.state.position,
      label: `${entry.state.position} · ${snapshot.catalogEntries.find((catalog) => catalog._id === entry.state.classEntryId)?.name ?? 'Unspecified'}`,
    }));
  const base = snapshot.entries.find((entry) => entry.kind === 'base');
  const prerequisiteInput = {
    ...snapshot,
    characterKind: snapshot.character.kind,
    entries: [
      ...snapshot.entries.filter(
        (entry) =>
          entry.active &&
          (entry.kind === 'base' || entry.kind === 'classLevel'),
      ),
      ...snapshot.calculated.resolvedEntries
        .filter((resolved) => resolved.counting)
        .map(({ entry }) => entry),
    ],
  };
  const rows = snapshot.calculated.resolvedEntries.flatMap((resolved) => {
    const entry = resolved.entry;
    if (entry.kind !== 'feat' && entry.kind !== 'trait') return [];
    const stored = snapshot.entries.find(
      (row): row is StoredSelection =>
        (row.kind === 'feat' || row.kind === 'trait') &&
        row._id === resolved.storedEntryId,
    );
    const catalog = snapshot.catalogEntries.find(
      (definition) => definition._id === entry.catalogEntryId,
    );
    const rowWarnings = warnings.filter(
      (warning) =>
        warning.target.kind === 'entry' && warning.target.entryId === entry._id,
    );
    const checks = entryChecks(snapshot.calculated, entry._id);
    const currentChecks = checks.filter((check) => check.view === 'current');
    const recordedChecks = checks.filter((check) => check.view === 'recorded');
    const exempt =
      resolved.origin === 'grant' ||
      ignoresPrerequisites(entry, prerequisiteInput);
    const recordedLevel = levels.find(
      (level) => level.entryId === stored?.gainedAtClassLevel,
    );
    return [
      {
        rowId: entry._id,
        entryId: stored?._id ?? null,
        kind: entry.kind,
        name: catalog?.name ?? 'Unavailable entry',
        description: catalog?.description ?? '',
        guidanceText: catalog ? selectionGuidance(catalog) : '',
        origin: resolved.origin,
        active: entry.active,
        dormant: resolved.dormant,
        counting: resolved.counting,
        kept: 'kept' in entry && entry.kept === true,
        canRemove: resolved.origin === 'selection' && stored !== undefined,
        canEdit: resolved.origin === 'selection' && stored !== undefined,
        slot: stored?.selectionSlot ?? null,
        choice: 'choice' in entry.state ? (entry.state.choice ?? null) : null,
        notes: stored?.notes ?? '',
        gainedAtClassLevel: stored?.gainedAtClassLevel ?? null,
        choiceOrder: stored?.choiceOrder ?? null,
        recordedLevelLabel: recordedLevel
          ? `Prerequisites at recorded level ${recordedLevel.position}`
          : null,
        currentStatus: requirementStatus(currentChecks, exempt),
        recordedStatus: recordedLevel
          ? requirementStatus(recordedChecks, exempt)
          : null,
        checks: checks
          .filter((check) => check.met !== null)
          .map((check) => ({
            ...check,
            label: prerequisiteLabel(check.clause, snapshot.catalogEntries),
          })),
        prerequisiteText: catalog ? selectionPrerequisiteText(catalog) : '',
        warnings: rowWarnings,
        currentWarnings: rowWarnings.filter((warning) =>
          isCurrentWarning(warning, entry._id),
        ),
        recordedWarnings: rowWarnings.filter((warning) =>
          isRecordedWarning(warning, entry._id),
        ),
      },
    ];
  });
  return {
    budgets: snapshot.calculated.selectionRules.budgets,
    slots: slots.map((slot) => ({
      ...slot,
      rows: rows.filter((row) => row.slot?.id === slot.id),
    })),
    rows,
    candidates: snapshot.catalogEntries.flatMap((entry) => {
      if (entry.detail.kind !== 'feat' && entry.detail.kind !== 'trait')
        return [];
      return [
        {
          catalogEntryId: entry._id,
          name: entry.name,
          kind: entry.detail.kind,
          description: entry.description ?? '',
          guidanceText: selectionGuidance(entry),
          prerequisiteText: selectionPrerequisiteText(entry),
        },
      ];
    }),
    levels,
    facts: {
      alignment: base?.state.alignment ?? null,
      deity: base?.state.deity ?? null,
    },
    warnings: warnings.filter((warning) =>
      snapshot.calculated.selectionRules.warnings.some(
        (candidate) =>
          candidate.check === warning.check &&
          candidate.subject === warning.subject &&
          candidate.fingerprint === warning.fingerprint,
      ),
    ),
  };
}

/** Preview crosses the same calculation seam as the saved sheet. Failed checks remain advisory. */
export function previewSelectionSlot(
  snapshot: CharacterSheetSnapshot,
  input: FillSelectionSlotInput,
) {
  const slot = snapshot.calculated.selectionRules.slots.find(
    (slot) => slot.id === input.slotId,
  );
  const catalog = snapshot.catalogEntries.find(
    (entry) => entry._id === input.catalogEntryId,
  );
  if (!slot || catalog?.detail.kind !== slot.kind) return null;
  const previous = snapshot.entries.find(
    (entry): entry is StoredSelection =>
      (entry.kind === 'feat' || entry.kind === 'trait') &&
      !entry.grantKey &&
      entry.selectionSlot?.id === input.slotId &&
      entry.selectionSlot.position === input.position,
  );
  const entryId = previous?._id ?? 'preview:selection';
  const metadata = selectionMetadata({
    entries: snapshot.entries,
    previous,
    input,
  });
  const { gainedAtClassLevel } = metadata;
  const source = slot.grantedBy
    ? {
        kind: 'slot' as const,
        grantedBy: slot.grantedBy,
        slotIndex: slot.slotIndex,
      }
    : undefined;
  const candidate: SheetEntry = {
    _id: entryId,
    ...buildSelectionEntry({
      kind: slot.kind,
      catalogEntryId: catalog._id,
      slotId: slot.id,
      position: input.position,
      choice: input.choice,
      source,
    }),
    ...metadata,
  };
  const calculated = calculateCharacterSheet({
    entries: replaceRecordedSelection<SheetEntry>(snapshot.entries, candidate),
    catalogEntries: snapshot.catalogEntries,
    characterKind: snapshot.character.kind,
    sheetMode: snapshot.character.sheetMode,
  });
  const checks = entryChecks(calculated, entryId);
  const baselineWarningKeys = new Set(
    snapshot.calculated.selectionRules.warnings.map((warning) =>
      JSON.stringify([warning.check, warning.subject, warning.fingerprint]),
    ),
  );
  const warnings = calculated.warnings.filter(
    (warning) =>
      (warning.target.kind === 'entry' && warning.target.entryId === entryId) ||
      calculated.selectionRules.warnings.some(
        (candidate) =>
          candidate === warning &&
          !baselineWarningKeys.has(
            JSON.stringify([
              warning.check,
              warning.subject,
              warning.fingerprint,
            ]),
          ),
      ),
  );
  return {
    catalogEntryId: catalog._id,
    name: catalog.name,
    currentStatus: requirementStatus(
      checks.filter((check) => check.view === 'current'),
      slot.ignoresPrerequisites,
    ),
    recordedStatus:
      gainedAtClassLevel &&
      snapshot.entries.some(
        (entry) =>
          entry.kind === 'classLevel' && entry._id === gainedAtClassLevel,
      )
        ? requirementStatus(
            checks.filter((check) => check.view === 'recorded'),
            slot.ignoresPrerequisites,
          )
        : null,
    checks: checks
      .filter((check) => check.met !== null)
      .map((check) => ({
        ...check,
        label: prerequisiteLabel(check.clause, snapshot.catalogEntries),
      })),
    prerequisiteText: selectionPrerequisiteText(catalog),
    guidanceText: selectionGuidance(catalog),
    description: catalog.description ?? '',
    warnings,
    selectable: true,
  };
}

/** A sheet revision reuses previews until its inputs change. */
export function createSelectionSlotPreview(
  snapshot: CharacterSheetSnapshot | null | undefined,
) {
  const previews = new Map<string, ReturnType<typeof previewSelectionSlot>>();
  return (input: FillSelectionSlotInput) => {
    if (!snapshot) return null;
    const key = JSON.stringify(input);
    if (previews.has(key)) return previews.get(key) ?? null;
    const preview = previewSelectionSlot(snapshot, input);
    // Browsing and editing a long catalog keeps a bounded set of projections.
    if (previews.size >= 32) previews.clear();
    previews.set(key, preview);
    return preview;
  };
}
