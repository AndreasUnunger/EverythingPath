// @vitest-environment node
import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  auditWriters,
  readWriterSources,
  writerInventory,
} from '../scripts/lib/initial-migration-writers';

test('public mutation validators accept an optional numeric write epoch, including retired endpoints', () => {
  const audit = auditWriters({
    'convex/example.ts': `
    import { mutation as save } from './_generated/server';
    import * as server from './_generated/server';
    import { v } from 'convex/values';
    import { rejectRetiredWorkflow } from './lib/retiredWorkflow';
    export const missing = save({args:{}, handler: rejectRetiredWorkflow});
    export const required = save({args:{writeEpoch: v.number()}, handler: rejectRetiredWorkflow});
    export const wrongType = save({args:{writeEpoch: v.optional(v.string())}, handler: rejectRetiredWorkflow});
    export const supported = server.mutation({args:{writeEpoch: v.optional(v.number())}, handler: rejectRetiredWorkflow});
    export const legacy = save({args: v.any(), handler: rejectRetiredWorkflow});
  `,
  });
  expect(audit.errors).toEqual([
    'convex/example.ts:missing public mutation must accept optional writeEpoch',
    'convex/example.ts:required public mutation must accept optional writeEpoch',
    'convex/example.ts:wrongType public mutation must accept optional writeEpoch',
  ]);
});

test('new raw writers fail even when an import disguises the registration name', () => {
  const audit = auditWriters({
    'convex/canonicalDraftPersistence.ts': `
    import { internalMutation } from './_generated/server';
    export const retireOtherDraft = internalMutation({args:{}, handler: async () => null});
  `,
    'convex/new.ts': `
    import { internalMutation as save } from './_generated/server';
    export const importCharacters = save({args:{}, handler: async ctx => ctx.db.insert('character', {})});
  `,
  });
  expect(audit.errors).toEqual([
    'convex/canonicalDraftPersistence.ts:retireOtherDraft is not gated or a reviewed exception',
    'convex/new.ts:importCharacters is not gated or a reviewed exception',
  ]);
});

test('gated aliases pass, retired names only pass while their handler rejects', () => {
  const audit = auditWriters({
    'convex/example.ts': `
    import { gatedMutation as save } from './lib/writeGate';
    import { mutation } from './_generated/server';
    import { rejectRetiredWorkflow } from './lib/retiredWorkflow';
    export const current = save({args:{}, handler: async () => null});
    export const retired = mutation({args:{writeEpoch: v.optional(v.number())}, handler: rejectRetiredWorkflow});
    export const revived = mutation({args:{writeEpoch: v.optional(v.number())}, handler: async () => null});
  `,
  });
  expect(audit.errors).toEqual([
    'convex/example.ts:revived is not gated or a reviewed exception',
  ]);
  expect(audit.writers).toHaveLength(3);
});

test('namespace registration and new side effects in a read-only exception fail closed', () => {
  const audit = auditWriters({
    'convex/new.ts': `import * as server from './_generated/server'; export const save = server.mutation({args:{writeEpoch: v.optional(v.number())}, handler: async () => null});`,
    'convex/canonicalPersistenceFixtures.ts': `import { internalMutation as inspectMutation } from './_generated/server'; export const inspect = inspectMutation({handler: async ctx => ctx.db.patch('id', {})});`,
  });
  expect(audit.errors).toEqual([
    'convex/canonicalPersistenceFixtures.ts:inspect read-only exception now writes or schedules work',
    'convex/new.ts:save is not gated or a reviewed exception',
  ]);
});

test('raw builder aliases and custom wrappers cannot escape the inventory', () => {
  const audit = auditWriters({
    'convex/escape.ts': `
    import { mutation } from './_generated/server';
    import { customMutation } from 'convex-helpers/server/customFunctions';
    const save = mutation;
    export const hidden = save({handler: async () => null});
    export const wrapped = customMutation(mutation, {});
  `,
  });
  expect(audit.errors).toEqual([
    'convex/escape.ts raw builder mutation escapes a direct registration',
    'convex/escape.ts raw builder mutation escapes a direct registration',
  ]);
});

test('webhooks and reviewed draft retirement declare their epoch exemptions', () => {
  const audit = auditWriters({
    'convex/example.ts': `
    import { gatedWebhookMutation } from './lib/writeGate';
    export const receive = gatedWebhookMutation({args:{}, handler: async () => null});
  `,
    'convex/canonicalDraftPersistence.ts': `
    import { internalMutation } from './_generated/server';
    export const retireClosedDraft = internalMutation({args:{}, handler: async () => null});
  `,
  });
  expect(audit.errors).toEqual([]);
  expect(audit.writers).toEqual([
    {
      name: 'convex/canonicalDraftPersistence.ts:retireClosedDraft',
      policy:
        'Write gate (maintenance defers); accepted draft retirement is idempotent across epochs and Character authority',
    },
    {
      name: 'convex/example.ts:receive',
      policy:
        'Write gate (maintenance + legacy authority); idempotent webhook, epoch exempt',
    },
  ]);
});

test('every current registration is gated or reviewed and the committed inventory is complete', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const audit = auditWriters(readWriterSources(root));
  expect(audit.errors).toEqual([]);
  const doc = readFileSync(
    new URL(
      '../docs/initial-character-migration-write-gate.md',
      import.meta.url,
    ),
    'utf8',
  );
  expect(doc).toContain(writerInventory(audit.writers));
});
