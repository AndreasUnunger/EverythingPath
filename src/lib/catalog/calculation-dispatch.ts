import {
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  type CharacterSheetInput,
} from '../character-sheet';
import { catalogRuntimeCompatibility } from './runtime-compatibility';

const priorCalculationIdentity =
  'sha256:404dc533a4f5212248f8c8aa720de4115d85196b171e802d6d2cceff56aa9982';

export function isSupportedCatalogCalculation(identity: string) {
  return (
    identity === priorCalculationIdentity ||
    identity === catalogRuntimeCompatibility.calculation
  );
}

function calculationInput(identity: string, input: CharacterSheetInput) {
  if (!isSupportedCatalogCalculation(identity))
    throw new Error('Unavailable Catalog Release calculation behavior');
  // Both supported calculators consume reviewed release resources over the bundled tables.
  // Future changes to those defaults require retaining their implementation separately.
  return input;
}

export function calculateCharacterSheetForRelease(
  identity: string,
  input: CharacterSheetInput,
  options?: Parameters<typeof calculateCharacterSheet>[1],
) {
  return calculateCharacterSheet(calculationInput(identity, input), options);
}

export function calculateCharacterSheetProjectionsForRelease(
  identity: string,
  input: CharacterSheetInput,
  options?: Parameters<typeof calculateCharacterSheetProjections>[1],
) {
  return calculateCharacterSheetProjections(
    calculationInput(identity, input),
    options,
  );
}
