import type { Character } from '@/types';

type Protecao = NonNullable<Character['protecoesOmni']>[number];

/** Consome concessões na ordem de criação e conserva proteção sem prazo de outras fontes. */
export function consumirProtecoesOmni(protecoes: Protecao[] = [], perda = 0): Protecao[] {
  let saldo = Math.max(0, perda);
  return protecoes.map(p => {
    const consumido = Math.min(p.restante, saldo);
    saldo -= consumido;
    return { ...p, restante: p.restante - consumido };
  }).filter(p => p.restante > 0);
}

/** Reconcilia edições manuais da reserva antes de expirar concessões. */
export function ajustarProtecoesOmni(c: Pick<Character, 'escCurrent' | 'protecoesOmni'>): Protecao[] {
  const protecoes = c.protecoesOmni ?? [];
  const total = protecoes.reduce((n, p) => n + p.restante, 0);
  return consumirProtecoesOmni(protecoes, Math.max(0, total - Math.max(0, c.escCurrent ?? 0)));
}

export function expirarProtecoesOmni(c: Pick<Character, 'escCurrent' | 'protecoesOmni'>) {
  const protecoes = ajustarProtecoesOmni(c);
  const retirar = protecoes.filter(p => p.rodadas === 1).reduce((n, p) => n + p.restante, 0);
  return {
    escCurrent: Math.max(0, (c.escCurrent ?? 0) - retirar),
    protecoesOmni: protecoes.filter(p => p.rodadas !== 1).map(p => ({ ...p, rodadas: p.rodadas > 0 ? p.rodadas - 1 : 0 })),
  };
}
