import {
  INVOCACAO_SCHEMA_VERSION,
  InstanciaInvocacaoSchema,
  type InstanciaInvocacao,
} from '@/lib/invocacoes/schema';

export type ResultadoEstadoInvocacao =
  | { ok: true; instancia: InstanciaInvocacao }
  | { ok: false; motivo: string };

export function validarDissipacaoVoluntaria(input: {
  estado: InstanciaInvocacao['estado'];
  emCombate: boolean;
  turnoDoDono: boolean;
  rodadaAtual?: number;
  rodadaCriacao?: number;
}): { ok: true } | { ok: false; motivo: string } {
  if (input.estado === 'derrotada') {
    return { ok: false, motivo: 'Uma invocação derrotada aguarda a resolução do Controlador ou do Mestre.' };
  }
  if (!input.emCombate) return { ok: true };
  if (!input.turnoDoDono) {
    return { ok: false, motivo: 'A dissipação voluntária só pode ocorrer no turno do dono.' };
  }
  if (input.rodadaCriacao !== undefined && input.rodadaAtual === input.rodadaCriacao) {
    return { ok: false, motivo: 'A invocação não pode ser dissipada voluntariamente na rodada em que foi chamada.' };
  }
  return { ok: true };
}

export type DecisaoManualDerrotaInvocacao =
  | { resultado: 'recuperada'; pvRecuperados: number }
  | { resultado: 'perda_permanente' };

export type ResultadoResolucaoDerrotaInvocacao =
  | { ok: true; instancia: InstanciaInvocacao; pvCatalogo: number; perdaPermanente: boolean }
  | { ok: false; motivo: string };

/** Registra a decisão humana sem apagar o PV que a instância tinha ao ser derrotada. */
export function resolverDerrotaManualInvocacao(
  instancia: InstanciaInvocacao,
  decisao: DecisaoManualDerrotaInvocacao,
  ator: { isMaster: boolean; profileId?: string; ownerProfileId?: string },
): ResultadoResolucaoDerrotaInvocacao {
  if (instancia.estado !== 'derrotada' || instancia.resolucaoDerrota) {
    return { ok: false, motivo: 'Esta derrota já foi resolvida ou não está pendente.' };
  }
  if (!ator.isMaster && (!ator.profileId || !ator.ownerProfileId || ator.profileId !== ator.ownerProfileId)) {
    return { ok: false, motivo: 'Somente o Controlador dono ou o Mestre pode resolver esta derrota.' };
  }

  const resolvidaEm = new Date().toISOString();
  const resolvidaPorProfileId = ator.profileId;
  if (decisao.resultado === 'recuperada') {
    if (!Number.isInteger(decisao.pvRecuperados) || decisao.pvRecuperados < 1 || decisao.pvRecuperados > instancia.hpMaximoAtual) {
      return { ok: false, motivo: `Informe PV inteiros entre 1 e ${instancia.hpMaximoAtual}.` };
    }
    const atualizada = InstanciaInvocacaoSchema.parse({
      ...instancia,
      version: instancia.version + 1,
      hpAtual: decisao.pvRecuperados,
      estado: 'dissipada',
      causasSaida: Array.from(new Set([...(instancia.causasSaida ?? []), 'derrota_recuperada_manualmente'])),
      resolucaoDerrota: {
        resultado: 'recuperada',
        pvNaDerrota: instancia.hpAtual,
        pvRecuperados: decisao.pvRecuperados,
        resolvidaEm,
        ...(resolvidaPorProfileId ? { resolvidaPorProfileId } : {}),
      },
    });
    return { ok: true, instancia: atualizada, pvCatalogo: decisao.pvRecuperados, perdaPermanente: false };
  }

  const atualizada = InstanciaInvocacaoSchema.parse({
    ...instancia,
    version: instancia.version + 1,
    resolucaoDerrota: {
      resultado: 'perda_permanente',
      pvNaDerrota: instancia.hpAtual,
      resolvidaEm,
      ...(resolvidaPorProfileId ? { resolvidaPorProfileId } : {}),
    },
  });
  return { ok: true, instancia: atualizada, pvCatalogo: Math.max(0, Math.min(instancia.hpMaximoAtual, instancia.hpAtual)), perdaPermanente: true };
}

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
  recursosAtuais?: InstanciaInvocacao['recursosAtuais'];
  combateId?: string;
  turnoCriacao?: number;
  rodadaCriacao?: number;
  contribuicaoTempo?: InstanciaInvocacao['contribuicaoTempo'];
  createdAt?: string;
}): InstanciaInvocacao {
  return InstanciaInvocacaoSchema.parse({
    schemaVersion: INVOCACAO_SCHEMA_VERSION,
    version: 1,
    ...input,
    createdAt: input.createdAt ?? new Date().toISOString(),
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
