import { expect, test } from '@playwright/test'
import { adminToken, createRecord, listReady, openEntity, openList, rows, search, signIn, stamp } from './support.ts'

// Step S5: filters, mass actions, related records.
async function seedAccounts(request: Parameters<typeof createRecord>[0], token: string, tag: string, names: Array<[string, Record<string, unknown>?]>) {
  for (const [suffix, extra] of names) await createRecord(request, token, 'account', { name: `${tag} ${suffix}`, ...extra })
}

test('a filter condition narrows the list and clearing it brings everything back', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  await seedAccounts(request, token, tag, [['alpha', { industry: 'Finance' }], ['beta', { industry: 'Retail' }], ['gamma', { industry: 'Finance' }]])
  await signIn(page)
  await openList(page, 'Accounts')
  await search(page, tag)
  await expect(rows(page)).toHaveCount(3)

  await page.getByRole('button', { name: 'Filtry', exact: true }).click()
  await page.getByRole('button', { name: 'Přidat podmínku' }).click()
  await page.getByLabel('Pole filtru').first().selectOption('name')
  await page.getByLabel('Operátor filtru').first().selectOption('endsWith')
  await page.getByLabel('Hodnota filtru').first().fill('mma')
  await page.getByRole('button', { name: 'Použít filtry' }).click()

  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText(`${tag} gamma`)
  await page.getByRole('button', { name: 'Vymazat filtry' }).click()   // clears the search text as well
  await expect(rows(page)).toHaveCount(20)
})

test('an enum filter with several values', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  await seedAccounts(request, token, tag, [['a', { industry: 'Finance' }], ['b', { industry: 'Retail' }], ['c', { industry: 'Education' }]])
  await signIn(page)
  await openList(page, 'Accounts')
  await search(page, tag)
  await expect(rows(page)).toHaveCount(3)

  await page.getByRole('button', { name: 'Filtry', exact: true }).click()
  await page.getByRole('button', { name: 'Přidat podmínku' }).click()
  await page.getByLabel('Pole filtru').first().selectOption('industry')
  await page.getByLabel('Operátor filtru').first().selectOption('anyOf')
  await page.getByLabel('Hodnoty filtru').first().selectOption(['Finance', 'Education'])
  await page.getByRole('button', { name: 'Použít filtry' }).click()

  await expect(rows(page)).toHaveCount(2)
})

test('selected records are deleted in one go', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  await seedAccounts(request, token, tag, [['one'], ['two'], ['three']])
  await signIn(page)
  await openList(page, 'Accounts')
  await search(page, tag)
  await expect(rows(page)).toHaveCount(3)

  await rows(page).nth(0).locator('input[type=checkbox]').check()
  await rows(page).nth(1).locator('input[type=checkbox]').check()
  await page.getByRole('button', { name: 'Smazat', exact: true }).click()
  await page.getByRole('button', { name: 'Smazat záznamy' }).click()

  await expect(rows(page)).toHaveCount(1)
  const left = await (await request.get(`/v1/records/account?q=${tag}`, { headers: { Authorization: `Bearer ${token}` } })).json()
  expect(left.items).toHaveLength(1)
})

test('mass edit changes one field of the selected records', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  await seedAccounts(request, token, tag, [['x', { billingCity: 'Brno' }], ['y', { billingCity: 'Brno' }], ['z', { billingCity: 'Brno' }]])
  await signIn(page)
  await openList(page, 'Accounts')
  await search(page, tag)
  await expect(rows(page)).toHaveCount(3)

  await rows(page).nth(0).locator('input[type=checkbox]').check()
  await rows(page).nth(1).locator('input[type=checkbox]').check()
  await page.getByRole('button', { name: 'Hromadně upravit' }).click()
  const dialog = page.locator('.modal-backdrop:visible').last()
  await dialog.locator('select').first().selectOption({ label: 'Billing city' })
  await dialog.locator('input[type=text]:visible').first().fill('Praha')
  await dialog.getByRole('button', { name: 'Použít změnu' }).click()

  await expect(dialog).toHaveCount(0)
  const items = (await (await request.get(`/v1/records/account?q=${tag}&sort=createdAt`, { headers: { Authorization: `Bearer ${token}` } })).json()).items
  expect(items.map((item: { billingCity: string }) => item.billingCity).sort()).toEqual(['Brno', 'Praha', 'Praha'])
})

test('related records are listed on the parent and created with the link already set', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  const account = await createRecord(request, token, 'account', { name: `Parent ${tag}` })
  await createRecord(request, token, 'contact', { lastName: `Child ${tag} one`, accountId: account.id })
  await createRecord(request, token, 'contact', { lastName: `Child ${tag} two`, accountId: account.id })
  await createRecord(request, token, 'contact', { lastName: `Stranger ${tag}` })
  await signIn(page)
  await openList(page, 'Accounts')
  await search(page, tag)
  await rows(page).first().click()

  const panel = page.locator('.record-relationships')
  await expect(panel).toContainText(`Child ${tag} one`)
  await expect(panel).toContainText(`Child ${tag} two`)
  await expect(panel).not.toContainText(`Stranger ${tag}`)
})

test('a saved filter survives a reload and applies its conditions', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  await seedAccounts(request, token, tag, [['keep', { industry: 'Finance' }], ['skip', { industry: 'Retail' }]])
  await signIn(page)
  await openList(page, 'Accounts')
  await search(page, tag)
  await expect(rows(page)).toHaveCount(2)
  await page.getByRole('button', { name: 'Filtry', exact: true }).click()
  await page.getByRole('button', { name: 'Přidat podmínku' }).click()
  await page.getByLabel('Pole filtru').first().selectOption('industry')
  await page.getByLabel('Operátor filtru').first().selectOption('anyOf')
  await page.getByLabel('Hodnoty filtru').first().selectOption(['Finance'])
  await page.getByRole('button', { name: 'Použít filtry' }).click()
  await expect(rows(page)).toHaveCount(1)

  await page.locator('button.filter-toggle').click()
  await page.getByLabel('Název uloženého filtru').fill(`Finance ${tag}`)
  await page.getByRole('button', { name: 'Uložit filtr' }).click()
  await expect(page.getByRole('button', { name: `Finance ${tag}` }).first()).toBeVisible()

  await page.reload()
  await expect(page.locator('aside.sidebar')).toBeVisible()
  await openList(page, 'Accounts')
  await page.getByRole('button', { name: 'Filtry', exact: true }).click()
  await page.getByLabel('Uložený filtr').selectOption({ label: `Finance ${tag}` })
  await listReady(page)
  await search(page, tag)
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText(`${tag} keep`)
  const preferences = await (await request.get('/v1/me/preferences', { headers: { Authorization: `Bearer ${token}` } })).json()
  expect(Object.keys(preferences.presetFilters ?? {})).toContain('Account')
})
