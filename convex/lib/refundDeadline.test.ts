import { describe, expect, it } from 'vitest'

import { getAddisDate } from './refundDeadline'

describe('Addis refund deadline date', () => {
  it('changes date at midnight in Addis Ababa', () => {
    expect(getAddisDate(Date.parse('2030-01-10T20:59:00.000Z'))).toBe(
      '2030-01-10',
    )
    expect(getAddisDate(Date.parse('2030-01-10T21:00:00.000Z'))).toBe(
      '2030-01-11',
    )
  })
})
