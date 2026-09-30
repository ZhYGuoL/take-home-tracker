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
