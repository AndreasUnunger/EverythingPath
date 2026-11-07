// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
  parseGrantedSpellMap,
  reviewedGrantedSpells,
  reviewedOptionOwners,
  withGrantedSpells,
  type GrantedSpellRecord,
  type OptionOwnerRecord,
} from '../../scripts/catalog/granted-spells';
import type { PreviewEntry } from '../../scripts/catalog/map';
import type { SourceRecord } from '../../scripts/catalog/records';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';

// A synthetic domain feature whose body lists two Spells, as Foundry's
// class-ability bodies do.
const body = '<p>Domain Spells: 1st—proof one, 2nd—proof two.</p>';
const sourceRecord: SourceRecord = {
  _id: 'proofDomain',
  _key: '!items!proofDomain',
  name: 'Proof Domain',
  type: 'feat',
  system: { description: { value: body } },
};
const entry: PreviewEntry = {
  externalKey: 'pf1/proofDomain',
  upstreamKey: 'pf1/proofDomain',
  pack: 'class-abilities',
  name: 'Proof Domain',
  detail: { kind: 'classFeature' },
  description: body,
  sources: [{ book: 'PZO1110', pages: '1' }],
  modifiers: [],
  unsupported: [],
};
const domainRecord = {
  featureKey: 'pf1/proofDomain',
  bodySha256: createHash('sha256').update(body).digest('hex'),
  grantedLevels: { kind: 'domain', name: 'Proof' },
  optionKind: 'domain',
  style: 'slot',
  extraSlot: 'domain',
  spells: [
    { spellLevel: 1, spellKey: 'pf1/proofOne' },
    { spellLevel: 2, spellKey: 'pf1/proofTwo' },
  ],
  status: 'checked',
  reviewedBy: 'reviewer',
  reviewedOn: '2026-11-06',
  receipt: `t3-review-${'0'.repeat(64)}`,
} as const;
const { extraSlot: _slot, ...domainWithoutSlot } = domainRecord;
const bloodlineRecord = {
  ...domainWithoutSlot,
  grantedLevels: { kind: 'bloodline', name: 'Proof' },
  optionKind: 'bloodline',
  style: 'schedule',
  schedule: 'sorcerer',
} as const;
const { schedule: _schedule, ...bloodlineWithoutSchedule } = bloodlineRecord;
// The Inquisitor's Domain: its options give powers only (APG p. 38).
const ownerRecord = {
  featureKey: 'pf1/proofDomain',
  bodySha256: domainRecord.bodySha256,
  chooses: 'domain',
  optionGrantsSpells: false,
  status: 'checked',
  reviewedBy: domainRecord.reviewedBy,
  reviewedOn: domainRecord.reviewedOn,
  receipt: domainRecord.receipt,
} as const;
const resolveAll = (key: string) => key;
const apply = (
  records: readonly unknown[],
  resolveKey: (key: string) => string | undefined = resolveAll,
  owners: readonly unknown[] = [],
) =>
  withGrantedSpells({
    entry,
    record: sourceRecord,
    resolveKey,
    records: records as GrantedSpellRecord[],
    owners: owners as OptionOwnerRecord[],
  });
const map = (features: unknown[], optionOwners: unknown[] = []) =>
  parseGrantedSpellMap({ version: 1, features, optionOwners });

describe('the reviewed granted-spell map', () => {
  it('ships empty, so no imported class feature gains casting facts', () => {
    expect(reviewedGrantedSpells).toEqual([]);
    expect(reviewedOptionOwners).toEqual([]);
    expect(
      withGrantedSpells({
        entry,
        record: sourceRecord,
        resolveKey: resolveAll,
      }),
    ).toBe(entry);
  });

  it('gives a checked record’s feature its Granted Spells by release key, in the imported schema', () => {
    const mapped = apply(map([domainRecord]).features, (key) =>
      key === 'pf1/proofTwo' ? 'pf1/proofTwoRemapped' : key,
    );
    expect(mapped.detail).toEqual({
      kind: 'classFeature',
      spellcasting: {
        optionKind: 'domain',
        extraSlot: 'domain',
        grantedSpells: {
          style: 'slot',
          spells: [
            { spellLevel: 1, spellKey: 'pf1/proofOne' },
            { spellLevel: 2, spellKey: 'pf1/proofTwoRemapped' },
          ],
        },
      },
    });
    expect(mapped.unsupported).toEqual([]);
    expect(importedCatalogEntrySchema.safeParse(mapped).success).toBe(true);
  });

  it('writes the sorcerer schedule as spell level N at class level 2N + 1', () => {
    const [record] = map([bloodlineRecord]).features;
    const { detail } = apply([record]);
    expect(detail.kind === 'classFeature' && detail.spellcasting).toEqual({
      optionKind: 'bloodline',
      grantedSpells: {
        style: 'schedule',
        schedule: [
          { spellLevel: 1, classLevel: 3 },
          { spellLevel: 2, classLevel: 5 },
        ],
        spells: domainRecord.spells,
      },
    });
  });

  it('gives a checked option owner’s feature its choice and withholds its options’ Spells, bound to its body', () => {
    const owned = apply([], resolveAll, map([], [ownerRecord]).optionOwners);
    expect(owned.detail).toEqual({
      kind: 'classFeature',
      spellcasting: { chooses: 'domain', optionGrantsSpells: false },
    });
    expect(importedCatalogEntrySchema.safeParse(owned).success).toBe(true);
    const stale = apply([], resolveAll, [
      { ...ownerRecord, bodySha256: 'a'.repeat(64) },
    ]);
    expect(stale.detail).toEqual({ kind: 'classFeature' });
    expect(stale.unsupported).toEqual([
      expect.objectContaining({ field: 'spellcasting' }),
    ]);
  });

  it('applies no drafted record, and refuses a record bound to another body or naming a Spell outside the import', () => {
    expect(
      apply([
        {
          ...domainRecord,
          status: 'drafted',
          reviewedBy: undefined,
          reviewedOn: undefined,
          receipt: undefined,
        },
      ]),
    ).toBe(entry);
    const stale = apply([{ ...domainRecord, bodySha256: 'a'.repeat(64) }]);
    expect(stale.detail).toEqual({ kind: 'classFeature' });
    expect(stale.unsupported).toEqual([
      expect.objectContaining({ field: 'spellcasting' }),
    ]);
    const missing = apply([domainRecord], (key) =>
      key === 'pf1/proofTwo' ? undefined : key,
    );
    expect(missing.detail).toEqual({ kind: 'classFeature' });
    expect(missing.unsupported).toEqual([
      {
        field: 'spellcasting',
        reason: 'Missing or out-of-scope Granted Spell.',
        value: ['pf1/proofTwo'],
      },
    ]);
  });

  // Standards r1 #1: each route is a schema variant, so every other
  // combination of its fields fails the schema.
  it.each([
    ['a slot-style bloodline', { ...bloodlineRecord, style: 'slot' }],
    [
      'a slot-style bloodline with the domain slot',
      {
        ...bloodlineWithoutSchedule,
        style: 'slot',
        extraSlot: 'domain',
      },
    ],
    ['a schedule-style grant without its schedule', bloodlineWithoutSchedule],
    [
      'a scheduled grant with the domain slot',
      { ...bloodlineRecord, extraSlot: 'domain' },
    ],
    [
      'a schedule-style domain',
      { ...domainWithoutSlot, style: 'schedule', schedule: 'sorcerer' },
    ],
    ['a domain with a schedule', { ...domainRecord, schedule: 'sorcerer' }],
    ['a domain without its slot', domainWithoutSlot],
    [
      'domain levels as a bloodline',
      { ...domainRecord, optionKind: 'bloodline' },
    ],
    [
      'bloodline levels as a domain',
      { ...bloodlineRecord, optionKind: 'domain' },
    ],
  ])('refuses %s', (_name, record) => {
    expect(() => map([record])).toThrow(ZodError);
  });

  it('refuses two Spells at one level and two records for one feature or one pair', () => {
    const parse =
      (...features: unknown[]) =>
      () =>
        map(features);
    expect(
      parse({
        ...domainRecord,
        spells: [domainRecord.spells[0], domainRecord.spells[0]],
      }),
    ).toThrow('two Spells at one level');
    expect(parse(domainRecord, domainRecord)).toThrow(
      'Two granted-spell records share pf1/proofDomain',
    );
    expect(
      parse(domainRecord, { ...domainRecord, featureKey: 'pf1/otherDomain' }),
    ).toThrow('Two granted-spell records share ["domain","Proof"]');
    expect(() => map([domainRecord], [ownerRecord])).toThrow(
      'Two granted-spell records share pf1/proofDomain',
    );
    // A drafted record names no reviewer, date or receipt.
    expect(parse({ ...domainRecord, status: 'drafted' })).toThrow(ZodError);
  });
});
