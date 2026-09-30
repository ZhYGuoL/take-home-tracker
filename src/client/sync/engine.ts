import { createStore, del, get, set } from 'idb-keyval'
import { mergeRecords, type StoredRecord } from '../../core/records'
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
  private queue: Promise<void> = Promise.resolve()
  private purge = new Set<string>()
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

  async save(changed: StoredRecord[]): Promise<void> {
    // Local durability first. This is what "saved" means on this device.
    const run = this.queue
      .catch(() => undefined)
      .then(async () => {
        const pending = await this.cache.pending()
        await this.cache.setPending([...mergeRecords(byId(pending), changed).values()])
        const cached = await this.cache.records()
        await this.cache.setRecords([...mergeRecords(byId(cached), changed).values()])
      })
    this.queue = run
    for (const r of changed) if (r.deleted && r.type === 'candidate') this.purge.add(r.id)
    await run
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

  /** Sends what is pending. Safe to call often: one push runs at a time. */
  push(): Promise<void> {
    this.pushing ??= this.pushOnce().finally(() => {
      this.pushing = null
    })
    return this.pushing
  }

  private async pushOnce(): Promise<void> {
    const pending = await this.cache.pending()
    if (pending.length === 0 && this.purge.size === 0) return
    this.setStatus('syncing')
    try {
      const sheet = await this.spreadsheet()
      if (pending.length > 0) {
        await this.api.append(sheet.id, pending.map(toRow))
        // Only what was sent leaves the queue. A save made meanwhile stays.
        const sent = byId(pending)
        const now = await this.cache.pending()
        await this.cache.setPending(now.filter((r) => sent.get(r.id)?.updatedAt !== r.updatedAt))
      }
      if (this.purge.size > 0) await this.purgeRows(sheet)
      this.setStatus((await this.cache.pending()).length > 0 ? 'syncing' : 'synced')
      this.scheduleView()
    } catch {
      this.setStatus('offline')
    }
  }

  /** Deletes every row of a deleted candidate and its entries. */
  private async purgeRows(sheet: Spreadsheet) {
    const ids = new Set(this.purge)
    const rows = await this.api.readRows(sheet.id)
    const records = rows.map(fromRow)
    // Entries go with their candidate. Their data names the candidate, and so do their tombstones.
    const cached = await this.cache.records()
    const owned = new Set(
      cached.flatMap((r) =>
        r.type === 'entry' && !r.deleted && ids.has(r.data.candidateId) ? [r.id] : [],
      ),
    )
    for (const r of records) {
      if (r?.type === 'entry' && !r.deleted && ids.has(r.data.candidateId)) owned.add(r.id)
    }
    const doomed = new Set([...ids, ...owned])
    const indexes = records.flatMap((r, i) => (r && doomed.has(r.id) ? [i + 1] : []))
    await this.api.deleteRows(sheet, indexes)
    for (const id of ids) this.purge.delete(id)
  }

  /** Reads the Sheet and makes it the truth, keeping saves that have not gone out yet. */
  async pull(): Promise<void> {
    try {
      const sheet = await this.spreadsheet()
      await this.push()
      const rows = await this.api.readRows(sheet.id)
      const remote = mergeRecords(
        new Map(),
        rows.flatMap((r) => fromRow(r) ?? []),
      )
      const all = mergeRecords(remote, await this.cache.pending())
      const records = [...all.values()]
      await this.cache.setRecords(records)
      this.target?.replaceAll(records)
      this.setStatus((await this.cache.pending()).length > 0 ? 'offline' : 'synced')
    } catch {
      this.setStatus('offline')
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
