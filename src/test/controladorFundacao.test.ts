import { describe, expect, it } from 'vitest';
import { getKeyAttrForSpec, recalcPeMaxBySpec, recalcPeMaxFromHistory } from '@/lib/levelEngine';
import {
  limiteInvocacoesConhecidas,
  limiteInvocacoesAtivas,
  pvControlador,
  validarCatalogoControlador,
  type InvocacaoControlador,
} from '@/lib/controlador/tipos';
import type { Attribute } from '@/types';

const attrs = [
  { id: 'sab', name: 'Sabedoria', value: 18 },
  { id: 'pre', name: 'Presença', value: 14 },
] as Attribute[];

const shikigami: InvocacaoControlador = {
  id: 'lobo', nome: 'Lobo Divino', tipo: 'shikigami', donoCharacterId: 'mestre',
  origem: { tipo: 'grimorio', entidadeId: 'criatura-lobo' },
  hpAtual: 12, hpMaximo: 12, defesa: 14, deslocamentoM: 9, porte: 'Médio',
  custoInvocacaoPE: 3, custoSustentacaoPE: 1,
  acoes: [{ id: 'mordida', nome: 'Mordida', tipo: 'ataque', alcanceM: 1.5, dano: '1d6' }],
};

describe('Controlador — atributo-chave e progressão', () => {
  it('aceita Sabedoria ou Presença mantendo fallback de fichas antigas', () => {
    expect(getKeyAttrForSpec('Controlador')).toBe('Sabedoria');
    expect(getKeyAttrForSpec('Controlador', 'Presença')).toBe('Presença');
    expect(recalcPeMaxBySpec(1, 'Controlador', attrs, 0, 'Sabedoria')).toBe(9);
    expect(recalcPeMaxBySpec(1, 'Controlador', attrs, 0, 'Presença')).toBe(7);
    expect(recalcPeMaxBySpec(6, 'Controlador', attrs, 0, 'Presença')).toBe(32);
    expect(recalcPeMaxFromHistory(10, 0, 'Controlador', attrs, 0, 1, 'Presença')).toBe(12);
  });
  it('PV inicial 10+CON, depois d8 ou média 5 + CON', () => {
    expect(pvControlador(1, 2)).toBe(12);
    expect(pvControlador(3, 2)).toBe(26);
    expect(pvControlador(3, 2, [8, 1])).toBe(25);
    expect(() => pvControlador(2, 0, [9])).toThrow();
  });
  it.each([[1,2],[3,3],[6,4],[9,5],[10,6],[12,7],[15,8],[18,9]])('nível %i permite %i invocações conhecidas', (nivel, esperado) => {
    expect(limiteInvocacoesConhecidas(nivel)).toBe(esperado);
  });
  it('até duas ativas com +1 em Controle, sem confundir com treino geral', () => {
    expect(limiteInvocacoesAtivas()).toBe(2);
    expect(limiteInvocacoesAtivas(2)).toBe(3);
    expect(limiteInvocacoesAtivas(0)).toBe(1);
  });
});
describe('Controlador — catálogo', () => {
  it('preserva vínculo com Grimório/OMNI e valida propriedade', () => {
    expect(validarCatalogoControlador('mestre', 1, [shikigami])).toEqual({ ok: true });
    expect(validarCatalogoControlador('intruso', 1, [shikigami]).ok).toBe(false);
    expect(validarCatalogoControlador('mestre', 1, [shikigami, shikigami]).ok).toBe(false);
    const tres = [shikigami, { ...shikigami, id: 'b' }, { ...shikigami, id: 'c' }];
    expect(validarCatalogoControlador('mestre', 1, tres).ok).toBe(false);
    expect(validarCatalogoControlador('mestre', 3, tres).ok).toBe(true);
  });
});
