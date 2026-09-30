import { expect, test } from '@playwright/test'

test('an empty tracker says it has no candidates', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Take-homes 0' })).toBeVisible()
  await expect(page.getByText('No candidates')).toBeVisible()
})
