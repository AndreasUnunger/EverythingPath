import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { campaignValidator } from "./schema";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity()

    if (!user) {
      return []
    }

    return await ctx.db.query("campaign").collect();
  }
})

export const createCampaign = mutation({
  args: campaignValidator,
  async handler(ctx, args) {
    const user = await ctx.auth.getUserIdentity()

    if (!user) {
      throw new ConvexError("You must be logged in to create a campaign")
    }

    await ctx.db.insert("campaign", {
      name: args.name,
      ownerId: user?.tokenIdentifier,
      description: args.description
    })
  }
})
