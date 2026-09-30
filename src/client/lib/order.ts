import { useRef } from 'react'
import { stableOrder } from '../../core/order'

/**
 * The rows in a stable order: sorted when `resetKey` changes (a new view or filter),
 * and otherwise kept where they were, with new rows on top.
 */
export function useStableOrder<T>(sorted: T[], idOf: (row: T) => string, resetKey: string): T[] {
  const last = useRef<{ key: string; ids: string[] }>({ key: resetKey, ids: [] })
  const ids = sorted.map(idOf)
  const order = last.current.key === resetKey ? stableOrder(last.current.ids, ids) : ids
  last.current = { key: resetKey, ids: order }
  const byId = new Map(sorted.map((r) => [idOf(r), r]))
  return order.flatMap((id) => {
    const row = byId.get(id)
    return row ? [row] : []
  })
}
