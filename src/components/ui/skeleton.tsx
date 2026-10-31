import { cn } from '@/lib/utils'

// Shimmer skeleton; the sweep is disabled under prefers-reduced-motion (see index.css).
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        'relative overflow-hidden rounded-md bg-muted after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-linear-to-r after:from-transparent after:via-white/[0.07] after:to-transparent motion-reduce:after:hidden',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
