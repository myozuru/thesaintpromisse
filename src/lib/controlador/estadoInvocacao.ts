import {
  INVOCACAO_SCHEMA_VERSION,
  InstanciaInvocacaoSchema,
  type InstanciaInvocacao,
} from '@/lib/invocacoes/schema';

export type ResultadoEstadoInvocacao =
  | { ok: true; instancia: InstanciaInvocacao }
  | { ok: false; motivo: string };

export function estadoPorPVInvocacao(hpAtual: number, hpMaximo: number): InstanciaInvocacao['estado'] {
  if (hpAtual <= -hpMaximo) return 'derrotada';
  if (hpAtual <= 0) return 'caida';
  return 'ativa';
}

export function novaInstanciaInvocacao(input: {
  id: string;
  modeloId: string;
  donoCharacterId: string;
  donoProfileId?: string;
  tokenId: string;
  eventoCriacaoId?: string;
  hpAtual: number;
  hpMaximoAtual: number;
  estado?: InstanciaInvocacao['estado'];
  economiaAcoes?: InstanciaInvocacao['economiaAcoes'];
  combateId?: string;
  turnoCriacao?: number;
  rodadaCriacao?: number;
  contribuicaoTempo?: InstanciaInvocacao['contribuicaoTempo'];
}): InstanciaInvocacao {
  return InstanciaInvocacaoSchema.parse({
    schemaVersion: INVOCACAO_SCHEMA_VERSION,
    version: 1,
    ...input,
    estado: input.estado ?? estadoPorPVInvocacao(input.hpAtual, input.hpMaximoAtual),
  });
}

export function aplicarDanoPVInvocacao(
  instancia: InstanciaInvocacao,
  dano: number,
): ResultadoEstadoInvocacao {
  if (!Number.isFinite(dano) || dano < 0) return { ok: false, motivo: 'Dano inválido.' };
  if (instancia.estado !== 'ativa' && instancia.estado !== 'caida') {
    return { ok: false, motivo: 'Esta instância não pode receber dano neste estado.' };
  }
  const hpAtual = instancia.hpAtual - Math.floor(dano);
  const estado = estadoPorPVInvocacao(hpAtual, instancia.hpMaximoAtual);
  return {
    ok: true,
    instancia: InstanciaInvocacaoSchema.parse({
      ...instancia,
      version: instancia.version + 1,
      hpAtual,
      estado,
    }),
  };
}

export function aplicarCuraPVInvocacao(
  instancia: InstanciaInvocacao,
  cura: number,
): ResultadoEstadoInvocacao {
  if (!Number.isFinite(cura) || cura < 0) return { ok: false, motivo: 'Cura inválida.' };
  if (instancia.estado === 'derrotada' || instancia.estado === 'dissipada') {
    return { ok: false, motivo: 'Esta instância não pode ser curada neste estado.' };
  }
  const hpAtual = Math.min(instancia.hpMaximoAtual, instancia.hpAtual + Math.floor(cura));
  const estado = instancia.estado === 'caida'
    ? 'caida'
    : estadoPorPVInvocacao(hpAtual, instancia.hpMaximoAtual);
  return {
    ok: true,
    instancia: InstanciaInvocacaoSchema.parse({
      ...instancia,
      version: instancia.version + 1,
      hpAtual,
      estado,
    }),
  };
}

export function levantarInstanciaInvocacao(instancia: InstanciaInvocacao): ResultadoEstadoInvocacao {
  if (instancia.estado !== 'caida') return { ok: false, motivo: 'A invocação não está Caída.' };
  if (instancia.hpAtual <= 0) return { ok: false, motivo: 'É preciso curar a invocação acima de 0 PV antes de levantá-la.' };
  const saldo = instancia.economiaAcoes?.acaoMovimento;
  if (!saldo || saldo.atual < 1) return { ok: false, motivo: 'Ação de Movimento própria indisponível.' };
  return {
    ok: true,
    instancia: InstanciaInvocacaoSchema.parse({
      ...instancia,
      version: instancia.version + 1,
      estado: 'ativa',
      economiaAcoes: {
        ...instancia.economiaAcoes,
        acaoMovimento: { ...saldo, atual: saldo.atual - 1 },
      },
    }),
  };
}
