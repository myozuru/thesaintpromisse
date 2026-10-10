// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
import { ficha, forcarDados, montarMesa, comoTela, pegarFicha } from './helpers/mesaReal';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useLogStore } from '@/stores/useLogStore';
import { useMapStore } from '@/stores/useMapStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { INVOCACAO_SCHEMA_VERSION } from '@/lib/invocacoes/schema';
import { definirAutomacaoInvocacao, despacharAutonomiasInvocacao } from '@/lib/controlador/autonomia';
import type { EntidadeOmni } from '@/lib/omni/tipos';
import type { CadeiaOmni } from '@/lib/omni/cadeiaEventos';
import {
  avaliarCondicaoAutonomia,
  caminhoSeguro,
  validarCondicaoAutonomia,
} from '@/lib/controlador/condicaoAutonomia';
import {
  limitarAcoesAutonomas,
  marcarRegraVisitada,
  MAX_ACOES_AUTONOMAS_POR_RODADA,
} from '@/lib/controlador/guardiaAutonomia';

function cadeia(orcamento = { restantes: 10, avisou: false }): CadeiaOmni {
  return { profundidade: 1, orcamento };
}

function prepararAutomacao(): { tokenId: string; custoPeDono: number } {
  const acionada = {
    id: 'acao-omni',
    nome: 'Mordida',
    acao: 'comum',
    custoPE: '0',
    alcanceM: 9,
    tipo_alvo: 'unico',
    filtro_alvo: 'inimigos',
    teste: 'ataque',
    dano: '1d4',
    tipoDano: 'DCO',
  };
  const entidade = {
    id: 'entidade-omni',
    nome: 'Garras',
    gatilhos: [{ id: 'gatilho-dano', evento: 'aoCausarDano' }],
    acoesAtivas: [acionada],
  } as unknown as EntidadeOmni;
  const modelo = {
    id: 'shiki-1',
    nome: 'Shikigami de teste',
    donoCharacterId: 'dono',
    tipo: 'shikigami',
    hpAtual: 10,
    hpMaximo: 10,
    defesa: 12,
    deslocamentoM: 9,
    porte: 'Médio',
    custoInvocacaoPE: 0,
    alcanceInvocacaoM: 3,
    atributos: { forca: 14, destreza: 10, constituicao: 10, inteligencia: 10, sabedoria: 10, presenca: 10 },
    economiaAcoesConfigurada: { acaoComum: 1 },
    acoes: [{
      id: 'acao-local', nome: 'Mordida', tipoExecucao: 'omni', tipo: 'ataque',
      categoriaAcao: 'acao_comum', dano: '1d4', tipoAtaque: 'corpo_a_corpo',
      atributoAtaque: 'forca', alcanceM: 9, entidadeOmniId: entidade.id, acaoOmniId: acionada.id,
    }],
    custosComandosConfigurados: { 'acao-local': { execucao: 'evento_automatico', debitos: [] } },
    automacoesOmni: [{
      id: 'regra-1', habilitada: true, prioridade: 1, entidadeOmniId: entidade.id,
      gatilhoId: 'gatilho-dano', acaoId: acionada.id, politicaAlvo: 'ameaca_mais_proxima', limitePorRodada: 1,
    }],
    autonomia: { modo: 'automatico', politicaAlvo: 'ameaca_mais_proxima', politicaCusto: 'manual', limitePorRodada: 1 },
  };
  const dono = ficha('dono', {
    profileId: 'perfil-dono', category: 'PLAYER', specialization: 'Controlador', level: 4,
    peCurrent: 10, actionsCurrent: 2, bonusActionsCurrent: 1,
    invocacoesConhecidas: [modelo as never],
    instanciasInvocacao: [],
  });
  const inimigo = ficha('inimigo', { category: 'INIMIGO', hpCurrent: 20, hpMax: 20, ca: 100 });
  montarMesa([dono, inimigo], { dono: [2, 2], inimigo: [3, 2] });
  const tokenId = useMapStore.getState().addEntity({
    id: 'token-shiki', shape: 'ELLIPSE', x: 140, y: 70, w: 70, h: 70,
    rotation: 0, color: '#654321', locked: false, layer: 'tokens',
    ownerCharId: dono.id, invocationId: 'shiki-1', invocationInstanceId: 'instancia-1',
    invocationState: 'ativa', hp: 10, hpMax: 10,
  });
  useCharacterStore.getState().updateCharacter(dono.id, {
    instanciasInvocacao: [{
      schemaVersion: INVOCACAO_SCHEMA_VERSION,
      version: 1,
      id: 'instancia-1',
      modeloId: 'shiki-1',
      donoCharacterId: dono.id,
      donoProfileId: dono.profileId,
      tokenId,
      estado: 'ativa',
      hpAtual: 10,
      hpMaximoAtual: 10,
      economiaAcoes: { acaoComum: { atual: 1, maximo: 1 } },
      recursosAtuais: {},
    }],
  });
  useOmniEntidadesStore.setState({ entidades: { [entidade.id]: entidade } });
  useCombatStore.setState({
    inCombat: true, round: 1, currentTurnIndex: 0,
    initiativeOrder: [{ charId: dono.id, charName: dono.name, roll: 10, bonus: 0, total: 10 }],
  } as never);
  comoTela({ profileId: 'perfil-dono', role: 'PLAYER' });
  forcarDados(1);
  return { tokenId, custoPeDono: dono.peCurrent };
}

beforeEach(() => {
  useCombatStore.setState({ inCombat: false, currentTurnIndex: 0, initiativeOrder: [] } as never);
  useOmniEntidadesStore.setState({ entidades: {} });
  useLogStore.getState().clearLogs();
});

describe('autonomia de Shikigami sem serviços externos', () => {
  it('executa uma regra no máximo uma vez dentro da cadeia OMNI e permite nova cadeia', () => {
    const primeira = cadeia();
    const segunda = cadeia();

    expect(marcarRegraVisitada(primeira, 'instancia-1:regra-1')).toBe(true);
    expect(marcarRegraVisitada(primeira, 'instancia-1:regra-1')).toBe(false);
    expect(marcarRegraVisitada(primeira, 'instancia-1:regra-2')).toBe(true);
    expect(marcarRegraVisitada(segunda, 'instancia-1:regra-1')).toBe(true);
  });

  it('mantém um teto de ações por rodada mesmo com configuração maior', () => {
    expect(MAX_ACOES_AUTONOMAS_POR_RODADA).toBe(8);
    expect(limitarAcoesAutonomas(undefined, 8)).toBe(8);
    expect(limitarAcoesAutonomas(2, 8)).toBe(2);
    expect(limitarAcoesAutonomas(50, 8)).toBe(8);
    expect(limitarAcoesAutonomas(-1, 1)).toBe(1);
    expect(limitarAcoesAutonomas(0, 1)).toBe(0);
  });

  it('valida condições declarativas e avalia comparações sem executar código', () => {
    const condicao = validarCondicaoAutonomia({
      op: 'all',
      conditions: [
        { op: 'compare', path: 'evento.dano.total', cmp: 'gte', value: 5 },
        { op: 'compare', path: 'dono.hpCurrent', cmp: 'lt', value: 10 },
      ],
    });

    expect(condicao).toBeDefined();
    expect(avaliarCondicaoAutonomia(condicao, {
      evento: { dano: { total: 7 } },
      dono: { hpCurrent: 8 },
    })).toBe(true);
    expect(avaliarCondicaoAutonomia(condicao, {
      evento: { dano: { total: 2 } },
      dono: { hpCurrent: 8 },
    })).toBe(false);
  });

  it('recusa caminhos perigosos, operadores inválidos e AST acima do limite', () => {
    expect(caminhoSeguro('dono.__proto__.hpCurrent')).toBe(false);
    expect(validarCondicaoAutonomia({ op: 'exists', path: 'constructor.prototype' })).toBeUndefined();
    expect(validarCondicaoAutonomia({ op: 'compare', path: 'dono.hpCurrent', cmp: 'exec', value: 1 })).toBeUndefined();
    expect(validarCondicaoAutonomia({ op: 'compare', path: 'dono.name', cmp: 'eq', value: 'x'.repeat(501) })).toBeUndefined();
    expect(validarCondicaoAutonomia({
      op: 'all',
      conditions: Array.from({ length: 17 }, () => ({ op: 'exists', path: 'dono.id' })),
    })).toBeUndefined();
  });

  it('executa a ação autorizada com a economia da instância e respeita o limite por rodada', async () => {
    const { tokenId, custoPeDono } = prepararAutomacao();
    const contexto = { usuarioId: 'dono', alvoId: 'inimigo', cena: {}, dano: {} };
    const primeiraCadeia = cadeia();

    await despacharAutonomiasInvocacao('aoCausarDano', contexto, primeiraCadeia);
    const aposPrimeiroGatilho = pegarFicha('dono');
    expect(aposPrimeiroGatilho.instanciasInvocacao?.[0]).toMatchObject({
      economiaAcoes: { acaoComum: { atual: 0, maximo: 1 } },
      usosAutomacaoRodada: { rodada: 1, total: 1, porAutomacao: { 'regra-1': 1 } },
    });
    expect(aposPrimeiroGatilho.peCurrent).toBe(custoPeDono);
    expect(aposPrimeiroGatilho.actionsCurrent).toBe(2);
    expect(aposPrimeiroGatilho.bonusActionsCurrent).toBe(1);

    await despacharAutonomiasInvocacao('aoCausarDano', contexto, primeiraCadeia);
    await despacharAutonomiasInvocacao('aoCausarDano', contexto, cadeia());
    expect(pegarFicha('dono').instanciasInvocacao?.[0].usosAutomacaoRodada?.total).toBe(1);
    expect(useMapStore.getState().entities[tokenId]?.invocationInstanceId).toBe('instancia-1');
  });

  it('permite intervenção do dono e do Mestre, mas bloqueia outro jogador', () => {
    const { tokenId } = prepararAutomacao();

    comoTela({ profileId: 'perfil-alheio', role: 'PLAYER' });
    expect(definirAutomacaoInvocacao(tokenId, true).ok).toBe(false);
    expect(pegarFicha('dono').instanciasInvocacao?.[0].automacaoSuspensa).toBeUndefined();

    comoTela({ profileId: 'perfil-dono', role: 'PLAYER' });
    expect(definirAutomacaoInvocacao(tokenId, true)).toEqual({ ok: true });
    expect(pegarFicha('dono').instanciasInvocacao?.[0].automacaoSuspensa).toBe(true);

    comoTela({ profileId: null, role: 'MASTER' });
    expect(definirAutomacaoInvocacao(tokenId, false)).toEqual({ ok: true });
    expect(pegarFicha('dono').instanciasInvocacao?.[0].automacaoSuspensa).toBe(false);
  });

  it('respeita a suspensão antes de consumir ações ou recursos', async () => {
    const { tokenId, custoPeDono } = prepararAutomacao();
    expect(definirAutomacaoInvocacao(tokenId, true)).toEqual({ ok: true });

    await despacharAutonomiasInvocacao('aoCausarDano', { usuarioId: 'dono', alvoId: 'inimigo', cena: {}, dano: {} }, cadeia());

    expect(pegarFicha('dono').instanciasInvocacao?.[0]).toMatchObject({
      automacaoSuspensa: true,
      economiaAcoes: { acaoComum: { atual: 1, maximo: 1 } },
    });
    expect(pegarFicha('dono').instanciasInvocacao?.[0].usosAutomacaoRodada).toBeUndefined();
    expect(pegarFicha('dono').peCurrent).toBe(custoPeDono);
  });
});
