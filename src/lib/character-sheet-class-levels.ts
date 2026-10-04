import type { CharacterSheetInput, SheetEntry } from './character-sheet';
import { characterSheetClassFamily } from './character-sheet-grants';

type ClassLevel = Extract<SheetEntry, { kind: 'classLevel' }>;

export function compareClassLevelPosition(a: SheetEntry, b: SheetEntry) {
  const position = (entry: SheetEntry) =>
    entry.kind === 'classLevel' ? entry.state.position : 0;
  return position(a) - position(b);
}

export function classFamilyLevels(
  input: CharacterSheetInput,
  classIdentity: string,
) {
  return input.entries
    .filter((entry): entry is ClassLevel => {
      if (entry.kind !== 'classLevel') return false;
      const definition = input.catalogEntries.find(
        (candidate) => candidate._id === entry.state.classEntryId,
      );
      return (
        definition?.detail?.kind === 'class' &&
        (definition.ruleIdentity === classIdentity ||
          characterSheetClassFamily(definition, input.catalogEntries) ===
            classIdentity)
      );
    })
    .sort(compareClassLevelPosition);
}
