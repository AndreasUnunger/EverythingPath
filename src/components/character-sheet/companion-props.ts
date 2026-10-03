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
