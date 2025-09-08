/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as auth from "../auth.js";
import type * as boards from "../boards.js";
import type * as comments from "../comments.js";
import type * as http from "../http.js";
import type * as interactions from "../interactions.js";
import type * as media from "../media.js";
import type * as messages from "../messages.js";
import type * as posts from "../posts.js";
import type * as profiles from "../profiles.js";
import type * as router from "../router.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  boards: typeof boards;
  comments: typeof comments;
  http: typeof http;
  interactions: typeof interactions;
  media: typeof media;
  messages: typeof messages;
  posts: typeof posts;
  profiles: typeof profiles;
  router: typeof router;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
