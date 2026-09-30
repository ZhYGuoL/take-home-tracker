import { addCandidate, expect, test } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('a candidate added by hand shows in the list at Sent and survives a reload', async ({
  page,
}) => {
  await addCandidate(page, {
    name: 'Rowan Okafor',
    role: 'Founding engineer',
    contact: 'rowan@example.com',
    preset: '48h',
  })
  await expect(page).not.toHaveURL(/[?&]new=/)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Rowan Okafor' })).toBeVisible()
  await expect(page.getByText('Founding engineer')).toBeVisible()
  await expect(page.getByText('Sent', { exact: true })).toBeVisible()
})

test('a submission link at add time makes the candidate Submitted', async ({ page }) => {
  await addCandidate(page, { name: 'Priya Raman', submission: 'priya-ledger.example.com' })
  await expect(page.getByText('Submitted', { exact: true })).toBeVisible()
})

test('a name is required', async ({ page }) => {
  await page.getByRole('button', { name: 'Add', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add candidate' })
  await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(dialog.getByText('Required')).toBeVisible()
})
