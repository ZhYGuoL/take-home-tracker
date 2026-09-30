import { expect, rowOf, shownNames, stageButton, test } from './fixtures'
import { asked, openedAt, person, seed, staged, submitted } from './seed'

const LA = 'America/Los_Angeles'
const NY = 'America/New_York'
// Mon Oct 5 2026, 12:00 PDT.
const NOW = new Date('2026-10-05T19:00:00Z')

test.describe('Needs you', () => {
  const ada = person('Ada Lindqvist', { due: ['2026-10-02', '17:00', LA] })
  const ben = person('Ben Osei', { due: ['2026-10-09', '17:00', LA] })
  const cyd = person('Cyd Marsh', { due: ['2026-10-01', '17:00', LA] })
  const dev = person('Dev Patel')
  const eli = person('Eli Brandt', { due: ['2026-10-02', '23:00', LA] })
  const fay = person('Fay Nakamura', { due: ['2026-10-09', '17:00', LA] })
  const gus = person('Gus Ferreira', { due: ['2026-10-01', '17:00', LA] })
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
    gus,
    staged(gus, '2026-10-02T09:00:00Z', 'passed'),
  ]

  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: NOW })
    await seed(page, pipeline)
  })

  test('shows exactly overdue, needs reply, and submitted, most urgent first', async ({ page }) => {
    await expect(page.getByRole('radio', { name: /Needs you/ })).toBeChecked()
    await expect.poll(() => shownNames(page)).toEqual(['Ada Lindqvist', 'Ben Osei', 'Cyd Marsh'])
    await expect(page.getByRole('radio', { name: /Needs you/ })).toContainText('3')
    await expect(page.getByRole('radio', { name: /All/ })).toContainText('7')
    await expect(rowOf(page, 'Ada Lindqvist')).toContainText('Overdue')
    await expect(rowOf(page, 'Ben Osei')).toContainText('Needs reply')
    await expect(rowOf(page, 'Cyd Marsh')).toContainText('Late')
  })

  test('All shows every candidate, and a closed or reviewed one never shows as needing her', async ({
    page,
  }) => {
    await page.getByRole('radio', { name: /All/ }).click()
    await expect.poll(async () => (await shownNames(page)).length).toBe(7)
    await expect(rowOf(page, 'Gus Ferreira')).not.toContainText('Overdue')
    await expect(rowOf(page, 'Eli Brandt')).not.toContainText('Late')
  })

  test('replying and opening the submission take candidates out of Needs you', async ({ page }) => {
    await page.getByRole('button', { name: 'Ben Osei' }).click()
    await page.getByRole('button', { name: 'Replied' }).click()
    await page.getByRole('button', { name: 'Close' }).click()
    await expect.poll(() => shownNames(page)).toEqual(['Ada Lindqvist', 'Cyd Marsh'])

    await page.getByRole('button', { name: 'Cyd Marsh' }).click()
    const popup = page.waitForEvent('popup')
    await page
      .getByRole('dialog', { name: 'Cyd Marsh' })
      .getByRole('link', { name: `${cyd.id}.example.com` })
      .first()
      .click()
    await (await popup).close()
    await expect(stageButton(page, 'Reviewing')).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Close' }).click()
    await expect.poll(() => shownNames(page)).toEqual(['Ada Lindqvist'])
  })

  test('a question logged by hand turns on Needs reply', async ({ page }) => {
    await page.getByRole('radio', { name: /All/ }).click()
    await page.getByRole('button', { name: 'Fay Nakamura' }).click()
    const detail = page.getByRole('dialog', { name: 'Fay Nakamura' })
    await detail.getByRole('button', { name: 'Add message' }).click()
    await detail.getByLabel('Message', { exact: true }).fill('Is it fine to use Supabase auth?')
    await detail.getByRole('button', { name: 'Add message' }).last().click()
    await expect(detail.getByText('Needs reply', { exact: true })).toBeVisible()
    await expect(detail.getByText('Is it fine to use Supabase auth?')).toBeVisible()
  })
})

test.describe('the deadline boundary', () => {
  // The deadline is 3:01 PM in New York, one minute after NOW.
  const due = new Date(NOW.getTime() + 60_000)
  const hana = person('Hana Kim', { due: ['2026-10-05', '15:01', NY] })

  test('Overdue is off at the deadline instant and on one millisecond after', async ({ page }) => {
    expect(hana.deadline?.at).toBe(due.toISOString())
    await page.clock.install({ time: NOW })
    await seed(page, [hana])
    await page.getByRole('radio', { name: /All/ }).click()
    await expect(rowOf(page, 'Hana Kim')).not.toContainText('Overdue')

    await page.clock.pauseAt(due)
    await expect(rowOf(page, 'Hana Kim')).not.toContainText('Overdue')

    await page.clock.runFor(1)
    await expect(rowOf(page, 'Hana Kim')).toContainText('Overdue')
    await page.getByRole('radio', { name: /Needs you/ }).click()
    await expect.poll(() => shownNames(page)).toEqual(['Hana Kim'])
  })

  test('a submission exactly at the deadline is on time, one second later is Late', async ({
    page,
  }) => {
    const onTime = person('Ines Duarte', { due: ['2026-10-02', '17:00', NY] })
    const late = person('Jon Okoro', { due: ['2026-10-02', '17:00', NY] })
    await page.clock.install({ time: NOW })
    await seed(page, [
      onTime,
      submitted(onTime, '2026-10-02T21:00:00.000Z'),
      late,
      submitted(late, '2026-10-02T21:00:01.000Z'),
    ])
    await page.getByRole('radio', { name: /All/ }).click()
    await expect(rowOf(page, 'Ines Duarte')).not.toContainText('Late')
    await expect(rowOf(page, 'Jon Okoro')).toContainText('Late')
  })
})

for (const [zone, shown] of [
  ['America/Los_Angeles', 'Fri, Oct 2, 2:00 PM PDT'],
  ['Asia/Tokyo', 'Sat, Oct 3, 6:00 AM GMT+9'],
] as const) {
  test.describe(`a viewer in ${zone}`, () => {
    test.use({ timezoneId: zone })

    test('sees the same flags, with the deadline in her own zone', async ({ page }) => {
      const kai = person('Kai Moreno', { due: ['2026-10-02', '17:00', NY] })
      await page.clock.install({ time: NOW })
      // 2:30 PM in Los Angeles is 5:30 PM in New York: 30 minutes late.
      await seed(page, [kai, submitted(kai, '2026-10-02T14:30:00-07:00')])
      await expect(rowOf(page, 'Kai Moreno')).toContainText('Late')
      await page.getByRole('button', { name: 'Kai Moreno' }).click()
      const detail = page.getByRole('dialog', { name: 'Kai Moreno' })
      await expect(detail).toContainText(shown)
      await expect(detail).toContainText('Fri, Oct 2, 5:00 PM EDT')
    })
  })
}

test.describe('replies logged by hand', () => {
  test('a question and her answer in the same minute leave nothing waiting', async ({ page }) => {
    const pia = person('Pia Laurent', { due: ['2026-10-09', '17:00', LA] })
    await page.clock.install({ time: NOW })
    await seed(page, [pia])
    await page.getByRole('radio', { name: /All/ }).click()
    await page.getByRole('button', { name: 'Pia Laurent' }).click()
    const detail = page.getByRole('dialog', { name: 'Pia Laurent' })
    await detail.getByRole('button', { name: 'Add message' }).click()
    await detail.getByLabel('Message', { exact: true }).fill('Can I use Postgres?')
    await detail.getByRole('button', { name: 'Add message' }).last().click()
    await expect(detail.getByText('Needs reply', { exact: true })).toBeVisible()
    await detail.getByRole('button', { name: 'Add message' }).click()
    await detail.getByLabel('From').selectOption('out')
    await detail.getByLabel('Message', { exact: true }).fill('Yes, Postgres is fine.')
    await detail.getByRole('button', { name: 'Add message' }).last().click()
    await expect(detail.getByText('Needs reply', { exact: true })).toHaveCount(0)
  })

  test('Replied clears a question she dated later than now by mistake', async ({ page }) => {
    const quinn = person('Quinn Adler', { due: ['2026-10-09', '17:00', LA] })
    await page.clock.install({ time: NOW })
    await seed(page, [quinn, asked(quinn, '2026-10-05T22:00:00Z')])
    await page.getByRole('button', { name: 'Quinn Adler' }).click()
    const detail = page.getByRole('dialog', { name: 'Quinn Adler' })
    await detail.getByRole('button', { name: 'Replied' }).click()
    await expect(detail.getByText('Needs reply', { exact: true })).toHaveCount(0)
    await expect(detail.getByRole('button', { name: 'Replied' })).toHaveCount(0)
  })
})
