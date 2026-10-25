import { expect } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'

export const ADMIN = { email: 'admin@example.com', password: 'admin-dev-password-1' }
export const PASSWORD = 'correct horse battery staple'

export async function adminToken(request: APIRequestContext): Promise<string> {
  const response = await request.post('/v1/auth/login', { data: ADMIN })
  expect(response.status()).toBe(200)
  return (await response.json()).accessToken
}

export const stamp = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`

export async function createRecord(request: APIRequestContext, token: string, entity: string, body: Record<string, unknown>) {
  const response = await request.post(`/v1/records/${entity}`, { headers: { Authorization: `Bearer ${token}` }, data: body })
  expect(response.status(), await response.text()).toBe(201)
  return response.json()
}

export async function signIn(page: Page, email = ADMIN.email, password = ADMIN.password) {
  await page.goto('/')
  await page.getByLabel(/e-?mail/i).fill(email)
  await page.locator('#login-password').fill(password)
  await page.locator('.login-submit').click()
  await expect(page.locator('aside.sidebar')).toBeVisible()
}

export const openEntity = (page: Page, label: string) => page.locator('aside.sidebar .nav-item', { hasText: label }).click()

export async function search(page: Page, text: string) {
  await page.locator('input[placeholder^="Hledat"]').fill(text)
  await page.keyboard.press('Enter')
}

export const rows = (page: Page) => page.locator('table tbody tr')
