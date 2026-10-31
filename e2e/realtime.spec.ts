import { expect, test } from '@playwright/test'
import { addToCart, boot, cardPrice, login, mock, openReview } from './utils'

test.beforeEach(({ page }) => boot(page))

// 9. Price/availability change via Socket.IO during checkout
test('a price change in the cart is announced and blocks the stale quote at checkout', async ({ page }) => {
  await login(page)
  await addToCart(page, 'emerald-ape-042')
  await expect(page.getByTestId('total').locator('visible=true')).toHaveText('1.206 ETH')

  // Cart open: the change is announced and the summary updated from the API
  await mock(page, (m) => m.updateNft('emerald-ape-042', { price: '1.30' }))
  await expect(page.getByText(/preço alterado de 1.19 para 1.30 ETH/).first()).toBeVisible()
  await expect(page.getByTestId('total').locator('visible=true')).toHaveText('1.316 ETH')

  // Checkout: a change while reviewing makes the quote stale
  const review = await openReview(page)
  await expect(review).toContainText('1.316 ETH')
  await mock(page, (m) => m.updateNft('emerald-ape-042', { price: '1.40' }))
  await expect(review.getByText(/mudou agora/)).toBeVisible()
  await expect(review.getByRole('button', { name: 'Confirmar compra' })).toHaveCount(0)
  await review.getByRole('button', { name: 'Atualizar cotação' }).click()
  await expect(review).toContainText('1.416 ETH')
  await review.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page).toHaveURL(/\/orders\/ord_/)
})

test('the API rejects an outdated quote even when the event was missed', async ({ page }) => {
  await login(page)
  await addToCart(page, 'emerald-ape-042')
  const review = await openReview(page)
  // Socket down: the client never hears about the change; the server still revalidates.
  await mock(page, (m) => m.dropSockets(30_000))
  await mock(page, (m) => m.updateNft('emerald-ape-042', { stock: 1, price: '2.00' }))
  await review.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(review.getByText('Os valores mudaram desde a sua revisão:')).toBeVisible()
  await expect(review).toContainText('Emerald Ape #042: 1.19 → 2.00 ETH')
  await review.getByRole('button', { name: 'Confirmar com novos valores' }).click()
  await expect(page).toHaveURL(/\/orders\/ord_/)
})

// 10. Duplicate/old events, disconnection and pending order recovery
test('duplicate and stale events never regress the catalog', async ({ page }) => {
  await page.goto('/')
  await expect(cardPrice(page, 'Emerald Ape #042')).toHaveText('1.19 ETH')
  await mock(page, (m) => m.updateNft('emerald-ape-042', { price: '1.50' }))
  await expect(cardPrice(page, 'Emerald Ape #042')).toHaveText('1.50 ETH')
  await mock(page, (m) => m.replayLastEvent()) // duplicate
  await mock(page, (m) => m.emitStaleNft('emerald-ape-042')) // older version with price 999
  await page.waitForTimeout(500)
  await expect(cardPrice(page, 'Emerald Ape #042')).toHaveText('1.50 ETH')
})

test('a pending order survives a disconnection and a reload without a second purchase', async ({ page }) => {
  await login(page)
  await addToCart(page, 'golden-signal-160')
  const posts: string[] = []
  page.on('request', (r) => r.method() === 'POST' && r.url().endsWith('/api/orders') && posts.push(r.url()))
  const review = await openReview(page)
  await review.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByTestId('order-pending')).toBeVisible()

  // Connection drops while the order settles (no event can arrive)…
  await mock(page, (m) => m.dropSockets(5_000))
  await page.waitForTimeout(3_500)
  await expect(page.getByTestId('order-pending')).toBeVisible()
  // …after reconnecting, the client reconciles with REST
  await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 15_000 })

  await page.reload()
  await expect(page.getByTestId('order-confirmed')).toBeVisible()
  expect(posts).toHaveLength(1)
})
