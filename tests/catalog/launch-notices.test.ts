// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { launchManifestCopies } from './launch-manifest';
import { inspectLaunchInventory } from '../../scripts/catalog/launch-inventory';
import type { LaunchManifest } from '../../scripts/catalog/launch-inventory-schema';
import { section15Registry } from '../../src/lib/catalog/reviewed-data';

const document: unknown = JSON.parse(
  await readFile(
    new URL(
      '../../scripts/catalog/scopes/campaign-mvp-v1.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const freshManifest = launchManifestCopies(document);

function omitNotice(value: LaunchManifest, key: string, coverage: boolean) {
  value.rows = value.rows.filter((row) => row.key !== key);
  value.edges = value.edges.filter(
    (edge) => edge.from !== key && edge.to !== key,
  );
  if (coverage)
    for (const entry of value.coverage)
      entry.keys = entry.keys.filter((entry) => entry !== key);
}

it('rejects loss of the Tiefling PZO9280 notice even with its edges and coverage removed', () => {
  const value = freshManifest();
  const key = 'notice/PZO9280';
  value.rows = value.rows.filter((row) => row.key !== key);
  value.edges = value.edges.filter(
    (edge) => edge.from !== key && edge.to !== key,
  );
  for (const coverage of value.coverage)
    coverage.keys = coverage.keys.filter((entry) => entry !== key);
  const report = inspectLaunchInventory(value);
  expect(report.inventoryErrors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: 'notice-required',
        key,
        owner: expect.objectContaining({ issue: 737 }),
        paths: expect.arrayContaining([
          expect.objectContaining({ keys: ['pf1/nVjKDLZSRONzYm8f', key] }),
        ]),
      }),
    ]),
  );
  expect(report.genericComplete).toBe(false);
});

it('keeps unchanged generic completeness separate from notice holds and pending party proof', () => {
  const report = inspectLaunchInventory(document);
  expect(report.inventoryErrors).toEqual([]);
  expect(report.genericComplete).toBe(true);
  expect(report.launchQualified).toBe(false);
  expect(report.party.status).toBe('pending');
  // PZO9280 is verified since its PCGen confirmation's review was recorded
  // (2026-10-31); PZO9413, whose `OGL.txt` lacks its own line, stays held.
  expect(report.launchFailures).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        key: 'notice/PZO9413',
        owner: expect.objectContaining({ issue: 737 }),
      }),
    ]),
  );
});

it.each(['notice/PZO1110', 'notice/PZO1112', 'notice/PZO1131'])(
  'rejects governing/transitive %s omission with every edge and coverage reference',
  (key) => {
    const value = freshManifest();
    omitNotice(value, key, true);
    const report = inspectLaunchInventory(value);
    expect(report.genericComplete).toBe(false);
    expect(report.inventoryErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'notice-required',
          key,
          owner: expect.objectContaining({ issue: 737 }),
        }),
      ]),
    );
    expect(report.launchFailures.some(({ key: other }) => other !== key)).toBe(
      true,
    );
  },
);

it('rejects Tiefling notice omission even when unchanged coverage still mentions it', () => {
  const value = freshManifest();
  omitNotice(value, 'notice/PZO9280', false);
  expect(inspectLaunchInventory(value).inventoryErrors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: 'notice-required',
        key: 'notice/PZO9280',
      }),
      expect.objectContaining({
        code: 'notice-coverage',
        key: 'notice/PZO9280',
      }),
    ]),
  );
});

it('independently accounts for every required notice after simultaneous public omission', () => {
  const value = freshManifest();
  const keys = value.rows
    .filter(
      ({ kind, requirement }) =>
        kind === 'notice' && requirement === 'required',
    )
    .map(({ key }) => key);
  expect(keys).toHaveLength(70);
  const omitted = new Set(keys);
  value.rows = value.rows.filter(({ key }) => !omitted.has(key));
  value.edges = value.edges.filter(
    ({ from, to }) => !omitted.has(from) && !omitted.has(to),
  );
  for (const coverage of value.coverage)
    coverage.keys = coverage.keys.filter((key) => !omitted.has(key));
  const report = inspectLaunchInventory(value);
  expect(
    new Set(
      report.inventoryErrors
        .filter(
          ({ code, owner }) =>
            code === 'notice-required' && owner?.issue === 737,
        )
        .map(({ key }) => key),
    ),
  ).toEqual(omitted);
  expect(report.genericComplete).toBe(false);
});

it.each(['inventoryOwner', 'implementationOwner', 'publicTestOwner'] as const)(
  'rejects altered required notice %s while reporting the independently known owner',
  (field) => {
    const value = freshManifest();
    const row = value.rows.find(({ key }) => key === 'notice/PZO9280');
    if (!row) throw new Error('Missing Tiefling notice.');
    row[field] = { ...row[field], issue: 768 };
    expect(inspectLaunchInventory(value).inventoryErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'notice-owner',
          key: row.key,
          owner: expect.objectContaining({ issue: 737 }),
        }),
      ]),
    );
  },
);

it.each(['inventoryOwner', 'implementationOwner', 'publicTestOwner'])(
  'rejects a missing required notice %s at the structural public boundary',
  (field) => {
    const value = freshManifest();
    const corrupted: unknown = {
      ...value,
      rows: value.rows.map((row) =>
        row.key === 'notice/PZO9280' ? { ...row, [field]: undefined } : row,
      ),
    };
    expect(() => inspectLaunchInventory(corrupted)).toThrow(field);
  },
);

it.each(['raw hash', 'effective hash', 'pin', 'locator', 'repository'])(
  'rejects a valid-format corrupt notice %s despite matching submitted observations',
  (change) => {
    const value = freshManifest();
    const row = value.rows.find(({ key }) => key === 'notice/PZO9280');
    const source = row?.sources[0];
    if (!source || !row)
      throw new Error('Missing original Tiefling notice provenance.');
    if (change === 'raw hash') source.rawSha256 = '0'.repeat(64);
    if (change === 'effective hash') source.effectiveSha256 = '0'.repeat(64);
    if (change === 'pin') source.pin = '0'.repeat(40);
    if (change === 'locator')
      source.locator = 'packs/spells/darkness.tsndfcfijmgxs37p.yaml';
    if (change === 'repository') source.repository = 'pf1-content';
    expect(
      inspectLaunchInventory(value, {
        bindings: value.rows.flatMap(({ sources }) => sources),
      }).inventoryErrors,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'notice-source',
          key: row.key,
          owner: expect.objectContaining({ issue: 737 }),
        }),
      ]),
    );
  },
);

it.each(['remove', 'citation', 'reason', 'condition', 'evidence'])(
  'rejects %s corruption of the Tiefling incoming notice dependency',
  (change) => {
    const value = freshManifest();
    const edge = value.edges.find(
      ({ from, to, kind }) =>
        from === 'pf1/nVjKDLZSRONzYm8f' &&
        to === 'notice/PZO9280' &&
        kind === 'notice',
    );
    if (!edge)
      throw new Error('Missing original races-328 Tiefling notice dependency.');
    if (change === 'remove')
      value.edges = value.edges.filter((entry) => entry !== edge);
    if (change === 'citation') edge.kind = 'citation';
    if (change === 'reason') edge.reason = 'Bibliographic citation only.';
    if (change === 'condition') edge.condition = 'Only when Darkness is used.';
    if (change === 'evidence')
      edge.evidence = ['scripts/catalog/legal/traits-382.json'];
    const report = inspectLaunchInventory(value);
    expect(report.inventoryErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'notice-edge',
          key: edge.to,
          owner: expect.objectContaining({ issue: 737 }),
        }),
      ]),
    );
    expect(report.genericComplete).toBe(false);
  },
);

it('reports a lost transitive familiar notice path even while the notice and its own edges survive', () => {
  const value = freshManifest();
  const fox = 'pf1-content/A3iwocEZULdxK0n7';
  const notice = value.edges.find(
    ({ from, kind }) => from === fox && kind === 'notice',
  );
  if (!notice) throw new Error('Missing APG Fox notice dependency.');
  expect(
    value.edges.some(({ to, condition }) => to === fox && condition !== null),
  ).toBe(true);
  value.edges = value.edges.filter(
    ({ to, kind }) => to !== fox || kind === 'citation',
  );
  const report = inspectLaunchInventory(value);
  expect(report.inventoryErrors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: 'notice-path',
        key: notice.to,
        paths: expect.arrayContaining([
          expect.objectContaining({
            keys: expect.arrayContaining([fox, notice.to]),
          }),
        ]),
      }),
    ]),
  );
});

it('invalidates notice scope when a governing non-notice source binding changes', () => {
  const value = freshManifest();
  const source = value.rows.find(({ key }) => key === 'pf1/nVjKDLZSRONzYm8f')
    ?.sources[0];
  if (!source) throw new Error('Missing Tiefling pinned source.');
  source.rawSha256 = '0'.repeat(64);
  expect(inspectLaunchInventory(value).inventoryErrors).toEqual(
    expect.arrayContaining([expect.objectContaining({ code: 'notice-scope' })]),
  );
});

it('does not turn an optional retained notice into a universal required dependency', () => {
  const value = freshManifest();
  expect(
    value.rows.find(({ key }) => key === 'notice/PZO1133')?.requirement,
  ).toBe('optional');
  omitNotice(value, 'notice/PZO1133', true);
  expect(inspectLaunchInventory(value).genericComplete).toBe(true);
});

it('keeps independent notice context intact when a caller edits an earlier report', () => {
  const value = freshManifest();
  omitNotice(value, 'notice/PZO9280', true);
  const first = inspectLaunchInventory(value).inventoryErrors.find(
    ({ code, key }) => code === 'notice-required' && key === 'notice/PZO9280',
  );
  if (!first?.owner) throw new Error('Missing independent notice owner.');
  Reflect.set(first.owner, 'issue', 768);
  Reflect.set(first.paths, 'length', 0);
  expect(inspectLaunchInventory(value).inventoryErrors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: 'notice-required',
        key: 'notice/PZO9280',
        owner: expect.objectContaining({ issue: 737 }),
        paths: expect.arrayContaining([
          expect.objectContaining({
            keys: ['pf1/nVjKDLZSRONzYm8f', 'notice/PZO9280'],
          }),
        ]),
      }),
    ]),
  );
});

// Notice-hold clearance (owner decisions 2026-10-30): a required notice row
// observes its notice instead of being held regardless of data.
it('observes the clearance and Registry review on required notice rows', () => {
  const value = freshManifest();
  const failures = inspectLaunchInventory(value).launchFailures;
  const observe = (key: string) => {
    const row = value.rows.find((other) => other.key === key);
    expect(row?.requirement, key).toBe('required');
    return {
      states: [
        row?.admission.state,
        row?.structure.state,
        row?.contentEvidence.state,
        row?.noticeEvidence.state,
      ],
      inclusion: row?.mechanisms.map(({ status }) => status),
      holds: row?.holds.map(({ reason }) => reason),
      failures: failures.filter((failure) => failure.key === key).length,
    };
  };
  const verified = {
    states: ['verified', 'verified', 'verified', 'verified'],
    inclusion: ['reused'],
    holds: [],
    failures: 0,
  };
  // A reviewed Registry identity, or a matched, checked PCGen block (#716
  // decision 5, extended), with every hold on it cleared.
  // PZO9280's PCGen block is checked since its confirmation's review was
  // recorded (2026-10-31).
  for (const key of [
    'notice/PZO1110',
    'notice/PZO1118',
    'notice/PZO1140',
    'notice/PZO9280',
  ])
    expect(observe(key), key).toEqual(verified);
  // A PRD record counts once its review is recorded.
  expect(observe('notice/PZO1131')).toEqual(
    section15Registry.PZO1131?.reviewStatus === 'reviewed'
      ? verified
      : {
          states: ['unreviewed', 'unreviewed', 'unreviewed', 'unreviewed'],
          inclusion: ['outstanding'],
          holds: [],
          failures: 5,
        },
  );
  // No Registry identity: held until the owner supplies the text.
  expect(observe('notice/PZO9413')).toEqual({
    states: ['held', 'held', 'held', 'held'],
    inclusion: ['outstanding'],
    holds: [
      'PZO9413: no Registry identity or usable PCGen confirmation; the owner supplies the notice text.',
    ],
    failures: 6,
  });
});
