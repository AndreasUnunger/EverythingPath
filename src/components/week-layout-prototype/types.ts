// PROTOTYPE — props every week-layout variant receives.
import type { Knobs, Phase } from './mock';

export type VariantProps = {
  knobs: Knobs;
  phase: Phase;
  setPhase: (phase: Phase) => void;
};
