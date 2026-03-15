import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { query } from './_generated/server'
import {
  buildDashboardSummaryResponse,
  buildOccupancyTrendResponse,
  buildStatusBreakdownsResponse,
  buildTopHotelsResponse,
  buildTrendResponse,
} from './lib/adminAnalyticsQueryBuilders'
import {
  buildBookingStatusCounts,
  buildBookingTrendSeries,
  buildOccupancyTrendSeries,
  buildPaymentStatusCounts,
  buildRevenueTrendSeries,
  buildRoomStatusCounts,
  buildTopHotelRankings,
  calculateCollectedRevenue,
  calculateConfirmedRevenuePipeline,
  countActiveStays,
  countArrivalsForDate,
  countPendingPaymentBookings,
} from './lib/adminAnalyticsMetrics'
import type {
  AnalyticsBookingRecord,
  AnalyticsHotelRecord,
  AnalyticsRoomRecord,
} from './lib/adminAnalyticsMetrics'
import { resolveAnalyticsScope } from './lib/adminAnalyticsScope'
import {
  buildDailyWindowBuckets,
  buildWindowBuckets,
  getAnalyticsWindowRange,
  getUtcDateKey,
} from './lib/adminAnalyticsWindow'
import { getHotelAssignment, requireUser } from './lib/auth'

const analyticsWindowValidator = v.union(
  v.literal('today'),
  v.literal('7d'),
  v.literal('30d'),
)

const metricCardValidator = v.object({
  key: v.union(
    v.literal('collectedRevenue'),
    v.literal('totalBookings'),
    v.literal('activeStays'),
    v.literal('occupancyRate'),
    v.literal('pendingPaymentBookings'),
    v.literal('arrivalsToday'),
  ),
  value: v.number(),
  format: v.union(
    v.literal('currency'),
    v.literal('count'),
    v.literal('percent'),
  ),
  secondaryKey: v.optional(v.string()),
  secondaryValue: v.optional(v.number()),
})

const trendPointValidator = v.object({
  key: v.string(),
  label: v.string(),
  value: v.number(),
})

const statusCountValidator = v.object({
  key: v.string(),
  count: v.number(),
})

const occupancyPointValidator = v.object({
  key: v.string(),
  label: v.string(),
  occupiedRooms: v.number(),
  totalRooms: v.number(),
  occupancyRate: v.number(),
})

const topHotelValidator = v.object({
  hotelId: v.id('hotels'),
  hotelName: v.string(),
  collectedRevenue: v.number(),
  bookingCount: v.number(),
  occupancyRate: v.number(),
})

const dashboardSummaryValidator = v.object({
  scope: v.union(v.literal('global'), v.literal('hotel')),
  assignmentRole: v.optional(
    v.union(v.literal('hotel_admin'), v.literal('hotel_cashier')),
  ),
  primaryKpis: v.array(metricCardValidator),
})

const trendResponseValidator = v.object({
  window: analyticsWindowValidator,
  points: v.array(trendPointValidator),
})

const statusBreakdownsValidator = v.object({
  bookingStatuses: v.array(statusCountValidator),
  paymentStatuses: v.array(statusCountValidator),
  roomStatuses: v.optional(v.array(statusCountValidator)),
})

const occupancyTrendValidator = v.object({
  window: analyticsWindowValidator,
  points: v.array(occupancyPointValidator),
})

const topHotelsValidator = v.object({
  window: analyticsWindowValidator,
  hotels: v.array(topHotelValidator),
})

type ActiveHotelDoc = Doc<'hotels'>
type ActiveRoomDoc = Doc<'rooms'>

function mapBookings(bookings: Doc<'bookings'>[]): AnalyticsBookingRecord[] {
  return bookings.map((booking) => ({
    _id: booking._id,
    hotelId: booking.hotelId,
    roomId: booking.roomId,
    createdAt: booking.createdAt,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    totalPrice: booking.totalPrice,
  }))
}

function mapRooms(rooms: ActiveRoomDoc[]): AnalyticsRoomRecord[] {
  return rooms.map((room) => ({
    _id: room._id,
    hotelId: room.hotelId,
    operationalStatus: room.operationalStatus,
    isDeleted: room.isDeleted,
  }))
}

function mapHotels(hotels: ActiveHotelDoc[]): AnalyticsHotelRecord[] {
  return hotels.map((hotel) => ({
    _id: hotel._id,
    name: hotel.name,
    isDeleted: hotel.isDeleted,
  }))
}

async function getScopeContext(ctx: QueryCtx) {
  const user = await requireUser(ctx)
  const assignment = await getHotelAssignment(ctx, user._id)
  const scope = resolveAnalyticsScope(user, assignment)

  return { user, assignment, scope }
}

async function listScopedHotels(
  ctx: QueryCtx,
  hotelId?: Id<'hotels'>,
): Promise<ActiveHotelDoc[]> {
  if (hotelId) {
    const hotel = await ctx.db.get(hotelId)
    return hotel && !hotel.isDeleted ? [hotel] : []
  }

  return await ctx.db
    .query('hotels')
    .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
    .collect()
}

async function listScopedRooms(
  ctx: QueryCtx,
  hotelIds: Set<Id<'hotels'>>,
): Promise<ActiveRoomDoc[]> {
  const rooms = await ctx.db.query('rooms').collect()
  return rooms.filter((room: Doc<'rooms'>) => hotelIds.has(room.hotelId))
}

async function listWindowedBookings(
  ctx: QueryCtx,
  hotelIds: Set<Id<'hotels'>>,
  window: 'today' | '7d' | '30d',
): Promise<Doc<'bookings'>[]> {
  const range = getAnalyticsWindowRange(window)

  if (hotelIds.size === 1) {
    const [hotelId] = Array.from(hotelIds)
    const bookings = await ctx.db
      .query('bookings')
      .withIndex('by_hotel_and_created_at', (q) =>
        q.eq('hotelId', hotelId).gte('createdAt', range.startMs),
      )
      .collect()

    return bookings.filter(
      (booking: Doc<'bookings'>) => booking.createdAt <= range.endMs,
    )
  }

  const bookings = await ctx.db
    .query('bookings')
    .withIndex('by_created_at', (q) => q.gte('createdAt', range.startMs))
    .collect()

  return bookings.filter(
    (booking: Doc<'bookings'>) =>
      booking.createdAt <= range.endMs && hotelIds.has(booking.hotelId),
  )
}

async function listOccupancyBookings(
  ctx: QueryCtx,
  hotelIds: Set<Id<'hotels'>>,
): Promise<Doc<'bookings'>[]> {
  const bookings = await ctx.db.query('bookings').collect()
  return bookings.filter((booking: Doc<'bookings'>) =>
    hotelIds.has(booking.hotelId),
  )
}

function filterOccupancyBookingsByActiveRooms(
  bookings: AnalyticsBookingRecord[],
  activeRoomIds: Set<Id<'rooms'>>,
): AnalyticsBookingRecord[] {
  return bookings.filter((booking) => activeRoomIds.has(booking.roomId))
}

export const getDashboardSummary = query({
  args: {
    window: analyticsWindowValidator,
  },
  returns: dashboardSummaryValidator,
  handler: async (ctx, args) => {
    const { scope } = await getScopeContext(ctx)
    const hotels = await listScopedHotels(
      ctx,
      scope.kind === 'hotel' ? (scope.hotelId as Id<'hotels'>) : undefined,
    )
    const hotelIds = new Set(hotels.map((hotel) => hotel._id))
    const rooms = await listScopedRooms(ctx, hotelIds)
    const windowedBookings = await listWindowedBookings(
      ctx,
      hotelIds,
      args.window,
    )
    const occupancyBookings = await listOccupancyBookings(ctx, hotelIds)
    const mappedRooms = mapRooms(rooms)
    const activeRoomIds = new Set(
      rooms.filter((room) => !room.isDeleted).map((room) => room._id),
    )
    const mappedWindowedBookings = mapBookings(windowedBookings)
    const mappedOccupancyBookings = filterOccupancyBookingsByActiveRooms(
      mapBookings(occupancyBookings),
      activeRoomIds,
    )
    const occupancyPoints = buildOccupancyTrendSeries(
      mappedRooms,
      mappedOccupancyBookings,
      buildDailyWindowBuckets('today'),
    )
    const todayDateKey = getUtcDateKey(Date.now())

    return buildDashboardSummaryResponse({
      scope,
      collectedRevenue: calculateCollectedRevenue(mappedWindowedBookings),
      confirmedRevenuePipeline:
        scope.kind === 'hotel' && scope.assignmentRole === 'hotel_cashier'
          ? 0
          : calculateConfirmedRevenuePipeline(mappedWindowedBookings),
      totalBookings: mappedWindowedBookings.length,
      activeStays: countActiveStays(mappedWindowedBookings),
      occupancyRate: occupancyPoints[0]?.occupancyRate ?? 0,
      pendingPaymentBookings: countPendingPaymentBookings(
        mappedWindowedBookings,
      ),
      arrivalsToday: countArrivalsForDate(
        mappedOccupancyBookings,
        todayDateKey,
      ),
    })
  },
})

export const getRevenueTrend = query({
  args: {
    window: analyticsWindowValidator,
  },
  returns: trendResponseValidator,
  handler: async (ctx, args) => {
    const { scope } = await getScopeContext(ctx)

    if (scope.kind === 'hotel' && scope.assignmentRole === 'hotel_cashier') {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'Cashiers cannot access revenue analytics.',
      })
    }

    const hotels = await listScopedHotels(
      ctx,
      scope.kind === 'hotel' ? (scope.hotelId as Id<'hotels'>) : undefined,
    )
    const hotelIds = new Set(hotels.map((hotel) => hotel._id))
    const bookings = mapBookings(
      await listWindowedBookings(ctx, hotelIds, args.window),
    )

    return buildTrendResponse(
      args.window,
      buildRevenueTrendSeries(bookings, buildWindowBuckets(args.window)),
    )
  },
})

export const getBookingTrend = query({
  args: {
    window: analyticsWindowValidator,
  },
  returns: trendResponseValidator,
  handler: async (ctx, args) => {
    const { scope } = await getScopeContext(ctx)
    const hotels = await listScopedHotels(
      ctx,
      scope.kind === 'hotel' ? (scope.hotelId as Id<'hotels'>) : undefined,
    )
    const hotelIds = new Set(hotels.map((hotel) => hotel._id))
    const bookings = mapBookings(
      await listWindowedBookings(ctx, hotelIds, args.window),
    )

    return buildTrendResponse(
      args.window,
      buildBookingTrendSeries(bookings, buildWindowBuckets(args.window)),
    )
  },
})

export const getStatusBreakdowns = query({
  args: {
    window: analyticsWindowValidator,
  },
  returns: statusBreakdownsValidator,
  handler: async (ctx, args) => {
    const { scope } = await getScopeContext(ctx)
    const hotels = await listScopedHotels(
      ctx,
      scope.kind === 'hotel' ? (scope.hotelId as Id<'hotels'>) : undefined,
    )
    const hotelIds = new Set(hotels.map((hotel) => hotel._id))
    const rooms = mapRooms(await listScopedRooms(ctx, hotelIds))
    const bookings = mapBookings(
      await listWindowedBookings(ctx, hotelIds, args.window),
    )

    return buildStatusBreakdownsResponse(
      buildBookingStatusCounts(bookings),
      buildPaymentStatusCounts(bookings),
      scope.kind === 'hotel' && scope.assignmentRole === 'hotel_cashier'
        ? undefined
        : buildRoomStatusCounts(rooms),
    )
  },
})

export const getOccupancyTrend = query({
  args: {
    window: analyticsWindowValidator,
  },
  returns: occupancyTrendValidator,
  handler: async (ctx, args) => {
    const { scope } = await getScopeContext(ctx)

    if (scope.kind === 'hotel' && scope.assignmentRole === 'hotel_cashier') {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'Cashiers cannot access occupancy analytics.',
      })
    }

    const hotels = await listScopedHotels(
      ctx,
      scope.kind === 'hotel' ? (scope.hotelId as Id<'hotels'>) : undefined,
    )
    const hotelIds = new Set(hotels.map((hotel) => hotel._id))
    const rooms = await listScopedRooms(ctx, hotelIds)
    const activeRoomIds = new Set(
      rooms.filter((room) => !room.isDeleted).map((room) => room._id),
    )
    const bookings = filterOccupancyBookingsByActiveRooms(
      mapBookings(await listOccupancyBookings(ctx, hotelIds)),
      activeRoomIds,
    )

    return buildOccupancyTrendResponse(
      args.window,
      buildOccupancyTrendSeries(
        mapRooms(rooms),
        bookings,
        buildDailyWindowBuckets(args.window),
      ),
    )
  },
})

export const getTopHotels = query({
  args: {
    window: analyticsWindowValidator,
  },
  returns: topHotelsValidator,
  handler: async (ctx, args) => {
    const { user } = await getScopeContext(ctx)

    if (user.role !== 'room_admin') {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'Only room admins can access top hotel rankings.',
      })
    }

    const hotels = await listScopedHotels(ctx)
    const hotelIds = new Set(hotels.map((hotel) => hotel._id))
    const rooms = await listScopedRooms(ctx, hotelIds)
    const activeRoomIds = new Set(
      rooms.filter((room) => !room.isDeleted).map((room) => room._id),
    )
    const bookings = mapBookings(
      await listWindowedBookings(ctx, hotelIds, args.window),
    )
    const occupancyBookings = filterOccupancyBookingsByActiveRooms(
      mapBookings(await listOccupancyBookings(ctx, hotelIds)),
      activeRoomIds,
    )
    const occupancyPoints = buildOccupancyTrendSeries(
      mapRooms(rooms),
      occupancyBookings,
      buildDailyWindowBuckets('today'),
    )

    return buildTopHotelsResponse(
      args.window,
      buildTopHotelRankings(
        mapHotels(hotels),
        mapRooms(rooms),
        bookings,
        occupancyPoints,
      ).map((hotel) => ({
        ...hotel,
        hotelId: hotel.hotelId as Id<'hotels'>,
      })),
    )
  },
})
