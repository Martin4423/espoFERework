import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { adminToken, createRecord, openEntity, openList, rows, search, signIn, stamp } from './support.ts'

// Step S7: leads, deals, quotes, activities and the calendar.
const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

test('a lead is converted into an account and a contact', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  const lead = await createRecord(request, token, 'lead', { firstName: 'Eva', lastName: `Lead ${tag}`, company: `Convert ${tag} s.r.o.`, email: `eva-${tag}@example.com` })
  await signIn(page)
  await openList(page, 'Leads')
  await search(page, tag)
  await expect(rows(page)).toHaveCount(1)
  await rows(page).first().click()

  await page.getByRole('button', { name: /Převést zájemce/ }).click()
  const dialog = page.getByTestId('lead-convert')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Convert', exact: true }).click()

  await expect(dialog).toHaveCount(0)
  const stored = await (await request.get(`/v1/records/lead/${lead.id}`, { headers: auth(token) })).json()
  expect(stored.status).toBe('converted')
  const account = await (await request.get(`/v1/records/account/${stored.convertedAccountId}`, { headers: auth(token) })).json()
  expect(account.name).toBe(`Convert ${tag} s.r.o.`)
  const contact = await (await request.get(`/v1/records/contact/${stored.convertedContactId}`, { headers: auth(token) })).json()
  expect(contact.lastName).toBe(`Lead ${tag}`)
  expect(contact.accountId).toBe(account.id)
  // a converted lead cannot be converted again
  await expect(page.getByRole('button', { name: /Převést zájemce/ })).toHaveCount(0)
})

test('the deal kanban shows a column per stage and a card moves between them', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  const deal = await createRecord(request, token, 'deal', { name: `Kanban ${tag}`, stage: 'qualification' })
  await signIn(page)
  await openList(page, 'Deals')

  await page.getByRole('button', { name: /Kanban/i }).first().click()
  await expect(page.locator('.kanban-column').first()).toBeVisible()
  const columns = await page.locator('.kanban-column').count()
  expect(columns).toBeGreaterThanOrEqual(6)
  await expect(page.locator('.kanban-column', { hasText: `Kanban ${tag}` })).toContainText('Qualification')

  // the drag events the board listens for, with a shared DataTransfer
  const transfer = await page.evaluateHandle(() => new DataTransfer())
  const card = page.locator('.kanban-card', { hasText: `Kanban ${tag}` })
  const column = page.locator('.kanban-column').filter({ has: page.locator('.kanban-column-head', { hasText: 'Negotiation' }) })
  await card.dispatchEvent('dragstart', { dataTransfer: transfer })
  await column.dispatchEvent('dragover', { dataTransfer: transfer })
  await column.dispatchEvent('drop', { dataTransfer: transfer })

  await expect.poll(async () => (await (await request.get(`/v1/records/deal/${deal.id}`, { headers: auth(token) })).json()).stage).toBe('negotiation')
})

test('a quote total follows its lines without a reload', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  const quote = await createRecord(request, token, 'quote', { name: `Quote ${tag}`, discountPercent: '0' })
  await signIn(page)
  await openList(page, 'Quotes')
  await search(page, tag)
  await rows(page).first().click()
  await expect(page.locator('article')).toContainText(`Quote ${tag}`)

  await createRecord(request, token, 'quoteLine', { name: 'Item', quoteId: quote.id, quantity: '2', unitPrice: '10.00' })

  await expect(page.locator('article')).toContainText('20', { timeout: 6_000 })
  const stored = await (await request.get(`/v1/records/quote/${quote.id}`, { headers: auth(token) })).json()
  expect(stored.total).toBe('20.00')
})

test('a task is completed from the list with the old status text translated', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  const task = await createRecord(request, token, 'task', { subject: `Do ${tag}` })
  await signIn(page)
  await openList(page, 'Tasks')
  await search(page, tag)
  await expect(rows(page)).toHaveCount(1)

  await rows(page).first().getByRole('button', { name: /Dokončit|Označit jako dokončený|Hotovo/ }).click()

  await expect.poll(async () => (await (await request.get(`/v1/records/task/${task.id}`, { headers: auth(token) })).json()).status).toBe('completed')
})

test('the calendar shows meetings and tasks of the visible week', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 10, 0, 0))
  const end = new Date(start.getTime() + 3600_000)
  await createRecord(request, token, 'meeting', { subject: `Meet ${tag}`, dateStart: start.toISOString(), dateEnd: end.toISOString() })
  await createRecord(request, token, 'task', { subject: `Due ${tag}`, dueDate: start.toISOString() })
  await signIn(page)

  await page.locator('aside.sidebar .nav-item', { hasText: 'Kalendář' }).click()

  await expect(page.getByText(`Meet ${tag}`).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(`Due ${tag}`).first()).toBeVisible()
})

export type { Page }
