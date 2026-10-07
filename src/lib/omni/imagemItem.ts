/**
 * Imagens de itens/armas do OMNI: guardadas pequenas (data URL) dentro da
 * própria entidade para viajarem com o catálogo e o multiplayer.
 */
import type { EntidadeOmni } from './tipos';
import type { Character } from '@/types';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { exemplarArma } from './exemplarArma';

const LADO = 192;

/** Reduz a imagem escolhida para um quadrado leve (webp). */
export async function reduzirImagemItem(file: Blob): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error('Imagem inválida.')); i.src = url;
    });
    const escala = Math.min(1, LADO / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * escala)), h = Math.max(1, Math.round(img.naturalHeight * escala));
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Não foi possível processar a imagem.');
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/webp', 0.85);
  } finally { URL.revokeObjectURL(url); }
}

/** Imagem atual da entidade (catálogo vivo vence o snapshot do inventário). */
export function imagemDaEntidade(ent: Pick<EntidadeOmni, 'id' | 'imagem'> | undefined | null): string | undefined {
  if (!ent) return undefined;
  return useOmniEntidadesStore.getState().entidades[ent.id]?.imagem ?? ent.imagem;
}

/** Imagem da arma na mão principal (ou secundária) do personagem. */
export function imagemArmaEmpunhada(c: Pick<Character, 'id' | 'mainHandWeaponName' | 'mainHandWeaponInstanceId' | 'offHandWeaponName' | 'offHandWeaponInstanceId'>): string | undefined {
  const inv = useInventoryStore.getState().items;
  for (const [nome, id] of [[c.mainHandWeaponName, c.mainHandWeaponInstanceId], [c.offHandWeaponName, c.offHandWeaponInstanceId]] as const) {
    if (!nome) continue;
    const item = id && !id.startsWith('legacy:') ? inv[id] : exemplarArma(c.id, nome);
    const img = item && imagemDaEntidade(item.entity);
    if (img) return img;
  }
  return undefined;
}

const cacheUrl = new Map<string, HTMLImageElement>();
/** Imagem pronta para desenhar no canvas, ou null enquanto carrega. */
export function imagemPronta(src: string | undefined): HTMLImageElement | null {
  if (!src) return null;
  let img = cacheUrl.get(src);
  if (!img) { img = new Image(); img.src = src; cacheUrl.set(src, img); }
  return img.complete && img.naturalWidth > 0 ? img : null;
}