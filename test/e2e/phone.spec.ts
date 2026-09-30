import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { asked, person, seed, submitted } from './seed'

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

// iPhone 15, the small iPhones, and the narrowest phones still in use.
const WIDTHS = [393, 375, 320]

test('no screen scrolls sideways at phone width', async ({ page }, info) => {
  test.skip(info.project.name !== 'iphone', 'phone width only')
  const a = person('Alexandra Montgomery-Okonkwo', {
    role: 'Founding full-stack engineer',
    contacts: ['alexandra.montgomery-okonkwo@example.com'],
    due: ['2026-10-09', '17:00', 'America/Los_Angeles'],
  })
  await seed(page, [
    a,
    asked(
      a,
      '2026-10-04T10:00:00Z',
      'A long question about whether the API can use a hosted database?',
    ),
    submitted(
      a,
      '2026-10-04T11:00:00Z',
      'https://a-very-long-subdomain-for-a-deployed-app-example.vercel.app',
    ),
  ])
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 700 })
    await page.goto('/')
    await noSideScroll(page)
    await expect(page.getByRole('button', { name: 'Add', exact: true }).first()).toBeInViewport()
    await page.getByRole('radio', { name: /All/ }).click()
    await noSideScroll(page)
    await page.getByRole('button', { name: /^Stage/ }).click()
    await noSideScroll(page)
    await page.keyboard.press('Escape')
    // The due time stays on one line.
    const due = page.locator('li.list-item .list-line > .num').first()
    expect((await due.boundingBox())?.height ?? 99).toBeLessThanOrEqual(18)
    await page.getByRole('button', { name: 'Alexandra Montgomery-Okonkwo' }).click()
    await noSideScroll(page)
    // Every stage name fits in its button.
    const crowded = await page
      .getByRole('toolbar', { name: 'Stage' })
      .evaluate(
        (el) =>
          el.scrollWidth > el.clientWidth ||
          [...el.children].some((c) => c.scrollWidth > c.clientWidth),
      )
    expect(crowded).toBe(false)
    await page.getByRole('button', { name: 'Close' }).click()
    await page.getByRole('button', { name: 'Add', exact: true }).first().click()
    await noSideScroll(page)
    await page
      .getByLabel('Message')
      .fill(
        'From: Alexandra Montgomery-Okonkwo <alexandra.montgomery-okonkwo@example.com>\nDate: Wed, Sep 30, 2026 at 11:42 AM\n\nhttps://a-very-long-subdomain-for-a-deployed-app-example.vercel.app',
      )
    await page.getByRole('button', { name: 'Read' }).click()
    await noSideScroll(page)
    await page.getByRole('radio', { name: 'By hand' }).click()
    await noSideScroll(page)
  }
})

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('the sign-in screen fits every phone width', async ({ page }, info) => {
    test.skip(info.project.name !== 'iphone', 'phone width only')
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 700 })
      await page.goto('/?signin=drive')
      await noSideScroll(page)
      await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeInViewport()
      await expect(page.getByRole('alert')).toBeInViewport()
    }
  })
})
