import { createFileRoute } from '@tanstack/react-router'
import { highlightsQuery, nftListQuery } from '@/api/queries'
import { Catalog, HomeSearch, MobileSearchBar, toListParams } from '@/components/catalog/Catalog'
import { useTitle } from '@/components/common/PageBits'
import { Journal, Promos } from '@/components/home/Editorial'
import { Hero } from '@/components/home/Hero'

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
  return (
    <>
      <MobileSearchBar search={search} />
      <Hero />
      <Catalog search={search} />
      <Promos />
      <Journal />
    </>
  )
}
