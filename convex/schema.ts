import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const relationshipTypes = [
  "Friend",
  "Partner",
  "Family",
  "Parent",
  "Former Partner",
  "Colleague",
  "School",
] as const;

const applicationTables = {
  profiles: defineTable({
    userId: v.id("users"),
    name: v.string(),
    relationship: v.union(...relationshipTypes.map(r => v.literal(r))),
    pictureId: v.optional(v.id("_storage")),
  }).index("by_user", ["userId"]),

  posts: defineTable({
    title: v.string(),
    content: v.object({
      type: v.literal("doc"),
      content: v.array(v.any()),
    }),
    authorId: v.id("users"),
    createdAt: v.number(),
  }).index("by_author", ["authorId"]),
  
  mediaItems: defineTable({
    title: v.string(),
    caption: v.optional(v.string()),
    type: v.union(v.literal("image"), v.literal("video")),
    storageId: v.id("_storage"),
    authorId: v.id("users"),
    createdAt: v.number(),
    // Make visibleTo optional during migration
    visibleTo: v.optional(v.array(v.union(...relationshipTypes.map(r => v.literal(r))))),
  }).index("by_author", ["authorId"]),

  comments: defineTable({
    content: v.string(),
    authorId: v.id("users"),
    createdAt: v.number(),
    targetType: v.union(v.literal("post"), v.literal("media")),
    targetId: v.union(v.id("posts"), v.id("mediaItems")),
  })
    .index("by_target", ["targetType", "targetId"])
    .index("by_author", ["authorId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
