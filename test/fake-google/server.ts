// A local stand-in for Google sign-in, Sheets, and Drive, for development and tests (D5).
// It runs only on localhost. Every person here is fictional.
import { createHash, randomBytes } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { FAKE_CLIENT_ID, FAKE_CLIENT_SECRET } from '../../src/shared/fake-google'

const PEOPLE = [
  { sub: 'fake-avery', email: 'avery@example.com', name: 'Avery Stone' },
  { sub: 'fake-blake', email: 'blake@example.com', name: 'Blake Rivera' },
  { sub: 'fake-casey', email: 'casey@example.com', name: 'Casey Nguyen' },
]

type Person = (typeof PEOPLE)[number]

interface Code {
  person: Person
  challenge: string
  redirectUri: string
  /** False when she unticked Drive on the consent screen. */
  drive: boolean
}

interface Sheet {
  id: string
  owner: string
  title: string
  appProperties: Record<string, string>
  tabs: Map<string, string[][]>
  createdTime: string
}

const state = {
  codes: new Map<string, Code>(),
  refresh: new Map<string, Person>(),
  access: new Map<string, { person: Person; expires: number }>(),
  sheets: new Map<string, Sheet>(),
  /** Upcoming failures by path prefix, for tests of retries. */
  failures: [] as Array<{ prefix: string; status: number }>,
  seq: 0,
}

const token = (prefix: string) => `${prefix}-${randomBytes(12).toString('hex')}`

/** Google stops taking this person's access tokens, and with `grant` her refresh tokens too. */
function forget(sub: string, grant: boolean) {
  for (const [t, a] of state.access) if (a.person.sub === sub) state.access.delete(t)
  if (grant) for (const [t, p] of state.refresh) if (p.sub === sub) state.refresh.delete(t)
}

function send(res: ServerResponse, status: number, body: unknown, origin?: string) {
  res.writeHead(status, {
    'content-type': typeof body === 'string' ? 'text/html; charset=utf-8' : 'application/json',
    'access-control-allow-origin': origin ?? '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  })
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

function personFor(req: IncomingMessage): Person | null {
  const auth = req.headers.authorization?.replace(/^Bearer /, '')
  const a = auth ? state.access.get(auth) : undefined
  if (!a || a.expires < Date.now()) return null
  return a.person
}

function unsignedJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.`
}

function issue(person: Person, withRefresh: boolean, drive = true) {
  const access = token('ya29.fake')
  state.access.set(access, { person, expires: Date.now() + 3600_000 })
  const out: Record<string, unknown> = {
    access_token: access,
    expires_in: 3599,
    token_type: 'Bearer',
    scope: `openid email profile${drive ? ' https://www.googleapis.com/auth/drive.file' : ''}`,
    id_token: unsignedJwt({
      iss: 'https://accounts.google.com',
      aud: FAKE_CLIENT_ID,
      sub: person.sub,
      email: person.email,
      email_verified: true,
      name: person.name,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  }
  if (withRefresh) {
    const refresh = token('1//fake')
    state.refresh.set(refresh, person)
    out.refresh_token = refresh
  }
  return out
}

/** "records!A2:Z" or "records" to a tab name and a first row index (0-based). */
function parseRange(range: string): { tab: string; startRow: number } {
  const [tab = '', cells] = decodeURIComponent(range).split('!')
  const m = cells ? /^[A-Z]+(\d+)/.exec(cells) : null
  return { tab, startRow: m ? Number(m[1]) - 1 : 0 }
}

function sheetFor(req: IncomingMessage, id: string): { sheet: Sheet; person: Person } | number {
  const person = personFor(req)
  if (!person) return 401
  const sheet = state.sheets.get(id)
  // Google answers 404 for a file the token cannot see, so another user's sheet does not exist.
  if (!sheet || sheet.owner !== person.sub) return 404
  return { sheet, person }
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const origin = req.headers.origin
  if (req.method === 'OPTIONS') return send(res, 204, '', origin)
  const path = url.pathname

  const failure = state.failures.findIndex((f) => path.startsWith(f.prefix))
  if (failure >= 0) {
    const [f] = state.failures.splice(failure, 1)
    return send(res, f?.status ?? 500, { error: { code: f?.status, message: 'injected' } }, origin)
  }

  // Test controls.
  // Clears every Sheet between tests. Sign-ins stay valid, so a saved session keeps working.
  // "?all=1" also forgets every sign-in.
  if (path === '/__reset' && req.method === 'POST') {
    if (url.searchParams.get('all') === '1') {
      state.codes.clear()
      state.refresh.clear()
      state.access.clear()
    }
    state.sheets.clear()
    state.failures = []
    return send(res, 200, { ok: true }, origin)
  }
  // Writes a person's tracker Sheet directly, the way the app would have left it.
  if (path === '/__seed' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req)) as { sub: string; rows: string[][] }
    // The same Sheet the app picks: the oldest of hers, labeled or still only named.
    let sheet = [...state.sheets.values()]
      .filter(
        (x) =>
          x.owner === body.sub &&
          (x.appProperties.takeHomeTracker === 'records-v1' || x.title === 'Take-home tracker'),
      )
      .sort((a, b) => a.createdTime.localeCompare(b.createdTime))[0]
    if (!sheet) {
      const id = `sheet-${++state.seq}-${randomBytes(4).toString('hex')}`
      sheet = {
        id,
        owner: body.sub,
        title: 'Take-home tracker',
        appProperties: { takeHomeTracker: 'records-v1' },
        tabs: new Map([
          ['records', []],
          ['candidates', []],
        ]),
        createdTime: new Date().toISOString(),
      }
      state.sheets.set(id, sheet)
    }
    sheet.tabs.set('records', [['id', 'type', 'updated_at', 'deleted', 'data'], ...body.rows])
    return send(res, 200, { id: sheet.id }, origin)
  }
  // She removed the app from her Google account: every token of hers stops working.
  if (path === '/__revoke-grant' && req.method === 'POST') {
    forget((JSON.parse(await readBody(req)) as { sub: string }).sub, true)
    return send(res, 200, { ok: true }, origin)
  }
  // Google stops taking her access tokens early. Her refresh token still works.
  if (path === '/__drop-access' && req.method === 'POST') {
    forget((JSON.parse(await readBody(req)) as { sub: string }).sub, false)
    return send(res, 200, { ok: true }, origin)
  }
  if (path === '/__fail' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req)) as {
      prefix: string
      status?: number
      times?: number
    }
    for (let i = 0; i < (body.times ?? 1); i++) {
      state.failures.push({ prefix: body.prefix, status: body.status ?? 500 })
    }
    return send(res, 200, { ok: true }, origin)
  }
  if (path === '/__sheets' && req.method === 'GET') {
    return send(
      res,
      200,
      [...state.sheets.values()].map((s) => ({
        id: s.id,
        owner: s.owner,
        title: s.title,
        tabs: Object.fromEntries(s.tabs),
      })),
      origin,
    )
  }
  if (path === '/__health') return send(res, 200, { ok: true }, origin)

  // Google sign-in: an account chooser with the fictional people.
  if (path === '/o/oauth2/v2/auth' && req.method === 'GET') {
    const redirect = url.searchParams.get('redirect_uri') ?? ''
    const st = url.searchParams.get('state') ?? ''
    const challenge = url.searchParams.get('code_challenge') ?? ''
    if (url.searchParams.get('client_id') !== FAKE_CLIENT_ID) return send(res, 400, 'bad client')
    const back = (p: Person, drive: boolean) => {
      const code = token('code')
      state.codes.set(code, { person: p, challenge, redirectUri: redirect, drive })
      return `${redirect}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(st)}`
    }
    const links = PEOPLE.map(
      (p) => `<li><a href="${back(p, true)}">${p.name}<br><small>${p.email}</small></a></li>`,
    )
    // As if she unticked the Drive box on Google's consent screen.
    const noDrive = PEOPLE.map(
      (p) => `<li><a href="${back(p, false)}">Without Drive: ${p.email}</a></li>`,
    )
    return send(
      res,
      200,
      `<!doctype html><title>Choose an account</title><h1>Choose an account</h1><ul>${links.join('')}</ul><ul>${noDrive.join('')}</ul>`,
    )
  }
  if (path === '/token' && req.method === 'POST') {
    const form = new URLSearchParams(await readBody(req))
    if (
      form.get('client_id') !== FAKE_CLIENT_ID ||
      form.get('client_secret') !== FAKE_CLIENT_SECRET
    ) {
      return send(res, 401, { error: 'invalid_client' })
    }
    if (form.get('grant_type') === 'authorization_code') {
      const code = state.codes.get(form.get('code') ?? '')
      if (!code) return send(res, 400, { error: 'invalid_grant' })
      state.codes.delete(form.get('code') ?? '')
      const verifier = form.get('code_verifier') ?? ''
      const expected = createHash('sha256').update(verifier).digest('base64url')
      if (expected !== code.challenge || form.get('redirect_uri') !== code.redirectUri) {
        return send(res, 400, { error: 'invalid_grant' })
      }
      return send(res, 200, issue(code.person, true, code.drive))
    }
    if (form.get('grant_type') === 'refresh_token') {
      const person = state.refresh.get(form.get('refresh_token') ?? '')
      if (!person) return send(res, 400, { error: 'invalid_grant' })
      return send(res, 200, issue(person, false))
    }
    return send(res, 400, { error: 'unsupported_grant_type' })
  }
  if (path === '/revoke' && req.method === 'POST') {
    const t = url.searchParams.get('token') ?? new URLSearchParams(await readBody(req)).get('token')
    // Like Google, revoking one token ends the whole grant, on every device.
    const person = t ? (state.refresh.get(t) ?? state.access.get(t)?.person) : undefined
    if (person) forget(person.sub, true)
    return send(res, 200, {})
  }

  // Drive: list and label the app's own files.
  if (path === '/drive/v3/files' && req.method === 'GET') {
    const person = personFor(req)
    if (!person) return send(res, 401, { error: { code: 401 } }, origin)
    const q = url.searchParams.get('q') ?? ''
    const want = /appProperties has \{ key='([^']+)' and value='([^']+)' \}/.exec(q)
    const named = /name = '([^']+)'/.exec(q)
    const files = [...state.sheets.values()]
      .filter((s) => s.owner === person.sub)
      .filter(
        (s) =>
          (!want && !named) ||
          (want && s.appProperties[want[1] ?? ''] === want[2]) ||
          (named && s.title === named[1]),
      )
      .sort((a, b) => a.createdTime.localeCompare(b.createdTime))
      .map((s) => ({
        id: s.id,
        name: s.title,
        createdTime: s.createdTime,
        appProperties: s.appProperties,
      }))
    return send(res, 200, { files }, origin)
  }
  const driveFile = /^\/drive\/v3\/files\/([^/]+)$/.exec(path)
  if (driveFile && req.method === 'PATCH') {
    const found = sheetFor(req, driveFile[1] ?? '')
    if (typeof found === 'number') return send(res, found, { error: { code: found } }, origin)
    const body = JSON.parse(await readBody(req)) as { appProperties?: Record<string, string> }
    Object.assign(found.sheet.appProperties, body.appProperties ?? {})
    return send(res, 200, { id: found.sheet.id }, origin)
  }

  // Sheets.
  if (path === '/v4/spreadsheets' && req.method === 'POST') {
    const person = personFor(req)
    if (!person) return send(res, 401, { error: { code: 401 } }, origin)
    const body = JSON.parse(await readBody(req)) as {
      properties?: { title?: string }
      sheets?: Array<{
        properties?: { title?: string }
        data?: Array<{
          rowData?: Array<{ values?: Array<{ userEnteredValue?: { stringValue?: string } }> }>
        }>
      }>
    }
    const id = `sheet-${++state.seq}-${randomBytes(4).toString('hex')}`
    const tabs = new Map<string, string[][]>()
    for (const s of body.sheets ?? [{ properties: { title: 'Sheet1' } }]) {
      const rows = (s.data?.[0]?.rowData ?? []).map((r) =>
        (r.values ?? []).map((v) => v.userEnteredValue?.stringValue ?? ''),
      )
      tabs.set(s.properties?.title ?? 'Sheet1', rows)
    }
    state.sheets.set(id, {
      id,
      owner: person.sub,
      title: body.properties?.title ?? 'Untitled',
      appProperties: {},
      tabs,
      createdTime: new Date().toISOString(),
    })
    return send(res, 200, { spreadsheetId: id }, origin)
  }
  const values = /^\/v4\/spreadsheets\/([^/]+)\/values\/([^:]+)(?::(append|clear))?$/.exec(path)
  if (values) {
    const found = sheetFor(req, values[1] ?? '')
    if (typeof found === 'number') return send(res, found, { error: { code: found } }, origin)
    const { tab, startRow } = parseRange(values[2] ?? '')
    const rows = found.sheet.tabs.get(tab)
    if (!rows) return send(res, 400, { error: { code: 400, message: 'no such tab' } }, origin)
    const op = values[3]
    if (req.method === 'GET' && !op) {
      const slice = rows.slice(startRow)
      return send(
        res,
        200,
        slice.length ? { range: values[2], values: slice } : { range: values[2] },
        origin,
      )
    }
    if (req.method === 'POST' && op === 'append') {
      const body = JSON.parse(await readBody(req)) as { values: string[][] }
      // Like Sheets: a cell holds at most 50,000 characters, and a new sheet has columns A to Z.
      if (body.values.some((r) => r.length > 26 || r.some((v) => String(v).length > 50_000))) {
        return send(res, 400, { error: { code: 400, message: 'cell too long' } }, origin)
      }
      rows.push(...body.values.map((r) => r.map(String)))
      return send(res, 200, { updates: { updatedRows: body.values.length } }, origin)
    }
    if (req.method === 'POST' && op === 'clear') {
      rows.length = 0
      return send(res, 200, {}, origin)
    }
    if (req.method === 'PUT' && !op) {
      const body = JSON.parse(await readBody(req)) as { values: string[][] }
      body.values.forEach((r, i) => {
        rows[startRow + i] = r.map(String)
      })
      return send(res, 200, { updatedRows: body.values.length }, origin)
    }
  }
  const batch = /^\/v4\/spreadsheets\/([^/:]+):batchUpdate$/.exec(path)
  if (batch && req.method === 'POST') {
    const found = sheetFor(req, batch[1] ?? '')
    if (typeof found === 'number') return send(res, found, { error: { code: found } }, origin)
    const body = JSON.parse(await readBody(req)) as {
      requests: Array<{
        deleteDimension?: {
          range: { sheetId?: number; dimension: string; startIndex: number; endIndex: number }
        }
      }>
    }
    const tabs = [...found.sheet.tabs.values()]
    for (const r of body.requests) {
      const d = r.deleteDimension
      if (d?.range.dimension !== 'ROWS') continue
      const rows = tabs[d.range.sheetId ?? 0]
      rows?.splice(d.range.startIndex, d.range.endIndex - d.range.startIndex)
    }
    return send(res, 200, { replies: [] }, origin)
  }
  const meta = /^\/v4\/spreadsheets\/([^/:]+)$/.exec(path)
  if (meta && req.method === 'GET') {
    const found = sheetFor(req, meta[1] ?? '')
    if (typeof found === 'number') return send(res, found, { error: { code: found } }, origin)
    return send(
      res,
      200,
      {
        spreadsheetId: found.sheet.id,
        sheets: [...found.sheet.tabs.keys()].map((title, sheetId) => ({
          properties: { sheetId, title },
        })),
      },
      origin,
    )
  }
  return send(res, 404, { error: { code: 404, message: `no route ${req.method} ${path}` } }, origin)
}

const port = Number(process.env.FAKE_GOOGLE_PORT ?? 8790)
createServer((req, res) => {
  handle(req, res).catch(() => send(res, 500, { error: { code: 500 } }))
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`fake google on http://127.0.0.1:${port}\n`)
})
