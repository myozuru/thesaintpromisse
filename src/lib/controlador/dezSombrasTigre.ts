export const TIGRE_FUNEBRE_SUBCATEGORIA = "dez-sombras:tigre-funebre";
export const TIGRE_GARRAS_DEFESA_MAXIMA = 4;
export const TIGRE_PREDADOR_RD_FIXA = 8;
export const TIGRE_SANGRAMENTO_FORMULA = "4d10";

export interface EstadoGarrasTigre {
  alvoId: string;
  nomeAlvo: string;
  penalidade: number;
  ultimaRodadaAcerto: number;
  ultimoTurnoRecuperacao?: string;
}

export interface EstadoPredadorApiceTigre {
  combateId?: string;
  rodadaAtivacao: number;
  rodadaAlvo: number;
  retalharesUsados: number;
}

export interface EstadoTigreFunebre {
  combateId?: string;
  garras: EstadoGarrasTigre[];
  predadorApice?: EstadoPredadorApiceTigre;
  turnosProcessados: string[];
}

export function estadoInicialTigreFunebre(combateId?: string): EstadoTigreFunebre {
  return { ...(combateId ? { combateId } : {}), garras: [], turnosProcessados: [] };
}

export function normalizarEstadoTigreFunebre(
  valor: Partial<EstadoTigreFunebre> | null | undefined,
  combateId?: string,
): EstadoTigreFunebre {
  if (combateId && valor?.combateId && valor.combateId !== combateId) {
    return estadoInicialTigreFunebre(combateId);
  }
  const garras = Array.isArray(valor?.garras)
    ? valor.garras
        .filter((item) => item && typeof item.alvoId === "string" && item.alvoId.length > 0)
        .map((item) => ({
          alvoId: item.alvoId,
          nomeAlvo: typeof item.nomeAlvo === "string" ? item.nomeAlvo : item.alvoId,
          penalidade: Math.max(
            0,
            Math.min(TIGRE_GARRAS_DEFESA_MAXIMA, Math.trunc(item.penalidade || 0)),
          ),
          ultimaRodadaAcerto: Math.max(0, Math.trunc(item.ultimaRodadaAcerto || 0)),
          ...(item.ultimoTurnoRecuperacao
            ? { ultimoTurnoRecuperacao: item.ultimoTurnoRecuperacao }
            : {}),
        }))
    : [];
  const predador = valor?.predadorApice;
  const predadorApice =
    predador && (!combateId || !predador.combateId || predador.combateId === combateId)
      ? {
          ...(predador.combateId ? { combateId: predador.combateId } : {}),
          rodadaAtivacao: Math.max(0, Math.trunc(predador.rodadaAtivacao || 0)),
          rodadaAlvo: Math.max(0, Math.trunc(predador.rodadaAlvo || 0)),
          retalharesUsados: Math.max(0, Math.min(2, Math.trunc(predador.retalharesUsados || 0))),
        }
      : undefined;
  return {
    ...(combateId ? { combateId } : valor?.combateId ? { combateId: valor.combateId } : {}),
    garras,
    ...(predadorApice ? { predadorApice } : {}),
    turnosProcessados: Array.isArray(valor?.turnosProcessados)
      ? valor.turnosProcessados.filter((item) => typeof item === "string").slice(-100)
      : [],
  };
}

export function registrarAcertoGarrasTigre(
  estado: EstadoTigreFunebre,
  input: { alvoId: string; nomeAlvo: string; rodada: number; combateId?: string },
): EstadoTigreFunebre {
  const base = normalizarEstadoTigreFunebre(estado, input.combateId);
  const anterior = base.garras.find((item) => item.alvoId === input.alvoId);
  const nova: EstadoGarrasTigre = {
    alvoId: input.alvoId,
    nomeAlvo: input.nomeAlvo,
    penalidade: Math.min(TIGRE_GARRAS_DEFESA_MAXIMA, (anterior?.penalidade ?? 0) + 1),
    ultimaRodadaAcerto: Math.max(0, Math.trunc(input.rodada)),
  };
  return {
    ...base,
    garras: [...base.garras.filter((item) => item.alvoId !== input.alvoId), nova],
  };
}

export function recuperarGarrasTigreNoTurnoAlvo(
  estado: EstadoTigreFunebre,
  alvoId: string,
  rodada: number,
  turnoId: string,
  combateId?: string,
): EstadoTigreFunebre {
  const base = normalizarEstadoTigreFunebre(estado, combateId);
  const alvo = base.garras.find((item) => item.alvoId === alvoId);
  if (
    !alvo ||
    alvo.penalidade <= 0 ||
    alvo.ultimaRodadaAcerto >= rodada ||
    alvo.ultimoTurnoRecuperacao === turnoId
  )
    return base;
  const penalidade = alvo.penalidade - 1;
  return {
    ...base,
    garras:
      penalidade > 0
        ? base.garras.map((item) =>
            item.alvoId === alvoId
              ? { ...item, penalidade, ultimoTurnoRecuperacao: turnoId }
              : item,
          )
        : base.garras.filter((item) => item.alvoId !== alvoId),
  };
}

export function penalidadeGarrasTigre(
  personagens: readonly {
    invocacoesConhecidas?: readonly { id: string; subcategoria?: string }[];
    instanciasInvocacao?: readonly {
      modeloId: string;
      estadoTigreFunebre?: Partial<EstadoTigreFunebre>;
    }[];
  }[],
  alvoId: string,
  combateId?: string,
): number {
  const total = personagens.reduce((soma, personagem) => {
    const modelos = personagem.invocacoesConhecidas ?? [];
    for (const instancia of personagem.instanciasInvocacao ?? []) {
      const modelo = modelos.find(
        (item) =>
          item.id === instancia.modeloId && item.subcategoria === TIGRE_FUNEBRE_SUBCATEGORIA,
      );
      if (!modelo) continue;
      const estado = normalizarEstadoTigreFunebre(instancia.estadoTigreFunebre, combateId);
      soma += estado.garras.find((item) => item.alvoId === alvoId)?.penalidade ?? 0;
    }
    return soma;
  }, 0);
  // A p.85 limita o acúmulo no mesmo alvo; sem teto separado por fonte, aplica-se o máximo global.
  return Math.min(TIGRE_GARRAS_DEFESA_MAXIMA, total);
}

export function ativarPredadorApiceTigre(
  estado: EstadoTigreFunebre,
  rodada: number,
  combateId?: string,
): EstadoTigreFunebre {
  const base = normalizarEstadoTigreFunebre(estado, combateId);
  return {
    ...base,
    predadorApice: {
      ...(combateId ? { combateId } : {}),
      rodadaAtivacao: Math.max(0, Math.trunc(rodada)),
      rodadaAlvo: Math.max(0, Math.trunc(rodada)) + 1,
      retalharesUsados: 0,
    },
  };
}

export function predadorApiceTigreAtivo(
  estado: EstadoTigreFunebre | undefined,
  rodada: number,
  combateId?: string,
): boolean {
  const predador = normalizarEstadoTigreFunebre(estado, combateId).predadorApice;
  return Boolean(predador && predador.rodadaAlvo === rodada);
}

export function registrarRetalharPredadorApiceTigre(
  estado: EstadoTigreFunebre,
  rodada: number,
  combateId?: string,
): { estado: EstadoTigreFunebre; ataqueGratuito: boolean; ativo: boolean } {
  const base = normalizarEstadoTigreFunebre(estado, combateId);
  const predador = base.predadorApice;
  if (!predador || predador.rodadaAlvo !== rodada || predador.retalharesUsados >= 2) {
    return { estado: base, ataqueGratuito: false, ativo: false };
  }
  const ataqueGratuito = predador.retalharesUsados === 1;
  const usados = predador.retalharesUsados + 1;
  return {
    ativo: true,
    ataqueGratuito,
    estado: {
      ...base,
      predadorApice: { ...predador, retalharesUsados: usados },
    },
  };
}
