import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Passive } from '@/types';

/**
 * Propostas de PASSIVAS criadas por players.
 * Toda passiva criada por player precisa passar por análise do Mestre antes de
 * ser aplicada à ficha. Mestre pode aprovar, recusar ou contrapropor (editar).
 * Fluxo paralelo (e propositalmente mais simples) ao de feitiços.
 */
export type PassiveProposalStatus = 'pending' | 'approved' | 'rejected' | 'counter_master';

export interface PassiveDiffEntry {
  field: string;
  label: string;
  before: string | number | null;
  after: string | number | null;
}

export interface PassiveRevision {
  by: 'PLAYER' | 'MASTER';
  passive: Passive;
  diff: PassiveDiffEntry[];
  note?: string;
  createdAt: number;
}

export interface PassiveProposal {
  id: string;
  characterId: string;
  characterName: string;
  revisions: PassiveRevision[];
  status: PassiveProposalStatus;
  createdAt: number;
  updatedAt: number;
  appliedPassiveId?: string;
}

export function computePassiveDiff(prev: Passive, next: Passive): PassiveDiffEntry[] {
  const out: PassiveDiffEntry[] = [];
  const fields: Array<{ key: keyof Passive; label: string }> = [
    { key: 'name', label: 'Nome' },
    { key: 'description', label: 'Descrição' },
    { key: 'spellLevel', label: 'Nível de Feitiço' },
    { key: 'bonusHP', label: 'Bônus HP' },
    { key: 'bonusPE', label: 'Bônus PE' },
    { key: 'bonusESC', label: 'Bônus ESC' },
    { key: 'bonusSlots', label: 'Slots' },
    { key: 'bonusRD', label: 'RD Geral' },
    { key: 'bonusCA', label: 'CA' },
    { key: 'bonusDC', label: 'CD' },
  ];
  for (const f of fields) {
    const a = (prev as any)[f.key];
    const b = (next as any)[f.key];
    if ((a ?? null) !== (b ?? null)) {
      out.push({ field: String(f.key), label: f.label, before: a ?? null, after: b ?? null });
    }
  }
  const aRd = JSON.stringify(prev.bonusRdByType ?? {});
  const bRd = JSON.stringify(next.bonusRdByType ?? {});
  if (aRd !== bRd) {
    out.push({ field: 'bonusRdByType', label: 'RD por Tipo', before: aRd, after: bRd });
  }
  return out;
}

interface PassiveProposalStore {
  proposals: PassiveProposal[];
  /** Player envia proposta inicial. Retorna ID. */
  submit: (characterId: string, characterName: string, passive: Passive, note?: string) => string;
  /** Mestre aprova: aplica a passiva e marca aprovada. */
  approve: (proposalId: string, applyPassive: (p: Passive) => void) => void;
  /** Mestre recusa. */
  reject: (proposalId: string, note?: string) => void;
  /** Mestre faz contraproposta. */
  counterByMaster: (proposalId: string, newPassive: Passive, note?: string) => void;
  /** Player aceita contraproposta. */
  acceptMasterCounter: (proposalId: string, applyPassive: (p: Passive) => void) => void;
  /** Player recusa contraproposta. */
  rejectMasterCounter: (proposalId: string, note?: string) => void;
  remove: (proposalId: string) => void;
  getByCharacter: (characterId: string) => PassiveProposal[];
  getPending: () => PassiveProposal[];
}

export const usePassiveProposalStore = create<PassiveProposalStore>()(
  persist(
    (set, get) => ({
      proposals: [],
      submit: (characterId, characterName, passive, note) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        const proposal: PassiveProposal = {
          id,
          characterId,
          characterName,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
          revisions: [{ by: 'PLAYER', passive, diff: [], note, createdAt: now }],
        };
        set((s) => ({ proposals: [proposal, ...s.proposals] }));
        return id;
      },
      approve: (proposalId, applyPassive) =>
        set((s) => ({
          proposals: s.proposals.map((p) => {
            if (p.id !== proposalId) return p;
            const last = p.revisions[p.revisions.length - 1];
            applyPassive(last.passive);
            return {
              ...p,
              status: 'approved' as PassiveProposalStatus,
              updatedAt: Date.now(),
              appliedPassiveId: last.passive.id,
            };
          }),
        })),
      reject: (proposalId, note) =>
        set((s) => ({
          proposals: s.proposals.map((p) => {
            if (p.id !== proposalId) return p;
            const updated = { ...p, status: 'rejected' as PassiveProposalStatus, updatedAt: Date.now() };
            if (note) {
              const last = p.revisions[p.revisions.length - 1];
              updated.revisions = [
                ...p.revisions,
                { by: 'MASTER', passive: last.passive, diff: [], note, createdAt: Date.now() },
              ];
            }
            return updated;
          }),
        })),
      counterByMaster: (proposalId, newPassive, note) =>
        set((s) => ({
          proposals: s.proposals.map((p) => {
            if (p.id !== proposalId) return p;
            const last = p.revisions[p.revisions.length - 1];
            const diff = computePassiveDiff(last.passive, newPassive);
            return {
              ...p,
              status: 'counter_master' as PassiveProposalStatus,
              updatedAt: Date.now(),
              revisions: [
                ...p.revisions,
                { by: 'MASTER', passive: newPassive, diff, note, createdAt: Date.now() },
              ],
            };
          }),
        })),
      acceptMasterCounter: (proposalId, applyPassive) =>
        set((s) => ({
          proposals: s.proposals.map((p) => {
            if (p.id !== proposalId) return p;
            const last = p.revisions[p.revisions.length - 1];
            applyPassive(last.passive);
            return {
              ...p,
              status: 'approved' as PassiveProposalStatus,
              updatedAt: Date.now(),
              appliedPassiveId: last.passive.id,
            };
          }),
        })),
      rejectMasterCounter: (proposalId, note) =>
        set((s) => ({
          proposals: s.proposals.map((p) => {
            if (p.id !== proposalId) return p;
            const updated = { ...p, status: 'rejected' as PassiveProposalStatus, updatedAt: Date.now() };
            if (note) {
              const last = p.revisions[p.revisions.length - 1];
              updated.revisions = [
                ...p.revisions,
                { by: 'PLAYER', passive: last.passive, diff: [], note, createdAt: Date.now() },
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
        get().proposals.filter((p) => p.status === 'pending'),
    }),
    { name: 'rpg-passive-proposals' },
  ),
);