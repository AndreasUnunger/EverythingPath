import { query } from "./_generated/server";
import { mutation, type MutationCtx } from "./_generated/server";
import { spellValidator } from "./schema";
import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "./_generated/api";
import type { DataModel, Doc } from "./_generated/dataModel";
import type { WithoutSystemFields } from "convex/server"

export const aggregate = new TableAggregate<{
  Key: null,
  DataModel: DataModel,
  TableName: "spell"
}>(components.aggregate, {
  sortKey: (_) => null,
}
)

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

