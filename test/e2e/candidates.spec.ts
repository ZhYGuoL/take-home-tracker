import { addCandidate, expect, stageRadio, test } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('a candidate added by hand shows in the list at Sent and survives a reload', async ({
  page,
}) => {
  const detail = await addCandidate(page, {
    name: 'Rowan Okafor',
    role: 'Founding engineer',
    contact: 'rowan@example.com',
    preset: '48h',
  })
  await expect(stageRadio(page, 'Sent')).toBeChecked()
  await detail.getByRole('button', { name: 'Close' }).click()
  await expect(page).not.toHaveURL(/[?&]c=/)

  await page.reload()
  const row = page.getByRole('button', { name: 'Rowan Okafor' })
  await expect(row).toBeVisible()
  await row.click()
  await expect(stageRadio(page, 'Sent')).toBeChecked()
  await expect(page.getByRole('dialog', { name: 'Rowan Okafor' })).toContainText(
    'Founding engineer',
  )
})

test('a submission link moves Sent to Submitted, and opening it moves to Reviewing', async ({
  page,
}) => {
  const detail = await addCandidate(page, {
    name: 'Priya Raman',
    submission: 'priya-ledger.example.com',
  })
  await expect(stageRadio(page, 'Submitted')).toBeChecked()

  const popup = page.waitForEvent('popup')
  await detail.getByRole('link', { name: 'priya-ledger.example.com' }).first().click()
  await (await popup).close()
  await expect(stageRadio(page, 'Reviewing')).toBeChecked()
  await expect(detail.getByText('Opened submission')).toBeVisible()
})

test('Advanced and Passed come only from her click, and a later link does not undo them', async ({
  page,
}) => {
  const detail = await addCandidate(page, { name: 'Diego Alvarez' })
  await stageRadio(page, 'Advanced').click()
  await expect(stageRadio(page, 'Advanced')).toBeChecked()
  await expect(detail.getByText('Stage set to Advanced')).toBeVisible()

  await detail.getByRole('button', { name: 'Add link' }).click()
  await detail.getByLabel('Link', { exact: true }).fill('diego-fix.example.com')
  await detail.getByRole('button', { name: 'Add link' }).last().click()
  await expect(detail.getByRole('link', { name: 'diego-fix.example.com' }).first()).toBeVisible()
  await expect(stageRadio(page, 'Advanced')).toBeChecked()

  await stageRadio(page, 'Passed').click()
  await expect(stageRadio(page, 'Passed')).toBeChecked()
  await stageRadio(page, 'Sent').click()
  await expect(stageRadio(page, 'Sent')).toBeChecked()
})

test('editing a candidate changes the list', async ({ page }) => {
  const detail = await addCandidate(page, { name: 'Mei Tanaka', role: 'Backend engineer' })
  await detail.getByRole('button', { name: 'Edit' }).click()
  const edit = page.getByRole('dialog', { name: 'Mei Tanaka' })
  await edit.getByLabel('Name', { exact: true }).fill('Mei Tanaka-Ruiz')
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog', { name: 'Mei Tanaka' })).toContainText('Mei Tanaka-Ruiz')
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('button', { name: 'Mei Tanaka-Ruiz' })).toBeVisible()
})

test('a name is required', async ({ page }) => {
  await page.getByRole('button', { name: 'Add', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add candidate' })
  await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(dialog.getByText('Required')).toBeVisible()
})

test('deleting takes two clicks and removes the candidate', async ({ page }) => {
  const detail = await addCandidate(page, { name: 'Sam Whitfield' })
  await detail.getByRole('button', { name: 'Delete', exact: true }).click()
  await detail.getByRole('button', { name: 'Delete Sam Whitfield' }).click()
  await expect(page.getByText('No candidates')).toBeVisible()
  // The panel closes once the delete is saved.
  await expect(page).not.toHaveURL(/[?&]c=/)
  await page.reload()
  await expect(page.getByText('No candidates')).toBeVisible()
})

test('the back gesture closes the detail panel', async ({ page }) => {
  await addCandidate(page, { name: 'Ana Costa' })
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page).not.toHaveURL(/[?&]c=/)
  await page.getByRole('button', { name: 'Ana Costa' }).click()
  await expect(page.getByRole('dialog', { name: 'Ana Costa' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('dialog', { name: 'Ana Costa' })).toBeHidden()
})

test('opening a second candidate from the list needs one close, not two', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'iphone', 'on a phone the panel covers the list')
  await addCandidate(page, { name: 'Ana Costa' })
  await page.getByRole('button', { name: 'Close' }).click()
  await addCandidate(page, { name: 'Bo Lindgren' })
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page).not.toHaveURL(/[?&]c=/)
  await page.getByRole('button', { name: 'Ana Costa' }).click()
  await page.getByRole('button', { name: 'Bo Lindgren' }).click()
  await expect(page.getByRole('dialog', { name: 'Bo Lindgren' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('a note survives closing the panel with Escape or the back gesture', async ({ page }) => {
  const detail = await addCandidate(page, { name: 'Lena Fischer' })
  await detail.getByLabel('Notes').fill('Strong on infra, ask about queues')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Lena Fischer' }).click()
  await expect(page.getByLabel('Notes')).toHaveValue('Strong on infra, ask about queues')

  await page.getByLabel('Notes').fill('Second thought')
  await page.goBack()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: 'Lena Fischer' }).click()
  await expect(page.getByLabel('Notes')).toHaveValue('Second thought')
})

test('after a preset, changing the deadline zone keeps the same instant', async ({ page }) => {
  await page.getByRole('button', { name: 'Add', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add candidate' })
  await dialog.getByLabel('Sent', { exact: true }).fill('2026-10-01')
  await dialog.getByLabel('Time', { exact: true }).first().fill('09:00')
  await dialog.getByRole('button', { name: '48h' }).click()
  const readout = dialog.getByRole('status', { name: 'Deadline in your time zone' })
  await expect(readout).toHaveText('Sat, Oct 3, 9:00 AM PDT')
  await dialog.getByLabel('Deadline zone').selectOption('America/New_York')
  await expect(readout).toHaveText('Sat, Oct 3, 9:00 AM PDT')
  await expect(dialog.getByLabel('Deadline', { exact: true })).toHaveValue('2026-10-03')
})
