/**
 * Mural de Quests: quests, murais (peças do mapa) e cartazes arrastáveis.
 * Sincronizado pela fatia 'quests' (mescla por updatedAt).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IconeQuest, StatusQuest } from '@/lib/economia/quests';
import type { BossRevealField } from '@/lib/bosses';

export interface Quest {
  id: string;
  titulo: string;
  descricao: string;
  icone: IconeQuest;
  /** Cartaz "?": mostra só descrição e recompensa. */
  mascarada: boolean;
  /** Mestre revelou o objetivo real de uma quest mascarada. */
  revelada: boolean;
  /** Descrição real (exibida quando não mascarada ou revelada). */
  objetivoReal: string;
  alvo: { tipo: 'nenhum' | 'boss' | 'item' | 'evento'; bossId?: string; entidadeId?: string };
  /** Campos do chefe revelados ao aceitar. */
  revelarBoss: BossRevealField[];
  recompensa: { valor: number; currencyId: string; itens: string[] };
  /** Fim do prazo em segundos da linha do tempo do mundo; null = sem prazo. */
  prazoFim: number | null;
  /** Murais onde aparece (vazio = todos). */
  murais: string[];
  status: StatusQuest;
  aceitaPor: string[];
  revelacaoAplicada?: boolean;
  poster: { x: number; y: number; rot: number };
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface Mural { id: string; nome: string; entityId: string | null; updatedAt: number; deletedAt?: number }

interface QuestState {
  quests: Record<string, Quest>;
  murais: Record<string, Mural>;
  criarQuest: (titulo?: string) => Quest;
  atualizarQuest: (id: string, patch: Partial<Omit<Quest, 'id' | 'createdAt'>>) => void;
  removerQuest: (id: string) => void;
  criarMural: (nome?: string) => Mural;
  atualizarMural: (id: string, patch: Partial<Omit<Mural, 'id'>>) => void;
  removerMural: (id: string) => void;
}

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useQuestStore = create<QuestState>()(
  persist(
    (set) => ({
      quests: {},
      murais: {},
      criarQuest: (titulo = 'Nova quest') => {
        const now = Date.now();
        const q: Quest = {
          id: uid('quest'), titulo, descricao: '', icone: 'pergaminho', mascarada: false, revelada: false, objetivoReal: '',
          alvo: { tipo: 'nenhum' }, revelarBoss: ['retrato', 'patamar'], recompensa: { valor: 0, currencyId: 'yen', itens: [] },
          prazoFim: null, murais: [], status: 'disponivel', aceitaPor: [],
          poster: { x: 10 + Math.random() * 60, y: 10 + Math.random() * 50, rot: Math.random() * 8 - 4 },
          createdAt: now, updatedAt: now,
        };
        set((s) => ({ quests: { ...s.quests, [q.id]: q } }));
        return q;
      },
      atualizarQuest: (id, patch) => set((s) => {
        const cur = s.quests[id];
        if (!cur) return s;
        return { quests: { ...s.quests, [id]: { ...cur, ...patch, id: cur.id, updatedAt: Date.now() } } };
      }),
      removerQuest: (id) => set((s) => {
        const cur = s.quests[id];
        if (!cur) return s;
        return { quests: { ...s.quests, [id]: { ...cur, deletedAt: Date.now(), updatedAt: Date.now() } } };
      }),
      criarMural: (nome = 'Mural') => {
        const m: Mural = { id: uid('mural'), nome, entityId: null, updatedAt: Date.now() };
        set((s) => ({ murais: { ...s.murais, [m.id]: m } }));
        return m;
      },
      atualizarMural: (id, patch) => set((s) => {
        const cur = s.murais[id];
        if (!cur) return s;
        return { murais: { ...s.murais, [id]: { ...cur, ...patch, id: cur.id, updatedAt: Date.now() } } };
      }),
      removerMural: (id) => set((s) => {
        const cur = s.murais[id];
        if (!cur) return s;
        return { murais: { ...s.murais, [id]: { ...cur, deletedAt: Date.now(), updatedAt: Date.now() } } };
      }),
    }),
    { name: 'tp-quests' },
  ),
);

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__questStore = useQuestStore;
}
