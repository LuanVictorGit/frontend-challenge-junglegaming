import { expect, test } from '@playwright/test'
import { boot, login } from './utils'

test.beforeEach(({ page }) => boot(page))

// 1×1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

// 8. Profile, avatar, password and wallets, with validation errors
test('profile edits validate locally and on the API, and persist', async ({ page }) => {
  await login(page)
  await page.goto('/profile')
  const name = page.getByLabel('Nome de exibição')
  await name.fill('A')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Use ao menos 2 caracteres')).toBeVisible()

  await name.fill('Ana Colecionadora')
  await page.getByLabel('Nome de usuário').fill('bruno.nft') // taken → 409 from the API
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Nome de usuário indisponível')).toBeVisible()

  await page.getByLabel('Nome de usuário').fill('ana.colecionadora')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Perfil atualizado.')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana Colecionadora')

  // Avatar: invalid file rejected, PNG accepted
  const file = page.locator('input[type=file]')
  await file.setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') })
  await expect(page.getByText('Envie PNG, JPG ou WEBP.')).toBeVisible()
  await file.setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByText('Avatar atualizado.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remover' })).toBeEnabled()
})

test('password change checks the current password on the API', async ({ page }) => {
  await login(page)
  await page.goto('/profile')
  await page.getByLabel('Senha atual').fill('Errada123')
  await page.getByLabel('Nova senha', { exact: true }).fill('NovaSenha123')
  await page.getByLabel('Confirmar nova senha').fill('NovaSenha123')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Senha atual incorreta').first()).toBeVisible()

  await page.getByLabel('Senha atual').fill('Kurio@123')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Perfil e senha atualizados.')).toBeVisible()
})

test('wallets validate the address and persist after refresh', async ({ page }) => {
  await login(page, 'bruno')
  await page.goto('/wallets')
  const primary = page.getByRole('form', { name: 'Carteira principal' })
  await primary.getByLabel('Endereço da carteira').fill('0x123')
  await primary.getByRole('button', { name: 'Salvar carteira' }).click()
  await expect(primary.getByText('Endereço 0x inválido (40 caracteres hex)')).toBeVisible()

  await primary.getByLabel('Endereço da carteira').fill('0x1111111111111111111111111111111111111111')
  await primary.getByLabel('Apelido da carteira').fill('Cofre')
  await primary.getByRole('button', { name: 'Salvar carteira' }).click()
  await expect(page.getByText('Carteira salva.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('form', { name: 'Carteira principal' }).getByLabel('Apelido da carteira')).toHaveValue('Cofre')
})
