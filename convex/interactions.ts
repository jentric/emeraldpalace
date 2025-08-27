import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const toggleLike = mutation({
  args: { mediaId: v.id("mediaItems") },
  handler: async (ctx, { mediaId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("mediaLikes")
      .withIndex("by_media_user", q => q.eq("mediaId", mediaId).eq("userId", userId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { liked: false };
    }
    await ctx.db.insert("mediaLikes", { mediaId, userId, createdAt: Date.now() });
    return { liked: true };
  }
});

export const toggleSave = mutation({
  args: { mediaId: v.id("mediaItems") },
  handler: async (ctx, { mediaId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("mediaSaves")
      .withIndex("by_media_user", q => q.eq("mediaId", mediaId).eq("userId", userId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { saved: false };
    }
    await ctx.db.insert("mediaSaves", { mediaId, userId, createdAt: Date.now() });
    return { saved: true };
  }
});

export const counts = query({
  args: { mediaId: v.id("mediaItems") },
  handler: async (ctx, { mediaId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const [likeDocs, saveDocs, liked, saved] = await Promise.all([
      ctx.db.query("mediaLikes").withIndex("by_media", q => q.eq("mediaId", mediaId)).collect(),
      ctx.db.query("mediaSaves").withIndex("by_media", q => q.eq("mediaId", mediaId)).collect(),
      ctx.db
        .query("mediaLikes")
        .withIndex("by_media_user", q => q.eq("mediaId", mediaId).eq("userId", userId))
        .unique(),
      ctx.db
        .query("mediaSaves")
        .withIndex("by_media_user", q => q.eq("mediaId", mediaId).eq("userId", userId))
        .unique(),
    ]);

    return {
      likeCount: likeDocs.length,
      saveCount: saveDocs.length,
      liked: !!liked,
      saved: !!saved,
    };
  }
});

export const countsMany = query({
  args: { mediaIds: v.array(v.id("mediaItems")) },
  handler: async (ctx, { mediaIds }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (mediaIds.length === 0) return [] as any[];

    // Collect likes and saves in parallel
    const likeDocs = await Promise.all(mediaIds.map(id => ctx.db.query("mediaLikes").withIndex("by_media", q => q.eq("mediaId", id)).collect()));
    const saveDocs = await Promise.all(mediaIds.map(id => ctx.db.query("mediaSaves").withIndex("by_media", q => q.eq("mediaId", id)).collect()));
    const userLikes = await Promise.all(mediaIds.map(id => ctx.db.query("mediaLikes").withIndex("by_media_user", q => q.eq("mediaId", id).eq("userId", userId)).unique()));
    const userSaves = await Promise.all(mediaIds.map(id => ctx.db.query("mediaSaves").withIndex("by_media_user", q => q.eq("mediaId", id).eq("userId", userId)).unique()));

    return mediaIds.map((id, i) => ({
      mediaId: id,
      likeCount: likeDocs[i].length,
      saveCount: saveDocs[i].length,
      liked: !!userLikes[i],
      saved: !!userSaves[i],
    }));
  }
});
