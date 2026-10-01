// PROTOTYPE (throwaway, #208) — Variant A: small rules lookups the wizard
// shows beside a choice ("Rogue 4 gives Uncanny Dodge, +1 BAB").

import { CATALOG_BY_KEY, classDetail, type ClassDetail } from '../catalog';
import type { Warning } from '../warnings';

export const WIZARD_STEPS = [
  { key: 'concept', label: 'Concept', short: 'Concept' },
  { key: 'race', label: 'Race', short: 'Race' },
  { key: 'abilities', label: 'Ability scores', short: 'Abilities' },
  { key: 'classes', label: 'Class', short: 'Class' },
  { key: 'hp', label: 'Hit points', short: 'HP' },
  { key: 'skills', label: 'Skills', short: 'Skills' },
  { key: 'feats', label: 'Feats & traits', short: 'Feats' },
  { key: 'gear', label: 'Gear & effects', short: 'Gear' },
  { key: 'review', label: 'Review', short: 'Review' },
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number]['key'];

export function isWizardStep(value: string | null): value is WizardStep {
  return WIZARD_STEPS.some((s) => s.key === value);
}

/** Which wizard step a warning belongs to, for the rail badges and the review. */
export function stepOfWarning(w: Warning): WizardStep {
  if (w.where === 'race') return 'race';
  if (w.where === 'abilities') return 'abilities';
  if (w.where === 'skills') return 'skills';
  if (w.where === 'feats' || w.where === 'features') return 'feats';
  if (w.where.startsWith('entry:')) return 'feats';
  if (w.where === 'level') return 'concept';
  if (w.where.startsWith('classLevel:')) {
    if (w.id.endsWith('-unspecified')) return 'classes';
    if (w.id.includes('-hp')) return 'hp';
    if (w.id.includes('-increase')) return 'abilities';
    if (w.id.includes('-fcb')) return 'hp';
    if (w.id.includes('-ranks')) return 'skills';
    if (w.id.includes('-pick-') || w.id.includes('-missing-')) return 'feats';
    return 'classes';
  }
  return 'review';
}

export function babAt(bab: ClassDetail['bab'], n: number) {
  if (bab === 'full') return n;
  if (bab === 'threeQuarters') return Math.floor((n * 3) / 4);
  return Math.floor(n / 2);
}

export function saveAt(kind: 'good' | 'poor', n: number) {
  return kind === 'good' ? 2 + Math.floor(n / 2) : Math.floor(n / 3);
}

/** What taking level `n` of a class adds, as short strings. */
export function classLevelGives(classKey: string, n: number): string[] {
  const detail = classDetail(classKey);
  if (!detail) return [];
  const out: string[] = [];
  const dBab = babAt(detail.bab, n) - babAt(detail.bab, n - 1);
  if (dBab) out.push(`BAB +${dBab}`);
  for (const save of ['fort', 'ref', 'will'] as const) {
    const d = saveAt(detail.saves[save], n) - saveAt(detail.saves[save], n - 1);
    if (d) out.push(`${save === 'fort' ? 'Fort' : save === 'ref' ? 'Ref' : 'Will'} +${d}`);
  }
  for (const grant of detail.featuresByLevel.filter((g) => g.classLevel === n))
    out.push(
      'catalogKey' in grant
        ? (CATALOG_BY_KEY[grant.catalogKey]?.name ?? grant.catalogKey)
        : `${grant.label} (pick)`,
    );
  return out;
}

export const BAB_LABEL: Record<ClassDetail['bab'], string> = {
  full: 'full BAB',
  threeQuarters: '¾ BAB',
  half: '½ BAB',
};

export function goodSaves(detail: ClassDetail) {
  return (['fort', 'ref', 'will'] as const)
    .filter((s) => detail.saves[s] === 'good')
    .map((s) => (s === 'fort' ? 'Fort' : s === 'ref' ? 'Ref' : 'Will'));
}
