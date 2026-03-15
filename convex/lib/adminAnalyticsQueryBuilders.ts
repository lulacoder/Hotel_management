import type {
  OccupancyPoint,
  TopHotelRanking,
  TrendPoint,
} from './adminAnalyticsMetrics'
import type { AnalyticsScope } from './adminAnalyticsScope'
import type { AnalyticsWindow } from './adminAnalyticsWindow'

export type DashboardMetricKey =
  | 'collectedRevenue'
  | 'totalBookings'
  | 'activeStays'
  | 'occupancyRate'
  | 'pendingPaymentBookings'
  | 'arrivalsToday'

export interface DashboardMetric {
  key: DashboardMetricKey
  value: number
  format: 'currency' | 'count' | 'percent'
  secondaryKey?: string
  secondaryValue?: number
}

export interface DashboardSummaryResponse {
  scope: 'global' | 'hotel'
  assignmentRole?: 'hotel_admin' | 'hotel_cashier'
  primaryKpis: DashboardMetric[]
}

export interface TrendResponse {
  window: AnalyticsWindow
  points: TrendPoint[]
}

export interface StatusBreakdownsResponse {
  bookingStatuses: Array<{ key: string; count: number }>
  paymentStatuses: Array<{ key: string; count: number }>
  roomStatuses?: Array<{ key: string; count: number }>
}

export interface OccupancyTrendResponse {
  window: AnalyticsWindow
  points: OccupancyPoint[]
}

export interface TopHotelsResponse {
  window: AnalyticsWindow
  hotels: TopHotelRanking[]
}

interface DashboardSummaryInput {
  scope: AnalyticsScope
  collectedRevenue: number
  confirmedRevenuePipeline: number
  totalBookings: number
  activeStays: number
  occupancyRate: number
  pendingPaymentBookings: number
  arrivalsToday: number
}

export function buildDashboardSummaryResponse(
  input: DashboardSummaryInput,
): DashboardSummaryResponse {
  if (
    input.scope.kind === 'hotel' &&
    input.scope.assignmentRole === 'hotel_cashier'
  ) {
    return {
      scope: 'hotel',
      assignmentRole: 'hotel_cashier',
      primaryKpis: [
        {
          key: 'pendingPaymentBookings',
          value: input.pendingPaymentBookings,
          format: 'count',
        },
        {
          key: 'totalBookings',
          value: input.totalBookings,
          format: 'count',
        },
        {
          key: 'arrivalsToday',
          value: input.arrivalsToday,
          format: 'count',
        },
        {
          key: 'activeStays',
          value: input.activeStays,
          format: 'count',
        },
      ],
    }
  }

  return {
    scope: input.scope.kind,
    assignmentRole:
      input.scope.kind === 'hotel' ? input.scope.assignmentRole : undefined,
    primaryKpis: [
      {
        key: 'collectedRevenue',
        value: input.collectedRevenue,
        format: 'currency',
        secondaryKey: 'confirmedRevenuePipeline',
        secondaryValue: input.confirmedRevenuePipeline,
      },
      {
        key: 'totalBookings',
        value: input.totalBookings,
        format: 'count',
      },
      {
        key: 'activeStays',
        value: input.activeStays,
        format: 'count',
      },
      {
        key: 'occupancyRate',
        value: input.occupancyRate,
        format: 'percent',
      },
    ],
  }
}

export function buildTrendResponse(
  window: AnalyticsWindow,
  points: TrendPoint[],
): TrendResponse {
  return { window, points }
}

export function buildStatusBreakdownsResponse(
  bookingStatuses: Array<{ key: string; count: number }>,
  paymentStatuses: Array<{ key: string; count: number }>,
  roomStatuses?: Array<{ key: string; count: number }>,
): StatusBreakdownsResponse {
  return {
    bookingStatuses,
    paymentStatuses,
    roomStatuses,
  }
}

export function buildOccupancyTrendResponse(
  window: AnalyticsWindow,
  points: OccupancyPoint[],
): OccupancyTrendResponse {
  return { window, points }
}

export function buildTopHotelsResponse(
  window: AnalyticsWindow,
  hotels: TopHotelRanking[],
): TopHotelsResponse {
  return { window, hotels }
}
