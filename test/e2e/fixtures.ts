import { test as base, expect, type Page } from '@playwright/test'

/** Every page stays offline: links to candidate sites get an empty page instead of the network. */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }),
    )
    await use(context)
  },
})

export { expect }

export interface NewCandidate {
  name: string
  role?: string
  contact?: string
  submission?: string
  preset?: '24h' | '48h' | '72h' | '7d'
}

export async function addCandidate(page: Page, c: NewCandidate) {
  await page.getByRole('button', { name: 'Add', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add candidate' })
  await dialog.getByLabel('Name', { exact: true }).fill(c.name)
  if (c.role) await dialog.getByLabel('Role', { exact: true }).fill(c.role)
  if (c.contact) await dialog.getByLabel('Contact', { exact: true }).fill(c.contact)
  if (c.preset) await dialog.getByRole('button', { name: c.preset, exact: true }).click()
  if (c.submission) await dialog.getByLabel('Submission link', { exact: true }).fill(c.submission)
  await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(dialog).toBeHidden()
  // The new candidate opens in its detail panel.
  return page.getByRole('dialog', { name: c.name })
}

export function stageRadio(page: Page, name: string) {
  return page.getByRole('radiogroup', { name: 'Stage' }).getByRole('radio', { name, exact: true })
}
