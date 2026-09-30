import type { Page } from '@playwright/test'
import { expect, shownNames, test } from './fixtures'
import { asked, openedAt, person, seed, submitted } from './seed'

const LA = 'America/Los_Angeles'
const NOW = new Date('2026-10-05T19:00:00Z')

// The target passes every filter. Each decoy fails exactly one, so leaving that one
// filter out must bring its decoy back.
const base = {
  source: 'email' as const,
  sentAt: '2026-09-28T16:00:00.000Z',
  due: ['2026-10-09', '17:00', LA] as [string, string, string],
}
const target = person('Tara Quinn', base)
const decoys = {
  stage: person('Tara Stage', base),
  flag: person('Tara Flag', base),
  role: person('Tara Role', { ...base, role: 'Product engineer' }),
  source: person('Tara Source', { ...base, source: 'x' }),
  date: person('Tara Date', { ...base, sentAt: '2026-09-20T16:00:00.000Z' }),
  q: person('Uma Search', base),
}
const records = [
  target,
  asked(target, '2026-10-04T10:00:00Z'),
  ...Object.values(decoys),
  // Every decoy asks a question, except the one that fails on the flag.
  ...[decoys.stage, decoys.role, decoys.source, decoys.date, decoys.q].map((c) =>
    asked(c, '2026-10-04T10:00:00Z'),
  ),
  // The stage decoy is Reviewing instead of Sent.
  submitted(decoys.stage, '2026-10-03T10:00:00Z'),
  openedAt(decoys.stage, '2026-10-03T11:00:00Z'),
  asked(decoys.stage, '2026-10-04T11:00:00Z'),
]

const query: Record<string, string> = {
  stage: 'stage=sent',
  flag: 'flag=needsReply',
  role: 'role=Founding%20engineer',
  source: 'source=email',
  date: 'date=sent:2026-09-27:2026-09-29',
  q: 'q=tara',
}

const shown = async (page: Page) => (await shownNames(page)).sort()

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: NOW })
  await seed(page, records)
})

test('every filter set through the bar leaves only the target', async ({ page }) => {
  await page.getByRole('radio', { name: /All/ }).click()
  const pick = async (chip: string, option: RegExp) => {
    await page.getByRole('button', { name: new RegExp(`^${chip}`) }).click()
    await page.getByRole('checkbox', { name: option }).check()
    await page.keyboard.press('Escape')
  }
  await pick('Stage', /^Sent/)
  await pick('Flag', /^Needs reply/)
  await pick('Role', /^Founding engineer/)
  await pick('Source', /^Email/)
  await page.getByRole('button', { name: /^Date/ }).click()
  await page.getByLabel('Field').selectOption('sent')
  await page.getByLabel('From', { exact: true }).fill('2026-09-27')
  await page.getByLabel('To', { exact: true }).fill('2026-09-29')
  await page.keyboard.press('Escape')
  await page.getByPlaceholder('Name, role, email, handle').fill('tara')
  await expect.poll(() => shown(page)).toEqual(['Tara Quinn'])
})

for (const left of Object.keys(query)) {
  test(`leaving out ${left} brings back only its decoy`, async ({ page }) => {
    const qs = Object.entries(query)
      .filter(([k]) => k !== left)
      .map(([, v]) => v)
      .join('&')
    await page.goto(`/?view=all&${qs}`)
    const decoy = decoys[left as keyof typeof decoys]
    await expect.poll(() => shown(page)).toEqual(['Tara Quinn', decoy.name].sort())
  })
}
