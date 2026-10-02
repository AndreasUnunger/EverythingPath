'use client';
// PROTOTYPE (throwaway, #216) — the living sheet's three variants for
// "Prototype attacks and conditional modifiers on the living sheet". Every
// page is the same; only the living sheet's slots differ. Each variant's
// slots live in its own file (v1-stat-block.tsx, v2-attack-table.tsx,
// v3-routines.tsx). Contract: CONTRACT.md, "Round 3".

import type { ComponentType } from 'react';
import { useProtoNav } from '../nav';
import type {
  Character,
  ResolvedSheet,
  SkillKey,
  SkillStat,
  Stat,
  StatPath,
} from '../types';
import { v1Slots } from './v1-stat-block';
import { v2Slots } from './v2-attack-table';
import { v3Slots } from './v3-routines';

export type SheetVariantKey = '1' | '2' | '3';

/** Props every sheet-wide slot gets: the Character and the sheet on screen (the lens sheet when a situation is set). */
export type SheetSlotProps = { character: Character; sheet: ResolvedSheet };

export type SheetVariantSlots = {
  /** The Defenses block (default: `DefensesBlock` in sheet-default-blocks.tsx). */
  Defenses: ComponentType<SheetSlotProps>;
  /** The Offense block (default: `OffenseBlock`); attacks go here. */
  Offense: ComponentType<SheetSlotProps>;
  /**
   * Appended at the bottom of the breakdown popover. `path` is null when the
   * popover shows an arbitrary Stat opened with `openStat` (then `openKey`
   * is the key given there).
   */
  BreakdownExtra?: ComponentType<
    SheetSlotProps & {
      path: StatPath | null;
      openKey: string;
      title: string;
      stat: Stat;
    }
  >;
  /**
   * True when `BreakdownExtra` renders its own section for the Stat's
   * `conditional` contributions: the popover then skips its default
   * "Only when…" list. Default false.
   */
  replacesConditionalSection?: boolean;
  /** Rendered beside a skill's total in the skills table. */
  SkillExtra?: ComponentType<
    SheetSlotProps & { skill: SkillKey; stat: SkillStat }
  >;
  /** Rendered under one figure in the pinned vitals row. */
  VitalExtra?: ComponentType<SheetSlotProps & { path: StatPath; stat: Stat }>;
  /** Rendered between the vitals row (and membership strip) and the sheet grid. */
  AboveSheet?: ComponentType<SheetSlotProps>;
};

export const SHEET_VARIANTS: {
  key: SheetVariantKey;
  name: string;
  slots: SheetVariantSlots;
}[] = [
  { key: '1', name: 'Stat-block lines', slots: v1Slots },
  { key: '2', name: 'Attack table', slots: v2Slots },
  { key: '3', name: 'Attack routines', slots: v3Slots },
];

/** The variant in `?variant=`; anything else (an old `B`, nothing) is variant 1. */
export function useSheetVariant(): {
  key: SheetVariantKey;
  slots: SheetVariantSlots;
} {
  const nav = useProtoNav();
  const variant =
    SHEET_VARIANTS.find((v) => v.key === nav.variant) ?? SHEET_VARIANTS[0]!;
  return { key: variant.key, slots: variant.slots };
}
