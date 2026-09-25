/**
 * Omni-Engine Runtime Store (Pilar 3 + pré-Pilar 5).
 *
 * Mantém instâncias de efeitos ativos no mundo. Cada instância aponta para
 * uma EntidadeOmni e tem um tempo de expiração em segundos da timeline.
 *
 * O tick vem do useChronosStore via subscribe (ver GlobalClockTicker).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EntidadeOmni, DuracaoEntidade } from '@/lib/omni/tipos';
import { duracaoParaSegundos, toTimelineSeconds } from '@/lib/omni/tempo';
import { useChronosStore } from './useChronosStore';

export interface EfeitoAtivo {
  id: string;
  entidadeId: string;
  nomeSnapshot: string;
  sourceCharId?: string;
  targetCharId?: string;
  iniciadoEm: number; // segundos de timeline
  expiraEm: number | null; // null = permanente / atéDissipar
  meta?: Record<string, unknown>;
}

interface OmniRuntimeStore {
  efeitos: Record<string, EfeitoAtivo>;
  aplicarEfeito: (
    entidade: EntidadeOmni,
    opts?: {
      duracaoValor?: number;
      sourceCharId?: string;
      targetCharId?: string;
      meta?: Record<string, unknown>;
      /**
       * Override de duração específico DESTE efeito (vem de AcaoLogica.duracao).
       * Quando presente, ignora `entidade.duracao` para o cálculo de expiração —
       * a entidade-fonte só serve como rótulo.
       */
      duracaoOverride?: DuracaoEntidade;
    },
  ) => EfeitoAtivo;
  removerEfeito: (id: string) => void;
  dissiparTodos: (charId?: string) => void;
  podarExpirados: () => string[]; // retorna ids removidos
  listarAtivosDe: (charId: string) => EfeitoAtivo[];
}

export const useOmniRuntimeStore = create<OmniRuntimeStore>()(
  persist(
    (set, get) => ({
      efeitos: {},

      aplicarEfeito: (entidade, opts = {}) => {
        const chronos = useChronosStore.getState();
        const agora = toTimelineSeconds(chronos);
        const duracaoEfetiva: DuracaoEntidade = opts.duracaoOverride ?? entidade.duracao;
        const duracaoValor =
          opts.duracaoValor ??
          (duracaoEfetiva.valor && duracaoEfetiva.valor.tipo === 'fixo' ? duracaoEfetiva.valor.valor : 1);
        const segundos = duracaoParaSegundos(duracaoEfetiva, duracaoValor);
        const expiraEm = segundos === null ? null : agora + segundos;
        const efeito: EfeitoAtivo = {
          id: crypto.randomUUID(),
          entidadeId: entidade.id,
          nomeSnapshot: entidade.nome,
          sourceCharId: opts.sourceCharId,
          targetCharId: opts.targetCharId,
          iniciadoEm: agora,
          expiraEm,
          meta: opts.meta,
        };
        set((s) => ({ efeitos: { ...s.efeitos, [efeito.id]: efeito } }));
        return efeito;
      },

      removerEfeito: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.efeitos;
          return { efeitos: rest };
        }),

      dissiparTodos: (charId) =>
        set((s) => {
          if (!charId) return { efeitos: {} };
          const rest: Record<string, EfeitoAtivo> = {};
          for (const [k, v] of Object.entries(s.efeitos)) {
            if (v.sourceCharId !== charId && v.targetCharId !== charId) rest[k] = v;
          }
          return { efeitos: rest };
        }),

      podarExpirados: () => {
        const chronos = useChronosStore.getState();
        const agora = toTimelineSeconds(chronos);
        const removidos: string[] = [];
        const manter: Record<string, EfeitoAtivo> = {};
        for (const [k, v] of Object.entries(get().efeitos)) {
          if (v.expiraEm !== null && agora >= v.expiraEm) removidos.push(k);
          else manter[k] = v;
        }
        if (removidos.length > 0) set({ efeitos: manter });
        return removidos;
      },

      listarAtivosDe: (charId) =>
        Object.values(get().efeitos).filter(
          (e) => e.sourceCharId === charId || e.targetCharId === charId,
        ),
    }),
    { name: 'omni-runtime-efeitos' },
  ),
);
