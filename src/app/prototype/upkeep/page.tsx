// PROTOTYPE — throwaway route for Wayfinder #107. Lives only on `prototype/upkeep`.
import { Suspense } from 'react';
import { UpkeepPrototype } from '~/components/upkeep-prototype';

export default function UpkeepPrototypePage() {
  return (
    <Suspense>
      <UpkeepPrototype />
    </Suspense>
  );
}
