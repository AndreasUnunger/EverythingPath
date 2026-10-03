import type {
  CharacterSheetInput,
  SheetEntry,
  SheetWarning,
} from './character-sheet';
import {
  characterSheetClassFamily,
  formatGrantKeyId,
  resolveCharacterSheetGrants,
} from './character-sheet-grants';
import { classFamilyLevels } from './character-sheet-class-levels';
import {
  matchesProficiency,
  normalizeProficiencyName,
  proficiencyKey,
  meetsProficiencyPrerequisite,
  resolveProficiencies,
  type ManualProficiency,
  type ResolvedProficiencies,
} from './character-sheet-proficiencies';

type PrerequisiteCheck = {
  entryId: string;
  view: 'current' | 'recorded';
  proficiency: ManualProficiency;
  met: boolean;
};

function weaponFor(proficiency: ManualProficiency, input: CharacterSheetInput) {
  if (!('baseType' in proficiency)) return undefined;
  for (const definition of input.catalogEntries) {
    const weapon =
      definition.detail?.kind === 'item' ? definition.detail.weapon : undefined;
    if (
      weapon &&
      normalizeProficiencyName(weapon.baseType) ===
        normalizeProficiencyName(proficiency.baseType)
    )
      return weapon;
  }
  return undefined;
}

function relevantFacts(
  proficiency: ManualProficiency,
  proficiencies: ResolvedProficiencies,
  input: CharacterSheetInput,
) {
  const weapon = weaponFor(proficiency, input);
  const grants = [
    ...proficiencies.grants.map((grant) => grant.proficiency),
    ...proficiencies.added,
  ];
  const familiarity =
    'baseType' in proficiency &&
    grants.some(
      (grant) =>
        'baseType' in grant &&
        normalizeProficiencyName(grant.baseType) ===
          normalizeProficiencyName(proficiency.baseType) &&
        grant.asMartial,
    );
  const relevant = (grant: ManualProficiency) => {
    if (!('baseType' in proficiency))
      return proficiencyKey(grant) === proficiencyKey(proficiency);
    return (
      matchesProficiency(
        grant,
        {
          kind: 'weapon',
          baseType: proficiency.baseType,
          proficiency: weapon?.proficiency ?? 'exotic',
          groups: weapon?.groups,
          hands: 'two',
        },
        true,
      ) ||
      ('category' in grant && grant.category === 'martial' && familiarity)
    );
  };
  const canonical = (values: ManualProficiency[]) =>
    [...new Set(values.filter(relevant).map(proficiencyKey))].sort();
  return {
    granted: canonical(grants),
    removed: canonical(proficiencies.removed),
    weapon: weapon
      ? {
          proficiency: weapon.proficiency,
          groups: weapon.groups?.map(normalizeProficiencyName).sort() ?? [],
        }
      : undefined,
  };
}

function canCheck(
  proficiency: ManualProficiency,
  proficiencies: ResolvedProficiencies,
  input: CharacterSheetInput,
) {
  if (!('baseType' in proficiency) || weaponFor(proficiency, input))
    return true;
  const sameName = (grant: ManualProficiency) =>
    'baseType' in grant &&
    normalizeProficiencyName(grant.baseType) ===
      normalizeProficiencyName(proficiency.baseType) &&
    !grant.asMartial;
  return [
    ...proficiencies.grants.map((grant) => grant.proficiency),
    ...proficiencies.added,
    ...proficiencies.removed,
  ].some(sameName);
}

function definitionFor(entry: SheetEntry, input: CharacterSheetInput) {
  const id =
    entry.kind === 'classLevel'
      ? entry.state.classEntryId
      : 'catalogEntryId' in entry
        ? entry.catalogEntryId
        : undefined;
  return input.catalogEntries.find((definition) => definition._id === id);
}

function ignoresPrerequisites(entry: SheetEntry, input: CharacterSheetInput) {
  if (entry.kind !== 'feat') return false;
  const reference =
    entry.selectionSource?.kind === 'slot'
      ? entry.selectionSource.grantedBy
      : entry.state.slot && entry.state.slot !== 'general'
        ? entry.state.slot.grantedBy
        : undefined;
  if (!reference) return false;
  const sourceId =
    reference.kind === 'entry'
      ? reference.entryId
      : formatGrantKeyId(reference.grantKey);
  const source = input.entries.find((candidate) => candidate._id === sourceId);
  return (
    source &&
    definitionFor(source, input)?.grantsSlots?.some(
      (slot) =>
        slot.kind === 'feat' &&
        slot.count > 0 &&
        slot.ignoresPrerequisites === true,
    ) === true
  );
}

type RecordedPosition = {
  classLevel: number;
  choiceOrder: number | undefined;
  beforeLevel: boolean;
};
type RecordedContext = {
  input: CharacterSheetInput;
  sources: ReadonlyMap<string, SheetEntry>;
  entryId: string;
  originId: string;
  position: RecordedPosition;
};

function entryKey(entry: SheetEntry) {
  return 'grantKey' in entry && entry.grantKey
    ? formatGrantKeyId(entry.grantKey)
    : entry._id;
}

function recordedOrigin(
  entry: SheetEntry,
  sources: ReadonlyMap<string, SheetEntry>,
) {
  let origin = entry;
  const ancestry = new Set<string>();
  while ('grantKey' in origin && origin.grantKey) {
    const source = sources.get(origin.grantKey.source);
    if (!source || ancestry.has(source._id)) break;
    ancestry.add(source._id);
    origin = source;
  }
  return origin;
}

function excludedFromPrefix(entry: SheetEntry, context: RecordedContext) {
  return (
    entryKey(entry) === context.entryId ||
    entry._id === context.entryId ||
    entry._id === context.originId
  );
}

function levelInPrefix(
  entry: Extract<SheetEntry, { kind: 'classLevel' }>,
  context: RecordedContext,
) {
  if (excludedFromPrefix(entry, context)) return false;
  return context.position.beforeLevel
    ? entry.state.position < context.position.classLevel
    : entry.state.position <= context.position.classLevel;
}

const undatedKinds = new Set<SheetEntry['kind']>([
  'base',
  'race',
  'item',
  'manual',
  'condition',
  'spellEffect',
  'abilityDamage',
  'abilityDrain',
]);

function recordedEntryEligible(entry: SheetEntry, context: RecordedContext) {
  let candidate = entry;
  const visited = new Set<string>();
  while (true) {
    const keyId = entryKey(candidate);
    if (visited.has(keyId) || excludedFromPrefix(candidate, context))
      return false;
    visited.add(keyId);
    if (candidate.kind === 'classLevel')
      return levelInPrefix(candidate, context);
    const key = 'grantKey' in candidate ? candidate.grantKey : undefined;
    if (key) {
      const source = context.sources.get(key.source);
      if (source) {
        candidate = source;
        continue;
      }
      if (key.classLevel !== undefined) {
        const levels = classFamilyLevels(context.input, key.source);
        if (levels.length)
          return (
            levels.filter((level) => levelInPrefix(level, context)).length >=
            key.classLevel
          );
      }
    }
    if (undatedKinds.has(candidate.kind)) return true;
    const gainedAt =
      'gainedAtClassLevel' in candidate
        ? candidate.gainedAtClassLevel
        : undefined;
    if (!gainedAt) return true;
    const level = context.input.entries.find(
      (row) => row.kind === 'classLevel' && row._id === gainedAt,
    );
    if (level?.kind !== 'classLevel') return false;
    const { classLevel, choiceOrder, beforeLevel } = context.position;
    if (level.state.position !== classLevel)
      return level.state.position < classLevel;
    if (beforeLevel) return false;
    const order =
      'choiceOrder' in candidate ? candidate.choiceOrder : undefined;
    return (
      choiceOrder !== undefined && order !== undefined && order < choiceOrder
    );
  }
}

function recordedPrefix(
  entry: SheetEntry,
  input: CharacterSheetInput,
  effectiveInput: CharacterSheetInput,
) {
  const sources = new Map(
    [...input.entries, ...effectiveInput.entries].map((candidate) => [
      entryKey(candidate),
      candidate,
    ]),
  );
  const origin = recordedOrigin(entry, sources);
  const originKey = 'grantKey' in origin ? origin.grantKey : undefined;
  const automaticLevel =
    originKey?.classLevel === undefined
      ? undefined
      : classFamilyLevels(input, originKey.source).at(originKey.classLevel - 1);
  const gainedAt =
    'gainedAtClassLevel' in origin ? origin.gainedAtClassLevel : undefined;
  const level =
    origin.kind === 'classLevel'
      ? origin
      : (automaticLevel ??
        input.entries.find(
          (candidate) =>
            candidate.kind === 'classLevel' &&
            candidate.active &&
            candidate._id === gainedAt,
        ));
  if (level?.kind !== 'classLevel') return undefined;
  const position: RecordedPosition = {
    classLevel: level.state.position,
    choiceOrder: 'choiceOrder' in origin ? origin.choiceOrder : undefined,
    beforeLevel: origin.kind === 'classLevel',
  };
  const context: RecordedContext = {
    input,
    sources,
    entryId: entry._id,
    originId: origin._id,
    position,
  };
  const eligible = (candidate: SheetEntry) =>
    recordedEntryEligible(candidate, context);
  const prefix = { ...input, entries: input.entries.filter(eligible) };
  return {
    input: {
      ...prefix,
      entries:
        resolveCharacterSheetGrants(prefix).countingEntries.filter(eligible),
    },
    position,
  };
}

export function resolveProficiencyPrerequisites(
  recordedInput: CharacterSheetInput,
  effectiveInput: CharacterSheetInput,
  proficiencies: ResolvedProficiencies,
) {
  const checks: PrerequisiteCheck[] = [];
  const warnings: SheetWarning[] = [];
  for (const entry of effectiveInput.entries) {
    if (!entry.active || ignoresPrerequisites(entry, effectiveInput)) continue;
    const definition = definitionFor(entry, effectiveInput);
    if (!definition?.proficiencyPrerequisites?.length) continue;
    if (entry.kind === 'classLevel') {
      if (
        definition.detail?.kind !== 'class' ||
        !('classKind' in definition.detail) ||
        definition.detail.classKind !== 'prestige'
      )
        continue;
      const family = characterSheetClassFamily(
        definition,
        effectiveInput.catalogEntries,
      );
      if (
        classFamilyLevels(effectiveInput, family).some(
          (other) => other.state.position < entry.state.position,
        )
      )
        continue;
    }
    const prefix = recordedPrefix(entry, recordedInput, effectiveInput);
    for (const [index, clause] of (
      definition?.proficiencyPrerequisites ?? []
    ).entries()) {
      const choice =
        'choice' in entry.state ? entry.state.choice?.trim() : undefined;
      const proficiency =
        'choice' in clause.proficiency
          ? choice
            ? { baseType: choice }
            : undefined
          : clause.proficiency;
      if (!proficiency) continue;
      const views: PrerequisiteCheck['view'][] = ['current'];
      if (prefix) views.push('recorded');
      for (const view of views) {
        const viewInput =
          view === 'recorded' && prefix ? prefix.input : effectiveInput;
        const viewProficiencies =
          view === 'recorded' && prefix
            ? resolveProficiencies(prefix.input)
            : proficiencies;
        if (!canCheck(proficiency, viewProficiencies, viewInput)) continue;
        const met = meetsProficiencyPrerequisite(
          viewProficiencies,
          { kind: 'proficiency', proficiency },
          viewInput,
        );
        checks.push({ entryId: entry._id, view, proficiency, met });
        if (!met)
          warnings.push({
            kind: 'rules',
            check: 'proficiencyPrerequisite',
            target: { kind: 'entry', entryId: entry._id },
            subject: `${entry._id}:${view}:${index}`,
            fingerprint: JSON.stringify([
              'choice' in clause.proficiency
                ? { choice: true }
                : proficiencyKey(clause.proficiency),
              proficiencyKey(proficiency),
              relevantFacts(proficiency, viewProficiencies, viewInput),
              view === 'recorded' ? prefix?.position : undefined,
            ]),
            message: `${definition?.name ?? 'Entry'}: required proficiency is missing ${view === 'current' ? 'now.' : 'at its recorded level.'}`,
          });
      }
    }
  }
  return { checks, warnings };
}
