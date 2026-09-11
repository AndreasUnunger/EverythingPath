/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as campaign from "../campaign.js";
import type * as canonicalDraftPersistence from "../canonicalDraftPersistence.js";
import type * as canonicalPersistenceFixtures from "../canonicalPersistenceFixtures.js";
import type * as character from "../character.js";
import type * as clerk from "../clerk.js";
import type * as data_spells from "../data/spells.js";
import type * as data_teams from "../data/teams.js";
import type * as e2eFixtures from "../e2eFixtures.js";
import type * as http from "../http.js";
import type * as lib_campaignInitialization from "../lib/campaignInitialization.js";
import type * as lib_canonicalCampaignContext from "../lib/canonicalCampaignContext.js";
import type * as lib_canonicalDraftPersistenceAuthority from "../lib/canonicalDraftPersistenceAuthority.js";
import type * as lib_canonicalDraftStorage from "../lib/canonicalDraftStorage.js";
import type * as lib_canonicalDraftTargets from "../lib/canonicalDraftTargets.js";
import type * as lib_canonicalRoster from "../lib/canonicalRoster.js";
import type * as lib_canonicalStorageValidators from "../lib/canonicalStorageValidators.js";
import type * as migrations from "../migrations.js";
import type * as militia from "../militia.js";
import type * as spell from "../spell.js";
import type * as types from "../types.js";
import type * as user from "../user.js";
import type * as weekBoard from "../weekBoard.js";
import type * as weekBoardRules from "../weekBoardRules.js";
import type * as weekResolution from "../weekResolution.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  campaign: typeof campaign;
  canonicalDraftPersistence: typeof canonicalDraftPersistence;
  canonicalPersistenceFixtures: typeof canonicalPersistenceFixtures;
  character: typeof character;
  clerk: typeof clerk;
  "data/spells": typeof data_spells;
  "data/teams": typeof data_teams;
  e2eFixtures: typeof e2eFixtures;
  http: typeof http;
  "lib/campaignInitialization": typeof lib_campaignInitialization;
  "lib/canonicalCampaignContext": typeof lib_canonicalCampaignContext;
  "lib/canonicalDraftPersistenceAuthority": typeof lib_canonicalDraftPersistenceAuthority;
  "lib/canonicalDraftStorage": typeof lib_canonicalDraftStorage;
  "lib/canonicalDraftTargets": typeof lib_canonicalDraftTargets;
  "lib/canonicalRoster": typeof lib_canonicalRoster;
  "lib/canonicalStorageValidators": typeof lib_canonicalStorageValidators;
  migrations: typeof migrations;
  militia: typeof militia;
  spell: typeof spell;
  types: typeof types;
  user: typeof user;
  weekBoard: typeof weekBoard;
  weekBoardRules: typeof weekBoardRules;
  weekResolution: typeof weekResolution;
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

export declare const components: {
  aggregate: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"aggregate">;
};
