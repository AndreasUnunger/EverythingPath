import { parseCharacterSheetBreakdowns } from '~/lib/character-sheet-breakdowns';
import { abilityTargets, type Ability } from '~/lib/character-sheet';
import { characterLedgerDetails } from '~/lib/character-ledger';
import { isCatalogSheetEntry } from '~/lib/character-sheet-entries';
import type {
  CharacterSheetSnapshot,
  SheetWarningView,
} from './use-character-sheet';

export function buildCharacterSheetView(snapshot: CharacterSheetSnapshot) {
  const calculated = {
    ...snapshot.calculated,
    breakdowns: parseCharacterSheetBreakdowns(snapshot.calculated.breakdowns),
  };
  function baseScore(ability: Ability) {
    const modifier = snapshot.baseScoresEntry.modifiers.find(
      (item) =>
        item.target === abilityTargets[ability] && item.bonusType === 'base',
    );
    if (!modifier) throw new Error('Base score is unavailable.');
    return modifier.value;
  }

  const classChoices = snapshot.catalogEntries.filter(
    (entry) => entry.detail.kind === 'class' && 'hitDie' in entry.detail,
  );
  const { canBuildOut } = characterLedgerDetails(snapshot.character);
  const minimal = canBuildOut;
  const warning = minimal
    ? (calculated.warnings.find((warning) => warning.check === 'levelZero')
        ?.message ?? null)
    : null;
  return {
    character: snapshot.character,
    owner: snapshot.owner,
    campaign: snapshot.campaign,
    canBuildOut,
    calculated,
    permanentCalculated: {
      ...snapshot.permanentCalculated,
      breakdowns: parseCharacterSheetBreakdowns(
        snapshot.permanentCalculated.breakdowns,
      ),
    },
    abilityChanges: snapshot.entries.filter(
      (entry) =>
        entry.kind === 'abilityDamage' || entry.kind === 'abilityDrain',
    ),
    sheetEntries: snapshot.entries.filter(isCatalogSheetEntry).map((entry) => {
      const catalog = snapshot.catalogEntries.find(
        (row) => row._id === entry.catalogEntryId,
      );
      if (!catalog || !isCatalogSheetEntry(catalog.detail))
        throw new Error('Character Sheet Entry is unavailable.');
      return {
        entryId: entry._id,
        active: entry.active,
        name: catalog.name,
        modifiers: catalog.modifiers,
        detail: catalog.detail,
        state: entry.state,
      };
    }),
    baseScores: {
      strength: baseScore('strength'),
      dexterity: baseScore('dexterity'),
      constitution: baseScore('constitution'),
      intelligence: baseScore('intelligence'),
      wisdom: baseScore('wisdom'),
      charisma: baseScore('charisma'),
    },
    adjustments: snapshot.entries
      .filter((entry) => entry.kind === 'manual')
      .map((entry) => {
        const catalogEntry = snapshot.catalogEntries.find(
          (item) => item._id === entry.catalogEntryId,
        );
        if (!catalogEntry)
          throw new Error('Personal adjustment is unavailable.');
        return {
          entryId: entry._id,
          catalogEntryId: catalogEntry._id,
          active: entry.active,
          name: catalogEntry.name,
          modifiers: catalogEntry.modifiers,
        };
      }),
    classChoices,
    favoredClassIds:
      snapshot.entries.find((entry) => entry.kind === 'base')?.state
        .favoredClassIds ?? [],
    unplacedSelections: snapshot.entries.filter(
      (entry) =>
        entry.kind === 'manual' &&
        entry.gainedAtClassLevel !== undefined &&
        !snapshot.entries.some(
          (level) =>
            level.kind === 'classLevel' &&
            level._id === entry.gainedAtClassLevel,
        ),
    ),
    levels: snapshot.entries
      .filter((entry) => entry.kind === 'classLevel')
      .map((entry) => {
        const selected = classChoices.find(
          (choice) => choice._id === entry.state.classEntryId,
        );
        return {
          ...entry,
          className: selected?.name ?? 'Unspecified',
          isUnspecified: selected === undefined,
        };
      }),
    warning,
    warnings: calculated.warnings.map(
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
    showMissingChoices: !minimal,
  };
}
