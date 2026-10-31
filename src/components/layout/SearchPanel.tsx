import { useState, type RefObject } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

type Props = { open: boolean; onOpenChange: (open: boolean) => void; initial: string; returnFocus: RefObject<HTMLButtonElement | null> }

/** Search dialog body (Radix Dialog), loaded on first use; focus returns to the trigger on close. */
export function SearchPanel({ open, onOpenChange, initial, returnFocus }: Props) {
  const [q, setQ] = useState(initial)
  const [shown, setShown] = useState(open)
  if (open !== shown) {
    setShown(open)
    if (open) setQ(initial) // every opening starts from the current URL term
  }
  const navigate = useNavigate()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          returnFocus.current?.focus()
        }}
        className="top-24 translate-y-0 bg-card sm:max-w-lg"
      >
        <DialogTitle>Buscar NFTs</DialogTitle>
        <DialogDescription>Pesquise por nome, coleção ou ID do token.</DialogDescription>
        <form
          role="search"
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            onOpenChange(false)
            navigate({ to: '/', search: (s) => ({ ...s, q: q.trim() || undefined, page: undefined }), hash: 'catalogo' })
          }}
        >
          <label htmlFor="global-search" className="sr-only">Termo de busca</label>
          <Input id="global-search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} maxLength={60} placeholder="Ex.: Emerald Ape" />
          <Button type="submit" aria-label="Buscar">
            <Search />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
