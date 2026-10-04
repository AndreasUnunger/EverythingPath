import type { CharacterSheetInput, SheetEntry } from './character-sheet';
import {
  formatGrantKeyId,
  resolveCharacterSheetGrants,
} from './character-sheet-grants';
import { classFamilyLevels } from './character-sheet-class-levels';
import { selectionOrdersAtLevel } from './character-sheet-selection';
import {
  matchesProficiency,
  normalizeProficiencyName,
  proficiencyKey,
  type ManualProficiency,
  type ResolvedProficiencies,
} from './character-sheet-proficiencies';

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

export function relevantProficiencyFacts(
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

export function canCheckProficiency(
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

export function definitionFor(entry: SheetEntry, input: CharacterSheetInput) {
  const id =
    entry.kind === 'classLevel'
      ? entry.state.classEntryId
      : 'catalogEntryId' in entry
        ? entry.catalogEntryId
        : undefined;
  return input.catalogEntries.find((definition) => definition._id === id);
}

export function ignoresPrerequisites(
  entry: SheetEntry,
  input: CharacterSheetInput,
) {
  if (entry.kind !== 'feat') return false;
  if (entry.grantKey) return true;
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
      (slot, index) =>
        index ===
          (entry.selectionSource?.kind === 'slot'
            ? (entry.selectionSource.slotIndex ?? 0)
            : entry.state.slot && entry.state.slot !== 'general'
              ? (entry.state.slot.slotIndex ?? 0)
              : 0) &&
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
  selectionOrders: ReturnType<typeof selectionOrdersAtLevel>;
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
    const { classLevel, beforeLevel } = context.position;
    if (level.state.position !== classLevel)
      return level.state.position < classLevel;
    if (beforeLevel) return false;
    const candidateOrder = context.selectionOrders.get(candidate._id);
    const originOrder = context.selectionOrders.get(context.originId);
    if (!candidateOrder || !originOrder) return false;
    return candidateOrder.order === originOrder.order
      ? candidateOrder.index < originOrder.index
      : candidateOrder.order < originOrder.order;
  }
}

export function recordedPrefix(
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
    selectionOrders: selectionOrdersAtLevel(input.entries, level._id),
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
