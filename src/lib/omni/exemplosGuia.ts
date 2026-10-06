import { EXEMPLOS_COMPONENTES_UI } from "./componentes/exemplosUI";
import type { ChaveGuia } from "./guiaDados";

const porOrigem = new Map<string, (typeof EXEMPLOS_COMPONENTES_UI)[number]>(
  EXEMPLOS_COMPONENTES_UI.map((exemplo) => [exemplo.origem, exemplo]),
);

type ExemploContextual = {
  origem: string;
  modelo: string;
  formula: string;
  explicacao: string;
};

const exemplosDeContexto: Record<string, ExemploContextual> = {
  "DANO.vida_perdida": {
    origem: "DANO.vida_perdida",
    modelo: "vida realmente perdida",
    formula:
      "se @DANO.vida_perdida > 0 entao somar 1 em @USUARIO.contador rancor ate @USUARIO.treino",
    explicacao:
      "Use esta condição dentro do gatilho Ao Sofrer Dano quando uma passiva só deve reagir à perda real de PV. Se o golpe resolver 12 de dano, mas escudo e vida temporária absorverem tudo, vida_perdida vale 0 e Rancor não aumenta. Se 5 PV forem retirados da Vida normal, a condição passa e soma 1 carga, respeitando o teto de Treino. O valor mede PV removidos, não o dano bruto nem o dano que só atingiu proteções.",
  },
};

/** Cards históricos e compostos consultam o mesmo exemplo, sem varrer o catálogo a cada render. */
export function exemploCompostoDaChave(
  chave: Pick<ChaveGuia, "id" | "aliases">,
) {
  const contextual = exemplosDeContexto[chave.id];
  if (contextual) return contextual;
  const principal = porOrigem.get(chave.id);
  if (principal) return principal;
  for (const alias of chave.aliases) {
    const exemplo = porOrigem.get(alias);
    if (exemplo) return exemplo;
  }
  return undefined;
}
