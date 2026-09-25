// PROTOTYPE — throwaway route for Wayfinder #101. Lives only on `prototype/week-layout`.
import { Suspense } from 'react';
import { WeekLayoutPrototype } from '~/components/week-layout-prototype';

export default function WeekLayoutPrototypePage() {
  return (
    <Suspense>
      <WeekLayoutPrototype />
    </Suspense>
  );
}
