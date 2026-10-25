import { expect, test } from '@playwright/test'

// Step S0: the stack is wired. The proxy reaches the API and the application shell loads.
test('the API is reachable through the same-origin proxy', async ({ request }) => {
  const health = await request.get('/v1/health')
  expect(health.status()).toBe(200)
  expect(await health.json()).toEqual({ status: 'ok' })

  const options = await request.get('/v1/public/login-options')
  expect(options.status()).toBe(200)
  expect((await options.json()).passwordLogin).toBe(true)
})

test('the OpenAPI document is served through the proxy', async ({ request }) => {
  const spec = await request.get('/v1/openapi.json')
  expect(spec.status()).toBe(200)
  expect((await spec.json()).openapi).toMatch(/^3\./)
})

test('the application page loads', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('ViaCRM')
  await expect(page.locator('#root')).toBeAttached()
})
