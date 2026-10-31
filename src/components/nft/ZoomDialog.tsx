import type { RefObject } from 'react'
import { NftImage } from '@/components/common/NftImage'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

type Props = { open: boolean; onOpenChange: (open: boolean) => void; image: string; name: string; returnFocus: RefObject<HTMLButtonElement | null> }

/** Enlarged artwork (desktop), loaded on first use; focus returns to the zoom button on close. */
export function ZoomDialog({ open, onOpenChange, image, name, returnFocus }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(92vw,720px)] bg-card p-3 sm:max-w-[720px]" onCloseAutoFocus={(e) => (e.preventDefault(), returnFocus.current?.focus())}>
        <DialogTitle className="sr-only">{name}</DialogTitle>
        <DialogDescription className="sr-only">Imagem ampliada do NFT</DialogDescription>
        <NftImage image={image} alt={name} sizes="720px" className="rounded-md" />
      </DialogContent>
    </Dialog>
  )
}
