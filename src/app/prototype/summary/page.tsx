// PROTOTYPE — throwaway route for Wayfinder #110. Lives only on `prototype/summary`.
import { Suspense } from 'react';
import { SummaryPrototype } from '~/components/summary-prototype';

export default function SummaryPrototypePage() {
  return (
    <Suspense>
      <SummaryPrototype />
    </Suspense>
  );
}
