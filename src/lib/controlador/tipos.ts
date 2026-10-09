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
  /** Grau e atributos definidos pelo editor de Shikigamis. */
  grau?: 'quarto' | 'terceiro' | 'segundo' | 'primeiro' | 'especial';
  atributos?: Record<'forca' | 'destreza' | 'constituicao' | 'inteligencia' | 'sabedoria' | 'presenca', number>;
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

/** Livro de Invocações: Controlador recebe 2 no nível 1 e +1 a cada 3 níveis.
 * Outras especializações obtêm invocações por Interlúdio, sem limite numérico
 * de catálogo definido neste capítulo. */
export function limiteInvocacoesConhecidas(nivel: number): number {
  return 2 + Math.floor((Math.max(1, Math.trunc(nivel) || 1) - 1) / 3);
}
/** Padrão: 1 em campo; Controlador utiliza Treinamento em Controle. */
export function limiteInvocacoesAtivas(treinoControle = 0): number {
  return 1 + Math.max(0, Math.trunc(treinoControle) || 0);
}
export function limiteAtivasPersonagem(especializacao: string, treinoControle = 0): number {
  return especializacao === 'Controlador' ? limiteInvocacoesAtivas(treinoControle) : 1;
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
  // Atingir o limite gera aviso na UI, não impede personalização autorizada.
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
