// PROTOTYPE — throwaway route for wayfinder #208. Lives only on `prototype/character-builder`.
import { Suspense } from 'react';
import { CharacterBuilderPrototype } from '~/components/character-builder-prototype';

export default function CharacterBuilderPrototypePage() {
  return (
    <Suspense>
      <CharacterBuilderPrototype />
    </Suspense>
  );
}
