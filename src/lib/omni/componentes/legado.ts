import { CORRESPONDENCIAS_COMPONENTES } from './correspondencias';
import { interpretarComposicao } from './interpretar';
import type { ContextoComposicao, NoComposicao } from './composicao';
import type { DadoComposto, DadosComposicao, RegistroComposto } from './avaliar';

const estruturas = CORRESPONDENCIAS_COMPONENTES.map(c => ({ ...c, no: interpretarComposicao(c.texto).referencia?.consulta }));
type RegistroMutavel = { valor?: number | boolean | string; campos?: Record<string, DadoComposto>; quantidade?: number; existe?: boolean };
const obj = (d: DadoComposto): RegistroMutavel => d && typeof d === 'object' && !Array.isArray(d) ? { ...(d as RegistroComposto), campos: { ...(d as RegistroComposto).campos } } : { valor: typeof d === 'object' ? undefined : d };

/** Converte fatos do schema antigo para campos estruturados antes da avaliação genérica. */
export function projetarDadosLegados(bag: Record<string, number>, contexto: ContextoComposicao, resolver: (chave: string) => string): DadosComposicao {
  const selecoes: Record<string, DadoComposto> = {};
  function caminho(n: NoComposicao): string[] | undefined {
    if (n.tipo === 'selecao') return n.argumentos ? undefined : [n.componente];
    if (n.tipo === 'vinculo') { const p = caminho(n.entrada); return p && !n.componentes.includes('e') && n.referencia.tipo === 'selecao' ? [...p, n.referencia.componente] : undefined; }
    if (n.tipo === 'literal' || n.tipo === 'comparacao' || n.argumentos) return;
    const p = caminho(n.entrada);
    return p ? [...p, n.componente === 'quantidade' ? '$quantidade' : n.componente === 'tem' ? '$existe' : n.componente] : undefined;
  }
  function escrever(d: DadoComposto, p: string[], valor: number): DadoComposto {
    const r = obj(d);
    if (!p.length) { r.valor = valor; return r; }
    const [k, ...resto] = p;
    if (k === '$quantidade') r.quantidade = valor;
    else if (k === '$existe') r.existe = valor > 0;
    else if (k !== 'percentual' && k !== 'porcentagem') {
      r.campos = { ...r.campos, [k]: escrever(r.campos?.[k], resto, valor) };
    }
    return r;
  }
  for (const c of estruturas) {
    if (!c.no || !(c.contextos as readonly string[]).includes(contexto)) continue;
    const p = caminho(c.no); if (!p) continue;
    const original = c.origem.replace(/^(CENA|DANO|ITEM|ARMA)\./, '');
    const chave = resolver(original), keys = contexto === 'USUARIO' || contexto === 'ALVO'
      ? [`${contexto}_${chave}`, chave, original.toUpperCase()] : [`${contexto}_${chave}`, `${contexto}_${original.toUpperCase()}`];
    const valor = keys.map(k => bag[k]).find(v => v !== undefined);
    if (valor === undefined || !Number.isFinite(valor)) continue;
    selecoes[p[0]] = escrever(selecoes[p[0]], p.slice(1), valor);
  }
  return { selecoes };
}

/** Dados nativos prevalecem; campos ausentes podem continuar usando fatos do schema anterior. */
export function mesclarDados(a: DadosComposicao, b: DadosComposicao): DadosComposicao {
  function mesclar(x: DadoComposto, y: DadoComposto): DadoComposto {
    if (y === undefined) return x;
    if (Array.isArray(y) || typeof y !== 'object' || y === null) return y;
    const antigo = obj(x), novo = y as RegistroComposto;
    const campos = { ...antigo.campos };
    for (const [k, v] of Object.entries(novo.campos ?? {})) campos[k] = mesclar(campos[k], v);
    const definidos = Object.fromEntries(Object.entries(novo).filter(([, valor]) => valor !== undefined));
    return { ...antigo, ...definidos, campos };
  }
  const selecoes = { ...a.selecoes };
  for (const [k, v] of Object.entries(b.selecoes)) selecoes[k] = mesclar(selecoes[k], v);
  return { selecoes };
}
