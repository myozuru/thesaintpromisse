/** Catálogo persistente de invocações do Controlador.
 * A materialização em tokens e os comandos pertencem às fases seguintes.
 * Referências preservam a origem no Grimório/OMNI sem duplicar entidades.
 */
export type TipoInvocacaoControlador = 'shikigami' | 'corpo_amaldicoado';

export interface InvocacaoControlador {
  id: string;
  donoCharacterId: string;
  nome: string;
  tipo: TipoInvocacaoControlador;
  origem?: { tipo: 'grimorio' | 'omni' | 'manual'; entidadeId?: string };
  hpAtual: number;
  hpMaximo: number;
  defesa: number;
  deslocamentoM: number;
  porte: 'Pequeno' | 'Médio' | 'Grande';
  custoInvocacaoPE: number;
  custoSustentacaoPE?: number;
  acoes: Array<{
    id: string;
    nome: string;
    tipo: 'ataque' | 'habilidade' | 'movimento' | 'bonus';
    alcanceM?: number;
    /** Bônus específico de acerto do servo, sem herdar o acerto do Controlador. */
    bonusAtaque?: number;
    dano?: string;
    tipoDano?: import('@/types').DamageType;
    entidadeOmniId?: string;
  }>;
}

/** A progressão segue marcos cumulativos, inclusive os acima do limite
 * atual de nível de campanha, para manter os dados prontos para expansão.
 */
export const MARCOS_INVOCACOES = [3, 6, 9, 10, 12, 15, 18] as const;

export function limiteInvocacoesConhecidas(nivel: number): number {
  const n = Math.max(1, Math.min(20, Math.trunc(nivel) || 1));
  return 2 + MARCOS_INVOCACOES.filter(marco => n >= marco).length;
}

/** O treino em Controle inicia em +1; não confundir com trainingBonus (+2 no nível 1). */
export function limiteInvocacoesAtivas(treinoControle = 1): number {
  return 1 + Math.max(0, Math.trunc(treinoControle) || 0);
}

/** Níveis de Controlador: PV inicial 10+CON, subsequentes 1d8 (média 5)+CON. */
export function pvControlador(nivel: number, modCon: number, dadosPosteriores?: readonly number[]): number {
  const n = Math.max(1, Math.trunc(nivel) || 1);
  const ganhos = Array.from({ length: n - 1 }, (_, i) => dadosPosteriores?.[i] ?? 5);
  if (ganhos.some(g => !Number.isInteger(g) || g < 1 || g > 8)) throw new Error('Dado de vida do Controlador precisa estar entre 1 e 8.');
  return Math.max(1, 10 + n * modCon + ganhos.reduce((a, b) => a + b, 0));
}

/** Protege contra duplicidade, catálogo acima do limite e referências cruzadas. */
export function validarCatalogoControlador(
  donoCharacterId: string,
  nivel: number,
  catalogo: readonly InvocacaoControlador[],
): { ok: true } | { ok: false; motivo: string } {
  if (catalogo.length > limiteInvocacoesConhecidas(nivel)) return { ok: false, motivo: 'Limite de invocações conhecidas excedido.' };
  const ids = new Set<string>();
  for (const inv of catalogo) {
    if (!inv.id || ids.has(inv.id)) return { ok: false, motivo: 'ID de invocação duplicado ou ausente.' };
    ids.add(inv.id);
    if (inv.donoCharacterId !== donoCharacterId) return { ok: false, motivo: 'Invocação pertence a outro controlador.' };
    if (!inv.nome.trim() || !Number.isFinite(inv.hpMaximo) || inv.hpMaximo < 1 || !Number.isFinite(inv.hpAtual) || inv.hpAtual < 0 || inv.hpAtual > inv.hpMaximo)
      return { ok: false, motivo: 'Dados vitais da invocação inválidos.' };
    if (!Number.isFinite(inv.defesa) || inv.defesa < 0 || !Number.isFinite(inv.deslocamentoM) || inv.deslocamentoM < 0 || !Number.isFinite(inv.custoInvocacaoPE) || inv.custoInvocacaoPE < 0 || (inv.custoSustentacaoPE !== undefined && (!Number.isFinite(inv.custoSustentacaoPE) || inv.custoSustentacaoPE < 0)))
      return { ok: false, motivo: 'Defesa, deslocamento ou custos inválidos.' };
  }
  return { ok: true };
}
