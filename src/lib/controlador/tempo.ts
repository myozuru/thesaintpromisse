import {
  ContribuicaoTempoInvocacaoSchema,
  type ContribuicaoTempoInvocacao,
  type ConfiguracaoTempoInvocacao,
} from '@/lib/invocacoes/schema';

export const PISO_TEMPO_DISSIPACAO_INVOCACAO = 10;

const FATOR_UNIDADE_SEGUNDOS: Record<string, number> = {
  s: 1, seg: 1, segundo: 1, segundos: 1, second: 1, seconds: 1,
  min: 60, minuto: 60, minutos: 60, minute: 60, minutes: 60,
  h: 3600, hora: 3600, horas: 3600, hour: 3600, hours: 3600,
  turno: 6, turnos: 6, turn: 6, turns: 6,
  rodada: 6, rodadas: 6, round: 6, rounds: 6,
};

function normalizarUnidade(unidade: string): string {
  return unidade.trim().toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}

export function tempoAdicionalEmSegundos(
  configuracao?: ConfiguracaoTempoInvocacao,
): { ok: true; segundos: number } | { ok: false; motivo: string } {
  if (!configuracao) return { ok: true, segundos: 0 };
  if (!Number.isFinite(configuracao.quantidade) || configuracao.quantidade < 0) {
    return { ok: false, motivo: 'A quantidade de tempo adicional precisa ser finita e não negativa.' };
  }
  const unidade = normalizarUnidade(configuracao.unidade);
  const fator = FATOR_UNIDADE_SEGUNDOS[unidade];
  if (fator === undefined) {
    return { ok: false, motivo: 'Unidade de tempo não reconhecida. Use segundos, minutos, horas, turnos ou rodadas.' };
  }
  const segundos = configuracao.quantidade * fator;
  if (!Number.isFinite(segundos)) return { ok: false, motivo: 'O tempo convertido excede o valor permitido.' };
  return { ok: true, segundos };
}

export function criarContribuicaoTempoInvocacao(input: {
  grantEventId: string;
  ownerCharacterId: string;
  combatId?: string;
  instanceId: string;
  invocationId: string;
  tempoAdicional?: ConfiguracaoTempoInvocacao;
  agora?: number;
}): { ok: true; contribuicao?: ContribuicaoTempoInvocacao } | { ok: false; motivo: string } {
  const convertido = tempoAdicionalEmSegundos(input.tempoAdicional);
  if (!convertido.ok) return convertido;
  if (convertido.segundos === 0) return { ok: true };
  const agora = input.agora ?? Date.now();
  return {
    ok: true,
    contribuicao: ContribuicaoTempoInvocacaoSchema.parse({
      id: `tempo-${input.instanceId}`,
      grantEventId: input.grantEventId,
      ownerCharacterId: input.ownerCharacterId,
      ...(input.combatId ? { combatId: input.combatId } : {}),
      instanceId: input.instanceId,
      invocationId: input.invocationId,
      quantidadeConcedida: convertido.segundos,
      quantidadeRestante: convertido.segundos,
      unidade: 'segundos',
      estado: 'ativa',
      createdAt: new Date(agora).toISOString(),
      lastAccountingAt: new Date(agora).toISOString(),
    }),
  };
}

export function reservaTempoAtivaNoCombate(
  contribuicao: ContribuicaoTempoInvocacao | undefined,
  combatId: string | null | undefined,
): contribuicao is ContribuicaoTempoInvocacao {
  return Boolean(contribuicao &&
    (contribuicao.estado === 'ativa' || contribuicao.estado === 'consolacao') &&
    contribuicao.quantidadeRestante > 0 &&
    contribuicao.combatId === (combatId ?? undefined));
}

export function consumoPorTempoDecorrido(input: {
  baseRestante: number;
  segundosDecorridos: number;
}): { baseRestante: number; consumirReservas: number } {
  const base = Math.max(0, Number.isFinite(input.baseRestante) ? input.baseRestante : 0);
  const decorrido = Math.max(0, Number.isFinite(input.segundosDecorridos) ? input.segundosDecorridos : 0);
  return {
    baseRestante: Math.max(0, base - decorrido),
    consumirReservas: Math.max(0, decorrido - base),
  };
}

export function formatarSegundosTempoInvocacao(segundos: number): string {
  const normalizado = Math.max(0, Number.isFinite(segundos) ? segundos : 0);
  return Number.isInteger(normalizado) ? String(normalizado) : String(Number(normalizado.toFixed(2)));
}
