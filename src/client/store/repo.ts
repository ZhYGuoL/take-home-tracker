import { type Live, live, mergeRecords, type StoredRecord } from '../../core/records'
import type { Candidate, Entry } from '../../core/types'

export interface Persistence {
  load(): Promise<StoredRecord[]>
  save(changed: StoredRecord[]): Promise<void>
}

/** Every save gets a strictly later timestamp than the last one on this device. */
export function monotonicClock(now: () => number = Date.now): () => string {
  let last = 0
  return () => {
    last = Math.max(now(), last + 1)
    return new Date(last).toISOString()
  }
}

export type SaveStatus = 'saved' | 'saving' | 'failed'

export class Repo {
  private records = new Map<string, StoredRecord>()
  private snapshot: Live = { candidates: [], entries: [] }
  private listeners = new Set<() => void>()
  private status: SaveStatus = 'saved'
  private statusListeners = new Set<() => void>()
  private inFlight = 0
  /** Changes whose save failed. `retry` saves them again. */
  private unsaved = new Map<string, StoredRecord>()

  constructor(
    private readonly persistence: Persistence,
    private readonly clock: () => string = monotonicClock(),
  ) {}

  async init(): Promise<void> {
    this.apply(await this.persistence.load())
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getSnapshot = (): Live => this.snapshot

  subscribeStatus = (fn: () => void): (() => void) => {
    this.statusListeners.add(fn)
    return () => this.statusListeners.delete(fn)
  }

  getStatus = (): SaveStatus => this.status

  retry(): Promise<void> {
    const again = [...this.unsaved.values()]
    this.unsaved.clear()
    return this.persist(again)
  }

  /** Applies records that came from elsewhere, such as another device. */
  apply(incoming: StoredRecord[]): void {
    if (incoming.length === 0) return
    this.records = mergeRecords(this.records, incoming)
    this.snapshot = live(this.records.values())
    for (const fn of this.listeners) fn()
  }

  saveCandidate(c: Candidate): Promise<void> {
    return this.write([
      { id: c.id, type: 'candidate', updatedAt: this.clock(), deleted: false, data: c },
    ])
  }

  /** Deletes the candidate and every entry on its timeline. */
  deleteCandidate(c: Candidate): Promise<void> {
    const own = this.snapshot.entries.filter((e) => e.candidateId === c.id)
    return this.write([
      ...own.map((e) => this.tombstone(e.id, 'entry')),
      this.tombstone(c.id, 'candidate'),
    ])
  }

  saveEntry(e: Entry): Promise<void> {
    return this.write([
      { id: e.id, type: 'entry', updatedAt: this.clock(), deleted: false, data: e },
    ])
  }

  deleteEntry(e: Entry): Promise<void> {
    return this.write([this.tombstone(e.id, 'entry')])
  }

  /** Saves several records as one change, such as a new candidate and its first message. */
  saveAll(items: Array<Candidate | Entry>): Promise<void> {
    return this.write(
      items.map((data): StoredRecord => {
        const updatedAt = this.clock()
        return 'kind' in data
          ? { id: data.id, type: 'entry', updatedAt, deleted: false, data }
          : { id: data.id, type: 'candidate', updatedAt, deleted: false, data }
      }),
    )
  }

  private tombstone(id: string, type: 'candidate' | 'entry'): StoredRecord {
    return { id, type, updatedAt: this.clock(), deleted: true, data: null }
  }

  private write(changed: StoredRecord[]): Promise<void> {
    this.apply(changed)
    return this.persist(changed)
  }

  private async persist(changed: StoredRecord[]): Promise<void> {
    if (changed.length === 0) return
    this.inFlight++
    this.setStatus('saving')
    try {
      await this.persistence.save(changed)
    } catch (err) {
      for (const r of changed) this.unsaved.set(r.id, r)
      console.error('save failed', err instanceof Error ? err.name : 'unknown')
    } finally {
      this.inFlight--
      if (this.inFlight === 0) this.setStatus(this.unsaved.size > 0 ? 'failed' : 'saved')
    }
  }

  private setStatus(next: SaveStatus) {
    if (next === this.status) return
    this.status = next
    for (const fn of this.statusListeners) fn()
  }
}
