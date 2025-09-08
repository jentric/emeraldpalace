import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    // Sort by creation time (oldest first for chat flow)
    return messages.sort((a, b) => a._creationTime - b._creationTime);
  },
});

export const send = mutation({
  args: {
    content: v.string(),
    boardId: v.id("boards"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get user name from Clerk identity
    const userName = identity.name || identity.email || "Anonymous";

    const messageId = await ctx.db.insert("messages", {
      content: args.content,
      author: userName,
      boardId: args.boardId,
    });

    return messageId;
  },
});

export const getRecent = query({
  args: { boardId: v.id("boards"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .take(limit);

    // Return most recent messages (newest first)
    return messages.sort((a, b) => b._creationTime - a._creationTime);
  },
});

