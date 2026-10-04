// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
import { cleanup, render, screen } from '@testing-library/react';
import { OmniScriptTerminal } from '@/components/omni/OmniScriptTerminal';
import type { Character } from '@/types';

const hero = { id: 'terminal-diag', name: 'Hero', level: 1,
  hpCurrent: 0, hpMax: 20, peCurrent: 0, peMax: 10,
  attributes: [], skills: [], savingThrows: [], ca: 10, movement: 9,
} as unknown as Character;

afterEach(cleanup);

describe('Diagnósticos visíveis na prévia do terminal', () => {
  it('mostra referência ausente e remove o aviso ao corrigir a fórmula', () => {
    const props = { onChange: vi.fn(), personagemPreview: hero, defaultTarget: 'USUARIO' as const };
    const view = render(<OmniScriptTerminal {...props} valor="somar @USUARIO.key_inexistente em vida" />);
    expect(screen.getByRole('status').textContent).toContain('@USUARIO.key_inexistente');
    view.rerender(<OmniScriptTerminal {...props} valor="somar @USUARIO.vida em vida" />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('não marca um zero real como prévia incompleta', () => {
    render(<OmniScriptTerminal onChange={vi.fn()} personagemPreview={hero} valor="somar @USUARIO.pe em vida" />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});


it.each([
  ['se @USUARIO.key_inexistente == 0 entao somar 1 em vida', 'Condição'],
  ['somar 1 em contador_rancor ate @USUARIO.key_inexistente', 'Teto'],
])('o terminal mostra referência inválida em %s', (script, campo) => {
  render(<OmniScriptTerminal onChange={vi.fn()} personagemPreview={hero} valor={script} />);
  expect(screen.getByRole('status').textContent).toContain(campo);
  expect(screen.getByRole('status').textContent).toContain('@USUARIO.key_inexistente');
});
