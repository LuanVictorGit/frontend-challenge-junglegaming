import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { z } from 'zod'
import { PasswordInput as PasswordSchema, ProfileInput, type User } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { profileQuery, useAvatar, useChangePassword, useUid, useUpdateProfile } from '@/api/queries'
import { AccountShell } from '@/components/account/AccountShell'
import { applyServerErrors, Field, PasswordInput } from '@/components/common/Field'
import { useTitle } from '@/components/common/PageBits'
import { ErrorState } from '@/components/common/States'
import { FormFields, type FieldDef } from '@/components/form/FormFields'
import { Avatar } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_auth/profile')({ component: ProfilePage })

type P = z.input<typeof ProfileInput>
type Pw = z.input<typeof PasswordSchema>
const FIELDS: FieldDef<P>[] = [
  { name: 'displayName', label: 'Nome de exibição', required: true, autoComplete: 'name' },
  { name: 'username', label: 'Nome de usuário', required: true, autoComplete: 'username' },
  { name: 'email', label: 'E-mail', required: true, type: 'email', autoComplete: 'email' },
  { name: 'ensName', label: 'Nome ENS', type: 'ens' },
  { name: 'walletNickname', label: 'Apelido da carteira', required: true },
]
const PW_FIELDS = ['currentPassword', 'newPassword', 'confirmPassword'] as const

function ProfilePage() {
  useTitle('Perfil')
  const uid = useUid()!
  const q = useQuery(profileQuery(uid))
  return (
    <AccountShell title="Perfil do colecionador">
      {q.isPending ? (
        <div className="mt-4 grid gap-5 sm:grid-cols-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : q.isError ? (
        <ErrorState className="mt-4" message={q.error.message} onRetry={() => q.refetch()} />
      ) : (
        <ProfileForm user={q.data} />
      )}
    </AccountShell>
  )
}

function ProfileForm({ user }: { user: User }) {
  const update = useUpdateProfile()
  const password = useChangePassword()
  const avatar = useAvatar()
  const file = useRef<HTMLInputElement>(null)
  const [avatarError, setAvatarError] = useState<string>()
  const form = useForm<P>({ resolver: zodResolver(ProfileInput), defaultValues: { displayName: user.displayName, username: user.username, email: user.email, ensName: user.ensName, walletNickname: user.walletNickname } })
  const pw = useForm<Pw>({ resolver: zodResolver(PasswordSchema), defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } })
  const saving = update.isPending || password.isPending
  const { isDirty } = form.formState // read in render to subscribe

  // Client checks are UX only; the API re-validates type, size and content.
  const onFile = (f?: File) => {
    setAvatarError(undefined)
    if (!f) return
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return setAvatarError('Envie PNG, JPG ou WEBP.')
    if (f.size > 1_048_576) return setAvatarError('A imagem deve ter no máximo 1 MB.')
    const reader = new FileReader()
    reader.onload = () => avatar.mutate(String(reader.result), { onError: (e) => setAvatarError(e instanceof ApiError ? (e.fields?.dataUrl ?? e.message) : e.message) })
    reader.readAsDataURL(f)
  }

  const save = async () => {
    const pwFilled = Object.values(pw.getValues()).some(Boolean)
    const [okProfile, okPw] = await Promise.all([form.trigger(), pwFilled ? pw.trigger() : true])
    if (!okProfile || !okPw) return
    try {
      if (isDirty) form.reset(await update.mutateAsync(ProfileInput.parse(form.getValues())) as P)
      if (pwFilled) {
        await password.mutateAsync(pw.getValues())
        pw.reset()
      }
      toast.success(pwFilled ? 'Perfil e senha atualizados.' : 'Perfil atualizado.')
    } catch (e) {
      if (!(e instanceof ApiError)) return
      const fields = e.fields ?? {}
      const own = (k: string) => (PW_FIELDS as readonly string[]).includes(k)
      applyServerErrors(Object.fromEntries(Object.entries(fields).filter(([k]) => !own(k))), form.setError)
      applyServerErrors(Object.fromEntries(Object.entries(fields).filter(([k]) => own(k))), pw.setError)
      toast.error(e.message)
    }
  }

  return (
    <form noValidate onSubmit={(e) => (e.preventDefault(), save())} className="mt-4 space-y-8">
      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
        <FormFields form={form} fields={FIELDS} className="contents" />
        <div className="flex flex-col gap-1.5">
          <span className="text-xs" id="avatar-label">Avatar</span>
          <div className="flex items-center gap-4" role="group" aria-labelledby="avatar-label">
            <Avatar url={user.avatarUrl} name={user.displayName} className="size-9" />
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ''))} />
            <Button type="button" size="sm" onClick={() => file.current?.click()} disabled={avatar.isPending} aria-describedby={avatarError ? 'avatar-err' : undefined}>
              {avatar.isPending ? 'Enviando…' : 'Alterar'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => avatar.mutate(null)} disabled={!user.avatarUrl || avatar.isPending}>Remover</Button>
          </div>
          {avatarError && <p id="avatar-err" role="alert" className="text-xs text-destructive">{avatarError}</p>}
        </div>
      </div>
      <fieldset className="max-w-sm space-y-4">
        <legend className="text-sm font-bold">Alterar senha</legend>
        <Field label="Senha atual" error={pw.formState.errors.currentPassword?.message}>
          {(p) => <PasswordInput {...p} {...pw.register('currentPassword')} autoComplete="current-password" />}
        </Field>
        <Field label="Nova senha" error={pw.formState.errors.newPassword?.message} hint="Mínimo de 8 caracteres, com letras e números.">
          {(p) => <PasswordInput {...p} {...pw.register('newPassword')} autoComplete="new-password" />}
        </Field>
        <Field label="Confirmar nova senha" error={pw.formState.errors.confirmPassword?.message}>
          {(p) => <PasswordInput {...p} {...pw.register('confirmPassword')} autoComplete="new-password" />}
        </Field>
      </fieldset>
      <Button type="submit" className="w-[72px]" disabled={saving}>{saving ? '…' : 'Salvar'}</Button>
    </form>
  )
}
