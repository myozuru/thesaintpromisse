/**
 * 🔔 Conta propostas pendentes (debates abertos) que exigem atenção.
 *
 * Para o MESTRE: tudo que está esperando avaliação dele
 *   (status 'pending' ou 'counter_player').
 * Para o PLAYER: contrapropostas que o Mestre devolveu
 *   (status 'counter_master').
 *
 * Usado para exibir o badge de "!" na navegação e nas seções do módulo
 * de Debates, dando feedback imediato ao Mestre quando há algo aguardando.
 */
import { useMemo } from 'react';
import { useSpellProposalStore } from '@/stores/useSpellProposalStore';
import { usePassiveProposalStore } from '@/stores/usePassiveProposalStore';
import { useOmniProposalStore } from '@/stores/useOmniProposalStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useCharacterStore } from '@/stores/useCharacterStore';

export interface PendingDebateCounts {
  spells: number;
  passives: number;
  omni: number;
  total: number;
}

export function usePendingDebates(): PendingDebateCounts {
  const role = useRoleStore((s) => s.role);
  const isMaster = role === 'MASTER';
  const spells = useSpellProposalStore((s) => s.proposals);
  const passives = usePassiveProposalStore((s) => s.proposals);
  const omni = useOmniProposalStore((s) => s.proposals);
  const characters = useCharacterStore((s) => s.characters);

  return useMemo(() => {
    const playerCharIds = new Set(
      characters.filter((c) => c.createdBy !== 'MASTER').map((c) => c.id),
    );

    const isMasterPending = (st: string) => st === 'pending' || st === 'counter_player';
    const isPlayerPending = (st: string) => st === 'counter_master';
    const matches = (st: string) => (isMaster ? isMasterPending(st) : isPlayerPending(st));

    const filterByRole = <T extends { characterId: string; status: string }>(list: T[]) =>
      list.filter((p) => {
        if (!matches(p.status)) return false;
        if (isMaster) return true;
        return playerCharIds.has(p.characterId);
      });

    const sCount = filterByRole(spells).length;
    const pCount = filterByRole(passives).length;
    const oCount = filterByRole(omni).length;

    return {
      spells: sCount,
      passives: pCount,
      omni: oCount,
      total: sCount + pCount + oCount,
    };
  }, [isMaster, spells, passives, omni, characters]);
}