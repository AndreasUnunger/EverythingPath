import {
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  type CharacterSheetInput,
} from '../character-sheet';
import { catalogRuntimeCompatibility } from './runtime-compatibility';

const priorCalculationIdentity =
  'sha256:7a6006e58cfc1d2ed3c438033e53b82ef1d70cc9569449ecb6d6f00d8cc3f366';

export function isSupportedCatalogCalculation(identity: string) {
  return (
    identity === priorCalculationIdentity ||
    identity === catalogRuntimeCompatibility.calculation
  );
}

function calculationInput(identity: string, input: CharacterSheetInput) {
  if (!isSupportedCatalogCalculation(identity))
    throw new Error('Unavailable Catalog Release calculation behavior');
  // The prior calculator uses the unchanged bundled tables and ignores release resources.
  // Future changes to those defaults require retaining their implementation separately.
  return identity === priorCalculationIdentity
    ? { ...input, resources: undefined }
    : input;
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
