'use client';
// PROTOTYPE variant D — "Militia rail, phone alt": the same tablet and desktop
// shell as C, with a drill-down phone pattern (Home · Characters · More, Up
// and a "Where to" navigator in the top bar). See variant-c-shell.tsx.
import type { ShellProps } from './types';
import { MilitiaRailShell } from './variant-c-shell';

export function VariantD(props: ShellProps) {
  return <MilitiaRailShell phone="drill" {...props} />;
}
