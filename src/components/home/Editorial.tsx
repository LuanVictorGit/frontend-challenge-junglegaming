import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { NftImage } from '@/components/common/NftImage'
import { soon } from '@/lib/utils'

const PROMOS = [
  { image: 'emerald', title: 'Lançamentos gênesis de edição limitada', text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.', tab: 'new' as const },
  { image: 'ivory', title: 'Arte digital selecionada e muito mais', text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.', tab: 'trending' as const },
]

const POSTS = [
  { image: 'ivory', date: '12 de setembro', read: 6, title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.' },
  { image: 'emerald', date: '13 de setembro', read: 2, title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.' },
  { image: 'sage', date: '15 de setembro', read: 3, title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.' },
  { image: 'golden', date: '15 de setembro', read: 2, title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.' },
]

export function Promos() {
  return (
    <section aria-label="Coleções em destaque" className="container-k mt-20 grid gap-4 md:grid-cols-2">
      {PROMOS.map((p) => (
        <article key={p.title} className="grid grid-cols-[40%_1fr] overflow-hidden rounded-sm bg-card">
          <NftImage image={p.image} alt="" sizes="(min-width: 768px) 240px, 40vw" className="h-full rounded-xl" />
          <div className="flex flex-col items-end justify-center gap-2 p-4 text-right">
            <h2 className="text-sm leading-snug font-bold">{p.title}</h2>
            <p className="text-xs leading-relaxed text-sand">{p.text}</p>
            <Link to="/" search={{ tab: p.tab }} hash="catalogo" className="mt-2 inline-flex h-8 items-center gap-1 rounded-xs bg-primary px-4 text-xs font-bold text-primary-foreground hover:brightness-110">
              Explorar <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </article>
      ))}
    </section>
  )
}

export function Journal() {
  return (
    <section aria-labelledby="journal" className="container-k mt-20">
      <h2 id="journal" className="text-center text-xl font-bold">Diário da Cunhagem</h2>
      <p className="mt-2 text-center text-xs text-sand">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {POSTS.map((p) => (
          <li key={p.title}>
            <article className="h-full overflow-hidden rounded-sm bg-card">
              <NftImage image={p.image} alt="" sizes="(min-width: 768px) 280px, 45vw" className="aspect-[3/2]" />
              <div className="space-y-2 p-3">
                <p className="text-[11px] text-sand">
                  {p.date} <span aria-hidden="true">|</span> Leitura de {p.read} min
                </p>
                <h3 className="text-sm leading-snug font-bold">{p.title}</h3>
                <p className="text-[11px] leading-relaxed text-sand">{p.text}</p>
                <button type="button" onClick={() => soon('O Diário da Cunhagem')} className="text-[11px] font-bold text-primary hover:underline">
                  Ler mais <span aria-hidden="true">→</span>
                  <span className="sr-only">: {p.title}</span>
                </button>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
