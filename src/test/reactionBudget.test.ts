import { afterEach, describe, expect, it } from 'vitest';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useReactionStore } from '@/stores/useReactionStore';
import type { Character } from '@/types';
import { getReactionsAvailable } from '@/lib/reactionBudget';

function placeFicha(reactionsCurrent: number, reactionsMax = reactionsCurrent) {
  const character = { id: 'alvo', name: 'Alvo', category: 'PLAYER', reactionsCurrent, reactionsMax } as Character;
  useCharacterStore.setState({ characters: [character] } as never);
  useReactionStore.setState({ prompts: [], reactionsUsedByChar: {} });
}

afterEach(() => {
  useCharacterStore.setState({ characters: [] } as never);
  useReactionStore.setState({ prompts: [], reactionsUsedByChar: {} });
});

describe('orçamento de reação unificado com o saldo da ficha', () => {
  it('restaura o limite configurado em fichas antigas sem saldo salvo e respeita zero explícito', () => {
    expect(getReactionsAvailable({ reactionsMax: 3 } as Character)).toBe(3);
    expect(getReactionsAvailable({ reactionsMax: 3, reactionsCurrent: 0 } as Character)).toBe(0);
    expect(getReactionsAvailable({} as Character)).toBe(1);
  });

  it('usa a mesma fonte de verdade e respeita fichas com mais de uma reação', () => {
    placeFicha(3);
    const reactions = useReactionStore.getState();
    expect(reactions.reactionsLeft('alvo')).toBe(3);
    expect(reactions.hasReactionAvailable('alvo')).toBe(true);
    expect(reactions.consumeReaction('alvo')).toBe(true);
    expect(useCharacterStore.getState().characters[0].reactionsCurrent).toBe(2);
    expect(useReactionStore.getState().reactionsLeft('alvo')).toBe(2);
    expect(useReactionStore.getState().reactionsUsedByChar.alvo).toBe(1);
  });

  it('nega uso sem saldo mesmo que o contador de prompts não registre consumo', () => {
    placeFicha(0);
    expect(useReactionStore.getState().hasReactionAvailable('alvo')).toBe(false);
    expect(useReactionStore.getState().consumeReaction('alvo')).toBe(false);
    expect(useReactionStore.getState().reactionsUsedByChar.alvo ?? 0).toBe(0);
  });

  it('runReaction reserva a reação antes do efeito e estorna apenas quando o efeito falha', () => {
    placeFicha(1);
    const failed = useReactionStore.getState().runReaction('alvo', () => ({ ok: false, reason: 'PE insuficiente.' }));
    expect(failed).toMatchObject({ ok: false, reason: 'PE insuficiente.' });
    expect(useCharacterStore.getState().characters[0].reactionsCurrent).toBe(1);
    expect(useReactionStore.getState().reactionsUsedByChar.alvo ?? 0).toBe(0);

    const applied = useReactionStore.getState().runReaction('alvo', () => ({ ok: true }));
    expect(applied.ok).toBe(true);
    expect(useCharacterStore.getState().characters[0].reactionsCurrent).toBe(0);
    expect(useReactionStore.getState().reactionsUsedByChar.alvo).toBe(1);
  });

  it('runReaction devolve reação e telemetria se o efeito lançar exceção', () => {
    placeFicha(1);
    expect(() => useReactionStore.getState().runReaction('alvo', () => { throw new Error('falha inesperada'); })).toThrow('falha inesperada');
    expect(useCharacterStore.getState().characters[0].reactionsCurrent).toBe(1);
    expect(useReactionStore.getState().reactionsUsedByChar.alvo ?? 0).toBe(0);
  });

  it('reconhece consumo manual feito na ficha sem liberar reação pelo contador auxiliar', () => {
    placeFicha(1);
    useCharacterStore.getState().updateCharacter('alvo', { reactionsCurrent: 0 });
    expect(useReactionStore.getState().hasReactionAvailable('alvo')).toBe(false);
    expect(useReactionStore.getState().reactionsLeft('alvo')).toBe(0);
  });

  it('o reset auxiliar não inventa reações; a ficha precisa receber seu saldo novo', () => {
    placeFicha(1);
    useReactionStore.getState().consumeReaction('alvo');
    useReactionStore.getState().resetRoundReactions();
    expect(useReactionStore.getState().reactionsUsedByChar).toEqual({});
    expect(useReactionStore.getState().hasReactionAvailable('alvo')).toBe(false);
    useCharacterStore.getState().updateCharacter('alvo', { reactionsCurrent: 1 });
    expect(useReactionStore.getState().hasReactionAvailable('alvo')).toBe(true);
  });

  it('não debita reação ao tentar ativar pelo botão genérico uma reação sem gatilho', () => {
    placeFicha(2);
    useCharacterStore.getState().updateCharacter('alvo', {
      chosenAuraAptitudes: ['absorcao_elemental'],
      cursedAptitudes: { AU: 2 } as never,
    });
    const result = useCharacterStore.getState().activateAuraAptitude('alvo', 'absorcao_elemental');
    expect(result).toMatchObject({ ok: false, reason: 'Esta reação só pode ser resolvida quando o gatilho correspondente acontecer.' });
    expect(useCharacterStore.getState().characters[0].reactionsCurrent).toBe(2);
  });

  it('ativar Cobrir-se pelo painel também debita exatamente uma reação', async () => {
    placeFicha(2);
    useCharacterStore.getState().updateCharacter('alvo', {
      chosenClAptitudes: ['cl-cobrir-se'],
      cursedAptitudes: { CL: 1 } as never,
      peCurrent: 20,
    });
    const result = await useCharacterStore.getState().activateClAptitude('alvo', 'cl-cobrir-se', { peSpent: 1 });
    expect(result.ok).toBe(true);
    expect(useCharacterStore.getState().characters[0]).toMatchObject({ reactionsCurrent: 1, peCurrent: 19 });
    expect(useReactionStore.getState().reactionsUsedByChar.alvo).toBe(1);
  });
});
