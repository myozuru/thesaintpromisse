// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OmniScriptTerminal } from '@/components/omni/OmniScriptTerminal';
import * as script from '@/lib/omni/omniScript';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });
describe('compilação do editor fora da thread do teclado', () => {
  it('envia o texto ao worker e ignora respostas de versões anteriores', () => {
    vi.useFakeTimers(); const onChange = vi.fn(), parse = vi.spyOn(script, 'parseOmniScript');
    const worker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null as null | ((e: { data: unknown }) => void), onerror: null };
    vi.stubGlobal('Worker', class { constructor() { return worker; } });
    const view = render(<OmniScriptTerminal valor="" onChange={onChange} adiarEdicao />);
    const campo = screen.getByRole('textbox');
    const inicial = parse.mock.calls.length;
    fireEvent.change(campo, { target: { value: 'somar 1 em vida' } });
    act(() => vi.advanceTimersByTime(250));
    expect(parse.mock.calls.length).toBe(inicial); expect(onChange).not.toHaveBeenCalled();
    const primeiro = worker.postMessage.mock.lastCall![0];
    fireEvent.change(campo, { target: { value: 'somar 2 em vida' } });
    act(() => worker.onmessage!({ data: { ...primeiro, compilado: script.parseOmniScript(primeiro.texto), tokens: [] } }));
    expect(onChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(250));
    const segundo = worker.postMessage.mock.lastCall![0];
    act(() => worker.onmessage!({ data: { ...segundo, compilado: script.parseOmniScript(segundo.texto), tokens: script.tokenizarOmniScript(segundo.texto) } }));
    expect(onChange).toHaveBeenCalledTimes(1); expect(onChange.mock.lastCall![0]).toBe('somar 2 em vida');
    view.unmount(); expect(worker.terminate).toHaveBeenCalled();
  });
  it('usa a compilação local se o navegador não conseguir iniciar o worker', () => {
    vi.useFakeTimers(); const onChange = vi.fn();
    vi.stubGlobal('Worker', class { constructor() { throw new Error('indisponível'); } });
    render(<OmniScriptTerminal valor="" onChange={onChange} adiarEdicao />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'somar 3 em pe' } });
    act(() => vi.advanceTimersByTime(250));
    expect(onChange.mock.lastCall![0]).toBe('somar 3 em pe');
  });
});
