import * as React from 'react'
import { Slider as SliderPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

// Adapted: each thumb gets an accessible label/value text (range sliders need distinct names).
function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbLabels = [],
  valueText,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & { thumbLabels?: string[]; valueText?: (v: number) => string }) {
  const values = Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn('relative flex h-5 w-full touch-none items-center select-none data-[disabled]:opacity-50', className)}
      {...props}
    >
      <SliderPrimitive.Track data-slot="slider-track" className="relative h-0.5 grow bg-primary/40">
        <SliderPrimitive.Range data-slot="slider-range" className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {values.map((v, i) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={i}
          aria-label={thumbLabels[i]}
          aria-valuetext={valueText?.(v)}
          className="block size-3.5 shrink-0 rounded-full border-2 border-primary bg-[#b9773f] outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
