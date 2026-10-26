import { expect, test } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { ADMIN, PASSWORD, adminToken, signIn, stamp } from './support.ts'

// Step S9: branding, password recovery by mail, public lead form, account security.
const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025'
const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

// The newest mail to this address, waiting for the queue to deliver it.
async function mailTo(request: APIRequestContext, address: string): Promise<{ text: string }> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const list = await (await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`)).json()
    if (list.messages?.length) {
      const message = await (await request.get(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json()
      return { text: message.Text as string }
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`no mail for ${address}`)
}
const tokenOf = (text: string) => /token=([A-Za-z0-9_-]+)/.exec(text)![1]

async function newUser(request: APIRequestContext, tag: string) {
  const token = await adminToken(request)
  const email = `pub-${tag}@example.com`
  const response = await request.post('/v1/users', { headers: auth(token), data: { email, password: PASSWORD, lastName: `Pub${tag}` } })
  expect(response.status(), await response.text()).toBe(201)
  return email
}

test('the sign-in page shows the stored branding', async ({ page, request }) => {
  const token = await adminToken(request)
  const name = `Brand ${stamp()}`
  try {
    await request.put('/v1/settings/branding', { headers: auth(token), data: { appName: name, theme: 'light' } })
    await page.goto('/')
    await expect(page.locator('.login-story')).toContainText(name)
  } finally {
    await request.put('/v1/settings/branding', { headers: auth(token), data: { appName: 'ViaCRM', theme: 'light' } })
  }
})

test('a forgotten password is reset through the mailed link', async ({ page, request }) => {
  const tag = stamp()
  const email = await newUser(request, tag)
  await page.goto('/')
  await page.getByRole('button', { name: /forgot your password/i }).click()
  await page.getByLabel(/e-?mail/i).fill(email)
  await page.getByRole('button', { name: 'Send the link' }).click()
  await expect(page.getByTestId('recovery-sent')).toBeVisible()
  const token = tokenOf((await mailTo(request, email)).text)

  await page.goto(`/reset-password?token=${token}`)
  const next = `fresh ${tag} horse battery`
  await page.locator('input[name="newPassword"]').fill(next)
  await page.locator('input[name="again"]').fill(next)
  await page.getByRole('button', { name: 'Set the password' }).click()
  await expect(page.getByTestId('reset-done')).toBeVisible()

  await signIn(page, email, next)
  // the link works once
  await page.goto(`/reset-password?token=${token}`)
  await expect(page.getByTestId('reset-invalid')).toBeVisible()
})

test('an unknown address gets the same answer as a known one', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /forgot your password/i }).click()
  await page.getByLabel(/e-?mail/i).fill(`nobody-${stamp()}@example.com`)
  await page.getByRole('button', { name: 'Send the link' }).click()
  await expect(page.getByTestId('recovery-sent')).toBeVisible()
})

test('a public lead form creates a lead', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  const created = await request.post('/v1/lead-forms', { headers: auth(token), data: { name: `Form ${tag}`, fields: [{ key: 'lastName', required: true }, { key: 'email', required: false }], optIn: false, successMessage: `Thanks ${tag}`, teamIds: [] } })
  expect(created.status(), await created.text()).toBe(201)
  const form = await created.json()
  await page.goto(`/forms/${form.id}`)
  await page.getByLabel(/Last name/).fill(`Web${tag}`)
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByTestId('lead-form-done')).toContainText(`Thanks ${tag}`)
  const found = await (await request.get(`/v1/records/lead?q=Web${tag}`, { headers: auth(token) })).json()
  expect(found.items.length).toBe(1)
})

test('a public form names the field that is missing', async ({ page, request }) => {
  const token = await adminToken(request)
  const form = await (await request.post('/v1/lead-forms', { headers: auth(token), data: { name: `Req ${stamp()}`, fields: [{ key: 'lastName', required: true }], optIn: false, teamIds: [] } })).json()
  await page.goto(`/forms/${form.id}`)
  await page.getByLabel(/Last name/).evaluate((input: HTMLInputElement) => input.removeAttribute('required'))
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByTestId('lead-form-error')).toContainText('Last name')
})

test('a form with e-mail confirmation creates the lead only after the link is opened', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  const email = `lead-${tag}@example.com`
  const form = await (await request.post('/v1/lead-forms', { headers: auth(token), data: { name: `Optin ${tag}`, fields: [{ key: 'lastName', required: true }, { key: 'email', required: true }], optIn: true, teamIds: [] } })).json()
  await page.goto(`/forms/${form.id}`)
  await page.getByLabel(/Last name/).fill(`Opt${tag}`)
  await page.getByLabel(/E-?mail/).fill(email)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByTestId('lead-form-done')).toBeVisible()
  expect((await (await request.get(`/v1/records/lead?q=Opt${tag}`, { headers: auth(token) })).json()).items.length).toBe(0)

  const link = tokenOf((await mailTo(request, email)).text)
  await page.goto(`/lead-confirm?token=${link}`)
  await expect(page.getByTestId('lead-confirm-status')).toContainText('confirmed')
  expect((await (await request.get(`/v1/records/lead?q=Opt${tag}`, { headers: auth(token) })).json()).items.length).toBe(1)
})

test('a non-existing form and an invalid confirmation link are explained', async ({ page }) => {
  await page.goto('/forms/00000000-0000-0000-0000-000000000000')
  await expect(page.getByTestId('lead-form-missing')).toBeVisible()
  await page.goto('/lead-confirm?token=nope')
  await expect(page.getByTestId('lead-confirm-status')).toContainText('not valid')
})

test('account security: the password is changed and other devices are signed out', async ({ page, request, browser, baseURL }) => {
  const tag = stamp()
  const email = await newUser(request, tag)
  await signIn(page, email, PASSWORD)
  const otherContext = await browser.newContext({ baseURL })
  const other = await otherContext.newPage()
  await signIn(other, email, PASSWORD)

  await page.evaluate(() => { window.location.hash = '#Account/security' })
  await expect(page.getByTestId('account-security')).toBeVisible()
  await expect(page.locator('[data-testid="sessions"] tbody tr')).toHaveCount(2)
  await page.getByRole('button', { name: 'Sign out the others' }).click()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.locator('[data-testid="sessions"] tbody tr')).toHaveCount(1)
  await expect(page.locator('[data-testid="login-history"] tbody tr').first()).toContainText('Succeeded')

  const next = `changed ${tag} horse battery`
  const form = page.getByTestId('password-form')
  await form.locator('input').nth(0).fill(PASSWORD)
  await form.locator('input').nth(1).fill(next)
  await form.locator('input').nth(2).fill(next)
  await form.getByRole('button', { name: 'Change password' }).click()
  await expect(page.getByText('The password is changed')).toBeVisible()
  await otherContext.close()
})

test('the admin stores the branding and manages lead forms', async ({ page }) => {
  await signIn(page, ADMIN.email, ADMIN.password)
  await page.getByRole('button', { name: 'Administrace' }).click()
  await page.locator('.admin-tile', { hasText: /Lead forms/ }).click()
  await expect(page.getByTestId('admin-lead-forms')).toBeVisible()
  await page.getByRole('button', { name: 'Administration' }).click()
  await page.locator('.admin-tile', { hasText: /^Branding/ }).click()
  await expect(page.getByTestId('admin-branding')).toBeVisible()
  await expect(page.getByLabel('Application name')).not.toHaveValue('')
})
