import { expect, test } from '@playwright/test'
import { addToCart, boot, login } from './utils'

test.beforeEach(({ page }) => boot(page))

// 5. Cart: quantities, removal, coupon and persistence after refresh/login
test('cart edits quantities, handles coupons and survives refresh and login', async ({ page }) => {
  await addToCart(page, 'emerald-ape-042')
  await addToCart(page, 'ivory-baron-088')
  const total = page.getByTestId('total').locator('visible=true')
  await expect(page.getByTestId('cart-row').locator('visible=true')).toHaveCount(2)
  await expect(total).toHaveText('2.996 ETH') // 1.19 + 1.79 + 0.016 fee (API values)

  await page.getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' }).click()
  await expect(total).toHaveText('4.186 ETH')
  await page.getByRole('button', { name: 'Remover Ivory Baron #088 do carrinho' }).click()
  await expect(page.getByTestId('cart-row').locator('visible=true')).toHaveCount(1)
  await expect(total).toHaveText('2.396 ETH')

  // Coupons: invalid, expired, valid, removed
  const coupon = page.getByLabel('Código promocional')
  await coupon.fill('NAOEXISTE')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Cupom inválido' })).toBeVisible()
  await coupon.fill('HALLOWEEN25')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Cupom expirado' })).toBeVisible()
  await coupon.fill('KURIO10')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByText(/Cupom KURIO10 —/)).toBeVisible()
  await expect(total).toHaveText('2.158 ETH') // 2.38 - 10% + 0.016

  // Refresh keeps the guest cart; login preserves the visitor items
  await page.reload()
  await expect(total).toHaveText('2.158 ETH')
  await login(page, 'ana')
  await page.goto('/cart')
  await expect(page.getByTestId('cart-row').locator('visible=true')).toHaveCount(1)
  await expect(page.getByRole('group', { name: 'Emerald Ape #042' }).locator('visible=true').locator('output')).toHaveText('2')
  await page.getByRole('button', { name: 'Remover cupom KURIO10' }).click()
  await expect(total).toHaveText('2.396 ETH')
})
