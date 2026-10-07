/**
 * Lojas (Mercadores) do Omni-Engine.
 * Cada loja tem inventário próprio (referencia entidades Omni por ID),
 * categorias de estabelecimento, NPC no mapa e pechincha secreta.
 * Sincronizada com a mesa pela fatia 'economia' (mescla por updatedAt).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PECHINCHA_PADRAO, type PechinchaConfig, type PechinchaEstado } from '@/lib/economia/pechincha';

export interface Shop {
  id: string;
  name: string;
  description: string;
  /** Tags ocultas legadas que esta loja aceita comprar. */
  acceptedTags: string[];
  /** Categorias de estabelecimento (ex.: 'ferreiro', 'padaria'). */
  categorias?: string[];
  /** IDs de EntidadeOmni vendidas pela loja. */
  inventory: string[];
  currencyId: string;
  /** Multiplicador aplicado ao basePrice quando a loja compra (default 0.5). */
  buyMultiplier: number;
  /** Peça do mapa (NPC) que abre esta loja. */
  npcEntityId?: string | null;
  /** Facção dona da loja: a reputação com ela muda os preços. */
  faccaoId?: string | null;
  /** Configuração secreta de pechincha (nunca exibida ao jogador). */
  pechincha?: PechinchaConfig;
  createdAt: number;
  updatedAt?: number;
  deletedAt?: number;
}

export interface CategoriaEstabelecimento { id: string; nome: string; updatedAt?: number; deletedAt?: number }

export const CATEGORIAS_PADRAO: CategoriaEstabelecimento[] = [
  ['geral', 'Geral'], ['ferreiro', 'Ferreiro'], ['armeiro', 'Armeiro'], ['alquimista', 'Alquimista'],
  ['padaria', 'Padaria'], ['taverna', 'Taverna'], ['joalheiro', 'Joalheiro'], ['mercado_negro', 'Mercado Negro'],
  ['antiquario', 'Antiquário'], ['boticario', 'Boticário'], ['alfaiate', 'Alfaiate'], ['livraria', 'Livraria'],
].map(([id, nome]) => ({ id, nome, updatedAt: 0 }));

export const slugCategoria = (nome: string) =>
  nome.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

interface ShopState {
  shops: Record<string, Shop>;
  categorias: Record<string, CategoriaEstabelecimento>;
  /** Estado de pechincha por `${shopId}:${charId}`. */
  pechinchas: Record<string, PechinchaEstado>;
  criar: (nome?: string) => Shop;
  atualizar: (id: string, patch: Partial<Omit<Shop, 'id' | 'createdAt'>>) => void;
  remover: (id: string) => void;
  listar: () => Shop[];
  toggleInventory: (shopId: string, entityId: string) => void;
  criarCategoria: (nome: string) => CategoriaEstabelecimento | null;
  removerCategoria: (id: string) => void;
  listarCategorias: () => CategoriaEstabelecimento[];
  setPechincha: (shopId: string, charId: string, estado: PechinchaEstado) => void;
}

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `shop-${Math.random().toString(36).slice(2)}-${Date.now()}`;

export const useShopStore = create<ShopState>()(
  persist(
    (set, get) => ({
      shops: {},
      categorias: Object.fromEntries(CATEGORIAS_PADRAO.map((c) => [c.id, c])),
      pechinchas: {},

      criar: (nome = 'Nova Loja') => {
        const now = Date.now();
        const shop: Shop = {
          id: uid(), name: nome, description: '', acceptedTags: [], categorias: ['geral'], inventory: [],
          currencyId: 'yen', buyMultiplier: 0.5, npcEntityId: null, pechincha: { ...PECHINCHA_PADRAO },
          createdAt: now, updatedAt: now,
        };
        set((s) => ({ shops: { ...s.shops, [shop.id]: shop } }));
        return shop;
      },

      atualizar: (id, patch) =>
        set((s) => {
          const cur = s.shops[id];
          if (!cur) return s;
          return { shops: { ...s.shops, [id]: { ...cur, ...patch, id: cur.id, updatedAt: Date.now() } } };
        }),

      // Remoção vira marca (deletedAt) para propagar entre telas.
      remover: (id) =>
        set((s) => {
          const cur = s.shops[id];
          if (!cur) return s;
          return { shops: { ...s.shops, [id]: { ...cur, deletedAt: Date.now(), updatedAt: Date.now() } } };
        }),

      listar: () =>
        Object.values(get().shops).filter((x) => !x.deletedAt).sort((a, b) => a.name.localeCompare(b.name)),

      toggleInventory: (shopId, entityId) =>
        set((s) => {
          const cur = s.shops[shopId];
          if (!cur) return s;
          const has = cur.inventory.includes(entityId);
          const inv = has ? cur.inventory.filter((x) => x !== entityId) : [...cur.inventory, entityId];
          return { shops: { ...s.shops, [shopId]: { ...cur, inventory: inv, updatedAt: Date.now() } } };
        }),

      criarCategoria: (nome) => {
        const id = slugCategoria(nome);
        if (!id) return null;
        const existing = get().categorias[id];
        if (existing && !existing.deletedAt) return existing;
        const cat = { id, nome: nome.trim(), updatedAt: Date.now() };
        set((s) => ({ categorias: { ...s.categorias, [id]: cat } }));
        return cat;
      },
      removerCategoria: (id) =>
        set((s) => {
          const cur = s.categorias[id];
          if (!cur) return s;
          return { categorias: { ...s.categorias, [id]: { ...cur, deletedAt: Date.now(), updatedAt: Date.now() } } };
        }),
      listarCategorias: () =>
        Object.values(get().categorias).filter((c) => !c.deletedAt).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),

      setPechincha: (shopId, charId, estado) =>
        set((s) => ({ pechinchas: { ...s.pechinchas, [`${shopId}:${charId}`]: estado } })),
    }),
    { name: 'omni-shops', version: 2, migrate: (p) => {
      const st = (p ?? {}) as Partial<ShopState>;
      return { ...st, categorias: { ...Object.fromEntries(CATEGORIAS_PADRAO.map((c) => [c.id, c])), ...(st.categorias ?? {}) }, pechinchas: st.pechinchas ?? {} } as ShopState;
    } },
  ),
);

/** Lojas ativas (sem marca de remoção). */
export const lojasAtivas = (shops: Record<string, Shop>) => Object.values(shops).filter((s) => !s.deletedAt);
