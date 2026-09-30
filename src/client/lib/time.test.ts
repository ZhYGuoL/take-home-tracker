import { describe, expect, it } from 'vitest'
import { nextWake } from './time'

describe('nextWake', () => {
  const now = 1_000_000

  it('waits one tick when no deadline is near', () => {
    expect(nextWake(now, [], 30_000)).toBe(30_000)
    expect(nextWake(now, [now + 60_000], 30_000)).toBe(30_000)
  })

  it('wakes one millisecond after a deadline inside the tick', () => {
    expect(nextWake(now, [now + 5_000], 30_000)).toBe(5_001)
  })

  it('a deadline exactly now wakes in one millisecond', () => {
    expect(nextWake(now, [now], 30_000)).toBe(1)
  })

  it('ignores deadlines that already passed', () => {
    expect(nextWake(now, [now - 1, now + 10_000], 30_000)).toBe(10_001)
  })
})
