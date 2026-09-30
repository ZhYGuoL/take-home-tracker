import { describe, expect, it } from 'vitest'
import { uuidv7Factory } from './ids'

describe('uuidv7Factory', () => {
  it('makes ids in the UUID shape with version 7', () => {
    const id = uuidv7Factory()()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('ids made later sort later, even inside one millisecond', () => {
    const next = uuidv7Factory(() => 1_790_000_000_000)
    const ids = Array.from({ length: 50 }, next)
    expect([...ids].sort()).toEqual(ids)
  })

  it('ids from a later millisecond sort after earlier ones', () => {
    let t = 1_790_000_000_000
    const next = uuidv7Factory(() => t)
    const a = next()
    t += 1
    const b = next()
    expect(a < b).toBe(true)
  })

  it('keeps order if the wall clock steps back', () => {
    let t = 1_790_000_000_500
    const next = uuidv7Factory(() => t)
    const a = next()
    t -= 400
    expect(next() > a).toBe(true)
  })
})
