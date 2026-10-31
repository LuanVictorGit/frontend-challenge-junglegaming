import { expect, type Page } from '@playwright/test'

export const USERS = { ana: ['ana@kurio.test', 'Kurio@123'], bruno: ['bruno@kurio.test', 'Kurio@456'] } as const

/** Fresh, deterministic mock backend per test (each test has its own browser context/storage). */
export async function boot(page: Page, { scenario = 'default', latency = [0, 0] as [number, number] } = {}) {
  await page.addInitScript(
    ({ scenario, latency }) => {
      if (sessionStorage.getItem('e2e:init')) return
      sessionStorage.setItem('e2e:init', '1')
      localStorage.setItem('kurio:mock', JSON.stringify({ scenario, seed: 42, latency }))
    },
    { scenario, latency },
  )
}

/** Runs a mock-control command (server-side mutation; events still flow through socket.io-client). */
export async function mock<T>(page: Page, fn: (m: NonNullable<Window['__mock']>) => T) {
  await page.waitForFunction(() => !!window.__mock)
  return page.evaluate(`(${fn.toString()})(window.__mock)`) as Promise<T>
}

export async function login(page: Page, user: keyof typeof USERS = 'ana') {
  if (!page.url().includes('/login')) await page.goto('/login')
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('E-mail', { exact: true }).fill(USERS[user][0])
  await dialog.getByLabel('Senha', { exact: true }).fill(USERS[user][1])
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText(/Bem-vindo\(a\)/)).toBeVisible()
}

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768

/** Filters live in the sidebar (desktop) or in a drawer (mobile). */
export async function filters(page: Page) {
  if (!isMobile(page)) return page.getByRole('complementary', { name: 'Filtros' })
  await page.getByRole('button', { name: 'Filtros e ordenação' }).click()
  return page.getByRole('dialog')
}

export async function addToCart(page: Page, id: string, edition?: string) {
  await page.goto(`/nft/${id}`)
  if (edition) await page.locator(`input[name=edition][value="${edition}"]`).check({ force: true })
  await page.getByRole('button', { name: /^(COMPRAR|Comprar NFT)$/ }).click()
  await expect(page).toHaveURL(/\/cart$/)
}

/** From an authenticated cart to the review dialog. */
export async function openReview(page: Page) {
  await page.goto('/checkout')
  await page.getByRole('button', { name: /^Conectar MetaMask$/ }).click()
  await expect(page.getByText(/Conectada via MetaMask/)).toBeVisible()
  await page.getByRole('button', { name: 'Revisar pedido' }).click()
  const review = page.getByRole('dialog', { name: 'Revise seu pedido' })
  await expect(review).toBeVisible()
  return review
}

export const cardPrice = (page: Page, name: string) =>
  page.getByTestId('nft-card').filter({ has: page.getByRole('link', { name, exact: true }) }).locator('p').first()
