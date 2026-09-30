import { expect, rowOf, test } from './fixtures'
import { person, seed, submitted } from './seed'

const LA = 'America/Los_Angeles'
const NY = 'America/New_York'
// Mon Oct 5 2026, 12:00 PDT.
const NOW = new Date('2026-10-05T19:00:00Z')

test('a question logged by hand turns on Needs reply', async ({ page }) => {
  const fay = person('Fay Nakamura', { due: ['2026-10-09', '17:00', LA] })
  await page.clock.install({ time: NOW })
  await seed(page, [fay])
  await page.getByRole('button', { name: 'Fay Nakamura' }).click()
  const detail = page.getByRole('dialog', { name: 'Fay Nakamura' })
  await detail.getByRole('button', { name: 'Add message' }).click()
  await detail.getByLabel('Message', { exact: true }).fill('Is it fine to use Supabase auth?')
  await detail.getByRole('button', { name: 'Add message' }).last().click()
  await expect(detail.getByText('Needs reply', { exact: true })).toBeVisible()
  await expect(detail.getByText('Is it fine to use Supabase auth?')).toBeVisible()
})

test.describe('the deadline boundary', () => {
  // The deadline is 3:01 PM in New York, one minute after NOW.
  const due = new Date(NOW.getTime() + 60_000)
  const hana = person('Hana Kim', { due: ['2026-10-05', '15:01', NY] })

  test('Overdue is off at the deadline instant and on one millisecond after', async ({ page }) => {
    expect(hana.deadline?.at).toBe(due.toISOString())
    await page.clock.install({ time: NOW })
    await seed(page, [hana])
    await expect(rowOf(page, 'Hana Kim')).not.toContainText('Overdue')

    await page.clock.pauseAt(due)
    await expect(rowOf(page, 'Hana Kim')).not.toContainText('Overdue')

    await page.clock.runFor(1)
    await expect(rowOf(page, 'Hana Kim')).toContainText('Overdue')
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
