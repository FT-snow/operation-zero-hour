/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_hash from "../lib/hash.js";
import type * as lib_sha256 from "../lib/sha256.js";
import type * as logs from "../logs.js";
import type * as round4 from "../round4.js";
import type * as rounds from "../rounds.js";
import type * as seed from "../seed.js";
import type * as submissions from "../submissions.js";
import type * as teams from "../teams.js";
import type * as videos from "../videos.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "lib/auth": typeof lib_auth;
  "lib/hash": typeof lib_hash;
  "lib/sha256": typeof lib_sha256;
  logs: typeof logs;
  round4: typeof round4;
  rounds: typeof rounds;
  seed: typeof seed;
  submissions: typeof submissions;
  teams: typeof teams;
  videos: typeof videos;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
