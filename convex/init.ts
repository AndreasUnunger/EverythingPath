import { internalMutation } from "./_generated/server";
import { api } from "./_generated/api";
import { spellValidator } from "./schema";
import { Infer } from "convex/values";
import spells from "./data/spells.js";

type SpellForInsert = Infer<typeof spellValidator>;

export default internalMutation({
  handler: async (ctx) => {
    const anySpell = await ctx.db.query("spell").first();
    if (anySpell) return;

    for (const spell of spells as SpellForInsert[]) {
      await ctx.runMutation(api.spell.addSpellMutation, spell)
    }
  },
});
