/**
 * Blindagem do localStorage para a hidratação do zustand/persist.
 *
 * Problemas observados ao abrir o app em nova guia:
 *  - JSON corrompido em alguma chave `*-storage` → JSON.parse throws → React crash → tela preta.
 *  - Quota cheia → setItem throws → re-render explode.
 *  - Safari/Brave bloqueiam storage em contextos específicos.
 *
 * Esta blindagem:
 *  - Captura erros de parse em getItem e, se a chave for de um store persistido (`*-storage`),
 *    remove a chave corrompida e devolve null (zustand usa o estado inicial).
 *  - Captura QuotaExceeded em setItem (silencioso — vira best-effort).
 *  - Captura SecurityError quando localStorage está bloqueado.
 */
export function installSafeLocalStorage() {
  if (typeof window === "undefined") return;
  let ls: Storage;
  try {
    ls = window.localStorage;
  } catch {
    // Storage totalmente bloqueado — instala stub em memória.
    const mem = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
        setItem: (k: string, v: string) => mem.set(k, String(v)),
        removeItem: (k: string) => mem.delete(k),
        clear: () => mem.clear(),
        key: (i: number) => Array.from(mem.keys())[i] ?? null,
        get length() {
          return mem.size;
        },
      },
      configurable: true,
    });
    console.warn("[safeLocalStorage] localStorage bloqueado — usando stub em memória.");
    return;
  }

  const originalGet = ls.getItem.bind(ls);
  const originalSet = ls.setItem.bind(ls);

  ls.getItem = function (key: string) {
    try {
      const raw = originalGet(key);
      if (raw == null) return raw;
      // Valida JSON apenas para chaves de stores persistidos (convenção `*-storage`).
      if (key.endsWith("-storage") || key.endsWith("-store")) {
        try {
          JSON.parse(raw);
        } catch (parseErr) {
          console.warn(
            `[safeLocalStorage] JSON corrompido em "${key}" — removendo e usando estado inicial.`,
            parseErr,
          );
          try {
            ls.removeItem(key);
          } catch {
            /* noop */
          }
          return null;
        }
      }
      return raw;
    } catch (err) {
      console.warn(`[safeLocalStorage] getItem("${key}") falhou:`, err);
      return null;
    }
  };

  ls.setItem = function (key: string, value: string) {
    try {
      originalSet(key, value);
    } catch (err) {
      console.warn(
        `[safeLocalStorage] setItem("${key}") falhou (provável quota cheia):`,
        err,
      );
      // Best-effort: tenta liberar espaço removendo a própria chave antes de propagar silenciosamente.
      try {
        ls.removeItem(key);
        originalSet(key, value);
      } catch {
        /* desiste silenciosamente — melhor sem persistência do que crash */
      }
    }
  };
}
