'use client';
// PROTOTYPE (throwaway, #216) — sheet variant 3, "Attack routines": saved Attack Routines (`routineSetups`, `store.addRoutine`/`updateRoutine`/`removeRoutine`).
// Owned by the variant 3 presentation agent. A stub for now: it
// re-exports the default blocks. Contract: CONTRACT.md, "Round 3".

import { DefensesBlock, OffenseBlock } from './sheet-default-blocks';
import type { SheetVariantSlots } from './sheet-variants';

export const v3Slots: SheetVariantSlots = {
  Defenses: DefensesBlock,
  Offense: OffenseBlock,
};
