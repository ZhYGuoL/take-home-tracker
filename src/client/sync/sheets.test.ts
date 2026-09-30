import { describe, expect, it, vi } from 'vitest'
import { SheetsApi } from './sheets'

const access = {
  token: async () => 'tok',
  sheets: 'https://sheets.test',
  drive: 'https://drive.test',
}

function google(files: Array<{ id: string; appProperties?: Record<string, string> }>) {
  const calls: Array<{ method: string; url: string; body: unknown }> = []
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({
      method: init?.method ?? 'GET',
      url,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    })
    if (url.includes('/drive/v3/files?')) return Response.json({ files })
    if (url.endsWith('/v4/spreadsheets')) return Response.json({ spreadsheetId: 'new-1' })
    if (url.includes('?fields='))
      return Response.json({ sheets: [{ properties: { sheetId: 7, title: 'records' } }] })
    return Response.json({})
  })
  return { api: new SheetsApi(access, f as unknown as typeof fetch), calls }
}

describe('SheetsApi.findOrCreate', () => {
  it('uses her labeled tracker when there is one', async () => {
    const { api, calls } = google([{ id: 's-1', appProperties: { takeHomeTracker: 'records-v1' } }])
    expect(await api.findOrCreate()).toEqual({ id: 's-1', recordsTab: 7 })
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
            rowData: Array<{ values: Array<{ userEnteredValue: { stringValue: string } }> }>
          }>
        }>
      }
    }
    const header = create.body.sheets[0]?.data?.[0]?.rowData[0]?.values.map(
      (v) => v.userEnteredValue.stringValue,
    )
    expect(header).toEqual(['id', 'type', 'updated_at', 'deleted', 'data'])
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
    expect(await api.readRows('s-1')).toEqual([['a']])
    expect(token).toHaveBeenCalledWith(true)
  })
})
