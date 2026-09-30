import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import type { StoredRecord } from '../../core/records'
import { HEADER, toRow } from '../../core/rows'
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
      return { id: 'sheet-1', records: { sheetId: 0, title: 'records' }, view: null }
    },
    async readRows() {
      return rows.slice(1).map((r) => [...r])
    },
    async append(_: Spreadsheet, add: string[][]) {
      if (fail.next > 0) {
        fail.next--
        throw new Error('google 503')
      }
      rows.push(...add)
    },
    lock: 'unlocked',
    async tryLock(_: Spreadsheet, token: string) {
      if (api.lock !== 'unlocked') return false
      api.lock = token
      return true
    },
    async unlock(_: Spreadsheet, token: string) {
      if (api.lock === token) api.lock = 'unlocked'
    },
    async deleteRows(_: Spreadsheet, indexes: number[]) {
      for (const i of [...indexes].sort((a, b) => b - a)) rows.splice(i, 1)
    },
    async writeView(_: Spreadsheet, v: string[][]) {
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
    // Every row with data is gone. One tombstone with no data stays, so an older edit from
    // another device cannot bring the candidate back.
    expect(sheet.rows).toEqual([HEADER, [c.id, 'candidate', expect.any(String), '1', '']])
    await b.sync.pull()
    expect(b.repo.getSnapshot()).toEqual({ candidates: [], entries: [] })
  })

  it('deleting a candidate keeps a message that was moved from it to someone else', async () => {
    const sheet = memorySheet()
    const { repo, sync } = device(sheet)
    const wrong = candidate({ name: 'Wrong Person' })
    const right = candidate({ name: 'Right Person' })
    const e = submission(wrong, '2026-09-30T10:00:00Z')
    await repo.saveAll([wrong, right, e])
    await sync.push()
    await repo.saveEntry({ ...e, candidateId: right.id })
    await repo.deleteCandidate(wrong)
    await sync.push()
    expect(JSON.stringify(sheet.rows)).not.toContain('Wrong Person')
    const other = device(sheet)
    await other.sync.pull()
    expect(other.repo.getSnapshot().entries.map((x) => [x.id, x.candidateId])).toEqual([
      [e.id, right.id],
    ])
  })

  it('a candidate deleted on a device that has not pulled yet keeps a message moved elsewhere', async () => {
    const sheet = memorySheet()
    const laptop = device(sheet)
    const phone = device(sheet)
    const a = candidate({ name: 'Wrong Person' })
    const b = candidate({ name: 'Right Person' })
    const e = submission(a, '2026-09-30T10:00:00Z')
    await laptop.repo.saveAll([a, b, e])
    await laptop.sync.push()
    await phone.sync.pull()
    // The laptop moves the message. The phone still shows it on A, and deletes A.
    await laptop.repo.saveEntry({ ...e, candidateId: b.id })
    await laptop.sync.push()
    await phone.repo.deleteCandidate(a)
    await phone.sync.push()
    await phone.sync.pull()
    expect(phone.repo.getSnapshot().entries.map((x) => [x.id, x.candidateId])).toEqual([
      [e.id, b.id],
    ])
  })

  it('a save made while a push is sending also goes out', async () => {
    const sheet = memorySheet()
    const { repo, sync } = device(sheet)
    const c = candidate({ name: 'Notes Typist' })
    let release = () => {}
    const slow = sheet.append
    sheet.append = async (id, add) => {
      await new Promise<void>((r) => {
        release = r
      })
      sheet.append = slow
      await slow(id, add)
    }
    await repo.saveCandidate(c)
    const first = sync.push()
    await repo.saveCandidate({ ...c, notes: 'second thought' })
    release()
    // Nothing else calls push, as when the tab is in the background.
    await first
    expect(JSON.stringify(sheet.rows)).toContain('second thought')
    expect(sync.getStatus()).toBe('synced')
  })

  it('a delete that its device never purged is purged by any device ten minutes later', async () => {
    const sheet = memorySheet()
    const c = candidate({ name: 'Closed Tab' })
    sheet.rows.push(
      [c.id, 'candidate', '2026-09-30T09:00:00.000Z', '', JSON.stringify(c)],
      [c.id, 'candidate', '2026-09-30T09:01:00.000Z', '1', ''],
    )
    const { sync } = device(sheet)
    await sync.pull()
    expect(sheet.rows).toEqual([HEADER, [c.id, 'candidate', '2026-09-30T09:01:00.000Z', '1', '']])
  })

  it('a save sent while a pull is reading still shows after that pull', async () => {
    const sheet = memorySheet()
    const { repo, sync } = device(sheet)
    const read = sheet.readRows
    let saving: Promise<void> = Promise.resolve()
    sheet.readRows = async () => {
      const before = await read()
      // The save goes out after the pull read the Sheet, but before the pull finishes.
      saving = repo.saveCandidate(candidate({ name: 'Mid Pull' })).then(() => sync.push())
      await saving
      return before
    }
    await sync.pull()
    sheet.readRows = read
    await saving
    expect(repo.getSnapshot().candidates.map((c) => c.name)).toEqual(['Mid Pull'])
  })

  it('two pulls at once run as one, so a purge never deletes a row twice', async () => {
    const sheet = memorySheet()
    const gone = candidate({ name: 'Gone Gil' })
    const kept = candidate({ name: 'Kept Kay' })
    sheet.rows.push(toRow(rec(gone)), toRow(rec(kept)), [
      gone.id,
      'candidate',
      '2026-09-30T09:01:00.000Z',
      '1',
      '',
    ])
    const { sync } = device(sheet)
    await Promise.all([sync.pull(), sync.pull()])
    expect(JSON.stringify(sheet.rows)).toContain('Kept Kay')
    expect(JSON.stringify(sheet.rows)).not.toContain('Gone Gil')
  })

  it('two devices purging at once never delete another candidate', async () => {
    const sheet = memorySheet()
    const gone = candidate({ name: 'Gone Gil' })
    const kept = candidate({ name: 'Kept Kay' })
    sheet.rows.push(toRow(rec(gone)), toRow(rec(kept)), [
      gone.id,
      'candidate',
      '2026-09-30T09:01:00.000Z',
      '1',
      '',
    ])
    // Each read waits a moment for a second one, so both devices see the same rows.
    const read = sheet.readRows
    let waiting: (() => void) | null = null
    sheet.readRows = async () => {
      const rows = await read()
      if (waiting) {
        const other = waiting
        waiting = null
        other()
      } else {
        await new Promise<void>((resolve) => {
          waiting = resolve
          setTimeout(() => {
            if (waiting === resolve) waiting = null
            resolve()
          }, 20)
        })
      }
      return rows
    }
    const a = device(sheet)
    const b = device(sheet)
    await Promise.all([a.sync.pull(), b.sync.pull()])
    await Promise.all([a.sync.pull(), b.sync.pull()])
    expect(JSON.stringify(sheet.rows)).toContain('Kept Kay')
    expect(JSON.stringify(sheet.rows)).not.toContain('Gone Gil')
    expect(sheet.lock).toBe('unlocked')
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

  it('another account on the same browser sees none of the records of the first', async () => {
    const c = candidate({ name: 'Only Mine' })
    await localCache('acct-first').setRecords([rec(c)])
    const other = new SheetSync(
      memorySheet() as unknown as SheetsApi,
      localCache('acct-second'),
      () => [],
    )
    expect(await other.load()).toEqual([])
  })

  it('rows this device sent to a file that was merged away follow into the kept file', async () => {
    const cache = localCache('acct-merged')
    await cache.setSheetId('old-2')
    const kept = { id: 'keep-1', records: { sheetId: 0, title: 'records' }, view: null }
    const absorbed: Array<[string, string]> = []
    const api = {
      findOrCreate: async () => kept,
      mergedInto: async (id: string) => (id === 'old-2' ? 'keep-1' : null),
      absorb: async (into: { id: string }, from: string) => void absorbed.push([into.id, from]),
      readRows: async () => [],
      append: async () => {},
    }
    const sync = new SheetSync(api as unknown as SheetsApi, cache, () => [])
    await sync.pull()
    expect(absorbed).toEqual([['keep-1', 'old-2']])
    expect(await cache.sheetId()).toBe('keep-1')
  })
})
