/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { api } from './_generated/api'
import schema from './schema'

import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

// Creates an authenticated room admin for guest lookup tests.
async function seedRoomAdmin(
  t: ReturnType<typeof convexTest>,
): Promise<Id<'users'>> {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('users', {
      clerkUserId: 'room-admin',
      email: 'admin@example.com',
      role: 'room_admin',
      createdAt: Date.now(),
    })
  })
}

// Adds one returning guest profile with realistic contact details.
async function seedGuestProfile(
  t: ReturnType<typeof convexTest>,
  createdBy: Id<'users'>,
): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.insert('guestProfiles', {
      name: 'Returning Guest',
      phone: '251911234567',
      email: 'returning@tripwayshotel.com',
      createdBy,
      createdAt: Date.now(),
    })
  })
}

describe('guest profile search', () => {
  it('finds a returning guest from a phone-number fragment', async () => {
    const t = convexTest(schema, modules)
    const adminId = await seedRoomAdmin(t)
    await seedGuestProfile(t, adminId)
    const admin = t.withIdentity({
      subject: 'room-admin',
      email: 'admin@example.com',
      emailVerified: true,
    })

    const results = await admin.query(api.guestProfiles.search, {
      searchTerm: '234567',
    })

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      profile: {
        name: 'Returning Guest',
        phone: '251911234567',
      },
      bookingCount: 0,
    })
  })

  it('finds a returning guest from an email fragment', async () => {
    const t = convexTest(schema, modules)
    const adminId = await seedRoomAdmin(t)
    await seedGuestProfile(t, adminId)
    const admin = t.withIdentity({
      subject: 'room-admin',
      email: 'admin@example.com',
      emailVerified: true,
    })

    const results = await admin.query(api.guestProfiles.search, {
      searchTerm: 'tripwayshotel',
    })

    expect(results).toHaveLength(1)
    expect(results[0].profile.email).toBe('returning@tripwayshotel.com')
  })
})
