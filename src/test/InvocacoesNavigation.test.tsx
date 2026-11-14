// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { ControladorShikigamisAba } from '@/components/fichas/ControladorShikigamisAba';
import type { Character } from '@/types';

vi.mock('@/components/fichas/CriadorShikigami', () => ({
  CriadorShikigami: ({ onCancel, onSaved, initial }: { onCancel: () => void; onSaved: () => void; initial?: { nome: string } }) => {
    const [value, setValue] = useState(initial?.nome ?? '');
    return <div><label>Rascunho<input value={value} onChange={event => setValue(event.target.value)} /></label><button onClick={onCancel}>Voltar</button><button onClick={onSaved}>Salvar</button></div>;
  },
}));
vi.mock('@/components/fichas/ControladorInvocacoesSection', () => ({
  ControladorInvocacoesSection: ({ onCreateFicha, onEditFicha }: { onCreateFicha: () => void; onEditFicha: (id: string) => void }) => <div><button onClick={onCreateFicha}>Criar ficha</button><button onClick={() => onEditFicha('existing')}>Editar existente</button></div>,
}));
afterEach(cleanup);
const character = { id: 'ui-character', name: 'Controlador', invocacoesConhecidas: [] } as unknown as Character;

describe('Invocações e rascunho do criador', () => {
  it('abre Minhas invocações primeiro sem montar um rascunho', () => {
    render(<ControladorShikigamisAba character={character} />);
    expect(screen.getByRole('button', { name: 'Criar ficha' }).closest('[hidden]')).toBeNull();
    expect(screen.queryByLabelText('Rascunho')).toBeNull();
  });
  it('preserva valores ao navegar e reinicia somente ao criar outra ficha', () => {
    render(<ControladorShikigamisAba character={character} />);
    fireEvent.click(screen.getByRole('button', { name: 'Criar ficha' }));
    fireEvent.change(screen.getByLabelText('Rascunho'), { target: { value: 'Valor preservado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Minhas invocações' }));
    fireEvent.click(screen.getByRole('button', { name: 'Criar ou editar' }));
    expect((screen.getByLabelText('Rascunho') as HTMLInputElement).value).toBe('Valor preservado');
    fireEvent.click(screen.getByRole('button', { name: 'Minhas invocações' }));
    fireEvent.click(screen.getByRole('button', { name: 'Criar ficha' }));
    expect((screen.getByLabelText('Rascunho') as HTMLInputElement).value).toBe('');
  });
  it.each(['Voltar', 'Salvar'])('encerra edição em %s e abre criação vazia ao retornar', async action => {
    const existing = { ...character, invocacoesConhecidas: [{ id: 'existing', nome: 'Ficha existente' }] } as unknown as Character;
    render(<ControladorShikigamisAba character={existing} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar existente' }));
    expect((screen.getByLabelText('Rascunho') as HTMLInputElement).value).toBe('Ficha existente');
    fireEvent.click(screen.getByRole('button', { name: action }));
    await waitFor(() => expect(screen.queryByLabelText('Rascunho')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Criar ficha' }));
    expect((screen.getByLabelText('Rascunho') as HTMLInputElement).value).toBe('');
  });
});
