import { createStore, get, update } from 'idb-keyval'
import { mergeRecords, type StoredRecord } from '../../core/records'
import type { Persistence } from './repo'

/** Keeps records in this browser's IndexedDB, under one key per account. */
export function idbPersistence(account: string): Persistence {
  const store = createStore('take-home-tracker', 'records')
  const key = `records:${account}`
  let queue: Promise<unknown> = Promise.resolve()
  return {
    async load() {
      return (await get<StoredRecord[]>(key, store)) ?? []
    },
    save(changed) {
      // One failed save must not stop the next ones, so the queue ignores earlier failures.
      // `update` reads and writes in one transaction, so two tabs cannot drop each other's saves.
      const run = queue
        .catch(() => undefined)
        .then(() =>
          update<StoredRecord[]>(
            key,
            (current) => [
              ...mergeRecords(new Map((current ?? []).map((r) => [r.id, r])), changed).values(),
            ],
            store,
          ),
        )
      queue = run
      return run
    },
  }
}
