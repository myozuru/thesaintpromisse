/**
 * Mural de Quests: quests, murais (peças do mapa), cartazes arrastáveis,
 * facções/reputação, linha do tempo da campanha, notas do diário e viagem do grupo.
 * Sincronizado pela fatia 'quests' (mescla por updatedAt).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IconeQuest, StatusQuest } from '@/lib/economia/quests';
import type { BossRevealField } from '@/lib/bosses';
import { limitarRep, type Faccao } from '@/lib/economia/reputacao';
import type { Transporte } from '@/lib/economia/viagem';
import type { Guilda } from '@/lib/economia/guilda';
export type { Guilda };

export type { Faccao };

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
  /** Legado: campos do chefe revelados ao aceitar (hoje usa a ficha do chefe). */
  revelarBoss: BossRevealField[];
  recompensa: { valor: number; currencyId: string; itens: string[] };
  /** Facção ligada à quest (reputação e exclusividade). */
  faccaoId?: string | null;
  /** Reputação ganha ao concluir (perde metade ao falhar). */
  repRecompensa?: number;
  /** Reputação mínima para ver a quest no mural (quest exclusiva). */
  repMinima?: number | null;
  /** Fim do prazo em segundos da linha do tempo do mundo; null = sem prazo. */
  prazoFim: number | null;
  /** Murais onde aparece (vazio = todos). */
  murais: string[];
  status: StatusQuest;
  aceitaPor: string[];
  /** Guilda que aceitou a quest (ganha/perde renome). */
  guildaId?: string | null;
  revelacaoAplicada?: boolean;
  poster: { x: number; y: number; rot: number };
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface Mural { id: string; nome: string; entityId: string | null; updatedAt: number; deletedAt?: number }

export type TipoEventoTL = 'quest' | 'viagem' | 'encontro' | 'manual';
export interface EventoTL { id: string; tipo: TipoEventoTL; texto: string; segundosMundo: number; updatedAt: number; deletedAt?: number }

export interface NotaDiario { texto: string; updatedAt: number }

export interface Viagem {
  grupo: { x: number; y: number } | null;
  /** Largura total do mapa do mundo em km. */
  escalaKm: number;
  transporte: Transporte;
  /** Chance de encontro por dia de viagem (%). */
  chanceEncontro: number;
  updatedAt: number;
}

export const VIAGEM_PADRAO: Viagem = { grupo: null, escalaKm: 1000, transporte: 'a_pe', chanceEncontro: 20, updatedAt: 0 };

interface QuestState {
  quests: Record<string, Quest>;
  murais: Record<string, Mural>;
  faccoes: Record<string, Faccao>;
  guildas: Record<string, Guilda>;
  criarGuilda: (nome: string, emblema: string, liderId: string, membros: string[]) => Guilda;
  atualizarGuilda: (id: string, patch: Partial<Omit<Guilda, 'id'>>) => void;
  linhaTempo: Record<string, EventoTL>;
  /** Notas do diário por `${charId}:${questId}`. */
  notas: Record<string, NotaDiario>;
  viagem: Viagem;
  criarQuest: (titulo?: string) => Quest;
  atualizarQuest: (id: string, patch: Partial<Omit<Quest, 'id' | 'createdAt'>>) => void;
  removerQuest: (id: string) => void;
  criarMural: (nome?: string) => Mural;
  atualizarMural: (id: string, patch: Partial<Omit<Mural, 'id'>>) => void;
  removerMural: (id: string) => void;
  criarFaccao: (nome?: string) => Faccao;
  atualizarFaccao: (id: string, patch: Partial<Omit<Faccao, 'id'>>) => void;
  removerFaccao: (id: string) => void;
  /** Soma reputação ao grupo e/ou a fichas específicas. */
  ajustarRep: (id: string, delta: number, charIds?: string[], grupo?: boolean) => void;
  adicionarEvento: (e: Omit<EventoTL, 'id' | 'updatedAt'>) => EventoTL;
  removerEvento: (id: string) => void;
  setNota: (charId: string, questId: string, texto: string) => void;
  setViagem: (patch: Partial<Omit<Viagem, 'updatedAt'>>) => void;
}

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function patchRec<T>(rec: Record<string, T>, id: string, patch: object): Record<string, T> | null {
  const cur = rec[id];
  if (!cur) return null;
  return { ...rec, [id]: { ...cur, ...patch, id: (cur as unknown as { id: string }).id, updatedAt: Date.now() } };
}

export const useQuestStore = create<QuestState>()(
  persist(
    (set) => ({
      quests: {},
      murais: {},
      faccoes: {},
      guildas: {},
      criarGuilda: (nome, emblema, liderId, membros) => {
        const g: Guilda = { id: uid('guilda'), nome: nome.trim() || 'Guilda', emblema: emblema || '⚔️', lema: '', liderId, membros: [...new Set([liderId, ...membros])], renome: 0, updatedAt: Date.now() };
        set((s) => ({ guildas: { ...s.guildas, [g.id]: g } }));
        return g;
      },
      atualizarGuilda: (id, patch) => set((s) => { const r = patchRec(s.guildas, id, patch); return r ? { guildas: r } : s; }),
      linhaTempo: {},
      notas: {},
      viagem: VIAGEM_PADRAO,
      criarQuest: (titulo = 'Nova quest') => {
        const now = Date.now();
        const q: Quest = {
          id: uid('quest'), titulo, descricao: '', icone: 'pergaminho', mascarada: false, revelada: false, objetivoReal: '',
          alvo: { tipo: 'nenhum' }, revelarBoss: [], recompensa: { valor: 0, currencyId: 'yen', itens: [] },
          faccaoId: null, repRecompensa: 0, repMinima: null,
          prazoFim: null, murais: [], status: 'disponivel', aceitaPor: [],
          poster: { x: 10 + Math.random() * 60, y: 10 + Math.random() * 50, rot: Math.random() * 8 - 4 },
          createdAt: now, updatedAt: now,
        };
        set((s) => ({ quests: { ...s.quests, [q.id]: q } }));
        return q;
      },
      atualizarQuest: (id, patch) => set((s) => { const r = patchRec(s.quests, id, patch); return r ? { quests: r } : s; }),
      removerQuest: (id) => set((s) => { const r = patchRec(s.quests, id, { deletedAt: Date.now() }); return r ? { quests: r } : s; }),
      criarMural: (nome = 'Mural') => {
        const m: Mural = { id: uid('mural'), nome, entityId: null, updatedAt: Date.now() };
        set((s) => ({ murais: { ...s.murais, [m.id]: m } }));
        return m;
      },
      atualizarMural: (id, patch) => set((s) => { const r = patchRec(s.murais, id, patch); return r ? { murais: r } : s; }),
      removerMural: (id) => set((s) => { const r = patchRec(s.murais, id, { deletedAt: Date.now() }); return r ? { murais: r } : s; }),
      criarFaccao: (nome = 'Nova facção') => {
        const f: Faccao = { id: uid('faccao'), nome, emblema: '🛡️', repGrupo: 0, repJogador: {}, updatedAt: Date.now() };
        set((s) => ({ faccoes: { ...s.faccoes, [f.id]: f } }));
        return f;
      },
      atualizarFaccao: (id, patch) => set((s) => { const r = patchRec(s.faccoes, id, patch); return r ? { faccoes: r } : s; }),
      removerFaccao: (id) => set((s) => { const r = patchRec(s.faccoes, id, { deletedAt: Date.now() }); return r ? { faccoes: r } : s; }),
      ajustarRep: (id, delta, charIds = [], grupo = true) => set((s) => {
        const f = s.faccoes[id];
        if (!f || !delta) return s;
        const repJogador = { ...f.repJogador };
        for (const c of charIds) repJogador[c] = limitarRep((repJogador[c] ?? 0) + delta);
        return { faccoes: { ...s.faccoes, [id]: { ...f, repGrupo: grupo ? limitarRep(f.repGrupo + delta) : f.repGrupo, repJogador, updatedAt: Date.now() } } };
      }),
      adicionarEvento: (e) => {
        const ev: EventoTL = { ...e, id: uid('tl'), updatedAt: Date.now() };
        set((s) => ({ linhaTempo: { ...s.linhaTempo, [ev.id]: ev } }));
        return ev;
      },
      removerEvento: (id) => set((s) => { const r = patchRec(s.linhaTempo, id, { deletedAt: Date.now() }); return r ? { linhaTempo: r } : s; }),
      setNota: (charId, questId, texto) => set((s) => ({ notas: { ...s.notas, [`${charId}:${questId}`]: { texto, updatedAt: Date.now() } } })),
      setViagem: (patch) => set((s) => ({ viagem: { ...s.viagem, ...patch, updatedAt: Date.now() } })),
    }),
    { name: 'tp-quests' },
  ),
);

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__questStore = useQuestStore;
}
