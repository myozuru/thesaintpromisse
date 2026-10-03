// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { OmniScriptTerminal } from '@/components/omni/OmniScriptTerminal';
import * as script from '@/lib/omni/omniScript';
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('digitação isolada do terminal', () => {
  it('200 alterações não recompilam nem atualizam o formulário a cada tecla', () => {
    vi.useFakeTimers(); const compilar = vi.spyOn(script, 'parseOmniScript'), onChange = vi.fn();
    render(<OmniScriptTerminal valor="" onChange={onChange} adiarEdicao />);
    const inicial = compilar.mock.calls.length;
    const campo = screen.getByRole('textbox');
    for (let i = 1; i <= 200; i++) fireEvent.change(campo, { target: { value: `somar ${i} em @USUARIO.vida` } });
    expect((campo as HTMLTextAreaElement).value).toBe('somar 200 em @USUARIO.vida');
    expect(onChange).not.toHaveBeenCalled(); expect(compilar).toHaveBeenCalledTimes(inicial);
    act(() => vi.advanceTimersByTime(250));
    expect(compilar).toHaveBeenCalledTimes(inicial + 1); expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.lastCall![0]).toBe('somar 200 em @USUARIO.vida');
    expect(onChange.mock.lastCall![1].efeitos[0].formula).toBe('200');
  });
  it('o Tab completa o rascunho atual antes de entregá-lo ao formulário', () => {
    vi.useFakeTimers(); const onChange = vi.fn();
    render(<OmniScriptTerminal valor="" onChange={onChange} adiarEdicao />);
    const campo = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(campo, { target: { value: 'somar 1 em vida temporar' } });
    campo.setSelectionRange(campo.value.length, campo.value.length);
    fireEvent.keyDown(campo, { key: 'Tab' });
    expect(campo.value).toContain('somar 1 em vida temporaria');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(campo);
    expect(onChange.mock.lastCall![0]).toBe(campo.value);
  });
  it('sair do campo entrega o último texto antes da pausa e não repete a entrega', () => {
    vi.useFakeTimers(); const onChange = vi.fn();
    render(<OmniScriptTerminal valor="" onChange={onChange} adiarEdicao />);
    const campo = screen.getByRole('textbox');
    fireEvent.change(campo, { target: { value: 'somar 2 em pe' } });
    fireEvent.blur(campo);
    expect(onChange.mock.lastCall![0]).toBe('somar 2 em pe');
    act(() => vi.advanceTimersByTime(300)); expect(onChange).toHaveBeenCalledTimes(1);
  });
  it('entrega uma edição pendente quando o terminal sai da aba', () => {
    vi.useFakeTimers(); const onChange = vi.fn();
    const view = render(<OmniScriptTerminal valor="" onChange={onChange} adiarEdicao />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'somar 7 em vida' } });
    view.unmount();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.lastCall![0]).toBe('somar 7 em vida');
    act(() => vi.advanceTimersByTime(300)); expect(onChange).toHaveBeenCalledTimes(1);
  });
  it('aceita inserção externa e mantém o rascunho após o retorno do formulário', () => {
    vi.useFakeTimers(); const onChange = vi.fn();
    const view = render(<OmniScriptTerminal valor="" onChange={onChange} adiarEdicao />);
    view.rerender(<OmniScriptTerminal valor="somar 3 em vida" onChange={onChange} adiarEdicao />);
    const campo = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(campo.value).toBe('somar 3 em vida');
    fireEvent.change(campo, { target: { value: 'somar 4 em vida' } });
    act(() => vi.advanceTimersByTime(250));
    view.rerender(<OmniScriptTerminal valor="somar 4 em vida" onChange={onChange} adiarEdicao />);
    fireEvent.change(campo, { target: { value: 'somar 5 em vida' } });
    expect(campo.value).toBe('somar 5 em vida');
  });
});
