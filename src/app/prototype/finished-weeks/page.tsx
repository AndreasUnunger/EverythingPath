// PROTOTYPE — throwaway route for Wayfinder #117. Lives only on `prototype/finished-weeks`.
import { Suspense } from 'react';
import { FinishedWeeksPrototype } from '~/components/finished-weeks-prototype';

export default function FinishedWeeksPrototypePage() {
  return (
    <Suspense>
      <FinishedWeeksPrototype />
    </Suspense>
  );
}
