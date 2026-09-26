// PROTOTYPE — throwaway route for Wayfinder #120. Lives only on `prototype/responsive-shell`.
import { Suspense } from 'react';
import { ResponsiveShellPrototype } from '~/components/responsive-shell-prototype';

export default function ResponsiveShellPrototypePage() {
  return (
    <Suspense>
      <ResponsiveShellPrototype />
    </Suspense>
  );
}
