import type { CharacterSheetInput, SheetEntry } from '~/lib/character-sheet';
import type {
  GrantKey,
  ResolvedSheetEntry,
} from '~/lib/character-sheet-grants';

export type GrantEntryTarget = { grantKey: GrantKey } | { entryId: string };

export type GrantEntryView = {
  rowId: string;
  target: GrantEntryTarget;
  name: string;
  kind: SheetEntry['kind'];
  origin: ResolvedSheetEntry['origin'];
  recorded: boolean;
  active: boolean;
  kept: boolean;
  dormant: boolean;
  counting: boolean;
  gainedAtClassLevel: string | null;
  unplaced: boolean;
  status: 'counting' | 'kept' | 'off' | 'dormant';
  choice: string | null;
  notes: string;
  sourceLabel: string | null;
  reason: string | null;
  canKeep: boolean;
  canDiscard: boolean;
  canEditChoice: boolean;
  replaced: GrantEntryView[];
};

export type GrantSectionView = {
  kind: SheetEntry['kind'];
  title: string;
  rows: GrantEntryView[];
  dormantRows: GrantEntryView[];
  dormantLabel: string;
};

type GrantSectionKind = Exclude<SheetEntry['kind'], 'base' | 'classLevel'>;
const sectionKinds: GrantSectionKind[] = [
  'race',
  'racialTrait',
  'archetype',
  'classFeature',
  'feat',
  'trait',
  'manual',
  'item',
  'spell',
  'spellEffect',
  'condition',
  'abilityDamage',
  'abilityDrain',
];
const sectionTitles: Record<GrantSectionKind, string> = {
  race: 'Race',
  racialTrait: 'Racial traits',
  archetype: 'Archetypes',
  classFeature: 'Class features',
  feat: 'Feats',
  trait: 'Traits',
  manual: 'Personal adjustments',
  item: 'Items',
  spell: 'Spells',
  spellEffect: 'Spell Effects',
  condition: 'Conditions',
  abilityDamage: 'Ability damage',
  abilityDrain: 'Ability drain',
};
const regularKinds: SheetEntry['kind'][] = [
  'race',
  'racialTrait',
  'archetype',
  'classFeature',
  'feat',
  'trait',
];

/** Existing effect panels own their regular rows; every section retains lost state here. */
export function buildCharacterSheetGrantsView(
  entries: readonly ResolvedSheetEntry[],
  catalogEntries: CharacterSheetInput['catalogEntries'],
  classLevelIds: ReadonlySet<string> = new Set(),
): GrantSectionView[] {
  const names = new Map(
    entries.map(({ entry }) => [
      entry._id,
      catalogEntries.find(
        (catalog) =>
          catalog._id ===
          ('catalogEntryId' in entry ? entry.catalogEntryId : undefined),
      )?.name ?? 'Unavailable entry',
    ]),
  );
  const rows = new Map<string, GrantEntryView>();
  for (const resolved of entries) {
    const { entry, reason } = resolved;
    if (entry.kind === 'base' || entry.kind === 'classLevel') continue;
    const grantKey = 'grantKey' in entry ? entry.grantKey : undefined;
    const kept = 'kept' in entry && entry.kept === true;
    const gainedAtClassLevel =
      'gainedAtClassLevel' in entry ? entry.gainedAtClassLevel : undefined;
    const source = catalogEntries.find(
      (catalog) => catalog.ruleIdentity === grantKey?.source,
    );
    const parentName = grantKey ? names.get(grantKey.source) : undefined;
    rows.set(entry._id, {
      rowId: entry._id,
      target: grantKey
        ? { grantKey }
        : { entryId: resolved.storedEntryId ?? entry._id },
      name: names.get(entry._id) ?? 'Unavailable entry',
      kind: entry.kind,
      origin: resolved.origin,
      recorded: resolved.recorded,
      active: entry.active,
      kept,
      dormant: resolved.dormant,
      counting: resolved.counting,
      gainedAtClassLevel: gainedAtClassLevel ?? null,
      unplaced:
        resolved.origin === 'selection' &&
        resolved.counting &&
        !resolved.dormant &&
        gainedAtClassLevel !== undefined &&
        !classLevelIds.has(gainedAtClassLevel),
      status: !entry.active
        ? 'off'
        : resolved.dormant
          ? kept
            ? 'kept'
            : 'dormant'
          : 'counting',
      choice: 'choice' in entry.state ? (entry.state.choice ?? null) : null,
      notes: ('notes' in entry ? entry.notes : undefined) ?? '',
      sourceLabel:
        parentName ??
        (source
          ? `${source.name}${grantKey?.classLevel ? ` ${grantKey.classLevel}` : ''}`
          : null),
      reason:
        reason?.kind === 'replaced'
          ? `Replaced by ${reason.byEntryIds.map((id) => names.get(id) ?? 'Unavailable entry').join(', ')}`
          : reason
            ? 'Its source is no longer active.'
            : null,
      canKeep: resolved.dormant,
      canDiscard: resolved.dormant && resolved.recorded,
      canEditChoice: [
        'race',
        'racialTrait',
        'archetype',
        'classFeature',
        'feat',
        'trait',
        'manual',
      ].includes(entry.kind),
      replaced: [],
    });
  }
  const nested = new Set<string>();
  for (const resolved of entries) {
    if (resolved.reason?.kind !== 'replaced') continue;
    const row = rows.get(resolved.entry._id);
    const replacer = resolved.reason.byEntryIds
      .map((id) => rows.get(id))
      .find((parent) => parent && !parent.dormant);
    if (row && replacer) {
      replacer.replaced.push(row);
      nested.add(row.rowId);
    }
  }
  return sectionKinds.flatMap((kind) => {
    const sectionRows = [...rows.values()].filter(
      (row) => row.kind === kind && !nested.has(row.rowId),
    );
    const regular = sectionRows.filter((row) =>
      row.dormant
        ? row.kept
        : row.origin === 'grant' || regularKinds.includes(row.kind),
    );
    const dormantRows = sectionRows.filter(
      (row) => row.dormant && row.recorded && !row.kept,
    );
    if (!regular.length && !dormantRows.length) return [];
    return [
      {
        kind,
        title: sectionTitles[kind],
        rows: regular,
        dormantRows,
        dormantLabel: `Not counting now (${dormantRows.length})`,
      },
    ];
  });
}
