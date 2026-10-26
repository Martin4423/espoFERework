import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { adminToken, signIn, stamp } from './support.ts'

// A rule left behind by a failed run would change records created by other tests, so always remove them.
test.afterEach(async ({ request }) => {
  const headers = { Authorization: `Bearer ${await adminToken(request)}` }
  const { items } = await (await request.get('/v1/workflows', { headers })).json()
  for (const rule of items.filter((item: { name: string }) => item.name.startsWith('Rule '))) await request.delete(`/v1/workflows/${rule.id}`, { headers })
})

// Step S8: the administration screens.
const openAdmin = async (page: Page) => {
  await signIn(page)
  await page.getByRole('button', { name: 'Administrace' }).click()
  await expect(page.getByTestId('admin-hub')).toBeVisible()
}
const tile = (page: Page, name: RegExp) => page.locator('.admin-tile', { hasText: name })

test('the hub offers the screens and marks the rest as not available', async ({ page }) => {
  await openAdmin(page)
  for (const name of [/Users/, /Teams/, /Roles/, /Entities and fields/, /Layouts/, /Workflows/, /CSV import/]) await expect(tile(page, name)).toBeVisible()
  await tile(page, /Portals and integrations/).click()
  await expect(page.getByTestId('not-available')).toBeVisible()
})

test('a user is created in the administration and appears in the list', async ({ page }) => {
  const tag = stamp()
  await openAdmin(page)
  await tile(page, /^Users/).click()
  await page.getByRole('button', { name: 'New user' }).first().click()
  const dialog = page.getByTestId('user-dialog')
  await dialog.locator('input').nth(1).fill(`Admin${tag}`)
  await dialog.locator('input[type="email"]').fill(`adm-${tag}@example.com`)
  await dialog.locator('input[type="password"]').fill('correct horse battery staple')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByTestId('admin-users')).toContainText(`adm-${tag}@example.com`)
})

test('a workflow is created, switched off and deleted', async ({ page }) => {
  const name = `Rule ${stamp()}`
  await openAdmin(page)
  await tile(page, /Workflows/).click()
  await page.getByRole('button', { name: 'New rule' }).click()
  const dialog = page.getByTestId('workflow-dialog')
  await dialog.getByLabel('Name', { exact: true }).fill(name)
  await dialog.getByLabel('Entity', { exact: true }).selectOption('product')
  await dialog.getByLabel('Field 1').selectOption('name')
  await dialog.getByLabel('Value 1').fill('Renamed')
  await dialog.getByRole('button', { name: 'Save' }).click()
  const row = page.locator('tr', { hasText: name })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Turn off' }).click()
  await expect(row).toContainText('Off')
  page.once('dialog', (confirm) => void confirm.accept())
  await row.getByRole('button', { name: 'Delete' }).click()
  await expect(row).toHaveCount(0)
})

test('a CSV file is checked and then imported', async ({ page, request }) => {
  const tag = stamp()
  await openAdmin(page)
  await tile(page, /CSV import/).click()
  await page.getByLabel('Entity', { exact: true }).selectOption('account')
  await page.getByTestId('csv-input').setInputFiles({ name: `acc-${tag}.csv`, mimeType: 'text/csv', buffer: Buffer.from(`name\nImp ${tag} A\n"Imp ${tag}, B"\n`) })
  await expect(page.getByLabel('Field for column name')).toHaveValue('name')
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page.getByTestId('import-result')).toContainText('created 2')
  await page.getByLabel('Only check, store nothing').uncheck()
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.getByTestId('import-result')).toContainText('created 2')
  const token = await adminToken(request)
  const found = await (await request.get(`/v1/records/account?q=Imp ${tag}`, { headers: { Authorization: `Bearer ${token}` } })).json()
  expect(found.items.length).toBe(2)
})

test('teams, roles, entities and layouts open without an error', async ({ page }) => {
  await openAdmin(page)
  for (const [name, id] of [[/^Teams/, 'admin-teams'], [/^Roles/, 'admin-roles'], [/Entities and fields/, 'admin-schema'], [/Layouts/, 'admin-layouts']] as const) {
    await tile(page, name).click()
    await expect(page.getByTestId(id)).toBeVisible()
    await expect(page.locator('.inline-error')).toHaveCount(0)
    await page.getByRole('button', { name: 'Administration' }).click()
  }
})
