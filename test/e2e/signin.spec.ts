import type { Page } from '@playwright/test'
import { FAKE_GOOGLE_URL } from '../../src/shared/fake-google'
import { expect, test } from './fixtures'

const people = { avery: 'Avery Stone', blake: 'Blake Rivera' }

// These tests start signed out.
test.use({ storageState: { cookies: [], origins: [] } })

async function signInAs(page: Page, who: keyof typeof people) {
  await page.goto('/')
  await page.getByRole('link', { name: 'Continue with Google' }).click()
  await page.getByRole('link', { name: new RegExp(people[who]) }).click()
  await expect(page.getByRole('heading', { name: 'Take-homes' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Continue with Google' })).toHaveCount(0)
}

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
    await signInAs(page, 'avery')
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
    await signInAs(page, 'avery')
    await addByHand(page, 'Avery Candidate')
    await page.getByRole('radio', { name: /All/ }).click()
    await expect(page.getByRole('button', { name: 'Avery Candidate' })).toBeVisible()
    await expect.poll(async () => (await sheets(page)).length).toBe(1)
    await signOut(page)

    await signInAs(page, 'blake')
    await expect(page.getByText('No candidates')).toBeVisible()
    await expect(page.getByText('Avery Candidate')).toHaveCount(0)
    await addByHand(page, 'Blake Candidate')
    await signOut(page)

    await signInAs(page, 'avery')
    await page.getByRole('radio', { name: /All/ }).click()
    await expect(page.getByRole('button', { name: 'Avery Candidate' })).toBeVisible()
    await expect(page.getByText('Blake Candidate')).toHaveCount(0)
    const owners = (await sheets(page)).map((s) => s.owner).sort()
    expect(owners).toEqual(['fake-avery', 'fake-blake'])
  })

  test('another device sees her changes after a reload', async ({ browser, page }) => {
    await signInAs(page, 'avery')
    await addByHand(page, 'Priya Raman')
    await expect
      .poll(
        async () =>
          (await sheets(page)).find((s) => s.owner === 'fake-avery')?.tabs.records?.length,
      )
      .toBe(2)
    const phone = await (await browser.newContext()).newPage()
    await signInAs(phone, 'avery')
    await phone.getByRole('radio', { name: /All/ }).click()
    await expect(phone.getByRole('button', { name: 'Priya Raman' })).toBeVisible()
    await phone.context().close()
  })
})
