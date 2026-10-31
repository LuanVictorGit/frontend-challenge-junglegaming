import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { NftImage } from '@/components/common/NftImage'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Editorial hero slides (marketing content, not catalog data).
const SLIDES = [
  { image: 'emerald', title: 'Seja dono do futuro da arte digital', short: 'Seja dono da cultura digital', alt: 'Emerald Ape: macaco de óculos redondos e jaqueta verde' },
  { image: 'ivory', title: 'Colecione edições raras e limitadas', short: 'Edições raras e limitadas', alt: 'Ivory Baron: chimpanzé de blazer creme e gola alta' },
  { image: 'golden', title: 'Apoie criadores e a nova cultura', short: 'Apoie novos criadores', alt: 'Golden Beat: orangotango com fones de ouvido' },
]

function Dots({ i, set, className }: { i: number; set: (n: number) => void; className?: string }) {
  return (
    <div className={cn('flex gap-2', className)}>
      {SLIDES.map((s, n) => (
        <button
          key={s.image}
          type="button"
          onClick={() => set(n)}
          aria-label={`Destaque ${n + 1} de ${SLIDES.length}`}
          aria-current={n === i}
          className={cn('size-2 rounded-full bg-primary transition-opacity', n === i ? 'opacity-100' : 'opacity-50 hover:opacity-80')}
        />
      ))}
    </div>
  )
}

export function Hero() {
  const [i, setI] = useState(0)
  const s = SLIDES[i]
  return (
    <section aria-roledescription="carrossel" aria-label="Destaques da Kurio" className="container-k">
      {/* Desktop (Figma: Desktop / Início) */}
      <div className="hidden grid-cols-[1fr_450px] items-center gap-10 py-12 md:grid">
        <div className="relative flex h-full flex-col justify-center lg:pl-10">
          <p className="text-base">Bem-vindo à Kurio</p>
          <h1 className="mt-5 max-w-[600px] text-[40px] leading-[1.45] font-bold tracking-wide uppercase lg:text-[48px]">{s.title}</h1>
          <p className="mt-3 max-w-[570px] text-[15px] leading-6 text-sand">
            Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.
          </p>
          <Button asChild size="lg" className="mt-9 w-[140px] text-base font-bold">
            <a href="#catalogo">EXPLORAR</a>
          </Button>
          <Dots i={i} set={setI} className="absolute right-0 bottom-0" />
        </div>
        <div className="overflow-hidden rounded-2xl">
          <NftImage image={s.image} alt={s.alt} sizes="450px" priority={i === 0} />
        </div>
      </div>
      {/* Mobile (Figma: Mobile / Início) */}
      <div className="relative mt-4 overflow-hidden rounded-2xl bg-[radial-gradient(120%_120%_at_30%_40%,#7a4f2d_0%,#4a2e1b_45%,#2a1810_100%)] p-4 md:hidden">
        <div className="grid grid-cols-[1fr_42%] gap-3">
          <div>
            <p className="text-[11px]">Bem-vindo à Kurio</p>
            <h1 className="mt-2 text-lg leading-snug font-bold uppercase">{s.short}</h1>
            <p className="mt-2 text-xs leading-relaxed text-sand">Descubra NFTs selecionados de criadores do mundo todo.</p>
            <a href="#catalogo" className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-primary">
              EXPLORAR <ArrowRight className="size-4" />
            </a>
          </div>
          <div className="relative">
            <NftImage image={s.image} alt={s.alt} sizes="40vw" priority={i === 0} className="rounded-xl" />
            <NftImage image={SLIDES[(i + 1) % 3].image} alt="" sizes="20vw" className="absolute -bottom-2 -left-4 w-1/2 rounded-lg ring-2 ring-[#4a2e1b]" />
          </div>
        </div>
        <Dots i={i} set={setI} className="mt-3 justify-center" />
      </div>
    </section>
  )
}
