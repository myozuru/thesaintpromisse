/**
 * Contadores nomeados genéricos do OMNI (cargas, stacks, almas, brasas…).
 *
 * Regra pura e reutilizável — nenhuma habilidade específica vive aqui.
 *  - `<nome>`                 → total (o que as fórmulas leem: @USUARIO.<nome>)
 *  - `<nome>__fonte__<id>`    → parcela de cada criatura de origem (escopo 'porFonte')
 *  - teto global limita o total; teto 'porFonte' limita cada parcela.
 */
export const SEP_FONTE = '__fonte__';

export interface OpcoesContador {
  valor: number;
  teto?: number;
  escopoTeto?: 'global' | 'porFonte';
  /** Criatura que originou o acúmulo (ex.: aliado ferido). */
  fonteId?: string;
}

export interface ResultadoContador {
  counters: Record<string, number>;
  anterior: number;
  consumido: number;
}

const prefixoFonte = (nome: string) => `${nome}${SEP_FONTE}`;

/** Soma todas as parcelas por fonte de um contador. */
export function somarFontes(counters: Record<string, number>, nome: string): number {
  const p = prefixoFonte(nome);
  let s = 0;
  for (const [k, v] of Object.entries(counters)) if (k.startsWith(p)) s += v;
  return s;
}

function limparFontes(c: Record<string, number>, nome: string) {
  const p = prefixoFonte(nome);
  for (const k of Object.keys(c)) if (k.startsWith(p)) delete c[k];
}

export function calcularContador(
  origem: Record<string, number>,
  nomeRaw: string,
  acao: string,
  op: OpcoesContador,
): ResultadoContador {
  const nome = nomeRaw.trim().toLowerCase();
  const c: Record<string, number> = { ...origem };
  const anterior = c[nome] ?? 0;
  const teto = op.teto !== undefined && op.teto > 0 ? Math.round(op.teto) : undefined;
  let consumido = 0;

  if (acao === 'INCREMENTAR_CONTADOR') {
    const qtd = Math.round(op.valor);
    if (op.escopoTeto === 'porFonte') {
      const fk = `${prefixoFonte(nome)}${op.fonteId ?? 'geral'}`;
      const parcela = c[fk] ?? 0;
      c[fk] = Math.max(0, teto !== undefined ? Math.min(teto, parcela + qtd) : parcela + qtd);
      c[nome] = somarFontes(c, nome);
    } else {
      const prox = anterior + qtd;
      c[nome] = Math.max(0, teto !== undefined ? Math.min(teto, prox) : prox);
    }
  } else if (acao === 'ZERAR_CONTADOR') {
    c[nome] = 0;
    limparFontes(c, nome);
  } else if (acao === 'DEFINIR_CONTADOR') {
    c[nome] = Math.max(0, Math.round(op.valor));
    limparFontes(c, nome);
  } else if (acao === 'CONSUMIR_CONTADOR') {
    // valor ≤ 0 → consome tudo.
    const pedir = op.valor > 0 ? Math.round(op.valor) : anterior;
    consumido = Math.min(anterior, pedir);
    const resto = anterior - consumido;
    if (resto === 0) {
      limparFontes(c, nome);
    } else if (somarFontes(c, nome) > 0) {
      // Retira proporcionalmente das parcelas, das maiores para as menores.
      let falta = consumido;
      const p = prefixoFonte(nome);
      const fontes = Object.entries(c).filter(([k]) => k.startsWith(p)).sort((x, y) => y[1] - x[1]);
      for (const [k, v] of fontes) {
        if (falta <= 0) break;
        const t = Math.min(v, falta);
        c[k] = v - t;
        falta -= t;
      }
    }
    c[nome] = resto;
  }
  return { counters: c, anterior, consumido };
}
