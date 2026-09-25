// PROTOTYPE — throwaway route for Wayfinder #108. Lives only on `prototype/event`.
import { Suspense } from 'react';
import { EventPrototype } from '~/components/event-prototype';

export default function EventPrototypePage() {
  return (
    <Suspense>
      <EventPrototype />
    </Suspense>
  );
}
