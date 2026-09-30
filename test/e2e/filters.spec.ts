import type { Page } from '@playwright/test'
import { expect, shownNames, test } from './fixtures'
import { asked, openedAt, person, seed, staged, submitted } from './seed'

const LA = 'America/Los_Angeles'
const NOW = new Date('2026-10-05T19:00:00Z')

const ada = person('Ada Lindqvist', { source: 'email', due: ['2026-10-02', '17:00', LA] })
const ben = person('Ben Osei', { source: 'x', due: ['2026-10-09', '17:00', LA] })
const cyd = person('Cyd Marsh', {
  role: 'Product engineer',
  due: ['2026-10-01', '17:00', LA],
})
const dev = person('Dev Patel', { role: '', source: 'linkedin' })
const eli = person('Eli Brandt', {
  role: 'Product engineer',
  source: 'email',
  due: ['2026-10-02', '23:00', LA],
})
const fay = person('Fay Nakamura', { due: ['2026-10-09', '17:00', LA] })

const pipeline = [
  ada,
  ben,
  asked(ben, '2026-10-04T10:00:00Z'),
  cyd,
  submitted(cyd, '2026-10-02T02:00:00Z'),
  dev,
  staged(dev, '2026-10-03T10:00:00Z', 'advanced'),
  eli,
  submitted(eli, '2026-10-02T20:00:00Z'),
  openedAt(eli, '2026-10-03T09:00:00Z'),
  fay,
]

const first = (names: string[]) => names.map((n) => n.split(' ')[0]).sort()
const shown = async (page: Page) => first(await shownNames(page))

async function pick(page: Page, chip: string, option: RegExp) {
  await page.getByRole('button', { name: new RegExp(`^${chip}`) }).click()
  await page.getByRole('checkbox', { name: option }).check()
  await page.keyboard.press('Escape')
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: NOW })
  await seed(page, pipeline)
  await page.getByRole('radio', { name: /All/ }).click()
  await expect.poll(() => shown(page)).toEqual(['Ada', 'Ben', 'Cyd', 'Dev', 'Eli', 'Fay'])
})

test.describe('each filter alone', () => {
  test('stage', async ({ page }) => {
    await pick(page, 'Stage', /^Sent/)
    await expect.poll(() => shown(page)).toEqual(['Ada', 'Ben', 'Fay'])
  })

  test('flag', async ({ page }) => {
    await pick(page, 'Flag', /^Late/)
    await expect.poll(() => shown(page)).toEqual(['Cyd'])
  })

  test('role, and no role', async ({ page }) => {
    await pick(page, 'Role', /^Product engineer/)
    await expect.poll(() => shown(page)).toEqual(['Cyd', 'Eli'])
    await page.goto('/?view=all')
    await pick(page, 'Role', /^No role/)
    await expect.poll(() => shown(page)).toEqual(['Dev'])
  })

  test('source', async ({ page }) => {
    await pick(page, 'Source', /^Email/)
    await expect.poll(() => shown(page)).toEqual(['Ada', 'Eli'])
  })

  test('date', async ({ page }) => {
    await page.getByRole('button', { name: /^Date/ }).click()
    await page.getByLabel('From', { exact: true }).fill('2026-10-02')
    await page.getByLabel('To', { exact: true }).fill('2026-10-02')
    await page.keyboard.press('Escape')
    await expect.poll(() => shown(page)).toEqual(['Ada', 'Eli'])
  })

  test('search', async ({ page }) => {
    await page.getByPlaceholder('Name, role, email, handle').fill('product')
    await expect.poll(() => shown(page)).toEqual(['Cyd', 'Eli'])
  })
})

test.describe('filters combined', () => {
  test('two values in one dimension widen, two dimensions narrow', async ({ page }) => {
    await pick(page, 'Stage', /^Sent/)
    await pick(page, 'Stage', /^Advanced/)
    await expect.poll(() => shown(page)).toEqual(['Ada', 'Ben', 'Dev', 'Fay'])
    await pick(page, 'Source', /^iMessage/)
    await expect.poll(() => shown(page)).toEqual(['Fay'])
  })

  test('Needs you with a role', async ({ page }) => {
    await page.getByRole('radio', { name: /Needs you/ }).click()
    await pick(page, 'Role', /^Product engineer/)
    await expect.poll(() => shown(page)).toEqual(['Cyd'])
  })

  test('every dimension at once', async ({ page }) => {
    await pick(page, 'Stage', /^Sent/)
    await pick(page, 'Flag', /^Overdue/)
    await pick(page, 'Role', /^Founding engineer/)
    await pick(page, 'Source', /^Email/)
    await page.getByRole('button', { name: /^Date/ }).click()
    await page.getByRole('button', { name: 'Past 7 days' }).click()
    await page.keyboard.press('Escape')
    await page.getByPlaceholder('Name, role, email, handle').fill('ada')
    await expect.poll(() => shown(page)).toEqual(['Ada'])
    await expect(page.getByRole('button', { name: /^Clear/ })).toContainText('6')
  })

  test('each option counts the rows it would show with the other filters', async ({ page }) => {
    await pick(page, 'Source', /^Email/)
    await page.getByRole('button', { name: /^Stage/ }).click()
    await expect(page.getByRole('checkbox', { name: /^Sent/ })).toHaveAccessibleName(/1$/)
    await expect(page.getByRole('checkbox', { name: /^Reviewing/ })).toHaveAccessibleName(/1$/)
    await expect(page.getByRole('checkbox', { name: /^Advanced/ })).toHaveAccessibleName(/0$/)
  })

  test('filters stay after a reload', async ({ page }) => {
    await pick(page, 'Role', /^Product engineer/)
    await pick(page, 'Flag', /^Late/)
    await expect.poll(() => shown(page)).toEqual(['Cyd'])
    await page.reload()
    await expect.poll(() => shown(page)).toEqual(['Cyd'])
  })

  test('an empty result offers counted ways back', async ({ page }) => {
    await pick(page, 'Flag', /^Late/)
    await pick(page, 'Stage', /^Sent/)
    await expect(page.getByText('No candidates match')).toBeVisible()
    const anyStage = page.getByRole('button', { name: /^Any stage, not Sent/ })
    await expect(anyStage).toContainText('1')
    await anyStage.click()
    await expect.poll(() => shown(page)).toEqual(['Cyd'])
    await page.getByRole('button', { name: /^Clear/ }).click()
    await expect.poll(() => shown(page)).toEqual(['Ada', 'Ben', 'Cyd', 'Dev', 'Eli', 'Fay'])
  })
})
