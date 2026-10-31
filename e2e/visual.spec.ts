import { expect, test, type Page } from '@playwright/test'
import { addToCart, boot, login } from './utils'

// Visual regression (versioned baselines in e2e/visual.spec.ts-snapshots, deterministic fixtures).
const settle = async (page: Page) => {
  // Full-page shots: load lazy images up front, then wait for images and fonts.
  await page.evaluate(() => document.querySelectorAll<HTMLImageElement>('img[loading=lazy]').forEach((i) => (i.loading = 'eager')))
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(() => [...document.images].every((i) => i.complete))
  await page.evaluate(() => document.fonts.ready)
}
const shot = { fullPage: true, mask: [] as never[] }

test.beforeEach(({ page }) => boot(page))

test('home', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('nft-card')).toHaveCount(9)
  await settle(page)
  await expect(page).toHaveScreenshot('home.png', shot)
})

test('nft detail', async ({ page }) => {
  await page.goto('/nft/emerald-ape-042')
  await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
  await settle(page)
  await expect(page).toHaveScreenshot('detail.png', shot)
})

test('cart', async ({ page }) => {
  await addToCart(page, 'emerald-ape-042')
  await addToCart(page, 'sage-nomad-009')
  await page.reload()
  await expect(page.getByTestId('cart-row').locator('visible=true')).toHaveCount(2)
  await settle(page)
  await expect(page).toHaveScreenshot('cart.png', { ...shot, mask: [page.locator('[data-sonner-toaster]')] })
})

test('checkout', async ({ page }) => {
  await login(page)
  await addToCart(page, 'emerald-ape-042')
  await page.goto('/checkout')
  await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
  await settle(page)
  await expect(page).toHaveScreenshot('checkout.png', { ...shot, mask: [page.locator('[data-sonner-toaster]')] })
})
