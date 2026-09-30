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
    if (files.length === 0) {
      const made = await this.create()
      // Two devices can open the app for the first time at once. Listing again finds a file
      // the other one made, and the merge below joins the two. Drive's list can lag, so the
      // file this call made counts even if the list does not show it yet.
      files = await this.files()
      if (!files.some((f) => f.id === made)) files = [...files, { id: made }]
    }
    const [keep, ...extra] = files
    if (!keep) throw new GoogleError(404)
    const sheet = await this.open(keep.id)
    if (keep.appProperties?.takeHomeTracker !== 'records-v1') {
      await this.call(`${this.access.drive}/drive/v3/files/${keep.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ appProperties: { takeHomeTracker: 'records-v1' } }),
      })
    }
    // More than one file: two first visits at once, or an attempt that failed halfway. Their
    // rows join the oldest, where newest-wins sorts them out (D3). The newer file goes to the
    // bin, marked, so a device that still writes to it can follow (see `mergedInto`).
    for (const f of extra) {
      await this.absorb(sheet, f.id)
      await this.call(`${this.access.drive}/drive/v3/files/${f.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          trashed: true,
          appProperties: { takeHomeTracker: 'merged', mergedInto: keep.id },
        }),
      })
    }
    return sheet
  }

  /** Adds every record row of another tracker file to `into`. */
  async absorb(into: Spreadsheet, fromId: string): Promise<void> {
    const rows = await this.readRows(await this.open(fromId))
    if (rows.length > 0) await this.append(into, rows)
  }

  /** The file that this one was merged into, or null. */
  async mergedInto(id: string): Promise<string | null> {
    try {
      const f = await this.call<{ appProperties?: Record<string, string> }>(
        `${this.access.drive}/drive/v3/files/${id}?fields=${q('appProperties')}`,
      )
      return f.appProperties?.mergedInto ?? null
    } catch (err) {
      if (err instanceof GoogleError && err.status === 404) return null
      throw err
    }
  }

  /** A tracker file with its tabs, found by their ids, so a renamed tab still works. */
  private async open(id: string): Promise<Spreadsheet> {
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
