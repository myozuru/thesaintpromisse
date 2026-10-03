import { validarComposicao, type NoComposicao, type ReferenciaComposta } from './composicao';

export interface RegistroComposto {
  readonly valor?: number | boolean | string;
  readonly campos?: Readonly<Record<string, DadoComposto>>;
  readonly registros?: Readonly<Record<string, DadoComposto>>;
  readonly propriedades?: readonly string[];
  readonly quantidade?: number;
  readonly padrao?: DadoComposto;
  readonly id?: string;
  readonly existe?: boolean;
}
export type DadoComposto = number | boolean | string | RegistroComposto | readonly DadoComposto[] | undefined;
export interface DadosComposicao { readonly selecoes: Readonly<Record<string, DadoComposto>> }
export type ResultadoComposicao = { ok: true; valor: number } | { ok: false; mensagem: string };
const registro = (d: DadoComposto): d is RegistroComposto => !!d && typeof d === 'object' && !Array.isArray(d);
const escalar = (d: DadoComposto): number => {
  if (typeof d === 'number' && Number.isFinite(d)) return d;
  if (typeof d === 'boolean') return d ? 1 : 0;
  if (registro(d) && d.valor !== undefined) return escalar(d.valor);
  throw new Error('A seleção não fornece um valor numérico neste contexto.');
};
function campo(d: DadoComposto, key: string): DadoComposto {
  if (registro(d) && d.campos && Object.hasOwn(d.campos, key)) return d.campos[key];
  if (registro(d) && d.propriedades && ['leve','pesada','versatil','fineza','corpo_a_corpo','distancia','critico_ampliado'].includes(key)) return d.propriedades.includes(key);
  throw new Error(`Componente ${key} não se aplica à seleção atual.`);
}
function comArgumentos(d: DadoComposto, args?: Readonly<Record<string, { valor: number | string }>>): DadoComposto {
  if (!args || !Object.keys(args).length) return d;
  const arg = Object.values(args)[0].valor;
  if (registro(d) && d.registros) return Object.hasOwn(d.registros, String(arg)) ? d.registros[String(arg)] : d.padrao;
  if (Array.isArray(d)) return d.filter(x => registro(x) && (x.id === String(arg) || x.valor === arg));
  return escalar(d === arg);
}

/** Operações compartilhadas, sem funções registradas para frases completas. */
export function avaliarComposicao(ref: ReferenciaComposta, dados: DadosComposicao): ResultadoComposicao {
  const invalidos = validarComposicao(ref);
  if (invalidos.length) return { ok: false, mensagem: invalidos[0].mensagem };
  function no(n: NoComposicao): DadoComposto {
    if (n.tipo === 'literal') return n.valor;
    if (n.tipo === 'selecao') {
      if (!Object.hasOwn(dados.selecoes, n.componente)) throw new Error(`Seleção ausente no contexto: ${n.componente}.`);
      return comArgumentos(dados.selecoes[n.componente], n.argumentos);
    }
    if (n.tipo === 'comparacao') {
      const left = no(n.esquerdo), right = no(n.direito);
      let a = escalar(left), b = escalar(right);
      if (n.direito.tipo === 'literal' && n.direito.unidade === 'percentual' && registro(left)) {
        const max = escalar(left.campos?.maximo ?? left.campos?.max);
        if (max <= 0) return false;
        b = max * b / 100;
      }
      return ({ '<': () => a < b, '<=': () => a <= b, '==': () => a === b, '!=': () => a !== b, '>=': () => a >= b, '>': () => a > b }[n.operador])();
    }
    if (n.tipo === 'vinculo') {
      const d = no(n.entrada);
      if (n.componentes.includes('e')) {
        if (registro(d) && n.referencia.tipo === 'selecao') {
          const identidade = d.campos?.identidade;
          if (registro(identidade) && identidade.registros && Object.hasOwn(identidade.registros, n.referencia.componente)) return identidade.registros[n.referencia.componente];
        }
        const target = no(n.referencia);
        if (!registro(d) || !registro(target) || d.id === undefined || target.id === undefined) throw new Error('Identidade dos participantes indisponível.');
        return d.id === target.id;
      }
      if (n.referencia.tipo !== 'selecao') throw new Error('O vínculo exige uma seleção de destino.');
      return campo(d, n.referencia.componente);
    }
    const d = no(n.entrada), c = n.componente;
    if (n.tipo === 'filtro' || n.tipo === 'qualificador') {
      if (Array.isArray(d)) return d.filter(x => {
        const v = campo(x,c);
        return n.argumentos ? Boolean(escalar(comArgumentos(v,n.argumentos))) : Boolean(escalar(v));
      });
      return comArgumentos(campo(d,c),n.argumentos);
    }
    if (c === 'tem') return d === undefined ? false : Array.isArray(d) ? d.length > 0 : registro(d) ? d.existe ?? true : typeof d === 'number' ? d > 0 : Boolean(d);
    if (c === 'quantidade') {
      if (Array.isArray(d)) return d.length;
      if (registro(d) && d.quantidade !== undefined) return d.quantidade;
      throw new Error('Quantidade exige uma coleção.');
    }
    if (c === 'percentual' || c === 'porcentagem') {
      if (!registro(d)) throw new Error('Percentual exige valor e máximo.');
      const max = escalar(d.campos?.maximo ?? d.campos?.max);
      return max > 0 ? Math.round(escalar(d) / max * 100) : 0;
    }
    if (['max','maximo','maximos','minimo'].includes(c) && Array.isArray(d)) {
      if (!d.length) return 0;
      const values = d.map(escalar);
      return c === 'minimo' ? Math.min(...values) : Math.max(...values);
    }
    return campo(d,c);
  }
  try { return { ok: true, valor: escalar(no(ref.consulta)) }; }
  catch (e) { return { ok: false, mensagem: e instanceof Error ? e.message : String(e) }; }
}
