// PROTOTYPE — throwaway route for Wayfinder #121. Lives only on `prototype/responsive-pages`.
import { Suspense } from 'react';
import { ResponsivePagesPrototype } from '~/components/responsive-pages-prototype';

export default function ResponsivePagesPrototypePage() {
  return (
    <Suspense>
      <ResponsivePagesPrototype />
    </Suspense>
  );
}
