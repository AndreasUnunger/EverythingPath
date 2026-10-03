import { reviewedRemapSchema } from '../../src/lib/catalog/imported-entry-schema.ts';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import {
  applyCuration,
  collectCurationInputs,
  collectDescriptionInputs,
  bindingKey,
  parseCuration,
  draftCurationRecord,
  type CurationData,
} from './curation.ts';
import {
  pins,
  itemAbilityHelperId,
  type ImportKind,
  type Repository,
} from './inventory.ts';
import {
  classify,
  isResource,
  mapEntry,
  upstreamRecord,
  toExternalKey,
  type LoadedRecord,
} from './map.ts';

const manifestSchema = z.object({
  version: z.string(),
  packs: z.array(z.object({ name: z.string().regex(/^[\w-]+$/) })),
});
type InventoryRecord = {
  repo: Repository;
  pack: string;
  path: string;
  externalKey: string;
  name: string;
  status: 'admitted' | 'excluded' | 'unassigned';
  reason: string;
};
type PackComparison = {
  repo: Repository;
  pack: string;
  declared: boolean;
  present: boolean;
  admitted: number;
  excluded: number;
  unassigned: number;
};

const remapSchema = z.array(reviewedRemapSchema);

type Candidate = { source: LoadedRecord; kind: ImportKind };
type ReviewedRemap = z.infer<typeof remapSchema>[number];

type CatalogImportOptions = {
  systemPath: string;
  contentPath: string;
  remaps: unknown;
  curation?: unknown;
};
type DraftOptions = CatalogImportOptions & { descriptions?: boolean };

export async function importCatalog({
  curation = { records: [] },
  ...options
}: CatalogImportOptions) {
  const prepared = await prepareCatalog(options);
  return importPreparedCatalog({ prepared, data: parseCuration(curation) });
}

async function prepareCatalog({
  systemPath,
  contentPath,
  remaps: reviewedRemaps,
}: Omit<CatalogImportOptions, 'curation'>) {
  const remaps = remapSchema.parse(reviewedRemaps);
  const loaded = await loadCatalogInputs({ systemPath, contentPath });
  const classified = classifyRecords(loaded);
  const resolved = resolveRemaps({ candidates: classified.candidates, remaps });
  const seeds = collectHelperSeeds(loaded.loaded);
  return { ...loaded, ...classified, ...resolved, remaps, seeds };
}

type PreparedCatalog = Awaited<ReturnType<typeof prepareCatalog>>;
function importPreparedCatalog({
  prepared,
  data,
}: {
  prepared: PreparedCatalog;
  data: CurationData;
}) {
  const mapped = mapCandidates(prepared);
  const inputs = prepared.candidates.flatMap(({ source, kind }) => {
    const externalKey =
      prepared.resolveKey(toExternalKey(source)) ?? toExternalKey(source);
    return [
      ...collectCurationInputs({ source, kind, externalKey }),
      ...collectDescriptionInputs({ source, kind, externalKey }),
    ];
  });
  const report = applyCuration({
    inputs,
    seeds: prepared.seeds,
    data,
    entries: mapped,
  });
  return {
    ...summariseImport({ ...prepared, mapped }),
    curation: report,
  };
}

export async function draftCatalogCuration({
  curation = { records: [] },
  descriptions = false,
  ...options
}: DraftOptions) {
  const data = parseCuration(curation);
  const prepared = await prepareCatalog(options);
  return draftPreparedCuration({
    prepared,
    data,
    shouldCollectDescriptions: descriptions,
  });
}

export async function draftCatalogCurationWithReport({
  curation = { records: [] },
  descriptions = false,
  ...options
}: DraftOptions) {
  const data = parseCuration(curation);
  const prepared = await prepareCatalog(options);
  const draft = draftPreparedCuration({
    prepared,
    data,
    shouldCollectDescriptions: descriptions,
  });
  const artifact = importPreparedCatalog({
    prepared,
    data: parseCuration(draft),
  });
  return { draft, report: artifact.curation, inputs: artifact.catalog.inputs };
}

function draftPreparedCuration({
  prepared,
  data,
  shouldCollectDescriptions,
}: {
  prepared: PreparedCatalog;
  data: CurationData;
  shouldCollectDescriptions: boolean;
}) {
  const seedKeys = new Set(prepared.seeds.map(bindingKey));
  const validRecords = data.records.filter((record) =>
    record.seedBindings.every((seed) => seedKeys.has(bindingKey(seed))),
  );
  const validKeys = new Set(validRecords.map(bindingKey));
  const seen = new Set(validKeys);
  const collectInputs = shouldCollectDescriptions
    ? collectDescriptionInputs
    : collectCurationInputs;
  const added = prepared.candidates.flatMap(({ source, kind }) => {
    const externalKey =
      prepared.resolveKey(toExternalKey(source)) ?? toExternalKey(source);
    return collectInputs({ source, kind, externalKey })
      .filter((input) => {
        const key = bindingKey(input);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((input) =>
        draftCurationRecord({ input, source, data, seeds: prepared.seeds }),
      );
  });
  const addedKeys = new Set(added.map(bindingKey));
  const replaced = data.records.filter((record) => {
    const key = bindingKey(record);
    return !validKeys.has(key) && addedKeys.has(key);
  });
  const replacedKeys = new Set(replaced.map(bindingKey));
  return {
    ...data,
    records: [
      ...data.records.filter((record) => !replacedKeys.has(bindingKey(record))),
      ...added,
    ],
    added,
    replaced,
  };
}

function collectHelperSeeds(loaded: LoadedRecord[]) {
  return loaded
    .filter(
      (source) =>
        source.repo === 'pf1-content' &&
        source.record._id === itemAbilityHelperId,
    )
    .flatMap((source) =>
      collectCurationInputs({
        source,
        externalKey: toExternalKey(source),
        kind: 'helper',
      }),
    );
}

async function loadCatalogInputs({
  systemPath,
  contentPath,
}: {
  systemPath: string;
  contentPath: string;
}) {
  const inputs = await Promise.all(
    (
      [
        ['pf1', systemPath],
        ['pf1-content', contentPath],
      ] as const
    ).map(async ([repo, root]) => {
      const manifestText = await readFile(
        join(root, pins[repo].manifest),
        'utf8',
      );
      return {
        repo,
        root,
        manifest: manifestSchema.parse(JSON.parse(manifestText)),
        manifestText,
      };
    }),
  );
  if (
    new Set(inputs.map((input) => input.manifest.version.split('.')[0]))
      .size !== 1
  )
    throw new Error('Upstream major versions must match.');
  for (const input of inputs)
    if (input.manifest.version !== pins[input.repo].version)
      throw new Error(
        `Expected pinned ${input.repo} ${pins[input.repo].version}.`,
      );
  const loaded: LoadedRecord[] = [];
  const packs: PackComparison[] = [];
  const fingerprints = [];
  for (const { repo, root, manifest, manifestText } of inputs) {
    const hash = createHash('sha256').update(manifestText);
    const directory = pins[repo].directory;
    const onDisk = (
      await readdir(join(root, directory), { withFileTypes: true })
    )
      .filter((item) => item.isDirectory())
      .map((item) => item.name);
    const declared = manifest.packs.map((pack) => pack.name);
    for (const pack of [...new Set([...declared, ...onDisk])].sort()) {
      const comparison: PackComparison = {
        repo,
        pack,
        declared: declared.includes(pack),
        present: onDisk.includes(pack),
        admitted: 0,
        excluded: 0,
        unassigned: 0,
      };
      packs.push(comparison);
      if (!comparison.present) continue;
      for (const file of (
        await readdir(join(root, directory, pack), { recursive: true })
      ).sort()) {
        if (!/\.ya?ml$/.test(file)) continue;
        const path = `${directory}/${pack}/${file}`;
        const text = await readFile(join(root, path), 'utf8');
        hash.update(path).update('\0').update(text).update('\0');
        try {
          loaded.push({
            repo,
            pack,
            path,
            record: upstreamRecord.parse(parse(text)),
          });
        } catch (cause) {
          throw new Error(`Invalid upstream YAML record: ${repo}/${path}`, {
            cause,
          });
        }
      }
    }
    fingerprints.push({
      repo,
      tag: pins[repo].tag,
      version: manifest.version,
      contentSha256: hash.digest('hex'),
    });
  }
  return { loaded, packs, fingerprints };
}

function findRaceBuilderFolders(loaded: LoadedRecord[]) {
  const raceBuilderFolders = new Set(['DrDUkvfcwfcx6AP9']);
  let changed = true;
  while (changed) {
    changed = false;
    for (const source of loaded)
      if (
        source.repo === 'pf1-content' &&
        source.pack === 'pf-racial-traits' &&
        source.record._key.startsWith('!folders!') &&
        source.record.folder &&
        raceBuilderFolders.has(source.record.folder) &&
        !raceBuilderFolders.has(source.record._id)
      ) {
        raceBuilderFolders.add(source.record._id);
        changed = true;
      }
  }
  return raceBuilderFolders;
}

function classifyRecords({
  loaded,
  packs,
}: Awaited<ReturnType<typeof loadCatalogInputs>>) {
  const raceBuilderFolders = findRaceBuilderFolders(loaded);
  const records: InventoryRecord[] = [];
  const candidates: Candidate[] = [];
  const keys = new Set<string>();
  for (const source of loaded) {
    const classification = classify({ source, raceBuilderFolders });
    const externalKey = toExternalKey(source);
    if (!source.record._key.startsWith('!folders!')) {
      if (keys.has(externalKey))
        throw new Error(`Duplicate upstream identity: ${externalKey}`);
      keys.add(externalKey);
    }
    const status = classification.kind;
    records.push({
      repo: source.repo,
      pack: source.pack,
      path: source.path,
      externalKey,
      name: source.record.name,
      status,
      reason:
        classification.kind === 'admitted'
          ? 'In scope for preview extraction; release admission remains pending.'
          : classification.reason,
    });
    const pack = packs.find(
      (pack) => pack.repo === source.repo && pack.pack === source.pack,
    );
    if (pack) pack[status]++;
    if (classification.kind === 'admitted')
      candidates.push({ source, kind: classification.entryKind });
  }
  return { records, candidates };
}

function resolveRemaps({
  candidates,
  remaps,
}: {
  candidates: Candidate[];
  remaps: ReviewedRemap[];
}) {
  const lookup = new Map(
    candidates.map((candidate) => [
      toExternalKey(candidate.source),
      candidate.source,
    ]),
  );
  const candidateKinds = new Map(
    candidates.map((candidate) => [
      toExternalKey(candidate.source),
      candidate.kind,
    ]),
  );
  const identities = new Map<string, string>();
  const remapOrigins = new Set<string>();
  const emittedIdentities = new Set<string>();
  for (const remap of remaps) {
    if (remapOrigins.has(remap.from))
      throw new Error(`Duplicate remap identity: ${remap.from}`);
    remapOrigins.add(remap.from);
    const fromKind = candidateKinds.get(remap.from);
    const toKind = candidateKinds.get(remap.to);
    if (
      (fromKind && fromKind !== remap.kind) ||
      (toKind && toKind !== remap.kind)
    )
      throw new Error(`Remap identity kind mismatch: ${remap.from}`);
    if (
      remap.from === remap.to ||
      (fromKind && toKind) ||
      remaps.some((other) => other.from === remap.to)
    )
      throw new Error(`Conflicting remap identity: ${remap.to}`);
    if (fromKind && emittedIdentities.has(remap.to))
      throw new Error(`Conflicting remap identity: ${remap.to}`);
    if (fromKind) emittedIdentities.add(remap.to);
    identities.set(remap.from, remap.to);
  }
  for (const [from, to] of identities) {
    const current = lookup.get(from);
    const retained = lookup.get(to);
    if (current) lookup.set(to, current);
    else if (retained) lookup.set(from, retained);
  }
  const resolveKey = (key: string) =>
    lookup.has(key) ? (identities.get(key) ?? key) : undefined;
  return { lookup, resolveKey };
}

function mapCandidates({
  candidates,
  lookup,
  resolveKey,
}: {
  candidates: Candidate[];
} & ReturnType<typeof resolveRemaps>) {
  const spellClassTags = new Set(
    [...lookup.values()]
      .filter(
        (source) => source.record.type === 'class' && source.pack === 'classes',
      )
      .map((source) => source.record.system.tag)
      .filter((tag): tag is string => typeof tag === 'string'),
  );
  return candidates
    .map(({ source, kind }) => {
      try {
        return mapEntry({ source, kind, resolveKey, lookup, spellClassTags });
      } catch (cause) {
        throw new Error(
          `Cannot map ${toExternalKey(source)} (${source.path})`,
          { cause },
        );
      }
    })
    .sort((left, right) => {
      if (left.externalKey < right.externalKey) return -1;
      if (left.externalKey > right.externalKey) return 1;
      return 0;
    });
}

function summariseImport({
  records,
  candidates,
  packs,
  fingerprints,
  mapped,
  remaps,
}: Pick<
  Awaited<ReturnType<typeof loadCatalogInputs>>,
  'packs' | 'fingerprints'
> &
  ReturnType<typeof classifyRecords> & {
    mapped: ReturnType<typeof mapCandidates>;
    remaps: ReviewedRemap[];
  }) {
  const candidateKeys = new Set(
    candidates.map(({ source }) => toExternalKey(source)),
  );
  const unsupportedEntries = mapped
    .filter((entry) => entry.unsupported.length)
    .map((entry) => ({
      externalKey: entry.externalKey,
      pack: entry.pack,
      issues: entry.unsupported,
    }));
  const byKind: Record<string, number> = {};
  for (const entry of mapped)
    byKind[entry.detail.kind] = (byKind[entry.detail.kind] ?? 0) + 1;
  const summary = {
    upstreamRecords: records.length,
    admitted: mapped.length,
    excluded: records.filter((row) => row.status === 'excluded').length,
    unassigned: records.filter((row) => row.status === 'unassigned').length,
    byKind,
  };
  return {
    catalog: {
      purpose: 'preview',
      releaseAdmission: 'not-evaluated',
      remaps: remaps.map((remap) => ({
        ...remap,
        applied: candidateKeys.has(remap.from) || candidateKeys.has(remap.to),
      })),
      inputs: fingerprints,
      summary,
      entries: mapped.filter((entry) => !isResource(entry)),
      resources: mapped.filter(isResource),
    },
    unsupported: {
      purpose: 'preview',
      summary: {
        entries: unsupportedEntries.length,
        issues: unsupportedEntries.reduce(
          (sum, entry) => sum + entry.issues.length,
          0,
        ),
      },
      entries: unsupportedEntries,
    },
    comparison: {
      coverageComplete:
        records.every((record) => record.status !== 'unassigned') &&
        packs.every((pack) => pack.present && pack.declared),
      summary,
      packs,
      records,
    },
  };
}
