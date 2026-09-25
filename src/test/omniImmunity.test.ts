/**
 * 🛡 Imunidade Omni — testes do bloqueio nativo de condições.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { executarGatilho } from '@/lib/omni/executor';
import type { EntidadeOmni } from '@/lib/omni/tipos';
import type { Character, ActiveCondition } from '@/types';
import { temImunidade } from '@/lib/omni/immunity';

function entidadeImunidade(escopo: string, acao: 'CONCEDER_IMUNIDADE' | 'REMOVER_IMUNIDADE' = 'CONCEDER_IMUNIDADE'): EntidadeOmni {
  return {
    id: `ent-${escopo}-${acao}`,
    versao: 1,
    nome: `Imunidade ${escopo}`,
    categoria: 'passiva',
    descricao: '',
    tags: [],
    duracao: { tipo: 'permanente' },
    custos: [],
    gatilhos: [
      {
        id: 'g1',
        evento: 'aoEquipar',
        blocos: [
          {
            id: 'b1',
            condicoes: [],
            modo: 'todas',
            acoes: [
              {
                id: 'a1',
                acao,
                alvoAplicacao: 'USUARIO',
                caminhoAlvo: escopo,
              },
            ],
          },
        ],
      },
    ],
    criadoEm: 0,
    atualizadoEm: 0,
  };
}

function condAtordoado(): ActiveCondition {
  return {
    id: 'inst-1',
    conditionId: 'atordoado',
    name: 'Atordoado',
    icon: '💫',
    remainingTurns: 1,
    remainingRounds: 1,
  };
}

function condAmedrontado(): ActiveCondition {
  return {
    id: 'inst-2',
    conditionId: 'amedrontado',
    name: 'Amedrontado',
    icon: '😨',
    remainingTurns: 1,
    remainingRounds: 1,
  };
}

let charId: string;
function getChar(): Character {
  return useCharacterStore.getState().characters.find((c) => c.id === charId)!;
}

describe('Imunidade Omni nativa', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [] });
    useCharacterStore.getState().addCharacter('Teste', 'PLAYER');
    charId = useCharacterStore.getState().characters[0].id;
  });

  it('temImunidade() reconhece escopo "todas"', () => {
    expect(temImunidade({ omniImmunities: ['todas'] }, { id: 'atordoado' })).toBe(true);
    expect(temImunidade({ omniImmunities: ['todas'] }, { id: 'amedrontado' })).toBe(true);
  });

  it('temImunidade() filtra por condição específica', () => {
    expect(temImunidade({ omniImmunities: ['condicao:atordoado'] }, { id: 'atordoado' })).toBe(true);
    expect(temImunidade({ omniImmunities: ['condicao:atordoado'] }, { id: 'amedrontado' })).toBe(false);
  });

  it('temImunidade() filtra por categoria inteira', () => {
    expect(temImunidade({ omniImmunities: ['categoria:MENTAL'] }, { id: 'amedrontado' })).toBe(true);
    expect(temImunidade({ omniImmunities: ['categoria:MENTAL'] }, { id: 'atordoado' })).toBe(false);
  });

  it('CONCEDER_IMUNIDADE persiste a imunidade na ficha', () => {
    executarGatilho(entidadeImunidade('condicao:atordoado'), 'aoEquipar', { usuario: getChar() });
    expect(getChar().omniImmunities).toContain('condicao:atordoado');
  });

  it('addCondition é bloqueado quando há imunidade específica', () => {
    executarGatilho(entidadeImunidade('condicao:atordoado'), 'aoEquipar', { usuario: getChar() });
    useCharacterStore.getState().addCondition(charId, condAtordoado());
    expect(getChar().activeConditions ?? []).toHaveLength(0);
  });

  it('addCondition é bloqueado quando há imunidade por categoria', () => {
    executarGatilho(entidadeImunidade('categoria:MENTAL'), 'aoEquipar', { usuario: getChar() });
    useCharacterStore.getState().addCondition(charId, condAmedrontado());
    expect(getChar().activeConditions ?? []).toHaveLength(0);
    // Mas atordoado (INCAPACITAÇÃO) ainda passa.
    useCharacterStore.getState().addCondition(charId, condAtordoado());
    expect(getChar().activeConditions ?? []).toHaveLength(1);
  });

  it('addCondition é bloqueado quando imunidade é "todas"', () => {
    executarGatilho(entidadeImunidade('todas'), 'aoEquipar', { usuario: getChar() });
    useCharacterStore.getState().addCondition(charId, condAtordoado());
    useCharacterStore.getState().addCondition(charId, condAmedrontado());
    expect(getChar().activeConditions ?? []).toHaveLength(0);
  });

  it('REMOVER_IMUNIDADE retira o escopo e libera a condição', () => {
    executarGatilho(entidadeImunidade('condicao:atordoado'), 'aoEquipar', { usuario: getChar() });
    expect(getChar().omniImmunities).toContain('condicao:atordoado');
    executarGatilho(entidadeImunidade('condicao:atordoado', 'REMOVER_IMUNIDADE'), 'aoEquipar', { usuario: getChar() });
    expect(getChar().omniImmunities ?? []).not.toContain('condicao:atordoado');
    useCharacterStore.getState().addCondition(charId, condAtordoado());
    expect(getChar().activeConditions ?? []).toHaveLength(1);
  });
});
