import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import type { StoredRecord } from '../../core/records'
import { candidate, submission } from '../../core/testing/fixtures'
import { idbPersistence } from './idb'
import { monotonicClock, type Persistence, Repo } from './repo'

function memory(): Persistence & { saved: StoredRecord[] } {
  const saved: StoredRecord[] = []
  return { saved, load: async () => [], save: async (r) => void saved.push(...r) }
}

describe('monotonicClock', () => {
  it('never repeats a timestamp, even when the wall clock stands still', () => {
    const clock = monotonicClock(() => Date.parse('2026-09-30T10:00:00Z'))
    const a = clock()
    const b = clock()
    expect(Date.parse(b)).toBeGreaterThan(Date.parse(a))
  })
})

describe('Repo', () => {
  it('shows a saved candidate at once and persists it', async () => {
    const p = memory()
    const repo = new Repo(p)
    const listener = vi.fn()
    repo.subscribe(listener)
    const c = candidate()
    await repo.saveCandidate(c)
    expect(repo.getSnapshot().candidates).toEqual([c])
    expect(listener).toHaveBeenCalled()
    expect(p.saved).toHaveLength(1)
  })

  it('an edit replaces the earlier version', async () => {
    const repo = new Repo(memory())
    const c = candidate()
    await repo.saveCandidate(c)
    await repo.saveCandidate({ ...c, name: 'Rowan O.' })
    expect(repo.getSnapshot().candidates.map((x) => x.name)).toEqual(['Rowan O.'])
  })

  it('deleting a candidate hides its entries too', async () => {
    const repo = new Repo(memory())
    const c = candidate()
    await repo.saveAll([c, submission(c, '2026-09-30T10:00:00Z')])
    expect(repo.getSnapshot().entries).toHaveLength(1)
    await repo.deleteCandidate(c)
    expect(repo.getSnapshot()).toEqual({ candidates: [], entries: [] })
  })

  it('keeps the same snapshot object until something changes', async () => {
    const repo = new Repo(memory())
    const before = repo.getSnapshot()
    repo.apply([])
    expect(repo.getSnapshot()).toBe(before)
  })
})

describe('idbPersistence', () => {
  it('a new repo on the same account loads what the last one saved', async () => {
    const c = candidate()
    await new Repo(idbPersistence('acct-a')).saveCandidate(c)
    const again = new Repo(idbPersistence('acct-a'))
    await again.init()
    expect(again.getSnapshot().candidates).toEqual([c])
  })

  it('another account on the same browser sees nothing', async () => {
    await new Repo(idbPersistence('acct-b')).saveCandidate(candidate())
    const other = new Repo(idbPersistence('acct-c'))
    await other.init()
    expect(other.getSnapshot().candidates).toEqual([])
  })
})
