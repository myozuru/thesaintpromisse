/**
 * Conquistas: definições editadas/criadas pelo Mestre e desbloqueios por ficha.
 * Sincronizado pela fatia 'conquistas' (mescla por updatedAt; revogação por deletedAt).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CONQUISTAS_PADRAO, type ConquistaDef, type Desbloqueio } from '@/lib/conquistas/tipos';

interface ConquistaState {
  /** Sobrescritas e conquistas customizadas (por id). */
  defs: Record<string, ConquistaDef>;
  /** Por `${charId}:${conquistaId}`. */
  desbloqueios: Record<string, Desbloqueio>;
  /** Título equipado por ficha. */
  titulos: Record<string, { texto: string; updatedAt: number }>;
  salvarDef: (def: ConquistaDef) => void;
  apagarDef: (id: string) => void;
  registrar: (d: Desbloqueio) => void;
  revogar: (charId: string, conquistaId: string) => void;
  equiparTitulo: (charId: string, texto: string) => void;
}

export const chaveDesbloqueio = (charId: string, conquistaId: string) => `${charId}:${conquistaId}`;

export const useConquistaStore = create<ConquistaState>()(
  persist(
    (set) => ({
      defs: {},
      desbloqueios: {},
      titulos: {},
      salvarDef: (def) => set((s) => ({ defs: { ...s.defs, [def.id]: { ...def, deletedAt: undefined, updatedAt: Date.now() } } })),
      apagarDef: (id) => set((s) => {
        const base = s.defs[id] ?? CONQUISTAS_PADRAO.find((c) => c.id === id);
        if (!base) return s;
        return { defs: { ...s.defs, [id]: { ...base, deletedAt: Date.now(), updatedAt: Date.now() } } };
      }),
      registrar: (d) => set((s) => ({ desbloqueios: { ...s.desbloqueios, [chaveDesbloqueio(d.charId, d.conquistaId)]: { ...d, updatedAt: Date.now() } } })),
      revogar: (charId, conquistaId) => set((s) => {
        const k = chaveDesbloqueio(charId, conquistaId);
        const cur = s.desbloqueios[k];
        if (!cur) return s;
        return { desbloqueios: { ...s.desbloqueios, [k]: { ...cur, deletedAt: Date.now(), updatedAt: Date.now() } } };
      }),
      equiparTitulo: (charId, texto) => set((s) => ({ titulos: { ...s.titulos, [charId]: { texto, updatedAt: Date.now() } } })),
    }),
    { name: 'rpg-conquistas' },
  ),
);

/** Catálogo efetivo: padrão + sobrescritas, sem as apagadas. */
export function listarConquistas(defs: Record<string, ConquistaDef>): ConquistaDef[] {
  const out = new Map<string, ConquistaDef>();
  for (const c of CONQUISTAS_PADRAO) out.set(c.id, c);
  for (const c of Object.values(defs)) out.set(c.id, c);
  return [...out.values()].filter((c) => !c.deletedAt);
}

export function desbloqueioAtivo(state: Pick<ConquistaState, 'desbloqueios'>, charId: string, conquistaId: string) {
  const d = state.desbloqueios[chaveDesbloqueio(charId, conquistaId)];
  return d && !d.deletedAt ? d : undefined;
}
