import { query } from "./_generated/server";
import { mutation } from "./_generated/server";
import { spellValidator } from "./schema";
import { v } from "convex/values";

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("spell").collect();
  }
})

export const addSpellMutation = mutation({
  args: spellValidator,
  handler: async (ctx, args) => {
    await ctx.db.insert("spell", args);
  },
});

export const addManySpells = mutation({
  args: { spells: v.array(v.object(spellValidator)) },
  handler: async (ctx, args) => {
    for (const spell of args.spells) {
      await ctx.db.insert("spell", spell);
    }
  },
});

