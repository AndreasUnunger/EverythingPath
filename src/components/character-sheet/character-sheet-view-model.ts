import { parseCharacterSheetBreakdowns } from '~/lib/character-sheet-breakdowns';
import { abilityTargets, type Ability } from '~/lib/character-sheet';
import { characterLedgerDetails } from '~/lib/character-ledger';
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
    levels: snapshot.entries
      .filter((entry) => entry.kind === 'classLevel')
      .map((entry) => ({
        ...entry,
        className:
          entry.state.classEntryId === null
            ? 'Unspecified'
            : (snapshot.catalogEntries.find(
                (catalogEntry) => catalogEntry._id === entry.state.classEntryId,
              )?.name ?? 'Class unavailable'),
        isUnspecified: entry.state.classEntryId === null,
      })),
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
