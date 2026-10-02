'use client';
// PROTOTYPE (throwaway, #216, #233) — the living sheet's variants. Round 3
// (#216) chose variant 3, "Attack routines": its slots (v3-routines.tsx) are
// now the fixed base for everyone. Round 4 (#233, "Prototype the
// spellcasting section on the living sheet") repurposes `?variant=1|2|3` for
// three spellcasting variants, each adding its own Spellcasting slots on top
// (s1-*.tsx, s2-*.tsx, s3-*.tsx). Contract: CONTRACT.md, "Round 4".

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
import type { Warning } from '../warnings';
import { s1Slots } from './s1-spell-cards';
import { s2Slots } from './s2-spell-ladder';
import { s3Slots } from './s3-spells-page';
import { v3Slots } from './v3-routines';

export type SheetVariantKey = '1' | '2' | '3';

/** Props every sheet-wide slot gets: the Character and the sheet on screen (the lens sheet when a situation is set). */
export type SheetSlotProps = { character: Character; sheet: ResolvedSheet };

/** PROTOTYPE (#233): spellcasting slots also get the Character's advisory warnings. */
export type SpellSlotProps = SheetSlotProps & { warnings: Warning[] };

/** PROTOTYPE (#233): what a spellcasting variant adds to the base (attack routines) slots. */
export type SpellVariantSlots = {
  /**
   * The Spellcasting section: one full-width grid cell after the row with
   * Attacks (left) and Skills (right), before Feats and Class features. On
   * phone it follows Skills. Rendered for every Full Character; render
   * nothing when `spellcastingsOf(character)` is empty.
   */
  Spellcasting?: ComponentType<SpellSlotProps>;
  /** Inside the pinned vitals row, after the figures (e.g. caster level and concentration). */
  VitalsExtra?: ComponentType<SpellSlotProps>;
  /**
   * `?page=spells`: replaces the sheet's grid under the vitals row (the
   * breakdown popover and `useSheetUi()` still work). Variants without it
   * show the sheet on that page.
   */
  SpellsPage?: ComponentType<SpellSlotProps>;
};

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
} & SpellVariantSlots;

export const SHEET_VARIANTS: {
  key: SheetVariantKey;
  name: string;
  slots: SheetVariantSlots;
}[] = [
  { key: '1', name: 'Spell cards', slots: { ...v3Slots, ...s1Slots } },
  { key: '2', name: 'Spell-level ladder', slots: { ...v3Slots, ...s2Slots } },
  { key: '3', name: 'Spells page', slots: { ...v3Slots, ...s3Slots } },
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
