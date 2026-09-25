// PROTOTYPE — throwaway route for Wayfinder #102. Lives only on `prototype/navigation`.
import { Suspense } from 'react';
import { NavigationPrototype } from '~/components/navigation-prototype';

export default function NavigationPrototypePage() {
  return (
    <Suspense>
      <NavigationPrototype />
    </Suspense>
  );
}
