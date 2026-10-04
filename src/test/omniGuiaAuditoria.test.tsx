// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("./helpers/mesaReal")).nuvemFalsa,
}));
vi.mock("@/integrations/supabase/safeClient", async () => ({
  hasWorkspaceCloud: false,
  supabase: (await import("./helpers/mesaReal")).nuvemFalsa,
}));
vi.mock("@/lib/socket", () => ({ getSocket: () => null }));
import { CHAVES_GUIA_OMNI, GATILHOS_GUIA_OMNI } from "@/lib/omni/guiaDados";
import { exemploCompostoDaChave } from "@/lib/omni/exemplosGuia";
import { EXEMPLOS_COMPONENTES_UI } from "@/lib/omni/componentes/exemplosUI";
import { CATALOGO_COMPONENTES_UI } from "@/lib/omni/componentes/catalogoUI";
import revisoesComponentes from "../../docs/omni-componentes/revisoes-componentes.json";
import revisoes from "../../docs/omni-componentes/revisoes-guia.json";
import { parseOmniScript } from "@/lib/omni/omniScript";
import { montarVariaveisDoPersonagem } from "@/lib/omni/resolvedor";
import { buildDefaultAttributes, buildDefaultSkills } from "@/lib/defaults";
import { DEFAULT_SAVING_THROWS, type Character } from "@/types";
import { avaliarFormula } from "@/lib/omni/parser";

describe("auditoria funcional do guia", () => {
  it("publica cada revisão editorial sem perder origem, modelo ou aliases", () => {
    for (const [id, revisao] of Object.entries(revisoes)) {
      const exemplo = EXEMPLOS_COMPONENTES_UI.find((e) => e.id === id)!;
      expect(exemplo).toMatchObject(revisao);
      expect(exemplo.modelo).toBeTruthy();
      expect(exemplo.origem).toBeTruthy();
    }
  });
  it("cards dos componentes preservam suas revisões funcionais", () => {
    for (const [key, revisao] of Object.entries(revisoesComponentes))
      expect(CATALOGO_COMPONENTES_UI.find((c) => c.key === key)).toMatchObject(
        revisao,
      );
  });
  it("cards históricos reutilizam o exemplo composto quando há correspondência", () => {
    const faltantes = CHAVES_GUIA_OMNI.filter(
      (c) => !exemploCompostoDaChave(c),
    ).map((c) => c.id);
    expect(faltantes).toEqual([]);
    for (const c of CHAVES_GUIA_OMNI) {
      const e = exemploCompostoDaChave(c);
      if (e) expect(e.explicacao).toBeTruthy();
    }
    expect(
      exemploCompostoDaChave({ id: "vida", aliases: ["hp"] }),
    ).toMatchObject(revisoes["316"]);
  });
  it.each(
    EXEMPLOS_COMPONENTES_UI.filter(
      (e) =>
        e.modelo.startsWith("pericia ") ||
        ["astucia", "fortitude", "integridade", "reflexos", "vontade"].includes(
          e.modelo,
        ),
    ),
  )("$modelo compara o dado mais o bônus", (e) => {
    const script = parseOmniScript(e.formula);
    expect(script.erros).toEqual([]);
    expect(script.efeitos[0].condition).toContain("1d20");
  });
  it("Medicina com bônus 5 pode falhar ou passar conforme o d20", () => {
    const e = EXEMPLOS_COMPONENTES_UI.find((e) => e.id === "205")!,
      parsed = parseOmniScript(e.formula);
    const condition = parsed.efeitos[0].condition!;
    const vars = {};
    const extras = {
      cena: { dt: 13 },
      composicoes: {
        USUARIO: { selecoes: { pericia: { campos: { medicina: 5 } } } },
      },
    };
    const falha = avaliarFormula(condition, vars, () => 0, extras),
      sucesso = avaliarFormula(condition, vars, () => 0.45, extras);
    expect(falha.diagnosticos).toEqual([]);
    expect(sucesso.diagnosticos).toEqual([]);
    expect(falha.valor).toBe(0);
    expect(sucesso.valor).toBe(1);
  });
  it("veneno usa evento de turno, não watcher da rodada da cena", () => {
    const p = parseOmniScript(
      EXEMPLOS_COMPONENTES_UI.find((e) => e.id === "078")!.formula,
    );
    expect(p.erros).toEqual([]);
    expect(p.efeitos[0].trigger).toBe("noFimDoTurno");
    expect(p.efeitos[0].watcher).toBeUndefined();
  });
});

describe("referências de cada exemplo no contexto do motor", () => {
  const usuario = {
    id: "u",
    name: "Usuário",
    level: 4,
    trainingBonus: 3,
    hpCurrent: 20,
    hpMax: 40,
    peCurrent: 10,
    peMax: 20,
    escCurrent: 0,
    escMax: 10,
    attributes: buildDefaultAttributes(),
    skills: buildDefaultSkills([]),
    savingThrows: DEFAULT_SAVING_THROWS.map((name) => ({
      id: name,
      name,
      value: 3,
    })),
    omniFlags: {},
    omniCounters: {},
    spells: [],
    activeConditions: [],
    chosenTalents: [],
    chosenAuraAptitudes: [],
    chosenSpecAbilities: [],
  } as unknown as Character;
  const alvo = { ...usuario, id: "a" };
  it.each(EXEMPLOS_COMPONENTES_UI)(
    "$id: $modelo resolve sem chave ausente",
    (e) => {
      const p = parseOmniScript(e.formula),
        vars = {
          ...montarVariaveisDoPersonagem(usuario, "USUARIO"),
          ...montarVariaveisDoPersonagem(alvo, "ALVO"),
        };
      const extras = {
        cena: {
          dt: 14,
          distancia: 3,
          no_mapa: 1,
          consumido: 2,
          dano: 10,
          sujeito_eh_aliado: 1,
          outro_eh_inimigo: 1,
          outro_eh_aliado: 0,
          outro_eh_voce: 0,
        },
        item: { usos_restantes: 2, usos_totais: 3 },
        dano: {
          valor_base: 10,
          valor_inicial: 10,
          valor_final: 8,
          absorvido: 2,
          tipo: 3,
          fonte: 1,
          tipo_ataque: 1,
          id_origem: 1,
          id_alvo: 1,
          foi_critico: 0,
          foi_falha_critica: 0,
          foi_furtivo: 0,
          foi_ataque_oportunidade: 0,
          alcance: 3,
        },
        resultados: [10, 5],
      };
      for (const ef of p.efeitos)
        for (const formula of [ef.condition, ef.formula].filter(
          (f): f is string => !!f,
        )) {
          const r = avaliarFormula(formula, vars, () => 0.4, extras);
          expect(r.diagnosticos, `${e.id}: ${formula}`).toEqual([]);
          expect(Number.isFinite(r.valor), formula).toBe(true);
        }
    },
  );
});

describe("contratos numéricos e contextos corrigidos", () => {
  it("quantidade de reações usadas conserva o valor da ficha", async () => {
    const { dadosTurnos } = await import("@/lib/omni/componentes/cena");
    expect(
      avaliarFormula("quantidade reacoes usadas", {}, undefined, {
        composicoes: {
          USUARIO: dadosTurnos({ REACOES_USADAS_NESTA_RODADA: 2 }),
        },
      }),
    ).toMatchObject({ valor: 2, diagnosticos: [] });
  });
  it("percentual sacrificado usa Vida Máxima como denominador", async () => {
    const { dadosRecursos } = await import("@/lib/omni/componentes/recursos");
    expect(
      avaliarFormula("percentual sacrificio", {}, undefined, {
        composicoes: {
          USUARIO: dadosRecursos({ HP_SACRIFICADO: 10, VIDA_MAX: 40 }),
        },
      }),
    ).toMatchObject({ valor: 25, diagnosticos: [] });
  });
  it("origem, especialização e suporte expõem os fatos positivos corretos", async () => {
    const { dadosRecursos } = await import("@/lib/omni/componentes/recursos");
    const extras = {
      composicoes: {
        USUARIO: dadosRecursos({
          ORIGEM_ID_INATO: 1,
          ESPECIALIZACAO_ID_SUPORTE: 1,
          SUPORTE_LV2_UNLOCKED: 1,
        }),
      },
    };
    for (const f of [
      "origem inato",
      "especializacao suporte",
      "suporte nivel 2",
    ])
      expect(avaliarFormula(f, {}, undefined, extras)).toMatchObject({
        valor: 1,
        diagnosticos: [],
      });
    expect(avaliarFormula("origem nobre", {}, undefined, extras)).toMatchObject(
      { valor: 0, diagnosticos: [] },
    );
  });
  it("extras parciais de cena conservam a contagem já disponível", async () => {
    const { anexarDadosCompostos } =
      await import("@/lib/omni/componentes/contexto");
    const vars = anexarDadosCompostos({}, "CENA", {
      selecoes: {
        aliados: { quantidade: 3 },
        eventos: { campos: { hoje: { quantidade: 2 } } },
      },
    });
    expect(
      avaliarFormula(
        "@CENA.quantidade aliados + @CENA.quantidade eventos hoje",
        vars,
        undefined,
        { cena: { dt: 14 } },
      ),
    ).toMatchObject({ valor: 5, diagnosticos: [] });
  });
  it("ITEM composto recebe os usos fornecidos pelo produtor", () => {
    expect(
      avaliarFormula(
        "@ITEM.usos restantes + @ITEM.usos maximos",
        {},
        undefined,
        { item: { usos_restantes: 2, usos_totais: 5 } },
      ),
    ).toMatchObject({ valor: 7, diagnosticos: [] });
    expect(
      avaliarFormula("@ITEM.usos restantes").diagnosticos.length,
    ).toBeGreaterThan(0);
  });
  it("contador ainda não criado consulta zero; recurso inexistente continua diagnosticado", () => {
    const vars = montarVariaveisDoPersonagem({
      id: "u",
      name: "U",
      omniCounters: {},
    } as Character);
    expect(avaliarFormula("@USUARIO.contador rancor", vars)).toMatchObject({
      valor: 0,
      diagnosticos: [],
    });
    expect(
      avaliarFormula("@USUARIO.recurso_inexistente", vars).diagnosticos.length,
    ).toBeGreaterThan(0);
  });
  it("condição ausente mantém presença falsa e idade sentinela", () => {
    const vars = montarVariaveisDoPersonagem({
      id: "u",
      name: "U",
      activeConditions: [],
    } as unknown as Character);
    expect(
      avaliarFormula("@USUARIO.tem condicao amedrontado", vars),
    ).toMatchObject({ valor: 0, diagnosticos: [] });
    expect(
      avaliarFormula("@USUARIO.idade condicao amedrontado", vars),
    ).toMatchObject({ valor: -1, diagnosticos: [] });
  });
  it("ID de escudo com hífen permanece um argumento completo entre aspas", () => {
    const vars = montarVariaveisDoPersonagem({
      id: "u",
      name: "U",
      equippedShieldId: "sh-leve",
    } as Character);
    expect(
      avaliarFormula('@USUARIO.escudo "sh-leve" equipado', vars),
    ).toMatchObject({ valor: 1, diagnosticos: [] });
  });
});

describe("receitas no combate real", () => {
  it("drenagem cura metade do dano após RD e não aplica outro ataque", async () => {
    const { RECEITAS_OMNI } = await import("@/lib/omni/receitas");
    const { novaEntidade } = await import("@/lib/omni/tipos");
    const { useOmniEntidadesStore } =
      await import("@/stores/useOmniEntidadesStore");
    const { useCharacterStore } = await import("@/stores/useCharacterStore");
    const { ficha, montarMesa, pegarFicha, esperar } =
      await import("./helpers/mesaReal");
    await import("@/lib/omni/executor");
    const e = novaEntidade("passiva");
    e.combatData = {
      critRange: 20,
      critMultiplier: 2,
      effects: [],
      effectsPassive: RECEITAS_OMNI.find(
        (r) => r.id === "drenagem-vampirica",
      )!.build(),
    };
    useOmniEntidadesStore.setState({ entidades: { [e.id]: e } });
    montarMesa(
      [
        ficha("u", {
          hpCurrent: 20,
          hpMax: 40,
          escCurrent: 0,
          rd: 0,
          omniAtivos: [
            {
              id: "v",
              entidadeId: e.id,
              instanceId: "i",
              categoria: "passiva",
              vinculadoEm: 0,
            },
          ],
        }),
        ficha("a", {
          hpCurrent: 50,
          hpMax: 50,
          escCurrent: 0,
          rd: 4,
          omniAtivos: [],
        }),
      ],
      {},
    );
    useCharacterStore
      .getState()
      .applyDamage("a", 10, "DI", { attackerId: "u", source: "arma" });
    await esperar(15);
    expect(pegarFicha("a").hpCurrent).toBe(44);
    expect(pegarFicha("u").hpCurrent).toBe(23);
  });
  it("exemplo de RD informa dano bruto e o motor reduz uma única vez", async () => {
    const { ficha, montarMesa, pegarFicha, esperar } =
      await import("./helpers/mesaReal");
    const { aplicarEfeitoNoPersonagem } =
      await import("@/lib/omni/aplicarEfeito");
    await import("@/lib/omni/executor");
    montarMesa(
      [
        ficha("u", { hpCurrent: 40, hpMax: 40, omniAtivos: [] }),
        ficha("a", {
          hpCurrent: 40,
          hpMax: 40,
          rd: 4,
          escCurrent: 0,
          omniAtivos: [],
        }),
      ],
      {},
    );
    const efeito = parseOmniScript(
      EXEMPLOS_COMPONENTES_UI.find((e) => e.id === "265")!.formula,
    ).efeitos[0];
    const bag = {
      ...montarVariaveisDoPersonagem(pegarFicha("u"), "USUARIO"),
      ...montarVariaveisDoPersonagem(pegarFicha("a"), "ALVO"),
    };
    const valor = avaliarFormula(efeito.formula, bag, () => 0.5).valor;
    expect(valor).toBe(10);
    aplicarEfeitoNoPersonagem("a", efeito.type, efeito.resourcePath, valor, {
      damageType: efeito.damageType,
      attackerId: "u",
    });
    expect(pegarFicha("a").hpCurrent).toBe(34);
    await esperar(5);
  });
  it("toda receita de dano declara um tipo aceito; choque não usa AREA como atalho", async () => {
    const { RECEITAS_OMNI } = await import("@/lib/omni/receitas"),
      { resolverTipoDano } = await import("@/lib/omni/contextoDano");
    for (const r of RECEITAS_OMNI)
      for (const ef of r.build())
        if (ef.type === "SUBTRAIR" && ef.resourcePath === "vida_atual")
          expect(
            resolverTipoDano(ef.damageType),
            `${r.id}: ${ef.damageType}`,
          ).toBeDefined();
    expect(
      RECEITAS_OMNI.find((r) => r.id === "choque-encadeado")!
        .build()
        .map((e) => e.target),
    ).toEqual(["ALVO", "ALVO"]);
  });
});

describe("configurações completas mostradas no guia", () => {
  it("golpe com arma faz teste de acerto: erro paga o custo e não causa dano", async () => {
    const { FLUXOS_ACOES_GUIA } = await import("@/lib/omni/fluxosGuia");
    const { executarAcaoAtiva } = await import("@/lib/omni/acaoAtiva");
    const { ficha, montarMesa, pegarFicha, forcarDados, esperar } =
      await import("./helpers/mesaReal");
    const { useCombatStore } = await import("@/stores/useCombatStore");
    useCombatStore.setState({ inCombat: false });
    montarMesa(
      [
        ficha("u", {
          hpCurrent: 40,
          hpMax: 40,
          peCurrent: 20,
          peMax: 20,
          actionsCurrent: 2,
          mainHandWeaponName: "Adaga",
          attributes: [],
          skills: [],
          omniAtivos: [],
        }),
        ficha("a", {
          category: "INIMIGO",
          hpCurrent: 50,
          hpMax: 50,
          ca: 10,
          rd: 0,
          escCurrent: 0,
          omniAtivos: [],
        }),
      ],
      { u: [0, 0], a: [1, 0] },
    );
    forcarDados(1);
    const r = await executarAcaoAtiva(
      "u",
      FLUXOS_ACOES_GUIA[0].acao,
      "a",
      undefined,
      { ignorarReacoes: true },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.reason);
    expect(r.detalhe).toContain("ERROU");
    expect(r.dano).toBe(0);
    expect(pegarFicha("a").hpCurrent).toBe(50);
    expect(pegarFicha("u").peCurrent).toBe(10);
    await esperar(5);
  });
  it("cura múltipla cobra 4 PE uma vez e cura apenas os três aliados selecionados", async () => {
    const { FLUXOS_ACOES_GUIA } = await import("@/lib/omni/fluxosGuia");
    const { executarAcaoAtiva } = await import("@/lib/omni/acaoAtiva");
    const { ficha, montarMesa, pegarFicha, esperar } =
      await import("./helpers/mesaReal");
    vi.spyOn(Math, "random").mockReturnValue(0);
    montarMesa(
      ["u", "a", "b", "c", "d"].map((id) =>
        ficha(id, {
          hpCurrent: 20,
          hpMax: 40,
          peCurrent: 20,
          peMax: 20,
          actionsCurrent: 2,
          attributes: [],
          skills: [],
          omniAtivos: [],
          healingHalved: false,
        }),
      ),
      { u: [0, 0], a: [1, 0], b: [2, 0], c: [3, 0], d: [4, 0] },
    );
    try {
      const r = await executarAcaoAtiva(
        "u",
        FLUXOS_ACOES_GUIA[1].acao,
        ["a", "b", "c"],
        undefined,
        { ignorarReacoes: true },
      );
      expect(r.ok).toBe(true);
      expect(pegarFicha("u").peCurrent).toBe(16);
      for (const id of ["a", "b", "c"])
        expect(pegarFicha(id).hpCurrent).toBe(22);
      expect(pegarFicha("d").hpCurrent).toBe(20);
      await esperar(5);
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe("exemplos completos dos 34 gatilhos", () => {
  it.each(GATILHOS_GUIA_OMNI)(
    "$id preserva o evento e tem efeito executável",
    (g) => {
      const p = parseOmniScript(g.exemplo);
      expect(p.erros).toEqual([]);
      expect(p.efeitos.length).toBeGreaterThan(0);
      expect(p.efeitos[0].trigger).toBe(g.id);
      expect(g.explicacao.length).toBeGreaterThan(80);
    },
  );
});
