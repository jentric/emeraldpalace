import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const create = mutation({
  args: {
    content: v.string(),
    targetType: v.union(v.literal("post"), v.literal("media")),
    targetId: v.union(v.id("posts"), v.id("mediaItems")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify the target exists
    const target = await ctx.db.get(args.targetId);
    if (!target) throw new Error("Target not found");

    return await ctx.db.insert("comments", {
      content: args.content,
      authorId: userId,
      targetType: args.targetType,
      targetId: args.targetId,
      createdAt: Date.now(),
    });
  },
});

export const list = query({
  args: {
    targetType: v.union(v.literal("post"), v.literal("media")),
    targetId: v.union(v.id("posts"), v.id("mediaItems")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db
      .query("comments")
      .withIndex("by_target", (q) => 
        q.eq("targetType", args.targetType).eq("targetId", args.targetId)
      )
      .order("asc")
      .collect();
  },
});
