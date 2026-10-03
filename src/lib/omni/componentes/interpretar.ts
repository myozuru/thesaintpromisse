import { criarComposicao, type ArgumentoComposicao, type ContextoComposicao, type NoComposicao, type ReferenciaComposta } from './composicao';
import { tokenizarComposicao, type TokenComposicao } from './lexer';
import type { ComponenteOmni } from './ids';

const operacoes = new Set<ComponenteOmni>(['quantidade','tem','max','maximo','maximos','minimo','percentual','porcentagem','bonus','margem_critico','reducao','restante','restantes','livre','idade','custo','velocidade','duração','rolagem','posicao','indice','total','recuperavel']);
const argumentosSelecao: Partial<Record<ComponenteOmni, ArgumentoComposicao['tipo']>> = { contador: 'nome', condicao: 'id', item: 'id', feitico: 'id', talento: 'id', habilidade: 'id', origem: 'id', especializacao: 'id', buff: 'nome', moeda: 'moeda', aptidao: 'id' };
const opcoesSemArgumento: Partial<Record<ComponenteOmni, readonly string[]>> = { feitico: ['pronto','anterior'], aptidao: ['au','cl','bar','dom','er'], buff: [], item: [], condicao: [], especializacao: [], origem: [] };

export interface InterpretacaoComposicao {
  referencia?: ReferenciaComposta;
  consumido: number;
  erro?: string;
}

/** Constrói uma árvore por papéis; não procura frases completas no catálogo. */
export function interpretarComposicao(texto: string, contextoPadrao: ContextoComposicao = 'USUARIO'): InterpretacaoComposicao {
  const lexico = tokenizarComposicao(texto);
  const ts = lexico.tokens;
  let i = 0;
  let contexto = contextoPadrao;
  if (ts[i]?.tipo === 'contexto') contexto = ts[i++].valor as ContextoComposicao;
  else if (ts[i]?.tipo === 'pontuacao' && ts[i].valor === '@') i++;
  let ultimo = ts[i - 1]?.fim ?? 0;
  const usar = () => { const t = ts[i++]; ultimo = t.fim; return t; };
  const key = (t?: TokenComposicao): ComponenteOmni | undefined => t?.tipo === 'componente' ? t.valor : undefined;
  function argumento(tipo: ArgumentoComposicao['tipo']): ArgumentoComposicao {
    const t = ts[i];
    if (!t) throw new Error('Falta o argumento da seleção.');
    if (tipo === 'numero' || tipo === 'distancia') {
      if (t.tipo !== 'numero') throw new Error('Argumento deve ser um número.');
      usar();
      return tipo === 'numero' ? { tipo, valor: t.valor } : { tipo, valor: t.valor, unidade: 'metros' };
    }
    if (!['componente','identificador','argumento','numero'].includes(t.tipo)) throw new Error('Falta o ID ou nome da seleção.');
    usar();
    let valor = String(t.valor);
    // IDs com hífen/números são argumentos inteiros quando escritos sem espaços.
    if (t.tipo !== 'argumento') {
      while (ts[i] && ts[i].inicio === ultimo && (ts[i].tipo === 'identificador' || ts[i].tipo === 'numero' || (ts[i].tipo === 'operador' && ts[i].valor === '-'))) usar();
      valor = texto.slice(t.inicio, ultimo);
    }
    return { tipo, valor } as ArgumentoComposicao;
  }
  try {
    const prefixos: ComponenteOmni[] = [];
    while (key(ts[i]) && operacoes.has(key(ts[i])!) && key(ts[i + 1])) prefixos.push(usar().valor as ComponenteOmni);
    const raiz = key(ts[i]);
    if (!raiz) return { consumido: 0 };
    usar();
    const args: Record<string, ArgumentoComposicao> = {};
    const tipoArg = argumentosSelecao[raiz];
    if (tipoArg && !opcoesSemArgumento[raiz]?.includes(String(ts[i]?.valor))) args[tipoArg] = argumento(tipoArg);
    if (raiz === 'saldo' && ts[i] && !['padrao','pessoal','total'].includes(String(ts[i].valor))) args.moeda = argumento('moeda');
    let no: NoComposicao = { tipo: 'selecao', componente: raiz, ...(Object.keys(args).length ? { argumentos: args } : {}) };
    const sufixos: ComponenteOmni[] = [];
    while (i < ts.length) {
      const c = key(ts[i]);
      if (!c) break;
      if (c === 'e' && !(raiz === 'outro' && key(ts[i + 1]) === 'voce')) break;
      usar();
      if (['neste','nesta','no','e'].includes(c) || (c === 'ate' && key(ts[i]) === 'minha_vez')) {
        const ref = key(ts[i]);
        if (!ref) throw new Error(`Falta o destino de ${c}.`);
        usar();
        no = { tipo: 'vinculo', componentes: [c], entrada: no, referencia: { tipo: 'selecao', componente: ref } };
      } else if (c === 'ate') {
        const t = ts[i];
        if (t?.tipo !== 'percentual' || ![25,50].includes(t.valor)) throw new Error('Use um limiar percentual aprovado: 25% ou 50%.');
        usar();
        no = { tipo: 'comparacao', operador: '<=', esquerdo: no, direito: { tipo: 'literal', unidade: 'percentual', valor: t.valor } };
      } else if (['max','maximo','maximos','minimo','percentual','porcentagem'].includes(c)) sufixos.push(c);
      else if (operacoes.has(c) && !(raiz === 'acao' && c === 'bonus')) no = { tipo: 'operacao', componente: c, entrada: no };
      else {
        const argumentoTipo = c === 'grupo' ? 'grupo' : c === 'fonte' ? (raiz === 'dano' ? 'fonte_dano' : 'id') : c === 'tipo' && key(ts[i]) !== 'ataque' ? 'tipo_dano' : c === 'elemento' ? 'tipo_dano' : c === 'nivel' && ts[i]?.tipo === 'numero' ? 'numero' : undefined;
        const argumentoValor = argumentoTipo ? argumento(argumentoTipo) : undefined;
        no = { tipo: 'qualificador', componente: c, entrada: no, ...(argumentoValor ? { argumentos: { valor: argumentoValor } } : {}) };
      }
    }
    for (const c of sufixos) no = { tipo: 'operacao', componente: c, entrada: no };
    for (const c of prefixos.reverse()) no = { tipo: 'operacao', componente: c, entrada: no };
    if ((raiz === 'distancia' || raiz === 'rodada') && ts[i]?.tipo === 'numero') throw new Error('Informe o comparador explicitamente, por exemplo <= 3 ou >= 3.');
    const erroLexico = lexico.erros.find(e => e.inicio <= ultimo);
    if (erroLexico) throw new Error(erroLexico.mensagem);
    return { referencia: criarComposicao(contexto, no), consumido: ultimo };
  } catch (e) { return { consumido: ultimo, erro: e instanceof Error ? e.message : String(e) }; }
}
