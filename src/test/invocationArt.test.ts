import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assetDB } from "@/components/mapa/assetDB";
import { assetCache } from "@/components/mapa/assetCache";
import { prepararArteInvocacao } from "@/lib/controlador/assetFicha";

vi.mock("@/components/mapa/assetDB", () => ({ assetDB: { get: vi.fn() } }));
vi.mock("@/lib/socket", () => ({ getSocket: () => null }));
vi.mock("@/integrations/supabase/safeClient", () => ({ hasWorkspaceCloud: false, supabase: {} }));

const decode = vi.fn<() => Promise<void>>();
class TestImage {
  naturalWidth = 100;
  naturalHeight = 100;
  src = "";
  onload = null;
  onerror = null;
  decode = decode;
}

beforeEach(() => {
  vi.stubGlobal("Image", TestImage);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:invocation-test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  decode.mockReset().mockResolvedValue();
  vi.mocked(assetDB.get).mockReset();
});
afterEach(() => {
  assetCache.releaseAll();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("arte de invocação pronta para o mapa", () => {
  it("aguarda a decodificação da imagem antes de liberar o posicionamento", async () => {
    vi.mocked(assetDB.get).mockResolvedValue({
      id: "arte",
      blob: new Blob(["png"]),
      mime: "image/png",
      createdAt: 0,
    });
    let concluir!: () => void;
    decode.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          concluir = resolve;
        }),
    );
    let preparada = false;
    const pending = prepararArteInvocacao({ nome: "Cão", imagemAssetId: "arte" }).then(() => {
      preparada = true;
    });
    await vi.waitFor(() => expect(decode).toHaveBeenCalled());
    expect(preparada).toBe(false);
    concluir();
    await pending;
    expect(assetCache.get("arte")?.ready).toBe(true);
  });

  it("carrega novamente uma imagem que antes não estava disponível no armazenamento", async () => {
    vi.mocked(assetDB.get).mockResolvedValueOnce(undefined);
    expect(await assetCache.load("arte")).toBeNull();
    vi.mocked(assetDB.get).mockResolvedValueOnce({
      id: "arte",
      blob: new Blob(["png"]),
      mime: "image/png",
      createdAt: 0,
    });
    await prepararArteInvocacao({ nome: "Cão", imagemAssetId: "arte" });
    expect(assetCache.get("arte")?.ready).toBe(true);
    expect(assetDB.get).toHaveBeenCalledTimes(2);
  });

  it("usa a imagem alternativa quando a principal está indisponível", async () => {
    vi.mocked(assetDB.get).mockImplementation(async (id) =>
      id === "alternativa"
        ? { id, blob: new Blob(["png"]), mime: "image/png", createdAt: 0 }
        : undefined,
    );
    await prepararArteInvocacao({
      nome: "Cão",
      imagemAssetId: "principal",
      imagemFallbackAssetId: "alternativa",
    });
    expect(assetCache.get("alternativa")?.ready).toBe(true);
  });

  it("informa a falha de imagem em vez de liberar silenciosamente uma peça sem arte", async () => {
    vi.mocked(assetDB.get).mockResolvedValue({
      id: "arte",
      blob: new Blob(["png"]),
      mime: "image/png",
      createdAt: 0,
    });
    decode.mockRejectedValue(new Error("arquivo inválido"));
    await expect(prepararArteInvocacao({ nome: "Cão", imagemAssetId: "arte" })).rejects.toThrow(
      "A imagem de Cão não pôde ser carregada.",
    );
    expect(assetCache.get("arte")?.ready).toBe(false);
  });
});
