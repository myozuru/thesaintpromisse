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
import { executarCombatEffect, validarEfeitosAtivosDaFicha } from "@/lib/omni/executarSubEfeito";
import { lerCaminhoOmni, montarVariaveisDoPersonagem } from "@/lib/omni/resolvedor";
import { validarDestinoEscritaNatural } from "@/lib/omni/politicaEscritaNatural";
import { SISTEMA_PERICIAS } from "@/lib/omni/constantesDoSistema";
import { useInventoryStore } from "@/stores/useInventoryStore";
import { useCharacterStore } from "@/stores/useCharacterStore";
import { effectiveMovement } from "@/lib/movementBudget";
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
  it("valida destinos no parser e executa aliases graváveis de proteção", () => {
    for (const destino of ["acoes_comuns", "bonus_acerto", "margem_critico"]) {
      expect(parseOmniScript(`somar 1 em ${destino}`).erros).toMatchObject([
        { mensagem: expect.stringContaining("não grava") },
      ]);
    }

    expect(validarDestinoEscritaNatural("vida_temporaria")).toMatchObject({
      ok: true,
      caminho: "vida_temp",
      canal: "protecao",
    });
    expect(validarDestinoEscritaNatural("pe_temporario")).toMatchObject({
      ok: true,
      caminho: "pe_temp",
      canal: "protecao",
    });
    expect(validarDestinoEscritaNatural("usos_restantes")).toMatchObject({
      ok: true,
      caminho: "usos_restantes",
      canal: "item",
    });
    expect(parseOmniScript("somar 1 em exaustao").erros).toEqual([]);
    expect(parseOmniScript("somar 1 em fadiga").erros).toEqual([]);
    expect(parseOmniScript("subtrair 1 em usos_restantes").erros).toEqual([]);

    montarMesa([ficha("protections", { escCurrent: 3, escMax: 10, tempPE: 2 })], {});
    const vida = parseOmniScript("somar 2 em vida_temporaria", {
      defaultTarget: "USUARIO",
    });
    expect(vida.erros).toEqual([]);
    expect(vida.efeitos[0].resourcePath).toBe("vida_temp");
    executarCombatEffect(vida.efeitos[0], {
      usuarioId: "protections",
      usuarioVars: montarVariaveisDoPersonagem(pegarFicha("protections")),
    });
    expect(pegarFicha("protections").escCurrent).toBe(5);
    const vidaVariaveis = montarVariaveisDoPersonagem(pegarFicha("protections"));
    expect(vidaVariaveis.VIDA_TEMP).toBe(5);
    expect(lerCaminhoOmni(pegarFicha("protections"), "vida_temporaria")).toBe(5);

    const excedente = parseOmniScript("somar 20 em vida_temp", {
      defaultTarget: "USUARIO",
    });
    expect(excedente.erros).toEqual([]);
    executarCombatEffect(excedente.efeitos[0], {
      usuarioId: "protections",
      usuarioVars: montarVariaveisDoPersonagem(pegarFicha("protections")),
    });
    expect(pegarFicha("protections").escCurrent).toBe(10);

    const pe = parseOmniScript("somar 3 em pe_temporario", {
      defaultTarget: "USUARIO",
    });
    expect(pe.erros).toEqual([]);
    expect(pe.efeitos[0].resourcePath).toBe("pe_temp");
    executarCombatEffect(pe.efeitos[0], {
      usuarioId: "protections",
      usuarioVars: montarVariaveisDoPersonagem(pegarFicha("protections")),
    });
    expect(pegarFicha("protections").tempPE).toBe(5);
    expect(lerCaminhoOmni(pegarFicha("protections"), "pe_temporario")).toBe(5);
  });
  it("escreve Acerto, Atenção, os cinco TRs, Empolgação e Deslocamento no estado real", () => {
    montarMesa([ficha("stats-write", {
      customHitBonus: 1,
      attention: 10,
      movement: 9,
      empolgacaoLevel: 3,
      characterClass: "Feiticeiro",
      specialization: "Lutador",
      savingThrows: [
        { id: "astucia", name: "Astúcia", value: 1 },
        { id: "fortitude", name: "Fortitude", value: 2 },
        { id: "integridade", name: "Integridade", value: 3 },
        { id: "reflexos", name: "Reflexos", value: 4 },
        { id: "vontade", name: "Vontade", value: 5 },
      ],
    })], {});
    const c = pegarFicha("stats-write");
    const vars = () => montarVariaveisDoPersonagem(pegarFicha(c.id));
    const executar = (texto: string) => {
      const parsed = parseOmniScript(texto, { defaultTarget: "USUARIO" });
      expect(parsed.erros, texto).toEqual([]);
      if (texto.includes("empolgacao")) expect(parsed.efeitos[0].resourcePath).toBe("empolgacao");
      return executarCombatEffect(parsed.efeitos[0], {
        usuarioId: c.id,
        usuarioVars: vars(),
      });
    };

    executar("somar 2 em acerto");
    expect(pegarFicha(c.id).customHitBonus).toBe(3);
    expect(vars().ACERTO).toBe(3);
    executar("subtrair 7 em acerto");
    expect(pegarFicha(c.id).customHitBonus).toBe(-4);
    expect(vars().ACERTO).toBe(-4);
    executar("subtrair 2 em atencao");
    expect(pegarFicha(c.id).attention).toBe(8);
    expect(vars().ATENCAO).toBe(8);

    for (const [tr, esperado] of [["astucia", 0], ["fortitude", 1], ["integridade", 2], ["reflexos", 3], ["vontade", 4]] as const) {
      executar(`subtrair 1 em tr.${tr}`);
      const salvo = pegarFicha(c.id).savingThrows.find((s) => s.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === tr);
      expect(salvo?.value).toBe(esperado);
      expect(vars()[tr.toUpperCase()]).toBe(esperado);
    }
    executar("subtrair 4 em tr.astucia");
    expect(pegarFicha(c.id).savingThrows[0].value).toBe(-4);
    expect(vars().ASTUCIA).toBe(-4);

    executar("somar 4 em empolgacao_nivel");
    expect(pegarFicha(c.id).empolgacaoLevel).toBe(5);
    executar("somar 2 em empolgacao");
    expect(pegarFicha(c.id).empolgacaoLevel).toBe(5);
    executar("subtrair 8 em empolgacao");
    expect(pegarFicha(c.id).empolgacaoLevel).toBe(0);

    executar("somar 3 em deslocamento");
    expect(pegarFicha(c.id).movement).toBe(12);
    expect(effectiveMovement(pegarFicha(c.id))).toBe(12);
    executar("subtrair 20 em deslocamento");
    expect(pegarFicha(c.id).movement).toBe(0);
  });
  it("consome usos_restantes na instância indicada e mantém o limite", () => {
    montarMesa([ficha("item-owner")], {});
    useInventoryStore.setState({
      items: {
        copia_a: {
          instanceId: "copia_a", ownerId: "item-owner", entity: {} as never,
          acquiredAt: 1, usosRestantes: 4, usosTotais: 5,
        },
        copia_b: {
          instanceId: "copia_b", ownerId: "item-owner", entity: {} as never,
          acquiredAt: 1, usosRestantes: 2, usosTotais: 5,
        },
      },
    } as never);
    const parsed = parseOmniScript("subtrair 2 em @ITEM.usos_restantes", { defaultTarget: "USUARIO" });
    expect(parsed.erros).toEqual([]);
    const contexto = {
      usuarioId: "item-owner",
      usuarioVars: montarVariaveisDoPersonagem(pegarFicha("item-owner")),
      sourceInstanceId: "copia_a",
    };
    expect(executarCombatEffect(parsed.efeitos[0], contexto)).toMatchObject({ aplicado: 2, consumido: 2 });
    expect(useInventoryStore.getState().items.copia_a.usosRestantes).toBe(2);
    expect(useInventoryStore.getState().items.copia_b.usosRestantes).toBe(2);
    const recarga = parseOmniScript("somar 20 em usos_restantes", { defaultTarget: "USUARIO" });
    expect(recarga.erros).toEqual([]);
    executarCombatEffect(recarga.efeitos[0], contexto);
    expect(useInventoryStore.getState().items.copia_a.usosRestantes).toBe(5);
    expect(aplicarEfeitoNoPersonagem("item-owner", "SUBTRAIR", "usos_restantes", 1)).toEqual({ aplicado: 0 });
  });
  it("recusa usos_restantes no executor sem instância de origem", () => {
    montarMesa([ficha("item-owner")], {});
    useInventoryStore.setState({ items: {} });
    const parsed = parseOmniScript("subtrair 1 em @ITEM.usos_restantes", { defaultTarget: "USUARIO" });
    const result = executarCombatEffect(parsed.efeitos[0], {
      usuarioId: "item-owner",
      usuarioVars: montarVariaveisDoPersonagem(pegarFicha("item-owner")),
    });
    expect(result).toMatchObject({ aplicado: 0, invalido: true });
    expect(pegarFicha("item-owner").omniCounters).toBeUndefined();
  });
  it("reconhece o destino de uso do item mesmo com escopo @ITEM", () => {
    expect(validarDestinoEscritaNatural("@ITEM.usos_restantes")).toMatchObject({
      ok: true,
      caminho: "usos_restantes",
      canal: "item",
    });
  });
  it("pré-valida fórmulas, condições e alvos antes do uso do item", () => {
    montarMesa([ficha("item-owner", { hpCurrent: 20, hpMax: 20 })], {});
    const parsed = parseOmniScript("somar 1 em pe", { defaultTarget: "USUARIO" });
    const base = parsed.efeitos[0];
    const contexto = { usuarioId: "item-owner", usuarioVars: montarVariaveisDoPersonagem(pegarFicha("item-owner")) };
    expect(validarEfeitosAtivosDaFicha([{ ...base, formula: "@USUARIO.chave_inexistente + 2" }], contexto)).toMatchObject({
      ok: false,
      detalhe: expect.stringContaining("chave_inexistente"),
    });
    expect(validarEfeitosAtivosDaFicha([{ ...base, condition: "@USUARIO.vida < 10" }], contexto)).toEqual({ ok: true, ignorados: [0] });
    expect(validarEfeitosAtivosDaFicha([{ ...base, target: "ALVO" }], contexto)).toMatchObject({
      ok: false,
      detalhe: expect.stringContaining("alvo selecionado"),
    });
    expect(validarEfeitosAtivosDaFicha([{
      ...base,
      diceSwitch: {
        dice: "1d2",
        branches: [{ values: [1], effects: [{ ...base, formula: "@USUARIO.chave_inexistente" }] }],
      },
    }], contexto)).toMatchObject({
      ok: false,
      detalhe: expect.stringContaining("chave_inexistente"),
    });
  });
  it("recusa tetos aleatórios ou negativos em efeitos diretos e subefeitos", () => {
    montarMesa([ficha("item-owner", { hpCurrent: 20, hpMax: 20 })], {});
    const contador = parseOmniScript("somar 1 em contador_rancor", { defaultTarget: "USUARIO" }).efeitos[0];
    const contexto = { usuarioId: "item-owner", usuarioVars: montarVariaveisDoPersonagem(pegarFicha("item-owner")) };

    expect(validarEfeitosAtivosDaFicha([{ ...contador, counterCap: "1d4" }], contexto)).toMatchObject({
      ok: false, detalhe: expect.stringContaining("determinístico"),
    });
    expect(validarEfeitosAtivosDaFicha([{ ...contador, counterSourceLimit: "-1" }], contexto)).toMatchObject({
      ok: false, detalhe: expect.stringContaining("não negativo"),
    });
    expect(validarEfeitosAtivosDaFicha([{
      ...contador,
      diceSwitch: { dice: "1d2", branches: [{ values: [1], effects: [{ ...contador, counterCap: "1d6" }] }] },
    }], contexto)).toMatchObject({ ok: false, detalhe: expect.stringContaining("teto global precisa ser determinístico") });

    const aplicado = executarCombatEffect({ ...contador, counterCap: "1d4" }, contexto);
    expect(aplicado).toMatchObject({ aplicado: 0, invalido: true, detalhe: expect.stringContaining("determinístico") });
    expect(pegarFicha("item-owner").omniCounters?.rancor).toBeUndefined();
  });
  it("concede e consome vida temporária mesmo sem teto de escudo configurado", () => {
    montarMesa([ficha("sem-teto", { hpCurrent: 20, hpMax: 20, escCurrent: 0, escMax: 0 })], {});
    const parsed = parseOmniScript("somar 8 em @USUARIO.vida temporaria", {
      defaultTarget: "USUARIO",
    });
    expect(parsed.erros).toEqual([]);
    const aplicado = executarCombatEffect(parsed.efeitos[0], {
      usuarioId: "sem-teto",
      usuarioVars: montarVariaveisDoPersonagem(pegarFicha("sem-teto")),
    });
    expect(aplicado.aplicado).toBe(8);
    expect(pegarFicha("sem-teto").escCurrent).toBe(8);
    expect(montarVariaveisDoPersonagem(pegarFicha("sem-teto")).VIDA_TEMP).toBe(8);

    useCharacterStore.getState().applyDamage("sem-teto", 3, undefined, { ignoresRD: true });
    expect(pegarFicha("sem-teto").escCurrent).toBe(5);
    expect(pegarFicha("sem-teto").hpCurrent).toBe(20);
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
