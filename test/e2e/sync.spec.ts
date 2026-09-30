import type { Page } from '@playwright/test'
import { FAKE_GOOGLE_URL } from '../../src/shared/fake-google'
import { addCandidate, expect, signInAs, test } from './fixtures'
import { person, seed, submitted } from './seed'

async function records(page: Page): Promise<string[][]> {
  const sheets = (await (await page.request.get(`${FAKE_GOOGLE_URL}/__sheets`)).json()) as Array<{
    owner: string
    tabs: Record<string, string[][]>
  }>
  return sheets.find((s) => s.owner === 'fake-avery')?.tabs.records ?? []
}

async function view(page: Page): Promise<string[][]> {
  const sheets = (await (await page.request.get(`${FAKE_GOOGLE_URL}/__sheets`)).json()) as Array<{
    owner: string
    tabs: Record<string, string[][]>
  }>
  return sheets.find((s) => s.owner === 'fake-avery')?.tabs.candidates ?? []
}

test('when Google cannot be reached, she sees Not synced, and Retry catches up', async ({
  page,
}) => {
  await seed(page, [person('Already Here')])
  await page.getByRole('radio', { name: /All/ }).click()
  await expect(page.getByRole('button', { name: 'Already Here' })).toBeVisible()
  const sheets = (await (await page.request.get(`${FAKE_GOOGLE_URL}/__sheets`)).json()) as Array<{
    id: string
  }>
  // The next write to her Sheet fails once, as when the phone is offline.
  await page.request.post(`${FAKE_GOOGLE_URL}/__fail`, {
    data: { prefix: `/v4/spreadsheets/${sheets[0]?.id}/values/records`, status: 503, times: 1 },
  })
  await addCandidate(page, { name: 'Offline Olga' })
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Not synced' })).toBeVisible()
  // The save is safe on this device meanwhile.
  await expect(page.getByRole('button', { name: 'Offline Olga' })).toBeVisible()
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Not synced' })).toHaveCount(0)
  await expect
    .poll(async () => (await records(page)).some((r) => r[4]?.includes('Offline Olga')))
    .toBe(true)
})

test('deleting a candidate removes every row of theirs from her Sheet', async ({ page }) => {
  const c = person('Delete Me', { contacts: ['delete.me@example.com'] })
  const keep = person('Keep Me')
  await seed(page, [c, submitted(c, '2026-09-30T10:00:00Z'), keep])
  await page.getByRole('radio', { name: /All/ }).click()
  await page.getByRole('button', { name: 'Delete Me' }).click()
  const detail = page.getByRole('dialog', { name: 'Delete Me' })
  await detail.getByRole('button', { name: 'Delete', exact: true }).click()
  await detail.getByRole('button', { name: 'Delete Delete Me' }).click()
  await expect
    .poll(async () => JSON.stringify(await records(page)))
    .not.toMatch(/Delete Me|delete\.me|c-\d+\.example\.com/)
  expect((await records(page)).map((r) => r[0])).toEqual(['id', keep.id])
})

test.describe('signing out', () => {
  // Sign-out ends the whole grant, so this test uses its own account, not the shared session.
  test.use({ storageState: { cookies: [], origins: [] } })

  test('signing out clears this browser, so the next person sees nothing of hers', async ({
    page,
  }) => {
    await signInAs(page, 'Casey Nguyen')
    await seed(page, [person('Private Pat')], 'fake-casey')
    await page.getByRole('radio', { name: /All/ }).click()
    await expect(page.getByRole('button', { name: 'Private Pat' })).toBeVisible()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible()
    const left = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const open = indexedDB.open('take-home-tracker')
          open.onsuccess = () => {
            const tx = open.result.transaction('records', 'readonly')
            const req = tx.objectStore('records').getAllKeys()
            req.onsuccess = () =>
              resolve(req.result.filter((k) => String(k).includes('fake-casey')).length)
          }
        }),
    )
    expect(left).toBe(0)
  })
})

test('her Sheet gets a readable candidates tab', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-05T19:00:00Z') })
  await seed(page, [person('Readable Rae', { role: 'Founding engineer' })])
  await page.getByRole('radio', { name: /All/ }).click()
  await page.getByRole('button', { name: 'Readable Rae' }).click()
  await page.getByLabel('Notes').fill('Great at SQL')
  await page.clock.runFor(1_000)
  await expect.poll(async () => JSON.stringify(await records(page))).toContain('Great at SQL')
  await page.clock.runFor(25_000)
  await expect
    .poll(async () => (await view(page))[1]?.slice(0, 3))
    .toEqual(['Readable Rae', 'Founding engineer', 'Sent'])
  expect((await view(page))[0]?.[0]).toBe('Name')
})
