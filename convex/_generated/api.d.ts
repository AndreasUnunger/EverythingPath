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
import type * as canonicalHistory from "../canonicalHistory.js";
import type * as canonicalLedger from "../canonicalLedger.js";
import type * as canonicalPersistenceFixtures from "../canonicalPersistenceFixtures.js";
import type * as canonicalSetup from "../canonicalSetup.js";
import type * as character from "../character.js";
import type * as characterSheet from "../characterSheet.js";
import type * as clerk from "../clerk.js";
import type * as cutover from "../cutover.js";
import type * as data_spells from "../data/spells.js";
import type * as e2eFixtures from "../e2eFixtures.js";
import type * as http from "../http.js";
import type * as initialMigration from "../initialMigration.js";
import type * as legacyRetirement from "../legacyRetirement.js";
import type * as lib_acceptedCampaignFixture from "../lib/acceptedCampaignFixture.js";
import type * as lib_campaignRuntime from "../lib/campaignRuntime.js";
import type * as lib_canonicalCharacters from "../lib/canonicalCharacters.js";
import type * as lib_canonicalConfirmation from "../lib/canonicalConfirmation.js";
import type * as lib_canonicalDraftPersistenceAuthority from "../lib/canonicalDraftPersistenceAuthority.js";
import type * as lib_canonicalDraftStorage from "../lib/canonicalDraftStorage.js";
import type * as lib_canonicalDraftTargets from "../lib/canonicalDraftTargets.js";
import type * as lib_canonicalStorageValidators from "../lib/canonicalStorageValidators.js";
import type * as lib_characterAccess from "../lib/characterAccess.js";
import type * as lib_characterSheet from "../lib/characterSheet.js";
import type * as lib_militiaCharacterFacts from "../lib/militiaCharacterFacts.js";
import type * as lib_retiredWorkflow from "../lib/retiredWorkflow.js";
import type * as lib_writeGate from "../lib/writeGate.js";
import type * as migrations from "../migrations.js";
import type * as militia from "../militia.js";
import type * as spell from "../spell.js";
import type * as types from "../types.js";
import type * as user from "../user.js";
import type * as weekBoard from "../weekBoard.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  campaign: typeof campaign;
  canonicalDraftPersistence: typeof canonicalDraftPersistence;
  canonicalHistory: typeof canonicalHistory;
  canonicalLedger: typeof canonicalLedger;
  canonicalPersistenceFixtures: typeof canonicalPersistenceFixtures;
  canonicalSetup: typeof canonicalSetup;
  character: typeof character;
  characterSheet: typeof characterSheet;
  clerk: typeof clerk;
  cutover: typeof cutover;
  "data/spells": typeof data_spells;
  e2eFixtures: typeof e2eFixtures;
  http: typeof http;
  initialMigration: typeof initialMigration;
  legacyRetirement: typeof legacyRetirement;
  "lib/acceptedCampaignFixture": typeof lib_acceptedCampaignFixture;
  "lib/campaignRuntime": typeof lib_campaignRuntime;
  "lib/canonicalCharacters": typeof lib_canonicalCharacters;
  "lib/canonicalConfirmation": typeof lib_canonicalConfirmation;
  "lib/canonicalDraftPersistenceAuthority": typeof lib_canonicalDraftPersistenceAuthority;
  "lib/canonicalDraftStorage": typeof lib_canonicalDraftStorage;
  "lib/canonicalDraftTargets": typeof lib_canonicalDraftTargets;
  "lib/canonicalStorageValidators": typeof lib_canonicalStorageValidators;
  "lib/characterAccess": typeof lib_characterAccess;
  "lib/characterSheet": typeof lib_characterSheet;
  "lib/militiaCharacterFacts": typeof lib_militiaCharacterFacts;
  "lib/retiredWorkflow": typeof lib_retiredWorkflow;
  "lib/writeGate": typeof lib_writeGate;
  migrations: typeof migrations;
  militia: typeof militia;
  spell: typeof spell;
  types: typeof types;
  user: typeof user;
  weekBoard: typeof weekBoard;
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
