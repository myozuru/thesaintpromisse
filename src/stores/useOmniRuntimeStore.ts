import { carimbarDicionario } from '@/lib/omni/dicionarioSync';
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
import { useCharacterStore } from './useCharacterStore';
import { useChronosStore } from './useChronosStore';

export interface EfeitoAtivo {
  _syncAt?: number;
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
  deleted: Record<string, number>;
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
      deleted: {},

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

      removerEfeito: (id) => {
        const efeito = get().efeitos[id];
        if (!efeito) return;
        set(s => { const { [id]: _, ...rest } = s.efeitos; return { efeitos: rest }; });
        const instanceId = efeito.meta?.conditionInstanceId;
        if (typeof instanceId === 'string' && efeito.targetCharId) useCharacterStore.getState().removeCondition(efeito.targetCharId, instanceId);
      },

      dissiparTodos: (charId) => {
        for (const e of Object.values(get().efeitos)) if (!charId || e.sourceCharId === charId || e.targetCharId === charId) get().removerEfeito(e.id);
      },

      podarExpirados: () => {
        const agora = toTimelineSeconds(useChronosStore.getState());
        const removidos: string[] = [];
        for (const e of Object.values(get().efeitos)) {
          const linked = e.meta?.conditionInstanceId;
          const ausente = typeof linked === 'string' && !!e.targetCharId && !useCharacterStore.getState().characters.find(c => c.id === e.targetCharId)?.activeConditions?.some(c => c.id === linked);
          if (ausente || e.expiraEm !== null && agora >= e.expiraEm) { removidos.push(e.id); get().removerEfeito(e.id); }
        }
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

useOmniRuntimeStore.subscribe((next, prev) => {
  const entrada = { records: next.efeitos, deleted: next.deleted };
  const out = carimbarDicionario(entrada, { records: prev.efeitos, deleted: prev.deleted });
  if (out !== entrada) useOmniRuntimeStore.setState({ efeitos: out.records, deleted: out.deleted });
});
