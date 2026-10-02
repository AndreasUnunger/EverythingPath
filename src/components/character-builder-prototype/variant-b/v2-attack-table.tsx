'use client';
// PROTOTYPE (throwaway, #216) — sheet variant 2, "Attack table": an attack table from each weapon's `wield` (`wieldSetups`, `store.setWield`) and the situation lens (`ui.situation`).
// Owned by the variant 2 presentation agent. A stub for now: it
// re-exports the default blocks. Contract: CONTRACT.md, "Round 3".

import { DefensesBlock, OffenseBlock } from './sheet-default-blocks';
import type { SheetVariantSlots } from './sheet-variants';

export const v2Slots: SheetVariantSlots = {
  Defenses: DefensesBlock,
  Offense: OffenseBlock,
};
