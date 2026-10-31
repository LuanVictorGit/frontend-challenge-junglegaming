import { expect, test } from '@playwright/test'
import { boot, login, mock } from './utils'

test.beforeEach(({ page }) => boot(page))

const favButton = (page: import('@playwright/test').Page) => page.locator('[data-testid="favorite"]:visible')

// 4. Favorites (optimistic update), mutation failure with rollback and recovery
test('favorite persists, rolls back on failure and recovers on retry', async ({ page }) => {
  await login(page)
  await page.goto('/nft/sage-nomad-009')
  const fav = favButton(page)
  await expect(fav).toHaveAttribute('aria-pressed', 'false')

  // Failure: the optimistic state is rolled back and the user is told
  await mock(page, (m) => m.failNext({ method: 'PUT', path: '^/favorites/', status: 500 }))
  await fav.click()
  await expect(page.getByText(/Não foi possível atualizar os favoritos de Sage Nomad #009/)).toBeVisible()
  await expect(fav).toHaveAttribute('aria-pressed', 'false')

  // Retry succeeds and survives a refresh (persisted for the user)
  await fav.click()
  await expect(fav).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(favButton(page)).toHaveAttribute('aria-pressed', 'true')
})
