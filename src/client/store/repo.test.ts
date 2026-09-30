import { describe, expect, it, vi } from 'vitest'
import type { StoredRecord } from '../../core/records'
import { candidate, message, submission } from '../../core/testing/fixtures'
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

  it('a deleted candidate leaves no name, contact, note, or message behind', async () => {
    const p = memory()
    const repo = new Repo(p)
    const c = candidate({ name: 'Private Name', contacts: ['private@example.com'], notes: 'n' })
    await repo.saveAll([c, message(c, '2026-09-30T10:00:00Z', { text: 'private text' })])
    await repo.deleteCandidate(c)
    const stored = new Map(p.saved.map((r) => [r.id, r]))
    expect([...stored.values()].every((r) => r.deleted && r.data === null)).toBe(true)
    expect(JSON.stringify([...stored.values()])).not.toMatch(/Private|private/)
  })

  it('keeps the same snapshot object until something changes', async () => {
    const repo = new Repo(memory())
    const before = repo.getSnapshot()
    repo.apply([])
    expect(repo.getSnapshot()).toBe(before)
  })
})

describe('Repo save failures', () => {
  function flaky(): Persistence & { saved: StoredRecord[]; failNext: number } {
    const p = {
      saved: [] as StoredRecord[],
      failNext: 0,
      load: async () => [],
      save: async (r: StoredRecord[]) => {
        if (p.failNext > 0) {
          p.failNext--
          throw new Error('Connection to Indexed Database server lost')
        }
        p.saved.push(...r)
      },
    }
    return p
  }

  it('a failed save shows as failed and does not stop later saves', async () => {
    const p = flaky()
    const repo = new Repo(p)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    p.failNext = 1
    await repo.saveCandidate(candidate({ name: 'Lost for now' }))
    expect(repo.getStatus()).toBe('failed')
    await repo.saveCandidate(candidate({ name: 'Saved' }))
    expect(p.saved.map((r) => (r.data as { name: string }).name)).toEqual(['Saved'])
    expect(repo.getStatus()).toBe('failed')
  })

  it('retry saves what failed and clears the failure', async () => {
    const p = flaky()
    const repo = new Repo(p)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    p.failNext = 1
    await repo.saveCandidate(candidate({ name: 'Second try' }))
    await repo.retry()
    expect(repo.getStatus()).toBe('saved')
    expect(p.saved.map((r) => (r.data as { name: string }).name)).toEqual(['Second try'])
  })

  it('logs no candidate data when a save fails', async () => {
    const p = flaky()
    const repo = new Repo(p)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    p.failNext = 1
    await repo.saveCandidate(candidate({ name: 'Private Name', notes: 'private note' }))
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/Private Name|private note/)
  })
})
