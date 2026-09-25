// PROTOTYPE — shared contract between the navigation variants and the switcher.
import type { Place } from './mock';

export type VariantProps = {
  place: Place;
  go: (patch: Partial<Place>) => void;
};
