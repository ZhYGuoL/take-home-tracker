import { FAKE_GOOGLE_URL } from '../../src/shared/fake-google'
import { expect, test } from './fixtures'
import { asked, person, seed } from './seed'

test('names keep their width at common laptop sizes', async ({ page }, info) => {
  test.skip(info.project.name === 'iphone', 'the phone shows a list, not the table')
  const ben = person('Benedikta Oyelaran-Hughes')
  await seed(page, [ben, asked(ben, '2026-10-04T10:00:00Z')])
  for (const width of [1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 800 })
    const cell = page.locator('tbody tr td').first()
    expect((await cell.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(200)
  }
})

test('the table does not scroll sideways on a 1280 or 1440 screen', async ({ page }, info) => {
  test.skip(info.project.name === 'iphone', 'the phone shows a list, not the table')
  await seed(page, [person('Wide Wendy')])
  await page.getByRole('radio', { name: /All/ }).click()
  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 800 })
    const extra = await page
      .locator('.table-scroll')
      .evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(extra).toBeLessThanOrEqual(0)
  }
})

test('with a candidate open, the header stays in reach: its status, Retry, and Add', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'iphone', 'on a phone the panel covers the page by design')
  await seed(page, [person('Open Olive')])
  await page.getByRole('radio', { name: /All/ }).click()
  await page.getByRole('button', { name: 'Open Olive' }).click()
  await page.route(`${FAKE_GOOGLE_URL}/**`, (route) => route.abort())
  await page.getByLabel('Notes', { exact: true }).fill('Strong on data modelling')
  const status = page.getByRole('status').filter({ hasText: 'Not synced' })
  await expect(status).toBeVisible()
  await page.unroute(`${FAKE_GOOGLE_URL}/**`)
  // A click fails if the open panel covers the button.
  await status.getByRole('button', { name: 'Retry' }).click({ timeout: 2_000 })
  await expect(status).toHaveCount(0)
  await page.getByRole('button', { name: 'Add', exact: true }).first().click({ timeout: 2_000 })
  await expect(page.getByRole('dialog', { name: 'Add candidate' })).toBeVisible()
})

test('a date-only deadline from another zone fits on one line in the table', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'iphone', 'the phone shows a list, not the table')
  await page.clock.install({ time: new Date('2026-10-05T19:00:00Z') })
  const d = person('Dana Whitfield', { due: ['2026-10-02', null, 'America/New_York'] })
  await seed(page, [d])
  await page.getByRole('radio', { name: /All/ }).click()
  const due = page
    .locator('tbody tr')
    .filter({ hasText: 'Dana Whitfield' })
    .locator('td .num')
    .first()
  await expect(due).toHaveText('Fri, Oct 2, end of day EDT')
  const box = await due.boundingBox()
  expect(box?.height ?? 99).toBeLessThanOrEqual(18)
})
