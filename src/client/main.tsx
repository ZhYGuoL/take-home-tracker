import './styles/base.css'
import './styles/app.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { RepoProvider } from './store/context'
import { idbPersistence } from './store/idb'
import { Repo } from './store/repo'

async function boot() {
  const root = document.getElementById('root')
  if (!root) throw new Error('missing #root')
  const repo = new Repo(idbPersistence('local'))
  await repo.init()
  createRoot(root).render(
    <StrictMode>
      <RepoProvider repo={repo}>
        <App />
      </RepoProvider>
    </StrictMode>,
  )
}

void boot()
