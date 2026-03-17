/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as audit from "../audit.js";
import type * as bookings from "../bookings.js";
import type * as bookingsInternal from "../bookingsInternal.js";
import type * as clerk from "../clerk.js";
import type * as complaints from "../complaints.js";
import type * as crons from "../crons.js";
import type * as files from "../files.js";
import type * as filesInternal from "../filesInternal.js";
import type * as guestProfiles from "../guestProfiles.js";
import type * as hotelBankAccounts from "../hotelBankAccounts.js";
import type * as hotelStaff from "../hotelStaff.js";
import type * as hotels from "../hotels.js";
import type * as http from "../http.js";
import type * as lib_adminAnalyticsMetrics from "../lib/adminAnalyticsMetrics.js";
import type * as lib_adminAnalyticsQueryBuilders from "../lib/adminAnalyticsQueryBuilders.js";
import type * as lib_adminAnalyticsScope from "../lib/adminAnalyticsScope.js";
import type * as lib_adminAnalyticsWindow from "../lib/adminAnalyticsWindow.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_dates from "../lib/dates.js";
import type * as notifications from "../notifications.js";
import type * as notificationsInternal from "../notificationsInternal.js";
import type * as ratings from "../ratings.js";
import type * as rooms from "../rooms.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  audit: typeof audit;
  bookings: typeof bookings;
  bookingsInternal: typeof bookingsInternal;
  clerk: typeof clerk;
  complaints: typeof complaints;
  crons: typeof crons;
  files: typeof files;
  filesInternal: typeof filesInternal;
  guestProfiles: typeof guestProfiles;
  hotelBankAccounts: typeof hotelBankAccounts;
  hotelStaff: typeof hotelStaff;
  hotels: typeof hotels;
  http: typeof http;
  "lib/adminAnalyticsMetrics": typeof lib_adminAnalyticsMetrics;
  "lib/adminAnalyticsQueryBuilders": typeof lib_adminAnalyticsQueryBuilders;
  "lib/adminAnalyticsScope": typeof lib_adminAnalyticsScope;
  "lib/adminAnalyticsWindow": typeof lib_adminAnalyticsWindow;
  "lib/auth": typeof lib_auth;
  "lib/dates": typeof lib_dates;
  notifications: typeof notifications;
  notificationsInternal: typeof notificationsInternal;
  ratings: typeof ratings;
  rooms: typeof rooms;
  seed: typeof seed;
  users: typeof users;
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
