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
import type * as announcements from "../announcements.js";
import type * as audit from "../audit.js";
import type * as bookings from "../bookings.js";
import type * as bookingsInternal from "../bookingsInternal.js";
import type * as chapaActions from "../chapaActions.js";
import type * as chapaInternal from "../chapaInternal.js";
import type * as chapaQueries from "../chapaQueries.js";
import type * as clerk from "../clerk.js";
import type * as complaints from "../complaints.js";
import type * as crons from "../crons.js";
import type * as fileTracking from "../fileTracking.js";
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
import type * as lib_arrays from "../lib/arrays.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_availability from "../lib/availability.js";
import type * as lib_bookingLifecycle from "../lib/bookingLifecycle.js";
import type * as lib_bookingTransitions from "../lib/bookingTransitions.js";
import type * as lib_dates from "../lib/dates.js";
import type * as lib_refundDeadline from "../lib/refundDeadline.js";
import type * as lib_refunds from "../lib/refunds.js";
import type * as notifications from "../notifications.js";
import type * as notificationsInternal from "../notificationsInternal.js";
import type * as paymentEmails from "../paymentEmails.js";
import type * as push from "../push.js";
import type * as pushTokens from "../pushTokens.js";
import type * as r2 from "../r2.js";
import type * as ratings from "../ratings.js";
import type * as ratingsInternal from "../ratingsInternal.js";
import type * as refundEmails from "../refundEmails.js";
import type * as rooms from "../rooms.js";
import type * as seed from "../seed.js";
import type * as staffInvitationActions from "../staffInvitationActions.js";
import type * as staffInvitationEmails from "../staffInvitationEmails.js";
import type * as staffInvitations from "../staffInvitations.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  announcements: typeof announcements;
  audit: typeof audit;
  bookings: typeof bookings;
  bookingsInternal: typeof bookingsInternal;
  chapaActions: typeof chapaActions;
  chapaInternal: typeof chapaInternal;
  chapaQueries: typeof chapaQueries;
  clerk: typeof clerk;
  complaints: typeof complaints;
  crons: typeof crons;
  fileTracking: typeof fileTracking;
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
  "lib/arrays": typeof lib_arrays;
  "lib/auth": typeof lib_auth;
  "lib/availability": typeof lib_availability;
  "lib/bookingLifecycle": typeof lib_bookingLifecycle;
  "lib/bookingTransitions": typeof lib_bookingTransitions;
  "lib/dates": typeof lib_dates;
  "lib/refundDeadline": typeof lib_refundDeadline;
  "lib/refunds": typeof lib_refunds;
  notifications: typeof notifications;
  notificationsInternal: typeof notificationsInternal;
  paymentEmails: typeof paymentEmails;
  push: typeof push;
  pushTokens: typeof pushTokens;
  r2: typeof r2;
  ratings: typeof ratings;
  ratingsInternal: typeof ratingsInternal;
  refundEmails: typeof refundEmails;
  rooms: typeof rooms;
  seed: typeof seed;
  staffInvitationActions: typeof staffInvitationActions;
  staffInvitationEmails: typeof staffInvitationEmails;
  staffInvitations: typeof staffInvitations;
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

export declare const components: {
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  r2: import("@convex-dev/r2/_generated/component.js").ComponentApi<"r2">;
};
