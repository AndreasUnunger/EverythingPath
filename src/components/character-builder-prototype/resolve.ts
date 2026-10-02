// PROTOTYPE (throwaway, #208) — the pure resolver, mirroring the stages in
// docs/pf-character-sheet-data-model.md: ability scores → ability modifiers
// → class bases (BAB, base saves, Hit Dice) → dependent statistics.
// Every statistic reports `applied` and `suppressed` contributions.
//
// Round 3 (#216): a Modifier may carry a `condition`. A situational one
// applies only when its situation is asked for (`opts.situations`), a
// `whileActive` one only while that entry is active, a weapon-scoped one only
// inside attack resolution (`opts.weapon`, used by attacks.ts). Unmet ones are
// listed on each statistic's `conditional`, outside the total. Stacking runs
// only over the contributions that apply, so a situation asked for stacks and
// suppresses like any other bonus, and two situations of one entry (dwarven
// hardy: poison, spells) never suppress each other unless both are asked for.

import {
  ABILITY_SHORT,
  SITUATION_TEXT,
  SKILLS,
  classDetail,
  classSlug,
} from './catalog';
import {
  classLevelShortLabel,
  classLevels,
  className,
  hitDice as countHitDice,
  isTemporary,
  lookupCatalog,
  racialHitDice as raceHitDice,
} from './sheet';
import {
  ABILITIES,
  SITUATION_KEYS,
  type AbilityKey,
  type AcLeaf,
  type BonusType,
  type CatalogEntry,
  type Character,
  type ConditionalContribution,
  type Contribution,
  type ExtraDamage,
  type LeafTarget,
  type Modifier,
  type ModifierCondition,
  type ResolvedSheet,
  type SaveKey,
  type SheetEntry,
  type SheetSituation,
  type SituationKey,
  type SkillKey,
  type SkillStat,
  type Stat,
  type StatPath,
  type Suppressed,
  type Target,
} from './types';

const STACKING: ReadonlySet<BonusType> = new Set([
  'dodge',
  'racial',
  'untyped',
  'circumstance',
]);

/** AC bonus types that also reach CMD. */
const CMD_TYPES: ReadonlySet<BonusType> = new Set([
  'circumstance',
  'deflection',
  'dodge',
  'insight',
  'luck',
  'morale',
  'profane',
  'sacred',
]);

const AC_LEAVES: AcLeaf[] = ['ac.armor', 'ac.shield', 'ac.natural', 'ac.other'];
const SAVES: SaveKey[] = ['fort', 'ref', 'will'];
const SAVE_ABILITY: Record<SaveKey, AbilityKey> = {
  fort: 'con',
  ref: 'dex',
  will: 'wis',
};

// ------------------------------------------------------------------ formulas

type FormulaContext = {
  level: number;
  hitDice: number;
  bab: number;
  classLevel: Record<string, number>;
  abilityMod: Partial<Record<AbilityKey, number>>;
};

/** Stage of a target: 1 ability scores, 3 class bases (bab), 4 the rest. */
function targetStage(target: LeafTarget) {
  if (target.startsWith('ability.')) return 1;
  if (target === 'bab') return 3;
  return 4;
}

/**
 * Evaluates the closed formula grammar: integers, + - * /, parentheses,
 * floor/ceil/min/max, and @level, @classLevel.<key>, @hitDice,
 * @ability.<key>.mod, @bab. Reading a stage that isn't earlier than the
 * target's is unsupported.
 */
export function evaluateFormula(
  formula: string,
  ctx: FormulaContext,
  stage: number,
): { value: number } | { error: string } {
  const tokens = formula.match(/@[\w.]+|\d+|[A-Za-z]+|[-+*/(),]/g) ?? [];
  if (tokens.join('') !== formula.replace(/\s+/g, ''))
    return { error: `Unsupported characters in "${formula}"` };
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  const fail = (msg: string): never => {
    throw new Error(msg);
  };
  const variable = (name: string): number => {
    const parts = name.slice(1).split('.');
    const [head, key, tail] = parts;
    const needs = (varStage: number) => {
      if (varStage >= stage)
        fail(`${name} is not available before this statistic`);
    };
    if (head === 'level' && parts.length === 1) return (needs(3), ctx.level);
    if (head === 'hitDice' && parts.length === 1)
      return (needs(3), ctx.hitDice);
    if (head === 'bab' && parts.length === 1) return (needs(3), ctx.bab);
    if (head === 'classLevel' && key && parts.length === 2)
      return (needs(3), ctx.classLevel[key] ?? 0);
    if (head === 'ability' && key && tail === 'mod' && parts.length === 3) {
      needs(2);
      const value = ctx.abilityMod[key as AbilityKey];
      return value ?? fail(`Unknown ability ${key}`);
    }
    return fail(`Unknown variable ${name}`);
  };
  const primary = (): number => {
    const t = next();
    if (t === undefined) return fail('Unexpected end');
    if (/^\d+$/.test(t)) return Number(t);
    if (t.startsWith('@')) return variable(t);
    if (t === '(') {
      const v = expr();
      if (next() !== ')') fail('Missing )');
      return v;
    }
    if (['floor', 'ceil', 'min', 'max'].includes(t)) {
      if (next() !== '(') fail(`Missing ( after ${t}`);
      const args = [expr()];
      while (peek() === ',') {
        next();
        args.push(expr());
      }
      if (next() !== ')') fail('Missing )');
      if (t === 'floor') return Math.floor(args[0]!);
      if (t === 'ceil') return Math.ceil(args[0]!);
      return t === 'min' ? Math.min(...args) : Math.max(...args);
    }
    return fail(`Unexpected "${t}"`);
  };
  const unary = (): number => (peek() === '-' ? (next(), -unary()) : primary());
  const term = (): number => {
    let v = unary();
    while (peek() === '*' || peek() === '/') {
      const op = next();
      const r = unary();
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  const expr = (): number => {
    let v = term();
    while (peek() === '+' || peek() === '-') {
      const op = next();
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };
  try {
    const value = expr();
    if (i !== tokens.length) fail(`Unexpected "${peek()}"`);
    if (!Number.isFinite(value)) fail('Not a number');
    return { value: Math.floor(value) };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

// ------------------------------------------------------------- collecting

type Candidate = {
  label: string;
  bonusType: BonusType;
  raw: Modifier['value'];
  target: LeafTarget;
  entryId: string;
  source: string;
  stacksWithItself: boolean;
  temporary: boolean;
  /** The entry's choice (Weapon Focus's weapon), for `weapon: '$choice'`. */
  choice: string | null;
  condition?: ModifierCondition;
  /** The weapon part of the condition as text ("with greataxe"). */
  weaponText?: string;
};

function expandTarget(target: Target, choice: string | null): LeafTarget[] {
  if (target === 'ac') return ['ac.other'];
  if (target === 'saves') return ['save.fort', 'save.ref', 'save.will'];
  if (target === 'attack') return ['attack.melee', 'attack.ranged'];
  if (target === 'damage') return ['damage.melee', 'damage.ranged'];
  if (target === 'skill.$choice')
    return choice ? [`skill.${choice}` as LeafTarget] : [];
  if (target === 'ability.$choice')
    return choice ? [`ability.${choice}` as LeafTarget] : [];
  return [target];
}

/** Weapon names compare case- and space-insensitively ("Dwarven waraxe" = "dwarven  waraxe"). */
export const weaponName = (name: string | null | undefined) =>
  (name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Melee or ranged, for a weapon's handedness. */
const weaponKind = (handedness: string) =>
  handedness === 'ranged' ? 'ranged' : 'melee';

/**
 * Which attack/damage leaves a weapon-scoped Modifier can reach: its own
 * weapon's kind for `$self`; for `$choice`, the kinds of the Character's
 * weapons with that base (both when none match).
 */
function weaponLeafKinds(
  character: Character,
  catalog: CatalogEntry,
  scope: '$self' | '$choice',
  choice: string | null,
): Set<'melee' | 'ranged'> {
  if (scope === '$self')
    return catalog.detail.kind === 'item' && catalog.detail.weapon
      ? new Set([weaponKind(catalog.detail.weapon.handedness)])
      : new Set(['melee', 'ranged']);
  const kinds = new Set<'melee' | 'ranged'>();
  for (const e of character.entries) {
    const detail = lookupCatalog(character, e.catalogKey)?.detail;
    if (
      e.active &&
      detail?.kind === 'item' &&
      detail.weapon &&
      weaponName(detail.weapon.base) === weaponName(choice)
    )
      kinds.add(weaponKind(detail.weapon.handedness));
  }
  return kinds.size ? kinds : new Set(['melee', 'ranged']);
}

/** Entries that count: active, and permanent when only permanent ones are asked for. */
function counts(
  character: Character,
  entry: SheetEntry,
  permanentOnly: boolean,
) {
  return entry.active && !(permanentOnly && isTemporary(character, entry));
}

function collect(character: Character, permanentOnly: boolean) {
  const byTarget = new Map<LeafTarget, Candidate[]>();
  for (const entry of character.entries) {
    if (!entry.catalogKey || !counts(character, entry, permanentOnly)) continue;
    const temporary = isTemporary(character, entry);
    const catalog = lookupCatalog(character, entry.catalogKey);
    if (!catalog) continue;
    const choice =
      entry.state.kind === 'race'
        ? entry.state.abilityChoice
        : 'choice' in entry.state
          ? (entry.state.choice ?? null)
          : null;
    for (const modifier of catalog.modifiers) {
      const scope = modifier.condition?.weapon;
      const kinds = scope
        ? weaponLeafKinds(character, catalog, scope, choice)
        : null;
      const weaponText =
        scope === '$self'
          ? `with ${catalog.name}`
          : scope === '$choice'
            ? choice
              ? `with ${choice}`
              : 'with the chosen weapon'
            : undefined;
      for (const target of expandTarget(modifier.target, choice)) {
        if (kinds) {
          const leafKind = target.endsWith('.melee')
            ? 'melee'
            : target.endsWith('.ranged')
              ? 'ranged'
              : null;
          if (leafKind && !kinds.has(leafKind)) continue;
        }
        const list = byTarget.get(target) ?? [];
        list.push({
          label: catalog.detail.kind === 'base' ? 'Base score' : catalog.name,
          bonusType: modifier.bonusType,
          raw: modifier.value,
          target,
          entryId: entry.id,
          source: catalog.sourceKey ?? catalog.key,
          stacksWithItself: catalog.stacksWithItself,
          temporary,
          choice,
          condition: modifier.condition,
          weaponText,
        });
        byTarget.set(target, list);
      }
    }
  }
  return byTarget;
}

// ------------------------------------------------------------- conditions

type ConditionContext = {
  situations: ReadonlySet<SituationKey>;
  /** Catalog keys of the entries that count (for `whileActive`). */
  activeKeys: ReadonlySet<string>;
  weapon?: { entryId: string; base: string };
};

/** "vs. spells…, while raging", "with greataxe". */
function conditionText(c: Candidate) {
  return [
    c.condition?.situation?.text,
    c.condition?.whileActive?.text,
    c.weaponText,
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * Whether a candidate's condition holds. `ignore`: a weapon-scoped Modifier
 * of another weapon during attack resolution, which isn't even listed.
 */
function checkCondition(
  c: Candidate,
  ctx: ConditionContext,
): 'met' | 'ignore' | { waitingOn?: string } {
  const cond = c.condition;
  if (!cond) return 'met';
  if (cond.weapon && ctx.weapon) {
    const matches =
      cond.weapon === '$self'
        ? c.entryId === ctx.weapon.entryId
        : weaponName(c.choice) !== '' &&
          weaponName(c.choice) === weaponName(ctx.weapon.base);
    if (!matches) return 'ignore';
  }
  const weaponMet = !cond.weapon || Boolean(ctx.weapon);
  const situationMet =
    !cond.situation || ctx.situations.has(cond.situation.key);
  const activeMet =
    !cond.whileActive || ctx.activeKeys.has(cond.whileActive.catalogKey);
  if (weaponMet && situationMet && activeMet) return 'met';
  return activeMet ? {} : { waitingOn: cond.whileActive!.text };
}

// --------------------------------------------------------------- stacking

type Evaluated = Contribution & {
  entryId: string;
  source: string;
  stacksWithItself: boolean;
};

/** A contribution as reported: without the stacking bookkeeping. */
const strip = ({
  source: _s,
  stacksWithItself: _w,
  ...c
}: Evaluated): Contribution => c;

const builtIn = (
  label: string,
  value: number,
  target: Contribution['target'],
  opts: { bonusType?: BonusType; temporary?: boolean } = {},
): Contribution => ({
  label,
  value,
  target,
  bonusType: opts.bonusType ?? 'untyped',
  builtIn: true,
  temporary: opts.temporary ?? false,
});

/**
 * Stacks one leaf's authored contributions: same entry, then same Source,
 * then bonus type (stacking types sum, others highest; untyped penalties
 * sum, typed penalties worst).
 */
function stackLeaf(list: Evaluated[]): {
  applied: Contribution[];
  suppressed: Suppressed[];
} {
  const suppressed: Suppressed[] = [];

  // 1. Within one entry, the same type doesn't stack: keep the largest magnitude.
  const byEntryType = new Map<string, Evaluated>();
  for (const c of list) {
    const key = `${c.entryId}|${c.bonusType}`;
    const held = byEntryType.get(key);
    if (!held) byEntryType.set(key, c);
    else {
      const [keep, drop] =
        Math.abs(c.value) > Math.abs(held.value) ? [c, held] : [held, c];
      byEntryType.set(key, keep);
      suppressed.push({
        contribution: strip(drop),
        by: keep.label,
        reason: 'sameEntry',
      });
    }
  }
  let pool = [...byEntryType.values()];

  // 2. Same Source: only the entry with the largest net contribution applies.
  const bySource = new Map<string, Evaluated[]>();
  for (const c of pool)
    bySource.set(c.source, [...(bySource.get(c.source) ?? []), c]);
  pool = [];
  for (const group of bySource.values()) {
    const entryIds = [...new Set(group.map((c) => c.entryId))];
    if (entryIds.length < 2 || group[0]!.stacksWithItself) {
      pool.push(...group);
      continue;
    }
    const net = (id: string) =>
      group.filter((c) => c.entryId === id).reduce((a, c) => a + c.value, 0);
    const winner = entryIds.reduce((best, id) =>
      net(id) > net(best) ? id : best,
    );
    const winnerLabel = group.find((c) => c.entryId === winner)!.label;
    for (const c of group) {
      if (c.entryId === winner) pool.push(c);
      else
        suppressed.push({
          contribution: strip(c),
          by: winnerLabel,
          reason: 'sameSource',
        });
    }
  }

  // 3. Bonus type.
  const applied: Contribution[] = [];
  const byType = new Map<string, Evaluated[]>();
  for (const c of pool) {
    if (c.value === 0) continue;
    const key = `${c.bonusType}|${c.value > 0 ? '+' : '-'}`;
    byType.set(key, [...(byType.get(key) ?? []), c]);
  }
  for (const [key, group] of byType) {
    const positive = key.endsWith('+');
    const type = group[0]!.bonusType;
    const stacks = positive ? STACKING.has(type) : type === 'untyped';
    if (stacks) {
      applied.push(...group.map(strip));
      continue;
    }
    const best = group.reduce((a, c) =>
      positive ? (c.value > a.value ? c : a) : c.value < a.value ? c : a,
    );
    applied.push(strip(best));
    for (const c of group)
      if (c !== best)
        suppressed.push({
          contribution: strip(c),
          by: best.label,
          reason: 'bonusType',
        });
  }
  return { applied, suppressed };
}

const sum = (list: Contribution[]) => list.reduce((a, c) => a + c.value, 0);

// --------------------------------------------------------------- resolving

export type ResolveOptions = {
  /** Permanent entries only (militia facts, skill-rank budget). */
  permanentOnly?: boolean;
  /** Situations asked for: their situational Modifiers apply (and stack) normally. */
  situations?: readonly SituationKey[];
  /**
   * Attack resolution only (attacks.ts): weapon-scoped Modifiers of this
   * weapon apply to the attack and damage leaves; other weapons' are ignored.
   */
  weapon?: { entryId: string; base: string };
};

export function resolveSheet(
  character: Character,
  opts: ResolveOptions = {},
): ResolvedSheet {
  const permanentOnly = opts.permanentOnly ?? false;
  const notes: string[] = [];
  const candidates = collect(character, permanentOnly);
  const situationsAsked = SITUATION_KEYS.filter((k) =>
    opts.situations?.includes(k),
  );
  const conditions: ConditionContext = {
    situations: new Set(situationsAsked),
    activeKeys: new Set(
      character.entries.flatMap((e) =>
        e.catalogKey && counts(character, e, permanentOnly)
          ? [e.catalogKey]
          : [],
      ),
    ),
    weapon: opts.weapon,
  };
  const levels = classLevels(character);
  const hitDice = countHitDice(character);

  const ctx: FormulaContext = {
    level: levels.length,
    hitDice,
    bab: 0,
    classLevel: {},
    abilityMod: {},
  };
  for (const l of levels)
    if (l.state.classKey) {
      const slug = classSlug(l.state.classKey);
      ctx.classLevel[slug] = (ctx.classLevel[slug] ?? 0) + 1;
    }

  /** One leaf's authored contributions: those that apply, and those waiting on a condition. */
  const evaluate = (
    target: LeafTarget,
  ): { eligible: Evaluated[]; conditional: ConditionalContribution[] } => {
    const eligible: Evaluated[] = [];
    const conditional: ConditionalContribution[] = [];
    for (const c of candidates.get(target) ?? []) {
      const check = checkCondition(c, conditions);
      if (check === 'ignore') continue;
      let value: number;
      if (typeof c.raw === 'number') value = c.raw;
      else {
        const result = evaluateFormula(c.raw.formula, ctx, targetStage(target));
        if ('error' in result) {
          notes.push(
            `${c.label}: formula "${c.raw.formula}" on ${target} is unsupported (${result.error}) and adds nothing.`,
          );
          continue;
        }
        value = result.value;
      }
      const text = c.condition ? conditionText(c) : undefined;
      const situationKey = c.condition?.situation?.key;
      const contribution: Evaluated = {
        label: c.label,
        bonusType: c.bonusType,
        value,
        builtIn: false,
        temporary: c.temporary,
        target,
        entryId: c.entryId,
        source: c.source,
        stacksWithItself: c.stacksWithItself,
        ...(text ? { conditionText: text } : {}),
        ...(situationKey ? { situationKey } : {}),
      };
      if (check === 'met') eligible.push(contribution);
      else
        conditional.push({
          ...strip(contribution),
          conditionText: text ?? '',
          ...(check.waitingOn ? { waitingOn: check.waitingOn } : {}),
          ...(c.weaponText && !conditions.weapon
            ? { weapon: c.weaponText }
            : {}),
        });
    }
    return { eligible, conditional };
  };

  /** Built-ins always apply; authored contributions stack; conditional ones wait. */
  const statOf = (target: LeafTarget, builtIns: Contribution[]): Stat => {
    const { eligible, conditional } = evaluate(target);
    const { applied, suppressed } = stackLeaf(eligible);
    // Base-type contributions (base score, ranks, BAB, hp rolled) lead the breakdown.
    const all = [...builtIns, ...applied].sort(
      (a, b) => Number(b.bonusType === 'base') - Number(a.bonusType === 'base'),
    );
    return { total: sum(all), applied: all, suppressed, conditional };
  };

  // Stage 1: ability scores.
  const abilities = {} as Record<AbilityKey, Stat>;
  for (const ability of ABILITIES) {
    const builtIns: Contribution[] = [];
    for (const l of levels)
      if (l.state.abilityIncrease === ability)
        builtIns.push({
          ...builtIn(
            `Ability increase (${classLevelShortLabel(character, l.id)} · level ${l.state.position})`,
            1,
            `ability.${ability}`,
          ),
          entryId: l.id,
        });
    for (const e of character.entries)
      if (
        e.active &&
        e.state.kind === 'abilityDrain' &&
        e.state.ability === ability
      )
        builtIns.push({
          ...builtIn('Ability drain', -e.state.points, `ability.${ability}`),
          entryId: e.id,
        });
    abilities[ability] = statOf(`ability.${ability}`, builtIns);
  }

  // Stage 2: ability modifiers (ability damage lowers the modifier only).
  const abilityMods = {} as Record<AbilityKey, Stat>;
  for (const ability of ABILITIES) {
    const score = abilities[ability];
    const temporary = score.applied.some((c) => c.temporary);
    const applied: Contribution[] = [
      builtIn(
        `${ABILITY_SHORT[ability]} ${score.total}`,
        Math.floor((score.total - 10) / 2),
        'derived',
        { bonusType: 'base', temporary },
      ),
    ];
    if (!permanentOnly)
      for (const e of character.entries)
        if (
          e.active &&
          e.state.kind === 'abilityDamage' &&
          e.state.ability === ability
        )
          applied.push({
            ...builtIn(
              `Ability damage ${e.state.points}`,
              -Math.floor(e.state.points / 2),
              'derived',
              { temporary: true },
            ),
            entryId: e.id,
          });
    abilityMods[ability] = {
      total: sum(applied),
      applied,
      suppressed: [],
      conditional: [],
    };
    ctx.abilityMod[ability] = abilityMods[ability].total;
  }
  const mod = (
    ability: AbilityKey,
    target: Contribution['target'],
    label?: string,
  ) =>
    builtIn(
      label ?? `${ABILITY_SHORT[ability]} modifier`,
      abilityMods[ability].total,
      target,
      {
        temporary: abilityMods[ability].applied.some((c) => c.temporary),
      },
    );

  // Stage 3: class bases.
  const classes: ResolvedSheet['classes'] = [];
  for (const l of levels) {
    const row = classes.find((c) => c.classKey === l.state.classKey);
    if (row) row.levels += 1;
    else
      classes.push({
        classKey: l.state.classKey,
        name: className(l.state.classKey),
        levels: 1,
      });
  }
  const babBuiltIns: Contribution[] = [];
  const saveBuiltIns: Record<SaveKey, Contribution[]> = {
    fort: [],
    ref: [],
    will: [],
  };
  for (const c of classes) {
    const detail = classDetail(c.classKey);
    if (!detail) continue;
    const n = c.levels;
    const bab =
      detail.bab === 'full'
        ? n
        : detail.bab === 'threeQuarters'
          ? Math.floor((n * 3) / 4)
          : Math.floor(n / 2);
    babBuiltIns.push(
      builtIn(`BAB (${c.name} ${n})`, bab, 'bab', { bonusType: 'base' }),
    );
    for (const save of SAVES) {
      const good = detail.saves[save] === 'good';
      saveBuiltIns[save].push(
        builtIn(
          `Base save (${c.name} ${n}, ${good ? 'good' : 'poor'})`,
          good ? 2 + Math.floor(n / 2) : Math.floor(n / 3),
          `save.${save}`,
          { bonusType: 'base' },
        ),
      );
    }
  }
  const bab = statOf('bab', babBuiltIns);
  ctx.bab = bab.total;
  const babBuiltIn = builtIn('BAB', bab.total, 'derived', {
    bonusType: 'base',
  });

  // Stage 4: dependent statistics.
  const armorItems = character.entries.flatMap((e) => {
    const detail = lookupCatalog(character, e.catalogKey)?.detail;
    return e.active &&
      detail?.kind === 'item' &&
      (detail.slot === 'armor' || detail.slot === 'shield')
      ? [
          {
            entry: e,
            detail,
            name: lookupCatalog(character, e.catalogKey)!.name,
          },
        ]
      : [];
  });
  const maxDexItem = armorItems
    .filter((a) => a.detail.maxDex !== undefined)
    .sort((a, b) => a.detail.maxDex! - b.detail.maxDex!)[0];
  const dexMod = abilityMods.dex.total;
  const acDex =
    maxDexItem && dexMod > maxDexItem.detail.maxDex!
      ? mod(
          'dex',
          'ac.other',
          `Dex modifier (max +${maxDexItem.detail.maxDex} in ${maxDexItem.name})`,
        )
      : mod('dex', 'ac.other');
  if (maxDexItem && dexMod > maxDexItem.detail.maxDex!)
    acDex.value = maxDexItem.detail.maxDex!;

  const leaves = {} as Record<AcLeaf, Stat>;
  for (const leaf of AC_LEAVES)
    leaves[leaf] = statOf(leaf, leaf === 'ac.other' ? [acDex] : []);
  const base10 = builtIn('Base', 10, 'derived', { bonusType: 'base' });
  const acApplied = AC_LEAVES.flatMap((leaf) => leaves[leaf].applied);
  const acSuppressed = AC_LEAVES.flatMap((leaf) => leaves[leaf].suppressed);
  const acConditional = AC_LEAVES.flatMap((leaf) => leaves[leaf].conditional);
  const ac: Stat = {
    total: 10 + sum(acApplied),
    applied: [base10, ...acApplied],
    suppressed: acSuppressed,
    conditional: acConditional,
  };

  const excluded = (list: Contribution[], by: string): Suppressed[] =>
    list.map((contribution) => ({ contribution, by, reason: 'excluded' }));
  const touchOut = AC_LEAVES.filter((l) => l !== 'ac.other').flatMap(
    (l) => leaves[l].applied,
  );
  const touchAc: Stat = {
    total: 10 + leaves['ac.other'].total,
    applied: [base10, ...leaves['ac.other'].applied],
    suppressed: [
      ...leaves['ac.other'].suppressed,
      ...excluded(
        touchOut,
        'Touch AC excludes armor, shield and natural armor',
      ),
    ],
    // Only `ac.other` reaches touch AC, conditional bonuses included.
    conditional: leaves['ac.other'].conditional,
  };
  const lostFlatFooted = (c: Contribution) =>
    (c === acDex && c.value > 0) || (c.bonusType === 'dodge' && c.value > 0);
  const ffApplied = acApplied.filter((c) => !lostFlatFooted(c));
  const flatFootedAc: Stat = {
    total: 10 + sum(ffApplied),
    applied: [base10, ...ffApplied],
    suppressed: [
      ...acSuppressed,
      ...excluded(
        acApplied.filter(lostFlatFooted),
        'Flat-footed: no Dex bonus or dodge bonuses',
      ),
    ],
    // A conditional dodge bonus (vs. traps, vs. giants) is lost flat-footed too.
    conditional: acConditional.filter((c) => !lostFlatFooted(c)),
  };

  const saves = {} as Record<SaveKey, Stat>;
  for (const save of SAVES)
    saves[save] = statOf(`save.${save}`, [
      ...saveBuiltIns[save],
      mod(SAVE_ABILITY[save], `save.${save}`),
    ]);

  const init = statOf('init', [mod('dex', 'init')]);
  const attackMelee = statOf('attack.melee', [
    babBuiltIn,
    mod('str', 'attack.melee'),
  ]);
  const attackRanged = statOf('attack.ranged', [
    babBuiltIn,
    mod('dex', 'attack.ranged'),
  ]);
  // Authored damage Modifiers only; attacks.ts adds Str and the weapon.
  const damageMelee = statOf('damage.melee', []);
  const damageRanged = statOf('damage.ranged', []);
  const cmb = statOf('cmb', [babBuiltIn, mod('str', 'cmb')]);

  const cmdDex = mod('dex', 'cmd');
  const reachesCmd = (c: Contribution) =>
    !c.builtIn && ((c.value > 0 && CMD_TYPES.has(c.bonusType)) || c.value < 0);
  const fromAc = acApplied.filter(reachesCmd);
  const cmdStat = statOf('cmd', [
    base10,
    babBuiltIn,
    mod('str', 'cmd'),
    cmdDex,
  ]);
  const cmd: Stat = {
    total: cmdStat.total + sum(fromAc),
    applied: [...cmdStat.applied, ...fromAc],
    suppressed: cmdStat.suppressed,
    // `cmd` Modifiers' own, plus conditional AC bonuses of the types CMD takes.
    conditional: [...cmdStat.conditional, ...acConditional.filter(reachesCmd)],
  };
  const flatFootedCmd: Stat =
    cmdDex.value > 0
      ? {
          total: cmd.total - cmdDex.value,
          applied: cmd.applied.filter((c) => c !== cmdDex),
          suppressed: [
            ...cmd.suppressed,
            ...excluded([cmdDex], 'Flat-footed: no Dex bonus'),
          ],
          // Dodge bonuses stay in flat-footed CMD, conditional ones too.
          conditional: cmd.conditional,
        }
      : cmd;

  // Hit points: hpGained per Class Level, favored class bonus, Con × Hit Dice.
  const hpBuiltIns: Contribution[] = [];
  for (const l of levels) {
    const detail = classDetail(l.state.classKey);
    if (l.state.hpGained !== null)
      hpBuiltIns.push({
        ...builtIn(
          `${classLevelShortLabel(character, l.id)}${detail ? ` (d${detail.hitDie})` : ''} · level ${l.state.position}`,
          l.state.hpGained,
          'hp',
          { bonusType: 'base' },
        ),
        entryId: l.id,
      });
    if (l.state.favoredClassBonus?.choice === 'hp')
      hpBuiltIns.push({
        ...builtIn(
          `Favored class bonus (${classLevelShortLabel(character, l.id)})`,
          1,
          'hp',
        ),
        entryId: l.id,
      });
  }
  const con = abilityMods.con.total;
  hpBuiltIns.push(
    builtIn(
      `Con modifier ${con >= 0 ? '+' : '−'}${Math.abs(con)} × ${hitDice} Hit Dice`,
      con * hitDice,
      'hp',
      {
        temporary: abilityMods.con.applied.some((c) => c.temporary),
      },
    ),
  );
  const hp = statOf('hp', hpBuiltIns);

  // Skills.
  const classSkills = new Set<SkillKey>();
  for (const c of classes)
    for (const s of classDetail(c.classKey)?.classSkills ?? [])
      classSkills.add(s);
  const acp = armorItems
    .filter((a) => (a.detail.armorCheckPenalty ?? 0) < 0)
    .map((a) => ({
      ...builtIn(
        `Armor check penalty (${a.name})`,
        a.detail.armorCheckPenalty!,
        'derived',
      ),
      entryId: a.entry.id,
    }));
  const skills = {} as Record<SkillKey, SkillStat>;
  for (const info of SKILLS) {
    const ranks = levels.reduce(
      (a, l) => a + (l.state.skillRanks[info.key] ?? 0),
      0,
    );
    const classSkill = classSkills.has(info.key);
    const builtIns: Contribution[] = [];
    if (ranks > 0) {
      builtIns.push(
        builtIn('Ranks', ranks, `skill.${info.key}`, { bonusType: 'base' }),
      );
      if (classSkill)
        builtIns.push(builtIn('Class skill', 3, `skill.${info.key}`));
    }
    builtIns.push(mod(info.ability, `skill.${info.key}`));
    if (info.armorCheckPenalty)
      builtIns.push(
        ...acp.map((c) => ({ ...c, target: `skill.${info.key}` as const })),
      );
    const stat = statOf(`skill.${info.key}`, builtIns);
    skills[info.key] = {
      ...stat,
      ranks,
      classSkill,
      trainedOnly: info.trainedOnly,
      usable: !info.trainedOnly || ranks > 0,
      ability: info.ability,
    };
  }

  // Extra damage dice from class features (sneak attack), per catalog entry.
  const extraDamage: ExtraDamage[] = [];
  for (const e of character.entries) {
    if (!e.catalogKey || !counts(character, e, permanentOnly)) continue;
    const catalog = lookupCatalog(character, e.catalogKey);
    if (catalog?.detail.kind !== 'classFeature' || !catalog.detail.damageDice)
      continue;
    const { die, situation, rangedWithin } = catalog.detail.damageDice;
    const held = extraDamage.find((x) => x.catalogKey === catalog.key);
    if (held && !catalog.stacksWithItself) continue;
    if (held) {
      held.count += 1;
      held.dice = `${held.count}d${die}`;
      held.entryIds.push(e.id);
    } else
      extraDamage.push({
        label: catalog.name,
        catalogKey: catalog.key,
        dice: `1d${die}`,
        count: 1,
        die,
        situationKey: situation,
        conditionText: SITUATION_TEXT[situation],
        ...(rangedWithin ? { rangedWithin } : {}),
        entryIds: [e.id],
      });
  }

  const racialHitDice = raceHitDice(character);
  const permanentScores = permanentOnly
    ? abilities
    : resolveSheet(character, { permanentOnly: true }).abilities;

  const sheet: ResolvedSheet = {
    abilities,
    abilityMods,
    bab,
    saves,
    ac,
    touchAc,
    flatFootedAc,
    attackMelee,
    attackRanged,
    damageMelee,
    damageRanged,
    cmb,
    cmd,
    flatFootedCmd,
    init,
    hp,
    skills,
    level: levels.length,
    hitDice,
    racialHitDice,
    classes,
    notes,
    militia: {
      level: levels.length,
      racialHitDice,
      hitDice,
      scores: Object.fromEntries(
        ABILITIES.map((a) => [a, permanentScores[a].total]),
      ) as Record<AbilityKey, number>,
      isActive: character.isActive,
    },
    situationsAsked,
    situations: [],
    extraDamage,
  };
  sheet.situations = situationsOf(sheet);
  return sheet;
}

// ------------------------------------------------------------ stat paths

/** Every sheet statistic, in sheet order. */
export const STAT_PATHS: StatPath[] = [
  ...ABILITIES.map((a) => `abilities.${a}` as const),
  ...ABILITIES.map((a) => `abilityMods.${a}` as const),
  'hp',
  'ac',
  'touchAc',
  'flatFootedAc',
  'saves.fort',
  'saves.ref',
  'saves.will',
  'cmd',
  'flatFootedCmd',
  'bab',
  'attackMelee',
  'attackRanged',
  'damageMelee',
  'damageRanged',
  'cmb',
  'init',
  ...SKILLS.map((s) => `skills.${s.key}` as const),
];

/** Reads one statistic by path: `getStat(sheet, 'saves.ref')`. */
export function getStat(sheet: ResolvedSheet, path: StatPath): Stat {
  const [head, tail] = path.split('.') as [string, string | undefined];
  if (!tail) return sheet[head as 'hp'];
  const group = sheet[head as 'saves'] as Record<string, Stat>;
  return group[tail]!;
}

/** Every situation on the sheet: the statistics it touches, and whether attacks change. */
function situationsOf(sheet: ResolvedSheet): SheetSituation[] {
  const paths = new Map<SituationKey, StatPath[]>();
  for (const path of STAT_PATHS) {
    const stat = getStat(sheet, path);
    const keys = new Set(
      [
        ...stat.applied,
        ...stat.suppressed.map((x) => x.contribution),
        ...stat.conditional,
      ].flatMap((c) => (c.situationKey ? [c.situationKey] : [])),
    );
    for (const key of keys) paths.set(key, [...(paths.get(key) ?? []), path]);
  }
  return SITUATION_KEYS.flatMap((key) => {
    const list = paths.get(key) ?? [];
    const attacks: SheetSituation['attacks'] = [];
    if (list.some((p) => p === 'attackMelee' || p === 'attackRanged'))
      attacks.push('attack');
    if (
      list.some((p) => p === 'damageMelee' || p === 'damageRanged') ||
      sheet.extraDamage.some((x) => x.situationKey === key)
    )
      attacks.push('damage');
    return list.length || attacks.length
      ? [{ key, text: SITUATION_TEXT[key], paths: list, attacks }]
      : [];
  });
}

// ------------------------------------------------------------- situations

const situationCache = new WeakMap<
  Character,
  Map<SituationKey, ResolvedSheet>
>();

/**
 * The sheet with one situation asked for, memoised per Character object
 * (the store never mutates a Character, so a new object means new numbers).
 */
export function resolveInSituation(
  character: Character,
  key: SituationKey,
): ResolvedSheet {
  let byKey = situationCache.get(character);
  if (!byKey)
    situationCache.set(
      character,
      (byKey = new Map<SituationKey, ResolvedSheet>()),
    );
  let sheet = byKey.get(key);
  if (!sheet)
    byKey.set(key, (sheet = resolveSheet(character, { situations: [key] })));
  return sheet;
}

/**
 * One statistic's total in each situation on the sheet that changes it, for
 * stat-block lines such as "Ref +7 (+9 vs. traps)". `sheet` is the normal
 * sheet (no situation asked for); entries with no change are left out.
 */
export function situationalTotals(
  character: Character,
  sheet: ResolvedSheet,
  path: StatPath,
): { key: SituationKey; text: string; total: number; delta: number }[] {
  const base = getStat(sheet, path).total;
  return sheet.situations.flatMap((s) => {
    if (!s.paths.includes(path)) return [];
    const total = getStat(resolveInSituation(character, s.key), path).total;
    return total === base
      ? []
      : [{ key: s.key, text: s.text, total, delta: total - base }];
  });
}

/** The values the militia reads: permanent-only scores, level, Hit Dice. */
export function militiaCharacterFacts(character: Character) {
  return resolveSheet(character, { permanentOnly: true }).militia;
}
