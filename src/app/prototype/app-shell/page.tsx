// PROTOTYPE — throwaway route for the app-shell restructure. Lives only on `prototype/app-shell`.
import { Suspense } from 'react';
import { AppShellPrototype } from '~/components/app-shell-prototype';

export default function AppShellPrototypePage() {
  return (
    <Suspense>
      <AppShellPrototype />
    </Suspense>
  );
}
