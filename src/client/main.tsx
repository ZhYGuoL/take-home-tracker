import './styles/base.css'
import './styles/app.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { viewRows } from '../core/view'
import { App } from './App'
import { SignIn } from './components/SignIn'
import { viewerZone } from './lib/time'
import { fetchSession, googleAccess, signOut } from './session'
import { RepoProvider } from './store/context'
import { Repo } from './store/repo'
import { SessionProvider } from './store/session-context'
import { localCache, SheetSync } from './sync/engine'
import { SheetsApi } from './sync/sheets'

async function boot() {
  const el = document.getElementById('root')
  if (!el) throw new Error('missing #root')
  const root = createRoot(el)
  const session = await fetchSession().catch(() => ({ signedIn: false as const, setUp: true }))

  // A signed-out visitor gets the sign-in screen and nothing else (F8).
  if (!session.signedIn) {
    const why = new URLSearchParams(window.location.search).get('signin')
    const problem = why === 'failed' || why === 'drive' ? why : null
    root.render(<SignIn problem={problem} setUp={session.setUp} />)
    return
  }

  const zone = viewerZone()
  const cache = localCache(session.user.sub)
  const sync = new SheetSync(new SheetsApi(googleAccess(session)), cache, (records) =>
    viewRows(records, Date.now(), zone),
  )
  const repo = new Repo(sync)
  sync.bind(repo)
  await repo.init()

  const value = {
    user: session.user,
    sync,
    async signOut(force = false) {
      if (!force) {
        await sync.push()
        const unsent = (await cache.pending()).length
        if (unsent > 0) return unsent
      }
      // This browser forgets her data too, so the next person on it sees nothing of hers.
      await signOut()
      await cache.clear()
      window.location.assign('/')
      return 0
    },
  }
  root.render(
    <StrictMode>
      <SessionProvider value={value}>
        <RepoProvider repo={repo}>
          <App />
        </RepoProvider>
      </SessionProvider>
    </StrictMode>,
  )

  // The Sheet in her Drive is the truth. Read it now, when she comes back, and each minute.
  void sync.pull()
  const visible = () => document.visibilityState === 'visible'
  window.addEventListener('focus', () => void sync.pull())
  document.addEventListener('visibilitychange', () => {
    if (visible()) void sync.pull()
  })
  window.setInterval(() => {
    if (visible()) void sync.pull()
  }, 60_000)
}

void boot()
