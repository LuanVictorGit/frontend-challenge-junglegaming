import { useState, type ReactElement } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

/** Global search: submits into the catalog URL state (?q=), so it survives refresh/history. */
export function SearchDialog({ trigger }: { trigger: ReactElement }) {
  const [open, setOpen] = useState(false)
  const current = (useSearch({ strict: false }) as { q?: string }).q ?? ''
  const [q, setQ] = useState(current)
  const navigate = useNavigate()
  return (
    <Dialog open={open} onOpenChange={(o) => (setOpen(o), o && setQ(current))}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="top-24 translate-y-0 bg-card sm:max-w-lg">
        <DialogTitle>Buscar NFTs</DialogTitle>
        <DialogDescription>Pesquise por nome, coleção ou ID do token.</DialogDescription>
        <form
          role="search"
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setOpen(false)
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
