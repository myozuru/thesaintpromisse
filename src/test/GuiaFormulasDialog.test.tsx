import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GuiaFormulasDialog } from '@/components/omni/GuiaFormulasDialog';

afterEach(cleanup);

describe('GuiaFormulasDialog', () => {
  it('organiza o guia em oito abas e permite inserir uma key e seu alias', () => {
    const onInserirFormula = vi.fn();
    render(<GuiaFormulasDialog aberto onClose={() => {}} onInserirFormula={onInserirFormula} />);

    expect(screen.getAllByRole('tab')).toHaveLength(8);
    expect(screen.getByRole('heading', { name: 'vida' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '@USUARIO.vida' }));
    expect(onInserirFormula).toHaveBeenLastCalledWith('@USUARIO.vida');

    fireEvent.click(screen.getByRole('button', { name: 'vida_atual' }));
    expect(onInserirFormula).toHaveBeenLastCalledWith('@USUARIO.vida_atual');
  });

  it('mostra gatilhos e as aliases para inserir no campo em foco', () => {
    const onInserirFormula = vi.fn();
    render(<GuiaFormulasDialog aberto onClose={() => {}} onInserirFormula={onInserirFormula} />);
    fireEvent.click(screen.getByRole('tab', { name: /Eventos/ }));

    fireEvent.click(screen.getByRole('button', { name: '@fim_turno ->' }));
    expect(onInserirFormula).toHaveBeenLastCalledWith('@fim_turno -> ');
  });

  it('maximiza a janela e preserva o redimensionamento no modo normal', () => {
    render(<GuiaFormulasDialog aberto onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.style.resize).toBe('both');

    fireEvent.click(screen.getByRole('button', { name: 'Maximizar guia' }));
    expect(dialog.style.width).toBe('100vw');
    expect(dialog.style.height).toBe('100vh');
    expect(screen.getByRole('button', { name: 'Restaurar tamanho do guia' })).toBeTruthy();
  });
});
