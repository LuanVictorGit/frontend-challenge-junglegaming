import { cn } from '@/lib/utils'

const WIDTHS = [320, 480, 640, 960]
// Only known artwork keys are rendered (the API returns a key, never an arbitrary URL).
const src = (key: string, w: number) => `/images/nft/${/^[a-z]+$/.test(key) ? key : 'emerald'}-${w}.webp`

type Props = { image: string; alt: string; sizes: string; priority?: boolean; className?: string; style?: React.CSSProperties }

export function NftImage({ image, alt, sizes, priority, className, style }: Props) {
  return (
    <img
      src={src(image, 640)}
      srcSet={WIDTHS.map((w) => `${src(image, w)} ${w}w`).join(', ')}
      sizes={sizes}
      alt={alt}
      width={640}
      height={640}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      draggable={false}
      style={style}
      className={cn('aspect-square w-full bg-muted object-cover', className)}
    />
  )
}
