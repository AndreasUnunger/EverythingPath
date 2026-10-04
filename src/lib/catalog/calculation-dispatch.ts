import {
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  type CharacterSheetInput,
} from '../character-sheet';
import { catalogRuntimeCompatibility } from './runtime-compatibility';

const priorCalculationIdentity =
  'sha256:c34f3f686fc800ec766394a7a8fb747d317da5de31e4d00def22c25c6542e5c6';

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
