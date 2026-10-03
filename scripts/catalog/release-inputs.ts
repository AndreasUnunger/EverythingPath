import { representativeClassCatalog } from '../../convex/lib/representativeClassCatalog.ts';
import { readFile, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { parse } from 'yaml';
import {
  isObject,
  parseReleaseJson,
} from '../../src/lib/catalog/release-schema.ts';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

/** Follow only the importer's explicit local dependency graph, never app code. */
export async function catalogImplementationInputs() {
  const files = await collectImplementationSources();
  const dependencyVersions = await readInstalledParserVersions();
  const dependencyResolution =
    await readParserDependencyResolution(dependencyVersions);
  return {
    parsers: {
      files: Object.fromEntries(
        [...files].sort(([a], [b]) => a.localeCompare(b)),
      ),
      dependencyVersions,
      dependencyResolution,
    },
    sanitizers: {
      source: files.get('scripts/catalog/sanitize.ts'),
      parse5: dependencyVersions.parse5,
    },
    ruleResources: await readAuthoredRuleResources(),
  };
}

async function collectImplementationSources() {
  const files = new Map<string, string>();
  async function collectSource(path: string) {
    const absolute = resolve(projectRoot, path);
    const key = relative(projectRoot, absolute).replaceAll('\\', '/');
    if (files.has(key)) return;
    const source = await readFile(absolute, 'utf8');
    files.set(key, source);
    if (extname(absolute) !== '.ts') return;
    for (const match of source.matchAll(
      /\bfrom\s+['"](\.[^'"]+)['"]|\bimport\s+['"](\.[^'"]+)['"]/g,
    )) {
      const specifier = match[1] ?? match[2];
      if (!specifier) continue;
      const target = resolve(dirname(absolute), specifier);
      await collectSource(extname(target) ? target : `${target}.ts`);
    }
  }
  for (const entry of [
    'scripts/catalog/import.ts',
    'scripts/catalog/admission.ts',
    'scripts/catalog/release.ts',
    'src/lib/catalog/legal-page-data.ts',
  ])
    await collectSource(entry);
  return files;
}

async function readInstalledParserVersions() {
  const [yaml, parse5, zod, entities] = await Promise.all([
    readInstalledPackageVersion('yaml'),
    readInstalledPackageVersion('parse5'),
    readInstalledPackageVersion('zod'),
    readEntitiesVersion(),
  ]);
  return { yaml, parse5, zod, entities };
}

async function readInstalledPackageVersion(name: string) {
  const data: unknown = JSON.parse(
    await readFile(
      resolve(projectRoot, 'node_modules', name, 'package.json'),
      'utf8',
    ),
  );
  if (!isObject(data) || typeof data.version !== 'string')
    throw new Error(`Missing parser version: ${name}.`);
  return data.version;
}

async function readEntitiesVersion() {
  const entitiesEntry = createRequire(
    await realpath(resolve(projectRoot, 'node_modules/parse5/package.json')),
  ).resolve('entities');
  let entityDirectory = dirname(entitiesEntry);
  let entitiesVersion: string | undefined;
  while (entityDirectory !== dirname(entityDirectory)) {
    try {
      const data: unknown = JSON.parse(
        await readFile(resolve(entityDirectory, 'package.json'), 'utf8'),
      );
      if (
        isObject(data) &&
        data.name === 'entities' &&
        'version' in data &&
        typeof data.version === 'string'
      ) {
        entitiesVersion = data.version;
        break;
      }
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !('code' in error) ||
        error.code !== 'ENOENT'
      )
        throw error;
    }
    entityDirectory = dirname(entityDirectory);
  }
  if (!entitiesVersion)
    throw new Error('Missing parse5 entities dependency version.');
  return entitiesVersion;
}

async function readParserDependencyResolution(
  dependencyVersions: Record<string, string>,
) {
  const lock: unknown = parse(
    await readFile(resolve(projectRoot, 'pnpm-lock.yaml'), 'utf8'),
  );
  if (!isObject(lock) || !isObject(lock.packages) || !isObject(lock.snapshots))
    throw new Error('Invalid parser dependency lock.');
  const packages = lock.packages;
  const snapshots = lock.snapshots;
  const dependencyResolution = Object.fromEntries(
    Object.entries(dependencyVersions).map(([name, version]) => {
      const key = `${name}@${version}`;
      if (!(key in packages) || !(key in snapshots))
        throw new Error(`Missing parser lock entry: ${key}.`);
      return [
        key,
        {
          package: parseReleaseJson(packages[key]),
          snapshot: parseReleaseJson(snapshots[key]),
        },
      ];
    }),
  );
  return dependencyResolution;
}

async function readAuthoredRuleResources() {
  return {
    representativeClassCatalog: {
      source: await readFile(
        resolve(projectRoot, 'convex/lib/representativeClassCatalog.ts'),
        'utf8',
      ),
      definitions: representativeClassCatalog,
    },
    castingTables: null,
  };
}
