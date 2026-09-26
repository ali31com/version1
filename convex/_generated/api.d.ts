/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as gemini from "../gemini.js";
import type * as health from "../health.js";
import type * as lib_checks from "../lib/checks.js";
import type * as lib_contracts from "../lib/contracts.js";
import type * as lib_expected from "../lib/expected.js";
import type * as lib_presets from "../lib/presets.js";
import type * as lib_prompts from "../lib/prompts.js";
import type * as lib_references from "../lib/references.js";
import type * as metrics from "../metrics.js";
import type * as modelRunner from "../modelRunner.js";
import type * as myFunctions from "../myFunctions.js";
import type * as participants from "../participants.js";
import type * as pipeline from "../pipeline.js";
import type * as presenter from "../presenter.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  gemini: typeof gemini;
  health: typeof health;
  "lib/checks": typeof lib_checks;
  "lib/contracts": typeof lib_contracts;
  "lib/expected": typeof lib_expected;
  "lib/presets": typeof lib_presets;
  "lib/prompts": typeof lib_prompts;
  "lib/references": typeof lib_references;
  metrics: typeof metrics;
  modelRunner: typeof modelRunner;
  myFunctions: typeof myFunctions;
  participants: typeof participants;
  pipeline: typeof pipeline;
  presenter: typeof presenter;
  validators: typeof validators;
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
