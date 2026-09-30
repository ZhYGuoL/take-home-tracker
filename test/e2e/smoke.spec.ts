import { expect, test } from './fixtures'

test('an empty tracker says it has no candidates', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Take-homes' })).toBeVisible()
  await expect(page.getByText('No candidates')).toBeVisible()
})

test('the app has an icon and a name for the home screen', async ({ page }) => {
  const manifest = await page.request.get('/manifest.webmanifest')
  expect(manifest.ok()).toBe(true)
  expect(await manifest.json()).toMatchObject({ name: 'Take-homes', start_url: '/' })
  for (const icon of ['/icon.svg', '/icon-180.png', '/icon-192.png', '/icon-512.png']) {
    const res = await page.request.get(icon)
    expect(res.ok()).toBe(true)
    expect(res.headers()['content-type']).toMatch(/^image\//)
  }
  await page.goto('/')
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    '/icon-180.png',
  )
})
