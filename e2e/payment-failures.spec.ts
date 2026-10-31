import { expect, test } from '@playwright/test'
import { addToCart, boot, login, openReview } from './utils'

// 7. Declined payment, repeated clicks and timeout recovered by idempotency
test('declined payment keeps the items in the cart', async ({ page }) => {
  await boot(page, { scenario: 'payment-declined' })
  await login(page)
  await addToCart(page, 'golden-beat-207')
  const review = await openReview(page)
  await review.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByTestId('order-declined')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/Seus itens continuam no carrinho/)).toBeVisible()
  await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
  await expect(page.getByTestId('cart-row').locator('visible=true')).toHaveCount(1)
})

test('repeated clicks send a single order request', async ({ page }) => {
  await boot(page, { latency: [400, 400] })
  await login(page)
  await addToCart(page, 'golden-beat-207')
  const orders: string[] = []
  page.on('request', (r) => r.method() === 'POST' && r.url().endsWith('/api/orders') && orders.push(r.headers()['idempotency-key']))
  const review = await openReview(page)
  const confirm = review.getByRole('button', { name: 'Confirmar compra' })
  await confirm.dblclick() // second click lands on the already-disabled button
  await expect(page).toHaveURL(/\/orders\/ord_/)
  expect(orders).toHaveLength(1)
})

test('a timeout after the order is created recovers the same order', async ({ page }) => {
  await boot(page, { scenario: 'order-timeout' })
  await page.clock.install()
  await login(page)
  await addToCart(page, 'golden-beat-207')
  const keys: string[] = []
  page.on('request', (r) => r.method() === 'POST' && r.url().endsWith('/api/orders') && keys.push(r.headers()['idempotency-key']))
  const review = await openReview(page)
  await review.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect.poll(() => keys.length).toBe(1)
  // The server committed the order but holds the response: jump past the 8s client timeout.
  await page.clock.fastForward('00:09')
  await expect(page.getByText(/Recuperando o pedido com segurança/).first()).toBeVisible()
  await page.clock.fastForward('00:02')
  await expect(page).toHaveURL(/\/orders\/ord_/)
  expect(keys.length).toBeGreaterThanOrEqual(2)
  expect(new Set(keys).size).toBe(1) // same Idempotency-Key → same order, no duplicate
  await page.clock.fastForward('00:05')
  await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 15_000 })
})
