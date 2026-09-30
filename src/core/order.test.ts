import { describe, expect, it } from 'vitest'
import { stableOrder } from './order'

describe('stableOrder', () => {
  it('keeps the old order when the sort would move a row', () => {
    expect(stableOrder(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual(['a', 'b', 'c'])
  })

  it('puts a new row on top', () => {
    expect(stableOrder(['a', 'b'], ['b', 'x', 'a'])).toEqual(['x', 'a', 'b'])
  })

  it('drops a row that left', () => {
    expect(stableOrder(['a', 'b', 'c'], ['c', 'a'])).toEqual(['a', 'c'])
  })

  it('with nothing before, is the sorted order', () => {
    expect(stableOrder([], ['c', 'a', 'b'])).toEqual(['c', 'a', 'b'])
  })
})
