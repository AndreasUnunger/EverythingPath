import { selectionImportRule } from './selection-import-rules.ts';
import { mapPrerequisites } from './prerequisites.ts';
import type { Prerequisite } from '../../src/lib/character-sheet-prerequisites.ts';
import knownNoticeHolds from './legal/known-notice-holds.json';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema.ts';
import {
  sourceDescription,
  uuidKey,
  toExternalKey,
  type SourceRecord,
  type LoadedRecord,
  type Unsupported,
} from './records.ts';
export { upstreamRecord, toExternalKey, type LoadedRecord } from './records.ts';
import { detailMappers, type PreviewDetail } from './details.ts';
import { readObject, readArray, readText, skillNames } from './values.ts';
import { sanitizeDescription } from './sanitize.ts';
import { mapFormula } from './formula.ts';
import { targetStage } from '../../src/lib/character-sheet.ts';
import {
  conditionalHelperIds,
  naturalAttackIds,
  packPolicy,
  type ImportKind,
} from './inventory.ts';
import type { CurationOutput } from './curation.ts';

export type PreviewEntry = {
  externalKey: string;
  upstreamKey: string;
  pack: string;
  name: string;
  detail: PreviewDetail;
  description: string;
  prerequisites?: Prerequisite[];
  prerequisiteText?: string;
  grantsSlots?: { kind: 'feat' | 'trait'; count: number }[];
  sources: { book: string; pages?: string }[];
  modifiers: (Omit<
    Extract<CurationOutput, { kind: 'modifier' }>,
    'kind' | 'target' | 'bonusType'
  > & { target: string; bonusType: string })[];
  situationalNotes?: Omit<Extract<CurationOutput, { kind: 'note' }>, 'kind'>[];
  sourceKey?: string;
  unsupported: Unsupported[];
};
const resourceKinds = new Set<ImportKind>([
  'creatureType',
  'companionFeature',
  'companion',
  'familiar',
  'eidolonForm',
  'eidolonEvolution',
]);
export function isResource(entry: PreviewEntry) {
  return (
    entry.detail.kind !== 'condition' && resourceKinds.has(entry.detail.kind)
  );
}

const buffKinds = new Map<string, ImportKind>([
  ['spell', 'spellEffect'],
  ['feat', 'classFeature'],
  ['item', 'item'],
]);

export function classify({
  source,
  raceBuilderFolders,
}: {
  source: LoadedRecord;
  raceBuilderFolders: Set<string>;
}):
  | { kind: 'admitted'; entryKind: ImportKind }
  | { kind: 'excluded' | 'unassigned'; reason: string } {
  const { repo, pack, record } = source;
  if (record._key.startsWith('!folders!'))
    return {
      kind: 'excluded',
      reason: 'Foundry folder metadata is not catalog content.',
    };
  const policy = packPolicy({ repo, pack });
  if (policy.kind !== 'map')
    return {
      kind: policy.kind === 'exclude' ? 'excluded' : 'unassigned',
      reason: policy.reason,
    };
  if (repo === 'pf1-content' && conditionalHelperIds.has(record._id))
    return {
      kind: 'excluded',
      reason: 'Named Foundry conditional-modifier helper/template (#228).',
    };
  if (
    repo === 'pf1-content' &&
    pack === 'pf-racial-traits' &&
    record.folder &&
    raceBuilderFolders.has(record.folder)
  )
    return {
      kind: 'excluded',
      reason:
        'Advanced Race Guide Race Builder subtree is explicitly excluded.',
    };
  if (policy.family === 'naturalAttacks')
    return naturalAttackIds.has(record._id)
      ? { kind: 'admitted', entryKind: 'item' }
      : {
          kind: 'excluded',
          reason:
            'Only the 12 generic natural attacks and unarmed strike are admitted from monster-abilities.',
        };
  if (policy.family === 'buff') {
    if (record.type !== 'buff')
      return {
        kind: 'unassigned',
        reason: 'Unexpected record type in a buff pack.',
      };
    const entryKind =
      buffKinds.get(readText({ value: record.system.subType })) ?? 'manual';
    return { kind: 'admitted', entryKind };
  }
  const expected: Record<string, string[]> = {
    race: ['race'],
    class: ['class'],
    classFeature: ['feat'],
    feat: ['feat'],
    trait: ['feat'],
    racialTrait: ['feat'],
    item: [
      'equipment',
      'weapon',
      'loot',
      'consumable',
      'container',
      'attack',
      'implant',
    ],
    itemAbility: ['feat'],
    spell: ['spell'],
    creatureType: ['class'],
    companionFeature: ['feat', 'class'],
    companion: ['npc', 'character'],
    familiar: ['npc', 'character'],
    eidolonForm: ['npc', 'character'],
    eidolonEvolution: ['feat', 'class', 'attack'],
  };
  if (!expected[policy.family]?.includes(record.type))
    return {
      kind: 'unassigned',
      reason: `Unexpected ${record.type} record in ${policy.family} inventory.`,
    };
  return { kind: 'admitted', entryKind: policy.family };
}

export function mapEntry({
  source,
  kind,
  resolveKey,
  lookup,
  spellClassTags,
}: {
  source: LoadedRecord;
  kind: ImportKind;
  resolveKey: (key: string) => string | undefined;
  lookup: Map<string, LoadedRecord>;
  spellClassTags: ReadonlySet<string>;
}): PreviewEntry {
  const { record, pack } = source;
  const upstreamKey = toExternalKey(source);
  const externalKey = resolveKey(upstreamKey) ?? upstreamKey;
  const unsupported: Unsupported[] = [];
  const sanitize = createSanitizer({ resolveKey, lookup, unsupported });
  const description = sanitize(sourceDescription(record));
  const sources = mapSources({ record, unsupported });
  recordNoticeHolds({ record, upstreamKey, unsupported });
  const detail = detailMappers[kind]({
    record,
    resolveKey,
    lookup,
    spellClassTags,
    unsupported,
  });
  const context = { record, kind, unsupported, sanitize };
  recordUncuratedContent(context);
  const modifiers = mapModifiers(context);
  const selectionRule = selectionImportRule({ kind, record });
  const entry = {
    externalKey,
    upstreamKey,
    pack,
    name: record.name,
    detail,
    description,
    ...(kind === 'feat' || kind === 'trait' || kind === 'class'
      ? mapPrerequisites({ source, lookup, resolveKey })
      : {}),
    ...(selectionRule ? { grantsSlots: selectionRule.grantsSlots } : {}),
    sources,
    modifiers,
    unsupported,
  };
  importedCatalogEntrySchema.parse(entry);
  return entry;
}

type MappingContext = {
  record: SourceRecord;
  kind: ImportKind;
  unsupported: Unsupported[];
  sanitize: (value: string) => string;
};

function createSanitizer({
  resolveKey,
  lookup,
  unsupported,
}: {
  resolveKey: (key: string) => string | undefined;
  lookup: ReadonlyMap<string, LoadedRecord>;
  unsupported: Unsupported[];
}) {
  const sanitize = (value: string) =>
    sanitizeDescription({
      html: value,
      link: (uuid) => {
        const upstream = uuidKey(uuid);
        const key = upstream && resolveKey(upstream);
        const target = upstream && lookup.get(upstream);
        if (!key || !target) {
          unsupported.push({
            field: 'description.link',
            reason: 'Unresolved catalog link stripped.',
            value: uuid,
          });
          return undefined;
        }
        return { key, name: target.record.name };
      },
    });
  return sanitize;
}

function recordNoticeHolds({
  record,
  upstreamKey,
  unsupported,
}: Pick<MappingContext, 'record' | 'unsupported'> & { upstreamKey: string }) {
  const sources = readArray(record.system.sources).map(readObject);
  for (const hold of knownNoticeHolds) {
    if (
      hold.externalKeys?.includes(upstreamKey) ||
      sources.some(
        (source) =>
          hold.productCodes.includes(readText({ value: source.id })) ||
          hold.titles.includes(readText({ value: source.name })) ||
          hold.titles.includes(readText({ value: source.title })) ||
          hold.publishers?.some((publisher) =>
            readText({ value: source.publisher }).includes(publisher),
          ),
      )
    )
      unsupported.push({
        field: 'attribution',
        reason:
          'Known notice/evidence hold (#227/#241); unavailable for new release admission.',
      });
  }
}

function mapSources({
  record: { system },
  unsupported,
}: Pick<MappingContext, 'record' | 'unsupported'>) {
  return readArray(system.sources).flatMap((value) => {
    const source = readObject(value);
    const book =
      readText({ value: source.id }) || readText({ value: source.name });
    const pages =
      typeof source.pages === 'string' || typeof source.pages === 'number'
        ? String(source.pages)
        : undefined;
    if (!source.id)
      unsupported.push({
        field: 'sources',
        reason:
          'Upstream custom source requires attribution review; no product code has been inferred.',
        value: {
          name: readText({ value: source.name }),
          date: readText({ value: source.date }),
          publisher: readText({ value: source.publisher }),
          url: /^https?:\/\//.test(readText({ value: source.url }))
            ? readText({ value: source.url })
            : '',
          pages,
        },
      });
    return book ? [{ book, ...(pages === undefined ? {} : { pages }) }] : [];
  });
}

function recordUncuratedContent({
  record,
  kind,
  unsupported,
  sanitize,
}: MappingContext) {
  const system = record.system;
  const contentFields = [
    'actions',
    'associations',
    'armorProf',
    'weaponProf',
    'links',
    'changes',
    'contextNotes',
    'classSkills',
    'hd',
    'bab',
    'savingThrows',
    'skillsPerLevel',
    'customHD',
    'customSkillFormula',
    'attributes',
    'traits',
    'skills',
    'speeds',
    'languages',
    'creatureTypes',
    'creatureSubtypes',
    'material',
    'uses',
    'weaponSubtype',
    'held',
    'properties',
  ];
  const forbidden = new Set([
    'script',
    'scripts',
    'scriptCalls',
    'command',
    'macro',
    'macros',
    'flags',
    '_stats',
    'img',
    'token',
    'prototypeToken',
    'spellbooks',
  ]);
  function retainContent({
    value,
    path = [],
    depth = 0,
  }: {
    value: unknown;
    path?: string[];
    depth?: number;
  }): unknown {
    if (depth > 20) return '[Nested content omitted]';
    if (typeof value === 'string') {
      const field = path.at(-1);
      const parent = path.at(-2);
      const isHtml =
        field === 'description' ||
        (parent === 'description' &&
          ['value', 'unidentified'].includes(field ?? '')) ||
        (parent === 'contextNotes' && field === 'text') ||
        (parent === 'conditionals' && field === 'name');
      return isHtml ? sanitize(value) : value;
    }
    if (
      value === null ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    )
      return value;
    if (Array.isArray(value))
      return value.map((item) =>
        retainContent({ value: item, path, depth: depth + 1 }),
      );
    return Object.fromEntries(
      Object.entries(readObject(value))
        .filter(([key]) => !forbidden.has(key))
        .map(([key, item]) => [
          key,
          retainContent({
            value: item,
            path: [...path, key],
            depth: depth + 1,
          }),
        ]),
    );
  }
  const uncuratedFields = contentFields.filter(
    (field) =>
      system[field] !== undefined &&
      !['changes', 'contextNotes'].includes(field),
  );
  if (uncuratedFields.length)
    unsupported.push({
      field: 'gameContent',
      reason:
        'Source game-content fields retained for feature curation; only explicitly mapped detail/modifiers have an interpretation.',
      value: Object.fromEntries(
        uncuratedFields.map((field) => [
          field,
          retainContent({ value: system[field], path: [field] }),
        ]),
      ),
    });
  if (resourceKinds.has(kind) && record.items?.length)
    unsupported.push({
      field: 'embeddedItems',
      reason:
        'Actor-owned embedded content retained for companion curation; these IDs are not global catalog identities.',
      value: record.items.map((item) => {
        const system = readObject(item.system);
        return {
          id: readText({ value: item._id }),
          name: readText({ value: item.name }),
          type: readText({ value: item.type }),
          description: sanitize(
            readText({ value: readObject(system.description).value }),
          ),
          content: Object.fromEntries(
            contentFields
              .filter((field) => system[field] !== undefined)
              .map((field) => [
                field,
                retainContent({ value: system[field], path: [field] }),
              ]),
          ),
        };
      }),
    });
}

function mapModifiers({
  record: { system },
  kind,
  unsupported,
}: Omit<MappingContext, 'sanitize'>) {
  const modifiers: PreviewEntry['modifiers'] = [];
  const targets: Record<string, string> = {
    str: 'ability.str',
    dex: 'ability.dex',
    con: 'ability.con',
    int: 'ability.int',
    wis: 'ability.wis',
    cha: 'ability.cha',
    ac: 'ac',
    aac: 'ac.armor',
    sac: 'ac.shield',
    nac: 'ac.natural',
    fort: 'save.fort',
    ref: 'save.ref',
    will: 'save.will',
    allSavingThrows: 'saves',
    skills: 'skills',
    attack: 'attack',
    mattack: 'attack.melee',
    rattack: 'attack.ranged',
    damage: 'damage',
    wdamage: 'damage',
    mwdamage: 'damage.melee',
    rwdamage: 'damage.ranged',
    bab: 'bab',
    cmb: 'cmb',
    cmd: 'cmd',
    init: 'init',
    mhp: 'hp',
    allChecks: '',
  };
  const bonusTypes = new Set([
    'alchemical',
    'armor',
    'circumstance',
    'competence',
    'deflection',
    'dodge',
    'enhancement',
    'inherent',
    'insight',
    'luck',
    'morale',
    'naturalArmor',
    'profane',
    'racial',
    'resistance',
    'sacred',
    'shield',
    'size',
    'trait',
    'untyped',
  ]);
  const aliases: Record<string, string> = {
    enh: 'enhancement',
    nat: 'naturalArmor',
    def: 'deflection',
    luck: 'luck',
  };
  for (const change of readArray(system.changes)) {
    const raw = readObject(change);
    const sourceTarget = readText({ value: raw.target });
    const skill =
      sourceTarget.startsWith('skill.') && skillNames[sourceTarget.slice(6)];
    const target = skill ? `skill.${skill}` : targets[sourceTarget];
    const bonusType =
      aliases[readText({ value: raw.type })] ?? readText({ value: raw.type });
    const value = mapFormula({
      input: readText({ value: raw.formula }),
      classTag: readText({ value: system.class }) || undefined,
      allowCasterLevel: kind === 'spellEffect' || target === 'casterLevel',
    });
    const stage = targetStage(target ?? '');
    const sameStage =
      typeof value === 'string' &&
      ((stage <= 2 && value.includes('@ability.')) ||
        (stage <= 3 && /@(?:bab|hitDice)\b/.test(value)) ||
        (stage <= 4 && value.includes('@casterLevel.')) ||
        (kind !== 'spellEffect' && stage < 4 && /@casterLevel\b/.test(value)));
    if (
      target &&
      bonusTypes.has(bonusType) &&
      value !== undefined &&
      !sameStage &&
      kind !== 'spell'
    )
      modifiers.push({
        target,
        bonusType,
        value: typeof value === 'number' ? value : { formula: value },
      });
    else
      unsupported.push({
        field: 'changes',
        reason:
          'Unmapped target, bonus type, formula or calculation-stage dependency; contributes nothing.',
        value: {
          target: sourceTarget,
          formula: readText({ value: raw.formula }),
          type: readText({ value: raw.type }),
        },
      });
  }
  return modifiers;
}
