// @ts-nocheck
import { query } from "./_generated/server";
import { mutation, type MutationCtx, internalMutation } from "./_generated/server";
import { spellValidator } from "./schema";
import type { Spell } from "./types";
import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "./_generated/api";
import type { DataModel, Doc } from "./_generated/dataModel";
import type { WithoutSystemFields } from "convex/server"
import { v } from "convex/values";
import { internal } from "./_generated/api";
import spells from "./data/spells.js";

const BATCH_SIZE = 100; // Define a batch size

export const aggregate = new TableAggregate<{
  Key: null,
  DataModel: DataModel,
  TableName: "spell"
}>(components.aggregate, {
  sortKey: (_) => null,
})

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("spell").collect();
  }
})

export const getCount = query({
  args: {},
  handler: async (ctx) => {
    return await aggregate.count(ctx);
  }
})

export const addSpellMutation = mutation({
  args: spellValidator,
  handler: async (ctx, spell) => {
    await addSpellMutationFunction(ctx, spell)
  },
});

export async function addSpellMutationFunction(
  ctx: MutationCtx,
  spell: WithoutSystemFields<Doc<"spell">>
) {
  const id = await ctx.db.insert("spell", spell);
  const doc = await ctx.db.get(id);
  await aggregate.insert(ctx, doc!);
}

export const addNextHundredSpells = internalMutation({
  handler: async (ctx) => {
    const currentSpellCount = await aggregate.count(ctx);
    const startIndex = currentSpellCount;
    const endIndex = startIndex + BATCH_SIZE;

    if (startIndex >= spells.length) {
      console.log("All spells have been added.");
      return;
    }

    const batch = spells.slice(startIndex, endIndex);

    for (const spell of batch as Spell[]) {
      await addSpellMutationFunction(ctx, spell);
    }
    console.log(`Added ${batch.length} spells. Total spells: ${currentSpellCount + batch.length}`);
  },
});

export const rebuildSpellAggregate = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }) => {
    const paginationOptions = { numItems: 100, cursor: cursor || null };
    const { page, continueCursor } = await ctx.db
      .query("spell")
      .paginate(paginationOptions);

    for (const spell of page) {
      await aggregate.insert(ctx, spell);
    }

    if (continueCursor !== null) {
      await ctx.scheduler.runAfter(0, internal.spell.rebuildSpellAggregate, {
        cursor: continueCursor,
      });
    }
  },
});