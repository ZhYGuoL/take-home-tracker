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
const SHEET_TYPE = 'application/vnd.google-apps.spreadsheet'
const RECORDS = 'records'
const VIEW = 'candidates'

/** A tab by its numeric id, which stays the same when she renames or moves it. */
export interface Tab {
  sheetId: number
  title: string
}

export interface Spreadsheet {
  id: string
  records: Tab
  view: Tab | null
}

// The app gives its two tabs these ids when it makes the file.
const RECORDS_ID = 0
const VIEW_ID = 1

/**
 * Cell Z1 of the records tab is a lock for deleting rows, which go by position. A find-and-
 * replace of "unlocked" is atomic in Sheets, so two devices can never both take it (D3).
 */
const LOCK_COLUMN = 25
export const UNLOCKED = 'unlocked'

/** A range on a tab, quoted, so any title she gives the tab still works. */
const range = (tab: Tab, cells: string) => `'${tab.title.replaceAll("'", "''")}'!${cells}`

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
    let files = await this.files()
    const labeled = files.find((f) => f.appProperties?.takeHomeTracker === 'records-v1')
    let id = labeled?.id ?? files[0]?.id
    if (!id) {
      id = await this.create()
      // Two devices can open the app for the first time at once, and each make a file. Each
      // keeps the oldest, so their saves meet in one Sheet. The newer, empty one goes to the bin.
      files = await this.files()
      const oldest = files[0]?.id
      if (oldest && oldest !== id) {
        await this.call(`${this.access.drive}/drive/v3/files/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ trashed: true }),
        })
        id = oldest
      }
    }
    if (!files.find((f) => f.id === id)?.appProperties?.takeHomeTracker) {
      await this.call(`${this.access.drive}/drive/v3/files/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ appProperties: { takeHomeTracker: 'records-v1' } }),
      })
    }
    const meta = await this.call<{
      sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>
    }>(`${this.access.sheets}/v4/spreadsheets/${id}?fields=${q('sheets.properties')}`)
    const tabs = (meta.sheets ?? []).flatMap((s): Tab[] =>
      s.properties?.sheetId !== undefined && s.properties.title !== undefined
        ? [{ sheetId: s.properties.sheetId, title: s.properties.title }]
        : [],
    )
    const find = (sheetId: number, title: string) =>
      tabs.find((t) => t.sheetId === sheetId) ?? tabs.find((t) => t.title === title) ?? null
    const records = find(RECORDS_ID, RECORDS)
    // Without the records tab nothing can be saved. Deleting it by hand is the only way here.
    if (!records) throw new GoogleError(404)
    return { id, records, view: find(VIEW_ID, VIEW) }
  }

  /** Her tracker files, oldest first. Also by name, in case an earlier attempt did not label one. */
  private async files() {
    const query = `(${PROPERTY} or name = '${TITLE}') and mimeType = '${SHEET_TYPE}' and trashed = false`
    const list = await this.call<{
      files?: Array<{ id: string; appProperties?: Record<string, string> }>
    }>(
      `${this.access.drive}/drive/v3/files?q=${q(query)}&orderBy=createdTime&fields=${q('files(id,createdTime,appProperties)')}`,
    )
    return list.files ?? []
  }

  /** A new tracker. The header row comes with the file, so a later failure cannot leave it out. */
  private async create(): Promise<string> {
    const made = await this.call<{ spreadsheetId: string }>(
      `${this.access.sheets}/v4/spreadsheets`,
      {
        method: 'POST',
        body: JSON.stringify({
          properties: { title: TITLE },
          sheets: [
            {
              properties: { sheetId: RECORDS_ID, title: RECORDS },
              data: [
                {
                  startRow: 0,
                  startColumn: 0,
                  rowData: [
                    {
                      values: [
                        ...HEADER.map((v) => ({ userEnteredValue: { stringValue: v } })),
                        ...Array.from({ length: LOCK_COLUMN - HEADER.length }, () => ({})),
                        { userEnteredValue: { stringValue: UNLOCKED } },
                      ],
                    },
                  ],
                },
              ],
            },
            { properties: { sheetId: VIEW_ID, title: VIEW } },
          ],
        }),
      },
    )
    return made.spreadsheetId
  }

  /** Every row under the header of the `records` tab. Data can fill columns E to Z. */
  async readRows(sheet: Spreadsheet): Promise<string[][]> {
    const res = await this.call<{ values?: string[][] }>(
      `${this.access.sheets}/v4/spreadsheets/${sheet.id}/values/${q(range(sheet.records, 'A2:Z'))}`,
    )
    return res.values ?? []
  }

  /** Adds rows at the end. INSERT_ROWS never writes over another device's rows (D3). */
  async append(sheet: Spreadsheet, rows: string[][]): Promise<void> {
    await this.call(
      `${this.access.sheets}/v4/spreadsheets/${sheet.id}/values/${q(range(sheet.records, 'A1:Z'))}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: 'POST', body: JSON.stringify({ values: rows }) },
    )
  }

  /**
   * Takes the delete lock with `token`, "locked <device> <ms>". A lock older than `staleMs`
   * belonged to a device that stopped halfway, and is taken over. False if another has it.
   */
  async tryLock(sheet: Spreadsheet, token: string, staleMs: number): Promise<boolean> {
    if (await this.replaceLock(sheet, UNLOCKED, token)) return true
    const lock = range(sheet.records, 'Z1')
    const url = `${this.access.sheets}/v4/spreadsheets/${sheet.id}/values/${q(lock)}`
    const held = (await this.call<{ values?: string[][] }>(url)).values?.[0]?.[0] ?? ''
    if (held === '') {
      // A file made before the lock existed.
      await this.call(`${url}?valueInputOption=RAW`, {
        method: 'PUT',
        body: JSON.stringify({ values: [[UNLOCKED]] }),
      })
      return this.replaceLock(sheet, UNLOCKED, token)
    }
    const since = Number(held.split(' ')[2])
    if (Number.isFinite(since) && Date.now() - since > staleMs) {
      return this.replaceLock(sheet, held, token)
    }
    return false
  }

  async unlock(sheet: Spreadsheet, token: string): Promise<void> {
    await this.replaceLock(sheet, token, UNLOCKED)
  }

  /** Replaces the lock cell's exact text. True if it held `from`. */
  private async replaceLock(sheet: Spreadsheet, from: string, to: string): Promise<boolean> {
    const res = await this.call<{
      replies?: Array<{ findReplace?: { occurrencesChanged?: number } }>
    }>(`${this.access.sheets}/v4/spreadsheets/${sheet.id}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            findReplace: {
              find: from,
              replacement: to,
              matchCase: true,
              matchEntireCell: true,
              range: {
                sheetId: sheet.records.sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: LOCK_COLUMN,
                endColumnIndex: LOCK_COLUMN + 1,
              },
            },
          },
        ],
      }),
    })
    return res.replies?.[0]?.findReplace?.occurrencesChanged === 1
  }

  /** Deletes rows by their 0-based index in the tab, last first, so the others keep their place. */
  async deleteRows(sheet: Spreadsheet, indexes: number[]): Promise<void> {
    if (indexes.length === 0) return
    const requests = [...new Set(indexes)]
      .sort((a, b) => b - a)
      .map((i) => ({
        deleteDimension: {
          range: {
            sheetId: sheet.records.sheetId,
            dimension: 'ROWS',
            startIndex: i,
            endIndex: i + 1,
          },
        },
      }))
    await this.call(`${this.access.sheets}/v4/spreadsheets/${sheet.id}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests }),
    })
  }

  /** Replaces the readable `candidates` tab. Nothing reads it back (D3). */
  async writeView(sheet: Spreadsheet, rows: string[][]): Promise<void> {
    if (!sheet.view) return
    await this.call(
      `${this.access.sheets}/v4/spreadsheets/${sheet.id}/values/${q(range(sheet.view, 'A:Z'))}:clear`,
      { method: 'POST', body: '{}' },
    )
    await this.call(
      `${this.access.sheets}/v4/spreadsheets/${sheet.id}/values/${q(range(sheet.view, 'A1'))}?valueInputOption=RAW`,
      { method: 'PUT', body: JSON.stringify({ values: rows }) },
    )
  }
}
