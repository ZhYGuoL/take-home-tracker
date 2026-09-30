import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import type { StoredRecord } from '../../core/records'
import { HEADER } from '../../core/rows'
import { candidate, submission } from '../../core/testing/fixtures'
import { Repo } from '../store/repo'
import { localCache, SheetSync } from './engine'
import type { SheetsApi, Spreadsheet } from './sheets'

/** An in-memory Sheet with the same calls as SheetsApi. */
function memorySheet() {
  const rows: string[][] = [HEADER]
  const fail = { next: 0 }
  const api = {
    rows,
    fail,
    views: [] as string[][][],
    async findOrCreate(): Promise<Spreadsheet> {
      return { id: 'sheet-1', recordsTab: 0 }
    },
    async readRows() {
      return rows.slice(1).map((r) => [...r])
    },
    async append(_: string, add: string[][]) {
      if (fail.next > 0) {
        fail.next--
        throw new Error('google 503')
      }
      rows.push(...add)
    },
    async deleteRows(_: Spreadsheet, indexes: number[]) {
      for (const i of [...indexes].sort((a, b) => b - a)) rows.splice(i, 1)
    },
    async writeView(_: string, v: string[][]) {
      api.views.push(v)
    },
  }
  return api
}

let n = 0
function device(sheet: ReturnType<typeof memorySheet>) {
  const sync = new SheetSync(sheet as unknown as SheetsApi, localCache(`acct-${++n}`), () => [
    ['Name'],
  ])
  const repo = new Repo(sync)
  sync.bind(repo)
  return { repo, sync }
}

const rec = (c: ReturnType<typeof candidate>): StoredRecord => ({
  id: c.id,
  type: 'candidate',
  updatedAt: c.createdAt,
  deleted: false,
  data: c,
})

describe('SheetSync', () => {
  it('a save reaches the Sheet as an appended row', async () => {
    const sheet = memorySheet()
    const { repo, sync } = device(sheet)
    await repo.saveCandidate(candidate({ name: 'Rowan Okafor' }))
    await sync.push()
    expect(sheet.rows).toHaveLength(2)
    expect(sheet.rows[1]?.[4]).toContain('Rowan Okafor')
    expect(sync.getStatus()).toBe('synced')
  })

  it('a failed push keeps the save and sends it later', async () => {
    const sheet = memorySheet()
    const { repo, sync } = device(sheet)
    sheet.fail.next = 1
    await repo.saveCandidate(candidate({ name: 'Priya Raman' }))
    await sync.push()
    expect(sync.getStatus()).toBe('offline')
    expect(sheet.rows).toHaveLength(1)
    await sync.push()
    expect(sheet.rows).toHaveLength(2)
    expect(sync.getStatus()).toBe('synced')
  })

  it('another device sees the save after a pull', async () => {
    const sheet = memorySheet()
    const a = device(sheet)
    const b = device(sheet)
    await a.repo.saveCandidate(candidate({ name: 'Diego Alvarez' }))
    await a.sync.push()
    await b.sync.pull()
    expect(b.repo.getSnapshot().candidates.map((c) => c.name)).toEqual(['Diego Alvarez'])
  })

  it('the Sheet is the truth: a candidate deleted elsewhere leaves this device too', async () => {
    const sheet = memorySheet()
    const a = device(sheet)
    const b = device(sheet)
    const c = candidate({ name: 'Mei Tanaka' })
    await a.repo.saveAll([c, submission(c, '2026-09-30T10:00:00Z')])
    await a.sync.push()
    await b.sync.pull()
    expect(b.repo.getSnapshot().candidates).toHaveLength(1)
    await a.repo.deleteCandidate(c)
    await a.sync.push()
    // Every row of the candidate and its timeline is gone from the Sheet.
    expect(sheet.rows).toEqual([HEADER])
    await b.sync.pull()
    expect(b.repo.getSnapshot()).toEqual({ candidates: [], entries: [] })
  })

  it('a save that has not gone out survives a pull', async () => {
    const sheet = memorySheet()
    const { repo, sync } = device(sheet)
    sheet.fail.next = 5
    await repo.saveCandidate(candidate({ name: 'Offline Save' }))
    await sync.pull()
    expect(repo.getSnapshot().candidates.map((c) => c.name)).toEqual(['Offline Save'])
  })

  it('a row edited by hand into nonsense is skipped, and the rest still load', async () => {
    const sheet = memorySheet()
    const good = candidate({ name: 'Good Row' })
    sheet.rows.push(
      ['x', 'nonsense', 'yesterday', '', '{'],
      [good.id, 'candidate', good.createdAt, '', JSON.stringify(good)],
    )
    const { repo, sync } = device(sheet)
    await sync.pull()
    expect(repo.getSnapshot().candidates.map((c) => c.name)).toEqual(['Good Row'])
    expect(rec(good).id).toBe(good.id)
  })

  it('a new device shows its cached records before any network call', async () => {
    const sheet = memorySheet()
    const cache = localCache('acct-cached')
    const c = candidate({ name: 'Cached Person' })
    await cache.setRecords([rec(c)])
    const sync = new SheetSync(sheet as unknown as SheetsApi, cache, () => [])
    expect((await sync.load()).map((r) => r.id)).toEqual([c.id])
  })
})
