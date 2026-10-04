import { EXEMPLOS_COMPONENTES_UI } from "./componentes/exemplosUI";
import type { ChaveGuia } from "./guiaDados";

const porOrigem = new Map<string, (typeof EXEMPLOS_COMPONENTES_UI)[number]>(
  EXEMPLOS_COMPONENTES_UI.map((exemplo) => [exemplo.origem, exemplo]),
);

/** Cards históricos e compostos consultam o mesmo exemplo, sem varrer o catálogo a cada render. */
export function exemploCompostoDaChave(
  chave: Pick<ChaveGuia, "id" | "aliases">,
) {
  const principal = porOrigem.get(chave.id);
  if (principal) return principal;
  for (const alias of chave.aliases) {
    const exemplo = porOrigem.get(alias);
    if (exemplo) return exemplo;
  }
  return undefined;
}
