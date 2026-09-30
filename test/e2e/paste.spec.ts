import type { Page } from '@playwright/test'
import { expect, rowOf, stageButton, test } from './fixtures'
import { person, seed } from './seed'

const NOW = new Date('2026-09-30T20:00:00Z') // Wed Sep 30, 1:00 PM PDT

const firstEmail = `From: Priya Raman <priya.raman@example.com>
Date: Wed, Sep 30, 2026 at 11:42 AM
Subject: Take-home submission

Hi Rae, here is my take-home for the Founding Engineer role:
Live app: https://ledgerline-priya.netlify.app
Code: https://github.com/ex-praman/ledgerline

Best,
Priya`

const followUp = `From: Priya Raman <priya.raman@example.com>
Date: Wed, Sep 30, 2026 at 12:30 PM
Subject: Re: Take-home submission

Quick follow-up: should I also add tests for the importer?`

async function paste(page: Page, text: string) {
  await page.getByRole('button', { name: 'Add', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add candidate' })
  await dialog.getByLabel('Message').fill(text)
  await dialog.getByRole('button', { name: 'Read' }).click()
  return dialog
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: NOW })
})

test('a pasted submission proposes name, links, and date, and she can correct them', async ({
  page,
}) => {
  await seed(page, [])
  const dialog = await paste(page, firstEmail)
  await expect(dialog.getByLabel('Attach to')).toHaveValue('new')
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Priya Raman')
  await expect(dialog.getByLabel('Role')).toHaveValue('Founding engineer')
  await expect(dialog.getByLabel('Contact')).toHaveValue('priya.raman@example.com')
  await expect(dialog.getByLabel('Sent at')).toHaveValue('2026-09-30')
  await expect(dialog.getByLabel('Time', { exact: true }).last()).toHaveValue('11:42')
  const links = dialog.getByLabel('Link', { exact: true })
  await expect(links.nth(0)).toHaveValue('https://ledgerline-priya.netlify.app/')
  await expect(links.nth(1)).toHaveValue('https://github.com/ex-praman/ledgerline')

  // She corrects the name and the time before saving.
  await dialog.getByLabel('Name', { exact: true }).fill('Priya R. Raman')
  await dialog.getByLabel('Time', { exact: true }).last().fill('11:45')
  await dialog.getByRole('button', { name: 'Save' }).click()

  const detail = page.getByRole('dialog', { name: 'Priya R. Raman' })
  await expect(detail).toBeVisible()
  await expect(stageButton(page, 'Submitted')).toHaveAttribute('aria-pressed', 'true')
  await expect(detail).toContainText('Wed, Sep 30, 11:45 AM PDT')
  await expect(
    detail.getByRole('link', { name: 'ledgerline-priya.netlify.app' }).first(),
  ).toBeVisible()
  await expect(
    detail.getByRole('link', { name: 'github.com/ex-praman/ledgerline' }).first(),
  ).toBeVisible()
})

test('a second paste from the same candidate attaches to her', async ({ page }) => {
  await seed(page, [])
  let dialog = await paste(page, firstEmail)
  await dialog.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('button', { name: 'Close' }).click()

  dialog = await paste(page, followUp)
  await expect(dialog.getByLabel('Attach to')).toHaveValue(/.+/)
  await expect(dialog.getByLabel('Attach to').locator('option:checked')).toHaveText('Priya Raman')
  await expect(dialog.getByRole('status', { name: 'Matched on' })).toHaveText(
    'priya.raman@example.com',
  )
  await expect(dialog.getByLabel('Needs reply')).toBeChecked()
  await dialog.getByRole('button', { name: 'Save' }).click()

  const detail = page.getByRole('dialog', { name: 'Priya Raman' })
  await expect(detail.getByText('should I also add tests for the importer?')).toBeVisible()
  await expect(detail.getByText('Needs reply', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('radio', { name: /All/ }).click()
  await expect(rowOf(page, 'Priya Raman')).toHaveCount(1)
})

test('a wrong match is fixed in one step before saving', async ({ page }) => {
  const priya = person('Priya Raman', { contacts: ['priya.raman@example.com'] })
  const pia = person('Pia Laurent')
  await seed(page, [priya, pia])
  const dialog = await paste(page, followUp)
  await expect(dialog.getByLabel('Attach to').locator('option:checked')).toHaveText('Priya Raman')
  await dialog.getByLabel('Attach to').selectOption({ label: 'Pia Laurent' })
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog', { name: 'Pia Laurent' })).toContainText('importer')
})

test('her own message sending the take-home adds a candidate at Sent with the deadline', async ({
  page,
}) => {
  await seed(page, [])
  const dialog = await paste(
    page,
    `Hi Nadia, thanks for chatting today! Here is the take-home assignment: https://docs.google.com/document/d/1NadiaEx/edit
Please submit by Friday 5pm ET.`,
  )
  await expect(dialog.getByLabel('From')).toHaveValue('out')
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Nadia')
  await expect(dialog.getByLabel('Take-home link')).toHaveValue(
    'https://docs.google.com/document/d/1NadiaEx/edit',
  )
  await expect(dialog.getByLabel('Deadline zone')).toHaveValue('America/New_York')
  await dialog.getByRole('button', { name: 'Save' }).click()
  const detail = page.getByRole('dialog', { name: 'Nadia' })
  await expect(stageButton(page, 'Sent')).toHaveAttribute('aria-pressed', 'true')
  await expect(detail).toContainText('Fri, Oct 2, 2:00 PM PDT')
  await expect(detail).toContainText('Fri, Oct 2, 5:00 PM EDT')
})

test('pasting into the empty box reads it at once', async ({ page }) => {
  await seed(page, [])
  await page.getByRole('button', { name: 'Add', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add candidate' })
  await dialog.getByLabel('Message').evaluate((el, text) => {
    const data = new DataTransfer()
    data.setData('text/plain', text)
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    )
  }, firstEmail)
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Priya Raman')
})

test('a message saved to the wrong candidate moves to the right one in one step', async ({
  page,
}) => {
  const priya = person('Priya Raman', { contacts: ['priya.raman@example.com'] })
  const pia = person('Pia Laurent')
  await seed(page, [priya, pia])
  const dialog = await paste(page, firstEmail)
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(stageButton(page, 'Submitted')).toHaveAttribute('aria-pressed', 'true')

  const detail = page.getByRole('dialog', { name: 'Priya Raman' })
  const item = detail.getByRole('listitem').filter({ hasText: 'ledgerline-priya' })
  await item.getByRole('button', { name: 'Move', exact: true }).click()
  await item.getByRole('combobox', { name: 'Move to' }).selectOption({ label: 'Pia Laurent' })
  await expect(stageButton(page, 'Sent')).toHaveAttribute('aria-pressed', 'true')
  await expect(detail.getByText('ledgerline-priya')).toHaveCount(0)

  await page.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('radio', { name: /All/ }).click()
  await page.getByRole('button', { name: 'Pia Laurent' }).click()
  await expect(stageButton(page, 'Submitted')).toHaveAttribute('aria-pressed', 'true')
})

test('sending the same take-home doc to a second candidate does not attach to the first', async ({
  page,
}) => {
  await seed(page, [])
  const doc = 'https://docs.google.com/document/d/1SharedBrief/edit'
  let dialog = await paste(
    page,
    `Hi Nadia, here is the take-home assignment: ${doc}\nYou'll have 48 hours.`,
  )
  await dialog.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('button', { name: 'Close' }).click()
  dialog = await paste(
    page,
    `Hi Omar, here is the take-home assignment: ${doc}\nYou'll have 48 hours.`,
  )
  await expect(dialog.getByLabel('Attach to')).toHaveValue('new')
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Omar')
})

test('a pasted submission with no time asks for the time before saving', async ({ page }) => {
  await seed(page, [])
  const dialog = await paste(
    page,
    `hey Rae! done: https://tidepool-ex.vercel.app\nrepo github.com/ex-mkoval/tidepool`,
  )
  await dialog.getByLabel('Name', { exact: true }).fill('Mara Koval')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByText('Time needed')).toBeVisible()
  await dialog.getByLabel('Time', { exact: true }).last().fill('09:30')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog', { name: 'Mara Koval' })).toContainText(
    'Wed, Sep 30, 9:30 AM PDT',
  )
})
