// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ConstrutorBlocoLogico } from '@/components/omni/ConstrutorBlocoLogico';
import type { CondicaoLogica } from '@/lib/omni/tipos';
afterEach(cleanup);
describe('construtor de consultas compostas', () => {
  it('conserva seletor e operação em nós separados ao editar a referência', () => {
    const c: CondicaoLogica = { id: 'condicao-ui', esquerdo: { tipo: 'ref', ref: { alvo: 'ALVO', caminho: 'vida' } }, operador: 'MENOR_QUE', direito: { tipo: 'fixo', valor: 50 } };
    const alterar = vi.fn();
    render(<ConstrutorBlocoLogico condicao={c} onChange={alterar} onRemove={() => {}} />);
    fireEvent.change(screen.getByLabelText('Consulta por componentes'), { target: { value: 'percentual vida temporaria' } });
    const ref = alterar.mock.lastCall![0].esquerdo.ref;
    expect(ref.composicao.contexto).toBe('ALVO');
    expect(ref.composicao.consulta).toMatchObject({ tipo: 'operacao', componente: 'percentual', entrada: { componente: 'temporaria', entrada: { componente: 'vida' } } });
  });
});
