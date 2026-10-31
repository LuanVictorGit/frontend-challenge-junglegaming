import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { NftImage } from '@/components/common/NftImage'
import { Button } from '@/components/ui/button'
import { arrowNav } from '@/lib/arrow-nav'
import { useMedia } from '@/lib/use-media'
import { cn } from '@/lib/utils'

// Editorial hero slides (marketing content, not catalog data).
const SLIDES = [
  { image: 'emerald', title: 'Seja dono do futuro da arte digital', short: 'Seja dono da cultura digital', alt: 'Emerald Ape: macaco de óculos redondos e jaqueta verde' },
  { image: 'ivory', title: 'Colecione edições raras e limitadas', short: 'Edições raras e limitadas', alt: 'Ivory Baron: chimpanzé de blazer creme e gola alta' },
  { image: 'golden', title: 'Apoie criadores e a nova cultura', short: 'Apoie novos criadores', alt: 'Golden Beat: orangotango com fones de ouvido' },
]

// Slide picker: ←/→ (Home/End) move between slides, like the dots under the Figma hero.
function Dots({ i, set, className }: { i: number; set: (n: number) => void; className?: string }) {
  return (
    <div role="group" aria-label="Escolher destaque" onKeyDown={(e) => arrowNav(e, { select: true })} className={cn('flex', className)}>
      {SLIDES.map((s, n) => (
        <button key={s.image} type="button" data-roving onClick={() => set(n)} aria-label={`Destaque ${n + 1} de ${SLIDES.length}`} aria-current={n === i} className="group grid size-6 place-items-center">
          <span className={cn('h-2 rounded-full bg-primary transition-all duration-300 ease-spring', n === i ? 'w-5 opacity-100' : 'w-2 opacity-50 group-hover:opacity-80')} />
        </button>
      ))}
    </div>
  )
}

export function Hero() {
  const [i, setI] = useState(0)
  const [moved, setMoved] = useState(false) // first slide renders without animation (LCP)
  const go = (n: number) => (setI(n), setMoved(true))
  const s = SLIDES[i]
  const fx = moved ? 'animate-in fade-in-0 duration-500 ease-spring' : ''
  // Only the visible layout is rendered, so the hidden one never downloads its (eager) LCP image.
  const desktop = useMedia('(min-width: 768px)')
  return (
    <section aria-roledescription="carrossel" aria-label="Destaques da Kurio" className="container-k">
      {/* Desktop (Figma: Desktop / Início) */}
      {desktop ? (
      <div className="grid grid-cols-[1fr_320px] items-center gap-8 py-10 lg:grid-cols-[1fr_450px] lg:gap-10">
        <div className="relative flex h-full flex-col justify-center lg:pl-10">
          <p className="text-base">Bem-vindo à Kurio</p>
          <h1 key={i} className={`mt-5 max-w-[600px] text-[32px] leading-[1.45] font-bold uppercase lg:text-[44px] lg:leading-[70px] ${fx} slide-in-from-left-2`}>{s.title}</h1>
          <p className="mt-3 max-w-[570px] text-[15px] leading-6 text-sand">
            Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.
          </p>
          <Button asChild className="mt-9 h-10 w-[140px] text-base font-bold">
            <a href="#catalogo">EXPLORAR</a>
          </Button>
          <Dots i={i} set={go} className="absolute right-0 bottom-0" />
        </div>
        <div className="overflow-hidden rounded-2xl">
          <NftImage key={i} image={s.image} alt={s.alt} sizes="(min-width: 1024px) 450px, 320px" priority={i === 0} className={`${fx} zoom-in-[1.04]`} />
        </div>
      </div>
      ) : (
      /* Mobile (Figma: Mobile / Início) */
      <div className="relative mt-4 overflow-hidden rounded-2xl bg-[radial-gradient(120%_120%_at_30%_40%,#7a4f2d_0%,#4a2e1b_45%,#2a1810_100%)] p-4">
        <div className="grid grid-cols-[1fr_42%] gap-3">
          <div>
            <p className="text-[11px]">Bem-vindo à Kurio</p>
            <h1 key={i} className={`mt-2 text-lg leading-snug font-bold uppercase ${fx}`}>{s.short}</h1>
            <p className="mt-2 text-xs leading-relaxed text-sand">Descubra NFTs selecionados de criadores do mundo todo.</p>
            <a href="#catalogo" className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-primary">
              EXPLORAR <ArrowRight className="size-4" />
            </a>
          </div>
          <div className="relative">
            <NftImage key={i} image={s.image} alt={s.alt} sizes="40vw" priority={i === 0} className={`rounded-xl ${fx}`} />
            <NftImage image={SLIDES[(i + 1) % 3].image} alt="" sizes="20vw" className="absolute -bottom-2 -left-4 w-1/2 rounded-lg ring-2 ring-[#4a2e1b]" />
          </div>
        </div>
        <Dots i={i} set={go} className="mt-3 justify-center" />
      </div>
      )}
    </section>
  )
}
