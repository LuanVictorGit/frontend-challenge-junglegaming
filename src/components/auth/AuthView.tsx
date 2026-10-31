import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { z } from 'zod'
import { LoginInput, RegisterInput } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { useLogin, useRegister } from '@/api/queries'
import { Catalog } from '@/components/catalog/Catalog'
import { FacebookColorIcon, GoogleIcon, Logo } from '@/components/common/Brand'
import { applyServerErrors, Field, PasswordInput } from '@/components/common/Field'
import { useTitle } from '@/components/common/PageBits'
import { Hero } from '@/components/home/Hero'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { safeRedirect } from '@/lib/session'
import { cn, soon } from '@/lib/utils'

type Mode = 'login' | 'register'

function Social() {
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-3 text-xs text-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">Ou continue com</p>
      <Button type="button" variant="secondary" className="w-full font-normal" onClick={() => soon('O login com Google')}>
        <GoogleIcon className="size-4" /> Continuar com Google
      </Button>
      <Button type="button" variant="secondary" className="w-full font-normal" onClick={() => soon('O login com Facebook')}>
        <FacebookColorIcon className="size-4" /> Continuar com Facebook
      </Button>
    </div>
  )
}

function FormError({ msg }: { msg?: string }) {
  return msg ? <p role="alert" className="rounded-sm border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">{msg}</p> : null
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const login = useLogin()
  const [error, setError] = useState<string>()
  const form = useForm<z.input<typeof LoginInput>>({ resolver: zodResolver(LoginInput), defaultValues: { email: '', password: '' } })
  const e = form.formState.errors
  const submit = form.handleSubmit((d) =>
    login.mutate(d, {
      onSuccess: (s) => (toast.success(`Bem-vindo(a), ${s.user.displayName}!`), onDone()),
      onError: (err) => (err instanceof ApiError && err.code === 'VALIDATION_ERROR' ? applyServerErrors(err.fields, form.setError) : setError(err.message)),
    }),
  )
  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <FormError msg={error} />
      <Field label="E-mail" srOnlyLabel error={e.email?.message}>
        {(p) => <Input {...p} {...form.register('email')} type="email" autoComplete="email" placeholder="contato@email.com" />}
      </Field>
      <Field label="Senha" srOnlyLabel error={e.password?.message}>
        {(p) => <PasswordInput {...p} {...form.register('password')} autoComplete="current-password" placeholder="Senha" />}
      </Field>
      <div className="text-right">
        <button type="button" className="text-xs text-primary hover:underline" onClick={() => soon('A recuperação de senha')}>Esqueceu a senha?</button>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
        {login.isPending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}

function RegisterForm({ onDone }: { onDone: () => void }) {
  const register = useRegister()
  const [error, setError] = useState<string>()
  const form = useForm<z.input<typeof RegisterInput>>({ resolver: zodResolver(RegisterInput), defaultValues: { username: '', email: '', password: '', confirmPassword: '' } })
  const e = form.formState.errors
  const submit = form.handleSubmit((d) =>
    register.mutate(d, {
      onSuccess: () => (toast.success('Conta criada com sucesso!'), onDone()),
      // 409 conflict (e-mail/usuário) and 422 come back as field errors.
      onError: (err) => (err instanceof ApiError && err.fields ? applyServerErrors(err.fields, form.setError) : setError(err.message)),
    }),
  )
  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <FormError msg={error} />
      <Field label="Nome de usuário" srOnlyLabel error={e.username?.message}>
        {(p) => <Input {...p} {...form.register('username')} autoComplete="username" placeholder="Nome de usuário" />}
      </Field>
      <Field label="E-mail" srOnlyLabel error={e.email?.message}>
        {(p) => <Input {...p} {...form.register('email')} type="email" autoComplete="email" placeholder="Digite seu e-mail" />}
      </Field>
      <Field label="Senha" srOnlyLabel error={e.password?.message} hint="Mínimo de 8 caracteres, com letras e números.">
        {(p) => <PasswordInput {...p} {...form.register('password')} autoComplete="new-password" placeholder="Senha" />}
      </Field>
      <Field label="Confirmar senha" srOnlyLabel error={e.confirmPassword?.message}>
        {(p) => <PasswordInput {...p} {...form.register('confirmPassword')} autoComplete="new-password" placeholder="Confirmar senha" />}
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={register.isPending}>
        <span className="md:hidden">{register.isPending ? 'Criando…' : 'Criar perfil'}</span>
        <span className="hidden md:inline">{register.isPending ? 'Criando…' : 'Criar conta'}</span>
      </Button>
    </form>
  )
}

/** Login/registration: modal over the home page on desktop, full screen on mobile (Figma frames). */
export function AuthView({ mode, redirect }: { mode: Mode; redirect?: string }) {
  const navigate = useNavigate()
  useTitle(mode === 'login' ? 'Entrar' : 'Criar conta')
  const done = () => navigate({ to: safeRedirect(redirect), replace: true })
  const tab = (m: Mode) => cn('font-bold', m === mode ? 'text-primary' : 'text-foreground hover:text-primary')
  return (
    <>
      <div aria-hidden="true" inert className="pointer-events-none hidden select-none md:block">
        <Hero />
        <Catalog search={{}} />
      </div>
      <Dialog open onOpenChange={(o) => !o && navigate({ to: '/' })}>
        <DialogContent className="max-h-dvh overflow-y-auto border-0 bg-card p-0 max-md:inset-0 max-md:h-dvh max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none md:max-w-[500px] md:rounded-sm">
          <div className="space-y-5 px-6 pt-16 pb-8 md:px-10 md:pt-10">
            <Logo className="block text-center text-2xl md:hidden" />
            <nav aria-label="Acesso" className="hidden justify-center gap-6 text-base md:flex">
              <Link to="/login" search={{ redirect }} replace className={tab('login')} aria-current={mode === 'login' ? 'page' : undefined}>Entrar</Link>
              <Link to="/register" search={{ redirect }} replace className={tab('register')} aria-current={mode === 'register' ? 'page' : undefined}>Criar conta</Link>
            </nav>
            <DialogTitle className="pt-8 text-center text-base font-bold md:sr-only md:pt-0">{mode === 'login' ? 'Entrar' : 'Criar perfil de colecionador'}</DialogTitle>
            <DialogDescription className="hidden text-center text-xs text-foreground md:block">
              {mode === 'login' ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.' : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'}
            </DialogDescription>
            {mode === 'login' ? <LoginForm onDone={done} /> : <RegisterForm onDone={done} />}
            <Social />
            <p className="text-center text-xs md:hidden">
              {mode === 'login' ? (
                <>Novo na Kurio? <Link to="/register" search={{ redirect }} replace className="text-primary underline underline-offset-2">Crie uma conta</Link></>
              ) : (
                <>Já tem conta? <Link to="/login" search={{ redirect }} replace className="text-primary underline underline-offset-2">Entrar</Link></>
              )}
            </p>
          </div>
          <div aria-hidden="true" className="hidden h-2 bg-primary md:block" />
        </DialogContent>
      </Dialog>
    </>
  )
}
