// Deterministic seed data: 36 NFTs (4 Figma artworks), 2 users, wallets and coupons.
import type { Category, Network, Wallet } from '@/api/contracts'

export type DbEdition = { id: string; label: string; price: string; stock: number; supply: number | null; maxPerOrder: number }
export type DbNft = {
  id: string
  name: string
  tokenId: string
  image: string
  collection: string
  category: Category
  network: Network
  compareAtPrice: string | null
  badge: string | null
  createdAt: string
  trending: number
  rating: number
  reviewCount: number
  attributes: string[]
  editions: DbEdition[]
  defaultEditionId: string
  version: number
}
export type DbUser = {
  id: string
  email: string
  username: string
  displayName: string
  profileName: string
  ensName: string
  walletNickname: string
  avatarUrl: string | null
  salt: string
  hash: string
}
export type Coupon = { code: string; label: string; bps?: number; fixed?: string; minSubtotal?: string; expiresAt: string }

const ART = {
  emerald: { collection: 'Kurio Apes', attrs: ['Óculos', 'Esmeralda', 'Raro'] },
  sage: { collection: 'Nomad Society', attrs: ['Chapéu', 'Moletom', 'Lilás'] },
  ivory: { collection: 'Velvet Club', attrs: ['Blazer', 'Gola alta', 'Elegante'] },
  golden: { collection: 'Golden Frequencies', attrs: ['Fones', 'Âmbar', 'Ritmo'] },
} as const
type Art = keyof typeof ART

// [name, token, art, base price, compareAt?, badge?] — first rows mirror the Figma catalog order.
const ROWS: [string, number, Art, string, string?, string?][] = [
  ['Emerald Ape', 42, 'emerald', '1.19'],
  ['Sage Nomad', 9, 'sage', '1.69'],
  ['Neon Vessel', 552, 'ivory', '1.99', '2.29', 'RARO'],
  ['Cosmic Bloom', 118, 'sage', '1.29'],
  ['Violet Nomad', 314, 'sage', '1.39'],
  ['Ivory Baron', 88, 'ivory', '1.79'],
  ['Golden Beat', 207, 'golden', '0.99'],
  ['Amber Groove', 233, 'golden', '0.59'],
  ['Golden Signal', 160, 'golden', '0.39'],
  ['Jade Rebel', 17, 'emerald', '2.45', '2.80', 'RARO'],
  ['Lilac Monk', 71, 'sage', '0.89'],
  ['Onyx Curator', 640, 'ivory', '3.10'],
  ['Saffron Wave', 305, 'golden', '0.25'],
  ['Moss Pilot', 128, 'emerald', '0.75'],
  ['Plum Sage', 412, 'sage', '1.05'],
  ['Velvet Broker', 77, 'ivory', '4.60', undefined, 'RARO'],
  ['Honey Bass', 509, 'golden', '0.12'],
  ['Forest Echo', 254, 'emerald', '1.49'],
  ['Indigo Hiker', 93, 'sage', '0.68'],
  ['Noir Patron', 11, 'ivory', '8.75', '9.90'],
  ['Copper Rhythm', 360, 'golden', '0.45'],
  ['Lime Prophet', 702, 'emerald', '2.05'],
  ['Mauve Scout', 188, 'sage', '0.95'],
  ['Pearl Envoy', 451, 'ivory', '5.40'],
  ['Marigold Mix', 39, 'golden', '0.05'],
  ['Clover King', 1, 'emerald', '12.30', undefined, 'RARO'],
  ['Orchid Keeper', 266, 'sage', '1.15'],
  ['Obsidian Duke', 830, 'ivory', '6.20'],
  ['Sunset Tempo', 147, 'golden', '0.33'],
  ['Mint Courier', 590, 'emerald', '0.52'],
  ['Grape Sentinel', 222, 'sage', '0.79'],
  ['Ebony Count', 64, 'ivory', '2.95'],
  ['Citrus Loop', 999, 'golden', '0.02'],
  ['Pine Herald', 431, 'emerald', '1.85'],
  ['Iris Voyager', 377, 'sage', '0.62'],
  ['Linen Magnate', 515, 'ivory', '3.65'],
]

const CATEGORIES: Category[] = ['arte-digital', 'fotografia', 'musica', 'arte-3d', 'colecionaveis', 'generativa', 'jogos', 'assinaturas', 'utilidade']
const NETWORKS: Network[] = ['ethereum', 'ethereum', 'polygon', 'solana']

const round2 = (v: number) => (Math.round(v * 100) / 100).toFixed(2)
const day = 86_400_000
const NEWEST = Date.UTC(2026, 9, 28, 12)

export const slug = (name: string, token: number) => `${name.toLowerCase().replace(/\s+/g, '-')}-${String(token).padStart(3, '0')}`

export function seedNfts(): DbNft[] {
  return ROWS.map(([name, token, art, price, compareAt, badge], i) => {
    const base = Number(price)
    const s1 = (i * 7) % 11
    const editions: DbEdition[] = [
      { id: '1-1', label: '1/1', price: round2(base * 3.5), stock: i % 5 === 3 ? 0 : 1, supply: 1, maxPerOrder: 1 },
      { id: '1-10', label: '1/10', price: round2(base * 1.35), stock: i % 7 === 5 ? 0 : 2 + (s1 % 8), supply: 10, maxPerOrder: 3 },
      { id: '1-50', label: '1/50', price, stock: 12 + ((i * 13) % 38), supply: 50, maxPerOrder: 10 },
      { id: 'open', label: 'ABERTA', price: round2(Math.max(base * 0.6, 0.01)), stock: 500, supply: null, maxPerOrder: 20 },
    ]
    return {
      id: slug(name, token),
      name: `${name} #${String(token).padStart(3, '0')}`,
      tokenId: `#${String(token).padStart(4, '0')}`,
      image: art,
      collection: ART[art].collection,
      category: CATEGORIES[(i * 4) % 9],
      network: NETWORKS[i % 4],
      compareAtPrice: compareAt ?? null,
      badge: badge ?? null,
      createdAt: new Date(NEWEST - i * 1.7 * day).toISOString(),
      trending: (i * 37) % 100,
      rating: i === 0 ? 4.8 : Math.round((4 + ((i * 3) % 10) / 10) * 10) / 10,
      reviewCount: i === 0 ? 19 : 3 + ((i * 11) % 37),
      attributes: [...ART[art].attrs],
      editions,
      defaultEditionId: '1-50',
      version: 1,
    }
  })
}

const REVIEWS = [
  ['Marina F.', 5, 'Arte impecável e entrega instantânea na carteira. Recomendo!'],
  ['Diego R.', 4, 'Ótima coleção, procedência clara e comunidade ativa.'],
  ['Lia T.', 5, 'Os detalhes em alta resolução são incríveis.'],
  ['Caio M.', 4, 'Gostei do benefício para colecionadores, voltarei a comprar.'],
] as const

export function reviewsFor(n: DbNft) {
  return REVIEWS.slice(0, 3).map(([author, rating, comment], i) => ({
    id: `${n.id}-r${i}`,
    author,
    rating,
    comment,
    date: new Date(Date.parse(n.createdAt) + (i + 1) * 2 * day).toISOString(),
  }))
}

export function describe(n: DbNft) {
  const net = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' }[n.network]
  return {
    description: `Um colecionável digital 1/50 finalizado à mão da coleção ${n.collection}, verificado na ${net}, com arte desbloqueável e acesso para colecionadores.`,
    details: [
      `${n.name} é uma obra digital 1/50 finalizada à mão da coleção ${n.collection}. Cada atributo fica armazenado nos metadados do token e verificado na ${net}. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
      'A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. O criador recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.',
    ],
  }
}

// PBKDF2-SHA256 (100k iterations) — plaintext passwords are documented in the README only.
export const seedUsers = (): DbUser[] => [
  {
    id: 'u_ana', email: 'ana@kurio.test', username: 'ana.kurio', displayName: 'Ana Lima', profileName: 'Ana Colecionadora',
    ensName: 'ana', walletNickname: 'Cofre da Ana', avatarUrl: null,
    salt: '5f1d3a9c2b7e4f60a1c8d2e3b4f5a697', hash: 'ab60913031bbb2fa784dfe4cb99eee3387eac7f97c87d8fc439d2ee26b7c666e',
  },
  {
    id: 'u_bruno', email: 'bruno@kurio.test', username: 'bruno.nft', displayName: 'Bruno Costa', profileName: 'Bruno Collector',
    ensName: 'bruno', walletNickname: 'Principal', avatarUrl: null,
    salt: '9a8b7c6d5e4f30211234abcd5678ef90', hash: '5ad2cd6cd7824f944ae4d397e6c6b56053c99364b7149bca8bf3a82a3bfad934',
  },
]

const at = '2026-10-01T12:00:00.000Z'
export const seedWallets = (): Record<string, { primary: Wallet | null; secondary: Wallet | null }> => ({
  u_ana: {
    primary: {
      slot: 'primary', displayName: 'Ana Lima', nickname: 'Principal', network: 'ethereum', profileName: 'Ana Colecionadora',
      address: '0xa91f4b2c9d7e3f5a1b8c6d0e2f4a6b8c0d1ee82c', secondaryAddress: '', walletType: 'metamask',
      referralCode: 'KURIO-ANA', email: 'ana@kurio.test', ensName: 'ana', updatedAt: at,
    },
    secondary: {
      slot: 'secondary', displayName: 'Ana Lima', nickname: 'Reserva', network: 'polygon', profileName: 'Ana Colecionadora',
      address: '0x5c7e9a1b3d5f7092b4d6f8a0c2e4a6c8e0a2b9f1', secondaryAddress: 'nova.kurio.eth', walletType: 'coinbase',
      referralCode: 'KURIO-ANA', email: 'ana@kurio.test', ensName: 'nova', updatedAt: at,
    },
  },
  u_bruno: {
    primary: {
      slot: 'primary', displayName: 'Bruno Costa', nickname: 'Principal', network: 'ethereum', profileName: 'Bruno Collector',
      address: '0x3e8b1f5d7a9c2e4f6a8b0c1d3e5f7a9b2c4d6e8f', secondaryAddress: '', walletType: 'walletconnect',
      referralCode: 'BRUNO-01', email: 'bruno@kurio.test', ensName: 'bruno', updatedAt: at,
    },
    secondary: null,
  },
})

export const COUPONS: Coupon[] = [
  { code: 'KURIO10', label: '10% de desconto no lançamento', bps: 1000, expiresAt: '2099-12-31T23:59:59Z' },
  { code: 'GENESIS', label: '0.05 ETH off acima de 0.5 ETH', fixed: '0.05', minSubtotal: '0.5', expiresAt: '2099-12-31T23:59:59Z' },
  { code: 'HALLOWEEN25', label: '25% de desconto', bps: 2500, expiresAt: '2025-11-01T03:00:00Z' },
]

export const NETWORK_FEES: Record<Network, string> = { ethereum: '0.016', polygon: '0.002', solana: '0.001' }
