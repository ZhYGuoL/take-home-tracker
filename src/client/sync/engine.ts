import { createStore, del, get, set } from 'idb-keyval'
import { purgePlan } from '../../core/purge'
import { mergeRecords, type StoredRecord, type Tombstone } from '../../core/records'
import { fromRow, toRow } from '../../core/rows'
import type { Persistence } from '../store/repo'
import type { SheetsApi, Spreadsheet } from './sheets'

export type SyncStatus = 'synced' | 'syncing' | 'offline'

const store = () => createStore('take-home-tracker', 'records')

/** Local copies, one set per Google account, so a shared browser never mixes two people (D1). */
export function localCache(account: string) {
  const s = store()
  const key = (k: string) => `${k}:${account}`
  return {
    records: async () => (await get<StoredRecord[]>(key('cache'), s)) ?? [],
    setRecords: (r: StoredRecord[]) => set(key('cache'), r, s),
    pending: async () => (await get<StoredRecord[]>(key('pending'), s)) ?? [],
    setPending: (r: StoredRecord[]) => set(key('pending'), r, s),
    sheetId: () => get<string>(key('sheet'), s),
    setSheetId: (id: string) => set(key('sheet'), id, s),
    clear: () => Promise.all(['cache', 'pending', 'sheet'].map((k) => del(key(k), s))),
  }
}

export type LocalCache = ReturnType<typeof localCache>

const byId = (records: Iterable<StoredRecord>) => new Map([...records].map((r) => [r.id, r]))

/**
 * The device that deletes a candidate purges its rows at once. Any device purges a delete
 * older than this, in case that device closed first. The wait keeps two devices from
 * deleting rows by position at the same moment.
 */
const PURGE_AFTER_MS = 10 * 60_000
const stale = (t: Tombstone) => Date.now() - Date.parse(t.updatedAt) > PURGE_AFTER_MS

/**
 * Keeps the Sheet in her Drive and this browser in step (D3).
 * - A save goes to a pending queue in IndexedDB first, so a closed tab loses nothing.
 * - Pending rows are appended to the Sheet. On failure they stay and are sent again later.
 * - A pull reads the Sheet. The Sheet is the truth, plus whatever is still pending here.
 * - Deleting a candidate deletes its rows from the Sheet, so the data really goes away.
 */
export class SheetSync implements Persistence {
  private status: SyncStatus = 'synced'
  private listeners = new Set<() => void>()
  private sheet: Promise<Spreadsheet> | null = null
  /** Every change to the pending queue runs in this chain, one at a time. */
  private queue: Promise<unknown> = Promise.resolve()
  /** Rows sent while a pull was reading, which that pull's snapshot may not have. */
  private sentDuringPull: StoredRecord[] = []
  private pulls = 0
  private viewTimer: ReturnType<typeof setTimeout> | null = null

  private target: { replaceAll(records: StoredRecord[]): void } | null = null

  constructor(
    private readonly api: SheetsApi,
    private readonly cache: LocalCache,
    /** Builds the rows of the readable tab from the current records. */
    private readonly view: (records: StoredRecord[]) => string[][],
  ) {}

  /** The repo that shows what a pull finds. */
  bind(target: { replaceAll(records: StoredRecord[]): void }) {
    this.target = target
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getStatus = () => this.status

  private setStatus(s: SyncStatus) {
    if (s === this.status) return
    this.status = s
    for (const fn of this.listeners) fn()
  }

  /** What this browser had last time, so the list shows at once. A pull follows. */
  async load(): Promise<StoredRecord[]> {
    const [cached, pending] = await Promise.all([this.cache.records(), this.cache.pending()])
    return [...mergeRecords(byId(cached), pending).values()]
  }

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.catch(() => undefined).then(fn)
    this.queue = run
    return run
  }

  async save(changed: StoredRecord[]): Promise<void> {
    // Local durability first. This is what "saved" means on this device.
    await this.serial(async () => {
      const pending = await this.cache.pending()
      await this.cache.setPending([...mergeRecords(byId(pending), changed).values()])
      const cached = await this.cache.records()
      await this.cache.setRecords([...mergeRecords(byId(cached), changed).values()])
    })
    void this.push()
  }

  private spreadsheet(): Promise<Spreadsheet> {
    this.sheet ??= this.api.findOrCreate().then(
      async (s) => {
        await this.cache.setSheetId(s.id)
        return s
      },
      (err) => {
        this.sheet = null
        throw err
      },
    )
    return this.sheet
  }

  private pushing: Promise<void> | null = null
  private again = false

  /**
   * Sends what is pending. Safe to call often: one push runs at a time, and a call made
   * during a push makes it run once more, so a save made meanwhile goes out too.
   */
  push(): Promise<void> {
    if (this.pushing) {
      this.again = true
      return this.pushing
    }
    this.pushing = (async () => {
      try {
        do {
          this.again = false
          await this.pushOnce()
        } while (this.again && this.status !== 'offline')
      } finally {
        this.pushing = null
      }
    })()
    return this.pushing
  }

  private async pushOnce(): Promise<void> {
    let pending = await this.cache.pending()
    if (pending.length === 0) return
    this.setStatus('syncing')
    try {
      const sheet = await this.spreadsheet()
      const deleted = new Set<string>()
      while (pending.length > 0) {
        const sending = pending
        await this.api.append(sheet.id, sending.map(toRow))
        if (this.pulls > 0) this.sentDuringPull.push(...sending)
        for (const r of sending) if (r.deleted && r.type === 'candidate') deleted.add(r.id)
        // Only what was sent leaves the queue. A save made meanwhile stays, and goes next.
        const sent = byId(sending)
        pending = await this.serial(async () => {
          const left = (await this.cache.pending()).filter(
            (r) => sent.get(r.id)?.updatedAt !== r.updatedAt,
          )
          await this.cache.setPending(left)
          return left
        })
      }
      if (deleted.size > 0) {
        const rows = (await this.api.readRows(sheet.id)).map(fromRow)
        await this.purge(sheet, rows, (t) => deleted.has(t.id) || stale(t))
      }
      this.setStatus('synced')
      this.scheduleView()
    } catch {
      this.setStatus('offline')
    }
  }

  /** Deletes the rows a deleted candidate left behind (D3). True if it deleted any. */
  private async purge(
    sheet: Spreadsheet,
    rows: Array<StoredRecord | null>,
    due: (t: Tombstone) => boolean,
  ): Promise<boolean> {
    const plan = purgePlan(rows, due)
    // Row 0 of the tab is the header, so the first row read is row 1.
    await this.api.deleteRows(
      sheet,
      plan.map((i) => i + 1),
    )
    return plan.length > 0
  }

  /** Reads the Sheet and makes it the truth, keeping saves that have not gone out yet. */
  async pull(): Promise<void> {
    this.pulls++
    try {
      const sheet = await this.spreadsheet()
      await this.push()
      const mark = this.sentDuringPull.length
      let rows = (await this.api.readRows(sheet.id)).map(fromRow)
      // A delete that its device did not finish purging, for example because the tab closed.
      if (await this.purge(sheet, rows, stale)) {
        rows = (await this.api.readRows(sheet.id)).map(fromRow)
      }
      const remote = mergeRecords(
        new Map(),
        rows.flatMap((r) => r ?? []),
      )
      const sent = mergeRecords(remote, this.sentDuringPull.slice(mark))
      const all = mergeRecords(sent, await this.cache.pending())
      const records = [...all.values()]
      await this.cache.setRecords(records)
      this.target?.replaceAll(records)
      this.setStatus((await this.cache.pending()).length > 0 ? 'offline' : 'synced')
    } catch {
      this.setStatus('offline')
    } finally {
      if (--this.pulls === 0) this.sentDuringPull = []
    }
  }

  /** Rewrites the readable tab at most once every 20 seconds. */
  private scheduleView() {
    if (this.viewTimer) return
    this.viewTimer = setTimeout(async () => {
      this.viewTimer = null
      try {
        const sheet = await this.spreadsheet()
        await this.api.writeView(sheet.id, this.view(await this.cache.records()))
      } catch {
        // The readable tab is a convenience. The next change writes it again.
      }
    }, 20_000)
  }
}
