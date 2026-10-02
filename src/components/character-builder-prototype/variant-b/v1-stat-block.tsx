'use client';
// PROTOTYPE (throwaway, #216) — sheet variant 1, "Stat-block lines": stat-block lines: situational and attack lines in the CRB stat-block style, e.g. "Ref +7 (+9 vs. traps)"; attacks from `autoSetups`.
// Owned by the variant 1 presentation agent. A stub for now: it
// re-exports the default blocks. Contract: CONTRACT.md, "Round 3".

import { DefensesBlock, OffenseBlock } from './sheet-default-blocks';
import type { SheetVariantSlots } from './sheet-variants';

export const v1Slots: SheetVariantSlots = {
  Defenses: DefensesBlock,
  Offense: OffenseBlock,
};
