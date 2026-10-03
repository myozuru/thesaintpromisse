import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const catalogo = JSON.parse(readFileSync(new URL('../docs/omni-componentes/catalogo.json', import.meta.url), 'utf8'));
const unique = (items, key) => new Set(items.map(item => item[key])).size;
assert.equal(catalogo.componentes.length, 303);
assert.equal(unique(catalogo.componentes, 'id'), 303);
assert.equal(unique(catalogo.componentes, 'key'), 303);
assert.equal(catalogo.conversoes.length, 335);
assert.equal(unique(catalogo.conversoes, 'id'), 335);
assert.equal(unique(catalogo.conversoes, 'origem'), 335);
assert.equal(catalogo.parametros.length, 10);
assert.equal(catalogo.aliasesHistoricos.length, 81);
const components = new Map(catalogo.componentes.map(c => [c.id, c]));
const conversions = new Map(catalogo.conversoes.map(c => [c.id, c]));
const parameters = new Set(catalogo.parametros.map(p => p.marcador));
const used = new Set();
for (const c of catalogo.conversoes) {
  assert.ok(c.contextos.length > 0, c.origem);
  assert.ok(c.sequencia.length > 0, c.origem);
  for (const part of c.sequencia) {
    if (part.tipo === 'componente') {
      assert.ok(components.has(part.id), `${c.origem}: ${part.id}`);
      assert.ok(components.get(part.id).contextosPorConversao.includes(c.id));
      used.add(part.id);
    } else if (part.tipo === 'parametro') {
      assert.ok(parameters.has(part.marcador), part.marcador);
    } else {
      assert.equal(part.tipo, 'literal');
      assert.ok(Number.isFinite(part.valor));
    }
  }
}
assert.equal(used.size, 303, 'Componente sem uso registrado');
for (const a of catalogo.aliasesHistoricos) {
  assert.equal(conversions.get(a.conversao)?.origem, a.origem, a.alias);
}
const byOrigin = new Map(catalogo.conversoes.map(c => [c.origem, c]));
const parts = origin => byOrigin.get(origin).sequencia.map(p => p.tipo === 'componente' ? components.get(p.id).key : p.marcador ?? p.grafia);
assert.deepEqual(parts('arma_principal_leve'), ['arma_principal', 'leve']);
assert.deepEqual(parts('arma_principal_versatil'), ['arma_principal', 'versatil']);
assert.deepEqual(parts('arma_margem_critico'), ['margem_critico', 'arma_principal']);
assert.deepEqual(parts('cura_recebida_nesta_rodada'), ['cura', 'recebida', 'nesta', 'rodada']);
assert.deepEqual(parts('arma_principal_corpo_a_corpo'), ['arma_principal', 'corpo_a_corpo']);
for (const c of catalogo.componentes) {
  assert.ok(c.papel && c.funcao && c.exemplo, c.key);
  assert.equal(c.permissaoIsolada, 'nao_habilita_escrita');
}
for (const origin of ['vida_pct','pe_pct','vida_temp_pct','pe_faltante_pct']) {
  assert.equal(byOrigin.get(origin).contratoNumerico.unidade, 'percentual_0_100');
}
console.log('Catálogo válido: 303 componentes, 335 conversões, 10 parâmetros e 81 aliases.');
