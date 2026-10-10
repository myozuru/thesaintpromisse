import { assetCache } from "@/components/mapa/assetCache";
import { assetDB } from "@/components/mapa/assetDB";
import { getSocket } from "@/lib/socket";
import { hasWorkspaceCloud, supabase } from "@/integrations/supabase/safeClient";

function blobBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      resolve(value.includes(",") ? value.slice(value.indexOf(",") + 1) : value);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Não foi possível ler o asset."));
    reader.readAsDataURL(blob);
  });
}

function blobFromBase64(data: string, mime: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

function blobFromSocket(value: unknown, mime: string): Blob | null {
  if (value instanceof ArrayBuffer) return new Blob([value], { type: mime });
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    const bytes = new Uint8Array(view.byteLength);
    bytes.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
    return new Blob([bytes.buffer as ArrayBuffer], { type: mime });
  }
  if (value && typeof value === "object" && "data" in value && Array.isArray((value as { data?: unknown }).data)) {
    const bytes = Uint8Array.from((value as { data: number[] }).data);
    return new Blob([bytes.buffer as ArrayBuffer], { type: mime });
  }
  return null;
}

export async function salvarAssetFicha(blob: Blob): Promise<string> {
  const id = await assetCache.put(blob, blob.type);
  const registro = await assetDB.get(id);
  if (!registro) throw new Error("A imagem foi selecionada, mas não foi armazenada localmente.");
  const socket = getSocket();
  socket?.emit("asset:put", { id, buffer: await registro.blob.arrayBuffer(), mime: registro.mime });
  if (hasWorkspaceCloud) {
    try {
      const data_base64 = await blobBase64(registro.blob);
      const { error } = await supabase.from("realtime_assets").upsert({ id, mime: registro.mime, data_base64 });
      if (error) console.warn("[invocacao] falha ao publicar imagem da ficha:", error.message);
    } catch (error) {
      console.warn("[invocacao] falha ao publicar imagem da ficha:", error);
    }
  }
  return id;
}

export async function carregarAssetFicha(id: string): Promise<void> {
  try { if (await assetCache.load(id)) return; } catch { /* tenta a fonte compartilhada mesmo quando IndexedDB está indisponível */ }
  if (hasWorkspaceCloud) {
    try {
      const { data } = await supabase.from("realtime_assets").select("id,mime,data_base64").eq("id", id).maybeSingle();
      if (data && typeof data.data_base64 === "string") {
        await assetCache.putWithId(id, blobFromBase64(data.data_base64, data.mime || "application/octet-stream"), data.mime);
        return;
      }
    } catch (error) {
      console.warn("[invocacao] falha ao carregar imagem da ficha pelo Cloud:", error);
    }
  }
  const socket = getSocket();
  if (!socket) return;
  await new Promise<void>((resolve) => {
    let concluido = false;
    const finalizar = () => {
      if (concluido) return;
      concluido = true;
      clearTimeout(timer);
      socket.off("asset:put", onAssetPut);
      resolve();
    };
    const onAssetPut = (payload: { id?: unknown; buffer?: unknown; mime?: string }) => {
      if (payload.id !== id) return;
      const blob = blobFromSocket(payload.buffer, payload.mime || "application/octet-stream");
      if (!blob) return;
      void assetCache.putWithId(id, blob, payload.mime).finally(finalizar);
    };
    const timer = setTimeout(finalizar, 3000);
    socket.on("asset:put", onAssetPut);
    socket.emit("asset:request", { ids: [id] });
  });
}
