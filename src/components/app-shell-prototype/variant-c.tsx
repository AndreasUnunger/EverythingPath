'use client';
// PROTOTYPE variant C — "Militia rail" with fixed phone tabs
// (Campaign · Militia · Characters · More). See variant-c-shell.tsx.
import type { ShellProps } from './types';
import { MilitiaRailShell } from './variant-c-shell';

export function VariantC(props: ShellProps) {
  return <MilitiaRailShell phone="tabs" {...props} />;
}
