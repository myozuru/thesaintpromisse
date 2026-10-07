import { lazy, type ComponentType } from "react";

// Após uma nova publicação, os arquivos antigos deixam de existir e o import
// dinâmico falha. Recarrega a página uma vez (no máximo a cada 15s).
export function lazyWithReload<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await loader();
    } catch (err) {
      if (typeof window !== "undefined") {
        const key = "tp-chunk-reload-at";
        const last = Number(sessionStorage.getItem(key) || 0);
        if (Date.now() - last > 15000) {
          sessionStorage.setItem(key, String(Date.now()));
          window.location.reload();
          return new Promise<never>(() => {});
        }
      }
      throw err;
    }
  });
}
