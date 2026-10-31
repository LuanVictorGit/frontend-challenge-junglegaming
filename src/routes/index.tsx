import { createFileRoute } from '@tanstack/react-router'
import { highlightsQuery, nftListQuery } from '@/api/queries'
import { Catalog, HomeSearch, MobileSearchBar, toListParams } from '@/components/catalog/Catalog'
import { Deferred, useTitle } from '@/components/common/PageBits'
import { Journal, Promos } from '@/components/home/Editorial'
import { Hero } from '@/components/home/Hero'
import { useMedia } from '@/lib/use-media'

export const Route = createFileRoute('/')({
  validateSearch: HomeSearch,
  loaderDeps: ({ search }) => search,
  // Start fetching before render (non-blocking: the page shows skeletons meanwhile).
  loader: ({ context: { queryClient }, deps }) => {
    queryClient.prefetchQuery(nftListQuery(toListParams(deps)))
    queryClient.prefetchQuery(highlightsQuery())
  },
  component: Home,
})

function Home() {
  const search = Route.useSearch()
  useTitle('')
  const desktop = useMedia('(min-width: 768px)')
  return (
    <>
      {!desktop && <MobileSearchBar search={search} />}
      <Hero />
      <Catalog search={search} />
      <Deferred>
        <Promos />
        <Journal />
      </Deferred>
    </>
  )
}
