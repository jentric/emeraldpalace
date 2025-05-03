import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { paginationOptsValidator } from "convex/server";

const relationshipTypes = [
  "Friend",
  "Partner",
  "Family",
  "Parent",
  "Former Partner",
  "Colleague",
  "School",
] as const;

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

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    await requireProfile(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    caption: v.optional(v.string()),
    type: v.union(v.literal("image"), v.literal("video")),
    storageId: v.id("_storage"),
    visibleTo: v.array(v.union(...relationshipTypes.map(r => v.literal(r)))),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireProfile(ctx);
    
    return await ctx.db.insert("mediaItems", {
      title: args.title,
      caption: args.caption,
      type: args.type,
      storageId: args.storageId,
      authorId: userId,
      createdAt: Date.now(),
      visibleTo: args.visibleTo,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("mediaItems"),
    caption: v.string(),
    visibleTo: v.array(v.union(...relationshipTypes.map(r => v.literal(r)))),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireProfile(ctx);
    
    const item = await ctx.db.get(args.id);
    if (!item || item.authorId !== userId) {
      throw new Error("Media item not found or access denied");
    }
    
    await ctx.db.patch(args.id, {
      caption: args.caption,
      visibleTo: args.visibleTo,
    });
  },
});

export const remove = mutation({
  args: {
    id: v.id("mediaItems"),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireProfile(ctx);
    
    const item = await ctx.db.get(args.id);
    if (!item || item.authorId !== userId) {
      throw new Error("Media item not found or access denied");
    }

    // Delete associated comments first
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_target", (q: any) => 
        q.eq("targetType", "media").eq("targetId", args.id)
      )
      .collect();
    
    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }
    
    // Delete the media item
    await ctx.db.delete(args.id);
  },
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    
    const result = await ctx.db
      .query("mediaItems")
      .order("desc")
      .paginate(args.paginationOpts);
    
    // Filter items based on visibility
    const visibleItems = result.page.filter(item => 
      !item.visibleTo || item.visibleTo.includes(profile.relationship)
    );
    
    const itemsWithUrls = await Promise.all(
      visibleItems.map(async (item) => ({
        ...item,
        url: await ctx.storage.getUrl(item.storageId),
        visibleTo: item.visibleTo || relationshipTypes,
      }))
    );

    return {
      page: itemsWithUrls,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});
