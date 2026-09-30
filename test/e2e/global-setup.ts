import { chromium, type FullConfig } from '@playwright/test'

export const AUTH_FILE = 'test-results/.auth/avery.json'

/** Signs in once as the fictional Avery Stone through the fake Google, and saves the session. */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:4180'
  const browser = await chromium.launch()
  const page = await browser.newPage({ baseURL })
  await page.goto('/')
  await page.getByRole('link', { name: 'Continue with Google' }).click()
  await page.getByRole('link', { name: /Avery Stone/ }).click()
  await page.getByRole('heading', { name: 'Take-homes' }).waitFor()
  await page.context().storageState({ path: AUTH_FILE })
  await browser.close()
}
