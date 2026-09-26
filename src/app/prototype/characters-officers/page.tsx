// PROTOTYPE — throwaway route for Wayfinder #114. Lives only on `prototype/characters-officers`.
import { Suspense } from 'react';
import { CharactersOfficersPrototype } from '~/components/characters-officers-prototype';

export default function CharactersOfficersPrototypePage() {
  return (
    <Suspense>
      <CharactersOfficersPrototype />
    </Suspense>
  );
}
