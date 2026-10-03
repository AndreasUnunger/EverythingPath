import type {
  Ability,
  CharacterSheetInput,
  CharacterSheetCatalogEntry,
  InputSourcedModifier,
  LeafTarget,
  ResolveOptions,
  ResolvedStatistic,
  SheetWarning,
} from './character-sheet';
import {
  findCastingTableRow,
  castingTableIncludesZeroLevel,
  MAX_LEVEL,
  type CastingTableRow,
  type Casting,
} from './character-sheet-casting-tables';
import { calculateBonusSpells } from './character-sheet-permanent-statistics';
import { characterSheetClassFamily } from './character-sheet-grants';

type Abilities = Record<Ability, { score: number; modifier: number }>;
export type ResolvedSpellcasting = Pick<
  Casting,
  'classTag' | 'type' | 'spellKind' | 'record' | 'ability' | 'cantrips'
> & {
  classEntryId: string;
  name: string;
  castingLevel: number;
  tableLevel: number;
  casterLevel: ResolvedStatistic | null;
  concentration: ResolvedStatistic | null;
  castableSpellLevels: number[];
  slots: {
    spellLevel: number;
    base: number | null;
    bonus: number;
    total: number | null;
    known: number | null;
    prepared: number | null;
    dc: ResolvedStatistic;
    dcUnresolved: boolean;
    schoolDCs: {
      school: string;
      breakdown: ResolvedStatistic;
      unresolved: boolean;
    }[];
  }[];
  unresolved: string[];
};

type ResolveCastingTarget = (
  target: LeafTarget,
  modifiers: readonly InputSourcedModifier[],
  options: ResolveOptions,
) => { statistic: ResolvedStatistic; warnings: readonly SheetWarning[] };

type CastingBase = {
  classEntryId: string;
  castingLevel: number;
  casting: Casting;
  row: CastingTableRow | undefined;
  castableSpellLevels: number[];
  casterLevel: ResolvedStatistic | null;
  name: string;
  casterLevelUnresolved: boolean;
};

function baseContribution({
  target,
  classId,
  name,
  value,
}: {
  target: LeafTarget;
  classId: string;
  name: string;
  value: number;
}): InputSourcedModifier {
  const id = `builtin:casting:${classId}:${target}:${name}`;
  return {
    target,
    bonusType: 'untyped',
    value,
    sheetEntryId: id,
    entryName: name,
    source: id,
    builtIn: true,
  };
}

function tallyCastingClasses(input: CharacterSheetInput) {
  const classes = new Map<
    string,
    { catalog: CharacterSheetCatalogEntry; castingLevel: number }
  >();
  const spellcastingUnresolved: string[] = [];
  for (const entry of input.entries) {
    if (!entry.active || entry.kind !== 'classLevel') continue;
    const catalog = input.catalogEntries.find(
      (item) => item._id === entry.state.classEntryId,
    );
    if (catalog?.detail?.kind !== 'class' || !('bab' in catalog.detail)) {
      spellcastingUnresolved.push(`class:${entry._id}`);
      continue;
    }
    const family = characterSheetClassFamily(catalog, input.catalogEntries);
    const current = classes.get(family);
    if (current) current.castingLevel++;
    else classes.set(family, { catalog, castingLevel: 1 });
  }
  return { classes: [...classes.values()], spellcastingUnresolved };
}

function resolveCastingBase({
  catalog,
  castingLevel,
  modifiers,
  options,
  resolve,
}: {
  catalog: CharacterSheetCatalogEntry;
  castingLevel: number;
  modifiers: readonly InputSourcedModifier[];
  options: ResolveOptions;
  resolve: ResolveCastingTarget;
}): CastingBase[] {
  if (
    catalog.detail?.kind !== 'class' ||
    !('casting' in catalog.detail) ||
    !catalog.detail.casting
  )
    return [];
  const classEntryId = catalog._id;
  const casting = catalog.detail.casting;
  const row = findCastingTableRow(casting.table, castingLevel);
  const castableSpellLevels = Array.from(
    { length: 10 },
    (_, level) => level,
  ).filter(
    (level) =>
      (level > 0 ||
        casting.cantrips ||
        castingTableIncludesZeroLevel(casting.table)) &&
      ([
        row?.spellsPerDay[level],
        row?.spellsKnown?.[level],
        row?.preparedPerDay?.[level],
      ].some((value) => value !== undefined && value !== null) ||
        row?.castableSpellLevels?.includes(level)),
  );
  const casterLevel = castableSpellLevels.length
    ? resolve(
        'casterLevel',
        [
          ...modifiers,
          baseContribution({
            target: 'casterLevel',
            classId: classEntryId,
            name: 'Class levels',
            value: castingLevel,
          }),
          baseContribution({
            target: 'casterLevel',
            classId: classEntryId,
            name: 'Caster level offset',
            value: casting.casterLevelOffset,
          }),
        ],
        {
          ...options,
          castingClass: casting.classTag,
          preModifierCasterLevel: castingLevel + casting.casterLevelOffset,
        },
      )
    : null;
  return [
    {
      classEntryId,
      castingLevel,
      casting,
      row,
      castableSpellLevels,
      casterLevel: casterLevel?.statistic ?? null,
      casterLevelUnresolved: (casterLevel?.warnings.length ?? 0) > 0,
      name: catalog.name ?? casting.classTag,
    },
  ];
}

function castingUnresolved({
  casterLevel,
  concentration,
  spellDC,
}: {
  casterLevel: boolean;
  concentration: boolean;
  spellDC: boolean;
}) {
  return (['casterLevel', 'spellDC', 'concentration'] as const).filter(
    (target) =>
      ({
        casterLevel,
        concentration: casterLevel || concentration,
        spellDC,
      })[target],
  );
}

function resolveSlotDC({
  spellLevel,
  classEntryId,
  abilityModifier,
  modifiers,
  options,
  schools,
  resolve,
}: {
  spellLevel: number;
  classEntryId: string;
  abilityModifier: number;
  modifiers: readonly InputSourcedModifier[];
  options: ResolveOptions;
  schools: readonly string[];
  resolve: ResolveCastingTarget;
}) {
  const dcModifiers = [
    ...modifiers,
    baseContribution({
      target: 'spellDC',
      classId: classEntryId,
      name: 'Spell level',
      value: 10 + spellLevel,
    }),
    baseContribution({
      target: 'spellDC',
      classId: classEntryId,
      name: 'Casting ability modifier',
      value: abilityModifier,
    }),
  ];
  const resolvedDC = resolve('spellDC', dcModifiers, options);
  const dc = resolvedDC.statistic;
  const schoolResults = schools.map((school) => ({
    school,
    ...resolve('spellDC', dcModifiers, { ...options, school }),
  }));
  const schoolDCs = schoolResults
    .map(({ school, statistic, warnings }) => ({
      school,
      breakdown: statistic,
      unresolved: warnings.length > 0,
    }))
    .filter(
      ({ school, breakdown, unresolved }) =>
        unresolved ||
        breakdown.total !== dc.total ||
        [
          ...breakdown.applied,
          ...breakdown.suppressed,
          ...breakdown.conditional,
        ].some(
          (modifier) =>
            modifier.condition?.school === school &&
            (!modifier.condition.castingClass ||
              modifier.condition.castingClass === options.castingClass),
        ),
    );
  return {
    dc,
    dcUnresolved: resolvedDC.warnings.length > 0,
    schoolDCs,
    unresolved:
      resolvedDC.warnings.length > 0 ||
      schoolResults.some((result) => result.warnings.length > 0),
  };
}

/** The sheet supplies its staged stacking resolver; casting owns class-local rules. */
export function calculateSpellcastings({
  input,
  modifiers,
  options,
  abilities,
  permanentAbilities = abilities,
  resolve,
}: {
  input: CharacterSheetInput;
  modifiers: readonly InputSourcedModifier[];
  options: ResolveOptions;
  abilities: Abilities;
  permanentAbilities?: Abilities;
  resolve: ResolveCastingTarget;
}) {
  const { classes, spellcastingUnresolved } = tallyCastingClasses(input);
  const bases = classes.flatMap((entry) =>
    resolveCastingBase({ ...entry, modifiers, options, resolve }),
  );
  const unresolvedCasterLevels = bases
    .filter((base) => base.casterLevelUnresolved)
    .map((base) => base.casting.classTag);
  const casterLevels = Object.fromEntries(
    bases
      .filter((base) => !unresolvedCasterLevels.includes(base.casting.classTag))
      .map((base) => [base.casting.classTag, base.casterLevel?.total ?? 0]),
  );
  const arcaneBases = bases.filter(
    (base) => base.casting.spellKind === 'arcane',
  );
  const arcaneCasterLevelUnresolved = arcaneBases.some((base) =>
    unresolvedCasterLevels.includes(base.casting.classTag),
  );
  const arcaneCasterLevel = arcaneCasterLevelUnresolved
    ? undefined
    : Math.max(0, ...arcaneBases.map((base) => base.casterLevel?.total ?? 0));
  const schools = [
    ...new Set(
      modifiers
        .filter((modifier) => modifier.target === 'spellDC')
        .flatMap((modifier) =>
          modifier.condition?.school && modifier.condition.school !== '$choice'
            ? [modifier.condition.school]
            : [],
        ),
    ),
  ];
  const spellcastings: ResolvedSpellcasting[] = bases.map(
    ({
      classEntryId,
      castingLevel,
      casting,
      row,
      castableSpellLevels,
      casterLevel,
      name,
    }) => {
      const scoped = {
        ...options,
        casterLevels: { ...casterLevels, ...options.casterLevels },
        arcaneCasterLevel: options.arcaneCasterLevel ?? arcaneCasterLevel,
        unresolvedCasterLevels: [
          ...(options.unresolvedCasterLevels ?? []),
          ...unresolvedCasterLevels,
        ],
        arcaneCasterLevelUnresolved:
          (options.arcaneCasterLevelUnresolved ?? false) ||
          arcaneCasterLevelUnresolved,
        castingClass: casting.classTag,
        preModifierCasterLevel: castingLevel + casting.casterLevelOffset,
      };
      const abilityModifier = abilities[casting.ability].modifier;
      const { bonusSpells } = calculateBonusSpells(
        {
          current: { abilities },
          permanent: { abilities: permanentAbilities },
        },
        {
          baseAbility: casting.ability,
          spellsPerDay: row?.spellsPerDay ?? [],
        },
      );
      const casterLevelUnresolved = unresolvedCasterLevels.includes(
        casting.classTag,
      );
      const classSchools = schools.filter((school) =>
        modifiers.some(
          (modifier) =>
            modifier.target === 'spellDC' &&
            modifier.condition?.school === school &&
            (!modifier.condition.castingClass ||
              modifier.condition.castingClass === casting.classTag),
        ),
      );
      const concentration =
        casterLevel && !casterLevelUnresolved
          ? resolve(
              'concentration',
              [
                ...modifiers,
                baseContribution({
                  target: 'concentration',
                  classId: classEntryId,
                  name: 'Caster level',
                  value: casterLevel.total,
                }),
                baseContribution({
                  target: 'concentration',
                  classId: classEntryId,
                  name: 'Casting ability modifier',
                  value: abilityModifier,
                }),
              ],
              scoped,
            )
          : null;
      const slotResults = castableSpellLevels.map((spellLevel) => {
        const base = row?.spellsPerDay[spellLevel] ?? null;
        const bonus = bonusSpells[spellLevel] ?? 0;
        const { unresolved, ...dc } = resolveSlotDC({
          spellLevel,
          classEntryId,
          abilityModifier,
          modifiers,
          options: scoped,
          schools: classSchools,
          resolve,
        });
        return {
          unresolved,
          slot: {
            spellLevel,
            base,
            bonus,
            total: base === null ? null : base + bonus,
            known: row?.spellsKnown?.[spellLevel] ?? null,
            prepared: row?.preparedPerDay?.[spellLevel] ?? null,
            ...dc,
          },
        };
      });
      const unresolved = castingUnresolved({
        casterLevel: casterLevelUnresolved,
        concentration: (concentration?.warnings.length ?? 0) > 0,
        spellDC: slotResults.some((result) => result.unresolved),
      });
      return {
        classEntryId,
        classTag: casting.classTag,
        name,
        type: casting.type,
        spellKind: casting.spellKind,
        record: casting.record,
        ability: casting.ability,
        cantrips: casting.cantrips,
        castingLevel,
        tableLevel: Math.min(MAX_LEVEL, castingLevel),
        casterLevel,
        concentration: concentration?.statistic ?? null,
        castableSpellLevels,
        slots: slotResults.map((result) => result.slot),
        unresolved,
      };
    },
  );
  return {
    spellcastings,
    casterLevels,
    arcaneCasterLevel,
    unresolvedCasterLevels,
    arcaneCasterLevelUnresolved,
    spellcastingUnresolved,
  };
}

export type CastingPrerequisite =
  | { kind: 'casterLevel'; casterLevel: number }
  | {
      kind: 'canCast';
      canCast: { spellLevel: number; kind?: 'arcane' | 'divine' | 'psychic' };
    }
  | { kind: 'castsSpell'; castsSpell: string }
  | { kind: 'anyOf'; anyOf: CastingPrerequisite[] };
export type CastingPrerequisiteResult = 'met' | 'unmet' | 'unresolved';
export type CastingPrerequisiteInputs = {
  spellcastings: readonly ResolvedSpellcasting[];
  spellcastingUnresolved?: readonly string[];
  spells?: readonly {
    ruleIdentity: string;
    classEntryId: string;
    spellLevel: number;
    source: 'recorded' | 'granted' | 'classList';
  }[];
};

/** Missing modeled inputs stay unresolved; a supported alternative can still qualify. */
export function evaluateCastingPrerequisite(
  clause: CastingPrerequisite,
  inputs: CastingPrerequisiteInputs,
): CastingPrerequisiteResult {
  const unavailable = (inputs.spellcastingUnresolved?.length ?? 0) > 0;
  switch (clause.kind) {
    case 'anyOf': {
      const results = clause.anyOf.map((alternative) =>
        evaluateCastingPrerequisite(alternative, inputs),
      );
      return results.includes('met')
        ? 'met'
        : results.includes('unresolved')
          ? 'unresolved'
          : 'unmet';
    }
    case 'casterLevel': {
      const supported = inputs.spellcastings.filter(
        (casting) => !casting.unresolved.includes('casterLevel'),
      );
      if (
        supported.some(
          (casting) =>
            casting.casterLevel &&
            casting.casterLevel.total >= clause.casterLevel,
        )
      )
        return 'met';
      return unavailable || supported.length < inputs.spellcastings.length
        ? 'unresolved'
        : 'unmet';
    }
    case 'canCast':
      if (
        inputs.spellcastings.some(
          (casting) =>
            (!clause.canCast.kind ||
              casting.spellKind === clause.canCast.kind) &&
            casting.castableSpellLevels.includes(clause.canCast.spellLevel),
        )
      )
        return 'met';
      return unavailable ? 'unresolved' : 'unmet';
    case 'castsSpell':
      if (!inputs.spells) return 'unresolved';
      if (
        inputs.spells.some(
          (spell) =>
            spell.ruleIdentity === clause.castsSpell &&
            inputs.spellcastings.some(
              (casting) =>
                casting.classEntryId === spell.classEntryId &&
                casting.castableSpellLevels.includes(spell.spellLevel) &&
                (spell.source !== 'classList' || casting.record === 'none'),
            ),
        )
      )
        return 'met';
      return unavailable ? 'unresolved' : 'unmet';
    default: {
      const exhaustive: never = clause;
      return exhaustive;
    }
  }
}
