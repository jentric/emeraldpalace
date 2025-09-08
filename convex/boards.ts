import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const boards = await ctx.db.query("boards").collect();
    return boards.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const boardId = await ctx.db.insert("boards", {
      name: args.name,
      description: args.description,
      createdBy: identity.subject,
    });

    return boardId;
  },
});

export const getById = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const board = await ctx.db.get(args.boardId);
    return board;
  },
});

export const createDefaultBoards = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if default boards already exist
    const existingBoards = await ctx.db.query("boards").collect();
    if (existingBoards.length > 0) {
      return existingBoards.map(board => board._id);
    }

    // Create default boards
    const defaultBoards = [
      {
        name: "General Chat",
        description: "General discussion and community topics",
        createdBy: identity.subject,
      },
      {
        name: "Music Lovers",
        description: "Share and discuss your favorite music",
        createdBy: identity.subject,
      },
      {
        name: "Tech Talk",
        description: "Discuss technology, programming, and gadgets",
        createdBy: identity.subject,
      },
      {
        name: "Creative Corner",
        description: "Share your creative projects and ideas",
        createdBy: identity.subject,
      },
    ];

    const boardIds = [];
    for (const board of defaultBoards) {
      const boardId = await ctx.db.insert("boards", board);
      boardIds.push(boardId);
    }

    return boardIds;
  },
});
