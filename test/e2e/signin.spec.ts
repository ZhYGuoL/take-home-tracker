import type { Page } from '@playwright/test'
import { FAKE_GOOGLE_URL } from '../../src/shared/fake-google'
import { expect, signInAs, test } from './fixtures'

// These tests start signed out.
test.use({ storageState: { cookies: [], origins: [] } })

async function addByHand(page: Page, name: string) {
  await page.getByRole('button', { name: 'Add', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add candidate' })
  await dialog.getByRole('radio', { name: 'By hand' }).click()
  await dialog.getByLabel('Name', { exact: true }).fill(name)
  await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByRole('button', { name: 'Close' }).click()
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible()
}

async function sheets(page: Page) {
  return (await (await page.request.get(`${FAKE_GOOGLE_URL}/__sheets`)).json()) as Array<{
    owner: string
    tabs: Record<string, string[][]>
  }>
}

test.describe('signed out', () => {
  test('a visitor sees only the way in, and the API gives nothing', async ({ page }) => {
    await page.goto('/?view=all')
    await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add', exact: true })).toHaveCount(0)
    const session = await page.request.get('/api/session')
    expect(session.status()).toBe(401)
    const extract = await page.request.post('/api/extract', { data: { paste: 'hi', ctx: {} } })
    expect([403, 503]).toContain(extract.status())
  })
})

test.describe('signed in', () => {
  test('her candidates live in a Sheet in her own Drive', async ({ page }) => {
    await signInAs(page, 'Avery Stone')
    await addByHand(page, 'Rowan Okafor')
    await expect
      .poll(
        async () =>
          (await sheets(page)).find((s) => s.owner === 'fake-avery')?.tabs.records?.length,
      )
      .toBe(2)
    const avery = (await sheets(page)).find((s) => s.owner === 'fake-avery')
    expect(avery?.tabs.records?.[0]).toEqual(['id', 'type', 'updated_at', 'deleted', 'data'])
    expect(avery?.tabs.records?.[1]?.[4]).toContain('Rowan Okafor')
  })

  test('one user never sees another user on the same browser', async ({ page }) => {
    await signInAs(page, 'Casey Nguyen')
    await addByHand(page, 'Casey Candidate')
    await page.getByRole('radio', { name: /All/ }).click()
    await expect(page.getByRole('button', { name: 'Casey Candidate' })).toBeVisible()
    await expect.poll(async () => (await sheets(page)).length).toBe(1)
    await signOut(page)

    await signInAs(page, 'Blake Rivera')
    await expect(page.getByText('No candidates')).toBeVisible()
    await expect(page.getByText('Casey Candidate')).toHaveCount(0)
    await addByHand(page, 'Blake Candidate')
    await signOut(page)

    await signInAs(page, 'Casey Nguyen')
    await page.getByRole('radio', { name: /All/ }).click()
    await expect(page.getByRole('button', { name: 'Casey Candidate' })).toBeVisible()
    await expect(page.getByText('Blake Candidate')).toHaveCount(0)
    const owners = (await sheets(page)).map((s) => s.owner).sort()
    expect(owners).toEqual(['fake-blake', 'fake-casey'])
  })

  test('another device sees her changes after a reload', async ({ browser, page }) => {
    await signInAs(page, 'Avery Stone')
    await addByHand(page, 'Priya Raman')
    await expect
      .poll(
        async () =>
          (await sheets(page)).find((s) => s.owner === 'fake-avery')?.tabs.records?.length,
      )
      .toBe(2)
    const phone = await (await browser.newContext()).newPage()
    await signInAs(phone, 'Avery Stone')
    await phone.getByRole('radio', { name: /All/ }).click()
    await expect(phone.getByRole('button', { name: 'Priya Raman' })).toBeVisible()
    await phone.context().close()
  })
})

test.describe('when Google stops taking her tokens', () => {
  const records = async (page: Page) =>
    JSON.stringify((await sheets(page)).find((s) => s.owner === 'fake-blake')?.tabs.records)

  test('a refused access token is replaced, and her saves keep reaching the Sheet', async ({
    page,
  }) => {
    await signInAs(page, 'Blake Rivera')
    await page.request.post(`${FAKE_GOOGLE_URL}/__drop-access`, { data: { sub: 'fake-blake' } })
    await addByHand(page, 'Tess Okonkwo')
    await expect.poll(() => records(page)).toContain('Tess Okonkwo')
    await expect(page.getByRole('status').filter({ hasText: 'Not synced' })).toHaveCount(0)
  })

  test('after she removes the app at Google, she goes to sign-in, and an unsent save survives', async ({
    page,
  }) => {
    await signInAs(page, 'Blake Rivera')
    await expect.poll(async () => (await sheets(page)).length).toBe(1)
    // Google cannot be reached while she adds someone, so the save waits on this device.
    await page.route(`${FAKE_GOOGLE_URL}/**`, (route) => route.abort())
    await page.getByRole('button', { name: 'Add', exact: true }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Add candidate' })
    await dialog.getByRole('radio', { name: 'By hand' }).click()
    await dialog.getByLabel('Name', { exact: true }).fill('Uma Lindgren')
    await dialog.getByRole('button', { name: 'Add', exact: true }).click()
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Not synced' })).toBeVisible()
    await page.request.post(`${FAKE_GOOGLE_URL}/__revoke-grant`, { data: { sub: 'fake-blake' } })
    await page.unroute(`${FAKE_GOOGLE_URL}/**`)
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible()
    await signInAs(page, 'Blake Rivera')
    await expect.poll(() => records(page)).toContain('Uma Lindgren')
  })

  test('signing out on one device sends her other device to sign-in at its next save', async ({
    browser,
    page,
  }) => {
    await signInAs(page, 'Blake Rivera')
    const phone = await (await browser.newContext()).newPage()
    await signInAs(phone, 'Blake Rivera')
    await signOut(page)
    await phone.getByRole('button', { name: 'Add', exact: true }).first().click()
    const dialog = phone.getByRole('dialog', { name: 'Add candidate' })
    await dialog.getByRole('radio', { name: 'By hand' }).click()
    await dialog.getByLabel('Name', { exact: true }).fill('Vic Moreau')
    await dialog.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(phone.getByRole('link', { name: 'Continue with Google' })).toBeVisible()
    await phone.context().close()
  })
})
