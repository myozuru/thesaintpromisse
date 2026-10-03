// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GuiaComponentes } from '@/components/omni/GuiaComponentes';
import { CATALOGO_COMPONENTES_UI } from '@/lib/omni/componentes/catalogoUI';
import { EXEMPLOS_COMPONENTES_UI } from '@/lib/omni/componentes/exemplosUI';
import { COMPONENTES_OMNI } from '@/lib/omni/componentes/ids';
afterEach(cleanup);
describe('guia individual de componentes', () => {
  it('documenta todas as keys e conversões, sem exemplos faltantes', () => {
    expect(CATALOGO_COMPONENTES_UI.map(c => c.key)).toEqual([...COMPONENTES_OMNI]);
    expect(EXEMPLOS_COMPONENTES_UI).toHaveLength(335);
    expect(new Set(EXEMPLOS_COMPONENTES_UI.map(c => c.explicacao)).size).toBeGreaterThan(320);
    for (const c of CATALOGO_COMPONENTES_UI) { expect(c.funcao.length).toBeGreaterThan(15); expect(c.exemplo.length).toBeGreaterThan(20); }
  });
  it('encontra a propriedade, explica seu comportamento e abre seu exemplo', () => {
    const inserir = vi.fn(); render(<GuiaComponentes inserir={inserir} />);
    fireEvent.change(screen.getByLabelText('Buscar componentes e exemplos'), { target: { value: 'leve' } });
    expect(screen.getByRole('button', { name: 'leve' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'arma_principal leve' }));
    expect(screen.getByText(/Uma lâmina leve permite uma sequência rápida/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /se @USUARIO.arma_principal leve/ }));
    expect(inserir.mock.lastCall![0]).toContain('arma_principal leve');
  });
});
