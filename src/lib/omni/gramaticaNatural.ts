import { tokenizarNatural, type TokenNatural } from './lexerNatural';

export interface IntervaloNatural { inicio: number; fim: number }
export type PredicadoNatural =
  | { tipo: 'atomo'; classe: 'condicao' | 'evento'; texto: string; intervalo: IntervaloNatural }
  | { tipo: 'e' | 'ou'; esquerda: PredicadoNatural; direita: PredicadoNatural; intervalo: IntervaloNatural };
export interface AcaoNatural { tipo: 'acao'; verbo: string; texto: string; intervalo: IntervaloNatural }
export interface FraseNatural { tipo: 'regra'; condicao: PredicadoNatural; acoes: AcaoNatural[]; intervalo: IntervaloNatural }
export interface ErroGramaticaNatural extends IntervaloNatural { mensagem: string }
export interface ResultadoGramaticaNatural { ast?: FraseNatural; erros: ErroGramaticaNatural[] }

const verbos = new Set(['aplicar','remover','imune','desimune','acumular','somar','subtrair','reduzir','definir','anular','ignorar','gastar','causar','curar','conceder','receber','recuperar','drenar','empurrar','puxar','avancar','teleportar','trocar','transferir','marcar','criar','cancelar','maximizar','rerrolar']);
const palavra = (token: TokenNatural | undefined) => token?.tipo === 'palavra' ? token.normalizado : undefined;
const abertura = (t: TokenNatural | undefined) => t?.tipo === 'pontuacao' && t.valor === '(';
const fechamento = (t: TokenNatural | undefined) => t?.tipo === 'pontuacao' && t.valor === ')';

function intervalo(tokens: TokenNatural[], inicio: number, fim: number): IntervaloNatural {
  return { inicio: tokens[inicio]?.inicio ?? 0, fim: tokens[fim - 1]?.fim ?? tokens[inicio]?.inicio ?? 0 };
}
function textoFonte(fonte: string, tokens: TokenNatural[], inicio: number, fim: number): string {
  return fonte.slice(tokens[inicio]?.inicio ?? 0, tokens[fim - 1]?.fim ?? tokens[inicio]?.inicio ?? 0).trim();
}

function validarParenteses(tokens: TokenNatural[], inicio: number, fim: number, erros: ErroGramaticaNatural[]): boolean {
  const pilha: number[] = [];
  for (let i = inicio; i < fim; i++) {
    if (abertura(tokens[i])) pilha.push(i);
    else if (fechamento(tokens[i])) {
      const abre = pilha.pop();
      if (abre === undefined) { erros.push({ inicio: tokens[i].inicio, fim: tokens[i].fim, mensagem: 'Parêntese de fechamento sem abertura.' }); return false; }
    }
  }
  if (pilha.length) {
    const token = tokens[pilha[pilha.length - 1]];
    erros.push({ inicio: token.inicio, fim: token.fim, mensagem: 'Expressão entre parênteses não foi fechada.' }); return false;
  }
  return true;
}

/** `e` tem precedência maior que `ou`; grupos entre parênteses têm prioridade. */
function predicado(fonte: string, tokens: TokenNatural[], inicio: number, fim: number, erros: ErroGramaticaNatural[]): PredicadoNatural | undefined {
  while (abertura(tokens[inicio]) && fechamento(tokens[fim - 1])) {
    let nivel = 0, fechaNoFim = false;
    for (let i = inicio; i < fim; i++) {
      if (abertura(tokens[i])) nivel++;
      if (fechamento(tokens[i])) nivel--;
      if (nivel === 0) { fechaNoFim = i === fim - 1; break; }
    }
    if (!fechaNoFim) break;
    inicio++; fim--;
  }
  if (inicio >= fim) { erros.push({ ...intervalo(tokens, inicio, fim), mensagem: 'Condição vazia; informe um estado ou evento.' }); return; }

  for (const operador of ['ou','e'] as const) {
    const posicoes: number[] = []; let nivel = 0;
    for (let i = inicio; i < fim; i++) {
      if (abertura(tokens[i])) nivel++;
      else if (fechamento(tokens[i])) nivel--;
      else if (nivel === 0 && palavra(tokens[i]) === operador) posicoes.push(i);
    }
    if (posicoes.length) {
      const partes: PredicadoNatural[] = []; let comeco = inicio;
      for (const p of posicoes) {
        const parte = predicado(fonte, tokens, comeco, p, erros);
        if (parte) partes.push(parte);
        comeco = p + 1;
      }
      const final = predicado(fonte, tokens, comeco, fim, erros);
      if (final) partes.push(final);
      if (partes.length !== posicoes.length + 1) return;
      return partes.slice(1).reduce((esquerda, direita) => ({ tipo: operador, esquerda, direita, intervalo: { inicio: esquerda.intervalo.inicio, fim: direita.intervalo.fim } }), partes[0]);
    }
  }

  if (abertura(tokens[inicio]) || fechamento(tokens[fim - 1])) {
    erros.push({ ...intervalo(tokens, inicio, fim), mensagem: 'Agrupamento inválido na condição.' }); return;
  }
  const texto = textoFonte(fonte, tokens, inicio, fim);
  if (!texto) { erros.push({ ...intervalo(tokens, inicio, fim), mensagem: 'Condição sem conteúdo.' }); return; }
  const inicioNorm = palavra(tokens[inicio]);
  const classe = inicioNorm === 'ao' || inicioNorm === 'aos' || inicioNorm === 'quando' || inicioNorm === 'no' || inicioNorm === 'na' ? 'evento' : 'condicao';
  return { tipo: 'atomo', classe, texto, intervalo: intervalo(tokens, inicio, fim) };
}

function acoes(fonte: string, tokens: TokenNatural[], inicio: number, fim: number, erros: ErroGramaticaNatural[]): AcaoNatural[] {
  if (inicio >= fim) { erros.push({ ...intervalo(tokens, inicio, fim), mensagem: 'Regra sem ação depois de "então".' }); return []; }
  const cortes: number[] = []; let nivel = 0;
  for (let i = inicio; i < fim; i++) {
    if (abertura(tokens[i])) nivel++;
    else if (fechamento(tokens[i])) nivel--;
    else if (nivel === 0 && palavra(tokens[i]) === 'e' && verbos.has(palavra(tokens[i + 1]) ?? '')) cortes.push(i);
  }
  const saida: AcaoNatural[] = []; let comeco = inicio;
  for (const corte of [...cortes, fim]) {
    if (comeco >= corte) { erros.push({ ...intervalo(tokens, comeco, corte), mensagem: 'Ação vazia no encadeamento.' }); return []; }
    const verbo = palavra(tokens[comeco]);
    if (!verbo || !verbos.has(verbo)) {
      erros.push({ inicio: tokens[comeco].inicio, fim: tokens[comeco].fim, mensagem: `Comando não reconhecido: "${tokens[comeco].valor}".` }); return [];
    }
    saida.push({ tipo: 'acao', verbo, texto: textoFonte(fonte, tokens, comeco, corte), intervalo: intervalo(tokens, comeco, corte) });
    comeco = corte + 1;
  }
  return saida;
}

/** Analisa uma única linha natural sem executar ou interpretar comandos. */
export function analisarFraseNatural(fonte: string): ResultadoGramaticaNatural {
  const lexico = tokenizarNatural(fonte);
  if (lexico.erros.length) return { erros: lexico.erros.map(e => ({ inicio:e.inicio, fim:e.fim, mensagem:e.mensagem })) };
  const tokens = lexico.tokens, erros: ErroGramaticaNatural[] = [];
  if (!tokens.length) return { erros: [{ inicio:0, fim:fonte.length, mensagem:'A regra está vazia.' }] };
  if (!validarParenteses(tokens, 0, tokens.length, erros)) return { erros };
  let nivel = 0; const separadores: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (abertura(tokens[i])) nivel++;
    else if (fechamento(tokens[i])) nivel--;
    else if (nivel === 0 && palavra(tokens[i]) === 'entao') separadores.push(i);
  }
  if (separadores.length !== 1) return { erros: [{ ...intervalo(tokens, separadores[1] ?? 0, (separadores[1] ?? 0) + 1), mensagem: separadores.length ? 'Use um único "então" para separar condição e ações.' : 'Falta "então" entre condição/evento e ação.' }] };
  const separador = separadores[0]; let inicioCondicao = 0;
  if (palavra(tokens[0]) === 'se') inicioCondicao++;
  const condicao = predicado(fonte, tokens, inicioCondicao, separador, erros);
  const lista = acoes(fonte, tokens, separador + 1, tokens.length, erros);
  if (erros.length || !condicao || !lista.length) return { erros };
  return { ast: { tipo:'regra', condicao, acoes:lista, intervalo:{ inicio:0, fim:fonte.length } }, erros:[] };
}
