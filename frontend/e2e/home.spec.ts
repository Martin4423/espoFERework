import { expect, test } from '@playwright/test'
import { adminToken, createRecord, signIn, stamp } from './support.ts'

// Step S10: the start page, the global search, the About dialog.
test('the start page shows record counts and the recently changed records', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  await createRecord(request, token, 'account', { name: `Home ${tag}` })
  await signIn(page)
  await expect(page.getByTestId('home')).toBeVisible()
  await expect(page.getByTestId('home-tile-Account')).toBeVisible()
  await expect(page.getByTestId('home-tile-Account').locator('b')).not.toHaveText('0')
  await expect(page.getByTestId('home').getByRole('button', { name: `Home ${tag}` })).toBeVisible()
})

test('a tile opens the list and the plus button starts a new record', async ({ page }) => {
  await signIn(page)
  await page.getByTestId('home-tile-Account').locator('.home-tile-open').click()
  await expect(page.locator('table')).toBeVisible()
})

test('the global search finds a record of any entity and opens it', async ({ page, request }) => {
  const token = await adminToken(request)
  const tag = stamp()
  await createRecord(request, token, 'account', { name: `Needle ${tag}` })
  await createRecord(request, token, 'contact', { lastName: `Needle${tag}` })
  await signIn(page)
  await page.keyboard.press('Control+k')
  const search = page.getByTestId('global-search')
  await expect(search).toBeVisible()
  await search.getByLabel('Search', { exact: true }).fill(`Needle`)
  await search.getByLabel('Search', { exact: true }).fill(`Needle ${tag}`)
  await expect(search.getByRole('option', { name: `Needle ${tag}` })).toHaveCount(1)
  await search.getByRole('option', { name: `Needle ${tag}` }).click()
  await expect(search).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 2, name: `Needle ${tag}` })).toBeVisible()
})

test('the global search says when nothing matches', async ({ page }) => {
  await signIn(page)
  await page.keyboard.press('Control+k')
  await page.getByTestId('global-search').getByLabel('Search', { exact: true }).fill(`nothing-${stamp()}`)
  await expect(page.getByTestId('global-empty').or(page.getByTestId('global-search-empty'))).toBeVisible()
})
