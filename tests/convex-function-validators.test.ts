/// <reference types="vite/client" />

import { v } from 'convex/values';
import { defineSchema, defineTable } from 'convex/server';
import { expect, test } from 'vitest';
import { query } from '../convex/_generated/server';
import schema from '../convex/schema';

const modules = import.meta.glob<Record<string, unknown>>([
  '../convex/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
  '!../convex/_generated/**',
  '!../convex/**/*.d.ts',
  '!../convex/**/*.{test,spec}.{ts,js}',
  '!../convex/**/convex.config.{ts,js}',
  '!../convex/**/auth.config.{ts,js}',
]);

function validatorJson(validator: unknown): unknown {
  if (
    typeof validator !== 'object' ||
    validator === null ||
    !('json' in validator)
  )
    throw new Error('Validator does not export JSON metadata');
  return validator.json;
}

function invalidValidators(validator: unknown, path: string): string[] {
  if (Array.isArray(validator))
    return validator.flatMap((member, index) =>
      invalidValidators(member, `${path}[${index}]`),
    );
  if (typeof validator !== 'object' || validator === null) return [];
  const invalid: string[] = [];
  if (
    'type' in validator &&
    validator.type === 'object' &&
    'value' in validator &&
    typeof validator.value === 'object' &&
    validator.value !== null
  ) {
    for (const field of Object.keys(validator.value))
      if (!/^[A-Za-z0-9_]+$/.test(field))
        invalid.push(`${path}.value[${field}]: invalid object field`);
  }
  if ('type' in validator && validator.type === 'record') {
    if (
      !('keys' in validator) ||
      typeof validator.keys !== 'object' ||
      validator.keys === null ||
      !('type' in validator.keys) ||
      (validator.keys.type !== 'string' && validator.keys.type !== 'id')
    )
      invalid.push(`${path}.keys: expected string or id`);
  }
  return [
    ...invalid,
    ...Object.entries(validator).flatMap(([key, value]) =>
      invalidValidators(value, `${path}.${key}`),
    ),
  ];
}

test('all registered Convex functions and schema tables export supported validator metadata', async () => {
  // Deployment consumes these exports; convex-test does not validate their shape.
  const checked: string[] = [];
  const invalid: string[] = [];
  for (const [modulePath, load] of Object.entries(modules)) {
    // Mirror Convex entrypoint exclusions, including tests and configuration.
    const basename = modulePath.slice(modulePath.lastIndexOf('/') + 1);
    if (
      basename.split('.').length !== 2 ||
      basename.startsWith('.') ||
      basename.startsWith('#') ||
      modulePath.includes(' ') ||
      basename === 'schema.ts' ||
      basename === 'schema.js'
    )
      continue;
    const module = await load();
    for (const [name, registeredFunction] of Object.entries(module)) {
      if (
        registeredFunction === null ||
        (typeof registeredFunction !== 'object' &&
          typeof registeredFunction !== 'function') ||
        (!('exportArgs' in registeredFunction) &&
          !('exportReturns' in registeredFunction))
      )
        continue;
      const path = `${modulePath}:${name}`;
      if (
        !('exportArgs' in registeredFunction) ||
        typeof registeredFunction.exportArgs !== 'function' ||
        !('exportReturns' in registeredFunction) ||
        typeof registeredFunction.exportReturns !== 'function'
      )
        throw new Error(`${path} does not export Convex function metadata`);
      checked.push(path);
      const args: unknown = registeredFunction.exportArgs();
      const returns: unknown = registeredFunction.exportReturns();
      for (const [kind, metadata] of Object.entries({ args, returns })) {
        if (typeof metadata !== 'string')
          throw new Error(`${path}.${kind} metadata is not a string`);
        const validator: unknown = JSON.parse(metadata);
        invalid.push(...invalidValidators(validator, `${path}.${kind}`));
      }
    }
  }
  for (const [tableName, table] of Object.entries(schema.tables)) {
    const path = `../convex/schema.ts:${tableName}`;
    checked.push(path);
    invalid.push(
      ...invalidValidators(
        validatorJson(table.validator),
        `${path}.documentType`,
      ),
    );
  }
  expect(checked).toContain('../convex/characterSheet.ts:read');
  expect(checked).toContain('../convex/initialMigration.ts:start');
  expect(checked).toContain('../convex/clerk.ts:fulfill');
  expect(checked).toContain('../convex/schema.ts:character');
  expect(checked).toContain('../convex/schema.ts:catalogEntry');
  expect(invalid).toEqual([]);
});

test('the schema metadata guard catches nested dotted fields and literal-union record keys', () => {
  const fixture = defineSchema({
    malformed: defineTable({
      nested: v.array(
        v.union(
          v.object({ 'ability.str': v.number() }),
          v.record(v.union(v.literal('hp'), v.literal('bab')), v.number()),
        ),
      ),
    }),
  });
  expect(
    invalidValidators(
      validatorJson(fixture.tables.malformed.validator),
      'malformed.documentType',
    ),
  ).toEqual([
    'malformed.documentType.value.nested.fieldType.value.value[0].value[ability.str]: invalid object field',
    'malformed.documentType.value.nested.fieldType.value.value[1].keys: expected string or id',
  ]);
});

test('the schema metadata guard accepts nested string and id record keys', () => {
  const fixture = defineSchema({
    supported: defineTable({
      nested: v.array(
        v.union(
          v.object({ values: v.record(v.string(), v.number()) }),
          v.object({ values: v.record(v.id('character'), v.number()) }),
        ),
      ),
    }),
  });
  expect(
    invalidValidators(
      validatorJson(fixture.tables.supported.validator),
      'supported.documentType',
    ),
  ).toEqual([]);
});

test('the metadata guard catches nested dotted fields and literal-union record keys', () => {
  const registeredFunction: unknown = query({
    args: {
      nested: v.array(
        v.union(
          v.object({ 'ability.str': v.number() }),
          v.record(v.union(v.literal('hp'), v.literal('bab')), v.number()),
        ),
      ),
    },
    returns: v.null(),
    handler: () => null,
  });
  if (
    typeof registeredFunction !== 'function' ||
    !('exportArgs' in registeredFunction) ||
    typeof registeredFunction.exportArgs !== 'function'
  )
    throw new Error('Fixture does not export Convex function metadata');
  const metadata: unknown = registeredFunction.exportArgs();
  if (typeof metadata !== 'string')
    throw new Error('Fixture args metadata is not a string');
  const validator: unknown = JSON.parse(metadata);
  expect(invalidValidators(validator, 'args')).toEqual([
    'args.value.nested.fieldType.value.value[0].value[ability.str]: invalid object field',
    'args.value.nested.fieldType.value.value[1].keys: expected string or id',
  ]);
});
