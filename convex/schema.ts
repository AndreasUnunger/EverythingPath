import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  character: defineTable({
    name: v.string(),
    ownerId: v.number(),
    campaignId: v.number(),
    description: v.string(),
  }),
  campaign: defineTable({
    name: v.string(),
    campaignId: v.number(),
    ownerId: v.string(),
    description: v.string(),
  }),
});
