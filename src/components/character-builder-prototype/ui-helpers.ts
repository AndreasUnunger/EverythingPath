// PROTOTYPE (throwaway, #208) — tiny presentational helpers shared by the
// variants. No layout components on purpose.

import type { BonusType, Contribution, Stat } from './types';

/** "+2", "−1", "+0" (typographic minus). */
export function formatBonus(value: number) {
  return value < 0 ? `−${Math.abs(value)}` : `+${value}`;
}

export const BONUS_TYPE_LABEL: Record<BonusType, string> = {
  alchemical: 'alchemical',
  armor: 'armor',
  circumstance: 'circumstance',
  competence: 'competence',
  deflection: 'deflection',
  dodge: 'dodge',
  enhancement: 'enhancement',
  inherent: 'inherent',
  insight: 'insight',
  luck: 'luck',
  morale: 'morale',
  naturalArmor: 'natural armor',
  profane: 'profane',
  racial: 'racial',
  resistance: 'resistance',
  sacred: 'sacred',
  shield: 'shield',
  size: 'size',
  trait: 'trait',
  untyped: 'untyped',
  base: 'base',
};

/**
 * Text colour per bonus type, from the palette the app already uses
 * (amber is reserved for warnings, destructive for penalties/errors).
 */
export const BONUS_TYPE_CLASS: Record<BonusType, string> = {
  base: 'text-foreground',
  untyped: 'text-muted-foreground',
  racial: 'text-sky-300',
  trait: 'text-sky-300',
  enhancement: 'text-violet-300',
  armor: 'text-emerald-300',
  shield: 'text-emerald-300',
  naturalArmor: 'text-emerald-300',
  deflection: 'text-emerald-300',
  dodge: 'text-teal-300',
  resistance: 'text-indigo-300',
  morale: 'text-rose-300',
  luck: 'text-yellow-200',
  competence: 'text-cyan-300',
  insight: 'text-cyan-300',
  circumstance: 'text-muted-foreground',
  alchemical: 'text-lime-300',
  inherent: 'text-violet-300',
  profane: 'text-fuchsia-300',
  sacred: 'text-fuchsia-300',
  size: 'text-muted-foreground',
};

export const SEVERITY_CLASS = {
  warning: 'text-amber-300',
  prompt: 'text-sky-300',
  info: 'text-muted-foreground',
} as const;

/** One breakdown line: "Belt of giant strength +2 · +2 enhancement". */
export function contributionText(c: Contribution) {
  const type =
    c.bonusType === 'untyped' || c.bonusType === 'base'
      ? ''
      : ` ${BONUS_TYPE_LABEL[c.bonusType]}`;
  return `${c.label} · ${formatBonus(c.value)}${type}`;
}

/** Whether any applied contribution is temporary (show a "buffed" marker). */
export function isBuffed(stat: Stat) {
  return stat.applied.some((c) => c.temporary);
}

/** Ability modifier from a score. */
export function modOf(score: number) {
  return Math.floor((score - 10) / 2);
}
