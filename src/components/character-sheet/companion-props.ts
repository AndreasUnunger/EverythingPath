import type { Id } from '@convex/_generated/dataModel';
import type { useCharacterCompanions } from './use-character-companions';

export type CompanionsController = ReturnType<typeof useCharacterCompanions>;
export type CompanionFieldProps = {
  controller: CompanionsController;
  isDisabled: boolean;
};
/** Remembers the control that opened an editor, to refocus when it closes. */
export type CompanionOpenerProps = {
  rememberOpener: (element: HTMLElement) => void;
};
/** What a relationship row needs to subscribe to its linked values. */
export type CompanionLinkedValueProps = {
  /** The viewed sheet, whichever side of the relationship it is on. */
  characterId: Id<'character'>;
  maintenanceMessage?: string;
};
