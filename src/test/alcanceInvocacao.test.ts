import { describe, expect, it } from "vitest";
import { alcancePosicionamentoInvocacao } from "@/lib/controlador/alcanceInvocacao";
import { criarPacoteDezSombras } from "@/lib/controlador/dezSombras";
import { criarFormasDerivadasDezSombras } from "@/lib/controlador/dezSombrasDerivadas";

describe("alcance base de invocação", () => {
  it("usa 1 metro quando a ficha antiga não tem alcance", () => {
    expect(alcancePosicionamentoInvocacao({})).toBe(1);
  });

  it.each([0, 0.5, 3, 18])("preserva o alcance configurado de %s metros", (alcanceInvocacaoM) => {
    expect(alcancePosicionamentoInvocacao({ alcanceInvocacaoM })).toBe(alcanceInvocacaoM);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "mantém valores inválidos sujeitos à validação",
    (alcanceInvocacaoM) => {
      expect(alcancePosicionamentoInvocacao({ alcanceInvocacaoM })).toBe(alcanceInvocacaoM);
    },
  );

  it("cria todos os perfis e formas derivadas das Dez Sombras com alcance de 1 metro", () => {
    const modelos = [
      ...criarPacoteDezSombras("dono", true),
      ...criarFormasDerivadasDezSombras("dono"),
    ];
    expect(modelos.length).toBeGreaterThan(0);
    modelos.forEach((modelo) => expect(modelo.alcanceInvocacaoM).toBe(1));
  });
});
