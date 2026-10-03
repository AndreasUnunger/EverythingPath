const referenceFields = new Set([
  'catalogEntryId',
  'classEntryId',
  'favoredClassIds',
  'racialTraits',
  'raceEntryIds',
  'classEntryIds',
  'replaces',
  'counterpartOf',
  'feats',
  'whileActive',
  'option',
]);

/** Change content references without changing provenance or durable identities. */
export function remapCatalogReferences<Value>(
  value: Value,
  originalId: string,
  copyId: string,
): Value {
  const result = structuredClone(value);
  function visit(input: unknown, references = false): unknown {
    if (typeof input === 'string')
      return references && input === originalId ? copyId : input;
    if (Array.isArray(input)) return input.map((row) => visit(row, references));
    if (input && typeof input === 'object')
      for (const key of Object.keys(input))
        Reflect.set(
          input,
          key,
          visit(Reflect.get(input, key), referenceFields.has(key)),
        );
    return input;
  }
  visit(result);
  return result;
}

export type CatalogReference = {
  id: string;
  kind: 'definition' | 'class' | 'condition';
};

/** The same reference fields drive dependency discovery and ID remapping. */
export function listCatalogReferences(value: unknown): CatalogReference[] {
  const result: CatalogReference[] = [];
  function visit(input: unknown, field?: string) {
    if (typeof input === 'string' && field && referenceFields.has(field)) {
      result.push({
        id: input,
        kind:
          field === 'counterpartOf' ||
          field === 'classEntryId' ||
          field === 'favoredClassIds'
            ? 'class'
            : field === 'whileActive' || field === 'option'
              ? 'condition'
              : 'definition',
      });
    } else if (Array.isArray(input)) {
      for (const row of input) visit(row, field);
    } else if (input && typeof input === 'object') {
      for (const [key, child] of Object.entries(input)) visit(child, key);
    }
  }
  visit(value);
  return result;
}
