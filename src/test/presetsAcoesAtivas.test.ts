import { describe, expect, it } from 'vitest';
import { copiarAcaoAtiva, criarAcaoDePreset } from '@/lib/omni/presetsAcoesAtivas';
import type { AcaoAtivaConfig } from '@/lib/omni/tipos';

const acao: AcaoAtivaConfig = {
  id: 'acao-original', nome: 'Chama', acao: 'comum', custoPE: '1', alcanceM: 6,
  teste: 'tr', efeitos: [{ tipo: 'condicao', condicao: 'queimado', rodadas: 2 }],
};

describe('duplicação e presets de ações OMNI', () => {
  it('duplica todos os campos com ID e objeto independentes', () => {
    const copia = copiarAcaoAtiva(acao);
    expect(copia).toMatchObject({ nome: 'Chama (cópia)', custoPE: '1', efeitos: acao.efeitos });
    expect(copia.id).not.toBe(acao.id);
    copia.efeitos![0] = { tipo: 'condicao', condicao: 'caido', rodadas: 1 };
    expect(acao.efeitos![0]).toMatchObject({ condicao: 'queimado', rodadas: 2 });
  });

  it('cria uma ação independente ao aplicar um preset', () => {
    const nova = criarAcaoDePreset({ id: 'preset-1', nome: 'Fogo', acao });
    expect(nova.nome).toBe(acao.nome);
    expect(nova.id).not.toBe(acao.id);
    expect(nova.efeitos).toEqual(acao.efeitos);
  });
});
