// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ficha, montarMesa, comoTela, pegarFicha } from './helpers/mesaReal';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useDice3DStore } from '@/stores/useDice3DStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useLogStore } from '@/stores/useLogStore';
import { useMapStore } from '@/stores/useMapStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useOmniRuntimeStore } from '@/stores/useOmniRuntimeStore';
import { useTestRequestStore } from '@/stores/useTestRequestStore';
import { useShikigamiHudStore } from '@/stores/useShikigamiHudStore';
import { ShikigamiOwnerPanel } from '@/components/mapa/ui/ShikigamiOwnerPanel';
import type { TestRequest } from '@/stores/useTestRequestStore';
import {
  causarDanoInvocacao,
  comandarAtaque,
  comandarAtaqueAdaptativoMahoraga,
  comandarRecuperacaoFerimentoMahoraga,
  comandarRegeneracaoAdaptativaMahoraga,
  configurarVontadeDivinaMahoraga,
  encerrarCondicaoMahoraga,
  invocarControladores,
  registrarCondicaoMahoraga,
  registrarFenomenoRodaMahoraga,
  registrarFerimentoMahoraga,
} from '@/lib/controlador/mapa';
import { criarPacoteDezSombras } from '@/lib/controlador/dezSombras';
import { resolverDanoAposTRInvocacao } from '@/lib/controlador/resolucaoTR';
import {
  DURACAO_GIRO_TRES_RODAS_MAHORAGA,
  efeitosRodaNoDano,
  estadoInicialMahoraga,
  limitePEAdicionalRegeneracaoMahoraga,
  normalizarEstadoMahoraga,
  processarAdaptacoesCondicoesMahoraga,
  processarInicioTurnoMahoraga,
  processarVontadeDivinaMahoraga,
  obterIgnoranciaAdaptativaMahoraga,
  registrarAtaqueContraAlvoMahoraga,
  resolverCicloVidaMahoraga,
} from '@/lib/controlador/dezSombrasMahoraga';

const DONO = 'mahoraga-owner';
const INIMIGO = 'mahoraga-enemy';
const COMBATE = 'combate-mahoraga-real';

function prepararMesaMahoraga() {
  vi.restoreAllMocks();
  useInventoryStore.getState().resetAll();
  useLogStore.getState().clearLogs();
  useTestRequestStore.getState().clearAll();
  useOmniEntidadesStore.setState({ entidades: {} });
  useOmniRuntimeStore.setState({ efeitos: {}, deleted: {} } as never);

  const modelos = criarPacoteDezSombras(DONO, false).map(modelo => ({
    ...modelo,
    domado: true,
    aprovacaoMestre: 'aprovada' as const,
    versaoAprovada: modelo.versaoModelo,
    alcanceInvocacaoM: 18,
  }));
  montarMesa([
    ficha(DONO, {
      name: 'Controlador',
      specialization: 'Controlador',
      profileId: 'perfil-mahoraga-owner',
      level: 15,
      peCurrent: 100,
      peMax: 100,
      treinoControle: 1,
      tecnicaAmaldicoada: 'Dez Sombras',
      invocacoesConhecidas: modelos,
      hpCurrent: 50,
      hpMax: 50,
    }),
    ficha(INIMIGO, {
      name: 'Oponente',
      category: 'INIMIGO',
      characterClass: 'Feiticeiro',
      profileId: 'perfil-mahoraga-enemy',
      hpCurrent: 1000,
      hpMax: 1000,
      ca: 1,
    }),
  ], { [DONO]: [2, 2], [INIMIGO]: [6, 2] });

  useMapStore.getState().clearWalls();
  comoTela({ profileId: 'perfil-mahoraga-owner', role: 'PLAYER' });
  useCombatStore.setState({
    inCombat: true,
    combatId: COMBATE,
    round: 1,
    currentTurnIndex: 0,
    initiativeOrder: [{ charId: DONO, charName: 'Controlador', roll: 20, bonus: 0, total: 20 }],
  } as never);
}

function mahoragaModelo() {
  const model = pegarFicha(DONO).invocacoesConhecidas?.find(item => item.subcategoria === 'dez-sombras:mahoraga');
  if (!model) throw new Error('Mahoraga is missing from the Ten Shadows catalog.');
  return model;
}

async function invocarMahoraga(): Promise<string> {
  const resultado = invocarControladores(DONO, [{ invocacaoId: mahoragaModelo().id, x: 280, y: 140 }]);
  if (!resultado.ok) throw new Error(resultado.motivo);
  const tokenId = resultado.tokenIds[0];
  if (!tokenId) throw new Error('Mahoraga invocation did not return a map token.');
  return tokenId;
}

function instanciaMahoraga() {
  const instancia = pegarFicha(DONO).instanciasInvocacao?.find(item => item.modeloId === mahoragaModelo().id);
  if (!instancia) throw new Error('Mahoraga invocation state is missing.');
  return instancia;
}

function rolarDanoMinimo() {
  return vi.spyOn(useDice3DStore.getState(), 'requestNotation').mockImplementation(async anotacao => {
    const grupos = [...anotacao.matchAll(/(\d+)d\d+/g)];
    return grupos.flatMap(grupo => Array(Number(grupo[1])).fill(1));
  });
}

function rolarD20(...resultados: number[]) {
  const fila = [...resultados];
  return vi.spyOn(useDice3DStore.getState(), 'requestRoll').mockImplementation(async tipos =>
    tipos.map(() => fila.shift() ?? 15),
  );
}

describe('Mahoraga · regras puras da Roda e dos estágios', () => {
  it('calcula o limite de PE adicional com o modificador de Constituição da ficha', () => {
    expect(limitePEAdicionalRegeneracaoMahoraga(28)).toBe(17);
    expect(limitePEAdicionalRegeneracaoMahoraga(10)).toBe(8);
  });

  it('aplica RD, metade, quarto e piso de 1 PV nos giros corretos', () => {
    const base = { pv: 50, pvTemporarios: 0, ataqueCorpoACorpo: false, ataquesCorpoACorpoRecebidos: 0 };
    const dano100 = efeitosRodaNoDano(undefined, 100, base);
    const giro2 = efeitosRodaNoDano({ id: 'x', nome: 'x', giros: 2, ultimaRodadaGiro: 1 }, 100, base);
    const giro3 = efeitosRodaNoDano({ id: 'x', nome: 'x', giros: 3, ultimaRodadaGiro: 1 }, 100, base);
    const giro4 = efeitosRodaNoDano({ id: 'x', nome: 'x', giros: 4, ultimaRodadaGiro: 1 }, 100, base);
    const giro5 = efeitosRodaNoDano({ id: 'x', nome: 'x', giros: 5, ultimaRodadaGiro: 1 }, 100, base);
    expect([dano100.danoNosPV, giro2.danoNosPV, giro3.danoNosPV, giro4.danoNosPV, giro5.danoNosPV]).toEqual([100, 88, 44, 22, 22]);
  });

  it('avança só com 150 de excesso e fenômeno novo; estágio 3 pode derrotar', () => {
    const inicial = estadoInicialMahoraga('cena-1');
    const insuficiente = resolverCicloVidaMahoraga({ estado: inicial, pvAtual: 1000, danoNosPV: 1001, fenomenoJaConhecido: false });
    expect(insuficiente).toMatchObject({ pvAtual: 1000, pvMaximo: 1000, estadoInvocacao: 'ativa', estado: { estagioVida: 1 } });

    const estagio2 = resolverCicloVidaMahoraga({ estado: inicial, pvAtual: 1000, danoNosPV: 1150, fenomenoJaConhecido: false });
    expect(estagio2).toMatchObject({ pvAtual: 0, pvMaximo: 500, estadoInvocacao: 'caida', estado: { estagioVida: 2, despertarPendente: true } });
    const estagio3 = resolverCicloVidaMahoraga({ estado: { ...estagio2.estado, despertarPendente: false }, pvAtual: 500, danoNosPV: 650, fenomenoJaConhecido: false });
    expect(estagio3).toMatchObject({ pvAtual: 0, pvMaximo: 250, estadoInvocacao: 'caida', estado: { estagioVida: 3, despertarPendente: true } });
    const derrotado = resolverCicloVidaMahoraga({ estado: { ...estagio3.estado, despertarPendente: false }, pvAtual: 250, danoNosPV: 400, fenomenoJaConhecido: false });
    expect(derrotado).toMatchObject({ pvAtual: -250, pvMaximo: 250, estadoInvocacao: 'derrotada' });
  });

  it('reinicia fenômenos por cena, preserva estágio e expira metade de dano após 600 rodadas', () => {
    const estado = {
      ...estadoInicialMahoraga('cena-1'),
      estagioVida: 2 as const,
      fenomenos: [{ id: 'dco', nome: 'corte', tipoDano: 'DCO' as const, giros: 3 as const, ultimaRodadaGiro: 4, expiraReducaoDanoNaRodada: 4 + DURACAO_GIRO_TRES_RODAS_MAHORAGA }],
      alvoFocoId: 'alvo-persistente',
      adaptacoesCombate: [{ alvoId: 'alvo-persistente', nomeAlvo: 'Oponente', giros: 2, defesaRegistrada: 24 }],
    };
    const novaCena = normalizarEstadoMahoraga(estado, 'cena-2');
    expect(novaCena).toMatchObject({
      estagioVida: 2,
      fenomenos: [],
      ataquesCorpoACorpoRecebidos: 0,
      alvoFocoId: undefined,
      adaptacoesCombate: [{ alvoId: 'alvo-persistente', giros: 2 }],
    });
    const turno = processarInicioTurnoMahoraga(estado, 4 + DURACAO_GIRO_TRES_RODAS_MAHORAGA);
    expect(turno.expirados).toEqual(['corte']);
    expect(turno.estado.fenomenos[0]).toMatchObject({ giros: 2, expiraReducaoDanoNaRodada: undefined });
  });

  it('mantém adaptação de invocação pelo ID da instância e migra tokens antigos', () => {
    const estado = {
      ...estadoInicialMahoraga(COMBATE),
      adaptacoesCombate: [{ alvoId: 'token-antigo', nomeAlvo: 'Invocação alvo', giros: 3, defesaRegistrada: 18 }],
    };
    expect(obterIgnoranciaAdaptativaMahoraga(estado, 'invocacao:instancia-alvo', ['token-antigo']))
      .toMatchObject({ giros: 3, ignoraResistencias: true });
    const atualizado = registrarAtaqueContraAlvoMahoraga(estado, {
      id: 'invocacao:instancia-alvo', idsLegados: ['token-antigo'], nome: 'Invocação alvo', defesa: 20,
    });
    expect(atualizado).toMatchObject({ girosAntes: 3, girosDepois: 4 });
    expect(atualizado.estado.adaptacoesCombate).toEqual([
      expect.objectContaining({ alvoId: 'invocacao:instancia-alvo', giros: 4, defesaRegistrada: 18 }),
    ]);
  });

  it('acumula +5 por rodada de condição e fixa resistência permanente quando ela termina', () => {
    const estado = estadoInicialMahoraga('cena-1');
    const primeira = processarAdaptacoesCondicoesMahoraga(estado, [
      { conditionId: 'atordoado', nome: 'Atordoado', grau: 'extrema' },
    ], 1);
    const repetida = processarAdaptacoesCondicoesMahoraga(primeira, [
      { conditionId: 'atordoado', nome: 'Atordoado', grau: 'extrema' },
    ], 1);
    const segunda = processarAdaptacoesCondicoesMahoraga(repetida, [
      { conditionId: 'atordoado', nome: 'Atordoado', grau: 'extrema' },
    ], 2);
    expect(repetida.adaptacoesCondicoes[0].bonusTRConsecutivo).toBe(5);
    expect(segunda.adaptacoesCondicoes[0]).toMatchObject({ rodadasConsecutivas: 2, bonusTRConsecutivo: 10 });
    const livre = processarAdaptacoesCondicoesMahoraga(segunda, [], 3);
    expect(livre.adaptacoesCondicoes[0]).toMatchObject({ condicaoAtiva: false, bonusTRPermanente: 40 });
    expect(normalizarEstadoMahoraga(livre, 'cena-2').adaptacoesCondicoes[0].bonusTRPermanente).toBe(40);
  });

  it('Vontade Divina ativa somente após domesticação e termina sem reiniciar na mesma queda', () => {
    const estado = estadoInicialMahoraga('cena-1');
    expect(processarVontadeDivinaMahoraga(estado, {
      domadoPermanentemente: false, donoIncapacitado: true, maiorModificadorMental: 4, rodada: 1, combateId: 'cena-1',
    }).estado.vontadeDivina).toBeUndefined();
    const inicio = processarVontadeDivinaMahoraga(estado, {
      domadoPermanentemente: true, donoIncapacitado: true, maiorModificadorMental: 2, rodada: 1, combateId: 'cena-1',
    });
    expect(inicio).toMatchObject({ iniciou: true, estado: { vontadeDivina: { ativa: true, rodadasRestantes: 2 } } });
    const intermediario = processarVontadeDivinaMahoraga(inicio.estado, {
      domadoPermanentemente: true, donoIncapacitado: true, maiorModificadorMental: 2, rodada: 2, combateId: 'cena-1',
    });
    expect(intermediario.estado.vontadeDivina?.rodadasRestantes).toBe(1);
    const fim = processarVontadeDivinaMahoraga(intermediario.estado, {
      domadoPermanentemente: true, donoIncapacitado: true, maiorModificadorMental: 2, rodada: 3, combateId: 'cena-1',
    });
    expect(fim).toMatchObject({ terminou: true, estado: { vontadeDivina: { ativa: false, bloqueadaAteRecuperar: true } } });
    const semReinicio = processarVontadeDivinaMahoraga(fim.estado, {
      domadoPermanentemente: true, donoIncapacitado: true, maiorModificadorMental: 2, rodada: 4, combateId: 'cena-1',
    });
    expect(semReinicio).toMatchObject({ iniciou: false, estado: { vontadeDivina: { ativa: false } } });
    const novoCombate = normalizarEstadoMahoraga({
      ...inicio.estado,
      vontadeDivina: {
        ...inicio.estado.vontadeDivina!,
        prioridade: 'eliminar_ameaca',
        alvoPrioritarioId: 'alvo-do-combate-anterior',
        ultimaOrdem: 'Proteger o Controlador.',
      },
    }, 'cena-2');
    expect(novoCombate.vontadeDivina).toMatchObject({
      ativa: false, rodadasRestantes: 0, prioridade: 'eliminar_ameaca', ultimaOrdem: 'Proteger o Controlador.',
    });
    expect(novoCombate.vontadeDivina).not.toHaveProperty('alvoPrioritarioId');
  });
});

describe('Mahoraga · resolução em mesa real', () => {
  beforeEach(prepararMesaMahoraga);
  afterEach(async () => {
    cleanup();
    await new Promise(resolve => setTimeout(resolve, 10));
    vi.restoreAllMocks();
  });

  it('materializa os três estágios e desperta automaticamente no próximo turno do Controlador', async () => {
    const tokenId = await invocarMahoraga();
    expect(instanciaMahoraga()).toMatchObject({ hpAtual: 1000, hpMaximoAtual: 1000, estado: 'ativa', estadoMahoraga: { estagioVida: 1 } });

    expect(causarDanoInvocacao(tokenId, 1150, 'DP', instanciaMahoraga().id, {
      eventoId: 'maho-ciclo-estagio-1', fenomenoId: 'fenomeno-um', fenomenoNome: 'Fenômeno um',
    })).toMatchObject({ ok: true, hpRestante: 0, destruida: false });
    expect(instanciaMahoraga()).toMatchObject({ hpAtual: 0, hpMaximoAtual: 500, estado: 'caida', estadoMahoraga: { estagioVida: 2, despertarPendente: true } });

    useCombatStore.getState().nextTurn();
    await waitFor(() => expect(useMapStore.getState().entities[tokenId]).toMatchObject({ hp: 500, hpMax: 500, invocationState: 'ativa' }));

    expect(causarDanoInvocacao(tokenId, 650, 'DA', instanciaMahoraga().id, {
      eventoId: 'maho-ciclo-estagio-2', fenomenoId: 'fenomeno-dois', fenomenoNome: 'Fenômeno dois',
    })).toMatchObject({ ok: true, hpRestante: 0, destruida: false });
    useCombatStore.getState().nextTurn();
    await waitFor(() => expect(instanciaMahoraga()).toMatchObject({ hpAtual: 250, hpMaximoAtual: 250, estado: 'ativa', estadoMahoraga: { estagioVida: 3, despertarPendente: false } }));

    expect(causarDanoInvocacao(tokenId, 400, 'DCG', instanciaMahoraga().id, {
      eventoId: 'maho-ciclo-estagio-3', fenomenoId: 'fenomeno-tres', fenomenoNome: 'Fenômeno três',
    })).toMatchObject({ ok: true, hpRestante: -250, destruida: true });
    expect(useMapStore.getState().entities[tokenId]).toBeUndefined();
    expect(instanciaMahoraga()).toMatchObject({ hpAtual: -250, hpMaximoAtual: 250, estado: 'derrotada' });
  });

  it('não progride se o golpe terminal usa fenômeno conhecido e trata evento repetido uma vez', async () => {
    const tokenId = await invocarMahoraga();
    const instanciaId = instanciaMahoraga().id;
    const primeiro = causarDanoInvocacao(tokenId, 100, 'DP', instanciaId, {
      eventoId: 'maho-mesmo-fenomeno-1', fenomenoId: 'corte-base', fenomenoNome: 'Corte base',
    });
    expect(primeiro).toMatchObject({ ok: true, hpRestante: 900 });

    const danoTerminal = causarDanoInvocacao(tokenId, 1000, 'DP', instanciaId, {
      eventoId: 'maho-mesmo-fenomeno-2', fenomenoId: 'corte-base', fenomenoNome: 'Corte base',
    });
    expect(danoTerminal).toMatchObject({ ok: true, hpRestante: 1000, destruida: false });
    expect(instanciaMahoraga()).toMatchObject({ hpAtual: 1000, hpMaximoAtual: 1000, estado: 'ativa', estadoMahoraga: { estagioVida: 1 } });

    const before = instanciaMahoraga().hpAtual;
    const firstEvent = causarDanoInvocacao(tokenId, 25, 'DI', instanciaId, { eventoId: 'maho-idempotencia', fenomenoId: 'impacto' });
    const retry = causarDanoInvocacao(tokenId, 25, 'DI', instanciaId, { eventoId: 'maho-idempotencia', fenomenoId: 'impacto' });
    expect(firstEvent).toMatchObject({ ok: true, hpRestante: before - 25 });
    expect(retry).toMatchObject({ ok: true, hpRestante: before - 25 });
    expect(instanciaMahoraga().hpAtual).toBe(before - 25);
  });

  it('limita a Roda a cinco giros e não cria regenerações extras depois da adaptação completa', async () => {
    await invocarMahoraga();
    const model = mahoragaModelo();
    const instanciaId = instanciaMahoraga().id;
    for (let giro = 1; giro <= 5; giro += 1) {
      expect(registrarFenomenoRodaMahoraga(DONO, model.id, {
        id: 'fonte-suprema', nome: 'Fonte suprema', eventoId: `maho-giro-${giro}`, tipoDano: 'DNR',
      })).toMatchObject({ ok: true, giros: giro });
    }
    expect(registrarFenomenoRodaMahoraga(DONO, model.id, {
      id: 'fonte-suprema', nome: 'Fonte suprema', eventoId: 'maho-giro-6', tipoDano: 'DNR',
    })).toMatchObject({ ok: true, giros: 5 });
    expect(instanciaMahoraga()).toMatchObject({
      estadoMahoraga: { regeneracoesRodaPendentes: 5, fenomenos: [expect.objectContaining({ id: 'fonte-suprema', giros: 5 })] },
    });
    expect(causarDanoInvocacao(useMapStore.getState().entities[instanciaMahoraga().tokenId].id, 100, 'DNR', instanciaId, {
      eventoId: 'maho-giro-dano-final', fenomenoId: 'fonte-suprema', fenomenoNome: 'Fonte suprema',
    })).toMatchObject({ ok: true, hpRestante: 978 });
    expect(instanciaMahoraga().estadoMahoraga?.regeneracoesRodaPendentes).toBe(5);
  });

  it('gira de novo após cinco rodadas e não duplica o giro quando o mesmo TR gera o dano', async () => {
    const tokenId = await invocarMahoraga();
    const model = mahoragaModelo();
    const instancia = instanciaMahoraga();
    expect(registrarFenomenoRodaMahoraga(DONO, model.id, {
      id: 'feitiço-persistente', nome: 'Feitiço persistente', eventoId: 'maho-feitico-primeiro-contato', tipoDano: 'DNR',
    })).toMatchObject({ ok: true, giros: 1 });

    useCombatStore.setState({ round: 6, currentTurnIndex: 0 } as never);
    await waitFor(() => expect(instanciaMahoraga().estadoMahoraga?.fenomenos[0]).toMatchObject({ giros: 2, proximaRodadaGiroAutomatico: 11 }));
    expect(instanciaMahoraga().estadoMahoraga?.regeneracoesRodaPendentes).toBe(2);

    const request = {
      id: 'maho-tr-com-dano',
      sourceTag: 'maho-tr-com-dano-event',
      charId: DONO,
      charName: 'General Divino Mahoraga',
      kind: 'save',
      testName: 'Fortitude',
      dc: 20,
      createdAt: Date.now(),
      result: { d20: 1, bonus: 0, total: 1, rolledAt: Date.now() },
      invocationResolution: {
        kind: 'shikigami_damage_after_save',
        ownerCharacterId: DONO,
        invocationId: model.id,
        invocationInstanceId: instancia.id,
        actionId: 'efeito-teste',
        sourceName: 'Efeito de teste',
        damageFormula: '1d12',
        damageBonus: 0,
        damageType: 'DA',
        damageOnSuccess: 'nenhum',
        targetInvocation: {
          tokenId,
          ownerCharacterId: DONO,
          invocationId: model.id,
          invocationInstanceId: instancia.id,
          name: model.nome,
          tipoAlvo: 'unico',
        },
      },
    } as TestRequest;
    rolarDanoMinimo();
    expect(await resolverDanoAposTRInvocacao(request)).toEqual({ passou: false, dano: 1 });
    expect(instanciaMahoraga().estadoMahoraga?.fenomenos).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: `${model.id}:efeito-teste`, giros: 1 }),
    ]));
    expect(instanciaMahoraga().estadoMahoraga?.regeneracoesRodaPendentes).toBe(3);
    expect(instanciaMahoraga().hpAtual).toBeLessThan(1000);
  });

  it('regenera com limite de 17 PE, usa Ação Livre uma vez abaixo da metade e consome giro como Simples', async () => {
    const tokenId = await invocarMahoraga();
    const model = mahoragaModelo();
    const peAntes = pegarFicha(DONO).peCurrent;
    causarDanoInvocacao(tokenId, 600, 'DCO', instanciaMahoraga().id, {
      eventoId: 'maho-regeneracao-meia-vida', fenomenoId: 'dano:DCO', fenomenoNome: 'Corte',
    });
    rolarDanoMinimo();

    const livre = await comandarRegeneracaoAdaptativaMahoraga(DONO, model.id, {
      requestId: 'maho-regeneracao-livre-17pe', modo: 'temporarios', peAdicional: 17,
    });
    expect(livre).toMatchObject({ ok: true, custoPE: 17, categoriaAcao: 'acaoLivre', modo: 'temporarios' });
    expect(pegarFicha(DONO).peCurrent).toBe(peAntes - 17);
    expect(instanciaMahoraga().estadoMahoraga?.regeneracaoLivreUsada).toMatchObject({ rodada: 1 });

    expect(registrarFenomenoRodaMahoraga(DONO, model.id, {
      id: 'feitiço-lento', nome: 'Feitiço lento', eventoId: 'maho-wheel-for-heal', tipoDano: 'DI',
    })).toMatchObject({ ok: true });
    const simples = await comandarRegeneracaoAdaptativaMahoraga(DONO, model.id, {
      requestId: 'maho-regeneracao-simples', modo: 'temporarios', peAdicional: 0, origemRoda: true,
    });
    expect(simples).toMatchObject({ ok: true, custoPE: 0, categoriaAcao: 'acaoSimples' });
    expect(instanciaMahoraga().estadoMahoraga?.regeneracoesRodaPendentes).toBe(1);
    expect(instanciaMahoraga().economiaAcoes?.acaoSimples?.atual).toBe(0);
  });

  it('usa reanexação de 4 PE para membro disponível e cura ferimento complexo separado por 8 PE', async () => {
    await invocarMahoraga();
    const model = mahoragaModelo();
    comoTela({ profileId: 'perfil-mahoraga-owner', role: 'MASTER' });
    const registrado = registrarFerimentoMahoraga(DONO, model.id, {
      descricao: 'Corte profundo no ombro',
      ferimentoComplexo: true,
      membroSeparado: 'braço direito',
      membroDisponivel: true,
    });
    expect(registrado.ok).toBe(true);
    if (!registrado.ok) throw new Error(registrado.motivo);
    comoTela({ profileId: 'perfil-mahoraga-owner', role: 'PLAYER' });
    const peInicial = pegarFicha(DONO).peCurrent;

    const curaMembroDisponivel = comandarRecuperacaoFerimentoMahoraga(DONO, model.id, {
      requestId: 'maho-nao-curar-membro-disponivel', ferimentoId: registrado.ferimentoId, operacao: 'curar_ferimento',
    });
    expect(curaMembroDisponivel).toMatchObject({ ok: false, motivo: expect.stringContaining('reanexação por 4 PE') });
    expect(pegarFicha(DONO).peCurrent).toBe(peInicial);

    const reanexado = comandarRecuperacaoFerimentoMahoraga(DONO, model.id, {
      requestId: 'maho-reanexar-membro-1', ferimentoId: registrado.ferimentoId, operacao: 'reanexar_membro',
    });
    expect(reanexado).toMatchObject({ ok: true, custoPE: 4, categoriaAcao: 'acaoSimples' });
    expect(pegarFicha(DONO).peCurrent).toBe(peInicial - 4);
    expect(instanciaMahoraga().estadoMahoraga?.ferimentosComplexos[0]).toMatchObject({ ferimentoAtivo: false, membroDisponivel: false, membroReanexado: true });
    expect(comandarRecuperacaoFerimentoMahoraga(DONO, model.id, {
      requestId: 'maho-reanexar-membro-1', ferimentoId: registrado.ferimentoId, operacao: 'reanexar_membro',
    })).toMatchObject({ ok: true, custoPE: 4, duplicado: true });
    expect(pegarFicha(DONO).peCurrent).toBe(peInicial - 4);

    comoTela({ profileId: 'perfil-mahoraga-owner', role: 'MASTER' });
    const ferimentoSemMembro = registrarFerimentoMahoraga(DONO, model.id, {
      descricao: 'Lesão interna complexa',
      ferimentoComplexo: true,
    });
    expect(ferimentoSemMembro.ok).toBe(true);
    if (!ferimentoSemMembro.ok) throw new Error(ferimentoSemMembro.motivo);
    comoTela({ profileId: 'perfil-mahoraga-owner', role: 'PLAYER' });
    const curado = comandarRecuperacaoFerimentoMahoraga(DONO, model.id, {
      requestId: 'maho-curar-ferimento-2', ferimentoId: ferimentoSemMembro.ferimentoId, operacao: 'curar_ferimento',
    });
    expect(curado).toMatchObject({ ok: true, custoPE: 8, categoriaAcao: 'acaoComplexa' });
    expect(pegarFicha(DONO).peCurrent).toBe(peInicial - 12);
    expect(instanciaMahoraga().estadoMahoraga?.ferimentosComplexos.find(item => item.id === ferimentoSemMembro.ferimentoId))
      .toMatchObject({ ferimentoAtivo: false });
  });

  it('recusa regeneração além do limite de PE e não rola nem gasta recursos', async () => {
    await invocarMahoraga();
    const antes = pegarFicha(DONO).peCurrent;
    const requestNotation = vi.spyOn(useDice3DStore.getState(), 'requestNotation');
    const resultado = await comandarRegeneracaoAdaptativaMahoraga(DONO, mahoragaModelo().id, {
      requestId: 'maho-regeneracao-pe-invalido', modo: 'cura', peAdicional: 18,
    });
    expect(resultado).toMatchObject({ ok: false, motivo: expect.stringContaining('entre 0 e 17') });
    expect(requestNotation).not.toHaveBeenCalled();
    expect(pegarFicha(DONO).peCurrent).toBe(antes);
    expect(instanciaMahoraga().economiaAcoes?.acaoComplexa?.atual).toBe(1);
  });

  it('exige cinco giros completos antes de preparar um Ataque Adaptativo', async () => {
    await invocarMahoraga();
    const model = mahoragaModelo();
    expect(registrarFenomenoRodaMahoraga(DONO, model.id, {
      id: 'propriedade-dp', nome: 'Corte da fonte', eventoId: 'maho-ataque-incompleto', tipoDano: 'DP',
    })).toMatchObject({ ok: true, giros: 1 });
    expect(comandarAtaqueAdaptativoMahoraga(DONO, model.id, {
      tipoDano: 'DP', requestId: 'maho-tentar-ataque-incompleto',
    })).toMatchObject({ ok: false, motivo: expect.stringContaining('cinco giros') });
    expect(instanciaMahoraga().economiaAcoes?.acaoSimples?.atual).toBe(1);
  });

  it('restaura ações no início do próximo turno do dono e conta tentativas contra o mesmo alvo, incluindo erros', async () => {
    const tokenId = await invocarMahoraga();
    const model = mahoragaModelo();
    const targetToken = useMapStore.getState().entities['e-' + INIMIGO];
    if (!targetToken) throw new Error('Combat fixture is missing the opponent token.');
    useMapStore.getState().updateEntity(targetToken.id, { x: 420, y: 140 });
    for (let giro = 1; giro <= 5; giro += 1) {
      expect(registrarFenomenoRodaMahoraga(DONO, model.id, {
        id: 'propriedade-dp', nome: 'Perfurante', eventoId: `maho-ataque-adaptativo-requisito-${giro}`, tipoDano: 'DP',
      })).toMatchObject({ ok: true, giros: giro });
    }
    expect(comandarAtaqueAdaptativoMahoraga(DONO, model.id, {
      tipoDano: 'DP', requestId: 'maho-preparar-ataque-adaptativo',
    })).toMatchObject({ ok: true, tipoDano: 'DP' });
    expect(instanciaMahoraga().economiaAcoes?.acaoSimples?.atual).toBe(0);

    rolarD20(1, 15, 15, 15);
    rolarDanoMinimo();
    const falha = await comandarAtaque(DONO, model.id, 'punho-do-exterminio', INIMIGO, {
      instanciaId: instanciaMahoraga().id, requestId: 'maho-alvo-tentativa-1', dadosReduzidos: 0,
    });
    expect(falha).toMatchObject({ ok: true, acertou: false });
    expect(instanciaMahoraga().estadoMahoraga).toMatchObject({
      ataqueAdaptativoTipo: undefined,
      adaptacoesCombate: [expect.objectContaining({ alvoId: INIMIGO, giros: 1, defesaRegistrada: expect.any(Number) })],
    });

    for (let tentativa = 2; tentativa <= 4; tentativa += 1) {
      useCombatStore.setState({ round: tentativa, currentTurnIndex: 0 } as never);
      await waitFor(() => expect(instanciaMahoraga().economiaAcoes?.acaoComplexa?.atual).toBe(1));
      const resultado = await comandarAtaque(DONO, model.id, 'punho-do-exterminio', INIMIGO, {
        instanciaId: instanciaMahoraga().id, requestId: `maho-alvo-tentativa-${tentativa}`, dadosReduzidos: 0,
      });
      expect(resultado).toMatchObject({ ok: true, acertou: true });
    }
    expect(instanciaMahoraga().estadoMahoraga?.adaptacoesCombate).toEqual([
      expect.objectContaining({ alvoId: INIMIGO, giros: 4, defesaRegistrada: expect.any(Number) }),
    ]);
    expect(useMapStore.getState().entities[tokenId]).toBeDefined();
  });

  it('registra condição pelo Mestre, acumula adaptação no turno real e fixa resistência ao encerrar', async () => {
    const tokenId = await invocarMahoraga();
    const model = mahoragaModelo();
    comoTela({ profileId: 'perfil-mahoraga-owner', role: 'MASTER' });

    expect(registrarCondicaoMahoraga(DONO, model.id, 'atordoado')).toMatchObject({ ok: true });
    expect(useMapStore.getState().entities[tokenId]?.invocationConditionIds).toContain('atordoado');

    useCombatStore.setState({ round: 2, currentTurnIndex: 0 } as never);
    await waitFor(() => expect(instanciaMahoraga().estadoMahoraga?.adaptacoesCondicoes).toContainEqual(
      expect.objectContaining({ conditionId: 'atordoado', condicaoAtiva: true, rodadasConsecutivas: 1, bonusTRConsecutivo: 5 }),
    ));
    useCombatStore.setState({ round: 3, currentTurnIndex: 0 } as never);
    await waitFor(() => expect(instanciaMahoraga().estadoMahoraga?.adaptacoesCondicoes[0]).toMatchObject({
      rodadasConsecutivas: 2, bonusTRConsecutivo: 10,
    }));

    expect(encerrarCondicaoMahoraga(DONO, model.id, 'atordoado')).toMatchObject({ ok: true, bonusTRPermanente: 40 });
    expect(useMapStore.getState().entities[tokenId]?.invocationConditionIds).not.toContain('atordoado');
    expect(instanciaMahoraga().estadoMahoraga?.adaptacoesCondicoes[0]).toMatchObject({
      condicaoAtiva: false, bonusTRPermanente: 40,
    });
  });

  it('aplica ao TR contra a condição o bônus acumulado de adaptação de Mahoraga', async () => {
    const maho = mahoragaModelo();
    const modelos = pegarFicha(DONO).invocacoesConhecidas ?? [];
    const nue = modelos.find(item => item.subcategoria === 'dez-sombras:nue');
    if (!nue) throw new Error('Nue is missing from the Ten Shadows catalog.');
    useCharacterStore.getState().updateCharacter(DONO, {
      invocacoesConhecidas: modelos.map(item => item.id === nue.id
        ? {
          ...item,
          economiaAcoesConfigurada: { acaoComplexa: 1 },
          acoes: [{
            id: 'teste-condicao', nome: 'Teste contra Atordoado', tipo: 'habilidade' as const,
            tipoExecucao: 'manual' as const, teste: 'resistencia' as const,
            resistenciaAlvo: 'Vontade', atributoCD: 'presenca' as const,
            categoriaAcao: 'acao_complexa' as const, alcanceM: 10, condicaoAlvoId: 'atordoado',
          }],
        }
        : item),
    });
    const invocadas = invocarControladores(DONO, [
      { invocacaoId: maho.id, x: 280, y: 140 },
      { invocacaoId: nue.id, x: 560, y: 140 },
    ]);
    if (!invocadas.ok) throw new Error(invocadas.motivo);
    expect(invocadas.ok).toBe(true);
    const tokenMahoraga = invocadas.tokenIds[0];
    const instanciaNue = pegarFicha(DONO).instanciasInvocacao?.find(item => item.modeloId === nue.id);
    if (!tokenMahoraga || !instanciaNue) throw new Error('Combat fixtures did not materialize both shikigami.');

    comoTela({ profileId: 'perfil-mahoraga-owner', role: 'MASTER' });
    expect(registrarCondicaoMahoraga(DONO, maho.id, 'atordoado')).toMatchObject({ ok: true });
    useCombatStore.setState({ round: 2, currentTurnIndex: 0 } as never);
    await waitFor(() => expect(instanciaMahoraga().estadoMahoraga?.adaptacoesCondicoes[0]?.bonusTRConsecutivo).toBe(5));
    useCombatStore.setState({ round: 3, currentTurnIndex: 0 } as never);
    await waitFor(() => expect(instanciaMahoraga().estadoMahoraga?.adaptacoesCondicoes[0]?.bonusTRConsecutivo).toBe(10));

    comoTela({ profileId: 'perfil-mahoraga-owner', role: 'PLAYER' });
    const resultado = await comandarAtaque(DONO, nue.id, 'teste-condicao', `invoc:${tokenMahoraga}`, {
      instanciaId: instanciaNue.id, requestId: 'nue-tr-atordoado-mahoraga',
    });
    expect(resultado).toMatchObject({ ok: true, testePendente: true });
    const pedido = useTestRequestStore.getState().requests.find(item => item.sourceTag?.includes('nue-tr-atordoado-mahoraga'));
    expect(pedido).toMatchObject({
      conditionIds: ['atordoado'],
      bonusOverride: expect.any(Number),
      bonusBreakdownOverride: expect.stringContaining('Mahoraga +10 contra atordoado'),
    });
  });

  it('exibe os controles de Vontade Divina e adaptação de condição na HUD real', async () => {
    const tokenId = await invocarMahoraga();
    comoTela({ profileId: 'perfil-mahoraga-owner', role: 'MASTER' });
    useShikigamiHudStore.setState({ sourceTokenId: tokenId } as never);

    render(createElement(ShikigamiOwnerPanel, { tokenId }));

    expect(screen.getByTestId('mahoraga-vontade-divina')).toBeTruthy();
    expect(screen.getByLabelText('Prioridade da Vontade Divina')).toBeTruthy();
    expect(screen.getByTestId('mahoraga-condition-adaptation')).toBeTruthy();
    expect(screen.getByTestId('mahoraga-injury-regeneration')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Condição adaptada por Mahoraga'), { target: { value: 'atordoado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar condição ativa' }));
    await waitFor(() => expect(useMapStore.getState().entities[tokenId]?.invocationConditionIds).toContain('atordoado'));
  });

  it('agrupa execuções diferentes pela mesma propriedade-base informada pelo Mestre', async () => {
    const tokenId = await invocarMahoraga();
    comoTela({ profileId: 'perfil-mahoraga-owner', role: 'MASTER' });
    useShikigamiHudStore.setState({ sourceTokenId: tokenId } as never);
    render(createElement(ShikigamiOwnerPanel, { tokenId }));

    fireEvent.change(screen.getByLabelText('Nome da fonte para a Roda de Dharma'), { target: { value: 'Chamas Azuis' } });
    fireEvent.change(screen.getByLabelText('Propriedade-base da fonte para a Roda de Dharma'), { target: { value: 'fogo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar e registrar' }));
    fireEvent.change(screen.getByLabelText('Nome da fonte para a Roda de Dharma'), { target: { value: 'Bola de Fogo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar e registrar' }));

    expect(instanciaMahoraga().estadoMahoraga?.fenomenos).toEqual([
      expect.objectContaining({ id: 'manual:fogo', giros: 2 }),
    ]);
  });

  it('bloqueia efeitos não danosos antes de pedir TR quando a fonte já chegou ao 4º giro', async () => {
    await invocarMahoraga();
    const model = mahoragaModelo();
    for (let giro = 1; giro <= 4; giro += 1) {
      const contato = registrarFenomenoRodaMahoraga(DONO, model.id, {
        id: 'fonte-condicao-mental',
        nome: 'Técnica de medo',
        eventoId: `maho-precheck-${giro}`,
        prevalidarEfeitoNaoDanoso: true,
      });
      expect(contato).toMatchObject({ ok: true, giros: giro, bloqueado: false });
    }
    const bloqueado = registrarFenomenoRodaMahoraga(DONO, model.id, {
      id: 'fonte-condicao-mental',
      nome: 'Técnica de medo',
      eventoId: 'maho-precheck-bloqueado',
      prevalidarEfeitoNaoDanoso: true,
    });
    expect(bloqueado).toMatchObject({ ok: true, giros: 4, bloqueado: true });
    expect(instanciaMahoraga().estadoMahoraga?.fenomenos[0].giros).toBe(4);
    expect(instanciaMahoraga().estadoMahoraga?.eventosRodaProcessados).not.toContain('maho-precheck-bloqueado');
  });

  it('Vontade Divina ignora controle mental externo e permite condição mental do Mestre', async () => {
    const tokenId = await invocarMahoraga();
    const model = mahoragaModelo();
    comoTela({ profileId: 'perfil-mahoraga-owner', role: 'MASTER' });
    const dono = pegarFicha(DONO);
    const instancia = instanciaMahoraga();
    useCharacterStore.getState().updateCharacter(DONO, {
      instanciasInvocacao: (dono.instanciasInvocacao ?? []).map(item => item.id === instancia.id
        ? { ...item, estadoMahoraga: {
          ...estadoInicialMahoraga(COMBATE),
          vontadeDivina: { ativa: true, rodadasRestantes: 2, rodadasTotais: 2, combateId: COMBATE, prioridade: 'ultima_ordem' },
        } }
        : item),
    });

    expect(registrarCondicaoMahoraga(DONO, model.id, 'amedrontado')).toMatchObject({ ok: true, bloqueadaPorVontadeDivina: true });
    expect(instanciaMahoraga().condicoes ?? []).toHaveLength(0);
    expect(registrarFenomenoRodaMahoraga(DONO, model.id, {
      id: 'intimidacao-externa', nome: 'Intimidação', eventoId: 'maho-intimidacao-externa', controleMental: true,
    })).toMatchObject({ ok: true, bloqueado: true, bloqueadoPorVontadeDivina: true });

    expect(registrarCondicaoMahoraga(DONO, model.id, 'amedrontado', { origemMestre: true })).toMatchObject({ ok: true });
    expect(useMapStore.getState().entities[tokenId]?.invocationConditionIds).toContain('amedrontado');
  });

  it('ativa Vontade Divina apenas no turno real do Controlador e decrementa uma vez por rodada', async () => {
    await invocarMahoraga();
    comoTela({ profileId: 'perfil-mahoraga-owner', role: 'MASTER' });
    expect(configurarVontadeDivinaMahoraga(DONO, mahoragaModelo().id, {
      prioridade: 'ultima_ordem', ultimaOrdem: 'Proteja o Controlador e afaste a ameaça.',
    })).toMatchObject({ ok: true });
    const dono = pegarFicha(DONO);
    const attributes = [
      { id: 'wis', name: 'Sabedoria', value: 18 },
      { id: 'pre', name: 'Presença', value: 16 },
    ];
    useCharacterStore.getState().updateCharacter(DONO, { dying: true, attributes });

    useCombatStore.setState({ round: 2, currentTurnIndex: 0 } as never);
    await waitFor(() => expect(instanciaMahoraga().estadoMahoraga?.vontadeDivina).toMatchObject({
      ativa: true, rodadasTotais: 4, rodadasRestantes: 4,
      prioridade: 'ultima_ordem', ultimaOrdem: 'Proteja o Controlador e afaste a ameaça.',
    }));
    useCombatStore.setState({ round: 3, currentTurnIndex: 0 } as never);
    await waitFor(() => expect(instanciaMahoraga().estadoMahoraga?.vontadeDivina).toMatchObject({
      ativa: true, rodadasRestantes: 3,
    }));
  });

  it('remove da Vontade Divina um alvo prioritário derrotado antes do próximo turno de Mahoraga', async () => {
    await invocarMahoraga();
    comoTela({ profileId: 'perfil-mahoraga-owner', role: 'MASTER' });
    const alvoToken = useMapStore.getState().entities['e-' + INIMIGO];
    if (!alvoToken) throw new Error('Combat fixture is missing the threat token.');
    useMapStore.getState().updateEntity(alvoToken.id, {
      ownerCharId: INIMIGO,
      invocationId: 'invocacao-ameaca',
      invocationInstanceId: 'instancia-ameaca',
      invocationState: 'ativa',
      hp: 50,
    });
    expect(configurarVontadeDivinaMahoraga(DONO, mahoragaModelo().id, {
      prioridade: 'eliminar_ameaca', alvoPrioritarioId: `invoc:${alvoToken.id}`,
    })).toMatchObject({ ok: true });
    const atributos = [
      { id: 'wis', name: 'Sabedoria', value: 18 },
      { id: 'pre', name: 'Presença', value: 16 },
    ];
    useCharacterStore.getState().updateCharacter(DONO, { dying: true, attributes: atributos });
    useCombatStore.setState({ round: 2, currentTurnIndex: 0 } as never);
    await waitFor(() => expect(instanciaMahoraga().estadoMahoraga?.vontadeDivina).toMatchObject({
      ativa: true, prioridade: 'eliminar_ameaca', alvoPrioritarioId: alvoToken.id,
    }));

    useMapStore.getState().updateEntity(alvoToken.id, { hp: 0, invocationState: 'derrotada' });
    useCombatStore.setState({ round: 3, currentTurnIndex: 0 } as never);
    await waitFor(() => expect(instanciaMahoraga().estadoMahoraga?.vontadeDivina?.alvoPrioritarioId).toBeUndefined());
  });

  it('Punho pode retirar dados para empurrar sem dano e o empurrão para na ocupação', async () => {
    const tokenId = await invocarMahoraga();
    const model = mahoragaModelo();
    const target = useMapStore.getState().entities['e-' + INIMIGO];
    if (!target) throw new Error('Combat fixture is missing the opponent token.');
    useMapStore.getState().updateEntity(target.id, { x: 420, y: 140 });
    useMapStore.getState().addEntity({
      id: 'maho-push-blocker', shape: 'ELLIPSE', x: 560, y: 140, w: 70, h: 70, rotation: 0,
      color: '#777777', label: 'Bloqueador', locked: false, layer: 'tokens',
    });
    rolarD20(15);
    const notation = vi.spyOn(useDice3DStore.getState(), 'requestNotation');

    const resultado = await comandarAtaque(DONO, model.id, 'punho-do-exterminio', INIMIGO, {
      instanciaId: instanciaMahoraga().id, requestId: 'maho-punho-sem-dados', dadosReduzidos: 4,
    });

    expect(resultado).toMatchObject({ ok: true, acertou: true, dano: 0 });
    expect(notation).not.toHaveBeenCalled();
    expect(useMapStore.getState().entities[target.id]?.x).toBeGreaterThan(420);
    expect(pegarFicha(INIMIGO).hpCurrent).toBe(1000);
    expect(tokenId).toBeDefined();
  });
});
