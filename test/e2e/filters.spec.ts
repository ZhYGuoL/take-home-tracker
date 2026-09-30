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

  test('each flag on its own', async ({ page }) => {
    await page.goto('/?view=all&flag=overdue')
    await expect.poll(() => shown(page)).toEqual(['Ada'])
    await page.goto('/?view=all&flag=needsReply')
    await expect.poll(() => shown(page)).toEqual(['Ben'])
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

  test('each date field', async ({ page }) => {
    await page.getByRole('button', { name: /^Date/ }).click()
    await page.getByLabel('Field').selectOption('submitted')
    await page.getByLabel('From', { exact: true }).fill('2026-10-01')
    await page.getByLabel('To', { exact: true }).fill('2026-10-02')
    await page.keyboard.press('Escape')
    await expect.poll(() => shown(page)).toEqual(['Cyd', 'Eli'])
    await page.goto('/?view=all&date=activity:2026-10-04:2026-10-05')
    await expect.poll(() => shown(page)).toEqual(['Ben'])
    await page.goto('/?view=all&date=sent:2026-09-28:2026-09-28')
    await expect.poll(() => shown(page)).toEqual(['Ada', 'Ben', 'Cyd', 'Dev', 'Eli', 'Fay'])
    await page.goto('/?view=all&date=sent:2026-09-29:')
    await expect.poll(() => shown(page)).toEqual([])
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

test.describe('the filter popover', () => {
  test('Escape closes it and puts focus back on its chip', async ({ page }) => {
    const chip = page.getByRole('button', { name: /^Stage/ })
    await chip.click()
    await page.getByRole('checkbox', { name: /^Sent/ }).focus()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('checkbox', { name: /^Sent/ })).toHaveCount(0)
    await expect(chip).toBeFocused()
  })

  test('a tap outside closes it without opening the row behind', async ({ page }) => {
    await page.getByRole('button', { name: /^Flag/ }).click()
    await expect(page.getByRole('checkbox', { name: /^Late/ })).toBeVisible()
    await page.mouse.click(10, 400)
    await expect(page.getByRole('checkbox', { name: /^Late/ })).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('choosing a date field alone filters nothing', async ({ page }) => {
    await page.getByRole('button', { name: /^Date/ }).click()
    await page.getByLabel('Field').selectOption('submitted')
    await page.keyboard.press('Escape')
    await expect.poll(() => shown(page)).toEqual(['Ada', 'Ben', 'Cyd', 'Dev', 'Eli', 'Fay'])
    await expect(page.getByRole('button', { name: /^Date/ })).not.toContainText('1')
  })
})

test.describe('a viewer in New York', () => {
  test.use({ timezoneId: 'America/New_York' })

  test('a date range reads days in her own zone', async ({ page }) => {
    // Eli's deadline is 11 PM Oct 2 in Los Angeles, which is Oct 3 in New York.
    await page.goto('/?view=all&date=deadline:2026-10-03:2026-10-03')
    await expect.poll(() => shown(page)).toEqual(['Eli'])
  })
})

test('with nothing needing her, the way back names the view it loosens', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('Name, role, email, handle').fill('fay')
  await expect(page.getByText('No candidates match')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Any view, not Needs you/ })).toContainText('1')
  await expect(page.getByRole('button', { name: /^Any text, not "fay"/ })).toContainText('3')
})

test('a count reads as its own word next to its option', async ({ page }) => {
  await seed(page, [person('Count Carla')])
  await page.getByRole('radio', { name: /All/ }).click()
  await page.getByRole('button', { name: /^Stage/ }).click()
  await expect(page.getByRole('checkbox', { name: 'Sent 1', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('searchbox', { name: 'Search' }).fill('zzz')
  await expect(
    page.getByRole('button', { name: 'Any text, not "zzz" 1', exact: true }),
  ).toBeVisible()
})
