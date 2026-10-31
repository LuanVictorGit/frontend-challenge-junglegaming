import { expect, test } from '@playwright/test'
import { addToCart, boot, isMobile, mock } from './utils'

// 11. Keyboard navigation, dialog focus and form validation
test('skip link, dialog focus trap/return and accessible form errors', async ({ page }) => {
  await boot(page)
  await page.goto('/')
  await expect(page.getByTestId('nft-card').first()).toBeVisible() // app rendered
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused()

  const trigger = isMobile(page) ? page.getByRole('button', { name: 'Explorar coleções' }) : page.getByRole('button', { name: 'Buscar NFTs' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Buscar NFTs' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Termo de busca')).toBeFocused()
  for (let i = 0; i < 4; i++) await page.keyboard.press('Tab')
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true) // focus stays inside
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()

  await page.goto('/login')
  await page.getByRole('dialog').getByRole('button', { name: 'Entrar', exact: true }).click()
  const email = page.getByRole('dialog').getByLabel('E-mail', { exact: true })
  await expect(email).toHaveAttribute('aria-invalid', 'true')
  const describedBy = await email.getAttribute('aria-describedby')
  await expect(page.locator(`[id="${describedBy}"]`)).toHaveText('E-mail inválido')
})

test('the main flow works with the keyboard alone', async ({ page }) => {
  await boot(page)
  await page.goto('/')
  await expect(page.getByTestId('nft-card')).toHaveCount(9)
  // Arrow keys: carousel dots, then the catalog lists (one Tab stop; ←/→ and Home switch the list)
  await page.getByRole('button', { name: 'Destaque 1 de 3' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('button', { name: 'Destaque 2 de 3' })).toBeFocused()
  await expect(page.getByRole('button', { name: 'Destaque 2 de 3' })).toHaveAttribute('aria-current', 'true')
  await page.getByRole('tab', { name: 'Todos os NFTs' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(/tab=new/)
  await expect(page.getByRole('tab', { name: 'Novos lançamentos' })).toBeFocused()
  await page.keyboard.press('Home')
  await expect(page).not.toHaveURL(/tab=/)
  // Card grid: a single Tab stop; arrows follow the visible columns (3 on desktop, 2 on mobile), Home goes back
  const results = page.getByRole('list', { name: 'Resultados' })
  const cards = results.locator('[data-card-link]')
  await expect(results.locator('[data-card-link][tabindex="0"]')).toHaveCount(1)
  await cards.first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(cards.nth(1)).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(cards.nth(isMobile(page) ? 3 : 4)).toBeFocused()
  await page.keyboard.press('Home')
  await expect(cards.first()).toBeFocused()
  // Card → detail with Enter; focus moves to the new page
  await page.getByRole('link', { name: 'Emerald Ape #042', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/nft\/emerald-ape-042/)
  await expect(page.locator('main')).toBeFocused()
  // Edition radio group and tabs with arrow keys; the focused tab panel shows a focus ring
  const edition = page.locator('input[name=edition]:checked')
  const before = await edition.getAttribute('value')
  await edition.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('input[name=edition]:checked')).not.toHaveAttribute('value', before!)
  // Quantity with ↑ (focus stays on the button); gallery views with ↓ on desktop
  await page.getByRole('button', { name: /^Aumentar quantidade/ }).locator('visible=true').focus()
  await page.keyboard.press('ArrowUp')
  await expect(page.getByRole('group', { name: 'Emerald Ape #042' }).locator('visible=true').locator('output')).toHaveText('2')
  if (!isMobile(page)) {
    await page.getByRole('tab', { name: 'Obra completa' }).focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('tab', { name: 'Detalhe do rosto' })).toHaveAttribute('aria-selected', 'true')
  }
  const info = page.locator('#avaliacoes')
  await info.getByRole('tab', { selected: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(info.getByRole('tab', { selected: true })).toContainText('Avaliações')
  await page.keyboard.press('Tab')
  await expect(info.getByRole('tabpanel')).toBeFocused()
  expect(await info.getByRole('tabpanel').evaluate((p) => getComputedStyle(p).outlineStyle)).not.toBe('none')
  // Buy with Enter, then apply a coupon with Enter
  await page.getByRole('button', { name: /^(COMPRAR|Comprar NFT)$/ }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/cart/)
  await page.getByLabel('Código promocional').locator('visible=true').focus()
  await page.keyboard.type('KURIO10')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Remover cupom KURIO10' }).locator('visible=true')).toBeVisible()
  // Sort select (desktop) or the filter drawer (mobile), operated by keyboard
  await page.goto('/')
  if (isMobile(page)) {
    const filters = page.locator('button[aria-label="Filtros e ordenação"]')
    await filters.focus()
    await page.keyboard.press('Enter')
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    await drawer.getByRole('button', { name: /^Arte digital/ }).focus()
    await page.keyboard.press('ArrowDown')
    await expect(drawer.getByRole('button', { name: /^Fotografia/ })).toBeFocused()
    for (let i = 0; i < 12; i++) await page.keyboard.press('Tab')
    expect(await drawer.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expect(filters).toBeFocused()
  } else {
    await page.getByRole('button', { name: /^Arte digital/ }).focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('button', { name: /^Fotografia/ })).toBeFocused()
    const sort = page.getByRole('combobox', { name: 'Ordenar por' })
    await sort.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('option', { name: 'Listados recentemente' })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('option', { name: 'Menor preço' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/sort=price-asc/)
    await expect(sort).toBeFocused()
  }
})

// 12. Skeletons on slow loading, failure feedback and retry
test('skeletons on slow network, then error feedback and recovery on retry', async ({ page }) => {
  await boot(page, { latency: [1500, 1500] })
  await page.goto('/')
  await expect(page.getByTestId('nft-card-skeleton').first()).toBeVisible()
  await expect(page.getByTestId('nft-card').first()).toBeVisible({ timeout: 10_000 })

  await page.goto('/nft/emerald-ape-042')
  await expect(page.getByLabel('Carregando NFT')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible({ timeout: 10_000 })

  await addToCart(page, 'emerald-ape-042')
  await page.reload()
  await expect(page.getByLabel('Carregando carrinho')).toBeVisible()

  // Three 503s exhaust the automatic retries → error state → manual retry succeeds
  await mock(page, (m) => {
    m.setLatency(0)
    m.failNext({ method: 'GET', path: '^/nfts\\?.*tab=new', status: 503, times: 3 })
  })
  // Client-side navigation keeps the in-page mock state; a new query key forces a request.
  await page.getByRole('link', { name: 'Início' }).first().click()
  await page.getByRole('tab', { name: 'Novos lançamentos' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Algo deu errado' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByTestId('nft-card').first()).toBeVisible()
})
