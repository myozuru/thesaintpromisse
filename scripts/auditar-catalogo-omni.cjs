/* Inventário estático. Referências de código não comprovam o funcionamento pela UI. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function carregar(file) {
  const absolute = path.resolve(root, file);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const module = { exports: {} }; cache.set(absolute, module);
  const src = fs.readFileSync(absolute, 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const requireLocal = name => name.startsWith('.') ? carregar(path.relative(root, path.resolve(path.dirname(absolute), name + '.ts'))) : require(name);
  new Function('require', 'module', 'exports', js)(requireLocal, module, module.exports);
  return module.exports;
}
function registroLiteral(file, nome) {
  const src = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
  let resultado;
  function visitar(no) {
    if (ts.isVariableDeclaration(no) && no.name.getText(src) === nome && no.initializer && ts.isObjectLiteralExpression(no.initializer)) {
      resultado = Object.fromEntries(no.initializer.properties.map(p => {
        if (!ts.isPropertyAssignment(p) || !ts.isStringLiteral(p.initializer)) throw new Error(`Registro não literal: ${nome}`);
        const key = ts.isStringLiteral(p.name) ? p.name.text : p.name.getText(src);
        return [key, p.initializer.text];
      }));
    }
    ts.forEachChild(no, visitar);
  }
  visitar(src);
  if (!resultado) throw new Error(`Registro não encontrado: ${nome}`);
  return resultado;
}
const atalhosParser = registroLiteral('src/lib/omni/parser.ts', 'ATALHOS_PT_BR');
const aliasesDano = registroLiteral('src/lib/omni/parser.ts', 'ALIASES_DANO');
const aliasesEscrita = registroLiteral('src/lib/omni/omniScript.ts', 'ALIASES_RECURSO');
function arquivos(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? arquivos(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
const c = carregar('src/lib/omni/constantesDoSistema.ts');
const aliases = carregar('src/lib/omni/gatilhoAliases.ts');
const keys = carregar('src/lib/omni/keyAliases.ts');
const ids = carregar('src/lib/omni/componentes/ids.ts').COMPONENTES_OMNI;
const ui = carregar('src/lib/omni/componentes/catalogoUI.ts').CATALOGO_COMPONENTES_UI;
const ex = carregar('src/lib/omni/componentes/exemplosUI.ts').EXEMPLOS_COMPONENTES_UI;
const corr = Object.values(carregar('src/lib/omni/componentes/correspondencias.ts')).find(Array.isArray);
const guia = carregar('src/lib/omni/guiaDados.ts');
const prod = arquivos(path.join(root, 'src')).filter(f => /\.tsx?$/.test(f) && !f.includes('/test/') && !/\.(test|spec)\./.test(f));
const fonte = prod.filter(f => !/\/(constantesDoSistema|gatilhoAliases|guiaDados)\.ts$/.test(f)).map(f => ({ arquivo: path.relative(root, f), linhas: fs.readFileSync(f, 'utf8').split(/\r?\n/) }));
const referencias = (evento, constante) => fonte.flatMap(f => f.linhas.flatMap((linha, i) => {
  if (!linha.includes(`'${evento}'`) && !linha.includes(`"${evento}"`) && !linha.includes(`GATILHOS_EVENTOS.${constante}`)) return [];
  if (/^\s*(\/\/|\*|\/\*)/.test(linha)) return [];
  return [{ arquivo: f.arquivo, linha: i + 1, trecho: linha.trim().slice(0, 220) }];
}));
const gatilhos = Object.entries(c.GATILHOS_EVENTOS).map(([constante, id]) => ({ id, constante, aliases: aliases.ALIASES_POR_EVENTO[id], referencias: referencias(id, constante), estado: 'requer_validacao_do_fluxo_real' }));
const exec = fs.readFileSync(path.join(root, 'src/lib/omni/executor.ts'), 'utf8');
const primitivas = Object.entries(c.ACOES_EFEITO).map(([id, info]) => ({ id, ...info, temCaseExecutor: exec.includes(`case '${id}'`), estado: 'requer_validacao_do_fluxo_real' }));
const variaveis = c.DICIONARIO_CHAVES_OMNI.flatMap(cat => cat.itens.map(key => ({ ...key, categoria: cat.label ?? cat.id })));
const duplicados = list => [...new Set(list)].filter(v => list.filter(x => x === v).length > 1);
const aliasEventos = gatilhos.flatMap(g => g.aliases.map(a => ({ alias: a, evento: g.id })));
const conflitosAliases = duplicados(aliasEventos.map(a => a.alias)).filter(a => new Set(aliasEventos.filter(x => x.alias === a).map(x => x.evento)).size > 1);
const aliasesDoGuia = new Set(guia.CHAVES_GUIA_OMNI.flatMap(k => [k.id, ...k.aliases]));
const resumo = { componentes: ids.length, cardsComponentes: ui.length, composicoes: corr.length, exemplosComponentes: ex.length, entradasDicionarioLegado: variaveis.length, idsLegadosUnicos: new Set(variaveis.map(v => v.id)).size, cardsGuiaLegado: guia.CHAVES_GUIA_OMNI.length, aliasesChaves: Object.keys(keys.LEGACY_TO_CANONICAL).length, atalhosParser: Object.keys(atalhosParser).length, aliasesDano: Object.keys(aliasesDano).length, aliasesEscrita: Object.keys(aliasesEscrita).length, gatilhos: gatilhos.length, aliasesGatilhos: aliasEventos.length, primitivas: primitivas.length };
const verificacoes = { componentesSemCard: ids.filter(id => !ui.some(k => k.key === id)), cardsSemComponente: ui.filter(k => !ids.includes(k.key)).map(k => k.key), componentesDuplicados: duplicados(ids), conflitosAliasesGatilhos: conflitosAliases, primitivasSemCase: primitivas.filter(p => !p.temCaseExecutor).map(p => p.id), gatilhosSemReferenciaDeProducao: gatilhos.filter(g => !g.referencias.length).map(g => g.id), idsLegadosRepetidos: duplicados(variaveis.map(v => v.id)), entradasLegadasSemCardOuAlias: variaveis.filter(v => !aliasesDoGuia.has(v.id)).map(v => v.id) };
const report = { commitRevisado: process.argv[2] ?? 'workspace', escopo: 'etapa 1/10: inventario estatico; nao constitui certificacao funcional', resumo, verificacoes, componentes: ui, composicoes: corr, variaveisLegadas: variaveis, aliasesChaves: keys.LEGACY_TO_CANONICAL, atalhosParser, aliasesDano, aliasesEscrita, gatilhos, primitivas };
fs.writeFileSync(path.join(root, 'docs/omni-auditoria/etapa-01-inventario.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ resumo, verificacoes }, null, 2));
if (verificacoes.componentesSemCard.length || verificacoes.cardsSemComponente.length || verificacoes.conflitosAliasesGatilhos.length || verificacoes.primitivasSemCase.length) process.exitCode = 1;
