import { describe, expect, it } from 'vitest'
import { normalizeContact, parseContacts } from './contacts'

describe('normalizeContact', () => {
  it.each([
    ['Rowan.Okafor@Example.com', 'rowan.okafor@example.com'],
    ['@RowanBuilds', '@rowanbuilds'],
    ['(555) 010-0142', '+15550100142'],
    ['+1 555-010-0142', '+15550100142'],
    ['+44 20 7946 0958', '+442079460958'],
    ['  ', ''],
    ['rowan on discord', 'rowan on discord'],
  ])('%s becomes %s', (raw, out) => {
    expect(normalizeContact(raw)).toBe(out)
  })
})

describe('parseContacts', () => {
  it('splits on commas and newlines and drops duplicates', () => {
    expect(parseContacts('rowan@example.com, @rowan\nROWAN@example.com')).toEqual([
      'rowan@example.com',
      '@rowan',
    ])
  })
})
