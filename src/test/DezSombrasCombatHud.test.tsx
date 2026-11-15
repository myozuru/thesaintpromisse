// @vitest-environment jsdom
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore } from '@/stores/useMapStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useShikigamiHudStore } from '@/stores/useShikigamiHudStore';
import { ficha } from './helpers/mesaReal';
import type { InvocacaoControlador } from '@/lib/controlador/tipos';
import { DezSombrasCombatHud } from '@/components/mapa/ui/DezSombrasCombatHud';

vi.mock('@/components/fichas/ControladorInvocacoesSection', () => ({
  ControladorInvocacoesSection: (props: { view: string; canViewCatalog: boolean; scopeToTenShadows?: boolean }) => (
    <div data-testid="invocations-section" data-view={props.view} data-catalog={String(props.canViewCatalog)} data-ten-shadows={String(props.scopeToTenShadows)} />
  ),
}));

vi.mock('@/components/fichas/RituaisDezSombrasSection', () => ({
  RituaisDezSombrasSection: ({ character }: { character: { id: string } }) => (
    <div data-testid="rituals-section" data-character={character.id} />
  ),
}));

vi.mock('@/components/mapa/ui/ShikigamiOwnerPanel', () => ({
  ShikigamiOwnerPanel: ({ tokenId }: { tokenId: string }) => <div data-testid="owner-actions">Ações de {tokenId}</div>,
}));

const modelo = {
  id: 'nue-modelo',
  nome: 'Nue',
  donoCharacterId: 'dono',
  tipo: 'shikigami',
  pacoteRegras: 'dez-sombras',
  subcategoria: 'dez-sombras:nue',
  hpAtual: 20,
  hpMaximo: 20,
  defesa: 12,
  deslocamentoM: 12,
  custoInvocacaoPE: 3,
  alcanceInvocacaoM: 6,
  acoes: [],
} as unknown as InvocacaoControlador;

const dono = ficha('dono', {
  name: 'Megumi',
  category: 'PLAYER',
  specialization: 'Controlador',
  profileId: 'perfil-dono',
  tecnicaAmaldicoada: 'Dez Sombras',
  invocacoesConhecidas: [modelo],
});

function entidade(extra: Record<string, unknown> = {}) {
  return {
    id: 'nue-token',
    characterId: undefined,
    ownerCharId: 'dono',
    invocationId: modelo.id,
    invocationState: 'ativa',
    x: 100,
    y: 100,
    w: 70,
    h: 70,
    ...extra,
  };
}

function Harness() {
  const [open, setOpen] = useState(false);
  return <DezSombrasCombatHud open={open} onOpenChange={setOpen} />;
}

function prepararMesa(role: 'PLAYER' | 'MASTER', selectedIds: string[] = [], token = entidade()) {
  useCharacterStore.setState({ characters: [dono, ficha('alvo', { name: 'Alvo', category: 'INIMIGO' })] } as never);
  useProfileStore.setState({ activeProfileId: role === 'PLAYER' ? 'perfil-dono' : null } as never);
  useRoleStore.setState({ role } as never);
  useMapStore.setState({
    selectedIds,
    entities: {
      'token-controlador': { id: 'token-controlador', characterId: 'dono', x: 0, y: 0, w: 70, h: 70 },
      'nue-token': token,
      'token-alvo': { id: 'token-alvo', characterId: 'alvo', x: 300, y: 0, w: 70, h: 70 },
    },
  } as never);
  useShikigamiHudStore.setState({ sourceTokenId: 'nue-token' });
}

beforeEach(() => {
  cleanup();
  prepararMesa('PLAYER');
});

describe('HUD das Dez Sombras no mapa', () => {
  it('abre no mapa com a biblioteca restrita às sombras adquiridas e oferece os rituais', () => {
    prepararMesa('PLAYER');
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: /Dez Sombras/ }));
    expect(screen.getByTestId('dez-sombras-combat-hud').getAttribute('aria-label')).toContain('Megumi');
    fireEvent.click(screen.getByRole('button', { name: /Invocar/ }));
    expect(screen.getByTestId('invocations-section').getAttribute('data-view')).toBe('owned');
    expect(screen.getByTestId('invocations-section').getAttribute('data-catalog')).toBe('false');
    expect(screen.getByTestId('invocations-section').getAttribute('data-ten-shadows')).toBe('true');
    expect(screen.queryByText('Catálogo')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Rituais/ }));
    expect(screen.getByTestId('rituals-section').getAttribute('data-character')).toBe('dono');
  });

  it('seleciona um shikigami ativo e abre os comandos no próprio HUD', () => {
    prepararMesa('MASTER', ['token-controlador']);
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: /Dez Sombras/ }));
    fireEvent.click(screen.getByRole('button', { name: /Em campo/ }));
    fireEvent.click(screen.getByRole('button', { name: /Nue/ }));

    expect(screen.getByTestId('owner-actions').textContent).toContain('nue-token');
    expect(useMapStore.getState().selectedIds).toEqual(['nue-token']);
    expect(useShikigamiHudStore.getState().sourceTokenId).toBe('nue-token');
  });

  it('mantém a ficha do Controlador do Mestre ao selecionar outro token como alvo', () => {
    prepararMesa('MASTER', ['token-controlador']);
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: /Dez Sombras/ }));
    useMapStore.setState({ selectedIds: ['token-alvo'] } as never);

    expect(screen.getByTestId('dez-sombras-combat-hud').getAttribute('aria-label')).toContain('Megumi');
    fireEvent.click(screen.getByRole('button', { name: /Rituais/ }));
    expect(screen.getByTestId('rituals-section').getAttribute('data-character')).toBe('dono');
  });

  it('não entrega ao jogador ações de uma sombra sob controle do Mestre', () => {
    prepararMesa('PLAYER', [], entidade({ masterControlled: true }));
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: /Dez Sombras/ }));
    fireEvent.click(screen.getByRole('button', { name: /Em campo/ }));

    expect(screen.getByText(/sob controle do Mestre/)).toBeTruthy();
    expect(screen.queryByText(/Selecione este token no mapa/)).toBeNull();
    expect(screen.queryByTestId('owner-actions')).toBeNull();
  });

  it('fecha com Escape mesmo quando o foco está fora do painel', () => {
    prepararMesa('PLAYER');
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: /Dez Sombras/ }));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByTestId('dez-sombras-combat-hud')).toBeNull();
    expect(screen.getByTestId('dez-sombras-hud-trigger')).toBeTruthy();
  });
});
