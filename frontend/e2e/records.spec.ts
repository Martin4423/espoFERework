import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { adminToken, createRecord, openEntity, openList, rows, search, signIn, stamp } from './support.ts'

// Step S4: detail, create, edit, delete.
const edit = (page: Page) => page.getByRole('button', { name: 'Upravit záznam', exact: true })
const field = (page: Page, id: string) => page.locator(`.record-modal #field-${id}:visible`)
const save = (page: Page) => page.getByRole('button', { name: 'Uložit změny' })

async function openContact(page: Page, tag: string) {
  await openList(page, 'Contacts')
  await search(page, tag)
  await expect(rows(page)).toHaveCount(1)
  await rows(page).first().click()
}

test('the detail shows the fields, the linked record and the owner', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  const account = await createRecord(request, token, 'account', { name: `Acme ${tag}` })
  await createRecord(request, token, 'contact', { firstName: 'Eva', lastName: `Detail ${tag}`, email: `eva-${tag}@example.com`, title: 'CFO', accountId: account.id })
  await signIn(page)

  await openContact(page, tag)

  await expect(page.getByRole('heading', { level: 2, name: `Eva Detail ${tag}` })).toBeVisible()
  await expect(page.locator('article').getByText(`Acme ${tag}`).first()).toBeVisible()
  await expect(page.locator('article').getByText('CFO').first()).toBeVisible()
  await expect(page.locator('article').getByText(`eva-${tag}@example.com`)).toBeVisible()
  await expect(page.locator('article').getByText('Admin').first()).toBeVisible()
})

test('editing saves through PATCH and the detail shows the new values', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  const contact = await createRecord(request, token, 'contact', { firstName: 'Eva', lastName: `Edit ${tag}` })
  await signIn(page)
  await openContact(page, tag)

  await edit(page).click()
  await field(page, 'lastName').fill(`Edited ${tag}`)
  await field(page, 'title').fill('Director')
  await save(page).click()

  await expect(page.getByRole('heading', { level: 2, name: `Edited ${tag}` })).toBeVisible()
  const stored = await (await request.get(`/v1/records/contact/${contact.id}`, { headers: { Authorization: `Bearer ${token}` } })).json()
  expect(stored.lastName).toBe(`Edited ${tag}`)
  expect(stored.title).toBe('Director')
})

test('a value the backend refuses is explained at the field, nothing is saved', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  const contact = await createRecord(request, token, 'contact', { lastName: `Invalid ${tag}`, email: 'ok@example.com' })
  await signIn(page)
  await openContact(page, tag)

  await edit(page).click()
  await field(page, 'email').fill('not-an-email')
  await save(page).click()

  await expect(page.locator('.record-modal:visible .inline-error')).toContainText('Email has an invalid value'.replace('Email', 'Email'))
  const stored = await (await request.get(`/v1/records/contact/${contact.id}`, { headers: { Authorization: `Bearer ${token}` } })).json()
  expect(stored.email).toBe('ok@example.com')
})

test('a record is created from the list and shows up in it', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  await signIn(page)
  await openList(page, 'Contacts')

  await page.getByRole('button', { name: /Nový záznam/ }).first().click()
  await field(page, 'lastName').fill(`Created ${tag}`)
  await field(page, 'firstName').fill('Nová')
  await page.getByRole('button', { name: 'Vytvořit záznam' }).click()

  await expect(page.locator('.record-modal:visible')).toHaveCount(0)
  await search(page, tag)
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText(`Created ${tag}`)
  const found = await (await request.get(`/v1/records/contact?q=${tag}`, { headers: { Authorization: `Bearer ${token}` } })).json()
  expect(found.items).toHaveLength(1)
  expect(found.items[0].firstName).toBe('Nová')
})

test('a record is deleted from the detail after a confirmation', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  const contact = await createRecord(request, token, 'contact', { lastName: `Delete ${tag}` })
  await signIn(page)
  await openContact(page, tag)

  await page.getByRole('button', { name: /Smazat|Odstranit/ }).first().click()
  await page.getByRole('button', { name: /Smazat|Odstranit/ }).last().click()

  await expect(rows(page).first()).toBeVisible()
  const response = await request.get(`/v1/records/contact/${contact.id}`, { headers: { Authorization: `Bearer ${token}` } })
  expect(response.status()).toBe(404)
})

test('a record changed by someone else meanwhile is not overwritten silently', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  const contact = await createRecord(request, token, 'contact', { firstName: 'Eva', lastName: `Conflict ${tag}` })
  await signIn(page)
  await openContact(page, tag)
  await edit(page).click()
  await field(page, 'title').fill('Mine')

  const other = await request.patch(`/v1/records/contact/${contact.id}`, { headers: { Authorization: `Bearer ${token}` }, data: { title: 'Theirs' } })
  expect(other.status()).toBe(200)
  await save(page).click()

  await expect(page.locator('.record-modal:visible')).toBeVisible()          // still open: nothing was saved
  const stored = await (await request.get(`/v1/records/contact/${contact.id}`, { headers: { Authorization: `Bearer ${token}` } })).json()
  expect(stored.title).toBe('Theirs')
})

test('a link is chosen from a search of the target entity and saved as its id', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  const account = await createRecord(request, token, 'account', { name: `Linked ${tag}` })
  const contact = await createRecord(request, token, 'contact', { lastName: `Picker ${tag}` })
  await signIn(page)
  await openContact(page, tag)
  await edit(page).click()

  await page.locator('.record-modal:visible').getByPlaceholder('Hledat accounts…').fill(`Linked ${tag}`)
  await page.locator('.record-modal:visible select', { hasText: `Linked ${tag}` }).selectOption({ label: `Linked ${tag}` })
  await save(page).click()

  await expect(page.locator('.record-modal:visible')).toHaveCount(0)
  const stored = await (await request.get(`/v1/records/contact/${contact.id}`, { headers: { Authorization: `Bearer ${token}` } })).json()
  expect(stored.accountId).toBe(account.id)
})

test('the owner is changed from the user choice and saved as ownerId', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  const email = `owner-${tag}@example.com`
  const user = await (await request.post('/v1/users', { headers: { Authorization: `Bearer ${token}` }, data: { email, password: 'correct horse battery staple', lastName: `Owner${tag}` } })).json()
  const contact = await createRecord(request, token, 'contact', { lastName: `Owned ${tag}` })
  await signIn(page)
  await openContact(page, tag)
  await edit(page).click()

  await page.locator('.record-modal:visible').getByPlaceholder('Hledat user…').fill(`Owner${tag}`)
  await page.locator('.record-modal:visible #field-assignedUser').selectOption({ label: `Owner${tag}` })
  await save(page).click()

  await expect(page.locator('.record-modal:visible')).toHaveCount(0)
  const stored = await (await request.get(`/v1/records/contact/${contact.id}`, { headers: { Authorization: `Bearer ${token}` } })).json()
  expect(stored.ownerId).toBe(user.id)
})

// Every entity can be created from its list with the fields it requires (defaults, enums, dates and links included).
const CREATE: Array<[string, string, Record<string, string>]> = [
  ['Accounts', 'name', {}],
  ['Contacts', 'lastName', {}],
  ['Leads', 'lastName', {}],
  ['Deals', 'name', {}],
  ['Products', 'name', {}],
  ['Quotes', 'name', {}],
  ['Tasks', 'subject', {}],
  ['Calls', 'subject', { dateStart: '2026-03-01T10:00' }],
  ['Meetings', 'subject', {}],
]
for (const [label, titleField, extra] of CREATE) {
  test(`${label}: a record can be created with its required fields`, async ({ page, request }) => {
    const token = await adminToken(request)
    const tag = stamp()
    await signIn(page)
    await openEntity(page, label)
    await expect(page.locator('.entity-heading h1')).toContainText(label)

    await page.getByRole('button', { name: /Nový záznam/ }).first().click()
    await field(page, titleField).fill(`Create ${tag}`)
    for (const [name, value] of Object.entries(extra)) await field(page, name).fill(value)
    if (label === 'Meetings') {
      // a meeting has its own date and time pickers
      const modal = page.locator('.record-modal:visible')
      await modal.getByLabel('Start – datum').fill('2026-03-01')
      await modal.getByLabel('Start – čas').fill('10:00')
      await modal.getByLabel('End – datum').fill('2026-03-01')
      await modal.getByLabel('End – čas').fill('11:00')
    }
    await page.getByRole('button', { name: 'Vytvořit záznam' }).click()

    await expect(page.locator('.record-modal:visible')).toHaveCount(0, { timeout: 10_000 })
    const entity = label.slice(0, -1).toLowerCase()
    const found = await (await request.get(`/v1/records/${entity}?q=${tag}`, { headers: { Authorization: `Bearer ${token}` } })).json()
    expect(found.items).toHaveLength(1)
  })
}
