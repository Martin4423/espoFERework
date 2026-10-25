import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'

// Step S1: sign-in, session restore, silent refresh, lockout, sign-out. Real backend, no mocks.
const ADMIN = { email: 'admin@example.com', password: 'admin-dev-password-1' }
const PASSWORD = 'correct horse battery staple'

async function adminToken(request: APIRequestContext): Promise<string> {
  const response = await request.post('/v1/auth/login', { data: ADMIN })
  expect(response.status()).toBe(200)
  return (await response.json()).accessToken
}

// A fresh regular user per test: lockout and sessions of one test never touch another.
async function newUser(request: APIRequestContext): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
  const created = await request.post('/v1/users', {
    headers: { Authorization: `Bearer ${await adminToken(request)}` },
    data: { email, password: PASSWORD, lastName: 'Tester', firstName: 'E2E' },
  })
  expect(created.status()).toBe(201)
  return email
}

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/')
  await page.getByLabel(/e-?mail/i).fill(email)
  await page.locator('#login-password').fill(password)
  await page.locator('.login-submit').click()
}

const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('via-session') || 'null'))

test.describe('English (the browser default of the test runner)', () => {
  test('sign in, survive a reload, sign out', async ({ page, request }) => {
    const email = await newUser(request)
    await signIn(page, email)

    await expect(page.locator('aside.sidebar')).toBeVisible()
    await expect(page.locator('.user-menu')).toContainText('E2E Tester')
    expect((await stored(page)).user.email).toBe(email)

    await page.reload()
    await expect(page.locator('aside.sidebar')).toBeVisible()

    await page.locator('.user-menu').click()
    await page.getByText('Odhlásit se').click()
    await expect(page.getByTestId('login-form')).toBeVisible()
    expect(await stored(page)).toBeNull()
    await page.reload()
    await expect(page.getByTestId('login-form')).toBeVisible()
  })

  test('a wrong password is explained and nothing is stored', async ({ page, request }) => {
    const email = await newUser(request)
    await signIn(page, email, 'definitely not the password')

    await expect(page.getByTestId('login-error')).toHaveText('The e-mail or password is not correct.')
    expect(await stored(page)).toBeNull()
  })

  // The backend also locks a client IP after 10 failed sign-ins in 5 minutes, and the limits are not configurable.
  // Five more failures would make repeated e2e runs collide, so this one is opt-in (E2E_LOCKOUT=1; the message
  // mapping itself is covered by the unit tests).
  test('five wrong attempts lock the account out with a time hint', async ({ page, request }) => {
    test.skip(!process.env.E2E_LOCKOUT, 'opt-in: set E2E_LOCKOUT=1')
    const email = await newUser(request)
    for (let attempt = 0; attempt < 5; attempt++) {
      expect((await request.post('/v1/auth/login', { data: { email, password: 'wrong wrong wrong' } })).status()).toBe(401)
    }

    await signIn(page, email)

    await expect(page.getByTestId('login-error')).toContainText(/Too many attempts\. Try again in \d+ min\./)
  })

  test('an expired access token is refreshed silently on reload', async ({ page, request }) => {
    const email = await newUser(request)
    await signIn(page, email)
    await expect(page.locator('aside.sidebar')).toBeVisible()
    const before = await stored(page)
    await page.evaluate(() => {
      const session = JSON.parse(localStorage.getItem('via-session')!)
      session.accessExpiresAt = Date.now() - 1000
      localStorage.setItem('via-session', JSON.stringify(session))
    })

    await page.reload()

    await expect(page.locator('aside.sidebar')).toBeVisible()
    const after = await stored(page)
    // the refresh token rotated (the JWT itself can be identical when both are issued within one second)
    expect(after.refreshToken).not.toBe(before.refreshToken)
    expect(after.accessExpiresAt).toBeGreaterThan(Date.now())
  })

  test('two tabs refreshing at the same moment both stay signed in', async ({ page, context, request }) => {
    const email = await newUser(request)
    await signIn(page, email)
    await expect(page.locator('aside.sidebar')).toBeVisible()
    await page.evaluate(() => {
      const session = JSON.parse(localStorage.getItem('via-session')!)
      session.accessExpiresAt = Date.now() - 1000
      localStorage.setItem('via-session', JSON.stringify(session))
    })
    const second = await context.newPage()

    await Promise.all([page.reload(), second.goto('/')])

    await expect(page.locator('aside.sidebar')).toBeVisible()
    await expect(second.locator('aside.sidebar')).toBeVisible()
    // the server did not treat a reused refresh token as theft: the session still works
    const token = (await stored(second)).accessToken
    expect((await request.get('/v1/me', { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(200)
  })

  test('a session revoked on the server ends with a notice', async ({ page, request }) => {
    const email = await newUser(request)
    await signIn(page, email)
    await expect(page.locator('aside.sidebar')).toBeVisible()
    const { accessToken } = await stored(page)
    const sessions = await (await request.get('/v1/me/sessions', { headers: { Authorization: `Bearer ${accessToken}` } })).json()
    const current = sessions.items.find((s: { current: boolean }) => s.current)
    expect((await request.delete(`/v1/me/sessions/${current.id}`, { headers: { Authorization: `Bearer ${accessToken}` } })).status()).toBe(204)

    await page.reload()

    await expect(page.getByTestId('login-notice')).toHaveText('Your session expired or was revoked. Please sign in again.')
    expect(await stored(page)).toBeNull()
  })

  test('the language switch persists', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Čeština' }).click()
    await expect(page.locator('.login-card h2')).toHaveText('Přihlášení do CRM')
    await page.reload()
    await expect(page.locator('.login-card h2')).toHaveText('Přihlášení do CRM')
    await page.getByRole('button', { name: 'English' }).click()
    await expect(page.locator('.login-card h2')).toHaveText('Sign in to the CRM')
  })
})

test.describe('Czech browser', () => {
  test.use({ locale: 'cs-CZ' })

  test('the sign-in screen and its errors are Czech by default', async ({ page, request }) => {
    const email = await newUser(request)
    await signIn(page, email, 'definitely not the password')

    await expect(page.locator('.login-card h2')).toHaveText('Přihlášení do CRM')
    await expect(page.getByTestId('login-error')).toHaveText('E-mail nebo heslo nejsou správné.')
  })
})
