import { z } from 'zod';

export function readObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? z.record(z.string(), z.unknown()).parse(value)
    : {};
}
export function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
export function readStrings(value: unknown): string[] {
  return readArray(value).filter(
    (item): item is string => typeof item === 'string',
  );
}
export function readNumber({
  value,
  fallback,
}: {
  value: unknown;
  fallback: number;
}): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
export function readText({
  value,
  fallback = '',
}: {
  value: unknown;
  fallback?: string;
}): string {
  return typeof value === 'string' ? value : fallback;
}
export function parseDelimitedStrings(value: unknown): string[] {
  if (typeof value !== 'string') return readStrings(value);
  return value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
}

export const skillNames: Record<string, string> = {
  acr: 'acrobatics',
  apr: 'appraise',
  art: 'artistry',
  blf: 'bluff',
  clm: 'climb',
  crf: 'craft',
  dip: 'diplomacy',
  dev: 'disableDevice',
  dis: 'disguise',
  esc: 'escapeArtist',
  fly: 'fly',
  han: 'handleAnimal',
  hea: 'heal',
  int: 'intimidate',
  kar: 'knowledgeArcana',
  kdu: 'knowledgeDungeoneering',
  ken: 'knowledgeEngineering',
  kge: 'knowledgeGeography',
  khi: 'knowledgeHistory',
  klo: 'knowledgeLocal',
  kna: 'knowledgeNature',
  kno: 'knowledgeNobility',
  kpl: 'knowledgePlanes',
  kre: 'knowledgeReligion',
  lin: 'linguistics',
  lor: 'lore',
  per: 'perception',
  prf: 'perform',
  pro: 'profession',
  rid: 'ride',
  sen: 'senseMotive',
  slt: 'sleightOfHand',
  spl: 'spellcraft',
  ste: 'stealth',
  sur: 'survival',
  swm: 'swim',
  umd: 'useMagicDevice',
};
