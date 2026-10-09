import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useDice3DStore } from '@/stores/useDice3DStore';
import { useOmniRuntimeStore } from '@/stores/useOmniRuntimeStore';
import { executarGatilho } from '@/lib/omni/executor';
import { rollD20Com } from '@/lib/dice';
import type { AcaoLogica, EntidadeOmni } from '@/lib/omni/tipos';
import type { Character } from '@/types';

function personagemComRancor(): Character {
  useCharacterStore.setState({ characters: [] });
  useCharacterStore.getState().addCharacter('Portador', 'PLAYER');
  const personagem = useCharacterStore.getState().characters[0];
  useCharacterStore.getState().updateCharacter(personagem.id, { omniCounters: { rancor: 4 } });
  return useCharacterStore.getState().characters[0];
}

function acao(
  id: string,
  acao: AcaoLogica['acao'],
  caminhoAlvo: string,
  valor?: AcaoLogica['valor'],
): AcaoLogica {
  return { id, acao, alvoAplicacao: 'USUARIO', caminhoAlvo, valor };
}

function entidade(acoes: AcaoLogica[]): EntidadeOmni {
  return {
    id: 'auditoria-primitivas',
    versao: 1,
    nome: 'Auditoria de primitivas',
    categoria: 'passiva',
    descricao: '',
    tags: [],
    duracao: { tipo: 'permanente' },
    custos: [],
    gatilhos: [{
      id: 'ao-equipar',
      evento: 'aoEquipar',
      blocos: [{ id: 'bloco', modo: 'todas', condicoes: [], acoes }],
    }],
    criadoEm: 0,
    atualizadoEm: 0,
  };
}

function personagemAtual(id: string): Character {
  return useCharacterStore.getState().characters.find(c => c.id === id)!;
}

beforeEach(() => {
  useCharacterStore.setState({ characters: [] });
  useOmniRuntimeStore.setState({ efeitos: {} } as never);
  useCombatStore.setState({ inCombat: false, reactionPauseIds: [] });
  useDice3DStore.setState({ enabled: false, current: null, queue: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
  useDice3DStore.getState().clear();
  useCombatStore.setState({ inCombat: false, reactionPauseIds: [] });
});

describe('Primitivas OMNI no executor e no consumo de rolagem', () => {
  it('inicia cada combate com os limites por rodada disponíveis', () => {
    const usuario = personagemComRancor();
    useCharacterStore.getState().updateCharacter(usuario.id, {
      omniActionCost: { ler_tecnica: { cost: 'action_free', perRound: 1, usedThisRound: 1 } },
    });

    useCombatStore.getState().startCombat([{ charId: usuario.id, charName: 'Portador', roll: 12, bonus: 0, total: 12 }]);

    expect(personagemAtual(usuario.id).omniActionCost?.ler_tecnica.usedThisRound).toBe(0);
  });

  it('CONSUMIR_CONTADOR gasta a quantidade pedida e publica o total em @CENA.consumido', () => {
    const usuario = personagemComRancor();
    const fonte = entidade([
      acao('gastar', 'CONSUMIR_CONTADOR', 'rancor', { tipo: 'fixo', valor: 2 }),
      acao('registrar', 'DEFINIR_CONTADOR', 'eco', { tipo: 'formula', expressao: '@CENA.consumido' }),
    ]);

    executarGatilho(fonte, 'aoEquipar', { usuario });

    expect(personagemAtual(usuario.id).omniCounters).toMatchObject({ rancor: 2, eco: 2 });
  });

  it('CONSUMIR_CONTADOR com zero consome todas as cargas e informa quanto gastou', () => {
    const usuario = personagemComRancor();
    const fonte = entidade([
      acao('gastar-tudo', 'CONSUMIR_CONTADOR', 'rancor', { tipo: 'fixo', valor: 0 }),
      acao('registrar', 'DEFINIR_CONTADOR', 'eco', { tipo: 'formula', expressao: '@CENA.consumido' }),
    ]);

    executarGatilho(fonte, 'aoEquipar', { usuario });

    expect(personagemAtual(usuario.id).omniCounters).toMatchObject({ rancor: 0, eco: 4 });
  });

  it('REROLL é consumido pela rolagem do portador e conserva o maior d20', async () => {
    const usuario = personagemComRancor();
    executarGatilho(entidade([
      acao('reroll', 'REROLL', 'usuario', { tipo: 'fixo', valor: 1 }),
    ]), 'aoEquipar', { usuario });

    const valores = [[5], [18]];
    const rolar = vi.spyOn(useDice3DStore.getState(), 'requestRoll')
      .mockImplementation(async () => valores.shift() ?? []);

    await expect(rollD20Com(usuario.id)).resolves.toBe(18);
    expect(rolar).toHaveBeenCalledTimes(2);
    expect(rolar.mock.calls[1][1]).toBe('d20 reroll');

    const pendencia = Object.values(useOmniRuntimeStore.getState().efeitos)
      .find(efeito => efeito.targetCharId === usuario.id);
    expect((pendencia?.meta as { rerollPendente?: number } | undefined)?.rerollPendente).toBe(0);
  });
});
