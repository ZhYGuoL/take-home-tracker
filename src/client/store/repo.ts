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

export class Repo {
  private records = new Map<string, StoredRecord>()
  private snapshot: Live = { candidates: [], entries: [] }
  private listeners = new Set<() => void>()

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

  deleteCandidate(c: Candidate): Promise<void> {
    return this.write([
      { id: c.id, type: 'candidate', updatedAt: this.clock(), deleted: true, data: c },
    ])
  }

  saveEntry(e: Entry): Promise<void> {
    return this.write([
      { id: e.id, type: 'entry', updatedAt: this.clock(), deleted: false, data: e },
    ])
  }

  deleteEntry(e: Entry): Promise<void> {
    return this.write([
      { id: e.id, type: 'entry', updatedAt: this.clock(), deleted: true, data: e },
    ])
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

  private write(changed: StoredRecord[]): Promise<void> {
    this.apply(changed)
    return this.persistence.save(changed)
  }
}
