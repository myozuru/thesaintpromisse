// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { OmniScriptTerminal } from '@/components/omni/OmniScriptTerminal';
import { DICIONARIO_AUTOCOMPLETE } from '@/lib/omni/dicionarioAutocomplete';
import { PacoteOmniSchema } from '@/lib/omni/validacao';
import { novaEntidade } from '@/lib/omni/tipos';
import type { Character } from '@/types';
afterEach(cleanup);

describe('keys no editor e no pacote exportado', () => {
  it('mostra uma key desconhecida no terminal', () => {
    render(<OmniScriptTerminal valor="somar @USUARIO.vidaa em vida_max" onChange={vi.fn()} />);
    expect(screen.getByText(/Key desconhecida: @USUARIO.vidaa/)).toBeDefined();
  });
  it('avisa contexto ausente em prévia sem tratar valor final como key inválida', () => {
    const personagemPreview = { id: 'preview', name: 'Preview', level: 1, attributes: [], hpCurrent: 10, hpMax: 10 } as unknown as Character;
    render(<OmniScriptTerminal valor="@depois_sofrer_dano -> somar @DANO.valor_final em contador_dano" onChange={vi.fn()} personagemPreview={personagemPreview} />);
    expect(screen.getByText(/@DANO.valor_final não está disponível/)).toBeDefined();
    expect(screen.queryByText(/Key desconhecida: @DANO.valor_final/)).toBeNull();
  });
  it.each(['DANO.resolvido', 'ACAO.eh_ataque', 'TESTE.margem', 'EFEITO.pilhas', 'ITEM.cooldown_restante', 'falhas_morte', 'cooldown_<id>', 'usos_habilidade_<id>'])('%s aparece no autocomplete', (key) => {
    expect(DICIONARIO_AUTOCOMPLETE.some((s) => s.valor === key)).toBe(true);
  });
  it('exportar/importar preserva ação, fórmulas e cooldown; rejeita cooldown inválido', () => {
    const ent = novaEntidade('item', 'Teste');
    ent.acoesAtivas = [{ id: 'a', nome: 'Teste', acao: 'livre', teste: 'nenhum', custoPE: '0', alcanceM: 0, cooldownTurnos: 2 }];
    ent.combatData = { critRange: 20, critMultiplier: 2, effects: [{ id: 'f', type: 'ADICIONAR', target: 'USUARIO', formula: '@DANO.valor_final', resourcePath: 'contador_dano' }] };
    const pacote = { formato: 'omni-engine.v1', nome: 'Teste', geradoEm: 0, entidades: [ent] };
    const salvo = PacoteOmniSchema.parse(JSON.parse(JSON.stringify(pacote)));
    expect(salvo.entidades[0].acoesAtivas).toEqual(ent.acoesAtivas);
    expect(salvo.entidades[0].combatData).toEqual(ent.combatData);
    ent.acoesAtivas[0].cooldownTurnos = -1;
    expect(PacoteOmniSchema.safeParse(pacote).success).toBe(false);
  });
});
