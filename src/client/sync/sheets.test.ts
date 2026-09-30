import { describe, expect, it, vi } from 'vitest'
import { SheetsApi } from './sheets'

const access = {
  token: async () => 'tok',
  sheets: 'https://sheets.test',
  drive: 'https://drive.test',
}

type File = { id: string; appProperties?: Record<string, string> }

function google(
  files: File[] | (() => File[]),
  tabs: Array<{ sheetId: number; title: string }> = [{ sheetId: 7, title: 'records' }],
) {
  const calls: Array<{ method: string; url: string; body: unknown }> = []
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({
      method: init?.method ?? 'GET',
      url,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    })
    if (url.includes('/drive/v3/files?'))
      return Response.json({ files: typeof files === 'function' ? files() : files })
    if (url.endsWith('/v4/spreadsheets')) return Response.json({ spreadsheetId: 'new-1' })
    if (url.includes('?fields='))
      return Response.json({ sheets: tabs.map((properties) => ({ properties })) })
    return Response.json({ values: [['a']] })
  })
  return { api: new SheetsApi(access, f as unknown as typeof fetch), calls }
}

describe('SheetsApi.findOrCreate', () => {
  it('uses her labeled tracker when there is one', async () => {
    const { api, calls } = google([{ id: 's-1', appProperties: { takeHomeTracker: 'records-v1' } }])
    expect(await api.findOrCreate()).toEqual({
      id: 's-1',
      records: { sheetId: 7, title: 'records' },
      view: null,
    })
    expect(calls.some((c) => c.method === 'POST' || c.method === 'PATCH')).toBe(false)
  })

  it('labels a tracker an earlier attempt made but did not label, instead of making another', async () => {
    const { api, calls } = google([{ id: 's-2' }])
    expect((await api.findOrCreate()).id).toBe('s-2')
    expect(calls.filter((c) => c.method === 'POST')).toEqual([])
    expect(calls.find((c) => c.method === 'PATCH')?.url).toBe(
      'https://drive.test/drive/v3/files/s-2',
    )
  })

  it('makes a new tracker with its header row in the same request', async () => {
    const { api, calls } = google([])
    expect((await api.findOrCreate()).id).toBe('new-1')
    const create = calls.find((c) => c.url.endsWith('/v4/spreadsheets')) as {
      body: {
        sheets: Array<{
          data?: Array<{
            rowData: Array<{ values: Array<{ userEnteredValue?: { stringValue: string } }> }>
          }>
        }>
      }
    }
    const header = create.body.sheets[0]?.data?.[0]?.rowData[0]?.values.map(
      (v) => v.userEnteredValue?.stringValue ?? '',
    )
    expect(header?.slice(0, 5)).toEqual(['id', 'type', 'updated_at', 'deleted', 'data'])
    // Z1 holds the lock for deleting rows.
    expect(header?.[25]).toBe('unlocked')
  })

  it('two first visits at once keep the oldest file, and put the one they made in the bin', async () => {
    let lists = 0
    const { api, calls } = google(() => (++lists === 1 ? [] : [{ id: 'other-1' }, { id: 'new-1' }]))
    expect((await api.findOrCreate()).id).toBe('other-1')
    const patches = calls.filter((c) => c.method === 'PATCH')
    expect(patches.map((c) => [c.url, c.body])).toEqual([
      ['https://drive.test/drive/v3/files/new-1', { trashed: true }],
      [
        'https://drive.test/drive/v3/files/other-1',
        { appProperties: { takeHomeTracker: 'records-v1' } },
      ],
    ])
  })

  it('finds the records tab by its id after she renames it, and reads it by its new name', async () => {
    const { api, calls } = google(
      [{ id: 's-1', appProperties: { takeHomeTracker: 'records-v1' } }],
      [
        { sheetId: 1, title: 'candidates' },
        { sheetId: 0, title: "Rae's data" },
      ],
    )
    const sheet = await api.findOrCreate()
    expect(sheet.records).toEqual({ sheetId: 0, title: "Rae's data" })
    await api.readRows(sheet)
    expect(decodeURIComponent(calls.at(-1)?.url ?? '')).toContain("/values/'Rae''s data'!A2:Z")
  })

  it('says so when the records tab is gone, instead of writing somewhere else', async () => {
    const { api } = google(
      [{ id: 's-1', appProperties: { takeHomeTracker: 'records-v1' } }],
      [{ sheetId: 1, title: 'candidates' }],
    )
    await expect(api.findOrCreate()).rejects.toThrow('google 404')
  })

  it('asks Drive only for files this app made, by label or by its name', async () => {
    const { api, calls } = google([])
    await api.findOrCreate()
    const q = new URL(calls[0]?.url ?? '').searchParams.get('q')
    expect(q).toContain("appProperties has { key='takeHomeTracker' and value='records-v1' }")
    expect(q).toContain("name = 'Take-home tracker'")
  })
})

describe('SheetsApi calls', () => {
  it('gets a fresh token once after a 401, then gives up', async () => {
    const token = vi.fn(async (fresh?: boolean) => (fresh ? 'fresh' : 'stale'))
    const f = vi.fn(async (_: string, init?: RequestInit) =>
      new Headers(init?.headers).get('authorization') === 'Bearer fresh'
        ? Response.json({ values: [['a']] })
        : new Response('{}', { status: 401 }),
    )
    const api = new SheetsApi({ ...access, token }, f as unknown as typeof fetch)
    const sheet = { id: 's-1', records: { sheetId: 0, title: 'records' }, view: null }
    expect(await api.readRows(sheet)).toEqual([['a']])
    expect(token).toHaveBeenCalledWith(true)
  })
})

describe('SheetsApi delete lock', () => {
  const sheet = { id: 's-1', records: { sheetId: 0, title: 'records' }, view: null }

  function lockGoogle(cell: string) {
    const calls: Array<{ method: string; url: string; body: unknown }> = []
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : null
      calls.push({ method: init?.method ?? 'GET', url, body })
      const fr = body?.requests?.[0]?.findReplace
      if (fr) {
        const hit = fr.find === cell
        if (hit) cell = fr.replacement
        return Response.json({ replies: [{ findReplace: { occurrencesChanged: hit ? 1 : 0 } }] })
      }
      return Response.json({ values: cell ? [[cell]] : [] })
    })
    return { api: new SheetsApi(access, f as unknown as typeof fetch), calls, cell: () => cell }
  }

  it('takes the lock with one exact find-and-replace in cell Z1', async () => {
    const g = lockGoogle('unlocked')
    expect(await g.api.tryLock(sheet, 'locked a 1', 120_000)).toBe(true)
    expect(g.calls[0]?.body).toEqual({
      requests: [
        {
          findReplace: {
            find: 'unlocked',
            replacement: 'locked a 1',
            matchCase: true,
            matchEntireCell: true,
            range: {
              sheetId: 0,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 25,
              endColumnIndex: 26,
            },
          },
        },
      ],
    })
    await g.api.unlock(sheet, 'locked a 1')
    expect(g.cell()).toBe('unlocked')
  })

  it('leaves a fresh lock alone, and takes over one that is stale', async () => {
    const fresh = lockGoogle(`locked b ${Date.now()}`)
    expect(await fresh.api.tryLock(sheet, 'locked a 1', 120_000)).toBe(false)
    const stale = lockGoogle(`locked b ${Date.now() - 180_000}`)
    expect(await stale.api.tryLock(sheet, 'locked a 1', 120_000)).toBe(true)
    expect(stale.cell()).toBe('locked a 1')
  })
})
