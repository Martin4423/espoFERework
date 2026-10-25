import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'

// Step S2: the metadata adapter and the shell. Navigation comes from the entities and permissions of the backend.
const ADMIN = { email: 'admin@example.com', password: 'admin-dev-password-1' }
const PASSWORD = 'correct horse battery staple'

async function adminToken(request: APIRequestContext): Promise<string> {
  const response = await request.post('/v1/auth/login', { data: ADMIN })
  return (await response.json()).accessToken
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/')
  await page.getByLabel(/e-?mail/i).fill(email)
  await page.locator('#login-password').fill(password)
  await page.locator('.login-submit').click()
  await expect(page.locator('aside.sidebar')).toBeVisible()
}

const nav = (page: Page) => page.locator('aside.sidebar .nav-item')

test('an administrator sees the entities of ViaCRM and the locked ones of the old system', async ({ page }) => {
  await signIn(page, ADMIN.email, ADMIN.password)

  const labels = (await nav(page).allInnerTexts()).map((text) => text.trim())
  for (const entity of ['Accounts', 'Contacts', 'Leads', 'Deals', 'Quotes', 'Products', 'Tasks', 'Calls', 'Meetings']) {
    expect(labels).toContain(entity)
  }
  expect(labels).not.toContain('Quote lines')
  for (const locked of ['E-mail', 'Cases', 'Campaigns', 'Documents', 'Knowledge base', 'Target lists']) {
    expect(labels).toContain(locked)
  }
})

test('a locked entry explains itself instead of failing', async ({ page }) => {
  await signIn(page, ADMIN.email, ADMIN.password)

  await page.locator('aside.sidebar .nav-item', { hasText: 'Campaigns' }).click()

  await expect(page.getByTestId('not-available')).toContainText('Not available in ViaCRM yet')
  await expect(page.locator('.inline-error:not(.notice-unsupported)')).toHaveCount(0)
})

test('the activity screen of the old system is a notice too', async ({ page }) => {
  await signIn(page, ADMIN.email, ADMIN.password)

  await page.getByRole('button', { name: 'Aktivita' }).click()

  await expect(page.getByTestId('not-available')).toBeVisible()
})

test('a user sees only what the role allows', async ({ page, request }) => {
  const headers = { Authorization: `Bearer ${await adminToken(request)}` }
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const role = await (await request.post('/v1/roles', {
    headers, data: { name: `Accounts only ${stamp}`, entityPermissions: { account: { read: 'all', edit: 'no', delete: 'no', create: 'no' } } },
  })).json()
  const email = `shell-${stamp}@example.com`
  const user = await (await request.post('/v1/users', { headers, data: { email, password: PASSWORD, lastName: 'Limited' } })).json()
  expect((await request.put(`/v1/users/${user.id}/roles`, { headers, data: { roleIds: [role.id] } })).status()).toBe(200)

  await signIn(page, email, PASSWORD)

  const labels = (await nav(page).allInnerTexts()).map((text) => text.trim())
  expect(labels).toContain('Accounts')
  for (const hidden of ['Contacts', 'Leads', 'Deals', 'Quotes', 'Products', 'Tasks']) expect(labels).not.toContain(hidden)
})
