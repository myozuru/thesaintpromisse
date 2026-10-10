// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ficha, montarMesa, comoTela } from './helpers/mesaReal';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore } from '@/stores/useMapStore';
import { useShikigamiHudStore } from '@/stores/useShikigamiHudStore';
import { novaInstanciaInvocacao } from '@/lib/controlador/estadoInvocacao';
import type { InvocacaoControlador } from '@/lib/controlador/tipos';
import { ShikigamiOwnerPanel } from '@/components/mapa/ui/ShikigamiOwnerPanel';

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
  acoes: [{ id: 'mordida', nome: 'Mordida', tipo: 'ataque', alcanceM: 3 }],
  economiaAcoesConfigurada: { acaoMovimento: 1, acaoComplexa: 1 },
  recursosConfigurados: [{ id: 'energia', nome: 'Energia', valorInicial: 2, valorMaximo: 4 }],
};

beforeEach(() => {
  cleanup();
  const instancia = novaInstanciaInvocacao({
    id: 'instancia-1',
    modeloId: modelo.id,
    donoCharacterId: 'dono',
    tokenId: 'token-1',
    hpAtual: 12,
    hpMaximoAtual: 12,
    economiaAcoes: { acaoMovimento: { atual: 1, maximo: 1 }, acaoComplexa: { atual: 1, maximo: 1 } },
    recursosAtuais: { energia: 2 },
  });
  montarMesa([ficha('dono', {
    profileId: 'perfil-dono',
    invocacoesConhecidas: [modelo],
    instanciasInvocacao: [instancia],
  })], { dono: [2, 2] });
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
