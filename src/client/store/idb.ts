import { createStore, get, set } from 'idb-keyval'
import { mergeRecords, type StoredRecord } from '../../core/records'
import type { Persistence } from './repo'

/** Keeps records in this browser's IndexedDB, under one key per account. */
export function idbPersistence(account: string): Persistence {
  const store = createStore('take-home-tracker', 'records')
  const key = `records:${account}`
  let queue = Promise.resolve()
  return {
    async load() {
      return (await get<StoredRecord[]>(key, store)) ?? []
    },
    save(changed) {
      queue = queue.then(async () => {
        const current = (await get<StoredRecord[]>(key, store)) ?? []
        const merged = mergeRecords(new Map(current.map((r) => [r.id, r])), changed)
        await set(key, [...merged.values()], store)
      })
      return queue
    },
  }
}
