/**
 * Contadores nomeados genéricos do OMNI (cargas, stacks, almas, brasas…).
 *
 * Regra pura e reutilizável — nenhuma habilidade específica vive aqui.
 *  - `<nome>`                 → total (o que as fórmulas leem: @USUARIO.<nome>)
 *  - `<nome>__fonte__<id>`    → parcela de cada criatura que contribuiu
 *  - o teto global limita o total; quota por fonte usa ciclo separado do saldo.
 */
export const SEP_FONTE = '__fonte__';

export interface OpcoesContador {
  valor: number;
  teto?: number;
  /** Teto legado local a cada fonte. `por_fonte` no script novo só registra a origem. */
  escopoTeto?: 'global' | 'porFonte';
  rastrearFonte?: boolean;
  limiteFonte?: number;
  cicloFonte?: string;
  usoPorFonte?: Record<string, Record<string, { ciclo: string; usados: number }>>;
  /** Criatura que originou o acúmulo (ex.: aliado ferido). */
  fonteId?: string;
  /** Destino explicitamente selecionado por `contador nome fonte id`. */
  fonteExata?: boolean;
}

export interface ResultadoContador {
  counters: Record<string, number>;
  anterior: number;
  consumido: number;
  usoPorFonte: Record<string, Record<string, { ciclo: string; usados: number }>>;
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
  const usoPorFonte = { ...(op.usoPorFonte ?? {}) };
  if (!Number.isFinite(op.valor) || (op.teto !== undefined && !Number.isFinite(op.teto)) || (op.limiteFonte !== undefined && !Number.isFinite(op.limiteFonte))) return { counters: c, anterior, consumido: 0, usoPorFonte };
  const teto = op.teto === undefined ? undefined : Math.max(0, Math.round(op.teto));
  const limiteFonte = op.limiteFonte === undefined ? undefined : Math.max(0, Math.round(op.limiteFonte));
  let consumido = 0;

  const temFontes = Object.keys(c).some(k => k.startsWith(prefixoFonte(nome)));
  const rastrearFonte = temFontes || op.rastrearFonte || op.fonteExata || op.escopoTeto === 'porFonte';
  // Preserva cargas globais ao passar a contar por fonte.
  if (temFontes || op.fonteExata || op.escopoTeto === 'porFonte') {
    const semFonte = Math.max(0, anterior - somarFontes(c, nome));
    if (semFonte > 0) c[`${prefixoFonte(nome)}geral`] = (c[`${prefixoFonte(nome)}geral`] ?? 0) + semFonte;
  }
  const retirarFontes = (quantidade: number) => {
    let falta = quantidade;
    const fontes = Object.entries(c).filter(([k]) => k.startsWith(prefixoFonte(nome))).sort((a, b) => b[1] - a[1]);
    for (const [k, v] of fontes) { const tirar = Math.min(v, falta); c[k] = v - tirar; falta -= tirar; if (falta <= 0) break; }
  };

  if (op.fonteExata && op.fonteId) {
    const fk = `${prefixoFonte(nome)}${op.fonteId}`;
    const atual = c[fk] ?? 0;
    const qtd = Math.max(0, Math.round(op.valor));
    if (acao === 'INCREMENTAR_CONTADOR') {
      const ciclo = op.cicloFonte ?? 'sem_ciclo';
      const usosAtuais = usoPorFonte[nome]?.[op.fonteId];
      const usados = usosAtuais?.ciclo === ciclo ? usosAtuais.usados : 0;
      const limiteRestante = limiteFonte === undefined ? qtd : Math.max(0, limiteFonte - usados);
      const tetoRestante = op.escopoTeto === 'porFonte' || teto === undefined ? qtd : Math.max(0, teto - anterior);
      const aceito = Math.min(qtd, limiteRestante, tetoRestante);
      if (aceito > 0) c[fk] = atual + aceito;
      c[nome] = somarFontes(c, nome);
      if (limiteFonte !== undefined && aceito > 0) {
        usoPorFonte[nome] = { ...(usoPorFonte[nome] ?? {}), [op.fonteId]: { ciclo, usados: usados + aceito } };
      }
    }
    else if (acao === 'CONSUMIR_CONTADOR') { consumido = Math.min(atual, op.valor > 0 ? qtd : atual); c[fk] = atual - consumido; }
    else c[fk] = acao === 'ZERAR_CONTADOR' ? 0 : teto === undefined ? qtd : Math.min(teto, qtd);
    c[nome] = somarFontes(c, nome);
    return { counters: c, anterior, consumido, usoPorFonte };
  }

  if (acao === 'INCREMENTAR_CONTADOR') {
    const qtd = Math.max(0, Math.round(op.valor));
    if (rastrearFonte) {
      const fonteId = op.fonteId ?? 'geral';
      const fk = `${prefixoFonte(nome)}${fonteId}`;
      const parcela = c[fk] ?? 0;
      const ciclo = op.cicloFonte ?? 'sem_ciclo';
      const usosAtuais = usoPorFonte[nome]?.[fonteId];
      const usados = usosAtuais?.ciclo === ciclo ? usosAtuais.usados : 0;
      const limiteRestante = limiteFonte === undefined ? qtd : Math.max(0, limiteFonte - usados);
      const tetoRestante = op.escopoTeto === 'porFonte' || teto === undefined ? qtd : Math.max(0, teto - anterior);
      const aceito = Math.min(qtd, limiteRestante, tetoRestante);
      if (aceito > 0) c[fk] = Math.max(0, parcela + aceito);
      c[nome] = somarFontes(c, nome);
      if (limiteFonte !== undefined && aceito > 0) {
        usoPorFonte[nome] = { ...(usoPorFonte[nome] ?? {}), [fonteId]: { ciclo, usados: usados + aceito } };
      }
    } else {
      const prox = anterior + qtd;
      c[nome] = Math.max(0, teto !== undefined ? Math.min(teto, prox) : prox);
    }
  } else if (acao === 'ZERAR_CONTADOR') {
    c[nome] = 0;
    limparFontes(c, nome);
  } else if (acao === 'DEFINIR_CONTADOR') {
    c[nome] = Math.max(0, teto === undefined ? Math.round(op.valor) : Math.min(teto, Math.round(op.valor)));
    limparFontes(c, nome);
  } else if (acao === 'CONSUMIR_CONTADOR') {
    // valor ≤ 0 → consome tudo.
    const pedir = op.valor > 0 ? Math.round(op.valor) : anterior;
    consumido = Math.min(anterior, pedir);
    const resto = anterior - consumido;
    if (resto === 0) {
      limparFontes(c, nome);
    } else if (somarFontes(c, nome) > 0) {
      retirarFontes(consumido);
    }
    c[nome] = resto;
  }
  return { counters: c, anterior, consumido, usoPorFonte };
}
