import { describe, expect, it } from "vitest";
import {
  resolverValoresDerivados,
  type EstadosEdicaoDerivados,
  type ValoresDerivadosShikigami,
} from "@/lib/controlador/fichaShikigami";

const automaticos: ValoresDerivadosShikigami = {
  hpMaximo: 26,
  defesa: 14,
  deslocamentoM: 9,
  custoInvocacaoPE: 2,
};

describe("edição automática e manual dos valores derivados", () => {
  it("recalcula campos automáticos e conserva o valor manual", () => {
    const estados: EstadosEdicaoDerivados = {
      hpMaximo: { modo: "manual", valorManual: 31 },
      defesa: { modo: "automatico", valorManual: null },
      deslocamentoM: { modo: "manual", valorManual: 12 },
      custoInvocacaoPE: { modo: "automatico", valorManual: null },
    };
    const primeiro = resolverValoresDerivados(automaticos, estados);
    expect(primeiro.valores).toEqual({ hpMaximo: 31, defesa: 14, deslocamentoM: 12, custoInvocacaoPE: 2 });
    expect(primeiro.configuracao.hpMaximo).toEqual({ modo: "manual", valor: 31 });
    expect(primeiro.configuracao.defesa).toEqual({ modo: "automatico" });
    const atualizado = resolverValoresDerivados({ ...automaticos, hpMaximo: 38, defesa: 16 }, estados);
    expect(atualizado.valores.hpMaximo).toBe(31);
    expect(atualizado.valores.defesa).toBe(16);
  });

  it("preserva valor legado sem presumir se era automático ou manual", () => {
    const estados: EstadosEdicaoDerivados = {
      hpMaximo: { modo: "revisao_necessaria", valorManual: 30, motivo: "Origem do valor não registrada." },
      defesa: { modo: "automatico", valorManual: null },
      deslocamentoM: { modo: "automatico", valorManual: null },
      custoInvocacaoPE: { modo: "automatico", valorManual: null },
    };
    const resultado = resolverValoresDerivados(automaticos, estados);
    expect(resultado.valores.hpMaximo).toBe(30);
    expect(resultado.configuracao.hpMaximo).toEqual({
      modo: "revisao_necessaria",
      valorPreservado: 30,
      motivo: "Origem do valor não registrada.",
    });
  });

  it("recusa valor manual vazio ou não finito sem substituir por zero", () => {
    const estados: EstadosEdicaoDerivados = {
      hpMaximo: { modo: "manual", valorManual: null },
      defesa: { modo: "automatico", valorManual: null },
      deslocamentoM: { modo: "automatico", valorManual: null },
      custoInvocacaoPE: { modo: "automatico", valorManual: null },
    };
    expect(() => resolverValoresDerivados(automaticos, estados)).toThrow("valor manual finito");
    estados.hpMaximo.valorManual = Number.POSITIVE_INFINITY;
    expect(() => resolverValoresDerivados(automaticos, estados)).toThrow("valor manual finito");
  });
});
