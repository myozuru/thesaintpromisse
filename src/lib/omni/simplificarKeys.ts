/**
 * 🧹 Simplificador automático de keys do Omni.
 *
 * Percorre uma EntidadeOmni e reescreve `caminhoAlvo`, `caminhoRecurso`
 * e fórmulas para usarem as chaves canônicas curtas definidas em
 * {@link ./keyAliases}. Idempotente: rodar duas vezes não muda nada.
 */
import type { EntidadeOmni, AcaoLogica, BlocoLogico, GatilhoEntidade, ValorDinamico, Operando, CondicaoLogica } from './tipos';
import { canonicalizarChave } from './keyAliases';

function canonExpr(expr: string): string {
  // Canonicaliza o caminho, preservando quem fornece o valor. CENA/ITEM
  // têm namespaces próprios e não usam os aliases de personagem.
  return expr.replace(/@?[A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_]*(?:\.[A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_]*)+/g, (m) => {
    const scoped = m.match(/^(@?)(USUARIO|ALVO|CENA|AREA|ITEM)\.(.+)$/i);
    if (scoped) {
      const [, at, escopo, caminho] = scoped;
      if (!/^(USUARIO|ALVO)$/i.test(escopo)) return m;
      return `${at}${escopo.toUpperCase()}.${canonicalizarChave(caminho) || caminho}`;
    }
    const at = m.startsWith('@') ? '@' : '';
    const caminho = at ? m.slice(1) : m;
    return `${at}${canonicalizarChave(caminho) || caminho}`;
  });
}

function migrarValor(v?: ValorDinamico): ValorDinamico | undefined {
  if (!v) return v;
  if (v.tipo === 'formula') return { tipo: 'formula', expressao: canonExpr(v.expressao) };
  return v;
}

function migrarOperando(o: Operando): Operando {
  if (o.tipo === 'ref') {
    return { tipo: 'ref', ref: { ...o.ref, caminho: canonicalizarChave(o.ref.caminho) || o.ref.caminho } };
  }
  if (o.tipo === 'formula') return { tipo: 'formula', expressao: canonExpr(o.expressao) };
  return o;
}

function migrarCondicao(c: CondicaoLogica): CondicaoLogica {
  return { ...c, esquerdo: migrarOperando(c.esquerdo), direito: migrarOperando(c.direito) };
}

function migrarAcao(a: AcaoLogica): AcaoLogica {
  // Vantagem/Desvantagem usam `caminhoAlvo` como escopo — não devem ser canonicalizadas.
  const ehVantagem = a.acao === 'CONCEDER_VANTAGEM' || a.acao === 'CONCEDER_DESVANTAGEM' || a.acao === 'LIMPAR_VANT_DESV';
  return {
    ...a,
    caminhoAlvo: a.caminhoAlvo && !ehVantagem
      ? (canonicalizarChave(a.caminhoAlvo) || a.caminhoAlvo)
      : a.caminhoAlvo,
    valor: migrarValor(a.valor),
  };
}

function migrarBloco(b: BlocoLogico): BlocoLogico {
  return {
    ...b,
    condicoes: b.condicoes.map(migrarCondicao),
    acoes: b.acoes.map(migrarAcao),
  };
}

function migrarGatilho(g: GatilhoEntidade): GatilhoEntidade {
  return { ...g, blocos: g.blocos.map(migrarBloco) };
}

/** Retorna uma cópia da entidade com keys canonicalizadas. */
export function simplificarKeysEntidade(ent: EntidadeOmni): EntidadeOmni {
  return {
    ...ent,
    custos: (ent.custos ?? []).map((c) => ({
      ...c,
      caminhoRecurso: canonicalizarChave(c.caminhoRecurso) || c.caminhoRecurso,
      valor: migrarValor(c.valor) ?? c.valor,
    })),
    gatilhos: (ent.gatilhos ?? []).map(migrarGatilho),
  };
}

/** Aplica em lote — devolve quantas entidades sofreram alteração. */
export function simplificarKeysLote(
  entidades: Record<string, EntidadeOmni>,
): { atualizadas: Record<string, EntidadeOmni>; alteradas: number } {
  const out: Record<string, EntidadeOmni> = {};
  let alteradas = 0;
  for (const [id, ent] of Object.entries(entidades)) {
    const novo = simplificarKeysEntidade(ent);
    const mudou = JSON.stringify(novo) !== JSON.stringify(ent);
    out[id] = mudou ? { ...novo, atualizadoEm: Date.now() } : ent;
    if (mudou) alteradas++;
  }
  return { atualizadas: out, alteradas };
}
