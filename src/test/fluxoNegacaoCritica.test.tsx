// @vitest-environment jsdom
/**
 * Fluxo completo da Negação Crítica com a mesa real:
 * aliado tira 1 natural → aviso aparece na tela do dono do Suporte → clique → efeito.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { rollD20Com } from '@/lib/dice';
import {
  consumeCritNegated, reduceNegacaoMessage, resolveNegacao, useNegacaoPromptStore,
} from '@/lib/suporteNegacao';
import { NegacaoPromptDialog } from '@/components/fichas/SuporteNegacaoSections';
import {
  capturarEnvios, comoTela, esperar, ficha, forcarDados, limparMesa, montarMesa, pegarFicha,
} from './helpers/mesaReal';

const sup = () => ficha('ana', { profileId: 'p-ana', chosenSpecAbilities: [{ abilityId: 'sup-negacao-critica', chosenAtLevel: 4 }] } as never);
const aliado = () => ficha('bruno', { profileId: 'p-bruno' } as never);

beforeEach(() => {
  useNegacaoPromptStore.setState({ offer: null });
  montarMesa([sup(), aliado()], { ana: [0, 0], bruno: [3, 0] });
});
afterEach(() => { cleanup(); limparMesa(); });

describe('Negação Crítica — fluxo real', () => {
  it('mesma tela: aviso aparece, clicar em Negar gasta 3 PE e vira falha comum', async () => {
    comoTela({ profileId: 'p-ana', role: 'PLAYER' });
    render(<NegacaoPromptDialog />);
    forcarDados(1);
    const rolagem = rollD20Com('bruno');
    await act(() => esperar(20));
    expect(screen.getByText(/tirou/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Negar/ }));
    expect(await rolagem).toBe(1);
    expect(consumeCritNegated('bruno')).toBe(true);
    expect(pegarFicha('ana').peCurrent).toBe(17);
    expect(pegarFicha('ana').negacaoCriticaUsed).toBe(1);
    expect(screen.queryByText(/tirou/)).toBeNull();
  });

  it('clicar em Não mantém a falha crítica e não gasta nada', async () => {
    comoTela({ profileId: 'p-ana', role: 'PLAYER' });
    render(<NegacaoPromptDialog />);
    forcarDados(1);
    const rolagem = rollD20Com('bruno');
    await act(() => esperar(20));
    fireEvent.click(screen.getByRole('button', { name: 'Não' }));
    await rolagem;
    expect(consumeCritNegated('bruno')).toBe(false);
    expect(pegarFicha('ana').peCurrent).toBe(20);
  });

  it('duas contas: o aviso não aparece na tela do Bruno, só na da Ana; a resposta dela volta', async () => {
    comoTela({ profileId: 'p-bruno', role: 'PLAYER' }); // tela de quem rolou
    const rede = capturarEnvios('negacao');
    render(<NegacaoPromptDialog />);
    forcarDados(1);
    const rolagem = rollD20Com('bruno');
    await act(() => esperar(20));
    expect(screen.queryByText(/tirou/)).toBeNull();
    const oferta = rede.enviados.find((m) => m.kind === 'offer')!;
    // A tela da Ana recebe a oferta e veria o aviso; o Mestre e o Bruno não.
    expect(reduceNegacaoMessage(oferta as never, 'tela-ana', (s) => s === 'ana').type).toBe('open');
    expect(reduceNegacaoMessage(oferta as never, 'tela-mestre', () => false).type).toBe('ignore');
    // Ana aceita na tela dela → chega o "accept" → a rolagem do Bruno continua.
    const resposta = reduceNegacaoMessage({ kind: 'accept', requestId: oferta.requestId as string, clientId: 'tela-ana' }, 'tela-bruno', () => false);
    if (resposta.type === 'accept') resolveNegacao(resposta.requestId, true);
    await rolagem;
    expect(consumeCritNegated('bruno')).toBe(true);
    rede.parar();
  });

  it('sem aviso quando o aliado está a mais de 12 m ou o resultado não é 1', async () => {
    comoTela({ profileId: 'p-ana', role: 'PLAYER' });
    montarMesa([sup(), aliado()], { ana: [0, 0], bruno: [10, 0] });
    forcarDados(1);
    await rollD20Com('bruno');
    expect(useNegacaoPromptStore.getState().offer).toBeNull();
    montarMesa([sup(), aliado()], { ana: [0, 0], bruno: [1, 0] });
    forcarDados(5);
    await rollD20Com('bruno');
    expect(useNegacaoPromptStore.getState().offer).toBeNull();
  });
});
