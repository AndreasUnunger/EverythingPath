// PROTOTYPE — throwaway route for Wayfinder #113. Lives only on `prototype/setup-correction`.
import { Suspense } from 'react';
import { SetupCorrectionPrototype } from '~/components/setup-correction-prototype';

export default function SetupCorrectionPrototypePage() {
  return (
    <Suspense>
      <SetupCorrectionPrototype />
    </Suspense>
  );
}
