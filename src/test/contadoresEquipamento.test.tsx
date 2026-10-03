// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { contadoresDaEntidade } from '@/lib/omni/contadoresDaEntidade';
import { ContadoresEquipamento } from '@/components/omni/ContadoresEquipamento';
import type { EntidadeOmni } from '@/lib/omni/tipos';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { montarMesa } from './helpers/mesaReal';

const entidade = (extra: object) => ({ id: 'lamina', nome: 'Lâmina', ...extra }) as EntidadeOmni;
afterEach(() => { cleanup(); useCharacterStore.setState({ characters: [] }); });

describe('contadores permanentes de equipamentos', () => {
  it('identifica passivas, custos e contadores gerados, unificando repetições', () => {
    expect(contadoresDaEntidade(entidade({
      combatData: { effectsPassive: [{ formula: '@USUARIO.contador rancor * 1d4' }] },
      acoesAtivas: [{ consumirContador: { nome: 'rancor' }, custo_recursos: { gastar_cargas: { nome: 'foco' } } }],
      gatilhos: [{ acoes: [{ acao: 'INCREMENTAR_CONTADOR', caminhoAlvo: 'contador_brasas', alvoAplicacao: 'USUARIO' }] }],
      descricao: '@USUARIO.contador decorativo',
    }))).toEqual(['brasas', 'foco', 'rancor']);
  });
  it('ignora contadores do alvo sem descartar referências ao portador na mesma ação', () => {
    expect(contadoresDaEntidade(entidade({ gatilhos: [{ acoes: [{
      acao: 'INCREMENTAR_CONTADOR', alvoAplicacao: 'ALVO', caminhoAlvo: 'contador_marca',
      formula: '@USUARIO.contador foco + @ALVO.contador brasas',
    }] }] }))).toEqual(['foco']);
  });
  it('preserva nomes literais nos custos', () => {
    expect(contadoresDaEntidade(entidade({ acoesAtivas: [{ consumirContador: { nome: 'contador_rancor' } }] }))).toEqual(['contador_rancor']);
  });
  it('mostra zero para uma passiva e atualiza o total e as origens sem alterar os recursos', () => {
    montarMesa([{ id: 'portador', name: 'Portador', omniCounters: {} }, { id: 'bia', name: 'Bia' }] as Character[], {});
    render(<ContadoresEquipamento charId="portador" entidade={entidade({ combatData: { effectsPassive: [{ formula: '@USUARIO.contador rancor * 1d4' }] } })} />);
    expect(screen.getByText('Rancor: 0')).toBeTruthy();
    const counters = { rancor: 3, rancor__fonte__bia: 2, rancor__fonte__ausente: 1, __omni_rodada: 9, fadiga: 1 };
    act(() => useCharacterStore.setState(s => ({ characters: s.characters.map(c => c.id === 'portador' ? { ...c, omniCounters: counters } : c) })));
    fireEvent.click(screen.getByText('Rancor: 3'));
    expect(screen.getByText('Bia: 2')).toBeTruthy();
    expect(screen.getByText('ausente: 1')).toBeTruthy();
    expect(screen.queryByText(/Fadiga/)).toBeNull();
    expect(useCharacterStore.getState().characters[0].omniCounters).toEqual(counters);
  });
});
