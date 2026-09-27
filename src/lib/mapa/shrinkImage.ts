/**
 * Reduz imagens pesadas antes de entrarem no mapa, para que carreguem e
 * sincronizem com todos. GIFs e imagens leves passam intactos.
 */
const MAX_BYTES = 1.5 * 1024 * 1024;
const MAX_SIDE = 4096;

function loadImage(file: Blob, timeoutMs = 20000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const done = (v: HTMLImageElement | null) => {
      clearTimeout(t);
      resolve(v);
    };
    const t = setTimeout(() => done(null), timeoutMs);
    img.onload = () => done(img);
    img.onerror = () => done(null);
    img.src = url;
  });
}

export async function shrinkImageFile(file: File): Promise<Blob> {
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  if (file.size <= MAX_BYTES) return file;
  const img = await loadImage(file);
  if (!img) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(img.src);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.85));
  return blob && blob.size < file.size ? blob : file;
}
