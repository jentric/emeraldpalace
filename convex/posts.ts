import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";

async function requireProfile(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  
  if (!profile) {
    throw new Error("Profile required to perform this action");
  }
  
  return { userId, profile };
}

export const create = mutation({
  args: {
    title: v.string(),
    content: v.object({
      type: v.literal("doc"),
      content: v.array(v.any()),
    }),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireProfile(ctx);
    
    return await ctx.db.insert("posts", {
      title: args.title,
      content: args.content,
      authorId: userId,
      createdAt: Date.now(),
    });
  },
});

export const list = query({
  handler: async (ctx) => {
    await requireProfile(ctx);
    return await ctx.db
      .query("posts")
      .order("desc")
      .collect();
  },
});
