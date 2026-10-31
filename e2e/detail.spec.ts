import { expect, test } from '@playwright/test'
import { boot } from './utils'

test.beforeEach(({ page }) => boot(page))

// 2. Direct access to the detail page and non-existent resources
test('direct access renders the NFT with editions, sold-out edition and quantity limit', async ({ page }) => {
  await page.goto('/nft/cosmic-bloom-118')
  await expect(page.getByRole('heading', { level: 1, name: 'Cosmic Bloom #118' })).toBeVisible()
  // 1/1 edition is sold out (unavailable edition)
  await expect(page.locator('input[name=edition][value="1-1"]')).toBeDisabled()
  // 1/10 edition allows at most 3 per order
  await page.locator('input[name=edition][value="1-10"]').check({ force: true })
  const plus = page.getByRole('button', { name: 'Aumentar quantidade de Cosmic Bloom #118' })
  await plus.click()
  await plus.click()
  await expect(plus).toBeDisabled()
  await expect(page.getByRole('group', { name: 'Cosmic Bloom #118' }).locator('output')).toHaveText('3')
})

test('unknown NFT and unknown route show not-found states', async ({ page }) => {
  await page.goto('/nft/nao-existe-000')
  await expect(page.getByText('NFT não encontrado')).toBeVisible()
  await page.goto('/rota/inexistente')
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
})
