import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { PASSWORD, adminToken, createRecord, openList, rows, search, signIn, stamp } from './support.ts'

// Step S6: notes, change history, followers, notifications and the live stream.
const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

async function openAccount(page: Page, tag: string) {
  await openList(page, 'Accounts')
  await search(page, tag)
  await expect(rows(page)).toHaveCount(1)
  await rows(page).first().click()
}

async function newUser(request: APIRequestContext, token: string, tag: string) {
  const email = `collab-${tag}@example.com`
  const user = await (await request.post('/v1/users', { headers: auth(token), data: { email, password: PASSWORD, lastName: `Mate${tag}` } })).json()
  const role = await (await request.post('/v1/roles', { headers: auth(token), data: { name: `Collab ${tag}`, entityPermissions: { account: { read: 'all', edit: 'all', delete: 'no', create: 'yes' } } } })).json()
  await request.put(`/v1/users/${user.id}/roles`, { headers: auth(token), data: { roleIds: [role.id] } })
  return { ...user, email }
}

const stream = (page: Page) => page.locator('.stream-item')

test('a post is published and shown with its author', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  const account = await createRecord(request, token, 'account', { name: `Post ${tag}` })
  await signIn(page)
  await openAccount(page, tag)

  await page.getByPlaceholder('Sdílejte novinku…').fill(`Hello ${tag}`)
  await page.getByRole('button', { name: /Publikovat/ }).click()

  await expect(stream(page).first()).toContainText(`Hello ${tag}`)
  const notes = await (await request.get(`/v1/records/account/${account.id}/notes`, { headers: auth(token) })).json()
  expect(notes.items.map((n: { body: string }) => n.body)).toContain(`Hello ${tag}`)
})

test('the history of a record shows the creation and each change', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  const account = await createRecord(request, token, 'account', { name: `History ${tag}`, billingCity: 'Brno' })
  await request.patch(`/v1/records/account/${account.id}`, { headers: auth(token), data: { billingCity: 'Praha' } })
  await signIn(page)
  await openAccount(page, tag)

  await expect(stream(page).filter({ hasText: 'Praha' }).first()).toBeVisible()
  await expect(stream(page).filter({ hasText: 'Brno' }).first()).toBeVisible()
  await expect(stream(page)).toHaveCount(2)    // created, changed
})

test('an own post is edited and deleted', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  const account = await createRecord(request, token, 'account', { name: `Edit post ${tag}` })
  await request.post(`/v1/records/account/${account.id}/notes`, { headers: auth(token), data: { body: `First ${tag}` } })
  await signIn(page)
  await openAccount(page, tag)
  await expect(stream(page).filter({ hasText: `First ${tag}` })).toBeVisible()

  await stream(page).filter({ hasText: `First ${tag}` }).getByRole('button', { name: /Upravit/ }).click()
  await page.locator('.stream-item textarea').first().fill(`Second ${tag}`)
  await page.getByRole('button', { name: /Uložit/ }).first().click()
  await expect(stream(page).filter({ hasText: `Second ${tag}` })).toBeVisible()

  await stream(page).filter({ hasText: `Second ${tag}` }).getByRole('button', { name: /Smazat|Odstranit/ }).click()
  await page.getByRole('button', { name: /Smazat|Odstranit/ }).last().click()
  await expect(stream(page).filter({ hasText: `Second ${tag}` })).toHaveCount(0)
})

test('following can be switched off and on again', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  const account = await createRecord(request, token, 'account', { name: `Follow ${tag}` })
  await signIn(page)
  await openAccount(page, tag)

  await page.getByRole('button', { name: 'Přestat sledovat' }).click()
  await expect(page.getByRole('button', { name: 'Sledovat záznam' })).toBeVisible()
  let followers = await (await request.get(`/v1/records/account/${account.id}/followers`, { headers: auth(token) })).json()
  expect(followers.items).toHaveLength(0)

  await page.getByRole('button', { name: 'Sledovat záznam' }).click()
  await expect(page.getByRole('button', { name: 'Přestat sledovat' })).toBeVisible()
  followers = await (await request.get(`/v1/records/account/${account.id}/followers`, { headers: auth(token) })).json()
  expect(followers.items).toHaveLength(1)
})

test('a mention notifies the other user at once and the bell lists it', async ({ browser, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  const mate = await newUser(request, token, tag)
  const account = await createRecord(request, token, 'account', { name: `Mention ${tag}` })
  const context = await browser.newContext({ locale: 'en-US' })
  const page = await context.newPage()
  await signIn(page, mate.email, PASSWORD)
  await expect(page.getByRole('button', { name: /Oznámení/ })).toBeVisible()

  await request.post(`/v1/records/account/${account.id}/notes`, { headers: auth(token), data: { body: `Hi @Mate${tag}`, mentions: [mate.id] } })

  // far below the 10 second polling interval: only the live stream can be this fast
  await expect(page.getByRole('button', { name: /Oznámení/ })).toContainText('1', { timeout: 4_000 })
  await page.getByRole('button', { name: /Oznámení/ }).click()
  await expect(page.getByText(/zmínil|Mention|Nová aktivita/).first()).toBeVisible()
  await context.close()
})

test('a note written elsewhere shows up in an open record without a reload', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  const account = await createRecord(request, token, 'account', { name: `Live ${tag}` })
  await signIn(page)
  await openAccount(page, tag)
  await expect(stream(page)).toHaveCount(1)

  await request.post(`/v1/records/account/${account.id}/notes`, { headers: auth(token), data: { body: `Live note ${tag}` } })

  await expect(stream(page).filter({ hasText: `Live note ${tag}` })).toBeVisible({ timeout: 4_000 })
})

test('files are uploaded to a record, downloaded and deleted', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  const account = await createRecord(request, token, 'account', { name: `Files ${tag}` })
  await signIn(page)
  await openAccount(page, tag)
  const panel = page.getByTestId('record-files')
  await expect(panel).toContainText('This record has no files yet.')

  await panel.getByTestId('file-input').setInputFiles({ name: `note-${tag}.txt`, mimeType: 'text/plain', buffer: Buffer.from(`hello ${tag}`) })

  await expect(panel).toContainText(`note-${tag}.txt`)
  const listed = await (await request.get(`/v1/records/account/${account.id}/files`, { headers: auth(token) })).json()
  expect(listed.items).toHaveLength(1)
  const [download] = await Promise.all([page.waitForEvent('download'), panel.getByRole('button', { name: `note-${tag}.txt`, exact: true }).click()])
  expect(download.suggestedFilename()).toBe(`note-${tag}.txt`)
  expect((await (await import('node:fs/promises')).readFile(await download.path()!)).toString()).toBe(`hello ${tag}`)

  await panel.getByRole('button', { name: /Delete file: / }).click()
  await page.getByRole('button', { name: 'Delete file' }).last().click()
  await expect(panel).toContainText('This record has no files yet.')
})
