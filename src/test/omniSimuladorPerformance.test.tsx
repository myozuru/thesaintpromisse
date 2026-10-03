// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SimuladorPreview } from '@/components/omni/SimuladorPreview';
import { novaEntidade, normalizarCombatData, type CombatEffect } from '@/lib/omni/tipos';
import * as parser from '@/lib/omni/parser';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('simulação fora do caminho de digitação', () => {
  it('só faz as 200 amostras ao solicitar e invalida resultados após uma edição', () => {
    const avaliar = vi.spyOn(parser, 'avaliarFormula');
    const efeito: CombatEffect = { id: 'e', type: 'ADICIONAR', resourcePath: 'vida', target: 'USUARIO', formula: '1d6' };
    const entidade = { ...novaEntidade('item'), combatData: normalizarCombatData({ effectsPassive: [efeito], effectsActive: [] }) };
    const view = render(<SimuladorPreview entidade={entidade} />);
    const antes = avaliar.mock.calls.length;
    expect(antes).toBeLessThan(10);
    fireEvent.click(screen.getByRole('button', { name: 'Calcular médias' }));
    expect(avaliar.mock.calls.length - antes).toBe(200);
    const calculado = avaliar.mock.calls.length;
    view.rerender(<SimuladorPreview entidade={{ ...entidade, descricao: 'Editando o texto' }} />);
    expect(avaliar.mock.calls.length).toBe(calculado);
    view.rerender(<SimuladorPreview entidade={{ ...entidade, combatData: normalizarCombatData({ effectsPassive: [{ ...efeito, formula: '2d6' }], effectsActive: [] }) }} />);
    expect(avaliar.mock.calls.length).toBe(calculado);
    expect(screen.getByRole('button', { name: 'Calcular médias' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Recalcular médias' })).toBeNull();
  });
});
