import type { CampoDerivadoInvocacao } from "@/lib/invocacoes/schema";

export const CAMPOS_DERIVADOS_SHIKIGAMI = [
  "hpMaximo",
  "defesa",
  "deslocamentoM",
  "custoInvocacaoPE",
] as const;

export type CampoDerivadoShikigami = typeof CAMPOS_DERIVADOS_SHIKIGAMI[number];
export type ModoEdicaoDerivado = "automatico" | "manual" | "revisao_necessaria";

export interface EstadoEdicaoDerivado {
  modo: ModoEdicaoDerivado;
  valorManual: number | null;
  motivo?: string;
}

export type EstadosEdicaoDerivados = Record<CampoDerivadoShikigami, EstadoEdicaoDerivado>;
export type ValoresDerivadosShikigami = Record<CampoDerivadoShikigami, number>;

export function resolverValoresDerivados(
  automaticos: ValoresDerivadosShikigami,
  estados: EstadosEdicaoDerivados,
): { valores: ValoresDerivadosShikigami; configuracao: Record<CampoDerivadoShikigami, CampoDerivadoInvocacao> } {
  const valores = {} as ValoresDerivadosShikigami;
  const configuracao = {} as Record<CampoDerivadoShikigami, CampoDerivadoInvocacao>;

  for (const campo of CAMPOS_DERIVADOS_SHIKIGAMI) {
    const estado = estados[campo];
    if (estado.modo === "automatico") {
      valores[campo] = automaticos[campo];
      configuracao[campo] = { modo: "automatico" };
      continue;
    }
    if (estado.valorManual === null || !Number.isFinite(estado.valorManual)) {
      throw new Error("Informe um valor manual finito para " + campo + ".");
    }
    valores[campo] = estado.valorManual;
    if (estado.modo === "manual") {
      configuracao[campo] = { modo: "manual", valor: estado.valorManual };
    } else {
      configuracao[campo] = {
        modo: "revisao_necessaria",
        valorPreservado: estado.valorManual,
        motivo: estado.motivo || "Confirme se o valor legado era automático ou manual.",
      };
    }
  }
  return { valores, configuracao };
}
