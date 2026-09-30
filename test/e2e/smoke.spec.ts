import { expect, test } from './fixtures'

test('an empty tracker says it has no candidates', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Take-homes' })).toBeVisible()
  await expect(page.getByText('No candidates')).toBeVisible()
})
