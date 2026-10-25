import { expect, test } from '@playwright/test'
import { adminToken, createRecord, openEntity, openList, rows, search, signIn, stamp } from './support.ts'

// Step S3: lists. Layout columns, cursor paging behind page numbers, sorting, search, links and owner names.
test('a list pages through the records, 20 at a time, and back', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  for (let i = 1; i <= 45; i++) await createRecord(request, token, 'account', { name: `L ${tag} ${String(i).padStart(2, '0')}` })
  await signIn(page)
  await openList(page, 'Accounts')

  await search(page, tag)

  await expect(rows(page)).toHaveCount(20)
  await expect(page.locator('.table-footer')).toContainText('1–20 z 45')
  await page.getByLabel('Další stránka').click()
  await expect(page.locator('.table-footer')).toContainText('21–40 z 45')
  await expect(rows(page)).toHaveCount(20)
  await page.getByLabel('Další stránka').click()
  await expect(page.locator('.table-footer')).toContainText('41–45 z 45')
  await expect(rows(page)).toHaveCount(5)
  await page.getByLabel('Předchozí stránka').click()
  await expect(page.locator('.table-footer')).toContainText('21–40 z 45')
})

test('the default order is newest first and a column header sorts', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  for (const n of ['b', 'c', 'a']) await createRecord(request, token, 'account', { name: `S ${tag} ${n}` })
  await signIn(page)
  await openList(page, 'Accounts')
  await search(page, tag)

  await expect(rows(page).first()).toContainText(`S ${tag} a`)       // created last, shown first
  await page.getByRole('button', { name: 'Name', exact: true }).click()
  await expect(rows(page)).toHaveCount(3)
  await expect(rows(page).nth(1)).toContainText(`S ${tag} b`)        // ascending: a, b, c
  await expect(rows(page).nth(2)).toContainText(`S ${tag} c`)
  await page.getByRole('button', { name: 'Name', exact: true }).click()
  await expect(rows(page).first()).toContainText(`S ${tag} c`)       // descending: c, b, a
  await expect(rows(page).nth(2)).toContainText(`S ${tag} a`)
})

test('the search narrows the list and an empty result is shown as such', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  await createRecord(request, token, 'account', { name: `Find ${tag} alpha`, billingCity: 'Brno' })
  await createRecord(request, token, 'account', { name: `Find ${tag} beta` })
  await signIn(page)
  await openList(page, 'Accounts')

  await search(page, `Find ${tag}`)
  await expect(rows(page)).toHaveCount(2)
  await search(page, `FIND ${tag} ALPHA`)
  await expect(rows(page)).toHaveCount(1)
  await search(page, `nothing-${tag}`)
  await expect(rows(page).first()).toContainText('Žádné záznamy k zobrazení')
})

test('a link column shows the name of the linked record, the owner column the owner', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  const account = await createRecord(request, token, 'account', { name: `Acme ${tag}` })
  await createRecord(request, token, 'contact', { firstName: 'Eva', lastName: `Link ${tag}`, accountId: account.id })
  await signIn(page)
  await openList(page, 'Contacts')
  await search(page, tag)

  const row = rows(page).first()
  await expect(row).toContainText(`Link ${tag}`)
  await expect(row).toContainText(`Acme ${tag}`)
  await expect(row).toContainText('Admin')
})

test('lists of every entity load without an error banner', async ({ page }) => {
  await signIn(page)
  for (const label of ['Accounts', 'Contacts', 'Leads', 'Deals', 'Quotes', 'Products', 'Tasks', 'Calls', 'Meetings']) {
    await openEntity(page, label)
    await expect(page.locator('.entity-heading h1')).toContainText(label)
    await expect(page.locator('.inline-error')).toHaveCount(0)
  }
})
