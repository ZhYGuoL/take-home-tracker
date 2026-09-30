import { HEADER } from '../../core/rows'

export interface GoogleAccess {
  /** A current Google access token. `fresh` asks for a new one after a 401. */
  token(fresh?: boolean): Promise<string>
  sheets: string
  drive: string
}

export class GoogleError extends Error {
  constructor(readonly status: number) {
    // The message names the status only. It never carries row data.
    super(`google ${status}`)
  }
}

export const TITLE = 'Take-home tracker'
const PROPERTY = "appProperties has { key='takeHomeTracker' and value='records-v1' }"
const RECORDS = 'records'
const VIEW = 'candidates'

export interface Spreadsheet {
  id: string
  /** The numeric id of the `records` tab, for row deletes. */
  recordsTab: number
}

const q = encodeURIComponent

/** The Sheets and Drive calls the app makes, with her own token, from her browser (D1). */
export class SheetsApi {
  constructor(
    private readonly access: GoogleAccess,
    private readonly fetcher: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  private async call<T>(url: string, init: RequestInit = {}): Promise<T> {
    for (const fresh of [false, true]) {
      const res = await this.fetcher(url, {
        ...init,
        headers: {
          ...(init.body ? { 'content-type': 'application/json' } : {}),
          authorization: `Bearer ${await this.access.token(fresh)}`,
        },
      })
      if (res.status === 401 && !fresh) continue
      if (!res.ok) throw new GoogleError(res.status)
      return (await res.json()) as T
    }
    throw new GoogleError(401)
  }

  /**
   * Her tracker spreadsheet: the oldest one this app made in her Drive, or a new one.
   * `drive.file` lets the app see only files it made (D4).
   */
  async findOrCreate(): Promise<Spreadsheet> {
    const list = await this.call<{ files?: Array<{ id: string }> }>(
      `${this.access.drive}/drive/v3/files?q=${q(`${PROPERTY} and trashed=false`)}&orderBy=createdTime&fields=${q('files(id,createdTime)')}`,
    )
    let id = list.files?.[0]?.id
    if (!id) {
      const made = await this.call<{ spreadsheetId: string }>(
        `${this.access.sheets}/v4/spreadsheets`,
        {
          method: 'POST',
          body: JSON.stringify({
            properties: { title: TITLE },
            sheets: [{ properties: { title: RECORDS } }, { properties: { title: VIEW } }],
          }),
        },
      )
      id = made.spreadsheetId
      await this.append(id, [HEADER])
      await this.call(`${this.access.drive}/drive/v3/files/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ appProperties: { takeHomeTracker: 'records-v1' } }),
      })
    }
    const meta = await this.call<{
      sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>
    }>(`${this.access.sheets}/v4/spreadsheets/${id}?fields=${q('sheets.properties')}`)
    const tab = meta.sheets?.find((s) => s.properties?.title === RECORDS)?.properties?.sheetId ?? 0
    return { id, recordsTab: tab }
  }

  /** Every row under the header of the `records` tab. */
  async readRows(id: string): Promise<string[][]> {
    const res = await this.call<{ values?: string[][] }>(
      `${this.access.sheets}/v4/spreadsheets/${id}/values/${q(`${RECORDS}!A2:E`)}`,
    )
    return res.values ?? []
  }

  /** Adds rows at the end. INSERT_ROWS never writes over another device's rows (D3). */
  async append(id: string, rows: string[][]): Promise<void> {
    await this.call(
      `${this.access.sheets}/v4/spreadsheets/${id}/values/${q(`${RECORDS}!A1:E`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: 'POST', body: JSON.stringify({ values: rows }) },
    )
  }

  /** Deletes rows by their 0-based index in the tab, last first, so the others keep their place. */
  async deleteRows(sheet: Spreadsheet, indexes: number[]): Promise<void> {
    if (indexes.length === 0) return
    const requests = [...new Set(indexes)]
      .sort((a, b) => b - a)
      .map((i) => ({
        deleteDimension: {
          range: { sheetId: sheet.recordsTab, dimension: 'ROWS', startIndex: i, endIndex: i + 1 },
        },
      }))
    await this.call(`${this.access.sheets}/v4/spreadsheets/${sheet.id}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests }),
    })
  }

  /** Replaces the readable `candidates` tab. Nothing reads it back (D3). */
  async writeView(id: string, rows: string[][]): Promise<void> {
    await this.call(`${this.access.sheets}/v4/spreadsheets/${id}/values/${q(VIEW)}:clear`, {
      method: 'POST',
      body: '{}',
    })
    await this.call(
      `${this.access.sheets}/v4/spreadsheets/${id}/values/${q(`${VIEW}!A1`)}?valueInputOption=RAW`,
      { method: 'PUT', body: JSON.stringify({ values: rows }) },
    )
  }
}
