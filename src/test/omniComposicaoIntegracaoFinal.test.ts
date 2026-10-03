import { describe, expect, it } from 'vitest';
import { avaliarFormula } from '@/lib/omni/parser';
import { dadosMagia } from '@/lib/omni/componentes/magia';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { executarGatilho } from '@/lib/omni/executor';
import { novaEntidade } from '@/lib/omni/tipos';
import { interpretarComposicao } from '@/lib/omni/componentes/interpretar';
import type { Character } from '@/types';

describe('integração final dos contextos compostos', () => {
  it('mantém resultados estáveis ao reutilizar o contexto em 1000 avaliações', () => {
    const composicoes = { USUARIO: { selecoes: { vida: { valor: 10, campos: { maximo: 40 } }, pe: { valor: 2, campos: { maximo: 4 } } } } };
    const inicio = performance.now(); let soma = 0;
    for (let i = 0; i < 1000; i++) {
      const r = avaliarFormula('percentual vida + percentual pe', {}, undefined, { composicoes });
      expect(r.diagnosticos).toEqual([]); soma += r.valor;
    }
    expect(soma).toBe(75000);
    console.info(`1000 avaliações compostas: ${(performance.now() - inicio).toFixed(1)} ms`);
  });
  it.each([
    ['@DANO.dano final', { dano: { valor_final: 8 } }],
    ['@CENA.mes', { cena: { mes: 8 } }],
  ])('o construtor executa a árvore %s com o evento atual', (texto, ctx) => {
    const entidade = novaEntidade('item');
    entidade.gatilhos = [{ id: 'g', evento: 'aoEquipar', blocos: [{ id: 'b', modo: 'todas', condicoes: [{ id: 'c', operador: 'IGUAL',
      esquerdo: { tipo: 'ref', ref: { alvo: 'USUARIO', caminho: texto, composicao: interpretarComposicao(texto).referencia! } },
      direito: { tipo: 'fixo', valor: 8 } }], acoes: [] }] }];
    expect(executarGatilho(entidade, 'aoEquipar', ctx)).toBe(1);
  });
  it.each(['fogo', 'DQ', 'chamas'])('tipo %s lê o mesmo evento vindo do executor', tipo => {
    const r = avaliarFormula(`@DANO.dano tipo ${tipo} * @DANO.dano final`, { DANO_TIPO: 7, DANO_VALOR_FINAL: 8 });
    expect(r.valor).toBe(8); expect(r.diagnosticos).toEqual([]);
  });
  it('normaliza somente tipos de dano, preservando IDs e nomes', () => {
    const c = { spells: [{ id: 'fogo', costPE: 2, spellType: 'damage', damageType: 'DQ', spellLevel: 1 }] } as unknown as Character;
    const r = avaliarFormula('quantidade feiticos elemento fogo + tem feitico fogo', {}, undefined, { composicoes: { USUARIO: dadosMagia(c, {}) } });
    expect(r.valor).toBe(2); expect(r.diagnosticos).toEqual([]);
  });
  it('separa percentual e consulta de alcance curto ao combinar duas fichas', () => {
    const c = { id: 'a', name: 'A', level: 1, hpCurrent: 10, hpMax: 40, peCurrent: 2, peMax: 4, hitDiceCurrent: 1, hitDiceMax: 2, attributes: [], skills: [], savingThrows: [] } as unknown as Character;
    const bag = { ...montarVariaveisDoPersonagem(c), ...montarVariaveisDoPersonagem({ ...c, id: 'b', hpCurrent: 20 }, 'ALVO') };
    const r = avaliarFormula('percentual vida + @ALVO.percentual vida + dado_vida restantes', bag);
    expect(r.valor).toBe(76); expect(r.diagnosticos).toEqual([]);
  });
});
