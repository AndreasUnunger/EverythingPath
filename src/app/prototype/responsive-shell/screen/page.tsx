// PROTOTYPE — the framed screen for Wayfinder #120; the harness at /prototype/responsive-shell loads it in an iframe.
import { Suspense } from 'react';
import { ResponsiveShellScreen } from '~/components/responsive-shell-prototype/screen';

export default function ResponsiveShellScreenPage() {
  return (
    <Suspense>
      <ResponsiveShellScreen />
    </Suspense>
  );
}
