// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { ficha, montarMesa, comoTela, pegarFicha } from './helpers/mesaReal';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useDice3DStore } from '@/stores/useDice3DStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useLogStore } from '@/stores/useLogStore';
import { useMapStore } from '@/stores/useMapStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useOmniRuntimeStore } from '@/stores/useOmniRuntimeStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useTestRequestStore } from '@/stores/useTestRequestStore';
import { completeReactionDecision, useReactionStore } from '@/stores/useReactionStore';
import {
  causarDanoInvocacao,
  comandarAgarrarGama,
  comandarAgarrarOrochi,
  comandarAtaque,
  comandarInerciaImparavelTouro,
  comandarAtaqueCoelhoDisperso,
  comandarDispersaoTaticaFugaCoelhos,
  comandarFugaCoelhos,
  comandarPuxarAliadoGama,
  comandarCargaAereaNue,
  comandarHabilidadeInvocacao,
  comandarLevantarInvocacao,
  comandarMassaEsmagadoraElefante,
  comandarNeutralizacaoCervo,
  comandarPredadorApiceTigre,
  oferecerReflexosFelinosTigre,
  comandarSuporte,
  comandarToqueDaVidaCervo,
  comandarSoltarCargaNue,
  confirmarMovimentoInvocacao,
  encerrarFugaCoelhos,
  escaparAgarradoPorInvocacao,
  escaparInvocacaoAgarrada,
  invocarControlador,
  invocarControladores,
  invocarHordaControlador,
  expirarSupressaoTecnicaInicioTurno,
  resolverAuraQuietudeInicioTurno,
  restaurarInvocacoesDescansoLongo,
  removerFragilizadoFugaCoelhos,
  tokensInvocados,
} from '@/lib/controlador/mapa';
import { criarPacoteDezSombras } from '@/lib/controlador/dezSombras';
import { criarFormasDerivadasDezSombras } from '@/lib/controlador/dezSombrasDerivadas';
import { calcularBonusPericiaInvocacao } from '@/lib/controlador/rolagens';
import { consumeAdvantageFor } from '@/lib/omni/rollAdvantage';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { deslocamentoInvocacaoM, estadoCargaNue } from '@/lib/controlador/dezSombrasMovimento';
import { celulasFugaCoelhosPorPorte, flanqueadoPelaFugaCoelhos, fragilizarAlvoFugaAtingidoPorArea, terrenosDificeisFugaCoelhos } from '@/lib/controlador/dezSombrasFuga';
import { bonusAuraQuietudeNoTR, resolverNeutralizacaoCervo } from '@/lib/controlador/dezSombrasCervo';
import { penalidadeGarrasTigre, predadorApiceTigreAtivo } from '@/lib/controlador/dezSombrasTigre';
import { resolverSangramentoForteTigre } from '@/lib/controlador/resolucaoTR';
import { ReactionPromptOverlay } from '@/components/fichas/ReactionPromptOverlay';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { movementCostForTerrainSegment } from '@/lib/mapa/terrenoDificil';
import { computeTotalDefense } from '@/lib/defenseCalc';
import { createEmptyRdByType } from '@/types';
import { novaEntidade } from '@/lib/omni/tipos';
import type { InvocacaoControlador } from '@/lib/controlador/tipos';

vi.mock('@/lib/sounds', async importOriginal => {
  const atual = await importOriginal<typeof import('@/lib/sounds')>();
  return {
    ...atual,
    playSuccessSound: vi.fn(),
    playErrorSound: vi.fn(),
    playClickSound: vi.fn(),
  };
});

const ID_DONO = 'dono';
const ID_ALIADO = 'aliado';
const ID_INIMIGO = 'inimigo';
const PE_INICIAL = 80;

function prepararMesa() {
  vi.restoreAllMocks();
  useInventoryStore.getState().resetAll();
  useLogStore.getState().clearLogs();
  useTestRequestStore.getState().clearAll();
  useOmniEntidadesStore.setState({ entidades: {} });
  useOmniRuntimeStore.setState({ efeitos: {}, deleted: {} } as never);
  useCombatStore.setState({
    inCombat: false,
    combatId: 'dez-sombras-combate-real-derivadas',
    round: 1,
    currentTurnIndex: 0,
    initiativeOrder: [],
  } as never);

  const modelosBase = criarPacoteDezSombras(ID_DONO, false).map(modelo => ({
    ...modelo,
    domado: true,
    aprovacaoMestre: 'aprovada' as const,
    versaoAprovada: modelo.versaoModelo,
    alcanceInvocacaoM: 18,
  }));
  const modelos = [...modelosBase, ...criarFormasDerivadasDezSombras(ID_DONO)];

  montarMesa([
    ficha(ID_DONO, {
      specialization: 'Controlador',
      profileId: 'perfil-dono',
      level: 1,
      peCurrent: PE_INICIAL,
      peMax: PE_INICIAL,
      treinoControle: 1,
      tecnicaAmaldicoada: 'Dez Sombras',
      invocacoesConhecidas: modelos,
      hpCurrent: 20,
      hpMax: 20,
    }),
    ficha(ID_ALIADO, { profileId: 'perfil-aliado', hpCurrent: 5, hpMax: 30, ca: 1 }),
    ficha(ID_INIMIGO, {
      category: 'INIMIGO',
      profileId: 'perfil-inimigo',
      hpCurrent: 1000,
      hpMax: 1000,
      ca: 1,
    }),
  ], { dono: [2, 2], aliado: [2, 3], inimigo: [4, 2] });

  useMapStore.getState().clearWalls();
  comoTela({ profileId: 'perfil-dono', role: 'PLAYER' });
  useCombatStore.setState({
    inCombat: true,
    round: 1,
    currentTurnIndex: 0,
    initiativeOrder: [{ charId: ID_DONO, charName: 'Dono', roll: 10, bonus: 0, total: 10 }],
  } as never);
}

function modelo(id: string): InvocacaoControlador {
  const encontrado = pegarFicha(ID_DONO).invocacoesConhecidas?.find(
    item => item.id === id || item.subcategoria === `dez-sombras:${id}`,
  );
  if (!encontrado) throw new Error(`Missing Ten Shadows model: ${id}`);
  return encontrado;
}

function instanciaAtiva(modeloId: string) {
  const instancia = pegarFicha(ID_DONO).instanciasInvocacao?.find(
    item => item.modeloId === modeloId && item.estado === 'ativa',
  );
  if (!instancia) throw new Error(`Missing active invocation instance: ${modeloId}`);
  return instancia;
}

function rolarD20s(...valores: number[]) {
  const fila = [...valores];
  return vi.spyOn(useDice3DStore.getState(), 'requestRoll').mockImplementation(async tipos =>
    tipos.map(() => fila.shift() ?? 12),
  );
}

function rolarDadosMinimos() {
  return vi.spyOn(useDice3DStore.getState(), 'requestNotation').mockImplementation(async anotacao => {
    const grupos = [...anotacao.matchAll(/(\d+)d\d+/g)];
    return grupos.flatMap(grupo => Array(Number(grupo[1])).fill(1));
  });
}

async function invocarUma(id: string, x = 210, y = 140): Promise<string> {
  const resultado = invocarControladores(ID_DONO, [{ invocacaoId: modelo(id).id, x, y }]);
  if (!resultado.ok) throw new Error(resultado.motivo);
  const tokenId = resultado.tokenIds[0];
  if (!tokenId) throw new Error(`Invocation did not return a token: ${id}`);
  return tokenId;
}

function prepararControladorInimigo() {
  const modelos = criarPacoteDezSombras(ID_INIMIGO, false).map(modelo => ({
    ...modelo,
    domado: true,
    aprovacaoMestre: 'aprovada' as const,
    versaoAprovada: modelo.versaoModelo,
    alcanceInvocacaoM: 18,
  }));
  useCharacterStore.getState().updateCharacter(ID_INIMIGO, {
    specialization: 'Controlador',
    tecnicaAmaldicoada: 'Dez Sombras',
    treinoControle: 1,
    level: 1,
    keyAttribute: 'Sabedoria',
    attributes: [
      { id: 'sabedoria', name: 'Sabedoria', value: 18 },
      { id: 'forca', name: 'Força', value: 18 },
      { id: 'constituicao', name: 'Constituição', value: 18 },
    ],
    peCurrent: PE_INICIAL,
    peMax: PE_INICIAL,
    invocacoesConhecidas: modelos,
  });
  const tigre = modelos.find(modelo => modelo.subcategoria === 'dez-sombras:tigre-funebre');
  if (!tigre) throw new Error('Enemy controller is missing the Tiger model.');
  return tigre;
}

describe('Dez Sombras: formas derivadas aguardam ficha operacional', () => {
  beforeEach(prepararMesa);

  it('importa as quatro quimeras como rascunhos sem inventar ações ou liberar uso', () => {
    const formas = criarFormasDerivadasDezSombras(ID_DONO);
    expect(formas.map(forma => forma.subcategoria)).toEqual([
      'dez-sombras:totalidade',
      'dez-sombras:abismo-desconhecido-do-poco',
      'dez-sombras:nue-totalidade',
      'dez-sombras:agito',
    ]);
    for (const forma of formas) {
      expect(forma.aprovacaoMestre).toBe('pendente');
      expect(forma.formaDerivada).toBe(true);
      expect(forma.valoresProvisoriosFormaDerivada?.length).toBeGreaterThan(0);
      expect(forma.acoes).toEqual([]);
    }
  });

  it.each(['totalidade', 'abismo-desconhecido-do-poco', 'nue-totalidade', 'agito'])(
    'bloqueia %s nas rotas individual, em lote e Horda enquanto não houver ações cadastradas',
    formaId => {
      const antes = pegarFicha(ID_DONO).peCurrent;
      const ficha = modelo(formaId);
      useCharacterStore.getState().updateCharacter(ID_DONO, {
        invocacoesConhecidas: pegarFicha(ID_DONO).invocacoesConhecidas?.map(item =>
          item.id === ficha.id
            ? { ...item, domado: true, aprovacaoMestre: 'aprovada' as const, versaoAprovada: item.versaoModelo }
            : item,
        ),
      });

      const individual = invocarControlador(ID_DONO, ficha.id, 'leste');
      expect(individual).toMatchObject({ ok: false, motivo: expect.stringContaining('não tem ações cadastradas') });

      const lote = invocarControladores(ID_DONO, [{ invocacaoId: ficha.id, x: 210, y: 140 }]);
      expect(lote).toMatchObject({ ok: false, motivo: expect.stringContaining('não tem ações cadastradas') });

      const horda = invocarHordaControlador(ID_DONO, {
        liderId: ficha.id,
        membrosIds: [modelo('sapo').id],
        tempoAdicional: { quantidade: 1, unidade: 'turnos' },
        x: 210,
        y: 140,
      });
      expect(horda).toMatchObject({ ok: false, motivo: expect.stringContaining('não tem ações cadastradas') });
      expect(pegarFicha(ID_DONO).peCurrent).toBe(antes);
      expect(Object.values(useMapStore.getState().entities).some(entity => entity.invocationId === ficha.id)).toBe(false);
    },
  );
});

describe('Dez Sombras: Cães Divinos em combate', () => {
  beforeEach(prepararMesa);
  afterEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
    vi.restoreAllMocks();
  });

  it('aplica deslocamento e bônus passivo de Percepção da ficha oficial', () => {
    const cao = modelo('cao-branco');
    expect(cao.deslocamentoM).toBe(12);
    expect(calcularBonusPericiaInvocacao(pegarFicha(ID_DONO), cao, 'Percepção')).toMatchObject({
      bonusCaracteristica: 2,
    });
  });

  it('Instinto Caçador gasta Ação Simples e concede uma única vantagem em Percepção', async () => {
    const cao = modelo('cao-branco');
    await invocarUma('cao-branco');
    const instancia = instanciaAtiva(cao.id);
    const antes = instancia.economiaAcoes?.acaoBonus?.atual;

    const resultado = comandarHabilidadeInvocacao(ID_DONO, cao.id, 'instinto-cacador', {
      instanciaId: instancia.id,
      requestId: 'instinto-cacador-combate-real',
    });

    expect(resultado).toMatchObject({ ok: true, pericia: 'Percepção' });
    const atualizado = instanciaAtiva(cao.id);
    expect(atualizado.economiaAcoes?.acaoBonus?.atual).toBe((antes ?? 0) - 1);
    expect(consumeAdvantageFor(ID_DONO, { kind: 'skill', name: 'Percepção' }).net).toBe('advantage');
    expect(consumeAdvantageFor(ID_DONO, { kind: 'skill', name: 'Percepção' }).net).toBe('normal');
  });

  it('resolve Mordida no alvo do mapa e registra Flanqueado quando outro aliado está adjacente', async () => {
    const cao = modelo('cao-branco');
    const tokenCao = await invocarUma('cao-branco');
    const tokenAlvo = Object.values(useMapStore.getState().entities).find(token => token.characterId === ID_INIMIGO);
    const tokenAliado = Object.values(useMapStore.getState().entities).find(token => token.characterId === ID_ALIADO);
    if (!tokenAlvo || !tokenAliado) throw new Error('Combat test setup is missing character tokens.');
    useMapStore.getState().updateEntity(tokenAliado.id, { x: tokenAlvo.x, y: tokenAlvo.y + tokenAlvo.h });
    rolarD20s(15);
    rolarDadosMinimos();

    const resultado = await comandarAtaque(ID_DONO, cao.id, 'mordida', ID_INIMIGO, {
      instanciaId: useMapStore.getState().entities[tokenCao]?.invocationInstanceId,
      requestId: 'mordida-cao-branco-matilha',
    });

    expect(resultado).toMatchObject({ ok: true, acertou: true });
    expect(pegarFicha(ID_INIMIGO).hpCurrent).toBeLessThan(1000);
    expect(useLogStore.getState().logs.some(log => log.message.includes('Flanqueado pela Matilha das Sombras'))).toBe(true);
    expect(montarVariaveisDoPersonagem(pegarFicha(ID_INIMIGO), 'ALVO').FLANQUEADO).toBe(1);
  });

  it('recusa Mordida fora do alcance sem consumir ação da invocação', async () => {
    const cao = modelo('cao-branco');
    const tokenCao = await invocarUma('cao-branco');
    const tokenAlvo = Object.values(useMapStore.getState().entities).find(token => token.characterId === ID_INIMIGO);
    if (!tokenAlvo) throw new Error('Combat test setup is missing the enemy token.');
    useMapStore.getState().updateEntity(tokenAlvo.id, { x: tokenAlvo.x + 700 });
    const instanciaAntes = instanciaAtiva(cao.id);
    const acaoAntes = instanciaAntes.economiaAcoes?.acaoComum?.atual;

    const resultado = await comandarAtaque(ID_DONO, cao.id, 'mordida', ID_INIMIGO, {
      instanciaId: useMapStore.getState().entities[tokenCao]?.invocationInstanceId,
      requestId: 'mordida-cao-branco-fora-alcance',
    });

    expect(resultado).toMatchObject({ ok: false });
    expect(instanciaAtiva(cao.id).economiaAcoes?.acaoComum?.atual).toBe(acaoAntes);
  });
});

describe('Dez Sombras: Tigre Fúnebre em combate', () => {
  beforeEach(() => {
    prepararMesa();
    useReactionStore.setState({ prompts: [], reactionsUsedByChar: {} });
  });
  afterEach(async () => {
    useReactionStore.setState({ prompts: [], reactionsUsedByChar: {} });
    await new Promise(resolve => setTimeout(resolve, 10));
    vi.restoreAllMocks();
  });

  it('Retalhar causa dano real e Garras reduz a Defesa do alvo atingido', async () => {
    const tigre = modelo('tigre-funebre');
    const tokenTigre = await invocarUma('tigre-funebre');
    rolarD20s(15, 15);
    rolarDadosMinimos();

    const primeiro = await comandarAtaque(ID_DONO, tigre.id, 'retalhar', ID_INIMIGO, {
      instanciaId: useMapStore.getState().entities[tokenTigre]?.invocationInstanceId,
      requestId: 'tigre-retalhar-garras-real',
    });

    expect(primeiro).toMatchObject({ ok: true, acertou: true });
    expect(pegarFicha(ID_INIMIGO).hpCurrent).toBeLessThan(1000);
    expect(useLogStore.getState().logs.find(log => log.message.includes('Retalhar') && log.message.includes('vs Defesa'))?.message)
      .toContain('d20 15 + 8 = 23');
    expect(penalidadeGarrasTigre(useCharacterStore.getState().characters, ID_INIMIGO, useCombatStore.getState().combatId ?? undefined)).toBe(1);
    expect(useLogStore.getState().logs.some(log => log.message.includes('Garras de Extermínio') && log.message.includes('perde 1 Defesa'))).toBe(true);

    useCombatStore.getState().nextTurn();
    await waitFor(() => expect(useCombatStore.getState().round).toBe(2));
    const penalidadeAntesSegundo = penalidadeGarrasTigre(useCharacterStore.getState().characters, ID_INIMIGO, useCombatStore.getState().combatId ?? undefined);
    expect(penalidadeAntesSegundo).toBe(1);
    const segundo = await comandarAtaque(ID_DONO, tigre.id, 'retalhar', ID_INIMIGO, {
      instanciaId: useMapStore.getState().entities[tokenTigre]?.invocationInstanceId,
      requestId: 'tigre-retalhar-defesa-penalizada',
    });
    expect(segundo).toMatchObject({ ok: true, acertou: true });
    const logsRetalhar = useLogStore.getState().logs.filter(log => log.message.includes('Retalhar') && log.message.includes('vs Defesa'));
    const logSegundoAtaque = logsRetalhar[0];
    expect(logSegundoAtaque).toBeDefined();
    const penalidadeAtual = penalidadeGarrasTigre(useCharacterStore.getState().characters, ID_INIMIGO, useCombatStore.getState().combatId ?? undefined);
    const defesaEsperada = Math.max(0, computeTotalDefense(pegarFicha(ID_INIMIGO), {}, 'melee') - penalidadeAntesSegundo);
    expect(logSegundoAtaque?.message).toContain(`vs Defesa ${defesaEsperada}`);
    expect(penalidadeAtual).toBe(2);
  });

  it('Predador Ápice libera dois Retalhares na rodada seguinte e ambos ignoram 8 RD', async () => {
    const tigre = modelo('tigre-funebre');
    const tokenTigre = await invocarUma('tigre-funebre');
    useCharacterStore.getState().updateCharacter(ID_INIMIGO, { rd: 10 });
    const instanciaId = useMapStore.getState().entities[tokenTigre]?.invocationInstanceId;
    if (!instanciaId) throw new Error('Tiger token is missing its invocation instance.');

    expect(comandarPredadorApiceTigre(ID_DONO, tigre.id, { instanciaId, requestId: 'tigre-predador-ativar' }))
      .toEqual({ ok: true, rodadaAlvo: 2 });
    expect(instanciaAtiva(tigre.id).economiaAcoes?.acaoSimples?.atual).toBe(0);
    useCombatStore.getState().nextTurn();
    await waitFor(() => expect(useCombatStore.getState().round).toBe(2));

    rolarD20s(15, 15);
    rolarDadosMinimos();
    const primeiro = await comandarAtaque(ID_DONO, tigre.id, 'retalhar', ID_INIMIGO, {
      instanciaId, requestId: 'tigre-predador-retalhar-1',
    });
    const segundo = await comandarAtaque(ID_DONO, tigre.id, 'retalhar', ID_INIMIGO, {
      instanciaId, requestId: 'tigre-predador-retalhar-2',
    });

    expect(primeiro).toMatchObject({ ok: true, acertou: true });
    expect(segundo).toMatchObject({ ok: true, acertou: true });
    // Cada Retalhar causa 3 de dano mínimo; 8 RD ignorada deixa só os 2 pontos restantes.
    expect(pegarFicha(ID_INIMIGO).hpCurrent).toBe(998);
    expect(instanciaAtiva(tigre.id).economiaAcoes?.acaoComplexa?.atual).toBe(0);
    expect(instanciaAtiva(tigre.id).estadoTigreFunebre?.predadorApice).toMatchObject({ retalharesUsados: 2 });
    expect(predadorApiceTigreAtivo(instanciaAtiva(tigre.id).estadoTigreFunebre, 2, useCombatStore.getState().combatId ?? undefined)).toBe(true);

    const hpAntesDaReacao = pegarFicha(ID_INIMIGO).hpCurrent;
    rolarD20s(15);
    const reacao = oferecerReflexosFelinosTigre(tokenTigre, { tipo: 'personagem', id: ID_INIMIGO }, 'tigre-predador-reacao');
    let oferta = useReactionStore.getState().prompts.find(item => item.kind === 'tigre_reflexos_offer');
    await waitFor(() => {
      oferta = useReactionStore.getState().prompts.find(item => item.kind === 'tigre_reflexos_offer');
      expect(oferta).toBeDefined();
    });
    completeReactionDecision(oferta!.id, 1);
    await reacao;
    expect(pegarFicha(ID_INIMIGO).hpCurrent).toBe(hpAntesDaReacao - 1);
  });

  it('Predador Ápice também ignora RD por grau em personagens com grau cadastrado', async () => {
    const tigre = modelo('tigre-funebre');
    const tokenTigre = await invocarUma('tigre-funebre');
    const instanciaId = useMapStore.getState().entities[tokenTigre]?.invocationInstanceId;
    if (!instanciaId) throw new Error('Tiger token is missing its invocation instance.');
    useCharacterStore.getState().updateCharacter(ID_INIMIGO, { rd: 10, grauCombate: 'segundo' });

    expect(comandarPredadorApiceTigre(ID_DONO, tigre.id, { instanciaId, requestId: 'tigre-predador-grau-ativar' }))
      .toEqual({ ok: true, rodadaAlvo: 2 });
    useCombatStore.getState().nextTurn();
    await waitFor(() => expect(useCombatStore.getState().round).toBe(2));

    rolarD20s(15, 15);
    rolarDadosMinimos();
    const primeiro = await comandarAtaque(ID_DONO, tigre.id, 'retalhar', ID_INIMIGO, {
      instanciaId, requestId: 'tigre-predador-grau-personagem',
    });
    expect(primeiro).toMatchObject({ ok: true, acertou: true });
    expect(pegarFicha(ID_INIMIGO).hpCurrent).toBe(997);

    useCharacterStore.getState().updateCharacter(ID_INIMIGO, { grauCombate: undefined });
    const segundo = await comandarAtaque(ID_DONO, tigre.id, 'retalhar', ID_INIMIGO, {
      instanciaId, requestId: 'tigre-predador-grau-nao-cadastrado',
    });
    expect(segundo).toMatchObject({ ok: true, acertou: true });
    expect(pegarFicha(ID_INIMIGO).hpCurrent).toBe(996);
    expect(useLogStore.getState().logs.some(log => log.message.toLowerCase().includes('grau de inimigo não está cadastrado'))).toBe(true);
  });

  it('Reflexos Felinos gasta uma Reação do Tigre e resolve Retalhar após a decisão', async () => {
    const tigre = modelo('tigre-funebre');
    const tokenTigre = await invocarUma('tigre-funebre');
    const instanciaId = useMapStore.getState().entities[tokenTigre]?.invocationInstanceId;
    if (!instanciaId) throw new Error('Tiger token is missing its invocation instance.');
    const reacoesAntes = instanciaAtiva(tigre.id).economiaAcoes?.reacao?.atual;
    rolarD20s(15);
    rolarDadosMinimos();

    const resolucao = oferecerReflexosFelinosTigre(tokenTigre, { tipo: 'personagem', id: ID_INIMIGO }, 'ataque-adversario-erro-real');
    let pedido = useReactionStore.getState().prompts.find(item => item.kind === 'tigre_reflexos_offer');
    await waitFor(() => {
      pedido = useReactionStore.getState().prompts.find(item => item.kind === 'tigre_reflexos_offer');
      expect(pedido).toBeDefined();
    });
    const overlay = render(createElement(ReactionPromptOverlay));
    fireEvent.click(screen.getByRole('button', { name: /Usar Reação.*Retalhar/ }));
    await resolucao;
    overlay.unmount();

    expect(instanciaAtiva(tigre.id).economiaAcoes?.reacao?.atual).toBe((reacoesAntes ?? 0) - 1);
    expect(pegarFicha(ID_INIMIGO).hpCurrent).toBeLessThan(1000);
    expect(useLogStore.getState().logs.some(log => log.message.includes('Reflexos Felinos') && log.message.includes('não foram resolvidos'))).toBe(false);
  });

  it('AttackPanel oferece Reflexos Felinos após personagem errar ataque corpo a corpo contra Tigre', async () => {
    const tigreInimigo = prepararControladorInimigo();
    useCharacterStore.getState().updateCharacter(ID_DONO, {
      mainHandWeaponName: 'Adaga',
      meleeTrained: true,
      attributes: [
        { id: 'forca', name: 'Força', value: 16 },
        { id: 'destreza', name: 'Destreza', value: 14 },
      ],
    });
    useRoleStore.setState({ role: 'MASTER' });
    const convocacao = invocarControladores(ID_INIMIGO, [{ invocacaoId: tigreInimigo.id, x: 210, y: 140 }]);
    if (!convocacao.ok) throw new Error(`Enemy Tiger summon failed: ${convocacao.motivo}`);
    const tokenTigre = convocacao.tokenIds[0];
    if (!tokenTigre) throw new Error('Enemy Tiger summon returned no token.');
    const instanciaTigreId = useMapStore.getState().entities[tokenTigre]?.invocationInstanceId;
    if (!instanciaTigreId) throw new Error('Enemy Tiger token has no invocation instance.');
    rolarD20s(1, 15);
    rolarDadosMinimos();

    const painel = render(createElement(AttackPanel, { character: pegarFicha(ID_DONO) }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Alvo do ataque' }), {
      target: { value: `invoc:${tokenTigre}` },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rolar Ataque' }));
    let oferta = useReactionStore.getState().prompts.find(item => item.kind === 'tigre_reflexos_offer');
    await waitFor(() => {
      oferta = useReactionStore.getState().prompts.find(item => item.kind === 'tigre_reflexos_offer');
      expect(oferta).toBeDefined();
    });
    expect(oferta?.charId).toBe(ID_INIMIGO);

    const hpAntes = pegarFicha(ID_DONO).hpCurrent;
    const overlay = render(createElement(ReactionPromptOverlay));
    fireEvent.click(screen.getByRole('button', { name: /Usar Reação.*Retalhar/ }));
    await waitFor(() => expect(pegarFicha(ID_DONO).hpCurrent).toBeLessThan(hpAntes));

    const tigreAtual = pegarFicha(ID_INIMIGO).instanciasInvocacao?.find(item => item.id === instanciaTigreId);
    expect(tigreAtual?.economiaAcoes?.reacao?.atual).toBe(1);
    overlay.unmount();
    painel.unmount();
  });

  it('Reflexos Felinos retalia a invocação que errou, não o Controlador dela', async () => {
    const tigre = modelo('tigre-funebre');
    const tokenTigre = await invocarUma('tigre-funebre', 210, 140);
    const tigreInimigo = prepararControladorInimigo();
    const tokenTigreInimigoAlvo = useMapStore.getState().entities[tokenTigre];
    if (!tokenTigreInimigoAlvo) throw new Error('Defending Tiger token is missing.');
    const convocacao = invocarControladores(ID_INIMIGO, [{
      invocacaoId: tigreInimigo.id,
      x: tokenTigreInimigoAlvo.x + tokenTigreInimigoAlvo.w + 70,
      y: tokenTigreInimigoAlvo.y,
    }]);
    if (!convocacao.ok) throw new Error(`Enemy Tiger summon failed: ${convocacao.motivo}`);
    const tokenAtacante = convocacao.tokenIds[0];
    if (!tokenAtacante) throw new Error('Enemy Tiger summon returned no token.');
    const instanciaAtacanteId = useMapStore.getState().entities[tokenAtacante]?.invocationInstanceId;
    if (!instanciaAtacanteId) throw new Error('Enemy Tiger token has no invocation instance.');

    useCombatStore.setState({
      inCombat: true,
      round: 1,
      currentTurnIndex: 1,
      initiativeOrder: [
        { charId: ID_DONO, charName: 'Dono', roll: 12, bonus: 0, total: 12 },
        { charId: ID_INIMIGO, charName: 'Inimigo', roll: 10, bonus: 0, total: 10 },
      ],
    } as never);
    const hpControladorAntes = pegarFicha(ID_INIMIGO).hpCurrent;
    const hpInvocacaoAntes = useCharacterStore.getState().characters
      .find(character => character.id === ID_INIMIGO)?.instanciasInvocacao?.find(item => item.id === instanciaAtacanteId)?.hpAtual;
    if (hpInvocacaoAntes === undefined) throw new Error('Enemy Tiger instance has no HP.');
    rolarD20s(1, 15);
    rolarDadosMinimos();

    const ataqueInimigo = comandarAtaque(ID_INIMIGO, tigreInimigo.id, 'retalhar', `invoc:${tokenTigre}`, {
      instanciaId: instanciaAtacanteId,
      requestId: 'tigre-inimigo-erra-contra-reflexos',
    });
    let oferta = useReactionStore.getState().prompts.find(item => item.kind === 'tigre_reflexos_offer');
    await waitFor(() => {
      oferta = useReactionStore.getState().prompts.find(item => item.kind === 'tigre_reflexos_offer');
      expect(oferta).toBeDefined();
    });
    completeReactionDecision(oferta!.id, 1);
    expect(await ataqueInimigo).toMatchObject({ ok: true, acertou: false });

    const hpInvocacaoDepois = useCharacterStore.getState().characters
      .find(character => character.id === ID_INIMIGO)?.instanciasInvocacao?.find(item => item.id === instanciaAtacanteId)?.hpAtual;
    expect(hpInvocacaoDepois).toBeLessThan(hpInvocacaoAntes);
    expect(pegarFicha(ID_INIMIGO).hpCurrent).toBe(hpControladorAntes);
    expect(instanciaAtiva(tigre.id).economiaAcoes?.reacao?.atual).toBe(1);
  });

  it('Garras respeita o limite global de −4 e recupera Defesa mesmo após a queda do Tigre', async () => {
    const tigre = modelo('tigre-funebre');
    const tokenTigre = await invocarUma('tigre-funebre');
    const instancia = instanciaAtiva(tigre.id);
    const combateId = useCombatStore.getState().combatId ?? undefined;
    const alvoComDuasFontes = [{
      invocacoesConhecidas: [
        { id: 'tigre-a', subcategoria: 'dez-sombras:tigre-funebre' },
        { id: 'tigre-b', subcategoria: 'dez-sombras:tigre-funebre' },
      ],
      instanciasInvocacao: [
        { modeloId: 'tigre-a', estadoTigreFunebre: { combateId, garras: [{ alvoId: ID_INIMIGO, nomeAlvo: 'Inimigo', penalidade: 3, ultimaRodadaAcerto: 1 }], turnosProcessados: [] } },
        { modeloId: 'tigre-b', estadoTigreFunebre: { combateId, garras: [{ alvoId: ID_INIMIGO, nomeAlvo: 'Inimigo', penalidade: 3, ultimaRodadaAcerto: 1 }], turnosProcessados: [] } },
      ],
    }];
    expect(penalidadeGarrasTigre(alvoComDuasFontes, ID_INIMIGO, combateId)).toBe(4);

    useCharacterStore.getState().updateCharacter(ID_DONO, {
      instanciasInvocacao: pegarFicha(ID_DONO).instanciasInvocacao?.map(item => item.id === instancia.id ? {
        ...item,
        estado: 'caida' as const,
        hpAtual: 0,
        estadoTigreFunebre: {
          combateId,
          garras: [{ alvoId: ID_INIMIGO, nomeAlvo: 'Inimigo', penalidade: 2, ultimaRodadaAcerto: 1 }],
          turnosProcessados: [],
        },
      } : item),
    });
    useCombatStore.setState({
      inCombat: true,
      round: 2,
      currentTurnIndex: 0,
      initiativeOrder: [
        { charId: ID_DONO, charName: 'Dono', roll: 12, bonus: 0, total: 12 },
        { charId: ID_INIMIGO, charName: 'Inimigo', roll: 10, bonus: 0, total: 10 },
      ],
    } as never);
    useCombatStore.getState().nextTurn();
    await waitFor(() => {
      expect(penalidadeGarrasTigre(useCharacterStore.getState().characters, ID_INIMIGO, combateId)).toBe(1);
    });
  });

  it('Garras recupera Defesa no turno do dono de uma invocação-alvo inimiga', async () => {
    const tigreDono = modelo('tigre-funebre');
    await invocarUma('tigre-funebre');
    const instanciaTigreDono = instanciaAtiva(tigreDono.id);
    const tigreInimigo = prepararControladorInimigo();
    useRoleStore.setState({ role: 'MASTER' });
    const convocacaoAlvo = invocarControladores(ID_INIMIGO, [{ invocacaoId: tigreInimigo.id, x: 560, y: 140 }]);
    if (!convocacaoAlvo.ok) throw new Error(`Enemy target invocation failed: ${convocacaoAlvo.motivo}`);
    const tokenAlvo = useMapStore.getState().entities[convocacaoAlvo.tokenIds[0]];
    const instanciaAlvoId = tokenAlvo?.invocationInstanceId;
    if (!instanciaAlvoId) throw new Error('Target invocation instance is missing.');
    const alvoId = `invoc:${instanciaAlvoId}`;
    const combateId = useCombatStore.getState().combatId ?? undefined;

    useCharacterStore.getState().updateCharacter(ID_DONO, {
      instanciasInvocacao: pegarFicha(ID_DONO).instanciasInvocacao?.map(item => item.id === instanciaTigreDono.id ? {
        ...item,
        estadoTigreFunebre: {
          combateId,
          garras: [{ alvoId, nomeAlvo: 'Tigre inimigo', penalidade: 2, ultimaRodadaAcerto: 1 }],
          turnosProcessados: [],
        },
      } : item),
    });
    useCombatStore.setState({
      inCombat: true,
      round: 2,
      currentTurnIndex: 0,
      initiativeOrder: [
        { charId: ID_DONO, charName: 'Dono', roll: 12, bonus: 0, total: 12 },
        { charId: ID_INIMIGO, charName: 'Inimigo', roll: 10, bonus: 0, total: 10 },
      ],
    } as never);

    useCombatStore.getState().nextTurn();
    await waitFor(() => expect(penalidadeGarrasTigre(useCharacterStore.getState().characters, alvoId, combateId)).toBe(1));
  });

  it('Sangramento Forte nasce de falha em Fortitude, causa 4d10 sem RD e oferece TR no fim do turno', async () => {
    const tigre = modelo('tigre-funebre');
    const tokenTigre = await invocarUma('tigre-funebre');
    const instanciaId = useMapStore.getState().entities[tokenTigre]?.invocationInstanceId;
    if (!instanciaId) throw new Error('Tiger token is missing its invocation instance.');
    useCharacterStore.getState().updateCharacter(ID_INIMIGO, { rd: 100 });
    const peAntesDoCritico = pegarFicha(ID_DONO).peCurrent ?? 0;
    rolarD20s(20);
    rolarDadosMinimos();

    const ataque = comandarAtaque(ID_DONO, tigre.id, 'retalhar', ID_INIMIGO, {
      instanciaId, requestId: 'tigre-retalhar-critico-sangramento',
    });
    let oferta = useReactionStore.getState().prompts.find(item => item.kind === 'tigre_sangramento_offer');
    await waitFor(() => {
      oferta = useReactionStore.getState().prompts.find(item => item.kind === 'tigre_sangramento_offer');
      expect(oferta).toBeDefined();
    });
    completeReactionDecision(oferta!.id, 1);
    expect(await ataque).toMatchObject({ ok: true, critico: true });
    expect(pegarFicha(ID_DONO).peCurrent).toBe(peAntesDoCritico - 6);

    const pedido = useTestRequestStore.getState().requests.find(item => item.tigreSangramentoResolution);
    if (!pedido) throw new Error('Critical Retalhar did not create a Fortitude request.');
    useTestRequestStore.getState().setResult(pedido.id, { d20: 1, bonus: 0, total: 1, rolledAt: Date.now() });
    const resultadoTR = useTestRequestStore.getState().requests.find(item => item.id === pedido.id)!;
    expect(resolverSangramentoForteTigre(resultadoTR)).toEqual({ passou: false, aplicado: true });
    expect(pegarFicha(ID_INIMIGO).activeConditions?.some(item => item.id === `tigre-sangramento:${pedido.id}`)).toBe(true);

    useRoleStore.setState({ role: 'MASTER' });
    useCombatStore.setState({
      inCombat: true, round: 1, currentTurnIndex: 0,
      initiativeOrder: [
        { charId: ID_DONO, charName: 'Dono', roll: 12, bonus: 0, total: 12 },
        { charId: ID_INIMIGO, charName: 'Inimigo', roll: 10, bonus: 0, total: 10 },
      ],
    } as never);
    useCombatStore.getState().nextTurn();
    await waitFor(() => expect(pegarFicha(ID_INIMIGO).hpCurrent).toBe(996));

    useCombatStore.getState().nextTurn();
    let prompt = useReactionStore.getState().prompts.find(item => item.kind === 'condition_end_tr_offer');
    await waitFor(() => {
      prompt = useReactionStore.getState().prompts.find(item => item.kind === 'condition_end_tr_offer');
      expect(prompt?.payload?.conditionInstanceId).toBe(`tigre-sangramento:${pedido.id}`);
    });

    const saves = [{ id: 'fortitude', name: 'Fortitude', value: 100 }];
    useCharacterStore.getState().updateCharacter(ID_INIMIGO, { savingThrows: saves });
    vi.spyOn(useDice3DStore.getState(), 'requestNotation').mockResolvedValue([1]);
    const overlay = render(createElement(ReactionPromptOverlay));
    fireEvent.click(screen.getByRole('button', { name: /Rolar TR/ }));
    await waitFor(() => expect(pegarFicha(ID_INIMIGO).activeConditions?.some(item => item.id === `tigre-sangramento:${pedido.id}`)).toBe(true));
    overlay.unmount();

    useCombatStore.getState().nextTurn();
    useCombatStore.getState().nextTurn();
    prompt = undefined;
    await waitFor(() => {
      prompt = useReactionStore.getState().prompts.find(item => item.kind === 'condition_end_tr_offer');
      expect(prompt?.payload?.conditionInstanceId).toBe(`tigre-sangramento:${pedido.id}`);
    });
    vi.spyOn(useDice3DStore.getState(), 'requestNotation').mockResolvedValue([20]);
    const overlaySucesso = render(createElement(ReactionPromptOverlay));
    fireEvent.click(screen.getByRole('button', { name: /Rolar TR/ }));
    await waitFor(() => expect(pegarFicha(ID_INIMIGO).activeConditions?.some(item => item.id === `tigre-sangramento:${pedido.id}`)).toBe(false));
    overlaySucesso.unmount();
  });

  it('não aplica Sangramento Forte se a invocação-alvo saiu do mapa antes da resolução de Fortitude', () => {
    const tigreInimigo = prepararControladorInimigo();
    useRoleStore.setState({ role: 'MASTER' });
    const convocacaoAlvo = invocarControladores(ID_INIMIGO, [{ invocacaoId: tigreInimigo.id, x: 560, y: 140 }]);
    if (!convocacaoAlvo.ok) throw new Error(`Enemy target invocation failed: ${convocacaoAlvo.motivo}`);
    const tokenId = convocacaoAlvo.tokenIds[0];
    const token = useMapStore.getState().entities[tokenId];
    const instanciaId = token?.invocationInstanceId;
    if (!token || !instanciaId) throw new Error('Target invocation token or instance is missing.');

    useMapStore.setState(state => {
      const entities = { ...state.entities };
      delete entities[tokenId];
      return { entities };
    });
    const request = {
      id: 'tigre-sangramento-alvo-removido',
      charId: ID_INIMIGO,
      charName: 'Tigre inimigo',
      dc: 16,
      result: { d20: 1, bonus: 0, total: 1, rolledAt: Date.now() },
      tigreSangramentoResolution: {
        sourceCharId: ID_DONO,
        sourceCharName: 'Dono',
        sourceInvocationId: 'tigre-funebre',
        sourceInstanceId: 'tigre-origem',
        sourceName: 'Tigre Fúnebre — Retalhar',
        conditionId: 'sangramento',
        conditionName: 'Sangramento Forte',
        conditionIcon: 'droplet',
        endCD: 16,
        targetInvocation: {
          tokenId,
          ownerCharacterId: ID_INIMIGO,
          invocationId: tigreInimigo.id,
          invocationInstanceId: instanciaId,
          name: 'Tigre inimigo',
        },
      },
    } as Parameters<typeof resolverSangramentoForteTigre>[0];

    expect(resolverSangramentoForteTigre(request)).toEqual({ passou: false, aplicado: false });
    const instanciaAlvo = pegarFicha(ID_INIMIGO).instanciasInvocacao?.find(item => item.id === instanciaId);
    expect(instanciaAlvo?.condicoes?.some(condition => condition && typeof condition === 'object' && 'id' in condition && condition.id === `tigre-sangramento:${request.id}`) ?? false).toBe(false);
    expect(useLogStore.getState().logs.some(log => log.message.includes('saiu do combate antes de receber Sangramento Forte'))).toBe(true);
  });
});

describe('Dez Sombras: Touro Perfurante em combate', () => {
  beforeEach(prepararMesa);
  afterEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
    vi.restoreAllMocks();
  });

  it('integra deslocamento à Investida, adiciona dados por distância e preserva a Ação de Movimento', async () => {
    const touro = modelo('touro-perfurante');
    const tokenId = await invocarUma('touro-perfurante', 210, 140);
    const tokenAlvo = Object.values(useMapStore.getState().entities).find(entity => entity.characterId === ID_INIMIGO);
    if (!tokenAlvo) throw new Error('Combat test setup is missing the enemy token.');
    useMapStore.getState().updateEntity(tokenAlvo.id, { x: 560, y: 140 });

    rolarD20s(15);
    const formulas: string[] = [];
    vi.spyOn(useDice3DStore.getState(), 'requestNotation').mockImplementation(async anotacao => {
      formulas.push(anotacao);
      const grupos = [...anotacao.matchAll(/(\d+)d\d+/g)];
      return grupos.flatMap(grupo => Array(Number(grupo[1])).fill(1));
    });
    const antes = instanciaAtiva(touro.id);
    const movimentoAntes = antes.economiaAcoes?.acaoMovimento?.atual;

    const resultado = await comandarAtaque(ID_DONO, touro.id, 'investida-perfurante', ID_INIMIGO, {
      instanciaId: useMapStore.getState().entities[tokenId]?.invocationInstanceId,
      requestId: 'touro-investida-15m',
    });

    if (!resultado.ok) throw new Error(`Touro Investida failed: ${resultado.motivo}`);
    expect(resultado).toMatchObject({ ok: true, acertou: true });
    expect(resultado).not.toHaveProperty('critico', true);
    expect(useMapStore.getState().entities[tokenId]?.x).toBeCloseTo(490, 1);
    expect(formulas).toHaveLength(1);
    expect(formulas[0]).toContain('2d8');
    expect(pegarFicha(ID_INIMIGO).hpCurrent).toBeLessThan(1000);
    expect(instanciaAtiva(touro.id).economiaAcoes?.acaoComplexa?.atual).toBe(0);
    expect(instanciaAtiva(touro.id).economiaAcoes?.acaoMovimento?.atual).toBe(movimentoAntes);
  });

  it('converte acerto em crítico ao percorrer todo o deslocamento normal disponível', async () => {
    const touro = modelo('touro-perfurante');
    const tokenId = await invocarUma('touro-perfurante', 210, 140);
    const tokenAlvo = Object.values(useMapStore.getState().entities).find(entity => entity.characterId === ID_INIMIGO);
    if (!tokenAlvo) throw new Error('Combat test setup is missing the enemy token.');
    useMapStore.getState().updateEntity(tokenAlvo.id, { x: 980, y: 140 });
    rolarD20s(15);
    rolarDadosMinimos();

    const resultado = await comandarAtaque(ID_DONO, touro.id, 'investida-perfurante', ID_INIMIGO, {
      instanciaId: useMapStore.getState().entities[tokenId]?.invocationInstanceId,
      requestId: 'touro-investida-deslocamento-total',
    });

    expect(resultado).toMatchObject({ ok: true, acertou: true, critico: true });
    expect(useMapStore.getState().entities[tokenId]?.x).toBeCloseTo(910, 1);
  });

  it('cobra Ação de Movimento adicional quando a trajetória da Investida muda mais de 45°', async () => {
    const touroOriginal = modelo('touro-perfurante');
    useCharacterStore.getState().updateCharacter(ID_DONO, {
      invocacoesConhecidas: pegarFicha(ID_DONO).invocacoesConhecidas?.map(item => item.id === touroOriginal.id
        ? { ...item, economiaAcoesConfigurada: { ...item.economiaAcoesConfigurada, acaoMovimento: 2 } }
        : item),
    });
    const touro = modelo('touro-perfurante');
    const tokenId = await invocarUma('touro-perfurante', 210, 140);
    const token = useMapStore.getState().entities[tokenId];
    const instancia = instanciaAtiva(touro.id);
    const tokenAlvo = Object.values(useMapStore.getState().entities).find(entity => entity.characterId === ID_INIMIGO);
    if (!tokenAlvo) throw new Error('Combat test setup is missing the enemy token.');
    useMapStore.getState().updateEntity(tokenAlvo.id, { x: 560, y: 350 });
    const de = { x: token.x, y: token.y };
    const para = { x: token.x + 280, y: token.y };
    const requestMovimento = 'touro-trajetoria-movimento-inicial';
    useMapStore.getState().updateEntity(tokenId, { x: para.x, y: para.y });
    useMapStore.getState().setPendingMove({
      entityId: tokenId, charId: ID_DONO, invocationInstanceId: instancia.id,
      movementRequestId: requestMovimento, startX: de.x, startY: de.y,
      trail: [de, para], distM: 6, actualDistM: 6,
    });

    expect(confirmarMovimentoInvocacao({
      tokenId, instanciaId: instancia.id, de, para, trajetoria: [de, para], distanciaM: 6, requestId: requestMovimento,
    })).toMatchObject({ ok: true, distanciaM: 6 });
    expect(instanciaAtiva(touro.id).investidaPerfuranteTurno).toMatchObject({
      distanciaM: expect.closeTo(6), direcao: { x: 1, y: 0 },
    });
    rolarD20s(15);
    rolarDadosMinimos();

    const resultado = await comandarAtaque(ID_DONO, touro.id, 'investida-perfurante', ID_INIMIGO, {
      instanciaId: instancia.id,
      requestId: 'touro-trajetoria-curva-70-graus',
    });

    if (!resultado.ok) throw new Error(`Touro curved charge failed: ${resultado.motivo}`);
    expect(resultado).toMatchObject({ ok: true, acertou: true });
    expect(instanciaAtiva(touro.id).economiaAcoes?.acaoMovimento).toEqual({ atual: 0, maximo: 2 });
    expect(instanciaAtiva(touro.id).economiaAcoes?.acaoComplexa?.atual).toBe(0);
  });

  it('recusa curva acima de 45° sem Ação de Movimento extra e não debita a Ação Complexa', async () => {
    const touro = modelo('touro-perfurante');
    const tokenId = await invocarUma('touro-perfurante', 210, 140);
    const token = useMapStore.getState().entities[tokenId];
    const instancia = instanciaAtiva(touro.id);
    const alvo = Object.values(useMapStore.getState().entities).find(entity => entity.characterId === ID_INIMIGO);
    if (!token || !alvo) throw new Error('Combat test setup is missing a Touro or enemy token.');
    useMapStore.getState().updateEntity(alvo.id, { x: 560, y: 350 });
    const de = { x: token.x, y: token.y };
    const para = { x: token.x + 280, y: token.y };
    const requestMovimento = 'touro-curva-sem-movimento-extra-movimento';
    useMapStore.getState().updateEntity(tokenId, { x: para.x, y: para.y });
    useMapStore.getState().setPendingMove({
      entityId: tokenId, charId: ID_DONO, invocationInstanceId: instancia.id,
      movementRequestId: requestMovimento, startX: de.x, startY: de.y,
      trail: [de, para], distM: 6, actualDistM: 6,
    });
    expect(confirmarMovimentoInvocacao({
      tokenId, instanciaId: instancia.id, de, para, trajetoria: [de, para], distanciaM: 6,
      requestId: requestMovimento,
    })).toMatchObject({ ok: true, distanciaM: 6 });
    expect(instanciaAtiva(touro.id).economiaAcoes).toMatchObject({
      acaoComplexa: { atual: 1, maximo: 1 }, acaoMovimento: { atual: 0, maximo: 1 },
    });
    rolarD20s(15);

    const resultado = await comandarAtaque(ID_DONO, touro.id, 'investida-perfurante', ID_INIMIGO, {
      instanciaId: instancia.id,
      requestId: 'touro-curva-sem-movimento-extra-ataque',
    });

    expect(resultado).toMatchObject({
      ok: false,
      motivo: expect.stringContaining('recusado sem debitar ações'),
    });
    expect(instanciaAtiva(touro.id).economiaAcoes).toMatchObject({
      acaoComplexa: { atual: 1, maximo: 1 }, acaoMovimento: { atual: 0, maximo: 1 },
    });
    expect(useMapStore.getState().entities[tokenId]?.x).toBe(para.x);
    expect(pegarFicha(ID_INIMIGO).hpCurrent).toBe(1000);
  });

  it('Inércia eleva dois níveis a Investida, ignora Lento e alcança além do deslocamento normal', async () => {
    const touro = modelo('touro-perfurante');
    const tokenId = await invocarUma('touro-perfurante', 210, 140);
    const instancia = instanciaAtiva(touro.id);
    const tokenAlvo = Object.values(useMapStore.getState().entities).find(entity => entity.characterId === ID_INIMIGO);
    if (!tokenAlvo) throw new Error('Combat test setup is missing the enemy token.');
    useMapStore.getState().updateEntity(tokenAlvo.id, { x: 1400, y: 140 });
    useCharacterStore.getState().updateCharacter(ID_DONO, {
      instanciasInvocacao: pegarFicha(ID_DONO).instanciasInvocacao?.map(item => item.id === instancia.id
        ? { ...item, condicoes: [{ conditionId: 'lento' }] }
        : item),
    });

    expect(comandarInerciaImparavelTouro(ID_DONO, touro.id, {
      instanciaId: instancia.id,
      requestId: 'touro-inercia-dois-niveis',
    })).toMatchObject({ ok: true, deslocamentoM: 30 });
    rolarD20s(15);
    const formulas: string[] = [];
    vi.spyOn(useDice3DStore.getState(), 'requestNotation').mockImplementation(async anotacao => {
      formulas.push(anotacao);
      const grupos = [...anotacao.matchAll(/(\d+)d\d+/g)];
      return grupos.flatMap(grupo => Array(Number(grupo[1])).fill(1));
    });

    const resultado = await comandarAtaque(ID_DONO, touro.id, 'investida-perfurante', ID_INIMIGO, {
      instanciaId: instancia.id,
      requestId: 'touro-investida-inercia-dois-niveis',
    });

    if (!resultado.ok) throw new Error(`Touro Inertia charge failed: ${resultado.motivo}`);
    expect(resultado).toMatchObject({ ok: true, acertou: true });
    expect(resultado).not.toHaveProperty('critico', true);
    expect(useMapStore.getState().entities[tokenId]?.x).toBeCloseTo(1330, 1);
    expect(formulas).toHaveLength(1);
    expect(formulas[0]).toContain('8d12');
    expect(pegarFicha(ID_INIMIGO).hpCurrent).toBeLessThan(1000);
  });

  it('não gasta ações nem desloca quando não há 3 m de trajetória livre', async () => {
    const touro = modelo('touro-perfurante');
    const tokenId = await invocarUma('touro-perfurante', 210, 140);
    const instanciaAntes = instanciaAtiva(touro.id);
    const tokenAntes = useMapStore.getState().entities[tokenId];
    const complexaAntes = instanciaAntes.economiaAcoes?.acaoComplexa?.atual;
    const movimentoAntes = instanciaAntes.economiaAcoes?.acaoMovimento?.atual;

    const resultado = await comandarAtaque(ID_DONO, touro.id, 'investida-perfurante', ID_INIMIGO, {
      instanciaId: tokenAntes?.invocationInstanceId,
      requestId: 'touro-investida-sem-trajetoria',
    });

    expect(resultado).toMatchObject({ ok: false, motivo: expect.stringContaining('3 m') });
    expect(useMapStore.getState().entities[tokenId]).toMatchObject({ x: tokenAntes?.x, y: tokenAntes?.y });
    expect(instanciaAtiva(touro.id).economiaAcoes?.acaoComplexa?.atual).toBe(complexaAntes);
    expect(instanciaAtiva(touro.id).economiaAcoes?.acaoMovimento?.atual).toBe(movimentoAntes);
  });

  it('não atravessa um token no caminho da carga e mantém a Investida sem custo', async () => {
    const touro = modelo('touro-perfurante');
    const tokenId = await invocarUma('touro-perfurante', 210, 140);
    const antes = instanciaAtiva(touro.id);
    const tokenAntes = useMapStore.getState().entities[tokenId];
    const aliado = Object.values(useMapStore.getState().entities).find(entity => entity.characterId === ID_ALIADO);
    const alvo = Object.values(useMapStore.getState().entities).find(entity => entity.characterId === ID_INIMIGO);
    if (!aliado || !alvo) throw new Error('Combat test setup is missing a character token.');
    useMapStore.getState().updateEntity(aliado.id, { x: 350, y: 140 });
    useMapStore.getState().updateEntity(alvo.id, { x: 560, y: 140 });

    const resultado = await comandarAtaque(ID_DONO, touro.id, 'investida-perfurante', ID_INIMIGO, {
      instanciaId: tokenAntes?.invocationInstanceId,
      requestId: 'touro-investida-aliado-bloqueando',
    });

    expect(resultado).toMatchObject({ ok: false });
    expect(useMapStore.getState().entities[tokenId]).toMatchObject({ x: tokenAntes?.x, y: tokenAntes?.y });
    expect(instanciaAtiva(touro.id).economiaAcoes?.acaoComplexa?.atual).toBe(antes.economiaAcoes?.acaoComplexa?.atual);
    expect(instanciaAtiva(touro.id).economiaAcoes?.acaoMovimento?.atual).toBe(antes.economiaAcoes?.acaoMovimento?.atual);
    expect(pegarFicha(ID_INIMIGO).hpCurrent).toBe(1000);
  });

  it('permite uma curva de exatamente 45° sem exigir Ação de Movimento adicional', async () => {
    const touro = modelo('touro-perfurante');
    const tokenId = await invocarUma('touro-perfurante', 210, 140);
    const instancia = instanciaAtiva(touro.id);
    const alvo = Object.values(useMapStore.getState().entities).find(entity => entity.characterId === ID_INIMIGO);
    if (!alvo) throw new Error('Combat test setup is missing the enemy token.');
    useMapStore.getState().updateEntity(tokenId, { x: 490, y: 140 });
    useMapStore.getState().updateEntity(alvo.id, { x: 630, y: 280 });
    useCharacterStore.getState().updateCharacter(ID_DONO, {
      instanciasInvocacao: pegarFicha(ID_DONO).instanciasInvocacao?.map(item => item.id === instancia.id
        ? {
          ...item,
          economiaAcoes: { ...item.economiaAcoes, acaoMovimento: { atual: 0, maximo: 1 } },
          investidaPerfuranteTurno: {
            combateId: useCombatStore.getState().combatId!, rodada: 1, turnoIndex: 0,
            distanciaM: 6, direcao: { x: 1, y: 0 },
          },
        }
        : item),
    });
    rolarD20s(15);
    rolarDadosMinimos();

    const resultado = await comandarAtaque(ID_DONO, touro.id, 'investida-perfurante', ID_INIMIGO, {
      instanciaId: instancia.id,
      requestId: 'touro-investida-curva-exata-45',
    });

    if (!resultado.ok) throw new Error(`Touro 45-degree charge failed: ${resultado.motivo}`);
    expect(resultado).toMatchObject({ ok: true, acertou: true });
    expect(instanciaAtiva(touro.id).economiaAcoes?.acaoMovimento).toEqual({ atual: 0, maximo: 1 });
  });

  it('ativa Inércia uma vez por rodada, repete o mesmo pedido sem cobrar e encerra o bônus na rodada seguinte', async () => {
    const touro = modelo('touro-perfurante');
    const tokenId = await invocarUma('touro-perfurante', 210, 140);
    const instancia = instanciaAtiva(touro.id);
    const requestId = 'touro-inercia-idempotente';
    const simplesAntes = instancia.economiaAcoes?.acaoSimples?.atual;

    const ativacao = comandarInerciaImparavelTouro(ID_DONO, touro.id, { instanciaId: instancia.id, requestId });
    expect(ativacao).toEqual({ ok: true, deslocamentoM: 30 });
    expect(deslocamentoInvocacaoM(tokenId)).toBe(30);
    expect(instanciaAtiva(touro.id).economiaAcoes?.acaoSimples?.atual).toBe((simplesAntes ?? 0) - 1);
    expect(comandarInerciaImparavelTouro(ID_DONO, touro.id, { instanciaId: instancia.id, requestId })).toEqual(ativacao);
    expect(comandarInerciaImparavelTouro(ID_DONO, touro.id, {
      instanciaId: instancia.id,
      requestId: 'touro-inercia-outro-pedido',
    })).toEqual(ativacao);
    expect(comandarInerciaImparavelTouro(ID_DONO, touro.id, { instanciaId: instancia.id })).toEqual(ativacao);
    expect(instanciaAtiva(touro.id).economiaAcoes?.acaoSimples?.atual).toBe((simplesAntes ?? 0) - 1);

    useCombatStore.setState({ round: 2 } as never);
    expect(deslocamentoInvocacaoM(tokenId)).toBe(15);
  });

  it('Inércia ignora lentidão e imobilidade, amplia a carga a 30 m e mantém falha natural 1 como erro', async () => {
    const touro = modelo('touro-perfurante');
    const tokenId = await invocarUma('touro-perfurante', 210, 140);
    const instancia = instanciaAtiva(touro.id);
    const tokenAlvo = Object.values(useMapStore.getState().entities).find(entity => entity.characterId === ID_INIMIGO);
    if (!tokenAlvo) throw new Error('Combat test setup is missing the enemy token.');
    useMapStore.getState().updateEntity(tokenAlvo.id, { x: 1680, y: 140 });
    useCharacterStore.getState().updateCharacter(ID_DONO, {
      instanciasInvocacao: pegarFicha(ID_DONO).instanciasInvocacao?.map(item => item.id === instancia.id
        ? { ...item, condicoes: [{ conditionId: 'lento' }] }
        : item),
    });
    expect(deslocamentoInvocacaoM(tokenId)).toBe(7.5);
    useCharacterStore.getState().updateCharacter(ID_DONO, {
      instanciasInvocacao: pegarFicha(ID_DONO).instanciasInvocacao?.map(item => item.id === instancia.id
        ? { ...item, condicoes: [{ conditionId: 'lento' }, { conditionId: 'imovel' }] }
        : item),
    });
    expect(deslocamentoInvocacaoM(tokenId)).toBe(0);

    expect(comandarInerciaImparavelTouro(ID_DONO, touro.id, {
      instanciaId: instancia.id,
      requestId: 'touro-inercia-contra-lento',
    })).toMatchObject({ ok: true, deslocamentoM: 30 });
    expect(deslocamentoInvocacaoM(tokenId)).toBe(30);
    rolarD20s(1);
    rolarDadosMinimos();

    const resultado = await comandarAtaque(ID_DONO, touro.id, 'investida-perfurante', ID_INIMIGO, {
      instanciaId: instancia.id,
      requestId: 'touro-investida-falha-natural-1',
    });

    if (!resultado.ok) throw new Error(`Touro Inertia attack failed: ${resultado.motivo}`);
    expect(resultado).toMatchObject({ ok: true, acertou: false });
    expect(resultado).not.toHaveProperty('critico', true);
    expect(useMapStore.getState().entities[tokenId]?.x).toBeCloseTo(1610, 1);
    expect(pegarFicha(ID_INIMIGO).hpCurrent).toBe(1000);
  });
});

describe('Dez Sombras: vagas efetivas de Horda', () => {
  beforeEach(prepararMesa);

  it('conta líder e membros individualmente mesmo quando a Horda usa um token', () => {
    const horda = invocarHordaControlador(ID_DONO, {
      eventoId: 'horda-ocupa-vagas-reais',
      liderId: modelo('fuga-do-coelho').id,
      membrosIds: [modelo('cao-branco').id],
      tempoAdicional: { quantidade: 1, unidade: 'turnos' },
      x: 210,
      y: 140,
    });
    expect(horda).toMatchObject({ ok: true });
    if (!horda.ok) throw new Error(horda.motivo);
    expect(useMapStore.getState().entities[horda.tokenId]).toMatchObject({
      invocationHordeId: expect.any(String),
      invocationHordeMemberIds: [modelo('cao-branco').id],
    });

    const peAntesDeOutraInvocacao = pegarFicha(ID_DONO).peCurrent;
    const bloqueada = invocarControlador(ID_DONO, modelo('nue').id, 'sul');
    expect(bloqueada).toMatchObject({ ok: false, motivo: 'Limite de vagas de invocação ativas atingido.' });
    expect(pegarFicha(ID_DONO).peCurrent).toBe(peAntesDeOutraInvocacao);
  });
});

describe('Dez Sombras: Gama em combate', () => {
  beforeEach(prepararMesa);
  afterEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
    vi.restoreAllMocks();
  });

  it('oferece Agarrar só após acerto e gasta 4 PE sem debitar uma segunda ação', async () => {
    const gama = modelo('sapo');
    const tokenGama = await invocarUma('sapo');
    const ataque = gama.acoes.find(item => item.id === 'protusao-lingua');
    expect(ataque?.alcanceM).toBe(6);
    expect(ataque?.efeitoEspecial).toMatchObject({ tipo: 'agarrar_gama_apos_acerto', custoPE: 4, categoriaAcao: 'acaoLivre' });
    const instanciaAntes = instanciaAtiva(gama.id);
    const PEAntes = pegarFicha(ID_DONO).peCurrent;
    const acaoLivreAntes = instanciaAntes.economiaAcoes?.acaoLivre?.atual;
    rolarD20s(15);
    rolarDadosMinimos();

    const acerto = await comandarAtaque(ID_DONO, gama.id, 'protusao-lingua', ID_INIMIGO, {
      instanciaId: useMapStore.getState().entities[tokenGama].invocationInstanceId,
      requestId: 'gama-protusao-hit',
    });

    expect(acerto).toMatchObject({ ok: true, acertou: true, efeitoOpcional: { tipo: 'agarrar_gama', custoPE: 4 } });
    expect(pegarFicha(ID_DONO).peCurrent).toBe(PEAntes);
    const instanciaComJanela = instanciaAtiva(gama.id);
    expect(instanciaComJanela.agarrarLinguaPendente).toMatchObject({ alvoId: ID_INIMIGO, eventoId: 'gama-protusao-hit' });
    rolarD20s(15, 10);

    const agarrar = await comandarAgarrarGama(ID_DONO, gama.id, {
      instanciaId: instanciaComJanela.id,
      requestId: 'gama-agarrar-hit',
    });

    expect(agarrar).toMatchObject({ ok: true, sucesso: true, aplicouCondicao: true });
    if (!agarrar.ok) throw new Error(agarrar.motivo);
    expect(agarrar.totalGama).toBe(15 + (calcularBonusPericiaInvocacao(pegarFicha(ID_DONO), gama, 'LUTA')?.total ?? 0));
    expect(pegarFicha(ID_DONO).peCurrent).toBe((PEAntes ?? 0) - 4);
    expect(instanciaAtiva(gama.id).economiaAcoes?.acaoLivre?.atual).toBe(acaoLivreAntes);
    expect(instanciaAtiva(gama.id).agarrarLinguaPendente).toBeUndefined();
    expect(pegarFicha(ID_INIMIGO).activeConditions?.some(condition => condition.conditionId === 'agarrado')).toBe(true);
    expect(await comandarAgarrarGama(ID_DONO, gama.id, { instanciaId: instanciaComJanela.id })).toMatchObject({ ok: false });
  });

  it('aplica uma única vez o bônus de Anfíbio Sombrio submerso e na Escuridão Total', async () => {
    const gama = modelo('sapo');
    await invocarUma('sapo');
    const instancia = instanciaAtiva(gama.id);
    const combate = useCombatStore.getState();
    const dono = pegarFicha(ID_DONO);
    useCharacterStore.getState().updateCharacter(ID_DONO, {
      instanciasInvocacao: dono.instanciasInvocacao?.map(item => item.id === instancia.id ? {
        ...item,
        agarrarLinguaPendente: {
          eventoId: 'gama-ambiente',
          alvoId: ID_INIMIGO,
          ...(combate.combatId ? { combateId: combate.combatId } : {}),
          rodada: combate.round,
          turnoIndex: combate.currentTurnIndex,
        },
      } : item),
    });
    rolarD20s(15, 10);

    const baseLuta = calcularBonusPericiaInvocacao(pegarFicha(ID_DONO), gama, 'LUTA')?.total;
    if (baseLuta === undefined) throw new Error('A ficha do Gama não resolveu o bônus base de Luta.');
    const resultado = await comandarAgarrarGama(ID_DONO, gama.id, {
      instanciaId: instancia.id,
      requestId: 'gama-agarrar-anfibio',
      contextoAmbiente: { submerso: true, escuridaoTotal: true },
    });

    expect(resultado).toMatchObject({ ok: true, bonusSituacional: 2, totalGama: 15 + baseLuta + 2 });
  });

  it('não abre Agarrar após erro da Protusão de Língua', async () => {
    const gama = modelo('sapo');
    const tokenGama = await invocarUma('sapo');
    useCharacterStore.getState().updateCharacter(ID_INIMIGO, { ca: 100 });
    rolarD20s(15);
    const erro = await comandarAtaque(ID_DONO, gama.id, 'protusao-lingua', ID_INIMIGO, {
      instanciaId: useMapStore.getState().entities[tokenGama].invocationInstanceId,
      requestId: 'gama-protusao-miss',
    });
    expect(erro).toMatchObject({ ok: true, acertou: false });
    expect(instanciaAtiva(gama.id).agarrarLinguaPendente).toBeUndefined();
  });

  it('não abre Agarrar quando o alvo cai com o dano da língua', async () => {
    const gama = modelo('sapo');
    const tokenGama = await invocarUma('sapo');
    useCharacterStore.getState().updateCharacter(ID_INIMIGO, { hpCurrent: 1, hpMax: 1, ca: 1 });
    rolarD20s(15);
    rolarDadosMinimos();
    const queda = await comandarAtaque(ID_DONO, gama.id, 'protusao-lingua', ID_INIMIGO, {
      instanciaId: useMapStore.getState().entities[tokenGama].invocationInstanceId,
      requestId: 'gama-protusao-alvo-derrotado',
    });
    expect(queda).toMatchObject({ ok: true, acertou: true });
    expect(queda).not.toHaveProperty('efeitoOpcional');
    expect(instanciaAtiva(gama.id).agarrarLinguaPendente).toBeUndefined();
  });

  it('usa Língua Sombria como Reação no turno de outro combatente, uma vez por rodada e sem AoO', async () => {
    const gama = modelo('sapo');
    const tokenGama = await invocarUma('sapo');
    const tokenAliado = Object.values(useMapStore.getState().entities).find(token => token.characterId === ID_ALIADO);
    if (!tokenAliado) throw new Error('Combat test setup is missing the ally token.');
    useMapStore.getState().updateEntity(tokenAliado.id, { x: 140, y: 280 });
    const posicaoInicial = { x: 140, y: 280 };
    useCombatStore.setState({
      currentTurnIndex: 1,
      initiativeOrder: [
        { charId: ID_DONO, charName: 'Dono', roll: 10, bonus: 0, total: 10 },
        { charId: ID_INIMIGO, charName: 'Inimigo', roll: 9, bonus: 0, total: 9 },
      ],
    } as never);

    expect(instanciaAtiva(gama.id).economiaAcoes?.reacao?.atual).toBe(1);
    const puxada = comandarPuxarAliadoGama(ID_DONO, gama.id, ID_ALIADO, {
      instanciaId: useMapStore.getState().entities[tokenGama]?.invocationInstanceId,
      requestId: 'gama-lingua-sombria-turno-inimigo',
    });
    expect(puxada).toMatchObject({ ok: true, nomeAlvo: 'aliado' });
    if (!puxada.ok) throw new Error(puxada.motivo);
    expect(useMapStore.getState().entities[tokenAliado.id]).toMatchObject(puxada.destino);
    expect(puxada.destino).not.toEqual(posicaoInicial);
    expect(instanciaAtiva(gama.id).economiaAcoes?.reacao?.atual).toBe(0);
    expect(instanciaAtiva(gama.id).usoLinguaSombriaGama).toMatchObject({
      combateId: useCombatStore.getState().combatId,
      rodada: 1,
    });
    expect(useLogStore.getState().logs.some(log => log.message.includes('não provoca ataques de oportunidade'))).toBe(true);

    const repetida = comandarPuxarAliadoGama(ID_DONO, gama.id, ID_ALIADO, {
      instanciaId: useMapStore.getState().entities[tokenGama]?.invocationInstanceId,
      requestId: 'gama-lingua-sombria-repetida',
    });
    expect(repetida).toMatchObject({ ok: false, motivo: 'Língua Sombria já foi usada nesta rodada.' });
  });

  it('recusa aliado fora de alcance sem gastar a Reação nem marcar uso', async () => {
    const gama = modelo('sapo');
    const tokenGama = await invocarUma('sapo');
    const tokenAliado = Object.values(useMapStore.getState().entities).find(token => token.characterId === ID_ALIADO);
    if (!tokenAliado) throw new Error('Combat test setup is missing the ally token.');
    useMapStore.getState().updateEntity(tokenAliado.id, { x: tokenAliado.x + 1000, y: tokenAliado.y + 1000 });

    const resultado = comandarPuxarAliadoGama(ID_DONO, gama.id, ID_ALIADO, {
      instanciaId: useMapStore.getState().entities[tokenGama]?.invocationInstanceId,
      requestId: 'gama-lingua-sombria-fora-alcance',
    });

    expect(resultado).toMatchObject({ ok: false, motivo: expect.stringContaining('fora do alcance') });
    expect(instanciaAtiva(gama.id).economiaAcoes?.reacao?.atual).toBe(1);
    expect(instanciaAtiva(gama.id).usoLinguaSombriaGama).toBeUndefined();
  });

  it('recusa inimigos e aliados Grandes sem gastar a Reação', async () => {
    const gama = modelo('sapo');
    const tokenGama = await invocarUma('sapo');
    const opcoes = { instanciaId: useMapStore.getState().entities[tokenGama]?.invocationInstanceId };

    expect(comandarPuxarAliadoGama(ID_DONO, gama.id, ID_INIMIGO, opcoes))
      .toMatchObject({ ok: false, motivo: 'Língua Sombria só pode puxar um aliado.' });
    useCharacterStore.getState().updateCharacter(ID_ALIADO, { level: 15, sizeCategory: 'Grande' });
    expect(comandarPuxarAliadoGama(ID_DONO, gama.id, ID_ALIADO, opcoes))
      .toMatchObject({ ok: false, motivo: 'Língua Sombria só pode puxar aliados de tamanho Médio ou menor.' });
    expect(instanciaAtiva(gama.id).economiaAcoes?.reacao?.atual).toBe(1);
    expect(instanciaAtiva(gama.id).usoLinguaSombriaGama).toBeUndefined();
  });

  it('recusa o puxão quando todos os espaços adjacentes estão ocupados sem gastar a Reação', async () => {
    const gama = modelo('sapo');
    const tokenGama = await invocarUma('sapo');
    const tokenAliado = Object.values(useMapStore.getState().entities).find(token => token.characterId === ID_ALIADO);
    if (!tokenAliado) throw new Error('Combat test setup is missing the ally token.');
    useMapStore.getState().updateEntity(tokenAliado.id, { x: 350, y: 210 });
    const posicoesBloqueadas = [
      { x: 140, y: 140 }, { x: 280, y: 140 }, { x: 210, y: 70 }, { x: 210, y: 210 },
      { x: 140, y: 70 }, { x: 280, y: 70 }, { x: 140, y: 210 }, { x: 280, y: 210 },
    ];
    for (const [index, { x, y }] of posicoesBloqueadas.entries()) {
      useMapStore.getState().addEntity({
        id: `bloqueio-gama-${index}`, shape: 'RECT', x, y, w: 70, h: 70, rotation: 0,
        color: '#555555', label: 'Bloqueio', locked: true, layer: 'tokens',
      });
    }

    const resultado = comandarPuxarAliadoGama(ID_DONO, gama.id, ID_ALIADO, {
      instanciaId: useMapStore.getState().entities[tokenGama]?.invocationInstanceId,
      requestId: 'gama-lingua-sombria-sem-espaco',
    });
    expect(resultado).toMatchObject({ ok: false, motivo: 'Não há espaço livre e acessível adjacente ao Gama para o aliado.' });
    expect(instanciaAtiva(gama.id).economiaAcoes?.reacao?.atual).toBe(1);
    expect(instanciaAtiva(gama.id).usoLinguaSombriaGama).toBeUndefined();
  });

  it('preserva a janela sem custo se o alvo sai dos 6 m antes da decisão', async () => {
    const gama = modelo('sapo');
    const tokenGama = await invocarUma('sapo');
    const alvo = Object.values(useMapStore.getState().entities).find(token => token.characterId === ID_INIMIGO);
    if (!alvo) throw new Error('Combat test setup is missing the enemy token.');
    rolarD20s(15);
    rolarDadosMinimos();
    await comandarAtaque(ID_DONO, gama.id, 'protusao-lingua', ID_INIMIGO, {
      instanciaId: useMapStore.getState().entities[tokenGama].invocationInstanceId,
      requestId: 'gama-protusao-alvo-move',
    });
    const peAntes = pegarFicha(ID_DONO).peCurrent;
    useMapStore.getState().updateEntity(alvo.id, { x: alvo.x + 1000 });
    const instancia = instanciaAtiva(gama.id);
    expect(await comandarAgarrarGama(ID_DONO, gama.id, { instanciaId: instancia.id })).toMatchObject({ ok: false });
    expect(pegarFicha(ID_DONO).peCurrent).toBe(peAntes);
    expect(instanciaAtiva(gama.id).agarrarLinguaPendente).toBeDefined();
  });
});

describe('Dez Sombras: Nue em combate', () => {
  beforeEach(prepararMesa);

  function adicionarPassageiro(id: string, tamanho: string) {
    useMapStore.getState().addEntity({
      id, shape: 'ELLIPSE', x: 700, y: 560, w: 70, h: 70, rotation: 0,
      color: '#667788', label: id, locked: false, layer: 'tokens', invocationEffectiveSize: tamanho,
    });
  }

  it('alterna voo e caminhada e aplica os limites de carga por tamanho', async () => {
    const tokenId = await invocarUma('nue', 420, 420);
    expect(deslocamentoInvocacaoM(tokenId, 'voo')).toBe(12);
    expect(deslocamentoInvocacaoM(tokenId, 'caminhada')).toBe(4.5);

    for (let index = 1; index <= 4; index += 1) adicionarPassageiro(`pequeno-${index}`, 'Pequeno');
    const umPequeno = comandarCargaAereaNue(ID_DONO, tokenId, 'pequeno-1', true);
    expect(umPequeno).toMatchObject({ ok: true, penalidadeVooM: 1.5 });
    const doisPequenos = comandarCargaAereaNue(ID_DONO, tokenId, 'pequeno-2', true);
    expect(doisPequenos).toMatchObject({ ok: true, penalidadeVooM: 3 });
    expect(deslocamentoInvocacaoM(tokenId, 'voo')).toBe(9);
    expect(estadoCargaNue(tokenId)).toMatchObject({ ok: true, passageiros: 2, unidades: 2 });

    expect(comandarCargaAereaNue(ID_DONO, tokenId, 'pequeno-3', false)).toMatchObject({ ok: false });
    expect(comandarCargaAereaNue(ID_DONO, tokenId, 'pequeno-3', true)).toMatchObject({ ok: true, penalidadeVooM: 4.5 });
    expect(comandarCargaAereaNue(ID_DONO, tokenId, 'pequeno-4', true)).toMatchObject({ ok: true, penalidadeVooM: 6 });
    adicionarPassageiro('pequeno-5', 'Pequeno');
    expect(comandarCargaAereaNue(ID_DONO, tokenId, 'pequeno-5', true)).toMatchObject({ ok: false });
    expect(deslocamentoInvocacaoM(tokenId, 'voo')).toBe(6);
  });

  it('equivale duas criaturas Médias a quatro unidades e bloqueia a terceira', async () => {
    const tokenId = await invocarUma('nue', 420, 420);
    adicionarPassageiro('medio-1', 'Médio');
    adicionarPassageiro('medio-2', 'Médio');
    adicionarPassageiro('medio-3', 'Médio');

    expect(comandarCargaAereaNue(ID_DONO, tokenId, 'medio-1', true)).toMatchObject({ ok: true, penalidadeVooM: 3 });
    expect(comandarCargaAereaNue(ID_DONO, tokenId, 'medio-2', true)).toMatchObject({ ok: true, penalidadeVooM: 6 });
    expect(comandarCargaAereaNue(ID_DONO, tokenId, 'medio-3', true)).toMatchObject({ ok: false });
  });

  it('exige confirmação manual para agarrar e solta a carga sem perder a posição do passageiro', async () => {
    const tokenId = await invocarUma('nue', 420, 420);
    const token = useMapStore.getState().entities[tokenId];
    adicionarPassageiro('alvo-nue', 'Pequeno');
    expect(comandarCargaAereaNue(ID_DONO, tokenId, 'alvo-nue', false)).toMatchObject({ ok: false });

    const carga = comandarCargaAereaNue(ID_DONO, tokenId, 'alvo-nue', true);
    expect(carga).toMatchObject({ ok: true, penalidadeVooM: 1.5 });
    expect(useMapStore.getState().entities['alvo-nue'].carriedBy).toBe(tokenId);
    expect(useMapStore.getState().entities['alvo-nue'].x).toBe(token.x);

    useMapStore.getState().updateEntity(tokenId, { x: token.x + 70 });
    expect(useMapStore.getState().entities['alvo-nue'].x).toBe(token.x + 70);
    expect(comandarSoltarCargaNue(ID_DONO, tokenId, 'alvo-nue')).toMatchObject({ ok: true });
    expect(useMapStore.getState().entities['alvo-nue'].carriedBy).toBeUndefined();
  });

  it('revalida o modo e o limite no movimento confirmado em combate', async () => {
    const tokenId = await invocarUma('nue', 420, 420);
    const token = useMapStore.getState().entities[tokenId];
    const instancia = instanciaAtiva(modelo('nue').id);
    const grid = useMapStore.getState().gridConfig;
    const distance = (x: number) => Math.hypot(x - token.x, 0) / grid.dpi * grid.metersPerCell;
    const confirmAt = (destX: number, mode: 'voo' | 'caminhada', requestId: string) => {
      const de = { x: token.x, y: token.y };
      const para = { x: destX, y: token.y };
      const distanciaM = distance(destX);
      useMapStore.getState().updateEntity(tokenId, { x: destX, invocationMovementMode: mode });
      useMapStore.getState().setPendingMove({
        entityId: tokenId, charId: ID_DONO, invocationInstanceId: instancia.id,
        invocationMovementMode: mode, movementRequestId: requestId,
        startX: de.x, startY: de.y, trail: [de, para], distM: distanciaM, actualDistM: distanciaM,
      });
      return confirmarMovimentoInvocacao({
        tokenId, instanciaId: instancia.id, de, para, trajetoria: [de, para], distanciaM, requestId,
      });
    };

    const caminhadaExcedida = confirmAt(token.x + 280, 'caminhada', 'nue-caminhada-excedida');
    expect(caminhadaExcedida).toMatchObject({ ok: false, motivo: 'O movimento excede o deslocamento disponível (4.5 m).' });
    expect(instanciaAtiva(modelo('nue').id).economiaAcoes?.acaoMovimento?.atual).toBe(1);

    useMapStore.getState().addEntity({
      id: 'obstaculo-no-solo', shape: 'RECT', x: token.x + 140, y: token.y, w: 70, h: 70,
      rotation: 0, color: '#667788', label: 'Obstáculo', locked: false, layer: 'tokens',
    });
    useMapStore.getState().updateEntity(tokenId, { x: token.x, invocationMovementMode: 'voo' });
    const caminhadaBloqueada = confirmAt(token.x + 210, 'caminhada', 'nue-caminhada-obstaculo');
    expect(caminhadaBloqueada).toMatchObject({ ok: false, motivo: 'A trajetória está bloqueada por uma parede, área ou token.' });

    useMapStore.getState().updateEntity(tokenId, { x: token.x, invocationMovementMode: 'voo' });
    const vooValidado = confirmAt(token.x + 420, 'voo', 'nue-voo-9m');
    expect(vooValidado).toMatchObject({ ok: true, distanciaM: 9 });
    expect(instanciaAtiva(modelo('nue').id).economiaAcoes?.acaoMovimento?.atual).toBe(0);
  });

  it('aplica Choque Estático como parcela DCC e respeita RD física separadamente', async () => {
    const nue = modelo('nue');
    await invocarUma('nue');
    const rd = createEmptyRdByType();
    rd.DI = 99;
    useCharacterStore.getState().updateCharacter(ID_INIMIGO, { hpCurrent: 1000, hpMax: 1000, rdByType: rd, ca: 1 });
    useCharacterStore.getState().updateCharacter(ID_DONO, {
      invocacoesConhecidas: pegarFicha(ID_DONO).invocacoesConhecidas?.map(item => item.id === nue.id
        ? { ...item, acoes: item.acoes.map(acao => acao.id === 'investida-eletrizante' ? { ...acao, tipoDano: 'DI' as const } : acao) }
        : item),
    });
    rolarD20s(15);
    rolarDadosMinimos();

    const resultado = await comandarAtaque(ID_DONO, nue.id, 'investida-eletrizante', ID_INIMIGO, {
      instanciaId: instanciaAtiva(nue.id).id,
      requestId: 'nue-choque-estatico-tipos-dano',
    });

    expect(resultado).toMatchObject({ ok: true, acertou: true, dano: 3 });
    expect(pegarFicha(ID_INIMIGO).hpCurrent).toBe(999);
    expect(useLogStore.getState().logs.some(log => log.message.includes('Choque Estático de Nue'))).toBe(true);
  });
});

describe('Dez Sombras: Orochi em combate', () => {
  beforeEach(prepararMesa);

  it('aplica vantagem de Emergir apenas contra quem ainda não agiu e abre a Ação Livre do Bote', async () => {
    useCombatStore.setState({
      initiativeOrder: [
        { charId: ID_DONO, charName: 'Dono', roll: 10, bonus: 0, total: 10 },
        { charId: ID_INIMIGO, charName: 'Inimigo', roll: 9, bonus: 0, total: 9 },
      ],
    } as never);
    const orochi = modelo('grande-serpente');
    const tokenId = await invocarUma('grande-serpente');
    rolarD20s(4, 18);
    rolarDadosMinimos();

    const resultado = await comandarAtaque(ID_DONO, orochi.id, 'bote-sombrio', ID_INIMIGO, {
      instanciaId: instanciaAtiva(orochi.id).id,
      requestId: 'orochi-emergir-vantagem',
    });

    expect(resultado).toMatchObject({
      ok: true,
      acertou: true,
      vantagemEmergir: true,
      efeitoOpcional: { tipo: 'agarrar_orochi', custoPE: 4 },
    });
    expect(useMapStore.getState().entities[tokenId]?.invocationEffectiveSize).toBe('Grande');
    expect(instanciaAtiva(orochi.id).agarrarOrochiPendente).toMatchObject({ alvoId: ID_INIMIGO, rodada: 1, turnoIndex: 0 });
  });

  it('não dá vantagem de Emergir a alvo que já agiu nesta rodada', async () => {
    useCombatStore.setState({
      currentTurnIndex: 1,
      initiativeOrder: [
        { charId: ID_INIMIGO, charName: 'Inimigo', roll: 10, bonus: 0, total: 10 },
        { charId: ID_DONO, charName: 'Dono', roll: 9, bonus: 0, total: 9 },
      ],
    } as never);
    const orochi = modelo('grande-serpente');
    await invocarUma('grande-serpente');
    rolarD20s(15);
    rolarDadosMinimos();

    const resultado = await comandarAtaque(ID_DONO, orochi.id, 'bote-sombrio', ID_INIMIGO, {
      instanciaId: instanciaAtiva(orochi.id).id,
      requestId: 'orochi-alvo-ja-agiu',
    });

    expect(resultado).toMatchObject({ ok: true, acertou: true });
    expect(resultado).not.toHaveProperty('vantagemEmergir');
  });

  it('gasta 4 PE na tentativa, marca Agarrado e aplica dano uma vez no início do turno do alvo', async () => {
    useCombatStore.setState({
      initiativeOrder: [
        { charId: ID_DONO, charName: 'Dono', roll: 10, bonus: 0, total: 10 },
        { charId: ID_INIMIGO, charName: 'Inimigo', roll: 9, bonus: 0, total: 9 },
      ],
    } as never);
    const orochi = modelo('grande-serpente');
    await invocarUma('grande-serpente');
    rolarD20s(4, 18, 20, 1);
    rolarDadosMinimos();
    await comandarAtaque(ID_DONO, orochi.id, 'bote-sombrio', ID_INIMIGO, {
      instanciaId: instanciaAtiva(orochi.id).id,
      requestId: 'orochi-bote-agarrar',
    });

    const tentativa = await comandarAgarrarOrochi(ID_DONO, orochi.id, {
      instanciaId: instanciaAtiva(orochi.id).id,
      requestId: 'orochi-agarrar-followup',
      escuridaoTotal: true,
    });
    expect(tentativa).toMatchObject({ ok: true, sucesso: true, bonusEscuridao: 2 });
    expect(pegarFicha(ID_DONO).peCurrent).toBe(PE_INICIAL - orochi.custoInvocacaoPE - 4);
    expect(pegarFicha(ID_INIMIGO).activeConditions).toEqual(expect.arrayContaining([
      expect.objectContaining({ conditionId: 'agarrado', sourceEntityId: orochi.subcategoria, sourceInstanceId: instanciaAtiva(orochi.id).id }),
    ]));

    const pvAntesDoTurno = pegarFicha(ID_INIMIGO).hpCurrent;
    useCombatStore.getState().nextTurn();
    await waitFor(() => expect(pegarFicha(ID_INIMIGO).hpCurrent).toBe(pvAntesDoTurno - 2));
    const pvAposTick = pegarFicha(ID_INIMIGO).hpCurrent;
    const { tickAgarradosOrochiInicioTurno } = await import('@/lib/controlador/mapa');
    await tickAgarradosOrochiInicioTurno(ID_INIMIGO);
    expect(pegarFicha(ID_INIMIGO).hpCurrent).toBe(pvAposTick);
  });

  it('permite ao personagem escapar do Orochi no início do próprio turno e remove o vínculo', async () => {
    useCombatStore.setState({
      initiativeOrder: [
        { charId: ID_DONO, charName: 'Dono', roll: 10, bonus: 0, total: 10 },
        { charId: ID_INIMIGO, charName: 'Inimigo', roll: 9, bonus: 0, total: 9 },
      ],
    } as never);
    const orochi = modelo('grande-serpente');
    await invocarUma('grande-serpente');
    rolarD20s(15, 16, 15, 1);
    rolarDadosMinimos();
    await comandarAtaque(ID_DONO, orochi.id, 'bote-sombrio', ID_INIMIGO, {
      instanciaId: instanciaAtiva(orochi.id).id,
      requestId: 'orochi-fuga-alvo-bote',
    });
    const tentativa = await comandarAgarrarOrochi(ID_DONO, orochi.id, {
      instanciaId: instanciaAtiva(orochi.id).id,
      requestId: 'orochi-fuga-alvo-grapple',
    });
    expect(tentativa).toMatchObject({ ok: true, sucesso: true });
    const condicao = pegarFicha(ID_INIMIGO).activeConditions?.find(condition =>
      condition.conditionId === 'agarrado' && condition.sourceEntityId === orochi.subcategoria);
    expect(condicao?.id).toBeTruthy();

    useCombatStore.setState({ currentTurnIndex: 1 } as never);
    rolarD20s(20, 1);
    const fuga = await escaparAgarradoPorInvocacao(ID_INIMIGO, condicao!.id, 'Atletismo');

    expect(fuga).toMatchObject({ ok: true, escapou: true });
    expect(pegarFicha(ID_INIMIGO).activeConditions?.some(condition => condition.id === condicao!.id)).toBe(false);
    expect(pegarFicha(ID_INIMIGO).grappleState?.grappledBy).not.toContain(`invocacao-grande-serpente:${instanciaAtiva(orochi.id).id}`);
  });

  it('permite à invocação-alvo escapar de Orochi e limpa apenas o vínculo correspondente', async () => {
    const orochi = modelo('grande-serpente');
    const cao = modelo('cao-branco');
    await invocarUma('grande-serpente');
    await invocarUma('cao-branco', 420, 140);
    const instanciaOrochi = instanciaAtiva(orochi.id);
    const instanciaCao = instanciaAtiva(cao.id);
    useCharacterStore.getState().updateCharacter(ID_DONO, {
      instanciasInvocacao: pegarFicha(ID_DONO).instanciasInvocacao?.map(instancia => instancia.id === instanciaCao.id
        ? {
            ...instancia,
            version: instancia.version + 1,
            agarradoPorInvocacao: [{ donoId: ID_DONO, instanciaId: instanciaOrochi.id, modeloId: orochi.id, nome: orochi.nome }],
          }
        : instancia),
    });
    rolarD20s(20, 1);

    const fuga = await escaparInvocacaoAgarrada(ID_DONO, instanciaCao.id, 'Acrobacia');

    expect(fuga).toMatchObject({ ok: true, escapou: true });
    expect(instanciaAtiva(cao.id).agarradoPorInvocacao).toEqual([]);
  });

  it('aplica uma vez por turno o dano de Orochi a uma invocação agarrada', async () => {
    const orochi = modelo('grande-serpente');
    const cao = modelo('cao-branco');
    await invocarUma('grande-serpente');
    const tokenCaoId = await invocarUma('cao-branco', 420, 140);
    const instanciaOrochi = instanciaAtiva(orochi.id);
    const instanciaCao = instanciaAtiva(cao.id);
    useCharacterStore.getState().updateCharacter(ID_DONO, {
      instanciasInvocacao: pegarFicha(ID_DONO).instanciasInvocacao?.map(instancia => instancia.id === instanciaCao.id
        ? {
            ...instancia,
            version: instancia.version + 1,
            agarradoPorInvocacao: [{ donoId: ID_DONO, instanciaId: instanciaOrochi.id, modeloId: orochi.id, nome: orochi.nome }],
          }
        : instancia),
    });
    const pvAntes = useMapStore.getState().entities[tokenCaoId]?.hp ?? 0;
    const { tickAgarradosOrochiInicioTurno } = await import('@/lib/controlador/mapa');

    expect(await tickAgarradosOrochiInicioTurno(ID_DONO)).toBe(1);
    expect(useMapStore.getState().entities[tokenCaoId]?.hp).toBe(pvAntes - 2);
    expect(await tickAgarradosOrochiInicioTurno(ID_DONO)).toBe(0);
  });

  it('libera os alvos quando Orochi cai ou deixa o campo', async () => {
    useCombatStore.setState({
      initiativeOrder: [
        { charId: ID_DONO, charName: 'Dono', roll: 10, bonus: 0, total: 10 },
        { charId: ID_INIMIGO, charName: 'Inimigo', roll: 9, bonus: 0, total: 9 },
      ],
    } as never);
    const orochi = modelo('grande-serpente');
    const tokenId = await invocarUma('grande-serpente');
    rolarD20s(5, 16, 20, 1);
    rolarDadosMinimos();
    await comandarAtaque(ID_DONO, orochi.id, 'bote-sombrio', ID_INIMIGO, {
      instanciaId: instanciaAtiva(orochi.id).id,
      requestId: 'orochi-bote-liberacao',
    });
    await comandarAgarrarOrochi(ID_DONO, orochi.id, { instanciaId: instanciaAtiva(orochi.id).id });
    expect(pegarFicha(ID_INIMIGO).activeConditions?.some(condition => condition.conditionId === 'agarrado')).toBe(true);

    expect(causarDanoInvocacao(tokenId, 1000, undefined, instanciaAtiva(orochi.id).id).ok).toBe(true);
    expect(pegarFicha(ID_INIMIGO).activeConditions?.some(condition => condition.conditionId === 'agarrado')).toBe(false);
  });
});

describe('Dez Sombras: Horda da Fuga dos Coelhos', () => {
  beforeEach(prepararMesa);

  it('aplica RD do nível contra alvo único, ignora RD contra área e registra Fragilizada', async () => {
    useCharacterStore.getState().updateCharacter(ID_DONO, { level: 4 });
    const coelhos = modelo('fuga-do-coelho');
    const tokenId = await invocarUma('fuga-do-coelho');
    const instanciaId = instanciaAtiva(coelhos.id).id;
    const pvInicial = useMapStore.getState().entities[tokenId]?.hp;
    if (pvInicial === undefined) throw new Error('The Fuga token was not materialized.');

    const danoUnico = causarDanoInvocacao(tokenId, 10, 'DCC', instanciaId, {
      tipoAlvo: 'unico', eventoId: 'fuga-rd-alvo-unico',
    });
    expect(danoUnico).toMatchObject({ ok: true, hpRestante: pvInicial - 6 });

    const danoArea = causarDanoInvocacao(tokenId, 10, 'DCC', instanciaId, {
      tipoAlvo: 'area', eventoId: 'fuga-rd-area',
    });
    expect(danoArea).toMatchObject({ ok: true, hpRestante: pvInicial - 16 });
    expect(useMapStore.getState().entities[tokenId]?.invocationConditionIds).toContain('fragilizado');
    expect(instanciaAtiva(coelhos.id).condicoes).toEqual(expect.arrayContaining([
      expect.objectContaining({ conditionId: 'fragilizado', sourceEntityId: 'dez-sombras:fuga-do-coelho' }),
    ]));

    const danoDepoisDeFragilizada = causarDanoInvocacao(tokenId, 10, 'DCC', instanciaId, {
      tipoAlvo: 'unico', eventoId: 'fuga-fragilizada-sem-rd',
    });
    expect(danoDepoisDeFragilizada).toMatchObject({ ok: true, hpRestante: pvInicial - 26 });
    expect(causarDanoInvocacao(tokenId, 10, 'DCC', instanciaId, {
      tipoAlvo: 'unico', eventoId: 'fuga-fragilizada-sem-rd',
    })).toMatchObject({ ok: true, hpRestante: pvInicial - 26 });

    expect(removerFragilizadoFugaCoelhos(ID_DONO, tokenId, instanciaId)).toEqual({ ok: true });
    expect(useMapStore.getState().entities[tokenId]?.invocationConditionIds).not.toContain('fragilizado');
    expect(instanciaAtiva(coelhos.id).condicoes).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ conditionId: 'fragilizado' }),
    ]));
  });

  it('cresce a cada três rodadas completas, aumenta PV atuais/máximos e para em Colossal', async () => {
    const coelhos = modelo('fuga-do-coelho');
    const tokenId = await invocarUma('fuga-do-coelho');
    const { processarCrescimentoFugaCoelhosInicioRodada } = await import('@/lib/controlador/dezSombrasFuga');
    const combateId = useCombatStore.getState().combatId!;
    const pvBase = coelhos.hpMaximo;

    for (const rodada of [2, 3]) {
      useCombatStore.setState({ round: rodada } as never);
      expect(processarCrescimentoFugaCoelhosInicioRodada(combateId, rodada)).toBe(0);
    }
    useCombatStore.setState({ round: 4 } as never);
    expect(processarCrescimentoFugaCoelhosInicioRodada(combateId, 4)).toBe(1);
    expect(processarCrescimentoFugaCoelhosInicioRodada(combateId, 4)).toBe(0);
    expect(useMapStore.getState().entities[tokenId]).toMatchObject({
      hp: pvBase + Math.floor(pvBase / 5),
      hpMax: pvBase + Math.floor(pvBase / 5),
      invocationEffectiveSize: 'Grande',
      invocationEffectiveSizeCategory: 3,
    });

    for (const rodada of [7, 10, 13]) {
      useCombatStore.setState({ round: rodada } as never);
      expect(processarCrescimentoFugaCoelhosInicioRodada(combateId, rodada)).toBe(1);
    }
    expect(useMapStore.getState().entities[tokenId]?.invocationEffectiveSize).toBe('Colossal');
    expect(useCharacterStore.getState().characters.find(character => character.id === ID_DONO)
      ?.instanciasInvocacao?.find(instancia => instancia.modeloId === coelhos.id)?.crescimentoFugaCoelhos?.totalCrescimentos).toBe(4);
  });

  it('materializa a pegada quadrada e aplica flanqueamento e terreno difícil apenas a adversários', async () => {
    const tokenId = await invocarUma('fuga-do-coelho', 350, 210);
    const mapa = useMapStore.getState();
    const horda = mapa.entities[tokenId];
    const alvo = Object.values(mapa.entities).find(entity => entity.characterId === ID_INIMIGO);
    if (!horda || !alvo) throw new Error('Fuga or enemy token was not materialized.');
    expect(horda).toMatchObject({ shape: 'RECT', w: mapa.gridConfig.dpi, h: mapa.gridConfig.dpi });
    mapa.updateEntity(alvo.id, { x: horda.x + 10, y: horda.y + 10 });
    const alvoAtual = useMapStore.getState().entities[alvo.id];
    const entities = useMapStore.getState().entities;
    const characters = useCharacterStore.getState().characters;
    const layerVisible = useMapStore.getState().layerVisible;
    expect(flanqueadoPelaFugaCoelhos(alvoAtual, entities, characters, layerVisible)).toBe(true);
    expect(montarVariaveisDoPersonagem(pegarFicha(ID_INIMIGO), 'USUARIO').FLANQUEADO).toBe(1);

    const areasInimigo = terrenosDificeisFugaCoelhos(ID_INIMIGO, characters, entities, layerVisible);
    const areasDono = terrenosDificeisFugaCoelhos(ID_DONO, characters, entities, layerVisible);
    expect(areasInimigo).toHaveLength(1);
    expect(areasDono).toHaveLength(0);
    const metrosPorPixel = useMapStore.getState().gridConfig.metersPerCell / useMapStore.getState().gridConfig.dpi;
    expect(movementCostForTerrainSegment(
      { x: horda.x - 35, y: horda.y + horda.h / 2 },
      { x: horda.x + horda.w + 35, y: horda.y + horda.h / 2 },
      metrosPorPixel,
      areasInimigo,
    )).toBeGreaterThan(100 * metrosPorPixel);
  });

  it('Fuga gasta uma Ação Complexa, valida o alcance e mantém o alvo até a mesa encerrar', async () => {
    const hordaId = await invocarUma('fuga-do-coelho', 210, 140);
    const horda = useMapStore.getState().entities[hordaId];
    const inimigo = Object.values(useMapStore.getState().entities).find(entity => entity.characterId === ID_INIMIGO);
    if (!horda || !inimigo) throw new Error('Fuga or enemy token was not materialized.');
    const modeloFuga = modelo('fuga-do-coelho');
    const instancia = instanciaAtiva(modeloFuga.id);
    const acoesAntes = instancia.economiaAcoes?.acaoComum?.atual ?? instancia.economiaAcoes?.acaoComplexa?.atual;

    expect(comandarFugaCoelhos(ID_DONO, modeloFuga.id, inimigo.id, {
      instanciaId: instancia.id, requestId: 'fuga-alvo-inimigo',
    })).toMatchObject({ ok: true, lado: 'inimigo' });
    expect(instanciaAtiva(modeloFuga.id).fugaCoelhosAlvo).toMatchObject({
      targetEntityId: inimigo.id, targetCharacterId: ID_INIMIGO, lado: 'inimigo', tipoAlvo: 'personagem',
    });
    const saldoDepois = instanciaAtiva(modeloFuga.id).economiaAcoes?.acaoComum?.atual ??
      instanciaAtiva(modeloFuga.id).economiaAcoes?.acaoComplexa?.atual;
    expect(saldoDepois).toBe((acoesAntes ?? 1) - 1);
    expect(encerrarFugaCoelhos(ID_DONO, instancia.id)).toEqual({ ok: true });
    expect(instanciaAtiva(modeloFuga.id).fugaCoelhosAlvo).toBeUndefined();
  });

  it('Cobertura Completa da Fuga bloqueia ataques de alvo único, mas não ataques em área', async () => {
    const coelhos = modelo('fuga-do-coelho');
    const tokenId = await invocarUma('fuga-do-coelho', 210, 140);
    const aliadoToken = Object.values(useMapStore.getState().entities).find(entity => entity.characterId === ID_ALIADO);
    if (!aliadoToken) throw new Error('Ally token was not materialized.');
    const instanciaId = instanciaAtiva(coelhos.id).id;
    expect(comandarFugaCoelhos(ID_DONO, coelhos.id, aliadoToken.id, {
      instanciaId, requestId: 'fuga-cobertura-aliado',
    })).toMatchObject({ ok: true, lado: 'aliado' });
    const pvAntes = pegarFicha(ID_ALIADO).hpCurrent;

    await useCharacterStore.getState().applyDamage(ID_ALIADO, 10, 'DCO', {
      attackerId: ID_INIMIGO, source: 'arma', isMelee: true,
      attack: { kind: 'melee', critical: false, criticalFail: false },
    });
    expect(pegarFicha(ID_ALIADO).hpCurrent).toBe(pvAntes);
    expect(useLogStore.getState().logs.some(log => log.message.includes('Cobertura Completa da Fuga'))).toBe(true);

    await useCharacterStore.getState().applyDamage(ID_ALIADO, 2, 'DCO', {
      attackerId: ID_INIMIGO, source: 'arma', isMelee: false,
      attack: { kind: 'ranged', critical: false, criticalFail: false, isAreaAttack: true },
    });
    expect(pegarFicha(ID_ALIADO).hpCurrent).toBe(pvAntes - 2);
    expect(useMapStore.getState().entities[tokenId]).toBeDefined();
  });

  it('Fuga não gasta ação quando o alvo está além de 9 m', async () => {
    const hordaId = await invocarUma('fuga-do-coelho', 210, 140);
    const horda = useMapStore.getState().entities[hordaId];
    const inimigo = Object.values(useMapStore.getState().entities).find(entity => entity.characterId === ID_INIMIGO);
    if (!horda || !inimigo) throw new Error('Fuga or enemy token was not materialized.');
    useMapStore.getState().updateEntity(inimigo.id, { x: horda.x + 700, y: horda.y });
    const modeloFuga = modelo('fuga-do-coelho');
    const instancia = instanciaAtiva(modeloFuga.id);
    const acoesAntes = instancia.economiaAcoes?.acaoComum?.atual ?? instancia.economiaAcoes?.acaoComplexa?.atual;

    expect(comandarFugaCoelhos(ID_DONO, modeloFuga.id, inimigo.id, {
      instanciaId: instancia.id, requestId: 'fuga-alvo-fora-alcance',
    })).toMatchObject({ ok: false, motivo: expect.stringContaining('fora do alcance') });
    const saldoDepois = instanciaAtiva(modeloFuga.id).economiaAcoes?.acaoComum?.atual ??
      instanciaAtiva(modeloFuga.id).economiaAcoes?.acaoComplexa?.atual;
    expect(saldoDepois).toBe(acoesAntes);
  });

  it('Dispersão debita Ação Bônus, reduz os PV proporcionalmente e não cria vagas extras', async () => {
    const hordaId = await invocarUma('fuga-do-coelho', 210, 140);
    const horda = useMapStore.getState().entities[hordaId];
    const coelhos = modelo('fuga-do-coelho');
    const instanciaAntes = instanciaAtiva(coelhos.id);
    const bonusAntes = instanciaAntes.economiaAcoes?.acaoBonus?.atual ?? 0;
    if (!horda) throw new Error('Fuga was not materialized.');

    const resultado = comandarDispersaoTaticaFugaCoelhos(ID_DONO, coelhos.id, 2, 45, 'Pequeno', {
      instanciaId: instanciaAntes.id, requestId: 'fuga-dispersao-proporcional',
    });
    expect(resultado).toMatchObject({ ok: true, quantidade: 2, hpAtualRestante: 45, hpMaximoRestante: 45, porteRestante: 'Pequeno' });
    if (!resultado.ok) throw new Error(resultado.motivo);
    expect(instanciaAtiva(coelhos.id)).toMatchObject({ hpAtual: 45, hpMaximoAtual: 45, tokenId: hordaId });
    expect(useMapStore.getState().entities[hordaId]).toMatchObject({ hp: 45, hpMax: 45, invocationEffectiveSize: 'Pequeno' });
    expect(resultado.tokenIds.map(id => useMapStore.getState().entities[id])).toEqual(expect.arrayContaining([
      expect.objectContaining({ hp: 1, hpMax: 1, invocationMovementM: 9, invocationDefense: coelhos.defesa,
        invocationSubordinate: expect.objectContaining({ kind: 'fuga-coelho', parentTokenId: hordaId }) }),
    ]));
    expect(tokensInvocados(ID_DONO).filter(token => token.invocationInstanceId === instanciaAntes.id)).toHaveLength(1);
    expect(instanciaAtiva(coelhos.id).economiaAcoes?.acaoBonus?.atual).toBe(bonusAntes - 1);

    const repetido = comandarDispersaoTaticaFugaCoelhos(ID_DONO, coelhos.id, 2, 45, 'Pequeno', {
      instanciaId: instanciaAntes.id, requestId: 'fuga-dispersao-proporcional',
    });
    expect(repetido).toMatchObject({ ok: true, repetido: true, tokenIds: resultado.tokenIds });
    expect(tokensInvocados(ID_DONO).filter(token => token.invocationInstanceId === instanciaAntes.id)).toHaveLength(1);
  });

  it('não gasta Ação Bônus nem reduz a Horda quando não há espaços adjacentes livres', async () => {
    const hordaId = await invocarUma('fuga-do-coelho', 210, 140);
    const mapa = useMapStore.getState();
    const horda = mapa.entities[hordaId];
    const coelhos = modelo('fuga-do-coelho');
    const instancia = instanciaAtiva(coelhos.id);
    const bonusAntes = instancia.economiaAcoes?.acaoBonus?.atual;
    if (!horda) throw new Error('Fuga was not materialized.');
    for (const entity of Object.values(mapa.entities)) {
      if (entity.id !== hordaId && entity.invocationInstanceId !== instancia.id && entity.layer !== 'map') {
        mapa.updateEntity(entity.id, { x: 900 + entity.x, y: 900 + entity.y });
      }
    }
    const passo = mapa.gridConfig.dpi;
    for (let linha = -1; linha <= 1; linha++) {
      for (let coluna = -1; coluna <= 1; coluna++) {
        if (linha === 0 && coluna === 0) continue;
        mapa.addEntity({
          id: `fuga-espaco-ocupado-${linha}-${coluna}`, shape: 'RECT',
          x: horda.x + coluna * passo, y: horda.y + linha * passo,
          w: passo, h: passo, rotation: 0, color: '#555', locked: false, layer: 'tokens',
        });
      }
    }

    expect(comandarDispersaoTaticaFugaCoelhos(ID_DONO, coelhos.id, 1, 45, 'Pequeno', {
      instanciaId: instancia.id, requestId: 'fuga-dispersao-sem-espaco',
    })).toMatchObject({ ok: false, motivo: expect.stringContaining('espaço') });
    expect(instanciaAtiva(coelhos.id)).toMatchObject({ hpAtual: coelhos.hpAtual, hpMaximoAtual: coelhos.hpMaximo });
    expect(instanciaAtiva(coelhos.id).economiaAcoes?.acaoBonus?.atual).toBe(bonusAntes);
    expect(Object.values(useMapStore.getState().entities).some(entity => entity.invocationSubordinate?.kind === 'fuga-coelho')).toBe(false);
  });

  it('limita seis coelhos ativos; atacar ignora RD comum e cada coelho ataca uma vez por rodada', async () => {
    const hordaId = await invocarUma('fuga-do-coelho', 210, 140);
    const coelhos = modelo('fuga-do-coelho');
    const instancia = instanciaAtiva(coelhos.id);
    const mapa = useMapStore.getState();
    for (const entity of Object.values(mapa.entities)) {
      if (entity.id !== hordaId && entity.invocationInstanceId !== instancia.id && entity.layer !== 'map') {
        mapa.updateEntity(entity.id, { x: 900 + entity.x, y: 900 + entity.y });
      }
    }
    const seis = comandarDispersaoTaticaFugaCoelhos(ID_DONO, coelhos.id, 6, 45, 'Pequeno', {
      instanciaId: instancia.id, requestId: 'fuga-dispersao-seis',
    });
    expect(seis).toMatchObject({ ok: true, quantidade: 6 });
    if (!seis.ok) throw new Error(seis.motivo);
    expect(comandarDispersaoTaticaFugaCoelhos(ID_DONO, coelhos.id, 1, 40, 'Minúsculo', {
      instanciaId: instancia.id, requestId: 'fuga-dispersao-sete',
    })).toMatchObject({ ok: false, motivo: expect.stringContaining('limite simultâneo') });

    const inimigo = Object.values(useMapStore.getState().entities).find(entity => entity.characterId === ID_INIMIGO);
    if (!inimigo) throw new Error('Enemy token was not materialized.');
    const coelhoId = seis.tokenIds[0];
    const coelho = useMapStore.getState().entities[coelhoId];
    if (!coelho) throw new Error('Dispersed rabbit was not materialized.');
    useMapStore.getState().updateEntity(coelhoId, { x: inimigo.x, y: inimigo.y - useMapStore.getState().gridConfig.dpi });
    const tigreTokenId = await invocarUma('tigre-funebre', 1260, 840);
    const tigreInstanceId = useMapStore.getState().entities[tigreTokenId]?.invocationInstanceId;
    if (!tigreInstanceId) throw new Error('Tiger instance was not materialized.');
    const dono = pegarFicha(ID_DONO);
    const combateId = useCombatStore.getState().combatId ?? undefined;
    useCharacterStore.getState().updateCharacter(ID_DONO, {
      instanciasInvocacao: (dono.instanciasInvocacao ?? []).map(instancia => instancia.id === tigreInstanceId
        ? { ...instancia, estadoTigreFunebre: {
          ...(combateId ? { combateId } : {}),
          garras: [{ alvoId: ID_INIMIGO, nomeAlvo: 'inimigo', penalidade: 2, ultimaRodadaAcerto: 1 }],
          turnosProcessados: [],
        } }
        : instancia),
    });
    useCharacterStore.getState().updateCharacter(ID_INIMIGO, { rd: 100 });
    rolarD20s(20);
    const pvAntes = pegarFicha(ID_INIMIGO).hpCurrent;
    const defesaEsperada = Math.max(0, computeTotalDefense(pegarFicha(ID_INIMIGO), {}, 'melee') - 2);

    const ataque = await comandarAtaqueCoelhoDisperso(ID_DONO, coelhoId, ID_INIMIGO, { requestId: 'fuga-ataque-critico' });
    expect(ataque).toMatchObject({ ok: true, acertou: true, critico: true, dano: 1, defesa: defesaEsperada });
    expect(pegarFicha(ID_INIMIGO).hpCurrent).toBe(pvAntes - 1);
    expect(await comandarAtaqueCoelhoDisperso(ID_DONO, coelhoId, ID_INIMIGO, { requestId: 'fuga-ataque-repetido' }))
      .toMatchObject({ ok: false, motivo: expect.stringContaining('já atacou nesta rodada') });
  });

  it('mover um coelho usa a instância da Horda sem substituir seus PV por 1', async () => {
    const hordaId = await invocarUma('fuga-do-coelho', 210, 140);
    const coelhos = modelo('fuga-do-coelho');
    const instancia = instanciaAtiva(coelhos.id);
    const dispersao = comandarDispersaoTaticaFugaCoelhos(ID_DONO, coelhos.id, 1, 45, 'Pequeno', {
      instanciaId: instancia.id, requestId: 'fuga-dispersao-movimento',
    });
    if (!dispersao.ok) throw new Error(dispersao.motivo);
    const coelho = useMapStore.getState().entities[dispersao.tokenIds[0]];
    if (!coelho) throw new Error('Dispersed rabbit was not materialized.');
    const de = { x: coelho.x, y: coelho.y };
    const para = { x: coelho.x, y: coelho.y - useMapStore.getState().gridConfig.dpi };
    const requestId = 'fuga-movimento-coelho';
    useCombatStore.getState().setFreeformMode(false);
    useMapStore.getState().updateEntity(coelho.id, para);
    useMapStore.getState().setPendingMove({
      entityId: coelho.id, charId: ID_DONO, invocationInstanceId: instancia.id, movementRequestId: requestId,
      startX: de.x, startY: de.y, trail: [de, para], distM: 1.5, actualDistM: 1.5,
    });

    expect(confirmarMovimentoInvocacao({
      tokenId: coelho.id, instanciaId: instancia.id, de, para, trajetoria: [de, para], distanciaM: 1.5, requestId,
    })).toMatchObject({ ok: true });
    expect(instanciaAtiva(coelhos.id)).toMatchObject({ tokenId: hordaId, hpAtual: 45, hpMaximoAtual: 45 });
  });

  it('dano derrota só o coelho disperso e não aciona o Tesouro Escondido do Líder', async () => {
    const hordaId = await invocarUma('fuga-do-coelho', 210, 140);
    const coelhos = modelo('fuga-do-coelho');
    const instancia = instanciaAtiva(coelhos.id);
    const dispersao = comandarDispersaoTaticaFugaCoelhos(ID_DONO, coelhos.id, 1, 45, 'Pequeno', {
      instanciaId: instancia.id, requestId: 'fuga-dispersao-dano-coelho',
    });
    if (!dispersao.ok) throw new Error(dispersao.motivo);
    vi.spyOn(useDice3DStore.getState(), 'requestNotation').mockResolvedValue([1]);

    expect(causarDanoInvocacao(dispersao.tokenIds[0], 1, 'DCO', instancia.id, {
      critico: true, eventoId: 'fuga-dano-no-coelho-disperso',
    })).toMatchObject({ ok: true, hpRestante: 0, destruida: true });
    expect(useMapStore.getState().entities[dispersao.tokenIds[0]]).toBeUndefined();
    expect(useMapStore.getState().entities[hordaId]).toBeDefined();
    expect(instanciaAtiva(coelhos.id)).toMatchObject({ hpAtual: 45, hpMaximoAtual: 45, tokenId: hordaId });
    expect(modelo('fuga-do-coelho').perdaPermanente).not.toBe(true);
    expect(useDice3DStore.getState().requestNotation).not.toHaveBeenCalled();
  });

  it('aplica Fragilizada à Horda e ao alvo protegido quando ambos sofrem dano em área', async () => {
    const hordaId = await invocarUma('fuga-do-coelho', 210, 140);
    const inimigo = Object.values(useMapStore.getState().entities).find(entity => entity.characterId === ID_INIMIGO);
    if (!inimigo) throw new Error('Enemy token was not materialized.');
    const coelhos = modelo('fuga-do-coelho');
    const instancia = instanciaAtiva(coelhos.id);
    expect(comandarFugaCoelhos(ID_DONO, coelhos.id, inimigo.id, {
      instanciaId: instancia.id, requestId: 'fuga-alvo-area',
    })).toMatchObject({ ok: true });

    expect(fragilizarAlvoFugaAtingidoPorArea({ characterId: ID_INIMIGO }, 'fuga-alvo-area-dano')).toBe(1);
    expect(pegarFicha(ID_INIMIGO).activeConditions).toEqual(expect.arrayContaining([
      expect.objectContaining({ conditionId: 'fragilizado', sourceEntityId: 'dez-sombras:fuga-do-coelho' }),
    ]));
    expect(instanciaAtiva(coelhos.id).condicoes).toEqual(expect.arrayContaining([
      expect.objectContaining({ conditionId: 'fragilizado' }),
    ]));
    expect(useMapStore.getState().entities[hordaId]?.invocationConditionIds).toContain('fragilizado');
    expect(fragilizarAlvoFugaAtingidoPorArea({ characterId: ID_INIMIGO }, 'fuga-alvo-area-dano')).toBe(0);
  });

  it('o Líder impede a derrota por dano comum e a Horda retorna após Descanso Longo', async () => {
    const coelhos = modelo('fuga-do-coelho');
    const tokenId = await invocarUma('fuga-do-coelho');
    const instanciaId = instanciaAtiva(coelhos.id).id;
    expect(causarDanoInvocacao(tokenId, 1000, 'DCO', instanciaId)).toMatchObject({
      ok: true, hpRestante: 0, destruida: false,
    });
    expect(pegarFicha(ID_DONO).instanciasInvocacao?.find(item => item.id === instanciaId)?.estado).toBe('caida');
    expect(useMapStore.getState().entities[tokenId]?.invocationState).toBe('caida');
    expect(modelo('fuga-do-coelho').perdaPermanente).not.toBe(true);

    expect(restaurarInvocacoesDescansoLongo(ID_DONO)).toBeGreaterThan(0);
    expect(instanciaAtiva(coelhos.id)).toMatchObject({ estado: 'ativa', hpAtual: coelhos.hpMaximo });
    expect(useMapStore.getState().entities[tokenId]).toMatchObject({
      hp: coelhos.hpMaximo, invocationState: 'ativa',
    });
  });

  it('em crítico, Tesouro Escondido exorciza a Horda somente no resultado 1 do d10', async () => {
    const coelhos = modelo('fuga-do-coelho');
    const tokenId = await invocarUma('fuga-do-coelho');
    const instanciaId = instanciaAtiva(coelhos.id).id;
    vi.spyOn(useDice3DStore.getState(), 'requestNotation').mockResolvedValue([1]);

    expect(causarDanoInvocacao(tokenId, 4, 'DCO', instanciaId, {
      critico: true, eventoId: 'fuga-tesouro-critico-1',
    })).toMatchObject({ ok: true, destruida: false });
    await waitFor(() => expect(modelo('fuga-do-coelho').perdaPermanente).toBe(true));
    expect(useMapStore.getState().entities[tokenId]).toBeUndefined();
    expect(useLogStore.getState().logs.some(log => log.message.includes('d10 = 1') && log.message.includes('exorcizada'))).toBe(true);
  });

  it('mantém o Líder quando Tesouro Escondido obtém 2 a 10 no d10', async () => {
    const coelhos = modelo('fuga-do-coelho');
    const tokenId = await invocarUma('fuga-do-coelho');
    const instanciaId = instanciaAtiva(coelhos.id).id;
    vi.spyOn(useDice3DStore.getState(), 'requestNotation').mockResolvedValue([7]);

    causarDanoInvocacao(tokenId, 4, 'DCO', instanciaId, {
      critico: true, eventoId: 'fuga-tesouro-critico-7',
    });
    await waitFor(() => expect(useLogStore.getState().logs.some(log => log.message.includes('d10 = 7'))).toBe(true));
    expect(modelo('fuga-do-coelho').perdaPermanente).not.toBe(true);
    expect(useMapStore.getState().entities[tokenId]).toBeDefined();
  });

  it('escala a pegada física junto com o porte da Horda', async () => {
    const tokenId = await invocarUma('fuga-do-coelho');
    const { processarCrescimentoFugaCoelhosInicioRodada } = await import('@/lib/controlador/dezSombrasFuga');
    const combatId = useCombatStore.getState().combatId!;
    useCombatStore.setState({ round: 4 } as never);
    expect(processarCrescimentoFugaCoelhosInicioRodada(combatId, 4)).toBe(1);
    expect(useMapStore.getState().entities[tokenId]).toMatchObject({
      shape: 'RECT',
      w: useMapStore.getState().gridConfig.dpi * celulasFugaCoelhosPorPorte('Grande'),
      h: useMapStore.getState().gridConfig.dpi * celulasFugaCoelhosPorPorte('Grande'),
      invocationEffectiveSize: 'Grande',
    });
  });

  it('Horda Infindável cresce a partir do porte reduzido pela Dispersão', async () => {
    const tokenId = await invocarUma('fuga-do-coelho');
    const coelhos = modelo('fuga-do-coelho');
    const instancia = instanciaAtiva(coelhos.id);
    expect(comandarDispersaoTaticaFugaCoelhos(ID_DONO, coelhos.id, 1, 45, 'Pequeno', {
      instanciaId: instancia.id, requestId: 'fuga-dispersao-antes-do-crescimento',
    })).toMatchObject({ ok: true });
    const { processarCrescimentoFugaCoelhosInicioRodada } = await import('@/lib/controlador/dezSombrasFuga');
    const combatId = useCombatStore.getState().combatId!;
    useCombatStore.setState({ round: 4 } as never);

    expect(processarCrescimentoFugaCoelhosInicioRodada(combatId, 4)).toBe(1);
    expect(useMapStore.getState().entities[tokenId]).toMatchObject({
      invocationEffectiveSize: 'Médio', hpMax: 56,
    });
    expect(instanciaAtiva(coelhos.id)).toMatchObject({ hpMaximoAtual: 56, crescimentoFugaCoelhos: { totalCrescimentos: 1 } });
  });

  it('é chamado automaticamente ao iniciar nova rodada do combate', async () => {
    const coelhos = modelo('fuga-do-coelho');
    const tokenId = await invocarUma('fuga-do-coelho');
    useCombatStore.setState({
      round: 3,
      currentTurnIndex: 0,
      initiativeOrder: [{ charId: ID_DONO, charName: 'Dono', roll: 10, bonus: 0, total: 10 }],
    } as never);

    useCombatStore.getState().nextTurn();

    await waitFor(() => expect(useMapStore.getState().entities[tokenId]?.hpMax).toBe(coelhos.hpMaximo + Math.floor(coelhos.hpMaximo / 5)));
    expect(useCombatStore.getState().round).toBe(4);
  });
});

describe('Dez Sombras: Elefante Máximo', () => {
  beforeEach(prepararMesa);

  it('Torrente de Água posiciona a linha de 6 m, seleciona a mesa e solicita Fortitude antes de cobrar uma vez', async () => {
    const tokenId = await invocarUma('elefante-maximo', 210, 140);
    const elefante = modelo('elefante-maximo');
    const instancia = instanciaAtiva(elefante.id);
    const token = useMapStore.getState().entities[tokenId];
    const placement = vi.spyOn(useMapStore.getState(), 'requestAoEPlacement').mockResolvedValue({
      id: 'torrente-linha', kind: 'line', x: token.x + token.w / 2, y: token.y + token.h / 2,
      rotation: 0, length: 280, width: 70, color: '#ff5577', opacity: 1,
    });
    const acoesAntes = instancia.economiaAcoes?.acaoComplexa?.atual ?? instancia.economiaAcoes?.acaoComum?.atual;
    useCombatStore.setState({ inCombat: true, initiativeOrder: [{ charId: ID_DONO, initiative: 10 }], currentTurnIndex: 0 } as never);

    const resultado = await comandarAtaque(ID_DONO, elefante.id, 'torrente-agua', { tipo: 'area' }, {
      instanciaId: instancia.id, requestId: 'torrente-area-linha',
    });

    expect(placement).toHaveBeenCalledWith(expect.objectContaining({ kind: 'line', sizeMeters: 6, widthMeters: 1.5 }));
    expect(resultado).toMatchObject({ ok: true, resultados: [
      expect.objectContaining({ alvoId: ID_INIMIGO, testePendente: true }),
    ] });
    expect(useTestRequestStore.getState().requests).toEqual(expect.arrayContaining([
      expect.objectContaining({
        charId: ID_INIMIGO, kind: 'save', testName: 'Fortitude',
        invocationResolution: expect.objectContaining({
          kind: 'shikigami_damage_after_save', damageFormula: '1d8', damageType: 'DI', damageOnSuccess: 'nenhum',
        }),
      }),
    ]));
    const acoesDepois = instanciaAtiva(elefante.id).economiaAcoes?.acaoComplexa?.atual ??
      instanciaAtiva(elefante.id).economiaAcoes?.acaoComum?.atual;
    expect(acoesDepois).toBe((acoesAntes ?? 1) - 1);
    useCombatStore.setState({ inCombat: false } as never);
  });

  it('Massa Esmagadora aplica dano real, Caído e altura de queda, consumindo uma Ação Simples', async () => {
    const tokenId = await invocarUma('elefante-maximo', 210, 140);
    const elefante = modelo('elefante-maximo');
    const instancia = instanciaAtiva(elefante.id);
    const token = useMapStore.getState().entities[tokenId];
    const alvoToken = Object.values(useMapStore.getState().entities).find(entity => entity.characterId === ID_INIMIGO);
    if (!alvoToken) throw new Error('Combat test setup is missing the enemy token.');
    useMapStore.getState().updateEntity(tokenId, { altitudeM: 9 });
    useMapStore.getState().updateEntity(alvoToken.id, { x: token.x, y: token.y });
    rolarDadosMinimos();
    const peAntes = pegarFicha(ID_DONO).peCurrent;
    const acoesAntes = instancia.economiaAcoes?.acaoBonus?.atual;

    const resultado = await comandarMassaEsmagadoraElefante(ID_DONO, elefante.id, ID_INIMIGO, {
      instanciaId: instancia.id, requestId: 'massa-elefante-personagem',
    });

    expect(resultado).toMatchObject({ ok: true, formula: '4d12+3d6', dano: 7, caiu: true });
    expect(pegarFicha(ID_INIMIGO).hpCurrent).toBeLessThan(1000);
    expect(pegarFicha(ID_INIMIGO).activeConditions?.some(condition => condition.conditionId === 'caido' && condition.durationMode === 'ate_acabar')).toBe(true);
    expect(useMapStore.getState().entities[tokenId]?.altitudeM).toBe(0);
    expect(instanciaAtiva(elefante.id).economiaAcoes?.acaoBonus?.atual).toBe((acoesAntes ?? 1) - 1);
    expect(pegarFicha(ID_DONO).peCurrent).toBe(peAntes);
  });

  it('Massa Esmagadora respeita porte e sobreposição e reserva 6d12 de Domínio apenas para o Mestre', async () => {
    const tokenId = await invocarUma('elefante-maximo', 210, 140);
    const elefante = modelo('elefante-maximo');
    const instancia = instanciaAtiva(elefante.id);
    const token = useMapStore.getState().entities[tokenId];
    const alvoToken = Object.values(useMapStore.getState().entities).find(entity => entity.characterId === ID_INIMIGO);
    if (!alvoToken) throw new Error('Combat test setup is missing the enemy token.');
    useMapStore.getState().updateEntity(alvoToken.id, { x: token.x, y: token.y });
    useCharacterStore.getState().updateCharacter(ID_INIMIGO, { level: 15, sizeCategory: 'Grande', __allowEnemyLevelUpdate: true } as never);
    expect(pegarFicha(ID_INIMIGO)).toMatchObject({ level: 15, sizeCategory: 'Grande' });

    const porteInvalido = await comandarMassaEsmagadoraElefante(ID_DONO, elefante.id, ID_INIMIGO, {
      instanciaId: instancia.id, requestId: 'massa-elefante-porte-invalido',
    });
    expect(porteInvalido).toMatchObject({ ok: false, motivo: expect.stringContaining('criatura menor') });
    useCharacterStore.getState().updateCharacter(ID_INIMIGO, { level: 1, sizeCategory: 'Pequeno' });
    useMapStore.getState().updateEntity(alvoToken.id, { x: token.x + 700, y: token.y + 700 });
    const foraDaPegada = await comandarMassaEsmagadoraElefante(ID_DONO, elefante.id, ID_INIMIGO, {
      instanciaId: instancia.id, requestId: 'massa-elefante-fora-da-pegada',
    });
    expect(foraDaPegada).toMatchObject({ ok: false, motivo: expect.stringContaining('sob os pés') });
    useMapStore.getState().updateEntity(alvoToken.id, { x: token.x, y: token.y });
    useRoleStore.setState({ role: 'PLAYER' } as never);
    const dominioSemPermissao = await comandarMassaEsmagadoraElefante(ID_DONO, elefante.id, ID_INIMIGO, {
      instanciaId: instancia.id, requestId: 'massa-elefante-dominio-sem-mestre', dominioAtivo: true,
    });
    expect(dominioSemPermissao).toMatchObject({ ok: false, motivo: expect.stringContaining('Somente o Mestre') });

    useRoleStore.setState({ role: 'MASTER' } as never);
    useMapStore.getState().updateEntity(tokenId, { altitudeM: 3 });
    rolarDadosMinimos();
    const dominio = await comandarMassaEsmagadoraElefante(ID_DONO, elefante.id, ID_INIMIGO, {
      instanciaId: instancia.id, requestId: 'massa-elefante-dominio-mestre', dominioAtivo: true,
    });
    expect(dominio).toMatchObject({ ok: true, formula: '6d12+1d6', dano: 7 });
  });

  it('Massa Esmagadora derruba outra invocação, reduz seu movimento e permite levantar com ação própria', async () => {
    const alvoId = await invocarUma('cao-branco', 420, 140);
    const elefanteId = await invocarUma('elefante-maximo', 210, 140);
    const elefante = modelo('elefante-maximo');
    const cao = modelo('cao-branco');
    const instanciaElefante = instanciaAtiva(elefante.id);
    const instanciaCao = instanciaAtiva(cao.id);
    const tokenElefante = useMapStore.getState().entities[elefanteId];
    useMapStore.getState().updateEntity(alvoId, { x: tokenElefante.x, y: tokenElefante.y });
    rolarDadosMinimos();

    const resultado = await comandarMassaEsmagadoraElefante(ID_DONO, elefante.id, `invoc:${alvoId}`, {
      instanciaId: instanciaElefante.id, requestId: 'massa-elefante-invocacao-alvo',
    });

    expect(resultado).toMatchObject({ ok: true, caiu: true });
    expect(useMapStore.getState().entities[alvoId]?.invocationConditionIds).toContain('caido');
    expect(instanciaAtiva(cao.id).condicoes?.some(condition => typeof condition === 'object' && condition !== null &&
      (condition as { conditionId?: string }).conditionId === 'caido')).toBe(true);
    expect(deslocamentoInvocacaoM(alvoId)).toBe(4.5);

    const levantar = comandarLevantarInvocacao(ID_DONO, alvoId, instanciaCao.id, 'levantar-cao-apos-massa');
    expect(levantar).toEqual({ ok: true });
    expect(useMapStore.getState().entities[alvoId]?.invocationConditionIds).not.toContain('caido');
    expect(deslocamentoInvocacaoM(alvoId)).toBe(12);
  });
});

describe('Dez Sombras: Cervo Circular', () => {
  beforeEach(prepararMesa);

  it('Bênção recupera 3d12 + Sabedoria, debita 2 PE e consome a Ação Complexa', async () => {
    const tokenId = await invocarUma('cervo-circular', 210, 140);
    const cervo = modelo('cervo-circular');
    const instancia = instanciaAtiva(cervo.id);
    const alvoToken = Object.values(useMapStore.getState().entities).find(entity => entity.characterId === ID_ALIADO);
    if (!alvoToken) throw new Error('Combat test setup is missing the ally token.');
    useMapStore.getState().updateEntity(alvoToken.id, { x: 280, y: 140 });
    rolarDadosMinimos();
    const peAntes = pegarFicha(ID_DONO).peCurrent;
    const acoesAntes = instancia.economiaAcoes?.acaoComplexa?.atual ?? instancia.economiaAcoes?.acaoComum?.atual;

    const resultado = await comandarSuporte(ID_DONO, cervo.id, 'bencao', [ID_ALIADO], { instanciaId: instancia.id, requestId: 'cervo-bencao-cura' });

    expect(resultado).toMatchObject({ ok: true, efeito: 'cura real', valor: 6, alvos: 1, curaReal: true, formula: '3d12+3' });
    expect(pegarFicha(ID_ALIADO).hpCurrent).toBe(11);
    expect(pegarFicha(ID_DONO).peCurrent).toBe(peAntes - 2);
    const instanciaAtual = instanciaAtiva(cervo.id);
    expect(instanciaAtual.economiaAcoes?.acaoComplexa?.atual ?? instanciaAtual.economiaAcoes?.acaoComum?.atual).toBe((acoesAntes ?? 1) - 1);
    expect(tokenId).toBeTruthy();
  });

  it('Bênção contra uma Maldição aplica 1,5× como Energia Reversa, sem curá-la', async () => {
    const tokenId = await invocarUma('cervo-circular', 210, 140);
    const cervo = modelo('cervo-circular');
    const instancia = instanciaAtiva(cervo.id);
    useCharacterStore.getState().updateCharacter(ID_INIMIGO, { characterClass: 'Maldição' });
    const alvoToken = Object.values(useMapStore.getState().entities).find(entity => entity.characterId === ID_INIMIGO);
    if (!alvoToken) throw new Error('Combat test setup is missing the curse token.');
    useMapStore.getState().updateEntity(alvoToken.id, { x: 280, y: 140 });
    rolarDadosMinimos();

    const resultado = await comandarSuporte(ID_DONO, cervo.id, 'bencao', [ID_INIMIGO], { instanciaId: instancia.id, requestId: 'cervo-bencao-malaria' });

    expect(resultado).toMatchObject({ ok: true, efeito: 'dano de Energia Reversa', valor: 9, alvos: 1, curaReal: false, formula: '3d12+3' });
    expect(pegarFicha(ID_INIMIGO).hpCurrent).toBe(991);
    const instanciaAtual = instanciaAtiva(cervo.id);
    expect(instanciaAtual.economiaAcoes?.acaoComplexa?.atual ?? instanciaAtual.economiaAcoes?.acaoComum?.atual).toBe(0);
    expect(tokenId).toBeTruthy();
  });

  it('Pisotear usa 2d12 contra um único alvo', async () => {
    const tokenId = await invocarUma('cervo-circular', 210, 140);
    const cervo = modelo('cervo-circular');
    const instancia = instanciaAtiva(cervo.id);
    useMapStore.getState().updateEntity('e-dono', { x: -7000, y: -7000 });
    useMapStore.getState().updateEntity('e-aliado', { x: 7000, y: 7000 });

    const unico = await comandarAtaque(ID_DONO, cervo.id, 'pisotear', { tipo: 'area' }, {
      instanciaId: instancia.id, requestId: 'cervo-pisotear-unico',
    });

    expect(unico).toMatchObject({ ok: true, resultados: [expect.objectContaining({ alvoId: ID_INIMIGO, testePendente: true })] });
    expect(useTestRequestStore.getState().requests).toEqual(expect.arrayContaining([
      expect.objectContaining({ charId: ID_INIMIGO, testName: 'Fortitude', invocationResolution: expect.objectContaining({ damageFormula: '2d12', damageType: 'DI' }) }),
    ]));
    expect(tokenId).toBeTruthy();
  });

  it('Pisotear mantém 1d10 por alvo quando a área alcança duas ou mais criaturas', async () => {
    const tokenId = await invocarUma('cervo-circular', 210, 140);
    const cervo = modelo('cervo-circular');
    const instancia = instanciaAtiva(cervo.id);
    useMapStore.getState().updateEntity('e-dono', { x: -7000, y: -7000 });
    useMapStore.getState().updateEntity('e-aliado', { x: 7000, y: 7000 });
    useCharacterStore.setState(state => ({
      characters: [...state.characters, ficha('inimigo-2', { category: 'INIMIGO', profileId: 'perfil-inimigo-2', hpCurrent: 50, hpMax: 50, ca: 1 })],
    }));
    useMapStore.getState().addEntity({
      id: 'token-inimigo-2', shape: 'ELLIPSE', x: 350, y: 140, w: 70, h: 70, rotation: 0,
      color: '#aa4444', label: 'Maldição 2', locked: false, layer: 'tokens', characterId: 'inimigo-2', avatarProfileId: 'perfil-inimigo-2',
    });

    const resultado = await comandarAtaque(ID_DONO, cervo.id, 'pisotear', { tipo: 'area' }, {
      instanciaId: instancia.id, requestId: 'cervo-pisotear-varios',
    });

    expect(resultado).toMatchObject({ ok: true, resultados: [
      expect.objectContaining({ alvoId: ID_INIMIGO, testePendente: true }),
      expect.objectContaining({ alvoId: 'inimigo-2', testePendente: true }),
    ] });
    expect(useTestRequestStore.getState().requests.filter(request => request.note?.includes('Pisotear'))).toEqual(expect.arrayContaining([
      expect.objectContaining({ charId: ID_INIMIGO, invocationResolution: expect.objectContaining({ damageFormula: '1d10' }) }),
      expect.objectContaining({ charId: 'inimigo-2', invocationResolution: expect.objectContaining({ damageFormula: '1d10' }) }),
    ]));
    expect(tokenId).toBeTruthy();
  });

  it.each([
    ['sofrendo', 2, 'movimento'],
    ['amedrontado', 4, 'movimento'],
    ['aterrorizado', 6, 'acao_complexa'],
    ['atordoado', 8, 'acao_complexa'],
  ] as const)('Toque da Vida remove %s, cobra %s PE e consome %s', async (conditionId, custo, categoria) => {
    const tokenCervo = await invocarUma('cervo-circular', 210, 140);
    const cervo = modelo('cervo-circular');
    const instancia = instanciaAtiva(cervo.id);
    const conditionInstanceId = `condicao-${conditionId}`;
    useCharacterStore.getState().addCondition(ID_ALIADO, {
      id: conditionInstanceId,
      conditionId,
      name: conditionId,
      icon: '✨',
      remainingTurns: -1,
      remainingRounds: -1,
    });
    const peAntes = pegarFicha(ID_DONO).peCurrent;
    const movimentoAntes = instancia.economiaAcoes?.acaoMovimento?.atual ?? 0;
    const complexaAntes = instancia.economiaAcoes?.acaoComplexa?.atual ?? instancia.economiaAcoes?.acaoComum?.atual ?? 0;

    const resultado = comandarToqueDaVidaCervo(ID_DONO, cervo.id, ID_ALIADO, conditionInstanceId, {
      instanciaId: useMapStore.getState().entities[tokenCervo]?.invocationInstanceId,
      requestId: `cervo-toque-${conditionId}`,
    });

    expect(resultado).toMatchObject({ ok: true, custoPE: custo, categoriaAcao: categoria });
    expect(pegarFicha(ID_DONO).activeConditions?.some(condition => condition.id === conditionInstanceId)).toBe(false);
    expect(pegarFicha(ID_DONO).peCurrent).toBe(peAntes - custo);
    const instanciaAtual = instanciaAtiva(cervo.id);
    if (categoria === 'movimento') {
      expect(instanciaAtual.economiaAcoes?.acaoMovimento?.atual).toBe(movimentoAntes - 1);
      expect(instanciaAtual.economiaAcoes?.acaoComplexa?.atual ?? instanciaAtual.economiaAcoes?.acaoComum?.atual).toBe(complexaAntes);
    } else {
      expect(instanciaAtual.economiaAcoes?.acaoComplexa?.atual ?? instanciaAtual.economiaAcoes?.acaoComum?.atual).toBe(complexaAntes - 1);
      expect(instanciaAtual.economiaAcoes?.acaoMovimento?.atual).toBe(movimentoAntes);
    }
  });

  it('Toque da Vida recusa alvo fora de alcance sem gastar ação ou PE', async () => {
    const tokenCervo = await invocarUma('cervo-circular', 210, 140);
    const cervo = modelo('cervo-circular');
    const instancia = instanciaAtiva(cervo.id);
    const conditionInstanceId = 'condicao-longe';
    useCharacterStore.getState().addCondition(ID_ALIADO, {
      id: conditionInstanceId, conditionId: 'abalado', name: 'Abalado', icon: '😰', remainingTurns: -1, remainingRounds: -1,
    });
    const tokenAliado = Object.values(useMapStore.getState().entities).find(entity => entity.characterId === ID_ALIADO && !entity.invocationId);
    if (!tokenAliado) throw new Error('Combat test setup is missing the ally token.');
    useMapStore.getState().updateEntity(tokenAliado.id, { x: tokenAliado.x + 1000 });
    const peAntes = pegarFicha(ID_DONO).peCurrent;
    const movimentoAntes = instancia.economiaAcoes?.acaoMovimento?.atual;

    expect(comandarToqueDaVidaCervo(ID_DONO, cervo.id, ID_ALIADO, conditionInstanceId, {
      instanciaId: useMapStore.getState().entities[tokenCervo]?.invocationInstanceId,
      requestId: 'cervo-toque-fora-de-alcance',
    })).toMatchObject({ ok: false, motivo: 'O aliado precisa ter um token visível e adjacente ao Cervo.' });
    expect(pegarFicha(ID_DONO).peCurrent).toBe(peAntes);
    expect(instanciaAtiva(cervo.id).economiaAcoes?.acaoMovimento?.atual).toBe(movimentoAntes);
    expect(pegarFicha(ID_ALIADO).activeConditions?.some(condition => condition.id === conditionInstanceId)).toBe(true);
  });

  it('Aura da Quietude cura aliados e seus shikigamis uma vez por início de turno e só bônus contra condições mentais', async () => {
    const tokenCervo = await invocarUma('cervo-circular', 210, 140);
    const cervo = modelo('cervo-circular');
    expect(tokenCervo).toBeTruthy();
    useCharacterStore.getState().updateCharacter(ID_ALIADO, { hpCurrent: 10, hpMax: 30 });
    useCombatStore.setState({
      inCombat: true, combatId: 'cervo-aura-idempotencia', round: 1, currentTurnIndex: 0,
      initiativeOrder: [{ charId: ID_ALIADO, charName: 'Aliado', initiative: 12 }],
    } as never);

    expect(resolverAuraQuietudeInicioTurno(ID_ALIADO)).toBe(16);
    expect(pegarFicha(ID_ALIADO).hpCurrent).toBe(26);
    expect(resolverAuraQuietudeInicioTurno(ID_ALIADO)).toBe(0);
    expect(pegarFicha(ID_ALIADO).hpCurrent).toBe(26);
    expect(bonusAuraQuietudeNoTR(ID_ALIADO, ['amedrontado'])).toBe(3);
    expect(bonusAuraQuietudeNoTR(ID_ALIADO, ['atordoado'])).toBe(3);
    expect(bonusAuraQuietudeNoTR(ID_ALIADO, ['envenenado'])).toBe(0);

    const tokenAliado = Object.values(useMapStore.getState().entities).find(entity => entity.characterId === ID_ALIADO && !entity.invocationId);
    if (!tokenAliado) throw new Error('Combat test setup is missing the ally token.');
    useMapStore.getState().updateEntity(tokenAliado.id, { x: tokenAliado.x + 1000 });
    useCharacterStore.getState().updateCharacter(ID_ALIADO, { hpCurrent: 10 });
    useCombatStore.setState({ round: 2, currentTurnIndex: 0, initiativeOrder: [{ charId: ID_ALIADO, charName: 'Aliado', initiative: 12 }] } as never);
    expect(resolverAuraQuietudeInicioTurno(ID_ALIADO)).toBe(0);
    expect(pegarFicha(ID_ALIADO).hpCurrent).toBe(10);
    expect(modelo('cervo-circular').id).toBe(cervo.id);
  });

  it('Aura da Quietude encontra uma peça aliada próxima mesmo quando outra peça da mesma ficha está longe', async () => {
    await invocarUma('cervo-circular', 210, 140);
    const tokenAliado = Object.values(useMapStore.getState().entities).find(entity => entity.characterId === ID_ALIADO && !entity.invocationId);
    if (!tokenAliado) throw new Error('Combat test setup is missing the ally token.');
    useMapStore.getState().updateEntity(tokenAliado.id, { x: tokenAliado.x + 1000 });
    useMapStore.setState(state => ({
      entities: {
        ...state.entities,
        'e-aliado-token-secundario': { ...tokenAliado, id: 'e-aliado-token-secundario', x: 210, y: 140 },
      },
    }));
    useCharacterStore.getState().updateCharacter(ID_ALIADO, { hpCurrent: 5 });
    useCombatStore.setState({
      inCombat: true, combatId: 'cervo-aura-token-secundario', round: 1, currentTurnIndex: 0,
      initiativeOrder: [{ charId: ID_ALIADO, charName: 'Aliado', initiative: 12 }],
    } as never);

    expect(resolverAuraQuietudeInicioTurno(ID_ALIADO)).toBe(16);
    expect(pegarFicha(ID_ALIADO).hpCurrent).toBe(21);
  });

  it('Aura da Quietude é chamada automaticamente quando o turno passa ao aliado', async () => {
    await invocarUma('cervo-circular', 210, 140);
    useCharacterStore.getState().updateCharacter(ID_ALIADO, { hpCurrent: 5 });
    useCombatStore.setState({
      inCombat: true, combatId: 'cervo-aura-hook-turno', round: 1, currentTurnIndex: 0,
      initiativeOrder: [
        { charId: ID_DONO, charName: 'Dono', roll: 12, bonus: 0, total: 12 },
        { charId: ID_ALIADO, charName: 'Aliado', roll: 10, bonus: 0, total: 10 },
      ],
    } as never);

    useCombatStore.getState().nextTurn();
    await waitFor(() => expect(pegarFicha(ID_ALIADO).hpCurrent).toBe(21));
  });

  it('Neutralização dissipa técnicas ativas, solicita TR e suprime a técnica até o próximo turno', async () => {
    const tokenCervo = await invocarUma('cervo-circular', 210, 140);
    const cervo = modelo('cervo-circular');
    const instancia = instanciaAtiva(cervo.id);
    useCharacterStore.setState(state => ({
      characters: state.characters.map(character => character.id === ID_DONO
        ? { ...character, characterClass: 'Feiticeiro' }
        : character.id === ID_INIMIGO
          ? {
            ...character,
            characterClass: 'Feiticeiro',
            activeBuffs: [
              { id: 'buff-tecnica-inimiga', spellName: 'Construto de Energia', type: 'ca', value: 2, remainingTurns: -1, sourceKind: 'tecnica_inata' },
              { id: 'buff-feitico-comum', spellName: 'Feitiço Comum', type: 'ca', value: 1, remainingTurns: -1, sourceKind: 'feitico' },
            ],
            omniFlags: { dominio_simples_durabilidade: 2, dominio_simples_raio_m: 3, dominio_simples_imune_acerto_garantido: 1 },
          }
          : character),
    }));
    useCharacterStore.getState().addCondition(ID_INIMIGO, {
      id: 'condicao-tecnica-inimiga', conditionId: 'confuso', name: 'Confuso', icon: '🌀',
      remainingTurns: -1, remainingRounds: -1, sourceCharId: ID_INIMIGO, sourceEntityId: 'tecnica-inimiga',
      sourceInstanceId: 'tecnica-inimiga-instancia', sourceKind: 'tecnica_inata',
    });
    const tecnicaOmni = novaEntidade('feitico', 'Construto de Energia');
    const tecnicaRemota = novaEntidade('feitico', 'Barreira Remota');
    useOmniEntidadesStore.setState({ entidades: { [tecnicaOmni.id]: tecnicaOmni, [tecnicaRemota.id]: tecnicaRemota } });
    useOmniRuntimeStore.setState({ efeitos: {
      'efeito-tecnica-condicao': {
        id: 'efeito-tecnica-condicao', entidadeId: tecnicaOmni.id, nomeSnapshot: tecnicaOmni.nome,
        sourceCharId: ID_INIMIGO, targetCharId: ID_INIMIGO, iniciadoEm: 0, expiraEm: null,
        meta: { conditionInstanceId: 'condicao-tecnica-inimiga' },
      },
      'efeito-remoto-fora-area': {
        id: 'efeito-remoto-fora-area', entidadeId: tecnicaRemota.id, nomeSnapshot: tecnicaRemota.nome,
        sourceCharId: ID_DONO, targetCharId: ID_ALIADO, iniciadoEm: 0, expiraEm: null,
      },
    } } as never);
    const tokenAliado = Object.values(useMapStore.getState().entities).find(entity => entity.characterId === ID_ALIADO && !entity.invocationId);
    if (!tokenAliado) throw new Error('Combat test setup is missing the ally token.');
    useMapStore.getState().updateEntity(tokenAliado.id, { x: tokenAliado.x + 1000 });

    const resultado = comandarNeutralizacaoCervo(ID_DONO, cervo.id, {
      instanciaId: useMapStore.getState().entities[tokenCervo]?.invocationInstanceId,
      requestId: 'cervo-neutralizacao-real',
    });

    expect(resultado).toMatchObject({ ok: true, dissipadas: 3, testes: 2 });
    expect(pegarFicha(ID_INIMIGO).activeBuffs).toEqual([
      expect.objectContaining({ id: 'buff-feitico-comum', sourceKind: 'feitico' }),
    ]);
    expect(pegarFicha(ID_INIMIGO).activeConditions?.some(condition => condition.id === 'condicao-tecnica-inimiga')).toBe(false);
    expect(pegarFicha(ID_INIMIGO).omniFlags).toMatchObject({ dominio_simples_durabilidade: 0, dominio_simples_raio_m: 0 });
    expect(useOmniRuntimeStore.getState().efeitos['efeito-tecnica-condicao']).toBeUndefined();
    expect(useOmniRuntimeStore.getState().efeitos['efeito-remoto-fora-area']).toBeDefined();
    const pedidoDono = useTestRequestStore.getState().requests.find(request => request.charId === ID_DONO && request.cervoNeutralizationResolution);
    expect(pedidoDono).toBeDefined();
    if (!pedidoDono) throw new Error('Neutralization did not create the owner saving throw request.');
    useTestRequestStore.getState().setResult(pedidoDono.id, { d20: 1, bonus: 50, total: 99, rolledAt: Date.now() });
    const pedidoResolvido = useTestRequestStore.getState().requests.find(request => request.id === pedidoDono.id)!;
    expect(resolverNeutralizacaoCervo(pedidoResolvido)).toBe(true);
    expect(pegarFicha(ID_DONO).activeConditions?.some(condition => condition.conditionId === 'tecnica-inata-suprimida' &&
      condition.expiraNoInicioDoTurnoDe === ID_DONO)).toBe(true);
    expect(resolverNeutralizacaoCervo(pedidoResolvido)).toBe(false);
    expect(expirarSupressaoTecnicaInicioTurno(ID_DONO)).toBe(1);
    expect(pegarFicha(ID_DONO).activeConditions?.some(condition => condition.conditionId === 'tecnica-inata-suprimida')).toBe(false);
  });
});
