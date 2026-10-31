import { expect, test } from '@playwright/test'
import { boot, filters, isMobile } from './utils'

test.beforeEach(({ page }) => boot(page))

// 1. Search, combined filters, sorting, pagination and history restoration
test('search, filters, sort and pagination live in the URL and survive history/refresh', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('nft-card').first()).toBeVisible()

  // Combined filters: category + network (API receives both params)
  let panel = await filters(page)
  const req = page.waitForRequest((r) => r.url().includes('/api/nfts?') && r.url().includes('category=arte-digital'))
  await panel.getByRole('button', { name: /^Arte digital/ }).click()
  await req
  await expect(page).toHaveURL(/category=arte-digital/)
  if (isMobile(page)) panel = page.getByRole('dialog')
  const req2 = page.waitForRequest((r) => /category=arte-digital/.test(r.url()) && /network=ethereum/.test(r.url()))
  await panel.getByRole('button', { name: /^Ethereum/ }).click()
  await req2
  await expect(page).toHaveURL(/network=ethereum/)
  if (isMobile(page)) await page.getByRole('button', { name: 'Ver resultados' }).click()
  await expect(page.getByTestId('nft-card')).toHaveCount(2)

  // Clear filters, sort by lowest price
  await page.goto('/')
  if (isMobile(page)) {
    await page.getByRole('button', { name: 'Filtros e ordenação' }).click()
  }
  await page.getByRole('combobox', { name: 'Ordenar por' }).click()
  await page.getByRole('option', { name: 'Menor preço' }).click()
  await expect(page).toHaveURL(/sort=price-asc/)
  if (isMobile(page)) await page.getByRole('button', { name: 'Ver resultados' }).click()
  await expect(page.getByTestId('nft-card').first()).toContainText('Citrus Loop #999')

  // Pagination, then a filter change resets it
  const pageOneFirst = (await page.getByTestId('nft-card').first().textContent())!
  await page.getByRole('link', { name: 'Página 2' }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.getByTestId('nft-card').first()).not.toHaveText(pageOneFirst) // placeholder replaced
  const pageTwoFirst = await page.getByTestId('nft-card').first().textContent()
  await page.getByRole('tab', { name: 'Em alta' }).click()
  await expect(page).toHaveURL(/tab=trending/)
  await expect(page).not.toHaveURL(/page=/)

  // History restores the previous state; refresh keeps it
  await page.goBack()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.getByTestId('nft-card').first()).toHaveText(pageTwoFirst!)
  await page.reload()
  await expect(page).toHaveURL(/sort=price-asc.*page=2|page=2.*sort=price-asc/)
  await expect(page.getByTestId('nft-card').first()).toHaveText(pageTwoFirst!)
})

test('search by name and empty results', async ({ page }) => {
  await page.goto('/')
  if (isMobile(page)) {
    await page.getByRole('searchbox', { name: 'Explorar coleções' }).fill('neon')
  } else {
    await page.getByRole('button', { name: 'Buscar NFTs' }).click()
    await page.getByLabel('Termo de busca').fill('neon')
    await page.getByLabel('Termo de busca').press('Enter')
  }
  await expect(page).toHaveURL(/q=neon/)
  await expect(page.getByTestId('nft-card')).toHaveCount(1)
  await expect(page.getByTestId('nft-card').first()).toContainText('Neon Vessel #552')

  await page.goto('/?q=zzzz-nada')
  await expect(page.getByText('Nenhum NFT encontrado')).toBeVisible()
  await page.getByRole('button', { name: 'Limpar filtros' }).click()
  await expect(page).not.toHaveURL(/q=/)
  await expect(page.getByTestId('nft-card').first()).toBeVisible()
})
