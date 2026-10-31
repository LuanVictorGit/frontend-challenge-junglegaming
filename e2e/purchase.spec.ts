import { expect, test } from '@playwright/test'
import { boot, login, openReview } from './utils'

test.beforeEach(({ page }) => boot(page))

// 6. Full purchase from the catalog to the confirmed receipt
test('buys an NFT from the catalog and shows the confirmed receipt', async ({ page }) => {
  await login(page, 'ana')
  await page.getByRole('link', { name: 'Neon Vessel #552', exact: true }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Neon Vessel #552' })).toBeVisible()
  await page.getByRole('button', { name: /^(COMPRAR|Comprar NFT)$/ }).click()
  await expect(page).toHaveURL(/\/cart$/)
  await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
  await expect(page).toHaveURL(/\/checkout$/)

  const review = await openReview(page)
  await expect(review.getByText('Neon Vessel #552')).toBeVisible()
  await review.getByRole('button', { name: 'Confirmar compra' }).click()

  await expect(page).toHaveURL(/\/orders\/ord_/)
  await expect(page.getByTestId('order-pending')).toBeVisible()
  // order.updated arrives through socket.io-client
  const receipt = page.getByTestId('order-confirmed')
  await expect(receipt).toBeVisible({ timeout: 15_000 })
  await expect(receipt.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
  await expect(receipt).toContainText('Neon Vessel #552')
  await expect(receipt).toContainText('2.006 ETH') // 1.99 + 0.016

  // Purchased items left the cart
  await page.goto('/cart')
  await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
})
