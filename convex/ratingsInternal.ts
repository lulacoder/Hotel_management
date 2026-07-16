import { v } from 'convex/values'

import { internalMutation } from './_generated/server'

// One-time backfill for the denormalized rating tally on hotels
// (ratingSum / ratingCount). Until a hotel has been backfilled, the rating
// mutations skip tally updates and ratings.getSummaries falls back to
// scanning that hotel's reviews, so running this is safe at any point and
// idempotent. Run from the Convex dashboard or CLI:
//   npx convex run ratingsInternal:backfillRatingTallies
// Returns the number of hotels backfilled in this run.
export const backfillRatingTallies = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const hotels = await ctx.db.query('hotels').collect()

    let backfilled = 0
    for (const hotel of hotels) {
      if (hotel.ratingCount !== undefined) {
        continue
      }

      const ratings = await ctx.db
        .query('hotelRatings')
        .withIndex('by_hotel_and_is_deleted', (q) =>
          q.eq('hotelId', hotel._id).eq('isDeleted', false),
        )
        .collect()

      await ctx.db.patch(hotel._id, {
        ratingSum: ratings.reduce((sum, rating) => sum + rating.rating, 0),
        ratingCount: ratings.length,
      })
      backfilled += 1
    }

    if (backfilled > 0) {
      console.log(`Backfilled rating tallies for ${backfilled} hotels`)
    }

    return backfilled
  },
})
