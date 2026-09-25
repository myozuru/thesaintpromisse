import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EntidadeOmni } from '@/lib/omni/tipos';

/**
 * Propostas de Entidades Omni criadas por jogadores.
 *
 * Fluxo idêntico ao de feitiços/passivas: o Player envia uma proposta com a
 * entidade construída no construtor visual; o Mestre pode aprovar (a entidade
 * vai para a biblioteca global do Omni), recusar ou contrapropor (editar e
 * devolver para o jogador aceitar/recusar/recontrapropor).
 */
export type OmniProposalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'counter_master'
  | 'counter_player';

export interface OmniDiffEntry {
  field: string;
  label: string;
  before: string | number | null;
  after: string | number | null;
}

export interface OmniRevision {
  by: 'PLAYER' | 'MASTER';
  entidade: EntidadeOmni;
  diff: OmniDiffEntry[];
  note?: string;
  createdAt: number;
}

export interface OmniProposal {
  id: string;
  /** Personagem do jogador que está propondo (para contexto / filtro). */
  characterId: string;
  characterName: string;
  /** Quem propôs (espelha role atual). */
  authorRole: 'PLAYER';
  revisions: OmniRevision[];
  status: OmniProposalStatus;
  createdAt: number;
  updatedAt: number;
  /** ID da entidade aplicada na biblioteca após aprovação. */
  appliedEntidadeId?: string;
}

/** Diff entre duas entidades Omni — campos top-level + contagens. */
export function computeOmniDiff(prev: EntidadeOmni, next: EntidadeOmni): OmniDiffEntry[] {
  const out: OmniDiffEntry[] = [];
  const fields: Array<{ key: keyof EntidadeOmni; label: string }> = [
    { key: 'nome', label: 'Nome' },
    { key: 'categoria', label: 'Categoria' },
    { key: 'descricao', label: 'Descrição' },
  ];
  for (const f of fields) {
    const a = (prev as unknown as Record<string, unknown>)[f.key as string];
    const b = (next as unknown as Record<string, unknown>)[f.key as string];
    if ((a ?? null) !== (b ?? null)) {
      out.push({
        field: String(f.key),
        label: f.label,
        before: (a as string | number | null) ?? null,
        after: (b as string | number | null) ?? null,
      });
    }
  }
  const aTags = (prev.tags ?? []).join(',');
  const bTags = (next.tags ?? []).join(',');
  if (aTags !== bTags) {
    out.push({ field: 'tags', label: 'Tags', before: aTags || '—', after: bTags || '—' });
  }
  if (JSON.stringify(prev.duracao) !== JSON.stringify(next.duracao)) {
    out.push({
      field: 'duracao',
      label: 'Duração',
      before: prev.duracao.tipo,
      after: next.duracao.tipo,
    });
  }
  if (JSON.stringify(prev.custos) !== JSON.stringify(next.custos)) {
    out.push({
      field: 'custos',
      label: 'Custos',
      before: `${prev.custos.length} custo(s)`,
      after: `${next.custos.length} custo(s)`,
    });
  }
  if (JSON.stringify(prev.gatilhos) !== JSON.stringify(next.gatilhos)) {
    const aBlocos = prev.gatilhos.reduce((s, g) => s + g.blocos.length, 0);
    const bBlocos = next.gatilhos.reduce((s, g) => s + g.blocos.length, 0);
    out.push({
      field: 'gatilhos',
      label: 'Gatilhos / Lógica',
      before: `${prev.gatilhos.length} gatilho(s) · ${aBlocos} bloco(s)`,
      after: `${next.gatilhos.length} gatilho(s) · ${bBlocos} bloco(s)`,
    });
  }
  if (JSON.stringify(prev.alcance) !== JSON.stringify(next.alcance)) {
    out.push({ field: 'alcance', label: 'Alcance', before: JSON.stringify(prev.alcance ?? null), after: JSON.stringify(next.alcance ?? null) });
  }
  if (JSON.stringify(prev.areaRaio) !== JSON.stringify(next.areaRaio)) {
    out.push({ field: 'areaRaio', label: 'Área / Raio', before: JSON.stringify(prev.areaRaio ?? null), after: JSON.stringify(next.areaRaio ?? null) });
  }
  return out;
}

interface OmniProposalStore {
  proposals: OmniProposal[];
  submit: (
    characterId: string,
    characterName: string,
    entidade: EntidadeOmni,
    note?: string,
  ) => string;
  approve: (proposalId: string, applyEntidade: (e: EntidadeOmni) => void) => void;
  reject: (proposalId: string, note?: string) => void;
  counterByMaster: (proposalId: string, novaEntidade: EntidadeOmni, note?: string) => void;
  counterByPlayer: (proposalId: string, novaEntidade: EntidadeOmni, note?: string) => void;
  acceptMasterCounter: (proposalId: string, applyEntidade: (e: EntidadeOmni) => void) => void;
  rejectMasterCounter: (proposalId: string, note?: string) => void;
  remove: (proposalId: string) => void;
  getByCharacter: (characterId: string) => OmniProposal[];
  getPending: () => OmniProposal[];
}

export const useOmniProposalStore = create<OmniProposalStore>()(
  persist(
    (set, get) => ({
      proposals: [],
      submit: (characterId, characterName, entidade, note) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        const proposal: OmniProposal = {
          id,
          characterId,
          characterName,
          authorRole: 'PLAYER',
          status: 'pending',
          createdAt: now,
          updatedAt: now,
          revisions: [{ by: 'PLAYER', entidade, diff: [], note, createdAt: now }],
        };
        set((s) => ({ proposals: [proposal, ...s.proposals] }));
        return id;
      },
      approve: (proposalId, applyEntidade) =>
        set((s) => ({
          proposals: s.proposals.map((p) => {
            if (p.id !== proposalId) return p;
            const last = p.revisions[p.revisions.length - 1];
            applyEntidade(last.entidade);
            return {
              ...p,
              status: 'approved' as OmniProposalStatus,
              updatedAt: Date.now(),
              appliedEntidadeId: last.entidade.id,
            };
          }),
        })),
      reject: (proposalId, note) =>
        set((s) => ({
          proposals: s.proposals.map((p) => {
            if (p.id !== proposalId) return p;
            const updated: OmniProposal = {
              ...p,
              status: 'rejected' as OmniProposalStatus,
              updatedAt: Date.now(),
            };
            if (note) {
              const last = p.revisions[p.revisions.length - 1];
              updated.revisions = [
                ...p.revisions,
                { by: 'MASTER', entidade: last.entidade, diff: [], note, createdAt: Date.now() },
              ];
            }
            return updated;
          }),
        })),
      counterByMaster: (proposalId, novaEntidade, note) =>
        set((s) => ({
          proposals: s.proposals.map((p) => {
            if (p.id !== proposalId) return p;
            const last = p.revisions[p.revisions.length - 1];
            const diff = computeOmniDiff(last.entidade, novaEntidade);
            return {
              ...p,
              status: 'counter_master' as OmniProposalStatus,
              updatedAt: Date.now(),
              revisions: [
                ...p.revisions,
                { by: 'MASTER', entidade: novaEntidade, diff, note, createdAt: Date.now() },
              ],
            };
          }),
        })),
      counterByPlayer: (proposalId, novaEntidade, note) =>
        set((s) => ({
          proposals: s.proposals.map((p) => {
            if (p.id !== proposalId) return p;
            const last = p.revisions[p.revisions.length - 1];
            const diff = computeOmniDiff(last.entidade, novaEntidade);
            return {
              ...p,
              status: 'counter_player' as OmniProposalStatus,
              updatedAt: Date.now(),
              revisions: [
                ...p.revisions,
                { by: 'PLAYER', entidade: novaEntidade, diff, note, createdAt: Date.now() },
              ],
            };
          }),
        })),
      acceptMasterCounter: (proposalId, applyEntidade) =>
        set((s) => ({
          proposals: s.proposals.map((p) => {
            if (p.id !== proposalId) return p;
            const last = p.revisions[p.revisions.length - 1];
            applyEntidade(last.entidade);
            return {
              ...p,
              status: 'approved' as OmniProposalStatus,
              updatedAt: Date.now(),
              appliedEntidadeId: last.entidade.id,
            };
          }),
        })),
      rejectMasterCounter: (proposalId, note) =>
        set((s) => ({
          proposals: s.proposals.map((p) => {
            if (p.id !== proposalId) return p;
            const updated: OmniProposal = {
              ...p,
              status: 'rejected' as OmniProposalStatus,
              updatedAt: Date.now(),
            };
            if (note) {
              const last = p.revisions[p.revisions.length - 1];
              updated.revisions = [
                ...p.revisions,
                { by: 'PLAYER', entidade: last.entidade, diff: [], note, createdAt: Date.now() },
              ];
            }
            return updated;
          }),
        })),
      remove: (proposalId) =>
        set((s) => ({ proposals: s.proposals.filter((p) => p.id !== proposalId) })),
      getByCharacter: (characterId) =>
        get().proposals.filter((p) => p.characterId === characterId),
      getPending: () =>
        get().proposals.filter(
          (p) => p.status === 'pending' || p.status === 'counter_player' || p.status === 'counter_master',
        ),
    }),
    { name: 'rpg-omni-proposals' },
  ),
);