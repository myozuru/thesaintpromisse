import { describe, expect, it, vi } from "vitest";
import type { Character } from "@/types";
import type { Entity } from "@/stores/useMapStore";
import type { InvocacaoControlador } from "@/lib/controlador/tipos";
import { drawInvocationPlacementPreview } from "@/components/mapa/InvocationPlacementPreview";
import { drawEntity } from "@/components/mapa/EntityEngine";
import { resolverTokenControladorDaFicha } from "@/lib/mapa/tokenDaFicha";

vi.mock("@/components/mapa/EntityEngine", () => ({ drawEntity: vi.fn() }));

function fixture() {
  const model: InvocacaoControlador = {
    id: "sombra",
    donoCharacterId: "dono",
    nome: "Cão",
    tipo: "shikigami",
    hpAtual: 25,
    hpMaximo: 25,
    defesa: 12,
    deslocamentoM: 6,
    porte: "Médio",
    custoInvocacaoPE: 2,
    alcanceInvocacaoM: 1,
    acoes: [],
    imagemAssetId: "imagem-carregada",
    imagemFallbackAssetId: "imagem-alternativa",
    tokenCrop: { zoom: 2, offsetX: 20, offsetY: -10 },
  };
  const owner: Entity = {
    id: "controlador",
    characterId: "dono",
    shape: "ELLIPSE",
    x: 140,
    y: 210,
    w: 70,
    h: 70,
    rotation: 0,
    color: "#994cf0",
    locked: false,
  };
  const characters = [
    { id: "dono", profileId: "perfil", invocacoesConhecidas: [model] },
  ] as Character[];
  const state: Parameters<typeof drawInvocationPlacementPreview>[1] = {
    entities: { [owner.id]: owner },
    layerVisible: { tokens: true, map: true, gm: true },
    walls: [],
    gridConfig: {
      type: "SQUARE",
      dpi: 70,
      metersPerCell: 1,
      snapping: true,
      snappingSensitivity: 1,
      useCorners: false,
      useCenter: true,
      lineType: "solid",
      lineWidth: 1,
      color: "#994cf0",
      opacity: 1,
      measurementStyle: "EUCLIDEAN",
      visible: true,
    },
    pendingInvocationPlacement: {
      ownerCharacterId: "dono",
      items: [{ invocationId: "sombra", label: "Cão", alcanceM: 1, color: "#994cf0" }],
      placements: [],
    },
  };
  const methods = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    strokeText: vi.fn(),
    fillText: vi.fn(),
    rect: vi.fn(),
    ellipse: vi.fn(),
  };
  return {
    state,
    characters,
    owner,
    model,
    ctx: methods as unknown as CanvasRenderingContext2D,
    methods,
  };
}

describe("prévia de posicionamento da invocação", () => {
  it("mostra o círculo imediatamente sem depender da posição do cursor", () => {
    const { ctx, state, characters, methods } = fixture();
    drawInvocationPlacementPreview(ctx, state, characters, null, 1);
    expect(methods.arc).toHaveBeenCalledWith(140, 210, 70, 0, Math.PI * 2);
    expect(methods.fillText).toHaveBeenCalledWith("Alcance de invocação: 1 m", 140, 132);
  });

  it("segue o avatar ativo, inclusive após ele se mover, em vez de uma peça antiga", () => {
    const { ctx, state, characters, owner, methods } = fixture();
    state.entities.avatar = {
      ...owner,
      id: "avatar",
      characterId: undefined,
      avatarProfileId: "perfil",
      x: 420,
      y: 490,
    };
    drawInvocationPlacementPreview(ctx, state, characters, null, 1);
    expect(methods.arc).toHaveBeenLastCalledWith(420, 490, 70, 0, Math.PI * 2);
    state.entities.avatar = { ...state.entities.avatar, x: 560, y: 630 };
    drawInvocationPlacementPreview(ctx, state, characters, null, 1);
    expect(methods.arc).toHaveBeenLastCalledWith(560, 630, 70, 0, Math.PI * 2);
  });

  it("usa a arte, formato circular e enquadramento salvos na ficha na prévia", () => {
    const { ctx, state, characters, model } = fixture();
    drawInvocationPlacementPreview(ctx, state, characters, { x: 210, y: 210 }, 1);
    expect(drawEntity).toHaveBeenLastCalledWith(
      ctx,
      expect.objectContaining({
        shape: "ELLIPSE",
        assetId: "imagem-carregada",
        invocationFallbackAssetId: "imagem-alternativa",
        tokenCrop: model.tokenCrop,
        x: 210,
        y: 210,
      }),
      1,
    );
  });

  it("distingue uma posição fora do alcance de uma posição válida", () => {
    const { ctx, state, characters, methods } = fixture();
    drawInvocationPlacementPreview(ctx, state, characters, { x: 280, y: 210 }, 1);
    expect(methods.fillText).toHaveBeenLastCalledWith(
      expect.stringContaining("Fora do alcance"),
      280,
      expect.any(Number),
    );
    drawInvocationPlacementPreview(ctx, state, characters, { x: 210, y: 210 }, 1);
    expect(methods.fillText).toHaveBeenLastCalledWith(
      expect.stringContaining("Clique para invocar"),
      210,
      expect.any(Number),
    );
  });

  it("não aceita um avatar ligado a outra ficha nem uma invocação como controlador", () => {
    const { state, characters, owner } = fixture();
    state.entities.avatar = {
      ...owner,
      id: "avatar",
      characterId: "outro",
      avatarProfileId: "perfil",
    };
    state.entities.servo = {
      ...owner,
      id: "servo",
      invocationId: "sombra",
      avatarProfileId: "perfil",
    };
    expect(
      resolverTokenControladorDaFicha(characters[0], state.entities, state.layerVisible)?.id,
    ).toBe("controlador");
  });
});
