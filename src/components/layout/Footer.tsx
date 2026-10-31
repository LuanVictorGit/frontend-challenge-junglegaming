import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CATEGORY_LABEL, type Category } from '@/api/contracts'
import { FacebookIcon, InstagramIcon, LinkedinIcon, Logo, TwitterIcon, YoutubeIcon } from '@/components/common/Brand'
import { soon } from '@/lib/utils'

const FEATURES = [
  ['W', 'Segurança da carteira', 'Proteja sua carteira e colecione arte digital verificada com confiança.'],
  ['C', 'Criadores em destaque', 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.'],
  ['D', 'Alertas de lançamentos', 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.'],
] as const

const SOCIAL = [
  ['Facebook', 'https://facebook.com', FacebookIcon],
  ['Instagram', 'https://instagram.com', InstagramIcon],
  ['Twitter', 'https://twitter.com', TwitterIcon],
  ['LinkedIn', 'https://linkedin.com', LinkedinIcon],
  ['YouTube', 'https://youtube.com', YoutubeIcon],
] as const

const linkCls = 'text-xs text-foreground/90 hover:text-primary'
const Soon = ({ label }: { label: string }) => (
  <li>
    <button type="button" className={linkCls} onClick={() => soon(`“${label}”`)}>{label}</button>
  </li>
)

function Newsletter() {
  const [error, setError] = useState('')
  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        const email = new FormData(e.currentTarget).get('email')?.toString() ?? ''
        if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Informe um e-mail válido.')
        setError('')
        soon('A newsletter')
      }}
    >
      <h2 className="text-sm leading-tight font-bold">Antecipe-se ao próximo lançamento</h2>
      <div className="flex">
        <label htmlFor="newsletter" className="sr-only">E-mail para newsletter</label>
        <input
          id="newsletter"
          name="email"
          type="email"
          placeholder="digite seu e-mail..."
          aria-invalid={!!error}
          aria-describedby={error ? 'newsletter-err' : undefined}
          className="h-8 min-w-0 flex-1 rounded-l-xs bg-[#3a281f] px-3 text-xs placeholder:text-muted-foreground"
        />
        <button className="h-8 rounded-r-xs bg-primary px-3 text-xs font-bold text-primary-foreground">Enviar</button>
      </div>
      {error && <p id="newsletter-err" className="text-xs text-destructive">{error}</p>}
      <p className="text-[11px] leading-relaxed text-muted-foreground">Receba lançamentos selecionados, histórias de criadores e novidades do mercado.</p>
    </form>
  )
}

export function Footer() {
  return (
    <footer className="container-k mt-20 pb-24 md:pb-6">
      <section aria-label="Benefícios" className="grid gap-6 rounded-t-sm bg-card p-6 sm:grid-cols-2 lg:grid-cols-[repeat(3,1fr)_1.25fr] lg:gap-0 lg:px-7">
        {FEATURES.map(([letter, title, text]) => (
          <div key={title} className="lg:border-r lg:border-primary/50 lg:px-5 lg:first:pl-0">
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{letter}</span>
            <h2 className="mt-3 text-sm font-bold">{title}</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text}</p>
          </div>
        ))}
        <div className="lg:pl-5">
          <Newsletter />
        </div>
      </section>
      <div className="grid gap-3 bg-[#3b2414] px-6 py-4 text-xs sm:grid-cols-2 lg:grid-cols-4 lg:items-center lg:px-5">
        <Logo className="text-xs" />
        <p>Feito para colecionadores, criadores e cultura</p>
        <a href="mailto:contato@email.com" className="hover:text-primary">contato@email.com</a>
        <a href="tel:+551140028922" className="hover:text-primary">+55 11 4002 8922</a>
      </div>
      <div className="grid grid-cols-2 gap-8 rounded-b-sm bg-card px-6 py-6 lg:grid-cols-4 lg:px-5">
        <nav aria-label="Meu perfil">
          <h2 className="text-sm font-bold">Meu perfil</h2>
          <ul className="mt-3 space-y-2">
            <li><Link to="/profile" className={linkCls}>Meu perfil</Link></li>
            <Soon label="Minha coleção" />
            <Soon label="Atividade" />
            <Soon label="Estúdio do criador" />
            <Soon label="Lista de interesse" />
          </ul>
        </nav>
        <nav aria-label="Central de ajuda">
          <h2 className="text-sm font-bold">Central de ajuda</h2>
          <ul className="mt-3 space-y-2">
            {['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'].map((l) => <Soon key={l} label={l} />)}
          </ul>
        </nav>
        <nav aria-label="Coleções">
          <h2 className="text-sm font-bold">Coleções</h2>
          <ul className="mt-3 space-y-2">
            {(['arte-digital', 'fotografia', 'musica', 'arte-3d', 'utilidade'] as Category[]).map((c) => (
              <li key={c}>
                <Link to="/" search={{ category: c }} hash="catalogo" className={linkCls}>{CATEGORY_LABEL[c]}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="col-span-2 space-y-5 lg:col-span-1">
          <div>
            <h2 className="text-sm font-bold">Redes sociais</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {SOCIAL.map(([label, href, Icon]) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} (abre em nova aba)`} className="grid size-8 place-items-center rounded-xs border border-primary/70 text-primary hover:bg-primary/10">
                    <Icon className="size-4" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-bold">Carteiras compatíveis</h2>
            <p className="mt-3 inline-block rounded-xs bg-[#3b2414] px-3 py-1.5 text-[10px] font-bold tracking-wider text-primary">METAMASK · WALLETCONNECT · COINBASE</p>
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
