// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("./helpers/mesaReal")).nuvemFalsa,
}));
vi.mock("@/integrations/supabase/safeClient", async () => ({
  hasWorkspaceCloud: false,
  supabase: (await import("./helpers/mesaReal")).nuvemFalsa,
}));
vi.mock("@/lib/socket", () => ({ getSocket: () => null }));
import { act, cleanup, render } from "@testing-library/react";
import { createFakeMesa } from "./helpers/fakeMesa";
import {
  comoTela,
  esperar,
  ficha,
  montarMesa,
  pegarFicha,
} from "./helpers/mesaReal";
import {
  carimbarDicionario,
  mergeDicionario,
  pacoteDicionario,
  type DicionarioSync,
} from "@/lib/omni/dicionarioSync";
import {
  comEstadoRemoto,
  estadoRemotoEmAplicacao,
} from "@/lib/omni/estadoRemoto";
import {
  efeitoSyncValido,
  entidadeSyncValida,
  posicaoSyncValida,
} from "@/lib/omni/validarSnapshot";
import {
  useOmniRuntimeStore,
  type EfeitoAtivo,
} from "@/stores/useOmniRuntimeStore";
import { useOmniEntidadesStore } from "@/stores/useOmniEntidadesStore";
import { useOmniSpatialStore } from "@/stores/useOmniSpatialStore";
import { useInventoryStore } from "@/stores/useInventoryStore";
import { useCharacterStore } from "@/stores/useCharacterStore";
import { useMapStore } from "@/stores/useMapStore";
import { useChronosStore } from "@/stores/useChronosStore";
import { GlobalClockTicker } from "@/components/chronos/GlobalClockTicker";
import { novaEntidade } from "@/lib/omni/tipos";
import { mergeInventory } from "@/lib/omni/inventorySync";
import { exemplarArma } from "@/lib/omni/exemplarArma";
import { armaDoPersonagem } from "@/lib/omni/armaDoPersonagem";
import { applyWeaponModel } from "@/lib/omni/weaponModel";
import { findWeaponByName } from "@/lib/weapons";
import { coletarFontesGatilho } from "@/lib/omni/fontesGatilho";
import { iniciarWatcherEngine } from "@/lib/omni/watcherEngine";
import { recalcularAuras } from "@/lib/omni/auras";
import * as bus from "@/lib/omni/eventBus";
import {
  observarMovimentoConfirmado,
  previaDepoisDaConfirmacao,
  receberMovimentoConfirmado,
  type MovimentoConfirmadoMapa,
} from "@/lib/mapa/movimentoConfirmado";
const vazio = (): DicionarioSync<EfeitoAtivo> => ({ records: {}, deleted: {} });
const ef = (id: string, at = 10): EfeitoAtivo => ({
  id,
  entidadeId: "e",
  nomeSnapshot: id,
  iniciadoEm: 0,
  expiraEm: null,
  _syncAt: at,
});
const pacote = (
  records: Record<string, EfeitoAtivo>,
  deleted: Record<string, number> = {},
) => pacoteDicionario(records, deleted);
beforeEach(async () => {
  comoTela({ role: "MASTER", profileId: null });
  comEstadoRemoto(() => {
    useInventoryStore.setState({ items: {}, deleted: {} });
    useOmniEntidadesStore.setState({ entidades: {}, deleted: {} });
    useOmniRuntimeStore.setState({ efeitos: {}, deleted: {} });
    useOmniSpatialStore.setState({
      posicoes: {},
      deleted: {},
      aurasDentro: {},
    });
  });
  useMapStore.setState({
    activeSceneId: crypto.randomUUID(),
    pendingMove: null,
  });
  montarMesa(
    [
      ficha("u", {
        hpCurrent: 100,
        hpMax: 100,
        peCurrent: 5,
        peMax: 20,
        omniAtivos: [],
      }),
      ficha("a"),
    ],
    { u: [0, 0], a: [1, 0] },
  );
  iniciarWatcherEngine();
  await esperar(5);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("snapshots de várias telas", () => {
  it("une efeitos independentes entre Mestre e jogador sem apagar o efeito local", () => {
    const mesa = createFakeMesa(vazio, {
      sync: (c, p) => {
        c.state = mergeDicionario(c.state, p.snapshot, efeitoSyncValido);
      },
    });
    const m = mesa.join({ name: "M", role: "MASTER", profileId: null }),
      p = mesa.join({ name: "P", role: "PLAYER", profileId: "p" });
    m.state.records.m = ef("m");
    p.state.records.p = ef("p");
    m.send("sync", { snapshot: pacote(m.state.records) });
    p.send("sync", { snapshot: pacote(p.state.records) });
    expect(m.state).toEqual(p.state);
    expect(Object.keys(m.state.records).sort()).toEqual(["m", "p"]);
  });
  it("entrega duplicada e versão antiga não alteram o resultado mais recente", () => {
    const novo = mergeDicionario(
      vazio(),
      pacote({ a: ef("a", 30) }),
      efeitoSyncValido,
    );
    const antigo = mergeDicionario(
      novo,
      pacote({ a: ef("a", 10) }),
      efeitoSyncValido,
    );
    expect(
      mergeDicionario(antigo, pacote({ a: ef("a", 30) }), efeitoSyncValido),
    ).toEqual(novo);
  });
  it("empate converge independentemente da ordem de chegada", () => {
    const a = pacote({ a: ef("a") }),
      b = pacote({ a: { ...ef("a"), nomeSnapshot: "z" } });
    expect(
      mergeDicionario(
        mergeDicionario(vazio(), a, efeitoSyncValido),
        b,
        efeitoSyncValido,
      ),
    ).toEqual(
      mergeDicionario(
        mergeDicionario(vazio(), b, efeitoSyncValido),
        a,
        efeitoSyncValido,
      ),
    );
  });
  it("efeito excluído continua excluído após JSON/reload e replay antigo", () => {
    const removido = mergeDicionario(
      { records: { a: ef("a") }, deleted: {} },
      pacote({}, { a: 20 }),
      efeitoSyncValido,
    );
    const reload = JSON.parse(JSON.stringify(removido));
    expect(
      mergeDicionario(reload, pacote({ a: ef("a", 19) }), efeitoSyncValido),
    ).toEqual(removido);
    expect(
      mergeDicionario(reload, pacote({ a: ef("a", 21) }), efeitoSyncValido)
        .records.a._syncAt,
    ).toBe(21);
  });
  it("catálogo e posição também conservam exclusões persistidas", () => {
    const e = novaEntidade("item");
    e._syncAt = 10;
    const cat = mergeDicionario(
      { records: { [e.id]: e }, deleted: {} },
      pacoteDicionario({}, { [e.id]: 20 }),
      entidadeSyncValida,
    );
    expect(
      mergeDicionario(cat, { [e.id]: e }, entidadeSyncValida).records,
    ).toEqual({});
    const pos = { x: 1, y: 2, _syncAt: 10 };
    const sp = mergeDicionario(
      { records: { u: pos }, deleted: { u: 20 } },
      { u: pos },
      posicaoSyncValida,
    );
    expect(sp.records).toEqual({});
  });
  it("aceita formato legado sem interpretar ausência como exclusão", () => {
    expect(
      Object.keys(
        mergeDicionario(
          { records: { a: ef("a") }, deleted: {} },
          { b: ef("b") },
          efeitoSyncValido,
        ).records,
      ).sort(),
    ).toEqual(["a", "b"]);
  });
  it.each([null, [], { formato: "omni-sync.v1", records: [] }])(
    "ignora envelope inválido %j",
    (p) =>
      expect(mergeDicionario(vazio(), p, efeitoSyncValido)).toEqual(vazio()),
  );
  it.each([
    { a: ef("outro") },
    { a: { ...ef("a"), _syncAt: NaN } },
    { a: { ...ef("a"), expiraEm: Infinity } },
    { constructor: ef("constructor") },
  ] as unknown[])("ignora registro inválido %j", (p) =>
    expect(mergeDicionario(vazio(), p, efeitoSyncValido).records).toEqual({}),
  );
  it("ignora coordenada não finita", () =>
    expect(
      mergeDicionario(
        { records: {}, deleted: {} },
        { u: { x: Infinity, y: 0 } },
        posicaoSyncValida,
      ).records,
    ).toEqual({}));
  it("mudança local tem versão monotônica mesmo com relógio recuando", () => {
    vi.spyOn(Date, "now").mockReturnValue(5);
    const prev = { records: { a: ef("a", 100) }, deleted: {} };
    expect(
      carimbarDicionario(
        {
          records: { a: { ...ef("a", 100), nomeSnapshot: "novo" } },
          deleted: {},
        },
        prev,
      ).records.a._syncAt,
    ).toBe(101);
    expect(
      carimbarDicionario({ records: {}, deleted: {} }, prev).deleted.a,
    ).toBe(101);
  });
  it("recepção não redata inventário nem runtime e libera o contexto depois de erro", () => {
    comEstadoRemoto(() => {
      useOmniRuntimeStore.setState({ efeitos: { a: ef("a", 10) } });
      expect(useOmniRuntimeStore.getState().efeitos.a._syncAt).toBe(10);
      comEstadoRemoto(() => expect(estadoRemotoEmAplicacao()).toBe(true));
    });
    expect(() =>
      comEstadoRemoto(() => {
        throw new Error("teste");
      }),
    ).toThrow();
    expect(estadoRemotoEmAplicacao()).toBe(false);
  });
});

describe("identidade dos exemplares", () => {
  it("snapshot clona configurações aninhadas e tags comerciais", () => {
    const e = novaEntidade("arma");
    e.tags = ["original"];
    e.comercio = { basePrice: 1, hiddenTags: ["segredo"], isBought: false };
    e.usos = { total: 3, recarga: "manual" };
    const i = useInventoryStore.getState().add("u", e);
    e.comercio!.hiddenTags.push("mudou");
    e.usos.total = 9;
    expect(i.entity.comercio!.hiddenTags).toEqual(["segredo"]);
    expect(i.entity.usos!.total).toBe(3);
  });
  it("repetir entrega do mesmo ID não recarrega usos nem duplica o item", () => {
    const e = novaEntidade("item");
    e.usos = { total: 3, recarga: "manual" };
    useInventoryStore.getState().add("u", e, { instanceId: "i" });
    useInventoryStore.getState().consumirUso("i");
    expect(
      useInventoryStore.getState().add("u", e, { instanceId: "i" })
        .usosRestantes,
    ).toBe(2);
    expect(Object.keys(useInventoryStore.getState().items)).toHaveLength(1);
    expect(() =>
      useInventoryStore.getState().add("a", e, { instanceId: "i" }),
    ).toThrow();
    useInventoryStore.getState().remove("i");
    expect(() =>
      useInventoryStore.getState().add("u", e, { instanceId: "i" }),
    ).toThrow();
  });
  it.each([-1, NaN, Infinity, 0.5])(
    "custo de usos inválido %s não aumenta cargas",
    (n) => {
      const e = novaEntidade("item");
      e.usos = { total: 3, recarga: "manual" };
      const i = useInventoryStore.getState().add("u", e);
      expect(useInventoryStore.getState().consumirUso(i.instanceId, n)).toBe(
        false,
      );
      expect(
        useInventoryStore.getState().items[i.instanceId].usosRestantes,
      ).toBe(3);
    },
  );
  it("contagem de usos corrompida não é consumida", () => {
    const e = novaEntidade("item");
    const i = useInventoryStore.getState().add("u", e);
    useInventoryStore.setState({
      items: { [i.instanceId]: { ...i, usosTotais: 3, usosRestantes: NaN } },
    });
    expect(useInventoryStore.getState().consumirUso(i.instanceId)).toBe(false);
  });
  it("exemplar automático independe da ordem e mantém seleção explícita com estatísticas próprias", () => {
    const e = applyWeaponModel(
      novaEntidade("arma"),
      findWeaponByName("Adaga")!,
    );
    e.nome = "Lâmina";
    const outro = {
      ...e,
      id: crypto.randomUUID(),
      combatData: { ...e.combatData!, critRange: 16 },
    };
    const a = useInventoryStore.getState().add("u", e, { instanceId: "a" }),
      z = useInventoryStore.getState().add("u", outro, { instanceId: "z" });
    useInventoryStore.setState({
      items: { z: { ...z, acquiredAt: 1 }, a: { ...a, acquiredAt: 1 } },
    });
    useCharacterStore
      .getState()
      .updateCharacter("u", { mainHandWeaponName: "Lâmina" });
    expect(exemplarArma("u", "Lâmina")!.instanceId).toBe("a");
    expect(
      coletarFontesGatilho(pegarFicha("u")).equipados.map((i) => i.instanceId),
    ).toEqual(["a"]);
    expect(armaDoPersonagem("u", "Lâmina", "z")!.critRange).toBe(16);
    expect(armaDoPersonagem("a", "Lâmina", "z")).toBeUndefined();
  });
  it("vínculo repetido não duplica a fonte automática", () => {
    const e = novaEntidade("passiva");
    useOmniEntidadesStore.setState({ entidades: { [e.id]: e } });
    const v = {
      id: "v",
      entidadeId: e.id,
      categoria: "passiva" as const,
      instanceId: "i",
      vinculadoEm: 0,
    };
    useCharacterStore
      .getState()
      .updateCharacter("u", { omniAtivos: [v, { ...v, id: "v2" }] });
    expect(coletarFontesGatilho(pegarFicha("u")).vinculados).toHaveLength(1);
  });
});

describe("receber resultado versus executar", () => {
  it("snapshot remoto de PV não dispara watcher nem deixa travessia antiga pendente", async () => {
    const e = novaEntidade("item");
    e.combatData = {
      critRange: 20,
      critMultiplier: 2,
      effects: [],
      effectsPassive: [
        {
          id: "w",
          type: "ADICIONAR",
          target: "USUARIO",
          resourcePath: "pe",
          formula: "1",
          watcher: { resource: "vida", op: "<=", threshold: 50 },
        },
      ],
    };
    const i = useInventoryStore.getState().add("u", e);
    useInventoryStore.getState().equipItem(i.instanceId, "anel");
    await esperar(5);
    comEstadoRemoto(() =>
      useCharacterStore.getState().updateCharacter("u", { hpCurrent: 40 }),
    );
    await esperar(10);
    useCharacterStore.getState().updateCharacter("u", { hpCurrent: 35 });
    await esperar(10);
    expect(pegarFicha("u").peCurrent).toBe(5);
    useCharacterStore.getState().updateCharacter("u", { hpCurrent: 80 });
    await esperar(5);
    useCharacterStore.getState().updateCharacter("u", { hpCurrent: 40 });
    await esperar(10);
    expect(pegarFicha("u").peCurrent).toBe(6);
  });
  it("aura vinculada e runtime não duplicam entrada; cache sobrevive a JSON/reload", () => {
    const spy = vi.spyOn(bus, "emitirEventoDaEntidade");
    const e = novaEntidade("aura");
    e.areaRaio = { tipo: "fixo", valor: 4.5 };
    useOmniEntidadesStore.setState({ entidades: { [e.id]: e } });
    const v = {
      id: "v",
      entidadeId: e.id,
      categoria: "aura" as const,
      instanceId: "i",
      vinculadoEm: 0,
    };
    useCharacterStore
      .getState()
      .updateCharacter("u", { omniAtivos: [v, { ...v, id: "v2" }] });
    useOmniRuntimeStore.getState().aplicarEfeito(e, { sourceCharId: "u" });
    recalcularAuras();
    expect(
      spy.mock.calls.filter((c) => c[1] === "aoEntrarEmAura"),
    ).toHaveLength(2);
    const cache = JSON.parse(
      JSON.stringify(useOmniSpatialStore.getState().aurasDentro),
    );
    useOmniSpatialStore.setState({ aurasDentro: cache });
    recalcularAuras();
    expect(
      spy.mock.calls.filter((c) => c[1] === "aoEntrarEmAura"),
    ).toHaveLength(2);
  });
  it("jogador e recepção remota não calculam entradas de aura", () => {
    const spy = vi.spyOn(bus, "emitirEventoDaEntidade");
    const e = novaEntidade("aura");
    e.areaRaio = { tipo: "fixo", valor: 4.5 };
    useOmniEntidadesStore.setState({ entidades: { [e.id]: e } });
    useOmniRuntimeStore.getState().aplicarEfeito(e, { sourceCharId: "u" });
    comoTela({ role: "PLAYER", profileId: "p" });
    recalcularAuras();
    comoTela({ role: "MASTER", profileId: null });
    comEstadoRemoto(() => recalcularAuras());
    expect(spy).not.toHaveBeenCalled();
  });
  it("relógio recebido pelo jogador não avança outra vez nem poda localmente", () => {
    let frame: (at: number) => void = () => {};
    vi.stubGlobal("requestAnimationFrame", (fn: (at: number) => void) => {
      frame = fn;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const tick = vi.fn(),
      podar = vi.spyOn(useOmniRuntimeStore.getState(), "podarExpirados");
    const original = useChronosStore.getState().tick;
    useChronosStore.setState({ isRunning: true, multiplier: 1, tick });
    comoTela({ role: "PLAYER", profileId: "p" });
    const view = render(<GlobalClockTicker />);
    act(() => frame(performance.now() + 1000));
    expect(tick).not.toHaveBeenCalled();
    expect(podar).not.toHaveBeenCalled();
    comoTela({ role: "MASTER", profileId: null });
    act(() => frame(performance.now() + 2000));
    expect(tick).toHaveBeenCalledTimes(1);
    expect(podar).toHaveBeenCalledTimes(1);
    view.unmount();
    useChronosStore.setState({ tick: original, isRunning: false });
  });
});

describe("movimentos duplicados e fora de ordem", () => {
  const msg = (
    at: number,
    id: string = crypto.randomUUID(),
  ): MovimentoConfirmadoMapa => ({
    at,
    id,
    sceneId: useMapStore.getState().activeSceneId,
    entityId: "e-u",
    characterId: "u",
    de: { x: 0, y: 0 },
    para: { x: at, y: 0 },
    trajetoria: [],
    teleporte: false,
  });
  it("duplicação por dois transportes só entrega um evento", () => {
    const fn = vi.fn(),
      parar = observarMovimentoConfirmado(fn),
      m = msg(20);
    expect(receberMovimentoConfirmado(m)).toBe(true);
    expect(receberMovimentoConfirmado(m)).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
    parar();
  });
  it("mensagem atrasada não reverte posição nem dispara novo evento", () => {
    receberMovimentoConfirmado(msg(30));
    expect(receberMovimentoConfirmado(msg(20))).toBe(false);
    expect(useMapStore.getState().entities["e-u"].x).toBe(30);
  });
  it("checkpoint persistido rejeita replay após recarregar dados", () => {
    receberMovimentoConfirmado(msg(30, "z"));
    useMapStore.setState({
      entities: JSON.parse(JSON.stringify(useMapStore.getState().entities)),
    });
    expect(receberMovimentoConfirmado(msg(30, "a"))).toBe(false);
    expect(receberMovimentoConfirmado(msg(31, "a"))).toBe(true);
  });
  it.each([undefined, 29, 30, NaN])(
    "prévia %s não sobrescreve confirmação 30",
    (at) =>
      expect(previaDepoisDaConfirmacao({ _omniMoveAt: 30 }, at)).toBe(false),
  );
  it("prévia posterior e mapa legado sem checkpoint continuam aceitos", () => {
    expect(previaDepoisDaConfirmacao({ _omniMoveAt: 30 }, 31)).toBe(true);
    expect(previaDepoisDaConfirmacao({}, undefined)).toBe(true);
  });
  it("recusa posição não finita, cena errada e peça carregada", () => {
    expect(
      receberMovimentoConfirmado({ ...msg(10), para: { x: NaN, y: 0 } }),
    ).toBe(false);
    expect(receberMovimentoConfirmado({ ...msg(10), sceneId: "outra" })).toBe(
      false,
    );
    useMapStore.getState().updateEntity("e-u", { carriedBy: "outro" });
    expect(receberMovimentoConfirmado(msg(10))).toBe(false);
  });
});

describe("persistência nas stores reais", () => {
  it("alterar e excluir efeito carimba versões e mantém tombstone no cache", () => {
    const e = novaEntidade("passiva"),
      rt = useOmniRuntimeStore.getState();
    const efeito = rt.aplicarEfeito(e, { targetCharId: "u" }),
      antes = useOmniRuntimeStore.getState().efeitos[efeito.id]._syncAt!;
    rt.removerEfeito(efeito.id);
    const estado = useOmniRuntimeStore.getState();
    expect(estado.deleted[efeito.id]).toBeGreaterThan(antes);
    const cache = JSON.parse(
      localStorage.getItem("omni-runtime-efeitos")!,
    ).state;
    expect(cache.deleted[efeito.id]).toBe(estado.deleted[efeito.id]);
  });
  it("excluir posição impede que posição antiga seja hidratada novamente", () => {
    useOmniSpatialStore.getState().mover("u", 3, 4);
    const antes = useOmniSpatialStore.getState().posicoes.u;
    useOmniSpatialStore.getState().remover("u");
    const s = useOmniSpatialStore.getState();
    expect(s.deleted.u).toBeGreaterThan(antes._syncAt!);
    expect(
      mergeDicionario(
        { records: s.posicoes, deleted: s.deleted },
        { u: antes },
        posicaoSyncValida,
      ).records.u,
    ).toBeUndefined();
  });
  it("versão recebida no inventário não é convertida em edição local", () => {
    const e = novaEntidade("item");
    const i = useInventoryStore.getState().add("u", e);
    const remoto = { ...i, _syncAt: 10, acquiredAt: 1 };
    comEstadoRemoto(() =>
      useInventoryStore.setState({ items: { [i.instanceId]: remoto } }),
    );
    expect(useInventoryStore.getState().items[i.instanceId]._syncAt).toBe(10);
  });
  it("item removido não reaparece nem com versão maior da cópia antiga", () => {
    const e = novaEntidade("item"),
      i = useInventoryStore.getState().add("u", e);
    useInventoryStore.getState().remove(i.instanceId);
    const s = useInventoryStore.getState(),
      incoming = {
        items: { [i.instanceId]: { ...i, _syncAt: Date.now() + 1000 } },
        deleted: {},
      };
    expect(mergeInventory(s, incoming).items[i.instanceId]).toBeUndefined();
  });
  it("transferência do mesmo exemplar preserva quantidade e não cria outra instância", () => {
    const e = novaEntidade("item"),
      i = useInventoryStore.getState().add("u", e);
    const s = { items: { [i.instanceId]: i }, deleted: {} };
    const transferido = {
      ...i,
      ownerId: "a",
      _syncAt: (i._syncAt ?? i.acquiredAt) + 1,
    };
    const merged = mergeInventory(s, {
      items: { [i.instanceId]: transferido },
      deleted: {},
    });
    expect(Object.keys(merged.items)).toHaveLength(1);
    expect(merged.items[i.instanceId].ownerId).toBe("a");
  });
  it("runtime segue em versão mais recente depois de receber snapshot incompleto", () => {
    comEstadoRemoto(() =>
      useOmniRuntimeStore.setState({
        efeitos: { a: ef("a", 30), b: ef("b", 10) },
      }),
    );
    const s = useOmniRuntimeStore.getState();
    const merged = mergeDicionario(
      { records: s.efeitos, deleted: s.deleted },
      pacote({ a: ef("a", 20) }),
      efeitoSyncValido,
    );
    comEstadoRemoto(() =>
      useOmniRuntimeStore.setState({
        efeitos: merged.records,
        deleted: merged.deleted,
      }),
    );
    expect(useOmniRuntimeStore.getState().efeitos.a._syncAt).toBe(30);
    expect(useOmniRuntimeStore.getState().efeitos.b).toBeDefined();
  });
});
