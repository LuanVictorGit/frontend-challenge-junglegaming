// Typed REST/realtime contracts shared by the client (parsing) and the mock backend (validation).
import { z } from 'zod'

/* ---------- primitives ---------- */
export const EthAmount = z.string().regex(/^\d+(\.\d{1,18})?$/, 'Valor em ETH inválido')
export const Network = z.enum(['ethereum', 'polygon', 'solana'])
export const Category = z.enum([
  'arte-digital', 'fotografia', 'musica', 'arte-3d', 'colecionaveis', 'generativa', 'jogos', 'assinaturas', 'utilidade',
])
export const Provider = z.enum(['metamask', 'walletconnect', 'coinbase'])
export const Tab = z.enum(['all', 'new', 'trending'])
export const Sort = z.enum(['recent', 'price-asc', 'price-desc', 'rating'])
export const WalletSlot = z.enum(['primary', 'secondary'])
export const OrderStatus = z.enum(['pending', 'confirmed', 'declined'])

export type Network = z.infer<typeof Network>
export type Category = z.infer<typeof Category>
export type Provider = z.infer<typeof Provider>
export type Tab = z.infer<typeof Tab>
export type Sort = z.infer<typeof Sort>
export type WalletSlot = z.infer<typeof WalletSlot>
export type OrderStatus = z.infer<typeof OrderStatus>

export const CATEGORY_LABEL: Record<Category, string> = {
  'arte-digital': 'Arte digital', fotografia: 'Fotografia', musica: 'Música', 'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis', generativa: 'Generativa', jogos: 'Jogos', assinaturas: 'Assinaturas', utilidade: 'Utilidade',
}
export const NETWORK_LABEL: Record<Network, string> = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' }
export const PROVIDER_LABEL: Record<Provider, string> = { metamask: 'MetaMask', walletconnect: 'WalletConnect', coinbase: 'Coinbase Wallet' }
export const SORT_LABEL: Record<Sort, string> = {
  recent: 'Listados recentemente', 'price-asc': 'Menor preço', 'price-desc': 'Maior preço', rating: 'Mais bem avaliados',
}

/* ---------- catalog ---------- */
export const Edition = z.object({
  id: z.string(),
  label: z.string(),
  price: EthAmount,
  stock: z.number().int().min(0),
  supply: z.number().int().nullable(),
  maxPerOrder: z.number().int().positive(),
})
export const NftSummary = z.object({
  id: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  collection: z.string(),
  category: Category,
  network: Network,
  price: EthAmount,
  compareAtPrice: EthAmount.nullable(),
  badge: z.string().nullable(),
  available: z.boolean(),
  defaultEditionId: z.string(),
  createdAt: z.string(),
  version: z.number().int(),
})
export const Review = z.object({ id: z.string(), author: z.string(), rating: z.number(), comment: z.string(), date: z.string() })
export const NftDetail = NftSummary.extend({
  description: z.string(),
  details: z.array(z.string()),
  attributes: z.array(z.string()),
  editions: z.array(Edition),
  rating: z.number(),
  reviewCount: z.number().int(),
  reviews: z.array(Review),
  contract: z.string(),
  royaltyBps: z.number().int(),
})
export const NftListParams = z.object({
  q: z.string().trim().max(60).optional(),
  category: Category.optional(),
  network: Network.optional(),
  minPrice: EthAmount.optional(),
  maxPrice: EthAmount.optional(),
  tab: Tab.default('all'),
  sort: Sort.default('recent'),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
})
export const NftList = z.object({
  items: z.array(NftSummary),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  facets: z.object({
    categories: z.record(z.string(), z.number()),
    networks: z.record(z.string(), z.number()),
    priceRange: z.tuple([EthAmount, EthAmount]),
  }),
})
export const Highlights = z.object({ featured: NftSummary.nullable(), trending: z.array(NftSummary) })

export type Edition = z.infer<typeof Edition>
export type NftSummary = z.infer<typeof NftSummary>
export type NftDetail = z.infer<typeof NftDetail>
export type NftListParams = z.input<typeof NftListParams>
export type NftList = z.infer<typeof NftList>

/* ---------- account ---------- */
const Password = z
  .string()
  .min(8, 'Use ao menos 8 caracteres')
  .max(64, 'Use no máximo 64 caracteres')
  .regex(/[A-Za-z]/, 'Inclua ao menos uma letra')
  .regex(/\d/, 'Inclua ao menos um número')
export const Username = z
  .string()
  .trim()
  .min(3, 'Use ao menos 3 caracteres')
  .max(24, 'Use no máximo 24 caracteres')
  .regex(/^[a-z0-9._]+$/i, 'Use apenas letras, números, ponto ou _')
export const Email = z.string().trim().toLowerCase().max(120).pipe(z.email('E-mail inválido'))
const Name = (min = 2, max = 40) => z.string().trim().min(min, `Use ao menos ${min} caracteres`).max(max, `Use no máximo ${max} caracteres`)
const EnsName = z.string().trim().toLowerCase().regex(/^[a-z0-9-]{3,30}$/, 'Use 3–30 letras minúsculas, números ou hífen')

export const RegisterInput = z
  .object({ username: Username, email: Email, password: Password, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não conferem' })
export const LoginInput = z.object({ email: Email, password: z.string().min(1, 'Informe a senha').max(64) })
export const User = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string(),
  displayName: z.string(),
  profileName: z.string(),
  ensName: z.string(),
  walletNickname: z.string(),
  avatarUrl: z.string().nullable(),
})
export const Session = z.object({ token: z.string(), expiresAt: z.string(), user: User })
export const ProfileInput = z.object({
  displayName: Name(),
  username: Username,
  email: Email,
  ensName: EnsName.or(z.literal('')),
  walletNickname: Name(2, 30),
})
export const AvatarInput = z.object({
  dataUrl: z
    .string()
    .max(1_400_000, 'A imagem deve ter no máximo 1 MB')
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/, 'Envie PNG, JPG ou WEBP'),
})
export const PasswordInput = z
  .object({ currentPassword: z.string().min(1, 'Informe a senha atual'), newPassword: Password, confirmPassword: z.string() })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não conferem' })
  .refine((d) => d.newPassword !== d.currentPassword, { path: ['newPassword'], message: 'A nova senha deve ser diferente da atual' })

export type User = z.infer<typeof User>
export type Session = z.infer<typeof Session>

/* ---------- wallets ---------- */
const EVM = /^0x[a-fA-F0-9]{40}$/
const SOL = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
export const WalletFields = z.object({
  displayName: Name(),
  nickname: Name(2, 30),
  network: Network,
  profileName: Name(),
  address: z.string().trim(),
  secondaryAddress: z.string().trim().max(64, 'Use no máximo 64 caracteres'),
  walletType: Provider,
  referralCode: z.string().trim().regex(/^[A-Za-z0-9-]{4,16}$/, 'Use 4–16 letras, números ou hífen'),
  email: Email,
  ensName: EnsName,
})
const checkAddress = (w: { network: Network; address: string }, ctx: z.RefinementCtx) => {
  if (!(w.network === 'solana' ? SOL : EVM).test(w.address))
    ctx.addIssue({ code: 'custom', path: ['address'], message: w.network === 'solana' ? 'Endereço Solana inválido' : 'Endereço 0x inválido (40 caracteres hex)' })
}
export const WalletInput = WalletFields.superRefine(checkAddress)
export const Wallet = WalletFields.extend({ slot: WalletSlot, updatedAt: z.string() })
export const Wallets = z.object({ primary: Wallet.nullable(), secondary: Wallet.nullable() })
export const ConnectInput = z.object({ provider: Provider, network: Network })
export const WalletConnection = z.object({
  slot: WalletSlot,
  provider: Provider,
  network: Network,
  address: z.string(),
  connectedAt: z.string(),
})

export type WalletInput = z.infer<typeof WalletInput>
export type Wallet = z.infer<typeof Wallet>
export type Wallets = z.infer<typeof Wallets>
export type WalletConnection = z.infer<typeof WalletConnection>

/* ---------- cart, quote & orders ---------- */
export const Coupon = z.object({ code: z.string(), label: z.string() })
export const Summary = z.object({
  subtotal: EthAmount,
  discount: EthAmount,
  networkFee: EthAmount,
  total: EthAmount,
  network: Network,
})
export const CartItem = z.object({
  id: z.string(),
  nftId: z.string(),
  editionId: z.string(),
  editionLabel: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  unitPrice: EthAmount,
  qty: z.number().int().positive(),
  lineTotal: EthAmount,
  maxQty: z.number().int().min(0),
  available: z.boolean(),
})
export const Cart = z.object({
  id: z.string(),
  items: z.array(CartItem),
  coupon: Coupon.nullable(),
  summary: Summary,
  count: z.number().int(),
  version: z.number().int(),
})
export const AddToCartInput = z.object({ nftId: z.string().min(1), editionId: z.string().min(1), qty: z.number().int().min(1).max(99) })
export const UpdateCartItemInput = z.object({ qty: z.number().int().min(1).max(99) })
export const CouponInput = z.object({ code: z.string().trim().toUpperCase().min(3, 'Informe o cupom').max(20, 'Cupom inválido') })

export const QuoteInput = z.object({ network: Network, walletSlot: WalletSlot })
export const QuoteLine = z.object({
  itemId: z.string(),
  nftId: z.string(),
  editionId: z.string(),
  editionLabel: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  unitPrice: EthAmount,
  qty: z.number().int().positive(),
  lineTotal: EthAmount,
})
export const Quote = z.object({
  id: z.string(),
  fingerprint: z.string(),
  lines: z.array(QuoteLine),
  coupon: Coupon.nullable(),
  summary: Summary,
  walletSlot: WalletSlot,
  expiresAt: z.string(),
})
export const CollectorInput = z.object({
  displayName: Name(),
  username: Username,
  network: Network,
  profileName: Name(),
  walletAddress: z.string().trim().min(1, 'Informe o endereço da carteira').max(64),
  secondaryAddress: z.string().trim().max(64),
  walletType: Provider,
  referralCode: z.string().trim().regex(/^[A-Za-z0-9-]{4,16}$/, 'Use 4–16 letras, números ou hífen'),
  email: Email,
  ensName: EnsName,
  note: z.string().trim().max(280, 'Use no máximo 280 caracteres'),
})
export const CreateOrderInput = z.object({
  quoteId: z.string().min(1),
  fingerprint: z.string().min(1),
  walletSlot: WalletSlot,
  collector: CollectorInput,
})
export const Order = z.object({
  id: z.string(),
  status: OrderStatus,
  createdAt: z.string(),
  updatedAt: z.string(),
  lines: z.array(QuoteLine),
  coupon: Coupon.nullable(),
  summary: Summary,
  wallet: z.object({ slot: WalletSlot, label: z.string(), address: z.string(), provider: Provider }),
  network: Network,
  txHash: z.string().nullable(),
  declineReason: z.string().nullable(),
  version: z.number().int(),
})

export type Summary = z.infer<typeof Summary>
export type CartItem = z.infer<typeof CartItem>
export type Cart = z.infer<typeof Cart>
export type Quote = z.infer<typeof Quote>
export type QuoteLine = z.infer<typeof QuoteLine>
export type CollectorInput = z.infer<typeof CollectorInput>
export type CreateOrderInput = z.infer<typeof CreateOrderInput>
export type Order = z.infer<typeof Order>

/* ---------- errors ---------- */
export const ErrorCode = z.enum([
  'VALIDATION_ERROR', 'UNAUTHENTICATED', 'SESSION_EXPIRED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'OUT_OF_STOCK',
  'QUOTE_OUTDATED', 'IDEMPOTENCY_CONFLICT', 'COUPON_INVALID', 'COUPON_EXPIRED', 'WALLET_REJECTED', 'RATE_LIMITED',
  'TRANSIENT', 'INTERNAL',
])
export type ErrorCode = z.infer<typeof ErrorCode>
export const ApiErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
    details: z.unknown().optional(),
  }),
})

/* ---------- realtime (Socket.IO) ---------- */
const EventBase = { id: z.string(), version: z.number().int(), occurredAt: z.string() }
export const NftUpdatedEvent = z.object({
  ...EventBase,
  type: z.literal('nft.updated'),
  resource: z.object({ type: z.literal('nft'), id: z.string() }),
  data: z.object({
    name: z.string(),
    price: EthAmount,
    compareAtPrice: EthAmount.nullable(),
    available: z.boolean(),
    editions: z.array(Edition.pick({ id: true, price: true, stock: true })),
  }),
})
export const OrderUpdatedEvent = z.object({
  ...EventBase,
  type: z.literal('order.updated'),
  resource: z.object({ type: z.literal('order'), id: z.string() }),
  data: z.object({ status: OrderStatus }),
})
export const RealtimeEvent = z.discriminatedUnion('type', [NftUpdatedEvent, OrderUpdatedEvent])
export type NftUpdatedEvent = z.infer<typeof NftUpdatedEvent>
export type OrderUpdatedEvent = z.infer<typeof OrderUpdatedEvent>
export type RealtimeEvent = z.infer<typeof RealtimeEvent>
