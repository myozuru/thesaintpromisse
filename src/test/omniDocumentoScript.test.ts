import { describe, expect, it } from 'vitest';
import { executarParseLegadoOmni, migrarScriptLegadoOmni, normalizarDocumentoOmni, preservarDocumentoOmni } from '@/lib/omni/documentoScript';
import type { OmniScriptParseOpts } from '@/lib/omni/omniScript';

describe('versão e migração sem perda de scripts OMNI', () => {
  it('trata script sem versão como legado e preserva o conteúdo byte por byte', () => {
    const source = 'quando vida <= 25% -> (somar 1 em contador_rancor ate treino por_fonte,\n somar 2 em pe)  ';
    const r = normalizarDocumentoOmni(source);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.documento).toEqual({ formato:'omni.script', versao:1, fonte:source });
    expect(r.linguagem).toBe('legada');
    expect(r.executavel).toBe(true);
    expect(r.parse.erros).toEqual([]);
    expect(preservarDocumentoOmni(source)?.fonte).toBe(source);
  });
  it('mantém fonte e semântica legada para condições, dano e delimitadores citados', () => {
    const sources = [
      'subtrair 2d6 em vida tipo DQ',
      'aplicar cego em usuario',
      'botao "Ação (teste), @fim_turno -> e aplicar cego"',
      'somar 1 em contador_rancor ate treino por_fonte',
    ];
    for (const source of sources) {
      const doc = migrarScriptLegadoOmni(source);
      const a = executarParseLegadoOmni(doc) as { efeitos: unknown[]; erros: unknown[] };
      const b = executarParseLegadoOmni(doc) as { efeitos: unknown[]; erros: unknown[] };
      expect(a.erros, source).toEqual([]);
      expect(a.efeitos.map(({ id: _id, ...effect }) => effect)).toEqual(b.efeitos.map(({ id: _id, ...effect }) => effect));
      expect(normalizarDocumentoOmni(doc)).toMatchObject({ ok:true, documento:{ fonte:source, versao:1 }, linguagem:'legada', executavel:true });
    }
  });
  it('aplica opções de parsing sem alterá-las nem guardá-las na migração', () => {
    const options: OmniScriptParseOpts = { defaultTarget:'USUARIO' };
    const source = 'somar 1 em contador_rancor';
    const parsed = executarParseLegadoOmni(migrarScriptLegadoOmni(source), options) as { efeitos: Array<{ target:string }> };
    expect(parsed.efeitos[0].target).toBe('USUARIO');
    expect(migrarScriptLegadoOmni(source)).not.toHaveProperty('opcoes');
  });
  it('mantém documentos naturais versionados fora do runtime antigo', () => {
    const source = 'ao acertar então aplicar condenado por 2 rodadas';
    const doc = { formato:'omni.script' as const, versao:2 as const, fonte:source };
    const lido = normalizarDocumentoOmni(doc);
    expect(lido).toMatchObject({ ok:true, linguagem:'natural', executavel:false, ast:{ tipo:'regra' } });
    if (lido.ok) expect(lido.documento).toEqual(doc);
    expect(executarParseLegadoOmni(doc)).toMatchObject({ codigo:'LINGUAGEM_NAO_EXECUTAVEL' });
    expect(preservarDocumentoOmni(doc)).toEqual(doc);
  });
  it('preserva texto natural inválido para correção, com diagnóstico e sem converter', () => {
    const doc = { formato:'omni.script' as const, versao:2 as const, fonte:'ao acertar causar' };
    const r = normalizarDocumentoOmni(doc);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.executavel).toBe(false);
    expect(r.documento.fonte).toBe(doc.fonte);
    expect(r.diagnosticos.length).toBeGreaterThan(0);
  });
  it('mantém fonte legada inválida, informa erro e não a declara pronta para execução', () => {
    const source = 'fazer algo';
    const r = normalizarDocumentoOmni(source);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.documento.fonte).toBe(source);
    expect(r.linguagem).toBe('legada');
    expect(r.executavel).toBe(false);
    expect(r.diagnosticos.length).toBeGreaterThan(0);
  });
  it('não adivinha formato novo para versão ausente, desconhecida ou documento truncado', () => {
    expect(normalizarDocumentoOmni('ao acertar então aplicar cego')).toMatchObject({ linguagem:'legada', executavel:false });
    expect(normalizarDocumentoOmni({ formato:'omni.script', versao:3, fonte:'sem sobrescrever' })).toMatchObject({ ok:false, diagnosticos:[{ codigo:'VERSAO_DESCONHECIDA' }] });
    expect(normalizarDocumentoOmni({ formato:'outro', versao:1, fonte:'x' } as never)).toMatchObject({ ok:false, diagnosticos:[{ codigo:'DOCUMENTO_INVALIDO' }] });
  });
});
