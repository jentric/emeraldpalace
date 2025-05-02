import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const relationshipTypes = [
  "Friend",
  "Partner",
  "Family",
  "Parent",
  "Former Partner",
  "Colleague",
  "School",
] as const;

export const get = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) throw new Error("Not authenticated");

    const currentUserProfile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", currentUserId))
      .unique();
    
    if (!currentUserProfile) throw new Error("Profile required to view other profiles");

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    
    if (!profile) return null;

    return {
      ...profile,
      pictureUrl: profile.pictureId ? await ctx.storage.getUrl(profile.pictureId) : null,
    };
  },
});

export const getCurrentProfile = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    
    if (!profile) return null;

    return {
      ...profile,
      pictureUrl: profile.pictureId ? await ctx.storage.getUrl(profile.pictureId) : null,
    };
  },
});

export const update = mutation({
  args: {
    name: v.string(),
    relationship: v.union(...relationshipTypes.map(r => v.literal(r))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        relationship: args.relationship,
      });
    } else {
      await ctx.db.insert("profiles", {
        userId,
        name: args.name,
        relationship: args.relationship,
      });
    }
  },
});

export const updatePicture = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        pictureId: args.storageId,
      });
    } else {
      throw new Error("Profile not found. Please create a profile first.");
    }
  },
});

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});
