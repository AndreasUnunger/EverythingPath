// PROTOTYPE — throwaway route for Wayfinder #106. Lives only on `prototype/activity-slots`.
import { Suspense } from 'react';
import { ActivitySlotsPrototype } from '~/components/activity-slots-prototype';

export default function ActivitySlotsPrototypePage() {
  return (
    <Suspense>
      <ActivitySlotsPrototype />
    </Suspense>
  );
}
