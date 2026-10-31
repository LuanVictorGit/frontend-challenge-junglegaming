import { expect, test } from '@playwright/test'
import { boot, login, mock, USERS } from './utils'

test.beforeEach(({ page }) => boot(page))

// 3. Registration, login, session expiry, logout and user switch
test('registration validates fields and handles conflicts', async ({ page }) => {
  await page.goto('/register')
  const d = page.getByRole('dialog')
  await d.getByRole('button', { name: /Criar (conta|perfil)/ }).click()
  await expect(d.getByText('Use ao menos 3 caracteres')).toBeVisible()
  await expect(d.getByLabel('Nome de usuário')).toHaveAttribute('aria-invalid', 'true')

  await d.getByLabel('Nome de usuário').fill('nova.colecionadora')
  await d.getByLabel('E-mail', { exact: true }).fill(USERS.ana[0]) // already registered
  await d.getByLabel('Senha', { exact: true }).fill('Segura123')
  await d.getByLabel('Confirmar senha').fill('Segura123')
  await d.getByRole('button', { name: /Criar (conta|perfil)/ }).click()
  await expect(d.getByText('E-mail já cadastrado')).toBeVisible()

  await d.getByLabel('E-mail', { exact: true }).fill('nova@kurio.test')
  await d.getByRole('button', { name: /Criar (conta|perfil)/ }).click()
  await expect(page.getByText('Conta criada com sucesso!')).toBeVisible()
  await expect(page).toHaveURL('/')
})

test('invalid login, session expiry with return path, logout and user switch', async ({ page }) => {
  await page.goto('/login')
  const d = page.getByRole('dialog')
  await d.getByLabel('E-mail', { exact: true }).fill(USERS.ana[0])
  await d.getByLabel('Senha', { exact: true }).fill('errada123')
  await d.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(d.getByRole('alert')).toHaveText('E-mail ou senha inválidos.')

  await login(page, 'ana')
  await page.goto('/profile')
  await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana Lima')

  // Expire the session on the server, then navigate inside a private area
  await mock(page, (m) => m.expireSessions())
  await page.getByRole('link', { name: 'Carteiras' }).first().click()
  await expect(page).toHaveURL(/\/login\?redirect=%2Fwallets/)
  await expect(page.getByText('Sua sessão expirou. Entre novamente para continuar.')).toBeVisible()
  await login(page, 'ana')
  await expect(page).toHaveURL(/\/wallets$/)

  // Logout clears private data; another user does not see Ana's favorites
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByText('Você saiu da sua conta.')).toBeVisible()
  await login(page, 'bruno')
  await page.goto('/nft/emerald-ape-042')
  await expect(page.locator('[data-testid="favorite"]:visible')).toHaveAttribute('aria-pressed', 'false')
})
