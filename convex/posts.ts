import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { paginationOptsValidator } from "convex/server";

async function requireProfile(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
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

export const remove = mutation({
  args: {
    id: v.id("posts"),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireProfile(ctx);
    
    const post = await ctx.db.get(args.id);
    if (!post || post.authorId !== userId) {
      throw new Error("Post not found or access denied");
    }

    // Delete associated comments first
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_target", (q: any) => 
        q.eq("targetType", "post").eq("targetId", args.id)
      )
      .collect();
    
    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }
    
    // Delete the post
    await ctx.db.delete(args.id);
  },
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireProfile(ctx);
    return await ctx.db
      .query("posts")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
