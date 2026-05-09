import { internal } from './_generated/api';
import { internalMutation, mutation, query } from './_generated/server';
import { ConvexError, v } from 'convex/values';

const LEGACY_SCHEMA_MIGRATION = 'legacy_ownerId_and_notoriety_backfill';
const BATCH_SIZE = 100;

export const getLegacySchemaMigrationStatus = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('dataMigration')
      .withIndex('by_name', (q) => q.eq('name', LEGACY_SCHEMA_MIGRATION))
      .unique();
  },
});

export const startLegacySchemaMigration = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const existing = await ctx.db
      .query('dataMigration')
      .withIndex('by_name', (q) => q.eq('name', LEGACY_SCHEMA_MIGRATION))
      .unique();

    let migrationId = existing?._id;
    if (existing?.status === 'running') {
      return existing;
    }

    if (existing) {
      await ctx.db.patch('dataMigration', existing._id, {
        status: 'running',
        stage: 'characters',
        characterCursor: undefined,
        militiaCursor: undefined,
        migratedCharacterCount: 0,
        migratedMilitiaCount: 0,
        startedAt: now,
        updatedAt: now,
        completedAt: undefined,
        error: undefined,
      });
    } else {
      migrationId = await ctx.db.insert('dataMigration', {
        name: LEGACY_SCHEMA_MIGRATION,
        status: 'running',
        stage: 'characters',
        migratedCharacterCount: 0,
        migratedMilitiaCount: 0,
        startedAt: now,
        updatedAt: now,
      });
    }

    if (!migrationId) {
      throw new ConvexError('Failed to initialize legacy schema migration.');
    }

    await ctx.scheduler.runAfter(0, internal.migrations.runLegacySchemaMigrationBatch, {
      migrationId,
    });

    return await ctx.db.get('dataMigration', migrationId);
  },
});

export const runLegacySchemaMigrationBatch = internalMutation({
  args: {
    migrationId: v.id('dataMigration'),
  },
  handler: async (ctx, args) => {
    const migration = await ctx.db.get('dataMigration', args.migrationId);
    if (migration?.name !== LEGACY_SCHEMA_MIGRATION) {
      return;
    }
    if (migration.status !== 'running') {
      return;
    }

    const now = Date.now();

    try {
      if (migration.stage === 'characters') {
        const { page, continueCursor, isDone } = await ctx.db
          .query('character')
          .paginate({
            numItems: BATCH_SIZE,
            cursor: migration.characterCursor ?? null,
          });

        let migratedCharacterCount = migration.migratedCharacterCount;
        for (const character of page) {
          if (typeof character.ownerId === 'number') {
            await ctx.db.patch('character', character._id, {
              ownerId: String(character.ownerId),
            });
            migratedCharacterCount += 1;
          }
        }

        if (!isDone) {
          await ctx.db.patch('dataMigration', migration._id, {
            characterCursor: continueCursor ?? undefined,
            migratedCharacterCount,
            updatedAt: now,
          });
          await ctx.scheduler.runAfter(
            0,
            internal.migrations.runLegacySchemaMigrationBatch,
            { migrationId: migration._id },
          );
          return;
        }

        await ctx.db.patch('dataMigration', migration._id, {
          stage: 'militias',
          characterCursor: undefined,
          migratedCharacterCount,
          updatedAt: now,
        });
        await ctx.scheduler.runAfter(0, internal.migrations.runLegacySchemaMigrationBatch, {
          migrationId: migration._id,
        });
        return;
      }

      if (migration.stage === 'militias') {
        const { page, continueCursor, isDone } = await ctx.db
          .query('militia')
          .paginate({
            numItems: BATCH_SIZE,
            cursor: migration.militiaCursor ?? null,
          });

        let migratedMilitiaCount = migration.migratedMilitiaCount;
        for (const militia of page) {
          if (militia.notoriety === undefined) {
            await ctx.db.patch('militia', militia._id, {
              notoriety: 0,
            });
            migratedMilitiaCount += 1;
          }
        }

        if (!isDone) {
          await ctx.db.patch('dataMigration', migration._id, {
            militiaCursor: continueCursor ?? undefined,
            migratedMilitiaCount,
            updatedAt: now,
          });
          await ctx.scheduler.runAfter(
            0,
            internal.migrations.runLegacySchemaMigrationBatch,
            { migrationId: migration._id },
          );
          return;
        }

        await ctx.db.patch('dataMigration', migration._id, {
          status: 'completed',
          stage: 'done',
          militiaCursor: undefined,
          migratedMilitiaCount,
          updatedAt: now,
          completedAt: now,
          error: undefined,
        });
        return;
      }

      await ctx.db.patch('dataMigration', migration._id, {
        status: 'completed',
        stage: 'done',
        updatedAt: now,
        completedAt: now,
      });
    } catch (error) {
      await ctx.db.patch('dataMigration', migration._id, {
        status: 'failed',
        updatedAt: now,
        error: error instanceof Error ? error.message : 'Unknown migration error',
      });
      throw error;
    }
  },
});
