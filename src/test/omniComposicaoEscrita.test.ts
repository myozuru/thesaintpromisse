// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("./helpers/mesaReal")).nuvemFalsa,
}));
vi.mock("@/integrations/supabase/safeClient", async () => ({
  hasWorkspaceCloud: false,
  supabase: (await import("./helpers/mesaReal")).nuvemFalsa,
}));
vi.mock("@/lib/socket", () => ({ getSocket: () => null }));
import { ficha, montarMesa, pegarFicha, limparMesa } from "./helpers/mesaReal";
import { aplicarEfeitoNoPersonagem } from "@/lib/omni/aplicarEfeito";
import { parseOmniScript } from "@/lib/omni/omniScript";
import { destinoComposto } from "@/lib/omni/componentes/escrita";
import { executarCombatEffect } from "@/lib/omni/executarSubEfeito";
import { montarVariaveisDoPersonagem } from "@/lib/omni/resolvedor";
import { validarDestinoEscritaNatural } from "@/lib/omni/politicaEscritaNatural";
import { SISTEMA_PERICIAS } from "@/lib/omni/constantesDoSistema";
afterEach(limparMesa);
describe("destinos compostos graváveis", () => {
  it("consome e repõe dados de vida com teto", () => {
    montarMesa([ficha("write", { hitDiceCurrent: 2, hitDiceMax: 3 })], {});
    aplicarEfeitoNoPersonagem("write", "ADICIONAR", "dado_vida", 10);
    expect(pegarFicha("write").hitDiceCurrent).toBe(3);
    aplicarEfeitoNoPersonagem("write", "SUBTRAIR", "dado_vida restante", 1);
    // O próprio recurso pode ser usado sem qualificador; `restante` também é um destino válido.
    expect(pegarFicha("write").hitDiceCurrent).toBe(2);
  });
  it("mantém o saldo total ao consumir somente uma fonte do contador", () => {
    montarMesa(
      [
        ficha("write", {
          omniCounters: {
            brasas: 7,
            "brasas__fonte__ALVO-01": 3,
            "brasas__fonte__alvo-02": 4,
          },
        }),
      ],
      {},
    );
    aplicarEfeitoNoPersonagem(
      "write",
      "SUBTRAIR",
      "contador brasas fonte ALVO-01",
      2,
    );
    expect(pegarFicha("write").omniCounters).toMatchObject({
      brasas: 5,
      "brasas__fonte__ALVO-01": 1,
      "brasas__fonte__alvo-02": 4,
    });
  });
  it("não concede escrita a filtros ou consultas percentuais", () => {
    expect(destinoComposto("percentual vida")).toBeUndefined();
    expect(destinoComposto("quantidade buffs ativos")).toBeUndefined();
    expect(
      parseOmniScript("somar 2 em quantidade buffs ativos").erros,
    ).toHaveLength(1);
    expect(parseOmniScript("somar 2 em vida temporaria").erros).toEqual([]);
  });
  it("separa recursos graváveis de métricas derivadas e proteções", () => {
    expect(validarDestinoEscritaNatural("vida")).toEqual({
      ok: true,
      caminho: "vida",
      canal: "vida",
    });
    expect(validarDestinoEscritaNatural("vida temporaria")).toEqual({
      ok: true,
      caminho: "vida_temp",
      canal: "protecao",
    });
    expect(validarDestinoEscritaNatural("pe temporario")).toEqual({
      ok: true,
      caminho: "pe_temp",
      canal: "protecao",
    });
    expect(validarDestinoEscritaNatural("vida maximo")).toEqual({
      ok: true,
      caminho: "vida_max",
      canal: "recurso",
    });
    expect(validarDestinoEscritaNatural("contador rancor")).toEqual({
      ok: true,
      caminho: "contador_rancor",
      canal: "contador",
    });
    expect(validarDestinoEscritaNatural("bloqueio total")).toEqual({
      ok: true,
      caminho: "bloqueio_total",
      canal: "flag",
    });
  });
  it.each([
    "vida_pct",
    "percentual vida",
    "vida faltante",
    "vida total",
    "pe faltante",
    "reserva pe recuperavel",
    "morrendo",
    "morto",
    "inconsciente",
  ])("recusa %s como destino porque é somente leitura", (destino) => {
    expect(validarDestinoEscritaNatural(destino)).toMatchObject({
      ok: false,
      codigo: "DERIVADO_SOMENTE_LEITURA",
    });
  });
  it("recusa destinos fora do catálogo de escrita do executor", () => {
    expect(validarDestinoEscritaNatural("atributo forca")).toMatchObject({
      ok: false,
      codigo: "DESTINO_NAO_SUPORTADO",
    });
    expect(validarDestinoEscritaNatural("recurso inventado")).toMatchObject({
      ok: false,
      codigo: "DESTINO_NAO_SUPORTADO",
    });
  });
  it("valida as 22 perícias canônicas e não cria bônus para perícia inexistente", () => {
    const caminhos = Object.values(SISTEMA_PERICIAS).map((caminho) =>
      caminho.replace(/^pericias\./, "pericia_"),
    );
    for (const caminho of caminhos) {
      expect(validarDestinoEscritaNatural(caminho)).toEqual({
        ok: true,
        caminho,
        canal: "pericia",
      });
    }

    montarMesa([ficha("skill-write", { omniSkillBonuses: { atletismo: 2 } })], {});
    expect(
      aplicarEfeitoNoPersonagem("skill-write", "ADICIONAR", "pericia_atletismo", 3),
    ).toEqual({ aplicado: 5 });
    expect(pegarFicha("skill-write").omniSkillBonuses).toEqual({ atletismo: 5 });

    const before = pegarFicha("skill-write").omniSkillBonuses;
    expect(
      aplicarEfeitoNoPersonagem("skill-write", "ADICIONAR", "pericia_adestramento", 1),
    ).toEqual({ aplicado: 0 });
    expect(pegarFicha("skill-write").omniSkillBonuses).toEqual(before);
    expect(validarDestinoEscritaNatural("pericia_adestramento")).toMatchObject({
      ok: false,
      codigo: "DESTINO_NAO_SUPORTADO",
    });
  });
  it("respeita o teto oficial de fome e a sincronização canônica de exaustão", () => {
    montarMesa([ficha("sobrevivente", { hunger: 20, exhaustionLevel: 0 })], {});
    expect(
      aplicarEfeitoNoPersonagem("sobrevivente", "ADICIONAR", "fome", 10)
        .aplicado,
    ).toBe(24);
    expect(pegarFicha("sobrevivente").hunger).toBe(24);
    expect(
      aplicarEfeitoNoPersonagem("sobrevivente", "SUBTRAIR", "fome", 40)
        .aplicado,
    ).toBe(0);
    expect(pegarFicha("sobrevivente").hunger).toBe(0);

    aplicarEfeitoNoPersonagem("sobrevivente", "ADICIONAR", "exaustao", 7);
    expect(pegarFicha("sobrevivente").exhaustionLevel).toBe(6);
    expect(pegarFicha("sobrevivente").hpCurrent).toBe(0);
  });
  it("transfere o valor calculado uma vez e conserva a reserva excedente", () => {
    const c = ficha("write", {
      economiaPEReserve: 8,
      peCurrent: 4,
      peMax: 10,
      attributes: [],
      skills: [],
      savingThrows: [],
    });
    montarMesa([c], {});
    const script = parseOmniScript(
      "transferir reserva pe recuperavel de reserva pe para pe",
      { defaultTarget: "USUARIO" },
    );
    expect(script.erros).toEqual([]);
    const r = executarCombatEffect(script.efeitos[0], {
      usuarioId: c.id,
      usuarioVars: montarVariaveisDoPersonagem(c),
    });
    expect(r.aplicado).toBe(6);
    expect(pegarFicha("write")).toMatchObject({
      economiaPEReserve: 2,
      peCurrent: 10,
    });
  });
});
