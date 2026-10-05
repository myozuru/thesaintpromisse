import { afterEach, describe, expect, it } from 'vitest';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useReactionStore } from '@/stores/useReactionStore';
import type { Character } from '@/types';

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
});
