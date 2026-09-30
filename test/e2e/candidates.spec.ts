import { addCandidate, expect, stageButton, test } from './fixtures'

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
  await expect(stageButton(page, 'Sent')).toHaveAttribute('aria-pressed', 'true')
  await detail.getByRole('button', { name: 'Close' }).click()
  await expect(page).not.toHaveURL(/[?&]c=/)

  await page.reload()
  const row = page.getByRole('button', { name: 'Rowan Okafor' })
  await expect(row).toBeVisible()
  await row.click()
  await expect(stageButton(page, 'Sent')).toHaveAttribute('aria-pressed', 'true')
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
  await expect(stageButton(page, 'Submitted')).toHaveAttribute('aria-pressed', 'true')

  const popup = page.waitForEvent('popup')
  await detail.getByRole('link', { name: 'priya-ledger.example.com' }).first().click()
  await (await popup).close()
  await expect(stageButton(page, 'Reviewing')).toHaveAttribute('aria-pressed', 'true')
  await expect(detail.getByText('Opened submission')).toBeVisible()
})

test('Advanced and Passed come only from her click, and a later link does not undo them', async ({
  page,
}) => {
  const detail = await addCandidate(page, { name: 'Diego Alvarez' })
  await stageButton(page, 'Advanced').click()
  await expect(stageButton(page, 'Advanced')).toHaveAttribute('aria-pressed', 'true')
  await expect(detail.getByText('Stage set to Advanced')).toBeVisible()

  await detail.getByRole('button', { name: 'Add link' }).click()
  await detail.getByLabel('Link', { exact: true }).fill('diego-fix.example.com')
  await detail.getByRole('button', { name: 'Add link' }).last().click()
  await expect(detail.getByRole('link', { name: 'diego-fix.example.com' }).first()).toBeVisible()
  await expect(stageButton(page, 'Advanced')).toHaveAttribute('aria-pressed', 'true')

  await stageButton(page, 'Passed').click()
  await expect(stageButton(page, 'Passed')).toHaveAttribute('aria-pressed', 'true')
  await stageButton(page, 'Sent').click()
  await expect(stageButton(page, 'Sent')).toHaveAttribute('aria-pressed', 'true')
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

test('a wrong link can be removed from the timeline, and the stage follows', async ({ page }) => {
  const detail = await addCandidate(page, { name: 'Omar Haddad' })
  await detail.getByRole('button', { name: 'Add link' }).click()
  await detail.getByLabel('Link', { exact: true }).fill('wrong-person.example.com')
  await detail.getByRole('button', { name: 'Add link' }).last().click()
  await expect(stageButton(page, 'Submitted')).toHaveAttribute('aria-pressed', 'true')

  const item = detail.getByRole('listitem').filter({ hasText: 'wrong-person.example.com' })
  await item.getByRole('button', { name: 'Remove' }).click()
  await item.getByRole('button', { name: 'Confirm remove' }).click()
  await expect(detail.getByText('wrong-person.example.com')).toHaveCount(0)
  await expect(stageButton(page, 'Sent')).toHaveAttribute('aria-pressed', 'true')
})

test('a link with its time cleared asks for the time instead of failing', async ({ page }) => {
  const detail = await addCandidate(page, { name: 'Tess Albright' })
  await detail.getByRole('button', { name: 'Add link' }).click()
  await detail.getByLabel('Link', { exact: true }).fill('tess.example.com')
  await detail.getByLabel('Time', { exact: true }).fill('')
  await detail.getByRole('button', { name: 'Add link' }).last().click()
  await expect(detail.getByText('Time needed')).toBeVisible()
  await expect(stageButton(page, 'Sent')).toHaveAttribute('aria-pressed', 'true')
})

test('arrow keys move along the stages without setting one', async ({ page }) => {
  await addCandidate(page, { name: 'Uma Reyes' })
  await stageButton(page, 'Sent').focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(stageButton(page, 'Advanced')).toBeFocused()
  await expect(stageButton(page, 'Sent')).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Enter')
  await expect(stageButton(page, 'Advanced')).toHaveAttribute('aria-pressed', 'true')
})

test('Tab stays inside the add dialog, and focus returns to Add when it closes', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'iphone', 'no Tab key on a phone')
  const add = page.getByRole('button', { name: 'Add', exact: true }).first()
  await add.click()
  const dialog = page.getByRole('dialog', { name: 'Add candidate' })
  for (let i = 0; i < 40; i++) await page.keyboard.press('Tab')
  await expect(dialog.locator(':focus')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(add).toBeFocused()
})
