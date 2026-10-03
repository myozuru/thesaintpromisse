import { COMPONENTES_OMNI, type ComponenteOmni } from './ids';

export const FORMATO_COMPOSICAO = 'omni.composicao.v1' as const;
export const CONTEXTOS_COMPOSICAO = ['USUARIO', 'ALVO', 'CENA', 'DANO', 'ITEM', 'ARMA', 'AREA', 'FORMULA'] as const;
export type ContextoComposicao = (typeof CONTEXTOS_COMPOSICAO)[number];
export type ComparadorComposicao = '<' | '<=' | '==' | '!=' | '>=' | '>';

/** Argumentos preservam IDs e nomes completos; nunca são decompostos em keys. */
export type ArgumentoComposicao =
  | { readonly tipo: 'id' | 'nome' | 'grupo' | 'moeda' | 'tipo_dano' | 'fonte_dano'; readonly valor: string }
  | { readonly tipo: 'numero'; readonly valor: number }
  | { readonly tipo: 'distancia'; readonly valor: number; readonly unidade: 'metros' };

/** Valores constantes e referências de domínio ocupam nós distintos. */
export interface LiteralComposicao {
  readonly tipo: 'literal';
  readonly valor: number;
  readonly unidade: 'numero' | 'percentual';
}

export interface SelecaoComposicao {
  readonly tipo: 'selecao';
  readonly componente: ComponenteOmni;
  readonly argumentos?: Readonly<Record<string, ArgumentoComposicao>>;
}

export interface AplicacaoComponente {
  readonly tipo: 'operacao' | 'filtro' | 'qualificador';
  readonly componente: ComponenteOmni;
  readonly entrada: NoComposicao;
  readonly argumentos?: Readonly<Record<string, ArgumentoComposicao>>;
}

export interface VinculoComposicao {
  readonly tipo: 'vinculo';
  readonly componentes: readonly ComponenteOmni[];
  readonly entrada: NoComposicao;
  readonly referencia: NoComposicao;
}

export interface ComparacaoComposicao {
  readonly tipo: 'comparacao';
  readonly operador: ComparadorComposicao;
  readonly esquerdo: NoComposicao;
  readonly direito: NoComposicao;
}

export type NoComposicao = SelecaoComposicao | AplicacaoComponente | VinculoComposicao | LiteralComposicao | ComparacaoComposicao;

/** Proveniência não é uma key de autoria nem deve desaparecer numa migração. */
export interface CompatibilidadeComposicao {
  readonly origem: string;
  readonly alias?: string;
  readonly conversao?: string;
  readonly perfil?: 'sustentados_indefinidos' | 'grupo_duas_maos' | 'escudo_proficiencia';
}

export interface ReferenciaComposta {
  readonly formato: typeof FORMATO_COMPOSICAO;
  readonly contexto: ContextoComposicao;
  readonly consulta: NoComposicao;
  readonly compatibilidade?: CompatibilidadeComposicao;
}

export interface DiagnosticoComposicao {
  readonly caminho: string;
  readonly mensagem: string;
}

const componentes = new Set<string>(COMPONENTES_OMNI);
const comparadores = new Set(['<', '<=', '==', '!=', '>=', '>']);
const textuais = new Set(['id', 'nome', 'grupo', 'moeda', 'tipo_dano', 'fonte_dano']);
const perfis = new Set(['sustentados_indefinidos', 'grupo_duas_maos', 'escudo_proficiencia']);
const objeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const texto = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const finito = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Valida apenas a estrutura; elegibilidade e retorno da composição pertencem ao avaliador. */
export function validarComposicao(valor: unknown): readonly DiagnosticoComposicao[] {
  const erros: DiagnosticoComposicao[] = [];
  const pilha = new Set<object>();
  const erro = (caminho: string, mensagem: string) => { erros.push({ caminho, mensagem }); };
  function campos(v: Record<string, unknown>, permitidos: readonly string[], caminho: string) {
    for (const key of Object.keys(v)) if (!permitidos.includes(key)) erro(`${caminho}.${key}`, 'Campo não previsto no formato.');
  }
  function componente(v: unknown, caminho: string) {
    if (typeof v !== 'string' || !componentes.has(v)) erro(caminho, 'Componente independente desconhecido.');
  }
  function argumentos(v: unknown, caminho: string) {
    if (v === undefined) return;
    if (!objeto(v)) { erro(caminho, 'Esperado um mapa de argumentos.'); return; }
    for (const [key, arg] of Object.entries(v)) {
      const at = `${caminho}.${key}`;
      if (!texto(key) || !objeto(arg)) { erro(at, 'Argumento inválido.'); continue; }
      campos(arg, arg.tipo === 'distancia' ? ['tipo', 'valor', 'unidade'] : ['tipo', 'valor'], at);
      if (textuais.has(String(arg.tipo))) {
        if (!texto(arg.valor)) erro(at, 'O identificador ou nome precisa estar preenchido.');
      } else if (arg.tipo === 'numero' || arg.tipo === 'distancia') {
        if (!finito(arg.valor)) erro(at, 'O argumento deve ser um número finito.');
        if (arg.tipo === 'distancia' && (arg.unidade !== 'metros' || Number(arg.valor) < 0)) erro(at, 'Distância deve ser não negativa, em metros.');
      } else erro(at, 'Tipo de argumento desconhecido.');
    }
  }
  function no(v: unknown, caminho: string, profundidade: number) {
    if (profundidade > 64) { erro(caminho, 'Composição excede 64 níveis.'); return; }
    if (!objeto(v)) { erro(caminho, 'Esperado um nó de composição.'); return; }
    if (pilha.has(v)) { erro(caminho, 'Composição contém uma referência circular.'); return; }
    pilha.add(v);
    switch (v.tipo) {
      case 'selecao':
        campos(v, ['tipo', 'componente', 'argumentos'], caminho);
        componente(v.componente, `${caminho}.componente`);
        argumentos(v.argumentos, `${caminho}.argumentos`);
        break;
      case 'operacao': case 'filtro': case 'qualificador':
        campos(v, ['tipo', 'componente', 'entrada', 'argumentos'], caminho);
        componente(v.componente, `${caminho}.componente`);
        argumentos(v.argumentos, `${caminho}.argumentos`);
        no(v.entrada, `${caminho}.entrada`, profundidade + 1);
        break;
      case 'vinculo':
        campos(v, ['tipo', 'componentes', 'entrada', 'referencia'], caminho);
        if (!Array.isArray(v.componentes) || !v.componentes.length || v.componentes.length > 8) erro(`${caminho}.componentes`, 'Vínculo exige entre 1 e 8 componentes.');
        else v.componentes.forEach((c, i) => componente(c, `${caminho}.componentes.${i}`));
        no(v.entrada, `${caminho}.entrada`, profundidade + 1);
        no(v.referencia, `${caminho}.referencia`, profundidade + 1);
        break;
      case 'comparacao':
        campos(v, ['tipo', 'operador', 'esquerdo', 'direito'], caminho);
        if (!comparadores.has(String(v.operador))) erro(`${caminho}.operador`, 'Comparador desconhecido.');
        no(v.esquerdo, `${caminho}.esquerdo`, profundidade + 1);
        no(v.direito, `${caminho}.direito`, profundidade + 1);
        break;
      case 'literal':
        campos(v, ['tipo', 'valor', 'unidade'], caminho);
        if (!finito(v.valor)) erro(`${caminho}.valor`, 'Literal deve ser um número finito.');
        if (v.unidade !== 'numero' && v.unidade !== 'percentual') erro(`${caminho}.unidade`, 'Unidade de literal desconhecida.');
        break;
      default: erro(`${caminho}.tipo`, 'Tipo de nó desconhecido.');
    }
    pilha.delete(v);
  }
  if (!objeto(valor)) { erro('$', 'Esperada uma referência composta.'); return erros; }
  campos(valor, ['formato', 'contexto', 'consulta', 'compatibilidade'], '$');
  if (valor.formato !== FORMATO_COMPOSICAO) erro('$.formato', 'Formato ou versão de composição desconhecido.');
  if (!(CONTEXTOS_COMPOSICAO as readonly unknown[]).includes(valor.contexto)) erro('$.contexto', 'Contexto desconhecido.');
  no(valor.consulta, '$.consulta', 0);
  if (valor.compatibilidade !== undefined) {
    const c = valor.compatibilidade;
    if (!objeto(c)) erro('$.compatibilidade', 'Proveniência inválida.');
    else {
      campos(c, ['origem', 'alias', 'conversao', 'perfil'], '$.compatibilidade');
      if (!texto(c.origem)) erro('$.compatibilidade.origem', 'Origem legada precisa estar preenchida.');
      if (c.alias !== undefined && !texto(c.alias)) erro('$.compatibilidade.alias', 'Alias inválido.');
      if (c.conversao !== undefined && (typeof c.conversao !== 'string' || !/^\d{3}$/.test(c.conversao))) erro('$.compatibilidade.conversao', 'Conversão deve preservar seu ID de três dígitos.');
      if (c.perfil !== undefined && !perfis.has(String(c.perfil))) erro('$.compatibilidade.perfil', 'Perfil de compatibilidade desconhecido.');
    }
  }
  return erros;
}

function exigirValida(valor: unknown): asserts valor is ReferenciaComposta {
  const erros = validarComposicao(valor);
  if (erros.length) throw new Error(erros.map(e => `${e.caminho}: ${e.mensagem}`).join('\n'));
}

/** Produz um snapshot JSON independente da árvore entregue pelo chamador. */
export function criarComposicao(contexto: ContextoComposicao, consulta: NoComposicao, compatibilidade?: CompatibilidadeComposicao): ReferenciaComposta {
  const valor = { formato: FORMATO_COMPOSICAO, contexto, consulta, ...(compatibilidade ? { compatibilidade } : {}) };
  exigirValida(valor);
  return JSON.parse(JSON.stringify(valor)) as ReferenciaComposta;
}

export function serializarComposicao(valor: ReferenciaComposta): string {
  exigirValida(valor);
  return JSON.stringify(valor);
}

export type LeituraComposicao =
  | { readonly ok: true; readonly valor: ReferenciaComposta }
  | { readonly ok: false; readonly diagnosticos: readonly DiagnosticoComposicao[] };

export function desserializarComposicao(json: string): LeituraComposicao {
  let valor: unknown;
  try { valor = JSON.parse(json); }
  catch { return { ok: false, diagnosticos: [{ caminho: '$', mensagem: 'JSON inválido.' }] }; }
  const diagnosticos = validarComposicao(valor);
  return diagnosticos.length ? { ok: false, diagnosticos } : { ok: true, valor: valor as ReferenciaComposta };
}
