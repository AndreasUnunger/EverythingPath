import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export default internalMutation({
  handler: async (ctx) => {
    const anySpell = await ctx.db.query("spell").first();
    if (anySpell) return;

    await ctx.runMutation(internal.spell.rebuildSpellAggregate, {});
  },
});
