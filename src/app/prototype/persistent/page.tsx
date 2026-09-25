// PROTOTYPE — throwaway route for Wayfinder #109. Lives only on `prototype/persistent`.
import { Suspense } from 'react';
import { PersistentPrototype } from '~/components/persistent-prototype';

export default function PersistentPrototypePage() {
  return (
    <Suspense>
      <PersistentPrototype />
    </Suspense>
  );
}
