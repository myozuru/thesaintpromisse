// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ficha, montarMesa, comoTela } from './helpers/mesaReal';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useDice3DStore } from '@/stores/useDice3DStore';
import { useMapStore } from '@/stores/useMapStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useShikigamiHudStore } from '@/stores/useShikigamiHudStore';
import { useTestRequestStore } from '@/stores/useTestRequestStore';
import { novaInstanciaInvocacao } from '@/lib/controlador/estadoInvocacao';
import type { InvocacaoControlador } from '@/lib/controlador/tipos';
import { ShikigamiOwnerPanel } from '@/components/mapa/ui/ShikigamiOwnerPanel';
import { consumeAdvantageFor } from '@/lib/omni/rollAdvantage';

const modelo: InvocacaoControlador = {
  id: 'shiki-1',
  nome: 'Komainu',
  donoCharacterId: 'dono',
  tipo: 'shikigami',
  hpAtual: 12,
  hpMaximo: 12,
  defesa: 14,
  deslocamentoM: 9,
  porte: 'Médio',
  custoInvocacaoPE: 3,
  alcanceInvocacaoM: 6,
  acoes: [
    { id: 'mordida', nome: 'Mordida', tipo: 'ataque', alcanceM: 3 },
    {
      id: 'instinto-cacador', nome: 'Instinto Caçador', tipo: 'habilidade', tipoExecucao: 'manual',
      categoriaAcao: 'acao_simples', statusAutomacao: 'executavel',
      efeitoEspecial: { tipo: 'vantagem_pericia_controlador', pericia: 'Percepção', contexto: 'rastreamento' },
    },
  ],
  economiaAcoesConfigurada: { acaoMovimento: 1, acaoComplexa: 1, acaoBonus: 1 },
  recursosConfigurados: [{ id: 'energia', nome: 'Energia', valorInicial: 2, valorMaximo: 4 }],
};

beforeEach(() => {
  cleanup();
  useTestRequestStore.getState().clearAll();
  const instancia = novaInstanciaInvocacao({
    id: 'instancia-1',
    modeloId: modelo.id,
    donoCharacterId: 'dono',
    tokenId: 'token-1',
    hpAtual: 12,
    hpMaximoAtual: 12,
    economiaAcoes: { acaoMovimento: { atual: 1, maximo: 1 }, acaoComplexa: { atual: 1, maximo: 1 }, acaoBonus: { atual: 1, maximo: 1 } },
    recursosAtuais: { energia: 2 },
  });
  montarMesa([ficha('dono', {
    profileId: 'perfil-dono',
    invocacoesConhecidas: [modelo],
    instanciasInvocacao: [instancia],
  })], { dono: [2, 2] });
  useCombatStore.setState({
    inCombat: true,
    round: 1,
    currentTurnIndex: 0,
    initiativeOrder: [{ charId: 'dono', charName: 'Dono', roll: 10, bonus: 0, total: 10 }],
  } as never);
  comoTela({ profileId: 'perfil-dono', role: 'PLAYER' });
  useMapStore.getState().addEntity({
    id: 'token-1', shape: 'ELLIPSE', x: 100, y: 100, w: 70, h: 70, rotation: 0,
    color: '#8055bd', label: 'Komainu', locked: false, layer: 'tokens', hp: 12, hpMax: 12,
    ownerCharId: 'dono', ownerProfileId: 'perfil-dono', invocationId: modelo.id,
    invocationInstanceId: instancia.id, invocationState: 'ativa', invocationDefense: 14, invocationMovementM: 9,
  });
  useShikigamiHudStore.getState().setSourceTokenId('token-1');
});

describe('painel do dono do Shikigami', () => {
  it('mostra saldos próprios e seleciona alcance de ação sem executá-la', () => {
    render(<ShikigamiOwnerPanel tokenId="token-1" />);

    expect(screen.getByTestId('shikigami-owner-panel')).toBeTruthy();
    const panel = screen.getByTestId('shikigami-owner-panel');
    expect(panel.textContent).toContain('Movimento 1/1');
    expect(panel.textContent).toContain('Energia 2/4');
    fireEvent.click(screen.getByRole('button', { name: 'Mordida · 3 m' }));
    expect(useShikigamiHudStore.getState().rangeMode).toEqual({ kind: 'action', actionId: 'mordida' });
  });

  it('alterna o modo de movimento e carrega/solta uma criatura pela HUD do Nue', async () => {
    const owner = useCharacterStore.getState().characters.find(character => character.id === 'dono');
    const instance = owner?.instanciasInvocacao?.[0];
    if (!owner || !instance) throw new Error('Ficha de teste sem instância.');
    const nue: InvocacaoControlador = {
      ...modelo,
      id: 'nue-hud',
      nome: 'Nue',
      subcategoria: 'dez-sombras:nue',
      deslocamentoM: 12,
      porte: 'Grande',
    };
    useCharacterStore.getState().updateCharacter('dono', {
      invocacoesConhecidas: [nue],
      instanciasInvocacao: [{ ...instance, modeloId: nue.id }],
    });
    useMapStore.getState().updateEntity('token-1', {
      invocationId: nue.id,
      invocationInstanceId: instance.id,
      invocationMovementM: 12,
      invocationEffectiveSize: 'Grande',
      invocationState: 'ativa',
    });
    useMapStore.getState().addEntity({
      id: 'passageiro-nue', shape: 'ELLIPSE', x: 240, y: 100, w: 35, h: 35, rotation: 0,
      color: '#558866', label: 'Passageiro', locked: false, layer: 'tokens', invocationEffectiveSize: 'Pequeno',
    });
    useShikigamiHudStore.setState({ selectedTargetId: 'passageiro-nue' });

    render(<ShikigamiOwnerPanel tokenId="token-1" />);

    expect(screen.getByTestId('nue-flight-controls').textContent).toContain('Voo · 12 m');
    fireEvent.click(screen.getByRole('button', { name: 'Caminhada · 4,5 m' }));
    expect(useMapStore.getState().entities['token-1']?.invocationMovementMode).toBe('caminhada');
    expect(screen.getByRole('button', { name: 'Caminhada · 4,5 m' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Carregar Passageiro' }));
    await waitFor(() => expect(useMapStore.getState().entities['passageiro-nue']?.carriedBy).toBe('token-1'));
    expect(screen.getByTestId('nue-flight-controls').textContent).toContain('penalidade de voo −1.5 m');

    fireEvent.click(screen.getByRole('button', { name: 'Soltar Passageiro' }));
    await waitFor(() => expect(useMapStore.getState().entities['passageiro-nue']?.carriedBy).toBeUndefined());
    expect(screen.getByRole('status').textContent).toContain('solto');
  });

  it('mostra a Matilha dos Cães Divinos e executa Instinto Caçador pela HUD', async () => {
    const owner = useCharacterStore.getState().characters.find(character => character.id === 'dono');
    const instance = owner?.instanciasInvocacao?.[0];
    if (!owner || !instance) throw new Error('Ficha de teste sem instância.');
    const cao: InvocacaoControlador = {
      ...modelo,
      id: 'cao-branco-hud',
      nome: 'Cão Divino Branco',
      subcategoria: 'dez-sombras:cao-branco',
    };
    useCharacterStore.getState().updateCharacter('dono', {
      invocacoesConhecidas: [cao],
      instanciasInvocacao: [{ ...instance, modeloId: cao.id }],
    });
    useMapStore.getState().updateEntity('token-1', {
      invocationId: cao.id,
      invocationInstanceId: instance.id,
      invocationState: 'ativa',
    });

    render(<ShikigamiOwnerPanel tokenId="token-1" />);

    expect(screen.getByText(/Matilha das Sombras:/).textContent).toContain('Flanqueado');
    fireEvent.click(screen.getByRole('button', { name: /Instinto Caçador/ }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Vantagem'));
    expect(consumeAdvantageFor('dono', { kind: 'skill', name: 'Percepção' }).net).toBe('advantage');
  });

  it('ativa Inércia Imparável pela HUD sem exigir alvo e atualiza o estado da rodada', async () => {
    const touro: InvocacaoControlador = {
      ...modelo,
      id: 'touro-hud',
      nome: 'Touro Perfurante',
      subcategoria: 'dez-sombras:touro-perfurante',
      deslocamentoM: 15,
      porte: 'Grande',
      acoes: [
        { id: 'ruptura', nome: 'Ruptura', tipo: 'habilidade', statusAutomacao: 'manual' },
        {
          id: 'inercia-imparavel', nome: 'Inércia Imparável', tipo: 'habilidade',
          categoriaAcao: 'acao_simples', statusAutomacao: 'executavel', somenteProprio: true,
        },
      ],
      economiaAcoesConfigurada: { acaoSimples: 1 },
    };
    const instancia = novaInstanciaInvocacao({
      id: 'instancia-touro', modeloId: touro.id, donoCharacterId: 'dono', tokenId: 'token-1',
      hpAtual: 96, hpMaximoAtual: 96,
      economiaAcoes: { acaoSimples: { atual: 1, maximo: 1 } },
    });
    useCharacterStore.getState().updateCharacter('dono', {
      invocacoesConhecidas: [touro],
      instanciasInvocacao: [instancia],
    });
    useMapStore.getState().updateEntity('token-1', {
      invocationId: touro.id, invocationInstanceId: instancia.id,
      invocationEffectiveSize: 'Grande', invocationMovementM: 15,
    });
    useCombatStore.setState({ inCombat: true, combatId: 'touro-hud-combate', round: 1 } as never);

    render(<ShikigamiOwnerPanel tokenId="token-1" />);

    expect(screen.getByTestId('touro-inercia-status').textContent).toContain('deslocamento atual 15 m');
    expect(screen.getByTestId('touro-ruptura-note').textContent).toContain('dano dobrado');
    expect(screen.getByTestId('touro-ruptura-note').textContent).toContain('permanece manual');
    const botao = screen.getByRole('button', { name: 'Executar Inércia Imparável' }) as HTMLButtonElement;
    expect(botao.disabled).toBe(false);
    fireEvent.click(botao);

    await waitFor(() => expect(screen.queryByRole('status') || screen.queryByRole('alert')).toBeTruthy());
    const feedback = screen.queryByRole('status')?.textContent ?? screen.queryByRole('alert')?.textContent ?? '';
    expect(feedback).toContain('deslocamento de 30 m');
    expect(screen.getByTestId('touro-inercia-status').textContent).toContain('deslocamento 30 m');
    expect((screen.getByRole('button', { name: 'Executar Inércia Imparável' }) as HTMLButtonElement).disabled).toBe(true);
    expect(useCharacterStore.getState().characters.find(character => character.id === 'dono')?.instanciasInvocacao?.[0])
      .toMatchObject({ economiaAcoes: { acaoSimples: { atual: 0, maximo: 1 } }, inerciaImparavelTouro: { rodada: 1 } });
  });

  it('mostra Reflexos Felinos e ativa Predador Ápice pela HUD', async () => {
    const tigre: InvocacaoControlador = {
      ...modelo,
      id: 'tigre-hud',
      nome: 'Tigre Fúnebre',
      subcategoria: 'dez-sombras:tigre-funebre',
      acoes: [
        { id: 'retalhar', nome: 'Retalhar', tipo: 'ataque', tipoAtaque: 'corpo_a_corpo', alcanceM: 3, dano: '2d12+1d12', statusAutomacao: 'executavel' },
        { id: 'predador-apice', nome: 'Predador Ápice', tipo: 'habilidade', categoriaAcao: 'acao_simples', statusAutomacao: 'executavel', somenteProprio: true },
      ],
      economiaAcoesConfigurada: { acaoSimples: 1, acaoComplexa: 1, reacao: 2 },
    };
    const instancia = novaInstanciaInvocacao({
      id: 'instancia-tigre', modeloId: tigre.id, donoCharacterId: 'dono', tokenId: 'token-1',
      hpAtual: 140, hpMaximoAtual: 140,
      economiaAcoes: {
        acaoSimples: { atual: 1, maximo: 1 },
        acaoComplexa: { atual: 1, maximo: 1 },
        reacao: { atual: 2, maximo: 2 },
      },
    });
    useCharacterStore.getState().updateCharacter('dono', {
      invocacoesConhecidas: [tigre],
      instanciasInvocacao: [instancia],
    });
    useMapStore.getState().updateEntity('token-1', {
      invocationId: tigre.id, invocationInstanceId: instancia.id,
      invocationState: 'ativa', invocationDefense: 12,
    });
    useCombatStore.setState({
      inCombat: true,
      combatId: 'tigre-hud-combate',
      round: 1,
      currentTurnIndex: 0,
      initiativeOrder: [{ charId: 'dono', charName: 'Dono', roll: 10, bonus: 0, total: 10 }],
    } as never);

    render(<ShikigamiOwnerPanel tokenId="token-1" />);

    expect(screen.getByTestId('tigre-funebre-status').textContent).toContain('Reflexos Felinos');
    expect(screen.getByTestId('tigre-funebre-status').textContent).toContain('Reações 2/2');
    expect(screen.getByTestId('tigre-funebre-status').textContent).toContain('Garras de Extermínio: nenhum alvo marcado.');
    const botao = screen.getByRole('button', { name: 'Executar Predador Ápice' }) as HTMLButtonElement;
    expect(botao.disabled).toBe(false);
    fireEvent.click(botao);

    await waitFor(() => expect(screen.getByTestId('tigre-funebre-status').textContent).toContain('preparado para a rodada 2'));
    expect(useCharacterStore.getState().characters.find(character => character.id === 'dono')?.instanciasInvocacao?.[0])
      .toMatchObject({ economiaAcoes: { acaoSimples: { atual: 0, maximo: 1 } }, estadoTigreFunebre: { predadorApice: { rodadaAlvo: 2 } } });
  });

  it('lista na HUD personagens que ainda recebem Sangramento Forte deste Tigre', () => {
    const tigre: InvocacaoControlador = {
      ...modelo,
      id: 'tigre-hud-sangramento',
      nome: 'Tigre Fúnebre',
      subcategoria: 'dez-sombras:tigre-funebre',
      acoes: [{ id: 'retalhar', nome: 'Retalhar', tipo: 'ataque', tipoAtaque: 'corpo_a_corpo', alcanceM: 3, dano: '2d12+1d12', statusAutomacao: 'executavel' }],
    };
    const instancia = novaInstanciaInvocacao({
      id: 'instancia-tigre-sangramento', modeloId: tigre.id, donoCharacterId: 'dono', tokenId: 'token-1',
      hpAtual: 140, hpMaximoAtual: 140,
    });
    useCharacterStore.getState().updateCharacter('dono', {
      invocacoesConhecidas: [tigre],
      instanciasInvocacao: [instancia],
    });
    useMapStore.getState().updateEntity('token-1', {
      invocationId: tigre.id, invocationInstanceId: instancia.id, invocationState: 'ativa',
    });
    useCharacterStore.setState(state => ({
      characters: [...state.characters, ficha('alvo-sangrando', {
        name: 'Maldição Ferida',
        activeConditions: [{
          id: 'tigre-sangramento:hud', conditionId: 'sangramento', name: 'Sangramento Forte', icon: '🩸',
          remainingTurns: -1, remainingRounds: -1, durationMode: 'ate_passar_tr', endTrType: 'Fortitude',
          sourceCharId: 'dono', sourceEntityId: 'tigre-funebre', sourceInstanceId: instancia.id,
          tickDamageFormula: '4d10', endTrTiming: 'turn_end',
        } as never],
      })],
    }));

    render(<ShikigamiOwnerPanel tokenId="token-1" />);

    expect(screen.getByTestId('tigre-sangramento-alvos').textContent).toContain('Maldição Ferida');
    expect(screen.getByTestId('tigre-sangramento-alvos').textContent).toContain('4d10 no início do turno');
    expect(screen.getByTestId('tigre-sangramento-alvos').textContent).toContain('Fortitude no fim pode encerrar');
  });

  it('exibe as ações do Cervo e executa Toque da Vida pela HUD sobre condição selecionada', async () => {
    const cervo: InvocacaoControlador = {
      ...modelo,
      id: 'cervo-hud', nome: 'Cervo Circular', subcategoria: 'dez-sombras:cervo-circular',
      versaoModelo: 1, versaoAprovada: 1, aprovacaoMestre: 'aprovada',
      atributos: { forca: 16, destreza: 10, constituicao: 14, inteligencia: 6, sabedoria: 16, presenca: 6 },
      acoes: [
        { id: 'toque-da-vida', nome: 'Toque da Vida', tipo: 'habilidade', categoriaAcao: 'movimento', statusAutomacao: 'executavel', efeitoEspecial: { tipo: 'toque_da_vida_cervo' } },
        { id: 'neutralizacao', nome: 'Neutralização', tipo: 'habilidade', categoriaAcao: 'acao_simples', statusAutomacao: 'executavel', area: { forma: 'raio_em_si', tamanho_m: 4.5 }, efeitoEspecial: { tipo: 'neutralizacao_cervo' } },
      ],
    };
    const owner = useCharacterStore.getState().characters.find(character => character.id === 'dono');
    const instance = owner?.instanciasInvocacao?.[0];
    if (!owner || !instance) throw new Error('Ficha de teste sem instância.');
    useCharacterStore.getState().updateCharacter('dono', {
      invocacoesConhecidas: [cervo],
      instanciasInvocacao: [{ ...instance, modeloId: cervo.id }],
    });
    useMapStore.getState().updateEntity('token-1', { invocationId: cervo.id, label: 'Cervo Circular' });
    useCharacterStore.setState(state => ({
      characters: [...state.characters, ficha('cervo-aliado', { profileId: 'perfil-cervo-aliado' })],
    }));
    useCharacterStore.getState().addCondition('cervo-aliado', {
      id: 'condicao-cervo-hud', conditionId: 'sofrendo', name: 'Sofrendo', icon: '😖', remainingTurns: -1, remainingRounds: -1,
    });
    useMapStore.getState().addEntity({
      id: 'token-cervo-aliado', shape: 'ELLIPSE', x: 170, y: 100, w: 70, h: 70, rotation: 0,
      color: '#558866', label: 'Aliado', locked: false, layer: 'tokens', characterId: 'cervo-aliado', avatarProfileId: 'perfil-cervo-aliado',
    });
    useShikigamiHudStore.getState().startTargetSelection();
    useShikigamiHudStore.getState().acceptTarget('token-cervo-aliado');

    render(<ShikigamiOwnerPanel tokenId="token-1" />);
    expect(screen.getByRole('button', { name: /Executar Neutralização/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Executar Toque da Vida/ })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Condição para remover com Toque da Vida' }).textContent).toContain('2 PE');
    fireEvent.click(screen.getByRole('button', { name: /Executar Toque da Vida/ }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Sofrendo removida'));
    expect(useCharacterStore.getState().characters.find(character => character.id === 'cervo-aliado')?.activeConditions).toEqual([]);
  });

  it('abre a seleção da linha da Torrente pela HUD sem exigir alvo manual', async () => {
    const torrente: InvocacaoControlador['acoes'][number] = {
      id: 'torrente-agua', nome: 'Torrente de Água', tipo: 'ataque', tipoExecucao: 'manual',
      teste: 'resistencia', categoriaAcao: 'acao_complexa', resistenciaAlvo: 'Fortitude',
      atributoCD: 'constituicao', multiplicadorDanoAtributo: 0, dano: '1d8', tipoDano: 'DI',
      tipo_alvo: 'area', filtro_alvo: 'todos', area: { forma: 'linha', tamanho_m: 6 },
      statusAutomacao: 'executavel',
    };
    const elefante: InvocacaoControlador = {
      ...modelo, id: 'elefante-hud', nome: 'Elefante Máximo', subcategoria: 'dez-sombras:elefante-maximo',
      porte: 'Grande',
      atributos: { forca: 15, destreza: 10, constituicao: 20, inteligencia: 6, sabedoria: 6, presenca: 6 },
      acoes: [torrente],
    };
    const owner = useCharacterStore.getState().characters.find(character => character.id === 'dono');
    const instancia = owner?.instanciasInvocacao?.[0];
    if (!owner || !instancia) throw new Error('Ficha de teste sem instância.');
    useCharacterStore.getState().updateCharacter('dono', {
      invocacoesConhecidas: [elefante],
      instanciasInvocacao: [{ ...instancia, modeloId: elefante.id }],
    });
    useMapStore.getState().updateEntity('token-1', { invocationId: elefante.id });
    useCharacterStore.setState(state => ({
      characters: [...state.characters, ficha('torrente-alvo', { category: 'INIMIGO', profileId: 'perfil-torrente-alvo' })],
    }));
    useMapStore.getState().addEntity({
      id: 'token-torrente-alvo', shape: 'ELLIPSE', x: 170, y: 100, w: 70, h: 70, rotation: 0,
      color: '#9f3b45', label: 'Alvo', locked: false, layer: 'tokens', characterId: 'torrente-alvo', avatarProfileId: 'perfil-torrente-alvo',
    });
    vi.spyOn(useMapStore.getState(), 'requestAoEPlacement').mockResolvedValue({
      id: 'torrente-area', kind: 'line', x: 135, y: 135, rotation: 0, length: 280, width: 70,
      color: '#ff5577', opacity: 1,
    });

    render(<ShikigamiOwnerPanel tokenId="token-1" />);
    const actionButton = screen.getByRole('button', { name: /Executar Torrente de Água/ });
    expect((actionButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(actionButton);

    await waitFor(() => expect(screen.queryByRole('status') || screen.queryByRole('alert')).toBeTruthy());
    const mensagem = screen.queryByRole('status')?.textContent ?? screen.queryByRole('alert')?.textContent ?? '';
    expect(mensagem).toContain('resistência enviado');
    expect(useTestRequestStore.getState().requests).toEqual(expect.arrayContaining([
      expect.objectContaining({ charId: 'torrente-alvo', kind: 'save', testName: 'Fortitude' }),
    ]));
  });

  it('exibe Massa Esmagadora e deixa somente o Mestre habilitar o bônus de Domínio', async () => {
    const massa: InvocacaoControlador['acoes'][number] = {
      id: 'massa-esmagadora', nome: 'Massa Esmagadora', tipo: 'habilidade', tipoExecucao: 'manual',
      categoriaAcao: 'acao_simples', statusAutomacao: 'executavel',
    };
    const elefante: InvocacaoControlador = {
      ...modelo, id: 'elefante-massa-hud', nome: 'Elefante Máximo', subcategoria: 'dez-sombras:elefante-maximo',
      hpAtual: 90, hpMaximo: 90, porte: 'Grande',
      acoes: [massa],
    };
    const owner = useCharacterStore.getState().characters.find(character => character.id === 'dono');
    const instancia = owner?.instanciasInvocacao?.[0];
    if (!owner || !instancia) throw new Error('Ficha de teste sem instância.');
    useCharacterStore.getState().updateCharacter('dono', {
      invocacoesConhecidas: [elefante],
      instanciasInvocacao: [{ ...instancia, modeloId: elefante.id }],
    });
    useMapStore.getState().updateEntity('token-1', { invocationId: elefante.id, hp: 90, hpMax: 90, invocationEffectiveSize: 'Grande' });
    useCharacterStore.setState(state => ({
      characters: [...state.characters, ficha('massa-alvo', {
        category: 'INIMIGO', profileId: 'perfil-massa-alvo', level: 1, hpCurrent: 50, hpMax: 50,
      })],
    }));
    useMapStore.getState().addEntity({
      id: 'token-massa-alvo', shape: 'ELLIPSE', x: 100, y: 100, w: 70, h: 70, rotation: 0,
      color: '#9f3b45', label: 'Alvo', locked: false, layer: 'tokens', characterId: 'massa-alvo', avatarProfileId: 'perfil-massa-alvo',
    });
    useShikigamiHudStore.getState().startTargetSelection();
    useShikigamiHudStore.getState().acceptTarget('token-massa-alvo');
    vi.spyOn(useDice3DStore.getState(), 'requestNotation').mockResolvedValue([1, 1, 1, 1, 1, 1]);
    comoTela({ profileId: 'perfil-dono', role: 'MASTER' });

    render(<ShikigamiOwnerPanel tokenId="token-1" />);
    expect(screen.getByRole('checkbox', { name: /Expansão de Domínio ativa/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: /Expansão de Domínio ativa/ }));
    fireEvent.click(screen.getByRole('button', { name: /Executar Massa Esmagadora/ }));

    await waitFor(() => expect(screen.queryByRole('status') || screen.queryByRole('alert')).toBeTruthy());
    const feedback = screen.queryByRole('status')?.textContent ?? screen.queryByRole('alert')?.textContent ?? '';
    expect(feedback).toContain('6d12');
    expect(useCharacterStore.getState().characters.find(character => character.id === 'massa-alvo')?.activeConditions?.some(condition => condition.conditionId === 'caido')).toBe(true);
  });

  it('mostra porte e próxima rodada de crescimento da Horda dos Coelhos', () => {
    const fuga: InvocacaoControlador = {
      ...modelo,
      id: 'fuga-coelhos-hud',
      nome: 'Fuga dos Coelhos',
      subcategoria: 'dez-sombras:fuga-do-coelho',
      hpAtual: 56,
      hpMaximo: 56,
      acoes: [],
    };
    const owner = useCharacterStore.getState().characters.find(character => character.id === 'dono');
    const instance = owner?.instanciasInvocacao?.[0];
    if (!owner || !instance) throw new Error('Ficha de teste sem instância.');
    useCombatStore.setState({ combatId: 'fuga-hud-combat', round: 1 } as never);
    useCharacterStore.getState().updateCharacter('dono', {
      invocacoesConhecidas: [fuga],
      instanciasInvocacao: [{
        ...instance,
        modeloId: fuga.id,
        hpAtual: 67,
        hpMaximoAtual: 67,
        crescimentoFugaCoelhos: {
          combateId: 'fuga-hud-combat',
          rodadaInicio: 1,
          totalCrescimentos: 1,
        },
      }],
    });
    useMapStore.getState().updateEntity('token-1', {
      invocationId: fuga.id,
      hp: 67,
      hpMax: 67,
      invocationEffectiveSize: 'Grande',
      invocationEffectiveSizeCategory: 3,
    });

    render(<ShikigamiOwnerPanel tokenId="token-1" />);

    const status = screen.getByTestId('fuga-coelhos-horda-status');
    expect(status.textContent).toContain('Crescimentos: 1');
    expect(status.textContent).toContain('Porte atual: Grande');
    expect(status.textContent).toContain('início da rodada 4');
    expect(status.textContent).toContain('+11 PV atuais e máximos');
  });

  it('expõe a Dispersão na Horda e mostra o ataque próprio no token subordinado', () => {
    const fuga: InvocacaoControlador = {
      ...modelo,
      id: 'fuga-coelhos-dispersao-hud',
      nome: 'Fuga dos Coelhos',
      subcategoria: 'dez-sombras:fuga-do-coelho',
      hpAtual: 56,
      hpMaximo: 56,
      acoes: [{ id: 'dispersao-tatica', nome: 'Dispersão Tática', tipo: 'habilidade', tipoExecucao: 'manual',
        categoriaAcao: 'acao_bonus', statusAutomacao: 'parcial' }],
    };
    const owner = useCharacterStore.getState().characters.find(character => character.id === 'dono');
    const instance = owner?.instanciasInvocacao?.[0];
    if (!owner || !instance) throw new Error('Ficha de teste sem instância.');
    const horda = { ...instance, modeloId: fuga.id, hpAtual: 56, hpMaximoAtual: 56,
      economiaAcoes: { acaoMovimento: { atual: 1, maximo: 1 }, acaoComum: { atual: 1, maximo: 1 }, acaoBonus: { atual: 1, maximo: 1 } } };
    useCharacterStore.getState().updateCharacter('dono', { invocacoesConhecidas: [fuga], instanciasInvocacao: [horda] });
    useMapStore.getState().updateEntity('token-1', {
      invocationId: fuga.id, invocationInstanceId: horda.id, hp: 56, hpMax: 56,
      invocationEffectiveSize: 'Médio', invocationDefense: fuga.defesa,
    });

    const { unmount } = render(<ShikigamiOwnerPanel tokenId="token-1" />);
    expect(screen.getByTestId('fuga-coelhos-dispersao').textContent).toContain('Ação Bônus');
    expect(screen.getByRole('spinbutton', { name: 'Quantidade de coelhos' })).toBeTruthy();
    expect(screen.getByLabelText('PV máximos restantes')).toBeTruthy();
    unmount();

    useMapStore.getState().addEntity({
      id: 'coelho-hud', shape: 'ELLIPSE', x: 170, y: 100, w: 70, h: 70, rotation: 0,
      color: '#d7c6f2', label: 'Coelho disperso 1', locked: false, layer: 'tokens', hp: 1, hpMax: 1,
      ownerCharId: 'dono', ownerProfileId: 'perfil-dono', invocationId: fuga.id,
      invocationInstanceId: horda.id, invocationState: 'ativa', invocationDefense: fuga.defesa, invocationMovementM: 9,
      invocationSubordinate: { kind: 'fuga-coelho', parentTokenId: 'token-1', dispersionEventId: 'disp-hud', index: 0 },
    });
    useShikigamiHudStore.getState().setSourceTokenId('coelho-hud');
    render(<ShikigamiOwnerPanel tokenId="coelho-hud" />);
    expect(screen.getByTestId('fuga-coelho-disperso-action').textContent).toContain('dano é fixo em 1');
    expect(screen.queryByTestId('fuga-coelhos-dispersao')).toBeNull();
    expect(screen.getByRole('button', { name: 'Selecionar alvo' })).toBeTruthy();
  });

  it('inicia seleção de alvo ou medição no mapa', () => {
    const { container } = render(<ShikigamiOwnerPanel tokenId="token-1" />);
    const panelElement = container.querySelector<HTMLElement>('[data-testid="shikigami-owner-panel"]');
    if (!panelElement) throw new Error('Painel do Shikigami não foi renderizado.');
    const panel = within(panelElement);

    fireEvent.click(panel.getByRole('button', { name: /^Alvo$/ }));
    expect(useShikigamiHudStore.getState().interaction).toBe('target');
    fireEvent.click(panel.getByRole('button', { name: /^Medir$/ }));
    expect(useShikigamiHudStore.getState().interaction).toBe('measure');
  });

  it('executa habilidade da HUD, gasta a ação própria e concede vantagem de rastreamento', async () => {
    render(<ShikigamiOwnerPanel tokenId="token-1" />);

    fireEvent.click(screen.getByRole('button', { name: /Instinto Caçador/ }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Vantagem'));
    const instanciaAtual = useCharacterStore.getState().characters.find((character) => character.id === 'dono')?.instanciasInvocacao?.[0];
    expect(instanciaAtual?.economiaAcoes?.acaoBonus?.atual).toBe(0);
    expect(consumeAdvantageFor('dono', { kind: 'skill', name: 'Percepção' }).net).toBe('advantage');
  });

  it('mostra e resolve a opção de Agarrar do Gama a partir da HUD do mapa', async () => {
    const actionGama: InvocacaoControlador['acoes'][number] = {
      id: 'protusao-lingua', nome: 'Protusão de Língua', tipo: 'ataque', tipoExecucao: 'manual',
      categoriaAcao: 'acao_complexa', dano: '1d12+1d8', tipoDano: 'DI', alcanceM: 6,
      statusAutomacao: 'parcial',
      efeitoEspecial: { tipo: 'agarrar_gama_apos_acerto', custoPE: 4, categoriaAcao: 'acaoLivre' },
    };
    const modeloGama = {
      ...modelo,
      subcategoria: 'dez-sombras:sapo',
      atributoBasePericias: 'sabedoria' as const,
      atributos: { forca: 15, destreza: 10, constituicao: 16, inteligencia: 6, sabedoria: 6, presenca: 6 },
      acoes: [...modelo.acoes, actionGama],
    };
    const owner = useCharacterStore.getState().characters.find(character => character.id === 'dono');
    const instance = owner?.instanciasInvocacao?.[0];
    if (!owner || !instance) throw new Error('Ficha de teste sem instância.');
    const economiaAcoesAntes = instance.economiaAcoes;
    const combat = useCombatStore.getState();
    useCharacterStore.getState().updateCharacter('dono', {
      peCurrent: 10,
      invocacoesConhecidas: [modeloGama],
      instanciasInvocacao: [{
        ...instance,
        agarrarLinguaPendente: {
          eventoId: 'ataque-gama-1',
          alvoId: 'alvo-gama',
          ...(combat.combatId ? { combateId: combat.combatId } : {}),
          rodada: combat.round,
          turnoIndex: combat.currentTurnIndex,
        },
      }],
    });
    useCharacterStore.setState(state => ({
      characters: [...state.characters, ficha('alvo-gama', { category: 'INIMIGO', hpCurrent: 30, hpMax: 30 })],
    }));
    useMapStore.getState().addEntity({
      id: 'token-alvo-gama', shape: 'ELLIPSE', x: 170, y: 100, w: 70, h: 70, rotation: 0,
      color: '#9f3b45', label: 'Alvo', locked: false, layer: 'tokens', hp: 30, hpMax: 30,
      characterId: 'alvo-gama', avatarProfileId: 'perfil-alvo-gama',
    });
    const rolagens = [15, 10];
    vi.spyOn(useDice3DStore.getState(), 'requestRoll').mockImplementation(async tipos =>
      tipos.map(() => rolagens.shift() ?? 10),
    );

    render(<ShikigamiOwnerPanel tokenId="token-1" />);
    const followup = screen.getByTestId('gama-grapple-followup');
    expect(followup.textContent).toContain('Ação Livre');
    fireEvent.click(within(followup).getByRole('checkbox', { name: 'Gama está submerso' }));
    fireEvent.click(within(followup).getByRole('checkbox', { name: 'Gama está em Escuridão Total' }));
    fireEvent.click(within(followup).getByRole('button'));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Agarrado (+2 Anfíbio Sombrio)'));
    const atual = useCharacterStore.getState().characters.find(character => character.id === 'dono');
    expect(atual?.peCurrent).toBe(6);
    expect(atual?.instanciasInvocacao?.[0].economiaAcoes).toEqual(economiaAcoesAntes);
    expect(useCharacterStore.getState().characters.find(character => character.id === 'alvo-gama')?.activeConditions?.some(condition => condition.conditionId === 'agarrado')).toBe(true);
  });

  it('mostra e resolve a opção de Agarrar do Orochi na HUD, incluindo o bônus de Escuridão Total', async () => {
    const action: InvocacaoControlador['acoes'][number] = {
      id: 'bote-sombrio', nome: 'Bote Sombrio', tipo: 'ataque', tipoExecucao: 'manual',
      categoriaAcao: 'acao_complexa', dano: '1d12+1d8', tipoDano: 'DP', alcanceM: 1.5,
      statusAutomacao: 'executavel',
      efeitoEspecial: { tipo: 'agarrar_orochi_apos_acerto', custoPE: 4, categoriaAcao: 'acaoLivre' },
    };
    const modeloOrochi: InvocacaoControlador = {
      ...modelo,
      id: 'orochi-hud', nome: 'Orochi', subcategoria: 'dez-sombras:grande-serpente',
      atributoBasePericias: 'sabedoria', porte: 'Grande',
      atributos: { forca: 14, destreza: 14, constituicao: 12, inteligencia: 6, sabedoria: 8, presenca: 6 },
      acoes: [action],
    };
    const owner = useCharacterStore.getState().characters.find(character => character.id === 'dono');
    const instance = owner?.instanciasInvocacao?.[0];
    if (!owner || !instance) throw new Error('Ficha de teste sem instância.');
    useCombatStore.setState({ combatId: 'orochi-hud-combat' });
    useCharacterStore.getState().updateCharacter('dono', {
      peCurrent: 10,
      invocacoesConhecidas: [modeloOrochi],
      instanciasInvocacao: [{
        ...instance,
        modeloId: modeloOrochi.id,
        agarrarOrochiPendente: {
          eventoId: 'orochi-hud-hit',
          alvoId: 'alvo-orochi',
          combateId: 'orochi-hud-combat',
          rodada: 1,
          turnoIndex: 0,
        },
      }],
    });
    useMapStore.getState().updateEntity('token-1', { invocationId: modeloOrochi.id, invocationEffectiveSize: 'Grande' });
    useCharacterStore.setState(state => ({
      characters: [...state.characters, ficha('alvo-orochi', { category: 'INIMIGO', hpCurrent: 30, hpMax: 30 })],
    }));
    useMapStore.getState().addEntity({
      id: 'token-alvo-orochi', shape: 'ELLIPSE', x: 170, y: 100, w: 70, h: 70, rotation: 0,
      color: '#9f3b45', label: 'Alvo', locked: false, layer: 'tokens', hp: 30, hpMax: 30,
      characterId: 'alvo-orochi', avatarProfileId: 'perfil-alvo-orochi',
    });
    const rolagens = [20, 1];
    vi.spyOn(useDice3DStore.getState(), 'requestRoll').mockImplementation(async tipos =>
      tipos.map(() => rolagens.shift() ?? 10),
    );

    render(<ShikigamiOwnerPanel tokenId="token-1" />);
    const followup = screen.getByTestId('orochi-grapple-followup');
    fireEvent.click(within(followup).getByRole('checkbox', { name: /Escuridão Total/ }));
    fireEvent.click(within(followup).getByRole('button'));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Agarrado (+2 em Escuridão Total)'));
    expect(useCharacterStore.getState().characters.find(character => character.id === 'dono')?.peCurrent).toBe(6);
    expect(useCharacterStore.getState().characters.find(character => character.id === 'alvo-orochi')?.activeConditions?.some(condition => condition.conditionId === 'agarrado')).toBe(true);
  });

  it('mostra e executa Língua Sombria pela HUD contra aliado selecionado', async () => {
    const action: InvocacaoControlador['acoes'][number] = {
      id: 'lingua-sombria', nome: 'Língua Sombria', tipo: 'habilidade', categoriaAcao: 'reacao', alcanceM: 6,
      statusAutomacao: 'executavel',
      efeitoEspecial: { tipo: 'puxar_aliado_gama' },
    };
    const modeloGama = { ...modelo, subcategoria: 'dez-sombras:sapo', acoes: [...modelo.acoes, action] };
    const owner = useCharacterStore.getState().characters.find(character => character.id === 'dono');
    const instance = owner?.instanciasInvocacao?.[0];
    if (!owner || !instance) throw new Error('Ficha de teste sem instância.');
    const instanciaGama = {
      ...instance,
      economiaAcoes: {
        ...instance.economiaAcoes,
        reacao: { atual: 1, maximo: 1 },
      },
    };
    useCharacterStore.getState().updateCharacter('dono', {
      invocacoesConhecidas: [modeloGama],
      instanciasInvocacao: [instanciaGama],
    });
    useCharacterStore.setState(state => ({
      characters: [...state.characters, ficha('aliado-lingua', { hpCurrent: 20, hpMax: 20 })],
    }));
    useMapStore.getState().addEntity({
      id: 'token-aliado-lingua', shape: 'ELLIPSE', x: 240, y: 100, w: 70, h: 70, rotation: 0,
      color: '#558866', label: 'Aliado', locked: false, layer: 'tokens', hp: 20, hpMax: 20,
      characterId: 'aliado-lingua', avatarProfileId: 'perfil-aliado-lingua',
    });
    useCombatStore.setState({ combatId: 'gama-hud-combat' });
    useShikigamiHudStore.setState({ selectedTargetId: 'token-aliado-lingua' });

    render(<ShikigamiOwnerPanel tokenId="token-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Executar Língua Sombria/ }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('foi puxado'));
    const tokenAliadoAtual = useMapStore.getState().entities['token-aliado-lingua'];
    expect(tokenAliadoAtual).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
    expect({ x: tokenAliadoAtual?.x, y: tokenAliadoAtual?.y }).not.toEqual({ x: 240, y: 100 });
    const instanciaAtual = useCharacterStore.getState().characters.find(character => character.id === 'dono')?.instanciasInvocacao?.[0];
    expect(instanciaAtual?.economiaAcoes?.reacao?.atual).toBe(0);
  });

  it('aplica reset manual apenas aos saldos próprios configurados', () => {
    const owner = useCharacterStore.getState().characters.find((character) => character.id === 'dono');
    const instance = owner?.instanciasInvocacao?.[0];
    if (!owner || !instance) throw new Error('Ficha de teste sem instância.');
    const modeloComReset: InvocacaoControlador = {
      ...modelo,
      economiaAcoesConfigurada: {
        ...modelo.economiaAcoesConfigurada,
        resetPorCategoria: { acaoMovimento: 'manual' },
      },
      recursosConfigurados: [{
        id: 'energia', nome: 'Energia', valorInicial: 2, valorMaximo: 4,
        recargaConfigurada: { quantidade: 2, unidade: 'manual' },
      }],
    };
    useCharacterStore.getState().updateCharacter('dono', {
      invocacoesConhecidas: [modeloComReset],
      instanciasInvocacao: owner.instanciasInvocacao?.map((item) => item.id === instance.id ? {
        ...item,
        economiaAcoes: { ...item.economiaAcoes, acaoMovimento: { atual: 0, maximo: 1 } },
        recursosAtuais: { energia: 1 },
      } : item),
    });
    const { container } = render(<ShikigamiOwnerPanel tokenId="token-1" />);
    const panelElement = container.querySelector<HTMLElement>('[data-testid="shikigami-owner-panel"]');
    if (!panelElement) throw new Error('Painel do Shikigami não foi renderizado.');
    const panel = within(panelElement);

    fireEvent.click(panel.getByRole('button', { name: 'Aplicar reset manual' }));

    const atualizada = useCharacterStore.getState().characters.find((character) => character.id === 'dono')?.instanciasInvocacao?.[0];
    expect(atualizada?.economiaAcoes?.acaoMovimento).toEqual({ atual: 1, maximo: 1 });
    expect(atualizada?.recursosAtuais?.energia).toBe(3);
    expect(panel.getByRole('status').textContent).toContain('Reset manual aplicado');
  });
});
