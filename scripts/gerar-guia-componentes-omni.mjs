import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const arquivo = process.argv[2];
if (!arquivo) throw new Error('Informe o arquivo da especificação aprovada como argumento.');
const fonte = readFileSync(arquivo, 'utf8');
const contrato = JSON.parse(readFileSync('docs/omni-componentes/catalogo.json', 'utf8'));
if (createHash('sha256').update(fonte).digest('hex') !== contrato.fonteSha256) throw new Error('A fonte não corresponde ao contrato aprovado. Atualize o contrato antes de regenerar o guia.');
const blocos = fonte.split(/^\[(\d{3})\/335\] ([^\n]+)\n/m);
const exemplos = [];
for (let i = 1; i < blocos.length; i += 3) {
  const [id, cabecalho, corpo] = blocos.slice(i, i + 3);
  const campo = nome => corpo.split('\n').find(l => l.startsWith(`${nome}: `))?.slice(nome.length + 2) ?? '';
  exemplos.push({ id, origem: cabecalho.split(' -> ')[0], modelo: campo('Forma composta enviada'),
    formula: campo('Exemplo da composição (ilustrativo)'), explicacao: campo('Funcionamento detalhado da origem'),
    legado: campo('Fórmula antiga para comparação'), aliases: campo('Aliases históricos desta origem') });
}
if (exemplos.length !== 335 || exemplos.some(e => !e.formula || !e.explicacao)) throw new Error('Há exemplos individuais ausentes.');
// Contratos numéricos e parâmetros executáveis conferidos com o motor.
for (const e of exemplos) {
  if (e.id === '320' || e.id === '325') e.formula = e.formula.replace('0.25', '25');
  if (e.id === '141') {
    e.formula = e.formula.replace('[id]', 'sh-leve');
    e.explicacao += ' Neste exemplo, sh-leve é o ID do Escudo Leve; outro escudo equipado não satisfaz essa consulta.';
  }
}
// Consultas de leitura não são destinos de comandos. Exemplos específicos usam
// contadores declarados pela mesa quando precisam registrar um orçamento narrativo.
const ajustes = {
 '008': ['se @USUARIO.oportunidade consumida = 0 entao subtrair 1 em @USUARIO.oportunidade restantes, subtrair 1d10 em @ALVO.vida', 'O contra-golpe exige que nenhuma oportunidade tenha sido consumida. Consome uma oportunidade restante e causa 1d10 ao alvo. A consulta consumida é somente leitura; configure o gatilho de saída de alcance e o limite de oportunidades na mesa.'],
 '043': ['definir 1d20 + @USUARIO.bonus ataque magia em @USUARIO.contador resultado_magico', 'Registra uma rolagem de ataque mágico no contador resultado_magico. Com bônus +5 e dado 12, grava 17. Compare esse resultado com a Defesa do alvo no fluxo do feitiço; gravar o resultado não aplica dano automaticamente.'],
 '139': ['se @USUARIO.aptidao er >= 1 entao somar 2 em @USUARIO.contador espacos_expansao', 'Quando ER é pelo menos 1, registra dois espaços adicionais no contador espacos_expansao para uma regra de Expansão da mesa. ER 0 não concede espaços. Esse contador não altera automaticamente o limite nativo de concentração.'],
 '255': ['se @USUARIO.reacao disponivel > 0 entao subtrair 1 em @USUARIO.reacao restantes, somar 3 em @USUARIO.defesa', 'A defesa reativa exige uma reação disponível. Consome uma reação restante e acrescenta 3 à Defesa. Configure o gatilho de ataque declarado e a remoção desse bônus após o ataque; a fórmula sozinha não define sua duração.'],
 '256': ['se @USUARIO.reacao usada = 0 entao subtrair 1 em @USUARIO.reacao restantes, somar 1 em @USUARIO.vida temporaria', 'A postura exige que nenhuma reação tenha sido usada, consome uma reação restante e concede 1 PV temporário. A consulta usada não é um marcador gravável. Configure o limite e a renovação de reações no combate.'],
 '329': ['definir @USUARIO.maximo vigor_maldito em @USUARIO.contador cargas_vigor', 'No início do dia, copia a capacidade de Vigor Maldito para o contador cargas_vigor desta regra personalizada. Com máximo 4, grava 4. O contador deve ser usado como custo pela ação correspondente; ele não modifica os usos nativos da habilidade.'],
 '330': ['se @USUARIO.usos vigor_maldito > 0 e @USUARIO.contador cargas_vigor > 0 entao subtrair 1 em @USUARIO.contador cargas_vigor, somar 2d8 + @USUARIO.bonus vigor_maldito em @USUARIO.vida', 'A cura exige usos nativos disponíveis e uma carga no contador cargas_vigor da regra personalizada. Consome uma carga desse contador e cura 2d8 mais o bônus de Vigor Maldito. Não consome os usos nativos automaticamente: para usar esse exemplo, vincule também o custo nativo no construtor.'],
};
for (const e of exemplos) {
 if (ajustes[e.id]) [e.formula, e.explicacao] = ajustes[e.id];
 if (e.formula.includes('em @USUARIO.movimento restante')) {
   e.formula = e.formula.replaceAll('em @USUARIO.movimento restante', 'em @USUARIO.contador metros_taticos');
   e.explicacao = e.explicacao.replaceAll('orçamento de movimento', 'contador metros_taticos').replaceAll('movimento restante', 'saldo de metros_taticos').replaceAll('deslocamento restante', 'saldo de metros_taticos');
   e.explicacao += ' Neste exemplo, metros_taticos é um contador de distância criado pela mesa. Inicialize-o antes da ação e vincule-o à regra de deslocamento personalizada; ele não altera automaticamente o orçamento do mapa.';
 }
}
const componentes = contrato.componentes.map(c => Object.fromEntries(['id','key','papel','funcao','exemplo','contextosPorConversao'].map(k => [k,c[k]])));
writeFileSync('src/lib/omni/componentes/catalogoUI.ts', `// Descrições individuais do contrato aprovado.\nexport const CATALOGO_COMPONENTES_UI = ${JSON.stringify(componentes)} as const;\n`);
writeFileSync('src/lib/omni/componentes/exemplosUI.ts', `// Exemplos individuais da especificação, com contratos numéricos verificados.\nexport const EXEMPLOS_COMPONENTES_UI = ${JSON.stringify(exemplos)} as const;\n`);
console.log(`${componentes.length} componentes e ${exemplos.length} exemplos individuais gerados.`);
