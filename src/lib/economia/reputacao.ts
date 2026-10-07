/** Reputação com facções: grupo + individual. Regras puras (preço e acesso a quests). */
export interface Faccao {
  id: string;
  nome: string;
  emblema: string;
  /** Reputação do grupo inteiro. */
  repGrupo: number;
  /** Reputação individual por ficha (soma à do grupo). */
  repJogador: Record<string, number>;
  updatedAt: number;
  deletedAt?: number;
}

export const REP_MIN = -100;
export const REP_MAX = 100;
export const limitarRep = (v: number) => Math.max(REP_MIN, Math.min(REP_MAX, Math.round(v)));

/** Reputação efetiva de uma ficha = grupo + individual (limitada a −100..100). */
export function repEfetiva(f: Faccao | undefined, charId?: string): number {
  if (!f) return 0;
  return limitarRep(f.repGrupo + (charId ? f.repJogador[charId] ?? 0 : 0));
}

export interface NivelRep { nome: string; ajustePreco: number | null }

/** Faixas: ajuste de preço em % (negativo = desconto); null = loja recusa negociar. */
export function nivelReputacao(rep: number): NivelRep {
  if (rep >= 60) return { nome: 'Venerado', ajustePreco: -20 };
  if (rep >= 30) return { nome: 'Honrado', ajustePreco: -10 };
  if (rep >= 10) return { nome: 'Amigável', ajustePreco: -5 };
  if (rep > -10) return { nome: 'Neutro', ajustePreco: 0 };
  if (rep > -30) return { nome: 'Desconfiado', ajustePreco: 10 };
  if (rep > -60) return { nome: 'Hostil', ajustePreco: 25 };
  return { nome: 'Inimigo', ajustePreco: null };
}

/** Quest exclusiva: só aparece se a reputação efetiva alcança o mínimo. */
export function atendeRepMinima(f: Faccao | undefined, charId: string | undefined, minima: number | null | undefined): boolean {
  if (minima == null || !f) return true;
  return repEfetiva(f, charId) >= minima;
}
