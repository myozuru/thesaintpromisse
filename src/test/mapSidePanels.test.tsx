// @vitest-environment jsdom
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PartyPanel } from "@/components/mapa/ui/PartyPanel";
import { ToolRail } from "@/components/mapa/ui/ToolRail";
import { ficha, montarMesa, comoTela } from "./helpers/mesaReal";
import { useMapStore, type ToolId } from "@/stores/useMapStore";

vi.mock("@/components/fichas/CharacterCard", () => ({
  CharacterCard: ({ character }: { character: { name: string } }) => {
    const [draft, setDraft] = useState("");
    return (
      <div>
        <h3>{character.name}</h3>
        <input
          aria-label="Anotação em edição"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </div>
    );
  },
}));
vi.mock("@/components/mapa/ui/ShikigamiOwnerPanel", () => ({
  ShikigamiOwnerPanel: () => <h3>Invocação selecionada</h3>,
}));
vi.mock("@/components/mapa/ui/OpportunityRailButton", () => ({
  OpportunityRailButton: () => null,
}));

beforeEach(() => {
  cleanup();
  montarMesa([ficha("dono", { name: "Meu personagem", profileId: "perfil-dono" })], {
    dono: [2, 2],
  });
  comoTela({ role: "PLAYER", profileId: "perfil-dono" });
  useMapStore.getState().setSettingsPanelOpen(false);
});

describe("painéis laterais do mapa", () => {
  it("recolhe os controles da esquerda e mantém a ferramenta ativa ao reabrir", () => {
    function Rail() {
      const [collapsed, setCollapsed] = useState(false);
      const [tool, setTool] = useState<ToolId>("measure");
      return (
        <ToolRail
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
          activeTool={tool}
          shape="RECT"
          onSelectTool={setTool}
          onPickShape={() => {}}
          layerPanelOpen={false}
          setLayerPanelOpen={() => {}}
        />
      );
    }
    render(<Rail />);
    expect(
      screen.getByRole("button", { name: "Régua (segure R)" }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Recolher ferramentas do mapa" }));
    expect(screen.queryByRole("button", { name: "Régua (segure R)" })).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "Expandir ferramentas do mapa" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Expandir ferramentas do mapa" }));
    expect(
      screen.getByRole("button", { name: "Régua (segure R)" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("alterna controlador e invocação sem sobrepor painéis nem perder a edição local", () => {
    const token = {
      id: "invocacao",
      shape: "ELLIPSE" as const,
      x: 70,
      y: 140,
      w: 70,
      h: 70,
      rotation: 0,
      color: "#994cf0",
      locked: false,
      ownerCharId: "dono",
      invocationId: "shikigami",
    };
    useMapStore.getState().addEntity(token);
    render(<PartyPanel collapsed={false} onToggleCollapsed={() => {}} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Anotação em edição" }), {
      target: { value: "rascunho preservado" },
    });
    act(() => useMapStore.getState().setSelected(["invocacao"]));
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(
      within(screen.getByRole("tabpanel")).getByRole("heading", { name: "Invocação selecionada" }),
    ).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Controlador" }), {
      button: 0,
      ctrlKey: false,
    });
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(
      screen.getByRole<HTMLInputElement>("textbox", { name: "Anotação em edição" }).value,
    ).toBe("rascunho preservado");
    expect(screen.queryByRole("heading", { name: "Invocação selecionada" })).toBeNull();
  });

  it("não mostra a invocação de outro jogador ao perfil atual", () => {
    useMapStore
      .getState()
      .addEntity({
        id: "alheia",
        shape: "ELLIPSE",
        x: 70,
        y: 140,
        w: 70,
        h: 70,
        rotation: 0,
        color: "#994cf0",
        locked: false,
        ownerCharId: "outro",
        invocationId: "shikigami",
      });
    useMapStore.getState().setSelected(["alheia"]);
    render(<PartyPanel collapsed={false} onToggleCollapsed={() => {}} />);
    expect(screen.queryByRole("tab", { name: "Invocação" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Meu personagem" })).toBeTruthy();
  });
});
