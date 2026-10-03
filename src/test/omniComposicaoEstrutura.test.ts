import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { COMPONENTES_OMNI } from '@/lib/omni/componentes/ids';
import { criarComposicao, serializarComposicao, desserializarComposicao, validarComposicao, type NoComposicao } from '@/lib/omni/componentes/composicao';

describe('Estrutura independente das composições OMNI', () => {
  const arma: NoComposicao = { tipo: 'selecao', componente: 'arma_principal' };

  it('mantém a seleção reutilizável e propriedades em nós diferentes', () => {
    const leve = criarComposicao('USUARIO', { tipo: 'filtro', componente: 'leve', entrada: arma });
    const versatil = criarComposicao('USUARIO', { tipo: 'filtro', componente: 'versatil', entrada: arma });
    expect(leve.consulta).toMatchObject({ componente: 'leve', entrada: arma });
    expect(versatil.consulta).toMatchObject({ componente: 'versatil', entrada: arma });
    expect(serializarComposicao(leve)).not.toContain('arma_principal_leve');
    expect(leve.consulta).not.toBe(versatil.consulta);
  });

  it('conserva a ordem estrutural de coleção, filtro e operação', () => {
    const consulta: NoComposicao = { tipo: 'operacao', componente: 'quantidade', entrada: { tipo: 'filtro', componente: 'sustentados', entrada: { tipo: 'selecao', componente: 'buffs' } } };
    const ref = criarComposicao('ALVO', consulta);
    expect(desserializarComposicao(serializarComposicao(ref))).toEqual({ ok: true, valor: ref });
  });

  it('distingue contexto e proveniência de consultas visualmente semelhantes', () => {
    const consulta: NoComposicao = { tipo: 'selecao', componente: 'buffs' };
    const atual = criarComposicao('USUARIO', consulta, { origem: 'qtd_buffs_sustentados', conversao: '225' });
    const antigo = criarComposicao('ALVO', consulta, { origem: 'qtd_sustentados', conversao: '251', perfil: 'sustentados_indefinidos' });
    expect(desserializarComposicao(serializarComposicao(antigo))).toEqual({ ok: true, valor: antigo });
    expect(atual.compatibilidade).not.toEqual(antigo.compatibilidade);
    expect(atual.contexto).not.toBe(antigo.contexto);
  });

  it('preserva identidade, conectores e argumentos completos sem normalizar nomes', () => {
    const consulta: NoComposicao = { tipo: 'vinculo', componentes: ['e'], entrada: { tipo: 'selecao', componente: 'outro' }, referencia: { tipo: 'selecao', componente: 'voce' } };
    const ref = criarComposicao('CENA', consulta);
    expect(ref.consulta).toEqual(consulta);
    const contador = criarComposicao('USUARIO', { tipo: 'qualificador', componente: 'fonte', entrada: { tipo: 'selecao', componente: 'contador', argumentos: { nome: { tipo: 'nome', valor: 'vida e brasas' } } }, argumentos: { id: { tipo: 'id', valor: 'reliquia_lunar' } } });
    expect(desserializarComposicao(serializarComposicao(contador))).toEqual({ ok: true, valor: contador });
  });

  it('conserva operador, unidade e valor do limiar', () => {
    const ref = criarComposicao('USUARIO', { tipo: 'comparacao', operador: '<=', esquerdo: { tipo: 'selecao', componente: 'vida' }, direito: { tipo: 'literal', unidade: 'percentual', valor: 25 } });
    expect(ref.consulta).toMatchObject({ operador: '<=', direito: { unidade: 'percentual', valor: 25 } });
  });

  it('copia entradas sem conservar referências mutáveis do chamador', () => {
    const consulta = { tipo: 'selecao' as const, componente: 'vida' as const, argumentos: { nome: { tipo: 'nome' as const, valor: 'original' } } };
    const ref = criarComposicao('USUARIO', consulta);
    consulta.argumentos.nome.valor = 'alterado';
    expect(ref.consulta).toMatchObject({ argumentos: { nome: { valor: 'original' } } });
  });

  it.each(['arma_principal leve', 'arma_principal_leve', 'desconhecido'])('rejeita componente fechado ou desconhecido: %s', componente => {
    expect(() => criarComposicao('USUARIO', { tipo: 'selecao', componente } as NoComposicao)).toThrow('Componente independente desconhecido');
  });

  it('rejeita dados não serializáveis, unidades inválidas e formatos estrangeiros', () => {
    const base = criarComposicao('USUARIO', arma);
    expect(validarComposicao({ ...base, consulta: { tipo: 'literal', valor: Infinity, unidade: 'numero' } })).not.toEqual([]);
    expect(validarComposicao({ ...base, formato: 'omni.composicao.v2' })).not.toEqual([]);
    expect(validarComposicao({ ...base, executar: () => 1 })).not.toEqual([]);
    expect(validarComposicao({ ...base, consulta: { tipo: 'selecao', componente: 'distancia', argumentos: { limite: { tipo: 'distancia', valor: 3, unidade: 'casas' } } } })).not.toEqual([]);
    expect(desserializarComposicao('{')).toMatchObject({ ok: false });
  });

  it('diagnostica árvore circular e profundidade excessiva', () => {
    const circular: Record<string, unknown> = { tipo: 'filtro', componente: 'leve' };
    circular.entrada = circular;
    expect(validarComposicao({ formato: 'omni.composicao.v1', contexto: 'USUARIO', consulta: circular }).some(e => e.mensagem.includes('circular'))).toBe(true);
    let consulta: NoComposicao = arma;
    for (let n = 0; n < 66; n++) consulta = { tipo: 'filtro', componente: 'leve', entrada: consulta };
    expect(() => criarComposicao('USUARIO', consulta)).toThrow('64 níveis');
  });

  it('tem os mesmos componentes independentes do contrato aprovado', () => {
    const doc = JSON.parse(readFileSync(new URL('../../docs/omni-componentes/catalogo.json', import.meta.url), 'utf8'));
    expect([...COMPONENTES_OMNI].sort()).toEqual(doc.componentes.map((c: { key: string }) => c.key).sort());
  });
});
