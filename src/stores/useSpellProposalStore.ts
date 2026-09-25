import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Spell } from '@/types';

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'counter_master' | 'counter_player';

export interface SpellDiffEntry {
  field: string;
  /** Human-readable field label, e.g. "Custo PE", "Dano". */
  label: string;
  before: string | number | null;
  after: string | number | null;
}

export interface ProposalRevision {
  /** Quem propôs esta revisão. */
  by: 'PLAYER' | 'MASTER';
  /** Snapshot completo do feitiço nesta revisão. */
  spell: Spell;
  /** Diff em relação à revisão anterior (vazio na primeira). */
  diff: SpellDiffEntry[];
  /** Comentário/explicação opcional. */
  note?: string;
  createdAt: number;
}

export interface SpellProposal {
  id: string;
  /** Personagem dono do feitiço. */
  characterId: string;
  characterName: string;
  /** Histórico completo (rev[0] = proposta original do player). */
  revisions: ProposalRevision[];
  status: ProposalStatus;
  createdAt: number;
  updatedAt: number;
  /** ID do feitiço final aplicado à ficha (após aprovação). */
  appliedSpellId?: string;
}

/** Calcula diff entre dois feitiços (apenas campos relevantes para o jogador/mestre). */
export function computeSpellDiff(prev: Spell, next: Spell): SpellDiffEntry[] {
  const out: SpellDiffEntry[] = [];
  const fields: Array<{ key: keyof Spell; label: string; fmt?: (v: any) => string }> = [
    { key: 'name', label: 'Nome' },
    { key: 'costPE', label: 'Custo PE' },
    { key: 'damageDice', label: 'Dado de Dano' },
    { key: 'damageBonus', label: 'Bônus de Dano' },
    { key: 'damageType', label: 'Tipo de Dano' },
    { key: 'spellLevel', label: 'Nível' },
    { key: 'spellType', label: 'Tipo' },
    { key: 'actionType', label: 'Ação' },
    { key: 'targetMode', label: 'Modo de Alvo' },
    { key: 'range', label: 'Alcance' },
    { key: 'durationRounds', label: 'Duração (rd)' },
    { key: 'bonusDC', label: 'Bônus de CD' },
    { key: 'tradeHitBonus', label: 'Bônus de Acerto' },
    { key: 'tradeDiceAdj', label: 'Trocas de Dados' },
    { key: 'tradeRangeAdj', label: 'Trocas de Alcance' },
    { key: 'tradeCDAdj', label: 'Trocas de CD' },
    { key: 'difficultyLevel', label: 'Dificuldade do Requisito' },
    { key: 'difficultyDescription', label: 'Descrição do Requisito' },
    { key: 'attackType', label: 'Tipo de Ataque' },
    { key: 'saveAttr', label: 'Atributo de TR' },
    { key: 'description', label: 'Descrição' },
  ];
  for (const f of fields) {
    const a = (prev as any)[f.key];
    const b = (next as any)[f.key];
    if ((a ?? null) !== (b ?? null)) {
      out.push({
        field: String(f.key),
        label: f.label,
        before: a ?? null,
        after: b ?? null,
      });
    }
  }
  // Buffs / Conditions: comparação por contagem + JSON shallow.
  const aBuffs = JSON.stringify(prev.buffs ?? []);
  const bBuffs = JSON.stringify(next.buffs ?? []);
  if (aBuffs !== bBuffs) {
    out.push({ field: 'buffs', label: 'Buffs/Debuffs', before: `${(prev.buffs ?? []).length} efeito(s)`, after: `${(next.buffs ?? []).length} efeito(s)` });
  }
  const aConds = JSON.stringify(prev.conditions ?? []);
  const bConds = JSON.stringify(next.conditions ?? []);
  if (aConds !== bConds) {
    out.push({ field: 'conditions', label: 'Condições', before: `${(prev.conditions ?? []).length}`, after: `${(next.conditions ?? []).length}` });
  }
  return out;
}

interface SpellProposalStore {
  proposals: SpellProposal[];
  /** Player envia proposta inicial. Retorna ID. */
  submit: (characterId: string, characterName: string, spell: Spell, note?: string) => string;
  /** Mestre aprova: aplica o feitiço e marca aprovado. */
  approve: (proposalId: string, applySpell: (spell: Spell) => void) => void;
  /** Mestre rejeita. */
  reject: (proposalId: string, note?: string) => void;
  /** Mestre faz contraproposta (modifica). */
  counterByMaster: (proposalId: string, newSpell: Spell, note?: string) => void;
  /** Player faz contraproposta de volta. */
  counterByPlayer: (proposalId: string, newSpell: Spell, note?: string) => void;
  /** Player aprova contraproposta do mestre: aplica e marca aprovado. */
  acceptMasterCounter: (proposalId: string, applySpell: (spell: Spell) => void) => void;
  /** Player rejeita contraproposta do mestre. */
  rejectMasterCounter: (proposalId: string, note?: string) => void;
  /** Remove uma proposta (limpeza). */
  remove: (proposalId: string) => void;
  /** Lista propostas de um personagem. */
  getByCharacter: (characterId: string) => SpellProposal[];
  /** Lista todas as pendentes (mestre). */
  getPending: () => SpellProposal[];
}

export const useSpellProposalStore = create<SpellProposalStore>()(
  persist(
    (set, get) => ({
      proposals: [],
      submit: (characterId, characterName, spell, note) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        const proposal: SpellProposal = {
          id,
          characterId,
          characterName,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
          revisions: [{ by: 'PLAYER', spell, diff: [], note, createdAt: now }],
        };
        set((s) => ({ proposals: [proposal, ...s.proposals] }));
        return id;
      },
      approve: (proposalId, applySpell) =>
        set((s) => ({
          proposals: s.proposals.map((p) => {
            if (p.id !== proposalId) return p;
            const last = p.revisions[p.revisions.length - 1];
            applySpell(last.spell);
            return { ...p, status: 'approved' as ProposalStatus, updatedAt: Date.now(), appliedSpellId: last.spell.id };
          }),
        })),
      reject: (proposalId, note) =>
        set((s) => ({
          proposals: s.proposals.map((p) => {
            if (p.id !== proposalId) return p;
            const updated = { ...p, status: 'rejected' as ProposalStatus, updatedAt: Date.now() };
            if (note) {
              const last = p.revisions[p.revisions.length - 1];
              updated.revisions = [
                ...p.revisions,
                { by: 'MASTER', spell: last.spell, diff: [], note, createdAt: Date.now() },
              ];
            }
            return updated;
          }),
        })),
      counterByMaster: (proposalId, newSpell, note) =>
        set((s) => ({
          proposals: s.proposals.map((p) => {
            if (p.id !== proposalId) return p;
            const last = p.revisions[p.revisions.length - 1];
            const diff = computeSpellDiff(last.spell, newSpell);
            return {
              ...p,
              status: 'counter_master' as ProposalStatus,
              updatedAt: Date.now(),
              revisions: [
                ...p.revisions,
                { by: 'MASTER', spell: newSpell, diff, note, createdAt: Date.now() },
              ],
            };
          }),
        })),
      counterByPlayer: (proposalId, newSpell, note) =>
        set((s) => ({
          proposals: s.proposals.map((p) => {
            if (p.id !== proposalId) return p;
            const last = p.revisions[p.revisions.length - 1];
            const diff = computeSpellDiff(last.spell, newSpell);
            return {
              ...p,
              status: 'counter_player' as ProposalStatus,
              updatedAt: Date.now(),
              revisions: [
                ...p.revisions,
                { by: 'PLAYER', spell: newSpell, diff, note, createdAt: Date.now() },
              ],
            };
          }),
        })),
      acceptMasterCounter: (proposalId, applySpell) =>
        set((s) => ({
          proposals: s.proposals.map((p) => {
            if (p.id !== proposalId) return p;
            const last = p.revisions[p.revisions.length - 1];
            applySpell(last.spell);
            return { ...p, status: 'approved' as ProposalStatus, updatedAt: Date.now(), appliedSpellId: last.spell.id };
          }),
        })),
      rejectMasterCounter: (proposalId, note) =>
        set((s) => ({
          proposals: s.proposals.map((p) => {
            if (p.id !== proposalId) return p;
            const updated = { ...p, status: 'rejected' as ProposalStatus, updatedAt: Date.now() };
            if (note) {
              const last = p.revisions[p.revisions.length - 1];
              updated.revisions = [
                ...p.revisions,
                { by: 'PLAYER', spell: last.spell, diff: [], note, createdAt: Date.now() },
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
        get().proposals.filter((p) => p.status === 'pending' || p.status === 'counter_player'),
    }),
    { name: 'rpg-spell-proposals' },
  ),
);
